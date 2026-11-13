const test = require('node:test');
const assert = require('node:assert/strict');
require('../stickman-core.js');
const templates = require('../stickman-templates.js');

test('production template catalog has 100 editable offline templates', () => {
  assert.equal(templates.templates.length, 100);
  assert.equal(new Set(templates.templates.map(item => item.id)).size, 100);
  for (const item of templates.templates) {
    assert.ok(item.name && item.category && item.style && item.class);
    assert.ok(item.duration > 0);
    assert.equal(item.characters.length, 2);
    assert.ok(item.characters.every(character => character.rig.bones.length > 0 && character.keyframes.length >= 2));
    assert.ok(item.camera.keyframes.length >= 2);
    assert.ok(item.effects.length);
  }
});

test('template search returns deep editable copies', () => {
  const result = templates.search({ category: 'Action' });
  assert.ok(result.length >= 10);
  result[0].characters[0].name = 'Changed';
  assert.notEqual(result[0].characters[0].name, templates.search({ category: 'Action' })[0].characters[0].name);
});
