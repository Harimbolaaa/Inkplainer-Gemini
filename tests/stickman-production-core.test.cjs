const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../stickman-production-core.js');

test('normalizes production tracks without mutating input', () => {
  const source = { duration: 4, tracks: [{ id: 'a', name: 'Lead', inPoint: -1, outPoint: 9 }] };
  const result = core.normalizeProduction(source);
  assert.equal(result.version, 2);
  assert.equal(result.tracks[0].inPoint, 0);
  assert.equal(result.tracks[0].outPoint, 4);
  assert.equal(source.tracks[0].inPoint, -1);
});

test('keyframe interpolation and camera evaluation are deterministic', () => {
  const camera = { x: 0, y: 0, zoom: 1, rotation: 0, keyframes: [{ time: 0, x: 0, zoom: 1 }, { time: 2, x: 200, zoom: 2 }] };
  assert.deepEqual(core.evaluateCamera(camera, 1), { x: 100, y: 0, zoom: 1.5, rotation: 0 });
  assert.equal(core.interpolateKeyframes([{ time: 0, value: 0 }, { time: 1, value: 10 }], .5, {}).value, 5);
});

test('snapping, track ordering, duplication and seeded effects work', () => {
  const production = core.normalizeProduction({ duration: 5, markers: [{ time: 2 }] });
  production.tracks = [{ id: 'a', name: 'A', order: 0 }, { id: 'b', name: 'B', order: 1 }];
  assert.equal(core.snapTime(2.04, production), 2);
  assert.equal(core.moveTrack(production, 'b', 'up'), true);
  assert.equal(production.tracks[0].id, 'b');
  assert.notEqual(core.duplicateTrack(production, 'b').id, 'b');
  assert.deepEqual(core.effectSamples({ seed: 7, duration: 1 }, .4), core.effectSamples({ seed: 7, duration: 1 }, .4));
});

test('integer frame timing, easing, holds, reverse and retime are deterministic', () => {
  const production = core.normalizeProduction({ duration: 4, fps: 24 });
  const track = production.tracks[0] = { id: 'hero', type: 'character', fps: 24, keyframes: [] };
  core.addKeyframe(track, { frame: 0, pose: { value: 0 }, easing: 'linear' });
  core.addKeyframe(track, { frame: 24, pose: { value: 10 }, easing: 'ease-in-out' });
  assert.equal(track.keyframes[1].time, 1);
  assert.equal(core.framesFromSeconds(1.01, 24), 24);
  assert.equal(core.secondsFromFrames(48, 24), 2);
  assert.ok(core.ease(.5, 'ease-in-out') === .5);
  core.reverseKeyframes(track, 48);
  assert.equal(track.keyframes[0].frame, 24);
  core.retimeKeyframes(track, 2);
  assert.equal(track.keyframes[0].frame, 48);
});

test('track paths sample cubic trajectories and remain independent', () => {
  const path = { points: [{ x: 0, y: 0, cp2: { x: 0, y: 100 } }, { x: 100, y: 100, cp1: { x: 100, y: 0 } }] };
  const midpoint = core.evaluatePath(path, 15, 0, 30);
  assert.ok(midpoint.x > 0 && midpoint.x < 100);
  assert.ok(midpoint.y > 0 && midpoint.y < 100);
});
