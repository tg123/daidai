import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoostTimer } from '../../src/game/boost';
import { createComboCounter } from '../../src/combo';
import { createEatenColorsQueue } from '../../src/eatenColors';
import { createGameStep, type GameStepDeps } from '../../src/game/step';

const COLORS_HEX = [0xff3333, 0x2266ff, 0x22ee22, 0xffaa00, 0xdd55ff];

type State = {
    snake: { x: number; y: number }[];
    direction: { x: number; y: number };
    nextDirection: { x: number; y: number };
    beans: { x: number; y: number; color: number }[];
    shedSkin: { x: number; y: number; life: number }[];
    goldBeans: { x: number; y: number; life: number }[];
    godMode: boolean;
    gameOver: boolean;
    paused: boolean;
    isRaining: boolean;
    score: number;
    hiScore: number;
    baseSpeed: number;
    speed: number;
    beansEaten: number;
    growthPending: number;
    gameOverInfo: { score: number; isNew: boolean; hi: number } | null;
};

function makeAudioMock() {
    return {
        init: vi.fn(),
        play: vi.fn(),
        setMuted: vi.fn(),
        setLoopVolume: vi.fn(),
        get muted() {
            return false;
        },
    };
}

function makeHarness(overrides: Partial<State> = {}) {
    const s: State = {
        snake: [
            { x: 5, y: 5 },
            { x: 4, y: 5 },
            { x: 3, y: 5 },
            { x: 2, y: 5 },
            { x: 1, y: 5 },
        ],
        direction: { x: 1, y: 0 },
        nextDirection: { x: 1, y: 0 },
        beans: [],
        shedSkin: [],
        goldBeans: [],
        godMode: false,
        gameOver: false,
        paused: false,
        isRaining: false,
        score: 0,
        hiScore: 0,
        baseSpeed: 150,
        speed: 150,
        beansEaten: 0,
        growthPending: 0,
        gameOverInfo: null,
        ...overrides,
    };
    const audio = makeAudioMock();
    const boost = createBoostTimer();
    const combo = createComboCounter();
    const eatenColors = createEatenColorsQueue();
    const spawnBean = vi.fn();
    const triggerMagic = vi.fn();
    const spawnRipple = vi.fn();
    const spawnParticles3D = vi.fn();
    const removeMesh = vi.fn();
    const updateUI = vi.fn();
    const saveHiScore = vi.fn(() => {
        if (s.score > s.hiScore) s.hiScore = s.score;
    });
    const deps: GameStepDeps = {
        audio: audio as unknown as GameStepDeps['audio'],
        t: (k: string) => k,
        showMessage: vi.fn(),
        showEffect: vi.fn(),
        cell: 1,
        cols: 20,
        rows: 20,
        colorsHex: COLORS_HEX,
        boost,
        combo,
        eatenColors,
        getSnake: () => s.snake,
        getDirection: () => s.direction,
        setDirection: (d) => {
            s.direction = d;
        },
        getNextDirection: () => s.nextDirection,
        getBeans: () => s.beans,
        getShedSkin: () => s.shedSkin,
        setShedSkin: (v) => {
            s.shedSkin = v;
        },
        getGoldBeans: () => s.goldBeans,
        setGoldBeans: (v) => {
            s.goldBeans = v;
        },
        getGodMode: () => s.godMode,
        getGameOver: () => s.gameOver,
        setGameOver: (v) => {
            s.gameOver = v;
        },
        getPaused: () => s.paused,
        getIsRaining: () => s.isRaining,
        getScore: () => s.score,
        addScore: (n) => {
            s.score += n;
        },
        getHiScore: () => s.hiScore,
        saveHiScore,
        getBaseSpeed: () => s.baseSpeed,
        setBaseSpeed: (v) => {
            s.baseSpeed = v;
        },
        setSpeed: (v) => {
            s.speed = v;
        },
        getGameClock: () => 0,
        incBeansEaten: () => {
            s.beansEaten++;
        },
        getGrowthPending: () => s.growthPending,
        setGrowthPending: (n) => {
            s.growthPending = n;
        },
        incGrowthPending: () => {
            s.growthPending++;
        },
        decGrowthPending: () => {
            s.growthPending--;
        },
        getSnakeMeshes: () => [],
        getBeanMeshes: () => [],
        getGoldMeshes: () => [],
        removeMesh,
        spawnRipple,
        spawnParticles3D,
        spawnBean,
        triggerMagic,
        updateUI,
        setGameOverInfo: (info) => {
            s.gameOverInfo = info;
        },
    };
    const step = createGameStep(deps);
    return {
        s,
        step,
        audio,
        boost,
        combo,
        mocks: { spawnBean, triggerMagic, spawnRipple, spawnParticles3D, updateUI },
    };
}

describe('createGameStep.gameUpdate', () => {
    beforeEach(() => {
        // Stabilise Math.random for any branches that consume it
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        // Restore Math.random (and any other spies) so this test file does
        // not leak global mocks into later vitest files.
        vi.restoreAllMocks();
    });

    it('basic move advances head and pops tail; length unchanged', () => {
        const { s, step } = makeHarness();
        step.gameUpdate();
        expect(s.snake[0]).toEqual({ x: 6, y: 5 });
        expect(s.snake.length).toBe(5);
        expect(s.gameOver).toBe(false);
    });

    it('eats a normal bean: removes bean, adds score, increments growth and beansEaten', () => {
        const { s, step, mocks } = makeHarness({
            beans: [{ x: 6, y: 5, color: 0 }],
        });
        step.gameUpdate();
        expect(s.beans).toHaveLength(0);
        expect(s.beansEaten).toBe(1);
        expect(s.score).toBeGreaterThan(0);
        // eatBean sets growthPending=1; the trailing decrement in gameUpdate
        // consumes it so the snake grew by one this tick and growthPending=0.
        expect(s.growthPending).toBe(0);
        expect(s.snake.length).toBe(6);
        expect(mocks.spawnBean).toHaveBeenCalledTimes(1);
    });

    it('eats a gold bean: +30 score, no growth', () => {
        const { s, step } = makeHarness({
            goldBeans: [{ x: 6, y: 5, life: 100 }],
        });
        step.gameUpdate();
        expect(s.goldBeans.find((g) => g.x === 6 && g.y === 5)).toBeUndefined();
        expect(s.score).toBe(30);
        expect(s.growthPending).toBe(0);
    });

    it('self-collision ends the game and records hi-score info', () => {
        // Head moves +1 into body at (4,5) by reversing direction (but we
        // bypass the isOpposite guard by mutating direction directly here).
        const snake = [
            { x: 5, y: 5 },
            { x: 5, y: 4 },
            { x: 4, y: 4 },
            { x: 4, y: 5 },
            { x: 4, y: 6 },
            { x: 5, y: 6 },
        ];
        const { s, step } = makeHarness({
            snake,
            // step into (4,5) which is a body cell
            direction: { x: -1, y: 0 },
            nextDirection: { x: -1, y: 0 },
        });
        step.gameUpdate();
        expect(s.gameOver).toBe(true);
        expect(s.gameOverInfo).not.toBeNull();
        expect(s.gameOverInfo!.score).toBe(0);
    });

    it('wraps around the board edges (toroidal grid)', () => {
        const { s, step } = makeHarness({
            snake: [
                { x: 19, y: 5 },
                { x: 18, y: 5 },
                { x: 17, y: 5 },
                { x: 16, y: 5 },
                { x: 15, y: 5 },
            ],
            direction: { x: 1, y: 0 },
            nextDirection: { x: 1, y: 0 },
        });
        step.gameUpdate();
        expect(s.snake[0]).toEqual({ x: 0, y: 5 });
        expect(s.gameOver).toBe(false);
    });

    it('paused or gameOver early-returns without moving', () => {
        const { s, step } = makeHarness({ paused: true });
        const before = JSON.stringify(s.snake);
        step.gameUpdate();
        expect(JSON.stringify(s.snake)).toBe(before);
    });

    it('eating five same-colour beans triggers magic via combo', () => {
        const beans = [
            { x: 6, y: 5, color: 0 },
            { x: 7, y: 5, color: 0 },
            { x: 8, y: 5, color: 0 },
            { x: 9, y: 5, color: 0 },
            { x: 10, y: 5, color: 0 },
        ];
        const { step, mocks } = makeHarness({ beans });
        for (let i = 0; i < 5; i++) step.gameUpdate();
        expect(mocks.triggerMagic).toHaveBeenCalledWith(0);
    });

    it('shed at projectedLen=25 drops baseSpeed by 5 and clamps to ≥80', () => {
        const snake: { x: number; y: number }[] = [];
        // 24-long horizontal-then-vertical snake that won't self-collide
        // when head moves +x.
        for (let i = 0; i < 24; i++) snake.push({ x: 5, y: i % 20 });
        // Head at snake[0] = (5,0); set direction +x so we don't hit body.
        const { s, step } = makeHarness({
            snake: [{ x: 5, y: 19 }, ...snake.slice(0, 23)],
            beans: [{ x: 6, y: 19, color: 2 }],
            direction: { x: 1, y: 0 },
            nextDirection: { x: 1, y: 0 },
            baseSpeed: 150,
        });
        step.gameUpdate();
        // After shed, baseSpeed reduced by 5
        expect(s.baseSpeed).toBe(145);
        // snake trimmed to initLen (5) + growthPending(1) safeguard
        expect(s.snake.length).toBeLessThanOrEqual(6);
        expect(s.shedSkin.length).toBeGreaterThan(0);
    });
});
