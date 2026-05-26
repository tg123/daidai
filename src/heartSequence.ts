// Pure heart-pattern matcher (no DOM, no globals beyond DAIDAI namespace).
// Loaded as an ES module (<script type="module">) in the browser and side-effect-imported in Vitest.

export interface HeartMatcher {
    push(key: string): boolean;
    reset(): void;
    readonly bufferLength: number;
}

(function (g: any) {
    'use strict';

    /**
     * Sliding-window sequence matcher. Push one key per keydown event;
     * push() returns true exactly when the trailing window matches `seq`.
     * On a successful match the internal buffer is cleared so consecutive
     * matches require a fresh sequence.
     *
     * The matcher is intentionally generic — the call site decides which
     * key events are even fed in (e.g. arrow-only keys for the heart code).
     */
    function createHeartMatcher(seq?: readonly string[]): HeartMatcher {
        if (!Array.isArray(seq) || seq.length === 0) {
            throw new Error('createHeartMatcher: seq must be a non-empty array');
        }
        let buf: string[] = [];
        return {
            push(key: string): boolean {
                buf.push(key);
                if (buf.length > seq.length) buf.shift();
                if (buf.length === seq.length && buf.every((k, i) => k === seq[i])) {
                    buf = [];
                    return true;
                }
                return false;
            },
            reset() {
                buf = [];
            },
            get bufferLength() {
                return buf.length;
            },
        };
    }

    // The "heart" cheat: four CW circles drawn with the arrow keys.
    const HEART_SEQUENCE: readonly string[] = [
        'ArrowDown',
        'ArrowRight',
        'ArrowUp',
        'ArrowLeft',
        'ArrowDown',
        'ArrowRight',
        'ArrowUp',
        'ArrowLeft',
        'ArrowDown',
        'ArrowRight',
        'ArrowUp',
        'ArrowLeft',
        'ArrowDown',
        'ArrowRight',
        'ArrowUp',
        'ArrowLeft',
    ];

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.createHeartMatcher = createHeartMatcher;
    g.DAIDAI.HEART_SEQUENCE = HEART_SEQUENCE;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : (this as any));
