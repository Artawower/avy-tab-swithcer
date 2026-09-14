/**
 * Keyboard-layout-aware helpers for mnemonic hints.
 *
 * Hints are assigned from the Latin alphabet and internally double as physical
 * key identities (`a` <-> `KeyA`). This module translates those identities to
 * the characters produced by the user's currently active keyboard layout
 * (whatever it is — QWERTY, Cyrillic, Colemak, custom) and resolves key events
 * back to hint identities. No layout tables are hardcoded anywhere: the
 * mapping always comes from the OS via the Keyboard API.
 */

/** Structural subset of the Keyboard API's KeyboardLayoutMap. */
export interface KeyboardLayoutMapLike {
  get(code: string): string | undefined;
}

const HINT_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Extracts the Latin letter identity from a physical `KeyboardEvent.code`
 * (`'KeyF'` -> `'f'`). Returns null for non-letter codes.
 */
export function letterFromKeyCode(code: string): string | null {
  const match = /^Key([A-Z])$/.exec(code);
  const letter = match?.[1];
  return letter ? letter.toLowerCase() : null;
}

export function isLatinLetterKey(key: string): boolean {
  return /^[a-zA-Z]$/.test(key);
}

/**
 * Builds hint letter -> displayed character for every possible hint. Without a
 * layout map (Firefox, unsupported contexts) every hint displays as its own
 * Latin letter, which matches physical QWERTY keycap labels.
 */
export function buildHintDisplayMap(
  layout: KeyboardLayoutMapLike | null,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  const producedChars = new Set<string>();

  if (layout) {
    for (const letter of HINT_LETTERS) {
      const produced = layout.get(`Key${letter.toUpperCase()}`);
      if (produced && produced.length > 0) {
        producedChars.add(produced.toLowerCase());
      }
    }
  }

  for (const letter of HINT_LETTERS) {
    if (layout && !producedChars.has(letter)) {
      const produced = layout.get(`Key${letter.toUpperCase()}`);
      map.set(letter, produced && produced.length > 0 ? produced : letter);
    } else {
      map.set(letter, letter);
    }
  }

  return map;
}

/**
 * Finds the first case-insensitive occurrence of a single character in text.
 * Unicode-aware (works for Cyrillic and other non-ASCII letters), unlike the
 * ASCII-only matching in the domain hint allocator. Deterministic: always the
 * leftmost match. Returns null when the character is absent.
 */
export function findCharIndexCaseInsensitive(text: string, ch: string): number | null {
  if (ch.length !== 1) {
    return null;
  }
  const needle = ch.toLowerCase();
  for (let i = 0; i < text.length; i++) {
    const current = text[i];
    if (current && current.toLowerCase() === needle) {
      return i;
    }
  }
  return null;
}
