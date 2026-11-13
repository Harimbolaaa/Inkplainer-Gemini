const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCameraCore() {
  const src = fs.readFileSync(path.join(__dirname, '../camera-core.js'), 'utf8');
  const sandbox = { Math, Number, Array, Object };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.CameraCore;
}

const CameraCore = loadCameraCore();

function extractFunction(source, fnName) {
  const sig = `function ${fnName}(`;
  const start = source.indexOf(sig);
  assert.ok(start >= 0, `${fnName} must exist in index.html`);
  let parenDepth = 0;
  let bodySearchStart = start + sig.length - 1;
  for (let i = bodySearchStart; i < source.length; i++) {
    if (source[i] === '(') parenDepth++;
    else if (source[i] === ')') {
      parenDepth--;
      if (parenDepth === 0) {
        bodySearchStart = i + 1;
        break;
      }
    }
  }
  let depth = 0;
  let inBody = false;
  for (let i = bodySearchStart; i < source.length; i++) {
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

test('CameraCore normalizeLayerCamera, auto-frame and frame-rect roundtrip', () => {
  const layer = { x: 800, y: 120, w: 320, h: 180 };
  const auto = CameraCore.computeAutoFrameForLayer(layer, 1280, 720, 1.38);
  assert.equal(auto.cx, 960);
  assert.equal(auto.cy, 210);
  assert.ok(auto.zoom > 2 && auto.zoom <= 4.0);

  const rect = CameraCore.getCameraFrameRect({ enabled: true, ...auto }, 1280, 720);
  assert.ok(Math.abs((rect.x + rect.w / 2) - auto.cx) < 0.01);
  assert.ok(Math.abs((rect.y + rect.h / 2) - auto.cy) < 0.01);
  assert.ok(Math.abs(rect.w - 1280 / auto.zoom) < 0.01);

  const back = CameraCore.cameraFromFrameRect(rect, 1280, 720);
  assert.ok(Math.abs(back.cx - auto.cx) < 0.5);
  assert.ok(Math.abs(back.cy - auto.cy) < 0.5);
  assert.ok(Math.abs(back.zoom - auto.zoom) < 0.02);
});

test('CameraCore evaluateSceneCameraAtTime pans smoothly between layers and optionally resets at scene end', () => {
  const layerA = {
    id: 1,
    inPoint: 0,
    outPoint: 6,
    x: 100,
    y: 100,
    w: 200,
    h: 150,
    cameraMode: 'custom',
    camera: { enabled: true, cx: 200, cy: 175, zoom: 2.0, transitionDur: 0.8 },
  };
  const layerB = {
    id: 2,
    inPoint: 0,
    outPoint: 6,
    x: 900,
    y: 420,
    w: 200,
    h: 150,
    cameraMode: 'custom',
    camera: { enabled: true, cx: 1000, cy: 495, zoom: 2.5, transitionDur: 0.8 },
  };
  const sceneReset = { id: 'sc-1', duration: 6, camera: { endResetToFull: true, transitionDur: 0.8 }, layers: [layerA, layerB] };
  const sceneHold = { id: 'sc-2', duration: 6, camera: { endResetToFull: false, transitionDur: 0.8 }, layers: [layerA, layerB] };

  // Start of layer A after initial settle: locked on layer A
  const atA = CameraCore.evaluateSceneCameraAtTime(sceneReset, 1.5, [layerA, layerB], 1280, 720);
  assert.equal(atA.active, true);
  assert.ok(Math.abs(atA.cx - 200) < 1);
  assert.ok(Math.abs(atA.cy - 175) < 1);
  assert.ok(Math.abs(atA.zoom - 2.0) < 0.01);

  // Mid transition into layer B (window 3.0..6.0, transitionDur 0.8 -> t=3.4 is halfway from A to B)
  const midAB = CameraCore.evaluateSceneCameraAtTime(sceneReset, 3.4, [layerA, layerB], 1280, 720);
  assert.ok(midAB.cx > 550 && midAB.cx < 650, `Expected midpoint cx near 600, got ${midAB.cx}`);
  assert.ok(midAB.zoom > 2.0 && midAB.zoom < 2.5);

  // Near end with endResetToFull: true zooms back toward full canvas (zoom -> 1.0)
  const atEndReset = CameraCore.evaluateSceneCameraAtTime(sceneReset, 5.95, [layerA, layerB], 1280, 720);
  assert.ok(atEndReset.zoom < 1.25, `Expected zoom-out near end, got ${atEndReset.zoom}`);

  // Near end with endResetToFull: false keeps framing on layer B
  const atEndHold = CameraCore.evaluateSceneCameraAtTime(sceneHold, 5.95, [layerA, layerB], 1280, 720);
  assert.ok(Math.abs(atEndHold.zoom - 2.5) < 0.01);
  assert.ok(Math.abs(atEndHold.cx - 1000) < 1);
});

test('CameraCore computeMagneticSnap snaps bounds to canvas center and sibling edges', () => {
  const sibling = { id: 2, visible: true, x: 500, y: 100, w: 120, h: 80 };
  // Near canvas horizontal center (1280 / 2 = 640 -> layer x should become 640 - 50 = 590)
  const snapCenter = CameraCore.computeMagneticSnap({ x: 594, y: 312, w: 100, h: 100 }, [sibling], 1280, 720, 8);
  assert.equal(snapCenter.x, 590);
  assert.equal(snapCenter.y, 310);
  assert.ok(snapCenter.guides.some(g => g.axis === 'x' && g.kind === 'canvas-center'));
  assert.ok(snapCenter.guides.some(g => g.axis === 'y' && g.kind === 'canvas-center'));

  // Near sibling left edge (500)
  const snapSibling = CameraCore.computeMagneticSnap({ x: 505, y: 260, w: 90, h: 90 }, [sibling], 1280, 720, 8);
  assert.equal(snapSibling.x, 500);
  assert.ok(snapSibling.guides.some(g => g.axis === 'x' && g.pos === 500));
});

test('getImageDataURL caches encoded data URLs by element and size', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const fnSrc = extractFunction(html, 'getImageDataURL');
  let toDataCalls = 0;
  const fakeImg = { width: 120, height: 80, naturalWidth: 120, naturalHeight: 80 };
  const sandbox = {
    document: {
      createElement() {
        return {
          width: 0,
          height: 0,
          getContext() {
            return { drawImage() {} };
          },
          toDataURL() {
            toDataCalls++;
            return `data:image/png;base64,CALL_${toDataCalls}`;
          },
        };
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fnSrc, sandbox);

  const first = sandbox.getImageDataURL(fakeImg);
  const second = sandbox.getImageDataURL(fakeImg);
  assert.equal(first, second);
  assert.equal(toDataCalls, 1, 'Expected cached PNG output on second identical call');

  fakeImg.naturalWidth = 160;
  fakeImg.width = 160;
  const third = sandbox.getImageDataURL(fakeImg);
  assert.notEqual(third, first);
  assert.equal(toDataCalls, 2, 'Expected cache invalidation when image dimensions change');
});

test('index.html & studio.js contain non-blocking confirm UI, pre-drag beforeSnap undo, and zero native confirm() dialogs', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');

  assert.equal(/\bconfirm\s*\(/.test(html), false, 'index.html should not call native window.confirm()');
  assert.equal(/\bconfirm\s*\(/.test(studioJs), false, 'studio.js should not call native window.confirm()');
  assert.ok(html.includes('function _pushUndoWithBeforeSnap('), 'Pre-drag beforeSnap undo helper exists');
  assert.ok(html.includes('function checkAutoSaveRecovery('), 'Auto-save recovery check exists');
  assert.ok(html.includes('(e.key || \'\').toLowerCase()'), 'Case-insensitive Ctrl+Z / Ctrl+Y shortcut handling exists');
  assert.ok(html.includes('evaluateSceneCameraAtTime'), 'Composite renderer integrates CameraCore evaluation');
  assert.equal((html.match(/const _CAMERA_MODE_HINTS\s*=/g) || []).length, 1, '_CAMERA_MODE_HINTS is declared only once');
  assert.ok(html.includes('id="cam-dock-left"') && html.includes('id="cam-dock-right"'), 'Left & Right lateral camera docks exist around main canvas');
  assert.ok(html.includes('id="cam-preset-grid"') && html.includes('id="tl-camera-lane"'), 'Camera preset grid and timeline camera track exist');
  assert.ok(html.includes('function applyCameraPresetAtPlayhead('), 'Preset insertion at playhead helper exists');
});

test('CameraCore CAMERA_PRESETS, buildCameraShotsFromPreset, and normalizeSceneCameraKeyframes work for single & multi-key presets', () => {
  assert.ok(Array.isArray(CameraCore.CAMERA_PRESETS) && CameraCore.CAMERA_PRESETS.length >= 10, 'Expected at least 10 camera preset templates');

  const sampleLayer = { id: 42, name: 'Titre', x: 700, y: 200, w: 300, h: 160 };
  const focusShots = CameraCore.buildCameraShotsFromPreset('focus-layer', {
    canvasW: 1280,
    canvasH: 720,
    sceneDuration: 6,
    localTime: 1.5,
    layer: sampleLayer,
    transitionDur: 0.8,
  });
  assert.equal(focusShots.length, 1);
  assert.equal(focusShots[0].time, 1.5);
  assert.equal(focusShots[0].cx, 850);
  assert.equal(focusShots[0].cy, 280);
  assert.ok(focusShots[0].zoom > 1.8 && focusShots[0].zoom <= 3.6);

  const pushShots = CameraCore.buildCameraShotsFromPreset('push-in', {
    canvasW: 1280,
    canvasH: 720,
    sceneDuration: 6,
    localTime: 2.0,
    layer: sampleLayer,
  });
  assert.equal(pushShots.length, 2, 'Push-In sequence should generate start and end keyframes');
  assert.equal(pushShots[0].time, 2.0);
  assert.equal(pushShots[0].zoom, 1.0);
  assert.ok(pushShots[1].time > 2.0 && pushShots[1].time <= 6.0);
  assert.equal(pushShots[1].zoom, 2.15);
  assert.equal(pushShots[1].cx, 850);

  const panShots = CameraCore.buildCameraShotsFromPreset('pan-lr', {
    canvasW: 1280,
    canvasH: 720,
    sceneDuration: 5,
    localTime: 1.0,
  });
  assert.equal(panShots.length, 2);
  assert.ok(panShots[0].cx < panShots[1].cx, 'Pan L->R should move horizontally from left to right');

  const normalized = CameraCore.normalizeSceneCameraKeyframes([
    { id: 'b', time: 9.5, zoom: 10 },
    { id: 'a', time: -2, zoom: 0.1 },
  ], 5.0, 1280, 720);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].id, 'a');
  assert.equal(normalized[0].time, 0);
  assert.equal(normalized[0].zoom, 0.5);
  assert.equal(normalized[1].id, 'b');
  assert.equal(normalized[1].time, 5.0);
  assert.equal(normalized[1].zoom, 4.0);
});

test('CameraCore evaluateSceneCameraAtTime evaluates timed scene.cameraKeyframes with smooth easing and optional end zoom-out', () => {
  const scene = {
    id: 'sc-kf',
    duration: 6.0,
    camera: { defaultZoom: 1.0, endResetToFull: true, transitionDur: 0.7 },
    cameraKeyframes: [
      { id: 'k1', time: 1.5, cx: 960, cy: 360, zoom: 2.0, transitionDur: 0.8, easing: 'ease-in-out' },
      { id: 'k2', time: 3.5, cx: 320, cy: 180, zoom: 2.6, transitionDur: 0.8, easing: 'ease-in-out' },
    ],
    layers: [],
  };

  // Before transition starts (t=0.2 < 1.5 - 0.8 = 0.7) -> stays at wide 1.0x
  const tStart = CameraCore.evaluateSceneCameraAtTime(scene, 0.2, [], 1280, 720);
  assert.equal(tStart.zoom, 1.0);
  assert.equal(tStart.active, false);

  // Mid-transition into k1 (t=1.1 is halfway between 0.7 and 1.5)
  const tMid1 = CameraCore.evaluateSceneCameraAtTime(scene, 1.1, [], 1280, 720);
  assert.ok(tMid1.zoom > 1.3 && tMid1.zoom < 1.7, `Expected mid zoom ~1.5, got ${tMid1.zoom}`);
  assert.ok(tMid1.cx > 760 && tMid1.cx < 840);

  // Hold at k1 before transition to k2 starts (t=2.0 < 3.5 - 0.8 = 2.7)
  const tHold1 = CameraCore.evaluateSceneCameraAtTime(scene, 2.0, [], 1280, 720);
  assert.equal(tHold1.zoom, 2.0);
  assert.equal(tHold1.cx, 960);

  // At k2 (t=3.5)
  const tAt2 = CameraCore.evaluateSceneCameraAtTime(scene, 3.5, [], 1280, 720);
  assert.equal(tAt2.zoom, 2.6);
  assert.equal(tAt2.cx, 320);

  // Near end with endResetToFull: true -> smoothly resets toward 1.0x
  const tEnd = CameraCore.evaluateSceneCameraAtTime(scene, 5.98, [], 1280, 720);
  assert.ok(tEnd.zoom < 1.2, `Expected zoom reset near scene end, got ${tEnd.zoom}`);
});

test('CameraCore worldToScreenPoint, screenToWorldPoint roundtrip and sceneHasCameraAnimation', () => {
  const camIn = { cx: 940, cy: 210, zoom: 3.2 };
  const worldPt = { x: 885, y: 245 };
  const scrPt = CameraCore.worldToScreenPoint(worldPt, camIn, 1280, 720);
  const backIn = CameraCore.screenToWorldPoint(scrPt, camIn, 1280, 720);
  assert.ok(Math.abs(backIn.x - worldPt.x) < 1e-6);
  assert.ok(Math.abs(backIn.y - worldPt.y) < 1e-6);

  const camOut = { cx: 480, cy: 360, zoom: 0.5 };
  const scrOut = CameraCore.worldToScreenPoint(worldPt, camOut, 1280, 720);
  const backOut = CameraCore.screenToWorldPoint(scrOut, camOut, 1280, 720);
  assert.ok(Math.abs(backOut.x - worldPt.x) < 1e-6);
  assert.ok(Math.abs(backOut.y - worldPt.y) < 1e-6);

  assert.equal(CameraCore.sceneHasCameraAnimation({ id: 'plain', layers: [{ visible: true, cameraMode: 'static' }] }), false);
  assert.equal(CameraCore.sceneHasCameraAnimation({ id: 'def', camera: { defaultZoom: 1.4 }, layers: [] }), true);
  assert.equal(CameraCore.sceneHasCameraAnimation({ id: 'kf', cameraKeyframes: [{ id: 'k1', time: 1, zoom: 2 }], layers: [] }), true);
  assert.equal(CameraCore.sceneHasCameraAnimation({ id: 'lay', layers: [{ visible: true, camera: { enabled: true, zoom: 1.8 } }] }), true);
  assert.equal(CameraCore.sceneHasCameraAnimation({ id: 'sm', production: { camera: { keyframes: [{ id: 's1', time: 0, zoom: 1.5 }] } }, layers: [] }), true);
});

test('StickmanProduction exposes getTrackBounds, passes follow targets to evaluateCamera, and supports ignoreCamera', () => {
  const coreSrc = fs.readFileSync(path.join(__dirname, '../stickman-core.js'), 'utf8');
  const prodCoreSrc = fs.readFileSync(path.join(__dirname, '../stickman-production-core.js'), 'utf8');
  const uiSrc = fs.readFileSync(path.join(__dirname, '../stickman-production-ui.js'), 'utf8');

  const noop = () => {};
  const sandbox = {
    Math, Number, Array, Object, String, Boolean, Date, JSON, Promise, Set, Map,
    console,
    addEventListener: noop,
    removeEventListener: noop,
    setTimeout: noop, clearTimeout: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    localStorage: { getItem: () => null, setItem: noop },
    document: {
      createElement: () => ({ style: {}, querySelector: () => null, querySelectorAll: () => [], append: noop, innerHTML: '' }),
      body: { append: noop },
      head: { append: noop },
    },
    state: {
      canvasW: 1280,
      canvasH: 720,
      playheadTime: 0,
      scenes: [],
      activeSceneId: 'sc-1',
    },
    StickmanTemplates: { templates: [], categories: [], styles: [] },
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(coreSrc, sandbox);
  vm.runInContext(prodCoreSrc, sandbox);
  vm.runInContext(uiSrc, sandbox);

  assert.equal(typeof sandbox.StickmanProduction?.getTrackBounds, 'function');

  const char = sandbox.StickmanCore.createCharacter('Hero', { x: 420, y: 360 });
  const track = {
    id: 'track-1',
    type: 'character',
    visible: true,
    inPoint: 0,
    outPoint: 5,
    character: char,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
  };
  const scene = {
    id: 'sc-1',
    duration: 5,
    production: {
      duration: 5,
      tracks: [track],
      effects: [],
      captions: [],
      camera: { keyframes: [{ id: 'c1', time: 0, zoom: 2, x: 0, y: 0 }], followTarget: 'track-1', followSmoothing: 1, shake: 0, pulse: 0 },
    },
  };
  sandbox.state.scenes = [scene];

  const cam = sandbox.StickmanProduction.evaluateCamera(scene.production.camera, 0, {
    targets: { 'track-1': { x: 120, y: -40 } },
  });
  assert.equal(cam.zoom, 2);
  assert.equal(cam.x, 120);
  assert.equal(cam.y, -40);

  const rawBounds = sandbox.StickmanProduction.getTrackBounds(scene, track, 0, { ignoreCamera: true });
  const camBounds = sandbox.StickmanProduction.getTrackBounds(scene, track, 0, { ignoreCamera: false });
  assert.ok(rawBounds && camBounds);
  assert.ok(camBounds.w > rawBounds.w * 1.5, 'Camera zoom should enlarge projected stickman selection bounds');
});

test('index.html, studio.js, and animations.js keep camera state coherent across whiteboard, SVG, preview, resize, split, and export', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');
  const animJs = fs.readFileSync(path.join(__dirname, '../animations.js'), 'utf8');

  assert.ok(html.includes('window.getActiveViewCamera = function()'));
  assert.ok(html.includes('CameraCore.screenToWorldPoint(raw, viewCam'));
  assert.ok(html.includes('renderSceneCompositeToContext(_mainCtx, activeScene, localT, false, { ignoreCamera: ignoreCam })'));
  assert.ok(html.includes('interactTargetKind = _interact.targetKind'));
  assert.equal(html.includes('state.slotMode = prevSlot'), false, 'Typo state.slotMode should not exist');
  assert.ok(html.includes('_applyDynamicCameraFrame') && animJs.includes('window._applyDynamicCameraFrame(true)'));
  assert.ok(html.includes('function _sceneNeedsCompositePlayback('));
  assert.ok(html.includes('scaledKfs = sc.cameraKeyframes.map'));
  assert.ok(html.includes('origCamKfs'));
  assert.ok(studioJs.includes('activePenViewCamera()') && studioJs.includes('screenToWorldPoint'));
});


