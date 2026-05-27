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
import { createGameStep } from './game/step';
import { findFreeCell, isCellOccupied } from './gameRules';
import { createHeartMatcher, HEART_SEQUENCE } from './heartSequence';
import { installTestApi } from './testApi';
import { applyI18nDOM as applyI18nDOMImpl } from './i18n/dom';
import { createT, hasLocale, pickLang } from './i18n/index';
import './i18n/zh-cn';
import './i18n/zh-tw';
import './i18n/en-us';
import './i18n/ja-jp';
import './i18n/ko-kr';
import './i18n/es-es';
import './i18n/fr-fr';
import './i18n/it-it';
import './i18n/de-de';
import './i18n/pt-br';
import './i18n/pl-pl';
import './i18n/ru-ru';
import './i18n/th-th';
import { detectConnectedGamepad, glyphForButton } from './input/gamepad';
import { installKeyboardControls } from './input/keyboard';
import { installTouchControls } from './input/touch';
import { getStartPrompt as getStartPromptImpl } from './input/promptStrings';
import { createKonamiMatcher } from './konami';
import { computeCameraFit, computeGridDims } from './layout';
import { buildAtmosphere } from './scene/atmosphere';
import { buildGrass } from './scene/grass';
import { createMeshFactories } from './scene/meshFactories';
import { buildPond } from './scene/pond';
import { buildWater } from './scene/water';
import { createSceneSync } from './scene/sync';
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
// True once the player has explicitly started the run (first unpause from
// the idle screen). Resets on initGame. Used to gate the "direction input
// implicitly unpauses" affordance — see canStartFromDirection.
let hasStarted = false;
interface GameOverInfo {
    score: number;
    isNew: boolean;
    hi: number;
}
let gameOverInfo: GameOverInfo | null = null;
const combo = createComboCounter();
const boost = createBoostTimer();
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
const heartMatcher = createHeartMatcher(HEART_SEQUENCE);

// Replaced at build time with the git short SHA. Stays as the literal
// placeholder for unbundled / locally-served runs; the banner then
// displays `'dev'` via the startsWith('__') check below.
const BUILD_SHA = '__DAIDAI_BUILD_SHA__';

function announceDebugHelp() {
    const big = 'color:#c08000;font-size:18px;font-weight:bold;padding:4px 0';
    const sub = 'color:#4060c0;font-size:13px;font-weight:bold';
    const mono = 'color:#444;font-family:Consolas,monospace;font-size:12px;line-height:1.6;padding:2px 0';
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
    keyboardControls.resetTypedBuf();
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
    gameOverInfo = null;
    paused = false;
    hasStarted = false;
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

// ============ 3D SCENE SYNC (extracted to src/scene/sync.ts) ============
// Per-frame interpolation timer state — declared up here so the deps bag
// passed to createSceneSync can read them via getters before mainLoop has
// run for the first time.
let lastGameTime = performance.now();
let gameAccumulator = 0;
let prevSnake: typeof snake = [];
let accumulatedPlayMs = 0;
let elapsedSeconds = 0;

const sceneSync = createSceneSync({
    scene,
    camera,
    audio,
    getSnakeMeshes: () => snakeMeshes,
    getBeanMeshes: () => beanMeshes,
    getGoldMeshes: () => goldMeshes,
    getSkinMeshes: () => skinMeshes,
    getParticles3D: () => particles3D,
    setParticles3D: (p) => {
        particles3D = p;
    },
    getRain3D: () => rain3D,
    setRain3D: (r) => {
        rain3D = r;
    },
    getFallingBeans: () => fallingBeans,
    causticsTex,
    causticsTex2,
    causticsMesh,
    waterGeom,
    waterBasePositions,
    rippleRings,
    bubbles,
    shafts,
    grassTufts,
    getSnake: () => snake,
    getBeans: () => beans,
    getGoldBeans: () => goldBeans,
    getShedSkin: () => shedSkin,
    getGoldenProjectiles: () => goldenProjectiles,
    getPrevSnake: () => prevSnake,
    getDirection: () => direction,
    getGodMode: () => godMode,
    getPaused: () => paused,
    getGameOver: () => gameOver,
    getSpeed: () => speed,
    getGameAccumulator: () => gameAccumulator,
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
});
const updateGoldenProjectiles = sceneSync.updateGoldenProjectiles;
const syncScene = sceneSync.syncFrame;

// ============ GAME STEP (extracted to src/game/step.ts) ============
const gameStep = createGameStep({
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
    getSnake: () => snake,
    getDirection: () => direction,
    setDirection: (d) => {
        direction = d;
    },
    getNextDirection: () => nextDirection,
    getBeans: () => beans,
    getShedSkin: () => shedSkin,
    setShedSkin: (s) => {
        shedSkin = s;
    },
    getGoldBeans: () => goldBeans,
    setGoldBeans: (g) => {
        goldBeans = g;
    },
    getGodMode: () => godMode,
    getGameOver: () => gameOver,
    setGameOver: (v) => {
        gameOver = v;
    },
    getPaused: () => paused,
    getIsRaining: () => isRaining,
    getScore: () => score,
    addScore: (n) => {
        score += n;
    },
    getHiScore: () => hiScore,
    saveHiScore,
    getBaseSpeed: () => baseSpeed,
    setBaseSpeed: (s) => {
        baseSpeed = s;
    },
    setSpeed: (s) => {
        speed = s;
    },
    incBeansEaten: () => {
        beansEaten++;
    },
    getGrowthPending: () => growthPending,
    setGrowthPending: (n) => {
        growthPending = n;
    },
    incGrowthPending: () => {
        growthPending++;
    },
    decGrowthPending: () => {
        growthPending--;
    },
    getSnakeMeshes: () => snakeMeshes,
    getBeanMeshes: () => beanMeshes,
    getGoldMeshes: () => goldMeshes,
    removeMesh: (m) => scene.remove(m as THREE.Object3D),
    spawnRipple,
    spawnParticles3D,
    spawnBean,
    triggerMagic,
    updateUI,
    setGameOverInfo: (info) => {
        gameOverInfo = info;
    },
});
const gameUpdate = gameStep.gameUpdate;

// ============ GAME LOOP ============

function mainLoop(timestamp) {
    const delta = timestamp - lastGameTime;
    lastGameTime = timestamp;

    // Sync a body.playing class so CSS can hide HUD chrome (e.g. the Tauri
    // mute button) during active play and show it again on pause / game over.
    const playing = !paused && !gameOver;
    if (playing !== document.body.classList.contains('playing')) {
        document.body.classList.toggle('playing', playing);
    }

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

// ============ INPUT (keyboard extracted to src/input/keyboard.ts) ============
// Single shared paused setter that also flips hasStarted on the
// first paused=true→false transition of a run. Used by keyboard, touch, and
// game-rules deps so canStartFromDirection sees a consistent signal.
function setPausedShared(p: boolean) {
    if (paused && !p) hasStarted = true;
    paused = p;
}
const keyboardControls = installKeyboardControls({
    audio,
    t,
    showMessage,
    showEffect,
    konamiMatcher,
    heartMatcher,
    activateGodMode,
    spawnMeteorShower,
    activateTribute,
    triggerMagic,
    initGame,
    getGameOver: () => gameOver,
    getPaused: () => paused,
    setPaused: setPausedShared,
    isDevtoolsOpen: () => devtoolsOpen,
    getDirection: () => direction,
    setNextDirection: (d) => {
        nextDirection = d;
    },
    incrementGrowthPending: () => {
        growthPending++;
    },
});

// ============ TOUCH / SWIPE CONTROLS (extracted to src/input/touch.ts) ============
const touchApi = installTouchControls({
    canvas: renderer.domElement,
    audio,
    t,
    showMessage,
    showEffect,
    initGame,
    getDirection: () => direction,
    setNextDirection: (d) => {
        nextDirection = d;
    },
    getGameOver: () => gameOver,
    getPaused: () => paused,
    setPaused: setPausedShared,
    getHasStarted: () => hasStarted,
    getLang: () => LANG,
    setLang,
    currentModality,
    gpBtn,
    getHasGamepad: () => hasGamepad,
    setHasGamepad: (v) => {
        hasGamepad = v;
    },
    getIsPSGamepad: () => isPSGamepad,
    setIsPSGamepad: (v) => {
        isPSGamepad = v;
    },
    hasTouchEnv,
    hasFineKeyboardEnv,
    onResize: () => {
        applyCanvasSize();
        fitCameraToPond();
    },
    refreshIdlePrompt: () => refreshIdlePrompt(),
});

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
// bug reproductions run straight from devtools. The shape of state() is a
// contract; see src/testApi.ts and tests/e2e/helpers.ts.
installTestApi({
    getScore: () => score,
    getHiScore: () => hiScore,
    getGameOver: () => gameOver,
    getPaused: () => paused,
    getGodMode: () => godMode,
    getSnake: () => snake,
    getDirection: () => direction,
    getNextDirection: () => nextDirection,
    getBeans: () => beans,
    getGoldBeans: () => goldBeans,
    getShedSkin: () => shedSkin,
    getIsRaining: () => isRaining,
    getGrowthPending: () => growthPending,
    getBeansEaten: () => beansEaten,
    getGoldenProjectilesCount: () => goldenProjectiles.length,
    getSpeed: () => speed,
    getBaseSpeed: () => baseSpeed,
    combo,
    boost,
    eatenColors,
    camera,
    COLS: () => COLS,
    ROWS: () => ROWS,
    CELL,
    setSnake: (s) => {
        snake = s;
    },
    setDirection: (d) => {
        direction = d;
    },
    setNextDirection: (d) => {
        nextDirection = d;
    },
    setBeans: (b) => {
        beans = b;
    },
    pushBean: (b) => {
        beans.push(b);
    },
    setGoldBeans: (g) => {
        goldBeans = g;
    },
    pushGoldBean: (g) => {
        goldBeans.push(g);
    },
    setShedSkin: (s) => {
        shedSkin = s;
    },
    pushShedSkin: (s) => {
        shedSkin.push(s);
    },
    setPaused: setPausedShared,
    setHasStarted: (s) => {
        hasStarted = s;
    },
    setGameOver: (g) => {
        gameOver = g;
    },
    setGodMode: (g) => {
        godMode = g;
    },
    setGrowthPending: (n) => {
        growthPending = n;
    },
    setBaseSpeed: (s) => {
        baseSpeed = s;
        speed = s;
    },
    gameUpdate,
    triggerMagic,
    updateGoldenProjectiles,
    activateTribute,
    tributeState,
});

// ============ START ============
initGame();
// Check for already-connected gamepad and prefer its prompts
if (detectGamepadNow()) {
    touchApi.markGamepad();
}
showMessage(getStartPrompt());
paused = true;
// Re-check shortly after load — some browsers expose gamepads asynchronously
setTimeout(() => {
    if (detectGamepadNow()) {
        touchApi.markGamepad();
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
    if (gameOver && gameOverInfo) {
        const { score, isNew, hi } = gameOverInfo;
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
        touchApi.applyGamepadGlyphs();
    } catch (_) {}
    // Refresh the consolidated restart button label after locale change
    try {
        touchApi.refreshRestartBtnLabel();
    } catch (_) {}
}
const isTauri = typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';

// Tauri desktop port polish:
//   - Disable the right-click context menu (no native "Inspect / Reload").
//   - Mark <body> so CSS can show/hide HUD chrome (e.g. mute button).
//   - Forward http(s) link clicks to the system browser via the opener
//     plugin; the webview ignores `target="_blank"` by default.
// Browsers keep all of the native behavior above.
if (isTauri) {
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.classList.add('tauri');
    document.addEventListener('click', (e) => {
        const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.getAttribute('href') || '';
        if (!/^https?:/i.test(href)) return;
        e.preventDefault();
        import('@tauri-apps/plugin-opener').then((m) => m.openUrl(href)).catch(() => {});
    });
}

// Swallow browser-style reload shortcuts (F5, Ctrl+R, Ctrl+Shift+R).
// On the web this is just polish; in the Tauri desktop port the webview
// would otherwise reload the whole game mid-run.
window.addEventListener(
    'keydown',
    (e) => {
        // Swallow F5 / Ctrl+R, but keep Ctrl+Shift+R as an explicit escape
        // hatch (matches the browser "hard reload" intent — useful during
        // Tauri dev when the webview gets into a bad state).
        const isReload =
            e.key === 'F5' || ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'r' || e.key === 'R'));
        if (isReload) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        // F11 toggles fullscreen (browsers only — in the Tauri desktop port the
        // OS already provides maximize, and true fullscreen on ultra-wide just
        // squashes the pond into a thin strip).
        if (e.key === 'F11') {
            if (isTauri) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            const fsEl =
                document.fullscreenElement ||
                (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
            if (fsEl) {
                (
                    document.exitFullscreen ||
                    (document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
                )?.call(document);
            } else {
                const root = document.documentElement as HTMLElement & {
                    webkitRequestFullscreen?: () => Promise<void>;
                };
                (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
            }
        }
    },
    { capture: true },
);

// Some browsers/webviews don't fire `resize` when entering/leaving fullscreen
// fast enough; piggy-back on the fullscreen change event so the camera refits.
document.addEventListener('fullscreenchange', () => window.dispatchEvent(new Event('resize')));

// Pond grid (COLS/ROWS) is decided once at startup by `pickGridForAspect`.
// When the user drags/maximizes into a substantially different size (e.g.
// ultra-wide), the camera refits but the playfield aspect stays wrong.
// Cheapest fix: debounce-detect a meaningful change and reload, so
// `pickGridForAspect` reruns. Hi-score lives in localStorage so nothing
// the player cares about is lost. Applies to browser + Tauri — a tab
// resize / device rotation is rare during play and the refit is worth it.
// Exception: F11 / Fullscreen API transitions are an expected, transient
// resize — we just refit the camera and rebaseline without reloading,
// otherwise pressing F11 dumps the player back to the title screen.
{
    let baselineW = window.innerWidth;
    let baselineH = window.innerHeight;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const THRESH = 80;
    const cancelPending = () => {
        if (reloadTimer) {
            clearTimeout(reloadTimer);
            reloadTimer = null;
        }
    };
    const rebaseline = () => {
        baselineW = window.innerWidth;
        baselineH = window.innerHeight;
    };
    window.addEventListener('resize', () => {
        const dw = Math.abs(window.innerWidth - baselineW);
        const dh = Math.abs(window.innerHeight - baselineH);
        if (dw < THRESH && dh < THRESH) return;
        cancelPending();
        reloadTimer = setTimeout(() => {
            location.reload();
        }, 800);
    });
    document.addEventListener('fullscreenchange', () => {
        cancelPending();
        rebaseline();
    });
}

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
document.addEventListener('keydown', function startHandler(e) {
    const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
    if (dirs.includes(e.key)) {
        setPausedShared(false);
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
