import { describe, it, expect } from 'vitest';
import '../../src/gameRules.ts';

const { wrapPosition, eatScore, isCellOccupied, findFreeCell } = globalThis.DAIDAI;

describe('wrapPosition', () => {
    it('passes through in-bounds positions', () => {
        expect(wrapPosition(5, 7, 40, 30)).toEqual({ x: 5, y: 7 });
        expect(wrapPosition(0, 0, 40, 30)).toEqual({ x: 0, y: 0 });
    });
    it('wraps left/up off the grid', () => {
        expect(wrapPosition(-1, 5, 40, 30)).toEqual({ x: 39, y: 5 });
        expect(wrapPosition(5, -1, 40, 30)).toEqual({ x: 5, y: 29 });
    });
    it('wraps right/down off the grid', () => {
        expect(wrapPosition(40, 5, 40, 30)).toEqual({ x: 0, y: 5 });
        expect(wrapPosition(5, 30, 40, 30)).toEqual({ x: 5, y: 0 });
    });
});

describe('eatScore', () => {
    it('base value', () => {
        expect(eatScore({})).toBe(5);
    });
    it('rain bonus', () => {
        expect(eatScore({ isRaining: true })).toBe(15);
    });
    it('red boost multiplier', () => {
        expect(eatScore({ isBoosted: true, boostMultiplier: 2 })).toBe(10);
        expect(eatScore({ isBoosted: true, boostMultiplier: 8 })).toBe(40);
    });
    it('rain + boost stack as +10 then ×mult', () => {
        // (5 + 10) * 4 = 60
        expect(eatScore({ isRaining: true, isBoosted: true, boostMultiplier: 4 })).toBe(60);
    });
    it('god mode multiplies the whole thing by 10 last', () => {
        // (5) * 10 = 50
        expect(eatScore({ godMode: true })).toBe(50);
        // (5 + 10) * 2 * 10 = 300
        expect(eatScore({ isRaining: true, isBoosted: true, boostMultiplier: 2, godMode: true })).toBe(300);
    });
    it('defensive: missing multiplier treated as 1', () => {
        expect(eatScore({ isBoosted: true })).toBe(5);
    });
    it('large multiplier survives bitwise overflow (regression)', () => {
        expect(eatScore({ isBoosted: true, boostMultiplier: 2 ** 31 })).toBe(5 * (2 ** 31));
    });
    it('negative/NaN multiplier clamped to 1', () => {
        expect(eatScore({ isBoosted: true, boostMultiplier: -4 })).toBe(5);
        expect(eatScore({ isBoosted: true, boostMultiplier: NaN })).toBe(5);
    });
});

describe('isCellOccupied', () => {
    it('returns false when nothing occupies the cell', () => {
        expect(isCellOccupied(5, 5, [[{ x: 0, y: 0 }], [{ x: 1, y: 1 }]])).toBe(false);
    });
    it('returns true on a match in any list', () => {
        const snake = [{ x: 3, y: 3 }, { x: 3, y: 4 }];
        const beans = [{ x: 7, y: 7 }];
        expect(isCellOccupied(3, 4, [snake, beans])).toBe(true);
        expect(isCellOccupied(7, 7, [snake, beans])).toBe(true);
    });
    it('handles null/empty lists gracefully', () => {
        expect(isCellOccupied(0, 0, [null, [], undefined])).toBe(false);
        expect(isCellOccupied(0, 0, null)).toBe(false);
    });
});

describe('findFreeCell', () => {
    it('returns a free cell when one exists', () => {
        // Block everything except (2,2) with a 3x3 board.
        const occupied = [];
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
            if (!(x === 2 && y === 2)) occupied.push({ x, y });
        }
        // Deterministic rng cycling through all cells
        const seq = [0, 0, 0.5, 0.5, 0.9, 0.9];
        let i = 0;
        const rng = () => seq[i++ % seq.length];
        const cell = findFreeCell(3, 3, [occupied], rng, 50);
        expect(cell).toEqual({ x: 2, y: 2 });
    });
    it('returns null when board is full', () => {
        const board = [];
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) board.push({ x, y });
        const cell = findFreeCell(2, 2, [board], Math.random, 50);
        expect(cell).toBeNull();
    });
    it('respects maxAttempts', () => {
        const blocked = [{ x: 0, y: 0 }];
        expect(findFreeCell(10, 10, [blocked], () => 0, 5)).toBeNull();
    });
    it('honors maxAttempts=0 (no fallback to default)', () => {
        expect(findFreeCell(10, 10, [[]], Math.random, 0)).toBeNull();
    });
    it('falls back to Math.random when rng omitted', () => {
        const cell = findFreeCell(10, 10, [[]]);
        expect(cell).not.toBeNull();
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(10);
    });
});
