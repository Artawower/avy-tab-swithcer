import type { SwitchableTab } from '../domain/tab';
import { getRecentTabs } from '../domain/tab-order';
import type { ActivateTabResult } from './messages';

export interface BrowserTabData {
  readonly id?: number;
  readonly windowId?: number;
  readonly title?: string;
  readonly url?: string;
  readonly favIconUrl?: string;
  readonly lastAccessed?: number;
}

export function toSwitchableTab(tab: BrowserTabData): SwitchableTab | null {
  const { id, windowId } = tab;
  if (
    typeof id !== 'number' ||
    !Number.isInteger(id) ||
    id < 0 ||
    typeof windowId !== 'number' ||
    !Number.isInteger(windowId) ||
    windowId < 0
  ) {
    return null;
  }

  const title = typeof tab.title === 'string' ? tab.title : '';
  const url = typeof tab.url === 'string' ? tab.url : '';

  let hostname = '';
  if (url.length > 0) {
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      hostname = '';
    }
  }

  const faviconUrl =
    typeof tab.favIconUrl === 'string' && tab.favIconUrl.length > 0 ? tab.favIconUrl : null;

  const lastAccessed =
    typeof tab.lastAccessed === 'number' && Number.isFinite(tab.lastAccessed)
      ? tab.lastAccessed
      : null;

  return {
    id,
    windowId,
    title,
    url,
    hostname,
    faviconUrl,
    lastAccessed,
  };
}

export function getCurrentWindowTabs(
  tabs: readonly BrowserTabData[],
  currentTabId: number,
  windowId: number,
): readonly SwitchableTab[] {
  const windowTabs: SwitchableTab[] = [];
  for (const tab of tabs) {
    const switchable = toSwitchableTab(tab);
    if (switchable !== null && switchable.windowId === windowId) {
      windowTabs.push(switchable);
    }
  }

  return getRecentTabs(windowTabs, currentTabId, windowTabs.length);
}

export interface TabActivationPort {
  readonly get: (tabId: number) => Promise<BrowserTabData>;
  readonly activate: (tabId: number) => Promise<void>;
}

export async function activateTabInWindow(
  port: TabActivationPort,
  tabId: number,
  sourceWindowId: number,
): Promise<ActivateTabResult> {
  let tabData: BrowserTabData;
  try {
    tabData = await port.get(tabId);
  } catch {
    return { ok: false, reason: 'tab-unavailable' };
  }

  const switchable = toSwitchableTab(tabData);
  if (switchable === null || switchable.id !== tabId) {
    return { ok: false, reason: 'tab-unavailable' };
  }

  if (switchable.windowId !== sourceWindowId) {
    return { ok: false, reason: 'wrong-window' };
  }

  try {
    await port.activate(tabId);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'tab-unavailable' };
  }
}
