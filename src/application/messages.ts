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

export type ActivateTabResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'tab-unavailable' | 'wrong-window' | 'unauthorized' | 'unexpected';
    };

const ACTIVATE_FAILURE_REASONS = new Set([
  'tab-unavailable',
  'wrong-window',
  'unauthorized',
  'unexpected',
]);

const SESSION_ERROR_REASONS = new Set(['unauthorized', 'unexpected']);

const SUCCESS_RESULT_KEYS = ['ok'] as const;
const ACTIVATE_FAILURE_KEYS = ['ok', 'reason'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hasExactKeys(record: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(record);
  if (keys.length !== expectedKeys.length) {
    return false;
  }

  for (const key of expectedKeys) {
    if (!Object.hasOwn(record, key)) {
      return false;
    }
  }

  return true;
}

function isValidFaviconUrl(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isValidTabRecency(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

export function isSwitchableTab(value: unknown): value is SwitchableTab {
  if (!isRecord(value)) {
    return false;
  }

  const { id, windowId, title, url, hostname, faviconUrl, lastAccessed } = value;

  return (
    isNonNegativeInteger(id) &&
    isNonNegativeInteger(windowId) &&
    typeof title === 'string' &&
    typeof url === 'string' &&
    typeof hostname === 'string' &&
    isValidFaviconUrl(faviconUrl) &&
    isValidTabRecency(lastAccessed)
  );
}

export function isHeartbeatSwitcherSessionMessage(
  value: unknown,
): value is HeartbeatSwitcherSessionMessage {
  return (
    isRecord(value) &&
    value['type'] === 'HEARTBEAT_SWITCHER_SESSION' &&
    isNonEmptyString(value['sessionId'])
  );
}

export function isHeartbeatSwitcherSessionResult(
  value: unknown,
): value is HeartbeatSwitcherSessionResult {
  if (!isRecord(value)) {
    return false;
  }

  if (value['ok'] === true) {
    return hasExactKeys(value, SUCCESS_RESULT_KEYS);
  }

  if (value['ok'] === false) {
    const reason = value['reason'];
    return typeof reason === 'string' && SESSION_ERROR_REASONS.has(reason);
  }

  return false;
}

export function isOpenSwitcherHostMessage(value: unknown): value is OpenSwitcherHostMessage {
  return (
    isRecord(value) &&
    value['type'] === 'OPEN_SWITCHER_HOST' &&
    isNonEmptyString(value['sessionId']) &&
    isNonEmptyString(value['frameUrl'])
  );
}

export function isRequestSwitcherDataMessage(value: unknown): value is RequestSwitcherDataMessage {
  return (
    isRecord(value) &&
    value['type'] === 'REQUEST_SWITCHER_DATA' &&
    isNonEmptyString(value['sessionId'])
  );
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
    return typeof reason === 'string' && SESSION_ERROR_REASONS.has(reason);
  }

  return false;
}

export function isActivateTabMessage(value: unknown): value is ActivateTabMessage {
  return (
    isRecord(value) &&
    value['type'] === 'ACTIVATE_TAB' &&
    isNonNegativeInteger(value['tabId']) &&
    isNonEmptyString(value['sessionId'])
  );
}

export function isCloseSwitcherSessionMessage(
  value: unknown,
): value is CloseSwitcherSessionMessage {
  return (
    isRecord(value) &&
    value['type'] === 'CLOSE_SWITCHER_SESSION' &&
    isNonEmptyString(value['sessionId'])
  );
}

export function isFrameCloseMessage(value: unknown): value is FrameCloseMessage {
  return (
    isRecord(value) && value['type'] === 'AVY_CLOSE_FRAME' && isNonEmptyString(value['sessionId'])
  );
}

export function isFrameInitErrorMessage(value: unknown): value is FrameInitErrorMessage {
  return isRecord(value) && value['type'] === 'AVY_FRAME_INIT_FAILED';
}

export function isActivateTabResult(value: unknown): value is ActivateTabResult {
  if (!isRecord(value)) {
    return false;
  }

  if (value['ok'] === true) {
    return hasExactKeys(value, SUCCESS_RESULT_KEYS);
  }

  if (value['ok'] === false && hasExactKeys(value, ACTIVATE_FAILURE_KEYS)) {
    const reason = value['reason'];
    return typeof reason === 'string' && ACTIVATE_FAILURE_REASONS.has(reason);
  }

  return false;
}
