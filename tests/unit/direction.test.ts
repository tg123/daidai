import { describe, it, expect } from 'vitest';
import '../../src/input/direction.ts';

const { keyToDirection, combineHeldDir, classifyDelta, isOppositeDir } = globalThis.DAIDAI;

describe('keyToDirection', () => {
    it('maps arrow keys', () => {
        expect(keyToDirection('ArrowUp')).toEqual({ x: 0, y: -1 });
        expect(keyToDirection('ArrowDown')).toEqual({ x: 0, y: 1 });
        expect(keyToDirection('ArrowLeft')).toEqual({ x: -1, y: 0 });
        expect(keyToDirection('ArrowRight')).toEqual({ x: 1, y: 0 });
    });
    it('maps WASD (both cases)', () => {
        expect(keyToDirection('w')).toEqual({ x: 0, y: -1 });
        expect(keyToDirection('W')).toEqual({ x: 0, y: -1 });
        expect(keyToDirection('s')).toEqual({ x: 0, y: 1 });
        expect(keyToDirection('A')).toEqual({ x: -1, y: 0 });
        expect(keyToDirection('d')).toEqual({ x: 1, y: 0 });
    });
    it('returns null for unrelated keys', () => {
        expect(keyToDirection('Space')).toBeNull();
        expect(keyToDirection('Enter')).toBeNull();
        expect(keyToDirection('')).toBeNull();
    });
});

describe('combineHeldDir', () => {
    it('returns null when nothing held', () => {
        expect(combineHeldDir(new Set())).toBeNull();
        expect(combineHeldDir(null)).toBeNull();
    });
    it('single axis', () => {
        expect(combineHeldDir(new Set(['ArrowUp']))).toEqual({ x: 0, y: -1 });
        expect(combineHeldDir(new Set(['d']))).toEqual({ x: 1, y: 0 });
    });
    it('two axes → diagonal', () => {
        expect(combineHeldDir(new Set(['ArrowUp', 'ArrowRight']))).toEqual({ x: 1, y: -1 });
        expect(combineHeldDir(new Set(['s', 'a']))).toEqual({ x: -1, y: 1 });
    });
    it('conflicting same-axis keys: first one wins via else-if priority', () => {
        // ArrowUp and ArrowDown both held → up wins (else-if order)
        expect(combineHeldDir(new Set(['ArrowUp', 'ArrowDown']))).toEqual({ x: 0, y: -1 });
        expect(combineHeldDir(new Set(['ArrowLeft', 'ArrowRight']))).toEqual({ x: -1, y: 0 });
    });
    it('accepts plain object as well as Set', () => {
        expect(combineHeldDir({ ArrowRight: true })).toEqual({ x: 1, y: 0 });
    });
});

describe('classifyDelta', () => {
    it('zero delta → null', () => {
        expect(classifyDelta(0, 0)).toBeNull();
    });
    it('clear cardinal swipes', () => {
        expect(classifyDelta(100, 5)).toEqual({ x: 1, y: 0 }); // right
        expect(classifyDelta(-50, 0)).toEqual({ x: -1, y: 0 }); // left
        expect(classifyDelta(0, -200)).toEqual({ x: 0, y: -1 }); // up
        expect(classifyDelta(2, 80)).toEqual({ x: 0, y: 1 }); // down
    });
    it('diagonal when minor ≥ 50% of major', () => {
        expect(classifyDelta(100, 50)).toEqual({ x: 1, y: 1 });
        expect(classifyDelta(-80, 60)).toEqual({ x: -1, y: 1 });
        expect(classifyDelta(40, -100)).toEqual({ x: 0, y: -1 });
    });
    it('not diagonal when minor < 50% of major', () => {
        expect(classifyDelta(100, 49)).toEqual({ x: 1, y: 0 });
        expect(classifyDelta(49, -100)).toEqual({ x: 0, y: -1 });
    });
    it('45° boundary (min/max = 0.5 exactly) is diagonal', () => {
        expect(classifyDelta(10, 5)).toEqual({ x: 1, y: 1 });
    });
});

describe('isOppositeDir', () => {
    it('true for exact 180°', () => {
        expect(isOppositeDir({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe(true);
        expect(isOppositeDir({ x: 0, y: -1 }, { x: 0, y: 1 })).toBe(true);
        expect(isOppositeDir({ x: 1, y: 1 }, { x: -1, y: -1 })).toBe(true);
    });
    it('false for same / perpendicular / null', () => {
        expect(isOppositeDir({ x: 1, y: 0 }, { x: 1, y: 0 })).toBe(false);
        expect(isOppositeDir({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(false);
        expect(isOppositeDir({ x: 1, y: 0 }, { x: -1, y: 1 })).toBe(false);
        expect(isOppositeDir(null, { x: 1, y: 0 })).toBe(false);
        expect(isOppositeDir({ x: 1, y: 0 }, null)).toBe(false);
    });
});
