const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractFunction(source, fnName) {
  const sig = `function ${fnName}(`;
  const start = source.indexOf(sig);
  assert.ok(start >= 0, `${fnName} must exist in index.html`);
  let depth = 0;
  let inBody = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      depth++;
      inBody = true;
    } else if (ch === '}') {
      depth--;
      if (inBody && depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new Error(`Unclosed function body for ${fnName}`);
}

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

test('Sequential export uses Turbo Virtual-Clock WebCodecs with live canvas compositing', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const bodyIdx = html.indexOf('function _exportSequentialProjectBody');
  assert.ok(bodyIdx > 0, '_exportSequentialProjectBody exists');
  const exportBody = html.slice(bodyIdx, html.indexOf('function init()', bodyIdx));

  // None of the export paths should use the static _renderExportFrame loop
  assert.ok(!exportBody.includes('_renderExportFrame('), 'Export must not use static _renderExportFrame loop');

  const gifSection = exportBody.slice(exportBody.indexOf("if (fmt === 'gif')"), exportBody.indexOf("if ((fmt === 'mp4' || fmt === 'webm')"));
  assert.ok(gifSection.includes('_runVirtualClockExport('), 'GIF export must use Turbo Virtual Clock');
  assert.ok(gifSection.includes('_compositeLiveCanvasesToTarget(gCtx,'), 'GIF export must composite live canvases + hand');

  const webCodecsSection = exportBody.slice(exportBody.indexOf("if ((fmt === 'mp4' || fmt === 'webm')"), exportBody.indexOf('// Fallback WebM MediaRecorder path'));
  assert.ok(webCodecsSection.includes('./vendor/mp4-muxer.mjs'), 'MP4 uses mp4-muxer');
  assert.ok(webCodecsSection.includes('./vendor/webm-muxer.mjs'), 'WebM uses webm-muxer');
  assert.ok(webCodecsSection.includes('_runVirtualClockExport('), 'MP4 and WebM use Turbo Virtual Clock');
  assert.ok(webCodecsSection.includes('_compositeLiveCanvasesToTarget(rctx,'), 'MP4 and WebM composite live canvases + hand');
  assert.ok(webCodecsSection.includes('_prepareOfflineAudioEncoder('), 'MP4 and WebM encode audio offline without real-time waiting');
  assert.ok(webCodecsSection.includes('_createPagedStreamTarget('), 'MP4 and WebM support multi-GB chunked streaming without single-ArrayBuffer OOM');
});

test('VirtualExportClock advances deterministic virtual time and cleanly restores globals', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const fnCode = extractFunction(html, '_createVirtualExportClock');

  const realPerfNow = () => 1000;
  const realDateNow = () => 1700000000000;
  const realRAF = () => 99;
  const realCAF = () => {};
  const realSetTimeout = () => 88;
  const realClearTimeout = () => {};

  const sandbox = {
    performance: { now: realPerfNow },
    Date: { now: realDateNow },
    window: {
      requestAnimationFrame: realRAF,
      cancelAnimationFrame: realCAF,
      setTimeout: realSetTimeout,
      clearTimeout: realClearTimeout,
    },
  };
  vm.runInNewContext(`${fnCode}; this.createClock = _createVirtualExportClock;`, sandbox);

  const clock = sandbox.createClock();
  clock.install();

  const startPerf = sandbox.performance.now();
  const startDate = sandbox.Date.now();
  let rafFired = 0;
  let timeoutFiredAt = null;
  let canceledFired = false;

  const canceledId = sandbox.window.setTimeout(() => { canceledFired = true; }, 50);
  sandbox.window.clearTimeout(canceledId);
  sandbox.window.setTimeout(() => { timeoutFiredAt = sandbox.performance.now(); }, 200);

  const scheduleNext = () => {
    sandbox.window.requestAnimationFrame((now) => {
      rafFired++;
      if (rafFired < 60) scheduleNext();
      assert.ok(now > startPerf);
    });
  };
  scheduleNext();

  // Simulate 1000ms of virtual playback instantaneously (60 ticks at 16.6667ms)
  for (let i = 0; i < 60; i++) {
    clock.tick(1000 / 60);
  }

  assert.equal(rafFired, 60, 'All 60 virtual animation frames executed synchronously');
  assert.equal(canceledFired, false, 'Cleared virtual timeout must not fire');
  assert.ok(timeoutFiredAt !== null && Math.abs(timeoutFiredAt - (startPerf + 200)) < 20, '200ms virtual timer fired on schedule');
  assert.ok(Math.abs(sandbox.performance.now() - (startPerf + 1000)) < 0.01, 'Virtual performance.now advanced by 1000ms');
  assert.ok(Math.abs(sandbox.Date.now() - (startDate + 1000)) <= 1, 'Virtual Date.now advanced by 1000ms');

  clock.restore();
  assert.equal(sandbox.performance.now(), 1000, 'performance.now restored');
  assert.equal(sandbox.Date.now(), 1700000000000, 'Date.now restored');
  assert.equal(sandbox.window.requestAnimationFrame(() => {}), 99, 'requestAnimationFrame restored');
  assert.equal(sandbox.window.setTimeout(() => {}, 10), 88, 'setTimeout restored');
});

test('PagedStreamTarget handles random-access and cross-page writes into a contiguous Blob', async () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const fnCode = extractFunction(html, '_createPagedStreamTarget');

  class MockStreamTarget {
    constructor(options) { this.options = options; }
  }
  const sandbox = { Uint8Array, Map, Blob, Math };
  vm.runInNewContext(`${fnCode}; this.createTarget = _createPagedStreamTarget;`, sandbox);

  const target = sandbox.createTarget(MockStreamTarget);
  // Write 10 bytes at start, 10 bytes crossing the 4MB boundary, and patch byte 2 later
  const head = new Uint8Array([1, 2, 3, 4, 5]);
  target.options.onData(head, 0);

  const boundaryPos = 4 * 1024 * 1024 - 3;
  const cross = new Uint8Array([10, 20, 30, 40, 50, 60]);
  target.options.onData(cross, boundaryPos);

  // Random-access patch at position 2 (like WebM duration / cues patch)
  target.options.onData(new Uint8Array([99]), 2);

  const blob = target.toBlob('video/webm');
  assert.equal(blob.size, boundaryPos + cross.length);
  const buf = new Uint8Array(await blob.arrayBuffer());
  assert.equal(buf[0], 1);
  assert.equal(buf[2], 99, 'Patched header byte preserved');
  assert.deepEqual([...buf.slice(boundaryPos, boundaryPos + 6)], [10, 20, 30, 40, 50, 60], 'Cross-page write intact');
});
