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

  const pages = [page1, page2, page3, page4, page5];
  for (const page of pages) {
    await page.bringToFront();
    await page.waitForTimeout(100);
  }

  expect(await getActiveTabTitle()).toBe('Tab 5');

  const frame = await openSwitcher(page5);
  const overlay = frame.locator('.switcher-overlay');
  await expect(overlay).toBeVisible();

  const titles = await frame.locator('.tab-tile__title').allTextContents();
  expect(titles).not.toContain('Tab 5');
  expect(titles).toEqual(['Tab 4', 'Tab 3', 'Tab 2', 'Tab 1']);

  const tiles = frame.locator('.tab-tile');
  await expect(tiles.first()).toHaveClass(/tab-tile--selected/);

  const targetTile = frame.locator('.tab-tile', { hasText: 'Tab 3' });
  await targetTile.click();

  await expect(overlay).toBeHidden();
  await expect.poll(async () => getActiveTabTitle()).toBe('Tab 3');
});

test('Search and close flow: searches beyond top 10 MRU, Enter activates, and close button hides overlay', async ({
  context,
  openSwitcher,
  getActiveTabTitle,
}) => {
  const needlePage = context.pages()[0] ?? (await context.newPage());
  await needlePage.goto('http://localhost:3456/?title=Unique%20Needle%20Candidate');
  await needlePage.bringToFront();
  await needlePage.waitForTimeout(100);

  const otherPages = [];
  for (let i = 1; i <= 13; i++) {
    const page = await context.newPage();
    await page.goto(`http://localhost:3456/?title=Recent%20Tab%20${i}`);
    otherPages.push(page);
    await page.bringToFront();
    await page.waitForTimeout(60);
  }

  const activePage = otherPages[otherPages.length - 1];
  if (!activePage) {
    throw new Error('Expected active page to exist');
  }

  expect(await getActiveTabTitle()).toBe('Recent Tab 13');

  const frame = await openSwitcher(activePage);

  const initialTitles = await frame.locator('.tab-tile__title').allTextContents();
  expect(initialTitles).not.toContain('Unique Needle Candidate');
  expect(initialTitles).toHaveLength(10);

  await frame.locator('.switcher-search-surface').click();
  await frame.locator('.switcher-search-input').fill('Recent');

  const commonResults = frame.locator('.tab-tile');
  await expect(commonResults).toHaveCount(12);

  await frame.locator('.switcher-search-input').fill('Needle');

  await expect(frame.locator('.switcher-grid-surface')).toBeVisible();
  const searchResults = frame.locator('.tab-tile');
  await expect(searchResults).toHaveCount(1);
  await expect(searchResults.first().locator('.tab-tile__title')).toContainText(
    'Unique Needle Candidate',
  );
  await expect(searchResults.first()).toHaveClass(/tab-tile--selected/);

  await activePage.keyboard.press('Enter');
  await expect(frame.locator('.switcher-overlay')).toBeHidden();
  await expect.poll(async () => getActiveTabTitle()).toBe('Unique Needle Candidate');

  const reopenFrame = await openSwitcher(needlePage);
  await expect(reopenFrame.locator('.switcher-overlay')).toBeVisible();

  await reopenFrame.locator('.switcher-close-btn').click();
  await expect(needlePage.locator('#avy-tab-switcher-root iframe')).toBeHidden();
  await expect(needlePage.locator('#avy-tab-switcher-root')).toBeAttached();

  const secondReopenFrame = await openSwitcher(needlePage);
  await expect(secondReopenFrame.locator('.switcher-overlay')).toBeVisible();
  await secondReopenFrame.locator('.switcher-close-btn').click();
  await expect(needlePage.locator('#avy-tab-switcher-root iframe')).toBeHidden();
});

test('Backdrop close: clicking outside surfaces closes overlay and restores host focus; inner clicks do not close', async ({
  context,
  openSwitcher,
}) => {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('http://localhost:3456/?title=Backdrop%20Host%20Page');

  const otherPage = await context.newPage();
  await otherPage.goto('http://localhost:3456/?title=Other%20Tab');
  await otherPage.waitForTimeout(60);

  await page.bringToFront();
  await page.waitForTimeout(60);

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'host-prior-input';
    document.body.appendChild(input);
  });

  const hostInput = page.locator('#host-prior-input');
  await hostInput.focus();
  await expect(hostInput).toBeFocused();

  const frame = await openSwitcher(page);
  const overlay = frame.locator('.switcher-overlay');
  await expect(overlay).toBeVisible();

  // Click a safe outside point on .switcher-overlay
  await overlay.click({ position: { x: 20, y: 20 } });

  // Assert iframe is hidden and prior input focus restored
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeHidden();
  await expect(hostInput).toBeFocused();

  // Reopen
  const reopenedFrame = await openSwitcher(page);
  const reopenedOverlay = reopenedFrame.locator('.switcher-overlay');
  await expect(reopenedOverlay).toBeVisible();

  // Verify clicks within search surface do not close
  await reopenedFrame.locator('.switcher-search-surface').click();
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeVisible();

  // Verify clicks within results shell do not close
  await reopenedFrame.locator('.switcher-grid-surface').click({ position: { x: 4, y: 4 } });
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeVisible();

  // Verify clicks within scroll viewport do not close
  await reopenedFrame.locator('.switcher-grid-viewport').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeVisible();

  // Existing close button behavior must remain
  await reopenedFrame.locator('.switcher-close-btn').click();
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeHidden();

  // Reopen and verify tile activation still works
  const tileFrame = await openSwitcher(page);
  await expect(tileFrame.locator('.switcher-overlay')).toBeVisible();
  const firstTile = tileFrame.locator('.tab-tile').first();
  await firstTile.click();
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeHidden();
});
