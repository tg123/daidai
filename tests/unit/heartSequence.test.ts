import { describe, it, expect } from 'vitest';
import { createHeartMatcher, HEART_SEQUENCE } from '../../src/heartSequence';

describe('createHeartMatcher', () => {
    it('throws on empty/invalid sequences', () => {
        expect(() => createHeartMatcher()).toThrow();
        expect(() => createHeartMatcher([])).toThrow();
        // @ts-expect-error - exercising the runtime guard against non-array input
        expect(() => createHeartMatcher('abc')).toThrow();
    });

    it('returns false until the full sequence is buffered', () => {
        const m = createHeartMatcher(['a', 'b', 'c']);
        expect(m.push('a')).toBe(false);
        expect(m.push('b')).toBe(false);
        expect(m.push('c')).toBe(true);
    });

    it('clears the buffer on a successful match', () => {
        const m = createHeartMatcher(['a', 'b']);
        expect(m.push('a')).toBe(false);
        expect(m.push('b')).toBe(true);
        // Same sequence required again for the next match.
        expect(m.push('b')).toBe(false);
        expect(m.push('a')).toBe(false);
        expect(m.push('b')).toBe(true);
    });

    it('slides the window when wrong keys are pushed', () => {
        const m = createHeartMatcher(['a', 'b', 'c']);
        m.push('x');
        m.push('y');
        m.push('z'); // junk
        expect(m.push('a')).toBe(false);
        expect(m.push('b')).toBe(false);
        expect(m.push('c')).toBe(true);
    });

    it('rejects partial matches at the wrong offset', () => {
        const m = createHeartMatcher(['a', 'b', 'c']);
        // 'a','b' is a prefix, but a 'd' breaks it.
        m.push('a');
        m.push('b');
        m.push('d');
        expect(m.push('a')).toBe(false);
        expect(m.push('b')).toBe(false);
        expect(m.push('c')).toBe(true);
    });

    it('reset() empties the buffer', () => {
        const m = createHeartMatcher(['a', 'b']);
        m.push('a');
        expect(m.bufferLength).toBe(1);
        m.reset();
        expect(m.bufferLength).toBe(0);
        expect(m.push('b')).toBe(false); // no longer a partial match
    });

    it('matches the canonical 16-key heart pattern exactly', () => {
        const m = createHeartMatcher(HEART_SEQUENCE);
        const results = HEART_SEQUENCE.map((k) => m.push(k));
        expect(results.slice(0, -1).every((r) => r === false)).toBe(true);
        expect(results[results.length - 1]).toBe(true);
    });

    it('HEART_SEQUENCE is the documented 16-step cw arrow loop ×4', () => {
        expect(HEART_SEQUENCE).toHaveLength(16);
        const oneLap = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
        for (let lap = 0; lap < 4; lap++) {
            expect(HEART_SEQUENCE.slice(lap * 4, lap * 4 + 4)).toEqual(oneLap);
        }
    });

    it('does not match an arbitrary 16-key sequence', () => {
        const m = createHeartMatcher(HEART_SEQUENCE);
        const noisy = Array(16).fill('ArrowUp');
        let matched = false;
        for (const k of noisy) if (m.push(k)) matched = true;
        expect(matched).toBe(false);
    });
});
