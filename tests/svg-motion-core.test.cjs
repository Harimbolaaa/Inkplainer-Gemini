const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join } = require('node:path');
const C = require('../svg-motion-core.js');
const near = (a, b) => assert.ok(Math.abs(a - b) < .00001, `${a} != ${b}`);

test('the local workshop contains 24 common shapes and 14 actual animation primitives', () => {
  assert.equal(C.shapes.length, 24);
  assert.equal(C.presets.length, 14);
  assert.equal(new Set(C.shapes.map(s => s.id)).size, 24);
  assert.equal(new Set(C.presets.map(p => p.id)).size, 14);
  for (const shape of C.shapes) {
    assert.ok(shape.name && shape.category);
    assert.ok(/^M/.test(shape.d));
    assert.ok(!/NaN|Infinity|https?:|<script/i.test(shape.d));
  }
  for (const id of ['circle', 'square', 'rectangle', 'rounded', 'ellipse', 'triangle', 'star', 'heart', 'arrow', 'line', 'arc', 'check', 'plus']) {
    assert.ok(C.shapes.some(s => s.id === id), id);
  }
});

test('normalization bounds source sizes, styles, timing, counts and imported values', () => {
  assert.equal(C.normalize({}), null);
  assert.equal(C.normalize({ ...C.create(), kind: 'unknown' }), null);
  assert.equal(C.normalize({ ...C.create(), kind: 'svg', svg: '' }), null);
  assert.equal(C.normalize({ ...C.create(), kind: 'svg', svg: 'x'.repeat(2 * 1024 * 1024 + 1) }), null);
  const normalized = C.normalize({
    ...C.create(), font: 'untrusted-font', strokeWidth: 500, scale: -5, stagger: 5, iterations: 900,
    fill: 'url(https://external.invalid)', background: 'javascript:alert(1)',
    steps: [{ id: '<bad>', preset: 'draw', duration: -8, hold: 500, amount: Infinity, easing: 'not-an-ease' }],
  });
  assert.equal(normalized.font, 'Geist');
  assert.equal(normalized.strokeWidth, 20);
  assert.equal(normalized.scale, .35);
  assert.equal(normalized.stagger, .5);
  assert.equal(normalized.iterations, 20);
  assert.equal(normalized.fill, '#6366f1');
  assert.equal(normalized.background, '#ffffff');
  assert.equal(normalized.steps[0].id, 'step-0');
  assert.equal(normalized.steps[0].duration, .15);
  assert.equal(normalized.steps[0].hold, 30);
  assert.equal(normalized.steps[0].amount, 1);
  assert.equal(normalized.steps[0].easing, 'easeInOutSine');
});

test('stagger, holds, yoyo and finite project cycles all contribute to exact duration', () => {
  const d = C.create();
  d.steps = [C.step('draw', { duration: 1, hold: .2 }), C.step('float', { duration: 2, hold: .3 })];
  d.mode = 'parts'; d.stagger = .1; d.yoyo = true; d.gap = .4; d.iterations = 5;
  const t = C.timing(d, 3);
  near(t.spread, .2);
  near(t.steps[0].end, 1.4);
  near(t.forward, 3.9);
  near(t.cycle, 8.2);
  near(t.total, 41);
  assert.equal(t.steps.length, 2);
  d.mode = 'all';
  near(C.timing(d, 100).forward, 3.5);
});

test('element timing remains independent and honors its per-element delay', () => {
  const d = C.create();
  d.mode = 'parts'; d.stagger = .2; d.gap = 0;
  d.steps = [C.step('draw', { duration: 1, hold: 0, easing: 'linear' })];
  near(C.stateAt(d, .3, 0, 3).trim, .3);
  near(C.stateAt(d, .3, 1, 3).trim, .1);
  near(C.stateAt(d, .3, 2, 3).trim, 0);
  d.mode = 'all';
  near(C.stateAt(d, .3, 2, 3).trim, .3);
});

test('all presets and easing curves produce deterministic finite frames at arbitrary times', () => {
  for (const preset of C.presets) for (const [easing] of C.easings) {
    const d = C.create();
    d.steps = [C.step(preset.id, { duration: 1.4, hold: .2, amount: 1.5, easing })];
    d.mode = 'parts'; d.stagger = .07; d.yoyo = true; d.iterations = 3;
    for (const time of [-1, 0, .01, .2, .6, 1.3, 1.9, 3, 12, 600]) {
      const first = C.stateAt(d, time, 2, 5);
      C.stateAt(d, time + 10, 2, 5);
      assert.deepEqual(C.stateAt(d, time, 2, 5), first);
      for (const [key, value] of Object.entries(first)) if (key !== 'step') assert.ok(Number.isFinite(value), `${preset.id} ${easing} ${key}`);
      assert.ok(first.opacity >= 0 && first.opacity <= 1);
      assert.ok(first.trim >= 0 && first.trim <= 1);
      assert.ok(first.scaleX >= 0 && first.scaleY >= 0);
    }
  }
});

test('finite repeats stop at the right pose and yoyo returns to the initial pose', () => {
  const d = C.create();
  d.loop = false; d.iterations = 3; d.gap = .1;
  d.steps = [C.step('draw', { duration: .8, hold: .1, easing: 'linear' })];
  near(C.stateAt(d, C.timing(d).total).trim, 1);
  near(C.stateAt(d, C.timing(d).total + 100).trim, 1);
  d.yoyo = true;
  near(C.stateAt(d, C.timing(d).total).trim, 0);
  near(C.stateAt(d, .4).trim, C.stateAt(d, 1.4).trim);
});

test('layout preserves aspect ratio and the shape scale is a genuine render parameter', () => {
  const d = C.create();
  const first = C.layout(d, 400, 200);
  near(first.scale, .88); near(first.x, 80); near(first.y, 168);
  d.scale = .5;
  const second = C.layout(d, 400, 200);
  near(second.scale, .44); near(second.x, 168); near(second.y, 212);
});

test('all shipped libraries match their locked hashes and include original licenses', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '../vendor/svg-workshop-dependencies.json'), 'utf8'));
  assert.equal(manifest.length, 4);
  for (const dependency of manifest) {
    assert.ok(dependency.version && dependency.license);
    assert.ok(dependency.source.startsWith('https://registry.npmjs.org/'));
    for (const [file, hash] of Object.entries(dependency.sha256)) {
      assert.equal(createHash('sha256').update(readFileSync(join(__dirname, '../vendor', file))).digest('hex'), hash, file);
    }
  }
});
