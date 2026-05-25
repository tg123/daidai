import { test, expect } from '@playwright/test';
import { gotoGame, stubGamepads } from './helpers';

test.describe('gamepad detection', () => {
  test('ghost (connected=false) pad is ignored — regression for iOS/macOS Safari', async ({ page }) => {
    await stubGamepads(page, [
      { id: 'Xbox Wireless Controller', connected: false },
      null, null, null,
    ]);
    await gotoGame(page, { lang: 'en' });
    const msg = await page.locator('#message').innerText();
    expect(msg).not.toMatch(/Ⓐ|Ⓑ|Ⓧ|Ⓨ|△|◯|✕|☐/);
    expect(msg).not.toMatch(/D-Pad|stick/i);
  });

  test('connected gamepad activates gamepad prompt', async ({ page }) => {
    await stubGamepads(page, [
      { id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', connected: true },
    ]);
    await gotoGame(page, { lang: 'en' });
    await page.waitForTimeout(400);
    const msg = await page.locator('#message').innerText();
    expect(msg).toMatch(/D-Pad|stick/i);
  });

  test('empty getGamepads (all null) leaves keyboard/touch prompt', async ({ page }) => {
    await stubGamepads(page, [null, null, null, null]);
    await gotoGame(page, { lang: 'en' });
    const msg = await page.locator('#message').innerText();
    expect(msg).not.toMatch(/D-Pad|stick/i);
  });

  test('ghost pad with empty id is also ignored', async ({ page }) => {
    await stubGamepads(page, [{ id: '', connected: true }]);
    await gotoGame(page, { lang: 'en' });
    const msg = await page.locator('#message').innerText();
    expect(msg).not.toMatch(/D-Pad|stick/i);
  });

  test('switching language without a gamepad does NOT pop up gamepad glyphs (regression)', async ({ page }) => {
    // Reproduces the bug: refreshDynamicI18n() ran applyGamepadGlyphs()
    // unconditionally, so any language switch lit up A/B/X/Y hints on
    // keyboard / touch users.
    await stubGamepads(page, [null, null, null, null]);
    await gotoGame(page, { lang: 'en' });

    // Switch language via the in-page API. Cycle a few times to be thorough.
    await page.evaluate(() => {
      // setLang isn't exposed globally, but clicking the language menu items is.
      const click = (lang: string) => {
        const btn = document.querySelector<HTMLButtonElement>(`#lang-menu button[data-lang="${lang}"]`);
        btn?.click();
      };
      click('zh');
      click('ja');
      click('en');
    });
    await page.waitForTimeout(150);

    // None of the visible UI should mention controller-only glyphs.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/Ⓐ|Ⓑ|Ⓧ|Ⓨ|△|◯|✕|☐/);

    // The language-button badge that lights up only for gamepad users
    // (#btn-lang-badge with class "show") must NOT be visible.
    const badgeShown = await page.locator('#btn-lang-badge.show').count();
    expect(badgeShown).toBe(0);
  });
});
