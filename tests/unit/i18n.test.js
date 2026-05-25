import { describe, it, expect, beforeAll } from 'vitest';

// Side-effect imports register each locale into DAIDAI.I18N_DICT.
import '../../src/i18n/index.js';
import '../../src/i18n/zh.js';
import '../../src/i18n/zh-tw.js';
import '../../src/i18n/en.js';
import '../../src/i18n/ja.js';
import '../../src/i18n/ko.js';
import '../../src/i18n/es.js';

const { I18N_DICT, pickLang, createT, locales } = globalThis.DAIDAI;

describe('i18n', () => {
    it('registers all 6 locales', () => {
        expect(locales().sort()).toEqual(['en', 'es', 'ja', 'ko', 'zh', 'zh-tw']);
    });

    it('every locale defines the same set of keys', () => {
        const ref = Object.keys(I18N_DICT.zh).sort();
        for (const code of locales()) {
            expect(Object.keys(I18N_DICT[code]).sort()).toEqual(ref);
        }
    });

    describe('pickLang', () => {
        it('falls back to zh when nothing matches', () => {
            expect(pickLang({})).toBe('zh');
            expect(pickLang({ navigator: ['xx-YY'] })).toBe('zh');
        });
        it('url wins over storage and navigator', () => {
            expect(pickLang({ url: 'en', stored: 'ja', navigator: ['ko'] })).toBe('en');
        });
        it('storage wins over navigator when url is null', () => {
            expect(pickLang({ url: null, stored: 'ja', navigator: ['ko'] })).toBe('ja');
        });
        it('detects Traditional Chinese region tags', () => {
            expect(pickLang({ url: 'zh-TW' })).toBe('zh-tw');
            expect(pickLang({ navigator: ['zh-Hant-HK'] })).toBe('zh-tw');
            expect(pickLang({ navigator: ['zh-MO'] })).toBe('zh-tw');
            expect(pickLang({ navigator: ['zh-HK'] })).toBe('zh-tw');
        });
        it('falls back to simplified for generic zh', () => {
            expect(pickLang({ navigator: ['zh-CN'] })).toBe('zh');
            expect(pickLang({ navigator: ['zh'] })).toBe('zh');
        });
        it('matches en/ja/ko/es by prefix', () => {
            expect(pickLang({ navigator: ['en-US'] })).toBe('en');
            expect(pickLang({ navigator: ['ja-JP'] })).toBe('ja');
            expect(pickLang({ navigator: ['ko-KR'] })).toBe('ko');
            expect(pickLang({ navigator: ['es-MX'] })).toBe('es');
        });
        it('skips null/undefined candidates', () => {
            expect(pickLang({ url: null, stored: null, navigator: [null, undefined, 'en'] })).toBe('en');
        });
    });

    describe('createT', () => {
        it('looks up the current language', () => {
            let lang = 'en';
            const t = createT(() => lang);
            expect(t('btn.restart')).toBe('Restart');
            lang = 'ja';
            expect(t('btn.restart')).toBe('リスタート');
        });
        it('falls back through current → en → zh → key', () => {
            const t = createT(() => 'es');
            // All locales currently have every key — verify with a missing locale.
            const tx = createT(() => 'xx');
            expect(tx('btn.restart')).toBe('Restart'); // en fallback
            expect(tx('totally.missing.key')).toBe('totally.missing.key');
        });
        it('substitutes {placeholder} params', () => {
            const t = createT(() => 'en');
            expect(t('over.new', { score: 42 })).toBe('🏆 New record!\nScore: 42');
            expect(t('over.normal', { score: 7, hi: 99 })).toBe('Game Over!\nScore: 7\nBest: 99');
        });
        it('leaves unmatched placeholders untouched', () => {
            const t = createT(() => 'en');
            expect(t('over.new')).toBe('🏆 New record!\nScore: {score}');
        });
    });
});
