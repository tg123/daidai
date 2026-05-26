import { describe, it, expect } from 'vitest';
import '../../src/game/boost.ts';

const { createBoostTimer } = globalThis.DAIDAI;

describe('createBoostTimer', () => {
    it('starts inactive with multiplier=1', () => {
        const b = createBoostTimer();
        expect(b.active).toBe(false);
        expect(b.multiplier).toBe(1);
        expect(b.deadline).toBe(0);
    });

    it('trigger sets active, doubles multiplier, schedules deadline', () => {
        const b = createBoostTimer();
        b.trigger(1000, 15000);
        expect(b.active).toBe(true);
        expect(b.multiplier).toBe(2);
        expect(b.deadline).toBe(16000);
    });

    it('consecutive triggers stack the multiplier (2x → 4x → 8x …)', () => {
        const b = createBoostTimer();
        b.trigger(1000, 15000);
        expect(b.multiplier).toBe(2);
        b.trigger(2000, 15000);
        expect(b.multiplier).toBe(4);
        b.trigger(3000, 15000);
        expect(b.multiplier).toBe(8);
    });

    it('each trigger refreshes the deadline (sliding 15s window)', () => {
        const b = createBoostTimer();
        b.trigger(1000, 15000);
        expect(b.deadline).toBe(16000);
        b.trigger(10000, 15000); // 10s later, before previous expiry
        expect(b.deadline).toBe(25000); // pushed out, not stacked
    });

    it('isExpired is false while active and before deadline', () => {
        const b = createBoostTimer();
        b.trigger(1000, 15000);
        expect(b.isExpired(5000)).toBe(false);
        expect(b.isExpired(15999)).toBe(false);
    });

    it('isExpired becomes true exactly at deadline (>=)', () => {
        const b = createBoostTimer();
        b.trigger(1000, 15000);
        expect(b.isExpired(16000)).toBe(true);
        expect(b.isExpired(20000)).toBe(true);
    });

    it('isExpired is false when inactive (even at huge times)', () => {
        const b = createBoostTimer();
        expect(b.isExpired(0)).toBe(false);
        expect(b.isExpired(1e9)).toBe(false);
    });

    it('remaining returns ms until deadline, clamped to 0', () => {
        const b = createBoostTimer();
        b.trigger(1000, 15000);
        expect(b.remaining(1000)).toBe(15000);
        expect(b.remaining(8000)).toBe(8000);
        expect(b.remaining(16000)).toBe(0); // exactly at deadline
        expect(b.remaining(20000)).toBe(0); // past deadline
    });

    it('remaining is 0 when inactive', () => {
        const b = createBoostTimer();
        expect(b.remaining(123)).toBe(0);
    });

    it('reset returns to the initial state and clears multiplier accumulation', () => {
        const b = createBoostTimer();
        b.trigger(1000, 15000);
        b.trigger(2000, 15000);
        expect(b.multiplier).toBe(4);
        b.reset();
        expect(b.active).toBe(false);
        expect(b.multiplier).toBe(1);
        expect(b.deadline).toBe(0);
        // After reset, a fresh trigger starts at 2× again (not 8×).
        b.trigger(10000, 15000);
        expect(b.multiplier).toBe(2);
    });

    it('typical lifecycle: trigger → tick → expire → reset', () => {
        const b = createBoostTimer();
        b.trigger(0, 15000);
        expect(b.active).toBe(true);
        for (let now = 0; now < 15000; now += 1000) {
            expect(b.isExpired(now)).toBe(false);
        }
        expect(b.isExpired(15000)).toBe(true);
        b.reset();
        expect(b.active).toBe(false);
    });
});
