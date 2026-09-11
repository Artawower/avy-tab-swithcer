export const SWITCHER_HOST_ID = 'avy-tab-switcher-root';

export function getDeepActiveElement(root: Document | ShadowRoot = document): Element | null {
  let current: Element | null = root.activeElement;
  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }
  return current;
}

export interface SwitcherHostController {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  readonly iframe: HTMLIFrameElement;
  open: (frameUrl: string) => void;
  close: () => void;
  isOpen: () => boolean;
  destroy: () => void;
}

export function createSwitcherHost(doc: Document = document): SwitcherHostController {
  const existing = doc.getElementById(SWITCHER_HOST_ID);
  if (existing) {
    const shadow = existing.shadowRoot;
    const iframe = shadow?.querySelector('iframe');
    if (shadow && iframe) {
      // Re-use existing singleton
      return getController(existing, shadow, iframe, doc);
    }
    existing.remove();
  }

  const host = doc.createElement('div');
  host.id = SWITCHER_HOST_ID;
  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('inset', '0', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');
  host.style.setProperty('pointer-events', 'none', 'important');
  host.style.setProperty('background', 'transparent', 'important');

  const shadow = host.attachShadow({ mode: 'open' });

  const iframe = doc.createElement('iframe');
  iframe.title = 'Avy Tab Switcher';
  iframe.style.setProperty('position', 'fixed', 'important');
  iframe.style.setProperty('inset', '0', 'important');
  iframe.style.setProperty('width', '100vw', 'important');
  iframe.style.setProperty('height', '100vh', 'important');
  iframe.style.setProperty('border', 'none', 'important');
  iframe.style.setProperty('background', 'transparent', 'important');
  iframe.style.setProperty('color-scheme', 'normal', 'important');
  iframe.style.setProperty('z-index', '2147483647', 'important');
  iframe.style.setProperty('display', 'none', 'important');
  iframe.style.setProperty('pointer-events', 'auto', 'important');

  shadow.appendChild(iframe);
  doc.documentElement.appendChild(host);

  return getController(host, shadow, iframe, doc);
}

function isSwitcherElement(
  element: Element,
  host: HTMLElement,
  shadow: ShadowRoot,
  iframe: HTMLIFrameElement,
): boolean {
  return (
    element === host || element === iframe || host.contains(element) || shadow.contains(element)
  );
}

function getController(
  host: HTMLElement,
  shadow: ShadowRoot,
  iframe: HTMLIFrameElement,
  doc: Document,
): SwitcherHostController {
  let isHostOpen = false;
  let priorFocusedElement: HTMLElement | SVGElement | null = null;
  let refocusTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRefocusTimer = (): void => {
    if (refocusTimer !== null) {
      clearTimeout(refocusTimer);
      refocusTimer = null;
    }
  };

  const reassertIframeFocus = (): void => {
    if (!isHostOpen) {
      return;
    }
    clearRefocusTimer();
    refocusTimer = setTimeout(() => {
      refocusTimer = null;
      if (!isHostOpen) {
        return;
      }
      if (typeof doc.hasFocus === 'function' && !doc.hasFocus()) {
        return;
      }
      if (doc.visibilityState && doc.visibilityState === 'hidden') {
        return;
      }
      const deep = getDeepActiveElement(doc);
      if (deep && isSwitcherElement(deep, host, shadow, iframe)) {
        return;
      }
      iframe.focus();
    }, 0);
  };

  const recordPriorFocus = (): void => {
    const deep = getDeepActiveElement(doc);
    if (deep instanceof HTMLElement || deep instanceof SVGElement) {
      if (!isSwitcherElement(deep, host, shadow, iframe)) {
        priorFocusedElement = deep;
      }
    }
  };

  const restorePriorFocus = (): void => {
    const target = priorFocusedElement;
    priorFocusedElement = null;

    if (!target || !target.isConnected) {
      return;
    }

    const currentDeep = getDeepActiveElement(doc);
    if (
      currentDeep &&
      currentDeep !== doc.body &&
      currentDeep !== target &&
      !isSwitcherElement(currentDeep, host, shadow, iframe)
    ) {
      return;
    }

    target.focus({ preventScroll: true });
  };

  iframe.addEventListener('load', () => {
    if (isHostOpen) {
      if (typeof doc.hasFocus === 'function' && !doc.hasFocus()) {
        return;
      }
      if (doc.visibilityState && doc.visibilityState === 'hidden') {
        return;
      }
      iframe.focus();
    }
  });

  iframe.addEventListener('blur', reassertIframeFocus);

  const handleDocFocusIn = (event: FocusEvent): void => {
    if (!isHostOpen) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && isSwitcherElement(target, host, shadow, iframe)) {
      return;
    }
    reassertIframeFocus();
  };

  doc.addEventListener('focusin', handleDocFocusIn, true);

  return {
    host,
    shadow,
    iframe,
    open(frameUrl: string): void {
      if (!isHostOpen) {
        recordPriorFocus();
      }
      isHostOpen = true;
      iframe.src = frameUrl;
      iframe.style.setProperty('display', 'block', 'important');
      iframe.focus();
    },
    close(): void {
      if (!isHostOpen) {
        return;
      }
      clearRefocusTimer();
      isHostOpen = false;
      iframe.style.setProperty('display', 'none', 'important');
      host.style.setProperty('pointer-events', 'none', 'important');
      iframe.blur();
      restorePriorFocus();
    },
    isOpen(): boolean {
      return isHostOpen;
    },
    destroy(): void {
      clearRefocusTimer();
      isHostOpen = false;
      iframe.removeEventListener('blur', reassertIframeFocus);
      doc.removeEventListener('focusin', handleDocFocusIn, true);
      iframe.style.setProperty('display', 'none', 'important');
      host.style.setProperty('pointer-events', 'none', 'important');
      iframe.blur();
      restorePriorFocus();
      host.remove();
    },
  };
}
