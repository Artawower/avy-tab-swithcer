import { expect, test } from 'vitest';
import {
  createSwitcherHost,
  getDeepActiveElement,
  SWITCHER_HOST_ID,
} from '../../src/ui/switcher-host';

test('creates singleton host with open shadow root, title, and hidden iframe', () => {
  const controller = createSwitcherHost(document);
  try {
    expect(controller.host.id).toBe(SWITCHER_HOST_ID);
    expect(controller.shadow).toBe(controller.host.shadowRoot);
    expect(controller.iframe.parentNode).toBe(controller.shadow);
    expect(controller.iframe.title).toBe('Avy Tab Switcher');
    expect(controller.isOpen()).toBe(false);

    const secondController = createSwitcherHost(document);
    expect(secondController.host).toBe(controller.host);
    expect(secondController.iframe).toBe(controller.iframe);
  } finally {
    controller.destroy();
  }
});

test('propagates the page color scheme to the iframe element and URL', () => {
  const rootStyle = document.documentElement.style;
  const previousColorScheme = rootStyle.getPropertyValue('color-scheme');
  const previousPriority = rootStyle.getPropertyPriority('color-scheme');
  rootStyle.setProperty('color-scheme', 'dark');

  const controller = createSwitcherHost(document);
  try {
    controller.open('about:blank?sessionId=session-themed');

    expect(controller.iframe.style.getPropertyValue('color-scheme')).toBe('dark');
    expect(new URL(controller.iframe.src).searchParams.get('colorScheme')).toBe('dark');
  } finally {
    controller.destroy();
    rootStyle.setProperty('color-scheme', previousColorScheme, previousPriority);
  }
});

test('open shows and focuses iframe; close hides iframe and restores prior page focus', () => {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();
  expect(document.activeElement).toBe(input);

  const controller = createSwitcherHost(document);
  try {
    controller.open('about:blank?sessionId=session-1');
    expect(controller.isOpen()).toBe(true);
    expect(controller.iframe.style.display).toBe('block');
    const frameUrl = new URL(controller.iframe.src);
    expect(frameUrl.searchParams.get('sessionId')).toBe('session-1');
    expect(frameUrl.searchParams.get('colorScheme')).toBe('normal');

    controller.close();
    expect(controller.isOpen()).toBe(false);
    expect(controller.iframe.style.display).toBe('none');
    expect(document.activeElement).toBe(input);
  } finally {
    controller.destroy();
    input.remove();
  }
});

test('destroy cleans up listeners, restores prior focus when open, and removes host', () => {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();
  expect(document.activeElement).toBe(input);

  const controller = createSwitcherHost(document);
  controller.open('about:blank?sessionId=session-destroy');
  expect(controller.isOpen()).toBe(true);

  controller.destroy();
  expect(controller.isOpen()).toBe(false);
  expect(document.getElementById(SWITCHER_HOST_ID)).toBeNull();
  expect(document.activeElement).toBe(input);

  input.remove();
});

test('preserves deliberate focus shift to another page element on close', () => {
  const inputA = document.createElement('input');
  const inputB = document.createElement('input');
  document.body.appendChild(inputA);
  document.body.appendChild(inputB);
  inputA.focus();
  expect(document.activeElement).toBe(inputA);

  const controller = createSwitcherHost(document);
  try {
    controller.open('about:blank?sessionId=session-1');

    inputB.focus();
    expect(document.activeElement).toBe(inputB);

    controller.close();
    expect(document.activeElement).toBe(inputB);
  } finally {
    controller.destroy();
    inputA.remove();
    inputB.remove();
  }
});

test('handles disconnected prior focus element safely', () => {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();

  const controller = createSwitcherHost(document);
  try {
    controller.open('about:blank?sessionId=session-1');
    input.remove();

    expect(() => controller.close()).not.toThrow();
    expect(document.activeElement).not.toBe(input);
  } finally {
    controller.destroy();
  }
});

test('preserves and restores deep active element inside shadow root', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const innerInput = document.createElement('input');
  shadow.appendChild(innerInput);
  innerInput.focus();

  expect(getDeepActiveElement(document)).toBe(innerInput);

  const controller = createSwitcherHost(document);
  try {
    controller.open('about:blank?sessionId=session-1');
    controller.close();

    expect(shadow.activeElement).toBe(innerInput);
  } finally {
    controller.destroy();
    host.remove();
  }
});

test('reasserts iframe focus when iframe blurs while host is open and document has focus', async () => {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();

  const controller = createSwitcherHost(document);
  try {
    controller.open('about:blank?sessionId=session-focus');
    expect(controller.isOpen()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const originalHasFocus = document.hasFocus.bind(document);
    document.hasFocus = () => true;

    try {
      input.focus();
      controller.iframe.dispatchEvent(new Event('blur'));

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(
        document.activeElement === controller.iframe ||
          controller.shadow.activeElement === controller.iframe,
      ).toBe(true);
    } finally {
      document.hasFocus = originalHasFocus;
    }
  } finally {
    controller.destroy();
    input.remove();
  }
});

test('does not reassert iframe focus if document does not have focus', async () => {
  const input = document.createElement('input');
  document.body.appendChild(input);

  const controller = createSwitcherHost(document);
  try {
    controller.open('about:blank?sessionId=session-no-focus');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const originalHasFocus = document.hasFocus.bind(document);
    document.hasFocus = () => false;

    try {
      input.focus();
      controller.iframe.dispatchEvent(new Event('blur'));

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(document.activeElement).toBe(input);
    } finally {
      document.hasFocus = originalHasFocus;
    }
  } finally {
    controller.destroy();
    input.remove();
  }
});
