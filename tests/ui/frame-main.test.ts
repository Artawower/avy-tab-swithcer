import { mount } from '@vue/test-utils';
import { expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import type { FrameCloseMessage } from '../../src/application/messages';
import {
  applyFrameColorScheme,
  createFrameAppComponent,
  defaultFrameAppPort,
  HEARTBEAT_INTERVAL_MS,
  mountFrameApp,
  type FrameAppPort,
} from '../../src/ui/frame-main';
import { createTab } from '../fixtures/tab';

test('applies the parent page color scheme supplied in the frame URL', () => {
  const root = document.createElement('html');

  applyFrameColorScheme(root, '?sessionId=session-1&colorScheme=dark');

  expect(root.style.getPropertyValue('color-scheme')).toBe('dark');
});

test('keeps the existing frame color scheme when the URL omits it', () => {
  const root = document.createElement('html');
  root.style.setProperty('color-scheme', 'light');

  applyFrameColorScheme(root, '?sessionId=session-1');

  expect(root.style.getPropertyValue('color-scheme')).toBe('light');
});

test('tears down via notifyClose if sessionId is missing', async () => {
  const sendMessage = vi.fn().mockResolvedValue({ ok: true, tabs: [] });
  const postParentMessage = vi.fn();

  const port: FrameAppPort = {
    getSessionId: () => '',
    sendMessage,
    postParentMessage,
  };

  const wrapper = mount(createFrameAppComponent(port));
  await nextTick();

  expect(sendMessage).not.toHaveBeenCalled();
  expect(postParentMessage).toHaveBeenCalledWith({
    type: 'AVY_FRAME_INIT_FAILED',
  });
  expect(wrapper.find('.switcher-overlay').exists()).toBe(false);
});

test('requests switcher data on mount and opens with tabs', async () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const sendMessage = vi.fn().mockResolvedValue({ ok: true, tabs });
  const postParentMessage = vi.fn();

  const port: FrameAppPort = {
    getSessionId: () => 'test-session-123',
    sendMessage,
    postParentMessage,
  };

  const wrapper = mount(createFrameAppComponent(port));
  await nextTick();
  await nextTick();

  expect(sendMessage).toHaveBeenCalledWith({
    type: 'REQUEST_SWITCHER_DATA',
    sessionId: 'test-session-123',
  });
  expect(wrapper.find('.switcher-overlay').exists()).toBe(true);
  expect(wrapper.findAll('.tab-tile')).toHaveLength(1);
});

test('tears down via notifyClose if request switcher data rejects', async () => {
  const sendMessage = vi.fn().mockRejectedValue(new Error('Network error'));
  const postParentMessage = vi.fn();

  const port: FrameAppPort = {
    getSessionId: () => 'session-err',
    sendMessage,
    postParentMessage,
  };

  const wrapper = mount(createFrameAppComponent(port));
  await nextTick();
  await nextTick();

  expect(postParentMessage).toHaveBeenCalledWith({
    type: 'AVY_CLOSE_FRAME',
    sessionId: 'session-err',
  });
  expect(wrapper.find('.switcher-overlay').exists()).toBe(false);
});

test('tears down via notifyClose if request switcher data returns not ok', async () => {
  const sendMessage = vi.fn().mockResolvedValue({ ok: false, reason: 'unauthorized' });
  const postParentMessage = vi.fn();

  const port: FrameAppPort = {
    getSessionId: () => 'session-unauth',
    sendMessage,
    postParentMessage,
  };

  const wrapper = mount(createFrameAppComponent(port));
  await nextTick();
  await nextTick();

  expect(postParentMessage).toHaveBeenCalledWith({
    type: 'AVY_CLOSE_FRAME',
    sessionId: 'session-unauth',
  });
  expect(wrapper.find('.switcher-overlay').exists()).toBe(false);
});

test('tears down with AVY_FRAME_INIT_FAILED if sessionId is missing', async () => {
  const sendMessage = vi.fn().mockResolvedValue({ ok: true, tabs: [] });
  const postParentMessage = vi.fn();

  const port: FrameAppPort = {
    getSessionId: () => '',
    sendMessage,
    postParentMessage,
  };

  const wrapper = mount(createFrameAppComponent(port));
  await nextTick();
  await nextTick();

  expect(postParentMessage).toHaveBeenCalledWith({
    type: 'AVY_FRAME_INIT_FAILED',
  });
  expect(wrapper.find('.switcher-overlay').exists()).toBe(false);
});

test('sends periodic heartbeat and tears down if heartbeat fails', async () => {
  vi.useFakeTimers();
  try {
    const tabs = [createTab({ id: 1, title: 'Tab 1' })];
    let heartbeatCalls = 0;
    const sendMessage = vi.fn().mockImplementation((msg: { type: string }) => {
      if (msg.type === 'REQUEST_SWITCHER_DATA') {
        return Promise.resolve({ ok: true, tabs });
      }
      if (msg.type === 'HEARTBEAT_SWITCHER_SESSION') {
        heartbeatCalls++;
        if (heartbeatCalls === 1) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false, reason: 'unauthorized' });
      }
      return Promise.resolve();
    });
    const postParentMessage = vi.fn();

    const port: FrameAppPort = {
      getSessionId: () => 'session-hb',
      sendMessage,
      postParentMessage,
    };

    const wrapper = mount(createFrameAppComponent(port));
    await Promise.resolve();
    await nextTick();

    expect(wrapper.find('.switcher-overlay').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'HEARTBEAT_SWITCHER_SESSION',
      sessionId: 'session-hb',
    });
    expect(postParentMessage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(postParentMessage).toHaveBeenCalledWith({
      type: 'AVY_CLOSE_FRAME',
      sessionId: 'session-hb',
    });
    expect(wrapper.find('.switcher-overlay').exists()).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

test('tears down if heartbeat message rejects', async () => {
  vi.useFakeTimers();
  try {
    const tabs = [createTab({ id: 1, title: 'Tab 1' })];
    const sendMessage = vi.fn().mockImplementation((msg: { type: string }) => {
      if (msg.type === 'REQUEST_SWITCHER_DATA') {
        return Promise.resolve({ ok: true, tabs });
      }
      if (msg.type === 'HEARTBEAT_SWITCHER_SESSION') {
        return Promise.reject(new Error('Extension context invalidated'));
      }
      return Promise.resolve();
    });
    const postParentMessage = vi.fn();

    const port: FrameAppPort = {
      getSessionId: () => 'session-hb-err',
      sendMessage,
      postParentMessage,
    };

    const wrapper = mount(createFrameAppComponent(port));
    await Promise.resolve();
    await nextTick();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(postParentMessage).toHaveBeenCalledWith({
      type: 'AVY_CLOSE_FRAME',
      sessionId: 'session-hb-err',
    });
    expect(wrapper.find('.switcher-overlay').exists()).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

test('notifies close to parent and background when Switcher emits close', async () => {
  const tabs = [createTab({ id: 1, title: 'Tab 1' })];
  const sendMessage = vi.fn().mockImplementation((msg: { type: string }) => {
    if (msg.type === 'REQUEST_SWITCHER_DATA') {
      return Promise.resolve({ ok: true, tabs });
    }
    return Promise.resolve();
  });
  const postParentMessage = vi.fn();

  const port: FrameAppPort = {
    getSessionId: () => 'session-close',
    sendMessage,
    postParentMessage,
  };

  const wrapper = mount(createFrameAppComponent(port));
  await nextTick();
  await nextTick();

  const closeBtn = wrapper.find('.switcher-close-btn');
  await closeBtn.trigger('click');
  await nextTick();

  expect(postParentMessage).toHaveBeenCalledWith({
    type: 'AVY_CLOSE_FRAME',
    sessionId: 'session-close',
  });
  expect(sendMessage).toHaveBeenCalledWith({
    type: 'CLOSE_SWITCHER_SESSION',
    sessionId: 'session-close',
  });
  expect(wrapper.find('.switcher-overlay').exists()).toBe(false);
});

test('activates tab successfully and closes frame', async () => {
  const tabs = [createTab({ id: 10, title: 'Active Tab' })];
  const sendMessage = vi.fn().mockImplementation((msg: { type: string }) => {
    if (msg.type === 'REQUEST_SWITCHER_DATA') {
      return Promise.resolve({ ok: true, tabs });
    }
    if (msg.type === 'ACTIVATE_TAB') {
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve();
  });
  const postParentMessage = vi.fn();

  const port: FrameAppPort = {
    getSessionId: () => 'session-act',
    sendMessage,
    postParentMessage,
  };

  const wrapper = mount(createFrameAppComponent(port));
  await nextTick();
  await nextTick();

  const tile = wrapper.find('.tab-tile');
  await tile.trigger('click');
  await nextTick();

  expect(sendMessage).toHaveBeenCalledWith({
    type: 'ACTIVATE_TAB',
    tabId: 10,
    sessionId: 'session-act',
  });
  expect(postParentMessage).toHaveBeenCalledWith({
    type: 'AVY_CLOSE_FRAME',
    sessionId: 'session-act',
  });
});

test('recovers from activation failure by removing stale tab and reopening', async () => {
  const tabs = [createTab({ id: 1, title: 'Stale Tab' }), createTab({ id: 2, title: 'Good Tab' })];
  const sendMessage = vi.fn().mockImplementation((msg: { type: string }) => {
    if (msg.type === 'REQUEST_SWITCHER_DATA') {
      return Promise.resolve({ ok: true, tabs });
    }
    if (msg.type === 'ACTIVATE_TAB') {
      return Promise.resolve({ ok: false, reason: 'tab-unavailable' });
    }
    return Promise.resolve();
  });
  const postParentMessage = vi.fn();

  const port: FrameAppPort = {
    getSessionId: () => 'session-rec',
    sendMessage,
    postParentMessage,
  };

  const wrapper = mount(createFrameAppComponent(port));
  await nextTick();
  await nextTick();

  expect(wrapper.findAll('.tab-tile')).toHaveLength(2);

  const firstTile = wrapper.findAll('.tab-tile')[0];
  await firstTile?.trigger('click');
  await nextTick();
  await nextTick();

  expect(wrapper.find('.switcher-overlay').exists()).toBe(true);
  const remainingTiles = wrapper.findAll('.tab-tile');
  expect(remainingTiles).toHaveLength(1);
  expect(remainingTiles[0]?.text()).toContain('Good Tab');
  expect(postParentMessage).not.toHaveBeenCalled();
});

test('recovers from activation rejection by removing stale tab and reopening', async () => {
  const tabs = [createTab({ id: 1, title: 'Bad Tab' })];
  const sendMessage = vi.fn().mockImplementation((msg: { type: string }) => {
    if (msg.type === 'REQUEST_SWITCHER_DATA') {
      return Promise.resolve({ ok: true, tabs });
    }
    if (msg.type === 'ACTIVATE_TAB') {
      return Promise.reject(new Error('Tab missing'));
    }
    return Promise.resolve();
  });
  const postParentMessage = vi.fn();

  const port: FrameAppPort = {
    getSessionId: () => 'session-rec-err',
    sendMessage,
    postParentMessage,
  };

  const wrapper = mount(createFrameAppComponent(port));
  await nextTick();
  await nextTick();

  const tile = wrapper.find('.tab-tile');
  await tile.trigger('click');
  await nextTick();
  await nextTick();

  expect(wrapper.find('.switcher-overlay').exists()).toBe(true);
  expect(wrapper.findAll('.tab-tile')).toHaveLength(0);
});

test('mountFrameApp mounts into container or selector', () => {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);

  const port: FrameAppPort = {
    getSessionId: () => '',
    sendMessage: vi.fn().mockResolvedValue({ ok: true }),
    postParentMessage: vi.fn(),
  };

  const app1 = mountFrameApp(container, port);
  expect(app1).not.toBeNull();
  app1?.unmount();

  const app2 = mountFrameApp('#test-container', port);
  expect(app2).not.toBeNull();
  app2?.unmount();

  const missingApp = mountFrameApp('#non-existent-id', port);
  expect(missingApp).toBeNull();

  container.remove();
});

test('defaultFrameAppPort reads sessionId and posts messages', () => {
  expect(typeof defaultFrameAppPort.getSessionId).toBe('function');
  expect(typeof defaultFrameAppPort.sendMessage).toBe('function');
  expect(typeof defaultFrameAppPort.postParentMessage).toBe('function');

  const postMessageSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
  const closeMsg: FrameCloseMessage = {
    type: 'AVY_CLOSE_FRAME',
    sessionId: 'sess-def',
  };
  defaultFrameAppPort.postParentMessage(closeMsg);
  expect(postMessageSpy).toHaveBeenCalledWith(closeMsg, '*');
  postMessageSpy.mockRestore();
});
