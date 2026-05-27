import { describe, it, expect } from 'vitest';
import { createEatenColorsQueue } from '../../src/eatenColors';

describe('createEatenColorsQueue', () => {
    it('starts empty by default', () => {
        const q = createEatenColorsQueue();
        expect(q.length).toBe(0);
        expect(q.snapshot()).toEqual([]);
        expect(q.colorAt(0)).toBeUndefined();
    });

    it('seeds from an initial array (and snapshots are decoupled)', () => {
        const seed = [1, 2, 3];
        const q = createEatenColorsQueue(seed);
        expect(q.snapshot()).toEqual([1, 2, 3]);
        seed.push(99); // mutating seed must not affect the queue
        expect(q.snapshot()).toEqual([1, 2, 3]);
        const snap = q.snapshot();
        snap.push(42); // mutating snapshot must not affect the queue
        expect(q.snapshot()).toEqual([1, 2, 3]);
    });

    it('recordEaten pushes to the FRONT (most-recent first)', () => {
        const q = createEatenColorsQueue();
        q.recordEaten(0);
        q.recordEaten(1);
        q.recordEaten(2);
        expect(q.snapshot()).toEqual([2, 1, 0]);
        expect(q.colorAt(0)).toBe(2);
        expect(q.colorAt(1)).toBe(1);
        expect(q.colorAt(2)).toBe(0);
    });

    it('trimToLength keeps only the n most-recent entries', () => {
        const q = createEatenColorsQueue([5, 4, 3, 2, 1]);
        q.trimToLength(3);
        expect(q.snapshot()).toEqual([5, 4, 3]);
        q.trimToLength(0);
        expect(q.snapshot()).toEqual([]);
        q.restore([1, 2, 3]);
        q.trimToLength(-5); // negative clamps to 0
        expect(q.snapshot()).toEqual([]);
    });

    it('trimAfterShed keeps initLen-1 colors (head has no queue entry)', () => {
        const q = createEatenColorsQueue([10, 11, 12, 13, 14, 15]);
        q.trimAfterShed(5); // snake resets to 5 segments → 4 colored body segments
        expect(q.snapshot()).toEqual([10, 11, 12, 13]);

        q.restore([10, 11, 12]);
        q.trimAfterShed(1); // only head
        expect(q.snapshot()).toEqual([]);

        q.restore([10, 11]);
        q.trimAfterShed(0); // edge: safe
        expect(q.snapshot()).toEqual([]);
    });

    it('trimAfterHalve mirrors trimAfterShed for the halve magic', () => {
        const q = createEatenColorsQueue([1, 2, 3, 4, 5, 6, 7, 8]);
        q.trimAfterHalve(5);
        expect(q.snapshot()).toEqual([1, 2, 3, 4]);
        q.restore([1, 2, 3]);
        q.trimAfterHalve(3);
        expect(q.snapshot()).toEqual([1, 2]);
    });

    it('reset() clears the queue', () => {
        const q = createEatenColorsQueue([1, 2, 3]);
        q.reset();
        expect(q.length).toBe(0);
        expect(q.snapshot()).toEqual([]);
    });

    it('restore() replaces the queue with a copy of the input', () => {
        const q = createEatenColorsQueue([1]);
        const next = [9, 8, 7];
        q.restore(next);
        expect(q.snapshot()).toEqual([9, 8, 7]);
        next.push(0);
        expect(q.snapshot()).toEqual([9, 8, 7]); // decoupled copy
        q.restore(undefined);
        expect(q.snapshot()).toEqual([]);
        q.restore(null);
        expect(q.snapshot()).toEqual([]);
    });

    it('length tracks the queue size after each mutation', () => {
        const q = createEatenColorsQueue();
        expect(q.length).toBe(0);
        q.recordEaten(0);
        q.recordEaten(1);
        expect(q.length).toBe(2);
        q.trimToLength(1);
        expect(q.length).toBe(1);
        q.reset();
        expect(q.length).toBe(0);
    });

    it('typical gameplay: eat 5 beans → shed → eat 2 → halve', () => {
        const q = createEatenColorsQueue();
        [0, 1, 2, 3, 4].forEach((c) => q.recordEaten(c));
        expect(q.snapshot()).toEqual([4, 3, 2, 1, 0]);
        q.trimAfterShed(5);
        expect(q.snapshot()).toEqual([4, 3, 2, 1]);
        q.recordEaten(2);
        q.recordEaten(3);
        expect(q.snapshot()).toEqual([3, 2, 4, 3, 2, 1]);
        q.trimAfterHalve(3);
        expect(q.snapshot()).toEqual([3, 2]);
    });
});
