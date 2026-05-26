import { describe, it, expect } from 'vitest';
import { createComboCounter, COMBO_THRESHOLD } from '../../src/combo';

describe('createComboCounter', () => {
    it('starts with color=-1 / count=0', () => {
        const c = createComboCounter();
        expect(c.color).toBe(-1);
        expect(c.count).toBe(0);
    });
    it('increments on same color', () => {
        const c = createComboCounter();
        c.recordEat(2);
        c.recordEat(2);
        c.recordEat(2);
        expect(c.color).toBe(2);
        expect(c.count).toBe(3);
    });
    it('resets count on color change', () => {
        const c = createComboCounter();
        c.recordEat(2);
        c.recordEat(2);
        c.recordEat(3);
        expect(c.color).toBe(3);
        expect(c.count).toBe(1);
    });
    it('returns true on the 5th same-color eat and resets', () => {
        const c = createComboCounter();
        expect(c.recordEat(1)).toBe(false);
        expect(c.recordEat(1)).toBe(false);
        expect(c.recordEat(1)).toBe(false);
        expect(c.recordEat(1)).toBe(false);
        expect(c.recordEat(1)).toBe(true);
        expect(c.color).toBe(-1);
        expect(c.count).toBe(0);
    });
    it('respects custom threshold', () => {
        const c = createComboCounter(3);
        expect(c.recordEat(0)).toBe(false);
        expect(c.recordEat(0)).toBe(false);
        expect(c.recordEat(0)).toBe(true);
    });
    it('reset() clears state', () => {
        const c = createComboCounter();
        c.recordEat(2);
        c.recordEat(2);
        c.reset();
        expect(c.color).toBe(-1);
        expect(c.count).toBe(0);
    });
    it('snapshot()/restore() round-trip', () => {
        const c = createComboCounter();
        c.recordEat(4);
        c.recordEat(4);
        c.recordEat(4);
        const snap = c.snapshot();
        c.reset();
        c.restore(snap);
        expect(c.color).toBe(4);
        expect(c.count).toBe(3);
    });
    it('exposes COMBO_THRESHOLD = 5', () => {
        expect(COMBO_THRESHOLD).toBe(5);
    });
    it('rejects non-positive / non-finite thresholds and falls back to default', () => {
        for (const bad of [0, -1, -100, NaN, undefined, null, 'foo', Infinity, -Infinity]) {
            const c = createComboCounter(bad);
            // With a 5-eat fallback threshold, the first eat must NOT trigger.
            expect(c.recordEat(1)).toBe(false);
        }
    });
    it('floors fractional thresholds and never undershoots 1', () => {
        const c = createComboCounter(2.9);
        expect(c.recordEat(1)).toBe(false);
        expect(c.recordEat(1)).toBe(true); // floor(2.9) = 2
    });
});
