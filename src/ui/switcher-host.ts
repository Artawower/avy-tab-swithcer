export const SWITCHER_HOST_ID = 'avy-tab-switcher-root';

export function createSwitcherHost(
  document: Document,
  cssText: string,
): HTMLElement | null {
  if (document.getElementById(SWITCHER_HOST_ID)) {
    return null;
  }

  const host = document.createElement('div');
  host.id = SWITCHER_HOST_ID;

  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('inset', '0', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');
  host.style.setProperty('pointer-events', 'none', 'important');
  host.style.setProperty('background', 'transparent', 'important');

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = cssText;
  shadow.appendChild(style);

  const container = document.createElement('div');
  container.className = 'switcher-container';
  shadow.appendChild(container);

  document.documentElement.appendChild(host);

  return container;
}
