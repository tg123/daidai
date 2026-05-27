import { describe, it, expect } from 'vitest';

// Side-effect imports register each locale into I18N_DICT.
import '../../src/i18n/zh-cn';
import '../../src/i18n/zh-tw';
import '../../src/i18n/en-us';
import '../../src/i18n/ja-jp';
import '../../src/i18n/ko-kr';
import '../../src/i18n/es-es';
import '../../src/i18n/fr-fr';
import '../../src/i18n/it-it';
import '../../src/i18n/de-de';
import '../../src/i18n/pt-br';
import '../../src/i18n/pl-pl';
import '../../src/i18n/ru-ru';
import '../../src/i18n/th-th';
import { I18N_DICT, pickLang, createT, locales } from '../../src/i18n/index';

describe('i18n', () => {
    it('registers all 13 locales', () => {
        expect(locales().sort()).toEqual(
            [
                'de-de',
                'en-us',
                'es-es',
                'fr-fr',
                'it-it',
                'ja-jp',
                'ko-kr',
                'pl-pl',
                'pt-br',
                'ru-ru',
                'th-th',
                'zh-cn',
                'zh-tw',
            ].sort(),
        );
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
        it('matches en/ja/ko by prefix', () => {
            expect(pickLang({ navigator: ['en-US'] })).toBe('en-us');
            expect(pickLang({ navigator: ['ja-JP'] })).toBe('ja-jp');
            expect(pickLang({ navigator: ['ko-KR'] })).toBe('ko-kr');
        });
        it('matches all Spanish variants to es-es', () => {
            expect(pickLang({ navigator: ['es-ES'] })).toBe('es-es');
            expect(pickLang({ navigator: ['es'] })).toBe('es-es');
            expect(pickLang({ navigator: ['es-MX'] })).toBe('es-es');
            expect(pickLang({ navigator: ['es-AR'] })).toBe('es-es');
            expect(pickLang({ navigator: ['es-419'] })).toBe('es-es');
        });
        it('matches the newly added European/Asian locales by prefix', () => {
            expect(pickLang({ navigator: ['fr-FR'] })).toBe('fr-fr');
            expect(pickLang({ navigator: ['fr-CA'] })).toBe('fr-fr');
            expect(pickLang({ navigator: ['it-IT'] })).toBe('it-it');
            expect(pickLang({ navigator: ['de-DE'] })).toBe('de-de');
            expect(pickLang({ navigator: ['de-AT'] })).toBe('de-de');
            expect(pickLang({ navigator: ['pt-BR'] })).toBe('pt-br');
            expect(pickLang({ navigator: ['pt-PT'] })).toBe('pt-br');
            expect(pickLang({ navigator: ['pl-PL'] })).toBe('pl-pl');
            expect(pickLang({ navigator: ['ru-RU'] })).toBe('ru-ru');
            expect(pickLang({ navigator: ['th-TH'] })).toBe('th-th');
        });
        it('accepts legacy 2-letter codes from old localStorage values', () => {
            expect(pickLang({ stored: 'zh' })).toBe('zh-cn');
            expect(pickLang({ stored: 'en' })).toBe('en-us');
            expect(pickLang({ stored: 'ja' })).toBe('ja-jp');
            expect(pickLang({ stored: 'ko' })).toBe('ko-kr');
            expect(pickLang({ stored: 'es' })).toBe('es-es');
            expect(pickLang({ stored: 'fr' })).toBe('fr-fr');
            expect(pickLang({ stored: 'it' })).toBe('it-it');
            expect(pickLang({ stored: 'de' })).toBe('de-de');
            expect(pickLang({ stored: 'pt' })).toBe('pt-br');
            expect(pickLang({ stored: 'pl' })).toBe('pl-pl');
            expect(pickLang({ stored: 'ru' })).toBe('ru-ru');
            expect(pickLang({ stored: 'th' })).toBe('th-th');
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
