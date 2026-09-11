import { expect, test } from 'vitest';
import {
  extractSenderContext,
  handleActivateTabRequest,
  handleCloseSwitcherSession,
  handleHeartbeatSwitcherSession,
  handleRequestSwitcherData,
  isExtensionFrameUrl,
  isInjectablePageUrl,
  openCurrentWindowSwitcher,
  type MessageSenderInfo,
  type SwitcherBackgroundPort,
} from '../../src/application/background';
import type {
  ActivateTabMessage,
  HeartbeatSwitcherSessionMessage,
  OpenSwitcherHostMessage,
  RequestSwitcherDataMessage,
} from '../../src/application/messages';
import { createSessionStore } from '../../src/application/sessions';
import type { BrowserTabData, TabActivationPort } from '../../src/application/tab-operations';

test('isInjectablePageUrl accepts valid http and https URLs', () => {
  expect(isInjectablePageUrl('http://example.com')).toBe(true);
  expect(isInjectablePageUrl('https://example.com/path?foo=bar')).toBe(true);
  expect(isInjectablePageUrl('HTTP://UPPERCASE.TEST/RESOURCE')).toBe(true);
  expect(isInjectablePageUrl('https://localhost:3000')).toBe(true);
});

test('isInjectablePageUrl rejects non-injectable URLs and schemes', () => {
  expect(isInjectablePageUrl('chrome://extensions')).toBe(false);
  expect(isInjectablePageUrl('chrome-extension://abcd1234efgh/popup.html')).toBe(false);
  expect(isInjectablePageUrl('moz-extension://abcd1234efgh/index.html')).toBe(false);
  expect(isInjectablePageUrl('edge://settings')).toBe(false);
  expect(isInjectablePageUrl('about:blank')).toBe(false);
  expect(isInjectablePageUrl('file:///Users/username/doc.txt')).toBe(false);
  expect(isInjectablePageUrl('data:text/html,<h1>Test</h1>')).toBe(false);
  expect(isInjectablePageUrl('javascript:void(0)')).toBe(false);
  expect(isInjectablePageUrl('view-source:https://example.com')).toBe(false);
  expect(isInjectablePageUrl('')).toBe(false);
  expect(isInjectablePageUrl('not-a-valid-url')).toBe(false);
});

test('isExtensionFrameUrl validates extension frame URLs', () => {
  expect(isExtensionFrameUrl(undefined)).toBe(true);
  expect(isExtensionFrameUrl('chrome-extension://xyz/frame.html')).toBe(true);
  expect(isExtensionFrameUrl('chrome-extension://xyz/frame.html?sessionId=abc')).toBe(true);
  expect(isExtensionFrameUrl('moz-extension://xyz/frame.html')).toBe(true);
  expect(isExtensionFrameUrl('https://example.com/frame.html')).toBe(false);
  expect(isExtensionFrameUrl('chrome-extension://xyz/other.html')).toBe(false);
  expect(isExtensionFrameUrl('not-a-url')).toBe(false);
});

test('isExtensionFrameUrl validates extension frame URLs with expectedFrameUrl', () => {
  const expected = 'chrome-extension://valid-extension-id/frame.html';
  expect(isExtensionFrameUrl(undefined, expected)).toBe(false);
  expect(isExtensionFrameUrl('', expected)).toBe(false);
  expect(isExtensionFrameUrl('chrome-extension://valid-extension-id/frame.html', expected)).toBe(
    true,
  );
  expect(
    isExtensionFrameUrl('chrome-extension://valid-extension-id/frame.html?sessionId=abc', expected),
  ).toBe(true);
  expect(isExtensionFrameUrl('chrome-extension://attacker-extension-id/frame.html', expected)).toBe(
    false,
  );
  expect(isExtensionFrameUrl('moz-extension://valid-extension-id/frame.html', expected)).toBe(
    false,
  );
  expect(isExtensionFrameUrl('chrome-extension://valid-extension-id/other.html', expected)).toBe(
    false,
  );
});

test('extractSenderContext extracts valid context and rejects invalid', () => {
  const validSender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
    documentId: 'doc-1',
    url: 'chrome-extension://xyz/frame.html',
  };
  expect(extractSenderContext(validSender)).toEqual({
    tabId: 1,
    windowId: 10,
    frameId: 100,
    documentId: 'doc-1',
  });

  expect(extractSenderContext({})).toBeNull();
  expect(extractSenderContext({ tab: { id: 1, windowId: 10 } })).toBeNull();
  expect(extractSenderContext({ tab: { id: -1, windowId: 10 }, frameId: 1 })).toBeNull();
  expect(extractSenderContext({ tab: { id: 1, windowId: -1 }, frameId: 1 })).toBeNull();
  expect(extractSenderContext({ tab: { id: 1, windowId: 10 }, frameId: -1 })).toBeNull();
  expect(
    extractSenderContext({
      tab: { id: 1, windowId: 10 },
      frameId: 1,
      url: 'https://evil.com/page',
    }),
  ).toBeNull();
});

test('extractSenderContext enforces expectedFrameUrl when provided', () => {
  const expected = 'chrome-extension://my-extension/frame.html';
  const matchingSender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
    url: 'chrome-extension://my-extension/frame.html?sessionId=123',
  };
  expect(extractSenderContext(matchingSender, expected)).toEqual({
    tabId: 1,
    windowId: 10,
    frameId: 100,
  });

  const mismatchedSender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
    url: 'chrome-extension://other-extension/frame.html?sessionId=123',
  };
  expect(extractSenderContext(mismatchedSender, expected)).toBeNull();
});

test('openCurrentWindowSwitcher returns null if active tab is missing or invalid', async () => {
  const sessionStore = createSessionStore();
  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.resolve(null),
    sendOpenHostMessage: () => Promise.resolve(),
    injectSwitcher: () => Promise.resolve(),
    getFrameUrl: (sid) => `chrome-extension://xyz/frame.html?sessionId=${sid}`,
    sessionStore,
  };

  const result = await openCurrentWindowSwitcher(port);
  expect(result).toBeNull();
  expect(sessionStore.size()).toBe(0);
});

test('openCurrentWindowSwitcher returns null if active tab has non-injectable URL', async () => {
  const sessionStore = createSessionStore();
  const port: SwitcherBackgroundPort = {
    queryActiveTab: () =>
      Promise.resolve({
        id: 1,
        windowId: 1,
        url: 'chrome://extensions',
      }),
    sendOpenHostMessage: () => Promise.resolve(),
    injectSwitcher: () => Promise.resolve(),
    getFrameUrl: (sid) => `chrome-extension://xyz/frame.html?sessionId=${sid}`,
    sessionStore,
  };

  const result = await openCurrentWindowSwitcher(port);
  expect(result).toBeNull();
  expect(sessionStore.size()).toBe(0);
});

test('openCurrentWindowSwitcher creates session and sends host message without injection when listener is present', async () => {
  const sessionStore = createSessionStore();
  const sentMessages: OpenSwitcherHostMessage[] = [];

  const port: SwitcherBackgroundPort = {
    queryActiveTab: () =>
      Promise.resolve({
        id: 10,
        windowId: 1,
        url: 'https://example.com',
      }),
    sendOpenHostMessage: (_tabId, msg) => {
      sentMessages.push(msg);
      return Promise.resolve();
    },
    injectSwitcher: () => Promise.reject(new Error('Should not be called')),
    getFrameUrl: (sid) => `chrome-extension://xyz/frame.html?sessionId=${sid}`,
    sessionStore,
  };

  const session = await openCurrentWindowSwitcher(port);
  expect(session).not.toBeNull();
  expect(sessionStore.size()).toBe(1);
  expect(sentMessages).toHaveLength(1);
  expect(sentMessages[0]?.type).toBe('OPEN_SWITCHER_HOST');
  expect(sentMessages[0]?.sessionId).toBe(session?.sessionId);
  expect(sentMessages[0]?.frameUrl).toContain(session?.sessionId);
});

test('openCurrentWindowSwitcher injects then resends when initial send fails', async () => {
  const sessionStore = createSessionStore();
  let sendAttempts = 0;
  let injected = false;

  const port: SwitcherBackgroundPort = {
    queryActiveTab: () =>
      Promise.resolve({
        id: 10,
        windowId: 1,
        url: 'https://example.com',
      }),
    sendOpenHostMessage: () => {
      sendAttempts++;
      if (sendAttempts === 1) {
        return Promise.reject(new Error('No listener'));
      }
      return Promise.resolve();
    },
    injectSwitcher: () => {
      injected = true;
      return Promise.resolve();
    },
    getFrameUrl: (sid) => `chrome-extension://xyz/frame.html?sessionId=${sid}`,
    sessionStore,
  };

  const session = await openCurrentWindowSwitcher(port);
  expect(session).not.toBeNull();
  expect(injected).toBe(true);
  expect(sendAttempts).toBe(2);
  expect(sessionStore.size()).toBe(1);
});

test('openCurrentWindowSwitcher cleans up session if injection fails', async () => {
  const sessionStore = createSessionStore();

  const port: SwitcherBackgroundPort = {
    queryActiveTab: () =>
      Promise.resolve({
        id: 10,
        windowId: 1,
        url: 'https://example.com',
      }),
    sendOpenHostMessage: () => Promise.reject(new Error('No listener')),
    injectSwitcher: () => Promise.reject(new Error('Injection failed')),
    getFrameUrl: (sid) => `chrome-extension://xyz/frame.html?sessionId=${sid}`,
    sessionStore,
  };

  const session = await openCurrentWindowSwitcher(port);
  expect(session).toBeNull();
  expect(sessionStore.size()).toBe(0);
});

test('handleRequestSwitcherData returns unauthorized for invalid or missing sender tab', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);
  const msg: RequestSwitcherDataMessage = {
    type: 'REQUEST_SWITCHER_DATA',
    sessionId: session.sessionId,
  };

  const resNoTab = await handleRequestSwitcherData(
    sessionStore,
    () => Promise.resolve([]),
    msg,
    {},
  );
  expect(resNoTab).toEqual({ ok: false, reason: 'unauthorized' });

  const resInvalidTab = await handleRequestSwitcherData(
    sessionStore,
    () => Promise.resolve([]),
    msg,
    { tab: { id: -1, windowId: 10 }, frameId: 1 },
  );
  expect(resInvalidTab).toEqual({ ok: false, reason: 'unauthorized' });
});

test('handleRequestSwitcherData returns unauthorized for unknown or mismatched session', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);

  const resWrongTab = await handleRequestSwitcherData(
    sessionStore,
    () => Promise.resolve([]),
    { type: 'REQUEST_SWITCHER_DATA', sessionId: session.sessionId },
    { tab: { id: 2, windowId: 10 }, frameId: 1 },
  );
  expect(resWrongTab).toEqual({ ok: false, reason: 'unauthorized' });

  const resUnknownSid = await handleRequestSwitcherData(
    sessionStore,
    () => Promise.resolve([]),
    { type: 'REQUEST_SWITCHER_DATA', sessionId: 'fake-session' },
    { tab: { id: 1, windowId: 10 }, frameId: 1 },
  );
  expect(resUnknownSid).toEqual({ ok: false, reason: 'unauthorized' });
});

test('handleRequestSwitcherData returns tabs for valid authorized session and sender, claiming session', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);

  const mockWindowTabs: BrowserTabData[] = [
    { id: 1, windowId: 10, title: 'Current Tab', lastAccessed: 200 },
    { id: 2, windowId: 10, title: 'Other Tab', lastAccessed: 100 },
  ];

  const sender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
    documentId: 'doc-1',
  };

  const res = await handleRequestSwitcherData(
    sessionStore,
    () => Promise.resolve(mockWindowTabs),
    { type: 'REQUEST_SWITCHER_DATA', sessionId: session.sessionId },
    sender,
  );

  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.tabs).toHaveLength(1);
    expect(res.tabs[0]?.id).toBe(2);
  }

  const stored = sessionStore.getSession(session.sessionId);
  expect(stored?.claimedSender).toEqual({ frameId: 100, documentId: 'doc-1' });
});

test('handleRequestSwitcherData rejects second sender attempting to claim already claimed session', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);

  const sender1: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
    documentId: 'doc-1',
  };
  const senderCloned: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 200,
    documentId: 'doc-2',
  };

  const res1 = await handleRequestSwitcherData(
    sessionStore,
    () => Promise.resolve([]),
    { type: 'REQUEST_SWITCHER_DATA', sessionId: session.sessionId },
    sender1,
  );
  expect(res1.ok).toBe(true);

  const resCloned = await handleRequestSwitcherData(
    sessionStore,
    () => Promise.resolve([]),
    { type: 'REQUEST_SWITCHER_DATA', sessionId: session.sessionId },
    senderCloned,
  );
  expect(resCloned).toEqual({ ok: false, reason: 'unauthorized' });
});

test('handleActivateTabRequest activates tab and removes session on success', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);
  const sender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
  };

  sessionStore.claimSession(session.sessionId, { tabId: 1, windowId: 10, frameId: 100 });

  let activatedTabId = -1;
  const activationPort: TabActivationPort = {
    get: (id) => Promise.resolve({ id, windowId: 10, title: 'Target' }),
    activate: (id) => {
      activatedTabId = id;
      return Promise.resolve();
    },
  };

  const msg: ActivateTabMessage = {
    type: 'ACTIVATE_TAB',
    tabId: 2,
    sessionId: session.sessionId,
  };

  const res = await handleActivateTabRequest(sessionStore, activationPort, msg, sender);

  expect(res).toEqual({ ok: true });
  expect(activatedTabId).toBe(2);
  expect(sessionStore.size()).toBe(0);
});

test('handleActivateTabRequest rejects unauthorized sender or session', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);
  sessionStore.claimSession(session.sessionId, { tabId: 1, windowId: 10, frameId: 100 });

  const activationPort: TabActivationPort = {
    get: (id) => Promise.resolve({ id, windowId: 10 }),
    activate: () => Promise.resolve(),
  };

  const msg: ActivateTabMessage = {
    type: 'ACTIVATE_TAB',
    tabId: 2,
    sessionId: session.sessionId,
  };

  const res = await handleActivateTabRequest(sessionStore, activationPort, msg, {
    tab: { id: 99, windowId: 10 },
    frameId: 100,
  });

  expect(res).toEqual({ ok: false, reason: 'unauthorized' });
  expect(sessionStore.size()).toBe(1);
});

test('handleActivateTabRequest returns tab-unavailable when target tab does not exist and preserves session for recovery', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);
  sessionStore.claimSession(session.sessionId, { tabId: 1, windowId: 10, frameId: 100 });

  const activationPort: TabActivationPort = {
    get: () => Promise.reject(new Error('Tab not found')),
    activate: () => Promise.resolve(),
  };

  const msg: ActivateTabMessage = {
    type: 'ACTIVATE_TAB',
    tabId: 999,
    sessionId: session.sessionId,
  };

  const res = await handleActivateTabRequest(sessionStore, activationPort, msg, {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
  });

  expect(res).toEqual({ ok: false, reason: 'tab-unavailable' });
  expect(sessionStore.size()).toBe(1);
});

test('handleActivateTabRequest returns wrong-window when target tab belongs to different window', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);
  sessionStore.claimSession(session.sessionId, { tabId: 1, windowId: 10, frameId: 100 });

  const activationPort: TabActivationPort = {
    get: (id) => Promise.resolve({ id, windowId: 999, title: 'Other Window Tab' }),
    activate: () => Promise.resolve(),
  };

  const msg: ActivateTabMessage = {
    type: 'ACTIVATE_TAB',
    tabId: 5,
    sessionId: session.sessionId,
  };

  const res = await handleActivateTabRequest(sessionStore, activationPort, msg, {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
  });

  expect(res).toEqual({ ok: false, reason: 'wrong-window' });
  expect(sessionStore.size()).toBe(1);
});

test('handleHeartbeatSwitcherSession validates and refreshes session liveness', () => {
  const sessionStore = createSessionStore();
  const now = Date.now();
  const session = sessionStore.createSession(1, 10, now);
  const sender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
  };

  sessionStore.claimSession(session.sessionId, { tabId: 1, windowId: 10, frameId: 100 }, now);

  const msg: HeartbeatSwitcherSessionMessage = {
    type: 'HEARTBEAT_SWITCHER_SESSION',
    sessionId: session.sessionId,
  };

  const res = handleHeartbeatSwitcherSession(sessionStore, msg, sender);
  expect(res).toEqual({ ok: true });
  expect(sessionStore.getSession(session.sessionId)?.lastSeenAt).toBeGreaterThanOrEqual(now);
});

test('handleHeartbeatSwitcherSession rejects unauthorized sender or unclaimed session', () => {
  const sessionStore = createSessionStore();
  const now = Date.now();
  const session = sessionStore.createSession(1, 10, now);

  const msg: HeartbeatSwitcherSessionMessage = {
    type: 'HEARTBEAT_SWITCHER_SESSION',
    sessionId: session.sessionId,
  };

  const resUnclaimed = handleHeartbeatSwitcherSession(sessionStore, msg, {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
  });
  expect(resUnclaimed).toEqual({ ok: false, reason: 'unauthorized' });

  sessionStore.claimSession(session.sessionId, { tabId: 1, windowId: 10, frameId: 100 }, now);

  const resWrongSender = handleHeartbeatSwitcherSession(sessionStore, msg, {
    tab: { id: 1, windowId: 10 },
    frameId: 200,
  });
  expect(resWrongSender).toEqual({ ok: false, reason: 'unauthorized' });
});

test('handleCloseSwitcherSession removes session for matching sender', () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);
  sessionStore.claimSession(session.sessionId, { tabId: 1, windowId: 10, frameId: 100 });

  const wrongSender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 200,
  };
  expect(
    handleCloseSwitcherSession(
      sessionStore,
      { type: 'CLOSE_SWITCHER_SESSION', sessionId: session.sessionId },
      wrongSender,
    ),
  ).toBe(false);
  expect(sessionStore.size()).toBe(1);

  const correctSender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
  };
  expect(
    handleCloseSwitcherSession(
      sessionStore,
      { type: 'CLOSE_SWITCHER_SESSION', sessionId: session.sessionId },
      correctSender,
    ),
  ).toBe(true);
  expect(sessionStore.size()).toBe(0);
});

test('background message handlers reject sender with mismatched expectedFrameUrl', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);
  const expectedUrl = 'chrome-extension://my-extension/frame.html';
  const mismatchedSender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
    url: 'chrome-extension://other-extension/frame.html',
  };

  const reqResult = await handleRequestSwitcherData(
    sessionStore,
    () => Promise.resolve([]),
    { type: 'REQUEST_SWITCHER_DATA', sessionId: session.sessionId },
    mismatchedSender,
    expectedUrl,
  );
  expect(reqResult).toEqual({ ok: false, reason: 'unauthorized' });

  const actResult = await handleActivateTabRequest(
    sessionStore,
    { get: () => Promise.resolve({ id: 2, windowId: 10 }), activate: () => Promise.resolve() },
    { type: 'ACTIVATE_TAB', sessionId: session.sessionId, tabId: 2 },
    mismatchedSender,
    expectedUrl,
  );
  expect(actResult).toEqual({ ok: false, reason: 'unauthorized' });

  const heartbeatResult = handleHeartbeatSwitcherSession(
    sessionStore,
    { type: 'HEARTBEAT_SWITCHER_SESSION', sessionId: session.sessionId },
    mismatchedSender,
    expectedUrl,
  );
  expect(heartbeatResult).toEqual({ ok: false, reason: 'unauthorized' });

  const closeResult = handleCloseSwitcherSession(
    sessionStore,
    { type: 'CLOSE_SWITCHER_SESSION', sessionId: session.sessionId },
    mismatchedSender,
    expectedUrl,
  );
  expect(closeResult).toBe(false);
});

test('background message handlers reject sender with missing url when expectedFrameUrl is provided', async () => {
  const sessionStore = createSessionStore();
  const session = sessionStore.createSession(1, 10);
  const expectedUrl = 'chrome-extension://my-extension/frame.html';
  const missingUrlSender: MessageSenderInfo = {
    tab: { id: 1, windowId: 10 },
    frameId: 100,
  };

  const reqResult = await handleRequestSwitcherData(
    sessionStore,
    () => Promise.resolve([]),
    { type: 'REQUEST_SWITCHER_DATA', sessionId: session.sessionId },
    missingUrlSender,
    expectedUrl,
  );
  expect(reqResult).toEqual({ ok: false, reason: 'unauthorized' });

  const actResult = await handleActivateTabRequest(
    sessionStore,
    { get: () => Promise.resolve({ id: 2, windowId: 10 }), activate: () => Promise.resolve() },
    { type: 'ACTIVATE_TAB', sessionId: session.sessionId, tabId: 2 },
    missingUrlSender,
    expectedUrl,
  );
  expect(actResult).toEqual({ ok: false, reason: 'unauthorized' });

  const heartbeatResult = handleHeartbeatSwitcherSession(
    sessionStore,
    { type: 'HEARTBEAT_SWITCHER_SESSION', sessionId: session.sessionId },
    missingUrlSender,
    expectedUrl,
  );
  expect(heartbeatResult).toEqual({ ok: false, reason: 'unauthorized' });

  const closeResult = handleCloseSwitcherSession(
    sessionStore,
    { type: 'CLOSE_SWITCHER_SESSION', sessionId: session.sessionId },
    missingUrlSender,
    expectedUrl,
  );
  expect(closeResult).toBe(false);
});
