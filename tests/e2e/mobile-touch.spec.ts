import { test, expect } from '@playwright/test';
import { getState, gotoGame } from './helpers';

// Regressions discovered during iPhone testing of the TypeScript migration.
// Both bugs predate the migration (camera fit + touch handler), but were
// only spotted on a real device — adding both unit + e2e coverage so they
// can't silently come back.

test.describe('canvas spans full window on every viewport (HUD buttons float on top)', () => {
    test('iPhone-sized portrait viewport: canvas full width, camera centered, no body-bg gutter', async ({
        browser,
    }) => {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
        });
        const page = await context.newPage();
        await gotoGame(page);

        // Camera stays centered on the pond — no horizontal offset, no
        // perspective tilt at the right wall.
        const s = await getState(page);
        expect(s.cameraOffsetX).toBeCloseTo(0, 5);

        // Canvas fills the whole window. The floating pause/mute/lang
        // buttons sit on top of the canvas (position:fixed) instead of
        // taking up a reserved gutter — that's intentional, an earlier
        // "reserve a right strip" approach left a visible dark bar on
        // iPhone that looked broken.
        const layout = await page.evaluate(() => {
            const canvas = document.querySelector('canvas')!;
            return {
                canvasWidth: canvas.getBoundingClientRect().width,
                windowWidth: window.innerWidth,
            };
        });
        expect(layout.canvasWidth).toBe(layout.windowWidth);

        await context.close();
    });

    test('desktop viewport: canvas full width, camera centered', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await gotoGame(page);
        const s = await getState(page);
        expect(s.cameraOffsetX).toBeCloseTo(0, 5);

        const widths = await page.evaluate(() => ({
            canvas: document.querySelector('canvas')!.getBoundingClientRect().width,
            window: window.innerWidth,
        }));
        expect(widths.canvas).toBe(widths.window);
    });
});

test.describe('mobile tap-to-start guard', () => {
    test('quick tap on the canvas DOES start the game from the initial idle screen', async ({ browser }) => {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
        });
        const page = await context.newPage();
        await gotoGame(page);
        // Initial idle: paused, score 0, short starter snake.
        const before = await getState(page);
        expect(before.paused).toBe(true);
        expect(before.score).toBe(0);
        expect(before.gameOver).toBe(false);

        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        if (!box) throw new Error('canvas has no bounding box');
        // Tap somewhere in the centre of the canvas (not on a HUD button).
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

        await expect.poll(async () => (await getState(page)).paused, { timeout: 2000 }).toBe(false);
        await context.close();
    });

    test('quick tap on the canvas DOES NOT resume from a mid-game pause (prevents accidental thumb taps)', async ({
        browser,
    }) => {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
        });
        const page = await context.newPage();
        await gotoGame(page);

        // Promote the world into "mid-game" state: longer snake (so the
        // tap-to-start initial-idle heuristic — `snake.length <= 5` — no
        // longer matches), then pause via the dedicated ▶ button so the
        // game is in exactly the state a player sees after hitting pause
        // mid-run.
        await page.evaluate(() => {
            const T = (window as any).__test;
            T.setSnake([
                { x: 10, y: 10 },
                { x: 9, y: 10 },
                { x: 8, y: 10 },
                { x: 7, y: 10 },
                { x: 6, y: 10 },
                { x: 5, y: 10 },
                { x: 4, y: 10 },
            ]);
            T.setDirection(1, 0);
            T.setHasStarted(true);
            T.setPaused(true);
        });
        const before = await getState(page);
        expect(before.paused).toBe(true);
        expect(before.gameOver).toBe(false);
        expect(before.snake.length).toBeGreaterThan(5);

        // Tap the canvas in a region that is NOT covered by any HUD button.
        // The right-side button column lives in the rightmost ~56px, so we
        // tap on the centre-left to be safe.
        const canvas = page.locator('canvas');
        const box = await canvas.boundingBox();
        if (!box) throw new Error('canvas has no bounding box');
        await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height * 0.5);

        // Give the touchend handler a beat to run, then assert state did NOT
        // change. The handler is purely synchronous so 200ms is plenty.
        await page.waitForTimeout(200);
        const after = await getState(page);
        expect(after.paused).toBe(true);

        // Sanity: the explicit ▶ button still works (i.e. we didn't break the
        // intended resume path).
        await page.locator('#btn-pause').click();
        await expect.poll(async () => (await getState(page)).paused, { timeout: 2000 }).toBe(false);

        await context.close();
    });
});
