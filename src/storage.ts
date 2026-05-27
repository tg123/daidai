// Persistent hi-score storage. Wraps localStorage with best-effort semantics:
// any read/write error returns/keeps the default value rather than crashing.
// No DOM, no rendering.

export interface HiScoreStorage {
    load(): number;
    save(score: number): number;
}

export const HI_SCORE_KEY = 'daidai_hiscore';

export function createHiScoreStorage(storage?: Storage | null): HiScoreStorage {
    // Resolve lazily so tests can pass a mock and the browser falls back to
    // localStorage when available.
    function getStore(): Storage | null {
        if (storage !== undefined) return storage;
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch {
            return null;
        }
    }

    function load(): number {
        const s = getStore();
        if (!s) return 0;
        try {
            const raw = s.getItem(HI_SCORE_KEY);
            if (raw == null) return 0;
            const n = parseInt(raw, 10);
            return Number.isFinite(n) && n > 0 ? n : 0;
        } catch {
            return 0;
        }
    }

    function save(score: number): number {
        const cur = load();
        const next = Number.isFinite(score) && score > cur ? Math.floor(score) : cur;
        if (next === cur) return cur;
        const s = getStore();
        if (!s) return cur;
        try {
            s.setItem(HI_SCORE_KEY, String(next));
            return next;
        } catch {
            return cur;
        }
    }

    return { load, save };
}
