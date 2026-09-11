import { expect, test } from './fixtures';

test('Extension loads: MV3 service worker exists and manifest is Avy Tab Switcher', async ({
  serviceWorker,
}) => {
  expect(serviceWorker.url()).toContain('chrome-extension://');

  const manifest = await serviceWorker.evaluate(() => {
    return chrome.runtime.getManifest();
  });

  expect(manifest.name).toBe('Avy Tab Switcher');
});

test('Quick flow: displays MRU order, omits current tab, and clicking tile switches active browser tab', async ({
  context,
  openSwitcher,
  getActiveTabTitle,
}) => {
  // Create 5 tabs in the local HTTP server
  const page1 = context.pages()[0] ?? (await context.newPage());
  await page1.goto('http://localhost:3456/?title=Tab%201');

  const page2 = await context.newPage();
  await page2.goto('http://localhost:3456/?title=Tab%202');

  const page3 = await context.newPage();
  await page3.goto('http://localhost:3456/?title=Tab%203');

  const page4 = await context.newPage();
  await page4.goto('http://localhost:3456/?title=Tab%204');

  const page5 = await context.newPage();
  await page5.goto('http://localhost:3456/?title=Tab%205');

  // Bring tabs to front in deterministic order with small pauses so lastAccessed order is known:
  // Order of activation: 1 -> 2 -> 3 -> 4 -> 5
  // Current active tab will be Tab 5.
  // Expected MRU among remaining tabs: Tab 4 > Tab 3 > Tab 2 > Tab 1
  const pages = [page1, page2, page3, page4, page5];
  for (const page of pages) {
    await page.bringToFront();
    await page.waitForTimeout(100);
  }

  expect(await getActiveTabTitle()).toBe('Tab 5');

  // Open switcher on current active page (page5)
  await openSwitcher(page5);

  // Assert overlay renders inside / pierces open shadow root
  const overlay = page5.locator('.switcher-overlay');
  await expect(overlay).toBeVisible();

  // Assert current tab (Tab 5) is absent from displayed tiles
  const titles = await page5.locator('.tab-tile__title').allTextContents();
  expect(titles).not.toContain('Tab 5');

  // Assert visible tile titles reflect actual MRU order: Tab 4, Tab 3, Tab 2, Tab 1
  expect(titles).toEqual(['Tab 4', 'Tab 3', 'Tab 2', 'Tab 1']);

  // Assert first tile has selected state
  const tiles = page5.locator('.tab-tile');
  await expect(tiles.first()).toHaveClass(/tab-tile--selected/);

  // Click a visible tile (Tab 3)
  const targetTile = page5.locator('.tab-tile', { hasText: 'Tab 3' });
  await targetTile.click();

  // Assert old overlay hides first
  await expect(overlay).toBeHidden();

  // Assert real active browser tab changes to selected tab (poll tabs API)
  await expect.poll(async () => getActiveTabTitle()).toBe('Tab 3');
});

test('Search and close flow: searches beyond top 10 MRU, Enter activates, and close button hides overlay', async ({
  context,
  openSwitcher,
  getActiveTabTitle,
}) => {
  // Create an older target tab that will fall outside top 10 quick tabs
  const needlePage = context.pages()[0] ?? (await context.newPage());
  await needlePage.goto('http://localhost:3456/?title=Unique%20Needle%20Candidate');
  await needlePage.bringToFront();
  await needlePage.waitForTimeout(100);

  // Create 13 more tabs (Tab 1 to Tab 13) and activate them in order
  const otherPages = [];
  for (let i = 1; i <= 13; i++) {
    const page = await context.newPage();
    await page.goto(`http://localhost:3456/?title=Recent%20Tab%20${i}`);
    otherPages.push(page);
    await page.bringToFront();
    await page.waitForTimeout(60);
  }

  // Currently on Recent Tab 13.
  // The quick switcher only holds MAX_QUICK_TABS (10), so Recent Tab 12 down to Recent Tab 3 fill it.
  // "Unique Needle Candidate" and older tabs (Recent Tab 1 and 2) are outside the quick top 10.
  const activePage = otherPages[otherPages.length - 1];
  if (!activePage) {
    throw new Error('Expected active page to exist');
  }

  expect(await getActiveTabTitle()).toBe('Recent Tab 13');

  // Open switcher
  await openSwitcher(activePage);

  // Confirm quick mode caps at 10 and Unique Needle Candidate is not in the quick 10
  const initialTitles = await activePage.locator('.tab-tile__title').allTextContents();
  expect(initialTitles).not.toContain('Unique Needle Candidate');
  expect(initialTitles).toHaveLength(10);

  // Click search surface
  await activePage.locator('.switcher-search-surface').click();

  // Search common term matching >10 candidates (12 candidates excluding active Recent Tab 13)
  await activePage.locator('.switcher-search-input').fill('Recent');

  // Assert search mode renders all matching tabs (>10)
  const commonResults = activePage.locator('.tab-tile');
  await expect(commonResults).toHaveCount(12);

  // Fill unique title fragment
  await activePage.locator('.switcher-search-input').fill('Needle');

  // Assert same grid/surfaces remain and unique tile appears
  await expect(activePage.locator('.switcher-grid-surface')).toBeVisible();
  const searchResults = activePage.locator('.tab-tile');
  await expect(searchResults).toHaveCount(1);
  await expect(searchResults.first().locator('.tab-tile__title')).toContainText(
    'Unique Needle Candidate',
  );
  await expect(searchResults.first()).toHaveClass(/tab-tile--selected/);

  // Press Enter and assert real active tab changes
  await activePage.keyboard.press('Enter');
  await expect(activePage.locator('.switcher-overlay')).toBeHidden();
  await expect.poll(async () => getActiveTabTitle()).toBe('Unique Needle Candidate');

  // Reopen on current test page (needlePage)
  await openSwitcher(needlePage);
  await expect(needlePage.locator('.switcher-overlay')).toBeVisible();

  // Click close button
  await needlePage.locator('.switcher-close-btn').click();

  // Assert overlay content hides while host remains attached/reusable
  await expect(needlePage.locator('.switcher-overlay')).toBeHidden();
  await expect(needlePage.locator('#avy-tab-switcher-root')).toBeAttached();

  // Verify host remains reusable by opening and closing again
  await openSwitcher(needlePage);
  await expect(needlePage.locator('.switcher-overlay')).toBeVisible();
  await needlePage.locator('.switcher-close-btn').click();
  await expect(needlePage.locator('.switcher-overlay')).toBeHidden();
});
