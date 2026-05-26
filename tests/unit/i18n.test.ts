import { describe, it, expect, beforeAll } from 'vitest';

// Side-effect imports register each locale into DAIDAI.I18N_DICT.
import '../../src/i18n/index.ts';
import '../../src/i18n/zh-cn.ts';
import '../../src/i18n/zh-tw.ts';
import '../../src/i18n/en-us.ts';
import '../../src/i18n/ja-jp.ts';
import '../../src/i18n/ko-kr.ts';
import '../../src/i18n/es-es.ts';

const { I18N_DICT, pickLang, createT, locales } = globalThis.DAIDAI;

describe('i18n', () => {
    it('registers all 6 locales', () => {
        expect(locales().sort()).toEqual(['en-us', 'es-es', 'ja-jp', 'ko-kr', 'zh-cn', 'zh-tw']);
    });

    it('every locale defines the same set of keys', () => {
        const ref = Object.keys(I18N_DICT['zh-cn']).sort();
        for (const code of locales()) {
            expect(Object.keys(I18N_DICT[code]).sort()).toEqual(ref);
        }
    });

    describe('pickLang', () => {
        it('falls back to zh-cn when nothing matches', () => {
            expect(pickLang({})).toBe('zh-cn');
            expect(pickLang({ navigator: ['xx-YY'] })).toBe('zh-cn');
        });
        it('url wins over storage and navigator', () => {
            expect(pickLang({ url: 'en', stored: 'ja', navigator: ['ko'] })).toBe('en-us');
        });
        it('storage wins over navigator when url is null', () => {
            expect(pickLang({ url: null, stored: 'ja', navigator: ['ko'] })).toBe('ja-jp');
        });
        it('detects Traditional Chinese region tags', () => {
            expect(pickLang({ url: 'zh-TW' })).toBe('zh-tw');
            expect(pickLang({ navigator: ['zh-Hant-HK'] })).toBe('zh-tw');
            expect(pickLang({ navigator: ['zh-MO'] })).toBe('zh-tw');
            expect(pickLang({ navigator: ['zh-HK'] })).toBe('zh-tw');
        });
        it('falls back to simplified for generic zh', () => {
            expect(pickLang({ navigator: ['zh-CN'] })).toBe('zh-cn');
            expect(pickLang({ navigator: ['zh'] })).toBe('zh-cn');
        });
        it('matches en/ja/ko/es by prefix', () => {
            expect(pickLang({ navigator: ['en-US'] })).toBe('en-us');
            expect(pickLang({ navigator: ['ja-JP'] })).toBe('ja-jp');
            expect(pickLang({ navigator: ['ko-KR'] })).toBe('ko-kr');
            expect(pickLang({ navigator: ['es-MX'] })).toBe('es-es');
        });
        it('accepts legacy 2-letter codes from old localStorage values', () => {
            expect(pickLang({ stored: 'zh' })).toBe('zh-cn');
            expect(pickLang({ stored: 'en' })).toBe('en-us');
            expect(pickLang({ stored: 'ja' })).toBe('ja-jp');
            expect(pickLang({ stored: 'ko' })).toBe('ko-kr');
            expect(pickLang({ stored: 'es' })).toBe('es-es');
        });
        it('skips null/undefined candidates', () => {
            expect(pickLang({ url: null, stored: null, navigator: [null, undefined, 'en'] })).toBe('en-us');
        });
    });

    describe('createT', () => {
        it('looks up the current language', () => {
            let lang = 'en-us';
            const t = createT(() => lang);
            expect(t('btn.restart')).toBe('Restart');
            lang = 'ja-jp';
            expect(t('btn.restart')).toBe('リスタート');
        });
        it('falls back through current → en-us → zh-cn → key', () => {
            const t = createT(() => 'es-es');
            // All locales currently have every key — verify with a missing locale.
            const tx = createT(() => 'xx');
            expect(tx('btn.restart')).toBe('Restart'); // en-us fallback
            expect(tx('totally.missing.key')).toBe('totally.missing.key');
        });
        it('substitutes {placeholder} params', () => {
            const t = createT(() => 'en-us');
            expect(t('over.new', { score: 42 })).toBe('🏆 New record!\nScore: 42');
            expect(t('over.normal', { score: 7, hi: 99 })).toBe('Game Over!\nScore: 7\nBest: 99');
        });
        it('leaves unmatched placeholders untouched', () => {
            const t = createT(() => 'en-us');
            expect(t('over.new')).toBe('🏆 New record!\nScore: {score}');
        });
    });
});
