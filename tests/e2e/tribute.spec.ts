import { test, expect } from '@playwright/test';
import { gotoGame, pressHeartSequence } from './helpers';

test.describe('heart easter egg', () => {
  test('16-key DRUL × 4 triggers tribute overlay', async ({ page }) => {
    await gotoGame(page);
    await pressHeartSequence(page);
    await expect(page.locator('#tribute-overlay')).toBeVisible({ timeout: 5_000 });
  });

  test('tribute is once-per-page-load', async ({ page }) => {
    await gotoGame(page);
    // Directly invoke the activator twice via __test hook. Skipping the real
    // keyboard sequence here avoids the 5.7s overlay-cleanup chain that flakes
    // under heavy CI load. The 16-key path is exercised by the test above.
    await page.evaluate(() => { (window as any).__test.callActivateTribute(); });
    await expect(page.locator('#tribute-overlay')).toHaveCount(1);
    // Dismiss + re-activate in separate evaluates so Playwright gets a
    // chance to drain between them under WebGL contention.
    await page.evaluate(() => { (window as any).__test.dismissTribute(); });
    await page.evaluate(() => { (window as any).__test.callActivateTribute(); });
    // Poll: the second activation should be a no-op (once-per-page-load).
    await expect(page.locator('#tribute-overlay')).toHaveCount(0, { timeout: 2000 });
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
