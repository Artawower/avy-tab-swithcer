import { browser } from 'wxt/browser';
import {
  handleActivateTabRequest,
  handleCloseSwitcherSession,
  handleHeartbeatSwitcherSession,
  handleRequestSwitcherData,
  openCurrentWindowSwitcher,
  type MessageSenderInfo,
  type SwitcherBackgroundPort,
} from '../src/application/background';
import {
  isActivateTabMessage,
  isCloseSwitcherSessionMessage,
  isHeartbeatSwitcherSessionMessage,
  isRequestSwitcherDataMessage,
  type ActivateTabResult,
  type HeartbeatSwitcherSessionResult,
  type RequestSwitcherDataResult,
} from '../src/application/messages';
import { createSessionStore } from '../src/application/sessions';
import { type BrowserTabData, type TabActivationPort } from '../src/application/tab-operations';

declare global {
  var __avyTriggerOpen: (() => Promise<unknown>) | undefined;
}

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

function extractMessageSenderInfo(sender: {
  readonly tab?:
    { readonly id?: number | undefined; readonly windowId?: number | undefined } | undefined;
  readonly frameId?: number | undefined;
  readonly documentId?: string | undefined;
  readonly url?: string | undefined;
}): MessageSenderInfo {
  const info: {
    tab?: { id?: number; windowId?: number };
    frameId?: number;
    documentId?: string;
    url?: string;
  } = {};

  if (sender.tab) {
    info.tab = {};
    if (sender.tab.id !== undefined) info.tab.id = sender.tab.id;
    if (sender.tab.windowId !== undefined) info.tab.windowId = sender.tab.windowId;
  }
  if (sender.frameId !== undefined) info.frameId = sender.frameId;
  if (sender.documentId !== undefined) info.documentId = sender.documentId;
  if (sender.url !== undefined) info.url = sender.url;

  return info;
}

export default defineBackground(() => {
  const sessionStore = createSessionStore();
  const expectedFrameUrl = browser.runtime.getURL('/frame.html');

  const queryWindowTabs = async (windowId: number): Promise<readonly BrowserTabData[]> => {
    const tabs = await browser.tabs.query({ windowId });
    return tabs.map(extractBrowserTabData);
  };

  const switcherPort: SwitcherBackgroundPort = {
    queryActiveTab: async (): Promise<BrowserTabData | null> => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const active = tabs[0];
      if (!active) {
        return null;
      }
      return extractBrowserTabData(active);
    },
    sendOpenHostMessage: async (tabId, message): Promise<void> => {
      await browser.tabs.sendMessage(tabId, message);
    },
    injectSwitcher: async (tabId): Promise<void> => {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['/switcher.js'],
      });
    },
    getFrameUrl: (sessionId: string): string => {
      return browser.runtime.getURL(`/frame.html?sessionId=${encodeURIComponent(sessionId)}`);
    },
    sessionStore,
  };

  const triggerOpen = async (): Promise<unknown> => {
    sessionStore.cleanupExpired();
    return openCurrentWindowSwitcher(switcherPort);
  };

  globalThis.__avyTriggerOpen = triggerOpen;

  browser.commands.onCommand.addListener((command) => {
    if (command === 'open-switcher') {
      triggerOpen().catch((err: unknown) => {
        console.error('[Avy] Unexpected error opening switcher:', err);
      });
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    sessionStore.removeTabSessions(tabId);
  });

  browser.runtime.onMessage.addListener(
    (
      message: unknown,
      sender,
      sendResponse: (
        response: ActivateTabResult | RequestSwitcherDataResult | HeartbeatSwitcherSessionResult,
      ) => void,
    ) => {
      const senderInfo = extractMessageSenderInfo(sender);

      if (isRequestSwitcherDataMessage(message)) {
        handleRequestSwitcherData(
          sessionStore,
          queryWindowTabs,
          message,
          senderInfo,
          expectedFrameUrl,
        )
          .then(sendResponse)
          .catch((err: unknown) => {
            console.error('[Avy] Unexpected error querying switcher data:', err);
            sendResponse({ ok: false, reason: 'unexpected' });
          });
        return true;
      }

      if (isActivateTabMessage(message)) {
        const activationPort: TabActivationPort = {
          get: async (targetTabId: number): Promise<BrowserTabData> => {
            const tab = await browser.tabs.get(targetTabId);
            return extractBrowserTabData(tab);
          },
          activate: async (targetTabId: number): Promise<void> => {
            await browser.tabs.update(targetTabId, { active: true });
          },
        };

        handleActivateTabRequest(
          sessionStore,
          activationPort,
          message,
          senderInfo,
          expectedFrameUrl,
        )
          .then(sendResponse)
          .catch((err: unknown) => {
            console.error('[Avy] Unexpected error activating tab:', err);
            sendResponse({ ok: false, reason: 'unexpected' });
          });
        return true;
      }

      if (isHeartbeatSwitcherSessionMessage(message)) {
        const result = handleHeartbeatSwitcherSession(
          sessionStore,
          message,
          senderInfo,
          expectedFrameUrl,
        );
        sendResponse(result);
        return false;
      }

      if (isCloseSwitcherSessionMessage(message)) {
        handleCloseSwitcherSession(sessionStore, message, senderInfo, expectedFrameUrl);
        return false;
      }

      return false;
    },
  );
});
