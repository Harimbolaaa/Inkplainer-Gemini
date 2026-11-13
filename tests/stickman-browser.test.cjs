const test = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('./browser-utils.cjs');

test('stickman workspace creates, edits, animates, and serializes local characters', { timeout: 60000 }, async t => {
  const b = await browser();
  t.after(() => b.close());
  await b.call('Page.enable');
  await b.call('Runtime.enable');
  await b.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('wb_onboarding_done_v1','1');`,
  });
  await b.call('Page.navigate', { url: process.env.SITE_URL || 'http://127.0.0.1:3000/' });
  await b.waitFor(`window.StickmanStudio && window.StickmanCore && document.getElementById('stickman-launch')`, 20000);
  const result = await b.evaluate(`(() => {
    StickmanStudio.open();
    const dialog = document.getElementById('stickman-studio-dialog');
    const initial = state.stickmanStudio.characters.length;
    dialog.querySelector('[data-action="add"]').click();
    const added = state.stickmanStudio.characters.length;
    const active = state.stickmanStudio.characters.find(c => c.id === state.stickmanStudio.activeCharacterId);
    StickmanCore.moveJoint(active, 'rightWrist', {x: 760, y: 205}, {solveIK: true});
    dialog.querySelector('[data-action="pose"]').click();
    dialog.querySelector('[data-field="motion"]').value = 'walk';
    dialog.querySelector('[data-action="motion"]').click();
    const sampleA = StickmanCore.evaluateMotion(active, .4, active.motion);
    const sampleB = StickmanCore.evaluateMotion(active, .4, active.motion);
    const snapshot = TimelineStudio.serializeProjectState(false);
    return {
      open: dialog.open,
      initial,
      added,
      poses: state.stickmanStudio.poses.length,
      deterministic: JSON.stringify(sampleA.pose) === JSON.stringify(sampleB.pose),
      persisted: snapshot.stickmanStudio.characters.length === added,
      ikFinite: Number.isFinite(active.pose.joints.rightElbow.x) && Number.isFinite(active.pose.joints.rightWrist.y),
    };
  })()`);
  assert.deepEqual(result, { open: true, initial: 2, added: 3, poses: 1, deterministic: true, persisted: true, ikFinite: true });
});
