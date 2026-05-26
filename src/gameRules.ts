// Pure game-rules helpers: torus wrap, scoring, cell occupancy, random spawn.
// No DOM, no Three.js — fully testable with deterministic RNG.

export interface Cell {
    x: number;
    y: number;
}

export interface EatScoreOpts {
    isRaining?: boolean;
    isBoosted?: boolean;
    boostMultiplier?: number;
    godMode?: boolean;
}

/** Wrap a head position around a COLS×ROWS torus. */
export function wrapPosition(x: number, y: number, cols: number, rows: number): Cell {
    let nx = x,
        ny = y;
    if (nx < 0) nx = cols - 1;
    else if (nx >= cols) nx = 0;
    if (ny < 0) ny = rows - 1;
    else if (ny >= rows) ny = 0;
    return { x: nx, y: ny };
}

/**
 * Points awarded for eating one regular bean.
 *   base 5, +10 during blue rain, ×boostMultiplier during red boost,
 *   ×10 during god mode (rainbow). Order matches the legacy code:
 *   rain bonus is added BEFORE multipliers stack.
 */
export function eatScore(opts?: EatScoreOpts): number {
    const o = opts || {};
    let pts = 5;
    if (o.isRaining) pts += 10;
    if (o.isBoosted) {
        const m = Number(o.boostMultiplier);
        pts *= Number.isFinite(m) && m >= 1 ? Math.floor(m) : 1;
    }
    if (o.godMode) pts *= 10;
    return pts;
}

/**
 * Returns true when (x,y) is taken by any cell in any of the supplied lists.
 * Each list is an array of {x,y} objects (snake segments, beans, etc.).
 */
export function isCellOccupied(
    x: number,
    y: number,
    occupants: ReadonlyArray<ReadonlyArray<Cell> | null | undefined> | null | undefined,
): boolean {
    if (!occupants) return false;
    for (const list of occupants) {
        if (!list) continue;
        for (const c of list) {
            if (c && c.x === x && c.y === y) return true;
        }
    }
    return false;
}

/**
 * Picks a free cell on the COLS×ROWS grid avoiding `occupants`.
 * `rng` is a function returning a float in [0,1) — defaults to Math.random.
 * Returns null if no free cell was found in `maxAttempts` tries.
 */
export function findFreeCell(
    cols: number,
    rows: number,
    occupants: ReadonlyArray<ReadonlyArray<Cell> | null | undefined> | null | undefined,
    rng?: () => number,
    maxAttempts?: number | null,
): Cell | null {
    const r = typeof rng === 'function' ? rng : Math.random;
    const tries =
        maxAttempts === undefined || maxAttempts === null ? 100 : Math.max(0, Math.floor(Number(maxAttempts) || 0));
    for (let i = 0; i < tries; i++) {
        const x = Math.floor(r() * cols);
        const y = Math.floor(r() * rows);
        if (!isCellOccupied(x, y, occupants)) return { x, y };
    }
    return null;
}
