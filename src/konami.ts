// Konami cheat-code matcher. Built on top of createHeartMatcher (sliding
// window sequence matcher) with case-insensitive normalization so the final
// "b a" works regardless of caps-lock / Shift state.

export interface KonamiMatcher {
    /** Returns true exactly when the trailing window matches the Konami sequence. */
    push(key: string): boolean;
    reset(): void;
    readonly bufferLength: number;
}

(function (g: any) {
    'use strict';

    const KONAMI_SEQUENCE: readonly string[] = [
        'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'b', 'a',
    ];

    function createKonamiMatcher(): KonamiMatcher {
        const lowerSeq = KONAMI_SEQUENCE.map((k) => k.toLowerCase());
        const inner = g.DAIDAI.createHeartMatcher(lowerSeq);
        return {
            push(key: string): boolean {
                if (typeof key !== 'string' || key.length === 0) return false;
                return inner.push(key.toLowerCase());
            },
            reset() { inner.reset(); },
            get bufferLength() { return inner.bufferLength; },
        };
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.createKonamiMatcher = createKonamiMatcher;
    g.DAIDAI.KONAMI_SEQUENCE = KONAMI_SEQUENCE;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (this as any)));
