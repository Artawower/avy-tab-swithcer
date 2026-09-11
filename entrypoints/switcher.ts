import { browser } from 'wxt/browser';
import {
  isFrameCloseMessage,
  isFrameInitErrorMessage,
  isOpenSwitcherHostMessage,
} from '../src/application/messages';
import { createSwitcherHost } from '../src/ui/switcher-host';

export default defineUnlistedScript(() => {
  const controller = createSwitcherHost(document);
  let currentSessionId = '';

  const extensionOrigin = new URL(browser.runtime.getURL('')).origin;

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isOpenSwitcherHostMessage(message)) {
      currentSessionId = message.sessionId;
      controller.open(message.frameUrl);
    }
  });

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (event.origin !== extensionOrigin) {
      return;
    }

    if (event.source !== controller.iframe.contentWindow) {
      return;
    }

    if (isFrameCloseMessage(event.data)) {
      if (event.data.sessionId === currentSessionId) {
        controller.close();
      }
      return;
    }

    if (isFrameInitErrorMessage(event.data)) {
      controller.close();
    }
  });
});
