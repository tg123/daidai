import { test, expect } from '@playwright/test';
import { gotoGame } from './helpers';

const expectedTitles: Record<string, string> = {
    'zh-cn': '呆呆虫之豆豆潭',
    'zh-tw': '呆呆蟲之豆豆潭',
    'en-us': '"DAIDAI" Worm',
    'ja-jp': '豆豆池のダイダイ虫',
    'ko-kr': '콩 연못의 다이다이 벌레',
    'es-es': 'Gusano DaiDai del Estanque DouDou',
    'es-419': 'Gusano DaiDai del Estanque DouDou',
    'fr-fr': 'Ver DaiDai de l’étang DouDou',
    'it-it': 'Verme DaiDai dello stagno DouDou',
    'de-de': '„DaiDai“-Wurm vom DouDou-Teich',
    'pt-br': 'Verme DaiDai do Lago DouDou',
    'pl-pl': 'Robak DaiDai ze Stawu DouDou',
    'ru-ru': 'Червяк ДайДай из пруда ДоуДоу',
    'ar-sa': 'دودة دايداي في بركة دوودوو',
    'th-th': 'หนอนไต่ไต่แห่งบ่อโต้วโต้ว',
};

for (const [lang, title] of Object.entries(expectedTitles)) {
    test(`locale ${lang} renders the canonical title`, async ({ page }) => {
        await gotoGame(page, { lang });
        await expect(page).toHaveTitle(title);
    });
}
