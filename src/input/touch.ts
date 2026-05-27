import type { AudioEngine } from '../audio/AudioEngine';
import { installLangMenu } from '../i18n/dom';
import { getRestartLabel } from './promptStrings';
import { canStartFromDirection, classifyDelta, isOppositeDir } from './direction';

type Dir = { x: number; y: number };
type TFn = (key: string, vars?: Record<string, unknown>) => string;
type Modality = { hasGamepad: boolean; hasTouch: boolean; hasFineKeyboard: boolean };

export interface TouchControlsDeps {
    canvas: HTMLElement;
    audio: AudioEngine;
    t: TFn;
    showMessage: (m: string) => void;
    showEffect: (m: string) => void;
    initGame: () => void;
    getDirection: () => Dir;
    setNextDirection: (d: Dir) => void;
    getGameOver: () => boolean;
    getPaused: () => boolean;
    setPaused: (p: boolean) => void;
    getHasStarted: () => boolean;
    getLang: () => string;
    setLang: (lang: string) => void;
    currentModality: () => Modality;
    gpBtn: (btn: string) => string;
    getHasGamepad: () => boolean;
    setHasGamepad: (v: boolean) => void;
    getIsPSGamepad: () => boolean;
    setIsPSGamepad: (v: boolean) => void;
    hasTouchEnv: boolean;
    hasFineKeyboardEnv: boolean;
    onResize: () => void;
    refreshIdlePrompt: () => void;
}

export interface TouchControlsApi {
    markGamepad: () => void;
    applyGamepadGlyphs: () => void;
    refreshRestartBtnLabel: () => void;
}

export function installTouchControls(deps: TouchControlsDeps): TouchControlsApi {
    const {
        canvas: surface,
        audio,
        t,
        showMessage,
        showEffect,
        initGame,
        getDirection,
        setNextDirection,
        getGameOver,
        getPaused,
        setPaused,
        getHasStarted,
        getLang,
        setLang,
        currentModality,
        gpBtn,
        getHasGamepad,
        setHasGamepad,
        getIsPSGamepad,
        setIsPSGamepad,
        hasTouchEnv,
        hasFineKeyboardEnv,
        onResize,
        refreshIdlePrompt,
    } = deps;

    let sx = 0,
        sy = 0,
        tracking = false,
        moved = false;
    const SWIPE_THRESHOLD = 24; // px
    function applyDir(dx: number, dy: number) {
        const nd = classifyDelta(dx, dy);
        if (!nd) return;
        if (!isOppositeDir(getDirection(), nd)) {
            setNextDirection(nd);
        }
    }
    surface.addEventListener(
        'touchstart',
        (e) => {
            audio.init();
            if (getGameOver()) {
                e.preventDefault();
                return;
            }
            const tt = (e as TouchEvent).touches[0];
            sx = tt.clientX;
            sy = tt.clientY;
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
            const tt = (e as TouchEvent).touches[0];
            const dx = tt.clientX - sx,
                dy = tt.clientY - sy;
            if (Math.hypot(dx, dy) >= SWIPE_THRESHOLD) {
                moved = true;
                // Swipe only starts the game from the initial idle screen —
                // mid-run a swipe must NOT unpause (matches keyboard, where
                // arrows never unpause; only ▶ / Space resumes).
                if (
                    canStartFromDirection({
                        paused: getPaused(),
                        gameOver: getGameOver(),
                        started: getHasStarted(),
                    })
                ) {
                    setPaused(false);
                    showMessage('');
                    audio.play('start');
                }
                if (!getPaused()) applyDir(dx, dy);
                // Reset origin so continued drag can chain another direction
                sx = tt.clientX;
                sy = tt.clientY;
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
            if (tracking && !moved && getPaused() && !getGameOver()) {
                if (
                    canStartFromDirection({
                        paused: getPaused(),
                        gameOver: getGameOver(),
                        started: getHasStarted(),
                    })
                ) {
                    setPaused(false);
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
    const btnPause = document.getElementById('btn-pause') as HTMLElement;
    btnPause.addEventListener('click', (e) => {
        e.preventDefault();
        audio.init();
        // After game over the pause button is meaningless — the player
        // must use the dedicated restart button (or ↵ / gamepad shortcut).
        if (getGameOver()) return;
        const next = !getPaused();
        setPaused(next);
        showMessage(next ? t('paused') : '');
        btnPause.textContent = next ? '▶' : '⏸';
    });
    // Restart button (single consolidated UI)
    function doRestart() {
        audio.init();
        initGame();
        setPaused(false);
        btnPause.textContent = '⏸';
        showMessage('');
    }
    const btnRestart = document.getElementById('btn-restart') as HTMLElement | null;
    if (btnRestart) {
        btnRestart.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            doRestart();
        });
    }
    // Refresh the button label to reflect the active input modality
    // (keyboard shortcut, gamepad glyph, or touch).
    function refreshRestartBtnLabel() {
        if (!btnRestart) return;
        btnRestart.textContent = getRestartLabel(t, currentModality(), {
            gpBtnB: () => gpBtn('B'),
        });
    }
    refreshRestartBtnLabel();
    // Mute button
    const btnMute = document.getElementById('btn-mute') as HTMLElement;
    // Detect Tauri so we can wire X/Square as a true mute shortcut on desktop
    // (the previous condition only fired on touch / mobile).
    const isTauriEnv =
        typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
    const wantsGamepadMute = (hasTouchEnv && !hasFineKeyboardEnv) || isTauriEnv;
    // Gamepad badge for the mute button — mirrors btn-lang's badge so the
    // shortcut hint is visible at a glance.
    const muteBadge = document.createElement('span');
    muteBadge.className = 'gp-badge';
    muteBadge.id = 'btn-mute-badge';
    btnMute.appendChild(muteBadge);
    function refreshMuteUI() {
        const m = audio.muted;
        // textContent wipes children, so re-attach the badge after updating.
        btnMute.textContent = m ? '🔇' : '🔊';
        btnMute.appendChild(muteBadge);
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
    // Language switcher (extracted to src/i18n/dom.ts). The returned
    // updateBtnState ticks itself on a setInterval inside installLangMenu, so
    // we don't need to thread it back out — no external caller reads it.
    installLangMenu({
        getLang,
        setLang,
        t,
        canSwitch: () => getPaused() && !getGameOver(),
        showEffect,
    });
    // ============ GAMEPAD CONTROLLER SUPPORT ============
    const prevButtons: boolean[][] = [];
    const DEAD = 0.4;
    function applyGamepadGlyphs() {
        // Defense-in-depth: this function paints the UI as if a gamepad
        // is connected, so refuse to run when one isn't. Several callers
        // (e.g. refreshDynamicI18n after a language switch) invoke this
        // unconditionally — without this guard we'd light up the gamepad
        // hints on keyboard / touch users every time they change locale.
        if (!getHasGamepad()) return;
        const hintKey = document.querySelector('#instr-line .hint-key') as HTMLElement | null;
        if (hintKey) {
            hintKey.textContent = t('hint.pauseGamepad', { btn: gpBtn('A') });
            hintKey.style.display = 'inline';
        }
        const hintSep = document.querySelector('#instr-line .hint-sep') as HTMLElement | null;
        if (hintSep) hintSep.style.display = 'inline';
        // Restart button label now also reflects gamepad modality
        refreshRestartBtnLabel();
        const mb = document.getElementById('btn-mute');
        if (mb && wantsGamepadMute) mb.title = t('btn.sound') + ' (' + gpBtn('X') + ')';
        const mbadge = document.getElementById('btn-mute-badge');
        if (mbadge && wantsGamepadMute) {
            mbadge.textContent = getIsPSGamepad() ? '□' : 'X';
            mbadge.classList.add('show');
        }
        const lb = document.getElementById('btn-lang');
        if (lb) lb.title = t('btn.language') + ' (' + gpBtn('Y') + ')';
        const lbadge = document.getElementById('btn-lang-badge');
        if (lbadge) {
            lbadge.textContent = getIsPSGamepad() ? '△' : 'Y';
            lbadge.classList.add('show');
        }
    }
    function markGamepad() {
        const firstTime = !getHasGamepad();
        setHasGamepad(true);
        if (!firstTime) return;
        refreshIdlePrompt();
        applyGamepadGlyphs();
    }
    // Log first-seen gamepad id once so unknown pads can be added to the PS regex
    // (gated behind `?debug` / `#debug` to avoid noisy console output in production).
    const debugLog =
        typeof location !== 'undefined' &&
        ((location.search || '').includes('debug') || (location.hash || '').includes('debug'));
    let loggedPad = false;
    function poll() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) {
            if (!pad || pad.connected === false) continue;
            const idLower = (pad.id || '').trim().toLowerCase();
            if (!idLower) continue;
            if (!loggedPad) {
                if (debugLog) console.log('[gamepad] detected:', pad.id, 'mapping:', pad.mapping);
                loggedPad = true;
            }
            const wasPS = getIsPSGamepad();
            if (/dualshock|dualsense|playstation|ps[345]|sony|054c/.test(idLower)) setIsPSGamepad(true);
            markGamepad();
            // If we just discovered it's a PS pad after first marking, re-apply glyphs
            if (!wasPS && getIsPSGamepad()) {
                applyGamepadGlyphs();
                if (getPaused() && !getGameOver()) refreshIdlePrompt();
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
                // Match the touch behavior: a direction press starts the game
                // ONLY from the initial idle screen. After the player has
                // explicitly paused mid-run, only A/Start can resume — this
                // prevents an idle stick (or controller drift) from kicking
                // the player back into a running game.
                if (
                    canStartFromDirection({
                        paused: getPaused(),
                        gameOver: getGameOver(),
                        started: getHasStarted(),
                    })
                ) {
                    audio.init();
                    setPaused(false);
                    showMessage('');
                    audio.play('start');
                }
                if (!getGameOver() && !getPaused() && !isOppositeDir(getDirection(), nd)) setNextDirection(nd);
            }
            // Edge-triggered button presses
            const prev = prevButtons[pad.index] || [];
            pad.buttons.forEach((b, i) => {
                const wasDown = !!prev[i];
                if (b.pressed && !wasDown) {
                    // A/Cross (0) or Start (9): pause/unpause or restart
                    if (i === 0 || i === 9) {
                        audio.init();
                        if (getGameOver()) doRestart();
                        else {
                            const next = !getPaused();
                            setPaused(next);
                            showMessage(next ? t('paused') : '');
                            btnPause.textContent = next ? '▶' : '⏸';
                        }
                    }
                    // B/Circle (1) or Back (8): restart — only when paused or game over
                    if (i === 1 || i === 8) {
                        if (getPaused() || getGameOver()) {
                            audio.init();
                            doRestart();
                        }
                    }
                    // X/Square (2): toggle mute (touch/mobile + Tauri desktop —
                    // browsers on desktop have their own tab-mute affordance)
                    if (i === 2 && wantsGamepadMute) {
                        audio.init();
                        audio.setMuted(!audio.muted);
                        refreshMuteUI();
                        showEffect(audio.muted ? '🔇 ' + t('btn.sound') : '🔊 ' + t('btn.sound'));
                    }
                    // Y/Triangle (3): cycle language — only while paused / waiting to start (not game over)
                    if (i === 3 && getPaused() && !getGameOver()) {
                        const langs = [
                            'zh-cn',
                            'zh-tw',
                            'en-us',
                            'ja-jp',
                            'ko-kr',
                            'es-es',
                            'fr-fr',
                            'it-it',
                            'de-de',
                            'pt-br',
                            'pl-pl',
                            'ru-ru',
                            'th-th',
                        ];
                        const idx = langs.indexOf(getLang());
                        const nextLang = langs[(idx + 1) % langs.length];
                        setLang(nextLang);
                        showEffect('🌐 ' + nextLang.toUpperCase());
                    }
                }
            });
            prevButtons[pad.index] = pad.buttons.map((b) => b.pressed);
        }
        requestAnimationFrame(poll);
    }
    let pollStarted = false;
    function startPoll() {
        if (pollStarted) return;
        pollStarted = true;
        if (probeInterval !== null) {
            clearInterval(probeInterval);
            probeInterval = null;
        }
        requestAnimationFrame(poll);
    }
    window.addEventListener('gamepadconnected', () => {
        markGamepad();
        startPoll();
    });
    // Some browsers (Chrome) need an active poll loop even without an event.
    // Use a low-frequency interval probe to detect a connected pad without
    // burning a permanent rAF when no gamepad is present.
    let probeInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
        if (pollStarted) return;
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) {
            if (pad && pad.connected !== false && (pad.id || '').trim()) {
                startPoll();
                return;
            }
        }
    }, 1000);
    // More menu toggle
    const moreMenu = document.getElementById('more-menu') as HTMLElement;
    const morePopup = document.getElementById('more-popup') as HTMLElement;
    moreMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        morePopup.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!moreMenu.contains(e.target as Node)) morePopup.classList.remove('open');
    });
    // Show ⋯ only when info-bar would overflow
    const infoBar = document.getElementById('info-bar') as HTMLElement;
    function checkInfoBarOverflow() {
        // Try expanding (show HISCORE + GitHub). If it fits, keep expanded; otherwise stay compact.
        const wasCompact = infoBar.classList.contains('compact');
        infoBar.classList.remove('compact');
        const fits = infoBar.scrollWidth <= infoBar.clientWidth + 1;
        if (!fits) infoBar.classList.add('compact');
        const isCompact = infoBar.classList.contains('compact');
        if (wasCompact !== isCompact) {
            onResize();
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
    return { markGamepad, applyGamepadGlyphs, refreshRestartBtnLabel };
}
