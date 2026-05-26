import { describe, it, expect } from 'vitest';
import '../../src/heartSequence.ts';
import '../../src/konami.ts';

const { createKonamiMatcher, KONAMI_SEQUENCE } = globalThis.DAIDAI;

describe('createKonamiMatcher', () => {
    it('exposes the canonical Konami sequence', () => {
        expect(KONAMI_SEQUENCE).toEqual([
            'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
            'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
            'b', 'a',
        ]);
    });

    it('returns false until the full sequence has been pushed', () => {
        const m = createKonamiMatcher();
        const seq = KONAMI_SEQUENCE;
        for (let i = 0; i < seq.length - 1; i++) {
            expect(m.push(seq[i])).toBe(false);
        }
        expect(m.push(seq[seq.length - 1])).toBe(true);
    });

    it('is case-insensitive on the trailing letters', () => {
        const m = createKonamiMatcher();
        const seq = KONAMI_SEQUENCE.slice(0, -2);
        for (const k of seq) m.push(k);
        expect(m.push('B')).toBe(false);
        expect(m.push('A')).toBe(true);
    });

    it('clears its buffer after a successful match (consecutive matches need fresh sequences)', () => {
        const m = createKonamiMatcher();
        for (const k of KONAMI_SEQUENCE) m.push(k);
        expect(m.bufferLength).toBe(0);
        // Pushing just the final 'a' should not immediately re-trigger.
        expect(m.push('a')).toBe(false);
    });

    it('keeps a sliding window: a wrong key in the middle does not permanently break the match', () => {
        const m = createKonamiMatcher();
        // Pollute with a random key, then run the full sequence.
        m.push('z');
        for (let i = 0; i < KONAMI_SEQUENCE.length - 1; i++) {
            expect(m.push(KONAMI_SEQUENCE[i])).toBe(false);
        }
        expect(m.push(KONAMI_SEQUENCE[KONAMI_SEQUENCE.length - 1])).toBe(true);
    });

    it('ignores empty / non-string input', () => {
        const m = createKonamiMatcher();
        expect(m.push('')).toBe(false);
        expect(m.push(null as unknown as string)).toBe(false);
        expect(m.push(undefined as unknown as string)).toBe(false);
        // Still matches when valid keys arrive afterwards.
        for (let i = 0; i < KONAMI_SEQUENCE.length - 1; i++) m.push(KONAMI_SEQUENCE[i]);
        expect(m.push('a')).toBe(true);
    });

    it('reset() clears the buffer mid-sequence', () => {
        const m = createKonamiMatcher();
        for (let i = 0; i < 5; i++) m.push(KONAMI_SEQUENCE[i]);
        expect(m.bufferLength).toBe(5);
        m.reset();
        expect(m.bufferLength).toBe(0);
        // After reset, pushing only the last key should not match.
        expect(m.push('a')).toBe(false);
    });

    it('wrong key inside the sequence delays the match (window must slide past)', () => {
        const m = createKonamiMatcher();
        // Up Up Down [Down] but typo "x" then resume — the buffer cannot match
        // without re-running the full sequence from the start.
        m.push('ArrowUp');
        m.push('ArrowUp');
        m.push('ArrowDown');
        m.push('x'); // typo
        // Now finish the sequence — this should NOT trigger because the
        // buffer contains [Up Up Down x] followed by the rest.
        const tail = ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        let matched = false;
        for (const k of tail) matched = m.push(k) || matched;
        expect(matched).toBe(false);
        // But continuing with another full sequence should match.
        for (let i = 0; i < KONAMI_SEQUENCE.length - 1; i++) m.push(KONAMI_SEQUENCE[i]);
        expect(m.push('a')).toBe(true);
    });
});
