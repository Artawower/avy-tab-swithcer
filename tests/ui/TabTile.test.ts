import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import TabTile from '../../src/ui/TabTile.vue';
import { createTab } from '../fixtures/tab';

test('TabTile renders displayed title and accessible label', () => {
  const tab = createTab({ id: 1, title: 'GitHub Dashboard', hostname: 'github.com' });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: null,
      hintIndex: null,
    },
  });

  expect(wrapper.text()).toContain('GitHub Dashboard');
  expect(wrapper.find('button').attributes('aria-label')).toBe('GitHub Dashboard');
});

test('TabTile renders exact marked mnemonic character when hintIndex is valid', () => {
  const tab = createTab({ id: 1, title: 'GitHub', hostname: 'github.com' });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: 'h',
      hintIndex: 3, // 'G-i-t-H-u-b' -> 'H'
    },
  });

  const mark = wrapper.find('mark.tab-tile__hint-char');
  expect(mark.exists()).toBe(true);
  expect(mark.text()).toBe('H');
  expect(wrapper.find('.tab-tile__title').text()).toBe('GitHub');
  expect(wrapper.find('.tab-tile__hint-badge').exists()).toBe(false);
  expect(wrapper.find('button').attributes('aria-label')).toBe('GitHub (key: h)');
});

test('TabTile renders separate badge when hint is chosen but absent from label', () => {
  const tab = createTab({ id: 1, title: 'Inbox', hostname: 'mail.com' });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: 'z',
      hintIndex: null,
    },
  });

  expect(wrapper.find('mark.tab-tile__hint-char').exists()).toBe(false);
  const badge = wrapper.find('.tab-tile__hint-badge');
  expect(badge.exists()).toBe(true);
  expect(badge.text()).toBe('z');
  expect(wrapper.find('button').attributes('aria-label')).toBe('Inbox (key: z)');
});

test('TabTile does not render hint badge or highlight when hint is null', () => {
  const tab = createTab({ id: 1, title: 'Search Result', hostname: 'search.com' });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: null,
      hintIndex: null,
    },
  });

  expect(wrapper.find('mark.tab-tile__hint-char').exists()).toBe(false);
  expect(wrapper.find('.tab-tile__hint-badge').exists()).toBe(false);
  expect(wrapper.find('button').attributes('aria-label')).toBe('Search Result');
});

test('TabTile renders favicon image when provided', () => {
  const tab = createTab({
    id: 1,
    title: 'Example',
    faviconUrl: 'https://example.com/icon.png',
  });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: null,
      hintIndex: null,
    },
  });

  const img = wrapper.find('img.tab-tile__icon');
  expect(img.exists()).toBe(true);
  expect(img.attributes('src')).toBe('https://example.com/icon.png');
  expect(wrapper.find('.tab-tile__fallback').exists()).toBe(false);
});

test('TabTile permanently renders fallback character on image error', async () => {
  const tab = createTab({
    id: 1,
    title: 'Wikipedia',
    faviconUrl: 'https://invalid-icon-url.example/icon.png',
  });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: null,
      hintIndex: null,
    },
  });

  const img = wrapper.find('img.tab-tile__icon');
  expect(img.exists()).toBe(true);

  await img.trigger('error');

  expect(wrapper.find('img.tab-tile__icon').exists()).toBe(false);
  const fallback = wrapper.find('.tab-tile__fallback');
  expect(fallback.exists()).toBe(true);
  expect(fallback.text()).toBe('W');
});

test('TabTile renders deterministic fallback when faviconUrl is null', () => {
  const tab = createTab({
    id: 1,
    title: '  alpha test',
    faviconUrl: null,
  });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: null,
      hintIndex: null,
    },
  });

  expect(wrapper.find('img.tab-tile__icon').exists()).toBe(false);
  const fallback = wrapper.find('.tab-tile__fallback');
  expect(fallback.exists()).toBe(true);
  expect(fallback.text()).toBe('A');
});

test('TabTile renders "U" fallback for whitespace-only tab via Untitled tab fallback', () => {
  const tab = createTab({
    id: 1,
    title: '   ',
    hostname: '   ',
    faviconUrl: null,
  });
  // getTabLabel returns 'Untitled tab' when title/hostname are whitespace, which starts with 'U'
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: null,
      hintIndex: null,
    },
  });

  const fallback = wrapper.find('.tab-tile__fallback');
  expect(fallback.exists()).toBe(true);
  expect(fallback.text()).toBe('U');
});

test('TabTile applies selected class and aria-current when selected is true', () => {
  const tab = createTab({ id: 1, title: 'Selected Tab' });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: true,
      hint: null,
      hintIndex: null,
    },
  });

  const button = wrapper.find('button');
  expect(button.classes()).toContain('tab-tile--selected');
  expect(button.attributes('aria-current')).toBe('true');
});

test('TabTile omits selected class and aria-current when selected is false', () => {
  const tab = createTab({ id: 1, title: 'Unselected Tab' });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: null,
      hintIndex: null,
    },
  });

  const button = wrapper.find('button');
  expect(button.classes()).not.toContain('tab-tile--selected');
  expect(button.attributes('aria-current')).toBeUndefined();
});

test('TabTile resets imageFailed when tab faviconUrl prop updates', async () => {
  const tab1 = createTab({ id: 1, faviconUrl: 'https://bad.url/icon.png' });
  const wrapper = mount(TabTile, {
    props: { tab: tab1, selected: false, hint: null, hintIndex: null },
  });
  await wrapper.find('img').trigger('error');
  expect(wrapper.find('.tab-tile__fallback').exists()).toBe(true);

  const tab2 = createTab({ id: 1, faviconUrl: 'https://good.url/icon.png' });
  await wrapper.setProps({ tab: tab2 });
  expect(wrapper.find('img').exists()).toBe(true);
});

test('TabTile emits activate event with tab id on click', async () => {
  const tab = createTab({ id: 42, title: 'Click Tab' });
  const wrapper = mount(TabTile, {
    props: {
      tab,
      selected: false,
      hint: null,
      hintIndex: null,
    },
  });

  await wrapper.find('button').trigger('click');

  expect(wrapper.emitted('activate')).toBeTruthy();
  expect(wrapper.emitted('activate')?.[0]).toEqual([42]);
});
