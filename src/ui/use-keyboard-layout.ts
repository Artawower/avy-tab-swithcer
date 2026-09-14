import { onMounted, onUnmounted, shallowRef, type ShallowRef } from 'vue';
import { buildHintDisplayMap } from '../application/keyboard-layout';

/**
 * Reactive hint-letter -> displayed-character map for the user's current
 * keyboard layout. Starts as the Latin identity map (safe fallback for
 * Firefox and contexts without the Keyboard API) and upgrades to the real
 * OS-reported mapping when `navigator.keyboard.getLayoutMap()` is available.
 * Refreshes on the Keyboard API's `layoutchange` event.
 */
export function useHintDisplayMap(): ShallowRef<ReadonlyMap<string, string>> {
  const displayMap = shallowRef<ReadonlyMap<string, string>>(buildHintDisplayMap(null));

  async function refresh(): Promise<void> {
    const keyboard = navigator.keyboard;
    if (!keyboard) {
      return;
    }
    try {
      const layout = await keyboard.getLayoutMap();
      displayMap.value = buildHintDisplayMap(layout);
    } catch {
      // Permission denied or transient failure — keep the Latin fallback.
    }
  }

  function onLayoutChange(): void {
    void refresh();
  }

  onMounted(() => {
    void refresh();
    navigator.keyboard?.addEventListener('layoutchange', onLayoutChange);
  });

  onUnmounted(() => {
    navigator.keyboard?.removeEventListener('layoutchange', onLayoutChange);
  });

  return displayMap;
}
