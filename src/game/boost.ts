// Pure boost-timer state. The red-magic combo triggers a temporary speed +
// score multiplier window. Each fresh trigger doubles the multiplier and
// refreshes the deadline. The timer itself is just a clock-driven state
// machine — sound effects, visuals, and the actual `speed` variable live in
// the caller.

export interface BoostTimer {
    readonly active: boolean;
    readonly multiplier: number;
    readonly deadline: number;
    /** Bump: activate, double the multiplier, set deadline = now + durationMs. */
    trigger(now: number, durationMs: number): void;
    /** True iff active AND the deadline has passed (caller decides what to do). */
    isExpired(now: number): boolean;
    /** Milliseconds until expiry. Returns 0 when not active or already expired. */
    remaining(now: number): number;
    /** Force-clear the timer (e.g. on game reset / end-of-boost). */
    reset(): void;
}

(function (g: any) {
    'use strict';

    function createBoostTimer(): BoostTimer {
        let active = false;
        let multiplier = 1;
        let deadline = 0;

        return {
            get active() { return active; },
            get multiplier() { return multiplier; },
            get deadline() { return deadline; },
            trigger(now: number, durationMs: number) {
                active = true;
                multiplier *= 2;
                deadline = now + durationMs;
            },
            isExpired(now: number) {
                return active && now >= deadline;
            },
            remaining(now: number) {
                if (!active) return 0;
                return Math.max(0, deadline - now);
            },
            reset() {
                active = false;
                multiplier = 1;
                deadline = 0;
            },
        };
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.createBoostTimer = createBoostTimer;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (this as any)));
