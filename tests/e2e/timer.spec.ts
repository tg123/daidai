import { test, expect } from '@playwright/test';
import { gotoGame } from './helpers';

const timerText = (page) => page.locator('#timer').innerText();

test.describe('timer', () => {
  test('does not advance before the first directional input', async ({ page }) => {
    await gotoGame(page);
    // Game starts paused on the title prompt — timer should stay at 00:00
    // until the user actually presses an arrow key. Wait just over 1s so
    // that any (incorrect) tick would have already updated the text.
    await page.waitForTimeout(1100);
    expect(await timerText(page)).toBe('00:00');
  });

  test('advances only while the game is unpaused', async ({ page }) => {
    await gotoGame(page);
    await page.keyboard.press('ArrowRight');           // starts the game
    // Poll until the timer changes from 00:00 — much faster than a fixed
    // 1300 ms wall on a healthy run, and self-healing under load.
    await expect.poll(() => timerText(page), { timeout: 3000 }).not.toBe('00:00');
    const t1 = await timerText(page);
    expect(t1).not.toBe('00:00');                       // timer started

    await page.keyboard.press('Space');                 // pause
    await page.waitForTimeout(150);
    const tPaused = await timerText(page);

    await page.waitForTimeout(1100);                    // wait while paused
    expect(await timerText(page)).toBe(tPaused);        // unchanged

    await page.keyboard.press('Space');                 // unpause
    // Poll until the timer ticks past tPaused.
    await expect.poll(() => timerText(page), { timeout: 3000 }).not.toBe(tPaused);
    const tResumed = await timerText(page);
    expect(tResumed).not.toBe(tPaused);                 // ticking again
    // Verify it didn't jump by the paused duration: the new value should be
    // close to (tPaused + 1s..2s), well below tPaused + 3s.
    const toSec = (s: string) => {
      const [m, sec] = s.split(':').map(Number);
      return m * 60 + sec;
    };
    const delta = toSec(tResumed) - toSec(tPaused);
    expect(delta).toBeGreaterThanOrEqual(1);
    expect(delta).toBeLessThanOrEqual(3);
  });
});

test.describe('auto-pause on focus loss', () => {
  test('window blur pauses an active game', async ({ page }) => {
    await gotoGame(page, { lang: 'zh-cn' });
    await page.keyboard.press('ArrowRight');
    // Wait until the start handler flips paused off, rather than guessing 300ms.
    await expect.poll(() =>
      page.evaluate(() => (window as any).__test.state().paused)
    , { timeout: 2000 }).toBe(false);

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));

    await expect.poll(() =>
      page.evaluate(() => (window as any).__test.state().paused)
    , { timeout: 2000 }).toBe(true);
    await expect(page.locator('#message')).toContainText('暂停');
  });

  test('visibilitychange (hidden) also pauses', async ({ page }) => {
    await gotoGame(page, { lang: 'zh-cn' });
    await page.keyboard.press('ArrowRight');
    await expect.poll(() =>
      page.evaluate(() => (window as any).__test.state().paused)
    , { timeout: 2000 }).toBe(false);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect.poll(() =>
      page.evaluate(() => (window as any).__test.state().paused)
    , { timeout: 2000 }).toBe(true);
  });

  test('blur is a no-op when already paused or game-over', async ({ page }) => {
    await gotoGame(page, { lang: 'zh-cn' });
    // Force game-over
    await page.evaluate(() => {
      const T = (window as any).__test;
      T.setSnake([{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 6, y: 6 }]);
      T.setDirection(1, 0);
      T.step();
    });
    // T.step() sets gameOver synchronously, but page.evaluate round-trips
    // can be slow under WebGL contention — keep a generous timeout.
    await expect.poll(async () =>
      page.evaluate(() => (window as any).__test.state().gameOver)
    , { timeout: 5000 }).toBe(true);

    const msgBefore = await page.locator('#message').innerText();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(100);
    // Game-over screen still visible (blur did not overwrite the message)
    expect(await page.locator('#message').innerText()).toBe(msgBefore);
  });
});
