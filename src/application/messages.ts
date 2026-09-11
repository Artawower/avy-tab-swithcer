import type { SwitchableTab } from '../domain/tab';

export interface OpenSwitcherHostMessage {
  readonly type: 'OPEN_SWITCHER_HOST';
  readonly sessionId: string;
  readonly frameUrl: string;
}

export interface RequestSwitcherDataMessage {
  readonly type: 'REQUEST_SWITCHER_DATA';
  readonly sessionId: string;
}

export type RequestSwitcherDataResult =
  | {
      readonly ok: true;
      readonly tabs: readonly SwitchableTab[];
    }
  | {
      readonly ok: false;
      readonly reason: 'unauthorized' | 'unexpected';
    };

export interface ActivateTabMessage {
  readonly type: 'ACTIVATE_TAB';
  readonly tabId: number;
  readonly sessionId: string;
}

export interface CloseSwitcherSessionMessage {
  readonly type: 'CLOSE_SWITCHER_SESSION';
  readonly sessionId: string;
}

export interface HeartbeatSwitcherSessionMessage {
  readonly type: 'HEARTBEAT_SWITCHER_SESSION';
  readonly sessionId: string;
}

export type HeartbeatSwitcherSessionResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: 'unauthorized' | 'unexpected' };

export interface FrameCloseMessage {
  readonly type: 'AVY_CLOSE_FRAME';
  readonly sessionId: string;
}

export interface FrameInitErrorMessage {
  readonly type: 'AVY_FRAME_INIT_FAILED';
}

export type FrameToParentMessage = FrameCloseMessage | FrameInitErrorMessage;

export type BackgroundToContentMessage = OpenSwitcherHostMessage;
export type ContentToBackgroundMessage =
  | RequestSwitcherDataMessage
  | ActivateTabMessage
  | CloseSwitcherSessionMessage
  | HeartbeatSwitcherSessionMessage;

export type ActivateTabResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'tab-unavailable' | 'wrong-window' | 'unauthorized' | 'unexpected';
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

  if (
    lastAccessed !== null &&
    (typeof lastAccessed !== 'number' || !Number.isFinite(lastAccessed))
  ) {
    return false;
  }

  return true;
}

export function isHeartbeatSwitcherSessionMessage(
  value: unknown,
): value is HeartbeatSwitcherSessionMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value['type'] !== 'HEARTBEAT_SWITCHER_SESSION') {
    return false;
  }

  const sessionId = value['sessionId'];
  return typeof sessionId === 'string' && sessionId.length > 0;
}

export function isHeartbeatSwitcherSessionResult(
  value: unknown,
): value is HeartbeatSwitcherSessionResult {
  if (!isRecord(value)) {
    return false;
  }

  if (value['ok'] === true) {
    return Object.keys(value).length === 1;
  }

  if (value['ok'] === false) {
    const reason = value['reason'];
    return reason === 'unauthorized' || reason === 'unexpected';
  }

  return false;
}

export function isOpenSwitcherHostMessage(value: unknown): value is OpenSwitcherHostMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value['type'] !== 'OPEN_SWITCHER_HOST') {
    return false;
  }

  const sessionId = value['sessionId'];
  const frameUrl = value['frameUrl'];

  return (
    typeof sessionId === 'string' &&
    sessionId.length > 0 &&
    typeof frameUrl === 'string' &&
    frameUrl.length > 0
  );
}

export function isRequestSwitcherDataMessage(value: unknown): value is RequestSwitcherDataMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value['type'] !== 'REQUEST_SWITCHER_DATA') {
    return false;
  }

  const sessionId = value['sessionId'];
  return typeof sessionId === 'string' && sessionId.length > 0;
}

export function isRequestSwitcherDataResult(value: unknown): value is RequestSwitcherDataResult {
  if (!isRecord(value)) {
    return false;
  }

  if (value['ok'] === true) {
    const tabs = value['tabs'];
    return Array.isArray(tabs) && tabs.every(isSwitchableTab);
  }

  if (value['ok'] === false) {
    const reason = value['reason'];
    return reason === 'unauthorized' || reason === 'unexpected';
  }

  return false;
}

export function isActivateTabMessage(value: unknown): value is ActivateTabMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value['type'] !== 'ACTIVATE_TAB') {
    return false;
  }

  const tabId = value['tabId'];
  const sessionId = value['sessionId'];

  return isNonNegativeInteger(tabId) && typeof sessionId === 'string' && sessionId.length > 0;
}

export function isCloseSwitcherSessionMessage(
  value: unknown,
): value is CloseSwitcherSessionMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value['type'] !== 'CLOSE_SWITCHER_SESSION') {
    return false;
  }

  const sessionId = value['sessionId'];
  return typeof sessionId === 'string' && sessionId.length > 0;
}

export function isFrameCloseMessage(value: unknown): value is FrameCloseMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value['type'] !== 'AVY_CLOSE_FRAME') {
    return false;
  }

  const sessionId = value['sessionId'];
  return typeof sessionId === 'string' && sessionId.length > 0;
}

export function isFrameInitErrorMessage(value: unknown): value is FrameInitErrorMessage {
  if (!isRecord(value)) {
    return false;
  }
  return value['type'] === 'AVY_FRAME_INIT_FAILED';
}

export function isActivateTabResult(value: unknown): value is ActivateTabResult {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (value['ok'] === true) {
    return keys.length === 1 && keys[0] === 'ok';
  }

  if (value['ok'] === false) {
    if (keys.length !== 2) {
      return false;
    }
    if (!keys.includes('ok') || !keys.includes('reason')) {
      return false;
    }
    const reason = value['reason'];
    return (
      reason === 'tab-unavailable' ||
      reason === 'wrong-window' ||
      reason === 'unauthorized' ||
      reason === 'unexpected'
    );
  }

  return false;
}
