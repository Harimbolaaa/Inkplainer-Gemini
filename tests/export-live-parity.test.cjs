const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('index.html registers handCanvas ID and global reference', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes("handCanvas.id = 'hand-canvas';"), 'handCanvas ID must be set');
  assert.ok(html.includes('window.handCanvas = handCanvas;'), 'window.handCanvas must be exposed');
  assert.ok(html.includes('window.hctx = hctx;'), 'window.hctx must be exposed');
});

test('compositeLiveCanvasesToTarget merges main-canvas, outline-overlay, and handCanvas', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(
    html.includes('function _compositeLiveCanvasesToTarget(targetCtx, W, H)'),
    '_compositeLiveCanvasesToTarget function exists'
  );
  assert.ok(
    html.includes("document.getElementById('hand-canvas')"),
    'hCanvas lookup checks #hand-canvas element'
  );
  assert.ok(
    html.includes('targetCtx.drawImage(hCanvas,'),
    'targetCtx composites hCanvas so moving hand is visible in output'
  );
});

test('Sequential export uses live multi-scene playback for WebM, MP4, and GIF', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const bodyIdx = html.indexOf('function _exportSequentialProjectBody');
  assert.ok(bodyIdx > 0, '_exportSequentialProjectBody exists');
  const exportBody = html.slice(bodyIdx, html.indexOf('function init()', bodyIdx));

  // None of the active export paths should use the static _renderExportFrame loop
  const gifSection = exportBody.slice(exportBody.indexOf("if (fmt === 'gif')"), exportBody.indexOf("if (fmt === 'mp4'"));
  assert.ok(!gifSection.includes('_renderExportFrame('), 'GIF export must not use offline static frame loop');
  assert.ok(gifSection.includes('_compositeLiveCanvasesToTarget(gCtx,'), 'GIF export must sample from live composited canvases');
  assert.ok(gifSection.includes('_startLiveMultiSceneExportRun('), 'GIF export must trigger live multi-scene run');

  const mp4Section = exportBody.slice(exportBody.indexOf("if (fmt === 'mp4'"), exportBody.indexOf("// WebM Sequential Recording"));
  assert.ok(!mp4Section.includes('_renderExportFrame('), 'MP4 export must not use offline static frame loop');
  assert.ok(mp4Section.includes('_compositeLiveCanvasesToTarget(rctx,'), 'MP4 export must encode from live composited canvases');
  assert.ok(mp4Section.includes('_startLiveMultiSceneExportRun('), 'MP4 export must trigger live multi-scene run');

  const webmSection = exportBody.slice(exportBody.indexOf("// WebM Sequential Recording"));
  assert.ok(!webmSection.includes('_renderExportFrame('), 'WebM export must not use offline static frame loop');
  assert.ok(webmSection.includes('_compositeLiveCanvasesToTarget(rctx,'), 'WebM export must sample from live composited canvases');
  assert.ok(webmSection.includes('_startLiveMultiSceneExportRun('), 'WebM export must trigger live multi-scene run');
});
