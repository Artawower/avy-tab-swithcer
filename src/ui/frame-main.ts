import {
  createApp,
  defineComponent,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  type App as VueApp,
} from 'vue';
import { browser } from 'wxt/browser';
import {
  isActivateTabResult,
  isHeartbeatSwitcherSessionResult,
  isRequestSwitcherDataResult,
  type FrameCloseMessage,
  type FrameToParentMessage,
  type RequestSwitcherDataMessage,
} from '../application/messages';
import type { SwitchableTab } from '../domain/tab';
import Switcher from './Switcher.vue';
import './switcher.css';

export interface FrameAppPort {
  readonly getSessionId: () => string;
  readonly sendMessage: (message: unknown) => Promise<unknown>;
  readonly postParentMessage: (message: FrameToParentMessage) => void;
}

export const defaultFrameAppPort: FrameAppPort = {
  getSessionId: (): string => new URLSearchParams(window.location.search).get('sessionId') ?? '',
  sendMessage: (message: unknown): Promise<unknown> => browser.runtime.sendMessage(message),
  postParentMessage: (message: FrameToParentMessage): void => {
    window.parent.postMessage(message, '*');
  },
};

export const HEARTBEAT_INTERVAL_MS = 15_000;

export function applyFrameColorScheme(root: HTMLElement, search: string): void {
  const colorScheme = new URLSearchParams(search).get('colorScheme');
  if (colorScheme) {
    root.style.setProperty('color-scheme', colorScheme);
  }
}

export function createFrameAppComponent(port: FrameAppPort = defaultFrameAppPort) {
  return defineComponent({
    name: 'AvyFrameApp',
    setup() {
      const sessionId = port.getSessionId();
      const open = ref(false);
      const tabs = ref<readonly SwitchableTab[]>([]);
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const stopHeartbeat = (): void => {
        if (heartbeatTimer !== null) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      };

      const notifyClose = (): void => {
        stopHeartbeat();
        open.value = false;
        if (sessionId) {
          const message: FrameCloseMessage = {
            type: 'AVY_CLOSE_FRAME',
            sessionId,
          };
          port.postParentMessage(message);
          port
            .sendMessage({
              type: 'CLOSE_SWITCHER_SESSION',
              sessionId,
            })
            .catch(() => {});
        } else {
          port.postParentMessage({
            type: 'AVY_FRAME_INIT_FAILED',
          });
        }
      };

      const startHeartbeat = (): void => {
        stopHeartbeat();
        heartbeatTimer = setInterval(() => {
          if (!open.value || !sessionId) {
            stopHeartbeat();
            return;
          }
          port
            .sendMessage({
              type: 'HEARTBEAT_SWITCHER_SESSION',
              sessionId,
            })
            .then((response: unknown) => {
              if (!isHeartbeatSwitcherSessionResult(response) || !response.ok) {
                stopHeartbeat();
                notifyClose();
              }
            })
            .catch(() => {
              stopHeartbeat();
              notifyClose();
            });
        }, HEARTBEAT_INTERVAL_MS);
      };

      onMounted(() => {
        if (!sessionId) {
          notifyClose();
          return;
        }

        const requestMsg: RequestSwitcherDataMessage = {
          type: 'REQUEST_SWITCHER_DATA',
          sessionId,
        };

        port
          .sendMessage(requestMsg)
          .then((response: unknown) => {
            if (isRequestSwitcherDataResult(response) && response.ok) {
              tabs.value = response.tabs;
              open.value = true;
              startHeartbeat();
              void nextTick(() => {
                window.focus();
              });
            } else {
              notifyClose();
            }
          })
          .catch(() => {
            notifyClose();
          });
      });

      onUnmounted(() => {
        stopHeartbeat();
      });

      const handleActivate = (tabId: number): void => {
        open.value = false;
        stopHeartbeat();

        const recover = (): void => {
          tabs.value = tabs.value.filter((tab) => tab.id !== tabId);
          open.value = true;
          startHeartbeat();
          void nextTick(() => {
            window.focus();
          });
        };

        port
          .sendMessage({
            type: 'ACTIVATE_TAB',
            tabId,
            sessionId,
          })
          .then((response: unknown) => {
            if (isActivateTabResult(response) && response.ok) {
              notifyClose();
            } else {
              recover();
            }
          })
          .catch(() => {
            recover();
          });
      };

      return () =>
        h(Switcher, {
          open: open.value,
          tabs: tabs.value,
          onClose: notifyClose,
          onActivate: handleActivate,
        });
    },
  });
}

export function mountFrameApp(
  container: HTMLElement | string = '#app',
  port: FrameAppPort = defaultFrameAppPort,
): VueApp | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const target = typeof container === 'string' ? document.querySelector(container) : container;
  if (!target) {
    return null;
  }
  const app = createApp(createFrameAppComponent(port));
  app.mount(target);
  return app;
}

if (typeof document !== 'undefined' && document.getElementById('app')) {
  applyFrameColorScheme(document.documentElement, window.location.search);
  mountFrameApp('#app');
}
