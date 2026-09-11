import { expect, test } from 'vitest';
import {
  isActivateTabMessage,
  isActivateTabResult,
  isCloseSwitcherSessionMessage,
  isFrameCloseMessage,
  isFrameInitErrorMessage,
  isHeartbeatSwitcherSessionMessage,
  isHeartbeatSwitcherSessionResult,
  isOpenSwitcherHostMessage,
  isRequestSwitcherDataMessage,
  isRequestSwitcherDataResult,
  isSwitchableTab,
  type ActivateTabMessage,
  type ActivateTabResult,
  type FrameCloseMessage,
  type FrameInitErrorMessage,
  type HeartbeatSwitcherSessionMessage,
  type HeartbeatSwitcherSessionResult,
  type OpenSwitcherHostMessage,
  type RequestSwitcherDataMessage,
  type RequestSwitcherDataResult,
} from '../../src/application/messages';
import { createTab } from '../fixtures/tab';

test('isSwitchableTab accepts valid tab with null nullable fields', () => {
  const tab = createTab({
    id: 1,
    windowId: 2,
    title: 'Test Title',
    url: 'https://example.com/page',
    hostname: 'example.com',
    faviconUrl: null,
    lastAccessed: null,
  });

  expect(isSwitchableTab(tab)).toBe(true);
});

test('isSwitchableTab accepts valid tab with non-null faviconUrl and lastAccessed', () => {
  const tab = createTab({
    id: 0,
    windowId: 0,
    title: '',
    url: 'chrome://extensions',
    hostname: 'extensions',
    faviconUrl: 'https://example.com/icon.png',
    lastAccessed: 1700000000000,
  });

  expect(isSwitchableTab(tab)).toBe(true);
});

test('isSwitchableTab rejects non-record values', () => {
  expect(isSwitchableTab(null)).toBe(false);
  expect(isSwitchableTab(undefined)).toBe(false);
  expect(isSwitchableTab(123)).toBe(false);
  expect(isSwitchableTab('string')).toBe(false);
  expect(isSwitchableTab(true)).toBe(false);
  expect(isSwitchableTab([])).toBe(false);
  expect(isSwitchableTab(() => {})).toBe(false);
  expect(isSwitchableTab(Symbol('tab'))).toBe(false);
});

test('isSwitchableTab rejects malformed id values', () => {
  const base = createTab();

  expect(isSwitchableTab({ ...base, id: -1 })).toBe(false);
  expect(isSwitchableTab({ ...base, id: 1.5 })).toBe(false);
  expect(isSwitchableTab({ ...base, id: Number.NaN })).toBe(false);
  expect(isSwitchableTab({ ...base, id: Number.POSITIVE_INFINITY })).toBe(false);
  expect(isSwitchableTab({ ...base, id: Number.NEGATIVE_INFINITY })).toBe(false);
  expect(isSwitchableTab({ ...base, id: '1' })).toBe(false);
  expect(isSwitchableTab({ ...base, id: null })).toBe(false);
  expect(isSwitchableTab({ ...base, id: undefined })).toBe(false);
});

test('isSwitchableTab rejects malformed windowId values', () => {
  const base = createTab();

  expect(isSwitchableTab({ ...base, windowId: -1 })).toBe(false);
  expect(isSwitchableTab({ ...base, windowId: 2.2 })).toBe(false);
  expect(isSwitchableTab({ ...base, windowId: Number.NaN })).toBe(false);
  expect(isSwitchableTab({ ...base, windowId: Number.POSITIVE_INFINITY })).toBe(false);
  expect(isSwitchableTab({ ...base, windowId: '2' })).toBe(false);
  expect(isSwitchableTab({ ...base, windowId: null })).toBe(false);
  expect(isSwitchableTab({ ...base, windowId: undefined })).toBe(false);
});

test('isSwitchableTab rejects malformed string fields', () => {
  const base = createTab();

  expect(isSwitchableTab({ ...base, title: 123 })).toBe(false);
  expect(isSwitchableTab({ ...base, title: null })).toBe(false);
  expect(isSwitchableTab({ ...base, title: undefined })).toBe(false);

  expect(isSwitchableTab({ ...base, url: 456 })).toBe(false);
  expect(isSwitchableTab({ ...base, url: null })).toBe(false);
  expect(isSwitchableTab({ ...base, url: undefined })).toBe(false);

  expect(isSwitchableTab({ ...base, hostname: 789 })).toBe(false);
  expect(isSwitchableTab({ ...base, hostname: null })).toBe(false);
  expect(isSwitchableTab({ ...base, hostname: undefined })).toBe(false);
});

test('isSwitchableTab rejects malformed faviconUrl values', () => {
  const base = createTab();

  expect(isSwitchableTab({ ...base, faviconUrl: 123 })).toBe(false);
  expect(isSwitchableTab({ ...base, faviconUrl: undefined })).toBe(false);
  expect(isSwitchableTab({ ...base, faviconUrl: true })).toBe(false);
  expect(isSwitchableTab({ ...base, faviconUrl: {} })).toBe(false);
});

test('isSwitchableTab rejects malformed lastAccessed values', () => {
  const base = createTab();

  expect(isSwitchableTab({ ...base, lastAccessed: '1700000000000' })).toBe(false);
  expect(isSwitchableTab({ ...base, lastAccessed: undefined })).toBe(false);
  expect(isSwitchableTab({ ...base, lastAccessed: true })).toBe(false);
  expect(isSwitchableTab({ ...base, lastAccessed: Number.NaN })).toBe(false);
  expect(isSwitchableTab({ ...base, lastAccessed: Number.POSITIVE_INFINITY })).toBe(false);
  expect(isSwitchableTab({ ...base, lastAccessed: Number.NEGATIVE_INFINITY })).toBe(false);
});

test('isSwitchableTab tolerates extra properties', () => {
  const tabWithExtra = {
    ...createTab(),
    active: true,
    pinned: false,
    extraMetadata: { custom: 'field' },
  };

  expect(isSwitchableTab(tabWithExtra)).toBe(true);
});

test('isSwitchableTab does not mutate input object', () => {
  const tab = Object.freeze(createTab({ id: 5, title: 'Frozen Tab' }));

  expect(isSwitchableTab(tab)).toBe(true);
});

test('isHeartbeatSwitcherSessionMessage accepts valid heartbeat message', () => {
  const message: unknown = {
    type: 'HEARTBEAT_SWITCHER_SESSION',
    sessionId: 'session-valid-123',
  };

  if (isHeartbeatSwitcherSessionMessage(message)) {
    const valid: HeartbeatSwitcherSessionMessage = message;
    expect(valid.type).toBe('HEARTBEAT_SWITCHER_SESSION');
    expect(valid.sessionId).toBe('session-valid-123');
  } else {
    expect.fail('Expected isHeartbeatSwitcherSessionMessage to return true');
  }
});

test('isHeartbeatSwitcherSessionMessage rejects invalid payloads', () => {
  expect(isHeartbeatSwitcherSessionMessage(null)).toBe(false);
  expect(isHeartbeatSwitcherSessionMessage(undefined)).toBe(false);
  expect(isHeartbeatSwitcherSessionMessage('HEARTBEAT_SWITCHER_SESSION')).toBe(false);
  expect(isHeartbeatSwitcherSessionMessage({ type: 'HEARTBEAT_SWITCHER_SESSION' })).toBe(false);
  expect(
    isHeartbeatSwitcherSessionMessage({ type: 'HEARTBEAT_SWITCHER_SESSION', sessionId: '' }),
  ).toBe(false);
  expect(
    isHeartbeatSwitcherSessionMessage({ type: 'HEARTBEAT_SWITCHER_SESSION', sessionId: 123 }),
  ).toBe(false);
  expect(isHeartbeatSwitcherSessionMessage({ type: 'OTHER_TYPE', sessionId: '123' })).toBe(false);
});

test('isHeartbeatSwitcherSessionResult accepts valid results', () => {
  const success: unknown = { ok: true };
  if (isHeartbeatSwitcherSessionResult(success)) {
    const valid: HeartbeatSwitcherSessionResult = success;
    expect(valid.ok).toBe(true);
  } else {
    expect.fail('Expected isHeartbeatSwitcherSessionResult to return true for ok: true');
  }

  const unauthorized: unknown = { ok: false, reason: 'unauthorized' };
  expect(isHeartbeatSwitcherSessionResult(unauthorized)).toBe(true);

  const unexpected: unknown = { ok: false, reason: 'unexpected' };
  expect(isHeartbeatSwitcherSessionResult(unexpected)).toBe(true);
});

test('isHeartbeatSwitcherSessionResult rejects invalid payloads', () => {
  expect(isHeartbeatSwitcherSessionResult(null)).toBe(false);
  expect(isHeartbeatSwitcherSessionResult(undefined)).toBe(false);
  expect(isHeartbeatSwitcherSessionResult({})).toBe(false);
  expect(isHeartbeatSwitcherSessionResult({ ok: true, extra: 1 })).toBe(false);
  expect(isHeartbeatSwitcherSessionResult({ ok: false })).toBe(false);
  expect(isHeartbeatSwitcherSessionResult({ ok: false, reason: 'invalid-reason' })).toBe(false);
});

test('isOpenSwitcherHostMessage validates valid host message', () => {
  const valid: unknown = {
    type: 'OPEN_SWITCHER_HOST',
    sessionId: 'test-session-123',
    frameUrl: 'chrome-extension://xyz/frame.html?sessionId=test-session-123',
  };

  if (isOpenSwitcherHostMessage(valid)) {
    const msg: OpenSwitcherHostMessage = valid;
    expect(msg.type).toBe('OPEN_SWITCHER_HOST');
    expect(msg.sessionId).toBe('test-session-123');
    expect(msg.frameUrl).toContain('frame.html');
  } else {
    expect.fail('Expected isOpenSwitcherHostMessage to return true');
  }

  expect(isOpenSwitcherHostMessage(null)).toBe(false);
  expect(isOpenSwitcherHostMessage({})).toBe(false);
  expect(isOpenSwitcherHostMessage({ type: 'OPEN_SWITCHER_HOST', sessionId: '' })).toBe(false);
  expect(
    isOpenSwitcherHostMessage({
      type: 'OPEN_SWITCHER_HOST',
      sessionId: 's',
      frameUrl: '',
    }),
  ).toBe(false);
});

test('isRequestSwitcherDataMessage validates request message', () => {
  const valid: unknown = {
    type: 'REQUEST_SWITCHER_DATA',
    sessionId: 'session-abc',
  };

  if (isRequestSwitcherDataMessage(valid)) {
    const msg: RequestSwitcherDataMessage = valid;
    expect(msg.type).toBe('REQUEST_SWITCHER_DATA');
    expect(msg.sessionId).toBe('session-abc');
  } else {
    expect.fail('Expected isRequestSwitcherDataMessage to return true');
  }

  expect(isRequestSwitcherDataMessage(null)).toBe(false);
  expect(isRequestSwitcherDataMessage({})).toBe(false);
  expect(isRequestSwitcherDataMessage({ type: 'REQUEST_SWITCHER_DATA', sessionId: '' })).toBe(
    false,
  );
  expect(isRequestSwitcherDataMessage({ type: 'REQUEST_SWITCHER_DATA', sessionId: 123 })).toBe(
    false,
  );
});

test('isRequestSwitcherDataResult validates result payloads', () => {
  const success: unknown = {
    ok: true,
    tabs: [createTab({ id: 1 })],
  };

  if (isRequestSwitcherDataResult(success)) {
    const res: RequestSwitcherDataResult = success;
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tabs).toHaveLength(1);
    }
  } else {
    expect.fail('Expected isRequestSwitcherDataResult to return true for success');
  }

  const failUnauthorized: unknown = {
    ok: false,
    reason: 'unauthorized',
  };
  expect(isRequestSwitcherDataResult(failUnauthorized)).toBe(true);

  const failUnexpected: unknown = {
    ok: false,
    reason: 'unexpected',
  };
  expect(isRequestSwitcherDataResult(failUnexpected)).toBe(true);

  expect(isRequestSwitcherDataResult(null)).toBe(false);
  expect(isRequestSwitcherDataResult({ ok: false, reason: 'unknown' })).toBe(false);
  expect(isRequestSwitcherDataResult({ ok: true, tabs: 'invalid' })).toBe(false);
});

test('isActivateTabMessage accepts valid message with tabId and sessionId', () => {
  const message: unknown = {
    type: 'ACTIVATE_TAB',
    tabId: 42,
    sessionId: 'valid-session-id',
  };

  if (isActivateTabMessage(message)) {
    const validMessage: ActivateTabMessage = message;
    expect(validMessage.type).toBe('ACTIVATE_TAB');
    expect(validMessage.tabId).toBe(42);
    expect(validMessage.sessionId).toBe('valid-session-id');
  } else {
    expect.fail('Expected isActivateTabMessage to return true');
  }
});

test('isActivateTabMessage rejects missing or empty sessionId', () => {
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: 1 })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: 1, sessionId: '' })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: 1, sessionId: 123 })).toBe(false);
});

test('isCloseSwitcherSessionMessage validates close session message', () => {
  const valid: unknown = {
    type: 'CLOSE_SWITCHER_SESSION',
    sessionId: 'session-xyz',
  };

  expect(isCloseSwitcherSessionMessage(valid)).toBe(true);
  expect(isCloseSwitcherSessionMessage(null)).toBe(false);
  expect(isCloseSwitcherSessionMessage({ type: 'CLOSE_SWITCHER_SESSION' })).toBe(false);
  expect(isCloseSwitcherSessionMessage({ type: 'CLOSE_SWITCHER_SESSION', sessionId: '' })).toBe(
    false,
  );
});

test('isFrameCloseMessage validates frame close message', () => {
  const valid: unknown = {
    type: 'AVY_CLOSE_FRAME',
    sessionId: 'session-xyz',
  };

  if (isFrameCloseMessage(valid)) {
    const msg: FrameCloseMessage = valid;
    expect(msg.type).toBe('AVY_CLOSE_FRAME');
    expect(msg.sessionId).toBe('session-xyz');
  } else {
    expect.fail('Expected isFrameCloseMessage to return true');
  }

  expect(isFrameCloseMessage(null)).toBe(false);
  expect(isFrameCloseMessage({ type: 'AVY_CLOSE_FRAME' })).toBe(false);
  expect(isFrameCloseMessage({ type: 'AVY_CLOSE_FRAME', sessionId: '' })).toBe(false);
});

test('isFrameInitErrorMessage validates init failure message', () => {
  const valid: unknown = {
    type: 'AVY_FRAME_INIT_FAILED',
  };

  if (isFrameInitErrorMessage(valid)) {
    const msg: FrameInitErrorMessage = valid;
    expect(msg.type).toBe('AVY_FRAME_INIT_FAILED');
  } else {
    expect.fail('Expected isFrameInitErrorMessage to return true');
  }

  expect(isFrameInitErrorMessage(null)).toBe(false);
  expect(isFrameInitErrorMessage({})).toBe(false);
  expect(isFrameInitErrorMessage({ type: 'AVY_CLOSE_FRAME' })).toBe(false);
  expect(isFrameInitErrorMessage({ type: 'OTHER' })).toBe(false);
});

test('isActivateTabResult accepts valid success result and narrows type', () => {
  const payload: unknown = { ok: true };

  if (isActivateTabResult(payload)) {
    const validResult: ActivateTabResult = payload;
    expect(validResult.ok).toBe(true);
  } else {
    expect.fail('Expected isActivateTabResult to return true for { ok: true }');
  }
});

test('isActivateTabResult accepts all valid failure reasons including unauthorized', () => {
  const validReasons: ReadonlyArray<ActivateTabResult & { ok: false }> = [
    { ok: false, reason: 'tab-unavailable' },
    { ok: false, reason: 'wrong-window' },
    { ok: false, reason: 'unauthorized' },
    { ok: false, reason: 'unexpected' },
  ];

  for (const item of validReasons) {
    const payload: unknown = item;
    if (isActivateTabResult(payload)) {
      const validResult: ActivateTabResult = payload;
      expect(validResult.ok).toBe(false);
      if (!validResult.ok) {
        expect(validResult.reason).toBe(item.reason);
      }
    } else {
      expect.fail(`Expected isActivateTabResult to return true for reason: ${item.reason}`);
    }
  }
});
