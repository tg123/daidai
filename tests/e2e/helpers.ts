import { Page, expect } from '@playwright/test';

/**
 * Open the game page and wait for the loading screen to finish so the
 * world is fully initialised before any test interaction.
 */
export async function gotoGame(page: Page, opts: { hash?: string; lang?: string } = {}) {
  // Force a deterministic language (some tests check translations).
  // We do this BEFORE the page loads so the script picks it up.
  await page.addInitScript((lang) => {
    if (lang) {
      try { localStorage.setItem('daidai_lang', lang); } catch (_) {}
    }
  }, opts.lang ?? '');
  await page.goto('/index.html' + (opts.hash ?? ''));
  // Loading bar finishes when #loading-screen is hidden / removed.
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 15_000 });
}

/**
 * Inject a stub of navigator.getGamepads that returns the supplied list.
 * Must be called BEFORE gotoGame so the override is installed before the
 * game script runs detectGamepadNow().
 */
export async function stubGamepads(page: Page, pads: Array<null | {
  id?: string;
  connected?: boolean;
  mapping?: string;
}>) {
  await page.addInitScript((rawPads) => {
    const fakePads = rawPads.map((p, i) => {
      if (!p) return null;
      return {
        id: p.id ?? '',
        index: i,
        connected: p.connected ?? true,
        mapping: p.mapping ?? 'standard',
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
        axes: [0, 0, 0, 0],
        timestamp: 0,
      };
    });
    const fn = () => fakePads as any;
    try { Object.defineProperty(navigator, 'getGamepads', { value: fn, configurable: true }); } catch (_) {}
    try { (Navigator.prototype as any).getGamepads = fn; } catch (_) {}
  }, pads);
}

/** Read the displayed score as a number. */
export async function readScore(page: Page): Promise<number> {
  const txt = await page.locator('#score').innerText();
  return parseInt(txt, 10);
}

/**
 * Snapshot of the in-game state exposed via window.__test.state().
 * Keep loosely typed — see index.html for the canonical shape.
 */
export type GameState = {
  score: number;
  hiScore: number;
  gameOver: boolean;
  paused: boolean;
  godMode: boolean;
  snake: Array<{ x: number; y: number }>;
  direction: { x: number; y: number };
  nextDirection: { x: number; y: number };
  beans: Array<{ x: number; y: number; color: number }>;
  goldBeans: Array<{ x: number; y: number; life: number }>;
  shedSkin: Array<{ x: number; y: number; life: number }>;
  eatenColors: number[];
  comboColor: number;
  comboCount: number;
  isBoosted: boolean;
  boostMultiplier: number;
  isRaining: boolean;
  growthPending: number;
  beansEaten: number;
  goldenProjectiles: number;
  speed: number;
  baseSpeed: number;
};

/** Read the current in-game state snapshot. */
export async function getState(page: Page): Promise<GameState> {
  return await page.evaluate(() => (window as any).__test.state());
}

/**
 * Place a fresh snake + direction and clear all beans/gold/shed. The game stays
 * paused unless caller flips it. Use stepN() to advance the simulation.
 */
export async function resetWorld(page: Page, opts: {
  snake?: Array<{ x: number; y: number }>;
  direction?: { x: number; y: number };
} = {}) {
  await page.evaluate((o) => {
    const T = (window as any).__test;
    T.clearBeans();
    T.clearGold();
    T.clearShed();
    if (o.snake) T.setSnake(o.snake);
    if (o.direction) T.setDirection(o.direction.x, o.direction.y);
  }, opts as any);
}

/** Run gameUpdate() N times, synchronously inside the page. */
export async function stepN(page: Page, n: number) {
  await page.evaluate((count) => {
    const T = (window as any).__test;
    for (let i = 0; i < count; i++) T.step();
  }, n);
}

/** Press the 16-key heart easter-egg sequence (DRUL × 4). */
export async function pressHeartSequence(page: Page) {
  const seq = ['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'];
  for (let i = 0; i < 4; i++) {
    for (const k of seq) {
      await page.keyboard.press(k);
    }
  }
}
