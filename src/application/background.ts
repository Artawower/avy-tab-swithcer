import type {
  ActivateTabMessage,
  ActivateTabResult,
  CloseSwitcherSessionMessage,
  HeartbeatSwitcherSessionMessage,
  HeartbeatSwitcherSessionResult,
  OpenSwitcherHostMessage,
  RequestSwitcherDataMessage,
  RequestSwitcherDataResult,
} from './messages';
import type { SessionSenderContext, SessionStore, SwitcherSession } from './sessions';
import {
  getCurrentWindowTabs,
  toSwitchableTab,
  type BrowserTabData,
  type TabActivationPort,
} from './tab-operations';

export interface SwitcherBackgroundPort {
  readonly queryActiveTab: () => Promise<BrowserTabData | null>;
  readonly sendOpenHostMessage: (tabId: number, message: OpenSwitcherHostMessage) => Promise<void>;
  readonly injectSwitcher: (tabId: number) => Promise<void>;
  readonly getFrameUrl: (sessionId: string) => string;
  readonly sessionStore: SessionStore;
}

export function isInjectablePageUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function openCurrentWindowSwitcher(
  port: SwitcherBackgroundPort,
): Promise<SwitcherSession | null> {
  const activeTab = await port.queryActiveTab();
  if (!activeTab) {
    return null;
  }

  const switchableActive = toSwitchableTab(activeTab);
  if (switchableActive === null || !isInjectablePageUrl(switchableActive.url)) {
    return null;
  }

  const session = port.sessionStore.createSession(switchableActive.id, switchableActive.windowId);
  const frameUrl = port.getFrameUrl(session.sessionId);

  const message: OpenSwitcherHostMessage = {
    type: 'OPEN_SWITCHER_HOST',
    sessionId: session.sessionId,
    frameUrl,
  };

  try {
    await port.sendOpenHostMessage(switchableActive.id, message);
    return session;
  } catch {
    // Initial send failed (host script not yet injected)
  }

  try {
    await port.injectSwitcher(switchableActive.id);
    await port.sendOpenHostMessage(switchableActive.id, message);
    return session;
  } catch {
    port.sessionStore.removeSession(session.sessionId);
    return null;
  }
}

export interface MessageSenderInfo {
  readonly tab?:
    | {
        readonly id?: number | undefined;
        readonly windowId?: number | undefined;
      }
    | undefined;
  readonly frameId?: number | undefined;
  readonly documentId?: string | undefined;
  readonly url?: string | undefined;
}

export function isExtensionFrameUrl(url?: string, expectedFrameUrl?: string): boolean {
  if (!url) {
    return !expectedFrameUrl;
  }
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/frame.html') {
      return false;
    }
    if (expectedFrameUrl) {
      const expected = new URL(expectedFrameUrl);
      return (
        parsed.protocol === expected.protocol &&
        parsed.host === expected.host &&
        parsed.pathname === expected.pathname
      );
    }
    return parsed.protocol === 'chrome-extension:' || parsed.protocol === 'moz-extension:';
  } catch {
    return false;
  }
}

export function extractSenderContext(
  sender: MessageSenderInfo,
  expectedFrameUrl?: string,
): SessionSenderContext | null {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  const frameId = sender.frameId;

  if (
    typeof tabId !== 'number' ||
    !Number.isInteger(tabId) ||
    tabId < 0 ||
    typeof windowId !== 'number' ||
    !Number.isInteger(windowId) ||
    windowId < 0 ||
    typeof frameId !== 'number' ||
    !Number.isInteger(frameId) ||
    frameId < 0
  ) {
    return null;
  }

  if (!isExtensionFrameUrl(sender.url, expectedFrameUrl)) {
    return null;
  }

  return {
    tabId,
    windowId,
    frameId,
    ...(sender.documentId ? { documentId: sender.documentId } : {}),
  };
}

export async function handleRequestSwitcherData(
  sessionStore: SessionStore,
  queryWindowTabs: (windowId: number) => Promise<readonly BrowserTabData[]>,
  message: RequestSwitcherDataMessage,
  sender: MessageSenderInfo,
  expectedFrameUrl?: string,
): Promise<RequestSwitcherDataResult> {
  const context = extractSenderContext(sender, expectedFrameUrl);
  if (!context) {
    return { ok: false, reason: 'unauthorized' };
  }

  if (!sessionStore.claimSession(message.sessionId, context)) {
    return { ok: false, reason: 'unauthorized' };
  }

  try {
    const rawTabs = await queryWindowTabs(context.windowId);
    const tabs = getCurrentWindowTabs(rawTabs, context.tabId, context.windowId);
    return { ok: true, tabs };
  } catch {
    return { ok: false, reason: 'unexpected' };
  }
}

export async function handleActivateTabRequest(
  sessionStore: SessionStore,
  activationPort: TabActivationPort,
  message: ActivateTabMessage,
  sender: MessageSenderInfo,
  expectedFrameUrl?: string,
): Promise<ActivateTabResult> {
  const context = extractSenderContext(sender, expectedFrameUrl);
  if (!context) {
    return { ok: false, reason: 'unauthorized' };
  }

  if (!sessionStore.validateSession(message.sessionId, context)) {
    return { ok: false, reason: 'unauthorized' };
  }

  try {
    const targetTab = await activationPort.get(message.tabId);
    const switchable = toSwitchableTab(targetTab);
    if (!switchable) {
      return { ok: false, reason: 'tab-unavailable' };
    }
    if (switchable.windowId !== context.windowId) {
      return { ok: false, reason: 'wrong-window' };
    }

    await activationPort.activate(message.tabId);
    sessionStore.removeSession(message.sessionId);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'tab-unavailable' };
  }
}

export function handleHeartbeatSwitcherSession(
  sessionStore: SessionStore,
  message: HeartbeatSwitcherSessionMessage,
  sender: MessageSenderInfo,
  expectedFrameUrl?: string,
): HeartbeatSwitcherSessionResult {
  const context = extractSenderContext(sender, expectedFrameUrl);
  if (!context) {
    return { ok: false, reason: 'unauthorized' };
  }

  if (!sessionStore.refreshSession(message.sessionId, context)) {
    return { ok: false, reason: 'unauthorized' };
  }

  return { ok: true };
}

export function handleCloseSwitcherSession(
  sessionStore: SessionStore,
  message: CloseSwitcherSessionMessage,
  sender: MessageSenderInfo,
  expectedFrameUrl?: string,
): boolean {
  const context = extractSenderContext(sender, expectedFrameUrl);
  if (!context) {
    return false;
  }

  return sessionStore.removeSession(message.sessionId, context);
}
