import { expect, test } from 'vitest';
import {
  isActivateTabMessage,
  isOpenSwitcherMessage,
  isSwitchableTab,
  type ActivateTabMessage,
  type OpenSwitcherMessage,
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

test('isOpenSwitcherMessage accepts valid message with non-empty tabs', () => {
  const message: unknown = {
    type: 'OPEN_SWITCHER',
    tabs: [createTab({ id: 1 }), createTab({ id: 2 })],
  };

  if (isOpenSwitcherMessage(message)) {
    const validMessage: OpenSwitcherMessage = message;
    expect(validMessage.type).toBe('OPEN_SWITCHER');
    expect(validMessage.tabs).toHaveLength(2);
  } else {
    expect.fail('Expected isOpenSwitcherMessage to return true');
  }
});

test('isOpenSwitcherMessage accepts valid message with empty tabs', () => {
  const message: unknown = {
    type: 'OPEN_SWITCHER',
    tabs: [],
  };

  expect(isOpenSwitcherMessage(message)).toBe(true);
});

test('isOpenSwitcherMessage rejects non-record values', () => {
  expect(isOpenSwitcherMessage(null)).toBe(false);
  expect(isOpenSwitcherMessage(undefined)).toBe(false);
  expect(isOpenSwitcherMessage(42)).toBe(false);
  expect(isOpenSwitcherMessage('OPEN_SWITCHER')).toBe(false);
  expect(isOpenSwitcherMessage([])).toBe(false);
});

test('isOpenSwitcherMessage rejects wrong or missing type discriminant', () => {
  expect(isOpenSwitcherMessage({ tabs: [] })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'ACTIVATE_TAB', tabs: [] })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'open_switcher', tabs: [] })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'UNKNOWN', tabs: [] })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 123, tabs: [] })).toBe(false);
  expect(isOpenSwitcherMessage({ type: null, tabs: [] })).toBe(false);
});

test('isOpenSwitcherMessage rejects missing or non-array tabs', () => {
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER' })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: null })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: undefined })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: {} })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: 'invalid' })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: 123 })).toBe(false);
});

test('isOpenSwitcherMessage rejects when any tab in tabs array is invalid', () => {
  const validTab = createTab({ id: 1 });
  const invalidTab = { ...createTab({ id: 2 }), id: -1 };

  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: [invalidTab] })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: [validTab, invalidTab] })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: [invalidTab, validTab] })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: [validTab, null] })).toBe(false);
  expect(isOpenSwitcherMessage({ type: 'OPEN_SWITCHER', tabs: ['not a tab'] })).toBe(false);
});

test('isOpenSwitcherMessage tolerates extra properties', () => {
  const message = {
    type: 'OPEN_SWITCHER',
    tabs: [createTab()],
    senderContext: 'background',
    timestamp: Date.now(),
  };

  expect(isOpenSwitcherMessage(message)).toBe(true);
});

test('isOpenSwitcherMessage does not mutate input object or tabs array', () => {
  const tabs = Object.freeze([Object.freeze(createTab())]);
  const message = Object.freeze({
    type: 'OPEN_SWITCHER',
    tabs,
  });

  expect(isOpenSwitcherMessage(message)).toBe(true);
});

test('isActivateTabMessage accepts valid message', () => {
  const message: unknown = {
    type: 'ACTIVATE_TAB',
    tabId: 42,
  };

  if (isActivateTabMessage(message)) {
    const validMessage: ActivateTabMessage = message;
    expect(validMessage.type).toBe('ACTIVATE_TAB');
    expect(validMessage.tabId).toBe(42);
  } else {
    expect.fail('Expected isActivateTabMessage to return true');
  }
});

test('isActivateTabMessage accepts valid message with tabId 0', () => {
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: 0 })).toBe(true);
});

test('isActivateTabMessage rejects non-record values', () => {
  expect(isActivateTabMessage(null)).toBe(false);
  expect(isActivateTabMessage(undefined)).toBe(false);
  expect(isActivateTabMessage(42)).toBe(false);
  expect(isActivateTabMessage('ACTIVATE_TAB')).toBe(false);
  expect(isActivateTabMessage([])).toBe(false);
});

test('isActivateTabMessage rejects wrong or missing type discriminant', () => {
  expect(isActivateTabMessage({ tabId: 1 })).toBe(false);
  expect(isActivateTabMessage({ type: 'OPEN_SWITCHER', tabId: 1 })).toBe(false);
  expect(isActivateTabMessage({ type: 'activate_tab', tabId: 1 })).toBe(false);
  expect(isActivateTabMessage({ type: 'UNKNOWN', tabId: 1 })).toBe(false);
  expect(isActivateTabMessage({ type: 123, tabId: 1 })).toBe(false);
  expect(isActivateTabMessage({ type: null, tabId: 1 })).toBe(false);
});

test('isActivateTabMessage rejects malformed tabId values', () => {
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: -1 })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: 1.5 })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: Number.NaN })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: Number.POSITIVE_INFINITY })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: Number.NEGATIVE_INFINITY })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: '42' })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: null })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB', tabId: undefined })).toBe(false);
  expect(isActivateTabMessage({ type: 'ACTIVATE_TAB' })).toBe(false);
});

test('isActivateTabMessage tolerates extra properties', () => {
  const message = {
    type: 'ACTIVATE_TAB',
    tabId: 99,
    source: 'content-script',
  };

  expect(isActivateTabMessage(message)).toBe(true);
});

test('isActivateTabMessage does not mutate input object', () => {
  const message = Object.freeze({
    type: 'ACTIVATE_TAB',
    tabId: 99,
  });

  expect(isActivateTabMessage(message)).toBe(true);
});
