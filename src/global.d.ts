// Ambient declarations for non-standard / test-only browser globals.

export {};

declare global {
    /**
     * Compile-time flag injected by Vite (see vite.config.js `define`). True
     * in `vite dev` and PR-preview builds (DAIDAI_INCLUDE_CHEATS=1), false in
     * production main-branch builds. Gates the 1-6 keyboard cheat backdoor.
     */
    const __INCLUDE_CHEATS__: boolean;

    interface Window {
        /** Set by Playwright via addInitScript to skip the loading screen. */
        __TEST_FAST_BOOT?: boolean;
        /** Webkit-prefixed AudioContext on older Safari. */
        webkitAudioContext?: typeof AudioContext;
        /** Eruda debug console — loaded only when ?debug is in the URL. */
        eruda?: { init: () => void };
        /** Test-only handles exposed by main.ts for E2E inspection. */
        __test?: Record<string, unknown>;
    }
}
