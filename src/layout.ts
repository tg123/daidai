// Pure layout math for the playfield: deciding grid dimensions for a given
// window size, and computing the orthographic-style camera distance that fits
// the whole pond into the visible viewport.
// No DOM, no THREE — both helpers take plain numbers so they can be unit-tested
// without a browser or WebGL context.

export interface GridDims {
    cols: number;
    rows: number;
}

export interface GridOptions {
    /** Inner window width in CSS pixels. */
    winW: number;
    /** Inner window height in CSS pixels. */
    winH: number;
    /** True for narrow / coarse-pointer devices (mobile-ish HUD reserves less). */
    isMobile?: boolean;
    /** Shortest grid side. Defaults to 22 (matches the original game tuning). */
    shortSide?: number;
    /** Hard upper bound to keep ultra-wide screens reasonable. Defaults to 60. */
    maxSide?: number;
    /** Floor for usable height after reserving the HUD bar. Defaults to 200. */
    minHeight?: number;
}

export interface CameraFitOptions {
    aspect: number;
    cols: number;
    rows: number;
    cell?: number; // world units per grid cell. Defaults to 1.0
    vFovDeg: number; // camera vertical FOV in degrees
    margin?: number; // 1.0 = exact fit, > 1 leaves a small border. Defaults to 1.02
    rim?: number; // extra world units padding outside the grid. Defaults to 0
}

export interface CameraFit {
    /** Camera Y (height above the pond center) so the whole grid is visible. */
    distance: number;
    /** World-space center X of the grid (where camera should look). */
    centerX: number;
    /** World-space center Z of the grid. */
    centerZ: number;
}

export function computeGridDims(opts: GridOptions): GridDims {
    const winW = Math.max(1, opts.winW | 0);
    const winH = Math.max(1, opts.winH | 0);
    const reservedTop = opts.isMobile ? 38 : 42;
    const minHeight = opts.minHeight ?? 200;
    const SHORT = opts.shortSide ?? 22;
    const MAX = opts.maxSide ?? 60;
    const h = Math.max(minHeight, winH - reservedTop);
    const aspect = winW / h;

    let cols: number;
    let rows: number;
    if (aspect >= 1) {
        rows = SHORT;
        cols = Math.max(SHORT, Math.round(SHORT * aspect));
    } else {
        cols = SHORT;
        rows = Math.max(SHORT, Math.round(SHORT / aspect));
    }
    cols = Math.min(MAX, cols);
    rows = Math.min(MAX, rows);
    return { cols, rows };
}

export function computeCameraFit(opts: CameraFitOptions): CameraFit {
    const cell = opts.cell ?? 1.0;
    const margin = opts.margin ?? 1.02;
    const rim = opts.rim ?? 0;
    const vFov = (opts.vFovDeg * Math.PI) / 180;
    const tanHalf = Math.tan(vFov / 2);
    const W = (opts.cols * cell + rim * 2) * margin;
    const H = (opts.rows * cell + rim * 2) * margin;
    const distForH = H / 2 / tanHalf;
    const distForW = W / 2 / (tanHalf * opts.aspect);
    const distance = Math.max(distForH, distForW);
    return {
        distance,
        centerX: ((opts.cols - 1) * cell) / 2,
        centerZ: ((opts.rows - 1) * cell) / 2,
    };
}
