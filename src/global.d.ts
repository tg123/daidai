// Ambient declarations for non-standard / test-only browser globals.

export {};

declare global {
    interface Window {
        /** Set by Playwright via addInitScript to skip the loading screen. */
        __TEST_FAST_BOOT?: boolean;
        /** Webkit-prefixed AudioContext on older Safari. */
        webkitAudioContext?: typeof AudioContext;
        /** Eruda debug console — loaded only when ?debug is in the URL. */
        eruda?: { init: () => void };
        /** Test-only handles exposed by main.ts for E2E inspection. */
        __test?: Record<string, unknown>;

        /** Hook to re-render the restart button label after locale or input changes. */
        __refreshRestartBtnLabel?: () => void;
        /** Hook to refresh the lang-menu active state. */
        __updateLangBtnState?: () => void;
        /** Hook to repaint gamepad-aware hints in the HUD. */
        __applyGamepadGlyphs?: () => void;
        /** Hook to redraw the idle/paused prompt. */
        __refreshIdlePrompt?: () => void;
        /** Hook to mark the active input as gamepad. */
        __markGamepad?: () => void;
    }
}
