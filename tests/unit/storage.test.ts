import { describe, it, expect } from 'vitest';
import '../../src/storage.ts';

const { createHiScoreStorage, HI_SCORE_KEY } = globalThis.DAIDAI;

function memStorage(initial: Record<string, string> = {}): Storage {
    const data = { ...initial };
    return {
        get length() {
            return Object.keys(data).length;
        },
        clear() {
            for (const k of Object.keys(data)) delete data[k];
        },
        getItem(k: string) {
            return k in data ? data[k] : null;
        },
        key(i: number) {
            return Object.keys(data)[i] ?? null;
        },
        removeItem(k: string) {
            delete data[k];
        },
        setItem(k: string, v: string) {
            data[k] = String(v);
        },
    } as Storage;
}

function throwingStorage(mode: 'read' | 'write' | 'both'): Storage {
    return {
        get length() {
            return 0;
        },
        clear() {
            /* noop */
        },
        getItem() {
            if (mode !== 'write') throw new Error('boom-read');
            return null;
        },
        key() {
            return null;
        },
        removeItem() {
            /* noop */
        },
        setItem() {
            if (mode !== 'read') throw new Error('boom-write');
        },
    } as Storage;
}

describe('createHiScoreStorage', () => {
    it('returns 0 when no value has been stored', () => {
        const s = createHiScoreStorage(memStorage());
        expect(s.load()).toBe(0);
    });

    it('persists a valid score and reads it back', () => {
        const backing = memStorage();
        const s = createHiScoreStorage(backing);
        expect(s.save(42)).toBe(42);
        expect(s.load()).toBe(42);
        expect(backing.getItem(HI_SCORE_KEY)).toBe('42');
    });

    it('keeps the higher of stored vs incoming', () => {
        const s = createHiScoreStorage(memStorage());
        expect(s.save(100)).toBe(100);
        expect(s.save(50)).toBe(100);
        expect(s.save(150)).toBe(150);
        expect(s.load()).toBe(150);
    });

    it('treats corrupted values as 0', () => {
        const s1 = createHiScoreStorage(memStorage({ [HI_SCORE_KEY]: 'not-a-number' }));
        expect(s1.load()).toBe(0);
        const s2 = createHiScoreStorage(memStorage({ [HI_SCORE_KEY]: '' }));
        expect(s2.load()).toBe(0);
        const s3 = createHiScoreStorage(memStorage({ [HI_SCORE_KEY]: '-50' }));
        expect(s3.load()).toBe(0);
    });

    it('parses leading-numeric strings (parseInt semantics)', () => {
        const s = createHiScoreStorage(memStorage({ [HI_SCORE_KEY]: '99abc' }));
        expect(s.load()).toBe(99);
    });

    it('floors non-integer incoming scores', () => {
        const backing = memStorage();
        const s = createHiScoreStorage(backing);
        s.save(42.9);
        expect(s.load()).toBe(42);
    });

    it('ignores NaN / Infinity / negative on save', () => {
        const s = createHiScoreStorage(memStorage({ [HI_SCORE_KEY]: '10' }));
        expect(s.save(Number.NaN)).toBe(10);
        expect(s.save(Number.POSITIVE_INFINITY)).toBe(10);
        expect(s.save(-5)).toBe(10);
        expect(s.load()).toBe(10);
    });

    it('returns 0 when storage is unavailable (null)', () => {
        const s = createHiScoreStorage(null);
        expect(s.load()).toBe(0);
        expect(s.save(100)).toBe(0);
        expect(s.load()).toBe(0);
    });

    it('survives a getItem that throws (quota / SecurityError)', () => {
        const s = createHiScoreStorage(throwingStorage('read'));
        expect(s.load()).toBe(0);
    });

    it('survives a setItem that throws (quota exceeded)', () => {
        const s = createHiScoreStorage(throwingStorage('write'));
        // load() returns 0; write throws; caller sees 0 (nothing persisted).
        expect(s.save(123)).toBe(0);
    });

    it('uses the documented key', () => {
        expect(HI_SCORE_KEY).toBe('daidai_hiscore');
    });
});
