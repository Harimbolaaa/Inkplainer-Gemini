const test = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('./browser-utils.cjs');

test('production suite inserts templates and persists scene-local production data', { timeout: 60000 }, async t => {
  const b = await browser();
  t.after(() => b.close());
  await b.call('Page.enable');
  await b.call('Runtime.enable');
  await b.call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('wb_onboarding_done_v1','1');` });
  await b.call('Page.navigate', { url: process.env.SITE_URL || 'http://127.0.0.1:3000/' });
  await b.waitFor(`window.StickmanProduction && window.StickmanTemplates && window.StickmanTemplates.templates.length === 100 && window.TimelineStudio && state.scenes && state.scenes.length`, 20000);
  const result = await b.evaluate(`(() => {
    const scene = TimelineStudio.getActiveScene();
    StickmanProduction.addTemplate(StickmanTemplates.templates[17]);
    const p = scene.production;
    p.captions.push({id:'test-caption', text:'Test', start:0, end:2, x:640, y:650});
    const target = document.createElement('canvas'); target.width=1280; target.height=720;
    const rendered = StickmanProduction.renderAt(scene, .5, target.getContext('2d'));
    const snap = TimelineStudio.serializeProjectState(false);
    const restored = snap.scenes.find(item => item.id === scene.id);
    return {
      templates: StickmanTemplates.templates.length,
      tracks: p.tracks.length,
      effects: p.effects.length,
      captions: p.captions.length,
      rendered,
      persistedTracks: restored.production.tracks.length,
      cameraKeys: restored.production.camera.keyframes.length,
    };
  })()`);
  assert.deepEqual(result, { templates: 100, tracks: 2, effects: 1, captions: 2, rendered: true, persistedTracks: 2, cameraKeys: 2 });
});
