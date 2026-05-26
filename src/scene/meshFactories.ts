// Mesh factory pool for the gameplay entities.
//
// Every object the game spawns at runtime (snake segments, beans, gold,
// skin/death meshes, particles, falling beans, rain drops) is produced
// here from shared geometries/materials so we don't hammer the GPU with
// fresh shader links during play. The factories also handle scene
// attachment; callers just hold on to the returned mesh.
//
// State (the `*Meshes` arrays) lives in main.ts because it is reset on
// every game-over and is consumed by both the render sync and the test
// API. The factory itself is stateless aside from the cached geoms/mats.

import type * as THREE_T from 'three';

export interface MeshFactoryOptions {
    colorsHex: number[];
    cell: number;
}

export interface FallingBeanState {
    mesh: THREE_T.Mesh;
    targetX: number;
    targetY: number;
    color: number;
    vy: number;
    gravity: number;
}

export interface MeshFactories {
    createSnakeSegment(isHead: boolean): THREE_T.Group;
    createBeanMesh(colorIdx: number): THREE_T.Mesh;
    createGoldMesh(): THREE_T.Mesh;
    createSkinMesh(): THREE_T.Mesh;
    createParticleMesh(color: number): THREE_T.Mesh;
    createFallingBean(targetX: number, targetY: number, colorIdx: number): FallingBeanState;
    rainGeom: THREE_T.CylinderGeometry;
    rainMat: THREE_T.MeshBasicMaterial;
}

(function (g: any) {
    'use strict';

    function createMeshFactories(
        scene: THREE_T.Scene,
        renderer: THREE_T.WebGLRenderer,
        camera: THREE_T.Camera,
        THREE: typeof THREE_T,
        opts: MeshFactoryOptions,
    ): MeshFactories {
        const { colorsHex, cell } = opts;

        const snakeBodyGeom = new THREE.SphereGeometry(0.42, 12, 12);
        const beanGeom = new THREE.SphereGeometry(0.35, 12, 12);
        const goldGeom = new THREE.DodecahedronGeometry(0.4);
        // Shared material — MeshPhysicalMaterial with clearcoat is the
        // heaviest shader in three.js; a new one per bean would re-link
        // the program for the first instance of each color/uniform combo
        // and stall the GPU. One shared material avoids the hitch and is
        // also cheaper.
        const goldMat = new THREE.MeshPhysicalMaterial({
            color: 0xffd700,
            roughness: 0.1,
            metalness: 0.9,
            emissive: 0xffaa00,
            emissiveIntensity: 0.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
        });
        const particleGeom = new THREE.SphereGeometry(0.12, 6, 6);
        const rainGeom = new THREE.CylinderGeometry(0.03, 0.01, 1.2, 4);
        const rainMat = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.7 });

        function createSnakeSegment(isHead: boolean) {
            const group = new THREE.Group();
            const mat = new THREE.MeshPhysicalMaterial({
                color: isHead ? 0xf0f0e8 : 0xd8d8c8,
                roughness: 0.3,
                metalness: 0.05,
                transparent: true,
                opacity: isHead ? 0.92 : 0.75,
                clearcoat: 1.0,
                clearcoatRoughness: 0.1,
            });
            if (isHead) {
                const headGeom = new THREE.SphereGeometry(0.6, 24, 20);
                const body = new THREE.Mesh(headGeom, mat);
                body.scale.set(1.05, 0.95, 1.05);
                body.castShadow = true;
                group.add(body);
                const eyeWhiteMat = new THREE.MeshPhongMaterial({
                    color: 0xffffff,
                    shininess: 80,
                    specular: 0x666666,
                });
                const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
                const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const deadXMat = new THREE.MeshBasicMaterial({ color: 0xd11414 });

                const eyeRadius = 0.33;
                const pupilRefs: any[] = [];
                const eyeRefs: any[] = [];
                const deadRefs: any[] = [];
                const makeEye = (xOffset: number) => {
                    const eyeGroup = new THREE.Group();
                    const white = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 20, 20), eyeWhiteMat);
                    white.castShadow = true;
                    eyeGroup.add(white);
                    const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.38, 16, 16), pupilMat);
                    pupil.position.set(0, eyeRadius * 0.55, eyeRadius * 0.55);
                    eyeGroup.add(pupil);
                    const hl = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.1, 10, 10), highlightMat);
                    hl.position.set(0, eyeRadius * 0.7, eyeRadius * 0.7);
                    eyeGroup.add(hl);
                    const deadX = new THREE.Group();
                    const barGeom = new THREE.BoxGeometry(eyeRadius * 1.6, eyeRadius * 0.18, eyeRadius * 0.18);
                    const bar1 = new THREE.Mesh(barGeom, deadXMat);
                    const bar2 = new THREE.Mesh(barGeom, deadXMat);
                    bar1.rotation.y = Math.PI / 4;
                    bar2.rotation.y = -Math.PI / 4;
                    deadX.add(bar1);
                    deadX.add(bar2);
                    deadX.position.set(0, eyeRadius * 0.95, 0);
                    deadX.visible = false;
                    eyeGroup.add(deadX);
                    eyeGroup.position.set(xOffset, 0.5, 0.12);
                    pupilRefs.push({ pupil, hl });
                    eyeRefs.push(eyeGroup);
                    deadRefs.push({ deadX, pupil, hl, white });
                    return eyeGroup;
                };
                group.add(makeEye(-0.32));
                group.add(makeEye(0.32));

                const mouthMat = new THREE.MeshBasicMaterial({ color: 0x3a1a10 });
                const smileGeom = new THREE.TorusGeometry(0.11, 0.022, 8, 18, Math.PI);
                const smile = new THREE.Mesh(smileGeom, mouthMat);
                smile.rotation.x = -Math.PI / 2;
                smile.rotation.z = Math.PI;
                smile.position.set(0, 0.42, 0.42);
                group.add(smile);

                const openMouth = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), mouthMat);
                openMouth.rotation.x = -Math.PI / 2;
                openMouth.position.set(0, 0.5, 0.44);
                openMouth.visible = false;
                group.add(openMouth);

                const tongue = new THREE.Mesh(
                    new THREE.CircleGeometry(0.07, 16),
                    new THREE.MeshBasicMaterial({ color: 0xcc3344 }),
                );
                tongue.rotation.x = -Math.PI / 2;
                tongue.position.set(0, 0.51, 0.42);
                tongue.visible = false;
                group.add(tongue);

                // Two little arms with palms attached to head sides. Because
                // the camera is nearly top-down, hands need to sit ABOVE the
                // head's equator (around the eye height) so they're visible.
                // Animated during eatTimer to do a "toss bean into mouth".
                const skinMat = new THREE.MeshStandardMaterial({
                    color: 0x111111,
                    roughness: 0.7,
                    metalness: 0.1,
                });
                const armLength = 0.5;
                const armGeom = new THREE.CapsuleGeometry(0.035, armLength - 0.1, 4, 8);
                const palmGeom = new THREE.SphereGeometry(0.09, 12, 10);
                const handRefs: any[] = [];
                const makeHand = (side: number) => {
                    const root = new THREE.Group();
                    root.position.set(side * 0.5, 0.45, 0.1);
                    const arm = new THREE.Mesh(armGeom, skinMat);
                    arm.castShadow = true;
                    arm.position.set(0, -armLength * 0.5, 0);
                    root.add(arm);
                    const palm = new THREE.Mesh(palmGeom, skinMat);
                    palm.castShadow = true;
                    palm.position.set(0, -armLength, 0);
                    root.add(palm);
                    const baseRotZ = side * 1.15;
                    const baseRotX = -0.2;
                    root.rotation.set(baseRotX, 0, baseRotZ);
                    group.add(root);
                    handRefs.push({ root, side, baseRotX, baseRotZ });
                    return root;
                };
                makeHand(-1);
                makeHand(1);

                group.userData.smile = smile;
                group.userData.openMouth = openMouth;
                group.userData.tongue = tongue;
                group.userData.eatTimer = 0;
                group.userData.handTimer = 0;
                group.userData.handTimerMax = 800;
                group.userData.chewTimer = 0;
                group.userData.chewTimerMax = 700;
                const tossBeanMat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    roughness: 0.4,
                    metalness: 0.1,
                    emissive: 0x000000,
                    emissiveIntensity: 0.4,
                });
                const tossBean = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), tossBeanMat);
                tossBean.castShadow = true;
                tossBean.visible = false;
                group.add(tossBean);
                group.userData.tossBean = tossBean;
                group.userData.tossFrom = new THREE.Vector3();
                group.userData.tossTo = new THREE.Vector3(0, 0.4, 0.55);
                group.userData.pupilRefs = pupilRefs;
                group.userData.eyeRefs = eyeRefs;
                group.userData.deadRefs = deadRefs;
                group.userData.eyeRadius = eyeRadius;
                group.userData.blinkTimer = 2000 + Math.random() * 2000;
                group.userData.blinkPhase = 0;
                group.userData.handRefs = handRefs;
                group.userData.handThrowSide = 1;
            } else {
                const seg = new THREE.Mesh(snakeBodyGeom, mat);
                seg.castShadow = true;
                group.add(seg);
            }
            (group as any).material = mat;
            scene.add(group);
            return group;
        }

        function createBeanMesh(colorIdx: number) {
            const mat = new THREE.MeshPhysicalMaterial({
                color: colorsHex[colorIdx],
                roughness: 0.15,
                metalness: 0.05,
                transparent: true,
                opacity: 0.95,
                clearcoat: 1.0,
                clearcoatRoughness: 0.05,
                emissive: colorsHex[colorIdx],
                emissiveIntensity: 0.55,
            });
            const mesh = new THREE.Mesh(beanGeom, mat);
            mesh.castShadow = false;
            const haloCanvas = document.createElement('canvas');
            haloCanvas.width = haloCanvas.height = 64;
            const hg = haloCanvas.getContext('2d')!;
            const rg = hg.createRadialGradient(32, 32, 4, 32, 32, 32);
            rg.addColorStop(0, 'rgba(255,255,255,0.9)');
            rg.addColorStop(0.4, 'rgba(255,255,255,0.3)');
            rg.addColorStop(1, 'rgba(255,255,255,0)');
            hg.fillStyle = rg;
            hg.fillRect(0, 0, 64, 64);
            const haloTex = new THREE.CanvasTexture(haloCanvas);
            haloTex.colorSpace = THREE.SRGBColorSpace;
            const halo = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: haloTex,
                    color: colorsHex[colorIdx],
                    transparent: true,
                    opacity: 0.55,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                }),
            );
            halo.scale.set(1.6, 1.6, 1);
            mesh.add(halo);
            mesh.userData.halo = halo;
            mesh.userData.dropPhase = 1.0;
            mesh.userData.dropBounce = 0;
            scene.add(mesh);
            return mesh;
        }

        function createGoldMesh() {
            const mesh = new THREE.Mesh(goldGeom, goldMat);
            mesh.castShadow = false;
            mesh.userData.dropPhase = 1.0;
            mesh.userData.dropBounce = 0;
            scene.add(mesh);
            return mesh;
        }
        // Pre-compile the heavy gold/physical shader at startup so the first
        // gold bean does not stall the GPU during gameplay.
        (function warmupGoldShader() {
            const warm = new THREE.Mesh(goldGeom, goldMat);
            warm.position.set(0, -10000, 0);
            scene.add(warm);
            requestAnimationFrame(() => {
                try {
                    renderer.compile(scene, camera);
                } catch (_) {
                    /* shader compile failure isn't fatal */
                }
                scene.remove(warm);
            });
        })();

        function createSkinMesh() {
            const mat = new THREE.MeshStandardMaterial({
                color: 0x888888,
                roughness: 0.5,
                metalness: 0.2,
                transparent: true,
                opacity: 0.8,
            });
            const mesh = new THREE.Mesh(beanGeom, mat);
            mesh.castShadow = false;
            scene.add(mesh);
            return mesh;
        }

        function createParticleMesh(color: number) {
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
            const mesh = new THREE.Mesh(particleGeom, mat);
            scene.add(mesh);
            return mesh;
        }

        function createFallingBean(targetX: number, targetY: number, colorIdx: number): FallingBeanState {
            const mat = new THREE.MeshStandardMaterial({
                color: colorsHex[colorIdx],
                roughness: 0.3,
                metalness: 0.4,
                emissive: colorsHex[colorIdx],
                emissiveIntensity: 0.3,
            });
            const mesh = new THREE.Mesh(beanGeom, mat);
            mesh.position.set(targetX * cell, 12 + Math.random() * 5, targetY * cell);
            mesh.castShadow = false;
            scene.add(mesh);
            return {
                mesh,
                targetX,
                targetY,
                color: colorIdx,
                vy: 0,
                gravity: 0.008 + Math.random() * 0.004,
            };
        }

        return {
            createSnakeSegment,
            createBeanMesh,
            createGoldMesh,
            createSkinMesh,
            createParticleMesh,
            createFallingBean,
            rainGeom,
            rainMat,
        };
    }

    g.DAIDAI = g.DAIDAI || {};
    g.DAIDAI.createMeshFactories = createMeshFactories;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : (this as any));
