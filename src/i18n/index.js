// i18n core: dictionary registry, locale picker, and string formatter.
// Pure data + functions, no DOM.
(function (g) {
    'use strict';

    const I18N_DICT = {};

    function registerLocale(code, dict) {
        I18N_DICT[code] = dict;
    }

    /**
     * Resolves a UI locale code from a prioritised list of candidates.
     * All supported codes are BCP-47 language-region tags (lower-cased).
     * Recognises Traditional Chinese region/script tags (Hant/TW/HK/MO).
     *
     * @param {{url?: string|null, stored?: string|null, navigator?: string[]}} opts
     * @returns {'zh-cn'|'zh-tw'|'en-us'|'ja-jp'|'ko-kr'|'es-es'}
     */
    function pickLang(opts) {
        const o = opts || {};
        const candidates = [o.url, o.stored, ...(o.navigator || [])];
        for (const raw of candidates) {
            if (!raw) continue;
            const lc = String(raw).toLowerCase();
            if (lc === 'zh-tw' || lc === 'zh-hk' || lc === 'zh-mo'
                || lc.startsWith('zh-hant') || lc.startsWith('zh-tw')
                || lc.startsWith('zh-hk') || lc.startsWith('zh-mo')) return 'zh-tw';
            if (lc.startsWith('zh')) return 'zh-cn';
            if (lc.startsWith('en')) return 'en-us';
            if (lc.startsWith('ja')) return 'ja-jp';
            if (lc.startsWith('ko')) return 'ko-kr';
            if (lc.startsWith('es')) return 'es-es';
        }
        return 'zh-cn';
    }

    /**
     * Builds a `t(key, params?)` translator bound to the current language.
     * `getLang` is a function so the same translator stays valid after setLang().
     * Falls back through current → en-us → zh-cn → key.
     */
    function createT(getLang) {
        return function t(key, params) {
            const dict = I18N_DICT[getLang()];
            const en = I18N_DICT['en-us'] || {};
            const zh = I18N_DICT['zh-cn'] || {};
            let s = dict ? dict[key] : undefined;
            if (s == null) s = en[key] != null ? en[key] : (zh[key] != null ? zh[key] : key);
            if (params) {
                for (const k in params) s = s.split('{' + k + '}').join(params[k]);
            }
            return s;
        };
    }

    function hasLocale(code) { return Object.prototype.hasOwnProperty.call(I18N_DICT, code); }
    function locales() { return Object.keys(I18N_DICT); }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.I18N_DICT = I18N_DICT;
    g.DAIDAI.registerLocale = registerLocale;
    g.DAIDAI.pickLang = pickLang;
    g.DAIDAI.createT = createT;
    g.DAIDAI.hasLocale = hasLocale;
    g.DAIDAI.locales = locales;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
