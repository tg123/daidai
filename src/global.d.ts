// Global ambient declarations for the DAIDAI namespace and test hooks.
// Modules attach helpers to `globalThis.DAIDAI`; the unit tests + main.js
// read them off that object.

export {};

declare global {
  interface DaidaiNamespace {
    [key: string]: any;
  }

  var DAIDAI: DaidaiNamespace;

  interface Window {
    DAIDAI: DaidaiNamespace;
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
