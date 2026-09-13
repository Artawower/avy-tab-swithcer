<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getTabLabel, type SwitchableTab } from '../domain/tab';

const props = defineProps<{
  readonly tab: SwitchableTab;
  readonly selected: boolean;
  readonly hint: string | null;
  readonly hintIndex: number | null;
}>();

const emit = defineEmits<{
  (e: 'activate', tabId: number): void;
}>();

const imageFailed = ref(false);

watch(
  () => props.tab.faviconUrl,
  () => {
    imageFailed.value = false;
  },
);

const label = computed(() => getTabLabel(props.tab));

const fallbackChar = computed(() => {
  const match = /\S/u.exec(label.value);
  return match ? match[0].toUpperCase() : '?';
});

const titleParts = computed(() => {
  const text = label.value;
  const idx = props.hintIndex;
  if (idx !== null && idx >= 0 && idx < text.length) {
    return {
      hasHighlight: true,
      prefix: text.slice(0, idx),
      marked: text.slice(idx, idx + 1),
      suffix: text.slice(idx + 1),
    };
  }
  return {
    hasHighlight: false,
    prefix: text,
    marked: '',
    suffix: '',
  };
});

const accessibleLabel = computed(() => {
  if (props.hint) {
    return `${label.value} (key: ${props.hint})`;
  }
  return label.value;
});

function onClick() {
  emit('activate', props.tab.id);
}
</script>

<template>
  <button
    type="button"
    class="tab-tile"
    :class="{ 'tab-tile--selected': selected }"
    :aria-current="selected ? 'true' : undefined"
    :aria-label="accessibleLabel"
    @click="onClick"
  >
    <div class="tab-tile__icon-box">
      <img
        v-if="tab.faviconUrl && !imageFailed"
        :src="tab.faviconUrl"
        alt=""
        class="tab-tile__icon"
        @error="imageFailed = true"
      />
      <span v-else class="tab-tile__fallback" aria-hidden="true">
        {{ fallbackChar }}
      </span>
      <span v-if="hint" class="tab-tile__keycap" aria-hidden="true">{{ hint }}</span>
    </div>

    <div class="tab-tile__title-wrap">
      <span class="tab-tile__title">
        <template v-if="titleParts.hasHighlight">
          <span>{{ titleParts.prefix }}</span>
          <mark class="tab-tile__hint-char">{{ titleParts.marked }}</mark>
          <span>{{ titleParts.suffix }}</span>
        </template>
        <template v-else>
          {{ titleParts.prefix }}
        </template>
      </span>
    </div>
  </button>
</template>
