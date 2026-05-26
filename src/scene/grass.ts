// 3D grass tufts surrounding the pond. Pure construction: builds N billboard
// planes around the play area and returns descriptor objects whose .mesh
// reference is added to the scene. The per-frame sway/react animation stays
// in main.ts because it depends on the live snake head position.

import type * as THREE_T from 'three';

export interface GrassTuft {
    mesh: THREE_T.Mesh;
    baseX: number;
    baseZ: number;
    baseRot: number;
    baseScale: number;
    phase: number;
    freq: number;
}

export interface BuildGrassOptions {
    cols: number;
    rows: number;
    cell: number;
    count?: number;
    spread?: number;
    textureSize?: number;
}

(function (g: any) {
    'use strict';

    function buildGrass(
        scene: THREE_T.Scene,
        THREE: typeof THREE_T,
        opts: BuildGrassOptions,
    ): GrassTuft[] {
        const { cols, rows, cell } = opts;
        const count = opts.count ?? 280;
        const spread = opts.spread ?? 1.3;
        const textureSize = opts.textureSize ?? 128;

        const tuftTexture = g.DAIDAI.makeTuftTexture(textureSize);
        const tuftMat = new THREE.MeshBasicMaterial({
            map: tuftTexture,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        const tuftGeom = new THREE.PlaneGeometry(1.4, 1.4);

        const tufts: GrassTuft[] = [];
        for (let i = 0; i < count; i++) {
            const m = new THREE.Mesh(tuftGeom, tuftMat);
            m.rotation.x = -Math.PI / 2;
            const px = (Math.random() - 0.5) * cols * cell * spread + cols * cell / 2;
            const pz = (Math.random() - 0.5) * rows * cell * spread + rows * cell / 2;
            m.position.set(px, -0.18, pz);
            const baseRot = Math.random() * Math.PI * 2;
            m.rotation.z = baseRot;
            const scl = 0.6 + Math.random() * 0.7;
            m.scale.set(scl, scl, 1);
            scene.add(m);
            tufts.push({
                mesh: m,
                baseX: px, baseZ: pz,
                baseRot,
                baseScale: scl,
                phase: Math.random() * Math.PI * 2,
                freq: 0.0015 + Math.random() * 0.001,
            });
        }
        return tufts;
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.buildGrass = buildGrass;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (this as any)));
