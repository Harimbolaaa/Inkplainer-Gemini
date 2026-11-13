/* Integrated local production controls for scene-local stickman tracks. */
(function (root) {
  'use strict';
  const core = root.StickmanCore;
  if (!core) return;
  const productionCore = root.StickmanProductionCore;
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let dialog, activeSceneId, recorder, recordingChunks = [], previewRaf = 0, previewPlaying = false, previewTime = 0;
  function appState() { try { return state; } catch (_) { return root.state || null; } }

  function defaultProduction() {
    return productionCore?.defaultProduction?.() || {
      version: 1, tracks: [], camera: { x: 0, y: 0, zoom: 1, rotation: 0, keyframes: [], preset: 'wide' },
      effects: [], captions: [], titleCards: [], audioClips: [], markers: [],
    };
  }
  function refreshTracks() {
    const list = dialog?.querySelector('[data-tracks]'), scene = activeScene(); if (!list || !scene) return;
    const p = production(scene);
    list.replaceChildren(...p.tracks.map(track => {
      const row = document.createElement('div'); row.className = 'production-track';
      row.innerHTML = `<span class="production-track-name">${track.name || track.type}</span><span class="production-track-frames">${track.keyframes?.length || 0} keys</span><label>In <input data-in type="number" min="0" step=".1" value="${Number(track.inPoint || 0).toFixed(1)}"></label><label>Out <input data-out type="number" min=".1" step=".1" value="${Number(track.outPoint ?? p.duration).toFixed(1)}"></label><button type="button" data-up title="Move track up">↑</button><button type="button" data-down title="Move track down">↓</button><button type="button" data-duplicate>Duplicate</button><button type="button" data-keyframe title="Add a keyframe at the current playhead">+ Key</button><button type="button" data-reverse title="Reverse keyframes">Reverse</button><button type="button" data-visible>${track.visible === false ? 'Show' : 'Hide'}</button><button type="button" data-lock>${track.locked ? 'Unlock' : 'Lock'}</button><button type="button" data-delete>Delete</button>`;
      row.querySelector('[data-up]').onclick = () => { productionCore?.moveTrack?.(p, track.id, 'up'); refreshTracks(); };
      row.querySelector('[data-down]').onclick = () => { productionCore?.moveTrack?.(p, track.id, 'down'); refreshTracks(); };
      row.querySelector('[data-duplicate]').onclick = () => { productionCore?.duplicateTrack?.(p, track.id); refreshTracks(); };
      row.querySelector('[data-visible]').onclick = () => { track.visible = track.visible === false; refreshTracks(); };
      row.querySelector('[data-lock]').onclick = () => { track.locked = !track.locked; refreshTracks(); root.TimelineStudio?.renderTimeline?.(); root.TimelineStudio?.autoSaveToLocalStorage?.(); };
      row.querySelector('[data-delete]').onclick = () => { p.tracks = p.tracks.filter(item => item.id !== track.id); refreshTracks(); refreshSceneInfo(); root.TimelineStudio?.renderTimeline?.(); root.TimelineStudio?.autoSaveToLocalStorage?.(); setStatus(`Deleted ${track.name || 'track'}.`); };
      row.querySelector('[data-in]').onchange = event => {
        if (track.locked) return setStatus('Unlock the track before editing its timing.');
        track.inPoint = Math.max(0, Math.min(Number(event.target.value) || 0, track.outPoint - .01));
        refreshTracks(); root.TimelineStudio?.renderTimeline?.(); root.TimelineStudio?.autoSaveToLocalStorage?.();
      };
      row.querySelector('[data-out]').onchange = event => {
        if (track.locked) return setStatus('Unlock the track before editing its timing.');
        track.outPoint = Math.max(track.inPoint + .01, Math.min(Number(event.target.value) || p.duration, p.duration));
        refreshTracks(); root.TimelineStudio?.renderTimeline?.(); root.TimelineStudio?.autoSaveToLocalStorage?.();
      };
      row.querySelector('[data-keyframe]').onclick = () => {
        if (track.locked) return setStatus('Unlock the track before adding a keyframe.');
        const time = productionCore?.snapTime?.(currentTime(), p) ?? currentTime();
        const character = track.character;
        const pose = character?.pose || (character?.joints ? { joints: clone(character.joints) } : null);
        if (pose && productionCore?.addKeyframe) {
          productionCore.addKeyframe(track, { time, pose: clone(pose) });
          refreshTracks(); root.TimelineStudio?.renderTimeline?.(); root.TimelineStudio?.autoSaveToLocalStorage?.(); setStatus(`Keyframe added to ${track.name || 'track'} at ${time.toFixed(2)}s.`);
        }
      };
      row.querySelector('[data-reverse]').onclick = () => {
        if (track.locked) return setStatus('Unlock the track before reversing keyframes.');
        productionCore?.reverseKeyframes?.(track, p.durationFrames || Math.round(p.duration * p.fps));
        refreshTracks(); root.TimelineStudio?.renderTimeline?.(); root.TimelineStudio?.autoSaveToLocalStorage?.(); setStatus(`Reversed ${track.name || 'track'} keyframes.`);
      };
      return row;
    }));
  }
  function refreshSceneInfo() {
    const node = dialog?.querySelector('[data-scene-info]'), scene = activeScene();
    if (!node || !scene) return;
    const p = production(scene);
    node.innerHTML = `<div class="production-scene-card"><strong>${scene.name || 'Active scene'}</strong><span>${Number(scene.duration || p.duration || 0).toFixed(1)}s</span><small>${p.tracks.length} character track${p.tracks.length === 1 ? '' : 's'} · ${p.effects.length} effect${p.effects.length === 1 ? '' : 's'} · ${p.captions.length} caption${p.captions.length === 1 ? '' : 's'}</small><div class="production-scene-actions"><button type="button" data-preview-scene>Preview this scene</button><button type="button" data-edit-characters>Edit characters</button></div></div>`;
    node.querySelector('[data-preview-scene]').onclick = () => {
      dialog.close();
      root.TimelineStudio?.startPreviewAll?.();
    };
    node.querySelector('[data-edit-characters]').onclick = () => {
      dialog.close();
      root.StickmanStudio?.open?.();
    };
  }
  function production(scene) {
    if (!scene) return null;
    scene.production = productionCore?.normalizeProduction?.(scene.production, scene.duration) || scene.production || defaultProduction();
    const fps = Math.max(1, Math.round(Number(appState()?.projectSettings?.fps) || scene.production.fps || 30));
    scene.production.fps = fps;
    scene.production.durationFrames = Math.max(1, Math.round((Number(scene.duration) || scene.production.duration || 5) * fps));
    scene.production.tracks.forEach(track => { track.fps = fps; });
    return scene.production;
  }
  function activeScene() { const app = appState(); return root.TimelineStudio?.getActiveScene?.() || app?.scenes?.find(s => s.id === app.activeSceneId); }
  function currentTime() {
    const scene = activeScene();
    const app = appState(); return scene && root.TimelineStudio ? Math.max(0, app.playheadTime - root.TimelineStudio.getSceneStartOffset(scene.id)) : 0;
  }
  function currentFrame() { const app = appState(), fps = Number(app?.projectSettings?.fps) || 30; return Math.max(0, Math.round(currentTime() * fps)); }
  function activeTrack() {
    const p = production(activeScene());
    return p?.tracks?.find(track => track.type === 'character' && track.locked !== true) || null;
  }
  function addPoseAtCurrentFrame() {
    const track = activeTrack(), scene = activeScene(), p = production(scene);
    if (!track || !p) return setStatus('Add or unlock a character track first.');
    const frame = currentFrame(), fps = p.fps || 30;
    productionCore?.addKeyframe?.(track, { frame, time: frame / fps, pose: clone(track.character?.pose || { joints: track.character?.joints || {} }) });
    refreshTracks(); root.TimelineStudio?.renderTimeline?.(); root.TimelineStudio?.autoSaveToLocalStorage?.(); setStatus(`Pose added at frame ${frame}.`);
  }
  function duplicatePoseAtCurrentFrame() {
    const track = activeTrack(), frame = currentFrame();
    const source = track?.keyframes?.slice().sort((a, b) => Math.abs((a.frame || 0) - frame) - Math.abs((b.frame || 0) - frame))[0];
    if (!track || !source) return setStatus('No pose keyframe is available to duplicate.');
    const copy = clone(source); copy.frame = frame; copy.time = secondsFromFrame(frame, production(activeScene())?.fps || 30);
    productionCore?.addKeyframe?.(track, copy); refreshTracks(); root.TimelineStudio?.autoSaveToLocalStorage?.(); setStatus(`Pose duplicated to frame ${frame}.`);
  }
  function deletePoseAtCurrentFrame() {
    const track = activeTrack(), frame = currentFrame();
    if (!track) return setStatus('No editable character track is selected.');
    const target = track.keyframes?.find(item => item.frame === frame);
    if (!target || !productionCore?.deleteKeyframe?.(track, target)) return setStatus(`No pose exists at frame ${frame}.`);
    refreshTracks(); root.TimelineStudio?.renderTimeline?.(); root.TimelineStudio?.autoSaveToLocalStorage?.(); setStatus(`Pose deleted at frame ${frame}.`);
  }
  function toggleOnionSkin() {
    const app = appState(); app.stickmanStudio = app.stickmanStudio || { version: 1 };
    app.stickmanStudio.onionSkin = { ...(app.stickmanStudio.onionSkin || {}), enabled: !(app.stickmanStudio.onionSkin?.enabled), previous: 2, next: 2, opacity: .2, color: '#8b5cf6' };
    root.StickmanStudio?.render?.(currentTime()); root.TimelineStudio?.autoSaveToLocalStorage?.(); setStatus(`Onion skin ${app.stickmanStudio.onionSkin.enabled ? 'enabled' : 'disabled'}.`);
  }
  function secondsFromFrame(frame, fps) { return Number(frame || 0) / Math.max(1, Number(fps) || 30); }
  function addTemplate(template) {
    const scene = activeScene(); if (!scene || !template) return false;
    const p = production(scene);
    const characters = clone(template.characters || []);
    const trackIds = new Set(p.tracks.map(track => track.id));
    characters.forEach(character => {
      character.id = trackIds.has(character.id) ? id('character') : character.id;
      p.tracks.push({ id: id('track'), type: 'character', name: character.name, character, inPoint: 0, outPoint: template.duration || scene.duration, visible: true, locked: false, keyframes: clone(character.keyframes || []) });
    });
    p.camera = clone(template.camera || p.camera);
    p.effects.push(...clone(template.effects || []));
    p.captions.push(...clone(template.captions || []));
    p.titleCards.push(...clone(template.titleCards || []));
    scene.duration = Math.max(scene.duration, Number(template.duration) || scene.duration);
    root.TimelineStudio?.renderTimeline?.();
    root.TimelineStudio?.autoSaveToLocalStorage?.();
    const app = appState(); if (app) app.stickmanStudio = app.stickmanStudio || { version: 1 };
    refreshSceneInfo();
    refreshTracks(); refreshEffects(); renderStudioPreview();
    return true;
  }
  function evaluateCamera(camera, time) {
    if (productionCore?.evaluateCamera) return productionCore.evaluateCamera(camera, time);
    const frames = (camera?.keyframes || []).slice().sort((a, b) => a.time - b.time);
    if (!frames.length) return { x: camera?.x || 0, y: camera?.y || 0, zoom: camera?.zoom || 1, rotation: camera?.rotation || 0 };
    const before = frames.filter(frame => frame.time <= time).pop() || frames[0];
    const after = frames.find(frame => frame.time >= time) || before;
    const u = after === before ? 0 : Math.max(0, Math.min(1, (time - before.time) / Math.max(.001, after.time - before.time)));
    const mix = key => (before[key] ?? 0) + ((after[key] ?? before[key] ?? 0) - (before[key] ?? 0)) * u;
    return { x: mix('x'), y: mix('y'), zoom: Math.max(.05, mix('zoom') || 1), rotation: mix('rotation') };
  }
  function drawEffect(ctx, effect, time, width, height) {
    const start = Number(effect.start) || 0, duration = Math.max(.001, Number(effect.duration) || 1);
    const t = Math.max(0, Math.min(1, (time - start) / duration));
    if (effect.visible === false || t <= 0 || t >= 1 && !['glow', 'aura', 'rain', 'snow', 'fog'].includes(effect.type)) return;
    ctx.save();
    ctx.globalCompositeOperation = effect.blendMode || 'source-over';
    const alpha = (1 - t) * (effect.opacity ?? .8);
    if (['impact', 'flash', 'hit-flash'].includes(effect.type)) {
      ctx.globalAlpha = (1 - t) * (effect.opacity || .8);
      ctx.fillStyle = effect.color || '#fff7ed'; ctx.fillRect(0, 0, width, height);
    } else if (['speed-lines', 'motion-trails'].includes(effect.type)) {
      ctx.globalAlpha = (1 - t) * (effect.opacity || .65); ctx.strokeStyle = effect.color || '#ffffff'; ctx.lineWidth = effect.lineWidth || 3;
      const count = effect.count || 18;
      for (let i = 0; i < count; i++) { const y = (i + .5) * height / count; ctx.beginPath(); ctx.moveTo(width * (.1 + i % 3 * .1), y); ctx.lineTo(width * (.35 + i % 4 * .1), y); ctx.stroke(); }
    } else if (['dust', 'smoke', 'fire', 'sparks', 'debris', 'explosion', 'energy', 'electricity', 'lightning', 'rain', 'snow', 'wind', 'fog'].includes(effect.type)) {
      ctx.fillStyle = effect.color || (effect.type === 'fire' || effect.type === 'explosion' ? '#fb923c' : '#94a3b8');
      const count = effect.count || 16, samples = productionCore?.effectSamples?.(effect, time, count) || [];
      for (const sample of samples) {
        ctx.globalAlpha = Math.max(0, sample.alpha ?? alpha); ctx.beginPath();
        if (['rain', 'snow'].includes(effect.type)) {
          ctx.moveTo(sample.x, sample.y); ctx.lineTo(sample.x + (effect.type === 'rain' ? 3 : 1), sample.y + (effect.type === 'rain' ? 24 : 5)); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.stroke();
        } else { ctx.arc(sample.x || width / 2, sample.y || height * .72, Math.max(1, sample.size), 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (['shockwave', 'energy-beam', 'aura', 'glow'].includes(effect.type)) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = effect.color || '#67e8f9'; ctx.lineWidth = effect.lineWidth || 8;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = effect.blur || 18; ctx.beginPath();
      ctx.arc(effect.x || width / 2, effect.y || height / 2, (effect.radius || 80) * (0.5 + t), 0, Math.PI * 2); ctx.stroke();
    } else if (['vignette', 'color-overlay'].includes(effect.type)) {
      ctx.globalAlpha = effect.type === 'vignette' ? alpha * .8 : alpha; ctx.fillStyle = effect.color || '#000000';
      if (effect.type === 'vignette') { const gradient = ctx.createRadialGradient(width / 2, height / 2, width * .15, width / 2, height / 2, width * .75); gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, effect.color || '#000'); ctx.fillStyle = gradient; }
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }
  function renderAt(scene, localTime, targetCtx = root.ctx) {
    const p = production(scene); if (!targetCtx || !p) return false;
    const width = targetCtx.canvas.width, height = targetCtx.canvas.height;
    const renderTime = Math.max(0, Math.min(Number(scene.duration || p.duration || 5), Number(localTime) || 0));
    targetCtx.save();
    const targets = {};
    for (const track of p.tracks || []) {
      if (track.type !== 'character' || !track.character) continue;
      const source = core.normalizeCharacter ? core.normalizeCharacter(clone(track.character)) : track.character;
      const evaluated = source.motion ? core.evaluateMotion(source, renderTime, source.motion) : core.evaluateCharacter(source, renderTime);
      const joints = evaluated.pose?.joints || {}, rootJoint = joints.root || joints.hips || joints.torso;
      if (rootJoint) targets[track.ownerId || track.character.id] = rootJoint;
    }
    const camera = evaluateCamera(p.camera, renderTime, { targets });
    targetCtx.translate(width / 2, height / 2); targetCtx.rotate((camera.rotation || 0) * Math.PI / 180); targetCtx.scale(camera.zoom, camera.zoom); targetCtx.translate(-width / 2 - camera.x, -height / 2 - camera.y);
    const activeTracks = (p.tracks || []).filter(track =>
      track.type === 'character' &&
      track.visible !== false &&
      renderTime + .0001 >= (Number(track.inPoint) || 0) &&
      renderTime - .0001 <= (Number(track.outPoint ?? scene.duration ?? p.duration) || p.duration)
    );
    for (const track of activeTracks) {
      if (track.visible === false || track.type !== 'character') continue;
      if (localTime < (track.inPoint || 0) || localTime > (track.outPoint ?? scene.duration)) continue;
      const character = track.character;
      const keyedCharacter = track.source === 'stickman-studio' && track.keyframes?.length
        ? { ...character, motion: null, keyframes: track.keyframes }
        : character;
      const normalizedCharacter = core.normalizeCharacter ? core.normalizeCharacter(clone(keyedCharacter)) : keyedCharacter;
      const evaluated = normalizedCharacter.motion ? core.evaluateMotion(normalizedCharacter, renderTime, normalizedCharacter.motion) : core.evaluateCharacter(normalizedCharacter, renderTime);
      const joints = evaluated.pose?.joints || {};
      const bounds = trackBoundsFromJoints(joints, character);
      const transform = track.transform || {};
      targetCtx.save();
      targetCtx.translate(bounds.x + bounds.w / 2 + (Number(transform.x) || 0), bounds.y + bounds.h / 2 + (Number(transform.y) || 0));
      targetCtx.rotate((Number(transform.rotation) || 0) * Math.PI / 180);
      targetCtx.scale(Math.max(.1, Number(transform.scale) || 1), Math.max(.1, Number(transform.scale) || 1));
      targetCtx.translate(-(bounds.x + bounds.w / 2), -(bounds.y + bounds.h / 2));
      targetCtx.strokeStyle = character.style?.lineColor || character.color || '#172033'; targetCtx.fillStyle = targetCtx.strokeStyle; targetCtx.lineWidth = character.style?.lineWidth || 5; targetCtx.lineCap = 'round';
      const bones = evaluated.rig?.bones?.length ? evaluated.rig.bones : (core.bones || []);
      for (const bone of bones) { const a = joints[bone.parent], b = joints[bone.child]; if (!a || !b) continue; targetCtx.beginPath(); targetCtx.moveTo(a.x, a.y); targetCtx.lineTo(b.x, b.y); targetCtx.stroke(); }
      const head = joints.head || joints.neck; if (head) { targetCtx.beginPath(); targetCtx.arc(head.x, head.y - (character.style?.headSize || 28) * .7, character.style?.headSize || 28, 0, Math.PI * 2); targetCtx.stroke(); }
      targetCtx.restore();
    }
    function trackBoundsFromJoints(joints, character) {
      const points = Object.values(joints || {}).filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
      if (!points.length) return { x: 0, y: 0, w: 1, h: 1 };
      const headSize = Number(character?.style?.headSize) || 28;
      const xs = points.map(point => point.x), ys = points.map(point => point.y);
      const minX = Math.min(...xs) - headSize, maxX = Math.max(...xs) + headSize;
      const minY = Math.min(...ys) - headSize * 1.8, maxY = Math.max(...ys) + headSize;
      return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    }
    function getTrackBounds(scene, track, localTime = 0) {
      if (!scene || !track?.character) return null;
      const keyedCharacter = track.source === 'stickman-studio' && track.keyframes?.length
        ? { ...track.character, motion: null, keyframes: track.keyframes } : track.character;
      const evaluated = keyedCharacter.motion ? core.evaluateMotion(keyedCharacter, localTime, keyedCharacter.motion) : core.evaluateCharacter(keyedCharacter, localTime);
      const bounds = trackBoundsFromJoints(evaluated.pose?.joints || {}, track.character);
      const transform = track.transform || {};
      const scale = Math.max(.1, Number(transform.scale) || 1);
      return {
        x: bounds.x + (Number(transform.x) || 0) + bounds.w * (1 - scale) / 2,
        y: bounds.y + (Number(transform.y) || 0) + bounds.h * (1 - scale) / 2,
        w: bounds.w * scale, h: bounds.h * scale,
      };
    }
    targetCtx.restore();
    for (const effect of p.effects) drawEffect(targetCtx, effect, localTime, width, height);
    for (const caption of p.captions) {
      if (localTime < caption.start || localTime > caption.end) continue;
      targetCtx.save(); targetCtx.fillStyle = caption.color || '#111827'; targetCtx.font = `${caption.size || 28}px sans-serif`; targetCtx.textAlign = caption.align || 'center'; targetCtx.fillText(caption.text || '', caption.x ?? width / 2, caption.y ?? height - 50); targetCtx.restore();
    }
    return true;
  }
  async function fileToDataUrl(file) {
    return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  }
  async function importAudio(input) {
    const file = input.files?.[0], scene = activeScene(); if (!file || !scene) return;
    const p = production(scene); const dataUrl = await fileToDataUrl(file);
    p.audioClips.push({ id: id('audio'), name: file.name, dataUrl, start: currentTime(), offset: 0, duration: 0, volume: .85, fadeIn: 0, fadeOut: 0 });
    setStatus(`Imported ${file.name} locally.`); root.TimelineStudio?.autoSaveToLocalStorage?.();
  }
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return setStatus('Voice recording is unavailable in this browser.');
    if (recorder) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingChunks = []; recorder = new MediaRecorder(stream); recorder.ondataavailable = event => recordingChunks.push(event.data);
      recorder.onstop = async () => { const blob = new Blob(recordingChunks, { type: recorder.mimeType || 'audio/webm' }); const scene = activeScene(); if (scene) production(scene).audioClips.push({ id: id('voice'), name: 'Voice recording', dataUrl: await fileToDataUrl(new File([blob], 'voice-recording.webm', { type: blob.type })), start: currentTime(), offset: 0, duration: 0, volume: .9, fadeIn: 0, fadeOut: 0 }); stream.getTracks().forEach(track => track.stop()); recorder = null; setStatus('Voice recording saved locally.'); root.TimelineStudio?.autoSaveToLocalStorage?.(); };
      recorder.start(); setStatus('Recording voice locally…');
    } catch (error) { console.error(error); setStatus('Microphone permission was not granted.'); }
  }
  function stopRecording() { if (recorder) recorder.stop(); }
  function setStatus(text) { const node = dialog?.querySelector('[data-status]'); if (node) node.textContent = text; }
  function renderStudioPreview() {
    const canvas = dialog?.querySelector('[data-preview-canvas]'), scene = activeScene();
    if (!canvas || !scene) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    renderAt(scene, previewTime, ctx);
    const timeLabel = dialog.querySelector('[data-preview-time]');
    if (timeLabel) timeLabel.textContent = `${previewTime.toFixed(2)}s / ${Number(scene.duration || 0).toFixed(2)}s`;
    const range = dialog.querySelector('[data-preview-range]');
    if (range) { range.max = Number(scene.duration || 1); range.value = previewTime; }
  }
  function stopStudioPreview() {
    previewPlaying = false;
    if (previewRaf) cancelAnimationFrame(previewRaf);
    previewRaf = 0;
  }
  function playStudioPreview() {
    const scene = activeScene(); if (!scene) return;
    stopStudioPreview(); previewPlaying = true;
    let last = performance.now();
    const tick = now => {
      if (!previewPlaying) return;
      previewTime += (now - last) / 1000; last = now;
      if (previewTime > Number(scene.duration || 1)) previewTime = 0;
      renderStudioPreview(); previewRaf = requestAnimationFrame(tick);
    };
    previewRaf = requestAnimationFrame(tick);
  }
  function seekStudioPreview(value) {
    stopStudioPreview(); previewTime = Math.max(0, Number(value) || 0); renderStudioPreview();
  }
  const effectTypes = ['impact', 'hit-flash', 'shockwave', 'speed-lines', 'motion-trails', 'dust', 'smoke', 'fire', 'electricity', 'energy-beam', 'rain', 'snow', 'sparks', 'explosion', 'fog', 'vignette', 'color-overlay', 'glow'];
  function refreshEffects() {
    const list = dialog?.querySelector('[data-effects]'), scene = activeScene(); if (!list || !scene) return;
    const p = production(scene);
    list.replaceChildren(...p.effects.map(effect => {
      const row = document.createElement('div'); row.className = 'production-effect-row';
      row.innerHTML = `<strong>${effect.name || effect.type}</strong><small>${effect.start.toFixed(2)}s · ${effect.duration.toFixed(2)}s · ${effect.quality}</small><label>Start <input data-effect-start type="number" min="0" step=".1" value="${effect.start}"></label><label>Duration <input data-effect-duration type="number" min=".01" step=".1" value="${effect.duration}"></label><label>Opacity <input data-effect-opacity type="range" min="0" max="1" step=".05" value="${effect.opacity}"></label><button type="button" data-effect-visible>${effect.visible === false ? 'Show' : 'Hide'}</button><button type="button" data-effect-delete>Delete</button>`;
      row.querySelector('[data-effect-start]').onchange = e => { if (!effect.locked) effect.start = Math.max(0, Number(e.target.value) || 0); refreshEffects(); renderStudioPreview(); root.TimelineStudio?.autoSaveToLocalStorage?.(); };
      row.querySelector('[data-effect-duration]').onchange = e => { if (!effect.locked) effect.duration = Math.max(.01, Number(e.target.value) || 1); refreshEffects(); renderStudioPreview(); root.TimelineStudio?.autoSaveToLocalStorage?.(); };
      row.querySelector('[data-effect-opacity]').oninput = e => { if (!effect.locked) effect.opacity = Math.max(0, Math.min(1, Number(e.target.value))); renderStudioPreview(); root.TimelineStudio?.autoSaveToLocalStorage?.(); };
      row.querySelector('[data-effect-visible]').onclick = () => { effect.visible = effect.visible === false; refreshEffects(); renderStudioPreview(); root.TimelineStudio?.autoSaveToLocalStorage?.(); };
      row.querySelector('[data-effect-delete]').onclick = () => { p.effects = p.effects.filter(item => item.id !== effect.id); refreshEffects(); renderStudioPreview(); root.TimelineStudio?.autoSaveToLocalStorage?.(); };
      return row;
    }));
  }
  function addEffect() {
    const scene = activeScene(); if (!scene) return;
    const p = production(scene), type = dialog.querySelector('[data-effect-type]').value;
    const effect = productionCore?.normalizeEffect?.({ type, name: `${type} effect`, start: currentTime(), duration: 1, seed: p.effects.length + 1 }, p.effects.length, p.duration) || { type, start: currentTime(), duration: 1 };
    p.effects.push(effect); refreshEffects(); setStatus(`${type} effect added to the active scene.`); root.TimelineStudio?.autoSaveToLocalStorage?.();
  }
  function build() {
    dialog = document.createElement('dialog'); dialog.id = 'stickman-production-dialog';
    dialog.innerHTML = `<form method="dialog" novalidate class="production-shell"><header><strong>Expert Stickman Studio</strong><span class="production-tabs">Characters · Timeline · Camera · Effects · Audio · Export</span><button type="submit" formnovalidate value="close">Close</button></header><div class="production-guide"><strong>Professional workflow</strong><span>1. Add a template or character</span><span>2. Press Play below to see the scene</span><span>3. Add camera keyframes and effect layers</span><span>4. Edit tracks, then preview/export from Inkplainer</span><small>The embedded preview uses the same scene compositor as the principal canvas and export.</small></div><div class="production-preview"><div class="production-preview-heading"><strong>Live scene preview</strong><span data-preview-time>0.00s / 0.00s</span></div><canvas data-preview-canvas width="1280" height="720" aria-label="Active scene preview"></canvas><div class="production-preview-controls"><button type="button" data-preview-play>Play</button><button type="button" data-preview-stop>Stop</button><input data-preview-range type="range" min="0" max="1" step=".001" value="0" aria-label="Preview playhead"></div></div><main><section><h3>1. Choose a starting template</h3><input data-search placeholder="Search by name, category, style, or class"><div class="production-filters"><select data-category><option value="">All categories</option></select><select data-style><option value="">All styles</option></select></div><div data-templates></div></section><section><h3>2. Edit the active scene</h3><div data-scene-info></div><div data-timeline-mode><button type="button" data-mode="beginner">Beginner timeline</button><button type="button" data-mode="advanced">Advanced timeline</button></div><div data-beginner-controls><button type="button" data-add-pose>Add pose at current frame</button><button type="button" data-duplicate-pose>Duplicate current pose</button><button type="button" data-delete-pose>Delete current pose</button><button type="button" data-onion>Toggle onion skin</button></div><div data-tracks class="production-tracks"></div><button type="button" data-add-marker>Add timeline marker</button><div class="production-grid"><label>Caption<textarea data-caption rows="3" placeholder="Caption or subtitle"></textarea></label><label>Start <input data-start type="number" min="0" step=".1" value="0"></label><label>End <input data-end type="number" min=".1" step=".1" value="2"></label></div><button type="button" data-add-caption>Add caption</button><h3>Camera Studio</h3><select data-camera><option value="wide">Wide shot</option><option value="medium">Medium shot</option><option value="close-up">Close-up</option><option value="extreme-close-up">Extreme close-up</option><option value="establishing">Establishing shot</option><option value="tracking">Tracking shot</option><option value="action">Action shot</option><option value="dramatic">Dramatic zoom</option><option value="impact">Impact shake</option><option value="follow">Follow action</option></select><button type="button" data-add-camera>Add camera keyframe</button><button type="button" data-follow-camera>Follow first character</button><button type="button" data-focus-camera>Focus first character</button><label>Shake <input data-camera-shake type="range" min="0" max="40" step="1" value="0"></label><label>Zoom pulse <input data-camera-pulse type="range" min="0" max=".5" step=".01" value="0"></label><h3>Effects Studio</h3><div class="production-grid"><select data-effect-type>${effectTypes.map(type => `<option value="${type}">${type.replace(/-/g, ' ')}</option>`).join('')}</select><button type="button" data-add-effect>Add effect layer</button></div><div data-effects class="production-effects"></div><h3>Audio</h3><input data-audio type="file" accept="audio/*"><button type="button" data-record>Record voice</button><button type="button" data-stop disabled>Stop recording</button><h3>3. Prepare export</h3><select data-preset><option value="landscape">YouTube Landscape · 1920×1080</option><option value="shorts">YouTube Shorts · 1080×1920</option><option value="square">Square · 1080×1080</option></select><select data-fps><option value="30">30 FPS</option><option value="60">60 FPS</option></select><button type="button" data-apply-preset>Apply export preset</button><p data-status>All production data stays local.</p></section></main><footer><span>Templates are starting points, not final videos. Everything remains editable.</span><button value="close">Done</button></footer></form>`;
    document.body.append(dialog);
    const productionForm = dialog.querySelector('form');
    if (productionForm) productionForm.noValidate = true;
    dialog.querySelectorAll('button[value="close"]').forEach(button => { button.formNoValidate = true; });
    const studioStyle = document.createElement('style');
    studioStyle.textContent = `.production-preview{grid-column:1/-1;padding:12px 16px;background:#0f172a;border-bottom:1px solid #334155}.production-preview-heading,.production-preview-controls{display:flex;align-items:center;gap:10px}.production-preview-heading{justify-content:space-between;margin-bottom:8px;color:#fed7aa}.production-preview-heading span{color:#94a3b8;font-size:11px}.production-preview canvas{display:block;width:min(100%,760px);height:auto;max-height:360px;margin:auto;background:#020617;border:1px solid #475569;border-radius:6px;image-rendering:auto}.production-preview-controls{max-width:760px;margin:8px auto 0}.production-preview-controls input{flex:1;margin:0}.production-effects{display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto}.production-effect-row{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:7px;background:#1e293b;border:1px solid #334155;border-radius:6px;font-size:10px}.production-effect-row strong{color:#fed7aa}.production-effect-row small{color:#94a3b8;text-align:right}.production-effect-row label{color:#cbd5e1}.production-effect-row button{font-size:10px}`;
    document.head.append(studioStyle);
    for (const item of root.StickmanTemplates?.categories || []) dialog.querySelector('[data-category]').insertAdjacentHTML('beforeend', `<option value="${item}">${item}</option>`);
    for (const item of root.StickmanTemplates?.styles || []) dialog.querySelector('[data-style]').insertAdjacentHTML('beforeend', `<option value="${item}">${item}</option>`);
    dialog.querySelector('[data-audio]').onchange = event => importAudio(event.target);
    dialog.querySelector('[data-record]').onclick = () => { startRecording(); dialog.querySelector('[data-stop]').disabled = false; };
    dialog.querySelector('[data-stop]').onclick = () => { stopRecording(); dialog.querySelector('[data-stop]').disabled = true; };
    dialog.querySelector('[data-preview-play]').onclick = playStudioPreview;
    dialog.querySelector('[data-preview-stop]').onclick = () => { stopStudioPreview(); previewTime = 0; renderStudioPreview(); };
    dialog.querySelector('[data-preview-range]').oninput = event => seekStudioPreview(event.target.value);
    const rememberedMode = localStorage.getItem('inkplainer-stickman-timeline-mode') || 'beginner';
    const setTimelineMode = mode => { localStorage.setItem('inkplainer-stickman-timeline-mode', mode); dialog.querySelector('[data-beginner-controls]').hidden = mode !== 'beginner'; dialog.querySelector('[data-tracks]').classList.toggle('production-advanced', mode === 'advanced'); };
    dialog.querySelectorAll('[data-mode]').forEach(button => { button.onclick = () => setTimelineMode(button.dataset.mode); });
    dialog.querySelector('[data-add-pose]').onclick = addPoseAtCurrentFrame;
    dialog.querySelector('[data-duplicate-pose]').onclick = duplicatePoseAtCurrentFrame;
    dialog.querySelector('[data-delete-pose]').onclick = deletePoseAtCurrentFrame;
    dialog.querySelector('[data-onion]').onclick = toggleOnionSkin;
    dialog.querySelector('[data-apply-preset]').onclick = () => {
      const app = appState(), preset = dialog.querySelector('[data-preset]').value, fps = Number(dialog.querySelector('[data-fps]').value);
      const sizes = { landscape: [1920, 1080], shorts: [1080, 1920], square: [1080, 1080] }, size = sizes[preset];
      if (app && size) { app.canvasW = size[0]; app.canvasH = size[1]; app.projectSettings = { ...(app.projectSettings || {}), fps, productionPreset: preset }; if (typeof root.initCanvas === 'function') root.initCanvas(size[0], size[1]); }
      setStatus(`${preset} export preset applied at ${fps} FPS.`);
    };
    dialog.querySelector('[data-add-caption]').onclick = () => { const scene = activeScene(); if (!scene) return; const app = appState(); const p = production(scene); p.captions.push({ id: id('caption'), text: dialog.querySelector('[data-caption]').value, start: +dialog.querySelector('[data-start]').value || 0, end: +dialog.querySelector('[data-end]').value || 2, x: (app?.canvasW || 1280) / 2, y: (app?.canvasH || 720) - 60 }); setStatus('Caption added to active scene.'); root.TimelineStudio?.autoSaveToLocalStorage?.(); };
    dialog.querySelector('[data-add-marker]').onclick = () => { const scene = activeScene(); if (!scene) return; const p = production(scene); const time = productionCore?.snapTime?.(currentTime(), p) ?? currentTime(); p.markers.push({ id: id('marker'), time, label: `Marker ${p.markers.length + 1}` }); setStatus(`Marker added at ${time.toFixed(2)}s.`); refreshTracks(); root.TimelineStudio?.autoSaveToLocalStorage?.(); };
    refreshTracks();
    refreshEffects();
    refreshSceneInfo();
    renderStudioPreview();
    setTimelineMode(rememberedMode);
    dialog.querySelector('[data-add-camera]').onclick = () => { const scene = activeScene(); if (!scene) return; const p = production(scene); const preset = dialog.querySelector('[data-camera]').value; const values = { wide: { zoom: 1, x: 0, y: 0 }, medium: { zoom: 1.15, x: 0, y: -10 }, 'close-up': { zoom: 1.45, x: 0, y: -40 }, 'extreme-close-up': { zoom: 2, x: 0, y: -55 }, establishing: { zoom: .85, x: 0, y: 0 }, tracking: { zoom: 1.2, x: 0, y: 0 }, action: { zoom: 1.2, x: 0, y: -10 }, dramatic: { zoom: 1.7, x: 0, y: -30 }, impact: { zoom: 1.35, x: 0, y: -20 }, follow: { zoom: 1.25, x: 0, y: -20 } }[preset] || { zoom: 1, x: 0, y: 0 }; p.camera.preset = preset; p.camera.keyframes.push({ time: currentTime(), ...values, rotation: 0 }); if (preset === 'impact') p.camera.impactZoom = .12; if (preset === 'tracking' || preset === 'follow') p.camera.followSmoothing = .2; setStatus(`${preset} camera keyframe added.`); root.TimelineStudio?.autoSaveToLocalStorage?.(); renderStudioPreview(); };
    dialog.querySelector('[data-add-effect]').onclick = () => { addEffect(); renderStudioPreview(); };
    dialog.querySelector('[data-camera-shake]').oninput = event => { const scene = activeScene(); if (scene) { production(scene).camera.shake = Number(event.target.value) || 0; root.TimelineStudio?.autoSaveToLocalStorage?.(); } };
    dialog.querySelector('[data-camera-pulse]').oninput = event => { const scene = activeScene(); if (scene) { production(scene).camera.zoomPulse = Number(event.target.value) || 0; production(scene).camera.pulseFrequency = 2; root.TimelineStudio?.autoSaveToLocalStorage?.(); renderStudioPreview(); } };
    dialog.querySelector('[data-follow-camera]').onclick = () => { const scene = activeScene(), track = production(scene)?.tracks?.find(item => item.type === 'character'); if (track) { production(scene).camera.followTarget = track.ownerId || track.character?.id; setStatus('Camera now follows the first character during preview and export.'); root.TimelineStudio?.autoSaveToLocalStorage?.(); } };
    dialog.querySelector('[data-focus-camera]').onclick = () => { const scene = activeScene(), track = production(scene)?.tracks?.find(item => item.type === 'character'); if (track) { const p = production(scene); p.camera.followTarget = track.ownerId || track.character?.id; p.camera.zoom = 1.35; p.camera.followSmoothing = .35; setStatus('Camera focused on the first character.'); root.TimelineStudio?.autoSaveToLocalStorage?.(); renderStudioPreview(); } };
    dialog.addEventListener('close', stopStudioPreview);
  }
  function refreshTemplates() {
    const list = dialog?.querySelector('[data-templates]'), source = root.StickmanTemplates?.templates || [];
    if (!list) return;
    const query = dialog.querySelector('[data-search]').value.toLowerCase(), category = dialog.querySelector('[data-category]')?.value, style = dialog.querySelector('[data-style]')?.value;
    list.replaceChildren(...source.filter(template => (!category || template.category === category) && (!style || template.style === style) && (!query || `${template.name} ${template.category} ${template.style} ${template.class}`.toLowerCase().includes(query))).slice(0, 100).map(template => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'production-template'; button.innerHTML = `<strong>${template.name}</strong><small>${template.category} · ${template.style} · ${template.class}</small><em>Add to current scene</em>`; button.onclick = () => { if (addTemplate(clone(template))) setStatus(`${template.name} added to the active scene. Preview it, then edit the tracks or characters.`); }; return button;
    }));
  }
  function open() {
    if (!dialog) { build(); dialog.querySelector('[data-search]').oninput = refreshTemplates; dialog.querySelector('[data-category]').onchange = refreshTemplates; dialog.querySelector('[data-style]').onchange = refreshTemplates; }
    activeSceneId = activeScene()?.id; previewTime = 0; refreshTemplates(); refreshSceneInfo(); refreshTracks(); refreshEffects(); dialog.showModal(); renderStudioPreview();
  }
  function serialize() {
    return (appState()?.scenes || []).map(scene => ({ id: scene.id, production: clone(scene.production || defaultProduction()) }));
  }
  function restore(entries) { for (const entry of entries || []) { const scene = appState()?.scenes?.find(item => item.id === entry.id); if (scene && entry.production) scene.production = clone(entry.production); } }
  root.StickmanProduction = { open, production, renderAt, serialize, restore, addTemplate, getTrackBounds };
  root.addEventListener('load', () => setTimeout(() => {
    if (!document.getElementById('stickman-production-launch')) {
      const anchor = document.getElementById('stickman-launch'); if (!anchor) return;
      const button = document.createElement('button'); button.id = 'stickman-production-launch'; button.type = 'button'; button.textContent = 'Production Suite'; button.onclick = open; anchor.after(button);
    }
    const style = document.createElement('style'); style.textContent = `#stickman-production-dialog{width:min(980px,calc(100vw - 24px));padding:0;background:#111827;color:#e5e7eb;border:1px solid #334155;border-radius:12px}#stickman-production-dialog::backdrop{background:#0f172acc}.production-shell{margin:0}.production-shell header,.production-shell footer{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#172033}.production-shell header strong{margin-right:auto;color:#fed7aa}.production-shell button{border:1px solid #475569;background:#202c40;color:#e2e8f0;border-radius:6px;padding:6px 9px;cursor:pointer}.production-shell main{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px}.production-shell h3{margin:0 0 8px;color:#fdba74;font-size:12px}.production-shell section{min-height:360px}.production-shell input,.production-shell textarea,.production-shell select{width:100%;margin:4px 0 8px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:5px;padding:7px}.production-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.production-grid label:first-child{grid-column:1/-1}.production-template{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;margin:5px 0;font-size:10px}.production-template strong{color:#fed7aa}.production-template small{color:#94a3b8}.production-template em{color:#fdba74;font-style:normal;font-size:9px}.production-guide{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px;background:#1e293b;border-bottom:1px solid #334155;font-size:10px}.production-guide strong{width:100%;color:#fed7aa}.production-guide span{color:#dbeafe}.production-guide small{width:100%;color:#94a3b8}.production-scene-card{display:grid;grid-template-columns:1fr auto;gap:3px 8px;padding:9px;margin-bottom:8px;background:#1e293b;border:1px solid #475569;border-radius:7px}.production-scene-card strong{color:#fed7aa}.production-scene-card small{grid-column:1/-1;color:#94a3b8}.production-scene-actions{grid-column:1/-1;display:flex;gap:6px;margin-top:5px}.production-scene-actions button{font-size:10px}.production-shell footer span{margin-right:auto;color:#94a3b8;font-size:10px}.production-tabs{color:#94a3b8;font-size:10px}.production-filters{display:flex;gap:6px}.production-track{display:flex;align-items:center;gap:4px;margin:4px 0;padding:5px;background:#1e293b;border:1px solid #334155;border-radius:5px}.production-track-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.production-track label{display:flex;align-items:center;gap:3px;color:#94a3b8;font-size:9px}.production-track input{width:46px;margin:0;padding:3px;font-size:10px}.production-track button{font-size:10px;padding:3px 5px}[data-status]{color:#94a3b8;font-size:10px;line-height:1.4}`; document.head.append(style);
  }, 400));
})(window);
