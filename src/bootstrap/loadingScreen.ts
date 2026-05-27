import type { AudioEngine } from '../audio/AudioEngine';

export type TFn = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Detect Playwright / `?test=1` fast-boot. When true, main.ts skips audio
 * preload gating and uses cheaper renderer settings to keep two parallel
 * headless WebGL pages from starving each other's rAF loop.
 */
export function detectFastBoot(): boolean {
    try {
        if (typeof window !== 'undefined' && window.__TEST_FAST_BOOT) return true;
        if (typeof location !== 'undefined' && location.search && /(?:^|[?&])test=1(?:&|$)/.test(location.search))
            return true;
    } catch (_) {
        /* ignore — feature detect only */
    }
    return false;
}

export interface LoadingScreenOpts {
    audio: AudioEngine;
    fastBoot: boolean;
    t: TFn;
}

/**
 * Install the loading-screen progress UI and tear it down once audio
 * preloading completes. Under fast-boot the screen is hidden immediately
 * and preload runs in the background (best-effort).
 */
export function installLoadingScreen({ audio, fastBoot, t }: LoadingScreenOpts): void {
    const screen = document.getElementById('loading-screen');
    const barInner = document.getElementById('loading-bar-inner');
    const pctEl = document.getElementById('loading-pct');
    const subEl = document.getElementById('loading-sub');
    if (!screen) return;
    if (fastBoot) {
        try {
            audio.preload().catch(() => {});
        } catch (_) {
            /* preload may throw synchronously on bad envs */
        }
        screen.classList.add('hidden');
        screen.remove();
        return;
    }
    audio.onProgress = (loaded, total, lastName) => {
        const pct = Math.round((loaded / total) * 100);
        if (barInner) barInner.style.width = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%  (' + loaded + '/' + total + ')';
        if (subEl && lastName) subEl.textContent = t('loading.fetching', { name: lastName });
    };
    const pendingTimer = setInterval(() => {
        if (audio.loaded >= audio.total) {
            clearInterval(pendingTimer);
            return;
        }
        const pending = Object.keys(audio.files).filter((n) => !audio.rawBuffers[n]);
        if (pending.length && subEl) {
            subEl.textContent = t('loading.waiting', {
                names: pending.slice(0, 3).join(', ') + (pending.length > 3 ? '…' : ''),
            });
        }
    }, 5000);
    function cleanup() {
        // Stop the pending-files poll and detach the progress callback so we
        // do not keep ticking (or holding references to detached DOM nodes)
        // after the loading screen is removed. Important under HMR.
        clearInterval(pendingTimer);
        audio.onProgress = null;
    }
    audio
        .preload()
        .then(() => {
            cleanup();
            if (subEl) subEl.textContent = t('loading.ready');
            if (barInner) barInner.style.width = '100%';
            if (pctEl) pctEl.textContent = '100%';
            setTimeout(() => {
                screen.classList.add('hidden');
                setTimeout(() => screen.remove(), 800);
            }, 250);
        })
        .catch((err) => {
            cleanup();
            console.warn('Preload error:', err);
            if (subEl) subEl.textContent = t('loading.failed');
            setTimeout(() => screen.classList.add('hidden'), 500);
        });
}
