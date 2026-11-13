/* One hundred original, editable, offline production templates. */
(function (root) {
  'use strict';
  const core = root.StickmanCore;
  if (!core) return;
  const clone = value => JSON.parse(JSON.stringify(value));
  const categories = ['Dialogue', 'Tutorial', 'Action', 'Fight', 'Chase', 'Reaction', 'Title', 'Shorts', 'Cinematic', 'Comedy'];
  const styles = ['clean', 'ink', 'neon', 'warm', 'minimal', 'bold', 'noir', 'pastel', 'marker', 'dramatic'];
  const classes = ['conversation', 'explanation', 'combat', 'movement', 'reaction', 'hook', 'lesson', 'story', 'vertical', 'comedy'];
  const names = ['First Contact', 'The Reveal', 'Quick Lesson', 'Big Question', 'Street Chase', 'Two-Step Punch', 'Quiet Before', 'Surprise Turn', 'Fast Tutorial', 'Victory Beat'];
  function template(index) {
    const category = categories[index % categories.length], style = styles[index % styles.length], className = classes[index % classes.length];
    const duration = 3 + (index % 5), name = `${names[index % names.length]} ${Math.floor(index / 10) + 1}`;
    const left = core.createCharacter({ id: `tpl-${index}-a`, name: 'Lead', color: index % 2 ? '#c2410c' : '#172033', root: { x: 360, y: 430 } });
    const right = core.createCharacter({ id: `tpl-${index}-b`, name: 'Partner', color: '#2563eb', root: { x: 820, y: 430 } });
    left.motion = { name: index % 3 === 0 ? 'walk' : index % 3 === 1 ? 'punch' : 'idle', start: 0, duration, loop: true };
    right.motion = { name: index % 2 ? 'reaction' : 'idle', start: 0, duration, loop: true };
    left.keyframes = [{ time: 0, pose: core.capturePose(left) }, { time: duration, pose: core.capturePose(left) }];
    right.keyframes = [{ time: 0, pose: core.capturePose(right) }, { time: duration, pose: core.capturePose(right) }];
    return {
      id: `production-template-${String(index + 1).padStart(3, '0')}`, name, category, style, class: className,
      duration, characters: [left, right],
      camera: { preset: index % 4 === 0 ? 'close-up' : index % 4 === 1 ? 'action' : 'wide', x: 0, y: 0, zoom: 1, rotation: 0, keyframes: [
        { time: 0, x: index % 2 ? -25 : 0, y: 0, zoom: index % 4 === 0 ? 1.35 : 1, rotation: 0 },
        { time: duration, x: index % 2 ? 25 : 0, y: index % 3 === 0 ? -12 : 0, zoom: index % 4 === 3 ? 1.25 : 1, rotation: 0 },
      ] },
      effects: [
        { id: `effect-${index}-a`, type: index % 3 === 0 ? 'speed-lines' : index % 3 === 1 ? 'dust' : 'impact', start: Math.max(0, duration / 2 - .35), duration: .7, count: 16 },
      ],
      captions: [{ id: `caption-${index}`, text: category === 'Dialogue' ? 'Your move.' : category === 'Tutorial' ? 'Step by step.' : 'Keep moving.', start: .35, end: Math.min(duration, 2.2), size: 28 }],
      titleCards: index % 5 === 0 ? [{ id: `title-${index}`, text: name, start: 0, end: 1.2 }] : [],
    };
  }
  const templates = Array.from({ length: 100 }, (_, index) => template(index));
  function get(id) { return templates.find(item => item.id === id); }
  function search(query = {}) {
    const text = String(query.text || '').toLowerCase();
    return templates.filter(item => (!query.category || item.category === query.category) && (!query.style || item.style === query.style) && (!query.className || item.class === query.className) && (!text || `${item.name} ${item.category} ${item.style} ${item.class}`.toLowerCase().includes(text))).map(clone);
  }
  root.StickmanTemplates = { version: 1, categories, styles, classes, templates, get, search, clone };
  if (typeof module !== 'undefined') module.exports = root.StickmanTemplates;
})(typeof window === 'undefined' ? globalThis : window);
