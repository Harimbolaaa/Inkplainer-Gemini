const { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'inkplainer-syntax-'));
function check(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `Syntax check failed: ${file}`);
}
try {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [i, match] of inline.entries()) {
    const file = join(temp, `inline-${i}.js`);
    writeFileSync(file, match[1]);
    check(file);
  }
  const localScripts = ['animations.js', 'studio-core.js', 'stickman-core.js', 'stickman-production-core.js', 'stickman-studio.js', 'stickman-templates.js', 'stickman-production-ui.js', 'stickman-workspace.js', 'studio-assets.js', 'studio-effects.js', 'studio.js',
    'svg-motion-core.js', 'svg-motion.js', 'svg-workshop.js', 'svg-motion-gif-worker.js',
    'vendor/mp4-muxer.mjs', 'vendor/gsap.min.js', 'vendor/anime.min.js', 'vendor/svg.min.js', 'vendor/purify.min.js', 'vendor/gifenc.mjs'];
  for (const file of localScripts) check(join(root, file));
  const css = readFileSync(join(root, 'vendor/fonts.css'), 'utf8');
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
    if (/^https?:/.test(match[1])) throw new Error('Font stylesheet contains a remote URL');
    if (!existsSync(resolve(root, 'vendor', match[1]))) throw new Error(`Missing bundled font: ${match[1]}`);
  }
  if (/\bimport\(['"]https?:/.test(html) || /<link[^>]+(?:href|rel)=["']https?:/.test(html)) {
    throw new Error('The editor contains a remote runtime dependency');
  }
  console.log(`Syntax OK: ${inline.length} inline scripts, ${localScripts.length} local scripts. Bundled font paths OK; no remote runtime dependencies.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
