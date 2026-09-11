import { MAX_QUICK_TABS, type SwitchableTab, getTabLabel } from './tab';

export interface HintedTab {
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

function getTabCandidates(tab: SwitchableTab): readonly string[] {
  const candidates: string[] = [];

  function addCandidate(ch: string | undefined): void {
    if (ch && isAsciiLetter(ch)) {
      const lower = ch.toLowerCase();
      if (!candidates.includes(lower)) {
        candidates.push(lower);
      }
    }
  }

  for (let i = 0; i < tab.title.length; i++) {
    const ch = tab.title[i];
    if (ch && isAsciiLetter(ch)) {
      addCandidate(ch);
      break;
    }
  }

  const words = tab.title.split(/[^a-zA-Z0-9]+/);
  for (const word of words) {
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      if (ch && isAsciiLetter(ch)) {
        addCandidate(ch);
        break;
      }
    }
  }

  const host = tab.hostname.trim().toLowerCase();
  const rawLabels = host.split('.').map((s) => s.trim()).filter((s) => s.length > 0);
  let meaningfulLabels = rawLabels;
  // Exclude leading 'www' and trailing TLD so domain/subdomain names take mnemonic precedence.
  if (meaningfulLabels.length > 0 && meaningfulLabels[0] === 'www') {
    meaningfulLabels = meaningfulLabels.slice(1);
  }
  if (meaningfulLabels.length > 1) {
    meaningfulLabels = meaningfulLabels.slice(0, -1);
  }
  for (const label of meaningfulLabels) {
    for (let i = 0; i < label.length; i++) {
      const ch = label[i];
      if (ch && isAsciiLetter(ch)) {
        addCandidate(ch);
        break;
      }
    }
  }

  for (let i = 0; i < tab.title.length; i++) {
    addCandidate(tab.title[i]);
  }
  for (let i = 0; i < tab.hostname.length; i++) {
    addCandidate(tab.hostname[i]);
  }

  for (let i = 0; i < ALPHABET.length; i++) {
    addCandidate(ALPHABET[i]);
  }

  return candidates;
}

export function allocateTabHints(
  tabs: readonly SwitchableTab[],
): readonly HintedTab[] {
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
