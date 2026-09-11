import { createApp, defineComponent, h, ref } from 'vue';
import { browser } from 'wxt/browser';
import { isActivateTabResult, isOpenSwitcherMessage } from '../src/application/messages';
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
            const recover = (): void => {
              tabs.value = tabs.value.filter((tab) => tab.id !== tabId);
              open.value = true;
            };

            browser.runtime
              .sendMessage({
                type: 'ACTIVATE_TAB',
                tabId,
              })
              .then((response: unknown) => {
                if (!isActivateTabResult(response) || !response.ok) {
                  recover();
                }
              })
              .catch((err: unknown) => {
                console.error('[Avy] Unexpected error activating tab:', err);
                recover();
              });
          },
        });
    },
  });

  const app = createApp(App);
  app.mount(container);
});
