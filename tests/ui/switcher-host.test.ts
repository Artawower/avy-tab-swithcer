import { beforeEach, expect, test } from 'vitest';
import {
  createSwitcherHost,
  SWITCHER_HOST_ID,
} from '../../src/ui/switcher-host';

beforeEach(() => {
  const existing = document.getElementById(SWITCHER_HOST_ID);
  if (existing) {
    existing.remove();
  }
});

test('createSwitcherHost creates host under documentElement with open shadow root, style, and container', () => {
  const cssText = '.test-class { color: red; }';
  const container = createSwitcherHost(document, cssText);

  expect(container).not.toBeNull();
  if (!container) {
    throw new Error('Expected container to be non-null');
  }
  expect(container.className).toBe('switcher-container');

  const host = document.getElementById(SWITCHER_HOST_ID);
  expect(host).not.toBeNull();
  if (!host) {
    throw new Error('Expected host to be non-null');
  }
  expect(host.parentElement).toBe(document.documentElement);

  const shadow = host.shadowRoot;
  expect(shadow).not.toBeNull();
  if (!shadow) {
    throw new Error('Expected shadowRoot to be non-null');
  }
  expect(shadow.mode).toBe('open');

  const style = shadow.querySelector('style');
  expect(style).not.toBeNull();
  expect(style?.textContent).toBe(cssText);

  expect(shadow.contains(container)).toBe(true);
});

test('createSwitcherHost sets critical inline styles on host with important priority', () => {
  createSwitcherHost(document, '');
  const host = document.getElementById(SWITCHER_HOST_ID);

  expect(host).not.toBeNull();
  if (host) {
    expect(host.style.getPropertyValue('all')).toBe('initial');
    expect(host.style.getPropertyPriority('all')).toBe('important');

    expect(host.style.getPropertyValue('position')).toBe('fixed');
    expect(host.style.getPropertyPriority('position')).toBe('important');

    expect(host.style.getPropertyValue('inset')).toBe('0');
    expect(host.style.getPropertyPriority('inset')).toBe('important');

    expect(host.style.getPropertyValue('z-index')).toBe('2147483647');
    expect(host.style.getPropertyPriority('z-index')).toBe('important');

    expect(host.style.getPropertyValue('pointer-events')).toBe('none');
    expect(host.style.getPropertyPriority('pointer-events')).toBe('important');

    expect(host.style.getPropertyValue('background')).toBe('transparent');
    expect(host.style.getPropertyPriority('background')).toBe('important');
  }
});

test('createSwitcherHost is idempotent and returns null when host already exists', () => {
  const firstContainer = createSwitcherHost(document, 'body {}');
  expect(firstContainer).not.toBeNull();

  const secondContainer = createSwitcherHost(document, 'body {}');
  expect(secondContainer).toBeNull();

  const allHosts = document.querySelectorAll(`#${SWITCHER_HOST_ID}`);
  expect(allHosts).toHaveLength(1);
});
