<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import {
  getGridColumnCount,
  moveSelection,
  type SelectionDirection,
} from '../application/selection';
import { allocateTabHints } from '../domain/hint-allocator';
import type { SwitchableTab } from '../domain/tab';
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

  const searchResults = searchTabs(props.tabs, query.value);
  return searchResults.map((tab) => ({
    tab,
    hint: null,
    hintIndex: null,
  }));
});

function resetState(): void {
  mode.value = 'quick';
  query.value = '';
  searchInputRef.value?.blur();
  const items = getRecentTabs(props.tabs, null);
  selectedIndex.value = items.length > 0 ? 0 : -1;
}

watch(
  () => [props.open, props.tabs],
  ([isOpen]) => {
    if (isOpen) {
      resetState();
    }
  },
  { immediate: true },
);

function enterSearch(): void {
  if (mode.value === 'quick') {
    mode.value = 'search';
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
}

function exitSearch(): void {
  mode.value = 'quick';
  query.value = '';
  searchInputRef.value?.blur();
  const recent = getRecentTabs(props.tabs, null);
  selectedIndex.value = recent.length > 0 ? 0 : -1;
}

function onSearchInput(): void {
  selectedIndex.value = displayedItems.value.length > 0 ? 0 : -1;
}

watch(query, () => {
  if (mode.value === 'search') {
    selectedIndex.value = displayedItems.value.length > 0 ? 0 : -1;
  }
});

function activateSelected(): void {
  if (
    selectedIndex.value >= 0 &&
    selectedIndex.value < displayedItems.value.length
  ) {
    const item = displayedItems.value[selectedIndex.value];
    if (item) {
      emit('activate', item.tab.id);
    }
  }
}

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
  event.stopPropagation();
}

function onKeydown(event: KeyboardEvent): void {
  if (
    !props.open ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return;
  }

  if (event.key === 'Escape') {
    consumeEvent(event);
    if (mode.value === 'search') {
      exitSearch();
    } else {
      emit('close');
    }
    return;
  }

  if (mode.value === 'quick' && event.key === '/') {
    consumeEvent(event);
    enterSearch();
    return;
  }

  if (event.key === 'Enter') {
    consumeEvent(event);
    activateSelected();
    return;
  }

  const direction = getDirection(event.key);
  if (direction !== null) {
    consumeEvent(event);
    selectedIndex.value = moveSelection(
      selectedIndex.value,
      displayedItems.value.length,
      direction,
      getGridColumnCount(window.innerWidth),
    );
    return;
  }

  if (mode.value === 'quick' && /^[a-zA-Z]$/.test(event.key)) {
    const keyLower = event.key.toLowerCase();
    const matched = displayedItems.value.find(
      (item) => item.hint !== null && item.hint.toLowerCase() === keyLower,
    );
    if (matched) {
      consumeEvent(event);
      emit('activate', matched.tab.id);
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown, true);
});

function onCloseClick(): void {
  emit('close');
}

function onTileActivate(tabId: number): void {
  emit('activate', tabId);
}
</script>

<template>
  <div v-if="open" class="switcher-overlay">
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
          @input="onSearchInput"
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
      <div v-if="displayedItems.length > 0" class="switcher-grid">
        <TabTile
          v-for="(item, index) in displayedItems"
          :key="item.tab.id"
          :tab="item.tab"
          :selected="index === selectedIndex"
          :hint="item.hint"
          :hintIndex="item.hintIndex"
          @activate="onTileActivate"
        />
      </div>
      <div v-else class="switcher-empty">
        {{ mode === 'quick' ? 'No other tabs' : 'No matching tabs' }}
      </div>
    </div>
  </div>
</template>
