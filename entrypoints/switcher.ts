import { createApp, defineComponent, h, ref } from 'vue';
import { browser } from 'wxt/browser';
import { isOpenSwitcherMessage } from '../src/application/messages';
import type { SwitchableTab } from '../src/domain/tab';
import Switcher from '../src/ui/Switcher.vue';
import { createSwitcherHost } from '../src/ui/switcher-host';
import switcherCss from '../src/ui/switcher.css?inline';

export default defineUnlistedScript(() => {
  const container = createSwitcherHost(document, switcherCss);
  if (!container) {
    return;
  }

  const open = ref(false);
  const tabs = ref<readonly SwitchableTab[]>([]);

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isOpenSwitcherMessage(message)) {
      tabs.value = message.tabs;
      open.value = true;
    }
  });

  const App = defineComponent({
    setup() {
      return () =>
        h(Switcher, {
          open: open.value,
          tabs: tabs.value,
          onClose: () => {
            open.value = false;
          },
          onActivate: (tabId: number) => {
            open.value = false;
            browser.runtime
              .sendMessage({
                type: 'ACTIVATE_TAB',
                tabId,
              })
              .catch((err: unknown) => {
                console.error('[Avy] Activation error:', err);
              });
          },
        });
    },
  });

  const app = createApp(App);
  app.mount(container);
});
