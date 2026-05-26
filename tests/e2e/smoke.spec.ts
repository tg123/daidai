import { test, expect } from '@playwright/test';
import { gotoGame } from './helpers';

test.describe('smoke', () => {
    test('page loads with title and core HUD', async ({ page }) => {
        await gotoGame(page, { lang: 'zh-cn' });
        await expect(page).toHaveTitle('呆呆虫之豆豆潭');
        await expect(page.locator('#score')).toHaveText('00000');
        await expect(page.locator('#hiscore')).toBeVisible();
        await expect(page.locator('canvas')).toBeVisible();
    });

    test('English locale uses the original author\'s "DAIDAI" Worm name', async ({ page }) => {
        await gotoGame(page, { lang: 'en-us' });
        await expect(page).toHaveTitle('"DAIDAI" Worm');
    });

    test('favicon and apple-touch-icon links are present', async ({ page }) => {
        await gotoGame(page);
        const iconHref = await page.locator('link[rel="icon"]').first().getAttribute('href');
        const touchHref = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute('href');
        expect(iconHref).toMatch(/fav\.ico$/);
        expect(touchHref).toMatch(/apple-touch-icon\.png$/);
        // Built output must use relative URLs so the site works under any deploy
        // subpath (GitHub Pages project page, PR previews under /pr-preview/...).
        // Dev server always serves from root, so only enforce in dist mode.
        if (process.env.TEST_DIST) {
            expect(iconHref).not.toMatch(/^\//);
            expect(touchHref).not.toMatch(/^\//);
        }
    });
});
