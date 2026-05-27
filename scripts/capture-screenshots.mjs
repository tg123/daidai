// One-off: capture PWA manifest screenshots for Store listing.
// Run via: `node scripts/capture-screenshots.mjs` after `npm run build`
// AND `npx vite preview` running on http://127.0.0.1:8080.
//
// Outputs are committed under public/screenshots/ and referenced by
// vite.config.js MANIFEST_BASE.screenshots.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public/screenshots');
mkdirSync(outDir, { recursive: true });

const URL = process.env.SHOT_URL || 'http://127.0.0.1:8080/';

const targets = [
    { name: 'desktop-1280x800', width: 1280, height: 800 },
    { name: 'mobile-720x1280', width: 720, height: 1280 },
];

const browser = await chromium.launch();
for (const t of targets) {
    const ctx = await browser.newContext({
        viewport: { width: t.width, height: t.height },
        deviceScaleFactor: 1,
        isMobile: t.width < t.height,
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
        try {
            window.__TEST_FAST_BOOT = true;
        } catch (_) {}
    });
    await page.goto(URL);
    await page.waitForSelector('#loading-screen', { state: 'detached', timeout: 15000 });
    // Let one frame render so the canvas isn't blank.
    await page.waitForTimeout(500);
    const file = resolve(outDir, `${t.name}.png`);
    await page.screenshot({ path: file, omitBackground: false });
    console.log('wrote', file);
    await ctx.close();
}
await browser.close();
