import {
  test as base,
  type BrowserContext,
  type Page,
  type Worker,
  chromium,
} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { OpenSwitcherMessage } from '../src/application/messages';
import {
  getCurrentWindowTabs,
  type BrowserTabData,
} from '../src/application/tab-operations';

declare global {
  interface ChromeTab {
    readonly id?: number | undefined;
    readonly windowId?: number | undefined;
    readonly title?: string | undefined;
    readonly url?: string | undefined;
    readonly favIconUrl?: string | undefined;
    readonly lastAccessed?: number | undefined;
    readonly active?: boolean | undefined;
  }

  const chrome: {
    readonly runtime: {
      readonly getManifest: () => { readonly name: string };
    };
    readonly tabs: {
      readonly query: (queryInfo: {
        readonly active?: boolean | undefined;
        readonly currentWindow?: boolean | undefined;
        readonly windowId?: number | undefined;
      }) => Promise<readonly ChromeTab[]>;
      readonly sendMessage: (tabId: number, message: unknown) => Promise<void>;
      readonly update: (
        tabId: number,
        updateProperties: { readonly active: boolean },
      ) => Promise<ChromeTab>;
    };
    readonly scripting: {
      readonly executeScript: (injection: {
        readonly target: { readonly tabId: number };
        readonly files: readonly string[];
      }) => Promise<unknown>;
    };
  };
}

function toBrowserTabData(tab: ChromeTab): BrowserTabData {
  const data: {
    id?: number;
    windowId?: number;
    title?: string;
    url?: string;
    favIconUrl?: string;
    lastAccessed?: number;
  } = {};

  if (tab.id !== undefined) data.id = tab.id;
  if (tab.windowId !== undefined) data.windowId = tab.windowId;
  if (tab.title !== undefined) data.title = tab.title;
  if (tab.url !== undefined) data.url = tab.url;
  if (tab.favIconUrl !== undefined) data.favIconUrl = tab.favIconUrl;
  if (tab.lastAccessed !== undefined) data.lastAccessed = tab.lastAccessed;

  return data;
}

export interface ExtensionTestFixtures {
  readonly context: BrowserContext;
  readonly serviceWorker: Worker;
  readonly openSwitcher: (targetPage: Page) => Promise<void>;
  readonly getActiveTabTitle: () => Promise<string | undefined>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export const test = base.extend<ExtensionTestFixtures>({
  context: async ({}, use) => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'avy-ext-test-'));
    let context: BrowserContext | null = null;

    try {
      const extensionDir = path.join(tempRoot, 'extension');
      const userDataDir = path.join(tempRoot, 'user-data');
      const originalExtensionDir = path.resolve('.output/chrome-mv3');

      fs.cpSync(originalExtensionDir, extensionDir, { recursive: true });

      // In Chrome MV3, programmatic chrome.scripting.executeScript on test HTTP tabs requires
      // host permission when activeTab has not been triggered by a real browser command accelerator.
      // We patch localhost host permissions only on the isolated temp copy.
      const manifestPath = path.join(extensionDir, 'manifest.json');
      const rawManifest = fs.readFileSync(manifestPath, 'utf-8');
      const parsed: unknown = JSON.parse(rawManifest);

      if (!isRecord(parsed)) {
        throw new Error('Invalid manifest.json: root must be a JSON object');
      }

      let existingHostPermissions: readonly string[] = [];
      if ('host_permissions' in parsed && parsed.host_permissions !== undefined) {
        if (!isStringArray(parsed.host_permissions)) {
          throw new Error(
            'Invalid manifest.json: host_permissions must be an array of strings',
          );
        }
        existingHostPermissions = parsed.host_permissions;
      }

      const targetPermission = 'http://localhost/*';
      const updatedHostPermissions = existingHostPermissions.includes(
        targetPermission,
      )
        ? existingHostPermissions
        : [...existingHostPermissions, targetPermission];

      const patchedManifest: Record<string, unknown> = {
        ...parsed,
        host_permissions: updatedHostPermissions,
      };

      fs.writeFileSync(manifestPath, JSON.stringify(patchedManifest, null, 2));

      const isHeadless = Boolean(process.env.CI || process.env.HEADLESS);
      const args = [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
      ];

      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chromium',
        headless: isHeadless,
        args,
      });

      await use(context);
    } finally {
      await context?.close();
      if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  },

  serviceWorker: async ({ context }, use) => {
    let worker = context.serviceWorkers()[0];
    if (!worker) {
      worker = await context.waitForEvent('serviceworker');
    }
    await use(worker);
  },

  openSwitcher: async ({ serviceWorker }, use) => {
    // WHY: Playwright/CDP keyboard events do not reliably trigger browser-level commands accelerators (Alt+Q).
    // We bypass keyboard dispatch by querying current-window tabs from the service worker, reusing production
    // getCurrentWindowTabs for MRU ordering, injecting /switcher.js, and sending an OPEN_SWITCHER message.
    const fn = async (targetPage: Page): Promise<void> => {
      const snapshot = await serviceWorker.evaluate(async () => {
        const [active] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const windowId = active?.windowId;
        const windowTabs =
          windowId !== undefined
            ? await chrome.tabs.query({ windowId })
            : [];
        return {
          activeTab: active,
          windowTabs,
        };
      });

      const active = snapshot.activeTab;
      if (
        !active ||
        typeof active.id !== 'number' ||
        typeof active.windowId !== 'number'
      ) {
        throw new Error('No active tab found in current window');
      }

      const tabs = getCurrentWindowTabs(
        snapshot.windowTabs.map(toBrowserTabData),
        active.id,
        active.windowId,
      );

      const message: OpenSwitcherMessage = {
        type: 'OPEN_SWITCHER',
        tabs,
      };

      await serviceWorker.evaluate(
        async ({ tabId, message }) => {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['/switcher.js'],
          });
          await chrome.tabs.sendMessage(tabId, message);
        },
        { tabId: active.id, message },
      );

      await targetPage
        .locator('.switcher-overlay')
        .waitFor({ state: 'visible', timeout: 5000 });
    };

    await use(fn);
  },

  getActiveTabTitle: async ({ serviceWorker }, use) => {
    const fn = async (): Promise<string | undefined> => {
      return serviceWorker.evaluate(async () => {
        const [active] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        return active?.title;
      });
    };

    await use(fn);
  },
});

export { expect } from '@playwright/test';
