import type { AudioEngine } from '../audio/AudioEngine';
import type { createBoostTimer } from './boost';
import type { createComboCounter } from '../combo';
import type { createEatenColorsQueue } from '../eatenColors';
import { eatScore, wrapPosition } from '../gameRules';

type TFn = (key: string, vars?: Record<string, unknown>) => string;
type Cell = { x: number; y: number };
type Dir = { x: number; y: number };
type Bean = { x: number; y: number; color: number };
type ShedSkin = { x: number; y: number; life: number };
type GoldBean = { x: number; y: number; life: number; [k: string]: unknown };

export interface GameOverInfo {
    score: number;
    isNew: boolean;
    hi: number;
}

export interface GameStepDeps {
    audio: AudioEngine;
    t: TFn;
    showMessage: (m: string) => void;
    showEffect: (m: string) => void;

    cell: number;
    cols: number;
    rows: number;
    colorsHex: readonly number[];

    boost: ReturnType<typeof createBoostTimer>;
    combo: ReturnType<typeof createComboCounter>;
    eatenColors: ReturnType<typeof createEatenColorsQueue>;

    getSnake: () => Cell[];
    getDirection: () => Dir;
    setDirection: (d: Dir) => void;
    getNextDirection: () => Dir;
    getBeans: () => Bean[];
    getShedSkin: () => ShedSkin[];
    setShedSkin: (s: ShedSkin[]) => void;
    getGoldBeans: () => GoldBean[];
    setGoldBeans: (g: GoldBean[]) => void;

    getGodMode: () => boolean;
    getGameOver: () => boolean;
    setGameOver: (v: boolean) => void;
    getPaused: () => boolean;
    getIsRaining: () => boolean;

    getScore: () => number;
    addScore: (n: number) => void;
    getHiScore: () => number;
    saveHiScore: () => void;

    getBaseSpeed: () => number;
    setBaseSpeed: (s: number) => void;
    setSpeed: (s: number) => void;

    incBeansEaten: () => void;
    getGrowthPending: () => number;
    setGrowthPending: (n: number) => void;
    incGrowthPending: () => void;
    decGrowthPending: () => void;

    getSnakeMeshes: () => {
        userData?: {
            deadRefs?: { deadX: { visible: boolean }; pupil: { visible: boolean }; hl: { visible: boolean } }[];
            [k: string]: unknown;
        };
    }[];
    getBeanMeshes: () => { position?: unknown }[];
    getGoldMeshes: () => { position?: unknown }[];
    removeMesh: (mesh: unknown) => void;

    spawnRipple: (x: number, z: number) => void;
    spawnParticles3D: (x: number, z: number, color: number, count: number) => void;
    spawnBean: () => void;
    triggerMagic: (colorIdx: number) => void;
    updateUI: () => void;
    setGameOverInfo: (info: GameOverInfo) => void;
}

export interface GameStep {
    gameUpdate: () => void;
    eatBean: (b: Bean) => void;
    endBoost: () => void;
}

export function createGameStep(deps: GameStepDeps): GameStep {
    const {
        audio,
        t,
        showMessage,
        showEffect,
        cell: CELL,
        cols: COLS,
        rows: ROWS,
        colorsHex: COLORS_HEX,
        boost,
        combo,
        eatenColors,
        getSnake,
        getDirection,
        setDirection,
        getNextDirection,
        getBeans,
        getShedSkin,
        setShedSkin,
        getGoldBeans,
        setGoldBeans,
        getGodMode,
        getGameOver,
        setGameOver,
        getPaused,
        getIsRaining,
        getScore,
        addScore,
        getHiScore,
        saveHiScore,
        getBaseSpeed,
        setBaseSpeed,
        setSpeed,
        incBeansEaten,
        getGrowthPending,
        setGrowthPending,
        incGrowthPending,
        decGrowthPending,
        getSnakeMeshes,
        getBeanMeshes,
        getGoldMeshes,
        removeMesh,
        spawnRipple,
        spawnParticles3D,
        spawnBean,
        triggerMagic,
        updateUI,
        setGameOverInfo,
    } = deps;

    function endBoost() {
        if (!boost.active) return;
        boost.reset();
        setSpeed(getBaseSpeed());
        audio.play('speed_end');
        showEffect(t('fx.boostEnd'));
    }

    function eatBean(bean: Bean) {
        incBeansEaten();
        const basePoints = eatScore({
            isRaining: getIsRaining(),
            isBoosted: boost.active,
            boostMultiplier: boost.multiplier,
            godMode: getGodMode(),
        });
        addScore(basePoints);
        incGrowthPending();
        audio.play('eat');
        spawnParticles3D(bean.x * CELL, bean.y * CELL, COLORS_HEX[bean.color], 8);
        // Trigger eat animation (chomp + alternate which hand "tosses")
        const snakeMeshes = getSnakeMeshes();
        if (snakeMeshes[0] && (snakeMeshes[0] as { userData?: Record<string, unknown> }).userData) {
            const ud = (
                snakeMeshes[0] as {
                    userData: Record<string, unknown> & {
                        eatTimer?: number;
                        handTimer?: number;
                        handTimerMax?: number;
                        handThrowSide?: number;
                        tossBean?: {
                            material: {
                                color: { setHex: (n: number) => void };
                                emissive: { setHex: (n: number) => void };
                            };
                            position: { copy: (v: unknown) => void };
                            visible: boolean;
                        };
                        tossFrom?: { set: (a: number, b: number, c: number) => void };
                    };
                }
            ).userData;
            ud.eatTimer = 220;
            ud.handTimer = ud.handTimerMax as number;
            ud.handThrowSide = -(ud.handThrowSide as number);
            // Spawn the visible tossed bean at the active hand's palm.
            if (ud.tossBean) {
                ud.tossBean.material.color.setHex(COLORS_HEX[bean.color]);
                ud.tossBean.material.emissive.setHex(COLORS_HEX[bean.color]);
                // Approximate hand palm local position (matches makeHand layout).
                const side = ud.handThrowSide as number;
                ud.tossFrom!.set(side * 0.5, 0.45 - 0.5, 0.1); // shoulder + arm hang
                ud.tossBean.position.copy(ud.tossFrom);
                ud.tossBean.visible = true;
            }
        }

        if (combo.recordEat(bean.color)) {
            triggerMagic(bean.color);
        }

        const snake = getSnake();
        // Anticipated length after growthPending applied
        const projectedLen = snake.length + getGrowthPending();
        // Heart beat begins at length 20, gets louder until shed at 25
        if (projectedLen >= 20 && projectedLen < 25) {
            audio.play('heartbeat_start');
            // Ramp volume from 0.25 at len=20 to 1.0 at len=24
            const tt = (projectedLen - 20) / 4; // 0..1
            const vol = 0.25 + tt * 0.75;
            audio.setLoopVolume('beat', vol, 0.2);
        }
        if (projectedLen >= 25) {
            audio.play('heartbeat_stop');
            audio.play('freeze');
            // Shed: drop all segments beyond init length (5) as gray beans (original: keep 5)
            const initLen = 5;
            const shed = getShedSkin();
            while (snake.length > initLen) {
                const tail = snake.pop()!;
                shed.push({ x: tail.x, y: tail.y, life: 600 });
            }
            // Keep most recent 4 eaten colors visible on body[1..4] after shed
            eatenColors.trimAfterShed(initLen);
            // Prevent the trailing snake.pop() in gameUpdate from shrinking us to 4
            setGrowthPending(1);
            showEffect(t('fx.shed'));
            const newBase = Math.max(80, getBaseSpeed() - 5);
            setBaseSpeed(newBase);
            setSpeed(newBase);
        }
        updateUI();
    }

    function gameUpdate() {
        if (getGameOver() || getPaused()) return;

        // Expire red boost
        if (boost.isExpired(performance.now())) {
            endBoost();
        }

        setDirection(getNextDirection());
        const snake = getSnake();
        const direction = getDirection();
        const head = wrapPosition(snake[0].x + direction.x, snake[0].y + direction.y, COLS, ROWS);

        const shedSkin = getShedSkin();
        if (
            !getGodMode() &&
            (snake.some((s) => s.x === head.x && s.y === head.y) ||
                shedSkin.some((s) => s.x === head.x && s.y === head.y))
        ) {
            setGameOver(true);
            // Show dead "X" eyes on the head
            const snakeMeshes = getSnakeMeshes();
            const ud =
                snakeMeshes[0] &&
                (
                    snakeMeshes[0] as {
                        userData?: {
                            deadRefs?: {
                                deadX: { visible: boolean };
                                pupil: { visible: boolean };
                                hl: { visible: boolean };
                            }[];
                        };
                    }
                ).userData;
            if (ud && ud.deadRefs) {
                for (const r of ud.deadRefs) {
                    r.deadX.visible = true;
                    r.pupil.visible = false;
                    r.hl.visible = false;
                }
            }
            const score = getScore();
            const hi = getHiScore();
            const isNew = score > hi;
            saveHiScore();
            updateUI();
            audio.play('heartbeat_stop');
            audio.play('die');
            const hiAfter = getHiScore();
            setGameOverInfo({ score, isNew, hi: hiAfter });
            const msg = isNew ? `${t('over.new', { score })}` : `${t('over.normal', { score, hi: hiAfter })}`;
            showMessage(msg);
            return;
        }

        snake.unshift(head);
        // Water ripple at head position
        spawnRipple(head.x * CELL, head.y * CELL);

        const beans = getBeans();
        const beanMeshes = getBeanMeshes();
        const beanIdx = beans.findIndex((b) => b.x === head.x && b.y === head.y);
        if (beanIdx !== -1) {
            const bean = beans[beanIdx];
            beans.splice(beanIdx, 1);
            // Remove the corresponding mesh so the next spawned bean gets a fresh drop-in animation
            if (beanMeshes[beanIdx]) {
                removeMesh(beanMeshes[beanIdx]);
                beanMeshes.splice(beanIdx, 1);
            }
            // Newest eaten color goes to front of queue → displayed directly behind head
            eatenColors.recordEaten(bean.color);
            eatBean(bean);
            spawnBean();
        }

        const goldBeans = getGoldBeans();
        const goldMeshes = getGoldMeshes();
        const goldIdx = goldBeans.findIndex((b) => b.x === head.x && b.y === head.y);
        if (goldIdx !== -1) {
            goldBeans.splice(goldIdx, 1);
            if (goldMeshes[goldIdx]) {
                removeMesh(goldMeshes[goldIdx]);
                goldMeshes.splice(goldIdx, 1);
            }
            addScore(30);
            audio.play('gold');
            spawnParticles3D(head.x * CELL, head.y * CELL, 0xffd700, 12);
            spawnBean();
        }

        if (getGrowthPending() > 0) {
            decGrowthPending();
        } else {
            snake.pop();
        }

        // Decay
        shedSkin.forEach((s) => s.life--);
        setShedSkin(shedSkin.filter((s) => s.life > 0));
        const gb = getGoldBeans();
        gb.forEach((b) => b.life--);
        setGoldBeans(gb.filter((b) => b.life > 0));

        updateUI();
    }

    // setBeans/setGoldBeans/setShedSkin are deps-injected so external state
    // can be reassigned by the host module after filter operations.

    return { gameUpdate, eatBean, endBoost };
}
