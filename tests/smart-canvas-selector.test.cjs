const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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

function buildSelectorSandbox(overrides = {}) {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const studioCoreSrc = fs.readFileSync(path.join(__dirname, '../studio-core.js'), 'utf8');

  const fnNames = [
    '_recordRenderedScene',
    '_getSceneLocalTime',
    'getLayerCanvasBounds',
    '_toLayerLocalPoint',
    '_isPointInsideBounds',
    '_isPointOpaqueOnLayerImage',
    'hitTestHandle',
    'hitTestStickmanTrack',
    '_collectSceneHitsAtPoint',
    'resolveSmartCanvasHit',
    '_pauseAllPlaybackForCanvasEdit',
    '_getKeyframeMoveMode',
    '_applyInteractiveLayerEdit',
  ];

  const probeCtx = {
    alphaValue: 255,
    clearRect() {},
    drawImage() {},
    getImageData() {
      return { data: [0, 0, 0, this.alphaValue] };
    },
  };

  const state = overrides.state || {
    activeSceneId: 'sc-1',
    playheadTime: 1.0,
    playing: false,
    animFrame: 0,
    selectedLayerId: null,
    layers: [],
    scenes: [],
  };

  const sandbox = {
    console,
    Math,
    Number,
    Set,
    Date,
    HANDLE_R: 6,
    selectedStickmanTrackId: null,
    _hitProbeCtx: probeCtx,
    state,
    cancelAnimationFrame: overrides.cancelAnimationFrame || (() => {}),
    updatePlayIcons: overrides.updatePlayIcons || (() => {}),
    getStickmanCanvasBounds: overrides.getStickmanCanvasBounds || (() => null),
    window: {
      _inkLastRendered: overrides._inkLastRendered || null,
      TimelineStudio: overrides.TimelineStudio || {
        getActiveScene: () => state.scenes.find(s => s.id === state.activeSceneId) || null,
        getSceneStartOffset: (id) => {
          let acc = 0;
          for (const s of state.scenes) {
            if (s.id === id) return acc;
            acc += s.duration || 5;
          }
          return 0;
        },
        getSceneAtGlobalTime: (t) => {
          let acc = 0;
          for (let i = 0; i < state.scenes.length; i++) {
            const sc = state.scenes[i];
            if (t < acc + sc.duration || i === state.scenes.length - 1) {
              return { scene: sc, index: i, sceneStart: acc, localTime: Math.max(0, t - acc) };
            }
            acc += sc.duration;
          }
          return { scene: null, index: 0, sceneStart: 0, localTime: 0 };
        },
      },
      StudioEffects: overrides.StudioEffects || {},
    },
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(studioCoreSrc, sandbox);
  sandbox.StudioCore = sandbox.window.StudioCore;

  const combined = fnNames.map(name => extractFunction(html, name)).join('\n');
  vm.runInContext(combined, sandbox);
  return { sandbox, probeCtx, state };
}

test('resolveSmartCanvasHit finds image in rendered/playhead scene even when another scene is active in timeline', () => {
  const layer1 = { id: 1, name: 'Scene1-Img', x: 50, y: 50, w: 150, h: 150, visible: true, inPoint: 0, outPoint: 5, img: { width: 100, height: 100 } };
  const layer2 = { id: 2, name: 'Scene2-Img', x: 400, y: 200, w: 200, h: 160, visible: true, inPoint: 0, outPoint: 5, img: { width: 100, height: 100 } };
  const sc1 = { id: 'sc-1', duration: 5, layers: [layer1], production: { tracks: [] } };
  const sc2 = { id: 'sc-2', duration: 5, layers: [layer2], production: { tracks: [] } };

  const { sandbox } = buildSelectorSandbox({
    state: {
      activeSceneId: 'sc-1',
      playheadTime: 6.5, // playhead is in Scene 2, e.g. after playback or transition
      playing: false,
      selectedLayerId: 1,
      layers: [layer1],
      scenes: [sc1, sc2],
    },
    _inkLastRendered: { sceneId: 'sc-2', secondarySceneId: null, localTime: 1.5 },
  });

  const hit = sandbox.resolveSmartCanvasHit(480, 260);
  assert.ok(hit, 'Expected hit in Scene 2');
  assert.equal(hit.kind, 'layer');
  assert.equal(hit.item.id, 2);
  assert.equal(hit.scene.id, 'sc-2');
});

test('resolveSmartCanvasHit prefers top layer over selected larger layer and skips transparent pixels when opaque layer is underneath', () => {
  const bgLayer = { id: 10, name: 'BottomSolid', x: 100, y: 100, w: 400, h: 300, visible: true, inPoint: 0, outPoint: 5, img: { width: 100, height: 100 } };
  const topLayer = { id: 11, name: 'TopOverlay', x: 180, y: 140, w: 180, h: 180, visible: true, inPoint: 0, outPoint: 5, img: { width: 100, height: 100 } };
  const sc1 = { id: 'sc-1', duration: 5, layers: [bgLayer, topLayer], production: { tracks: [] } };

  const { sandbox, probeCtx } = buildSelectorSandbox({
    state: {
      activeSceneId: 'sc-1',
      playheadTime: 1.0,
      playing: false,
      selectedLayerId: 10, // Bottom layer is currently selected
      layers: [bgLayer, topLayer],
      scenes: [sc1],
    },
  });

  // 1) Both opaque -> clicking inside topLayer must pick topLayer (even though bgLayer was selected)
  probeCtx.alphaValue = 255;
  const topHit = sandbox.resolveSmartCanvasHit(220, 200);
  assert.equal(topHit.item.id, 11);

  // 2) Alt+click cycles to bottom layer
  sandbox.state.selectedLayerId = 11;
  const cycledNext = sandbox.resolveSmartCanvasHit(220, 200, { altCycle: true });
  assert.equal(cycledNext.item.id, 10);

  // 3) Transparent top pixel -> falls through to opaque bottom layer
  sandbox._isPointOpaqueOnLayerImage = (px, py, layer) => layer.id === 10;
  const fallthrough = sandbox.resolveSmartCanvasHit(220, 200);
  assert.equal(fallthrough.item.id, 10);
});

test('getLayerCanvasBounds & hitTestHandle respect rotation and keyframed positions', () => {
  const animLayer = {
    id: 21,
    name: 'Animated',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    baseW: 100,
    baseH: 100,
    resizePct: 100,
    rotation: 0,
    visible: true,
    inPoint: 0,
    outPoint: 5,
    keyframes: [
      { id: 'k1', time: 0, x: 0, y: 0, rotation: 0 },
      { id: 'k2', time: 2, x: 300, y: 200, rotation: 0 },
    ],
    img: { width: 100, height: 100 },
  };
  const sc1 = { id: 'sc-1', duration: 5, layers: [animLayer], production: { tracks: [] } };
  const { sandbox } = buildSelectorSandbox({
    state: {
      activeSceneId: 'sc-1',
      playheadTime: 2.0,
      playing: false,
      selectedLayerId: 21,
      layers: [animLayer],
      scenes: [sc1],
    },
  });

  const bounds = sandbox.getLayerCanvasBounds(animLayer, 2.0);
  assert.equal(Math.round(bounds.x), 300);
  assert.equal(Math.round(bounds.y), 200);
  assert.equal(sandbox.hitTestHandle(300, 200, bounds), 'nw');

  // Interactive move on keyframed layer updates keyframe at localTime=2.0 via StudioCore.put
  const kfMode = sandbox._getKeyframeMoveMode(animLayer, 2.0);
  sandbox._applyInteractiveLayerEdit(animLayer, bounds, 45, -25, null, false, kfMode);
  const updated = sandbox.getLayerCanvasBounds(animLayer, 2.0);
  assert.equal(Math.round(updated.x), 345);
  assert.equal(Math.round(updated.y), 175);

  // Rotated wide bar (200x40 rotated 90deg around center 200,200) hits vertically, not horizontally outside bar
  const rotBounds = { x: 100, y: 180, w: 200, h: 40, rotation: 90 };
  assert.equal(sandbox._isPointInsideBounds(200, 120, rotBounds), true);
  assert.equal(sandbox._isPointInsideBounds(120, 200, rotBounds), false);
});

test('_pauseAllPlaybackForCanvasEdit stops active preview and animation playback cleanly', () => {
  let previewPaused = false;
  let rafCancelled = false;
  let iconsUpdated = false;
  let effectsStopped = false;

  const { sandbox, state } = buildSelectorSandbox({
    state: { activeSceneId: 'sc-1', playheadTime: 2.0, playing: true, animFrame: 42, layers: [], scenes: [] },
    cancelAnimationFrame: () => { rafCancelled = true; },
    updatePlayIcons: () => { iconsUpdated = true; },
    TimelineStudio: {
      isPreviewPlaying: () => true,
      pausePreviewAll: () => { previewPaused = true; },
      getActiveScene: () => null,
      getSceneStartOffset: () => 0,
    },
    StudioEffects: {
      stopPreview: () => { effectsStopped = true; },
    },
  });

  const wasPlaying = sandbox._pauseAllPlaybackForCanvasEdit();
  assert.equal(wasPlaying, true);
  assert.equal(previewPaused, true);
  assert.equal(state.playing, false);
  assert.equal(rafCancelled, true);
  assert.equal(iconsUpdated, true);
  assert.equal(effectsStopped, true);
});

test('TimelineStudio keeps timeline synced on seek and supports switchToSceneForCanvasHit', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('function switchToSceneForCanvasHit(sceneId, localTime = null)'), 'switchToSceneForCanvasHit exists');
  assert.ok(html.includes('if (sceneChanged && !state.recording) {\n      renderTimeline();\n    }'), 'seekToGlobalTime refreshes timeline when crossing scenes');
});

test('Bidirectional smart hover syncs canvas hover to layer list and layer list hover back to canvas', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const studioCoreSrc = fs.readFileSync(path.join(__dirname, '../studio-core.js'), 'utf8');

  const layerA = { id: 101, name: 'Hero', x: 100, y: 120, w: 220, h: 160, visible: true, inPoint: 0, outPoint: 5, img: { width: 100, height: 100 } };
  const layerB = { id: 102, name: 'Sub', x: 400, y: 200, w: 150, h: 100, visible: false, inPoint: 0, outPoint: 5, img: { width: 100, height: 100 } };
  const sc1 = { id: 'sc-1', duration: 5, layers: [layerA, layerB], production: { tracks: [] } };

  function makeClassList(initial = []) {
    const set = new Set(initial);
    return {
      add(c) { set.add(c); },
      remove(c) { set.delete(c); },
      contains(c) { return set.has(c); },
    };
  }

  const grpEl = { classList: makeClassList(['layer-group', 'collapsed']) };
  const itemA = { dataset: { id: '101' }, classList: makeClassList(['layer-item']), closest: () => null };
  const itemB = { dataset: { id: '102' }, classList: makeClassList(['layer-item']), closest: (sel) => (sel === '.layer-group.collapsed' ? grpEl : null) };
  const items = [itemA, itemB];

  let drawCalls = 0;
  const listEl = {
    querySelectorAll(sel) {
      if (sel === '.layer-item.canvas-hovered') return items.filter(el => el.classList.contains('canvas-hovered'));
      if (sel === '.layer-group.canvas-hovered') return grpEl.classList.contains('canvas-hovered') ? [grpEl] : [];
      return [];
    },
    querySelector(sel) {
      const m = sel.match(/\.layer-item\[data-id="(.+)"\]/);
      return m ? items.find(el => el.dataset.id === m[1]) || null : null;
    },
  };

  const state = { activeSceneId: 'sc-1', playheadTime: 1.0, playing: false, recording: false, layers: [layerA, layerB], scenes: [sc1] };
  const sandbox = {
    console,
    Math,
    Number,
    Set,
    Date,
    String,
    Boolean,
    _hoverCandidate: null,
    _layerListHoveredId: null,
    _interact: null,
    state,
    document: {
      getElementById: (id) => (id === 'layer-list' ? listEl : null),
    },
    getLayerById: (id) => state.layers.find(l => l.id === id) || null,
    drawSelectionHandles: () => { drawCalls++; },
    window: {
      TimelineStudio: {
        getActiveScene: () => sc1,
        getSceneStartOffset: () => 0,
      },
    },
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(studioCoreSrc, sandbox);
  sandbox.StudioCore = sandbox.window.StudioCore;

  const hoverFns = [
    '_getSceneLocalTime',
    'getLayerCanvasBounds',
    'syncLayerListHoverHighlight',
    'setSmartHoverCandidate',
    'hoverLayerFromList',
    'clearLayerHoverFromList',
  ].map(name => extractFunction(html, name)).join('\n');
  vm.runInContext(hoverFns, sandbox);

  // 1) Canvas hover highlights target item in layer list and redraws canvas
  sandbox.setSmartHoverCandidate({ kind: 'layer', id: 101, name: 'Hero', sceneId: 'sc-1', bounds: { x: 100, y: 120, w: 220, h: 160 }, fromList: false });
  assert.equal(itemA.classList.contains('canvas-hovered'), true);
  assert.equal(itemB.classList.contains('canvas-hovered'), false);
  assert.equal(drawCalls, 1);

  // 2) Canvas hover on layer inside collapsed group highlights both item and collapsed group
  sandbox.setSmartHoverCandidate({ kind: 'layer', id: 102, name: 'Sub', sceneId: 'sc-1', bounds: { x: 400, y: 200, w: 150, h: 100 }, fromList: false });
  assert.equal(itemA.classList.contains('canvas-hovered'), false);
  assert.equal(itemB.classList.contains('canvas-hovered'), true);
  assert.equal(grpEl.classList.contains('canvas-hovered'), true);

  // 3) Hovering a layer in the layer list sets canvas hover target (without double-toggling canvas-hovered class) and clears cleanly
  sandbox.hoverLayerFromList(102);
  assert.equal(sandbox._hoverCandidate.id, 102);
  assert.equal(sandbox._hoverCandidate.fromList, true);
  assert.equal(sandbox._hoverCandidate.isHidden, true);
  assert.equal(sandbox._hoverCandidate.bounds.x, 400);
  assert.equal(itemB.classList.contains('canvas-hovered'), false);

  sandbox.clearLayerHoverFromList(102);
  assert.equal(sandbox._hoverCandidate, null);
});
