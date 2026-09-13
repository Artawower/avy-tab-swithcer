import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import Switcher from '../../src/ui/Switcher.vue';
import { createTab } from '../fixtures/tab';

enableAutoUnmount(afterEach);

function dispatchKey(key: string, options?: Partial<KeyboardEventInit>): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

function dispatchKeyUp(key: string, options?: Partial<KeyboardEventInit>): KeyboardEvent {
  const event = new KeyboardEvent('keyup', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

test('Switcher renders nothing when open is false', () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: {
      open: false,
      tabs,
    },
  });

  expect(wrapper.find('.switcher-overlay').exists()).toBe(false);
  expect(wrapper.text()).toBe('');
});

test('Switcher renders search and close buttons and separate surfaces when open', () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  expect(wrapper.find('.switcher-overlay').exists()).toBe(true);
  expect(wrapper.find('.switcher-top-row').exists()).toBe(true);
  expect(wrapper.find('.switcher-search-surface').exists()).toBe(true);
  expect(wrapper.find('input.switcher-search-input').exists()).toBe(true);
  expect(wrapper.find('button.switcher-close-btn').exists()).toBe(true);
  expect(wrapper.find('.switcher-grid-surface').exists()).toBe(true);
  expect(wrapper.find('.switcher-grid-viewport').exists()).toBe(true);
});

test('Switcher caps quick mode to 10 tabs in MRU order with first selected', () => {
  const tabs = [];
  for (let i = 1; i <= 15; i++) {
    tabs.push(createTab({ id: i, title: `Tab ${i}`, lastAccessed: i * 100 }));
  }

  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  const tiles = wrapper.findAll('.tab-tile');
  expect(tiles).toHaveLength(10);
  expect(tiles[0]?.text()).toContain('Tab 15');
  expect(tiles[0]?.classes()).toContain('tab-tile--selected');
  expect(tiles[1]?.classes()).not.toContain('tab-tile--selected');
});

test('Switcher assigns unique visible hints in quick mode', () => {
  const tabs = [
    createTab({ id: 1, title: 'GitHub' }),
    createTab({ id: 2, title: 'Google' }),
    createTab({ id: 3, title: 'GitLab' }),
  ];

  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  const tiles = wrapper.findAll('.tab-tile');
  const hints = tiles
    .map((t) => {
      const keycap = t.find('.tab-tile__keycap');
      if (keycap.exists()) return keycap.text().toLowerCase();
      return null;
    })
    .filter((h): h is string => h !== null);

  expect(hints).toHaveLength(3);
  expect(new Set(hints).size).toBe(3);
});

test('Switcher enters search mode and focuses input on click', async () => {
  const tabs = [createTab({ id: 1, title: 'Docs' })];
  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
    attachTo: document.body,
  });

  const searchInput = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  expect(searchInput.attributes('readonly')).toBeDefined();

  await wrapper.find('.switcher-search-surface').trigger('click');

  expect(searchInput.attributes('readonly')).toBeUndefined();
  expect(document.activeElement).toBe(searchInput.element);
});

test('Switcher finds a tab outside quick 10 in search mode and uses same tile grid', async () => {
  const tabs = [];
  for (let i = 1; i <= 10; i++) {
    tabs.push(createTab({ id: i, title: `Recent Tab ${i}`, lastAccessed: 1000 + i }));
  }
  tabs.push(createTab({ id: 11, title: 'Hidden Needle Document', lastAccessed: 10 }));

  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  let tiles = wrapper.findAll('.tab-tile');
  expect(tiles.map((t) => t.text())).not.toContain('Needle');

  await wrapper.find('.switcher-search-surface').trigger('click');
  const searchInput = wrapper.find('input.switcher-search-input');
  await searchInput.setValue('needle');

  tiles = wrapper.findAll('.tab-tile');
  expect(tiles).toHaveLength(1);
  expect(tiles[0]?.text()).toContain('Needle');
  expect(tiles[0]?.classes()).toContain('tab-tile--selected');
  expect(tiles[0]?.find('mark.tab-tile__hint-char').exists()).toBe(false);
  expect(tiles[0]?.find('.tab-tile__keycap').exists()).toBe(false);
});

test('search mode renders all matches when >10 and returns to 10 unhinted tiles when cleared', async () => {
  const tabs = [];
  for (let i = 1; i <= 15; i++) {
    tabs.push(createTab({ id: i, title: `Tab ${i}`, lastAccessed: 1000 + i }));
  }

  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  // 1. Quick mode is capped at 10 and has hints
  let tiles = wrapper.findAll('.tab-tile');
  expect(tiles).toHaveLength(10);
  const quickHints = tiles.map((t) => t.find('.tab-tile__keycap').exists());
  expect(quickHints.some((hasHint) => hasHint)).toBe(true);

  // 2. Enter search mode and type non-empty search matching all 15 tabs
  await wrapper.find('.switcher-search-surface').trigger('click');
  const searchInput = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  await searchInput.setValue('Tab');

  // Search mode renders ALL matches (>10)
  tiles = wrapper.findAll('.tab-tile');
  expect(tiles).toHaveLength(15);
  for (const tile of tiles) {
    expect(tile.find('mark.tab-tile__hint-char').exists()).toBe(false);
    expect(tile.find('.tab-tile__keycap').exists()).toBe(false);
  }

  // 3. Clear search query (empty string)
  await searchInput.setValue('');

  // Remains in search mode (input is still editable, not readonly)
  expect(searchInput.attributes('readonly')).toBeUndefined();

  // Shows top 10 MRU tabs without hints
  tiles = wrapper.findAll('.tab-tile');
  expect(tiles).toHaveLength(10);
  expect(tiles[0]?.text()).toContain('Tab 15');
  for (const tile of tiles) {
    expect(tile.find('mark.tab-tile__hint-char').exists()).toBe(false);
    expect(tile.find('.tab-tile__keycap').exists()).toBe(false);
  }

  // Whitespace-only query also preserves search mode with top 10 MRU and no hints
  await searchInput.setValue('   ');
  tiles = wrapper.findAll('.tab-tile');
  expect(tiles).toHaveLength(10);
  for (const tile of tiles) {
    expect(tile.find('mark.tab-tile__hint-char').exists()).toBe(false);
    expect(tile.find('.tab-tile__keycap').exists()).toBe(false);
  }
});

test('Switcher shows query no-result empty state during search', async () => {
  const tabs = [createTab({ id: 1, title: 'Alpha' })];
  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  await wrapper.find('.switcher-search-surface').trigger('click');
  const searchInput = wrapper.find('input.switcher-search-input');
  await searchInput.setValue('nonexistentquery123');

  expect(wrapper.findAll('.tab-tile')).toHaveLength(0);
  const empty = wrapper.find('.switcher-empty');
  expect(empty.exists()).toBe(true);
  expect(empty.text()).toBe('No matching tabs');
  expect(wrapper.find('input.switcher-search-input').exists()).toBe(true);
});

test('Switcher shows quick mode empty state when tabs array is empty', () => {
  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs: [],
    },
  });

  expect(wrapper.findAll('.tab-tile')).toHaveLength(0);
  const empty = wrapper.find('.switcher-empty');
  expect(empty.exists()).toBe(true);
  expect(empty.text()).toBe('No other tabs');
  expect(wrapper.find('input.switcher-search-input').exists()).toBe(true);
});

test('Switcher emits activate event when a tile is clicked', async () => {
  const tabs = [createTab({ id: 88, title: 'Target Tab' })];
  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  const tile = wrapper.find('button.tab-tile');
  await tile.trigger('click');

  expect(wrapper.emitted('activate')).toBeTruthy();
  expect(wrapper.emitted('activate')?.[0]).toEqual([88]);
});

test('Switcher emits close event when close button is clicked', async () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  const closeBtn = wrapper.find('button.switcher-close-btn');
  await closeBtn.trigger('click');

  expect(wrapper.emitted('close')).toBeTruthy();
  expect(wrapper.emitted('close')).toHaveLength(1);
});

test('Switcher resets to quick mode, empty query, and initial selection on reopen', async () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' }), createTab({ id: 2, title: 'Tab 2' })];
  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  await wrapper.find('.switcher-search-surface').trigger('click');
  await wrapper.find('input.switcher-search-input').setValue('Tab 2');
  expect(wrapper.findAll('.tab-tile')).toHaveLength(1);

  await wrapper.setProps({ open: false });
  await wrapper.setProps({ open: true });

  const input = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  expect(input.element.value).toBe('');
  expect(input.attributes('readonly')).toBeDefined();
  expect(wrapper.findAll('.tab-tile')).toHaveLength(2);
  expect(wrapper.findAll('.tab-tile')[0]?.classes()).toContain('tab-tile--selected');
});

test('Switcher resets state when tabs prop changes while open', async () => {
  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs: [createTab({ id: 1, title: 'Tab 1' })],
    },
  });

  await wrapper.find('.switcher-search-surface').trigger('click');
  await wrapper.find('input.switcher-search-input').setValue('query');
  expect(wrapper.find('input.switcher-search-input').attributes('readonly')).toBeUndefined();

  await wrapper.setProps({
    tabs: [createTab({ id: 2, title: 'Tab 2' })],
  });

  const input = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  expect(input.element.value).toBe('');
  expect(input.attributes('readonly')).toBeDefined();
});

// Keyboard navigation tests

test('quick initially selects previous MRU with readonly search input', async () => {
  const tabs = [
    createTab({ id: 10, title: 'Previous MRU Tab', lastAccessed: 500 }),
    createTab({ id: 20, title: 'Older Tab', lastAccessed: 200 }),
  ];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
    attachTo: document.body,
  });

  await nextTick();

  const tiles = wrapper.findAll('.tab-tile');
  expect(tiles[0]?.classes()).toContain('tab-tile--selected');
  expect(tiles[0]?.text()).toContain('Previous MRU Tab');
  expect(tiles[1]?.classes()).not.toContain('tab-tile--selected');

  const searchInput = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  expect(searchInput.attributes('readonly')).toBeDefined();
});

test('Enter emits selected id on keyup; Enter empty does nothing', () => {
  const tabs = [
    createTab({ id: 42, title: 'Selected Tab', lastAccessed: 500 }),
    createTab({ id: 43, title: 'Other Tab', lastAccessed: 200 }),
  ];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  const ev1 = dispatchKey('Enter', { code: 'Enter' });
  expect(ev1.defaultPrevented).toBe(true);
  expect(wrapper.emitted('activate')).toBeUndefined();

  const up1 = dispatchKeyUp('Enter', { code: 'Enter' });
  expect(up1.defaultPrevented).toBe(true);
  expect(wrapper.emitted('activate')).toBeTruthy();
  expect(wrapper.emitted('activate')?.[0]).toEqual([42]);

  const emptyWrapper = mount(Switcher, {
    props: { open: true, tabs: [] },
  });
  const ev2 = dispatchKey('Enter', { code: 'Enter' });
  expect(ev2.defaultPrevented).toBe(true);
  dispatchKeyUp('Enter', { code: 'Enter' });
  expect(emptyWrapper.emitted('activate')).toBeUndefined();
});

test('/ enters and focuses search in quick mode', async () => {
  const tabs = [createTab({ id: 1, title: 'Docs Tab' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
    attachTo: document.body,
  });

  const searchInput = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  expect(searchInput.attributes('readonly')).toBeDefined();

  const ev = dispatchKey('/');
  expect(ev.defaultPrevented).toBe(true);

  await nextTick();
  expect(searchInput.attributes('readonly')).toBeUndefined();
  expect(document.activeElement).toBe(searchInput.element);
});

test('quick Escape queues close on keydown and emits close on keyup', () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  const ev = dispatchKey('Escape', { code: 'Escape' });
  expect(ev.defaultPrevented).toBe(true);
  expect(wrapper.emitted('close')).toBeUndefined();

  const up = dispatchKeyUp('Escape', { code: 'Escape' });
  expect(up.defaultPrevented).toBe(true);
  expect(wrapper.emitted('close')).toBeTruthy();
  expect(wrapper.emitted('close')).toHaveLength(1);
});

test('search Escape clears/leaves search/restores quick tiles without closing; second Escape closes', async () => {
  const tabs = [
    createTab({ id: 1, title: 'First Tab', lastAccessed: 200 }),
    createTab({ id: 2, title: 'Second Tab', lastAccessed: 100 }),
  ];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
    attachTo: document.body,
  });

  // Enter search mode via /
  dispatchKey('/');
  await nextTick();

  const searchInput = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  await searchInput.setValue('Second');
  expect(wrapper.findAll('.tab-tile')).toHaveLength(1);

  // First Escape in search mode
  const esc1 = dispatchKey('Escape', { code: 'Escape' });
  expect(esc1.defaultPrevented).toBe(true);
  dispatchKeyUp('Escape', { code: 'Escape' });
  await nextTick();

  // Mode returned to quick, input cleared, close NOT emitted
  expect(wrapper.emitted('close')).toBeUndefined();
  expect(searchInput.element.value).toBe('');
  expect(searchInput.attributes('readonly')).toBeDefined();

  // Quick tiles restored, first selected
  const restoredTiles = wrapper.findAll('.tab-tile');
  expect(restoredTiles).toHaveLength(2);
  expect(restoredTiles[0]?.classes()).toContain('tab-tile--selected');
  expect(restoredTiles[0]?.text()).toContain('First Tab');

  // Second Escape in quick mode
  const esc2 = dispatchKey('Escape', { code: 'Escape' });
  expect(esc2.defaultPrevented).toBe(true);
  expect(wrapper.emitted('close')).toBeUndefined();

  const up2 = dispatchKeyUp('Escape', { code: 'Escape' });
  expect(up2.defaultPrevented).toBe(true);
  expect(wrapper.emitted('close')).toBeTruthy();
  expect(wrapper.emitted('close')).toHaveLength(1);
});

test('window blur while close action is pending cancels queued close without emitting', () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });
  dispatchKey('Escape', { code: 'Escape' });
  expect(wrapper.emitted('close')).toBeUndefined();

  window.dispatchEvent(new Event('blur'));
  expect(wrapper.emitted('close')).toBeUndefined();
});

test('window blur while activate action is pending cancels queued activate without emitting', () => {
  const tabs = [createTab({ id: 101, title: 'Alpha', lastAccessed: 100 })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });
  dispatchKey('Enter', { code: 'Enter' });
  expect(wrapper.emitted('activate')).toBeUndefined();

  window.dispatchEvent(new Event('blur'));
  expect(wrapper.emitted('activate')).toBeUndefined();
});

test('fallback safety timer cancels queued close after 800ms without emitting', () => {
  vi.useFakeTimers();
  try {
    const tabs = [createTab({ id: 1, title: 'Tab 1' })];
    const wrapper = mount(Switcher, {
      props: { open: true, tabs },
    });
    dispatchKey('Escape', { code: 'Escape' });
    expect(wrapper.emitted('close')).toBeUndefined();

    vi.advanceTimersByTime(800);
    expect(wrapper.emitted('close')).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});

test('fallback safety timer cancels queued activate after 800ms without emitting', () => {
  vi.useFakeTimers();
  try {
    const tabs = [createTab({ id: 202, title: 'Beta', lastAccessed: 100 })];
    const wrapper = mount(Switcher, {
      props: { open: true, tabs },
    });
    dispatchKey('Enter', { code: 'Enter' });
    expect(wrapper.emitted('activate')).toBeUndefined();

    vi.advanceTimersByTime(800);
    expect(wrapper.emitted('activate')).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});

test('backdrop click immediately emits close without waiting for keyup', async () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });
  const overlay = wrapper.find<HTMLElement>('.switcher-overlay');
  await overlay.trigger('click');
  expect(wrapper.emitted('close')).toHaveLength(1);
});

test('close button click immediately emits close without waiting for keyup', async () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });
  const closeBtn = wrapper.find<HTMLButtonElement>('.switcher-close-btn');
  await closeBtn.trigger('click');
  expect(wrapper.emitted('close')).toHaveLength(1);
});

test('tile click immediately emits activate without waiting for keyup', async () => {
  const tabs = [createTab({ id: 55, title: 'Tab 55' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });
  const tile = wrapper.find('.tab-tile');
  await tile.trigger('click');
  expect(wrapper.emitted('activate')).toHaveLength(1);
  expect(wrapper.emitted('activate')?.[0]).toEqual([55]);
});

test('all four arrows change selected tile at desktop grid (5 columns)', async () => {
  window.innerWidth = 1024;
  const tabs = [];
  for (let i = 1; i <= 10; i++) {
    tabs.push(createTab({ id: i, title: `Tab ${i}`, lastAccessed: 1000 - i }));
  }
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  const getSelectedIndex = async (): Promise<number> => {
    await nextTick();
    const tiles = wrapper.findAll('.tab-tile');
    return tiles.findIndex((t) => t.classes().includes('tab-tile--selected'));
  };

  expect(await getSelectedIndex()).toBe(0);

  // Move right across row 0
  dispatchKey('ArrowRight');
  expect(await getSelectedIndex()).toBe(1);
  dispatchKey('ArrowRight');
  expect(await getSelectedIndex()).toBe(2);
  dispatchKey('ArrowRight');
  expect(await getSelectedIndex()).toBe(3);
  dispatchKey('ArrowRight');
  expect(await getSelectedIndex()).toBe(4);

  // Clamps right at row edge (does not wrap to 5)
  dispatchKey('ArrowRight');
  expect(await getSelectedIndex()).toBe(4);

  // Move down to row 1 (index 4 + 5 = 9)
  dispatchKey('ArrowDown');
  expect(await getSelectedIndex()).toBe(9);

  // Clamps down at bottom row
  dispatchKey('ArrowDown');
  expect(await getSelectedIndex()).toBe(9);

  // Move left on row 1
  dispatchKey('ArrowLeft');
  expect(await getSelectedIndex()).toBe(8);

  // Move up to row 0 (index 8 - 5 = 3)
  dispatchKey('ArrowUp');
  expect(await getSelectedIndex()).toBe(3);

  // Clamps up at top row
  dispatchKey('ArrowUp');
  expect(await getSelectedIndex()).toBe(3);

  // Move left back to 0
  dispatchKey('ArrowLeft');
  dispatchKey('ArrowLeft');
  dispatchKey('ArrowLeft');
  expect(await getSelectedIndex()).toBe(0);

  // Clamps left at left edge
  dispatchKey('ArrowLeft');
  expect(await getSelectedIndex()).toBe(0);
});

test('arrows change selected tile at responsive grid (width <= 480 => 2 columns)', async () => {
  window.innerWidth = 400;
  const tabs = [
    createTab({ id: 1, title: 'Tab 1', lastAccessed: 400 }),
    createTab({ id: 2, title: 'Tab 2', lastAccessed: 300 }),
    createTab({ id: 3, title: 'Tab 3', lastAccessed: 200 }),
    createTab({ id: 4, title: 'Tab 4', lastAccessed: 100 }),
  ];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  const getSelectedIndex = async (): Promise<number> => {
    await nextTick();
    const tiles = wrapper.findAll('.tab-tile');
    return tiles.findIndex((t) => t.classes().includes('tab-tile--selected'));
  };

  expect(await getSelectedIndex()).toBe(0);

  // Move right to col 1 (index 1)
  dispatchKey('ArrowRight');
  expect(await getSelectedIndex()).toBe(1);

  // Clamps right at 2-column boundary
  dispatchKey('ArrowRight');
  expect(await getSelectedIndex()).toBe(1);

  // Move down by 2 columns (index 1 + 2 = 3)
  dispatchKey('ArrowDown');
  expect(await getSelectedIndex()).toBe(3);

  // Move left to col 0 (index 2)
  dispatchKey('ArrowLeft');
  expect(await getSelectedIndex()).toBe(2);
});

test('uppercase and lowercase mnemonic activates immediately; mnemonic miss does nothing', () => {
  const tabs = [
    createTab({ id: 101, title: 'GitHub', lastAccessed: 200 }),
    createTab({ id: 202, title: 'Google', lastAccessed: 100 }),
  ];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  const tiles = wrapper.findAll('.tab-tile');
  const getHint = (el: (typeof tiles)[number]): string | null => {
    const keycap = el.find('.tab-tile__keycap');
    if (keycap.exists()) return keycap.text();
    return null;
  };
  const firstTile = tiles[0];
  const secondTile = tiles[1];
  const hint0 = firstTile ? getHint(firstTile) : null;
  const hint1 = secondTile ? getHint(secondTile) : null;

  expect(hint0).not.toBeNull();
  expect(hint1).not.toBeNull();

  if (hint0 && hint1) {
    // Lowercase mnemonic queues on keydown, activates tab 0 on keyup
    const ev1 = dispatchKey(hint0.toLowerCase(), { code: `Key${hint0.toUpperCase()}` });
    expect(ev1.defaultPrevented).toBe(true);
    expect(wrapper.emitted('activate')).toBeUndefined();

    const up1 = dispatchKeyUp(hint0.toLowerCase(), { code: `Key${hint0.toUpperCase()}` });
    expect(up1.defaultPrevented).toBe(true);
    expect(wrapper.emitted('activate')).toBeTruthy();
    expect(wrapper.emitted('activate')?.[0]).toEqual([101]);

    // Uppercase mnemonic queues on keydown, activates tab 1 on keyup
    const ev2 = dispatchKey(hint1.toUpperCase(), {
      shiftKey: true,
      code: `Key${hint1.toUpperCase()}`,
    });
    expect(ev2.defaultPrevented).toBe(true);
    expect(wrapper.emitted('activate')?.[1]).toBeUndefined();

    const up2 = dispatchKeyUp(hint1.toUpperCase(), {
      shiftKey: true,
      code: `Key${hint1.toUpperCase()}`,
    });
    expect(up2.defaultPrevented).toBe(true);
    expect(wrapper.emitted('activate')?.[1]).toEqual([202]);

    // Mnemonic miss does not activate and does not prevent default
    const ev3 = dispatchKey('z', { code: 'KeyZ' });
    expect(ev3.defaultPrevented).toBe(false);
    expect(wrapper.emitted('activate')).toHaveLength(2);
  }
});

test('search typing filters, selection resets, arrows select another result, Enter emits that result', async () => {
  window.innerWidth = 1024;
  const tabs = [
    createTab({ id: 1, title: 'Alpha First', lastAccessed: 300 }),
    createTab({ id: 2, title: 'Alpha Second', lastAccessed: 200 }),
    createTab({ id: 3, title: 'Beta Third', lastAccessed: 100 }),
  ];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  // Enter search
  dispatchKey('/');
  await nextTick();

  // Type filter query
  const searchInput = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  await searchInput.setValue('Alpha');

  const filteredTiles = wrapper.findAll('.tab-tile');
  expect(filteredTiles).toHaveLength(2);
  expect(filteredTiles[0]?.classes()).toContain('tab-tile--selected');
  expect(filteredTiles[0]?.text()).toContain('Alpha First');

  // Arrow right selects second result in the same row
  dispatchKey('ArrowRight');
  await nextTick();
  const updatedTiles = wrapper.findAll('.tab-tile');
  expect(updatedTiles[1]?.classes()).toContain('tab-tile--selected');

  // Enter activates second result on keyup
  dispatchKey('Enter', { code: 'Enter' });
  expect(wrapper.emitted('activate')).toBeUndefined();
  dispatchKeyUp('Enter', { code: 'Enter' });
  expect(wrapper.emitted('activate')).toBeTruthy();
  expect(wrapper.emitted('activate')?.[0]).toEqual([2]);
});

test('empty search results arrows and Enter are safe', async () => {
  const tabs = [createTab({ id: 1, title: 'Existing Tab' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  dispatchKey('/');
  await nextTick();

  const searchInput = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  await searchInput.setValue('nomatchxyz');

  expect(wrapper.findAll('.tab-tile')).toHaveLength(0);

  // Arrows should not crash or change selection
  const evDown = dispatchKey('ArrowDown');
  expect(evDown.defaultPrevented).toBe(true);

  const evRight = dispatchKey('ArrowRight');
  expect(evRight.defaultPrevented).toBe(true);

  // Enter should not emit activate
  const evEnter = dispatchKey('Enter', { code: 'Enter' });
  expect(evEnter.defaultPrevented).toBe(true);
  dispatchKeyUp('Enter', { code: 'Enter' });
  expect(wrapper.emitted('activate')).toBeUndefined();
});

test('modified and composing keys are ignored', () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  const ctrlEnter = dispatchKey('Enter', { ctrlKey: true });
  expect(ctrlEnter.defaultPrevented).toBe(false);
  expect(wrapper.emitted('activate')).toBeUndefined();

  const metaEsc = dispatchKey('Escape', { metaKey: true });
  expect(metaEsc.defaultPrevented).toBe(false);
  expect(wrapper.emitted('close')).toBeUndefined();

  const altDown = dispatchKey('ArrowDown', { altKey: true });
  expect(altDown.defaultPrevented).toBe(false);

  const composingSlash = dispatchKey('/', { isComposing: true });
  expect(composingSlash.defaultPrevented).toBe(false);
  const input = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  expect(input.attributes('readonly')).toBeDefined();
});

test('unrecognized key in quick mode and typing in search mode do not prevent default', async () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  mount(Switcher, {
    props: { open: true, tabs },
  });

  // Non-letter key in quick mode
  const evDigit = dispatchKey('1');
  expect(evDigit.defaultPrevented).toBe(false);

  // Enter search
  dispatchKey('/');
  await nextTick();

  // Normal character key in search mode is not prevented
  const evChar = dispatchKey('a');
  expect(evChar.defaultPrevented).toBe(false);
});

test('listener is removed on unmount', () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  wrapper.unmount();

  const ev = dispatchKey('Escape');
  expect(ev.defaultPrevented).toBe(false);
  expect(wrapper.emitted('close')).toBeUndefined();
});

test('when open is false, keydown listener does not act', () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: { open: false, tabs },
  });

  const ev = dispatchKey('Escape');
  expect(ev.defaultPrevented).toBe(false);
  expect(wrapper.emitted('close')).toBeUndefined();
});

test('any keyup while open is default-prevented and does not reach a later page listener', () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  mount(Switcher, {
    props: { open: true, tabs },
  });

  let pageListenerCalled = false;
  const pageListener = (): void => {
    pageListenerCalled = true;
  };
  window.addEventListener('keyup', pageListener);

  try {
    const ev = dispatchKeyUp('x', { code: 'KeyX' });
    expect(ev.defaultPrevented).toBe(true);
    expect(pageListenerCalled).toBe(false);
  } finally {
    window.removeEventListener('keyup', pageListener);
  }
});

test('unmount removes keyup listener and pending state', () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const wrapper = mount(Switcher, {
    props: { open: true, tabs },
  });

  // Keydown while open
  dispatchKey('Escape', { code: 'Escape' });

  // Unmount component
  wrapper.unmount();

  let pageListenerCalled = false;
  const pageListener = (): void => {
    pageListenerCalled = true;
  };
  window.addEventListener('keyup', pageListener);

  try {
    const upEvent = dispatchKeyUp('Escape', { code: 'Escape' });
    expect(upEvent.defaultPrevented).toBe(false);
    expect(pageListenerCalled).toBe(true);
  } finally {
    window.removeEventListener('keyup', pageListener);
  }
});

test('holding Escape beyond timeout cancels action without close, consumes keyup, and allows subsequent press', () => {
  vi.useFakeTimers();
  try {
    const tabs = [createTab({ id: 1, title: 'Tab 1' })];
    const wrapper = mount(Switcher, {
      props: { open: true, tabs },
    });

    dispatchKey('Escape', { code: 'Escape' });
    dispatchKey('Escape', { code: 'Escape', repeat: true });

    vi.advanceTimersByTime(800);
    expect(wrapper.emitted('close')).toBeUndefined();

    const upEvent = dispatchKeyUp('Escape', { code: 'Escape' });
    expect(upEvent.defaultPrevented).toBe(true);
    expect(wrapper.emitted('close')).toBeUndefined();

    dispatchKey('Escape', { code: 'Escape' });
    dispatchKeyUp('Escape', { code: 'Escape' });
    expect(wrapper.emitted('close')).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});

test('holding mnemonic beyond timeout cancels action without activate, consumes keyup, and allows subsequent press', () => {
  vi.useFakeTimers();
  try {
    const tabs = [createTab({ id: 42, title: 'Alpha Tab' })];
    const wrapper = mount(Switcher, {
      props: { open: true, tabs },
    });

    const tile = wrapper.find('.tab-tile');
    const hint = tile.find('.tab-tile__keycap').text().toLowerCase();

    dispatchKey(hint, { code: `Key${hint.toUpperCase()}` });
    dispatchKey(hint, { code: `Key${hint.toUpperCase()}`, repeat: true });

    vi.advanceTimersByTime(800);
    expect(wrapper.emitted('activate')).toBeUndefined();

    const upEvent = dispatchKeyUp(hint, { code: `Key${hint.toUpperCase()}` });
    expect(upEvent.defaultPrevented).toBe(true);
    expect(wrapper.emitted('activate')).toBeUndefined();

    dispatchKey(hint, { code: `Key${hint.toUpperCase()}` });
    dispatchKeyUp(hint, { code: `Key${hint.toUpperCase()}` });
    expect(wrapper.emitted('activate')?.[0]).toEqual([42]);
  } finally {
    vi.useRealTimers();
  }
});

test('window blur while action is pending cancels action without emission', () => {
  vi.useFakeTimers();
  try {
    const tabs = [createTab({ id: 1, title: 'Tab 1' })];
    const wrapper = mount(Switcher, {
      props: { open: true, tabs },
    });

    dispatchKey('Escape', { code: 'Escape' });
    window.dispatchEvent(new Event('blur'));

    vi.advanceTimersByTime(1000);
    expect(wrapper.emitted('close')).toBeUndefined();

    const upEvent = dispatchKeyUp('Escape', { code: 'Escape' });
    expect(upEvent.defaultPrevented).toBe(true);
    expect(wrapper.emitted('close')).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});

test('selection change scrolls newly selected tile into view', async () => {
  const scrollSpy = vi
    .spyOn(window.HTMLElement.prototype, 'scrollIntoView')
    .mockImplementation(() => {});

  try {
    const tabs = [
      createTab({ id: 1, title: 'Tab 1', lastAccessed: 200 }),
      createTab({ id: 2, title: 'Tab 2', lastAccessed: 100 }),
    ];
    mount(Switcher, {
      props: { open: true, tabs },
    });

    await nextTick();
    scrollSpy.mockClear();

    dispatchKey('ArrowRight');
    await nextTick();

    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  } finally {
    scrollSpy.mockRestore();
  }
});
