import { MAX_QUICK_TABS, type SwitchableTab } from './tab';

function isValidRecency(val: number | null): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

export function getRecentTabs(
  tabs: readonly SwitchableTab[],
  currentTabId: number | null,
  limit: number = MAX_QUICK_TABS,
): readonly SwitchableTab[] {
  if (!Number.isFinite(limit) || limit <= 0) {
    return [];
  }

  const integerLimit = Math.floor(limit);
  if (integerLimit <= 0) {
    return [];
  }

  const candidates = tabs
    .map((tab, originalIndex) => ({ tab, originalIndex }))
    .filter(({ tab }) => currentTabId === null || tab.id !== currentTabId);

  candidates.sort((first, second) => {
    const a = first.tab;
    const b = second.tab;

    const recencyA = a.lastAccessed;
    const recencyB = b.lastAccessed;

    if (isValidRecency(recencyA) && isValidRecency(recencyB)) {
      if (recencyB !== recencyA) {
        return recencyB - recencyA;
      }
    } else if (isValidRecency(recencyA)) {
      return -1;
    } else if (isValidRecency(recencyB)) {
      return 1;
    }

    if (a.id !== b.id) {
      return a.id - b.id;
    }

    return first.originalIndex - second.originalIndex;
  });

  return candidates.slice(0, integerLimit).map(({ tab }) => tab);
}
