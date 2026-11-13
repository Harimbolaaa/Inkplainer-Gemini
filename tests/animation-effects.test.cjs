const test = require('node:test');
const assert = require('node:assert/strict');
const { gsap } = require('../vendor/gsap.min.js');
const { AnimationEffects, EffectManager, AnimationEngine } = require('../animations.js');

const effects = Object.entries(AnimationEffects).flatMap(([category, entries]) =>
  Object.entries(entries).map(([key, effect]) => ({ category, key, effect })));
const target = text => ({
  x: 120, y: 80, width: 180, height: 100, scaleX: 1.3, scaleY: .8,
  rotation: 17, skewX: 0, skewY: 0, opacity: .75, text: text ?? 'Motion Studio',
});
const numericState = state => Object.entries(state).filter(([key]) => key !== '_gsap');
const near = (actual, expected, tolerance = 1e-5) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test.afterEach(() => {
  EffectManager.stopAll();
  EffectManager.configure({ canvas: null, beforeApply: null });
  gsap.ticker.sleep();
});

test('five exportable categories contain exactly the 50 requested real GSAP effects', () => {
  assert.deepEqual(Object.keys(AnimationEffects), ['In', 'Out', 'Text', 'Idle', 'Emphasis']);
  for (const entries of Object.values(AnimationEffects)) assert.equal(Object.keys(entries).length, 10);
  assert.equal(effects.length, 50);
  assert.equal(new Set(effects.map(e => e.effect)).size, 50);
  assert.equal(EffectManager.catalog.length, 50);
  assert.equal(typeof AnimationEngine.setupContour, 'function');
  assert.equal(typeof AnimationEngine.setupHandEraser, 'function');
  assert.equal(typeof AnimationEngine._tickAllSlots, 'function');
});

test('all 50 functions return seekable GSAP timelines with the requested duration', () => {
  for (const { effect, key } of effects) for (const text of ['Motion Studio', 'A', '']) {
    const object = target(text), before = { ...object };
    const timeline = effect(object, .8, { paused: true, repeat: 0, seed: 9 });
    assert.ok(timeline instanceof gsap.core.Timeline, key);
    assert.equal(timeline.paused(), true);
    near(timeline.duration(), .8);
    for (const progress of [0, .1, .3, .7, 1, .4, 0]) {
      timeline.progress(progress, false);
      for (const [property, value] of numericState(timeline.data.state)) {
        assert.ok(Number.isFinite(value), `${key}.${property}: ${value}`);
      }
      for (const property of ['x', 'y', 'scaleX', 'scaleY', 'opacity', 'rotation', 'skewX', 'skewY']) {
        assert.ok(Number.isFinite(object[property]), `${key}.${property}`);
      }
    }
    EffectManager.stop(object);
    assert.deepEqual(object, before, key);
  }
});

test('all requested display names, camel-case IDs and categorized names resolve', () => {
  for (const entry of EffectManager.catalog) {
    for (const name of [entry.name, entry.key, `${entry.category}.${entry.key}`]) {
      const object = target();
      const timeline = EffectManager.apply(object, name, { duration: .25, paused: true, repeat: 0 });
      assert.equal(timeline.data.effectName, entry.name);
      assert.equal(EffectManager.get(object), timeline);
      assert.equal(EffectManager.has(object), true);
      EffectManager.stop(object);
    }
  }
});

test('GSAP onUpdate renders the associated Canvas and preserves user callbacks', () => {
  let renders = 0, updates = 0, completions = 0;
  const object = target();
  object.canvas = { renderAll() { renders++; } };
  const timeline = EffectManager.apply(object, 'Smooth Overshoot', .5, {
    paused: true,
    onUpdate(received) { assert.equal(received, object); updates++; },
    onComplete(received) { assert.equal(received, object); completions++; },
  });
  const initial = renders;
  timeline.progress(.4, false);
  assert.ok(renders > initial);
  timeline.progress(1, false);
  assert.equal(renders, updates);
  assert.equal(completions, 1);
  near(object.opacity, .75);
  near(object.scaleX, 1.3);
  near(object.y, 80);
});

test('idle effects loop by default, support finite repeat counts and reset without leaks', () => {
  for (const effect of Object.values(AnimationEffects.Idle)) {
    const object = target();
    const timeline = effect(object, 1, { paused: true });
    assert.equal(timeline.repeat(), -1);
    timeline.totalTime(1.4, false);
    assert.ok(numericState(timeline.data.state).every(([, n]) => Number.isFinite(n)));
    timeline.kill();
    assert.equal(EffectManager.has(object), false);
    near(object.x, 120);
    near(object.scaleX, 1.3);
    assert.equal(effect(object, 1, { paused: true, repeat: 2 }).repeat(), 2);
    EffectManager.stop(object);
  }
});

test('all out effects end hidden and all in effects return to their baseline pose', () => {
  for (const effect of Object.values(AnimationEffects.Out)) {
    const object = target();
    const timeline = effect(object, 1, { paused: true });
    timeline.progress(1, false);
    near(object.opacity, 0);
    EffectManager.stop(object);
    near(object.opacity, .75);
  }
  for (const effect of Object.values(AnimationEffects.In)) {
    const object = target();
    const timeline = effect(object, 1, { paused: true });
    timeline.progress(1, false);
    near(object.x, 120); near(object.y, 80);
    near(object.scaleX, 1.3); near(object.scaleY, .8);
    near(object.rotation, 17); near(object.opacity, .75);
  }
});

test('grapheme animation handles emoji sequences, combining marks and line breaks', () => {
  const object = target('A👩‍💻é\nB');
  const timeline = EffectManager.apply(object, 'Typewriter Pro', 1, { paused: true });
  assert.equal(timeline.data.glyphs.length, 4);
  timeline.progress(.5, false);
  near(timeline.data.state.textProgress, .5);
  timeline.progress(1, false);
  assert.equal(object.text, 'A👩‍💻é\nB');
});

test('stopAll restores completed effects as well as active loops and replacement kills prior work', () => {
  const a = target(), b = target(), c = target();
  const first = EffectManager.apply(a, 'Fly Away', 1, { paused: true });
  first.progress(1, false);
  EffectManager.apply(b, 'Liquid Float', 1, { paused: true }).totalTime(.4, false);
  const previous = EffectManager.apply(c, 'Glow Pulse', 1, { paused: true }).totalTime(.4, false);
  const replacement = EffectManager.apply(c, 'Breathing Scale', 1, { paused: true });
  assert.ok(EffectManager.get(c) === replacement);
  assert.ok(previous.parent === null);
  EffectManager.stopAll();
  assert.ok(first.parent === null);
  for (const object of [a, b, c]) {
    assert.equal(EffectManager.has(object), false);
    near(object.opacity, .75);
    near(object.x, 120);
    near(object.scaleX, 1.3);
  }
});

test('Fabric adapter uses set, preserves the center and restores render/cache hooks', () => {
  let renders = 0, sets = 0, coords = 0;
  const prototype = {
    _render() {},
    set(properties) { sets++; Object.assign(this, properties); },
    getCenterPoint() { return { x: 150, y: 120 }; },
    setPositionByOrigin(point, x, y) {
      assert.equal(x, 'center'); assert.equal(y, 'center');
      this.left = point.x; this.top = point.y;
    },
    setCoords() { coords++; },
  };
  const object = Object.assign(Object.create(prototype), {
    left: 150, top: 120, width: 100, height: 80, scaleX: 1, scaleY: 1,
    angle: 20, opacity: .9, objectCaching: true,
    canvas: { renderAll() { renders++; } },
  });
  const original = object._render;
  const timeline = EffectManager.apply(object, '3D Flip In', .7, { paused: true });
  assert.equal(object.objectCaching, false);
  assert.notEqual(object._render, original);
  timeline.progress(.5, false);
  assert.ok(sets && coords && renders);
  near(object.left, 150); near(object.top, 120);
  timeline.progress(1, false);
  EffectManager.stop(object);
  assert.equal(object.objectCaching, true);
  assert.equal(object._render, original);
  assert.equal(Object.hasOwn(object, '_render'), false);
  near(object.angle, 20); near(object.opacity, .9);
});

test('invalid requests fail explicitly without destroying a running animation', () => {
  const object = target();
  const existing = EffectManager.apply(object, 'Glow Pulse', 1, { paused: true });
  assert.throws(() => EffectManager.apply(object, 'not-an-effect'), RangeError);
  assert.throws(() => AnimationEffects.In.elasticPop(object, NaN), RangeError);
  assert.throws(() => AnimationEffects.In.elasticPop(null, 1), TypeError);
  assert.equal(EffectManager.get(object), existing);
  EffectManager.configure({ beforeApply: () => false });
  assert.throws(() => EffectManager.apply(object, 'Elastic Pop'), /unavailable/);
  assert.equal(EffectManager.get(object), existing);
});

test('project sampling honors delay, repeats and yoyo without mutating the editable target', () => {
  const object = { img: {}, x: 120, y: 80, w: 100, h: 80, opacity: .75 };
  const before = { ...object }, stack = [];
  let translations, opacity;
  const c = {
    globalAlpha: .65, filter: 'none',
    save() { stack.push(this.globalAlpha); },
    restore() { this.globalAlpha = stack.pop(); },
    translate(x, y) { translations.push([x, y]); },
    rotate() {}, transform() {}, scale() {},
  };
  const settings = {
    effect: 'smoothOvershoot', duration: 1, delay: .2, repeat: 1,
    repeatDelay: 0, yoyo: true, options: { distance: 100, ease: 'none' },
  };
  const attachedTimelines = gsap.globalTimeline.getChildren(true, false, true).length;
  const sample = time => {
    translations = [];
    EffectManager.renderAt(c, object, settings, time, ctx => { opacity = ctx.globalAlpha; }, 100, 80);
    assert.deepEqual(object, before);
    assert.equal(EffectManager.has(object), false);
    assert.equal(gsap.globalTimeline.getChildren(true, false, true).length, attachedTimelines, 'project samples do not accumulate on the live ticker');
    assert.equal(c.globalAlpha, .65);
    return { x: translations[0][0], y: translations[0][1], opacity };
  };
  near(sample(.1).opacity, 0);
  near(sample(.45).y, 115);
  near(sample(.45).opacity, .65 * .25);
  near(sample(1.45).y, 65);
  const first = sample(.45);
  sample(1.8);
  assert.deepEqual(sample(.45), first);
  EffectManager.stopAll();
  assert.deepEqual(sample(.45), first, 'samples rebuild after global cleanup');
  settings.options.distance = 200;
  near(sample(.45).y, 190, 1e-4);
});

test('unknown saved effects render the unmodified object instead of breaking the scene', () => {
  let draws = 0;
  EffectManager.renderAt({}, { img: {}, w: 100 }, { effect: 'unknown' }, .4, () => { draws++; }, 100, 80);
  assert.equal(draws, 1);
});

test('stopping a native preview never discards edits made to the underlying layer', () => {
  const object = { img: {}, x: 120, y: 80, w: 100, h: 80, opacity: .75 };
  EffectManager.apply(object, 'Liquid Float', 1, { paused: true }).progress(.3, false);
  object.x = 260;
  object.y = 135;
  object.opacity = .4;
  EffectManager.stop(object);
  assert.equal(object.x, 260);
  assert.equal(object.y, 135);
  assert.equal(object.opacity, .4);
  assert.equal(EffectManager.has(object), false);
});
