// Pond floor + (currently-disabled) muddy rim & pebble decorations. The
// rim/pebble code is kept verbatim because the visual style historically
// toggled between "screen-edge boundary" and "drawn rim"; we don't want to
// silently delete the assets when extracting. Only the floor mesh is
// actually added to the scene.

import type * as THREE_T from 'three';

export interface BuildPondOptions {
    cols: number;
    rows: number;
    cell: number;
}

(function (g: any) {
    'use strict';

    function buildPond(
        scene: THREE_T.Scene,
        renderer: THREE_T.WebGLRenderer,
        THREE: typeof THREE_T,
        opts: BuildPondOptions,
    ): void {
        const { cols, rows, cell } = opts;
        const pondCX = (cols * cell) / 2;
        const pondCZ = (rows * cell) / 2;

        // Background floor - procedurally generated high-res grass texture
        const floorGeom = new THREE.PlaneGeometry(cols * cell * 10, rows * cell * 10);
        const bgTexture = g.DAIDAI.makeGrassTexture(1024);
        bgTexture.wrapS = THREE.RepeatWrapping;
        bgTexture.wrapT = THREE.RepeatWrapping;
        bgTexture.repeat.set(20, 16);
        bgTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const floorMat = new THREE.MeshStandardMaterial({
            map: bgTexture,
            roughness: 0.85,
            metalness: 0.0,
        });
        const floor = new THREE.Mesh(floorGeom, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(pondCX, -0.3, pondCZ);
        floor.receiveShadow = true;
        scene.add(floor);

        // ============ POND BANK - continuous muddy rim with pebbles ============
        const fieldW = cols * cell;
        const fieldH = rows * cell;
        const minX = -cell / 2,
            maxX = fieldW - cell / 2;
        const minZ = -cell / 2,
            maxZ = fieldH - cell / 2;
        const RIM_W = 0.8;

        // Muddier seamless texture (darker underwater tones, more cohesive with pond)
        function makeMudTexture(size: number) {
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const gc = c.getContext('2d')!;
            gc.fillStyle = '#2a2218';
            gc.fillRect(0, 0, size, size);
            const wrapDraw = (x: number, y: number, fn: (x: number, y: number) => void) => {
                for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(x + ox, y + oy);
            };
            for (let i = 0; i < 260; i++) {
                const x = Math.random() * size,
                    y = Math.random() * size;
                const r = 6 + Math.random() * 22;
                const hue = 28 + Math.random() * 16;
                const sat = 18 + Math.random() * 22;
                const light = 14 + Math.random() * 16;
                wrapDraw(x, y, (px, py) => {
                    const rg = gc.createRadialGradient(px, py, 0, px, py, r);
                    rg.addColorStop(0, `hsla(${hue},${sat}%,${light}%,0.85)`);
                    rg.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`);
                    gc.fillStyle = rg;
                    gc.beginPath();
                    gc.arc(px, py, r, 0, Math.PI * 2);
                    gc.fill();
                });
            }
            for (let i = 0; i < 60; i++) {
                const x = Math.random() * size,
                    y = Math.random() * size;
                const r = 4 + Math.random() * 10;
                wrapDraw(x, y, (px, py) => {
                    const rg = gc.createRadialGradient(px, py, 0, px, py, r);
                    rg.addColorStop(0, `hsla(${75 + Math.random() * 30},35%,22%,0.55)`);
                    rg.addColorStop(1, `hsla(80,30%,18%,0)`);
                    gc.fillStyle = rg;
                    gc.beginPath();
                    gc.arc(px, py, r, 0, Math.PI * 2);
                    gc.fill();
                });
            }
            const img = gc.getImageData(0, 0, size, size);
            for (let p = 0; p < img.data.length; p += 4) {
                const n = (Math.random() - 0.5) * 20;
                img.data[p] = Math.max(0, Math.min(255, img.data[p] + n));
                img.data[p + 1] = Math.max(0, Math.min(255, img.data[p + 1] + n * 0.9));
                img.data[p + 2] = Math.max(0, Math.min(255, img.data[p + 2] + n * 0.7));
            }
            gc.putImageData(img, 0, 0);
            for (let i = 0; i < 220; i++) {
                const x = Math.random() * size,
                    y = Math.random() * size;
                const r = 0.6 + Math.random() * 1.8;
                gc.fillStyle = `hsla(${20 + Math.random() * 15},25%,${8 + Math.random() * 10}%,0.85)`;
                gc.beginPath();
                gc.arc(x, y, r, 0, Math.PI * 2);
                gc.fill();
            }
            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.colorSpace = THREE.SRGBColorSpace;
            return tex;
        }
        const mudTex = makeMudTexture(512);
        mudTex.repeat.set(8, 8);

        // Single continuous rim using Shape-with-hole (no corner seams)
        const rimShape = new THREE.Shape();
        rimShape.moveTo(minX - RIM_W, -(maxZ + RIM_W));
        rimShape.lineTo(maxX + RIM_W, -(maxZ + RIM_W));
        rimShape.lineTo(maxX + RIM_W, -(minZ - RIM_W));
        rimShape.lineTo(minX - RIM_W, -(minZ - RIM_W));
        rimShape.lineTo(minX - RIM_W, -(maxZ + RIM_W));
        const hole = new THREE.Path();
        hole.moveTo(minX, -maxZ);
        hole.lineTo(maxX, -maxZ);
        hole.lineTo(maxX, -minZ);
        hole.lineTo(minX, -minZ);
        hole.lineTo(minX, -maxZ);
        rimShape.holes.push(hole);
        const rimGeom = new THREE.ShapeGeometry(rimShape, 24);
        {
            const pos = rimGeom.attributes.position;
            const uvs = new Float32Array(pos.count * 2);
            const SCALE = 1 / 3;
            for (let i = 0; i < pos.count; i++) {
                uvs[i * 2] = pos.getX(i) * SCALE;
                uvs[i * 2 + 1] = pos.getY(i) * SCALE;
            }
            rimGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        }
        {
            const pos = rimGeom.attributes.position;
            const colors = new Float32Array(pos.count * 3);
            const cInner = new THREE.Color(0xa08566);
            const cOuter = new THREE.Color(0x3a2c1e);
            const innerXMin = minX,
                innerXMax = maxX;
            const innerYMin = -maxZ,
                innerYMax = -minZ;
            for (let i = 0; i < pos.count; i++) {
                const px = pos.getX(i),
                    py = pos.getY(i);
                const distInner = Math.max(innerXMin - px, px - innerXMax, innerYMin - py, py - innerYMax, 0);
                const t = Math.min(1, distInner / RIM_W);
                const c = cInner.clone().lerp(cOuter, t);
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
            rimGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
        const rimMat = new THREE.MeshStandardMaterial({
            map: mudTex,
            vertexColors: true,
            roughness: 0.95,
            metalness: 0.0,
        });
        const rimMesh = new THREE.Mesh(rimGeom, rimMat);
        rimMesh.rotation.x = -Math.PI / 2;
        rimMesh.position.y = -0.18;
        rimMesh.receiveShadow = true;
        // Rim & pebbles disabled — screen edge is the boundary
        // scene.add(rimMesh);
        void rimMesh;

        // 3D pebbles scattered on the rim (disabled but kept for reference)
        const pebbleGeoms = [
            new THREE.IcosahedronGeometry(0.18, 0),
            new THREE.IcosahedronGeometry(0.12, 0),
            new THREE.DodecahedronGeometry(0.14, 0),
        ];
        const pebbleColors = [0x5c4a36, 0x6b5640, 0x4a3a28, 0x807060, 0x3d2e20];
        // eslint-disable-next-line no-constant-condition -- pebble decoration disabled, kept for reference
        if (false)
            for (let i = 0; i < 60; i++) {
                const side = Math.floor(Math.random() * 4);
                let px: number, pz: number;
                const t = Math.random();
                const off = (RIM_W - 0.2) * Math.random() + 0.1;
                if (side === 0) {
                    px = minX - off;
                    pz = minZ - RIM_W + t * (fieldH + RIM_W * 2);
                } else if (side === 1) {
                    px = maxX + off;
                    pz = minZ - RIM_W + t * (fieldH + RIM_W * 2);
                } else if (side === 2) {
                    pz = minZ - off;
                    px = minX - RIM_W + t * (fieldW + RIM_W * 2);
                } else {
                    pz = maxZ + off;
                    px = minX - RIM_W + t * (fieldW + RIM_W * 2);
                }
                const geom = pebbleGeoms[Math.floor(Math.random() * pebbleGeoms.length)];
                const mat = new THREE.MeshStandardMaterial({
                    color: pebbleColors[Math.floor(Math.random() * pebbleColors.length)],
                    roughness: 0.85,
                    metalness: 0.05,
                });
                const m = new THREE.Mesh(geom, mat);
                const s = 0.5 + Math.random() * 1.3;
                m.scale.set(s, s * (0.5 + Math.random() * 0.4), s);
                m.position.set(px, -0.12 + Math.random() * 0.08, pz);
                m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                m.castShadow = true;
                m.receiveShadow = true;
                scene.add(m);
            }
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.buildPond = buildPond;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : (this as any));
