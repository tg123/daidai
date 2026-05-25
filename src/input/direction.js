// Pure direction / input-vector helpers shared by keyboard, touch & gamepad.
// No DOM, no globals beyond the DAIDAI namespace.
(function (g) {
    'use strict';

    const KEY_TO_DIR = {
        'ArrowUp':    { x: 0, y: -1 },
        'w':          { x: 0, y: -1 },
        'W':          { x: 0, y: -1 },
        'ArrowDown':  { x: 0, y:  1 },
        's':          { x: 0, y:  1 },
        'S':          { x: 0, y:  1 },
        'ArrowLeft':  { x: -1, y: 0 },
        'a':          { x: -1, y: 0 },
        'A':          { x: -1, y: 0 },
        'ArrowRight': { x: 1, y:  0 },
        'd':          { x: 1, y:  0 },
        'D':          { x: 1, y:  0 },
    };

    /** Returns `{x,y}` for a movement key, or null. */
    function keyToDirection(key) {
        return KEY_TO_DIR[key] || null;
    }

    /**
     * Combines a set of currently-held movement keys into a single
     * direction vector, supporting 8-way diagonals.
     * Returns null when no movement key is held.
     */
    function combineHeldDir(heldKeys) {
        const has = (k) => heldKeys && (typeof heldKeys.has === 'function' ? heldKeys.has(k) : heldKeys[k]);
        let dx = 0, dy = 0;
        if (has('ArrowUp') || has('w') || has('W')) dy = -1;
        else if (has('ArrowDown') || has('s') || has('S')) dy = 1;
        if (has('ArrowLeft') || has('a') || has('A')) dx = -1;
        else if (has('ArrowRight') || has('d') || has('D')) dx = 1;
        if (!dx && !dy) return null;
        return { x: dx, y: dy };
    }

    /**
     * Maps a 2D delta (swipe / analog-stick) into a discrete direction.
     * If the smaller component is ≥ 50% of the larger, the result is
     * diagonal (both axes set). Otherwise the dominant axis wins.
     * Returns null for a zero delta.
     */
    function classifyDelta(dx, dy) {
        const ax = Math.abs(dx), ay = Math.abs(dy);
        if (!ax && !ay) return null;
        const max = Math.max(ax, ay), min = Math.min(ax, ay);
        let ndx = 0, ndy = 0;
        if (max > 0 && min / max >= 0.5) {
            ndx = dx > 0 ? 1 : -1;
            ndy = dy > 0 ? 1 : -1;
        } else if (ax > ay) {
            ndx = dx > 0 ? 1 : -1;
        } else {
            ndy = dy > 0 ? 1 : -1;
        }
        return { x: ndx, y: ndy };
    }

    /** True when `next` would reverse `current` 180°. */
    function isOpposite(current, next) {
        if (!current || !next) return false;
        return next.x === -current.x && next.y === -current.y;
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.keyToDirection = keyToDirection;
    g.DAIDAI.combineHeldDir = combineHeldDir;
    g.DAIDAI.classifyDelta = classifyDelta;
    g.DAIDAI.isOppositeDir = isOpposite;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
