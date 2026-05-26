// @ts-nocheck — main.ts migrated as-is from main.js. Progressive typing is a follow-up.
    import * as THREE from 'three';
    // ============ AUDIO ENGINE (extracted to src/audio/AudioEngine.ts) ============
    const AudioEngine = DAIDAI.AudioEngine;
    const audio = new AudioEngine();
    // iOS WKWebView reliability: prime audio on the very first user interaction
    // anywhere on the page (touchend > touchstart for Safari/Chrome on iOS).
    (function primeAudioOnFirstGesture() {
        const events = ['touchend', 'touchstart', 'mousedown', 'click', 'keydown'];
        const handler = () => {
            audio.init();
            events.forEach(ev => window.removeEventListener(ev, handler, true));
        };
        events.forEach(ev => window.addEventListener(ev, handler, true));
    })();
    // Keep the iOS silent-switch bypass alive: every subsequent gesture also
    // re-kicks the silent video in case iOS paused it (interruption, app
    // backgrounded, audio route change, etc).
    (function keepSilentVideoAlive() {
        const refresh = () => {
            if (audio.initialized && !audio.muted) audio._ensureSilentVideo();
        };
        ['touchend', 'click', 'keydown'].forEach(ev => window.addEventListener(ev, refresh, true));
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && audio.initialized) {
                if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(()=>{});
                if (!audio.muted) audio._ensureSilentVideo();
            }
        });
        window.addEventListener('focus', refresh);
    })();
    // ============ LOADING SCREEN ============
    // Test fast-boot: when running under e2e tests we don't need to wait for
    // audio preload / decode (which can take seconds and stall under headless
    // WebGL contention). Detected via either ?test=1 in the URL or a flag set
    // by Playwright's addInitScript. The loading screen is hidden immediately
    // and audio preload runs in the background (best-effort).
    const __FAST_BOOT = (() => {
        try {
            if (typeof window !== 'undefined' && window.__TEST_FAST_BOOT) return true;
            if (typeof location !== 'undefined' && location.search
                && /(?:^|[?&])test=1(?:&|$)/.test(location.search)) return true;
        } catch (_) {}
        return false;
    })();
    (function setupLoadingScreen() {
        const screen = document.getElementById('loading-screen');
        const barInner = document.getElementById('loading-bar-inner');
        const pctEl = document.getElementById('loading-pct');
        const subEl = document.getElementById('loading-sub');
        if (!screen) return;
        if (__FAST_BOOT) {
            // Hide immediately — don't gate test boot on audio fetch/decode.
            // Still kick off preload in the background for any tests that may
            // poke at the audio engine, but never block on it.
            try { audio.preload().catch(() => {}); } catch (_) {}
            screen.classList.add('hidden');
            screen.remove();
            return;
        }
        audio.onProgress = (loaded, total, lastName) => {
            const pct = Math.round((loaded / total) * 100);
            if (barInner) barInner.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct + '%  (' + loaded + '/' + total + ')';
            if (subEl && lastName) subEl.textContent = t('loading.fetching', { name: lastName });
        };
        // After 10s, surface which files are still pending in the UI
        const pendingTimer = setInterval(() => {
            if (audio.loaded >= audio.total) { clearInterval(pendingTimer); return; }
            const pending = Object.keys(audio.files).filter(n => !audio.rawBuffers[n]);
            if (pending.length && subEl) {
                subEl.textContent = t('loading.waiting', { names: pending.slice(0, 3).join(', ') + (pending.length > 3 ? '…' : '') });
            }
        }, 5000);
        audio.preload().then(() => {
            if (subEl) subEl.textContent = t('loading.ready');
            if (barInner) barInner.style.width = '100%';
            if (pctEl) pctEl.textContent = '100%';
            // Hide shortly after — keep the screen long enough to be readable
            setTimeout(() => {
                screen.classList.add('hidden');
                setTimeout(() => screen.remove(), 800);
            }, 250);
        }).catch(err => {
            console.warn('Preload error:', err);
            if (subEl) subEl.textContent = t('loading.failed');
            setTimeout(() => screen.classList.add('hidden'), 500);
        });
    })();

    // ============ TEXTURE GENERATION ============
    // Procedural high-res grass texture generator (seamless, tileable)
    function makeGrassTexture(size) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        // Flat base color — desaturated to let beans pop
        g.fillStyle = '#1f3a18';
        g.fillRect(0, 0, size, size);
        // Helper: draw with wrap so edges stay seamless
        const wrapDraw = (x, y, drawFn) => {
            const offsets = [-size, 0, size];
            for (const ox of offsets) for (const oy of offsets) drawFn(x + ox, y + oy);
        };
        // Large soft tonal patches — subtle, low contrast
        for (let i = 0; i < 35; i++) {
            const x = Math.random() * size, y = Math.random() * size;
            const r = size * (0.05 + Math.random() * 0.1);
            const hue = 95 + Math.random() * 20;
            const sat = 25 + Math.random() * 15;
            const light = 18 + Math.random() * 12;
            const alpha = 0.2 + Math.random()*0.15;
            wrapDraw(x, y, (px, py) => {
                if (px < -r || px > size+r || py < -r || py > size+r) return;
                const rg = g.createRadialGradient(px, py, 0, px, py, r);
                rg.addColorStop(0, `hsla(${hue},${sat}%,${light}%,${alpha})`);
                rg.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`);
                g.fillStyle = rg;
                g.beginPath(); g.arc(px, py, r, 0, Math.PI*2); g.fill();
            });
        }
        // Crisp vector-style grass blades — fewer and dimmer
        const bladeCount = Math.floor(size * 0.5);
        for (let i = 0; i < bladeCount; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const len = 6 + Math.random() * 16;
            const w = 1.0 + Math.random() * 1.5;
            const angle = -Math.PI/2 + (Math.random() - 0.5) * 1.4;
            const dxT = Math.cos(angle) * len;
            const dyT = Math.sin(angle) * len;
            const perp = angle + Math.PI/2;
            const bxOff = Math.cos(perp) * w * 0.5;
            const byOff = Math.sin(perp) * w * 0.5;
            const hue = 90 + Math.random() * 25;
            const light = 22 + Math.random() * 25;
            const curveOff = (Math.random()-0.5)*4;
            wrapDraw(x, y, (px, py) => {
                if (px < -30 || px > size+30 || py < -30 || py > size+30) return;
                const tipX = px + dxT, tipY = py + dyT;
                const lg = g.createLinearGradient(px, py, tipX, tipY);
                lg.addColorStop(0, `hsla(${hue},40%,${light*0.6}%,0.5)`);
                lg.addColorStop(1, `hsla(${hue+5},45%,${light}%,0.65)`);
                g.fillStyle = lg;
                g.beginPath();
                g.moveTo(px + bxOff, py + byOff);
                g.quadraticCurveTo(
                    px + dxT*0.5 + curveOff,
                    py + dyT*0.5,
                    tipX, tipY
                );
                g.lineTo(px - bxOff, py - byOff);
                g.closePath();
                g.fill();
            });
        }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    // Single grass-tuft sprite for top-down 3D grass clumps
    function makeTuftTexture(size) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        g.clearRect(0, 0, size, size);
        const cx = size/2, cy = size/2;
        // Radial blades from center
        const blades = 14;
        for (let i = 0; i < blades; i++) {
            const a = (i / blades) * Math.PI * 2 + Math.random() * 0.2;
            const len = size * (0.35 + Math.random() * 0.12);
            const w = size * 0.05;
            const tipX = cx + Math.cos(a) * len;
            const tipY = cy + Math.sin(a) * len;
            const perp = a + Math.PI/2;
            const bx1 = cx + Math.cos(perp) * w;
            const by1 = cy + Math.sin(perp) * w;
            const bx2 = cx - Math.cos(perp) * w;
            const by2 = cy - Math.sin(perp) * w;
            const hue = 90 + Math.random() * 30;
            const lg = g.createLinearGradient(cx, cy, tipX, tipY);
            lg.addColorStop(0, `hsla(${hue},65%,28%,0.95)`);
            lg.addColorStop(1, `hsla(${hue+10},75%,55%,0.95)`);
            g.fillStyle = lg;
            g.beginPath();
            g.moveTo(bx1, by1);
            g.quadraticCurveTo(cx + Math.cos(a)*len*0.6, cy + Math.sin(a)*len*0.6, tipX, tipY);
            g.lineTo(bx2, by2);
            g.closePath();
            g.fill();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    // ============ TEXTURE LOADING ============
    // (All image textures previously loaded from img/ were unused —
    // the game uses procedural materials only.)

    // ============ GAME STATE ============
    // Pond grid dimensions — match screen aspect so the playfield fills the viewport edge-to-edge
    const CELL = 1.0;
    let COLS, ROWS;
    (function pickGridForAspect() {
        // Estimate the canvas height after info-bar takes its share (~42px on desktop, ~38 on mobile)
        const reservedTop = window.matchMedia('(max-width: 720px), (pointer: coarse)').matches ? 38 : 42;
        const w = window.innerWidth;
        const h = Math.max(200, window.innerHeight - reservedTop);
        const aspect = w / h;
        const SHORT = 22;
        if (aspect >= 1) {
            ROWS = SHORT;
            COLS = Math.max(SHORT, Math.round(SHORT * aspect));
        } else {
            COLS = SHORT;
            ROWS = Math.max(SHORT, Math.round(SHORT / aspect));
        }
        COLS = Math.min(60, COLS);
        ROWS = Math.min(60, ROWS);
    })();
    // ============ I18N ============
    // ============ I18N (dictionaries + helpers extracted to src/i18n/) ============
    let LANG = DAIDAI.pickLang({
        url: new URLSearchParams(location.search).get('lang'),
        stored: (() => { try { return localStorage.getItem('daidai_lang'); } catch (_e) { return null; } })(),
        navigator: (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'zh-cn']),
    });
    const t = DAIDAI.createT(() => LANG);
    try { document.documentElement.lang = LANG; document.title = t('title'); } catch (_e) { /* document may be missing in headless edge cases */ }
    function applyI18nDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.getAttribute('data-i18n-title'));
        });
    }
    function setLang(lang) {
        if (!DAIDAI.hasLocale(lang) || lang === LANG) return;
        LANG = lang;
        try { localStorage.setItem('daidai_lang', lang); } catch(_) {}
        try { document.documentElement.lang = lang; document.title = t('title'); } catch(_) {}
        applyI18nDOM();
        document.querySelectorAll('#lang-menu button[data-lang]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-lang') === lang);
        });
        try { if (typeof refreshDynamicI18n === 'function') refreshDynamicI18n(); } catch(_) {}
    }
    applyI18nDOM();
    const COLORS_HEX = [0xff3333, 0x2266ff, 0x22ee22, 0xffaa00, 0xdd55ff];
    const COLORS_STR = ['#ff3333', '#2266ff', '#22ee22', '#ffaa00', '#dd55ff'];

    let snake, direction, nextDirection, beans, shedSkin, score, beansEaten;
    let gameOver, paused, speed, baseSpeed;
    const combo = DAIDAI.createComboCounter();
    let goldBeans, growthPending;
    const eatenColors = DAIDAI.createEatenColorsQueue(); // queue of bean colors behind the head
    let hasGamepad = false;
    const hasTouchEnv = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const hasFineKeyboardEnv = window.matchMedia('(pointer: fine)').matches;
    let isPSGamepad = false;
    if (location.hash === '#ps') isPSGamepad = true;
    function detectGamepadNow() {
        try {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            const r = DAIDAI.detectConnectedGamepad(pads);
            if (r.isPS) isPSGamepad = true;
            return r.connected;
        } catch (_e) { return false; }
    }
    function gpBtn(btn) { return DAIDAI.glyphForButton(btn, isPSGamepad); }
    function getStartPrompt() {
        if (hasGamepad || detectGamepadNow()) {
            hasGamepad = true;
            return t('start.gamepad');
        }
        if (hasTouchEnv && !hasFineKeyboardEnv) return t('start.touch');
        if (hasTouchEnv && hasFineKeyboardEnv) return t('start.both');
        return t('start.keyboard');
    }
    let hiScore = 0;
    try { hiScore = parseInt(localStorage.getItem('daidai_hiscore') || '0', 10) || 0; } catch (_e) { /* hi-score is best-effort */ }
    function saveHiScore() {
        if (score > hiScore) {
            hiScore = score;
            try { localStorage.setItem('daidai_hiscore', String(hiScore)); } catch (_e) { /* hi-score is best-effort */ }
        }
    }

    // ============ EASTER EGG STATE ============
    const isLocalhost = ['localhost','127.0.0.1','::1',''].includes(location.hostname);
    let devtoolsOpen = isLocalhost; // on localhost: backdoor enabled by default
    let godMode = false;          // Konami: rainbow + invincible + 10x score
    let tributeActive = false;    // Heart pattern: tribute screen + TV static
    let tributeTriggeredThisLoad = false; // Once per page load only
    const konamiSeq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let konamiBuf = [];
    let typedBuf = '';
    const heartMatcher = DAIDAI.createHeartMatcher(DAIDAI.HEART_SEQUENCE);

    // Replaced at build time with the git short SHA. Stays as the literal
    // placeholder for unbundled / locally-served runs; the banner then
    // displays `'dev'` via the startsWith('__') check below.
    const BUILD_SHA = '__DAIDAI_BUILD_SHA__';

    function announceDebugHelp() {
        const big = 'background:#222;color:#ffd700;font-size:18px;font-weight:bold;padding:4px 10px;border-radius:4px';
        const sub = 'color:#4060c0;font-size:13px;font-weight:bold';
        const mono = 'background:#222;color:#eee;font-family:Consolas,monospace;font-size:12px;line-height:1.6;padding:6px 10px;border-radius:4px';
        const tag  = 'color:#666;font-family:Consolas,monospace;font-size:11px';
        console.log('%c🐛 DaiDai DEBUG mode active', big);
        console.log('%cbuild: ' + (BUILD_SHA.startsWith('__') ? 'dev' : BUILD_SHA), tag);
        console.log('%cPress 1-6 to trigger the matching magic (no 5-bean combo required):', sub);
        console.log('%c  1  🔴 speed boost\n  2  🔵 rain\n  3  🟢 shed → beans\n  4  🟠 gold laser\n  5  🟣 halve length\n  6  ➕ length +1', mono);
    }
    function detectDevtools() {
        const threshold = 160;
        const opened =
            (window.outerWidth  - window.innerWidth  > threshold) ||
            (window.outerHeight - window.innerHeight > threshold) ||
            window.devicePixelRatio < 0.5;
        if (opened && !devtoolsOpen) { devtoolsOpen = true; announceDebugHelp(); }
    }
    setInterval(detectDevtools, 1000);
    // Getter probe — fires when devtools renders the object (works even when undocked)
    const _ddProbe = function(){};
    _ddProbe.toString = function() {
        if (!devtoolsOpen) { devtoolsOpen = true; announceDebugHelp(); }
        return '';
    };
    setInterval(() => { if (!devtoolsOpen) console.debug('%c', '', _ddProbe); }, 1500);


    // ============ THREE.JS SETUP ============
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    // Camera position - top-down, auto-fit to screen
    function getVisibleArea() {
        const infoEl = document.getElementById('info-bar');
        const top = infoEl ? infoEl.getBoundingClientRect().bottom : 0;
        return { top, height: Math.max(150, window.innerHeight - top), width: window.innerWidth };
    }
    function applyCanvasSize() {
        const v = getVisibleArea();
        renderer.setSize(v.width, v.height);
        renderer.domElement.style.top = v.top + 'px';
        camera.aspect = v.width / v.height;
        camera.updateProjectionMatrix();
    }
    applyCanvasSize();
    function fitCameraToPond() {
        const aspect = camera.aspect;
        const vFov = camera.fov * Math.PI / 180;
        const RIM = 0;
        const margin = 1.02;
        const W = (COLS * CELL + RIM * 2) * margin;
        const H = (ROWS * CELL + RIM * 2) * margin;
        const distForH = (H / 2) / Math.tan(vFov / 2);
        const distForW = (W / 2) / (Math.tan(vFov / 2) * aspect);
        const dist = Math.max(distForH, distForW);
        const cx = (COLS - 1) * CELL / 2;
        const cz = (ROWS - 1) * CELL / 2;
        camera.up.set(0, 1, 0);
        camera.position.set(cx, dist, cz + 0.5);
        camera.lookAt(cx, 0, cz);
        camera.updateProjectionMatrix();
        // Keep fog visual constant regardless of camera distance (portrait vs landscape)
        if (scene.fog) scene.fog.density = 0.018 * (25 / dist);
    }
    fitCameraToPond();

    // Lighting - bright and even like original
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
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

    const fillLight = new THREE.DirectionalLight(0xccddcc, 0.4);
    fillLight.position.set(-10, 15, -5);
    scene.add(fillLight);

    // Subtle aquatic tint and stronger underwater fog
    scene.fog = new THREE.FogExp2(0x0d3a55, 0.018);
    scene.background = new THREE.Color(0x0a2540);

    // ============ POND (ORIGINAL STYLE - grass texture background) ============
    const pondCX = COLS * CELL / 2;
    const pondCZ = ROWS * CELL / 2;

    // Background floor - procedurally generated high-res grass texture
    const floorGeom = new THREE.PlaneGeometry(COLS * CELL * 10, ROWS * CELL * 10);
    const bgTexture = makeGrassTexture(1024);
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
    const fieldW = COLS * CELL;
    const fieldH = ROWS * CELL;
    const minX = -CELL/2, maxX = fieldW - CELL/2;
    const minZ = -CELL/2, maxZ = fieldH - CELL/2;
    const RIM_W = 0.8;

    // Muddier seamless texture (darker underwater tones, more cohesive with pond)
    function makeMudTexture(size) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        // Dark mud base
        g.fillStyle = '#2a2218';
        g.fillRect(0, 0, size, size);
        const wrapDraw = (x, y, fn) => {
            for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(x + ox, y + oy);
        };
        // Muddy patches — desaturated, low-light browns blending into the pond floor
        for (let i = 0; i < 260; i++) {
            const x = Math.random() * size, y = Math.random() * size;
            const r = 6 + Math.random() * 22;
            const hue = 28 + Math.random() * 16;
            const sat = 18 + Math.random() * 22;
            const light = 14 + Math.random() * 16;
            wrapDraw(x, y, (px, py) => {
                const rg = g.createRadialGradient(px, py, 0, px, py, r);
                rg.addColorStop(0, `hsla(${hue},${sat}%,${light}%,0.85)`);
                rg.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`);
                g.fillStyle = rg;
                g.beginPath(); g.arc(px, py, r, 0, Math.PI*2); g.fill();
            });
        }
        // Mossy green tinges (algae growth on edge)
        for (let i = 0; i < 60; i++) {
            const x = Math.random() * size, y = Math.random() * size;
            const r = 4 + Math.random() * 10;
            wrapDraw(x, y, (px, py) => {
                const rg = g.createRadialGradient(px, py, 0, px, py, r);
                rg.addColorStop(0, `hsla(${75 + Math.random()*30},35%,22%,0.55)`);
                rg.addColorStop(1, `hsla(80,30%,18%,0)`);
                g.fillStyle = rg;
                g.beginPath(); g.arc(px, py, r, 0, Math.PI*2); g.fill();
            });
        }
        // Fine grain noise + dark specks (pebble hints)
        const img = g.getImageData(0, 0, size, size);
        for (let p = 0; p < img.data.length; p += 4) {
            const n = (Math.random() - 0.5) * 20;
            img.data[p] = Math.max(0, Math.min(255, img.data[p] + n));
            img.data[p+1] = Math.max(0, Math.min(255, img.data[p+1] + n * 0.9));
            img.data[p+2] = Math.max(0, Math.min(255, img.data[p+2] + n * 0.7));
        }
        g.putImageData(img, 0, 0);
        for (let i = 0; i < 220; i++) {
            const x = Math.random() * size, y = Math.random() * size;
            const r = 0.6 + Math.random() * 1.8;
            g.fillStyle = `hsla(${20 + Math.random()*15},25%,${8 + Math.random()*10}%,0.85)`;
            g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }
    const mudTex = makeMudTexture(512);
    mudTex.repeat.set(8, 8);

    // Single continuous rim using Shape-with-hole (no corner seams)
    // Note: after rotation.x = -PI/2, shape's Y axis maps to world's -Z, so we negate Y here.
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
    // Build world-space UVs so texture tiles uniformly across the ring
    {
        const pos = rimGeom.attributes.position;
        const uvs = new Float32Array(pos.count * 2);
        const SCALE = 1 / 3; // ~3 world units per texture tile
        for (let i = 0; i < pos.count; i++) {
            uvs[i*2]   = pos.getX(i) * SCALE;
            uvs[i*2+1] = pos.getY(i) * SCALE;
        }
        rimGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
    // Vertex colors: lighter (sandy) at inner edge, darker mud at outer edge
    {
        const pos = rimGeom.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        const cInner = new THREE.Color(0xa08566);
        const cOuter = new THREE.Color(0x3a2c1e);
        // Inner hole bounds in SHAPE space (Y negated)
        const innerXMin = minX, innerXMax = maxX;
        const innerYMin = -maxZ, innerYMax = -minZ;
        for (let i = 0; i < pos.count; i++) {
            const px = pos.getX(i), py = pos.getY(i);
            const distInner = Math.max(
                innerXMin - px, px - innerXMax,
                innerYMin - py, py - innerYMax,
                0
            );
            const t = Math.min(1, distInner / RIM_W);
            const c = cInner.clone().lerp(cOuter, t);
            colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
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

    // 3D pebbles scattered on the rim (disabled)
    const pebbleGeoms = [
        new THREE.IcosahedronGeometry(0.18, 0),
        new THREE.IcosahedronGeometry(0.12, 0),
        new THREE.DodecahedronGeometry(0.14, 0),
    ];
    const pebbleColors = [0x5c4a36, 0x6b5640, 0x4a3a28, 0x807060, 0x3d2e20];
    // eslint-disable-next-line no-constant-condition -- pebble decoration disabled, kept for reference
    if (false) for (let i = 0; i < 60; i++) {
        // Pick which side of the rim
        const side = Math.floor(Math.random() * 4);
        let px, pz;
        const t = Math.random();
        const off = (RIM_W - 0.2) * Math.random() + 0.1;
        if (side === 0) { px = minX - off; pz = minZ - RIM_W + t * (fieldH + RIM_W * 2); }
        else if (side === 1) { px = maxX + off; pz = minZ - RIM_W + t * (fieldH + RIM_W * 2); }
        else if (side === 2) { pz = minZ - off; px = minX - RIM_W + t * (fieldW + RIM_W * 2); }
        else { pz = maxZ + off; px = minX - RIM_W + t * (fieldW + RIM_W * 2); }
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

    // ============ GRASS TUFTS - 3D clumps that sway and react to snake ============
    const tuftTexture = makeTuftTexture(128);
    const tuftMat = new THREE.MeshBasicMaterial({
        map: tuftTexture,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const tuftGeom = new THREE.PlaneGeometry(1.4, 1.4);
    const grassTufts = [];
    const TUFT_COUNT = 280;
    const tuftSpread = 1.3; // place tufts in 1.3x the play field area
    for (let i = 0; i < TUFT_COUNT; i++) {
        const m = new THREE.Mesh(tuftGeom, tuftMat);
        m.rotation.x = -Math.PI / 2;
        const px = (Math.random() - 0.5) * COLS * CELL * tuftSpread + COLS * CELL / 2;
        const pz = (Math.random() - 0.5) * ROWS * CELL * tuftSpread + ROWS * CELL / 2;
        m.position.set(px, -0.18, pz);
        const baseRot = Math.random() * Math.PI * 2;
        m.rotation.z = baseRot;
        const scl = 0.6 + Math.random() * 0.7;
        m.scale.set(scl, scl, 1);
        scene.add(m);
        grassTufts.push({
            mesh: m,
            baseX: px, baseZ: pz,
            baseRot,
            baseScale: scl,
            phase: Math.random() * Math.PI * 2,
            freq: 0.0015 + Math.random() * 0.001,
        });
    }

    // ============ CAUSTICS + WATER SURFACE for underwater feel ============
    function makeCausticsTexture(size) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        g.fillStyle = 'rgba(0,0,0,0)';
        g.fillRect(0, 0, size, size);
        const wrapDraw = (x, y, fn) => {
            for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(x + ox, y + oy);
        };
        // Voronoi-like light cells, drawn wrapped to be seamless
        const cells = 30;
        const radius = size * 0.12;
        for (let i = 0; i < cells; i++) {
            const cx = Math.random() * size, cy = Math.random() * size;
            wrapDraw(cx, cy, (px, py) => {
                if (px < -radius || px > size+radius || py < -radius || py > size+radius) return;
                const rg = g.createRadialGradient(px, py, 0, px, py, radius);
                rg.addColorStop(0, 'rgba(180,230,255,0.55)');
                rg.addColorStop(0.5, 'rgba(140,210,255,0.18)');
                rg.addColorStop(1, 'rgba(140,210,255,0)');
                g.fillStyle = rg;
                g.beginPath(); g.arc(px, py, radius, 0, Math.PI*2); g.fill();
            });
        }
        // Thin bright refraction lines (wrapped)
        for (let i = 0; i < 50; i++) {
            const x = Math.random()*size, y = Math.random()*size;
            const len = 30 + Math.random()*80;
            const a = Math.random()*Math.PI*2;
            const dx = Math.cos(a)*len, dy = Math.sin(a)*len;
            wrapDraw(x, y, (px, py) => {
                if (px < -len || px > size+len || py < -len || py > size+len) return;
                const grd = g.createLinearGradient(px, py, px+dx, py+dy);
                grd.addColorStop(0, 'rgba(220,240,255,0)');
                grd.addColorStop(0.5, 'rgba(220,240,255,0.6)');
                grd.addColorStop(1, 'rgba(220,240,255,0)');
                g.strokeStyle = grd;
                g.lineWidth = 1.5;
                g.beginPath();
                g.moveTo(px, py);
                g.lineTo(px+dx, py+dy);
                g.stroke();
            });
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }
    const causticsTex = makeCausticsTexture(512);
    const causticsMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(COLS * CELL * 10, ROWS * CELL * 10),
        new THREE.MeshBasicMaterial({
            map: causticsTex,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        })
    );
    causticsMesh.rotation.x = -Math.PI / 2;
    causticsMesh.position.set(pondCX, -0.15, pondCZ);
    scene.add(causticsMesh);

    // Second caustics layer moving opposite direction for shimmer
    const causticsTex2 = makeCausticsTexture(512);
    const causticsMesh2 = new THREE.Mesh(
        new THREE.PlaneGeometry(COLS * CELL * 10, ROWS * CELL * 10),
        new THREE.MeshBasicMaterial({
            map: causticsTex2,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        })
    );
    causticsMesh2.rotation.x = -Math.PI / 2;
    causticsMesh2.position.set(pondCX, -0.14, pondCZ);
    scene.add(causticsMesh2);

    // Water surface above the play field (subtle blue tint with wave normal)
    const waterGeom = new THREE.PlaneGeometry(COLS * CELL * 3, ROWS * CELL * 3, 60, 60);
    const waterMat = new THREE.MeshPhysicalMaterial({
        color: 0x4a90c8,
        transparent: true,
        opacity: 0.18,
        roughness: 0.15,
        metalness: 0.0,
        transmission: 0.6,
        thickness: 0.5,
        side: THREE.DoubleSide,
    });
    const waterSurface = new THREE.Mesh(waterGeom, waterMat);
    waterSurface.rotation.x = -Math.PI / 2;
    waterSurface.position.set(pondCX, 4.5, pondCZ);
    scene.add(waterSurface);
    const waterBasePositions = waterGeom.attributes.position.array.slice();

    // Water ripple rings (spawned when snake moves) — soft radial gradient, multiple concentric waves
    const rippleRings = [];
    // Generate a soft ring texture: bright thin band, soft falloff
    const rippleTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0.00, 'rgba(180,225,255,0)');
        grad.addColorStop(0.55, 'rgba(180,225,255,0)');
        grad.addColorStop(0.72, 'rgba(200,235,255,0.55)');
        grad.addColorStop(0.82, 'rgba(230,245,255,0.85)');
        grad.addColorStop(0.92, 'rgba(200,235,255,0.35)');
        grad.addColorStop(1.00, 'rgba(180,225,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    })();
    const rippleQuadGeom = new THREE.PlaneGeometry(1, 1);
    function spawnRipple(x, z) {
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

    // Subtle floating particles (spores/debris) — more density for underwater feel
    const bubbleGeom = new THREE.SphereGeometry(0.04, 6, 6);
    const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xddeeff, transparent: true, opacity: 0.45 });
    const bubbles = [];
    for (let i = 0; i < 80; i++) {
        const bubble = new THREE.Mesh(bubbleGeom, bubbleMat.clone());
        bubble.position.set(
            (Math.random() - 0.5) * COLS * CELL * 1.4 + COLS * CELL / 2,
            Math.random() * 5,
            (Math.random() - 0.5) * ROWS * CELL * 1.4 + ROWS * CELL / 2
        );
        bubble.userData = { speed: 0.004 + Math.random() * 0.01, phase: Math.random() * Math.PI * 2 };
        scene.add(bubble);
        bubbles.push(bubble);
    }

    // ============ UNDERWATER ATMOSPHERE ============
    // 1) Fullscreen color-grade overlay — cyan-blue tint with darker corners (vignette)
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = overlayCanvas.height = 512;
    {
        const og = overlayCanvas.getContext('2d');
        // Cyan tint
        og.fillStyle = 'rgba(30, 110, 150, 0.18)';
        og.fillRect(0, 0, 512, 512);
        // Vignette
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
    // Attach to camera so it always covers screen
    {
        // We need to size it to fill the camera's near plane
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
        c.width = 128; c.height = 512;
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 128, 0);
        grad.addColorStop(0.0, 'rgba(180,220,255,0)');
        grad.addColorStop(0.5, 'rgba(220,240,255,0.55)');
        grad.addColorStop(1.0, 'rgba(180,220,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 512);
        // Vertical fade
        const vgrad = g.createLinearGradient(0, 0, 0, 512);
        vgrad.addColorStop(0.0, 'rgba(0,0,0,0)');
        vgrad.addColorStop(0.3, 'rgba(0,0,0,0)');
        vgrad.addColorStop(1.0, 'rgba(0,0,0,1)');
        g.globalCompositeOperation = 'destination-in';
        g.fillStyle = vgrad;
        g.fillRect(0, 0, 128, 512);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    })();
    const shafts = [];
    const SHAFT_COUNT = 8;
    for (let i = 0; i < SHAFT_COUNT; i++) {
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
        // Tilt the shaft like a beam coming from upper-back-left
        mesh.rotation.x = -Math.PI / 2 + 0.6 + Math.random() * 0.3;
        mesh.rotation.z = Math.random() * Math.PI * 2;
        mesh.position.set(
            COLS * CELL / 2 + (Math.random() - 0.5) * COLS * CELL * 1.4,
            6 + Math.random() * 2,
            ROWS * CELL / 2 + (Math.random() - 0.5) * ROWS * CELL * 1.4
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

    // ============ 3D OBJECT POOLS ============
    let snakeMeshes = [];
    let beanMeshes = [];
    let skinMeshes = [];
    let goldMeshes = [];

    const snakeBodyGeom = new THREE.SphereGeometry(0.42, 12, 12);
    const beanGeom = new THREE.SphereGeometry(0.35, 12, 12);
    const goldGeom = new THREE.DodecahedronGeometry(0.4);
    // Shared material — MeshPhysicalMaterial with clearcoat is the heaviest
    // shader in three.js; creating a new one per bean would re-link the
    // program for the first instance of each color/uniform combo and stall
    // the GPU. One shared material avoids the hitch and is also cheaper.
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

    function createSnakeSegment(isHead) {
        const group = new THREE.Group();
        const mat = new THREE.MeshPhysicalMaterial({
            color: isHead ? 0xf0f0e8 : 0xd8d8c8,
            roughness: 0.3,
            metalness: 0.05,
            transparent: true,
            opacity: isHead ? 0.92 : 0.75,
            transmission: 0.15,
            thickness: 0.3,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
        });
        if (isHead) {
            // Bulbous head - slightly squashed sphere for cute worm look
            const headGeom = new THREE.SphereGeometry(0.6, 24, 20);
            const body = new THREE.Mesh(headGeom, mat);
            body.scale.set(1.05, 0.95, 1.05);
            body.castShadow = true;
            group.add(body);
            // BIG bulging 3D eyeballs sticking out on top - cute cartoon worm style
            const eyeWhiteMat = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                shininess: 80,
                specular: 0x666666,
            });
            const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
            const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

            const eyeRadius = 0.33;
            const pupilRefs = [];
            const eyeRefs = [];
            const makeEye = (xOffset) => {
                const eyeGroup = new THREE.Group();
                const white = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 20, 20), eyeWhiteMat);
                white.castShadow = true;
                eyeGroup.add(white);
                // Smaller pupil that can be moved on eyeball surface to track beans
                const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.38, 16, 16), pupilMat);
                pupil.position.set(0, eyeRadius * 0.55, eyeRadius * 0.55);
                eyeGroup.add(pupil);
                // Highlight on pupil
                const hl = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.1, 10, 10), highlightMat);
                hl.position.set(0, eyeRadius * 0.7, eyeRadius * 0.7);
                eyeGroup.add(hl);
                eyeGroup.position.set(xOffset, 0.5, 0.12);
                pupilRefs.push({ pupil, hl });
                eyeRefs.push(eyeGroup);
                return eyeGroup;
            };
            group.add(makeEye(-0.32));
            group.add(makeEye(0.32));

            // Mouth: smile (default) and open "O" (when eating). Swap visibility.
            const mouthMat = new THREE.MeshBasicMaterial({ color: 0x3a1a10 });
            const smileGeom = new THREE.TorusGeometry(0.11, 0.022, 8, 18, Math.PI);
            const smile = new THREE.Mesh(smileGeom, mouthMat);
            smile.rotation.x = -Math.PI / 2;
            smile.rotation.z = Math.PI;
            smile.position.set(0, 0.42, 0.42);
            group.add(smile);

            // Open mouth — a small dark disc that becomes visible when chomping
            const openMouth = new THREE.Mesh(
                new THREE.CircleGeometry(0.12, 20),
                mouthMat
            );
            openMouth.rotation.x = -Math.PI / 2;
            openMouth.position.set(0, 0.5, 0.44);
            openMouth.visible = false;
            group.add(openMouth);

            // Tongue (red disc inside open mouth)
            const tongue = new THREE.Mesh(
                new THREE.CircleGeometry(0.07, 16),
                new THREE.MeshBasicMaterial({ color: 0xcc3344 })
            );
            tongue.rotation.x = -Math.PI / 2;
            tongue.position.set(0, 0.51, 0.42);
            tongue.visible = false;
            group.add(tongue);

            group.userData.smile = smile;
            group.userData.openMouth = openMouth;
            group.userData.tongue = tongue;
            group.userData.eatTimer = 0;
            group.userData.pupilRefs = pupilRefs;
            group.userData.eyeRefs = eyeRefs;
            group.userData.eyeRadius = eyeRadius;
            group.userData.blinkTimer = 2000 + Math.random() * 2000;
            group.userData.blinkPhase = 0;
        } else {
            const seg = new THREE.Mesh(snakeBodyGeom, mat);
            seg.castShadow = true;
            group.add(seg);
        }
        group.material = mat;
        scene.add(group);
        return group;
    }

    function createBeanMesh(colorIdx) {
        const mat = new THREE.MeshPhysicalMaterial({
            color: COLORS_HEX[colorIdx],
            roughness: 0.15,
            metalness: 0.05,
            transparent: true,
            opacity: 0.95,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            emissive: COLORS_HEX[colorIdx],
            emissiveIntensity: 0.55,
        });
        const mesh = new THREE.Mesh(beanGeom, mat);
        mesh.castShadow = false;
        // Glow halo sprite around the bean
        const haloCanvas = document.createElement('canvas');
        haloCanvas.width = haloCanvas.height = 64;
        const hg = haloCanvas.getContext('2d');
        const rg = hg.createRadialGradient(32, 32, 4, 32, 32, 32);
        rg.addColorStop(0, 'rgba(255,255,255,0.9)');
        rg.addColorStop(0.4, 'rgba(255,255,255,0.3)');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        hg.fillStyle = rg;
        hg.fillRect(0, 0, 64, 64);
        const haloTex = new THREE.CanvasTexture(haloCanvas);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: haloTex,
            color: COLORS_HEX[colorIdx],
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        halo.scale.set(1.6, 1.6, 1);
        mesh.add(halo);
        mesh.userData.halo = halo;
        mesh.userData.dropPhase = 1.0; // 1 = high in sky, 0 = resting; eased per-frame
        mesh.userData.dropBounce = 0;  // squash on landing
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
        warm.position.set(0, -10000, 0); // off-screen but still in scene
        scene.add(warm);
        // Render once on next frame to force shader link
        requestAnimationFrame(() => {
            try { renderer.compile(scene, camera); } catch(_) {}
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

    function createParticleMesh(color) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(particleGeom, mat);
        scene.add(mesh);
        return mesh;
    }

    // Golden projectile system
    let goldenProjectiles = [];

    // Falling bean system - beans that drop from sky
    let fallingBeans = [];
    function spawnFallingBean(targetX, targetY, colorIdx) {
        const mat = new THREE.MeshStandardMaterial({
            color: COLORS_HEX[colorIdx],
            roughness: 0.3,
            metalness: 0.4,
            emissive: COLORS_HEX[colorIdx],
            emissiveIntensity: 0.3,
        });
        const mesh = new THREE.Mesh(beanGeom, mat);
        mesh.position.set(targetX * CELL, 12 + Math.random() * 5, targetY * CELL);
        mesh.castShadow = false;
        scene.add(mesh);
        fallingBeans.push({
            mesh,
            targetX,
            targetY,
            color: colorIdx,
            vy: 0,
            gravity: 0.008 + Math.random() * 0.004
        });
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
                life: 60
            });
        }
    }

    // Rain 3D
    let rain3D = [];
    const rainGeom = new THREE.CylinderGeometry(0.03, 0.01, 1.2, 4);
    const rainMat = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.7 });

    // Heavy rain with blur and bonus beans
    let isRaining = false;
    function spawnHeavyRain() {
        isRaining = true;
        // Spawn very dense rain drops in waves
        function spawnWave() {
            for (let i = 0; i < 150; i++) {
                const mesh = new THREE.Mesh(rainGeom, rainMat.clone());
                mesh.position.set(
                    Math.random() * COLS * CELL,
                    8 + Math.random() * 15,
                    Math.random() * ROWS * CELL
                );
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
                let x, y, attempts = 0;
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
                setTimeout(() => { isRaining = false; }, 1000);
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
        snakeMeshes.forEach(m => scene.remove(m));
        beanMeshes.forEach(m => scene.remove(m));
        skinMeshes.forEach(m => scene.remove(m));
        goldMeshes.forEach(m => scene.remove(m));
        particles3D.forEach(p => scene.remove(p.mesh));
        rain3D.forEach(r => scene.remove(r.mesh));
        goldenProjectiles.forEach(p => scene.remove(p.mesh));
        fallingBeans.forEach(fb => scene.remove(fb.mesh));
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
            { x: startX - 4, y: startY }
        ];
        eatenColors.reset();
        godMode = false;
        isBoosted = false;
        boostMultiplier = 1;
        boostEndAt = 0;
        konamiBuf = [];
        heartMatcher.reset();
        typedBuf = '';
        direction = { x: 1, y: 0 };
        nextDirection = { x: 1, y: 0 };
        beans = [];
        shedSkin = [];
        goldBeans = [];
        score = 0;
        // Load hi-score from localStorage on each init (in case another tab updated)
        try { hiScore = parseInt(localStorage.getItem('daidai_hiscore') || '0', 10) || 0; } catch (_e) { hiScore = 0; }
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
        const cell = DAIDAI.findFreeCell(COLS, ROWS, [snake, beans, shedSkin, goldBeans]);
        if (cell) beans.push({ x: cell.x, y: cell.y, color: Math.floor(Math.random() * COLORS_HEX.length) });
    }

    function isOccupied(x, y) {
        return DAIDAI.isCellOccupied(x, y, [snake, beans, shedSkin, goldBeans]);
    }

    function gameUpdate() {
        if (gameOver || paused) return;

        // Expire red boost
        if (isBoosted && performance.now() >= boostEndAt) {
            endBoost();
        }

        direction = nextDirection;
        const head = DAIDAI.wrapPosition(
            snake[0].x + direction.x,
            snake[0].y + direction.y,
            COLS, ROWS
        );

        if (!godMode && (snake.some(s => s.x === head.x && s.y === head.y) ||
            shedSkin.some(s => s.x === head.x && s.y === head.y))) {
            gameOver = true;
            const isNew = score > hiScore;
            saveHiScore();
            updateUI();
            audio.play('heartbeat_stop');
            audio.play('die');
            window.__gameOverInfo = { score, isNew, hi: hiScore };
            const msg = isNew
                ? `${t('over.new', { score })}`
                : `${t('over.normal', { score, hi: hiScore })}`;
            showMessage(msg);
            return;
        }

        snake.unshift(head);
        // Water ripple at head position
        spawnRipple(head.x * CELL, head.y * CELL);

        const beanIdx = beans.findIndex(b => b.x === head.x && b.y === head.y);
        if (beanIdx !== -1) {
            const bean = beans[beanIdx];
            beans.splice(beanIdx, 1);
            // Remove the corresponding mesh so the next spawned bean gets a fresh drop-in animation
            if (beanMeshes[beanIdx]) { scene.remove(beanMeshes[beanIdx]); beanMeshes.splice(beanIdx, 1); }
            // Newest eaten color goes to front of queue → displayed directly behind head
            eatenColors.recordEaten(bean.color);
            eatBean(bean);
            spawnBean();
        }

        const goldIdx = goldBeans.findIndex(b => b.x === head.x && b.y === head.y);
        if (goldIdx !== -1) {
            goldBeans.splice(goldIdx, 1);
            if (goldMeshes[goldIdx]) { scene.remove(goldMeshes[goldIdx]); goldMeshes.splice(goldIdx, 1); }
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
        shedSkin.forEach(s => s.life--);
        shedSkin = shedSkin.filter(s => s.life > 0);
        goldBeans.forEach(b => b.life--);
        goldBeans = goldBeans.filter(b => b.life > 0);

        updateUI();
    }

    function eatBean(bean) {
        beansEaten++;
        const basePoints = DAIDAI.eatScore({ isRaining, isBoosted, boostMultiplier, godMode });
        score += basePoints;
        growthPending++;
        audio.play('eat');
        spawnParticles3D(bean.x * CELL, bean.y * CELL, COLORS_HEX[bean.color], 8);
        // Trigger eat animation (chomp)
        if (snakeMeshes[0] && snakeMeshes[0].userData) {
            snakeMeshes[0].userData.eatTimer = 220;
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

    let isBoosted = false; // Track speed boost state for visual
    let boostMultiplier = 1;   // score multiplier from red combos (doubles each trigger)
    let boostEndAt = 0;        // ms timestamp when boost should end

    function endBoost() {
        if (!isBoosted) return;
        isBoosted = false;
        boostMultiplier = 1;
        boostEndAt = 0;
        speed = baseSpeed;
        audio.play('speed_end');
        showEffect(t('fx.boostEnd'));
    }

    function triggerMagic(colorIdx) {
        audio.play('combo');
        switch(colorIdx) {
            case 0:
                audio.play('magic_red');
                speed = Math.max(50, baseSpeed - 50);
                isBoosted = true;
                boostMultiplier *= 2;          // stack: 2x, 4x, 8x ...
                boostEndAt = performance.now() + 15000; // refresh 15s window
                if (snake.length > 0) {
                    spawnParticles3D(snake[0].x * CELL, snake[0].y * CELL, 0xff4444, 15);
                }
                showEffect(t('fx.boost', { mult: boostMultiplier }));
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
                    goldenProjectiles.push({
                        x: head.x * CELL,
                        z: head.y * CELL,
                        dx: direction.x * 0.4,
                        dz: direction.y * 0.4,
                        life: 120,
                        mesh: null
                    });
                    // Create projectile mesh
                    const pMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 1.0, metalness: 0.9, roughness: 0.1 });
                    const pMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), pMat);
                    pMesh.position.set(head.x * CELL, 0.5, head.y * CELL);
                    scene.add(pMesh);
                    goldenProjectiles[goldenProjectiles.length - 1].mesh = pMesh;
                    // Add a light to the projectile
                    const pLight = new THREE.PointLight(0xffd700, 1.5, 5);
                    pMesh.add(pLight);
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

    function showEffect(text) {
        const el = document.getElementById('effect-text');
        el.textContent = text;
        el.style.opacity = 1;
        setTimeout(() => { el.style.opacity = 0; }, 2000);
    }

    // ============ EASTER EGG EFFECTS ============
    function activateGodMode() {
        if (godMode) return;
        godMode = true;
        showEffect(t('fx.godmode'));
        audio.play('magic_orange');
        // sparkle
        if (snake && snake[0]) {
            for (let k = 0; k < 5; k++) {
                const hue = (k * 72) % 360;
                const col = new THREE.Color().setHSL(hue/360, 1, 0.5).getHex();
                spawnParticles3D(snake[0].x * CELL, snake[0].y * CELL, col, 20);
            }
        }
    }
    function spawnMeteorShower() {
        showEffect(t('fx.meteor'));
        audio.play('magic_blue');
        for (let i = 0; i < 30; i++) {
            const x = Math.floor(Math.random() * COLS);
            const y = Math.floor(Math.random() * ROWS);
            const c = Math.floor(Math.random() * COLORS_HEX.length);
            // stagger drops for waterfall feel
            setTimeout(() => spawnFallingBean(x, y, c), i * 60);
        }
    }
    function activateTribute() {
        if (tributeActive || tributeTriggeredThisLoad) return;
        tributeTriggeredThisLoad = true;
        tributeActive = true;
        audio.play('magic_orange');
        // Create overlay: TV static + scrolling subtitle
        const wrap = document.createElement('div');
        wrap.id = 'tribute-overlay';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden;background:radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%);';
        // TV static canvas
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 180;
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0.35;mix-blend-mode:screen;image-rendering:pixelated;';
        wrap.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const staticTimer = setInterval(() => {
            const img = ctx.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < img.data.length; i += 4) {
                const v = Math.random() * 255 | 0;
                img.data[i] = img.data[i+1] = img.data[i+2] = v;
                img.data[i+3] = 255;
            }
            ctx.putImageData(img, 0, 0);
        }, 60);
        wrap.dataset.staticTimer = String(staticTimer);
        // Scrolling subtitle
        const subtitle = document.createElement('div');
        subtitle.style.cssText = 'position:absolute;left:100%;top:50%;transform:translateY(-50%);white-space:nowrap;font-size:56px;font-weight:bold;color:#fff;text-shadow:0 0 18px #ff66aa, 0 0 4px #000;font-family:inherit;letter-spacing:6px;transition:left 5s linear;';
        subtitle.textContent = t('subtitle');
        wrap.appendChild(subtitle);
        document.body.appendChild(wrap);
        requestAnimationFrame(() => { subtitle.style.left = '-100%'; });
        setTimeout(() => {
            clearInterval(staticTimer);
            wrap.style.transition = 'opacity 0.6s';
            wrap.style.opacity = '0';
            setTimeout(() => { wrap.remove(); tributeActive = false; }, 700);
        }, 5000);
    }

    function showMessage(text) {
        const el = document.getElementById('message');
        el.textContent = text;
        el.style.display = text ? 'block' : 'none';
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
        if (isBoosted) {
            const remain = Math.max(0, (boostEndAt - performance.now()) / 1000);
            boostEl.style.display = '';
            boostEl.textContent = `🔥 ×${boostMultiplier}  ${remain.toFixed(1)}s`;
        } else {
            boostEl.style.display = 'none';
        }
    }

    // ============ 3D SCENE SYNC ============
    function updateGoldenProjectiles() {
        for (let i = goldenProjectiles.length - 1; i >= 0; i--) {
            const p = goldenProjectiles[i];
            p.x += p.dx;
            p.z += p.dz;
            p.life--;
            if (p.mesh) {
                p.mesh.position.set(p.x, 0.5, p.z);
                p.mesh.rotation.y += 0.2;
            }
            for (let j = beans.length - 1; j >= 0; j--) {
                const b = beans[j];
                const bx = b.x * CELL;
                const bz = b.y * CELL;
                const dist = Math.sqrt((p.x - bx) ** 2 + (p.z - bz) ** 2);
                if (dist < 0.8) {
                    goldBeans.push({ x: b.x, y: b.y, life: 300 });
                    beans.splice(j, 1);
                    if (beanMeshes[j]) { scene.remove(beanMeshes[j]); beanMeshes.splice(j, 1); }
                    spawnBean();
                    spawnParticles3D(bx, bz, 0xffd700, 8);
                    audio.play('gold');
                }
            }
            for (let j = shedSkin.length - 1; j >= 0; j--) {
                const s = shedSkin[j];
                const sx = s.x * CELL;
                const sz = s.y * CELL;
                const dist = Math.sqrt((p.x - sx) ** 2 + (p.z - sz) ** 2);
                if (dist < 0.8) {
                    goldBeans.push({ x: s.x, y: s.y, life: 300 });
                    shedSkin.splice(j, 1);
                    spawnParticles3D(sx, sz, 0xffd700, 10);
                    audio.play('gold');
                }
            }
            if (p.life <= 0 || p.x < -2 || p.x > COLS * CELL + 2 || p.z < -2 || p.z > ROWS * CELL + 2) {
                if (p.mesh) scene.remove(p.mesh);
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
                        btnRestartEl.style.top = (r.bottom + 16) + 'px';
                        btnRestartEl.style.transform = 'translate(-50%, 0)';
                    }
                }
            }
        }
        // Tick boost countdown every frame for smooth display
        if (isBoosted) {
            const boostEl = document.getElementById('boost-timer');
            const remain = Math.max(0, (boostEndAt - performance.now()) / 1000);
            boostEl.style.display = '';
            boostEl.textContent = `🔥 ×${boostMultiplier}  ${remain.toFixed(1)}s`;
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
            if (Math.abs(dx) > COLS * CELL / 2) dx = 0;
            if (Math.abs(dz) > ROWS * CELL / 2) dz = 0;
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
                    let nx = 0, nz = 1, found = false;
                    let bestD = Infinity;
                    const hx = mesh.position.x, hz = mesh.position.z;
                    for (const b of beans) {
                        const ddx = b.x * CELL - hx, ddz = b.y * CELL - hz;
                        const d = ddx * ddx + ddz * ddz;
                        if (d < bestD) { bestD = d; nx = ddx; nz = ddz; found = true; }
                    }
                    const eyeR = ud.eyeRadius;
                    let lx = 0, lz = 1;
                    if (found) {
                        // transform world dir to head-local (inverse rotation.y)
                        const ca = Math.cos(-angle), sa = Math.sin(-angle);
                        const tlx = nx * ca - nz * sa;
                        const tlz = nx * sa + nz * ca;
                        const len = Math.hypot(tlx, tlz) || 1;
                        lx = tlx / len; lz = tlz / len;
                    }
                    // Smooth pupil direction to avoid snapping when target bean changes
                    if (ud.gazeX === undefined) { ud.gazeX = lx; ud.gazeZ = lz; }
                    const smooth = 0.12;
                    ud.gazeX += (lx - ud.gazeX) * smooth;
                    ud.gazeZ += (lz - ud.gazeZ) * smooth;
                    // Renormalize so pupil stays on a circle (no shrinking during lerp)
                    const gLen = Math.hypot(ud.gazeX, ud.gazeZ) || 1;
                    const gx = ud.gazeX / gLen, gz = ud.gazeZ / gLen;
                    // Place pupil on upper hemisphere toward bean
                    const off = eyeR * 0.5;
                    const py = eyeR * 0.62;
                    ud.pupilRefs.forEach(r => {
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
                        ud.eyeRefs.forEach(e => { e.scale.y = sq; });
                        ud.pupilRefs.forEach(r => { r.pupil.visible = sq > 0.4; r.hl.visible = sq > 0.4; });
                    } else {
                        ud.eyeRefs.forEach(e => { e.scale.y = 1; });
                    }

                    // Eat animation: open mouth for short window
                    if (ud.eatTimer > 0) {
                        ud.eatTimer -= 16;
                        const t = ud.eatTimer;
                        ud.smile.visible = false;
                        ud.openMouth.visible = true;
                        ud.tongue.visible = true;
                        const s = 0.6 + Math.sin((1 - t / 220) * Math.PI) * 0.6;
                        ud.openMouth.scale.set(s, s, 1);
                        ud.tongue.scale.set(s, s, 1);
                    } else {
                        ud.smile.visible = true;
                        ud.openMouth.visible = false;
                        ud.tongue.visible = false;
                    }
                }
            }
            // Body segments - color = eaten bean colors (newest at body[1])
            if (i > 0) {
                if (godMode) {
                    const hue = ((time * 0.0008) + i * 0.08) % 1;
                    const col = new THREE.Color().setHSL(hue, 1, 0.55);
                    mesh.material.color.copy(col);
                    mesh.material.opacity = 0.92;
                    mesh.material.transmission = 0.08;
                } else if (isBoosted) {
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
            } else if (i === 0 && isBoosted) {
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
                if (mesh.userData.dropPhase === 0) { mesh.userData.dropBounce = 1.0; audio.play('plop'); spawnRipple(bean.x * CELL, bean.y * CELL); }
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
                const haloFade = dp > 0 ? (1 - dp) : 1;
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
                if (mesh.userData.dropPhase === 0) { mesh.userData.dropBounce = 1.0; audio.play('plop'); spawnRipple(bean.x * CELL, bean.y * CELL); }
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
        particles3D.forEach(p => {
            p.mesh.position.x += p.vx;
            p.mesh.position.y += p.vy;
            p.mesh.position.z += p.vz;
            p.vy -= 0.003;
            p.life--;
            p.mesh.material.opacity = p.life / 60;
            p.mesh.scale.setScalar(p.life / 60);
        });
        particles3D = particles3D.filter(p => {
            if (p.life <= 0) { scene.remove(p.mesh); return false; }
            return true;
        });

        // Update rain
        rain3D.forEach(r => {
            r.mesh.position.y -= r.speed;
            r.life--;
            r.mesh.material.opacity = Math.min(0.7, r.life / 60);
        });
        rain3D = rain3D.filter(r => {
            if (r.life <= 0 || r.mesh.position.y < -1) { scene.remove(r.mesh); return false; }
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
        bubbles.forEach(b => {
            b.position.y += b.userData.speed;
            b.position.x += Math.sin(time * 0.001 + b.userData.phase) * 0.004;
            if (b.position.y > 5.5) {
                b.position.y = -0.2;
                b.position.x = (Math.random() - 0.5) * COLS * CELL * 1.4 + COLS * CELL / 2;
                b.position.z = (Math.random() - 0.5) * ROWS * CELL * 1.4 + ROWS * CELL / 2;
            }
        });

        // Animate god-ray shafts — slow drift + opacity shimmer
        shafts.forEach(s => {
            s.userData.driftPhase += s.userData.driftSpeed;
            s.position.x = s.userData.baseX + Math.sin(s.userData.driftPhase) * 1.5;
            s.position.z = s.userData.baseZ + Math.cos(s.userData.driftPhase * 0.7) * 1.5;
            s.material.opacity = s.userData.baseOpacity * (0.7 + Math.sin(time * 0.0008 + s.userData.driftPhase) * 0.3);
        });

        // Animate caustics — scroll opposite directions
        causticsTex.offset.x = (time * 0.00003) % 1;
        causticsTex.offset.y = (time * 0.00002) % 1;
        causticsTex2.offset.x = (-time * 0.00004) % 1;
        causticsTex2.offset.y = (time * 0.000035) % 1;
        causticsMesh.material.opacity = 0.4 + Math.sin(time * 0.0012) * 0.08;

        // Animate water surface waves
        const wpos = waterGeom.attributes.position;
        for (let i = 0; i < wpos.count; i++) {
            const bx = waterBasePositions[i*3], by = waterBasePositions[i*3+1];
            const z = Math.sin(bx*0.4 + time*0.002) * 0.15 + Math.cos(by*0.3 + time*0.0017) * 0.12;
            wpos.array[i*3+2] = z;
        }
        wpos.needsUpdate = true;

        // Animate grass tufts — ambient sway + react to snake head proximity
        const headMesh = snakeMeshes[0];
        const hx = headMesh ? headMesh.position.x : -999;
        const hz = headMesh ? headMesh.position.z : -999;
        grassTufts.forEach(t => {
            const swayBase = Math.sin(time * t.freq + t.phase) * 0.08;
            const dx = t.baseX - hx;
            const dz = t.baseZ - hz;
            const dist = Math.hypot(dx, dz);
            // Within ~2.5 cells, push grass outward from snake (radial bend)
            let reactX = 0, reactZ = 0, pulse = 0;
            if (dist < 3.5) {
                const k = (1 - dist / 3.5);
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
            if (r.delay > 0) { r.delay--; continue; }
            r.life--;
            const t = 1 - r.life / r.maxLife; // 0..1
            const eased = 1 - Math.pow(1 - t, 2); // ease-out quad
            const scale = r.startScale + (r.endScale - r.startScale) * eased;
            r.mesh.scale.set(scale, scale, 1);
            // Fade in fast at start, fade out slow at end
            const fadeIn = Math.min(1, t * 4);
            const fadeOut = Math.max(0, 1 - t);
            r.mesh.material.opacity = 0.28 * fadeIn * fadeOut;
            if (r.life <= 0) {
                scene.remove(r.mesh);
                r.mesh.material.dispose();
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
                prevSnake = snake.map(s => ({ x: s.x, y: s.y }));
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
    document.addEventListener('keydown', e => {
        audio.init(); // Init audio on first interaction

        // ----- Easter eggs (always-on capture) -----
        // 1) Konami code → 樊一鹏模式
        konamiBuf.push(e.key);
        if (konamiBuf.length > konamiSeq.length) konamiBuf.shift();
        if (konamiBuf.length === konamiSeq.length &&
            konamiBuf.every((k, i) => k.toLowerCase() === konamiSeq[i].toLowerCase())) {
            konamiBuf = [];
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
        const arrowOnly = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
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
            if (gameOver) { e.preventDefault(); return; }
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
        const newDir = DAIDAI.keyToDirection(e.key);
        if (newDir) {
            heldDirKeys.add(e.key);
            const combined = combineHeldDir();
            if (combined && !DAIDAI.isOppositeDir(direction, combined)) {
                nextDirection = combined;
            }
            e.preventDefault();
        }
    });
    // ============ DIAGONAL MOVEMENT (held-key tracking) ============
    const heldDirKeys = new Set();
    function combineHeldDir() { return DAIDAI.combineHeldDir(heldDirKeys); }
    window.addEventListener('keyup', e => { heldDirKeys.delete(e.key); });
    window.addEventListener('blur', () => heldDirKeys.clear());

    // ============ TOUCH / SWIPE CONTROLS ============
    (function() {
        let sx = 0, sy = 0, tracking = false, moved = false;
        const SWIPE_THRESHOLD = 24; // px
        function applyDir(dx, dy) {
            const nd = DAIDAI.classifyDelta(dx, dy);
            if (!nd) return;
            if (!DAIDAI.isOppositeDir(direction, nd)) {
                nextDirection = nd;
            }
        }
        const surface = renderer.domElement;
        surface.addEventListener('touchstart', e => {
            audio.init();
            if (gameOver) { e.preventDefault(); return; }
            const t = e.touches[0];
            sx = t.clientX; sy = t.clientY;
            tracking = true; moved = false;
            e.preventDefault();
        }, { passive: false });
        surface.addEventListener('touchmove', e => {
            if (!tracking) return;
            const t = e.touches[0];
            const dx = t.clientX - sx, dy = t.clientY - sy;
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
                sx = t.clientX; sy = t.clientY;
            }
            e.preventDefault();
        }, { passive: false });
        surface.addEventListener('touchend', e => {
            // Quick tap (no swipe) → unpause / start game
            if (tracking && !moved && paused) {
                paused = false;
                showMessage('');
                audio.play('start');
            }
            tracking = false;
            e.preventDefault();
        }, { passive: false });
        // Pause button
        const btnPause = document.getElementById('btn-pause');
        btnPause.addEventListener('click', e => {
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
        btnRestart.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); doRestart(); });
        // Refresh the button label to reflect the active input modality
        // (keyboard shortcut, gamepad glyph, or touch).
        function refreshRestartBtnLabel() {
            if (!btnRestart) return;
            if (hasGamepad || (typeof detectGamepadNow === 'function' && detectGamepadNow())) {
                btnRestart.textContent = t('hint.restartGamepad', { btn: gpBtn('B') });
            } else if (hasTouchEnv && !hasFineKeyboardEnv) {
                btnRestart.textContent = '⟳ ' + t('btn.restart');
            } else {
                btnRestart.textContent = t('hint.restartKey');
            }
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
        btnMute.addEventListener('click', e => {
            e.preventDefault();
            audio.init();
            audio.setMuted(!audio.muted);
            refreshMuteUI();
        });
        refreshMuteUI();
        // Language switcher
        (function setupLangMenu() {
            const btn = document.getElementById('btn-lang');
            const menu = document.getElementById('lang-menu');
            if (!btn || !menu) return;
            // Add gamepad-shortcut badge to button (shown only when gamepad detected)
            const badge = document.createElement('span');
            badge.className = 'gp-badge';
            badge.id = 'btn-lang-badge';
            btn.appendChild(badge);
            menu.querySelectorAll('button[data-lang]').forEach(b => {
                if (b.getAttribute('data-lang') === LANG) b.classList.add('active');
            });
            function canSwitch() { return paused && !gameOver; }
            function updateBtnState() {
                btn.style.display = canSwitch() ? 'flex' : 'none';
                if (!canSwitch()) menu.classList.remove('open');
            }
            window.__updateLangBtnState = updateBtnState;
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                if (!canSwitch()) {
                    showEffect('⏸ ' + t('hint.langPauseFirst'));
                    return;
                }
                menu.classList.toggle('open');
            });
            menu.addEventListener('click', e => {
                const target = e.target.closest('button[data-lang]');
                if (!target) return;
                e.preventDefault();
                e.stopPropagation();
                const lang = target.getAttribute('data-lang');
                setLang(lang);
                menu.classList.remove('open');
            });
            document.addEventListener('click', e => {
                if (!menu.classList.contains('open')) return;
                if (e.target === btn || menu.contains(e.target)) return;
                menu.classList.remove('open');
            });
            updateBtnState();
            setInterval(updateBtnState, 250);
        })();
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
                const hintKey = document.querySelector('#instr-line .hint-key');
                if (hintKey) { hintKey.textContent = t('hint.pauseGamepad', { btn: gpBtn('A') }); hintKey.style.display = 'inline'; }
                const hintSep = document.querySelector('#instr-line .hint-sep');
                if (hintSep) hintSep.style.display = 'inline';
                // Restart button label now also reflects gamepad modality
                if (typeof window.__refreshRestartBtnLabel === 'function') window.__refreshRestartBtnLabel();
                const mb = document.getElementById('btn-mute');
                if (mb && hasTouchEnv && !hasFineKeyboardEnv) mb.title = t('btn.sound') + ' (' + gpBtn('X') + ')';
                const lb = document.getElementById('btn-lang');
                if (lb) lb.title = t('btn.language') + ' (' + gpBtn('Y') + ')';
                const lbadge = document.getElementById('btn-lang-badge');
                if (lbadge) { lbadge.textContent = isPSGamepad ? '△' : 'Y'; lbadge.classList.add('show'); }
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
                    if (!loggedPad) { console.log('[gamepad] detected:', pad.id, 'mapping:', pad.mapping); loggedPad = true; }
                    const wasPS = isPSGamepad;
                    if (/dualshock|dualsense|playstation|ps[345]|sony|054c/.test(idLower)) isPSGamepad = true;
                    markGamepad();
                    // If we just discovered it's a PS pad after first marking, re-apply glyphs
                    if (!wasPS && isPSGamepad) {
                        applyGamepadGlyphs();
                        if (paused && !gameOver && typeof window.__refreshIdlePrompt === 'function') window.__refreshIdlePrompt();
                    }
                    // Direction: D-pad (buttons 12-15) or left stick (axes 0,1)
                    let dx = 0, dy = 0;
                    if (pad.buttons[12]?.pressed) dy = -1;
                    else if (pad.buttons[13]?.pressed) dy = 1;
                    if (pad.buttons[14]?.pressed) dx = -1;
                    else if (pad.buttons[15]?.pressed) dx = 1;
                    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
                    if (!dx && !dy && (Math.abs(ax) > DEAD || Math.abs(ay) > DEAD)) {
                        const nd2 = DAIDAI.classifyDelta(ax, ay);
                        if (nd2) { dx = nd2.x; dy = nd2.y; }
                    }
                    if (dx || dy) {
                        const nd = { x: dx, y: dy };
                        if (paused && !gameOver) { audio.init(); paused = false; showMessage(''); audio.play('start'); }
                        // After game over, direction input is ignored —
                        // restart requires an explicit A/B/Start/Back press
                        // (or the on-screen restart button / ↵ Enter).
                        if (!gameOver && !DAIDAI.isOppositeDir(direction, nd)) nextDirection = nd;
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
                                else { paused = !paused; showMessage(paused ? t('paused') : ''); btnPause.textContent = paused ? '▶' : '⏸'; }
                            }
                            // B/Circle (1) or Back (8): restart — only when paused or game over
                            if (i === 1 || i === 8) {
                                if (paused || gameOver) { audio.init(); doRestart(); }
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
                    prevButtons[pad.index] = pad.buttons.map(b => b.pressed);
                }
                requestAnimationFrame(poll);
            }
            window.addEventListener('gamepadconnected', () => { markGamepad(); requestAnimationFrame(poll); });
            // Some browsers (Chrome) need an active poll loop even without an event
            requestAnimationFrame(poll);
        })();
        // More menu toggle
        const moreMenu = document.getElementById('more-menu');
        const morePopup = document.getElementById('more-popup');
        moreMenu.addEventListener('click', e => {
            e.stopPropagation();
            morePopup.classList.toggle('open');
        });
        document.addEventListener('click', e => {
            if (!moreMenu.contains(e.target)) morePopup.classList.remove('open');
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
            if (wasCompact !== isCompact) { applyCanvasSize(); fitCameraToPond(); }
        }
        window.addEventListener('resize', checkInfoBarOverflow);
        setTimeout(checkInfoBarOverflow, 0);
        // Re-check whenever score/hiscore text length changes
        new MutationObserver(checkInfoBarOverflow).observe(infoBar, { subtree: true, characterData: true, childList: true });
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
            score, hiScore, gameOver, paused, godMode,
            snake: snake.map(s => ({ x: s.x, y: s.y })),
            direction: { x: direction.x, y: direction.y },
            nextDirection: { x: nextDirection.x, y: nextDirection.y },
            beans: beans.map(b => ({ x: b.x, y: b.y, color: b.color })),
            goldBeans: goldBeans.map(g => ({ x: g.x, y: g.y, life: g.life })),
            shedSkin: shedSkin.map(s => ({ x: s.x, y: s.y, life: s.life })),
            eatenColors: eatenColors.snapshot(),
            comboColor: combo.color, comboCount: combo.count,
            isBoosted, boostMultiplier, isRaining,
            growthPending, beansEaten,
            goldenProjectiles: goldenProjectiles.length,
            speed, baseSpeed,
        }),
        setSnake: (cells) => {
            snake = cells.map(c => ({ x: c.x, y: c.y }));
            eatenColors.reset();
            growthPending = 0;
        },
        setDirection: (x, y) => {
            direction = { x, y };
            nextDirection = { x, y };
        },
        clearBeans: () => { beans = []; },
        placeBean: (x, y, color) => { beans.push({ x, y, color: color | 0 }); },
        clearGold: () => { goldBeans = []; },
        placeGold: (x, y) => { goldBeans.push({ x, y, life: 300 }); },
        clearShed: () => { shedSkin = []; },
        placeShed: (x, y) => { shedSkin.push({ x, y, life: 600 }); },
        setPaused: (p) => { paused = !!p; },
        setGameOver: (g) => { gameOver = !!g; },
        setGodMode: (g) => { godMode = !!g; },
        setComboColor: (c, n) => { combo.color = c; combo.count = n; },
        setBaseSpeed: (s) => { baseSpeed = s; speed = s; },
        step: () => {
            const wasPaused = paused;
            paused = false;
            try { gameUpdate(); } finally { paused = wasPaused; }
        },
        triggerMagic: (c) => { triggerMagic(c); },
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
            tributeActive = false;
        },
        tributeTriggered: () => tributeTriggeredThisLoad,
        callActivateTribute: () => { activateTribute(); },
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
            const msg = isNew
                ? t('over.new', { score })
                : t('over.normal', { score, hi });
            showMessage(msg);
        } else if (paused) {
            // Distinguish initial-idle (score==0, hasn't moved) from mid-game pause
            const isInitial = (typeof score !== 'undefined' && score === 0)
                && (typeof snake !== 'undefined' && snake && snake.length <= 5);
            if (isInitial) {
                showMessage(getStartPrompt());
            } else {
                showMessage(t('paused'));
            }
        }
        // Gamepad glyphs (also updates btn-mute/btn-lang titles)
        try { if (typeof window.__applyGamepadGlyphs === 'function') window.__applyGamepadGlyphs(); } catch(_) {}
        // Refresh the consolidated restart button label after locale change
        try { if (typeof window.__refreshRestartBtnLabel === 'function') window.__refreshRestartBtnLabel(); } catch(_) {}
    }
    window.__refreshDynamicI18n = refreshDynamicI18n;
    // Update prompt dynamically if first interaction reveals a different modality
    window.addEventListener('touchstart', () => { if (!hasGamepad) refreshIdlePrompt(); }, { once: true, passive: true });
    window.addEventListener('keydown', () => { if (!hasGamepad) refreshIdlePrompt(); }, { once: true });
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
            let tries = 0, x, y;
            do {
                x = Math.floor(Math.random() * COLS);
                y = Math.floor(Math.random() * ROWS);
            } while (isOccupied(x, y) && ++tries < 30);
            if (tries >= 30) continue;
            const c = Math.floor(Math.random() * COLORS_HEX.length);
            setTimeout(() => spawnFallingBean(x, y, c), i * 180);
        }
    }, 1000);
