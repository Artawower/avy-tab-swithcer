import { describe, it, expect } from 'vitest';
import {
  letterFromKeyCode,
  isLatinLetterKey,
  buildHintDisplayMap,
  findCharIndexCaseInsensitive,
} from '../../src/application/keyboard-layout';

describe('keyboard-layout', () => {
  describe('letterFromKeyCode', () => {
    it('extracts latin letter from valid KeyCode', () => {
      expect(letterFromKeyCode('KeyA')).toBe('a');
      expect(letterFromKeyCode('KeyZ')).toBe('z');
    });

    it('returns null for non-letter KeyCodes', () => {
      expect(letterFromKeyCode('Digit1')).toBeNull();
      expect(letterFromKeyCode('Space')).toBeNull();
      expect(letterFromKeyCode('')).toBeNull();
    });
  });

  describe('isLatinLetterKey', () => {
    it('returns true for latin letters', () => {
      expect(isLatinLetterKey('a')).toBe(true);
      expect(isLatinLetterKey('Z')).toBe(true);
    });

    it('returns false for non-latin letters', () => {
      expect(isLatinLetterKey('ф')).toBe(false);
      expect(isLatinLetterKey('1')).toBe(false);
      expect(isLatinLetterKey('Enter')).toBe(false);
      expect(isLatinLetterKey('')).toBe(false);
    });
  });

  describe('buildHintDisplayMap', () => {
    it('returns Latin identity map when layout is null', () => {
      const map = buildHintDisplayMap(null);
      expect(map.get('a')).toBe('a');
      expect(map.get('z')).toBe('z');
      expect(map.size).toBe(26);
    });

    it('returns OS-mapped characters when layout does not produce Latin letters (e.g. Cyrillic)', () => {
      const mockLayout = {
        get: (code: string) => {
          if (code === 'KeyA') return 'ф';
          if (code === 'KeyB') return 'и';
          return undefined;
        },
      };
      const map = buildHintDisplayMap(mockLayout);
      expect(map.get('a')).toBe('ф'); // 'a' is not produced, falls back to KeyA mapping
      expect(map.get('b')).toBe('и'); // 'b' is not produced, falls back to KeyB mapping
      expect(map.get('c')).toBe('c'); // 'c' is not produced, but KeyC mapping is undefined, falls back to 'c'
    });

    it('returns Latin identity map when layout produces Latin letters (e.g. Colemak/Dvorak)', () => {
      const mockLayout = {
        get: (code: string) => {
          // Simulate Colemak-like mapping where letters are rearranged but all present
          if (code === 'KeyA') return 'a';
          if (code === 'KeyB') return 'b';
          if (code === 'KeyS') return 'r';
          if (code === 'KeyD') return 's';
          if (code === 'KeyF') return 't';
          return code.toLowerCase().replace('key', '');
        },
      };
      const map = buildHintDisplayMap(mockLayout);
      // Even though KeyS produces 'r', the layout overall produces 's' (on KeyD).
      // Thus, 's' is available, so it maps to 's'.
      expect(map.get('s')).toBe('s');
      expect(map.get('r')).toBe('r');
      expect(map.get('a')).toBe('a');
    });
  });

  describe('findCharIndexCaseInsensitive', () => {
    it('returns correct index for matching character', () => {
      expect(findCharIndexCaseInsensitive('Hello World', 'w')).toBe(6);
      expect(findCharIndexCaseInsensitive('Привет Мир', 'м')).toBe(7);
      expect(findCharIndexCaseInsensitive('Привет Мир', 'П')).toBe(0);
    });

    it('returns null if character is not found', () => {
      expect(findCharIndexCaseInsensitive('Hello World', 'z')).toBeNull();
      expect(findCharIndexCaseInsensitive('Привет Мир', 'z')).toBeNull();
    });

    it('returns null if length is not 1', () => {
      expect(findCharIndexCaseInsensitive('Hello World', 'll')).toBeNull();
      expect(findCharIndexCaseInsensitive('Hello World', '')).toBeNull();
    });
  });
});
