export type SelectionDirection = 'left' | 'right' | 'up' | 'down';

// Breakpoints mirror switcher.css media queries (<=480px: 2, <=720px: 3, default: 5).
export function getGridColumnCount(viewportWidth: number): 2 | 3 | 5 {
  if (!Number.isFinite(viewportWidth) || viewportWidth < 0) {
    return 5;
  }
  if (viewportWidth <= 480) {
    return 2;
  }
  if (viewportWidth <= 720) {
    return 3;
  }
  return 5;
}

export function moveSelection(
  currentIndex: number,
  itemCount: number,
  direction: SelectionDirection,
  columns: number,
): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) {
    return -1;
  }

  const total = Math.floor(itemCount);
  if (total <= 0) {
    return -1;
  }

  if (
    typeof currentIndex !== 'number' ||
    !Number.isInteger(currentIndex) ||
    currentIndex < 0 ||
    currentIndex >= total
  ) {
    return 0;
  }

  const safeColumns =
    typeof columns === 'number' && Number.isInteger(columns) && columns > 0 ? columns : 1;

  const col = currentIndex % safeColumns;

  switch (direction) {
    case 'left': {
      if (col > 0) {
        return currentIndex - 1;
      }
      return currentIndex;
    }
    case 'right': {
      if (col < safeColumns - 1 && currentIndex + 1 < total) {
        return currentIndex + 1;
      }
      return currentIndex;
    }
    case 'up': {
      const target = currentIndex - safeColumns;
      if (target >= 0) {
        return target;
      }
      return currentIndex;
    }
    case 'down': {
      const target = currentIndex + safeColumns;
      if (target < total) {
        return target;
      }
      return currentIndex;
    }
  }
}
