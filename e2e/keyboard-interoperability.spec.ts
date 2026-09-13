import { expect, test } from './fixtures';

declare global {
  interface Window {
    __topWindowKeyLog?: string[];
  }
}

test('Keyboard interoperability: isolated frame intercepts keystrokes, cancels long-hold release, and activates with lowercase and uppercase mnemonics', async ({
  context,
  openSwitcher,
  getActiveTabTitle,
}) => {
  const currentPage = context.pages()[0] ?? (await context.newPage());
  await currentPage.goto('http://localhost:3456/?title=Current%20Page');

  const secondPage = await context.newPage();
  await secondPage.goto('http://localhost:3456/?title=Second%20Page');
  await currentPage.bringToFront();

  await currentPage.evaluate(() => {
    const priorInput = document.createElement('input');
    priorInput.id = 'page-prior-input';
    document.body.appendChild(priorInput);
    priorInput.focus();

    window.__topWindowKeyLog = [];
    window.addEventListener(
      'keydown',
      (e) => {
        window.__topWindowKeyLog?.push(`down:${e.key}`);
      },
      true,
    );
    window.addEventListener(
      'keyup',
      (e) => {
        window.__topWindowKeyLog?.push(`up:${e.key}`);
      },
      true,
    );
  });

  const frame = await openSwitcher(currentPage);
  const overlay = frame.locator('.switcher-overlay');
  await expect(overlay).toBeVisible();
  await expect(currentPage.locator('#avy-tab-switcher-root iframe')).toHaveAttribute(
    'title',
    'Avy Tab Switcher',
  );

  await currentPage.keyboard.press('ArrowRight');
  await currentPage.keyboard.press('ArrowLeft');

  await currentPage.keyboard.press('/');
  const searchInput = frame.locator('.switcher-search-input');
  await expect(searchInput).toBeFocused();

  await currentPage.keyboard.type('Second');
  await expect(frame.locator('.tab-tile')).toHaveCount(1);

  await currentPage.keyboard.press('Escape');
  await expect(searchInput).toHaveAttribute('readonly', '');
  await expect(overlay).toBeVisible();
  await expect(frame.locator('.tab-tile')).toHaveCount(1);

  const logDuringOverlay = await currentPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(logDuringOverlay).toEqual([]);

  await currentPage.keyboard.down('Escape');
  await currentPage.waitForTimeout(950);
  await expect(overlay).toBeVisible();

  await currentPage.keyboard.up('Escape');
  await expect(overlay).toBeVisible();

  const logAfterLongHold = await currentPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(logAfterLongHold).toEqual([]);

  await currentPage.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(currentPage.locator('#avy-tab-switcher-root iframe')).toBeHidden();

  const logAfterClose = await currentPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(logAfterClose).toEqual([]);

  const activeId = await currentPage.evaluate(() => document.activeElement?.id);
  expect(activeId).toBe('page-prior-input');

  await currentPage.keyboard.press('x');
  const logAfterFreshKey = await currentPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(logAfterFreshKey).toEqual(['down:x', 'up:x']);

  await secondPage.evaluate(() => {
    window.__topWindowKeyLog = [];
    window.addEventListener(
      'keydown',
      (e) => {
        window.__topWindowKeyLog?.push(`down:${e.key}`);
      },
      true,
    );
    window.addEventListener(
      'keyup',
      (e) => {
        window.__topWindowKeyLog?.push(`up:${e.key}`);
      },
      true,
    );
  });

  await currentPage.evaluate(() => {
    window.__topWindowKeyLog = [];
  });

  const reopenFrame = await openSwitcher(currentPage);
  await expect(reopenFrame.locator('.switcher-overlay')).toBeVisible();

  const tileHint = await reopenFrame
    .locator('.tab-tile', { hasText: 'Second Page' })
    .locator('.tab-tile__keycap')
    .textContent();
  expect(tileHint).toBeTruthy();
  const hintChar = (tileHint ?? '').trim();

  await currentPage.keyboard.down(hintChar.toLowerCase());
  await currentPage.waitForTimeout(950);
  expect(await getActiveTabTitle()).toBe('Current Page');
  await expect(reopenFrame.locator('.switcher-overlay')).toBeVisible();

  await currentPage.keyboard.up(hintChar.toLowerCase());
  expect(await getActiveTabTitle()).toBe('Current Page');
  await expect(reopenFrame.locator('.switcher-overlay')).toBeVisible();

  const currentLogAfterHold = await currentPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(currentLogAfterHold).toEqual([]);

  const secondLogAfterHold = await secondPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(secondLogAfterHold).toEqual([]);

  await currentPage.keyboard.press(hintChar.toLowerCase());
  await expect.poll(async () => getActiveTabTitle()).toBe('Second Page');

  const secondLogAfterLower = await secondPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(secondLogAfterLower).toEqual([]);

  await currentPage.bringToFront();
  const currentLogAfterLower = await currentPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(currentLogAfterLower).toEqual([]);

  await secondPage.evaluate(() => {
    window.__topWindowKeyLog = [];
  });
  await currentPage.evaluate(() => {
    window.__topWindowKeyLog = [];
  });

  const reopenUpperFrame = await openSwitcher(currentPage);
  await expect(reopenUpperFrame.locator('.switcher-overlay')).toBeVisible();

  const upperTileHint = await reopenUpperFrame
    .locator('.tab-tile', { hasText: 'Second Page' })
    .locator('.tab-tile__keycap')
    .textContent();
  expect(upperTileHint).toBeTruthy();
  const upperHintChar = (upperTileHint ?? '').trim();

  await currentPage.keyboard.press(`Shift+${upperHintChar.toUpperCase()}`);
  await expect.poll(async () => getActiveTabTitle()).toBe('Second Page');

  const secondLogAfterUpper = await secondPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(secondLogAfterUpper).toEqual([]);

  await currentPage.bringToFront();
  const currentFinalLog = await currentPage.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(currentFinalLog).toEqual([]);
});

test('Security: unauthorized direct iframe embed cannot obtain tabs', async ({
  context,
  getExtensionId,
}) => {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('http://localhost:3456/?title=Attacker%20Page');

  const extId = getExtensionId();

  const resultNoSession = await page.evaluate(async (extensionId) => {
    const iframe = document.createElement('iframe');
    iframe.id = 'unauth-frame-1';
    iframe.src = `chrome-extension://${extensionId}/frame.html`;
    document.body.appendChild(iframe);
    await new Promise((resolve) => {
      iframe.onload = resolve;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return iframe.contentWindow !== null;
  }, extId);
  expect(resultNoSession).toBe(true);

  const frameNoSession = page.frameLocator('#unauth-frame-1');
  await expect(frameNoSession.locator('.switcher-overlay')).toHaveCount(0);

  const resultFakeSession = await page.evaluate(async (extensionId) => {
    const iframe = document.createElement('iframe');
    iframe.id = 'unauth-frame-2';
    iframe.src = `chrome-extension://${extensionId}/frame.html?sessionId=forged-nonce-12345`;
    document.body.appendChild(iframe);
    await new Promise((resolve) => {
      iframe.onload = resolve;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return iframe.contentWindow !== null;
  }, extId);
  expect(resultFakeSession).toBe(true);

  const frameFakeSession = page.frameLocator('#unauth-frame-2');
  await expect(frameFakeSession.locator('.switcher-overlay')).toHaveCount(0);
});

test('Security: cloned iframe reusing authorized session URL cannot hijack session', async ({
  context,
  openSwitcher,
}) => {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('http://localhost:3456/?title=Host%20Page');

  const secondPage = await context.newPage();
  await secondPage.goto('http://localhost:3456/?title=Other%20Page');
  await page.bringToFront();

  const frame = await openSwitcher(page);
  const overlay = frame.locator('.switcher-overlay');
  await expect(overlay).toBeVisible();

  const clonedResult = await page.evaluate(async () => {
    const host = document.getElementById('avy-tab-switcher-root');
    const originalIframe = host?.shadowRoot?.querySelector('iframe');
    if (!originalIframe?.src) {
      return false;
    }

    const clonedIframe = document.createElement('iframe');
    clonedIframe.id = 'cloned-frame';
    clonedIframe.src = originalIframe.src;
    document.body.appendChild(clonedIframe);

    await new Promise((resolve) => {
      clonedIframe.onload = resolve;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return true;
  });
  expect(clonedResult).toBe(true);

  const clonedFrame = page.frameLocator('#cloned-frame');
  await expect(clonedFrame.locator('.switcher-overlay')).toHaveCount(0);

  await page.evaluate(() => {
    document.getElementById('cloned-frame')?.remove();
  });

  await frame.locator('.switcher-close-btn').click();
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeHidden();
});

test('Security: origin and source spoofing postMessage is rejected by switcher host', async ({
  context,
  openSwitcher,
}) => {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('http://localhost:3456/?title=Host%20Page');

  const secondPage = await context.newPage();
  await secondPage.goto('http://localhost:3456/?title=Other%20Page');
  await page.bringToFront();

  const frame = await openSwitcher(page);
  const overlay = frame.locator('.switcher-overlay');
  await expect(overlay).toBeVisible();

  await page.evaluate(() => {
    window.postMessage(
      {
        type: 'AVY_CLOSE_FRAME',
        sessionId: 'spoofed-session',
      },
      '*',
    );
  });

  await page.waitForTimeout(200);

  await expect(overlay).toBeVisible();

  await frame.locator('.switcher-close-btn').click();
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeHidden();
});

test('Focus containment: programmatically focusing host-page element reasserts frame focus and prevents keystroke leakage', async ({
  context,
  openSwitcher,
}) => {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto('http://localhost:3456/?title=Focus%20Containment%20Page');

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'page-hijack-input';
    document.body.appendChild(input);

    window.__topWindowKeyLog = [];
    window.addEventListener(
      'keydown',
      (e) => {
        window.__topWindowKeyLog?.push(`down:${e.key}`);
      },
      true,
    );
    window.addEventListener(
      'keyup',
      (e) => {
        window.__topWindowKeyLog?.push(`up:${e.key}`);
      },
      true,
    );
  });

  const frame = await openSwitcher(page);
  await expect(frame.locator('.switcher-overlay')).toBeVisible();

  await page.evaluate(() => {
    document.getElementById('page-hijack-input')?.focus();
  });

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const active = document.activeElement;
        const host = document.getElementById('avy-tab-switcher-root');
        return active === host;
      });
    })
    .toBe(true);

  expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('page-hijack-input');

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');

  const keyLog = await page.evaluate(() => window.__topWindowKeyLog ?? []);
  expect(keyLog).toEqual([]);

  await frame.locator('.switcher-close-btn').click();
  await expect(page.locator('#avy-tab-switcher-root iframe')).toBeHidden();
});
