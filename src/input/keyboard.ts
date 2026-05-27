import type { AudioEngine } from '../audio/AudioEngine';
import type { createHeartMatcher } from '../heartSequence';
import type { createKonamiMatcher } from '../konami';
import { combineHeldDir as combineHeldDirImpl, isOppositeDir, keyToDirection } from './direction';

type Dir = { x: number; y: number };

export interface KeyboardDeps {
    audio: AudioEngine;
    t: (key: string, vars?: Record<string, unknown>) => string;
    showMessage: (m: string) => void;
    showEffect: (m: string) => void;
    konamiMatcher: ReturnType<typeof createKonamiMatcher>;
    heartMatcher: ReturnType<typeof createHeartMatcher>;
    activateGodMode: () => void;
    spawnMeteorShower: () => void;
    activateTribute: () => void;
    triggerMagic: (colorIdx: number) => void;
    initGame: () => void;
    getGameOver: () => boolean;
    getPaused: () => boolean;
    setPaused: (p: boolean) => void;
    isDevtoolsOpen: () => boolean;
    getDirection: () => Dir;
    setNextDirection: (d: Dir) => void;
    incrementGrowthPending: () => void;
}

export interface KeyboardControls {
    resetTypedBuf: () => void;
    combineHeldDir: () => Dir | null;
}

export function installKeyboardControls(deps: KeyboardDeps): KeyboardControls {
    let typedBuf = '';
    const heldDirKeys = new Set<string>();

    function combineHeldDir(): Dir | null {
        return combineHeldDirImpl(heldDirKeys);
    }

    document.addEventListener('keydown', (e) => {
        deps.audio.init();

        // ----- Easter eggs (always-on capture) -----
        // 1) Konami code → 樊一鹏模式
        if (deps.konamiMatcher.push(e.key)) {
            deps.activateGodMode();
        }
        // 2) Type "daidai" → meteor shower
        if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
            typedBuf = (typedBuf + e.key.toLowerCase()).slice(-6);
            if (typedBuf === 'daidai') {
                typedBuf = '';
                deps.spawnMeteorShower();
            }
        }
        // 5) Heart pattern → tribute
        const arrowOnly = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (arrowOnly.includes(e.key)) {
            if (deps.heartMatcher.push(e.key)) {
                deps.activateTribute();
            }
        }

        if (e.key === 'Enter' && (deps.getGameOver() || deps.getPaused())) {
            deps.audio.init();
            deps.initGame();
            deps.setPaused(false);
            deps.showMessage('');
            const bp = document.getElementById('btn-pause');
            if (bp) bp.textContent = '⏸';
            return;
        }
        if (e.key === ' ') {
            if (deps.getGameOver()) {
                e.preventDefault();
                return;
            }
            const next = !deps.getPaused();
            deps.setPaused(next);
            deps.showMessage(next ? deps.t('paused') : '');
            const bp = document.getElementById('btn-pause');
            if (bp) bp.textContent = next ? '▶' : '⏸';
            e.preventDefault();
            return;
        }
        // Cheat backdoor (1-5 magic, 6 grow body) is gated by
        // `__INCLUDE_CHEATS__` — false in production main-branch builds, so
        // Vite tree-shakes the whole branch out of shipped code.
        if (__INCLUDE_CHEATS__ && !deps.getGameOver() && deps.isDevtoolsOpen()) {
            if ('12345'.includes(e.key)) {
                deps.triggerMagic(parseInt(e.key) - 1);
                e.preventDefault();
                return;
            }
            if (e.key === '6') {
                deps.incrementGrowthPending();
                deps.showEffect(deps.t('fx.lenPlus'));
                e.preventDefault();
                return;
            }
        }
        const newDir = keyToDirection(e.key);
        if (newDir) {
            heldDirKeys.add(e.key);
            const combined = combineHeldDir();
            if (combined && !isOppositeDir(deps.getDirection(), combined)) {
                deps.setNextDirection(combined);
            }
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        heldDirKeys.delete(e.key);
    });
    window.addEventListener('blur', () => heldDirKeys.clear());

    return {
        resetTypedBuf: () => {
            typedBuf = '';
        },
        combineHeldDir,
    };
}
