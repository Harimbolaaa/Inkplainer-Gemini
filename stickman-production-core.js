/* Pure production timeline math shared by editing, preview, thumbnails, and export. */
(function (root) {
  'use strict';
  const VERSION = 2;
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  function ease(t, name = 'smooth') {
    t = clamp(Number(t) || 0, 0, 1);
    if (name === 'linear') return t;
    if (name === 'ease-in') return t * t;
    if (name === 'ease-out') return 1 - (1 - t) * (1 - t);
    if (name === 'step') return t < 1 ? 0 : 1;
    if (name === 'ease-in-out') return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    if (name === 'bezier') return cubicBezier(t, .25, .1, .25, 1);
    if (name === 'spring') return 1 - Math.exp(-7 * t) * Math.cos(t * Math.PI * 4);
    return t * t * (3 - 2 * t);
  }
  function cubicBezier(t, x1, y1, x2, y2) {
    t = clamp(Number(t) || 0, 0, 1);
    let low = 0, high = 1, u = t;
    for (let i = 0; i < 16; i++) {
      u = (low + high) / 2;
      const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
      if (x < t) low = u; else high = u;
    }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  }
  function framesFromSeconds(seconds, fps = 30) { return Math.max(0, Math.round((Number(seconds) || 0) * Math.max(1, Number(fps) || 30))); }
  function secondsFromFrames(frame, fps = 30) { return Math.max(0, Number(frame) || 0) / Math.max(1, Number(fps) || 30); }
  function normalizeFrame(frame, fps = 30, duration = Infinity) { return clamp(Math.round(Number(frame) || 0), 0, Number.isFinite(duration) ? framesFromSeconds(duration, fps) : Number.MAX_SAFE_INTEGER); }
  function keyframes(value) { return Array.isArray(value) ? value.filter(frame => Number.isFinite(frame.time)).slice().sort((a, b) => a.time - b.time) : []; }
  function interpolateKeyframes(frames, time, defaults = {}, easing = 'smooth') {
    const list = keyframes(frames);
    if (!list.length) return clone(defaults);
    if (time <= list[0].time) return { ...clone(defaults), ...clone(list[0]) };
    if (time >= list[list.length - 1].time) return { ...clone(defaults), ...clone(list[list.length - 1]) };
    let before = list[0], after = list[list.length - 1];
    for (let i = 1; i < list.length; i++) {
      if (time <= list[i].time) { before = list[i - 1]; after = list[i]; break; }
    }
    const u = ease((time - before.time) / Math.max(.00001, after.time - before.time), before.easing || easing);
    const result = { ...clone(defaults) };
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    keys.delete('id'); keys.delete('time'); keys.delete('easing');
    for (const key of keys) {
      const a = before[key], b = after[key];
      if (Number.isFinite(a) && Number.isFinite(b)) result[key] = a + (b - a) * u;
      else result[key] = u < .5 ? clone(a ?? b) : clone(b ?? a);
    }
    return result;
  }
  function defaultProduction() {
    return {
      version: VERSION, fps: 30, durationFrames: 150, tracks: [], camera: { x: 0, y: 0, zoom: 1, rotation: 0, keyframes: [], preset: 'wide' },
      effects: [], captions: [], titleCards: [], audioClips: [], markers: [], duration: 5,
    };
  }
  const effectDefaults = {
    type: 'impact', start: 0, duration: 1, opacity: .8, color: '#ffffff', x: 0, y: 0,
    count: 18, radius: 80, rise: 80, size: 5, speed: 120, gravity: 30, spread: 1,
    quality: 'standard', seed: 1, blendMode: 'source-over', keyframes: [], visible: true, locked: false,
  };
  function normalizeEffect(effect, index, duration) {
    const result = { ...clone(effectDefaults), ...clone(effect || {}) };
    result.id ||= uid(`effect-${index}`);
    result.name ||= `${String(result.type).replace(/[-_]/g, ' ')} ${index + 1}`;
    result.start = clamp(Number(result.start) || 0, 0, duration);
    result.duration = Math.max(.01, Math.min(Number(result.duration) || 1, Math.max(.01, duration - result.start)));
    result.count = clamp(Math.round(Number(result.count) || 18), 1, result.quality === 'draft' ? 80 : result.quality === 'high' ? 600 : 240);
    result.keyframes = keyframes(result.keyframes);
    return result;
  }
  function normalizeProduction(value, duration = 5) {
    const result = { ...defaultProduction(), ...clone(value || {}) };
    result.version = VERSION; result.fps = Math.max(1, Math.round(Number(result.fps) || 30)); result.duration = Math.max(.5, Number(result.duration) || Number(duration) || 5);
    result.durationFrames = Math.max(1, Math.round(Number(result.durationFrames) || framesFromSeconds(result.duration, result.fps)));
    result.tracks = Array.isArray(result.tracks) ? result.tracks.map((track, index) => ({
      ...track,
      id: track.id || uid(`track-${index}`), type: track.type || 'character', name: track.name || `Track ${index + 1}`,
      visible: track.visible !== false, locked: track.locked === true, muted: track.muted === true,
      inPoint: clamp(Number(track.inPoint) || 0, 0, result.duration),
      outPoint: clamp(Number(track.outPoint) || result.duration, 0, result.duration),
      inFrame: normalizeFrame(track.inFrame ?? framesFromSeconds(track.inPoint || 0, result.fps), result.fps, result.duration),
      outFrame: normalizeFrame(track.outFrame ?? framesFromSeconds(track.outPoint ?? result.duration, result.fps), result.fps, result.duration),
      ownerId: track.ownerId || track.character?.id || null,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, ...(track.transform || {}) },
      fps: Math.max(1, Math.round(Number(track.fps) || result.fps)),
      propertyChannels: track.propertyChannels || {},
      order: Number.isFinite(track.order) ? track.order : index,
    })).sort((a, b) => a.order - b.order) : [];
    result.camera = { ...defaultProduction().camera, ...(result.camera || {}) };
    result.camera.keyframes = keyframes(result.camera.keyframes);
    result.camera.keyframes = result.camera.keyframes.map(frame => ({ ...frame, frame: normalizeFrame(frame.frame ?? framesFromSeconds(frame.time, result.fps), result.fps, result.duration) }));
    for (const key of ['captions', 'titleCards', 'audioClips', 'markers']) if (!Array.isArray(result[key])) result[key] = [];
    result.effects = Array.isArray(result.effects) ? result.effects.map((effect, index) => normalizeEffect(effect, index, result.duration)) : [];
    return result;
  }
  function evaluateCamera(camera, time, context = {}) {
    const value = interpolateKeyframes(camera?.keyframes, time, {
      x: camera?.x || 0, y: camera?.y || 0, zoom: camera?.zoom || 1, rotation: camera?.rotation || 0,
    });
    const follow = context.followPosition || (camera?.followTarget && context.targets?.[camera.followTarget]);
    if (follow) {
      const smooth = clamp(Number(camera.followSmoothing ?? .18), .01, 1);
      value.x += Number(follow.x || 0) * smooth;
      value.y += Number(follow.y || 0) * smooth;
    }
    const seed = Number(camera?.seed || 1), random = seeded(seed + Math.floor(Math.max(0, time) * 60));
    const shake = Math.max(0, Number(camera?.shake || 0)) * (Number(camera?.shakeDecay ?? 1));
    const pulse = Number(camera?.zoomPulse || 0) * Math.sin(time * Math.PI * 2 * (Number(camera?.pulseFrequency) || 2));
    if (shake) { value.x += (random() - .5) * shake; value.y += (random() - .5) * shake; value.rotation += (random() - .5) * shake * .05; }
    value.zoom = Math.max(.05, Number(value.zoom) || 1) + pulse;
    value.rotation += Number(camera?.impactZoom || 0) * Math.max(0, 1 - time / Math.max(.01, Number(camera?.impactDuration) || 1));
    value.zoom = Math.max(.05, Number(value.zoom) || 1);
    return value;
  }
  function trackAt(production, time) {
    return (production?.tracks || []).filter(track => track.visible !== false && time >= (track.inPoint || 0) && time <= (track.outPoint ?? production.duration));
  }
  function snapTime(time, production, options = {}) {
    const duration = Number(options.duration || production?.duration || 5);
    const threshold = Number(options.threshold ?? .08);
    const points = [0, duration, ...(production?.markers || []).map(marker => marker.time), ...(production?.tracks || []).flatMap(track => [track.inPoint, track.outPoint]), ...(production?.tracks || []).flatMap(track => keyframes(track.keyframes).map(frame => frame.time))].filter(Number.isFinite);
    const nearest = points.reduce((best, point) => Math.abs(point - time) < Math.abs(best - time) ? point : best, points[0] ?? time);
    return Math.abs(nearest - time) <= threshold ? clamp(nearest, 0, duration) : clamp(time, 0, duration);
  }
  function addKeyframe(track, frame) {
    if (!track || (!Number.isFinite(frame?.time) && !Number.isFinite(frame?.frame))) return false;
    track.keyframes ||= [];
    const fps = Number(track.fps || 30), normalized = { ...clone(frame), frame: normalizeFrame(frame.frame ?? framesFromSeconds(frame.time, fps), fps), time: secondsFromFrames(frame.frame ?? framesFromSeconds(frame.time, fps), fps) };
    const existing = track.keyframes.find(item => (Number.isFinite(normalized.frame) && item.frame === normalized.frame) || Math.abs(item.time - normalized.time) < .001);
    if (existing) Object.assign(existing, normalized);
    else track.keyframes.push({ id: frame.id || uid('keyframe'), easing: 'smooth', ...normalized });
    track.keyframes.sort((a, b) => (a.frame ?? framesFromSeconds(a.time, fps)) - (b.frame ?? framesFromSeconds(b.time, fps)));
    return true;
  }
  function duplicateKeyframe(track, frame) { if (!track?.keyframes || !frame) return null; const copy = clone(frame); copy.id = uid('keyframe'); track.keyframes.push(copy); track.keyframes.sort((a, b) => (a.frame ?? a.time) - (b.frame ?? b.time)); return copy; }
  function copyKeyframe(track, frame) { return track?.keyframes && frame ? clone(track.keyframes.find(item => item.id === frame.id || item.frame === frame.frame) || frame) : null; }
  function pasteKeyframe(track, clipboard, frame) { if (!track || !clipboard) return null; const copy = clone(clipboard); copy.id = uid('keyframe'); copy.frame = normalizeFrame(frame, track.fps || 30); copy.time = secondsFromFrames(copy.frame, track.fps || 30); addKeyframe(track, copy); return copy; }
  function holdKeyframe(track, frame, durationFrames = 1) { const source = copyKeyframe(track, frame); if (!source) return false; const fps = track.fps || 30; for (let i = 1; i < Math.max(1, durationFrames); i++) pasteKeyframe(track, source, (source.frame ?? framesFromSeconds(source.time, fps)) + i); return true; }
  function deleteKeyframe(track, frame) { if (!track?.keyframes) return false; const before = track.keyframes.length; track.keyframes = track.keyframes.filter(item => item.id !== frame?.id && item.frame !== frame?.frame); return track.keyframes.length !== before; }
  function reverseKeyframes(track, durationFrames) { if (!track?.keyframes) return false; track.keyframes.forEach(frame => { frame.frame = Math.max(0, durationFrames - (frame.frame ?? 0)); frame.time = secondsFromFrames(frame.frame, track.fps || 30); }); track.keyframes.sort((a, b) => a.frame - b.frame); return true; }
  function retimeKeyframes(track, factor = 1) { if (!track?.keyframes) return false; track.keyframes.forEach(frame => { frame.frame = Math.max(0, Math.round((frame.frame ?? 0) * Math.max(.01, Number(factor) || 1))); frame.time = secondsFromFrames(frame.frame, track.fps || 30); }); track.keyframes.sort((a, b) => a.frame - b.frame); return true; }
  function samplePath(path, progress) {
    const points = Array.isArray(path?.points) ? path.points : [];
    if (points.length < 2) return clone(points[0] || { x: 0, y: 0 });
    const t = clamp(progress, 0, 1), scaled = t * (points.length - 1), index = Math.min(points.length - 2, Math.floor(scaled)), u = scaled - index;
    const a = points[index], b = points[index + 1], c = a.cp2 || a, d = b.cp1 || b;
    const mix = (p, q, r, s) => p * (1 - u) ** 3 + 3 * q * (1 - u) ** 2 * u + 3 * r * (1 - u) * u ** 2 + s * u ** 3;
    return { x: mix(a.x, c.x, d.x, b.x), y: mix(a.y, c.y, d.y, b.y) };
  }
  function evaluatePath(path, frame, start = 0, end = 30) { return samplePath(path, (frame - start) / Math.max(1, end - start)); }
  function duplicateTrack(production, trackId) {
    const source = production?.tracks?.find(track => track.id === trackId);
    if (!source) return null;
    const copy = clone(source); copy.id = uid('track'); copy.name = `${source.name} copy`; copy.order = production.tracks.length;
    production.tracks.push(copy); return copy;
  }
  function moveTrack(production, trackId, direction) {
    const index = production?.tracks?.findIndex(track => track.id === trackId);
    if (index < 0) return false;
    const target = clamp(index + (direction === 'up' ? -1 : 1), 0, production.tracks.length - 1);
    if (target === index) return true;
    const [track] = production.tracks.splice(index, 1); production.tracks.splice(target, 0, track);
    production.tracks.forEach((item, order) => { item.order = order; }); return true;
  }
  function seeded(seed = 1) {
    let value = (Number(seed) || 1) >>> 0;
    return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
  }
  function effectSamples(effect, time, count = effect?.count || 16) {
    const random = seeded(effect?.seed || 1), start = Number(effect?.start) || 0, duration = Math.max(.001, Number(effect?.duration) || 1);
    const t = clamp((time - start) / duration, 0, 1), result = [];
    for (let i = 0; i < count; i++) result.push({
      x: (Number(effect?.x) || 0) + (random() - .5) * (Number(effect?.radius) || 80) * t,
      y: (Number(effect?.y) || 0) - random() * (Number(effect?.rise) || 80) * t,
      size: (Number(effect?.size) || 5) * (1 - t * .35), alpha: (1 - t) * (Number(effect?.opacity) || .6),
    });
    return result;
  }
  const api = { VERSION, clone, clamp, ease, cubicBezier, framesFromSeconds, secondsFromFrames, normalizeFrame, keyframes, interpolateKeyframes, effectDefaults, normalizeEffect, defaultProduction, normalizeProduction, evaluateCamera, trackAt, snapTime, addKeyframe, duplicateKeyframe, copyKeyframe, pasteKeyframe, holdKeyframe, deleteKeyframe, reverseKeyframes, retimeKeyframes, samplePath, evaluatePath, duplicateTrack, moveTrack, seeded, effectSamples, uid };
  root.StickmanProductionCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
