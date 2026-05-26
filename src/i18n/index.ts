// i18n core: dictionary registry, locale picker, and string formatter.
// Pure data + functions, no DOM.

export type LocaleCode =
    | 'zh-cn'
    | 'zh-tw'
    | 'en-us'
    | 'ja-jp'
    | 'ko-kr'
    | 'es-es'
    | 'es-419'
    | 'fr-fr'
    | 'it-it'
    | 'de-de'
    | 'pt-br'
    | 'pl-pl'
    | 'ru-ru'
    | 'ar-sa'
    | 'th-th';
export type LocaleDict = Record<string, string>;

export interface PickLangOpts {
    url?: string | null;
    stored?: string | null;
    navigator?: ReadonlyArray<string | null | undefined>;
}

export type TFunction = (key: string, params?: Record<string, unknown>) => string;

(function (g: any) {
    'use strict';

    const I18N_DICT: Record<string, LocaleDict> = {};

    function registerLocale(code: string, dict: LocaleDict): void {
        I18N_DICT[code] = dict;
    }

    /**
     * Resolves a UI locale code from a prioritised list of candidates.
     * All supported codes are BCP-47 language-region tags (lower-cased).
     * Recognises Traditional Chinese region/script tags (Hant/TW/HK/MO)
     * and splits Spanish into European (es-es) vs. Latin American (es-419).
     */
    function pickLang(opts?: PickLangOpts): LocaleCode {
        const o = opts || {};
        const candidates: Array<string | null | undefined> = [o.url, o.stored, ...(o.navigator || [])];
        // Latin-American Spanish: any es-* region that isn't Spain itself.
        // Includes the UN M.49 region code "419" used by CLDR/BCP-47.
        const ES_LATAM = new Set([
            '419',
            'ar',
            'bo',
            'cl',
            'co',
            'cr',
            'cu',
            'do',
            'ec',
            'gt',
            'hn',
            'mx',
            'ni',
            'pa',
            'pe',
            'pr',
            'py',
            'sv',
            'us',
            'uy',
            've',
        ]);
        for (const raw of candidates) {
            if (!raw) continue;
            const lc = String(raw).toLowerCase();
            if (
                lc === 'zh-tw' ||
                lc === 'zh-hk' ||
                lc === 'zh-mo' ||
                lc.startsWith('zh-hant') ||
                lc.startsWith('zh-tw') ||
                lc.startsWith('zh-hk') ||
                lc.startsWith('zh-mo')
            )
                return 'zh-tw';
            if (lc.startsWith('zh')) return 'zh-cn';
            if (lc.startsWith('en')) return 'en-us';
            if (lc.startsWith('ja')) return 'ja-jp';
            if (lc.startsWith('ko')) return 'ko-kr';
            if (lc.startsWith('es')) {
                // es / es-es → European Spanish; es-MX, es-419 etc. → Latin-American.
                const region = lc.split(/[-_]/)[1];
                if (region && ES_LATAM.has(region)) return 'es-419';
                return 'es-es';
            }
            if (lc.startsWith('fr')) return 'fr-fr';
            if (lc.startsWith('it')) return 'it-it';
            if (lc.startsWith('de')) return 'de-de';
            if (lc.startsWith('pt')) return 'pt-br';
            if (lc.startsWith('pl')) return 'pl-pl';
            if (lc.startsWith('ru')) return 'ru-ru';
            if (lc.startsWith('ar')) return 'ar-sa';
            if (lc.startsWith('th')) return 'th-th';
        }
        return 'zh-cn';
    }

    /**
     * Builds a `t(key, params?)` translator bound to the current language.
     * `getLang` is a function so the same translator stays valid after setLang().
     * Falls back through current → en-us → zh-cn → key.
     */
    function createT(getLang: () => string): TFunction {
        return function t(key, params) {
            const dict = I18N_DICT[getLang()];
            const en = I18N_DICT['en-us'] || {};
            const zh = I18N_DICT['zh-cn'] || {};
            let s: string | undefined = dict ? dict[key] : undefined;
            if (s == null) s = en[key] != null ? en[key] : zh[key] != null ? zh[key] : key;
            if (params) {
                for (const k in params) s = (s as string).split('{' + k + '}').join(String(params[k]));
            }
            return s as string;
        };
    }

    function hasLocale(code: string): boolean {
        return Object.prototype.hasOwnProperty.call(I18N_DICT, code);
    }
    function locales(): string[] {
        return Object.keys(I18N_DICT);
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.I18N_DICT = I18N_DICT;
    g.DAIDAI.registerLocale = registerLocale;
    g.DAIDAI.pickLang = pickLang;
    g.DAIDAI.createT = createT;
    g.DAIDAI.hasLocale = hasLocale;
    g.DAIDAI.locales = locales;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : (this as any));
