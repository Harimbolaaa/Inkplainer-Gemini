const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../stickman-core.js');

test('creates independent versioned characters', () => {
  const a = core.createCharacter({ name: 'A' });
  const b = core.createCharacter({ name: 'B' });
  assert.notEqual(a.id, b.id);
  a.pose.joints.root.x += 20;
  assert.notEqual(a.pose.joints.root.x, b.pose.joints.root.x);
  assert.equal(a.version, 1);
});

test('two segment IK clamps unreachable targets and keeps finite joints', () => {
  const c = core.createCharacter();
  core.moveJoint(c, 'leftWrist', { x: 10000, y: 10000 }, { solveIK: true });
  const j = c.pose.joints;
  assert.ok(Number.isFinite(j.leftElbow.x) && Number.isFinite(j.leftWrist.y));
  assert.ok(Math.hypot(j.leftWrist.x - j.leftShoulder.x, j.leftWrist.y - j.leftShoulder.y) <= 130);
});

test('poses round trip and mirror swaps bilateral joints', () => {
  const c = core.createCharacter();
  const pose = core.capturePose(c);
  pose.joints.leftWrist.x -= 100;
  core.applyPose(c, pose);
  const mirrored = core.mirrorPose(pose);
  const axis = (pose.joints.leftWrist.x + pose.joints.rightWrist.x) / 2;
  assert.equal(mirrored.joints.leftWrist.x, axis * 2 - pose.joints.rightWrist.x);
  assert.equal(core.capturePose(c).joints.leftWrist.x, pose.joints.leftWrist.x);
});

test('procedural motion is deterministic and finite', () => {
  const c = core.createCharacter();
  const a = core.evaluateMotion(c, .5, { name: 'run', duration: 2, loop: true });
  const b = core.evaluateMotion(c, .5, { name: 'run', duration: 2, loop: true });
  assert.deepEqual(a.pose, b.pose);
  for (const p of Object.values(a.pose.joints)) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('normalizes legacy characters with independent rig metadata', () => {
  const legacy = core.createCharacter({ name: 'Legacy' });
  delete legacy.expression;
  delete legacy.rig.pins;
  const normalized = core.normalizeCharacter(legacy);
  assert.equal(normalized.schemaVersion, 2);
  assert.equal(normalized.expression.name, 'neutral');
  assert.deepEqual(normalized.rig.pins, {});
  assert.ok(normalized.rig.bones.every(bone => bone.id && bone.length > 0));
});

test('pins keep a foot target while the root moves', () => {
  const character = core.createCharacter();
  const target = core.clone(character.pose.joints.leftAnkle);
  assert.equal(core.setPin(character, 'leftAnkle', true, target), true);
  core.moveJoint(character, 'root', { x: character.pose.joints.root.x + 80, y: character.pose.joints.root.y - 20 });
  assert.ok(Math.hypot(character.pose.joints.leftAnkle.x - target.x, character.pose.joints.leftAnkle.y - target.y) < .01);
  assert.ok(Number.isFinite(character.pose.joints.leftKnee.x));
});

test('rig edits, mirroring, validation, and accessories remain isolated', () => {
  const a = core.createCharacter({ name: 'A' });
  const b = core.createCharacter({ name: 'B' });
  assert.equal(core.setBoneLength(a, 'leftShoulder-leftElbow', 70), true);
  assert.equal(core.addJoint(a, 'badge', 'neck', { x: 480, y: 180 }), true);
  a.accessories.push({ id: 'badge', type: 'circle', joint: 'badge', radius: 8 });
  core.mirrorCharacter(a);
  assert.equal(core.validateRig(a).valid, true);
  assert.equal(b.pose.joints.leftElbow.x, core.createCharacter({ name: 'B2' }).pose.joints.leftElbow.x);
  assert.ok(core.removeJoint(a, 'badge'));
});
