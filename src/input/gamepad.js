// Pure helpers for gamepad detection & button glyph mapping.
// No DOM, no window.* — safe to import in unit tests.
(function (g) {
    'use strict';

    const PS_PATTERN = /dualshock|dualsense|playstation|ps[345]|sony|054c/i;

    function isPlayStationGamepadId(id) {
        if (!id || typeof id !== 'string') return false;
        return PS_PATTERN.test(id);
    }

    function glyphForButton(btn, isPS) {
        if (isPS) {
            if (btn === 'A') return '✕';
            if (btn === 'B') return '◯';
            if (btn === 'X') return '☐';
            if (btn === 'Y') return '△';
        } else {
            if (btn === 'A') return 'Ⓐ';
            if (btn === 'B') return 'Ⓑ';
            if (btn === 'X') return 'Ⓧ';
            if (btn === 'Y') return 'Ⓨ';
        }
        return btn;
    }

    function detectConnectedGamepad(pads) {
        let connected = false;
        let isPS = false;
        if (!pads) return { connected, isPS };
        for (const p of pads) {
            if (!p || p.connected === false) continue;
            const id = ((p.id || '') + '').trim();
            if (!id) continue;
            connected = true;
            if (PS_PATTERN.test(id)) isPS = true;
        }
        return { connected, isPS };
    }

    function pickStartPromptKey(opts) {
        const o = opts || {};
        if (o.hasGamepad) return 'start.gamepad';
        if (o.hasTouchEnv && !o.hasFineKeyboardEnv) return 'start.touch';
        if (o.hasTouchEnv && o.hasFineKeyboardEnv) return 'start.both';
        return 'start.keyboard';
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.isPlayStationGamepadId = isPlayStationGamepadId;
    g.DAIDAI.glyphForButton = glyphForButton;
    g.DAIDAI.detectConnectedGamepad = detectConnectedGamepad;
    g.DAIDAI.pickStartPromptKey = pickStartPromptKey;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
