import { MAX_QUICK_TABS, type SwitchableTab, getTabLabel } from './tab';

interface HintedTab {
  readonly tab: SwitchableTab;
  readonly hint: string;
  readonly hintIndex: number | null;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function isAsciiLetter(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function findAsciiCaseInsensitiveIndex(text: string, letter: string): number | null {
  const targetCode = letter.toLowerCase().charCodeAt(0);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch && isAsciiLetter(ch)) {
      if (ch.toLowerCase().charCodeAt(0) === targetCode) {
        return i;
      }
    }
  }
  return null;
}

function findFirstAsciiLetter(text: string): string | null {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch && isAsciiLetter(ch)) {
      return ch;
    }
  }
  return null;
}

function appendUniqueAsciiCandidate(candidates: string[], ch: string | null | undefined): void {
  if (!ch || !isAsciiLetter(ch)) {
    return;
  }
  const lower = ch.toLowerCase();
  if (!candidates.includes(lower)) {
    candidates.push(lower);
  }
}

function extractMeaningfulHostnameLabels(hostname: string): readonly string[] {
  const host = hostname.trim().toLowerCase();
  const rawLabels = host
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let labels = rawLabels;
  if (labels.length > 0 && labels[0] === 'www') {
    labels = labels.slice(1);
  }
  if (labels.length > 1) {
    labels = labels.slice(0, -1);
  }
  return labels;
}

function getTabCandidates(tab: SwitchableTab): readonly string[] {
  const candidates: string[] = [];
  const append = (ch: string | null | undefined): void => {
    appendUniqueAsciiCandidate(candidates, ch);
  };

  append(findFirstAsciiLetter(tab.title));

  for (const word of tab.title.split(/[^a-zA-Z0-9]+/)) {
    append(findFirstAsciiLetter(word));
  }
  for (const label of extractMeaningfulHostnameLabels(tab.hostname)) {
    append(findFirstAsciiLetter(label));
  }
  for (let i = 0; i < tab.title.length; i++) {
    append(tab.title[i]);
  }
  for (let i = 0; i < tab.hostname.length; i++) {
    append(tab.hostname[i]);
  }
  for (let i = 0; i < ALPHABET.length; i++) {
    append(ALPHABET[i]);
  }

  return candidates;
}

export function allocateTabHints(tabs: readonly SwitchableTab[]): readonly HintedTab[] {
  const visibleTabs = tabs.slice(0, MAX_QUICK_TABS);
  const usedHints = new Set<string>();
  const result: HintedTab[] = [];

  for (const tab of visibleTabs) {
    const candidates = getTabCandidates(tab);
    let hint = 'a';

    for (const candidate of candidates) {
      if (!usedHints.has(candidate)) {
        hint = candidate;
        break;
      }
    }

    usedHints.add(hint);

    const label = getTabLabel(tab);
    const hintIndex = findAsciiCaseInsensitiveIndex(label, hint);

    result.push({
      tab,
      hint,
      hintIndex,
    });
  }

  return result;
}
