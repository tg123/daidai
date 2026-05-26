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
    await expect(page.locator('link[rel="icon"][href*="fav.ico"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });
});
