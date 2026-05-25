// Build script: minify index.html (HTML + inline JS + inline CSS) into dist/
// and copy the runtime assets the game needs.
//
// Usage: `npm run build`
import { minify } from 'html-minifier-terser';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const RUNTIME_ASSETS = [
  'fav.ico',
  'apple-touch-icon.png',
  'logo-512.png',
  '.nojekyll',
  'audio',
];

async function ensureCleanDist() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
}

async function copyAsset(name) {
  const src = path.join(ROOT, name);
  const dst = path.join(DIST, name);
  let stat;
  try { stat = await fs.stat(src); } catch { return false; }
  if (stat.isDirectory()) {
    await fs.cp(src, dst, { recursive: true });
  } else {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  }
  return true;
}

async function buildHtml() {
  const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const minified = await minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    minifyCSS: true,
    minifyJS: {
      ecma: 2020,
      compress: { passes: 2, drop_console: false },
      mangle: true,
      format: { comments: false },
    },
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    decodeEntities: false,
    processConditionalComments: true,
    sortAttributes: true,
    sortClassName: true,
  });
  await fs.writeFile(path.join(DIST, 'index.html'), minified, 'utf8');
  return { srcBytes: Buffer.byteLength(html, 'utf8'), outBytes: Buffer.byteLength(minified, 'utf8') };
}

const fmt = (n) => (n / 1024).toFixed(1) + ' KB';

(async () => {
  const t0 = Date.now();
  await ensureCleanDist();
  const { srcBytes, outBytes } = await buildHtml();
  const copied = [];
  for (const a of RUNTIME_ASSETS) {
    if (await copyAsset(a)) copied.push(a);
  }
  const ms = Date.now() - t0;
  const pct = (100 * (1 - outBytes / srcBytes)).toFixed(1);
  console.log(`✓ built dist/index.html in ${ms} ms`);
  console.log(`  ${fmt(srcBytes)} → ${fmt(outBytes)}  (-${pct}%)`);
  console.log(`  copied: ${copied.join(', ')}`);
})().catch((err) => {
  console.error('build failed:', err);
  process.exit(1);
});
