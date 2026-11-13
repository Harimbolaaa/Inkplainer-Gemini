/* Deterministic SVG workshop model. Shared by preview, project playback and export. */
(function (root) {
  'use strict';
  const anime = root.anime || (typeof module === 'object' ? require('./vendor/anime.min.js') : null);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const numeric = (value, fallback, a, b) => Number.isFinite(Number(value)) ? clamp(Number(value), a, b) : fallback;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  const star = (count, outer, inner) => Array.from({ length: count * 2 }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI / count, r = i % 2 ? inner : outer;
    return `${i ? 'L' : 'M'}${(128 + Math.cos(a) * r).toFixed(3)} ${(128 + Math.sin(a) * r).toFixed(3)}`;
  }).join('') + 'Z';
  const polygon = count => Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / count;
    return `${i ? 'L' : 'M'}${(128 + Math.cos(a) * 92).toFixed(3)} ${(128 + Math.sin(a) * 92).toFixed(3)}`;
  }).join('') + 'Z';
  const shapes = [
    ['circle', 'Cercle', 'Géométrie', 'M220 128A92 92 0 1 1 36 128A92 92 0 1 1 220 128Z'],
    ['square', 'Carré', 'Géométrie', 'M40 40H216V216H40Z'],
    ['rounded', 'Carré arrondi', 'Géométrie', 'M68 40H188Q216 40 216 68V188Q216 216 188 216H68Q40 216 40 188V68Q40 40 68 40Z'],
    ['rectangle', 'Rectangle', 'Géométrie', 'M28 66H228V190H28Z'],
    ['ellipse', 'Ellipse', 'Géométrie', 'M228 128A100 66 0 1 1 28 128A100 66 0 1 1 228 128Z'],
    ['triangle', 'Triangle', 'Géométrie', 'M128 28L230 216H26Z'],
    ['diamond', 'Losange', 'Géométrie', 'M128 26L224 128L128 230L32 128Z'],
    ['pentagon', 'Pentagone', 'Géométrie', polygon(5)],
    ['hexagon', 'Hexagone', 'Géométrie', polygon(6)],
    ['octagon', 'Octogone', 'Géométrie', polygon(8)],
    ['star', 'Étoile', 'Symboles', star(5, 100, 43)],
    ['sparkle', 'Éclat', 'Symboles', star(4, 104, 30)],
    ['heart', 'Cœur', 'Symboles', 'M128 220C22 148 12 88 50 54C79 28 110 44 128 68C146 44 177 28 206 54C244 88 234 148 128 220Z'],
    ['arrow', 'Flèche', 'Symboles', 'M28 94H144V42L230 128L144 214V162H28Z'],
    ['chevron', 'Chevron', 'Symboles', 'M60 34L158 128L60 222H112L210 128L112 34Z'],
    ['plus', 'Plus', 'Symboles', 'M98 34H158V98H222V158H158V222H98V158H34V98H98Z'],
    ['check', 'Validation', 'Traits', 'M44 132L102 188L216 62', true],
    ['cross', 'Croix', 'Traits', 'M60 60L196 196M196 60L60 196', true],
    ['line', 'Ligne', 'Traits', 'M30 128H226', true],
    ['arc', 'Arc', 'Traits', 'M36 174A100 100 0 0 1 220 174', true],
    ['bubble', 'Bulle', 'Symboles', 'M58 42H198Q224 42 224 68V162Q224 188 198 188H110L58 226V188Q32 188 32 162V68Q32 42 58 42Z'],
    ['cloud', 'Nuage', 'Symboles', 'M62 198C4 198 8 122 56 118C48 44 150 22 178 98C246 82 258 198 198 198Z'],
    ['drop', 'Goutte', 'Symboles', 'M128 24C102 66 42 122 42 164A86 86 0 0 0 214 164C214 122 154 66 128 24Z'],
    ['bolt', 'Éclair', 'Symboles', 'M142 24L46 146H116L96 232L216 104H144L172 24Z'],
  ].map(([id, name, category, d, open = false]) => Object.freeze({ id, name, category, d, open }));
  const presets = [
    ['draw', 'Tracer', 'Les contours se dessinent, puis les couleurs apparaissent.', 'easeInOutSine'],
    ['fade', 'Fondu', 'Une apparition douce, avec une légère mise à l’échelle.', 'easeOutCubic'],
    ['pop', 'Pop élastique', 'Un rebond souple qui attire le regard.', 'easeOutElastic(1,.5)'],
    ['slide', 'Glisser', 'Une entrée latérale fluide.', 'easeOutCubic'],
    ['rise', 'Monter', 'Idéal pour faire apparaître les lettres une à une.', 'easeOutCubic'],
    ['float', 'Flotter', 'Un cycle aérien qui revient à sa pose initiale.', 'easeInOutSine'],
    ['pulse', 'Pulsation', 'Une respiration visuelle, sans déformation.', 'easeInOutSine'],
    ['spin', 'Rotation', 'Un tour complet, autour de son centre.', 'easeInOutSine'],
    ['swing', 'Balancer', 'Un mouvement de pendule léger.', 'easeInOutSine'],
    ['bounce', 'Rebondir', 'Un petit saut, puis un retour au sol.', 'easeInOutSine'],
    ['wave', 'Vague', 'Une onde qui parcourt les éléments ou les lettres.', 'easeInOutSine'],
    ['wipe', 'Révéler', 'Un dévoilement de gauche à droite.', 'easeInOutSine'],
    ['exit', 'Disparaître', 'Un fondu glissé pour fermer proprement une boucle.', 'easeInCubic'],
    ['hold', 'Pause', 'Conserver la forme visible avant la suite.', 'linear'],
  ].map(([id, name, description, easing]) => Object.freeze({ id, name, description, easing }));
  const easings = [
    ['linear', 'Linéaire'], ['easeInOutSine', 'Doux'], ['easeOutCubic', 'Décélération'],
    ['easeInCubic', 'Accélération'], ['easeOutExpo', 'Exponentiel'],
    ['easeOutBack', 'Dépassement'], ['easeOutElastic(1,.5)', 'Élastique'], ['easeOutBounce', 'Rebond'],
  ];
  const fonts = ['Geist', 'Caveat', 'Nunito', 'Merriweather', 'Space Mono', 'Arial'];
  function step(preset = 'draw', values = {}) {
    const p = presets.find(item => item.id === preset) || presets[0];
    return { id: `motion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, preset: p.id, duration: 1.2, hold: .15, amount: 1, easing: p.easing, ...values };
  }
  function create() {
    return {
      version: 1, kind: 'shape', name: 'Cercle animé', shape: 'circle', svg: '', text: 'Bonjour !',
      font: 'Geist', bold: true, letterSpacing: 0, fill: '#6366f1', stroke: '#25324b',
      strokeWidth: 4, noFill: false, preserveColors: true, scale: 1,
      mode: 'all', stagger: .06, loop: true, iterations: 1, yoyo: false, gap: .2,
      background: '#ffffff',
      steps: [step('draw', { duration: 1.2, hold: .2 }), step('float', { duration: 1.4, hold: .1 }), step('exit', { duration: .5, hold: .1 })],
    };
  }
  function normalize(value) {
    if (!value || value.version !== 1 || !['shape', 'svg', 'text'].includes(value.kind)) return null;
    if (value.kind === 'svg' && (typeof value.svg !== 'string' || !value.svg.trim() || value.svg.length > 2 * 1024 * 1024)) return null;
    const d = create();
    for (const key of ['kind', 'loop', 'yoyo', 'noFill', 'preserveColors', 'bold']) if (typeof value[key] === typeof d[key]) d[key] = value[key];
    d.shape = shapes.some(s => s.id === value.shape) ? value.shape : 'circle';
    d.name = String(value.name || shapes.find(s => s.id === d.shape).name).slice(0, 80);
    d.svg = value.kind === 'svg' ? value.svg : '';
    d.text = Array.from(String(value.text ?? d.text)).slice(0, 240).join('');
    d.font = fonts.includes(value.font) ? value.font : d.font;
    d.fill = color(value.fill, d.fill); d.stroke = color(value.stroke, d.stroke);
    d.background = value.background === 'transparent' ? 'transparent' : color(value.background, d.background);
    d.strokeWidth = numeric(value.strokeWidth, 4, 0, 20);
    d.scale = numeric(value.scale, 1, .35, 1.4);
    d.letterSpacing = numeric(value.letterSpacing, 0, -4, 20);
    d.mode = value.mode === 'parts' ? 'parts' : 'all';
    d.stagger = numeric(value.stagger, .06, 0, .5);
    d.iterations = Math.round(numeric(value.iterations, 1, 1, 20));
    d.gap = numeric(value.gap, .2, 0, 10);
    const ids = new Set();
    d.steps = (Array.isArray(value.steps) ? value.steps : []).slice(0, 64).filter(s => s && presets.some(p => p.id === s.preset)).map((s, i) => {
      const p = presets.find(p => p.id === s.preset);
      const id = /^[a-z0-9_-]{1,80}$/i.test(s.id || '') && !ids.has(s.id) ? s.id : `step-${i}`;
      ids.add(id);
      return {
        id, preset: p.id, duration: numeric(s.duration, 1.2, .15, 60),
        hold: numeric(s.hold, .15, 0, 30), amount: numeric(s.amount, 1, 0, 3),
        easing: easings.some(([id]) => id === s.easing) ? s.easing : p.easing,
      };
    });
    if (!d.steps.length) d.steps = [step()];
    return d;
  }
  function timing(data, partCount = 1) {
    const spread = data.mode === 'parts' ? Math.max(0, partCount - 1) * data.stagger : 0;
    let cursor = 0;
    const steps = data.steps.map(s => {
      const item = { ...s, start: cursor, active: s.duration + spread, end: cursor + s.duration + spread + s.hold };
      cursor = item.end;
      return item;
    });
    const cycle = cursor * (data.yoyo ? 2 : 1) + data.gap;
    return { steps, forward: cursor, cycle, total: cycle * data.iterations, spread };
  }
  const easeCache = new Map();
  function eased(value, name) {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    if (!easeCache.has(name)) easeCache.set(name, anime?.easing(name) || (t => t));
    return easeCache.get(name)(value);
  }
  function stateAt(data, time, index = 0, count = 1, compiledTiming) {
    const t = compiledTiming || timing(data, count);
    const elapsed = Math.max(0, Number(time) || 0);
    let position = elapsed % t.cycle;
    if (!data.loop && elapsed >= t.total) position = data.yoyo ? 0 : t.forward;
    else if (data.yoyo && position > t.forward) position = Math.max(0, 2 * t.forward - Math.min(position, 2 * t.forward));
    else position = Math.min(position, t.forward);
    const s = t.steps.find(s => position <= s.end) || t.steps[t.steps.length - 1];
    const delay = data.mode === 'parts' ? index * data.stagger : 0;
    const u = clamp((position - s.start - delay) / s.duration, 0, 1), p = eased(u, s.easing);
    const state = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, trim: 1, reveal: 1, fill: 1, step: s.id, progress: u };
    if (s.preset === 'draw') { state.trim = clamp(p, 0, 1); state.fill = clamp((u - .72) / .28, 0, 1); }
    if (s.preset === 'fade') { state.opacity = clamp(p, 0, 1); state.scaleX = state.scaleY = .94 + .06 * p; }
    if (s.preset === 'pop') { state.opacity = clamp(u * 5, 0, 1); state.scaleX = state.scaleY = Math.max(0, p); }
    if (s.preset === 'slide') { state.x = -70 * s.amount * (1 - p); state.opacity = clamp(p, 0, 1); }
    if (s.preset === 'rise') { state.y = 55 * s.amount * (1 - p); state.opacity = clamp(p, 0, 1); }
    if (s.preset === 'float') state.y = -22 * s.amount * Math.sin(p * Math.PI * 2);
    if (s.preset === 'pulse') state.scaleX = state.scaleY = 1 + .16 * s.amount * Math.sin(p * Math.PI);
    if (s.preset === 'spin') state.rotation = p * 360 * s.amount;
    if (s.preset === 'swing') state.rotation = 14 * s.amount * Math.sin(p * Math.PI * 2);
    if (s.preset === 'bounce') state.y = -45 * s.amount * Math.sin(p * Math.PI);
    if (s.preset === 'wave') state.y = -22 * s.amount * Math.sin(p * Math.PI * 2 + index * .7) * Math.sin(u * Math.PI);
    if (s.preset === 'wipe') state.reveal = clamp(p, 0, 1);
    if (s.preset === 'exit') { state.x = 65 * s.amount * p; state.opacity = clamp(1 - p, 0, 1); }
    return state;
  }
  function layout(data, width, height) {
    const scale = Math.min(352 / width, 352 / height) * data.scale;
    return { scale, x: (512 - width * scale) / 2, y: (512 - height * scale) / 2 };
  }
  const api = { shapes, presets, easings, fonts, create, normalize, step, timing, stateAt, layout, esc, clamp };
  root.SVGMotionCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
