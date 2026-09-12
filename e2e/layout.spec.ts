import { expect, test } from './fixtures';

interface ElementVisualStyles {
  readonly borderStyle: string;
  readonly borderWidth: string;
  readonly borderColor: string;
  readonly boxShadow: string;
  readonly backgroundColor: string;
  readonly backgroundImage: string;
  readonly transform: string;
}

function assertSurfaceStyles(styles: ElementVisualStyles): void {
  expect(styles.borderStyle).toBe('solid');
  expect(styles.borderWidth).toBe('1px');
  expect(styles.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(styles.borderColor).not.toBe('transparent');
  expect(styles.boxShadow).not.toBe('none');
  expect(styles.boxShadow).toContain('inset');
  expect(styles.backgroundImage).not.toBe('none');
  expect(styles.backgroundImage).toContain('gradient');
}

test('Layout stability: search and close heights are equal (48px), panel height is invariant across filter counts, shell is overflow hidden, and viewport handles inset scrolling', async ({
  context,
  openSwitcher,
}) => {
  const currentPage = context.pages()[0] ?? (await context.newPage());
  await currentPage.goto('http://localhost:3456/?title=Active%20Tab');

  for (let i = 1; i <= 14; i++) {
    const page = await context.newPage();
    await page.goto(`http://localhost:3456/?title=Tab%20${i}`);
  }

  await currentPage.bringToFront();

  const frame = await openSwitcher(currentPage);
  const overlay = frame.locator('.switcher-overlay');
  await expect(overlay).toBeVisible();

  const searchSurface = frame.locator('.switcher-search-surface');
  const closeBtn = frame.locator('.switcher-close-btn');
  const gridSurface = frame.locator('.switcher-grid-surface');
  const gridViewport = frame.locator('.switcher-grid-viewport');
  const searchInput = frame.locator('.switcher-search-input');

  const searchBox = await searchSurface.boundingBox();
  const closeBox = await closeBtn.boundingBox();
  expect(searchBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  if (searchBox && closeBox) {
    expect(Math.round(searchBox.height)).toBe(Math.round(closeBox.height));
    expect(Math.round(searchBox.height)).toBe(48);
    expect(Math.round(closeBox.width)).toBe(48);
  }

  const shellStyles = await gridSurface.evaluate((el: HTMLElement) => {
    const cs = window.getComputedStyle(el);
    return {
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
    };
  });
  expect(shellStyles.overflowX).toBe('hidden');
  expect(shellStyles.overflowY).toBe('hidden');
  expect(shellStyles.paddingTop).toBe('8px');
  expect(shellStyles.paddingRight).toBe('8px');
  expect(shellStyles.paddingBottom).toBe('8px');
  expect(shellStyles.paddingLeft).toBe('8px');

  await expect(gridViewport).toBeVisible();
  const viewportStyles = await gridViewport.evaluate((el: HTMLElement) => {
    const cs = window.getComputedStyle(el);
    return {
      overflowY: cs.overflowY,
      overscrollBehaviorY: cs.overscrollBehaviorY,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
    };
  });
  expect(['auto', 'scroll']).toContain(viewportStyles.overflowY);
  expect(viewportStyles.overscrollBehaviorY).toBe('contain');
  expect(viewportStyles.paddingTop).toBe('20px');
  expect(viewportStyles.paddingRight).toBe('20px');
  expect(viewportStyles.paddingBottom).toBe('20px');
  expect(viewportStyles.paddingLeft).toBe('20px');

  const initialGridBox = await gridSurface.boundingBox();
  const initialViewportBox = await gridViewport.boundingBox();
  expect(initialGridBox).not.toBeNull();
  expect(initialViewportBox).not.toBeNull();
  if (initialGridBox && initialViewportBox) {
    expect(initialViewportBox.y).toBeGreaterThanOrEqual(initialGridBox.y + 7.5);
    expect(initialViewportBox.x).toBeGreaterThanOrEqual(initialGridBox.x + 7.5);
    expect(initialViewportBox.y + initialViewportBox.height).toBeLessThanOrEqual(
      initialGridBox.y + initialGridBox.height - 7.5,
    );
    expect(initialViewportBox.x + initialViewportBox.width).toBeLessThanOrEqual(
      initialGridBox.x + initialGridBox.width - 7.5,
    );
  }

  const expectedHeight = initialGridBox ? Math.round(initialGridBox.height) : 0;
  expect(expectedHeight).toBeGreaterThan(0);

  await searchSurface.click();
  await searchInput.fill('Tab');
  await expect(frame.locator('.tab-tile')).toHaveCount(14);

  const manyBox = await gridSurface.boundingBox();
  expect(manyBox).not.toBeNull();
  if (manyBox) {
    expect(Math.round(manyBox.height)).toBe(expectedHeight);
  }

  const initialPageScrollY = await currentPage.evaluate(() => window.scrollY);
  const scrolledTop = await gridViewport.evaluate((el: HTMLElement) => {
    el.scrollTop = 60;
    return el.scrollTop;
  });
  expect(scrolledTop).toBeGreaterThan(0);

  const pageScrollAfterInternalScroll = await currentPage.evaluate(() => window.scrollY);
  expect(pageScrollAfterInternalScroll).toBe(initialPageScrollY);

  await gridViewport.hover();
  await currentPage.mouse.wheel(0, 40);
  const pageScrollAfterWheel = await currentPage.evaluate(() => window.scrollY);
  expect(pageScrollAfterWheel).toBe(initialPageScrollY);

  await gridViewport.evaluate((el: HTMLElement) => {
    el.scrollTop = 0;
  });
  await currentPage.keyboard.press('ArrowDown');
  await currentPage.keyboard.press('ArrowDown');
  const scrollAfterDown = await gridViewport.evaluate((el: HTMLElement) => el.scrollTop);
  expect(scrollAfterDown).toBeGreaterThan(0);

  await searchInput.fill('Tab 14');
  await expect(frame.locator('.tab-tile')).toHaveCount(1);

  const oneBox = await gridSurface.boundingBox();
  expect(oneBox).not.toBeNull();
  if (oneBox) {
    expect(Math.round(oneBox.height)).toBe(expectedHeight);
  }

  await searchInput.fill('nomatchtokenxyz');
  await expect(frame.locator('.switcher-empty')).toBeVisible();

  const zeroBox = await gridSurface.boundingBox();
  expect(zeroBox).not.toBeNull();
  if (zeroBox) {
    expect(Math.round(zeroBox.height)).toBe(expectedHeight);
  }
});

test('Visual styling and material: non-transparent borders, multi-layer shadows with inner highlight, selected tile contrast, and dark mode adaptation', async ({
  context,
  openSwitcher,
}, testInfo) => {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://localhost:3456/?title=Active%20Tab');

  for (let i = 1; i <= 6; i++) {
    const p = await context.newPage();
    await p.goto(`http://localhost:3456/?title=Tab%20${i}`);
  }
  await page.bringToFront();

  await page.emulateMedia({ colorScheme: 'light' });
  let frame = await openSwitcher(page);
  await expect(frame.locator('.switcher-overlay')).toBeVisible();

  const closeBtn = frame.locator('.switcher-close-btn');

  const lightScreenshotPath = testInfo.outputPath('post-change-light.png');
  await page.screenshot({ path: lightScreenshotPath });
  await testInfo.attach('post-change-light', {
    path: lightScreenshotPath,
    contentType: 'image/png',
  });

  const lightStyles = await frame.locator('.switcher-overlay').evaluate(() => {
    const searchEl = document.querySelector('.switcher-search-surface');
    const closeEl = document.querySelector('.switcher-close-btn');
    const gridEl = document.querySelector('.switcher-grid-surface');
    const selEl = document.querySelector('.tab-tile--selected');
    const unselEl = document.querySelector('.tab-tile:not(.tab-tile--selected)');

    const inspect = (el: Element | null) => {
      if (!el) {
        return null;
      }
      const cs = window.getComputedStyle(el);
      return {
        borderStyle: cs.borderTopStyle,
        borderWidth: cs.borderTopWidth,
        borderColor: cs.borderTopColor,
        boxShadow: cs.boxShadow,
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        transform: cs.transform,
      };
    };

    return {
      search: inspect(searchEl),
      close: inspect(closeEl),
      grid: inspect(gridEl),
      selected: inspect(selEl),
      unselected: inspect(unselEl),
    };
  });

  expect(lightStyles.search).not.toBeNull();
  expect(lightStyles.close).not.toBeNull();
  expect(lightStyles.grid).not.toBeNull();
  expect(lightStyles.selected).not.toBeNull();
  expect(lightStyles.unselected).not.toBeNull();

  if (
    lightStyles.search &&
    lightStyles.close &&
    lightStyles.grid &&
    lightStyles.selected &&
    lightStyles.unselected
  ) {
    assertSurfaceStyles(lightStyles.search);
    assertSurfaceStyles(lightStyles.close);
    assertSurfaceStyles(lightStyles.grid);

    expect(lightStyles.selected.borderStyle).toBe('solid');
    expect(lightStyles.selected.borderWidth).toBe('1px');
    expect(lightStyles.selected.borderColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(lightStyles.selected.borderColor).not.toBe(lightStyles.unselected.borderColor);
    expect(lightStyles.selected.boxShadow).not.toBe('none');
    expect(lightStyles.selected.boxShadow).toContain('inset');
    expect(lightStyles.selected.backgroundImage).not.toBe('none');
    expect(lightStyles.selected.backgroundImage).toContain('gradient');
    expect(lightStyles.selected.backgroundColor).not.toBe(lightStyles.unselected.backgroundColor);
    expect(lightStyles.selected.transform).not.toBe('none');
  }

  await closeBtn.click();
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeHidden();

  await page.emulateMedia({ colorScheme: 'dark' });
  frame = await openSwitcher(page);
  await expect(frame.locator('.switcher-overlay')).toBeVisible();

  const darkScreenshotPath = testInfo.outputPath('post-change-dark.png');
  await page.screenshot({ path: darkScreenshotPath });
  await testInfo.attach('post-change-dark', {
    path: darkScreenshotPath,
    contentType: 'image/png',
  });

  const darkStyles = await frame.locator('.switcher-overlay').evaluate(() => {
    const searchEl = document.querySelector('.switcher-search-surface');
    const closeEl = document.querySelector('.switcher-close-btn');
    const gridEl = document.querySelector('.switcher-grid-surface');
    const selEl = document.querySelector('.tab-tile--selected');
    const unselEl = document.querySelector('.tab-tile:not(.tab-tile--selected)');

    const inspect = (el: Element | null) => {
      if (!el) {
        return null;
      }
      const cs = window.getComputedStyle(el);
      return {
        borderStyle: cs.borderTopStyle,
        borderWidth: cs.borderTopWidth,
        borderColor: cs.borderTopColor,
        boxShadow: cs.boxShadow,
        backgroundColor: cs.backgroundColor,
        backgroundImage: cs.backgroundImage,
        transform: cs.transform,
      };
    };

    return {
      search: inspect(searchEl),
      close: inspect(closeEl),
      grid: inspect(gridEl),
      selected: inspect(selEl),
      unselected: inspect(unselEl),
    };
  });

  expect(darkStyles.search).not.toBeNull();
  expect(darkStyles.close).not.toBeNull();
  expect(darkStyles.grid).not.toBeNull();
  expect(darkStyles.selected).not.toBeNull();

  if (
    darkStyles.search &&
    darkStyles.close &&
    darkStyles.grid &&
    darkStyles.selected &&
    lightStyles.search &&
    lightStyles.close &&
    lightStyles.grid &&
    lightStyles.selected
  ) {
    assertSurfaceStyles(darkStyles.search);
    assertSurfaceStyles(darkStyles.close);
    assertSurfaceStyles(darkStyles.grid);

    expect(darkStyles.close.borderColor).not.toBe(lightStyles.close.borderColor);
    expect(darkStyles.close.backgroundColor).not.toBe(lightStyles.close.backgroundColor);

    expect(darkStyles.grid.borderColor).not.toBe(lightStyles.grid.borderColor);
    expect(darkStyles.grid.backgroundColor).not.toBe(lightStyles.grid.backgroundColor);

    expect(darkStyles.search.borderColor).not.toBe(lightStyles.search.borderColor);
    expect(darkStyles.search.backgroundColor).not.toBe(lightStyles.search.backgroundColor);

    expect(darkStyles.selected.borderStyle).toBe('solid');
    expect(darkStyles.selected.borderWidth).toBe('1px');
    expect(darkStyles.selected.borderColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(darkStyles.selected.boxShadow).not.toBe('none');
    expect(darkStyles.selected.backgroundImage).not.toBe('none');
    expect(darkStyles.selected.backgroundImage).toContain('gradient');
    expect(darkStyles.selected.backgroundColor).not.toBe(lightStyles.selected.backgroundColor);
  }
});

test('Themed pages: iframe and embedded document use the page color scheme for a transparent canvas', async ({
  context,
  openSwitcher,
}) => {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('http://localhost:3456/?title=Themed%20Host');

  const otherPage = await context.newPage();
  await otherPage.goto('http://localhost:3456/?title=Other%20Tab');
  await page.bringToFront();

  await page.evaluate(() => {
    document.documentElement.style.colorScheme = 'dark';
  });

  const frame = await openSwitcher(page);
  const iframeColorScheme = await page
    .locator('#avy-tab-switcher-root iframe')
    .evaluate((iframe) => window.getComputedStyle(iframe).colorScheme);
  const frameStyles = await frame.locator('html').evaluate((root) => {
    const styles = window.getComputedStyle(root);
    return {
      backgroundColor: styles.backgroundColor,
      colorScheme: styles.colorScheme,
    };
  });

  expect(iframeColorScheme).toBe('dark');
  expect(frameStyles.colorScheme).toBe('dark');
  expect(frameStyles.backgroundColor).toBe('rgba(0, 0, 0, 0)');
});
