import { expect, test } from 'vitest';
import {
  isInjectablePageUrl,
  openCurrentWindowSwitcher,
  type SwitcherBackgroundPort,
} from '../../src/application/background';
import type { OpenSwitcherMessage } from '../../src/application/messages';
import type { BrowserTabData } from '../../src/application/tab-operations';

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

test('openCurrentWindowSwitcher stops before window query if active tab is missing or invalid', async () => {
  const queriedWindows: number[] = [];
  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.resolve(null),
    queryWindowTabs: (windowId) => {
      queriedWindows.push(windowId);
      return Promise.resolve([]);
    },
    sendOpenMessage: () => Promise.resolve(),
    injectSwitcher: () => Promise.resolve(),
  };

  const result = await openCurrentWindowSwitcher(port);

  expect(result).toBe(false);
  expect(queriedWindows).toEqual([]);
});

test('openCurrentWindowSwitcher stops before window query if active tab metadata is malformed', async () => {
  const malformedTabs: BrowserTabData[] = [
    { windowId: 1, url: 'https://example.com' }, // missing id
    { id: -1, windowId: 1, url: 'https://example.com' }, // negative id
    { id: 1, url: 'https://example.com' }, // missing windowId
    { id: 1, windowId: -2, url: 'https://example.com' }, // negative windowId
  ];

  for (const malformed of malformedTabs) {
    let windowQueried = false;
    const port: SwitcherBackgroundPort = {
      queryActiveTab: () => Promise.resolve(malformed),
      queryWindowTabs: () => {
        windowQueried = true;
        return Promise.resolve([]);
      },
      sendOpenMessage: () => Promise.resolve(),
      injectSwitcher: () => Promise.resolve(),
    };

    const result = await openCurrentWindowSwitcher(port);

    expect(result).toBe(false);
    expect(windowQueried).toBe(false);
  }
});

test('openCurrentWindowSwitcher stops before window query if active tab has non-injectable URL', async () => {
  let windowQueried = false;
  const port: SwitcherBackgroundPort = {
    queryActiveTab: () =>
      Promise.resolve({
        id: 1,
        windowId: 1,
        url: 'chrome://extensions',
      }),
    queryWindowTabs: () => {
      windowQueried = true;
      return Promise.resolve([]);
    },
    sendOpenMessage: () => Promise.resolve(),
    injectSwitcher: () => Promise.resolve(),
  };

  const result = await openCurrentWindowSwitcher(port);

  expect(result).toBe(false);
  expect(windowQueried).toBe(false);
});

test('openCurrentWindowSwitcher sends open message without injection when listener is already present', async () => {
  const callLog: string[] = [];
  const receivedMessages: OpenSwitcherMessage[] = [];

  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => {
      callLog.push('queryActiveTab');
      return Promise.resolve({ id: 10, windowId: 1, url: 'https://example.com/page' });
    },
    queryWindowTabs: (windowId) => {
      callLog.push(`queryWindowTabs:${windowId}`);
      return Promise.resolve([
        { id: 10, windowId: 1, title: 'Current Tab', lastAccessed: 500 },
        { id: 20, windowId: 1, title: 'Other Tab', lastAccessed: 400 },
      ]);
    },
    sendOpenMessage: (tabId, message) => {
      callLog.push(`sendOpenMessage:${tabId}`);
      receivedMessages.push(message);
      return Promise.resolve();
    },
    injectSwitcher: (tabId) => {
      callLog.push(`injectSwitcher:${tabId}`);
      return Promise.resolve();
    },
  };

  const result = await openCurrentWindowSwitcher(port);

  expect(result).toBe(true);
  expect(callLog).toEqual(['queryActiveTab', 'queryWindowTabs:1', 'sendOpenMessage:10']);
  expect(receivedMessages).toHaveLength(1);
  const delivered = receivedMessages[0];
  expect(delivered?.type).toBe('OPEN_SWITCHER');
  expect(delivered?.tabs.map((t) => t.id)).toEqual([20]);
});

test('openCurrentWindowSwitcher injects once then resends when initial send fails', async () => {
  const callLog: string[] = [];
  let sendAttempt = 0;

  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.resolve({ id: 5, windowId: 2, url: 'https://app.dev' }),
    queryWindowTabs: () =>
      Promise.resolve([
        { id: 5, windowId: 2, title: 'Active' },
        { id: 6, windowId: 2, title: 'Second Tab', lastAccessed: 100 },
      ]),
    sendOpenMessage: (tabId) => {
      sendAttempt++;
      callLog.push(`sendOpenMessage:${tabId}:attempt${sendAttempt}`);
      if (sendAttempt === 1) {
        return Promise.reject(
          new Error('Could not establish connection. Receiving end does not exist.'),
        );
      }
      return Promise.resolve();
    },
    injectSwitcher: (tabId) => {
      callLog.push(`injectSwitcher:${tabId}`);
      return Promise.resolve();
    },
  };

  const result = await openCurrentWindowSwitcher(port);

  expect(result).toBe(true);
  expect(callLog).toEqual([
    'sendOpenMessage:5:attempt1',
    'injectSwitcher:5',
    'sendOpenMessage:5:attempt2',
  ]);
});

test('openCurrentWindowSwitcher returns false without throwing when injection fails', async () => {
  const callLog: string[] = [];

  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.resolve({ id: 5, windowId: 2, url: 'https://app.dev' }),
    queryWindowTabs: () => Promise.resolve([{ id: 5, windowId: 2, title: 'Active' }]),
    sendOpenMessage: (tabId) => {
      callLog.push(`sendOpenMessage:${tabId}`);
      return Promise.reject(new Error('Connection failed'));
    },
    injectSwitcher: (tabId) => {
      callLog.push(`injectSwitcher:${tabId}`);
      return Promise.reject(new Error('Script injection blocked'));
    },
  };

  const result = await openCurrentWindowSwitcher(port);

  expect(result).toBe(false);
  expect(callLog).toEqual(['sendOpenMessage:5', 'injectSwitcher:5']);
});

test('openCurrentWindowSwitcher returns false without throwing when second send fails', async () => {
  const callLog: string[] = [];
  let sendAttempts = 0;

  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.resolve({ id: 5, windowId: 2, url: 'https://app.dev' }),
    queryWindowTabs: () => Promise.resolve([{ id: 5, windowId: 2, title: 'Active' }]),
    sendOpenMessage: (tabId) => {
      sendAttempts++;
      callLog.push(`sendOpenMessage:${tabId}:attempt${sendAttempts}`);
      return Promise.reject(new Error('Send failed'));
    },
    injectSwitcher: (tabId) => {
      callLog.push(`injectSwitcher:${tabId}`);
      return Promise.resolve();
    },
  };

  const result = await openCurrentWindowSwitcher(port);

  expect(result).toBe(false);
  expect(callLog).toEqual([
    'sendOpenMessage:5:attempt1',
    'injectSwitcher:5',
    'sendOpenMessage:5:attempt2',
  ]);
});

test('openCurrentWindowSwitcher propagates query failures from active tab query', async () => {
  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.reject(new Error('Tabs query failed')),
    queryWindowTabs: () => Promise.resolve([]),
    sendOpenMessage: () => Promise.resolve(),
    injectSwitcher: () => Promise.resolve(),
  };

  await expect(openCurrentWindowSwitcher(port)).rejects.toThrow('Tabs query failed');
});

test('openCurrentWindowSwitcher propagates query failures from window tabs query', async () => {
  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.resolve({ id: 1, windowId: 1, url: 'https://example.com' }),
    queryWindowTabs: () => Promise.reject(new Error('Window tabs query failed')),
    sendOpenMessage: () => Promise.resolve(),
    injectSwitcher: () => Promise.resolve(),
  };

  await expect(openCurrentWindowSwitcher(port)).rejects.toThrow('Window tabs query failed');
});

test('openCurrentWindowSwitcher excludes current tab and includes all same-window tabs beyond 10 in MRU order', async () => {
  const allTabs: BrowserTabData[] = [];
  // 15 tabs in window 1 with increasing recency
  for (let i = 1; i <= 15; i++) {
    allTabs.push({
      id: i,
      windowId: 1,
      title: `Tab ${i}`,
      lastAccessed: i * 10,
    });
  }
  // 2 tabs in window 2
  allTabs.push({ id: 100, windowId: 2, title: 'Other Win 1' });
  allTabs.push({ id: 101, windowId: 2, title: 'Other Win 2' });

  const deliveredMessages: OpenSwitcherMessage[] = [];
  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.resolve({ id: 1, windowId: 1, url: 'https://example.com' }),
    queryWindowTabs: () => Promise.resolve(allTabs),
    sendOpenMessage: (_tabId, msg) => {
      deliveredMessages.push(msg);
      return Promise.resolve();
    },
    injectSwitcher: () => Promise.resolve(),
  };

  const result = await openCurrentWindowSwitcher(port);

  expect(result).toBe(true);
  expect(deliveredMessages).toHaveLength(1);
  const sentMessage = deliveredMessages[0];
  expect(sentMessage?.tabs).toHaveLength(14); // 15 minus active tab id 1
  expect(sentMessage?.tabs.map((t) => t.id)).toEqual([
    15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
  ]);
});

test('openCurrentWindowSwitcher sends empty OPEN message when no other tabs exist in window', async () => {
  const deliveredMessages: OpenSwitcherMessage[] = [];
  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.resolve({ id: 1, windowId: 1, url: 'https://example.com' }),
    queryWindowTabs: () => Promise.resolve([{ id: 1, windowId: 1, url: 'https://example.com' }]),
    sendOpenMessage: (_tabId, msg) => {
      deliveredMessages.push(msg);
      return Promise.resolve();
    },
    injectSwitcher: () => Promise.resolve(),
  };

  const result = await openCurrentWindowSwitcher(port);

  expect(result).toBe(true);
  expect(deliveredMessages).toEqual([
    {
      type: 'OPEN_SWITCHER',
      tabs: [],
    },
  ]);
});

test('openCurrentWindowSwitcher preserves input immutability', async () => {
  const activeTab = Object.freeze({ id: 1, windowId: 1, url: 'https://example.com' });
  const windowTabs = Object.freeze([
    activeTab,
    Object.freeze({ id: 2, windowId: 1, title: 'Tab 2' }),
  ]);

  const port: SwitcherBackgroundPort = {
    queryActiveTab: () => Promise.resolve(activeTab),
    queryWindowTabs: () => Promise.resolve(windowTabs),
    sendOpenMessage: () => Promise.resolve(),
    injectSwitcher: () => Promise.resolve(),
  };

  const result = await openCurrentWindowSwitcher(port);
  expect(result).toBe(true);
});
