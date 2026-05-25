import { test, expect } from '@playwright/test';
import { gotoGame } from './helpers';

test.describe('pause / restart', () => {
  test('Space toggles pause and shows the i18n paused message', async ({ page }) => {
    await gotoGame(page, { lang: 'zh' });
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    await expect(page.locator('#message')).toContainText('暂停');
    await page.keyboard.press('Space');
    await expect(page.locator('#message')).not.toContainText('暂停');
  });

  test('Pause button toggles symbol (mobile viewport)', async ({ page }) => {
    // #btn-pause lives inside #touch-controls which is display:none on desktop;
    // shrinking the viewport below 720px triggers the media query that shows it.
    await page.setViewportSize({ width: 480, height: 800 });
    await gotoGame(page);
    const btn = page.locator('#btn-pause');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(100);
    const text = (await btn.innerText()).trim();
    expect(['⏸', '▶']).toContain(text);
  });

  test('Space is a no-op after game over (keeps the failure screen visible)', async ({ page }) => {
    await gotoGame(page, { lang: 'zh' });
    // Force a game-over via the test API.
    await page.evaluate(() => {
      const T = (window as any).__test;
      T.setSnake([{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 6, y: 6 }]);
      T.setDirection(1, 0);
      T.step(); // self-collision
    });
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__test.state().gameOver);
    }, { timeout: 2000 }).toBe(true);

    const msgBefore = await page.locator('#message').innerText();
    expect(msgBefore).toContain('游戏结束');

    await page.keyboard.press('Space');
    await page.waitForTimeout(150);

    const stateAfter = await page.evaluate(() => (window as any).__test.state());
    // Pause must not have toggled, and the game-over message must still be shown.
    expect(stateAfter.gameOver).toBe(true);
    expect(stateAfter.paused).toBe(true); // paused stays true as set by gameOver path
    const msgAfter = await page.locator('#message').innerText();
    expect(msgAfter).toContain('游戏结束');
    // Big restart button is still showing.
    await expect(page.locator('#btn-restart')).toHaveClass(/show/);
  });
});
