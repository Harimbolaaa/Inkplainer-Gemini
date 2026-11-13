/* Pure, deterministic stickman characters, rigs, IK, poses, and procedural motion. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const bones = [
    ['neck', 'head'], ['neck', 'leftShoulder'], ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'],
    ['neck', 'rightShoulder'], ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
    ['neck', 'leftHip'], ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
    ['neck', 'rightHip'], ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
  ].map(([parent, child]) => ({ parent, child }));
  const boneLength = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const jointNames = ['root', 'neck', 'head', 'leftShoulder', 'leftElbow', 'leftWrist', 'rightShoulder', 'rightElbow', 'rightWrist', 'leftHip', 'leftKnee', 'leftAnkle', 'rightHip', 'rightKnee', 'rightAnkle'];
  const terminalJoints = new Set(['head', 'leftWrist', 'rightWrist', 'leftAnkle', 'rightAnkle']);
  function defaultExpression(name = 'neutral') {
    const values = {
      neutral: { eye: 'dot', brow: 'flat', mouth: 'line' }, happy: { eye: 'dot', brow: 'soft', mouth: 'smile' },
      angry: { eye: 'narrow', brow: 'furrow', mouth: 'line' }, sad: { eye: 'dot', brow: 'sad', mouth: 'frown' },
      surprised: { eye: 'wide', brow: 'raised', mouth: 'o' }, scared: { eye: 'wide', brow: 'raised', mouth: 'wobble' },
      confused: { eye: 'dot', brow: 'offset', mouth: 'squiggle' }, determined: { eye: 'narrow', brow: 'flat', mouth: 'grit' },
    };
    return { name: values[name] ? name : 'neutral', ...(values[name] || values.neutral) };
  }
  function normalizeCharacter(value) {
    const character = clone(value || {});
    const fallback = createCharacter({ id: character.id, name: character.name, color: character.color, root: character.pose?.joints?.root || character.rig?.joints?.root || { x: 480, y: 290 } });
    const result = { ...fallback, ...character };
    result.version = VERSION; result.schemaVersion = 2; result.id = result.id || id('character');
    result.style = { ...fallback.style, ...(character.style || {}) };
    result.rig = { ...fallback.rig, ...(character.rig || {}) };
    result.rig.joints = { ...fallback.rig.joints, ...(character.rig?.joints || {}) };
    result.rig.bones = Array.isArray(character.rig?.bones) && character.rig.bones.length ? character.rig.bones : clone(bones);
    result.rig.constraints = { ...fallback.rig.constraints, ...(character.rig?.constraints || {}) };
    result.rig.jointLimits = { ...(character.rig?.jointLimits || {}) };
    result.rig.pins = { ...(character.rig?.pins || {}) };
    result.rig.stretch = character.rig?.stretch === true;
    result.pose = { ...(character.pose || {}), joints: { ...result.rig.joints, ...(character.pose?.joints || {}) } };
    result.restPose = character.restPose || capturePose(result);
    result.expression = { ...defaultExpression(), ...(character.expression || {}) };
    result.accessories = Array.isArray(character.accessories) ? character.accessories : [];
    result.drawingOrder = Array.isArray(character.drawingOrder) ? character.drawingOrder : ['back', 'bones', 'head', 'face', 'accessories', 'joints'];
    result.rig.bones = result.rig.bones.map((bone, index) => ({ id: bone.id || `bone-${index + 1}`, parent: bone.parent, child: bone.child, length: Number(bone.length) || boneLength(result.pose.joints[bone.parent], result.pose.joints[bone.child]) || 1, locked: bone.locked === true }));
    if (value && typeof value === 'object') { for (const key of Object.keys(value)) delete value[key]; Object.assign(value, result); return value; }
    return result;
  }
  function makeJoints(rootPoint, scale = 1) {
    const x = rootPoint.x, y = rootPoint.y;
    return {
      root: { x, y }, neck: { x, y: y - 105 * scale }, head: { x, y: y - 143 * scale },
      leftShoulder: { x: x - 34 * scale, y: y - 98 * scale }, leftElbow: { x: x - 62 * scale, y: y - 42 * scale }, leftWrist: { x: x - 78 * scale, y: y + 15 * scale },
      rightShoulder: { x: x + 34 * scale, y: y - 98 * scale }, rightElbow: { x: x + 62 * scale, y: y - 42 * scale }, rightWrist: { x: x + 78 * scale, y: y + 15 * scale },
      leftHip: { x: x - 25 * scale, y: y - 2 * scale }, leftKnee: { x: x - 38 * scale, y: y + 78 * scale }, leftAnkle: { x: x - 42 * scale, y: y + 157 * scale },
      rightHip: { x: x + 25 * scale, y: y - 2 * scale }, rightKnee: { x: x + 38 * scale, y: y + 78 * scale }, rightAnkle: { x: x + 42 * scale, y: y + 157 * scale },
    };
  }
  function createCharacter(options = {}) {
    const scale = Number(options.scale) || 1;
    const joints = makeJoints(options.root || { x: 480, y: 290 }, scale);
    return {
      version: VERSION, schemaVersion: 2, id: options.id || id('character'), name: options.name || 'Character',
      color: options.color || '#172033', scale, rotation: 0,
      style: { lineColor: options.color || '#172033', lineWidth: 5, headSize: 28, jointStyle: 'round', lineCap: 'round', lineJoin: 'round' },
      rig: { bones: clone(bones), joints: clone(joints), constraints: { enabled: true, minAngle: -2.9, maxAngle: 2.9 }, jointLimits: {}, pins: {}, stretch: false },
      pose: { joints }, restPose: { version: VERSION, joints: clone(joints), rotation: 0, scale }, expression: defaultExpression(), accessories: [], drawingOrder: ['back', 'bones', 'head', 'face', 'accessories', 'joints'], keyframes: [], motion: null,
    };
  }
  function jointsOf(character) {
    character.pose ||= { joints: clone(character.rig?.joints || {}) };
    character.pose.joints ||= clone(character.rig?.joints || {});
    return character.pose.joints;
  }
  function forwardKinematics(character) {
    const joints = jointsOf(character);
    character.rig ||= {};
    character.rig.joints = clone(joints);
    return character;
  }
  function solveIK(character, endName, target, options = {}) {
    normalizeCharacter(character);
    const joints = jointsOf(character);
    const chains = {
      leftWrist: ['leftShoulder', 'leftElbow', 'leftWrist'], rightWrist: ['rightShoulder', 'rightElbow', 'rightWrist'],
      leftAnkle: ['leftHip', 'leftKnee', 'leftAnkle'], rightAnkle: ['rightHip', 'rightKnee', 'rightAnkle'],
    };
    const chain = chains[endName];
    if (!chain || !joints[chain[0]]) return false;
    const [rootName, midName] = chain;
    const root = joints[rootName], currentMid = joints[midName];
    const lenA = boneLength(root, currentMid) || 1, lenB = boneLength(currentMid, joints[endName]) || 1;
    const dx = target.x - root.x, dy = target.y - root.y, distance = Math.hypot(dx, dy) || .001;
    const reach = clamp(distance, Math.abs(lenA - lenB) + .001, lenA + lenB - .001);
    const baseAngle = Math.atan2(dy, dx);
    let bend = Math.acos(clamp((lenA * lenA + reach * reach - lenB * lenB) / (2 * lenA * reach), -1, 1));
    const limit = character.rig?.jointLimits?.[midName];
    if (limit) bend = clamp(bend, Number(limit.minBend ?? 0), Number(limit.maxBend ?? Math.PI));
    const side = options.pole === 'right' || (options.pole === undefined && (rootName.startsWith('right'))) ? 1 : -1;
    const angle = baseAngle + side * bend;
    joints[midName] = { x: root.x + Math.cos(angle) * lenA, y: root.y + Math.sin(angle) * lenA };
    const pin = character.rig?.pins?.[endName];
    const destination = pin?.enabled && !options.ignorePins ? pin.position : target;
    const ddx = destination.x - root.x, ddy = destination.y - root.y, d = Math.hypot(ddx, ddy) || .001;
    const finalReach = character.rig?.stretch ? d : reach;
    joints[endName] = { x: root.x + ddx / d * finalReach, y: root.y + ddy / d * finalReach };
    if (!character.rig?.stretch) {
      const actual = boneLength(root, joints[endName]);
      if (actual > reach + .01) joints[endName] = { x: root.x + ddx / d * reach, y: root.y + ddy / d * reach };
    }
    return forwardKinematics(character);
  }
  function moveJoint(character, name, target, options = {}) {
    normalizeCharacter(character);
    const joints = jointsOf(character);
    if (name === 'root') {
      const pinned = Object.entries(character.rig?.pins || {}).filter(([, pin]) => pin?.enabled).map(([joint, pin]) => [joint, clone(pin.position || joints[joint])]);
      const dx = target.x - joints.root.x, dy = target.y - joints.root.y;
      Object.values(joints).forEach(p => { p.x += dx; p.y += dy; });
      for (const [joint, position] of pinned) {
        if (joints[joint]) { joints[joint] = position; solveIK(character, joint, position, { ignorePins: true }); }
      }
      return forwardKinematics(character);
    }
    if (options.solveIK !== false && ['leftWrist', 'rightWrist', 'leftAnkle', 'rightAnkle'].includes(name)) return solveIK(character, name, target, options);
    if (!joints[name] || character.rig?.pins?.[name]?.enabled && !options.ignorePins) return false;
    joints[name] = { x: target.x, y: target.y };
    return forwardKinematics(character);
  }
  function setBoneLength(character, boneId, length) {
    normalizeCharacter(character);
    const bone = character.rig.bones.find(item => item.id === boneId || `${item.parent}-${item.child}` === boneId);
    if (!bone || !Number.isFinite(Number(length)) || Number(length) <= 0) return false;
    bone.length = Number(length);
    const parent = character.pose.joints[bone.parent], child = character.pose.joints[bone.child];
    if (parent && child) { const angle = Math.atan2(child.y - parent.y, child.x - parent.x); child.x = parent.x + Math.cos(angle) * bone.length; child.y = parent.y + Math.sin(angle) * bone.length; }
    forwardKinematics(character); return true;
  }
  function setJointLimit(character, joint, min, max) {
    normalizeCharacter(character);
    if (!character.pose.joints[joint]) return false;
    character.rig.jointLimits[joint] = { minBend: Number(min), maxBend: Number(max) };
    return true;
  }
  function setPin(character, joint, enabled = true, position = null) {
    normalizeCharacter(character);
    if (!character.pose.joints[joint]) return false;
    character.rig.pins[joint] = { enabled: Boolean(enabled), position: position || clone(character.pose.joints[joint]) };
    return true;
  }
  function resetPose(character) { normalizeCharacter(character); return applyPose(character, character.restPose || capturePose(character)); }
  function mirrorCharacter(character) { normalizeCharacter(character); character.pose = mirrorPose(capturePose(character)); return forwardKinematics(character); }
  function addJoint(character, joint, parent = 'root', position = null) {
    normalizeCharacter(character);
    if (!joint || character.pose.joints[joint] || !character.pose.joints[parent]) return false;
    character.pose.joints[joint] = position ? clone(position) : clone(character.pose.joints[parent]);
    character.rig.joints[joint] = clone(character.pose.joints[joint]);
    character.rig.bones.push({ id: id('bone'), parent, child: joint, length: 1, locked: false });
    return true;
  }
  function removeJoint(character, joint) {
    normalizeCharacter(character);
    if (!character.pose.joints[joint] || joint === 'root' || joint === 'neck') return false;
    const incoming = character.rig.bones.find(bone => bone.child === joint);
    const outgoing = character.rig.bones.filter(bone => bone.parent === joint);
    if (incoming && outgoing.length <= 1) {
      character.rig.bones = character.rig.bones.filter(bone => bone !== incoming && !outgoing.includes(bone));
      if (outgoing[0]) character.rig.bones.push({ ...outgoing[0], id: id('bone'), parent: incoming.parent, length: boneLength(character.pose.joints[incoming.parent], character.pose.joints[outgoing[0].child]) });
    } else character.rig.bones = character.rig.bones.filter(bone => bone.parent !== joint && bone.child !== joint);
    delete character.pose.joints[joint]; delete character.rig.joints[joint]; delete character.rig.pins[joint]; delete character.rig.jointLimits[joint];
    return forwardKinematics(character);
  }
  function validateRig(character) {
    normalizeCharacter(character);
    const errors = [], joints = character.pose.joints, seen = new Set();
    if (!joints.root || !joints.neck) errors.push('Rig requires root and neck joints.');
    character.rig.bones.forEach(bone => {
      if (!joints[bone.parent] || !joints[bone.child]) errors.push(`Bone ${bone.id} references a missing joint.`);
      if (seen.has(bone.child) && bone.child !== 'root') errors.push(`Joint ${bone.child} has multiple parents.`);
      seen.add(bone.child);
      if (!(Number(bone.length) > 0)) errors.push(`Bone ${bone.id} has an invalid length.`);
    });
    return { valid: errors.length === 0, errors, joints: Object.keys(joints).length, bones: character.rig.bones.length };
  }
  function capturePose(character) { return { version: VERSION, joints: clone(jointsOf(character)), rotation: character.rotation || 0, scale: character.scale || 1 }; }
  function applyPose(character, pose) {
    if (!pose?.joints) return character;
    character.pose = clone(pose);
    character.pose.joints = clone(pose.joints);
    return forwardKinematics(character);
  }
  function mirrorPose(pose, axis = null) {
    const result = clone(pose || { joints: {} }), joints = result.joints || {};
    const values = Object.values(joints), xs = values.map(p => p.x);
    const mirrorAxis = axis ?? (xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0);
    for (const point of Object.values(joints)) point.x = mirrorAxis * 2 - point.x;
    for (const [left, right] of [['leftShoulder', 'rightShoulder'], ['leftElbow', 'rightElbow'], ['leftWrist', 'rightWrist'], ['leftHip', 'rightHip'], ['leftKnee', 'rightKnee'], ['leftAnkle', 'rightAnkle']]) {
      const temp = joints[left]; joints[left] = joints[right]; joints[right] = temp;
    }
    return result;
  }
  function ease(t, name = 'smooth') {
    t = clamp(t, 0, 1);
    if (name === 'linear') return t;
    if (name === 'spring') return 1 - Math.exp(-7 * t) * Math.cos(t * Math.PI * 4);
    return t * t * (3 - 2 * t);
  }
  function motionPose(character, name, time) {
    const pose = capturePose(character), joints = pose.joints, cycle = time * (name === 'run' ? 8 : name === 'walk' ? 4 : 2), s = Math.sin(cycle), c = Math.cos(cycle);
    const root = joints.root;
    if (name === 'idle') { Object.values(joints).forEach(p => { p.y += Math.sin(time * 2) * 2; }); }
    if (['walk', 'run'].includes(name)) {
      root.x += time * (name === 'run' ? 130 : 70) % 760;
      joints.leftKnee.y += Math.max(0, s) * 18; joints.rightKnee.y += Math.max(0, -s) * 18;
      joints.leftAnkle.x += s * 18; joints.rightAnkle.x -= s * 18; joints.leftWrist.x += -s * 12; joints.rightWrist.x += s * 12;
    }
    if (name === 'jump') { const lift = Math.sin(clamp(time / 1.2, 0, 1) * Math.PI) * 90; Object.values(joints).forEach(p => { p.y -= lift; }); }
    if (name === 'punch') { joints.rightWrist.x += ease(clamp(time * 2, 0, 1), 'spring') * 90; joints.rightWrist.y -= 35; }
    if (name === 'kick') { joints.rightAnkle.x += ease(clamp(time * 2, 0, 1), 'spring') * 90; joints.rightAnkle.y -= 35; }
    if (name === 'reaction') { joints.root.x += Math.sin(time * 10) * 5; Object.values(joints).forEach(p => { p.y += Math.abs(Math.sin(time * 5)) * 8; }); }
    if (name === 'fall') { Object.values(joints).forEach(p => { p.y += clamp(time, 0, 1) * 120; }); pose.rotation = clamp(time, 0, 1) * .9; }
    if (['sprint', 'run'].includes(name)) { root.x += time * 180 % 760; joints.leftWrist.x += -s * 18; joints.rightWrist.x += s * 18; }
    if (['land', 'impact'].includes(name)) { Object.values(joints).forEach(p => { p.y += Math.max(0, 1 - time * 3) * 22; }); pose.scale = 1 - Math.max(0, 1 - time * 3) * .12; }
    if (name === 'roll') { pose.rotation = Math.min(Math.PI * 2, time * 5); root.x += time * 100; }
    if (name === 'block') { joints.leftWrist.x += 32; joints.leftWrist.y -= 55; joints.rightWrist.x -= 32; joints.rightWrist.y -= 55; }
    if (name === 'dodge') { root.x += Math.sin(time * 5) * 70; root.y += Math.sin(time * 5) * 18; }
    if (name === 'fight') { joints.rightWrist.x += Math.max(0, Math.sin(time * 8)) * 80; joints.leftWrist.x -= Math.max(0, Math.sin(time * 8 + 1)) * 55; }
    if (name === 'dance') { root.y += Math.sin(time * 8) * 12; joints.leftWrist.y -= Math.abs(s) * 65; joints.rightWrist.y -= Math.abs(c) * 65; }
    if (name === 'wave') { joints.rightWrist.y -= 55; joints.rightWrist.x += Math.sin(time * 10) * 18; }
    if (name === 'point') { joints.rightWrist.x += 80; joints.rightWrist.y -= 25; }
    if (name === 'laugh') { root.y += Math.abs(Math.sin(time * 12)) * 8; }
    if (name === 'cry') { joints.leftWrist.y -= 35; joints.rightWrist.y -= 35; }
    if (name === 'death') { Object.values(joints).forEach(p => { p.y += clamp(time, 0, 1) * 150; }); pose.rotation = clamp(time, 0, 1) * 1.5; }
    if (name === 'surprise') { root.y -= Math.abs(Math.sin(time * 7)) * 10; }
    return pose;
  }
  function evaluateMotion(character, time, motion) {
    const name = typeof motion === 'string' ? motion : motion?.name;
    if (!name) return character;
    const duration = Math.max(.001, Number(motion?.duration) || 1), local = motion?.loop ? (time - (motion.start || 0)) % duration : time - (motion.start || 0);
    const result = clone(character); applyPose(result, motionPose(character, name, Math.max(0, local))); return result;
  }
  function evaluateCharacter(character, time) {
    if (character.motion) return evaluateMotion(character, time, character.motion);
    const result = clone(character);
    const keys = (character.keyframes || []).slice().sort((a, b) => a.time - b.time);
    if (!keys.length) return result;
    const before = keys.filter(k => k.time <= time).pop() || keys[0], after = keys.find(k => k.time >= time) || before;
    const u = after === before ? 0 : (time - before.time) / Math.max(.001, after.time - before.time), pose = clone(before.pose || capturePose(character));
    if (after.pose?.joints) for (const [name, p] of Object.entries(after.pose.joints)) { const a = before.pose?.joints?.[name] || p; pose.joints[name] = { x: a.x + (p.x - a.x) * ease(u), y: a.y + (p.y - a.y) * ease(u) }; }
    return applyPose(result, pose);
  }
  const api = { VERSION, bones, clone, clamp, createCharacter, normalizeCharacter, forwardKinematics, solveIK, moveJoint, setBoneLength, setJointLimit, setPin, resetPose, mirrorCharacter, addJoint, removeJoint, validateRig, defaultExpression, capturePose, applyPose, mirrorPose, evaluateMotion, evaluateCharacter, ease, motions: ['idle', 'walk', 'run', 'sprint', 'jump', 'land', 'fall', 'roll', 'punch', 'kick', 'block', 'dodge', 'fight', 'dance', 'wave', 'point', 'laugh', 'cry', 'death', 'surprise', 'reaction'], expressions: ['neutral', 'happy', 'angry', 'sad', 'surprised', 'scared', 'confused', 'determined'] };
  root.StickmanCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
