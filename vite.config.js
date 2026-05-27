import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

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
                // Auto-register service worker via the script tag the plugin
                // injects into index.html (which viteSingleFile inlines).
                registerType: 'autoUpdate',
                // Inline the tiny registration snippet directly into index.html
                // so we don't ship a separate registerSW.js file alongside the
                // singlefile build. The service worker itself (sw.js) still
                // needs to be a separately-served file by spec.
                injectRegister: 'inline',
                // Pinned filenames keep the gh-pages / itch.io / PR-preview
                // deployments cacheable behind their own paths.
                filename: 'sw.js',
                manifestFilename: 'manifest.webmanifest',
                // Note: do NOT use `includeAssets` for files already in
                // public/ — Vite copies them to dist automatically and
                // `workbox.globPatterns` below picks them up with proper
                // content-hash revisions. Adding them via includeAssets
                // produces duplicate (revision:null) precache entries.
                manifest: {
                    name: '呆呆虫之豆豆潭',
                    short_name: 'DaiDai',
                    description:
                        'A nostalgic 3D Three.js remake of the classic 1999 game "DaiDai Worm" (呆呆虫之豆豆潭).',
                    lang: 'zh-CN',
                    start_url: './',
                    scope: './',
                    display: 'fullscreen',
                    display_override: ['fullscreen', 'standalone', 'minimal-ui'],
                    orientation: 'any',
                    background_color: '#02101c',
                    theme_color: '#02101c',
                    categories: ['games', 'entertainment'],
                    icons: [
                        // Browsers downscale 512px for the 192 slot — adequate for
                        // PWA installability checks without bundling a second PNG.
                        { src: 'logo-512.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                        { src: 'logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                        { src: 'logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                    ],
                },
                workbox: {
                    // The whole game is inlined into index.html by
                    // vite-plugin-singlefile, so the precache list is small:
                    // the single HTML shell + the favicons listed above.
                    globPatterns: ['**/*.{html,ico,png,webmanifest}'],
                    // index.html for any navigation request -> offline-ready.
                    navigateFallback: 'index.html',
                    // The inlined HTML can exceed Workbox's default 2 MiB cap;
                    // bump generously so future asset additions don't silently
                    // drop the main entry from the precache.
                    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
                    cleanupOutdatedCaches: true,
                },
            }),
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
