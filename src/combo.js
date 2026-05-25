// Pure combo (same-color streak) tracker.
// Counts consecutive eats of the same bean color; at THRESHOLD eats
// it signals "trigger magic" and resets the streak.
(function (g) {
    'use strict';

    const COMBO_THRESHOLD = 5;

    function createComboCounter(threshold) {
        const T = (threshold | 0) || COMBO_THRESHOLD;
        let color = -1;
        let count = 0;
        return {
            /**
             * Records one bean eaten of `colorIdx`. Returns true exactly
             * when the streak has just hit the magic threshold (caller
             * should fire magic of that color). On a trigger the counter
             * resets to its initial state.
             */
            recordEat(colorIdx) {
                if (colorIdx === color) {
                    count++;
                } else {
                    color = colorIdx;
                    count = 1;
                }
                if (count >= T) {
                    color = -1;
                    count = 0;
                    return true;
                }
                return false;
            },
            reset() { color = -1; count = 0; },
            get color() { return color; },
            get count() { return count; },
            set color(v) { color = v; },
            set count(v) { count = v; },
            snapshot() { return { color, count }; },
            restore(s) { color = s && s.color != null ? s.color : -1; count = s && s.count != null ? s.count : 0; },
        };
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.createComboCounter = createComboCounter;
    g.DAIDAI.COMBO_THRESHOLD = COMBO_THRESHOLD;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
