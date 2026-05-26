import { test, expect } from '@playwright/test';
import { gotoGame } from './helpers';

const expectedTitles: Record<string, string> = {
    'zh-cn': '呆呆虫之豆豆潭',
    'zh-tw': '呆呆蟲之豆豆潭',
    'en-us': '"DAIDAI" Worm',
    'ja-jp': '豆豆池のダイダイ虫',
    'ko-kr': '콩 연못의 다이다이 벌레',
    'es-es': 'Gusano DaiDai del Estanque DouDou',
};

for (const [lang, title] of Object.entries(expectedTitles)) {
    test(`locale ${lang} renders the canonical title`, async ({ page }) => {
        await gotoGame(page, { lang });
        await expect(page).toHaveTitle(title);
    });
}
