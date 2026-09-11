import { expect, test } from 'vitest';
import { MAX_QUICK_TABS } from '../../src/domain/tab';
import { searchTabs } from '../../src/domain/tab-search';
import { createTab } from '../fixtures/tab';

test('searchTabs ranks exact match over whole-field prefix match', () => {
  const tabPrefix = createTab({ id: 1, title: 'Docs Search', hostname: 'example.com' });
  const tabExact = createTab({ id: 2, title: 'Docs', hostname: 'example.com' });

  const result = searchTabs([tabPrefix, tabExact], 'Docs');

  expect(result.map((t) => t.id)).toEqual([2, 1]);
});

test('searchTabs ranks whole-field prefix over word prefix', () => {
  const tabWordPrefix = createTab({ id: 1, title: 'API Documentation', hostname: 'example.com' });
  const tabFieldPrefix = createTab({ id: 2, title: 'Documentation API', hostname: 'example.com' });

  const result = searchTabs([tabWordPrefix, tabFieldPrefix], 'doc');

  expect(result.map((t) => t.id)).toEqual([2, 1]);
});

test('searchTabs ranks word prefix over non-word substring', () => {
  const tabSubstring = createTab({ id: 1, title: 'Redoc Reader', hostname: 'example.com' });
  const tabWordPrefix = createTab({ id: 2, title: 'API Documentation', hostname: 'example.com' });

  const result = searchTabs([tabSubstring, tabWordPrefix], 'doc');

  expect(result.map((t) => t.id)).toEqual([2, 1]);
});

test('searchTabs ranks substring over subsequence match', () => {
  const tabSubsequence = createTab({
    id: 1,
    title: 'Default Options and Config',
    hostname: 'example.com',
  }); // d-o-c
  const tabSubstring = createTab({ id: 2, title: 'Redoc Reader', hostname: 'example.com' }); // "doc"

  const result = searchTabs([tabSubsequence, tabSubstring], 'doc');

  expect(result.map((t) => t.id)).toEqual([2, 1]);
});

test('searchTabs resolves equal-quality matches by field priority (title > hostname)', () => {
  const tabHostname = createTab({
    id: 1,
    title: 'Beta Page',
    hostname: 'xneedle.test',
    url: 'https://xneedle.test',
  });
  const tabTitle = createTab({
    id: 2,
    title: 'xneedle',
    hostname: 'alpha.org',
    url: 'https://alpha.org/page',
  });

  const result = searchTabs([tabHostname, tabTitle], 'needle');

  expect(result.map((t) => t.id)).toEqual([2, 1]);
});

test('searchTabs ignores query terms that appear only in URL path or query string', () => {
  const tabWithPath = createTab({
    id: 1,
    title: 'Example Page',
    hostname: 'example.com',
    url: 'https://example.com/deep/path/target-token?query=target-token',
  });

  const result = searchTabs([tabWithPath], 'target-token');

  expect(result).toEqual([]);
});

test('searchTabs ranks stronger lower-priority-field quality over weaker title quality', () => {
  const tabTitleSubsequence = createTab({
    id: 1,
    title: 'Desktop Options Commands System', // d-o-c-s subsequence
    hostname: 'example.com',
    url: 'https://example.com',
  });
  const tabHostPrefix = createTab({
    id: 2,
    title: 'Home Page',
    hostname: 'docs.example.com', // "docs" whole-field prefix on hostname
    url: 'https://docs.example.com',
  });

  const result = searchTabs([tabTitleSubsequence, tabHostPrefix], 'docs');

  // Hostname WholeFieldPrefix beats Title Subsequence
  expect(result.map((t) => t.id)).toEqual([2, 1]);
});

test('searchTabs breaks equal quality and field ties using MRU descending with known recency before null', () => {
  const tabNull = createTab({ id: 1, title: 'React Guide', lastAccessed: null });
  const tabOlder = createTab({ id: 2, title: 'React Guide', lastAccessed: 1000 });
  const tabNewer = createTab({ id: 3, title: 'React Guide', lastAccessed: 2000 });

  const result = searchTabs([tabNull, tabOlder, tabNewer], 'react');

  expect(result.map((t) => t.id)).toEqual([3, 2, 1]);
});

test('searchTabs breaks MRU ties deterministically by ascending tab id', () => {
  const tabHighId = createTab({ id: 50, title: 'React', lastAccessed: 1000 });
  const tabLowId = createTab({ id: 10, title: 'React', lastAccessed: 1000 });
  const tabMidId = createTab({ id: 25, title: 'React', lastAccessed: 1000 });

  const result = searchTabs([tabHighId, tabLowId, tabMidId], 'react');

  expect(result.map((t) => t.id)).toEqual([10, 25, 50]);
});

test('searchTabs operates case-insensitively for queries and tab fields', () => {
  const tab1 = createTab({ id: 1, title: 'GITHUB REPOSITORIES', hostname: 'GITHUB.COM' });
  const tab2 = createTab({ id: 2, title: 'gitlab projects', hostname: 'gitlab.com' });

  const resultUpper = searchTabs([tab1, tab2], 'GITHUB');
  const resultLower = searchTabs([tab1, tab2], 'github');

  expect(resultUpper.map((t) => t.id)).toEqual([1]);
  expect(resultLower.map((t) => t.id)).toEqual([1]);
  expect(resultUpper).toEqual(resultLower);
});

test('searchTabs returns MRU order when query is empty or whitespace only', () => {
  const tabOld = createTab({ id: 1, title: 'Old Tab', lastAccessed: 100 });
  const tabNew = createTab({ id: 2, title: 'New Tab', lastAccessed: 300 });
  const tabMid = createTab({ id: 3, title: 'Mid Tab', lastAccessed: 200 });

  const emptyResult = searchTabs([tabOld, tabNew, tabMid], '');
  const whitespaceResult = searchTabs([tabOld, tabNew, tabMid], '   \t  ');

  expect(emptyResult.map((t) => t.id)).toEqual([2, 3, 1]);
  expect(whitespaceResult.map((t) => t.id)).toEqual([2, 3, 1]);
});

test('searchTabs preserves input order on duplicate tabs with identical ranking properties', () => {
  const first = createTab({ id: 5, title: 'Vue Docs', lastAccessed: 1000 });
  const second = createTab({ id: 5, title: 'Vue Docs', lastAccessed: 1000 });

  const result = searchTabs([first, second], 'vue');

  expect(result).toHaveLength(2);
  expect(result[0]).toBe(first);
  expect(result[1]).toBe(second);
});

test('searchTabs returns empty array when no tabs match query', () => {
  const tabs = [
    createTab({ id: 1, title: 'React', hostname: 'react.dev', url: 'https://react.dev' }),
    createTab({ id: 2, title: 'Vue', hostname: 'vuejs.org', url: 'https://vuejs.org' }),
  ];

  const result = searchTabs(tabs, 'angular');

  expect(result).toEqual([]);
});

test('searchTabs respects default cap of MAX_QUICK_TABS (10) and custom limits', () => {
  const tabs = Array.from({ length: 15 }, (_, i) =>
    createTab({ id: i + 1, title: `Item ${i + 1} Docs`, lastAccessed: (i + 1) * 100 }),
  );

  const defaultResult = searchTabs(tabs, 'docs');
  expect(defaultResult).toHaveLength(MAX_QUICK_TABS);
  expect(defaultResult).toHaveLength(10);

  const customResult = searchTabs(tabs, 'docs', 3);
  expect(customResult).toHaveLength(3);

  expect(searchTabs(tabs, 'docs', 0)).toEqual([]);
  expect(searchTabs(tabs, 'docs', -5)).toEqual([]);
  expect(searchTabs(tabs, 'docs', NaN)).toEqual([]);
  expect(searchTabs(tabs, 'docs', Infinity)).toEqual([]);
});

test('searchTabs does not mutate input tabs array or individual tab objects', () => {
  const tab1 = Object.freeze(createTab({ id: 1, title: 'React Docs' }));
  const tab2 = Object.freeze(createTab({ id: 2, title: 'React Native' }));
  const inputList = Object.freeze([tab1, tab2]);

  const result = searchTabs(inputList, 'react');

  expect(inputList).toHaveLength(2);
  expect(inputList[0]?.id).toBe(1);
  expect(inputList[1]?.id).toBe(2);
  expect(result).toHaveLength(2);
});

test('searchTabs correctly sorts known recency before null recency when known tab appears first', () => {
  const tabKnown = createTab({ id: 1, title: 'React Guide', lastAccessed: 500 });
  const tabNull = createTab({ id: 2, title: 'React Guide', lastAccessed: null });

  const result = searchTabs([tabKnown, tabNull], 'react');

  expect(result.map((t) => t.id)).toEqual([1, 2]);
});

test('searchTabs handles fractional limits by flooring to integer count', () => {
  const tabs = [createTab({ id: 1, title: 'Docs 1' }), createTab({ id: 2, title: 'Docs 2' })];

  expect(searchTabs(tabs, 'docs', 0.8)).toEqual([]);
  expect(searchTabs(tabs, 'docs', 1.9)).toHaveLength(1);
});
