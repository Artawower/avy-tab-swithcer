export type SelectionDirection = 'left' | 'right' | 'up' | 'down';

const COMPACT_VIEWPORT_MAX_WIDTH = 480;
const MEDIUM_VIEWPORT_MAX_WIDTH = 720;

export function getGridColumnCount(viewportWidth: number): 2 | 3 | 5 {
  if (!Number.isFinite(viewportWidth) || viewportWidth < 0) {
    return 5;
  }
  if (viewportWidth <= COMPACT_VIEWPORT_MAX_WIDTH) {
    return 2;
  }
  if (viewportWidth <= MEDIUM_VIEWPORT_MAX_WIDTH) {
    return 3;
  }
  return 5;
}

function normalizeItemCount(itemCount: number): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) {
    return -1;
  }

  const total = Math.floor(itemCount);
  return total > 0 ? total : -1;
}

function isValidIndex(currentIndex: number, total: number): boolean {
  return Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < total;
}

function normalizeColumnCount(columns: number): number {
  return Number.isInteger(columns) && columns > 0 ? columns : 1;
}

function getDirectionOffset(direction: SelectionDirection, columns: number): number {
  const offsets = {
    left: -1,
    right: 1,
    up: -columns,
    down: columns,
  } satisfies Record<SelectionDirection, number>;
  return offsets[direction];
}

export function moveSelection(
  currentIndex: number,
  itemCount: number,
  direction: SelectionDirection,
  columns: number,
): number {
  const total = normalizeItemCount(itemCount);
  if (total <= 0) {
    return -1;
  }

  if (!isValidIndex(currentIndex, total)) {
    return 0;
  }

  const safeColumns = normalizeColumnCount(columns);
  const target = currentIndex + getDirectionOffset(direction, safeColumns);

  if (target < 0 || target >= total) {
    return currentIndex;
  }

  const isHorizontal = direction === 'left' || direction === 'right';
  const isSameRow = Math.floor(target / safeColumns) === Math.floor(currentIndex / safeColumns);
  if (isHorizontal && !isSameRow) {
    return currentIndex;
  }

  return target;
}
