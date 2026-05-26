// Underwater atmosphere visuals: cyan tint + vignette camera overlay, and a
// set of additive god-ray light shafts drifting above the pond. Construction
// is pure; per-frame drift/shimmer of the shafts stays in main.ts because it
// depends on the global animation time. The overlay is parented to the
// camera so it always covers the screen; callers can rescale it on resize.

import type * as THREE_T from 'three';

export interface BuildAtmosphereOptions {
    cols: number;
    rows: number;
    cell: number;
    shaftCount?: number;
}

export interface AtmosphereRefs {
    overlayMesh: THREE_T.Mesh;
    shafts: THREE_T.Mesh[];
}

(function (g: any) {
    'use strict';

    function buildAtmosphere(
        scene: THREE_T.Scene,
        camera: THREE_T.PerspectiveCamera,
        THREE: typeof THREE_T,
        opts: BuildAtmosphereOptions,
    ): AtmosphereRefs {
        const { cols, rows, cell } = opts;
        const shaftCount = opts.shaftCount ?? 8;

        // 1) Fullscreen color-grade overlay — cyan-blue tint with darker corners (vignette)
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = overlayCanvas.height = 512;
        {
            const og = overlayCanvas.getContext('2d')!;
            og.fillStyle = 'rgba(30, 110, 150, 0.18)';
            og.fillRect(0, 0, 512, 512);
            const vg = og.createRadialGradient(256, 256, 100, 256, 256, 360);
            vg.addColorStop(0, 'rgba(0,0,0,0)');
            vg.addColorStop(0.7, 'rgba(0, 20, 40, 0.35)');
            vg.addColorStop(1, 'rgba(0, 10, 25, 0.75)');
            og.fillStyle = vg;
            og.fillRect(0, 0, 512, 512);
        }
        const overlayTex = new THREE.CanvasTexture(overlayCanvas);
        overlayTex.colorSpace = THREE.SRGBColorSpace;
        const overlayMat = new THREE.MeshBasicMaterial({
            map: overlayTex,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false,
        });
        const overlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), overlayMat);
        overlayMesh.frustumCulled = false;
        overlayMesh.renderOrder = 9999;
        {
            const distance = 0.5;
            const vFov = (camera.fov * Math.PI) / 180;
            const height = 2 * Math.tan(vFov / 2) * distance;
            const width = height * camera.aspect;
            overlayMesh.scale.set(width, height, 1);
            overlayMesh.position.z = -distance;
        }
        camera.add(overlayMesh);
        scene.add(camera); // ensure camera is in scene graph so its children render

        // 2) God-ray / volumetric light shafts — angled translucent planes drifting overhead
        const shaftTex = (() => {
            const c = document.createElement('canvas');
            c.width = 128;
            c.height = 512;
            const gc = c.getContext('2d')!;
            const grad = gc.createLinearGradient(0, 0, 128, 0);
            grad.addColorStop(0.0, 'rgba(180,220,255,0)');
            grad.addColorStop(0.5, 'rgba(220,240,255,0.55)');
            grad.addColorStop(1.0, 'rgba(180,220,255,0)');
            gc.fillStyle = grad;
            gc.fillRect(0, 0, 128, 512);
            const vgrad = gc.createLinearGradient(0, 0, 0, 512);
            vgrad.addColorStop(0.0, 'rgba(0,0,0,0)');
            vgrad.addColorStop(0.3, 'rgba(0,0,0,0)');
            vgrad.addColorStop(1.0, 'rgba(0,0,0,1)');
            gc.globalCompositeOperation = 'destination-in';
            gc.fillStyle = vgrad;
            gc.fillRect(0, 0, 128, 512);
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            return t;
        })();

        const shafts: THREE_T.Mesh[] = [];
        for (let i = 0; i < shaftCount; i++) {
            const mat = new THREE.MeshBasicMaterial({
                map: shaftTex,
                transparent: true,
                opacity: 0.12,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
            });
            const w = 3 + Math.random() * 4;
            const h = 18 + Math.random() * 8;
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
            mesh.rotation.x = -Math.PI / 2 + 0.6 + Math.random() * 0.3;
            mesh.rotation.z = Math.random() * Math.PI * 2;
            mesh.position.set(
                (cols * cell) / 2 + (Math.random() - 0.5) * cols * cell * 1.4,
                6 + Math.random() * 2,
                (rows * cell) / 2 + (Math.random() - 0.5) * rows * cell * 1.4,
            );
            mesh.userData = {
                driftPhase: Math.random() * Math.PI * 2,
                driftSpeed: 0.0003 + Math.random() * 0.0004,
                baseOpacity: 0.08 + Math.random() * 0.1,
                baseX: mesh.position.x,
                baseZ: mesh.position.z,
            };
            scene.add(mesh);
            shafts.push(mesh);
        }

        return { overlayMesh, shafts };
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.buildAtmosphere = buildAtmosphere;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : (this as any));
