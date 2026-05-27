// Test API surface used by Playwright e2e specs. The shape of the
// window.__test object — and especially window.__test.state() — is a
// contract: tests/e2e/helpers.ts (GameState) maps over every field
// returned by state(). Do not rename / drop fields here without updating
// the helpers + every spec that relies on them.

import type { Camera } from 'three';
import type { createBoostTimer } from './game/boost';
import type { createComboCounter } from './combo';
import type { createEatenColorsQueue } from './eatenColors';

export type Cell = { x: number; y: number };
export type Direction = { x: number; y: number };
export type Bean = { x: number; y: number; color: number };
export type GoldBean = { x: number; y: number; life: number };
export type ShedSkin = { x: number; y: number; life: number };

export interface TestApiDeps {
    // Read-only getters used by state():
    getScore: () => number;
    getHiScore: () => number;
    getGameOver: () => boolean;
    getPaused: () => boolean;
    getGodMode: () => boolean;
    getSnake: () => Cell[];
    getDirection: () => Direction;
    getNextDirection: () => Direction;
    getBeans: () => Bean[];
    getGoldBeans: () => GoldBean[];
    getShedSkin: () => ShedSkin[];
    getIsRaining: () => boolean;
    getGrowthPending: () => number;
    getBeansEaten: () => number;
    getGoldenProjectilesCount: () => number;
    getSpeed: () => number;
    getBaseSpeed: () => number;

    // Direct references to long-lived helpers (their .field reads/writes
    // are visible to main.ts because they share the same object).
    combo: ReturnType<typeof createComboCounter>;
    boost: ReturnType<typeof createBoostTimer>;
    eatenColors: ReturnType<typeof createEatenColorsQueue>;
    camera: Camera;

    // Static values:
    COLS: () => number;
    ROWS: () => number;
    CELL: number;

    // Mutators (covers every test hook that flips a module-scope let):
    setSnake: (snake: Cell[]) => void;
    setDirection: (d: Direction) => void;
    setNextDirection: (d: Direction) => void;
    setBeans: (beans: Bean[]) => void;
    pushBean: (b: Bean) => void;
    setGoldBeans: (g: GoldBean[]) => void;
    pushGoldBean: (g: GoldBean) => void;
    setShedSkin: (s: ShedSkin[]) => void;
    pushShedSkin: (s: ShedSkin) => void;
    setPaused: (p: boolean) => void;
    setGameOver: (g: boolean) => void;
    setGodMode: (g: boolean) => void;
    setGrowthPending: (n: number) => void;
    setBaseSpeed: (s: number) => void;

    // Direct calls:
    gameUpdate: () => void;
    triggerMagic: (colorIdx: number) => void;
    updateGoldenProjectiles: () => void;
    activateTribute: () => void;

    // Tribute state — shared object mutated by easterEggs.activateTribute.
    tributeState: { tributeActive: boolean; tributeTriggeredThisLoad: boolean };
}

/**
 * Install window.__test with the full e2e contract. Keep every key
 * field-for-field identical to what tests/e2e/helpers.ts (GameState)
 * expects.
 */
export function installTestApi(deps: TestApiDeps): void {
    (window as unknown as { __test: Record<string, unknown> }).__test = {
        state: () => ({
            score: deps.getScore(),
            hiScore: deps.getHiScore(),
            gameOver: deps.getGameOver(),
            paused: deps.getPaused(),
            godMode: deps.getGodMode(),
            snake: deps.getSnake().map((s) => ({ x: s.x, y: s.y })),
            direction: { x: deps.getDirection().x, y: deps.getDirection().y },
            nextDirection: { x: deps.getNextDirection().x, y: deps.getNextDirection().y },
            beans: deps.getBeans().map((b) => ({ x: b.x, y: b.y, color: b.color })),
            goldBeans: deps.getGoldBeans().map((g) => ({ x: g.x, y: g.y, life: g.life })),
            shedSkin: deps.getShedSkin().map((s) => ({ x: s.x, y: s.y, life: s.life })),
            eatenColors: deps.eatenColors.snapshot(),
            comboColor: deps.combo.color,
            comboCount: deps.combo.count,
            isBoosted: deps.boost.active,
            boostMultiplier: deps.boost.multiplier,
            isRaining: deps.getIsRaining(),
            growthPending: deps.getGrowthPending(),
            beansEaten: deps.getBeansEaten(),
            goldenProjectiles: deps.getGoldenProjectilesCount(),
            speed: deps.getSpeed(),
            baseSpeed: deps.getBaseSpeed(),
            cameraOffsetX: deps.camera.position.x - ((deps.COLS() - 1) * deps.CELL) / 2,
        }),
        setSnake: (cells: Cell[]) => {
            deps.setSnake(cells.map((c) => ({ x: c.x, y: c.y })));
            deps.eatenColors.reset();
            deps.setGrowthPending(0);
        },
        setDirection: (x: number, y: number) => {
            deps.setDirection({ x, y });
            deps.setNextDirection({ x, y });
        },
        clearBeans: () => {
            deps.setBeans([]);
        },
        placeBean: (x: number, y: number, color: number) => {
            deps.pushBean({ x, y, color: color | 0 });
        },
        clearGold: () => {
            deps.setGoldBeans([]);
        },
        placeGold: (x: number, y: number) => {
            deps.pushGoldBean({ x, y, life: 300 });
        },
        clearShed: () => {
            deps.setShedSkin([]);
        },
        placeShed: (x: number, y: number) => {
            deps.pushShedSkin({ x, y, life: 600 });
        },
        setPaused: (p: boolean) => {
            deps.setPaused(!!p);
        },
        setGameOver: (g: boolean) => {
            deps.setGameOver(!!g);
        },
        setGodMode: (g: boolean) => {
            deps.setGodMode(!!g);
        },
        setComboColor: (c: number, n: number) => {
            deps.combo.color = c;
            deps.combo.count = n;
        },
        setBaseSpeed: (s: number) => {
            deps.setBaseSpeed(s);
        },
        step: () => {
            const wasPaused = deps.getPaused();
            deps.setPaused(false);
            try {
                deps.gameUpdate();
            } finally {
                deps.setPaused(wasPaused);
            }
        },
        triggerMagic: (c: number) => {
            deps.triggerMagic(c);
        },
        stepProjectiles: (n: number) => {
            const raw = Number(n);
            const STEP_CAP = 10000;
            const steps = Number.isFinite(raw) ? Math.min(STEP_CAP, Math.max(0, Math.floor(raw))) : 0;
            for (let i = 0; i < steps; i++) deps.updateGoldenProjectiles();
        },
        dismissTribute: () => {
            const el = document.getElementById('tribute-overlay');
            if (el) {
                const tn = Number(el.dataset.staticTimer);
                if (tn) clearInterval(tn);
                el.remove();
            }
            deps.tributeState.tributeActive = false;
        },
        tributeTriggered: () => deps.tributeState.tributeTriggeredThisLoad,
        callActivateTribute: () => {
            deps.activateTribute();
        },
        COLS: () => deps.COLS(),
        ROWS: () => deps.ROWS(),
    };
}
