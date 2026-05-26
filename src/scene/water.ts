// Underwater "wet" visuals: two layered caustics planes, the wavy water
// surface, ring-ripples spawned on collisions, and floating bubbles. All
// construction is pure; main.ts owns the per-frame animation (caustic
// offsets, wave deformation, ripple expansion + cleanup, bubble drift).

import type * as THREE_T from 'three';

export interface BuildWaterOptions {
    cols: number;
    rows: number;
    cell: number;
    bubbleCount?: number;
}

export interface RippleRing {
    mesh: THREE_T.Mesh;
    life: number;
    maxLife: number;
    startScale: number;
    endScale: number;
    delay: number;
}

export interface WaterRefs {
    causticsTex: THREE_T.CanvasTexture;
    causticsTex2: THREE_T.CanvasTexture;
    causticsMesh: THREE_T.Mesh;
    causticsMesh2: THREE_T.Mesh;
    waterGeom: THREE_T.PlaneGeometry;
    waterMat: THREE_T.MeshPhysicalMaterial;
    waterSurface: THREE_T.Mesh;
    waterBasePositions: ArrayLike<number>;
    rippleRings: RippleRing[];
    spawnRipple(x: number, z: number): void;
    bubbles: THREE_T.Mesh[];
}

(function (g: any) {
    'use strict';

    function buildWater(
        scene: THREE_T.Scene,
        THREE: typeof THREE_T,
        opts: BuildWaterOptions,
    ): WaterRefs {
        const { cols, rows, cell } = opts;
        const bubbleCount = opts.bubbleCount ?? 80;
        const pondCX = cols * cell / 2;
        const pondCZ = rows * cell / 2;

        function makeCausticsTexture(size: number) {
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const gc = c.getContext('2d')!;
            gc.fillStyle = 'rgba(0,0,0,0)';
            gc.fillRect(0, 0, size, size);
            const wrapDraw = (x: number, y: number, fn: (x: number, y: number) => void) => {
                for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(x + ox, y + oy);
            };
            // Voronoi-like light cells, drawn wrapped to be seamless
            const cells = 30;
            const radius = size * 0.12;
            for (let i = 0; i < cells; i++) {
                const cx = Math.random() * size, cy = Math.random() * size;
                wrapDraw(cx, cy, (px, py) => {
                    if (px < -radius || px > size + radius || py < -radius || py > size + radius) return;
                    const rg = gc.createRadialGradient(px, py, 0, px, py, radius);
                    rg.addColorStop(0, 'rgba(180,230,255,0.55)');
                    rg.addColorStop(0.5, 'rgba(140,210,255,0.18)');
                    rg.addColorStop(1, 'rgba(140,210,255,0)');
                    gc.fillStyle = rg;
                    gc.beginPath(); gc.arc(px, py, radius, 0, Math.PI * 2); gc.fill();
                });
            }
            // Thin bright refraction lines (wrapped)
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * size, y = Math.random() * size;
                const len = 30 + Math.random() * 80;
                const a = Math.random() * Math.PI * 2;
                const dx = Math.cos(a) * len, dy = Math.sin(a) * len;
                wrapDraw(x, y, (px, py) => {
                    if (px < -len || px > size + len || py < -len || py > size + len) return;
                    const grd = gc.createLinearGradient(px, py, px + dx, py + dy);
                    grd.addColorStop(0, 'rgba(220,240,255,0)');
                    grd.addColorStop(0.5, 'rgba(220,240,255,0.6)');
                    grd.addColorStop(1, 'rgba(220,240,255,0)');
                    gc.strokeStyle = grd;
                    gc.lineWidth = 1.5;
                    gc.beginPath();
                    gc.moveTo(px, py);
                    gc.lineTo(px + dx, py + dy);
                    gc.stroke();
                });
            }
            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.colorSpace = THREE.SRGBColorSpace;
            return tex;
        }

        const causticsTex = makeCausticsTexture(512);
        const causticsMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(cols * cell * 10, rows * cell * 10),
            new THREE.MeshBasicMaterial({
                map: causticsTex,
                transparent: true,
                opacity: 0.22,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            }),
        );
        causticsMesh.rotation.x = -Math.PI / 2;
        causticsMesh.position.set(pondCX, -0.15, pondCZ);
        scene.add(causticsMesh);

        const causticsTex2 = makeCausticsTexture(512);
        const causticsMesh2 = new THREE.Mesh(
            new THREE.PlaneGeometry(cols * cell * 10, rows * cell * 10),
            new THREE.MeshBasicMaterial({
                map: causticsTex2,
                transparent: true,
                opacity: 0.18,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            }),
        );
        causticsMesh2.rotation.x = -Math.PI / 2;
        causticsMesh2.position.set(pondCX, -0.14, pondCZ);
        scene.add(causticsMesh2);

        // Water surface above the play field (subtle blue tint with wave normal)
        const waterGeom = new THREE.PlaneGeometry(cols * cell * 3, rows * cell * 3, 60, 60);
        const waterMat = new THREE.MeshPhysicalMaterial({
            color: 0xcce4f0,
            transparent: true,
            opacity: 0.04,
            roughness: 0.15,
            metalness: 0.0,
            side: THREE.DoubleSide,
        });
        const waterSurface = new THREE.Mesh(waterGeom, waterMat);
        waterSurface.rotation.x = -Math.PI / 2;
        waterSurface.position.set(pondCX, 4.5, pondCZ);
        scene.add(waterSurface);
        const waterBasePositions = (waterGeom.attributes.position.array as Float32Array).slice();

        // Water ripple rings (spawned when snake moves) — soft radial gradient, multiple concentric waves
        const rippleRings: RippleRing[] = [];
        const rippleTex = (() => {
            const c = document.createElement('canvas');
            c.width = c.height = 128;
            const gc = c.getContext('2d')!;
            const grad = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
            grad.addColorStop(0.00, 'rgba(180,225,255,0)');
            grad.addColorStop(0.55, 'rgba(180,225,255,0)');
            grad.addColorStop(0.72, 'rgba(200,235,255,0.55)');
            grad.addColorStop(0.82, 'rgba(230,245,255,0.85)');
            grad.addColorStop(0.92, 'rgba(200,235,255,0.35)');
            grad.addColorStop(1.00, 'rgba(180,225,255,0)');
            gc.fillStyle = grad;
            gc.fillRect(0, 0, 128, 128);
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            return t;
        })();
        const rippleQuadGeom = new THREE.PlaneGeometry(1, 1);

        function spawnRipple(x: number, z: number) {
            const mat = new THREE.MeshBasicMaterial({
                map: rippleTex,
                color: 0xbfe6ff,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(rippleQuadGeom, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(x, 0.04, z);
            const initScale = 0.4;
            mesh.scale.set(initScale, initScale, 1);
            scene.add(mesh);
            rippleRings.push({
                mesh, life: 55, maxLife: 55,
                startScale: initScale,
                endScale: 3.2,
                delay: 0,
            });
        }

        // Subtle floating particles (spores/debris)
        const bubbleGeom = new THREE.SphereGeometry(0.04, 6, 6);
        const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xddeeff, transparent: true, opacity: 0.45 });
        const bubbles: THREE_T.Mesh[] = [];
        for (let i = 0; i < bubbleCount; i++) {
            const bubble = new THREE.Mesh(bubbleGeom, bubbleMat.clone());
            bubble.position.set(
                (Math.random() - 0.5) * cols * cell * 1.4 + cols * cell / 2,
                Math.random() * 5,
                (Math.random() - 0.5) * rows * cell * 1.4 + rows * cell / 2,
            );
            bubble.userData = { speed: 0.004 + Math.random() * 0.01, phase: Math.random() * Math.PI * 2 };
            scene.add(bubble);
            bubbles.push(bubble);
        }

        return {
            causticsTex, causticsTex2,
            causticsMesh, causticsMesh2,
            waterGeom, waterMat, waterSurface, waterBasePositions,
            rippleRings, spawnRipple,
            bubbles,
        };
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.buildWater = buildWater;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (this as any)));
