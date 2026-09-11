import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import Switcher from '../../src/ui/Switcher.vue';
import TabTile from '../../src/ui/TabTile.vue';
import { createTab } from '../fixtures/tab';

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

  const tiles = wrapper.findAllComponents(TabTile);
  expect(tiles).toHaveLength(10);
  expect(tiles[0]?.props('tab').id).toBe(15);
  expect(tiles[0]?.props('selected')).toBe(true);
  expect(tiles[1]?.props('selected')).toBe(false);
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

  const tiles = wrapper.findAllComponents(TabTile);
  const hints = tiles.map((t) => t.props('hint')).filter((h): h is string => h !== null);

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

  wrapper.unmount();
});

test('Switcher finds a tab outside quick 10 in search mode and uses same tile grid', async () => {
  const tabs = [];
  // Tab 1 to 10 have high recency, Tab 11 has low recency with unique title
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

  // In quick mode, Tab 11 is not among the top 10
  let tiles = wrapper.findAllComponents(TabTile);
  expect(tiles.map((t) => t.props('tab').id)).not.toContain(11);

  // Enter search mode by clicking search surface and inputting query
  await wrapper.find('.switcher-search-surface').trigger('click');
  const searchInput = wrapper.find('input.switcher-search-input');
  await searchInput.setValue('needle');

  // Search finds Tab 11
  tiles = wrapper.findAllComponents(TabTile);
  expect(tiles).toHaveLength(1);
  expect(tiles[0]?.props('tab').id).toBe(11);
  expect(tiles[0]?.props('selected')).toBe(true);
  expect(tiles[0]?.props('hint')).toBeNull(); // Search tiles pass null hint
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

  expect(wrapper.findAllComponents(TabTile)).toHaveLength(0);
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

  expect(wrapper.findAllComponents(TabTile)).toHaveLength(0);
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

  const tile = wrapper.findComponent(TabTile);
  await tile.find('button').trigger('click');

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
  const tabs = [
    createTab({ id: 1, title: 'Tab 1' }),
    createTab({ id: 2, title: 'Tab 2' }),
  ];
  const wrapper = mount(Switcher, {
    props: {
      open: true,
      tabs,
    },
  });

  // Enter search
  await wrapper.find('.switcher-search-surface').trigger('click');
  await wrapper.find('input.switcher-search-input').setValue('Tab 2');
  expect(wrapper.findAllComponents(TabTile)).toHaveLength(1);

  // Close
  await wrapper.setProps({ open: false });

  // Re-open
  await wrapper.setProps({ open: true });

  const input = wrapper.find<HTMLInputElement>('input.switcher-search-input');
  expect(input.element.value).toBe('');
  expect(input.attributes('readonly')).toBeDefined();
  expect(wrapper.findAllComponents(TabTile)).toHaveLength(2);
  expect(wrapper.findAllComponents(TabTile)[0]?.props('selected')).toBe(true);
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
