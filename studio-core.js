/* Shared, DOM-independent animation math. Used by editing, playback and export. */
(function (root) {
  const channels = [
    { key: 'x', label: 'Position X', unit: 'px', step: 1 },
    { key: 'y', label: 'Position Y', unit: 'px', step: 1 },
    { key: 'resizePct', label: 'Scale', unit: '%', min: 0, max: 1000, step: 1 },
    { key: 'rotation', label: 'Rotation', unit: '°', step: 1 },
    { key: 'opacity', label: 'Opacity', unit: '%', min: 0, max: 1, step: .01 },
    { key: 'trimPath', label: 'Trim Paths', unit: '%', min: 0, max: 100, step: 1 },
  ];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const clone = value => JSON.parse(JSON.stringify(value));
  function ease(t, name = 'ease-in-out') {
    t = clamp(t, 0, 1);
    if (t === 0 || t === 1) return t;
    if (name === 'linear') return t;
    if (name === 'expo') return t < .5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
    if (name === 'spring') return 1 - Math.exp(-7 * t) * Math.cos(t * Math.PI * 4);
    if (name === 'bounce') {
      const d = 2.75, n = 7.5625;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) { t -= 1.5 / d; return n * t * t + .75; }
      if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + .9375; }
      t -= 2.625 / d; return n * t * t + .984375;
    }
    return t * t * (3 - 2 * t);
  }
  function channel(layer, key, time, fallback) {
    const frames = (layer.keyframes || []).filter(k => Number.isFinite(k[key])).sort((a, b) => a.time - b.time);
    if (!frames.length) return fallback;
    if (time <= frames[0].time) return frames[0][key];
    if (time >= frames[frames.length - 1].time) return frames[frames.length - 1][key];
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i];
      if (time <= b.time) {
        // Easing belongs to the outgoing segment, independently for each channel.
        const u = ease((time - a.time) / Math.max(.00001, b.time - a.time), a.easings?.[key] || a.easing);
        return a[key] + (b[key] - a[key]) * u;
      }
    }
    return fallback;
  }
  function evaluate(layer, time) {
    const result = {};
    for (const c of channels) {
      const fallback = layer[c.key] ?? ({ resizePct: 100, opacity: 1, trimPath: 100, rotation: 0 }[c.key] ?? 0);
      result[c.key] = channel(layer, c.key, time, fallback);
    }
    result.resizePct = Math.max(0, result.resizePct);
    result.opacity = clamp(result.opacity, 0, 1);
    result.trimPath = clamp(result.trimPath, 0, 100);
    result.w = (layer.baseW || layer.w) * result.resizePct / 100;
    result.h = (layer.baseH || layer.h) * result.resizePct / 100;
    return result;
  }
  function put(layer, key, time, value, easing = 'ease-in-out') {
    layer.keyframes ||= [];
    let frame = layer.keyframes.find(k => Math.abs(k.time - time) < .001);
    if (!frame) {
      frame = { id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, time };
      layer.keyframes.push(frame);
    }
    frame[key] = value;
    frame.easings = { ...(frame.easings || {}), [key]: easing };
    layer.keyframes.sort((a, b) => a.time - b.time);
    return frame;
  }
  const presets = [
    { id: 'draw', name: 'Dynamic Whiteboard Draw', group: 'Draw', easing: 'ease-in-out', frames: [
      [0, { trimPath: 0, opacity: .3 }], [.8, { trimPath: 100, opacity: 1 }], [1, { trimPath: 100, opacity: 1 }]] },
    { id: 'slide', name: 'Smooth Slide & Scale', group: 'Entrance', easing: 'ease-in-out', frames: [
      [0, { dx: -240, scale: .75, opacity: 0 }], [.75, { dx: 12, scale: 1.04, opacity: 1 }], [1, { dx: 0, scale: 1, opacity: 1 }]] },
    { id: 'pop', name: 'Elastic Pop-in', group: 'Entrance', easing: 'spring', frames: [
      [0, { scale: 0, opacity: 0 }], [.7, { scale: 1.08, opacity: 1 }], [1, { scale: 1, opacity: 1 }]] },
    { id: 'cinema', name: 'Cinematic Pan & Fade', group: 'Entrance', easing: 'expo', frames: [
      [0, { dx: -120, scale: 1.12, opacity: 0 }], [1, { dx: 0, scale: 1, opacity: 1 }]] },
    { id: 'drop', name: 'Bounce Drop', group: 'Entrance', easing: 'bounce', frames: [
      [0, { dy: -250, opacity: 0 }], [1, { dy: 0, opacity: 1 }]] },
    { id: 'spin', name: 'Spin Reveal', group: 'Entrance', easing: 'expo', frames: [
      [0, { rotation: -140, scale: .1, opacity: 0 }], [1, { rotation: 0, scale: 1, opacity: 1 }]] },
    { id: 'float', name: 'Gentle Float', group: 'Emphasis', easing: 'ease-in-out', frames: [
      [0, { dy: 0 }], [.5, { dy: -24 }], [1, { dy: 0 }]] },
    { id: 'pulse', name: 'Focus Pulse', group: 'Emphasis', easing: 'spring', frames: [
      [0, { scale: 1 }], [.4, { scale: 1.15 }], [1, { scale: 1 }]] },
    { id: 'trace', name: 'Trace & Settle', group: 'Draw', easing: 'linear', frames: [
      [0, { trimPath: 0, rotation: -5 }], [.8, { trimPath: 100, rotation: 0 }], [1, { trimPath: 100 }]] },
    { id: 'orbit', name: 'Orbit In', group: 'Entrance', easing: 'ease-in-out', frames: [
      [0, { dx: -150, dy: 100, rotation: -45, opacity: 0 }], [.5, { dx: -60, dy: -35, rotation: 12, opacity: 1 }], [1, { dx: 0, dy: 0, rotation: 0 }]] },
    { id: 'zoom', name: 'Expo Zoom', group: 'Entrance', easing: 'expo', frames: [
      [0, { scale: 1.8, opacity: 0 }], [1, { scale: 1, opacity: 1 }]] },
    { id: 'exit', name: 'Exit Swish', group: 'Exit', easing: 'expo', frames: [
      [0, { dx: 0, rotation: 0, opacity: 1 }], [1, { dx: 300, rotation: 18, opacity: 0 }]] },
  ];
  function applyPreset(layer, id, start, duration) {
    const preset = presets.find(p => p.id === id);
    if (!preset) return false;
    const base = { ...layer };
    const generated = preset.frames.map(([t, props]) => {
      const values = { ...props };
      if ('dx' in values) { values.x = base.x + values.dx; delete values.dx; }
      if ('dy' in values) { values.y = base.y + values.dy; delete values.dy; }
      if ('scale' in values) { values.resizePct = (base.resizePct ?? 100) * values.scale; delete values.scale; }
      return [start + t * duration, values];
    });
    const affected = new Set(generated.flatMap(([, values]) => Object.keys(values)));
    // Replace only affected channels inside the preset window; preserve all others.
    for (const k of layer.keyframes || []) {
      if (k.time >= start - .001 && k.time <= start + duration + .001) {
        affected.forEach(key => { delete k[key]; if (k.easings) delete k.easings[key]; });
      }
    }
    layer.keyframes = (layer.keyframes || []).filter(k => channels.some(c => Number.isFinite(k[c.key])));
    for (const [t, values] of generated) {
      for (const [key, value] of Object.entries(values)) put(layer, key, +t.toFixed(4), value, preset.easing);
    }
    return true;
  }
  function penPath(nodes, closed) {
    if (!nodes.length) return '';
    let d = `M${nodes[0].x} ${nodes[0].y}`;
    const segment = (a, b) => `C${a.outX} ${a.outY} ${b.inX} ${b.inY} ${b.x} ${b.y}`;
    for (let i = 1; i < nodes.length; i++) d += segment(nodes[i - 1], nodes[i]);
    if (closed && nodes.length > 2) d += segment(nodes[nodes.length - 1], nodes[0]) + 'Z';
    return d;
  }
  function normalizeVector(data) {
    if (!data) return undefined;
    if (Array.isArray(data.paths) && data.width > 0 && data.height > 0) return clone(data);
    // Earlier Make versions stored world-space pen points and a separate bounds box.
    if (Array.isArray(data.points) && data.bounds?.w > 0 && data.bounds?.h > 0) {
      const { x, y, w, h } = data.bounds;
      const nodes = data.points.map(p => ({
        x: p.x - x, y: p.y - y,
        inX: (p.inX ?? p.x) - x, inY: (p.inY ?? p.y) - y,
        outX: (p.outX ?? p.x) - x, outY: (p.outY ?? p.y) - y,
      }));
      return {
        width: w, height: h, stroke: data.stroke || '#182234', fill: data.fill || 'none',
        strokeWidth: data.width ?? 4, paths: [{ nodes, closed: !!data.closed, fill: !!data.closed }],
      };
    }
    return undefined;
  }
  root.StudioCore = { channels, clamp, clone, ease, evaluate, channel, put, presets, applyPreset, penPath, normalizeVector };
  if (typeof module !== 'undefined') module.exports = root.StudioCore;
})(typeof window === 'undefined' ? globalThis : window);
