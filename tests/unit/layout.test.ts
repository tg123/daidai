import { describe, it, expect } from 'vitest';
import { computeGridDims, computeCameraFit } from '../../src/layout';

describe('computeGridDims', () => {
    it('landscape: rows = SHORT, cols scales with aspect', () => {
        const g = computeGridDims({ winW: 1920, winH: 1080 });
        expect(g.rows).toBe(22);
        // visible h = 1080 - 42 = 1038; aspect = 1920/1038 ≈ 1.849; cols = round(22*1.849) = 41
        expect(g.cols).toBe(41);
    });

    it('portrait: cols = SHORT, rows scales with inverse aspect', () => {
        const g = computeGridDims({ winW: 600, winH: 1200 });
        expect(g.cols).toBe(22);
        // visible h = 1200-42 = 1158; aspect = 600/1158 ≈ 0.518; rows = round(22/0.518) = 42
        expect(g.rows).toBe(42);
    });

    it('square viewport falls into the landscape branch (aspect = 1)', () => {
        const g = computeGridDims({ winW: 1000, winH: 1042 });
        expect(g.rows).toBe(22);
        expect(g.cols).toBe(22);
    });

    it('mobile reserves less HUD height (38 vs 42)', () => {
        // Use a case where mobile produces a different result:
        // 200×500 viewport, portrait branch
        const d = computeGridDims({ winW: 200, winH: 500 });
        const m = computeGridDims({ winW: 200, winH: 500, isMobile: true });
        expect(d.cols).toBe(22);
        expect(m.cols).toBe(22);
        // rows_d = round(22 * (500-42) / 200) = round(22 * 458/200) = round(50.38) = 50
        // rows_m = round(22 * (500-38) / 200) = round(22 * 462/200) = round(50.82) = 51
        expect(d.rows).toBe(50);
        expect(m.rows).toBe(51);
    });

    it('caps both dimensions at maxSide (default 60)', () => {
        const g = computeGridDims({ winW: 10000, winH: 200 });
        expect(g.cols).toBe(60);
        expect(g.rows).toBe(22);
    });

    it('respects custom shortSide and maxSide', () => {
        const g = computeGridDims({ winW: 2000, winH: 500, shortSide: 10, maxSide: 30 });
        expect(g.rows).toBe(10);
        expect(g.cols).toBe(30); // would be ~44 unbounded, clamped to 30
    });

    it('handles tiny / zero / negative window sizes safely', () => {
        const z = computeGridDims({ winW: 0, winH: 0 });
        expect(z.cols).toBeGreaterThanOrEqual(22);
        expect(z.rows).toBeGreaterThanOrEqual(22);
        const n = computeGridDims({ winW: -100, winH: -100 });
        expect(n.cols).toBeGreaterThanOrEqual(22);
        expect(n.rows).toBeGreaterThanOrEqual(22);
    });

    it('minHeight floor prevents extreme aspect blow-up on tiny viewports', () => {
        // Without the floor, winH=50, reservedTop=42 → h=8 → aspect huge → rows would
        // shrink dramatically. With the floor, h is clamped to minHeight (200).
        const g = computeGridDims({ winW: 800, winH: 50 });
        // aspect = 800/200 = 4; cols = round(22*4) = 88 → clamped 60
        expect(g.rows).toBe(22);
        expect(g.cols).toBe(60);
    });
});

describe('computeCameraFit', () => {
    const baseSquare = { aspect: 1, cols: 22, rows: 22, vFovDeg: 50 };

    it('returns the grid center regardless of aspect/fov', () => {
        const f = computeCameraFit(baseSquare);
        expect(f.centerX).toBeCloseTo((22 - 1) / 2, 6);
        expect(f.centerZ).toBeCloseTo((22 - 1) / 2, 6);
    });

    it('square grid + square viewport: distForW == distForH', () => {
        const f = computeCameraFit(baseSquare);
        // H = 22*1*1.02 = 22.44; distForH = 22.44/2 / tan(25°) ≈ 24.06
        const expected = (22 * 1.02) / 2 / Math.tan((50 * Math.PI) / 360);
        expect(f.distance).toBeCloseTo(expected, 4);
    });

    it('landscape viewport: distance dominated by grid height (rows side)', () => {
        const f = computeCameraFit({ ...baseSquare, aspect: 2.0, cols: 44 });
        // With 2× wide aspect, horizontal extent (44 cells) is matched by viewport width.
        // Vertical needs distForH ≈ same as 22-cell square ⇒ ~24
        // Horizontal needs distForW = (44/2 * 1.02) / (tan(25°) * 2) ≈ 24.06
        // Both should be roughly equal.
        const tanHalf = Math.tan((50 * Math.PI) / 360);
        const distH = (22 * 1.02) / 2 / tanHalf;
        const distW = (44 * 1.02) / 2 / (tanHalf * 2);
        expect(f.distance).toBeCloseTo(Math.max(distH, distW), 4);
    });

    it('portrait viewport: distance dominated by grid width', () => {
        const f = computeCameraFit({ ...baseSquare, aspect: 0.5, rows: 44 });
        const tanHalf = Math.tan((50 * Math.PI) / 360);
        const distH = (44 * 1.02) / 2 / tanHalf;
        const distW = (22 * 1.02) / 2 / (tanHalf * 0.5);
        expect(f.distance).toBeCloseTo(Math.max(distH, distW), 4);
    });

    it('honors custom cell, margin, rim', () => {
        const tight = computeCameraFit({ ...baseSquare, margin: 1.0, rim: 0 });
        const loose = computeCameraFit({ ...baseSquare, margin: 1.5, rim: 2 });
        expect(loose.distance).toBeGreaterThan(tight.distance);
        const big = computeCameraFit({ ...baseSquare, cell: 2 });
        expect(big.distance).toBeCloseTo(tight.distance * 2 * 1.02, 4); // doubled cell ≈ doubled extent
        expect(big.centerX).toBeCloseTo(((22 - 1) * 2) / 2, 6);
    });

    it('smaller FOV → larger distance (need to step back further)', () => {
        const wide = computeCameraFit({ ...baseSquare, vFovDeg: 90 });
        const narrow = computeCameraFit({ ...baseSquare, vFovDeg: 30 });
        expect(narrow.distance).toBeGreaterThan(wide.distance);
    });
});

describe('iPhone-portrait full-window canvas (no gutter; HUD buttons float on top)', () => {
    // On mobile we render the canvas at the full window width and let the
    // pause/mute/lang buttons (position:fixed) float on top of the canvas.
    // An earlier "reserve a right-side strip" approach left a visible dark
    // bar on iPhone and was reverted; these tests pin the contract that
    // the canvas uses the full window width so it can't silently regress.
    it('full-window canvas keeps the grid identical to the unshrunk computation', () => {
        const full = computeGridDims({ winW: 390, winH: 844, isMobile: true });
        // Sanity: portrait short-side rule still kicks in.
        expect(full.cols).toBe(22);
        expect(full.rows).toBeGreaterThan(full.cols);
    });

    it('camera fit on the full-window aspect produces a finite, sensible distance and centered lookAt', () => {
        const winW = 390;
        const winH = 844;
        const grid = computeGridDims({ winW, winH, isMobile: true });
        const fit = computeCameraFit({
            aspect: winW / winH,
            cols: grid.cols,
            rows: grid.rows,
            vFovDeg: 50,
            margin: 1.02,
        });
        expect(Number.isFinite(fit.distance)).toBe(true);
        expect(fit.distance).toBeGreaterThan(10);
        // Camera looks at grid center — no horizontal offset, so the
        // perspective stays symmetric and the worm doesn't tilt at the
        // right wall.
        expect(fit.centerX).toBeCloseTo((grid.cols - 1) / 2, 6);
        expect(fit.centerZ).toBeCloseTo((grid.rows - 1) / 2, 6);
    });
});
