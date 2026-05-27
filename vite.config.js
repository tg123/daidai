import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
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
        plugins: [injectBuildSha(), viteSingleFile()],
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
