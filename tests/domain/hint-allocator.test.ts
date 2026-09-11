import { expect, test } from 'vitest';
import { MAX_QUICK_TABS, getTabLabel } from '../../src/domain/tab';
import { allocateTabHints } from '../../src/domain/hint-allocator';
import { createTab } from '../fixtures/tab';

test('getTabLabel returns trimmed non-empty title', () => {
  const tab = createTab({ title: '  GitHub Repositories  ', hostname: 'github.com' });
  expect(getTabLabel(tab)).toBe('GitHub Repositories');
});

test('getTabLabel falls back to trimmed hostname when title is empty or whitespace', () => {
  const emptyTitleTab = createTab({ title: '', hostname: '  github.com  ' });
  expect(getTabLabel(emptyTitleTab)).toBe('github.com');

  const whitespaceTitleTab = createTab({ title: '   ', hostname: 'vitejs.dev' });
  expect(getTabLabel(whitespaceTitleTab)).toBe('vitejs.dev');
});

test('getTabLabel falls back to "Untitled tab" when title and hostname are empty or whitespace', () => {
  const blankTab = createTab({ title: '   ', hostname: '   ' });
  expect(getTabLabel(blankTab)).toBe('Untitled tab');
});

test('allocateTabHints assigns exactly one unique lowercase ASCII hint per returned tab', () => {
  const tabs = [
    createTab({ id: 1, title: 'Alpha' }),
    createTab({ id: 2, title: 'Beta' }),
    createTab({ id: 3, title: 'Gamma' }),
    createTab({ id: 4, title: 'Delta' }),
  ];

  const result = allocateTabHints(tabs);

  expect(result).toHaveLength(4);
  const hints = result.map((h) => h.hint);
  const uniqueHints = new Set(hints);

  expect(uniqueHints.size).toBe(4);
  for (const hint of hints) {
    expect(hint).toMatch(/^[a-z]$/);
  }
});

test('allocateTabHints is deterministic and case-insensitive across repeated calls', () => {
  const upperTabs = [
    createTab({ id: 1, title: 'GOOGLE SEARCH', hostname: 'GOOGLE.COM' }),
    createTab({ id: 2, title: 'GITHUB REPOSITORIES', hostname: 'GITHUB.COM' }),
  ];
  const lowerTabs = [
    createTab({ id: 1, title: 'google search', hostname: 'google.com' }),
    createTab({ id: 2, title: 'github repositories', hostname: 'github.com' }),
  ];

  const firstCall = allocateTabHints(upperTabs);
  const secondCall = allocateTabHints(upperTabs);
  const lowerCall = allocateTabHints(lowerTabs);

  expect(firstCall).toEqual(secondCall);
  expect(firstCall.map((r) => r.hint)).toEqual(lowerCall.map((r) => r.hint));
  expect(firstCall[0]?.hint).toBe('g');
  expect(firstCall[1]?.hint).not.toBe('g');
});

test('allocateTabHints prefers first ASCII letter found from start of title', () => {
  const tab = createTab({ id: 1, title: 'Wikipedia' });
  const result = allocateTabHints([tab]);

  expect(result[0]?.hint).toBe('w');
  expect(result[0]?.hintIndex).toBe(0);
});

test('allocateTabHints falls back to title word initials in word order', () => {
  const tab1 = createTab({ id: 1, title: 'Avy Tab Switcher' });
  const tab2 = createTab({ id: 2, title: 'Avy Browser Extension' });
  const tab3 = createTab({ id: 3, title: 'Avy Navigation Bar' });

  const result = allocateTabHints([tab1, tab2, tab3]);

  expect(result[0]?.hint).toBe('a'); // First letter of "Avy"
  expect(result[1]?.hint).toBe('b'); // Word-initial of "Browser" ('a' was taken)
  expect(result[2]?.hint).toBe('n'); // Word-initial of "Navigation" ('a' and 'b' were taken)
});

test('allocateTabHints allocates unique hints for duplicate titles', () => {
  const tab1 = createTab({ id: 1, title: 'React Documentation', hostname: 'react.dev' });
  const tab2 = createTab({ id: 2, title: 'React Documentation', hostname: 'react.dev' });
  const tab3 = createTab({ id: 3, title: 'React Documentation', hostname: 'react.dev' });

  const result = allocateTabHints([tab1, tab2, tab3]);

  expect(result[0]?.hint).toBe('r'); // from "React"
  expect(result[1]?.hint).toBe('d'); // from "Documentation"
  expect(result[2]?.hint).toBe('e'); // remaining letters from title/hostname
  const hints = new Set(result.map((r) => r.hint));
  expect(hints.size).toBe(3);
});

test('allocateTabHints allocates unique hints for duplicate domains with empty titles', () => {
  const tab1 = createTab({ id: 1, title: '', hostname: 'news.ycombinator.com' });
  const tab2 = createTab({ id: 2, title: '', hostname: 'news.ycombinator.com' });

  const result = allocateTabHints([tab1, tab2]);

  expect(result[0]?.hint).toBe('n'); // meaningful label 'news'
  expect(result[1]?.hint).toBe('y'); // meaningful label 'ycombinator'
  expect(result[0]?.hint).not.toBe(result[1]?.hint);
});

test('allocateTabHints skips leading punctuation, digits, and space to find first ASCII letter', () => {
  const tab1 = createTab({ id: 1, title: '123 [Docs] Quickstart' });
  const tab2 = createTab({ id: 2, title: '  --- #Vue Framework--- ' });

  const result = allocateTabHints([tab1, tab2]);

  expect(result[0]?.hint).toBe('d');
  expect(result[0]?.hintIndex).toBe(5); // index of 'D' in "123 [Docs] Quickstart"
  expect(result[1]?.hint).toBe('v');
  expect(result[1]?.hintIndex).toBe(5); // index of 'V' in "--- #Vue Framework---" (trimmed title)
});

test('allocateTabHints uses meaningful hostname labels when title is empty', () => {
  const tab = createTab({ id: 1, title: '', hostname: 'developer.mozilla.org' });
  const result = allocateTabHints([tab]);

  expect(result[0]?.hint).toBe('d'); // from 'developer'
  expect(result[0]?.hintIndex).toBe(0); // 'd' in "developer.mozilla.org"
});

test('allocateTabHints ignores www prefix and common TLD when evaluating hostname initials', () => {
  const tab = createTab({ id: 1, title: '', hostname: 'www.github.com' });
  const result = allocateTabHints([tab]);

  // 'www' is skipped, 'com' is final TLD and skipped; 'github' provides 'g'
  expect(result[0]?.hint).toBe('g');
  expect(result[0]?.hintIndex).toBe(4); // index of 'g' in "www.github.com"
});

test('allocateTabHints falls back to ASCII hostname for non-Latin titles', () => {
  const tab = createTab({ id: 1, title: 'Новости', hostname: 'bbc.com' });
  const result = allocateTabHints([tab]);

  expect(result[0]?.hint).toBe('b'); // from 'bbc'
  expect(result[0]?.hintIndex).toBeNull(); // 'Новости' has no ASCII 'b'
});

test('allocateTabHints falls back to alphabet for fully non-Latin title and hostname', () => {
  const tab = createTab({ id: 1, title: 'Почта', hostname: 'яндекс.рф' });
  const result = allocateTabHints([tab]);

  expect(result[0]?.hint).toBe('a'); // alphabet fallback
  expect(result[0]?.hintIndex).toBeNull(); // 'Почта' has no ASCII 'a'
});

test('allocateTabHints forces alphabet fallback when identical single-letter inputs exhaust options', () => {
  const tabs = Array.from({ length: 5 }, (_, i) =>
    createTab({ id: i + 1, title: 'A', hostname: 'a.com' }),
  );

  const result = allocateTabHints(tabs);

  expect(result).toHaveLength(5);
  const hints = result.map((r) => r.hint);
  const unique = new Set(hints);
  expect(unique.size).toBe(5);
  expect(hints[0]).toBe('a');
  expect(hints[1]).toBe('c'); // 'c' from 'com' in remaining letters
  expect(hints[2]).toBe('o'); // 'o' from 'com' in remaining letters
  expect(hints[3]).toBe('m'); // 'm' from 'com' in remaining letters
  expect(hints[4]).toBe('b'); // step 5 alphabet fallback ('a' used, 'b' first unused)
  expect(result[4]?.hintIndex).toBeNull(); // 'b' not in "A"
});

test('allocateTabHints correctly sets hintIndex and returns null when hint is absent from displayed label', () => {
  const tabInLabel = createTab({ id: 1, title: 'Fast Search', hostname: 'example.com' });
  const tabNotInLabel = createTab({ id: 2, title: 'Файлы', hostname: 'files.example.com' });

  const result = allocateTabHints([tabInLabel, tabNotInLabel]);

  expect(result[0]?.hint).toBe('f');
  expect(result[0]?.hintIndex).toBe(0);

  // 'f' from 'files' is chosen, but displayed label is 'Файлы' which lacks ASCII 'f'
  expect(result[1]?.hint).not.toBe('f');
  expect(result[1]?.hintIndex).toBeNull();
});

test('allocateTabHints caps at MAX_QUICK_TABS (10) preserving input order', () => {
  const tabs = Array.from({ length: 15 }, (_, i) =>
    createTab({ id: i + 1, title: `Tab ${i + 1}`, hostname: `site${i + 1}.com` }),
  );

  const result = allocateTabHints(tabs);

  expect(result).toHaveLength(MAX_QUICK_TABS);
  expect(result).toHaveLength(10);
  expect(result.map((r) => r.tab.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('allocateTabHints does not mutate input tabs array or tab objects', () => {
  const tab1 = Object.freeze(createTab({ id: 1, title: 'First' }));
  const tab2 = Object.freeze(createTab({ id: 2, title: 'Second' }));
  const inputList = Object.freeze([tab1, tab2]);

  const result = allocateTabHints(inputList);

  expect(inputList).toHaveLength(2);
  expect(inputList[0]?.id).toBe(1);
  expect(inputList[1]?.id).toBe(2);
  expect(result).toHaveLength(2);
});

test('allocateTabHints supports single-label hostnames like localhost', () => {
  const tab = createTab({ id: 1, title: '', hostname: 'localhost' });
  const result = allocateTabHints([tab]);

  expect(result[0]?.hint).toBe('l');
  expect(result[0]?.hintIndex).toBe(0);
});
