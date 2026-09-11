import { describe, expect, test } from 'vitest';
import {
  getGridColumnCount,
  moveSelection,
  type SelectionDirection,
} from '../../src/application/selection';

describe('getGridColumnCount', () => {
  test('returns 2 for widths <= 480', () => {
    expect(getGridColumnCount(0)).toBe(2);
    expect(getGridColumnCount(320)).toBe(2);
    expect(getGridColumnCount(480)).toBe(2);
  });

  test('returns 3 for widths > 480 and <= 720', () => {
    expect(getGridColumnCount(480.1)).toBe(3);
    expect(getGridColumnCount(600)).toBe(3);
    expect(getGridColumnCount(720)).toBe(3);
  });

  test('returns 5 for widths > 720', () => {
    expect(getGridColumnCount(720.1)).toBe(5);
    expect(getGridColumnCount(1024)).toBe(5);
    expect(getGridColumnCount(1920)).toBe(5);
  });

  test('safely falls back to 5 for non-finite or negative widths', () => {
    expect(getGridColumnCount(-1)).toBe(5);
    expect(getGridColumnCount(-480)).toBe(5);
    expect(getGridColumnCount(NaN)).toBe(5);
    expect(getGridColumnCount(Infinity)).toBe(5);
    expect(getGridColumnCount(-Infinity)).toBe(5);
  });
});

describe('moveSelection', () => {
  test('returns -1 when itemCount is zero, negative, or non-finite', () => {
    expect(moveSelection(0, 0, 'right', 5)).toBe(-1);
    expect(moveSelection(0, -1, 'right', 5)).toBe(-1);
    expect(moveSelection(0, -10, 'down', 5)).toBe(-1);
    expect(moveSelection(0, NaN, 'up', 5)).toBe(-1);
    expect(moveSelection(0, 0.5, 'left', 5)).toBe(-1);
  });

  test('returns 0 when currentIndex is invalid or out-of-range', () => {
    expect(moveSelection(-1, 5, 'right', 5)).toBe(0);
    expect(moveSelection(-5, 5, 'left', 5)).toBe(0);
    expect(moveSelection(5, 5, 'down', 5)).toBe(0);
    expect(moveSelection(100, 5, 'up', 5)).toBe(0);
    expect(moveSelection(1.5, 5, 'right', 5)).toBe(0);
    expect(moveSelection(NaN, 5, 'right', 5)).toBe(0);
  });

  test('moves right within visual row', () => {
    // 5 columns, 10 items
    expect(moveSelection(0, 10, 'right', 5)).toBe(1);
    expect(moveSelection(1, 10, 'right', 5)).toBe(2);
    expect(moveSelection(3, 10, 'right', 5)).toBe(4);
  });

  test('clamps right at visual row boundary without wrapping to next row', () => {
    // Index 4 is at the right edge of row 0 (col 4 of 5)
    expect(moveSelection(4, 10, 'right', 5)).toBe(4);
    // Index 9 is at the right edge of row 1 (col 4 of 5)
    expect(moveSelection(9, 10, 'right', 5)).toBe(9);
  });

  test('clamps right when next column in final row is missing', () => {
    // 5 columns, 7 items (Row 0: 0..4; Row 1: 5..6)
    // Index 6 is at col 1 of row 1, but index 7 does not exist
    expect(moveSelection(6, 7, 'right', 5)).toBe(6);
  });

  test('moves left within visual row', () => {
    // 5 columns, 10 items
    expect(moveSelection(4, 10, 'left', 5)).toBe(3);
    expect(moveSelection(3, 10, 'left', 5)).toBe(2);
    expect(moveSelection(1, 10, 'left', 5)).toBe(0);
    expect(moveSelection(7, 10, 'left', 5)).toBe(6);
  });

  test('clamps left at visual row start without wrapping to previous row', () => {
    // Index 0 is at left edge of row 0 (col 0 of 5)
    expect(moveSelection(0, 10, 'left', 5)).toBe(0);
    // Index 5 is at left edge of row 1 (col 0 of 5)
    expect(moveSelection(5, 10, 'left', 5)).toBe(5);
  });

  test('moves up by columns when destination exists', () => {
    // 5 columns, 10 items (Row 0: 0..4; Row 1: 5..9)
    expect(moveSelection(5, 10, 'up', 5)).toBe(0);
    expect(moveSelection(6, 10, 'up', 5)).toBe(1);
    expect(moveSelection(7, 10, 'up', 5)).toBe(2);
    expect(moveSelection(8, 10, 'up', 5)).toBe(3);
    expect(moveSelection(9, 10, 'up', 5)).toBe(4);
  });

  test('remains when moving up from the top row', () => {
    // Row 0 items cannot move up
    for (let i = 0; i < 5; i++) {
      expect(moveSelection(i, 10, 'up', 5)).toBe(i);
    }
  });

  test('moves down by columns when destination exists', () => {
    // 5 columns, 10 items (Row 0: 0..4; Row 1: 5..9)
    expect(moveSelection(0, 10, 'down', 5)).toBe(5);
    expect(moveSelection(1, 10, 'down', 5)).toBe(6);
    expect(moveSelection(2, 10, 'down', 5)).toBe(7);
    expect(moveSelection(3, 10, 'down', 5)).toBe(8);
    expect(moveSelection(4, 10, 'down', 5)).toBe(9);
  });

  test('remains when moving down and destination does not exist', () => {
    // Bottom row cannot move down
    for (let i = 5; i < 10; i++) {
      expect(moveSelection(i, 10, 'down', 5)).toBe(i);
    }
  });

  test('remains when moving down into missing cell in incomplete last row', () => {
    // 3 columns, 5 items
    // Row 0: 0, 1, 2
    // Row 1: 3, 4 (col 2 / index 5 is missing)
    expect(moveSelection(0, 5, 'down', 3)).toBe(3);
    expect(moveSelection(1, 5, 'down', 3)).toBe(4);
    // Index 2 destination would be 5 (missing) -> remains at 2
    expect(moveSelection(2, 5, 'down', 3)).toBe(2);
  });

  test('normalizes invalid columns to 1', () => {
    // When columns normalizes to 1:
    // items: 0, 1, 2 (each in its own row)
    const invalidCols = [0, -1, -5, 1.5, NaN, Infinity];
    for (const cols of invalidCols) {
      // Left and right cannot move because every row has 1 column
      expect(moveSelection(1, 3, 'left', cols)).toBe(1);
      expect(moveSelection(1, 3, 'right', cols)).toBe(1);
      // Up and down move by 1 item
      expect(moveSelection(1, 3, 'up', cols)).toBe(0);
      expect(moveSelection(1, 3, 'down', cols)).toBe(2);
    }
  });

  test('works with 2 columns layout', () => {
    // 2 columns, 5 items
    // Row 0: 0, 1
    // Row 1: 2, 3
    // Row 2: 4 (missing 5)
    expect(moveSelection(0, 5, 'right', 2)).toBe(1);
    expect(moveSelection(1, 5, 'right', 2)).toBe(1); // right clamp
    expect(moveSelection(1, 5, 'left', 2)).toBe(0);
    expect(moveSelection(0, 5, 'down', 2)).toBe(2);
    expect(moveSelection(2, 5, 'down', 2)).toBe(4);
    expect(moveSelection(3, 5, 'down', 2)).toBe(3); // missing cell 5 -> remains
    expect(moveSelection(4, 5, 'up', 2)).toBe(2);
  });

  test('is deterministic across repeated calls with identical input', () => {
    const directions: SelectionDirection[] = ['left', 'right', 'up', 'down'];
    for (const dir of directions) {
      const res1 = moveSelection(2, 7, dir, 3);
      const res2 = moveSelection(2, 7, dir, 3);
      expect(res1).toBe(res2);
    }
  });
});
