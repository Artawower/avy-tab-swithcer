import { expect, test } from 'vitest';
import { MAX_QUICK_TABS } from '../../src/domain/tab';
import { getRecentTabs } from '../../src/domain/tab-order';
import { createTab } from '../fixtures/tab';

test('getRecentTabs orders tabs by descending lastAccessed recency', () => {
  const tabA = createTab({ id: 1, lastAccessed: 1000 });
  const tabB = createTab({ id: 2, lastAccessed: 3000 });
  const tabC = createTab({ id: 3, lastAccessed: 2000 });

  const result = getRecentTabs([tabA, tabB, tabC], null);

  expect(result.map((t) => t.id)).toEqual([2, 3, 1]);
});

test('getRecentTabs excludes currentTabId when non-null', () => {
  const tab1 = createTab({ id: 1, lastAccessed: 5000 });
  const tab2 = createTab({ id: 2, lastAccessed: 4000 });
  const tab3 = createTab({ id: 3, lastAccessed: 3000 });

  const result = getRecentTabs([tab1, tab2, tab3], 2);

  expect(result.map((t) => t.id)).toEqual([1, 3]);
  expect(result.some((t) => t.id === 2)).toBe(false);
});

test('getRecentTabs keeps all matching tabs when currentTabId is null', () => {
  const tab1 = createTab({ id: 1, lastAccessed: 5000 });
  const tab2 = createTab({ id: 2, lastAccessed: 4000 });

  const result = getRecentTabs([tab1, tab2], null);

  expect(result.map((t) => t.id)).toEqual([1, 2]);
});

test('getRecentTabs breaks equal lastAccessed ties deterministically by ascending tab id', () => {
  const tabA = createTab({ id: 40, lastAccessed: 2500 });
  const tabB = createTab({ id: 10, lastAccessed: 2500 });
  const tabC = createTab({ id: 25, lastAccessed: 2500 });

  const result = getRecentTabs([tabA, tabB, tabC], null);

  expect(result.map((t) => t.id)).toEqual([10, 25, 40]);
});

test('getRecentTabs preserves input order as final fallback when both timestamp and tab id are equal', () => {
  const first = createTab({ id: 7, title: 'First Instance', lastAccessed: 1000 });
  const second = createTab({ id: 7, title: 'Second Instance', lastAccessed: 1000 });

  const result = getRecentTabs([first, second], null);

  expect(result).toHaveLength(2);
  expect(result[0]?.title).toBe('First Instance');
  expect(result[1]?.title).toBe('Second Instance');
});

test('getRecentTabs returns all available tabs when fewer than the default limit of 10 exist', () => {
  const tabs = [
    createTab({ id: 1, lastAccessed: 300 }),
    createTab({ id: 2, lastAccessed: 200 }),
    createTab({ id: 3, lastAccessed: 100 }),
  ];

  const result = getRecentTabs(tabs, null);

  expect(result).toHaveLength(3);
  expect(result.map((t) => t.id)).toEqual([1, 2, 3]);
});

test('getRecentTabs caps output at default MAX_QUICK_TABS (10) when more than 10 are available', () => {
  const tabs = Array.from({ length: 15 }, (_, i) =>
    createTab({ id: i + 1, lastAccessed: (i + 1) * 100 }),
  );

  const result = getRecentTabs(tabs, null);

  expect(result).toHaveLength(MAX_QUICK_TABS);
  expect(result).toHaveLength(10);
  expect(result.map((t) => t.id)).toEqual([15, 14, 13, 12, 11, 10, 9, 8, 7, 6]);
});

test('getRecentTabs respects explicit custom positive limit', () => {
  const tabs = [
    createTab({ id: 1, lastAccessed: 100 }),
    createTab({ id: 2, lastAccessed: 200 }),
    createTab({ id: 3, lastAccessed: 300 }),
    createTab({ id: 4, lastAccessed: 400 }),
  ];

  const result = getRecentTabs(tabs, null, 2);

  expect(result).toHaveLength(2);
  expect(result.map((t) => t.id)).toEqual([4, 3]);
});

test('getRecentTabs places tabs with null lastAccessed after tabs with known finite recency', () => {
  const knownA = createTab({ id: 1, lastAccessed: 50 });
  const unknownA = createTab({ id: 2, lastAccessed: null });
  const knownB = createTab({ id: 3, lastAccessed: 100 });
  const unknownB = createTab({ id: 4, lastAccessed: null });

  const result = getRecentTabs([unknownA, knownA, unknownB, knownB], null);

  expect(result.map((t) => t.id)).toEqual([3, 1, 2, 4]);
});

test('getRecentTabs breaks ties between multiple null recency tabs by ascending tab id', () => {
  const tabZ = createTab({ id: 99, lastAccessed: null });
  const tabA = createTab({ id: 5, lastAccessed: null });
  const tabM = createTab({ id: 50, lastAccessed: null });

  const result = getRecentTabs([tabZ, tabA, tabM], null);

  expect(result.map((t) => t.id)).toEqual([5, 50, 99]);
});

test('getRecentTabs returns empty array when given empty tabs array', () => {
  const result = getRecentTabs([], null);

  expect(result).toEqual([]);
});

test('getRecentTabs produces stable identical results across repeated calls', () => {
  const tabs = [
    createTab({ id: 3, lastAccessed: 500 }),
    createTab({ id: 1, lastAccessed: 500 }),
    createTab({ id: 2, lastAccessed: null }),
  ];

  const firstCall = getRecentTabs(tabs, null);
  const secondCall = getRecentTabs(tabs, null);

  expect(firstCall.map((t) => t.id)).toEqual(secondCall.map((t) => t.id));
  expect(firstCall).toEqual(secondCall);
});

test('getRecentTabs does not mutate input tabs array or individual tab objects', () => {
  const tab1 = Object.freeze(createTab({ id: 1, lastAccessed: 100 }));
  const tab2 = Object.freeze(createTab({ id: 2, lastAccessed: 200 }));
  const inputList = Object.freeze([tab1, tab2]);

  const result = getRecentTabs(inputList, null);

  expect(inputList).toHaveLength(2);
  expect(inputList[0]?.id).toBe(1);
  expect(inputList[1]?.id).toBe(2);
  expect(result.map((t) => t.id)).toEqual([2, 1]);
});

test('getRecentTabs returns empty array when limit is zero', () => {
  const tabs = [createTab({ id: 1, lastAccessed: 100 })];

  const result = getRecentTabs(tabs, null, 0);

  expect(result).toEqual([]);
});

test('getRecentTabs returns empty array when limit is negative', () => {
  const tabs = [createTab({ id: 1, lastAccessed: 100 })];

  const result = getRecentTabs(tabs, null, -5);

  expect(result).toEqual([]);
});

test('getRecentTabs safely returns empty array without throwing when limit is non-finite', () => {
  const tabs = [createTab({ id: 1, lastAccessed: 100 })];

  expect(getRecentTabs(tabs, null, NaN)).toEqual([]);
  expect(getRecentTabs(tabs, null, Infinity)).toEqual([]);
  expect(getRecentTabs(tabs, null, -Infinity)).toEqual([]);
});

test('getRecentTabs safely floors non-integer positive limits to integer count', () => {
  const tabs = [
    createTab({ id: 1, lastAccessed: 100 }),
    createTab({ id: 2, lastAccessed: 200 }),
    createTab({ id: 3, lastAccessed: 300 }),
  ];

  const result = getRecentTabs(tabs, null, 2.7);

  expect(result).toHaveLength(2);
  expect(result.map((t) => t.id)).toEqual([3, 2]);

  const zeroResult = getRecentTabs(tabs, null, 0.9);
  expect(zeroResult).toEqual([]);
});
