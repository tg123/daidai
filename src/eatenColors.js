// Pure queue that tracks which bean colors are currently visible on the
// snake's body segments (most-recent-first). No DOM, no rendering.
// Loaded as a classic <script> in the browser and side-effect-imported in Vitest.
(function (g) {
    'use strict';

    /**
     * Queue of bean color indices behind the snake's head.
     *   colorAt(0) → color of body segment immediately behind the head
     *   colorAt(1) → next segment, etc.
     *
     * Lifecycle:
     *   - recordEaten(color) on every bean eaten
     *   - trimAfterShed(initLen) when the green-magic shed shrinks the snake to initLen
     *   - trimAfterHalve(halfLen) when the purple-magic halve shrinks the snake to halfLen
     *   - reset() at game restart
     *   - colorAt(i) by the renderer
     *   - snapshot()/restore() for test inspection and state save/load
     */
    function createEatenColorsQueue(initial) {
        let q = Array.isArray(initial) ? initial.slice() : [];
        return {
            recordEaten(colorIdx) { q.unshift(colorIdx); },
            colorAt(i) { return q[i]; },
            trimToLength(n) { q = q.slice(0, Math.max(0, n | 0)); },
            // After shed: snake length resets to initLen, so we keep initLen-1
            // colors (the head itself has no entry in the queue).
            trimAfterShed(initLen) { q = q.slice(0, Math.max(0, (initLen | 0) - 1)); },
            // After halve: snake length is halfLen — same head-less indexing.
            trimAfterHalve(halfLen) { q = q.slice(0, Math.max(0, (halfLen | 0) - 1)); },
            snapshot() { return q.slice(); },
            restore(arr) { q = Array.isArray(arr) ? arr.slice() : []; },
            reset() { q = []; },
            get length() { return q.length; },
        };
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.createEatenColorsQueue = createEatenColorsQueue;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
