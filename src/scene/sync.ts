// 3D scene sync — per-frame mesh updates that mirror the game state into
// THREE objects. Pure side-effects on the deps bag; the caller still owns
// every long-lived `let` (snake / beans / pools) and passes getters / a
// few setters for the ones that get reassigned (particles3D, rain3D, the
// mesh-pool arrays via initGame).
//
// No unit tests — this is 3D side-effect code; the unit value would be
// negative. The block is exercised by the e2e specs.

import * as THREE from 'three';
import type { AudioEngine } from '../audio/AudioEngine';
import { isProjectileDead, projectileHits, stepProjectile } from '../game/projectiles';

export type Cell = { x: number; y: number };
export type Bean = { x: number; y: number; color: number };
export type GoldBean = { x: number; y: number; life: number };
export type ShedSkinSeg = { x: number; y: number; life: number };
export type Direction = { x: number; y: number };

export interface GoldenProjectile {
    x: number;
    z: number;
    dx: number;
    dz: number;
    life: number;
    mesh: THREE.Mesh | null;
    light: THREE.PointLight | null;
}

export interface Particle3D {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
}

export interface RainDrop {
    mesh: THREE.Mesh;
    speed: number;
    life: number;
}

export interface FallingBean {
    mesh: THREE.Mesh;
    targetX: number;
    targetY: number;
    color: number;
    vy: number;
    gravity: number;
}

export interface RippleRing {
    mesh: THREE.Mesh;
    delay: number;
    life: number;
    maxLife: number;
    startScale: number;
    endScale: number;
}

export interface GrassTuft {
    mesh: THREE.Mesh;
    baseX: number;
    baseZ: number;
    baseRot: number;
    baseScale: number;
    freq: number;
    phase: number;
}

export interface BoostLike {
    active: boolean;
    multiplier: number;
    remaining: (now: number) => number;
}

export interface EatenColorsLike {
    colorAt: (i: number) => number | null;
}

export interface SceneSyncDeps {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    audio: AudioEngine;

    // Mesh pools — mutated in place via push/pop (length-driven sync), so
    // getters that return the current array reference are sufficient.
    getSnakeMeshes: () => THREE.Object3D[];
    getBeanMeshes: () => THREE.Mesh[];
    getGoldMeshes: () => THREE.Mesh[];
    getSkinMeshes: () => THREE.Mesh[];

    // Particle / rain pools — reassigned (filter) each frame, so we need
    // a setter for the new array reference.
    getParticles3D: () => Particle3D[];
    setParticles3D: (p: Particle3D[]) => void;
    getRain3D: () => RainDrop[];
    setRain3D: (r: RainDrop[]) => void;
    getFallingBeans: () => FallingBean[];

    // Static once built:
    causticsTex: THREE.Texture;
    causticsTex2: THREE.Texture;
    causticsMesh: THREE.Mesh;
    waterGeom: THREE.BufferGeometry;
    waterBasePositions: ArrayLike<number>;
    rippleRings: RippleRing[];
    bubbles: THREE.Object3D[];
    shafts: THREE.Mesh[];
    grassTufts: GrassTuft[];

    // Game-state getters:
    getSnake: () => Cell[];
    getBeans: () => Bean[];
    getGoldBeans: () => GoldBean[];
    getShedSkin: () => ShedSkinSeg[];
    getGoldenProjectiles: () => GoldenProjectile[];
    getPrevSnake: () => Cell[];
    getDirection: () => Direction;
    getGodMode: () => boolean;
    getPaused: () => boolean;
    getGameOver: () => boolean;
    getSpeed: () => number;
    getGameAccumulator: () => number;
    boost: BoostLike;
    eatenColors: EatenColorsLike;

    // Side-effects + helpers:
    spawnBean: () => void;
    spawnParticles3D: (x: number, z: number, color: number, count: number) => void;
    spawnRipple: (x: number, z: number) => void;
    isOccupied: (x: number, y: number) => boolean;
    releaseGoldenProjLight: (l: THREE.PointLight | null) => void;
    fitCameraToPond: () => void;
    createSnakeSegment: (isHead: boolean) => THREE.Object3D;
    createBeanMesh: (colorIdx: number) => THREE.Mesh;
    createGoldMesh: () => THREE.Mesh;
    createSkinMesh: () => THREE.Mesh;

    // Bean color palette + grid constants:
    COLORS_HEX: number[];
    COLS: number;
    ROWS: number;
    CELL: number;
}

type AnyMesh = THREE.Mesh & {
    material: THREE.MeshStandardMaterial & { transmission?: number };
    userData: Record<string, unknown>;
};

export interface SceneSyncApi {
    updateGoldenProjectiles: () => void;
    syncFrame: (time: number) => void;
}

export function createSceneSync(deps: SceneSyncDeps): SceneSyncApi {
    const {
        scene,
        camera,
        audio,
        causticsTex,
        causticsTex2,
        causticsMesh,
        waterGeom,
        waterBasePositions,
        rippleRings,
        bubbles,
        shafts,
        grassTufts,
        boost,
        eatenColors,
        spawnBean,
        spawnParticles3D,
        spawnRipple,
        isOccupied,
        releaseGoldenProjLight,
        fitCameraToPond,
        createSnakeSegment,
        createBeanMesh,
        createGoldMesh,
        createSkinMesh,
        COLORS_HEX,
        COLS,
        ROWS,
        CELL,
    } = deps;

    const instrEl = document.getElementById('instructions');
    const btnRestartEl = document.getElementById('btn-restart');
    const msgEl = document.getElementById('message');
    const boostEl = document.getElementById('boost-timer') as HTMLElement | null;

    function updateGoldenProjectiles() {
        const goldenProjectiles = deps.getGoldenProjectiles();
        const beans = deps.getBeans();
        const goldBeans = deps.getGoldBeans();
        const shedSkin = deps.getShedSkin();
        const beanMeshes = deps.getBeanMeshes();
        for (let i = goldenProjectiles.length - 1; i >= 0; i--) {
            const p = goldenProjectiles[i];
            stepProjectile(p);
            if (p.mesh) {
                p.mesh.position.set(p.x, 0.5, p.z);
                p.mesh.rotation.y += 0.2;
            }
            if (p.light) p.light.position.set(p.x, 0.5, p.z);
            for (let j = beans.length - 1; j >= 0; j--) {
                const b = beans[j];
                if (projectileHits(p, b.x, b.y, CELL)) {
                    goldBeans.push({ x: b.x, y: b.y, life: 300 });
                    beans.splice(j, 1);
                    if (beanMeshes[j]) {
                        scene.remove(beanMeshes[j]);
                        beanMeshes.splice(j, 1);
                    }
                    spawnBean();
                    spawnParticles3D(b.x * CELL, b.y * CELL, 0xffd700, 8);
                    audio.play('gold');
                }
            }
            for (let j = shedSkin.length - 1; j >= 0; j--) {
                const s = shedSkin[j];
                if (projectileHits(p, s.x, s.y, CELL)) {
                    goldBeans.push({ x: s.x, y: s.y, life: 300 });
                    shedSkin.splice(j, 1);
                    spawnParticles3D(s.x * CELL, s.y * CELL, 0xffd700, 10);
                    audio.play('gold');
                }
            }
            if (isProjectileDead(p, COLS, ROWS, CELL)) {
                if (p.mesh) scene.remove(p.mesh);
                releaseGoldenProjLight(p.light);
                goldenProjectiles.splice(i, 1);
            }
        }
    }

    function syncFrame(time: number) {
        const paused = deps.getPaused();
        const gameOver = deps.getGameOver();
        const godMode = deps.getGodMode();
        const snake = deps.getSnake();
        const beans = deps.getBeans();
        const goldBeans = deps.getGoldBeans();
        const shedSkin = deps.getShedSkin();
        const prevSnake = deps.getPrevSnake();
        const direction = deps.getDirection();
        const snakeMeshes = deps.getSnakeMeshes();
        const beanMeshes = deps.getBeanMeshes();
        const goldMeshes = deps.getGoldMeshes();
        const skinMeshes = deps.getSkinMeshes();
        const fallingBeans = deps.getFallingBeans();
        const speed = deps.getSpeed();
        const gameAccumulator = deps.getGameAccumulator();

        const showHints = paused || gameOver;
        if (instrEl) instrEl.classList.toggle('show', showHints);
        if (btnRestartEl) {
            btnRestartEl.classList.toggle('show', gameOver);
            btnRestartEl.classList.toggle('gameover', gameOver);
            if (gameOver && msgEl) {
                const r = msgEl.getBoundingClientRect();
                if (r.height > 0) {
                    btnRestartEl.style.top = r.bottom + 16 + 'px';
                    btnRestartEl.style.transform = 'translate(-50%, 0)';
                }
            }
        }
        if (boost.active && boostEl) {
            const remain = boost.remaining(performance.now()) / 1000;
            boostEl.style.display = '';
            boostEl.textContent = `🔥 ×${boost.multiplier}  ${remain.toFixed(1)}s`;
        }
        while (snakeMeshes.length < snake.length) {
            snakeMeshes.push(createSnakeSegment(snakeMeshes.length === 0));
        }
        while (snakeMeshes.length > snake.length) {
            const m = snakeMeshes.pop();
            if (m) scene.remove(m);
        }
        const lerpFactor = Math.min(1, gameAccumulator / speed);
        snake.forEach((seg, i) => {
            const mesh = snakeMeshes[i] as AnyMesh;
            let fromX: number, fromZ: number;
            if (prevSnake.length > i) {
                fromX = prevSnake[i].x * CELL;
                fromZ = prevSnake[i].y * CELL;
            } else {
                fromX = seg.x * CELL;
                fromZ = seg.y * CELL;
            }
            const toX = seg.x * CELL;
            const toZ = seg.y * CELL;
            let dx = toX - fromX;
            let dz = toZ - fromZ;
            if (Math.abs(dx) > (COLS * CELL) / 2) dx = 0;
            if (Math.abs(dz) > (ROWS * CELL) / 2) dz = 0;
            mesh.position.x = fromX + dx * lerpFactor;
            mesh.position.z = fromZ + dz * lerpFactor;
            mesh.position.y = 0.4 + Math.sin(time * 0.003 + i * 0.5) * 0.05;
            if (i === 0) {
                const angle = Math.atan2(direction.x, direction.y);
                mesh.rotation.y = angle;
                const ud = mesh.userData as Record<string, any>;
                if (ud.pupilRefs) {
                    let nx = 0,
                        nz = 1,
                        found = false;
                    let bestD = Infinity;
                    const hx = mesh.position.x,
                        hz = mesh.position.z;
                    for (const b of beans) {
                        const ddx = b.x * CELL - hx,
                            ddz = b.y * CELL - hz;
                        const d = ddx * ddx + ddz * ddz;
                        if (d < bestD) {
                            bestD = d;
                            nx = ddx;
                            nz = ddz;
                            found = true;
                        }
                    }
                    const eyeR = ud.eyeRadius;
                    let lx = 0,
                        lz = 1;
                    if (found) {
                        const ca = Math.cos(-angle),
                            sa = Math.sin(-angle);
                        const tlx = nx * ca - nz * sa;
                        const tlz = nx * sa + nz * ca;
                        const len = Math.hypot(tlx, tlz) || 1;
                        lx = tlx / len;
                        lz = tlz / len;
                    }
                    if (ud.gazeX === undefined) {
                        ud.gazeX = lx;
                        ud.gazeZ = lz;
                    }
                    const smooth = 0.12;
                    ud.gazeX += (lx - ud.gazeX) * smooth;
                    ud.gazeZ += (lz - ud.gazeZ) * smooth;
                    const gLen = Math.hypot(ud.gazeX, ud.gazeZ) || 1;
                    const gx = ud.gazeX / gLen,
                        gz = ud.gazeZ / gLen;
                    const off = eyeR * 0.5;
                    const py = eyeR * 0.62;
                    ud.pupilRefs.forEach((r: any) => {
                        r.pupil.position.set(gx * off, py, gz * off);
                        r.hl.position.set(gx * off - 0.03, py + 0.04, gz * off + 0.05);
                    });

                    ud.blinkTimer -= 16;
                    if (ud.blinkTimer <= 0) {
                        ud.blinkPhase = 1;
                        ud.blinkTimer = 2500 + Math.random() * 2500;
                    }
                    if (ud.blinkPhase > 0) {
                        ud.blinkPhase -= 0.12;
                        if (ud.blinkPhase < 0) ud.blinkPhase = 0;
                        const sq = 1 - Math.sin(Math.max(0, ud.blinkPhase) * Math.PI) * 0.92;
                        ud.eyeRefs.forEach((e: any) => {
                            e.scale.y = sq;
                        });
                        const dead = ud.deadRefs && ud.deadRefs[0] && ud.deadRefs[0].deadX.visible;
                        if (!dead) {
                            ud.pupilRefs.forEach((r: any) => {
                                r.pupil.visible = sq > 0.4;
                                r.hl.visible = sq > 0.4;
                            });
                        }
                    } else {
                        ud.eyeRefs.forEach((e: any) => {
                            e.scale.y = 1;
                        });
                    }

                    const tossingNow = ud.handTimer > 0;
                    const chewingNow = ud.chewTimer > 0;
                    if (tossingNow || chewingNow) {
                        ud.smile.visible = false;
                        ud.openMouth.visible = true;
                        ud.tongue.visible = true;
                        let mouthScale: number;
                        if (tossingNow) {
                            const p = 1 - ud.handTimer / ud.handTimerMax;
                            mouthScale = 0.7 + p * 0.6;
                        } else {
                            const cp = 1 - ud.chewTimer / ud.chewTimerMax;
                            mouthScale = 0.5 + Math.abs(Math.sin(cp * Math.PI * 4)) * 0.7;
                        }
                        ud.openMouth.scale.set(mouthScale, mouthScale, 1);
                        ud.tongue.scale.set(mouthScale, mouthScale, 1);
                        if (chewingNow) ud.chewTimer -= 16;
                        ud.eatTimer = tossingNow ? ud.handTimer : ud.chewTimer;
                    } else {
                        ud.smile.visible = true;
                        ud.openMouth.visible = false;
                        ud.tongue.visible = false;
                        ud.eatTimer = 0;
                    }
                    if (chewingNow) {
                        const cp = 1 - ud.chewTimer / ud.chewTimerMax;
                        const bob = Math.abs(Math.sin(cp * Math.PI * 4)) * 0.12;
                        mesh.position.y = bob;
                        mesh.scale.set(1 + bob * 0.4, 1 - bob * 0.5, 1 + bob * 0.4);
                    } else if (!tossingNow) {
                        mesh.position.y = 0;
                        mesh.scale.set(1, 1, 1);
                    }
                    if (ud.handRefs) {
                        const swimPhase = time * 0.005;
                        const tossing = ud.handTimer > 0;
                        let p = 0,
                            swing = 0;
                        if (tossing) {
                            ud.handTimer -= 16;
                            p = 1 - ud.handTimer / ud.handTimerMax;
                            swing = Math.sin(p * Math.PI);
                        }
                        const throwSide = ud.handThrowSide;
                        for (const h of ud.handRefs) {
                            const phase = swimPhase + (h.side > 0 ? 0 : Math.PI);
                            const paddle = Math.sin(phase) * 0.45;
                            let rx = h.baseRotX - paddle;
                            let rz = h.baseRotZ + Math.cos(phase) * 0.12;
                            if (tossing && h.side === throwSide) {
                                rx = h.baseRotX - swing * 1.9;
                                rz = h.baseRotZ - h.side * swing * 0.95;
                            } else if (tossing) {
                                rx -= swing * 0.25;
                            }
                            h.root.rotation.x = rx;
                            h.root.rotation.z = rz;
                        }
                        if (ud.tossBean && ud.tossBean.visible) {
                            if (ud.handTimer > 0) {
                                const tp = p;
                                const from = ud.tossFrom,
                                    to = ud.tossTo;
                                ud.tossBean.position.x = from.x + (to.x - from.x) * tp;
                                ud.tossBean.position.z = from.z + (to.z - from.z) * tp;
                                const baseY = from.y + (to.y - from.y) * tp;
                                ud.tossBean.position.y = baseY + Math.sin(tp * Math.PI) * 1.3;
                                ud.tossBean.rotation.x += 0.22;
                                ud.tossBean.rotation.y += 0.28;
                                const s = 1 - tp * 0.4;
                                ud.tossBean.scale.setScalar(s);
                            } else {
                                ud.tossBean.visible = false;
                                ud.tossBean.scale.setScalar(1);
                                ud.chewTimer = ud.chewTimerMax;
                            }
                        }
                    }
                }
            }
            if (i > 0) {
                if (godMode) {
                    const hue = (time * 0.0008 + i * 0.08) % 1;
                    const col = new THREE.Color().setHSL(hue, 1, 0.55);
                    mesh.material.color.copy(col);
                    mesh.material.opacity = 0.92;
                    mesh.material.transmission = 0.08;
                } else if (boost.active) {
                    const flicker = 0.7 + Math.sin(time * 0.02 + i) * 0.3;
                    mesh.material.color.setRGB(1.0 * flicker, 0.3, 0.1);
                    mesh.material.opacity = 0.8;
                    mesh.material.transmission = 0.1;
                } else {
                    const cIdx = eatenColors.colorAt(i - 1);
                    if (cIdx != null) {
                        mesh.material.color.setHex(COLORS_HEX[cIdx]);
                        mesh.material.opacity = 0.88;
                        mesh.material.transmission = 0.15;
                    } else {
                        mesh.material.color.setRGB(0.85, 0.85, 0.78);
                        mesh.material.opacity = 0.75;
                        mesh.material.transmission = 0.2;
                    }
                }
                mesh.scale.setScalar(1.0);
            } else if (i === 0 && boost.active) {
                mesh.material.color.setRGB(1.0, 0.4, 0.1);
                mesh.material.opacity = 0.9;
            } else if (i === 0) {
                mesh.material.color.setRGB(0.93, 0.93, 0.88);
                mesh.material.opacity = 0.9;
            }
        });

        while (beanMeshes.length < beans.length) {
            beanMeshes.push(createBeanMesh(0));
        }
        while (beanMeshes.length > beans.length) {
            const m = beanMeshes.pop();
            if (m) scene.remove(m);
        }
        beans.forEach((bean, i) => {
            const mesh = beanMeshes[i] as AnyMesh & { material: THREE.MeshStandardMaterial };
            const ud = mesh.userData as Record<string, any>;
            if (ud.dropPhase > 0) {
                ud.dropPhase = Math.max(0, ud.dropPhase - 0.035);
                if (ud.dropPhase === 0) {
                    ud.dropBounce = 1.0;
                    audio.play('plop');
                    spawnRipple(bean.x * CELL, bean.y * CELL);
                }
            } else if (ud.dropBounce > 0) {
                ud.dropBounce = Math.max(0, ud.dropBounce - 0.06);
            }
            const dp = ud.dropPhase;
            const dropY = dp * dp * 22;
            const restY = 0.4 + Math.sin(time * 0.004 + bean.x + bean.y) * 0.15;
            mesh.position.set(bean.x * CELL, restY + dropY, bean.y * CELL);
            const b = ud.dropBounce;
            mesh.scale.set(1 + b * 0.4, 1 - b * 0.5, 1 + b * 0.4);
            mesh.rotation.y = time * 0.002;
            mesh.material.color.setHex(COLORS_HEX[bean.color]);
            mesh.material.emissive.setHex(COLORS_HEX[bean.color]);
            mesh.material.emissiveIntensity = 0.55 + Math.sin(time * 0.005 + i) * 0.2;
            if (ud.halo) {
                ud.halo.material.color.setHex(COLORS_HEX[bean.color]);
                const haloFade = dp > 0 ? 1 - dp : 1;
                ud.halo.material.opacity = (0.5 + Math.sin(time * 0.004 + i) * 0.15) * haloFade;
            }
        });

        while (goldMeshes.length < goldBeans.length) {
            goldMeshes.push(createGoldMesh());
        }
        while (goldMeshes.length > goldBeans.length) {
            const m = goldMeshes.pop();
            if (m) scene.remove(m);
        }
        goldBeans.forEach((bean, i) => {
            const mesh = goldMeshes[i] as AnyMesh;
            const ud = mesh.userData as Record<string, any>;
            if (ud.dropPhase > 0) {
                ud.dropPhase = Math.max(0, ud.dropPhase - 0.035);
                if (ud.dropPhase === 0) {
                    ud.dropBounce = 1.0;
                    audio.play('plop');
                    spawnRipple(bean.x * CELL, bean.y * CELL);
                }
            } else if (ud.dropBounce > 0) {
                ud.dropBounce = Math.max(0, ud.dropBounce - 0.06);
            }
            const dp = ud.dropPhase;
            const dropY = dp * dp * 22;
            const restY = 0.6 + Math.sin(time * 0.006 + i) * 0.2;
            mesh.position.set(bean.x * CELL, restY + dropY, bean.y * CELL);
            const b = ud.dropBounce;
            mesh.scale.set(1 + b * 0.4, 1 - b * 0.5, 1 + b * 0.4);
            mesh.rotation.x = time * 0.003;
            mesh.rotation.y = time * 0.005;
        });

        while (skinMeshes.length < shedSkin.length) {
            skinMeshes.push(createSkinMesh());
        }
        while (skinMeshes.length > shedSkin.length) {
            const m = skinMeshes.pop();
            if (m) scene.remove(m);
        }
        shedSkin.forEach((skin, i) => {
            const mesh = skinMeshes[i] as AnyMesh;
            mesh.position.set(skin.x * CELL, 0.1, skin.y * CELL);
            mesh.material.opacity = Math.min(0.7, skin.life / 100);
        });

        const particles3D = deps.getParticles3D();
        particles3D.forEach((p) => {
            p.mesh.position.x += p.vx;
            p.mesh.position.y += p.vy;
            p.mesh.position.z += p.vz;
            p.vy -= 0.003;
            p.life--;
            (p.mesh.material as THREE.Material & { opacity: number }).opacity = p.life / 60;
            p.mesh.scale.setScalar(p.life / 60);
        });
        deps.setParticles3D(
            particles3D.filter((p) => {
                if (p.life <= 0) {
                    scene.remove(p.mesh);
                    return false;
                }
                return true;
            }),
        );

        const rain3D = deps.getRain3D();
        rain3D.forEach((r) => {
            r.mesh.position.y -= r.speed;
            r.life--;
            (r.mesh.material as THREE.Material & { opacity: number }).opacity = Math.min(0.7, r.life / 60);
        });
        deps.setRain3D(
            rain3D.filter((r) => {
                if (r.life <= 0 || r.mesh.position.y < -1) {
                    scene.remove(r.mesh);
                    return false;
                }
                return true;
            }),
        );

        updateGoldenProjectiles();

        for (let i = fallingBeans.length - 1; i >= 0; i--) {
            const fb = fallingBeans[i];
            fb.vy += fb.gravity;
            fb.mesh.position.y -= fb.vy;
            fb.mesh.rotation.y += 0.05;
            if (fb.mesh.position.y <= 0.4) {
                fb.mesh.position.y = 0.4;
                scene.remove(fb.mesh);
                if (!isOccupied(fb.targetX, fb.targetY)) {
                    beans.push({ x: fb.targetX, y: fb.targetY, color: fb.color });
                } else {
                    spawnBean();
                }
                spawnParticles3D(fb.targetX * CELL, fb.targetY * CELL, COLORS_HEX[fb.color], 6);
                spawnRipple(fb.targetX * CELL, fb.targetY * CELL);
                fallingBeans.splice(i, 1);
            }
        }

        bubbles.forEach((b) => {
            const ud = b.userData as Record<string, any>;
            b.position.y += ud.speed;
            b.position.x += Math.sin(time * 0.001 + ud.phase) * 0.004;
            if (b.position.y > 5.5) {
                b.position.y = -0.2;
                b.position.x = (Math.random() - 0.5) * COLS * CELL * 1.4 + (COLS * CELL) / 2;
                b.position.z = (Math.random() - 0.5) * ROWS * CELL * 1.4 + (ROWS * CELL) / 2;
            }
        });

        shafts.forEach((s) => {
            const ud = s.userData as Record<string, any>;
            ud.driftPhase += ud.driftSpeed;
            s.position.x = ud.baseX + Math.sin(ud.driftPhase) * 1.5;
            s.position.z = ud.baseZ + Math.cos(ud.driftPhase * 0.7) * 1.5;
            (s.material as THREE.Material & { opacity: number }).opacity =
                ud.baseOpacity * (0.7 + Math.sin(time * 0.0008 + ud.driftPhase) * 0.3);
        });

        causticsTex.offset.x = (time * 0.00003) % 1;
        causticsTex.offset.y = (time * 0.00002) % 1;
        causticsTex2.offset.x = (-time * 0.00004) % 1;
        causticsTex2.offset.y = (time * 0.000035) % 1;
        (causticsMesh.material as THREE.Material & { opacity: number }).opacity = 0.4 + Math.sin(time * 0.0012) * 0.08;

        const wpos = waterGeom.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < wpos.count; i++) {
            const bx = waterBasePositions[i * 3],
                by = waterBasePositions[i * 3 + 1];
            const z = Math.sin(bx * 0.4 + time * 0.002) * 0.15 + Math.cos(by * 0.3 + time * 0.0017) * 0.12;
            (wpos.array as Float32Array)[i * 3 + 2] = z;
        }
        wpos.needsUpdate = true;

        const headMesh = snakeMeshes[0];
        const hx = headMesh ? headMesh.position.x : -999;
        const hz = headMesh ? headMesh.position.z : -999;
        grassTufts.forEach((t) => {
            const swayBase = Math.sin(time * t.freq + t.phase) * 0.08;
            const dx = t.baseX - hx;
            const dz = t.baseZ - hz;
            const dist = Math.hypot(dx, dz);
            let reactX = 0,
                reactZ = 0,
                pulse = 0;
            if (dist < 3.5) {
                const k = 1 - dist / 3.5;
                pulse = k * 0.18;
                const len = dist || 1;
                reactX = (dx / len) * k * 0.25;
                reactZ = (dz / len) * k * 0.25;
            }
            t.mesh.position.x = t.baseX + Math.sin(time * 0.002 + t.phase) * 0.04 + reactX;
            t.mesh.position.z = t.baseZ + Math.cos(time * 0.0017 + t.phase) * 0.04 + reactZ;
            t.mesh.rotation.z = t.baseRot + swayBase + pulse * Math.sign(Math.sin(t.phase));
            const s = t.baseScale * (1 + Math.sin(time * 0.003 + t.phase) * 0.05 + pulse * 0.5);
            t.mesh.scale.set(s, s, 1);
        });

        for (let i = rippleRings.length - 1; i >= 0; i--) {
            const r = rippleRings[i];
            if (r.delay > 0) {
                r.delay--;
                continue;
            }
            r.life--;
            const tn = 1 - r.life / r.maxLife;
            const eased = 1 - Math.pow(1 - tn, 2);
            const scale = r.startScale + (r.endScale - r.startScale) * eased;
            r.mesh.scale.set(scale, scale, 1);
            const fadeIn = Math.min(1, tn * 4);
            const fadeOut = Math.max(0, 1 - tn);
            (r.mesh.material as THREE.Material & { opacity: number }).opacity = 0.28 * fadeIn * fadeOut;
            if (r.life <= 0) {
                scene.remove(r.mesh);
                (r.mesh.material as THREE.Material).dispose();
                rippleRings.splice(i, 1);
            }
        }

        fitCameraToPond();
        // Touch the camera so callers can verify deps connection.
        void camera;
    }

    return { updateGoldenProjectiles, syncFrame };
}
