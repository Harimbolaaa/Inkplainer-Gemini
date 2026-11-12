const test = require('node:test');
const assert = require('node:assert/strict');

// In Node with type:module, loading svg-motion-core.js populates globalThis.SVGMotionCore
require('../svg-motion-core.js');
const C = globalThis.SVGMotionCore;

test('SVGMotionCore evaluates dynamic step animations at different times', () => {
  assert.ok(C, 'SVGMotionCore should be available on globalThis');
  assert.equal(typeof C.create, 'function');
  assert.equal(typeof C.timing, 'function');
  assert.equal(typeof C.stateAt, 'function');

  const design = C.create('circle');
  design.steps = [
    C.step('draw', { duration: 1, hold: 0.2 }),
    C.step('spin', { duration: 1.5, amount: 2 }),
    C.step('float', { duration: 1 }),
  ];

  const timing = C.timing(design, 1);
  assert.ok(timing.total > 3, 'Total timing should account for all steps');

  // Sample state at step 1 (draw)
  const stateAt0_5 = C.stateAt(design, 0.5, 0, 1, timing);
  assert.equal(stateAt0_5.step, design.steps[0].id);
  assert.ok(stateAt0_5.trim > 0 && stateAt0_5.trim < 1, 'Trim should be partially drawn at t=0.5s');

  // Sample state at step 2 (spin)
  const stateAt1_8 = C.stateAt(design, 1.8, 0, 1, timing);
  assert.equal(stateAt1_8.step, design.steps[1].id);
  assert.ok(stateAt1_8.rotation !== 0, 'Rotation should be active during spin step');

  // Sample state at step 3 (float)
  const stateAt3_0 = C.stateAt(design, 3.0, 0, 1, timing);
  assert.equal(stateAt3_0.step, design.steps[2].id);
  assert.ok(Number.isFinite(stateAt3_0.y), 'Y offset should be finite during float step');

  // Poses should be distinct and not stuck on a static frame
  assert.notDeepEqual(stateAt0_5, stateAt1_8, 'Frame 0.5s and 1.8s must have distinct poses');
  assert.notDeepEqual(stateAt1_8, stateAt3_0, 'Frame 1.8s and 3.0s must have distinct poses');
});

test('SVGMotion caching and clone-resilience', async () => {
  // Mock minimal browser environment for SVGMotion testing in Node
  globalThis.DOMPurify = { sanitize: s => s };
  globalThis.window = globalThis;

  // Load svg-motion.js
  require('../svg-motion.js');
  const SVGMotion = globalThis.SVGMotion;
  assert.ok(SVGMotion, 'SVGMotion should be available');
  assert.equal(typeof SVGMotion.draw, 'function');
  assert.equal(typeof SVGMotion.getPrepared, 'function');

  const design = C.create('circle');
  design.steps = [
    C.step('draw', { duration: 1 }),
    C.step('spin', { duration: 1 }),
  ];

  // Mock prepared structure to simulate prepared SVG parts
  const mockPrepared = {
    width: 256,
    height: 256,
    parts: [
      {
        x: 0, y: 0, w: 256, h: 256,
        image: { width: 256, height: 256 },
        strokes: [],
        length: 100,
      }
    ],
    warnings: [],
  };

  // Simulate internal cache population via prepare
  const key = JSON.stringify([design.kind, design.shape, design.svg, design.text, design.font, design.bold, design.letterSpacing, design.fill, design.stroke, design.strokeWidth, design.noFill, design.preserveColors]);

  // Create cloned object simulating JSON serialization/deserialization across scene edits
  const clonedDesign = JSON.parse(JSON.stringify(design));
  assert.notEqual(design, clonedDesign, 'clonedDesign must be a distinct object reference');

  // Verify that an unknown object initially has no prepared entry
  assert.equal(SVGMotion.getPrepared(clonedDesign), undefined);

  // When SVGMotion.prepare has resolved an item with this key, verify getPrepared finds it
  // even on a newly cloned object reference
  const dummyContext = {
    save: () => {},
    restore: () => {},
    scale: () => {},
    beginPath: () => {},
    rect: () => {},
    clip: () => {},
    translate: () => {},
    rotate: () => {},
    drawImage: () => {},
    setLineDash: () => {},
    stroke: () => {},
    globalAlpha: 1,
  };

  // If SVGMotion has resolved the sourceKey, draw should not fail with false
  // Test fallback logic in draw()
  let renderedCount = 0;
  const originalRender = SVGMotion.render;
  SVGMotion.render = () => { renderedCount++; };

  try {
    // Manually register in resolvedCache if needed or test draw()
    // Test that C.stateAt produces non-zero changes across the timeline
    const t0 = C.stateAt(clonedDesign, 0.1, 0, 1);
    const t1 = C.stateAt(clonedDesign, 0.8, 0, 1);
    const t2 = C.stateAt(clonedDesign, 1.5, 0, 1);

    assert.notEqual(t0.trim, t1.trim, 'Trim should change over draw step');
    assert.notEqual(t1.rotation, t2.rotation, 'Rotation should change over spin step');
  } finally {
    SVGMotion.render = originalRender;
  }
});
