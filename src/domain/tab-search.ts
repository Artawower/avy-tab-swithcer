import { MAX_QUICK_TABS, type SwitchableTab } from './tab';
import { compareTabRecency, getRecentTabs, normalizeTabLimit } from './tab-order';

const enum MatchQuality {
  Exact = 0,
  WholeFieldPrefix = 1,
  WordPrefix = 2,
  Substring = 3,
  Subsequence = 4,
  NoMatch = 5,
}

const enum FieldPriority {
  Title = 0,
  Hostname = 1,
}

interface BestMatch {
  readonly quality: MatchQuality;
  readonly fieldPriority: FieldPriority;
}

function isSubsequence(query: string, target: string): boolean {
  if (query.length > target.length) {
    return false;
  }
  let qIdx = 0;
  let tIdx = 0;
  while (qIdx < query.length && tIdx < target.length) {
    if (query[qIdx] === target[tIdx]) {
      qIdx++;
    }
    tIdx++;
  }
  return qIdx === query.length;
}

function getFieldMatchQuality(field: string, query: string): MatchQuality {
  if (field === query) {
    return MatchQuality.Exact;
  }
  if (field.startsWith(query)) {
    return MatchQuality.WholeFieldPrefix;
  }
  const words = field.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 0);
  if (words.length > 1) {
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (word && word.startsWith(query)) {
        return MatchQuality.WordPrefix;
      }
    }
  }
  if (field.includes(query)) {
    return MatchQuality.Substring;
  }
  if (isSubsequence(query, field)) {
    return MatchQuality.Subsequence;
  }
  return MatchQuality.NoMatch;
}

function getBestMatch(tab: SwitchableTab, query: string): BestMatch | null {
  const fields = [
    { text: tab.title.trim().toLowerCase(), priority: FieldPriority.Title },
    { text: tab.hostname.trim().toLowerCase(), priority: FieldPriority.Hostname },
  ];

  let best: BestMatch | null = null;

  for (const { text, priority } of fields) {
    const quality = getFieldMatchQuality(text, query);
    if (quality === MatchQuality.NoMatch) {
      continue;
    }
    // Fields are checked in Title > Hostname order; earlier fields win ties
    if (best === null || quality < best.quality) {
      best = { quality, fieldPriority: priority };
    }
  }

  return best;
}

export function searchTabs(
  tabs: readonly SwitchableTab[],
  query: string,
  limit: number = MAX_QUICK_TABS,
): readonly SwitchableTab[] {
  const integerLimit = normalizeTabLimit(limit);
  if (integerLimit === 0) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return getRecentTabs(tabs, null, integerLimit);
  }

  const candidates: {
    tab: SwitchableTab;
    originalIndex: number;
    match: BestMatch;
  }[] = [];

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    if (tab) {
      const match = getBestMatch(tab, normalizedQuery);
      if (match !== null) {
        candidates.push({ tab, originalIndex: i, match });
      }
    }
  }

  candidates.sort((first, second) => {
    if (first.match.quality !== second.match.quality) {
      return first.match.quality - second.match.quality;
    }

    if (first.match.fieldPriority !== second.match.fieldPriority) {
      return first.match.fieldPriority - second.match.fieldPriority;
    }

    const recencyDiff = compareTabRecency(first.tab, second.tab);
    if (recencyDiff !== 0) {
      return recencyDiff;
    }

    return first.originalIndex - second.originalIndex;
  });

  return candidates.slice(0, integerLimit).map(({ tab }) => tab);
}
