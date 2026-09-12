<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  getGridColumnCount,
  moveSelection,
  type SelectionDirection,
} from '../application/selection';
import { allocateTabHints } from '../domain/hint-allocator';
import { MAX_QUICK_TABS, type SwitchableTab } from '../domain/tab';
import { getRecentTabs } from '../domain/tab-order';
import { searchTabs } from '../domain/tab-search';
import TabTile from './TabTile.vue';

interface Props {
  readonly open: boolean;
  readonly tabs: readonly SwitchableTab[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'activate', tabId: number): void;
}>();

const mode = ref<'quick' | 'search'>('quick');
const query = ref('');
const selectedIndex = ref(0);
const searchInputRef = ref<HTMLInputElement | null>(null);
const viewportRef = ref<HTMLDivElement | null>(null);

interface DisplayItem {
  readonly tab: SwitchableTab;
  readonly hint: string | null;
  readonly hintIndex: number | null;
}

const displayedItems = computed<readonly DisplayItem[]>(() => {
  if (mode.value === 'quick') {
    const recent = getRecentTabs(props.tabs, null);
    const hinted = allocateTabHints(recent);
    return hinted.map(({ tab, hint, hintIndex }) => ({
      tab,
      hint,
      hintIndex,
    }));
  }

  const isFilteredSearch = query.value.trim().length > 0;
  const limit = isFilteredSearch ? props.tabs.length : MAX_QUICK_TABS;
  const searchResults = searchTabs(props.tabs, query.value, limit);
  return searchResults.map((tab) => ({
    tab,
    hint: null,
    hintIndex: null,
  }));
});

type PendingAction =
  | { readonly type: 'close'; readonly code: string; readonly key: string }
  | {
      readonly type: 'activate';
      readonly tabId: number;
      readonly code: string;
      readonly key: string;
    };

let pendingAction: PendingAction | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

function clearFallbackTimer(): void {
  if (fallbackTimer !== null) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
}

function cancelPendingAction(): void {
  clearFallbackTimer();
  pendingAction = null;
}

function executePendingAction(): void {
  clearFallbackTimer();
  if (!pendingAction) {
    return;
  }
  const action = pendingAction;
  pendingAction = null;

  if (action.type === 'close') {
    emit('close');
  } else if (action.type === 'activate') {
    emit('activate', action.tabId);
  }
}

function queueAction(action: PendingAction): void {
  clearFallbackTimer();
  pendingAction = action;
  fallbackTimer = setTimeout(() => {
    cancelPendingAction();
  }, 800);
}

function resetState(): void {
  clearFallbackTimer();
  pendingAction = null;
  mode.value = 'quick';
  query.value = '';
  const items = getRecentTabs(props.tabs, null);
  selectedIndex.value = items.length > 0 ? 0 : -1;
  searchInputRef.value?.blur();
  if (viewportRef.value) {
    viewportRef.value.scrollTop = 0;
  }
}

watch(
  () => [props.open, props.tabs] as const,
  ([isOpen]) => {
    if (isOpen) {
      resetState();
    } else {
      clearFallbackTimer();
      pendingAction = null;
    }
  },
  { immediate: true },
);

function enterSearch(): void {
  if (mode.value === 'quick') {
    mode.value = 'search';
    void nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
}

function exitSearch(): void {
  mode.value = 'quick';
  query.value = '';
  const recent = getRecentTabs(props.tabs, null);
  selectedIndex.value = recent.length > 0 ? 0 : -1;
  searchInputRef.value?.blur();
  if (viewportRef.value) {
    viewportRef.value.scrollTop = 0;
  }
}

watch(query, () => {
  if (mode.value === 'search') {
    selectedIndex.value = displayedItems.value.length > 0 ? 0 : -1;
    if (viewportRef.value) {
      viewportRef.value.scrollTop = 0;
    }
  }
});

watch(
  selectedIndex,
  () => {
    const selectedEl = viewportRef.value?.querySelector<HTMLElement>('.tab-tile--selected');
    if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
      selectedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  },
  { flush: 'post' },
);

function getDirection(key: string): SelectionDirection | null {
  if (key === 'ArrowLeft') {
    return 'left';
  }
  if (key === 'ArrowRight') {
    return 'right';
  }
  if (key === 'ArrowUp') {
    return 'up';
  }
  if (key === 'ArrowDown') {
    return 'down';
  }
  return null;
}

function consumeEvent(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function shouldIgnoreKeydown(open: boolean, event: KeyboardEvent): boolean {
  return !open || event.isComposing || event.ctrlKey || event.metaKey || event.altKey;
}

function handleEscapeKey(event: KeyboardEvent): void {
  consumeEvent(event);
  if (mode.value === 'search') {
    exitSearch();
    return;
  }

  queueAction({
    type: 'close',
    code: event.code || 'Escape',
    key: event.key,
  });
}

function handleEnterKey(event: KeyboardEvent): void {
  consumeEvent(event);
  const item = displayedItems.value[selectedIndex.value];
  if (!item) {
    return;
  }
  queueAction({
    type: 'activate',
    tabId: item.tab.id,
    code: event.code || 'Enter',
    key: event.key,
  });
}

function handleDirectionKey(event: KeyboardEvent, direction: SelectionDirection): void {
  consumeEvent(event);
  selectedIndex.value = moveSelection(
    selectedIndex.value,
    displayedItems.value.length,
    direction,
    getGridColumnCount(window.innerWidth),
  );
}

function handleKnownKey(event: KeyboardEvent): boolean {
  if (event.key === 'Escape') {
    handleEscapeKey(event);
    return true;
  }

  if (mode.value === 'quick' && event.key === '/') {
    consumeEvent(event);
    enterSearch();
    return true;
  }

  if (event.key === 'Enter') {
    handleEnterKey(event);
    return true;
  }

  const direction = getDirection(event.key);
  if (direction !== null) {
    handleDirectionKey(event, direction);
    return true;
  }

  return false;
}

function handleMnemonicKey(event: KeyboardEvent): void {
  if (mode.value !== 'quick' || !/^[a-zA-Z]$/.test(event.key)) {
    return;
  }

  const keyLower = event.key.toLowerCase();
  const matched = displayedItems.value.find(
    (item) => item.hint !== null && item.hint.toLowerCase() === keyLower,
  );
  if (!matched) {
    return;
  }

  consumeEvent(event);
  queueAction({
    type: 'activate',
    tabId: matched.tab.id,
    code: event.code || `Key${keyLower.toUpperCase()}`,
    key: event.key,
  });
}

function onKeydown(event: KeyboardEvent): void {
  if (shouldIgnoreKeydown(props.open, event)) {
    return;
  }

  if (pendingAction !== null || event.repeat) {
    consumeEvent(event);
    return;
  }

  if (handleKnownKey(event)) {
    return;
  }

  handleMnemonicKey(event);
}

function onKeyup(event: KeyboardEvent): void {
  if (!props.open) {
    return;
  }

  if (pendingAction !== null) {
    const matchesCode = Boolean(event.code && event.code === pendingAction.code);
    const matchesKey = event.key.toLowerCase() === pendingAction.key.toLowerCase();
    if (matchesCode || matchesKey) {
      consumeEvent(event);
      executePendingAction();
      return;
    }
  }

  consumeEvent(event);
}

function onWindowBlur(): void {
  cancelPendingAction();
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true);
  window.addEventListener('keyup', onKeyup, true);
  window.addEventListener('blur', onWindowBlur);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown, true);
  window.removeEventListener('keyup', onKeyup, true);
  window.removeEventListener('blur', onWindowBlur);
  clearFallbackTimer();
  pendingAction = null;
});

function onCloseClick(): void {
  clearFallbackTimer();
  pendingAction = null;
  emit('close');
}

function onTileActivate(tabId: number): void {
  clearFallbackTimer();
  pendingAction = null;
  emit('activate', tabId);
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    clearFallbackTimer();
    pendingAction = null;
    emit('close');
  }
}
</script>

<template>
  <div v-if="open" class="switcher-overlay" @click="onBackdropClick">
    <div class="switcher-top-row">
      <div class="switcher-search-surface" @click="enterSearch">
        <svg
          class="switcher-search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref="searchInputRef"
          v-model="query"
          type="text"
          class="switcher-search-input"
          :readonly="mode === 'quick'"
          placeholder="Search tabs..."
          aria-label="Search open tabs"
        />
      </div>

      <button
        type="button"
        class="switcher-close-btn"
        aria-label="Close tab switcher"
        @click="onCloseClick"
      >
        <svg
          class="switcher-close-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>

    <div class="switcher-grid-surface">
      <div ref="viewportRef" class="switcher-grid-viewport">
        <div v-if="displayedItems.length > 0" class="switcher-grid">
          <TabTile
            v-for="(item, index) in displayedItems"
            :key="item.tab.id"
            :tab="item.tab"
            :selected="index === selectedIndex"
            :hint="item.hint"
            :hint-index="item.hintIndex"
            @activate="onTileActivate"
          />
        </div>
        <div v-else class="switcher-empty">
          {{ mode === 'quick' ? 'No other tabs' : 'No matching tabs' }}
        </div>
      </div>
    </div>
  </div>
</template>
