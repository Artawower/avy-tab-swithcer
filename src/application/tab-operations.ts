import type { SwitchableTab } from '../domain/tab';
import { getRecentTabs } from '../domain/tab-order';
import { isNonNegativeInteger, type ActivateTabResult } from './messages';
import { parseHostname } from './url';

export interface BrowserTabData {
  readonly id?: number;
  readonly windowId?: number;
  readonly title?: string;
  readonly url?: string;
  readonly favIconUrl?: string;
  readonly lastAccessed?: number;
}

function normalizeFaviconUrl(favIconUrl: unknown): string | null {
  return typeof favIconUrl === 'string' && favIconUrl.length > 0 ? favIconUrl : null;
}

function normalizeLastAccessed(lastAccessed: unknown): number | null {
  return typeof lastAccessed === 'number' && Number.isFinite(lastAccessed) ? lastAccessed : null;
}

export function toSwitchableTab(tab: BrowserTabData): SwitchableTab | null {
  const { id, windowId } = tab;
  if (!isNonNegativeInteger(id) || !isNonNegativeInteger(windowId)) {
    return null;
  }

  const title = typeof tab.title === 'string' ? tab.title : '';
  const url = typeof tab.url === 'string' ? tab.url : '';

  return {
    id,
    windowId,
    title,
    url,
    hostname: parseHostname(url),
    faviconUrl: normalizeFaviconUrl(tab.favIconUrl),
    lastAccessed: normalizeLastAccessed(tab.lastAccessed),
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
