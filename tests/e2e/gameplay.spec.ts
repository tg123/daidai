import { test, expect } from '@playwright/test';
import { gotoGame, getState, resetWorld, stepN } from './helpers';

// All gameplay tests use the window.__test API exposed by index.html. Each test
// pins the snake/beans/etc. to a deterministic layout, then advances the game
// loop via stepN() to assert specific mechanics without depending on RNG or
// real-time scheduling.

test.describe('gameplay — eating', () => {
  test('eating a colored bean adds +5, grows the snake, and prepends eatenColors', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { x: 1, y: 0 },
    });
    await page.evaluate(() => (window as any).__test.placeBean(11, 10, 2)); // green
    const before = await getState(page);
    expect(before.beansEaten).toBe(0);

    await stepN(page, 1);

    const after = await getState(page);
    expect(after.score).toBe(before.score + 5);
    expect(after.beansEaten).toBe(1);
    expect(after.snake.length).toBe(before.snake.length + 1); // growthPending applied next tick? actually +1 since growth holds tail
    expect(after.snake[0]).toEqual({ x: 11, y: 10 });
    expect(after.eatenColors[0]).toBe(2);
  });

  test('eating a gold bean adds +30', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { x: 1, y: 0 },
    });
    await page.evaluate(() => (window as any).__test.placeGold(11, 10));
    const before = await getState(page);

    await stepN(page, 1);

    const after = await getState(page);
    expect(after.score).toBe(before.score + 30);
    expect(after.goldBeans.length).toBe(0);
    expect(after.snake[0]).toEqual({ x: 11, y: 10 });
  });
});

test.describe('gameplay — death', () => {
  test('biting own body triggers gameOver', async ({ page }) => {
    await gotoGame(page);
    // Snake shaped like a U so the next head step lands on body[2].
    await resetWorld(page, {
      snake: [
        { x: 5, y: 5 }, // head, moving down
        { x: 5, y: 4 },
        { x: 6, y: 4 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
      ],
      direction: { x: 1, y: 0 }, // head goes to (6,5) which is body[3]
    });

    await stepN(page, 1);

    const s = await getState(page);
    expect(s.gameOver).toBe(true);
  });

  test('walking into shed skin triggers gameOver', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { x: 1, y: 0 },
    });
    await page.evaluate(() => (window as any).__test.placeShed(11, 10));

    await stepN(page, 1);

    const s = await getState(page);
    expect(s.gameOver).toBe(true);
  });

  test('godMode keeps snake alive on self-collision', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
        { x: 6, y: 4 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
      ],
      direction: { x: 1, y: 0 },
    });
    await page.evaluate(() => (window as any).__test.setGodMode(true));

    await stepN(page, 1);

    const s = await getState(page);
    expect(s.gameOver).toBe(false);
    expect(s.godMode).toBe(true);
  });
});

test.describe('gameplay — wrap-around', () => {
  test('head wraps from right edge to column 0', async ({ page }) => {
    await gotoGame(page);
    const cols = await page.evaluate(() => (window as any).__test.COLS());
    await resetWorld(page, {
      snake: [{ x: cols - 1, y: 10 }, { x: cols - 2, y: 10 }, { x: cols - 3, y: 10 }],
      direction: { x: 1, y: 0 },
    });

    await stepN(page, 1);

    const s = await getState(page);
    expect(s.snake[0].x).toBe(0);
    expect(s.snake[0].y).toBe(10);
  });

  test('head wraps from top edge to last row', async ({ page }) => {
    await gotoGame(page);
    const rows = await page.evaluate(() => (window as any).__test.ROWS());
    await resetWorld(page, {
      snake: [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }],
      direction: { x: 0, y: -1 },
    });

    await stepN(page, 1);

    const s = await getState(page);
    expect(s.snake[0].y).toBe(rows - 1);
    expect(s.snake[0].x).toBe(5);
  });
});

test.describe('gameplay — 5-color combo magics', () => {
  test('red x5 → boost (isBoosted + 2x multiplier + faster speed)', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { x: 1, y: 0 },
    });
    // Pre-load combo to 4 reds (color index 0), next red triggers magic.
    await page.evaluate(() => (window as any).__test.setComboColor(0, 4));
    await page.evaluate(() => (window as any).__test.placeBean(11, 10, 0));
    const before = await getState(page);

    await stepN(page, 1);

    const after = await getState(page);
    expect(after.isBoosted).toBe(true);
    expect(after.boostMultiplier).toBeGreaterThanOrEqual(2);
    expect(after.speed).toBeLessThan(before.baseSpeed);
    expect(after.comboCount).toBe(0);
  });

  test('purple x5 → halves snake', async ({ page }) => {
    await gotoGame(page);
    // Long snake so halving is visible.
    const longSnake = Array.from({ length: 20 }, (_, i) => ({ x: 30 - i, y: 10 }));
    await resetWorld(page, { snake: longSnake, direction: { x: 1, y: 0 } });
    await page.evaluate(() => (window as any).__test.setComboColor(4, 4));
    await page.evaluate(() => (window as any).__test.placeBean(31, 10, 4));

    await stepN(page, 1);

    const after = await getState(page);
    // 20 long + head added = 21, halved ~ 10. Allow growthPending tail logic ±1.
    expect(after.snake.length).toBeLessThanOrEqual(12);
    expect(after.snake.length).toBeGreaterThanOrEqual(8);
  });

  test('orange magic spawns a golden projectile', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { x: 1, y: 0 },
    });
    const before = await getState(page);
    expect(before.goldenProjectiles).toBe(0);

    await page.evaluate(() => (window as any).__test.triggerMagic(3));

    const after = await getState(page);
    expect(after.goldenProjectiles).toBeGreaterThanOrEqual(1);
  });

  test('green magic converts up to 5 shed skin segments back into falling beans', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 1, y: 1 }, { x: 0, y: 1 }],
      direction: { x: 1, y: 0 },
    });
    // Place 5 shed segments far from the snake.
    for (let i = 0; i < 5; i++) {
      await page.evaluate((y) => (window as any).__test.placeShed(20, y), 5 + i);
    }
    const before = await getState(page);
    expect(before.shedSkin.length).toBe(5);

    await page.evaluate(() => (window as any).__test.triggerMagic(2));

    const after = await getState(page);
    expect(after.shedSkin.length).toBe(0);
  });
});

test.describe('gameplay — orange laser collisions', () => {
  test('laser converts beans in its path into gold beans', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { x: 1, y: 0 },
    });
    await page.evaluate(() => (window as any).__test.placeBean(13, 10, 1));
    // Keep paused so gameUpdate is suppressed (snake stays put), but
    // syncScene still runs in mainLoop and advances projectile physics.
    await page.evaluate(() => (window as any).__test.setPaused(true));
    await page.evaluate(() => (window as any).__test.triggerMagic(3));
    // Deterministically step projectile physics (rAF can starve under
    // parallel workers / headless CI). 20 steps × 0.4 = 8 units, plenty
    // for a bean ~3 cells away.
    await page.evaluate(() => (window as any).__test.stepProjectiles(20));

    const after = await getState(page);
    expect(after.goldBeans.length).toBeGreaterThanOrEqual(1);
    expect(after.beans.find(b => b.x === 13 && b.y === 10)).toBeUndefined();
  });

  test('laser converts shed skin into gold beans (matches original game)', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { x: 1, y: 0 },
    });
    await page.evaluate(() => (window as any).__test.placeShed(13, 10));
    const before = await getState(page);
    expect(before.shedSkin.length).toBe(1);
    expect(before.goldBeans.length).toBe(0);

    await page.evaluate(() => (window as any).__test.setPaused(true));
    await page.evaluate(() => (window as any).__test.triggerMagic(3));
    await page.evaluate(() => (window as any).__test.stepProjectiles(20));

    const after = await getState(page);
    expect(after.shedSkin.length).toBe(0);
    expect(after.goldBeans.length).toBeGreaterThanOrEqual(1);
    expect(after.goldBeans.some(g => g.x === 13 && g.y === 10)).toBe(true);
  });
});

test.describe('gameplay — shedding at length 25', () => {
  test('reaching length 25 sheds body down to 5 and spawns shed skin segments', async ({ page }) => {
    await gotoGame(page);
    // 24-segment snake plus the bean it eats this tick takes projectedLen to 25.
    const body = Array.from({ length: 24 }, (_, i) => ({ x: 30 - i, y: 10 }));
    await resetWorld(page, { snake: body, direction: { x: 1, y: 0 } });
    await page.evaluate(() => (window as any).__test.placeBean(31, 10, 0));

    await stepN(page, 1);

    const after = await getState(page);
    expect(after.snake.length).toBe(5);
    // Shed dropped 25 - 5 = 20 segments.
    expect(after.shedSkin.length).toBeGreaterThanOrEqual(19);
  });
});

test.describe('gameplay — pause blocks game step', () => {
  test('mainLoop does not advance the snake while paused', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { x: 1, y: 0 },
    });
    // setBaseSpeed(50) → if not paused, ~10 ticks would happen in 500ms.
    await page.evaluate(() => (window as any).__test.setBaseSpeed(50));
    await page.evaluate(() => (window as any).__test.setPaused(true));
    const before = await getState(page);

    await page.waitForTimeout(500);

    const after = await getState(page);
    expect(after.snake[0]).toEqual(before.snake[0]);
    expect(after.score).toBe(before.score);
  });
});

test.describe('gameplay — rainbow rain bean bonus', () => {
  test('blue x5 sets isRaining and bonus persists for the next eat', async ({ page }) => {
    await gotoGame(page);
    await resetWorld(page, {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { x: 1, y: 0 },
    });
    await page.evaluate(() => (window as any).__test.triggerMagic(1));
    const mid = await getState(page);
    expect(mid.isRaining).toBe(true);

    await page.evaluate(() => (window as any).__test.placeBean(11, 10, 2));
    const before = await getState(page);

    await stepN(page, 1);

    const after = await getState(page);
    // Base 5 + rain bonus 10 = 15.
    expect(after.score - before.score).toBe(15);
  });
});
