import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SHA_RE = /^[0-9a-f]{40}$/i;

function gitSha() {
    // Prefer an explicit build SHA from CI (e.g. the PR head SHA passed by
    // the workflow), so the banner matches what users see in the PR UI even
    // when CI checks out a synthetic merge commit.
    // Validate strictly: must be a 40-character hex string to avoid bundle
    // breakage or code injection from an unexpected env-var value.
    const fromEnv = (process.env.DAIDAI_BUILD_SHA || '').trim();
    if (SHA_RE.test(fromEnv)) return fromEnv.slice(0, 12);
    try {
        return (
            execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
                .toString()
                .trim() || 'dev'
        );
    } catch {
        return 'dev';
    }
}

// Replaces every occurrence of the literal `__DAIDAI_BUILD_SHA__` in the
// transformed source with the current commit SHA (matches the behavior of
// the previous scripts/build.mjs).
function injectBuildSha() {
    const sha = gitSha();
    return {
        name: 'daidai-inject-build-sha',
        enforce: 'pre',
        transform(code, id) {
            if (!id.includes('/src/') && !id.includes('\\src\\')) return null;
            if (!code.includes('__DAIDAI_BUILD_SHA__')) return null;
            return { code: code.split('__DAIDAI_BUILD_SHA__').join(sha), map: null };
        },
    };
}

// Base manifest properties shared across every locale variant. Per-locale
// overrides (name / short_name / description / lang) come from
// src/i18n/pwa-strings.json. We emit:
//   - dist/manifest.<code>.webmanifest      (one per supported locale)
//   - dist/manifest.webmanifest              (en-us copy, default fallback)
// An inline script in index.html picks the right one at runtime and
// switches `<link rel="manifest">` href accordingly (see public/ logic
// duplicated below for parity with src/i18n/index.ts pickLang).
// Canonical PWA identity for production main-branch deploys. Used as the
// manifest `id` only when we're shipping the real site — PR previews live
// under the same gh-pages origin and would otherwise collide with the
// installed production app (PWA `id` is origin-scoped).
const CANONICAL_ID = 'https://tg123.github.io/daidai/';

const MANIFEST_BASE = {
    start_url: './',
    scope: './',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#02101c',
    theme_color: '#02101c',
    categories: ['games', 'entertainment'],
    icons: [
        // Real PNGs at each declared size — Microsoft Store / PWABuilder
        // reject manifests where the file dimensions don't match the
        // declared `sizes` attribute. logo-{96,144,192,512}.png are all
        // generated from the 512px master in public/.
        { src: 'logo-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
        { src: 'logo-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
        { src: 'logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Store listing previews (Microsoft Store / Chrome install dialog
    // both honor these). Wide for desktop, narrow for mobile.
    screenshots: [
        {
            src: 'screenshots/desktop-1280x800.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'DaiDai Worm — idle screen on desktop',
        },
        {
            src: 'screenshots/mobile-720x1280.png',
            sizes: '720x1280',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'DaiDai Worm — idle screen on mobile',
        },
    ],
};

function loadPwaStrings() {
    const raw = readFileSync(resolve(__dirname, 'src/i18n/pwa-strings.json'), 'utf8');
    const parsed = JSON.parse(raw);
    // Strip the JSON-doc placeholder key so it doesn't leak into output.
    const out = {};
    for (const k of Object.keys(parsed)) {
        if (k.startsWith('$')) continue;
        out[k] = parsed[k];
    }
    return out;
}

function buildLocaleManifest(code, strings, { canonicalId } = {}) {
    const manifest = {
        ...MANIFEST_BASE,
        name: strings.name,
        short_name: strings.short_name,
        description: strings.description,
        lang: code,
    };
    // Only stamp the canonical `id` on real production builds — PR
    // previews share the gh-pages origin and would otherwise hijack the
    // installed production PWA's identity.
    if (canonicalId) manifest.id = CANONICAL_ID;
    return manifest;
}

// Custom plugin: emits one manifest per locale alongside the default
// one (in addition to whatever VitePWA writes).
function pwaLocaleManifests({ canonicalId } = {}) {
    return {
        name: 'daidai-pwa-locale-manifests',
        apply: 'build',
        generateBundle() {
            const strings = loadPwaStrings();
            for (const code of Object.keys(strings)) {
                this.emitFile({
                    type: 'asset',
                    fileName: `manifest.${code}.webmanifest`,
                    source: JSON.stringify(buildLocaleManifest(code, strings[code], { canonicalId })),
                });
            }
            // Default manifest at the canonical filename — used as a
            // fallback for tools that fetch manifest.webmanifest directly
            // (e.g. PWA Builder, manifest validators).
            this.emitFile({
                type: 'asset',
                fileName: 'manifest.webmanifest',
                source: JSON.stringify(buildLocaleManifest('en-us', strings['en-us'], { canonicalId })),
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    // Compile-time gate for the 1-6 keyboard cheat backdoor (and its
    // announce-debug-help console banner). Enabled in `vite dev` and any
    // build that opts in via `DAIDAI_INCLUDE_CHEATS=1` (PR previews); off in
    // production main-branch deploys so the cheat code is tree-shaken out.
    const includeCheats = mode === 'development' || process.env.DAIDAI_INCLUDE_CHEATS === '1';
    return {
        plugins: [
            injectBuildSha(),
            viteSingleFile(),
            VitePWA({
                // Auto-register service worker via the inline script tag the
                // plugin injects into index.html (which viteSingleFile inlines).
                registerType: 'autoUpdate',
                injectRegister: 'inline',
                filename: 'sw.js',
                manifestFilename: 'manifest.webmanifest',
                // Disable VitePWA's manifest emission + <link> injection.
                // Our pwaLocaleManifests() plugin below emits 13 per-locale
                // manifests plus a default `manifest.webmanifest` (= en-us),
                // and index.html ships a static <link id="daidai-manifest">
                // whose href is swapped by an inline script based on locale.
                manifest: false,
                workbox: {
                    // The whole game is inlined into index.html by
                    // vite-plugin-singlefile, so the precache list is short:
                    // index.html, favicons, locale manifests, and the small
                    // audio clips boot needs. `music.ogg` (~460 KiB) is
                    // intentionally excluded — it's the looping BGM and
                    // streams happily over network once the SW is alive;
                    // we don't want to bloat the install footprint by half
                    // a megabyte. `silent.mp3`/`silent.mp4` are tiny iOS
                    // audio-unlock helpers and stay precached.
                    globPatterns: ['**/*.{html,ico,png,webmanifest,ogg,mp3,mp4}'],
                    globIgnores: ['**/music.ogg'],
                    navigateFallback: 'index.html',
                    // Don't hijack standalone HTML pages (privacy policy,
                    // future about/credits pages, etc.) — they need to be
                    // served as their own documents, not fall back to the
                    // game shell. Without this denylist, Workbox treats
                    // every navigation as the SPA entry and serves
                    // index.html, which breaks the Microsoft Store privacy
                    // policy URL.
                    navigateFallbackDenylist: [/\/privacy\.html$/i],
                    // The inlined HTML can exceed Workbox's default 2 MiB cap;
                    // bump generously so future asset additions don't silently
                    // drop the main entry from the precache.
                    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
                    cleanupOutdatedCaches: true,
                    // Runtime cache for music.ogg + any other audio that
                    // slipped past precache — first play hits network, then
                    // subsequent plays are served offline-friendly from cache.
                    runtimeCaching: [
                        {
                            urlPattern: /\.(?:ogg|mp3|mp4)$/i,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'daidai-audio',
                                expiration: {
                                    maxEntries: 32,
                                    maxAgeSeconds: 60 * 60 * 24 * 30,
                                },
                                rangeRequests: true,
                            },
                        },
                    ],
                },
            }),
            pwaLocaleManifests({ canonicalId: !includeCheats }),
        ],
        define: {
            __INCLUDE_CHEATS__: JSON.stringify(includeCheats),
        },
        // Use relative asset URLs so the site works under any subpath
        // (GitHub Pages project page, PR previews under /pr-preview/..., etc.)
        base: './',
        build: {
            target: 'es2020',
            outDir: 'dist',
            emptyOutDir: true,
            assetsInlineLimit: 100000000, // inline everything
            cssCodeSplit: false,
            rollupOptions: {
                output: { inlineDynamicImports: true },
            },
        },
        server: {
            port: 8080,
            strictPort: true,
            host: '127.0.0.1',
            watch: {
                // src-tauri/target is rewritten constantly by cargo during `tauri dev`.
                // Watching it makes Vite throw EBUSY on the Rust output DLL.
                ignored: ['**/src-tauri/**'],
            },
        },
        preview: { port: 8080, strictPort: true, host: '127.0.0.1' },
    };
});
