import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';

function gitSha() {
  // Prefer an explicit build SHA from CI (e.g. the PR head SHA passed by
  // the workflow), so the banner matches what users see in the PR UI even
  // when CI checks out a synthetic merge commit.
  const fromEnv = (process.env.DAIDAI_BUILD_SHA || '').trim();
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || 'dev';
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

export default defineConfig({
  plugins: [injectBuildSha(), viteSingleFile()],
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
  server: { port: 8080, strictPort: true, host: '127.0.0.1' },
  preview: { port: 8080, strictPort: true, host: '127.0.0.1' },
});
