import type { SwitchableTab } from '../domain/tab';

export interface OpenSwitcherMessage {
  readonly type: 'OPEN_SWITCHER';
  readonly tabs: readonly SwitchableTab[];
}

export interface ActivateTabMessage {
  readonly type: 'ACTIVATE_TAB';
  readonly tabId: number;
}

export type BackgroundToContentMessage = OpenSwitcherMessage;
export type ContentToBackgroundMessage = ActivateTabMessage;

export type ActivateTabResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'tab-unavailable' | 'wrong-window' | 'unexpected';
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isSwitchableTab(value: unknown): value is SwitchableTab {
  if (!isRecord(value)) {
    return false;
  }

  const { id, windowId, title, url, hostname, faviconUrl, lastAccessed } = value;

  if (!isNonNegativeInteger(id) || !isNonNegativeInteger(windowId)) {
    return false;
  }

  if (typeof title !== 'string' || typeof url !== 'string' || typeof hostname !== 'string') {
    return false;
  }

  if (typeof faviconUrl !== 'string' && faviconUrl !== null) {
    return false;
  }

  if (lastAccessed !== null && (typeof lastAccessed !== 'number' || !Number.isFinite(lastAccessed))) {
    return false;
  }

  return true;
}

export function isOpenSwitcherMessage(value: unknown): value is OpenSwitcherMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value['type'] !== 'OPEN_SWITCHER') {
    return false;
  }

  const tabs = value['tabs'];
  if (!Array.isArray(tabs)) {
    return false;
  }

  return tabs.every(isSwitchableTab);
}

export function isActivateTabMessage(value: unknown): value is ActivateTabMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value['type'] !== 'ACTIVATE_TAB') {
    return false;
  }

  return isNonNegativeInteger(value['tabId']);
}
