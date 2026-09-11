import type { SwitchableTab } from '../../src/domain/tab';

export function createTab(overrides: Partial<SwitchableTab> = {}): SwitchableTab {
  return {
    id: 1,
    windowId: 1,
    title: 'Example Tab',
    url: 'https://example.com',
    hostname: 'example.com',
    faviconUrl: null,
    lastAccessed: null,
    ...overrides,
  };
}
