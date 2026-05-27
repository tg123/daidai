// Pure helpers for gamepad detection & button glyph mapping.
// No DOM, no window.* — safe to import in unit tests.

export interface GamepadLike {
    id?: string | null;
    connected?: boolean;
}

export interface DetectResult {
    connected: boolean;
    isPS: boolean;
}

export interface StartPromptOpts {
    hasGamepad?: boolean;
    hasTouchEnv?: boolean;
    hasFineKeyboardEnv?: boolean;
}

const PS_PATTERN = /dualshock|dualsense|playstation|ps[345]|sony|054c/i;

export function isPlayStationGamepadId(id: unknown): boolean {
    if (!id || typeof id !== 'string') return false;
    return PS_PATTERN.test(id);
}

export function glyphForButton(btn: string, isPS: boolean): string {
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

export function detectConnectedGamepad(
    pads: ReadonlyArray<GamepadLike | null | undefined> | null | undefined,
): DetectResult {
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

export function pickStartPromptKey(opts?: StartPromptOpts): string {
    const o = opts || {};
    if (o.hasGamepad) return 'start.gamepad';
    if (o.hasTouchEnv && !o.hasFineKeyboardEnv) return 'start.touch';
    if (o.hasTouchEnv && o.hasFineKeyboardEnv) return 'start.both';
    return 'start.keyboard';
}
