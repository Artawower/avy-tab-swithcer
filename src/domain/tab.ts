export const MAX_QUICK_TABS = 10;

export interface SwitchableTab {
  readonly id: number;
  readonly windowId: number;
  readonly title: string;
  readonly url: string;
  readonly hostname: string;
  readonly faviconUrl: string | null;
  readonly lastAccessed: number | null;
}

export function getTabLabel(tab: SwitchableTab): string {
  const trimmedTitle = tab.title.trim();
  if (trimmedTitle.length > 0) {
    return trimmedTitle;
  }
  const trimmedHostname = tab.hostname.trim();
  if (trimmedHostname.length > 0) {
    return trimmedHostname;
  }
  return 'Untitled tab';
}
