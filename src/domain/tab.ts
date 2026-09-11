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
