// Input-modality-aware prompt-string composition.
// Pure logic: given a translation function and a snapshot of which input
// devices are available, returns the appropriate prompt. Caller is responsible
// for dispatching the result to the DOM.
//
// The four modality buckets (in priority order):
//   1. gamepad detected  → gamepad-specific prompt
//   2. touch-only        → touch-specific prompt
//   3. touch + keyboard  → combined prompt
//   4. keyboard-only     → keyboard prompt

export interface InputModality {
    hasGamepad: boolean;
    hasTouch: boolean;
    /** True when a fine-pointer (mouse) + physical keyboard is plausible. */
    hasFineKeyboard: boolean;
}

/** Minimal translator shape we depend on. */
export type Translator = (key: string, params?: Record<string, unknown>) => string;

export interface RestartLabelDeps {
    /** Glyph for the gamepad "B"/Circle button at the current PS/Xbox glyph set. */
    gpBtnB: () => string;
}

(function (g: any) {
    'use strict';

    function getStartPrompt(t: Translator, m: InputModality): string {
        if (m.hasGamepad) return t('start.gamepad');
        if (m.hasTouch && !m.hasFineKeyboard) return t('start.touch');
        if (m.hasTouch && m.hasFineKeyboard) return t('start.both');
        return t('start.keyboard');
    }

    function getRestartLabel(t: Translator, m: InputModality, deps: RestartLabelDeps): string {
        if (m.hasGamepad) return t('hint.restartGamepad', { btn: deps.gpBtnB() });
        if (m.hasTouch && !m.hasFineKeyboard) return '⟳ ' + t('btn.restart');
        return t('hint.restartKey');
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.getStartPrompt = getStartPrompt;
    g.DAIDAI.getRestartLabel = getRestartLabel;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : (this as any));
