const test = require('node:test');
const assert = require('node:assert/strict');
const assets = require('../studio-assets.js');

test('scene template catalog contains 300 varied offline editorial templates', () => {
  assert.equal(assets.templates.length, 300);
  assert.equal(new Set(assets.templates.map(template => template.id)).size, 300);
  assert.ok(new Set(assets.templates.map(template => template.layout)).size >= 12);
  assert.ok(new Set(assets.templates.map(template => template.style)).size >= 10);
  assert.ok(new Set(assets.templates.map(template => template.palette)).size >= 10);
  for (const template of assets.templates) {
    assert.ok(template.name);
    assert.ok(template.description);
    assert.ok(template.family);
    if (template.id.includes('-editorial-')) {
      assert.ok(template.layout);
      assert.ok(template.style);
      assert.ok(template.palette);
      assert.ok(template.artDirection);
    }
    assert.ok(template.items.length >= 3);
    for (const assetId of template.items) assert.ok(assets.getAssetById(assetId), `${template.id} references ${assetId}`);
  }
});

test('legacy scene template IDs remain compatible', () => {
  for (const id of ['pitch', 'education', 'reveal', 'startup', 'workflow', 'team', 'report', 'roadmap', 'care', 'journey', 'event', 'security']) {
    assert.ok(assets.templates.some(template => template.id === id));
  }
});
