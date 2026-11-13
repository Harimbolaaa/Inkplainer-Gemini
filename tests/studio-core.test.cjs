const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../studio-core.js');
const StudioAssets = require('../studio-assets.js');
const { assets, templates } = StudioAssets;
const base = () => ({
  x: 100, y: 200, w: 240, h: 200, baseW: 240, baseH: 200,
  resizePct: 100, opacity: 1, keyframes: [],
});

test('the entire local catalog is bundled and uniquely identified', () => {
  assert.equal(assets.length, 2500);
  assert.equal(StudioAssets.categories.length, 50);
  assert.equal(StudioAssets.collections.length, 10);
  assert.equal(StudioAssets.styles.length, 9);
  assert.equal(new Set(assets.map(a => a.id)).size, assets.length);
  assert.equal(new Set(assets.map(a => JSON.stringify(a.vector.paths))).size, assets.length);
  assert.equal(templates.length, 12);
  assert.equal(core.presets.length, 12);
  for (const template of templates) {
    for (const id of template.items) assert.ok(assets.some(a => a.id === id));
  }
  const countsByCategory = new Map();
  for (const asset of assets) {
    countsByCategory.set(asset.category, (countsByCategory.get(asset.category) || 0) + 1);
    assert.ok(Array.isArray(asset.tags) && asset.tags.length >= 3);
    assert.ok(Array.isArray(asset.classes) && asset.classes.length >= 2);
    assert.ok(Array.isArray(asset.aliases) && asset.aliases.length >= 2);
    assert.ok(StudioAssets.styles.some(s => s.id === asset.style));
    assert.ok(asset.vector.paths.length);
    assert.ok(asset.vector.paths.every(p => p.d && !/https?:/.test(p.d)));
  }
  assert.equal(countsByCategory.size, 50);
  for (const [, count] of countsByCategory) assert.equal(count, 50);
});
test('the catalog architecture scales cleanly to 10,000+ indexed multi-style assets', () => {
  const extended = StudioAssets.getCatalog('10000');
  assert.equal(extended.length, 10000);
  assert.equal(new Set(extended.map(a => a.id)).size, 10000);
  assert.equal(new Set(extended.map(a => JSON.stringify(a.vector.paths))).size, 10000);
  const byStyle = StudioAssets.search({ style: 'duotone', scaleMode: '10000' });
  assert.ok(byStyle.length > 800);
  assert.ok(byStyle.every(a => a.style === 'duotone'));
  const byClassAndTag = StudioAssets.search({ className: 'ai', query: 'neural', scaleMode: '10000' });
  assert.ok(byClassAndTag.length >= 4);
  const scaled12k = StudioAssets.scaleCatalog(12000);
  assert.equal(scaled12k.length, 12000);
});
test('all five easing curves have exact endpoints and finite samples', () => {
  for (const name of ['linear', 'ease-in-out', 'spring', 'bounce', 'expo']) {
    assert.equal(core.ease(0, name), 0);
    assert.equal(core.ease(1, name), 1);
    for (let i = 0; i <= 100; i++) assert.ok(Number.isFinite(core.ease(i / 100, name)));
  }
  assert.ok(core.ease(.2, 'spring') > 1);
  assert.notEqual(core.ease(.25, 'linear'), core.ease(.25, 'expo'));
});
test('unanimated layer dimensions and zero opacity are retained', () => {
  const layer = base();
  layer.opacity = 0;
  const pose = core.evaluate(layer, 3);
  assert.equal(pose.x, 100);
  assert.equal(pose.w, 240);
  assert.equal(pose.opacity, 0);
  assert.equal(pose.trimPath, 100);
});
test('sparse channels interpolate independently across unrelated keys', () => {
  const layer = base();
  core.put(layer, 'x', 0, 0, 'linear');
  core.put(layer, 'x', 4, 400, 'linear');
  core.put(layer, 'opacity', 1, 0, 'linear');
  core.put(layer, 'opacity', 3, 1, 'linear');
  core.put(layer, 'rotation', 2, 90, 'linear');
  const pose = core.evaluate(layer, 2);
  assert.equal(pose.x, 200);
  assert.equal(pose.y, 200);
  assert.equal(pose.opacity, .5);
  assert.equal(pose.rotation, 90);
});
test('zero scale is supported and opacity/trim are clamped during overshoot', () => {
  const layer = base();
  for (const key of ['resizePct', 'opacity', 'trimPath']) {
    core.put(layer, key, 0, 0, 'spring');
    core.put(layer, key, 1, key === 'opacity' ? 1 : 100, 'spring');
  }
  assert.equal(core.evaluate(layer, 0).w, 0);
  assert.equal(core.evaluate(layer, 0).trimPath, 0);
  const spring = core.evaluate(layer, .2);
  assert.equal(spring.opacity, 1);
  assert.equal(spring.trimPath, 100);
  assert.ok(spring.w > 240);
});
test('per-channel outgoing easing does not alter sibling channels', () => {
  const layer = base();
  core.put(layer, 'x', 0, 0, 'expo');
  core.put(layer, 'x', 1, 100);
  core.put(layer, 'y', 0, 0, 'linear');
  core.put(layer, 'y', 1, 100);
  const pose = core.evaluate(layer, .25);
  assert.equal(pose.y, 25);
  assert.ok(pose.x < 5);
  assert.equal(layer.keyframes[0].easings.x, 'expo');
  assert.equal(layer.keyframes[0].easings.y, 'linear');
});
test('key updates preserve independent properties at the same timestamp', () => {
  const layer = base();
  core.put(layer, 'x', 1, 10);
  core.put(layer, 'opacity', 1, .5);
  core.put(layer, 'x', 1, 20);
  assert.equal(layer.keyframes.length, 1);
  assert.equal(layer.keyframes[0].x, 20);
  assert.equal(layer.keyframes[0].opacity, .5);
});
test('legacy combined keyframes migrate without losing their values', () => {
  const layer = base();
  layer.keyframes = [
    { id: 'legacy-a', time: 0, x: 0, y: 100, opacity: 0, resizePct: 50 },
    { id: 'legacy-b', time: 2, x: 200, y: 300, opacity: 1, resizePct: 100 },
  ];
  const pose = core.evaluate(layer, 1);
  assert.equal(pose.x, 100);
  assert.equal(pose.y, 200);
  assert.equal(pose.opacity, .5);
  assert.equal(pose.w, 180);
  assert.equal(pose.rotation, 0);
});
test('presets generate editable data and preserve unrelated channels', () => {
  const layer = base();
  core.put(layer, 'rotation', 0, 45);
  core.put(layer, 'rotation', 3, 90);
  core.put(layer, 'x', 6, 999);
  assert.equal(core.applyPreset(layer, 'slide', 1, 2), true);
  assert.equal(layer.keyframes.find(k => k.time === 0).rotation, 45);
  assert.equal(layer.keyframes.find(k => k.time === 3).rotation, 90);
  assert.equal(layer.keyframes.find(k => k.time === 6).x, 999);
  assert.ok(layer.keyframes.some(k => k.time === 1 && k.opacity === 0));
  assert.equal(core.applyPreset(layer, 'unknown', 0, 1), false);
});
test('all presets support interpolation at every generated pose', () => {
  for (const preset of core.presets) {
    const layer = base();
    core.applyPreset(layer, preset.id, 0, 2);
    assert.ok(layer.keyframes.length >= 2);
    for (let t = 0; t <= 2; t += .025) {
      const pose = core.evaluate(layer, t);
      for (const channel of core.channels) assert.ok(Number.isFinite(pose[channel.key]));
    }
  }
});
test('Bézier paths include dragged handles and close with a curved segment', () => {
  const nodes = [
    { x: 0, y: 0, inX: -10, inY: 0, outX: 10, outY: 20 },
    { x: 50, y: 50, inX: 25, inY: 40, outX: 75, outY: 60 },
    { x: 100, y: 0, inX: 90, inY: 20, outX: 110, outY: -20 },
  ];
  const open = core.penPath(nodes, false), closed = core.penPath(nodes, true);
  assert.match(open, /C10 20 25 40 50 50/);
  assert.ok(!open.endsWith('Z'));
  assert.ok(closed.endsWith('Z'));
  assert.match(closed, /C110 -20 -10 0 0 0Z$/);
  assert.equal(core.penPath([], false), '');
});
test('previous Make vector metadata migrates into local, editable SVG nodes', () => {
  const old = {
    bounds: { x: 100, y: 200, w: 300, h: 180 }, width: 6, stroke: '#123456', fill: '#abcdef', closed: true,
    points: [
      { x: 120, y: 220, inX: 110, inY: 210, outX: 130, outY: 230 },
      { x: 380, y: 350, inX: 340, inY: 320, outX: 390, outY: 360 },
    ],
  };
  const migrated = core.normalizeVector(old);
  assert.equal(migrated.width, 300);
  assert.equal(migrated.height, 180);
  assert.equal(migrated.strokeWidth, 6);
  assert.equal(migrated.paths[0].nodes[0].x, 20);
  assert.equal(migrated.paths[0].nodes[0].inY, 10);
  assert.equal(migrated.paths[0].closed, true);
  assert.deepEqual(core.normalizeVector(migrated), migrated);
  assert.equal(core.normalizeVector({ invalid: true }), undefined);
});
