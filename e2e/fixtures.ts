import {
  test as base,
  type BrowserContext,
  type FrameLocator,
  type Page,
  type Worker,
  chromium,
} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    };
  };
}

export interface ExtensionTestFixtures {
  readonly context: BrowserContext;
  readonly serviceWorker: Worker;
  readonly openSwitcher: (targetPage: Page) => Promise<FrameLocator>;
  readonly switcherFrame: (targetPage: Page) => FrameLocator;
  readonly getActiveTabTitle: () => Promise<string | undefined>;
  readonly getExtensionId: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
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
          throw new Error('Invalid manifest.json: host_permissions must be an array of strings');
        }
        existingHostPermissions = parsed.host_permissions;
      }

      const targetPermission = 'http://localhost/*';
      const updatedHostPermissions = existingHostPermissions.includes(targetPermission)
        ? existingHostPermissions
        : [...existingHostPermissions, targetPermission];

      const patchedManifest: Record<string, unknown> = {
        ...parsed,
        host_permissions: updatedHostPermissions,
      };

      fs.writeFileSync(manifestPath, JSON.stringify(patchedManifest, null, 2));

      const isHeadless = !(process.env.HEADED === '1' || process.env.HEADED === 'true');
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
    const fn = async (targetPage: Page): Promise<FrameLocator> => {
      await targetPage.bringToFront();
      await serviceWorker.evaluate(async () => {
        if (globalThis.__avyTriggerOpen) {
          await globalThis.__avyTriggerOpen();
        }
      });

      const frame = targetPage.frameLocator('#avy-tab-switcher-root iframe');
      await frame.locator('.switcher-overlay').waitFor({ state: 'visible', timeout: 5000 });
      await targetPage.locator('#avy-tab-switcher-root iframe').focus();
      return frame;
    };

    await use(fn);
  },

  switcherFrame: async ({}, use) => {
    const fn = (targetPage: Page): FrameLocator => {
      return targetPage.frameLocator('#avy-tab-switcher-root iframe');
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

  getExtensionId: async ({ serviceWorker }, use) => {
    const fn = (): string => {
      const swUrl = serviceWorker.url();
      const match = swUrl.match(/chrome-extension:\/\/([a-z0-9]+)\//);
      if (!match || !match[1]) {
        throw new Error(`Could not parse extension ID from SW URL: ${swUrl}`);
      }
      return match[1];
    };
    await use(fn);
  },
});

export { expect } from '@playwright/test';
