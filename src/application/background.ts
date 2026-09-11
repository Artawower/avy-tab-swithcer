import type { OpenSwitcherMessage } from './messages';
import {
  getCurrentWindowTabs,
  toSwitchableTab,
  type BrowserTabData,
} from './tab-operations';

export interface SwitcherBackgroundPort {
  readonly queryActiveTab: () => Promise<BrowserTabData | null>;
  readonly queryWindowTabs: (windowId: number) => Promise<readonly BrowserTabData[]>;
  readonly sendOpenMessage: (tabId: number, message: OpenSwitcherMessage) => Promise<void>;
  readonly injectSwitcher: (tabId: number) => Promise<void>;
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
): Promise<boolean> {
  const activeTab = await port.queryActiveTab();
  if (!activeTab) {
    return false;
  }

  const switchableActive = toSwitchableTab(activeTab);
  if (switchableActive === null || !isInjectablePageUrl(switchableActive.url)) {
    return false;
  }

  const windowTabs = await port.queryWindowTabs(switchableActive.windowId);
  const tabs = getCurrentWindowTabs(
    windowTabs,
    switchableActive.id,
    switchableActive.windowId,
  );

  const message: OpenSwitcherMessage = {
    type: 'OPEN_SWITCHER',
    tabs,
  };

  try {
    await port.sendOpenMessage(switchableActive.id, message);
    return true;
  } catch {
    // Initial send rejected (listener not yet injected)
  }

  try {
    await port.injectSwitcher(switchableActive.id);
    await port.sendOpenMessage(switchableActive.id, message);
    return true;
  } catch {
    return false;
  }
}
