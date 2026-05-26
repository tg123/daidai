import { describe, it, expect } from 'vitest';
import '../../src/game/projectiles.ts';

const { stepProjectile, isProjectileDead, projectileHits } = globalThis.DAIDAI;

const make = (over: Partial<{ x: number; z: number; dx: number; dz: number; life: number }> = {}) => ({
    x: 0, z: 0, dx: 0, dz: 0, life: 120,
    ...over,
});

describe('stepProjectile', () => {
    it('advances x and z by velocity and decrements life by 1', () => {
        const p = make({ x: 1, z: 2, dx: 0.4, dz: -0.3, life: 100 });
        stepProjectile(p);
        expect(p.x).toBeCloseTo(1.4);
        expect(p.z).toBeCloseTo(1.7);
        expect(p.life).toBe(99);
    });

    it('handles zero velocity (life still ticks)', () => {
        const p = make({ x: 5, z: 5, dx: 0, dz: 0, life: 10 });
        stepProjectile(p);
        expect(p.x).toBe(5);
        expect(p.z).toBe(5);
        expect(p.life).toBe(9);
    });

    it('120-frame straight-line trajectory accumulates predictably', () => {
        const p = make({ x: 0, z: 0, dx: 0.4, dz: 0, life: 120 });
        for (let i = 0; i < 10; i++) stepProjectile(p);
        expect(p.x).toBeCloseTo(4);
        expect(p.life).toBe(110);
    });
});

describe('isProjectileDead', () => {
    const COLS = 20, ROWS = 20, CELL = 1;

    it('returns false for fresh projectile inside bounds', () => {
        expect(isProjectileDead(make({ x: 10, z: 10 }), COLS, ROWS, CELL)).toBe(false);
    });

    it('returns true when life <= 0', () => {
        expect(isProjectileDead(make({ x: 10, z: 10, life: 0 }), COLS, ROWS, CELL)).toBe(true);
        expect(isProjectileDead(make({ x: 10, z: 10, life: -1 }), COLS, ROWS, CELL)).toBe(true);
    });

    it('returns true past left/right margin', () => {
        expect(isProjectileDead(make({ x: -2.1, z: 10 }), COLS, ROWS, CELL)).toBe(true);
        expect(isProjectileDead(make({ x: COLS * CELL + 2.1, z: 10 }), COLS, ROWS, CELL)).toBe(true);
    });

    it('returns true past top/bottom margin', () => {
        expect(isProjectileDead(make({ x: 10, z: -2.1 }), COLS, ROWS, CELL)).toBe(true);
        expect(isProjectileDead(make({ x: 10, z: ROWS * CELL + 2.1 }), COLS, ROWS, CELL)).toBe(true);
    });

    it('exactly at -margin is still alive (strict <)', () => {
        expect(isProjectileDead(make({ x: -2, z: 10 }), COLS, ROWS, CELL)).toBe(false);
    });

    it('respects custom margin', () => {
        expect(isProjectileDead(make({ x: -3, z: 10 }), COLS, ROWS, CELL, 5)).toBe(false);
        expect(isProjectileDead(make({ x: -3, z: 10 }), COLS, ROWS, CELL, 1)).toBe(true);
    });

    it('scales with cell size', () => {
        expect(isProjectileDead(make({ x: 18, z: 5 }), 10, 10, 2)).toBe(false);  // 18 < 10*2+2=22
        expect(isProjectileDead(make({ x: 23, z: 5 }), 10, 10, 2)).toBe(true);
    });
});

describe('projectileHits', () => {
    const CELL = 1;

    it('hits when within default 0.8 radius of cell center', () => {
        const p = make({ x: 5.2, z: 5.0 });
        expect(projectileHits(p, 5, 5, CELL)).toBe(true);
    });

    it('misses when outside 0.8 radius', () => {
        const p = make({ x: 6.0, z: 5.0 });
        expect(projectileHits(p, 5, 5, CELL)).toBe(false);
    });

    it('hits diagonally if within radius', () => {
        // distance = sqrt(0.5² + 0.5²) ≈ 0.707 < 0.8
        const p = make({ x: 5.5, z: 5.5 });
        expect(projectileHits(p, 5, 5, CELL)).toBe(true);
    });

    it('misses diagonally just outside radius', () => {
        // distance = sqrt(0.6² + 0.6²) ≈ 0.849 > 0.8
        const p = make({ x: 5.6, z: 5.6 });
        expect(projectileHits(p, 5, 5, CELL)).toBe(false);
    });

    it('respects custom radius', () => {
        const p = make({ x: 7, z: 5 });
        expect(projectileHits(p, 5, 5, CELL, 1.5)).toBe(false);
        expect(projectileHits(p, 5, 5, CELL, 2.5)).toBe(true);
    });

    it('scales with cell size (target at cellX*cell, cellY*cell)', () => {
        const p = make({ x: 10, z: 10 });
        expect(projectileHits(p, 5, 5, 2)).toBe(true);  // 5*2=10, dist=0
        expect(projectileHits(p, 5, 5, 1)).toBe(false); // 5*1=5, dist≈7.07
    });
});
