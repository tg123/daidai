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
    await page.evaluate(() => {
      const t = (window as any).__test;
      t.callActivateTribute();
    });
    await expect(page.locator('#tribute-overlay')).toHaveCount(1);
    // Remove overlay via the in-page test hook so app state (tributeActive)
    // is cleaned up too. Directly removing the DOM node would leave the flag
    // set and the second-invocation assertion would pass for the wrong reason.
    await page.evaluate(() => {
      const t = (window as any).__test;
      t.dismissTribute();
      t.callActivateTribute();
    });
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
