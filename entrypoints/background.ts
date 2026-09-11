import { browser } from 'wxt/browser';
import {
  openCurrentWindowSwitcher,
  type SwitcherBackgroundPort,
} from '../src/application/background';
import {
  isActivateTabMessage,
  type ActivateTabResult,
} from '../src/application/messages';
import {
  activateTabInWindow,
  type BrowserTabData,
  type TabActivationPort,
} from '../src/application/tab-operations';

function extractBrowserTabData(tab: {
  readonly id?: number | undefined;
  readonly windowId?: number | undefined;
  readonly title?: string | undefined;
  readonly url?: string | undefined;
  readonly favIconUrl?: string | undefined;
  readonly lastAccessed?: number | undefined;
}): BrowserTabData {
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

export default defineBackground(() => {
  const switcherPort: SwitcherBackgroundPort = {
    queryActiveTab: async (): Promise<BrowserTabData | null> => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const active = tabs[0];
      if (!active) {
        return null;
      }
      return extractBrowserTabData(active);
    },
    queryWindowTabs: async (windowId: number): Promise<readonly BrowserTabData[]> => {
      const tabs = await browser.tabs.query({ windowId });
      return tabs.map(extractBrowserTabData);
    },
    sendOpenMessage: async (tabId, message): Promise<void> => {
      await browser.tabs.sendMessage(tabId, message);
    },
    injectSwitcher: async (tabId): Promise<void> => {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['/switcher.js'],
      });
    },
  };

  browser.commands.onCommand.addListener((command) => {
    if (command === 'open-switcher') {
      openCurrentWindowSwitcher(switcherPort).catch((err: unknown) => {
        console.error('[Avy] Unexpected error opening switcher:', err);
      });
    }
  });

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (!isActivateTabMessage(message)) {
      return;
    }

    return (async (): Promise<ActivateTabResult> => {
      const senderWindowId = sender.tab?.windowId;
      if (
        typeof senderWindowId !== 'number' ||
        !Number.isInteger(senderWindowId) ||
        senderWindowId < 0
      ) {
        return { ok: false, reason: 'unexpected' };
      }

      const activationPort: TabActivationPort = {
        get: async (targetTabId: number): Promise<BrowserTabData> => {
          const tab = await browser.tabs.get(targetTabId);
          return extractBrowserTabData(tab);
        },
        activate: async (targetTabId: number): Promise<void> => {
          await browser.tabs.update(targetTabId, { active: true });
        },
      };

      return activateTabInWindow(activationPort, message.tabId, senderWindowId);
    })();
  });
});
