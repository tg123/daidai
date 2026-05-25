// One-shot integration: replaces hand-written audio/i18n/eatenColors/heart/gamepad
// blocks in index.html with calls to the extracted DAIDAI.* modules.
import fs from 'node:fs';

const FILE = 'index.html';
let src = fs.readFileSync(FILE, 'utf8');
const hadCRLF = src.includes('\r\n');
if (hadCRLF) src = src.replace(/\r\n/g, '\n');

function replaceOnce(needle, replacement, label) {
    const idx = src.indexOf(needle);
    if (idx === -1) throw new Error(`[${label}] needle not found`);
    if (src.indexOf(needle, idx + 1) !== -1) throw new Error(`[${label}] needle not unique`);
    src = src.slice(0, idx) + replacement + src.slice(idx + needle.length);
    console.log(`✓ ${label}`);
}

function replaceBlock(startNeedle, endNeedle, replacement, label) {
    const i = src.indexOf(startNeedle);
    if (i === -1) throw new Error(`[${label}] start needle not found`);
    const j = src.indexOf(endNeedle, i);
    if (j === -1) throw new Error(`[${label}] end needle not found`);
    src = src.slice(0, i) + replacement + src.slice(j + endNeedle.length);
    console.log(`✓ ${label}`);
}

// 1) Inject script tags after Three.js CDN
replaceOnce(
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n    <script>\n    // ============ AUDIO ENGINE (Original PCM/WAV files) ============',
    `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="./src/heartSequence.js"></script>
    <script src="./src/eatenColors.js"></script>
    <script src="./src/i18n/index.js"></script>
    <script src="./src/i18n/zh.js"></script>
    <script src="./src/i18n/zh-tw.js"></script>
    <script src="./src/i18n/en.js"></script>
    <script src="./src/i18n/ja.js"></script>
    <script src="./src/i18n/ko.js"></script>
    <script src="./src/i18n/es.js"></script>
    <script src="./src/audio/AudioEngine.js"></script>
    <script src="./src/input/gamepad.js"></script>
    <script>
    // ============ AUDIO ENGINE (extracted to src/audio/AudioEngine.js) ============`,
    'script tags + audio header'
);

// 2) Remove the AudioEngine class definition (now a thin alias)
replaceBlock(
    '    class AudioEngine {\n        constructor() {\n            this.ctx = null;',
    '    }\n    const audio = new AudioEngine();',
    `    const AudioEngine = DAIDAI.AudioEngine;
    const audio = new AudioEngine();`,
    'AudioEngine class body'
);

// 3) Replace I18N_DICT + helpers with thin wrappers
// Anchor: from `const I18N_DICT = {` through end of `applyI18nDOM();` standalone call
replaceBlock(
    '    const I18N_DICT = {\n        zh: {',
    '    applyI18nDOM();\n    const COLORS_HEX',
    `    // ============ I18N (dictionaries + helpers extracted to src/i18n/) ============
    const I18N_DICT = DAIDAI.I18N_DICT;
    let LANG = DAIDAI.pickLang({
        url: new URLSearchParams(location.search).get('lang'),
        stored: (() => { try { return localStorage.getItem('daidai_lang'); } catch(e) { return null; } })(),
        navigator: (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'zh']),
    });
    const t = DAIDAI.createT(() => LANG);
    try { document.documentElement.lang = LANG; document.title = t('title'); } catch(e) {}
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
    const COLORS_HEX`,
    'I18N_DICT + helpers'
);

// 4) Replace `let eatenColors = []` with queue API
replaceOnce(
    `    let eatenColors = []; // queue of bean colors, [0]=most recent — displayed body[1]=eatenColors[0], body[2]=eatenColors[1], ...`,
    `    const eatenColors = DAIDAI.createEatenColorsQueue(); // queue of bean colors behind the head`,
    'eatenColors declaration'
);

// 5) Rewrite eatenColors call sites
replaceOnce('        ];\n        eatenColors = [];\n        godMode = false;', '        ];\n        eatenColors.reset();\n        godMode = false;', 'eatenColors reset @ initGame');
replaceOnce('            eatenColors.unshift(bean.color);', '            eatenColors.recordEaten(bean.color);', 'recordEaten');
replaceOnce('            eatenColors = eatenColors.slice(0, initLen - 1);', '            eatenColors.trimAfterShed(initLen);', 'trimAfterShed');
replaceOnce('                eatenColors = eatenColors.slice(0, Math.max(0, halfLen - 1));', '                eatenColors.trimAfterHalve(halfLen);', 'trimAfterHalve');
replaceOnce('                    const cIdx = eatenColors[i - 1];', '                    const cIdx = eatenColors.colorAt(i - 1);', 'colorAt');
replaceOnce('            eatenColors: eatenColors.slice(),', '            eatenColors: eatenColors.snapshot(),', 'snapshot for test hook');
replaceOnce('            snake = cells.map(c => ({ x: c.x, y: c.y }));\n            eatenColors = [];',
            '            snake = cells.map(c => ({ x: c.x, y: c.y }));\n            eatenColors.reset();', 'reset for setSnake');

// 6) Replace heartSeq/heartBuf declarations
replaceBlock(
    '    const heartSeq = [\n',
    '    let heartBuf = [];\n',
    `    const heartMatcher = DAIDAI.createHeartMatcher(DAIDAI.HEART_SEQUENCE);
`,
    'heartSeq/heartBuf decl'
);

// 7) Replace heartBuf reset in initGame
replaceOnce('        konamiBuf = [];\n        heartBuf = [];\n        typedBuf', '        konamiBuf = [];\n        heartMatcher.reset();\n        typedBuf', 'heartMatcher reset @ initGame');

// 8) Replace the heart-match block
replaceBlock(
    '            heartBuf.push(e.key);\n',
    '            if (heartBuf.length === heartSeq.length &&\n                heartBuf.every((k, i) => k === heartSeq[i])) {\n                heartBuf = [];\n',
    `            if (heartMatcher.push(e.key)) {
`,
    'heart-match push/check block'
);

// 9) Replace detectGamepadNow + gpBtn bodies with module calls
replaceBlock(
    '    function detectGamepadNow() {\n        try {\n            const pads = navigator.getGamepads',
    '    function gpBtn(btn) {\n        // btn: \'A\' (confirm), \'B\' (cancel/back), \'X\' (square), \'Y\' (triangle)\n        if (isPSGamepad) {\n            if (btn === \'A\') return \'✕\';\n            if (btn === \'B\') return \'◯\';\n            if (btn === \'X\') return \'☐\';\n            if (btn === \'Y\') return \'△\';\n        }\n        if (btn === \'A\') return \'Ⓐ\';\n        if (btn === \'B\') return \'Ⓑ\';\n        if (btn === \'X\') return \'Ⓧ\';\n        if (btn === \'Y\') return \'Ⓨ\';\n        return btn;\n    }\n',
    `    function detectGamepadNow() {
        try {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            const r = DAIDAI.detectConnectedGamepad(pads);
            if (r.isPS) isPSGamepad = true;
            return r.connected;
        } catch(e) { return false; }
    }
    function gpBtn(btn) { return DAIDAI.glyphForButton(btn, isPSGamepad); }
`,
    'detectGamepadNow + gpBtn bodies'
);

if (hadCRLF) src = src.replace(/\n/g, '\r\n');
fs.writeFileSync(FILE, src);
console.log('done. new size:', src.length, 'bytes,', src.split('\n').length, 'lines');
