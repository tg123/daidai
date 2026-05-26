// Pure direction / input-vector helpers shared by keyboard, touch & gamepad.
// No DOM.

export interface Dir2 {
    x: number;
    y: number;
}

type HeldKeys = Set<string> | { has?: (k: string) => boolean; [key: string]: unknown };

const KEY_TO_DIR: Record<string, Dir2> = {
    ArrowUp: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    W: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    S: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    A: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
    D: { x: 1, y: 0 },
};

/** Returns `{x,y}` for a movement key, or null. */
export function keyToDirection(key: string): Dir2 | null {
    return KEY_TO_DIR[key] || null;
}

/**
 * Combines a set of currently-held movement keys into a single
 * direction vector, supporting 8-way diagonals.
 * Returns null when no movement key is held.
 */
export function combineHeldDir(heldKeys: HeldKeys | null | undefined): Dir2 | null {
    const has = (k: string): boolean => {
        if (!heldKeys) return false;
        const set = heldKeys as Set<string>;
        if (typeof set.has === 'function') return set.has(k);
        return Boolean((heldKeys as Record<string, unknown>)[k]);
    };
    let dx = 0,
        dy = 0;
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
export function classifyDelta(dx: number, dy: number): Dir2 | null {
    const ax = Math.abs(dx),
        ay = Math.abs(dy);
    if (!ax && !ay) return null;
    const max = Math.max(ax, ay),
        min = Math.min(ax, ay);
    let ndx = 0,
        ndy = 0;
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
export function isOppositeDir(current: Dir2 | null, next: Dir2 | null): boolean {
    if (!current || !next) return false;
    return next.x === -current.x && next.y === -current.y;
}
