import { expect, test } from './fixtures';

test('Recovery flow: reopens switcher and removes stale tile when target tab is unavailable', async ({
  context,
  openSwitcher,
  getActiveTabTitle,
}) => {
  // Use the initial context page as a normal localhost current page
  const currentPage = context.pages()[0] ?? (await context.newPage());
  await currentPage.goto('http://localhost:3456/?title=Current%20Page');

  // Create a second localhost tab titled clearly
  const targetPage = await context.newPage();
  await targetPage.goto('http://localhost:3456/?title=Vanishing%20Target');

  // Bring current page to front last and verify active tab
  await currentPage.bringToFront();
  expect(await getActiveTabTitle()).toBe('Current Page');

  // Open switcher and verify target tile is visible
  await openSwitcher(currentPage);
  const overlay = currentPage.locator('.switcher-overlay');
  await expect(overlay).toBeVisible();

  const targetTile = currentPage.locator('.tab-tile', { hasText: 'Vanishing Target' });
  await expect(targetTile).toBeVisible();

  // Close the target browser page AFTER the overlay has captured it
  await targetPage.close();

  // Click the now-stale target tile
  await targetTile.click();

  // Assert overlay reopens/remains visibly available
  await expect(overlay).toBeVisible();

  // Assert the stale target tile is removed
  await expect(currentPage.locator('.tab-tile', { hasText: 'Vanishing Target' })).toHaveCount(0);

  // Assert the active browser tab remains the current page
  expect(await getActiveTabTitle()).toBe('Current Page');
});
