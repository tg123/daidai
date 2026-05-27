import { describe, it, expect } from 'vitest';
import '../../src/i18n/en-us';
import '../../src/i18n/zh-cn';
import '../../src/i18n/zh-tw';
import '../../src/i18n/ja-jp';
import '../../src/i18n/ko-kr';
import '../../src/i18n/es-es';
import '../../src/i18n/fr-fr';
import '../../src/i18n/it-it';
import '../../src/i18n/de-de';
import '../../src/i18n/pt-br';
import '../../src/i18n/pl-pl';
import '../../src/i18n/ru-ru';
import '../../src/i18n/ar-sa';
import '../../src/i18n/th-th';
import { createT } from '../../src/i18n/index';
import { getStartPrompt, getRestartLabel } from '../../src/input/promptStrings';

const LANGS = [
    'en-us',
    'zh-cn',
    'zh-tw',
    'ja-jp',
    'ko-kr',
    'es-es',
    'fr-fr',
    'it-it',
    'de-de',
    'pt-br',
    'pl-pl',
    'ru-ru',
    'ar-sa',
    'th-th',
] as const;

function makeT(lang: string) {
    return createT(() => lang);
}

describe('getStartPrompt', () => {
    it('gamepad takes priority over touch+keyboard', () => {
        const t = makeT('en-us');
        expect(getStartPrompt(t, { hasGamepad: true, hasTouch: true, hasFineKeyboard: true })).toBe(
            'Press D-Pad / stick to start!',
        );
    });

    it('touch-only (mobile)', () => {
        const t = makeT('en-us');
        expect(getStartPrompt(t, { hasGamepad: false, hasTouch: true, hasFineKeyboard: false })).toBe(
            'Tap / swipe to start!',
        );
    });

    it('touch + keyboard (e.g. laptop with touchscreen)', () => {
        const t = makeT('en-us');
        expect(getStartPrompt(t, { hasGamepad: false, hasTouch: true, hasFineKeyboard: true })).toBe(
            'Press ← ↑ ↓ → / tap / swipe to start!',
        );
    });

    it('keyboard-only (desktop)', () => {
        const t = makeT('en-us');
        expect(getStartPrompt(t, { hasGamepad: false, hasTouch: false, hasFineKeyboard: true })).toBe(
            'Press ← ↑ ↓ → to start!',
        );
    });

    it('all four modalities produce non-empty strings for every supported locale', () => {
        const modalities: InputModality[] = [
            { hasGamepad: true, hasTouch: false, hasFineKeyboard: false },
            { hasGamepad: false, hasTouch: true, hasFineKeyboard: false },
            { hasGamepad: false, hasTouch: true, hasFineKeyboard: true },
            { hasGamepad: false, hasTouch: false, hasFineKeyboard: true },
        ];
        for (const lang of LANGS) {
            const t = makeT(lang);
            for (const m of modalities) {
                const s = getStartPrompt(t, m);
                expect(typeof s).toBe('string');
                expect(s.length).toBeGreaterThan(0);
                expect(s.startsWith('start.')).toBe(false); // not a fallback key
            }
        }
    });

    it('each modality produces a distinct string for English', () => {
        const t = makeT('en-us');
        const variants = new Set([
            getStartPrompt(t, { hasGamepad: true, hasTouch: false, hasFineKeyboard: false }),
            getStartPrompt(t, { hasGamepad: false, hasTouch: true, hasFineKeyboard: false }),
            getStartPrompt(t, { hasGamepad: false, hasTouch: true, hasFineKeyboard: true }),
            getStartPrompt(t, { hasGamepad: false, hasTouch: false, hasFineKeyboard: true }),
        ]);
        expect(variants.size).toBe(4);
    });
});

interface InputModality {
    hasGamepad: boolean;
    hasTouch: boolean;
    hasFineKeyboard: boolean;
}

describe('getRestartLabel', () => {
    const xboxBtn = () => 'B';
    const psBtn = () => '○';

    it('gamepad: interpolates the B-button glyph (Xbox)', () => {
        const t = makeT('en-us');
        const s = getRestartLabel(
            t,
            { hasGamepad: true, hasTouch: false, hasFineKeyboard: false },
            { gpBtnB: xboxBtn },
        );
        expect(s).toContain('B');
        expect(s).toContain('Restart');
    });

    it('gamepad: interpolates the Circle glyph (PlayStation)', () => {
        const t = makeT('en-us');
        const s = getRestartLabel(t, { hasGamepad: true, hasTouch: false, hasFineKeyboard: false }, { gpBtnB: psBtn });
        expect(s).toContain('○');
        expect(s).toContain('Restart');
        expect(s).not.toContain('{btn}'); // params placeholder fully resolved
    });

    it('touch-only: shows the ⟳ icon + localized restart label', () => {
        const t = makeT('en-us');
        const s = getRestartLabel(
            t,
            { hasGamepad: false, hasTouch: true, hasFineKeyboard: false },
            { gpBtnB: xboxBtn },
        );
        expect(s).toMatch(/^⟳ /);
        expect(s).toContain('Restart');
    });

    it('touch + keyboard (laptop with touchscreen): defaults to keyboard hint', () => {
        const t = makeT('en-us');
        const s = getRestartLabel(t, { hasGamepad: false, hasTouch: true, hasFineKeyboard: true }, { gpBtnB: xboxBtn });
        expect(s).toContain('Restart');
        expect(s).toContain('↵');
    });

    it('keyboard-only: shows ↵ shortcut', () => {
        const t = makeT('en-us');
        const s = getRestartLabel(
            t,
            { hasGamepad: false, hasTouch: false, hasFineKeyboard: true },
            { gpBtnB: xboxBtn },
        );
        expect(s).toContain('↵');
    });

    it('produces non-empty restart labels for every supported locale', () => {
        for (const lang of LANGS) {
            const t = makeT(lang);
            const s = getRestartLabel(
                t,
                { hasGamepad: true, hasTouch: false, hasFineKeyboard: false },
                { gpBtnB: xboxBtn },
            );
            expect(s.length).toBeGreaterThan(0);
        }
    });
});
