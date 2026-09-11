import { expect, test } from './fixtures';

test('Recovery flow: reopens switcher and removes stale tile when target tab is unavailable', async ({
  context,
  openSwitcher,
  getActiveTabTitle,
}) => {
  const currentPage = context.pages()[0] ?? (await context.newPage());
  await currentPage.goto('http://localhost:3456/?title=Current%20Page');

  const targetPage = await context.newPage();
  await targetPage.goto('http://localhost:3456/?title=Vanishing%20Target');

  await currentPage.bringToFront();
  expect(await getActiveTabTitle()).toBe('Current Page');

  const frame = await openSwitcher(currentPage);
  const overlay = frame.locator('.switcher-overlay');
  await expect(overlay).toBeVisible();

  const targetTile = frame.locator('.tab-tile', { hasText: 'Vanishing Target' });
  await expect(targetTile).toBeVisible();

  await targetPage.close();

  await targetTile.click();

  await expect(overlay).toBeVisible();
  await expect(frame.locator('.tab-tile', { hasText: 'Vanishing Target' })).toHaveCount(0);
  expect(await getActiveTabTitle()).toBe('Current Page');
});
