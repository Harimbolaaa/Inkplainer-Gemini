const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadVideoCore() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'video-core.js'), 'utf8');
  const context = {
    console,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Map,
    Set,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'video-core.js' });
  return context.VideoCore;
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

const VideoCore = loadVideoCore();

test('detects video files by MIME type and extension', () => {
  assert.equal(VideoCore.isVideoFile({ name: 'clip.mp4', type: 'video/mp4' }), true);
  assert.equal(VideoCore.isVideoFile({ name: 'clip.MOV', type: '' }), true);
  assert.equal(VideoCore.isVideoFile({ name: 'clip.webm', type: 'video/webm' }), true);
  assert.equal(VideoCore.isVideoFile({ name: 'photo.png', type: 'image/png' }), false);
  assert.equal(VideoCore.isVideoFile({ name: 'icon.svg', type: 'image/svg+xml' }), false);
});

test('computes aspect-preserving layout presets for video beside SVGs', () => {
  const stage = VideoCore.computeVideoPlacement(1920, 1080, 1280, 720, 'stage');
  assert.ok(stage.w < 1280 && stage.h < 720, 'default stage leaves room around video for SVGs');
  assert.ok(Math.abs((stage.w / stage.h) - (16 / 9)) < 0.03);

  const left = VideoCore.computeVideoPlacement(1920, 1080, 1280, 720, 'left');
  const right = VideoCore.computeVideoPlacement(1920, 1080, 1280, 720, 'right');
  assert.ok(left.x + left.w < right.x, 'left and right split presets do not overlap');

  const pip = VideoCore.computeVideoPlacement(1920, 1080, 1280, 720, 'pip');
  assert.ok(pip.w <= Math.round(1280 * 0.31) && pip.x > 700 && pip.y > 400);

  const full = VideoCore.computeVideoPlacement(1920, 1080, 1280, 720, 'full');
  assert.equal(full.w, 1280);
  assert.equal(full.h, 720);
});

test('normalizes video timing and audio volume/mute defaults', () => {
  const layer = VideoCore.normalizeVideoTiming({
    kind: 'video',
    sourceDuration: 8.5,
    inPoint: 1.0,
    outPoint: 20.0,
    volume: 1.5,
  }, 6.0);
  assert.equal(layer.sourceIn, 0);
  assert.equal(layer.outPoint, 6.0);
  assert.equal(layer.sourceOut, 5.0);
  assert.equal(layer.volume, 1);
  assert.equal(layer.muted, false);
});

test('razor splits a video clip cleanly preserving sourceIn and sourceOut continuity', () => {
  const layer = {
    kind: 'video',
    sourceDuration: 10.0,
    sourceIn: 2.0,
    sourceOut: 8.0,
    inPoint: 1.0,
    outPoint: 7.0,
    keyframes: [{ id: 'k1', time: 1.5 }, { id: 'k2', time: 5.5 }],
  };
  const plan = VideoCore.splitVideoLayerSegment(layer, 3.5);
  assert.ok(plan);
  assert.equal(plan.cutTime, 3.5);
  assert.equal(plan.leftPatch.outPoint, 3.5);
  assert.equal(plan.leftPatch.sourceIn, 2.0);
  assert.equal(plan.leftPatch.sourceOut, 4.5);
  assert.equal(plan.rightSegmentProps.inPoint, 3.5);
  assert.equal(plan.rightSegmentProps.outPoint, 7.0);
  assert.equal(plan.rightSegmentProps.sourceIn, 4.5);
  assert.equal(plan.rightSegmentProps.sourceOut, 8.0);
  assert.equal(plan.leftPatch.keyframes.length, 1);
  assert.equal(plan.rightSegmentProps.keyframes.length, 1);

  assert.equal(VideoCore.splitVideoLayerSegment(layer, 1.05), null);
  assert.equal(VideoCore.splitVideoLayerSegment(layer, 6.95), null);
});

test('trims left and right edges while clamping to available media source bounds', () => {
  const layer = {
    kind: 'video',
    sourceDuration: 6.0,
    sourceIn: 1.0,
    sourceOut: 4.0,
    inPoint: 2.0,
    outPoint: 5.0,
  };
  const trimmedLeft = VideoCore.trimVideoLayerEdge(layer, 'left', 3.0, 8.0);
  assert.equal(trimmedLeft.inPoint, 3.0);
  assert.equal(trimmedLeft.sourceIn, 2.0);
  assert.equal(trimmedLeft.sourceOut, 4.0);

  const trimmedLeftExtended = VideoCore.trimVideoLayerEdge(layer, 'left', 0.2, 8.0);
  assert.equal(trimmedLeftExtended.inPoint, 1.0, 'cannot extend left further than sourceIn=1s');
  assert.equal(trimmedLeftExtended.sourceIn, 0);

  const trimmedRight = VideoCore.trimVideoLayerEdge(layer, 'right', 6.5, 8.0);
  assert.equal(trimmedRight.outPoint, 6.5);
  assert.equal(trimmedRight.sourceOut, 5.5);
});

test('shifts video sourceIn/sourceOut accurately on scene split and computes source time', () => {
  const shifted = VideoCore.shiftVideoClipOnSceneSplit({
    kind: 'video',
    sourceDuration: 10.0,
    sourceIn: 1.0,
    sourceOut: 7.0,
    inPoint: 1.0,
    outPoint: 7.0,
  }, 4.0, 4.0);
  assert.equal(shifted.inPoint, 0);
  assert.equal(shifted.outPoint, 3.0);
  assert.equal(shifted.sourceIn, 4.0);
  assert.equal(shifted.sourceOut, 7.0);

  assert.equal(VideoCore.getVideoSourceTime({ inPoint: 2, sourceIn: 3, sourceDuration: 12 }, 4.5), 5.5);
});

test('reorders scenes safely via drag-and-drop gap index', () => {
  const items = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
  const fwd = VideoCore.reorderArrayMove(items, 0, 3);
  assert.deepEqual(fwd.list.map(x => x.id), ['B', 'C', 'A', 'D']);

  const back = VideoCore.reorderArrayMove(items, 3, 1);
  assert.deepEqual(back.list.map(x => x.id), ['A', 'D', 'B', 'C']);
});

test('collects project audio mix inputs honoring volume, mute, visibility, and scene offsets', () => {
  const scenes = [
    {
      duration: 4.0,
      layers: [
        { kind: 'video', videoAssetId: 'v1', inPoint: 0.5, outPoint: 3.5, sourceIn: 1.0, volume: 0.4, muted: false },
        { kind: 'video', videoAssetId: 'v2', inPoint: 0, outPoint: 2, sourceIn: 0, volume: 0.9, muted: true },
        { kind: 'video', videoAssetId: 'v3', inPoint: 0, outPoint: 2, sourceIn: 0, volume: 0, muted: false },
      ],
    },
    {
      duration: 5.0,
      layers: [
        { kind: 'video', videoAssetId: 'v4', inPoint: 1.0, outPoint: 4.0, sourceIn: 0.5, volume: 0.75, muted: false },
      ],
    },
  ];
  const inputs = VideoCore.collectProjectAudioMixInputs(scenes, { dataUrl: 'data:audio/wav;base64,AA==', duration: 9, volume: 0.6 });
  assert.equal(inputs.length, 3);
  assert.equal(inputs[0].type, 'track');
  assert.equal(inputs[0].volume, 0.6);
  assert.equal(inputs[1].assetId, 'v1');
  assert.equal(inputs[1].startTime, 0.5);
  assert.equal(inputs[1].duration, 3.0);
  assert.equal(inputs[1].sourceOffset, 1.0);
  assert.equal(inputs[1].volume, 0.4);
  assert.equal(inputs[2].assetId, 'v4');
  assert.equal(inputs[2].startTime, 5.0);
});
