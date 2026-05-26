// main.ts migrated as-is from main.js. Progressive typing is a follow-up.
import * as THREE from 'three';
// Explicit CSS import so Vite reliably injects the stylesheet via its
// JS module pipeline (HMR-friendly). The <link> in index.html alone can
// race / fall out of sync in iframed DevTools device mode.
import './styles/main.css';

import { AudioEngine } from './audio/AudioEngine';
import { installAudioBootstrap } from './bootstrap/audio';
import { detectFastBoot, installLoadingScreen } from './bootstrap/loadingScreen';
import { createComboCounter } from './combo';
import { createEatenColorsQueue } from './eatenColors';
import { createEasterEggs, showEffect, showMessage } from './effects/easterEggs';
import { createBoostTimer } from './game/boost';
import { isProjectileDead, projectileHits, stepProjectile } from './game/projectiles';
import { eatScore, findFreeCell, isCellOccupied, wrapPosition } from './gameRules';
import { createHeartMatcher, HEART_SEQUENCE } from './heartSequence';
import { applyI18nDOM as applyI18nDOMImpl, installLangMenu } from './i18n/dom';
import { createT, hasLocale, pickLang } from './i18n/index';
import './i18n/zh-cn';
import './i18n/zh-tw';
import './i18n/en-us';
import './i18n/ja-jp';
import './i18n/ko-kr';
import './i18n/es-es';
import { classifyDelta, combineHeldDir as combineHeldDirImpl, isOppositeDir, keyToDirection } from './input/direction';
import { detectConnectedGamepad, glyphForButton } from './input/gamepad';
import { getRestartLabel, getStartPrompt as getStartPromptImpl } from './input/promptStrings';
import { createKonamiMatcher } from './konami';
import { computeCameraFit, computeGridDims } from './layout';
import { buildAtmosphere } from './scene/atmosphere';
import { buildGrass } from './scene/grass';
import { createMeshFactories } from './scene/meshFactories';
import { buildPond } from './scene/pond';
import { buildWater } from './scene/water';
import { createHiScoreStorage } from './storage';

// ============ AUDIO ENGINE (extracted to src/audio/AudioEngine.ts) ============
const audio = new AudioEngine();
installAudioBootstrap(audio);
// ============ LOADING SCREEN ============
// Test fast-boot: when running under e2e tests we don't need to wait for
// audio preload / decode (which can take seconds and stall under headless
// WebGL contention). Detected via either ?test=1 in the URL or a flag set
// by Playwright's addInitScript. The loading screen is hidden immediately
// and audio preload runs in the background (best-effort).
const __FAST_BOOT = detectFastBoot();

// ============ TEXTURE GENERATION (extracted to src/textures.ts) ============

// ============ TEXTURE LOADING ============
// (All image textures previously loaded from img/ were unused —
// the game uses procedural materials only.)

// ============ GAME STATE ============
// Pond grid dimensions — match screen aspect so the playfield fills the viewport edge-to-edge
const CELL = 1.0;
let COLS: number, ROWS: number;
(function pickGridForAspect() {
    const isMobile = window.matchMedia('(max-width: 720px), (pointer: coarse)').matches;
    const dims = computeGridDims({
        winW: window.innerWidth,
        winH: window.innerHeight,
        isMobile,
    });
    COLS = dims.cols;
    ROWS = dims.rows;
})();
// ============ I18N ============
// ============ I18N (dictionaries + helpers extracted to src/i18n/) ============
let LANG = pickLang({
    url: new URLSearchParams(location.search).get('lang'),
    stored: (() => {
        try {
            return localStorage.getItem('daidai_lang');
        } catch (_e) {
            return null;
        }
    })(),
    navigator:
        navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'zh-cn'],
});
const t = createT(() => LANG);
installLoadingScreen({ audio, fastBoot: __FAST_BOOT, t });
try {
    document.documentElement.lang = LANG;
    document.title = t('title');
} catch (_e) {
    /* document may be missing in headless edge cases */
}
function applyI18nDOM() {
    applyI18nDOMImpl(t);
}
function setLang(lang) {
    if (!hasLocale(lang) || lang === LANG) return;
    LANG = lang;
    try {
        localStorage.setItem('daidai_lang', lang);
    } catch (_) {}
    try {
        document.documentElement.lang = lang;
        document.title = t('title');
    } catch (_) {}
    applyI18nDOM();
    document.querySelectorAll('#lang-menu button[data-lang]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    try {
        if (typeof refreshDynamicI18n === 'function') refreshDynamicI18n();
    } catch (_) {}
}
applyI18nDOM();
const COLORS_HEX = [0xff3333, 0x2266ff, 0x22ee22, 0xffaa00, 0xdd55ff];
const COLORS_STR = ['#ff3333', '#2266ff', '#22ee22', '#ffaa00', '#dd55ff'];

let snake, direction, nextDirection, beans, shedSkin, score, beansEaten;
let gameOver, paused, speed, baseSpeed;
const combo = createComboCounter();
let goldBeans, growthPending;
const eatenColors = createEatenColorsQueue(); // queue of bean colors behind the head
let hasGamepad = false;
const hasTouchEnv = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const hasFineKeyboardEnv = window.matchMedia('(pointer: fine)').matches;
let isPSGamepad = false;
if (location.hash === '#ps') isPSGamepad = true;
function detectGamepadNow() {
    try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const r = detectConnectedGamepad(pads);
        if (r.isPS) isPSGamepad = true;
        return r.connected;
    } catch (_e) {
        return false;
    }
}
function gpBtn(btn) {
    return glyphForButton(btn, isPSGamepad);
}
function currentModality() {
    return {
        hasGamepad: hasGamepad || detectGamepadNow(),
        hasTouch: hasTouchEnv,
        hasFineKeyboard: hasFineKeyboardEnv,
    };
}
function getStartPrompt() {
    const m = currentModality();
    if (m.hasGamepad) hasGamepad = true;
    return getStartPromptImpl(t, m);
}
let hiScore = 0;
const hiScoreStore = createHiScoreStorage();
hiScore = hiScoreStore.load();
function saveHiScore() {
    hiScore = hiScoreStore.save(score);
}

// ============ EASTER EGG STATE ============
const isLocalhost = ['localhost', '127.0.0.1', '::1', ''].includes(location.hostname);
let devtoolsOpen = isLocalhost; // on localhost: backdoor enabled by default
let godMode = false; // Konami: rainbow + invincible + 10x score
const tributeState = { tributeActive: false, tributeTriggeredThisLoad: false };
const konamiMatcher = createKonamiMatcher();
let typedBuf = '';
const heartMatcher = createHeartMatcher(HEART_SEQUENCE);

// Replaced at build time with the git short SHA. Stays as the literal
// placeholder for unbundled / locally-served runs; the banner then
// displays `'dev'` via the startsWith('__') check below.
const BUILD_SHA = '__DAIDAI_BUILD_SHA__';

function announceDebugHelp() {
    const big = 'background:#222;color:#ffd700;font-size:18px;font-weight:bold;padding:4px 10px;border-radius:4px';
    const sub = 'color:#4060c0;font-size:13px;font-weight:bold';
    const mono =
        'background:#222;color:#eee;font-family:Consolas,monospace;font-size:12px;line-height:1.6;padding:6px 10px;border-radius:4px';
    const tag = 'color:#666;font-family:Consolas,monospace;font-size:11px';
    console.log('%c🐛 DaiDai DEBUG mode active', big);
    console.log('%cbuild: ' + (BUILD_SHA.startsWith('__') ? 'dev' : BUILD_SHA), tag);
    console.log('%cPress 1-6 to trigger the matching magic (no 5-bean combo required):', sub);
    console.log(
        '%c  1  🔴 speed boost\n  2  🔵 rain\n  3  🟢 shed → beans\n  4  🟠 gold laser\n  5  🟣 halve length\n  6  ➕ length +1',
        mono,
    );
}
function detectDevtools() {
    const threshold = 160;
    const opened =
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold ||
        window.devicePixelRatio < 0.5;
    if (opened && !devtoolsOpen) {
        devtoolsOpen = true;
        announceDebugHelp();
    }
}
setInterval(detectDevtools, 1000);
// Getter probe — fires when devtools renders the object (works even when undocked)
const _ddProbe = function () {};
_ddProbe.toString = function () {
    if (!devtoolsOpen) {
        devtoolsOpen = true;
        announceDebugHelp();
    }
    return '';
};
setInterval(() => {
    if (!devtoolsOpen) console.debug('%c', '', _ddProbe);
}, 1500);

// ============ THREE.JS SETUP ============
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: !__FAST_BOOT, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
// Under fast-boot (e2e) drop pixel ratio + shadows so two parallel WebGL
// pages don't starve each other's rAF loop on headless CI. Tests don't
// inspect pixels (only DOM HUD elements + the canvas's existence), so
// rendering quality here is irrelevant.
renderer.setPixelRatio(__FAST_BOOT ? 0.25 : Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = !__FAST_BOOT;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Camera position - top-down, auto-fit to screen
function getVisibleArea() {
    const infoEl = document.getElementById('info-bar');
    const top = infoEl ? infoEl.getBoundingClientRect().bottom : 0;
    return {
        top,
        height: Math.max(150, window.innerHeight - top),
        width: window.innerWidth,
    };
}
function applyCanvasSize() {
    const v = getVisibleArea();
    renderer.setSize(v.width, v.height);
    renderer.domElement.style.top = v.top + 'px';
    camera.aspect = v.width / v.height;
    camera.updateProjectionMatrix();
}
applyCanvasSize();
const BASE_FOG_DENSITY = 0.016;
function fitCameraToPond() {
    const fit = computeCameraFit({
        aspect: camera.aspect,
        cols: COLS,
        rows: ROWS,
        cell: CELL,
        vFovDeg: camera.fov,
        margin: 1.02,
    });
    camera.up.set(0, 1, 0);
    camera.position.set(fit.centerX, fit.distance, fit.centerZ + 0.5);
    camera.lookAt(fit.centerX, 0, fit.centerZ);
    camera.updateProjectionMatrix();
    // Keep fog visual constant regardless of camera distance (portrait vs landscape)
    if (scene.fog) (scene.fog as THREE.FogExp2).density = BASE_FOG_DENSITY * (25 / fit.distance);
}
fitCameraToPond();

// Lighting - bright and even like original
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8 * Math.PI);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI);
mainLight.position.set(5, 30, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.camera.left = -20;
mainLight.shadow.camera.right = 40;
mainLight.shadow.camera.top = 30;
mainLight.shadow.camera.bottom = -10;
mainLight.shadow.radius = 4;
mainLight.shadow.bias = -0.002;
mainLight.shadow.normalBias = 0.05;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xccddcc, 0.4 * Math.PI);
fillLight.position.set(-10, 15, -5);
scene.add(fillLight);

// Subtle aquatic tint and stronger underwater fog
scene.fog = new THREE.FogExp2(0x3d5520, BASE_FOG_DENSITY);
scene.background = new THREE.Color(0x2a3818);

// ============ POND (floor + disabled rim/pebbles) ============
buildPond(scene, renderer, THREE, { cols: COLS, rows: ROWS, cell: CELL });

// ============ GRASS TUFTS - 3D clumps that sway and react to snake ============
const grassTufts = buildGrass(scene, THREE, { cols: COLS, rows: ROWS, cell: CELL });

// ============ CAUSTICS + WATER SURFACE for underwater feel ============
const { causticsTex, causticsTex2, causticsMesh, waterGeom, waterBasePositions, rippleRings, spawnRipple, bubbles } =
    buildWater(scene, THREE, { cols: COLS, rows: ROWS, cell: CELL });

// ============ UNDERWATER ATMOSPHERE ============
const { overlayMesh, shafts } = buildAtmosphere(scene, camera, THREE, { cols: COLS, rows: ROWS, cell: CELL });

// ============ 3D OBJECT POOLS ============
const meshFactories = createMeshFactories(scene, renderer, camera, THREE, {
    colorsHex: COLORS_HEX,
    cell: CELL,
});
const {
    createSnakeSegment,
    createBeanMesh,
    createGoldMesh,
    createSkinMesh,
    createParticleMesh,
    createFallingBean,
    rainGeom,
    rainMat,
} = meshFactories;

let snakeMeshes = [];
let beanMeshes = [];
let skinMeshes = [];
let goldMeshes = [];

// Golden projectile system
let goldenProjectiles = [];

// Shared geometry/material + PointLight pool for golden projectiles.
// Without this, every key-4 fire created a fresh MeshStandardMaterial
// AND added a new PointLight to the scene — the new light count forced
// THREE to recompile every standard material in the scene on the first
// frame after firing, causing a visible stutter ("初次还是有些卡").
// With shared resources warmed up at startup, the projectile shader is
// already compiled and the scene light count never changes when firing.
const GOLDEN_PROJ_LIGHT_POOL = 4;
const goldenProjGeom = new THREE.SphereGeometry(0.3, 12, 12);
const goldenProjMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffaa00,
    emissiveIntensity: 1.0,
    metalness: 0.9,
    roughness: 0.1,
});
const goldenProjLightPool: THREE.PointLight[] = [];
for (let __i = 0; __i < GOLDEN_PROJ_LIGHT_POOL; __i++) {
    const l = new THREE.PointLight(0xffd700, 0, 5);
    l.position.set(0, -10000, 0);
    scene.add(l);
    goldenProjLightPool.push(l);
}
function acquireGoldenProjLight(): THREE.PointLight | null {
    for (const l of goldenProjLightPool) {
        if (l.intensity === 0) {
            l.intensity = 1.5 * Math.PI;
            return l;
        }
    }
    return null; // pool exhausted; projectile fires unlit (rare)
}
function releaseGoldenProjLight(l: THREE.PointLight | null) {
    if (!l) return;
    l.intensity = 0;
    l.position.set(0, -10000, 0);
}
// Pre-warm the projectile shader so the first key-4 press doesn't hitch.
(function warmupGoldenProjShader() {
    const warm = new THREE.Mesh(goldenProjGeom, goldenProjMat);
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

// Falling bean system - beans that drop from sky
let fallingBeans = [];
function spawnFallingBean(targetX, targetY, colorIdx) {
    fallingBeans.push(createFallingBean(targetX, targetY, colorIdx));
}

// 3D particle system
let particles3D = [];
function spawnParticles3D(x, z, color, count) {
    for (let i = 0; i < count; i++) {
        const mesh = createParticleMesh(color);
        mesh.position.set(x, 0.5, z);
        particles3D.push({
            mesh,
            vx: (Math.random() - 0.5) * 0.15,
            vy: Math.random() * 0.15 + 0.05,
            vz: (Math.random() - 0.5) * 0.15,
            life: 60,
        });
    }
}

// Rain 3D
let rain3D = [];

// Heavy rain with blur and bonus beans
let isRaining = false;
function spawnHeavyRain() {
    isRaining = true;
    // Spawn very dense rain drops in waves
    function spawnWave() {
        for (let i = 0; i < 150; i++) {
            const mesh = new THREE.Mesh(rainGeom, rainMat.clone());
            mesh.position.set(Math.random() * COLS * CELL, 8 + Math.random() * 15, Math.random() * ROWS * CELL);
            scene.add(mesh);
            rain3D.push({ mesh, speed: 0.2 + Math.random() * 0.25, life: 250 });
        }
    }
    spawnWave();
    setTimeout(spawnWave, 800);
    setTimeout(spawnWave, 1600);
    // Spawn bonus beans falling from sky with rain
    let beanWaves = 0;
    const rainInterval = setInterval(() => {
        for (let i = 0; i < 3; i++) {
            let x,
                y,
                attempts = 0;
            do {
                x = Math.floor(Math.random() * COLS);
                y = Math.floor(Math.random() * ROWS);
                attempts++;
            } while (isOccupied(x, y) && attempts < 50);
            if (attempts < 50) {
                spawnFallingBean(x, y, Math.floor(Math.random() * COLORS_HEX.length));
            }
        }
        beanWaves++;
        if (beanWaves >= 5) {
            clearInterval(rainInterval);
            setTimeout(() => {
                isRaining = false;
            }, 1000);
        }
    }, 500);
    // Blur + darken screen
    renderer.domElement.style.filter = 'blur(2px) brightness(0.6)';
    renderer.domElement.style.transition = 'filter 0.5s';
    setTimeout(() => {
        renderer.domElement.style.filter = 'blur(0.5px) brightness(0.85)';
    }, 2500);
    setTimeout(() => {
        renderer.domElement.style.filter = 'none';
    }, 3500);
}

// ============ GAME LOGIC ============
function initGame() {
    // Clear old meshes
    snakeMeshes.forEach((m) => scene.remove(m));
    beanMeshes.forEach((m) => scene.remove(m));
    skinMeshes.forEach((m) => scene.remove(m));
    goldMeshes.forEach((m) => scene.remove(m));
    particles3D.forEach((p) => scene.remove(p.mesh));
    rain3D.forEach((r) => scene.remove(r.mesh));
    goldenProjectiles.forEach((p) => {
        scene.remove(p.mesh);
        releaseGoldenProjLight(p.light);
    });
    fallingBeans.forEach((fb) => scene.remove(fb.mesh));
    snakeMeshes = [];
    beanMeshes = [];
    skinMeshes = [];
    goldMeshes = [];
    particles3D = [];
    rain3D = [];
    goldenProjectiles = [];
    fallingBeans = [];

    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);
    snake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY },
        { x: startX - 3, y: startY },
        { x: startX - 4, y: startY },
    ];
    eatenColors.reset();
    godMode = false;
    boost.reset();
    konamiMatcher.reset();
    heartMatcher.reset();
    typedBuf = '';
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    beans = [];
    shedSkin = [];
    goldBeans = [];
    score = 0;
    // Reload hi-score on each init (in case another tab updated it).
    hiScore = hiScoreStore.load();
    beansEaten = 0;
    gameOver = false;
    window.__gameOverInfo = null;
    paused = false;
    baseSpeed = 150;
    speed = baseSpeed;
    combo.reset();
    growthPending = 0;
    accumulatedPlayMs = 0;
    elapsedSeconds = 0;
    document.getElementById('timer').textContent = '00:00';

    for (let i = 0; i < 15; i++) spawnBean();
    updateUI();
    showMessage('');
}

function spawnBean() {
    const cell = findFreeCell(COLS, ROWS, [snake, beans, shedSkin, goldBeans]);
    if (cell) beans.push({ x: cell.x, y: cell.y, color: Math.floor(Math.random() * COLORS_HEX.length) });
}

function isOccupied(x, y) {
    return isCellOccupied(x, y, [snake, beans, shedSkin, goldBeans]);
}

function gameUpdate() {
    if (gameOver || paused) return;

    // Expire red boost
    if (boost.isExpired(performance.now())) {
        endBoost();
    }

    direction = nextDirection;
    const head = wrapPosition(snake[0].x + direction.x, snake[0].y + direction.y, COLS, ROWS);

    if (
        !godMode &&
        (snake.some((s) => s.x === head.x && s.y === head.y) || shedSkin.some((s) => s.x === head.x && s.y === head.y))
    ) {
        gameOver = true;
        // Show dead "X" eyes on the head
        if (snakeMeshes[0] && snakeMeshes[0].userData && snakeMeshes[0].userData.deadRefs) {
            for (const r of snakeMeshes[0].userData.deadRefs) {
                r.deadX.visible = true;
                r.pupil.visible = false;
                r.hl.visible = false;
            }
        }
        const isNew = score > hiScore;
        saveHiScore();
        updateUI();
        audio.play('heartbeat_stop');
        audio.play('die');
        window.__gameOverInfo = { score, isNew, hi: hiScore };
        const msg = isNew ? `${t('over.new', { score })}` : `${t('over.normal', { score, hi: hiScore })}`;
        showMessage(msg);
        return;
    }

    snake.unshift(head);
    // Water ripple at head position
    spawnRipple(head.x * CELL, head.y * CELL);

    const beanIdx = beans.findIndex((b) => b.x === head.x && b.y === head.y);
    if (beanIdx !== -1) {
        const bean = beans[beanIdx];
        beans.splice(beanIdx, 1);
        // Remove the corresponding mesh so the next spawned bean gets a fresh drop-in animation
        if (beanMeshes[beanIdx]) {
            scene.remove(beanMeshes[beanIdx]);
            beanMeshes.splice(beanIdx, 1);
        }
        // Newest eaten color goes to front of queue → displayed directly behind head
        eatenColors.recordEaten(bean.color);
        eatBean(bean);
        spawnBean();
    }

    const goldIdx = goldBeans.findIndex((b) => b.x === head.x && b.y === head.y);
    if (goldIdx !== -1) {
        goldBeans.splice(goldIdx, 1);
        if (goldMeshes[goldIdx]) {
            scene.remove(goldMeshes[goldIdx]);
            goldMeshes.splice(goldIdx, 1);
        }
        score += 30;
        audio.play('gold');
        spawnParticles3D(head.x * CELL, head.y * CELL, 0xffd700, 12);
        spawnBean();
    }

    if (growthPending > 0) {
        growthPending--;
    } else {
        snake.pop();
    }

    // Decay
    shedSkin.forEach((s) => s.life--);
    shedSkin = shedSkin.filter((s) => s.life > 0);
    goldBeans.forEach((b) => b.life--);
    goldBeans = goldBeans.filter((b) => b.life > 0);

    updateUI();
}

function eatBean(bean) {
    beansEaten++;
    const basePoints = eatScore({
        isRaining,
        isBoosted: boost.active,
        boostMultiplier: boost.multiplier,
        godMode,
    });
    score += basePoints;
    growthPending++;
    audio.play('eat');
    spawnParticles3D(bean.x * CELL, bean.y * CELL, COLORS_HEX[bean.color], 8);
    // Trigger eat animation (chomp + alternate which hand "tosses")
    if (snakeMeshes[0] && snakeMeshes[0].userData) {
        const ud = snakeMeshes[0].userData;
        ud.eatTimer = 220;
        ud.handTimer = ud.handTimerMax;
        ud.handThrowSide = -ud.handThrowSide;
        // Spawn the visible tossed bean at the active hand's palm.
        if (ud.tossBean) {
            ud.tossBean.material.color.setHex(COLORS_HEX[bean.color]);
            ud.tossBean.material.emissive.setHex(COLORS_HEX[bean.color]);
            // Approximate hand palm local position (matches makeHand layout).
            const side = ud.handThrowSide;
            ud.tossFrom.set(side * 0.5, 0.45 - 0.5, 0.1); // shoulder + arm hang
            ud.tossBean.position.copy(ud.tossFrom);
            ud.tossBean.visible = true;
        }
    }

    if (combo.recordEat(bean.color)) {
        triggerMagic(bean.color);
    }

    // Anticipated length after growthPending applied
    const projectedLen = snake.length + growthPending;
    // Heart beat begins at length 20, gets louder until shed at 25
    if (projectedLen >= 20 && projectedLen < 25) {
        audio.play('heartbeat_start');
        // Ramp volume from 0.25 at len=20 to 1.0 at len=24
        const t = (projectedLen - 20) / 4; // 0..1
        const vol = 0.25 + t * 0.85;
        audio.setLoopVolume('beat', vol, 0.2);
    }
    if (projectedLen >= 25) {
        audio.play('heartbeat_stop');
        audio.play('freeze');
        // Shed: drop all segments beyond init length (5) as gray beans (original: keep 5)
        const initLen = 5;
        while (snake.length > initLen) {
            const tail = snake.pop();
            shedSkin.push({ x: tail.x, y: tail.y, life: 600 });
        }
        // Keep most recent 4 eaten colors visible on body[1..4] after shed
        eatenColors.trimAfterShed(initLen);
        // Prevent the trailing snake.pop() in gameUpdate from shrinking us to 4
        growthPending = 1;
        showEffect(t('fx.shed'));
        baseSpeed = Math.max(80, baseSpeed - 5);
        speed = baseSpeed;
    }
    updateUI();
}

const boost = createBoostTimer();

function endBoost() {
    if (!boost.active) return;
    boost.reset();
    speed = baseSpeed;
    audio.play('speed_end');
    showEffect(t('fx.boostEnd'));
}

function triggerMagic(colorIdx) {
    audio.play('combo');
    switch (colorIdx) {
        case 0:
            audio.play('magic_red');
            speed = Math.max(50, baseSpeed - 50);
            boost.trigger(performance.now(), 15000); // refresh 15s window, doubles multiplier
            if (snake.length > 0) {
                spawnParticles3D(snake[0].x * CELL, snake[0].y * CELL, 0xff4444, 15);
            }
            showEffect(t('fx.boost', { mult: boost.multiplier }));
            break;
        case 1:
            audio.play('magic_blue');
            // Rain: blur vision, each bean eaten +10 bonus (handled in eatBean)
            spawnHeavyRain();
            showEffect(t('fx.rain'));
            break;
        case 2:
            audio.play('magic_green');
            // Randomly convert up to 5 shed skin segments back into beans
            {
                const n = Math.min(5, shedSkin.length);
                for (let k = 0; k < n; k++) {
                    const idx = Math.floor(Math.random() * shedSkin.length);
                    const s = shedSkin.splice(idx, 1)[0];
                    spawnFallingBean(s.x, s.y, Math.floor(Math.random() * COLORS_HEX.length));
                }
            }
            showEffect(t('fx.green'));
            break;
        case 3:
            audio.play('magic_orange');
            // Shoot a golden projectile from head in current direction
            if (snake.length > 0) {
                const head = snake[0];
                const pMesh = new THREE.Mesh(goldenProjGeom, goldenProjMat);
                pMesh.position.set(head.x * CELL, 0.5, head.y * CELL);
                scene.add(pMesh);
                const pLight = acquireGoldenProjLight();
                if (pLight) pLight.position.set(head.x * CELL, 0.5, head.y * CELL);
                goldenProjectiles.push({
                    x: head.x * CELL,
                    z: head.y * CELL,
                    dx: direction.x * 0.4,
                    dz: direction.y * 0.4,
                    life: 120,
                    mesh: pMesh,
                    light: pLight,
                });
            }
            showEffect(t('fx.gold'));
            break;
        case 4: {
            audio.play('magic_purple');
            const halfLen = Math.max(3, Math.floor(snake.length / 2));
            while (snake.length > halfLen) snake.pop();
            eatenColors.trimAfterHalve(halfLen);
            // Stop heartbeat if we dropped below threshold
            if (halfLen + growthPending < 20) {
                audio.play('heartbeat_stop');
            }
            showEffect(t('fx.halve'));
            break;
        }
    }
}

// ============ EASTER EGG EFFECTS (extracted to src/effects/easterEggs.ts) ============
const easterEggs = createEasterEggs({
    audio,
    t,
    THREE,
    getSnake: () => snake,
    cell: CELL,
    cols: COLS,
    rows: ROWS,
    colorsHexCount: COLORS_HEX.length,
    spawnParticles3D,
    spawnFallingBean,
});
function activateGodMode() {
    godMode = easterEggs.activateGodMode(godMode);
}
const spawnMeteorShower = easterEggs.spawnMeteorShower;
function activateTribute() {
    easterEggs.activateTribute(tributeState);
}

function updateUI() {
    document.getElementById('score').textContent = String(score).padStart(5, '0');
    document.getElementById('hiscore').textContent = String(hiScore).padStart(5, '0');
    const hm = document.getElementById('hiscore-m');
    if (hm) hm.textContent = String(hiScore).padStart(5, '0');
    document.getElementById('length').textContent = snake.length;
    const comboEl = document.getElementById('combo');
    if (combo.count > 0) {
        const color = COLORS_STR[combo.color];
        comboEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;min-width:10px;min-height:10px;flex:0 0 10px;border-radius:50%;background:${color};vertical-align:middle;margin-right:3px;"></span>×${combo.count}`;
    } else {
        comboEl.innerHTML = '';
    }
    const boostEl = document.getElementById('boost-timer');
    if (boost.active) {
        const remain = boost.remaining(performance.now()) / 1000;
        boostEl.style.display = '';
        boostEl.textContent = `🔥 ×${boost.multiplier}  ${remain.toFixed(1)}s`;
    } else {
        boostEl.style.display = 'none';
    }
}

// ============ 3D SCENE SYNC ============
function updateGoldenProjectiles() {
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

function syncScene(time) {
    // Instructions show whenever paused/game-over; the big restart
    // button only shows after a real game-over (not on the initial
    // idle screen or a mid-run pause).
    const showHints = paused || gameOver;
    const instrEl = document.getElementById('instructions');
    const btnRestartEl = document.getElementById('btn-restart');
    if (instrEl) instrEl.classList.toggle('show', showHints);
    if (btnRestartEl) {
        btnRestartEl.classList.toggle('show', gameOver);
        btnRestartEl.classList.toggle('gameover', gameOver);
        // Anchor the button just below the game-over message so it
        // visually replaces the old "↵ 重新开始" hint line.
        if (gameOver) {
            const msgEl = document.getElementById('message');
            if (msgEl) {
                const r = msgEl.getBoundingClientRect();
                if (r.height > 0) {
                    btnRestartEl.style.top = r.bottom + 16 + 'px';
                    btnRestartEl.style.transform = 'translate(-50%, 0)';
                }
            }
        }
    }
    // Tick boost countdown every frame for smooth display
    if (boost.active) {
        const boostEl = document.getElementById('boost-timer');
        const remain = boost.remaining(performance.now()) / 1000;
        boostEl.style.display = '';
        boostEl.textContent = `🔥 ×${boost.multiplier}  ${remain.toFixed(1)}s`;
    }
    // Sync snake meshes
    while (snakeMeshes.length < snake.length) {
        snakeMeshes.push(createSnakeSegment(snakeMeshes.length === 0));
    }
    while (snakeMeshes.length > snake.length) {
        const m = snakeMeshes.pop();
        scene.remove(m);
    }
    // Smooth interpolation factor based on game tick progress
    const lerpFactor = Math.min(1, gameAccumulator / speed);
    snake.forEach((seg, i) => {
        const mesh = snakeMeshes[i];
        // Interpolate between previous and current positions
        let fromX, fromZ;
        if (prevSnake.length > i) {
            fromX = prevSnake[i].x * CELL;
            fromZ = prevSnake[i].y * CELL;
        } else {
            fromX = seg.x * CELL;
            fromZ = seg.y * CELL;
        }
        const toX = seg.x * CELL;
        const toZ = seg.y * CELL;
        // Handle wrapping (don't lerp across the whole map)
        let dx = toX - fromX;
        let dz = toZ - fromZ;
        if (Math.abs(dx) > (COLS * CELL) / 2) dx = 0;
        if (Math.abs(dz) > (ROWS * CELL) / 2) dz = 0;
        mesh.position.x = fromX + dx * lerpFactor;
        mesh.position.z = fromZ + dz * lerpFactor;
        mesh.position.y = 0.4 + Math.sin(time * 0.003 + i * 0.5) * 0.05;
        if (i === 0) {
            // Rotate head to face direction
            const angle = Math.atan2(direction.x, direction.y);
            mesh.rotation.y = angle;

            // Eye tracking: find nearest bean and aim pupils
            const ud = mesh.userData;
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
                    // transform world dir to head-local (inverse rotation.y)
                    const ca = Math.cos(-angle),
                        sa = Math.sin(-angle);
                    const tlx = nx * ca - nz * sa;
                    const tlz = nx * sa + nz * ca;
                    const len = Math.hypot(tlx, tlz) || 1;
                    lx = tlx / len;
                    lz = tlz / len;
                }
                // Smooth pupil direction to avoid snapping when target bean changes
                if (ud.gazeX === undefined) {
                    ud.gazeX = lx;
                    ud.gazeZ = lz;
                }
                const smooth = 0.12;
                ud.gazeX += (lx - ud.gazeX) * smooth;
                ud.gazeZ += (lz - ud.gazeZ) * smooth;
                // Renormalize so pupil stays on a circle (no shrinking during lerp)
                const gLen = Math.hypot(ud.gazeX, ud.gazeZ) || 1;
                const gx = ud.gazeX / gLen,
                    gz = ud.gazeZ / gLen;
                // Place pupil on upper hemisphere toward bean
                const off = eyeR * 0.5;
                const py = eyeR * 0.62;
                ud.pupilRefs.forEach((r) => {
                    r.pupil.position.set(gx * off, py, gz * off);
                    r.hl.position.set(gx * off - 0.03, py + 0.04, gz * off + 0.05);
                });

                // Blink: squash eye whites on Y for ~120ms periodically
                ud.blinkTimer -= 16;
                if (ud.blinkTimer <= 0) {
                    ud.blinkPhase = 1;
                    ud.blinkTimer = 2500 + Math.random() * 2500;
                }
                if (ud.blinkPhase > 0) {
                    ud.blinkPhase -= 0.12;
                    if (ud.blinkPhase < 0) ud.blinkPhase = 0;
                    const sq = 1 - Math.sin(Math.max(0, ud.blinkPhase) * Math.PI) * 0.92;
                    ud.eyeRefs.forEach((e) => {
                        e.scale.y = sq;
                    });
                    const dead = ud.deadRefs && ud.deadRefs[0] && ud.deadRefs[0].deadX.visible;
                    if (!dead) {
                        ud.pupilRefs.forEach((r) => {
                            r.pupil.visible = sq > 0.4;
                            r.hl.visible = sq > 0.4;
                        });
                    }
                } else {
                    ud.eyeRefs.forEach((e) => {
                        e.scale.y = 1;
                    });
                }

                // Eat animation: mouth stays open during the toss arc
                // (handTimer), then "chews" with rapid open/close pulses.
                const tossingNow = ud.handTimer > 0;
                const chewingNow = ud.chewTimer > 0;
                if (tossingNow || chewingNow) {
                    ud.smile.visible = false;
                    ud.openMouth.visible = true;
                    ud.tongue.visible = true;
                    let mouthScale;
                    if (tossingNow) {
                        // Open wide in anticipation; peak as bean arrives
                        const p = 1 - ud.handTimer / ud.handTimerMax;
                        mouthScale = 0.7 + p * 0.6;
                    } else {
                        // Chew pulses: 4 quick open/close cycles
                        const cp = 1 - ud.chewTimer / ud.chewTimerMax;
                        mouthScale = 0.5 + Math.abs(Math.sin(cp * Math.PI * 4)) * 0.7;
                    }
                    ud.openMouth.scale.set(mouthScale, mouthScale, 1);
                    ud.tongue.scale.set(mouthScale, mouthScale, 1);
                    // Decay chew timer (handTimer decays in the hand block below)
                    if (chewingNow) ud.chewTimer -= 16;
                    // Keep legacy eatTimer in sync so other systems still see it
                    ud.eatTimer = tossingNow ? ud.handTimer : ud.chewTimer;
                } else {
                    ud.smile.visible = true;
                    ud.openMouth.visible = false;
                    ud.tongue.visible = false;
                    ud.eatTimer = 0;
                }
                // Head bob during chew for an obvious "munching" motion
                if (chewingNow) {
                    const cp = 1 - ud.chewTimer / ud.chewTimerMax;
                    const bob = Math.abs(Math.sin(cp * Math.PI * 4)) * 0.12;
                    mesh.position.y = bob; // head pops down with each chomp
                    mesh.scale.set(1 + bob * 0.4, 1 - bob * 0.5, 1 + bob * 0.4);
                } else if (!tossingNow) {
                    mesh.position.y = 0;
                    mesh.scale.set(1, 1, 1);
                }
                // Hand animation: alternating "swim/paddle" stroke while
                // moving, with one hand performing a bigger toss arc
                // during the eat window.
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
                        // Base alternating paddle: each hand 180° out of phase
                        const phase = swimPhase + (h.side > 0 ? 0 : Math.PI);
                        const paddle = Math.sin(phase) * 0.45;
                        let rx = h.baseRotX - paddle;
                        let rz = h.baseRotZ + Math.cos(phase) * 0.12;
                        if (tossing && h.side === throwSide) {
                            // Override with bigger toss arc on the throwing hand
                            rx = h.baseRotX - swing * 1.9;
                            rz = h.baseRotZ - h.side * swing * 0.95;
                        } else if (tossing) {
                            // Other hand: small celebratory bob on top of paddle
                            rx -= swing * 0.25;
                        }
                        h.root.rotation.x = rx;
                        h.root.rotation.z = rz;
                    }
                    // Animate the tossed bean: arc from hand to mouth, then hide
                    // and start the chew phase.
                    if (ud.tossBean && ud.tossBean.visible) {
                        if (ud.handTimer > 0) {
                            const tp = p; // 0 -> 1
                            const from = ud.tossFrom,
                                to = ud.tossTo;
                            ud.tossBean.position.x = from.x + (to.x - from.x) * tp;
                            ud.tossBean.position.z = from.z + (to.z - from.z) * tp;
                            // Higher parabolic arc up then down into the mouth
                            const baseY = from.y + (to.y - from.y) * tp;
                            ud.tossBean.position.y = baseY + Math.sin(tp * Math.PI) * 1.3;
                            ud.tossBean.rotation.x += 0.22;
                            ud.tossBean.rotation.y += 0.28;
                            const s = 1 - tp * 0.4;
                            ud.tossBean.scale.setScalar(s);
                        } else {
                            ud.tossBean.visible = false;
                            ud.tossBean.scale.setScalar(1);
                            // Bean has entered the mouth: start chewing
                            ud.chewTimer = ud.chewTimerMax;
                        }
                    }
                }
            }
        }
        // Body segments - color = eaten bean colors (newest at body[1])
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

    // Sync bean meshes
    while (beanMeshes.length < beans.length) {
        beanMeshes.push(createBeanMesh(0));
    }
    while (beanMeshes.length > beans.length) {
        const m = beanMeshes.pop();
        scene.remove(m);
    }
    beans.forEach((bean, i) => {
        const mesh = beanMeshes[i];
        // Drop-from-sky easing
        if (mesh.userData.dropPhase > 0) {
            mesh.userData.dropPhase = Math.max(0, mesh.userData.dropPhase - 0.035);
            if (mesh.userData.dropPhase === 0) {
                mesh.userData.dropBounce = 1.0;
                audio.play('plop');
                spawnRipple(bean.x * CELL, bean.y * CELL);
            }
        } else if (mesh.userData.dropBounce > 0) {
            mesh.userData.dropBounce = Math.max(0, mesh.userData.dropBounce - 0.06);
        }
        const dp = mesh.userData.dropPhase;
        const dropY = dp * dp * 22; // ease-in fall
        const restY = 0.4 + Math.sin(time * 0.004 + bean.x + bean.y) * 0.15;
        mesh.position.set(bean.x * CELL, restY + dropY, bean.y * CELL);
        // Squash on landing
        const b = mesh.userData.dropBounce;
        mesh.scale.set(1 + b * 0.4, 1 - b * 0.5, 1 + b * 0.4);
        mesh.rotation.y = time * 0.002;
        mesh.material.color.setHex(COLORS_HEX[bean.color]);
        mesh.material.emissive.setHex(COLORS_HEX[bean.color]);
        mesh.material.emissiveIntensity = 0.55 + Math.sin(time * 0.005 + i) * 0.2;
        if (mesh.userData.halo) {
            mesh.userData.halo.material.color.setHex(COLORS_HEX[bean.color]);
            const haloFade = dp > 0 ? 1 - dp : 1;
            mesh.userData.halo.material.opacity = (0.5 + Math.sin(time * 0.004 + i) * 0.15) * haloFade;
        }
    });

    // Sync gold beans
    while (goldMeshes.length < goldBeans.length) {
        goldMeshes.push(createGoldMesh());
    }
    while (goldMeshes.length > goldBeans.length) {
        const m = goldMeshes.pop();
        scene.remove(m);
    }
    goldBeans.forEach((bean, i) => {
        const mesh = goldMeshes[i];
        if (mesh.userData.dropPhase > 0) {
            mesh.userData.dropPhase = Math.max(0, mesh.userData.dropPhase - 0.035);
            if (mesh.userData.dropPhase === 0) {
                mesh.userData.dropBounce = 1.0;
                audio.play('plop');
                spawnRipple(bean.x * CELL, bean.y * CELL);
            }
        } else if (mesh.userData.dropBounce > 0) {
            mesh.userData.dropBounce = Math.max(0, mesh.userData.dropBounce - 0.06);
        }
        const dp = mesh.userData.dropPhase;
        const dropY = dp * dp * 22;
        const restY = 0.6 + Math.sin(time * 0.006 + i) * 0.2;
        mesh.position.set(bean.x * CELL, restY + dropY, bean.y * CELL);
        const b = mesh.userData.dropBounce;
        mesh.scale.set(1 + b * 0.4, 1 - b * 0.5, 1 + b * 0.4);
        mesh.rotation.x = time * 0.003;
        mesh.rotation.y = time * 0.005;
    });

    // Sync shed skin
    while (skinMeshes.length < shedSkin.length) {
        skinMeshes.push(createSkinMesh());
    }
    while (skinMeshes.length > shedSkin.length) {
        const m = skinMeshes.pop();
        scene.remove(m);
    }
    shedSkin.forEach((skin, i) => {
        const mesh = skinMeshes[i];
        mesh.position.set(skin.x * CELL, 0.1, skin.y * CELL);
        mesh.material.opacity = Math.min(0.7, skin.life / 100);
    });

    // Update particles
    particles3D.forEach((p) => {
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.vy -= 0.003;
        p.life--;
        p.mesh.material.opacity = p.life / 60;
        p.mesh.scale.setScalar(p.life / 60);
    });
    particles3D = particles3D.filter((p) => {
        if (p.life <= 0) {
            scene.remove(p.mesh);
            return false;
        }
        return true;
    });

    // Update rain
    rain3D.forEach((r) => {
        r.mesh.position.y -= r.speed;
        r.life--;
        r.mesh.material.opacity = Math.min(0.7, r.life / 60);
    });
    rain3D = rain3D.filter((r) => {
        if (r.life <= 0 || r.mesh.position.y < -1) {
            scene.remove(r.mesh);
            return false;
        }
        return true;
    });

    // Update golden projectiles
    updateGoldenProjectiles();

    // Update falling beans
    for (let i = fallingBeans.length - 1; i >= 0; i--) {
        const fb = fallingBeans[i];
        fb.vy += fb.gravity;
        fb.mesh.position.y -= fb.vy;
        fb.mesh.rotation.y += 0.05;
        // Landed
        if (fb.mesh.position.y <= 0.4) {
            fb.mesh.position.y = 0.4;
            scene.remove(fb.mesh);
            // Add the bean to the game
            if (!isOccupied(fb.targetX, fb.targetY)) {
                beans.push({ x: fb.targetX, y: fb.targetY, color: fb.color });
            } else {
                // Find nearby spot
                spawnBean();
            }
            spawnParticles3D(fb.targetX * CELL, fb.targetY * CELL, COLORS_HEX[fb.color], 6);
            spawnRipple(fb.targetX * CELL, fb.targetY * CELL);
            fallingBeans.splice(i, 1);
        }
    }

    // Animate bubbles/particles
    bubbles.forEach((b) => {
        b.position.y += b.userData.speed;
        b.position.x += Math.sin(time * 0.001 + b.userData.phase) * 0.004;
        if (b.position.y > 5.5) {
            b.position.y = -0.2;
            b.position.x = (Math.random() - 0.5) * COLS * CELL * 1.4 + (COLS * CELL) / 2;
            b.position.z = (Math.random() - 0.5) * ROWS * CELL * 1.4 + (ROWS * CELL) / 2;
        }
    });

    // Animate god-ray shafts — slow drift + opacity shimmer
    shafts.forEach((s) => {
        s.userData.driftPhase += s.userData.driftSpeed;
        s.position.x = s.userData.baseX + Math.sin(s.userData.driftPhase) * 1.5;
        s.position.z = s.userData.baseZ + Math.cos(s.userData.driftPhase * 0.7) * 1.5;
        (s.material as THREE.Material & { opacity: number }).opacity =
            s.userData.baseOpacity * (0.7 + Math.sin(time * 0.0008 + s.userData.driftPhase) * 0.3);
    });

    // Animate caustics — scroll opposite directions
    causticsTex.offset.x = (time * 0.00003) % 1;
    causticsTex.offset.y = (time * 0.00002) % 1;
    causticsTex2.offset.x = (-time * 0.00004) % 1;
    causticsTex2.offset.y = (time * 0.000035) % 1;
    (causticsMesh.material as THREE.Material & { opacity: number }).opacity = 0.4 + Math.sin(time * 0.0012) * 0.08;

    // Animate water surface waves
    const wpos = waterGeom.attributes.position;
    for (let i = 0; i < wpos.count; i++) {
        const bx = waterBasePositions[i * 3],
            by = waterBasePositions[i * 3 + 1];
        const z = Math.sin(bx * 0.4 + time * 0.002) * 0.15 + Math.cos(by * 0.3 + time * 0.0017) * 0.12;
        wpos.array[i * 3 + 2] = z;
    }
    wpos.needsUpdate = true;

    // Animate grass tufts — ambient sway + react to snake head proximity
    const headMesh = snakeMeshes[0];
    const hx = headMesh ? headMesh.position.x : -999;
    const hz = headMesh ? headMesh.position.z : -999;
    grassTufts.forEach((t) => {
        const swayBase = Math.sin(time * t.freq + t.phase) * 0.08;
        const dx = t.baseX - hx;
        const dz = t.baseZ - hz;
        const dist = Math.hypot(dx, dz);
        // Within ~2.5 cells, push grass outward from snake (radial bend)
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
        // Sway by adjusting position slightly (shake) and rotating tuft
        t.mesh.position.x = t.baseX + Math.sin(time * 0.002 + t.phase) * 0.04 + reactX;
        t.mesh.position.z = t.baseZ + Math.cos(time * 0.0017 + t.phase) * 0.04 + reactZ;
        t.mesh.rotation.z = t.baseRot + swayBase + pulse * Math.sign(Math.sin(t.phase));
        const s = t.baseScale * (1 + Math.sin(time * 0.003 + t.phase) * 0.05 + pulse * 0.5);
        t.mesh.scale.set(s, s, 1);
    });

    // Update water ripples — ease-out expansion, soft fade
    for (let i = rippleRings.length - 1; i >= 0; i--) {
        const r = rippleRings[i];
        if (r.delay > 0) {
            r.delay--;
            continue;
        }
        r.life--;
        const t = 1 - r.life / r.maxLife; // 0..1
        const eased = 1 - Math.pow(1 - t, 2); // ease-out quad
        const scale = r.startScale + (r.endScale - r.startScale) * eased;
        r.mesh.scale.set(scale, scale, 1);
        // Fade in fast at start, fade out slow at end
        const fadeIn = Math.min(1, t * 4);
        const fadeOut = Math.max(0, 1 - t);
        (r.mesh.material as THREE.Material & { opacity: number }).opacity = 0.28 * fadeIn * fadeOut;
        if (r.life <= 0) {
            scene.remove(r.mesh);
            (r.mesh.material as THREE.Material).dispose();
            rippleRings.splice(i, 1);
        }
    }

    // Camera fixed top-down (auto-fit to viewport / aspect)
    fitCameraToPond();
}

// ============ GAME LOOP ============
let lastGameTime = performance.now();
let gameAccumulator = 0;
// Store previous snake positions for smooth interpolation
let prevSnake = [];
// Timer — tracks accumulated unpaused playtime so pausing/idle don't bleed
// into the displayed elapsed time.
let accumulatedPlayMs = 0;
let elapsedSeconds = 0;

function mainLoop(timestamp) {
    const delta = timestamp - lastGameTime;
    lastGameTime = timestamp;

    if (!paused && !gameOver) {
        gameAccumulator += delta;
        while (gameAccumulator >= speed) {
            gameAccumulator -= speed;
            // Save positions before update for interpolation
            prevSnake = snake.map((s) => ({ x: s.x, y: s.y }));
            gameUpdate();
        }
        // Update timer (only counts active play time, not pauses / pre-start idle)
        accumulatedPlayMs += delta;
        const newSeconds = Math.floor(accumulatedPlayMs / 1000);
        if (newSeconds !== elapsedSeconds) {
            elapsedSeconds = newSeconds;
            const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
            const secs = String(elapsedSeconds % 60).padStart(2, '0');
            document.getElementById('timer').textContent = `${mins}:${secs}`;
        }
    }

    syncScene(timestamp);
    renderer.render(scene, camera);
    requestAnimationFrame(mainLoop);
}

// ============ INPUT ============
document.addEventListener('keydown', (e) => {
    audio.init(); // Init audio on first interaction

    // ----- Easter eggs (always-on capture) -----
    // 1) Konami code → 樊一鹏模式
    if (konamiMatcher.push(e.key)) {
        activateGodMode();
    }
    // 2) Type "daidai" → meteor shower
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        typedBuf = (typedBuf + e.key.toLowerCase()).slice(-6);
        if (typedBuf === 'daidai') {
            typedBuf = '';
            spawnMeteorShower();
        }
    }
    // 5) Heart pattern → tribute
    const arrowOnly = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (arrowOnly.includes(e.key)) {
        if (heartMatcher.push(e.key)) {
            activateTribute();
        }
    }

    if (e.key === 'Enter' && (gameOver || paused)) {
        audio.init();
        initGame();
        paused = false;
        showMessage('');
        const bp = document.getElementById('btn-pause');
        if (bp) bp.textContent = '⏸';
        return;
    }
    if (e.key === ' ') {
        // Pause is meaningless when the run already ended — leave the
        // game-over screen intact so the player can read their score
        // and choose to restart.
        if (gameOver) {
            e.preventDefault();
            return;
        }
        paused = !paused;
        showMessage(paused ? t('paused') : '');
        const bp = document.getElementById('btn-pause');
        if (bp) bp.textContent = paused ? '▶' : '⏸';
        e.preventDefault();
        return;
    }
    // Backdoor: 1-5 trigger magic; 6 grows body — only when devtools is open (or localhost)
    if (!gameOver && devtoolsOpen) {
        if ('12345'.includes(e.key)) {
            triggerMagic(parseInt(e.key) - 1);
            e.preventDefault();
            return;
        }
        if (e.key === '6') {
            growthPending++;
            showEffect(t('fx.lenPlus'));
            e.preventDefault();
            return;
        }
    }
    const newDir = keyToDirection(e.key);
    if (newDir) {
        heldDirKeys.add(e.key);
        const combined = combineHeldDir();
        if (combined && !isOppositeDir(direction, combined)) {
            nextDirection = combined;
        }
        e.preventDefault();
    }
});
// ============ DIAGONAL MOVEMENT (held-key tracking) ============
const heldDirKeys = new Set<string>();
function combineHeldDir() {
    return combineHeldDirImpl(heldDirKeys);
}
window.addEventListener('keyup', (e) => {
    heldDirKeys.delete(e.key);
});
window.addEventListener('blur', () => heldDirKeys.clear());

// ============ TOUCH / SWIPE CONTROLS ============
(function () {
    let sx = 0,
        sy = 0,
        tracking = false,
        moved = false;
    const SWIPE_THRESHOLD = 24; // px
    function applyDir(dx, dy) {
        const nd = classifyDelta(dx, dy);
        if (!nd) return;
        if (!isOppositeDir(direction, nd)) {
            nextDirection = nd;
        }
    }
    const surface = renderer.domElement;
    surface.addEventListener(
        'touchstart',
        (e) => {
            audio.init();
            if (gameOver) {
                e.preventDefault();
                return;
            }
            const t = e.touches[0];
            sx = t.clientX;
            sy = t.clientY;
            tracking = true;
            moved = false;
            e.preventDefault();
        },
        { passive: false },
    );
    surface.addEventListener(
        'touchmove',
        (e) => {
            if (!tracking) return;
            const t = e.touches[0];
            const dx = t.clientX - sx,
                dy = t.clientY - sy;
            if (Math.hypot(dx, dy) >= SWIPE_THRESHOLD) {
                moved = true;
                // Swipe also starts/unpauses the game
                if (paused && !gameOver) {
                    paused = false;
                    showMessage('');
                    audio.play('start');
                }
                applyDir(dx, dy);
                // Reset origin so continued drag can chain another direction
                sx = t.clientX;
                sy = t.clientY;
            }
            e.preventDefault();
        },
        { passive: false },
    );
    surface.addEventListener(
        'touchend',
        (e) => {
            // Quick tap (no swipe) → start the game only from the initial
            // idle screen. A mid-run pause requires the explicit ▶ button
            // so an accidental tap (pocket, palm, double-tap) can't kick
            // the player back into a running game.
            if (tracking && !moved && paused && !gameOver) {
                const isInitial = score === 0 && snake && snake.length <= 5;
                if (isInitial) {
                    paused = false;
                    showMessage('');
                    audio.play('start');
                }
            }
            tracking = false;
            e.preventDefault();
        },
        { passive: false },
    );
    // Pause button
    const btnPause = document.getElementById('btn-pause');
    btnPause.addEventListener('click', (e) => {
        e.preventDefault();
        audio.init();
        // After game over the pause button is meaningless — the player
        // must use the dedicated restart button (or ↵ / gamepad shortcut).
        if (gameOver) return;
        paused = !paused;
        showMessage(paused ? t('paused') : '');
        btnPause.textContent = paused ? '▶' : '⏸';
    });
    // Restart button (single consolidated UI)
    function doRestart() {
        audio.init();
        initGame();
        paused = false;
        btnPause.textContent = '⏸';
        showMessage('');
    }
    const btnRestart = document.getElementById('btn-restart');
    btnRestart.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        doRestart();
    });
    // Refresh the button label to reflect the active input modality
    // (keyboard shortcut, gamepad glyph, or touch).
    function refreshRestartBtnLabel() {
        if (!btnRestart) return;
        btnRestart.textContent = getRestartLabel(t, currentModality(), {
            gpBtnB: () => gpBtn('B'),
        });
    }
    refreshRestartBtnLabel();
    window.__refreshRestartBtnLabel = refreshRestartBtnLabel;
    // Mute button
    const btnMute = document.getElementById('btn-mute');
    function refreshMuteUI() {
        const m = audio.muted;
        btnMute.textContent = m ? '🔇' : '🔊';
        btnMute.classList.toggle('muted', m);
        btnMute.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
        const hint = document.getElementById('mute-hint');
        if (hint) hint.style.display = m ? 'block' : 'none';
    }
    btnMute.addEventListener('click', (e) => {
        e.preventDefault();
        audio.init();
        audio.setMuted(!audio.muted);
        refreshMuteUI();
    });
    refreshMuteUI();
    // Language switcher
    // Language switcher (extracted to src/i18n/dom.ts)
    const updateLangBtnState = installLangMenu({
        getLang: () => LANG,
        setLang,
        t,
        canSwitch: () => paused && !gameOver,
        showEffect,
    });
    if (updateLangBtnState) window.__updateLangBtnState = updateLangBtnState;
    // ============ GAMEPAD CONTROLLER SUPPORT ============
    (function setupGamepad() {
        const prevButtons = [];
        const DEAD = 0.4;
        function applyGamepadGlyphs() {
            // Defense-in-depth: this function paints the UI as if a gamepad
            // is connected, so refuse to run when one isn't. Several callers
            // (e.g. refreshDynamicI18n after a language switch) invoke this
            // unconditionally — without this guard we'd light up the gamepad
            // hints on keyboard / touch users every time they change locale.
            if (!hasGamepad) return;
            const hintKey = document.querySelector('#instr-line .hint-key') as HTMLElement | null;
            if (hintKey) {
                hintKey.textContent = t('hint.pauseGamepad', { btn: gpBtn('A') });
                hintKey.style.display = 'inline';
            }
            const hintSep = document.querySelector('#instr-line .hint-sep') as HTMLElement | null;
            if (hintSep) hintSep.style.display = 'inline';
            // Restart button label now also reflects gamepad modality
            if (typeof window.__refreshRestartBtnLabel === 'function') window.__refreshRestartBtnLabel();
            const mb = document.getElementById('btn-mute');
            if (mb && hasTouchEnv && !hasFineKeyboardEnv) mb.title = t('btn.sound') + ' (' + gpBtn('X') + ')';
            const lb = document.getElementById('btn-lang');
            if (lb) lb.title = t('btn.language') + ' (' + gpBtn('Y') + ')';
            const lbadge = document.getElementById('btn-lang-badge');
            if (lbadge) {
                lbadge.textContent = isPSGamepad ? '△' : 'Y';
                lbadge.classList.add('show');
            }
        }
        window.__applyGamepadGlyphs = applyGamepadGlyphs;
        function markGamepad() {
            const firstTime = !hasGamepad;
            hasGamepad = true;
            if (!firstTime) return;
            if (typeof window.__refreshIdlePrompt === 'function') window.__refreshIdlePrompt();
            applyGamepadGlyphs();
        }
        window.__markGamepad = markGamepad;
        window.__applyGamepadGlyphs = applyGamepadGlyphs;
        // Log first-seen gamepad id once so unknown pads can be added to the PS regex
        let loggedPad = false;
        function poll() {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (const pad of pads) {
                if (!pad || pad.connected === false) continue;
                const idLower = (pad.id || '').trim().toLowerCase();
                if (!idLower) continue;
                if (!loggedPad) {
                    console.log('[gamepad] detected:', pad.id, 'mapping:', pad.mapping);
                    loggedPad = true;
                }
                const wasPS = isPSGamepad;
                if (/dualshock|dualsense|playstation|ps[345]|sony|054c/.test(idLower)) isPSGamepad = true;
                markGamepad();
                // If we just discovered it's a PS pad after first marking, re-apply glyphs
                if (!wasPS && isPSGamepad) {
                    applyGamepadGlyphs();
                    if (paused && !gameOver && typeof window.__refreshIdlePrompt === 'function')
                        window.__refreshIdlePrompt();
                }
                // Direction: D-pad (buttons 12-15) or left stick (axes 0,1)
                let dx = 0,
                    dy = 0;
                if (pad.buttons[12]?.pressed) dy = -1;
                else if (pad.buttons[13]?.pressed) dy = 1;
                if (pad.buttons[14]?.pressed) dx = -1;
                else if (pad.buttons[15]?.pressed) dx = 1;
                const ax = pad.axes[0] || 0,
                    ay = pad.axes[1] || 0;
                if (!dx && !dy && (Math.abs(ax) > DEAD || Math.abs(ay) > DEAD)) {
                    const nd2 = classifyDelta(ax, ay);
                    if (nd2) {
                        dx = nd2.x;
                        dy = nd2.y;
                    }
                }
                if (dx || dy) {
                    const nd = { x: dx, y: dy };
                    if (paused && !gameOver) {
                        audio.init();
                        paused = false;
                        showMessage('');
                        audio.play('start');
                    }
                    // After game over, direction input is ignored —
                    // restart requires an explicit A/B/Start/Back press
                    // (or the on-screen restart button / ↵ Enter).
                    if (!gameOver && !isOppositeDir(direction, nd)) nextDirection = nd;
                }
                // Edge-triggered button presses
                const prev = prevButtons[pad.index] || [];
                pad.buttons.forEach((b, i) => {
                    const wasDown = !!prev[i];
                    if (b.pressed && !wasDown) {
                        // A/Cross (0) or Start (9): pause/unpause or restart
                        if (i === 0 || i === 9) {
                            audio.init();
                            if (gameOver) doRestart();
                            else {
                                paused = !paused;
                                showMessage(paused ? t('paused') : '');
                                btnPause.textContent = paused ? '▶' : '⏸';
                            }
                        }
                        // B/Circle (1) or Back (8): restart — only when paused or game over
                        if (i === 1 || i === 8) {
                            if (paused || gameOver) {
                                audio.init();
                                doRestart();
                            }
                        }
                        // X/Square (2): toggle mute (mobile / touch only — desktop uses system volume)
                        if (i === 2 && hasTouchEnv && !hasFineKeyboardEnv) {
                            audio.init();
                            audio.setMuted(!audio.muted);
                            refreshMuteUI();
                            showEffect(audio.muted ? '🔇 ' + t('btn.sound') : '🔊 ' + t('btn.sound'));
                        }
                        // Y/Triangle (3): cycle language — only while paused / waiting to start (not game over)
                        if (i === 3 && paused && !gameOver) {
                            const langs = ['zh-cn', 'zh-tw', 'en-us', 'ja-jp', 'ko-kr', 'es-es'];
                            const idx = langs.indexOf(LANG);
                            const next = langs[(idx + 1) % langs.length];
                            setLang(next);
                            showEffect('🌐 ' + next.toUpperCase());
                        }
                    }
                });
                prevButtons[pad.index] = pad.buttons.map((b) => b.pressed);
            }
            requestAnimationFrame(poll);
        }
        window.addEventListener('gamepadconnected', () => {
            markGamepad();
            requestAnimationFrame(poll);
        });
        // Some browsers (Chrome) need an active poll loop even without an event
        requestAnimationFrame(poll);
    })();
    // More menu toggle
    const moreMenu = document.getElementById('more-menu');
    const morePopup = document.getElementById('more-popup');
    moreMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        morePopup.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!moreMenu.contains(e.target as Node)) morePopup.classList.remove('open');
    });
    // Show ⋯ only when info-bar would overflow
    const infoBar = document.getElementById('info-bar');
    function checkInfoBarOverflow() {
        // Try expanding (show HISCORE + GitHub). If it fits, keep expanded; otherwise stay compact.
        const wasCompact = infoBar.classList.contains('compact');
        infoBar.classList.remove('compact');
        const fits = infoBar.scrollWidth <= infoBar.clientWidth + 1;
        if (!fits) infoBar.classList.add('compact');
        const isCompact = infoBar.classList.contains('compact');
        if (wasCompact !== isCompact) {
            applyCanvasSize();
            fitCameraToPond();
        }
    }
    window.addEventListener('resize', checkInfoBarOverflow);
    setTimeout(checkInfoBarOverflow, 0);
    // Re-check whenever score/hiscore text length changes
    new MutationObserver(checkInfoBarOverflow).observe(infoBar, {
        subtree: true,
        characterData: true,
        childList: true,
    });
})();

// Resize
window.addEventListener('resize', () => {
    applyCanvasSize();
    fitCameraToPond();
    // Resize underwater overlay so it always covers the screen
    const distance = 0.5;
    const vFov = (camera.fov * Math.PI) / 180;
    const h = 2 * Math.tan(vFov / 2) * distance;
    const w = h * camera.aspect;
    overlayMesh.scale.set(w, h, 1);
});

// ============ TEST API (used by Playwright e2e specs) ============
// Intentionally exposed in production builds too — payload is tiny and lets
// bug reproductions run straight from devtools.
window.__test = {
    state: () => ({
        score,
        hiScore,
        gameOver,
        paused,
        godMode,
        snake: snake.map((s) => ({ x: s.x, y: s.y })),
        direction: { x: direction.x, y: direction.y },
        nextDirection: { x: nextDirection.x, y: nextDirection.y },
        beans: beans.map((b) => ({ x: b.x, y: b.y, color: b.color })),
        goldBeans: goldBeans.map((g) => ({ x: g.x, y: g.y, life: g.life })),
        shedSkin: shedSkin.map((s) => ({ x: s.x, y: s.y, life: s.life })),
        eatenColors: eatenColors.snapshot(),
        comboColor: combo.color,
        comboCount: combo.count,
        isBoosted: boost.active,
        boostMultiplier: boost.multiplier,
        isRaining,
        growthPending,
        beansEaten,
        goldenProjectiles: goldenProjectiles.length,
        speed,
        baseSpeed,
        cameraOffsetX: camera.position.x - ((COLS - 1) * CELL) / 2,
    }),
    setSnake: (cells) => {
        snake = cells.map((c) => ({ x: c.x, y: c.y }));
        eatenColors.reset();
        growthPending = 0;
    },
    setDirection: (x, y) => {
        direction = { x, y };
        nextDirection = { x, y };
    },
    clearBeans: () => {
        beans = [];
    },
    placeBean: (x, y, color) => {
        beans.push({ x, y, color: color | 0 });
    },
    clearGold: () => {
        goldBeans = [];
    },
    placeGold: (x, y) => {
        goldBeans.push({ x, y, life: 300 });
    },
    clearShed: () => {
        shedSkin = [];
    },
    placeShed: (x, y) => {
        shedSkin.push({ x, y, life: 600 });
    },
    setPaused: (p) => {
        paused = !!p;
    },
    setGameOver: (g) => {
        gameOver = !!g;
    },
    setGodMode: (g) => {
        godMode = !!g;
    },
    setComboColor: (c, n) => {
        combo.color = c;
        combo.count = n;
    },
    setBaseSpeed: (s) => {
        baseSpeed = s;
        speed = s;
    },
    step: () => {
        const wasPaused = paused;
        paused = false;
        try {
            gameUpdate();
        } finally {
            paused = wasPaused;
        }
    },
    triggerMagic: (c) => {
        triggerMagic(c);
    },
    stepProjectiles: (n) => {
        const steps = Math.max(0, Math.floor(Number(n)) || 0);
        for (let i = 0; i < steps; i++) updateGoldenProjectiles();
    },
    dismissTribute: () => {
        const el = document.getElementById('tribute-overlay');
        if (el) {
            const t = Number(el.dataset.staticTimer);
            if (t) clearInterval(t);
            el.remove();
        }
        tributeState.tributeActive = false;
    },
    tributeTriggered: () => tributeState.tributeTriggeredThisLoad,
    callActivateTribute: () => {
        activateTribute();
    },
    COLS: () => COLS,
    ROWS: () => ROWS,
};

// ============ START ============
initGame();
// Check for already-connected gamepad and prefer its prompts
if (detectGamepadNow() && typeof window.__markGamepad === 'function') {
    window.__markGamepad();
}
showMessage(getStartPrompt());
paused = true;
// Re-check shortly after load — some browsers expose gamepads asynchronously
setTimeout(() => {
    if (detectGamepadNow() && typeof window.__markGamepad === 'function') {
        window.__markGamepad();
        if (paused && !gameOver) showMessage(getStartPrompt());
    }
}, 500);
function refreshIdlePrompt() {
    if (!paused) return;
    if (gameOver) return; // gameOver renders its own message
    showMessage(getStartPrompt());
}
function refreshDynamicI18n() {
    // Re-render visible message based on game state
    if (gameOver && window.__gameOverInfo) {
        const { score, isNew, hi } = window.__gameOverInfo;
        const msg = isNew ? t('over.new', { score }) : t('over.normal', { score, hi });
        showMessage(msg);
    } else if (paused) {
        // Distinguish initial-idle (score==0, hasn't moved) from mid-game pause
        const isInitial =
            typeof score !== 'undefined' && score === 0 && typeof snake !== 'undefined' && snake && snake.length <= 5;
        if (isInitial) {
            showMessage(getStartPrompt());
        } else {
            showMessage(t('paused'));
        }
    }
    // Gamepad glyphs (also updates btn-mute/btn-lang titles)
    try {
        if (typeof window.__applyGamepadGlyphs === 'function') window.__applyGamepadGlyphs();
    } catch (_) {}
    // Refresh the consolidated restart button label after locale change
    try {
        if (typeof window.__refreshRestartBtnLabel === 'function') window.__refreshRestartBtnLabel();
    } catch (_) {}
}
window.__refreshDynamicI18n = refreshDynamicI18n;
// Update prompt dynamically if first interaction reveals a different modality
window.addEventListener(
    'touchstart',
    () => {
        if (!hasGamepad) refreshIdlePrompt();
    },
    { once: true, passive: true },
);
window.addEventListener(
    'keydown',
    () => {
        if (!hasGamepad) refreshIdlePrompt();
    },
    { once: true },
);
window.__refreshIdlePrompt = refreshIdlePrompt;
document.addEventListener('keydown', function startHandler(e) {
    const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
    if (dirs.includes(e.key)) {
        paused = false;
        showMessage('');
        audio.play('start');
        document.removeEventListener('keydown', startHandler);
    }
});
requestAnimationFrame(mainLoop);

// Auto-pause when the window loses focus / tab is hidden so the timer
// (and the snake) don't keep running while the user is away.
function autoPauseOnFocusLoss() {
    if (gameOver || paused) return;
    paused = true;
    showMessage(t('paused'));
    const bp = document.getElementById('btn-pause');
    if (bp) bp.textContent = '▶';
}
window.addEventListener('blur', autoPauseOnFocusLoss);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autoPauseOnFocusLoss();
});

// Random sky-drop event: every frame we roll the dice, but at most one
// event per 60 s. Each event drops 0–3 random beans from the sky.
let nextSkyDropAt = performance.now() + 60000 + Math.random() * 60000;
setInterval(() => {
    if (gameOver || paused) return;
    if (performance.now() < nextSkyDropAt) return;
    nextSkyDropAt = performance.now() + 60000 + Math.random() * 30000;
    const count = Math.floor(Math.random() * 4); // 0..3
    for (let i = 0; i < count; i++) {
        let tries = 0,
            x,
            y;
        do {
            x = Math.floor(Math.random() * COLS);
            y = Math.floor(Math.random() * ROWS);
        } while (isOccupied(x, y) && ++tries < 30);
        if (tries >= 30) continue;
        const c = Math.floor(Math.random() * COLORS_HEX.length);
        setTimeout(() => spawnFallingBean(x, y, c), i * 180);
    }
}, 1000);
