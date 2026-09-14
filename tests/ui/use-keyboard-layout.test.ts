import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useHintDisplayMap } from '../../src/ui/use-keyboard-layout';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';

describe('use-keyboard-layout', () => {
  let originalNavigator: Navigator;

  beforeEach(() => {
    originalNavigator = global.navigator;

    const mockKeyboard = {
      getLayoutMap: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    Object.defineProperty(global, 'navigator', {
      value: { ...originalNavigator, keyboard: mockKeyboard },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  const TestComponent = defineComponent({
    setup() {
      const displayMap = useHintDisplayMap();
      return { displayMap };
    },
    template: '<div>{{ displayMap.get("a") }}</div>',
  });

  it('initializes with Latin fallback and updates on mount if layout available', async () => {
    const mockMap = new Map([['KeyA', 'ф']]);

    if (global.navigator.keyboard) {
      const kb = global.navigator.keyboard;
      vi.spyOn(kb, 'getLayoutMap').mockResolvedValue(mockMap);
    }

    const wrapper = mount(TestComponent);
    expect(wrapper.text()).toBe('a');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(wrapper.text()).toBe('ф');
  });

  it('keeps Latin fallback on layout fetch error', async () => {
    if (global.navigator.keyboard) {
      const kb = global.navigator.keyboard;
      vi.spyOn(kb, 'getLayoutMap').mockRejectedValue(new Error('Denied'));
    }

    const wrapper = mount(TestComponent);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();

    expect(wrapper.text()).toBe('a');
  });
});
