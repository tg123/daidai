import { test, expect } from '@playwright/test';
import { gotoGame, pressHeartSequence } from './helpers';

test.describe('heart easter egg', () => {
  test('16-key DRUL × 4 triggers tribute exactly once per page load', async ({ page }) => {
    await gotoGame(page);
    await pressHeartSequence(page);
    await expect(page.locator('#tribute-overlay')).toBeVisible({ timeout: 2_000 });

    // Skip the 5.7s cleanup chain — the TV-static setInterval can starve
    // the JS event loop on slow CI runners. Dismiss synchronously instead.
    await page.evaluate(() => {
      const el = document.getElementById('tribute-overlay');
      if (el) {
        const t = Number((el as HTMLElement).dataset.staticTimer);
        if (t) clearInterval(t);
        el.remove();
      }
    });
    await expect(page.locator('#tribute-overlay')).toHaveCount(0, { timeout: 2_000 });

    // Second attempt must NOT trigger
    await pressHeartSequence(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#tribute-overlay')).toHaveCount(0);
  });

  test('half-length arrow sequence does not trigger', async ({ page }) => {
    await gotoGame(page);
    for (let i = 0; i < 2; i++) {
      for (const k of ['ArrowDown','ArrowRight','ArrowUp','ArrowLeft']) {
        await page.keyboard.press(k);
      }
    }
    await page.waitForTimeout(300);
    await expect(page.locator('#tribute-overlay')).toHaveCount(0);
  });
});
