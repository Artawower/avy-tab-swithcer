import { expect, test } from 'vitest';
import {
  activateTabInWindow,
  getCurrentWindowTabs,
  toSwitchableTab,
  type BrowserTabData,
  type TabActivationPort,
} from '../../src/application/tab-operations';

test('toSwitchableTab normalizes complete browser tab metadata', () => {
  const browserTab: BrowserTabData = {
    id: 10,
    windowId: 2,
    title: 'GitHub Pull Requests',
    url: 'https://GitHub.com/pulls',
    favIconUrl: 'https://github.com/favicon.ico',
    lastAccessed: 1700000000000,
  };

  expect(toSwitchableTab(browserTab)).toEqual({
    id: 10,
    windowId: 2,
    title: 'GitHub Pull Requests',
    url: 'https://GitHub.com/pulls',
    hostname: 'github.com',
    faviconUrl: 'https://github.com/favicon.ico',
    lastAccessed: 1700000000000,
  });
});

test('toSwitchableTab applies fallbacks for missing title, url, favicon, and lastAccessed', () => {
  const browserTab: BrowserTabData = {
    id: 1,
    windowId: 1,
  };

  expect(toSwitchableTab(browserTab)).toEqual({
    id: 1,
    windowId: 1,
    title: '',
    url: '',
    hostname: '',
    faviconUrl: null,
    lastAccessed: null,
  });
});

test('toSwitchableTab falls back to null on empty favIconUrl', () => {
  const tabWithEmptyFavicon: BrowserTabData = {
    id: 1,
    windowId: 1,
    favIconUrl: '',
  };

  expect(toSwitchableTab(tabWithEmptyFavicon)?.faviconUrl).toBeNull();
});

test('toSwitchableTab extracts and lowercases hostnames across various URL formats and schemes', () => {
  const testCases = [
    { url: 'http://EXAMPLE.ORG:8080/path', expectedHostname: 'example.org' },
    { url: 'https://SUB.Domain.Net/resource?q=1', expectedHostname: 'sub.domain.net' },
    { url: 'chrome://extensions/', expectedHostname: 'extensions' },
    { url: 'about:blank', expectedHostname: '' },
    { url: 'file:///path/to/local/file', expectedHostname: '' },
    { url: 'javascript:void(0)', expectedHostname: '' },
    { url: 'malformed-url-without-scheme', expectedHostname: '' },
    { url: '', expectedHostname: '' },
  ];

  for (const { url, expectedHostname } of testCases) {
    const result = toSwitchableTab({ id: 1, windowId: 1, url });
    expect(result?.hostname).toBe(expectedHostname);
  }
});

test('toSwitchableTab rejects missing or invalid id', () => {
  expect(toSwitchableTab({})).toBeNull();
  expect(toSwitchableTab({ windowId: 1 })).toBeNull();
  expect(toSwitchableTab({ id: -1, windowId: 1 })).toBeNull();
  expect(toSwitchableTab({ id: 1.5, windowId: 1 })).toBeNull();
  expect(toSwitchableTab({ id: Number.NaN, windowId: 1 })).toBeNull();
  expect(toSwitchableTab({ id: Number.POSITIVE_INFINITY, windowId: 1 })).toBeNull();
  expect(toSwitchableTab({ id: Number.NEGATIVE_INFINITY, windowId: 1 })).toBeNull();
});

test('toSwitchableTab rejects missing or invalid windowId', () => {
  expect(toSwitchableTab({ id: 1 })).toBeNull();
  expect(toSwitchableTab({ id: 1, windowId: -1 })).toBeNull();
  expect(toSwitchableTab({ id: 1, windowId: 2.2 })).toBeNull();
  expect(toSwitchableTab({ id: 1, windowId: Number.NaN })).toBeNull();
  expect(toSwitchableTab({ id: 1, windowId: Number.POSITIVE_INFINITY })).toBeNull();
  expect(toSwitchableTab({ id: 1, windowId: Number.NEGATIVE_INFINITY })).toBeNull();
});

test('toSwitchableTab handles finite recency values and falls back to null on non-finite values', () => {
  expect(toSwitchableTab({ id: 1, windowId: 1, lastAccessed: 0 })?.lastAccessed).toBe(0);
  expect(toSwitchableTab({ id: 1, windowId: 1, lastAccessed: 123456 })?.lastAccessed).toBe(123456);
  expect(toSwitchableTab({ id: 1, windowId: 1, lastAccessed: Number.NaN })?.lastAccessed).toBeNull();
  expect(toSwitchableTab({ id: 1, windowId: 1, lastAccessed: Number.POSITIVE_INFINITY })?.lastAccessed).toBeNull();
  expect(toSwitchableTab({ id: 1, windowId: 1, lastAccessed: Number.NEGATIVE_INFINITY })?.lastAccessed).toBeNull();
});

test('getCurrentWindowTabs excludes other windows and currentTabId', () => {
  const tabs: BrowserTabData[] = [
    { id: 1, windowId: 1, title: 'Current Tab', lastAccessed: 300 },
    { id: 2, windowId: 1, title: 'Same Window Tab 2', lastAccessed: 200 },
    { id: 3, windowId: 2, title: 'Other Window Tab', lastAccessed: 400 },
    { id: 4, windowId: 1, title: 'Same Window Tab 4', lastAccessed: 100 },
  ];

  const result = getCurrentWindowTabs(tabs, 1, 1);

  expect(result.map((t) => t.id)).toEqual([2, 4]);
});

test('getCurrentWindowTabs skips invalid tab records', () => {
  const tabs: BrowserTabData[] = [
    { id: 1, windowId: 1, title: 'Valid 1', lastAccessed: 100 },
    { id: -5, windowId: 1, title: 'Invalid Negative ID' },
    { id: 2, windowId: -1, title: 'Invalid Negative Window' },
    { windowId: 1, title: 'Missing ID' },
    { id: 3, windowId: 1, title: 'Valid 3', lastAccessed: 200 },
  ];

  const result = getCurrentWindowTabs(tabs, 999, 1);

  expect(result.map((t) => t.id)).toEqual([3, 1]);
});

test('getCurrentWindowTabs returns all same-window tabs beyond MAX_QUICK_TABS in MRU order', () => {
  const tabs: BrowserTabData[] = [];
  for (let i = 1; i <= 15; i++) {
    tabs.push({
      id: i,
      windowId: 1,
      title: `Tab ${i}`,
      lastAccessed: i * 100,
    });
  }

  // currentTabId is 1, so 14 tabs remain in windowId 1
  const result = getCurrentWindowTabs(tabs, 1, 1);

  expect(result).toHaveLength(14);
  expect(result.map((t) => t.id)).toEqual([
    15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
  ]);
});

test('getCurrentWindowTabs preserves deterministic tie-breaking and input immutability', () => {
  const tabs: readonly BrowserTabData[] = Object.freeze([
    Object.freeze({ id: 30, windowId: 1, title: 'Tie 30' }),
    Object.freeze({ id: 10, windowId: 1, title: 'Tie 10' }),
    Object.freeze({ id: 20, windowId: 1, title: 'Tie 20' }),
  ]);

  const result = getCurrentWindowTabs(tabs, 999, 1);

  // When recency is missing/null, getRecentTabs breaks ties by id ascending
  expect(result.map((t) => t.id)).toEqual([10, 20, 30]);
});

test('activateTabInWindow succeeds and calls get followed by activate with target tabId', async () => {
  const callLog: string[] = [];
  const port: TabActivationPort = {
    get: async (tabId: number) => {
      callLog.push(`get:${tabId}`);
      return { id: tabId, windowId: 10 };
    },
    activate: async (tabId: number) => {
      callLog.push(`activate:${tabId}`);
    },
  };

  const result = await activateTabInWindow(port, 42, 10);

  expect(result).toEqual({ ok: true });
  expect(callLog).toEqual(['get:42', 'activate:42']);
});

test('activateTabInWindow blocks activation when target tab is in a different window', async () => {
  const callLog: string[] = [];
  const port: TabActivationPort = {
    get: async (tabId: number) => {
      callLog.push(`get:${tabId}`);
      return { id: tabId, windowId: 99 };
    },
    activate: async (tabId: number) => {
      callLog.push(`activate:${tabId}`);
    },
  };

  const result = await activateTabInWindow(port, 42, 10);

  expect(result).toEqual({ ok: false, reason: 'wrong-window' });
  expect(callLog).toEqual(['get:42']);
});

test('activateTabInWindow blocks activation when fetched tab id does not match requested tabId', async () => {
  const callLog: string[] = [];
  const port: TabActivationPort = {
    get: async (tabId: number) => {
      callLog.push(`get:${tabId}`);
      return { id: 999, windowId: 10 };
    },
    activate: async (tabId: number) => {
      callLog.push(`activate:${tabId}`);
    },
  };

  const result = await activateTabInWindow(port, 42, 10);

  expect(result).toEqual({ ok: false, reason: 'tab-unavailable' });
  expect(callLog).toEqual(['get:42']);
});

test('activateTabInWindow blocks activation when fetched tab metadata is invalid', async () => {
  const port: TabActivationPort = {
    get: async () => ({ id: -1, windowId: 10 }),
    activate: async () => {},
  };

  const result = await activateTabInWindow(port, 42, 10);

  expect(result).toEqual({ ok: false, reason: 'tab-unavailable' });
});

test('activateTabInWindow handles port.get rejection cleanly as tab-unavailable', async () => {
  const callLog: string[] = [];
  const port: TabActivationPort = {
    get: async (tabId: number) => {
      callLog.push(`get:${tabId}`);
      throw new Error('Tab not found');
    },
    activate: async (tabId: number) => {
      callLog.push(`activate:${tabId}`);
    },
  };

  const result = await activateTabInWindow(port, 42, 10);

  expect(result).toEqual({ ok: false, reason: 'tab-unavailable' });
  expect(callLog).toEqual(['get:42']);
});

test('activateTabInWindow handles port.activate rejection cleanly as tab-unavailable', async () => {
  const callLog: string[] = [];
  const port: TabActivationPort = {
    get: async (tabId: number) => {
      callLog.push(`get:${tabId}`);
      return { id: tabId, windowId: 10 };
    },
    activate: async (tabId: number) => {
      callLog.push(`activate:${tabId}`);
      throw new Error('Tab closed before activation');
    },
  };

  const result = await activateTabInWindow(port, 42, 10);

  expect(result).toEqual({ ok: false, reason: 'tab-unavailable' });
  expect(callLog).toEqual(['get:42', 'activate:42']);
});
