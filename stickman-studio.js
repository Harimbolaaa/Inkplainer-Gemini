/* Offline stickman workspace. Uses the pure StickmanCore module and existing project serializer. */
(function (root) {
  'use strict';
  const core = root.StickmanCore;
  if (!core) return;
  const clone = value => JSON.parse(JSON.stringify(value));
  const jointsOf = character => character.pose?.joints || character.joints || character.rig?.joints || {};
  const bonesOf = character => character.rig?.bones || character.bones || [];
  const point = value => ({ x: Number(value?.x) || 0, y: Number(value?.y) || 0 });
  let model = null, activeId = null, selectedJoint = null, dialog = null, canvas = null, ctx = null;
  let playing = false, playStarted = 0, raf = 0;

  function defaultModel() {
    const make = (name, color, x) => {
      const character = core.createCharacter({ name, color, root: { x, y: 290 } });
      character.keyframes = [];
      character.motion = null;
      return character;
    };
    return { version: 2, fps: 30, durationFrames: 240, characters: [make('Rook', '#172033', 310), make('Ember', '#c2410c', 650)], poses: [], activeCharacterId: null, duration: 8, onionSkin: { enabled: true, previous: 2, next: 2, opacity: .18, color: '#8b5cf6' } };
  }
  function deletePose() {
    const c = active(), time = currentTime();
    const before = model.poses.length;
    model.poses = model.poses.filter(pose => !(pose.characterId === c?.id && Math.abs(pose.time - time) < .05));
    if (model.poses.length !== before) { render(time); save(); setStatus(`Removed pose at ${time.toFixed(2)}s.`); }
    else setStatus('No pose exists at the current time.');
  }
  function sendToScene() {
    const scene = activeScene();
    if (!scene) return setStatus('Open or create a project scene first.');
    const production = root.StickmanProduction?.production?.(scene) || (scene.production ||= {
      version: 2, fps: 30, duration: 5, durationFrames: 150, tracks: [], camera: { x: 0, y: 0, zoom: 1, rotation: 0, keyframes: [] }, effects: [], captions: [], titleCards: [], audioClips: [], markers: [],
    });
    production.tracks = production.tracks.filter(track => track.source !== 'stickman-studio');
    const fps = Math.max(1, Math.round(Number(appState()?.projectSettings?.fps) || model.fps || 30));
    for (const character of model.characters) {
      const poses = model.poses.filter(pose => pose.characterId === character.id).map(pose => ({ frame: Math.round(pose.time * fps), time: Math.round(pose.time * fps) / fps, pose: clone(pose.pose) }));
      production.tracks.push({
        id: `studio-track-${character.id}`, source: 'stickman-studio', type: 'character',
        name: character.name || 'Stickman', ownerId: character.id, fps, character: clone(character), keyframes: poses,
        inPoint: 0, outPoint: model.duration, visible: true, locked: false, transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      });
    }
    production.fps = fps; production.durationFrames = Math.round(model.duration * fps);
    scene.duration = Math.max(Number(scene.duration) || 0, model.duration);
    if (root.TimelineStudio?.applySceneToWorkingState) root.TimelineStudio.applySceneToWorkingState(scene);
    root.TimelineStudio?.renderTimeline?.();
    root.TimelineStudio?.autoSaveToLocalStorage?.();
    root.TimelineStudio?.renderSceneCompositeToContext?.(root._mainCtx || root.ctx, scene, 0, false);
    if (typeof root.redrawLayersOnCanvas === 'function') root.redrawLayersOnCanvas();
    if (typeof root.drawSelectionHandles === 'function') root.drawSelectionHandles();
    setStatus(`${model.characters.length} character(s) inserted into ${scene.name || 'the active scene'}. Close this window and press Preview All or Generate Animation to see them.`);
  }
  function loadFromScene() {
    const scene = activeScene(), production = scene && root.StickmanProduction?.production?.(scene);
    const tracks = production?.tracks?.filter(track => track.source === 'stickman-studio' || track.type === 'character') || [];
    if (!tracks.length) return setStatus('No stickman character tracks found in the active scene.');
    model.characters = tracks.map(track => clone(track.character)).filter(Boolean);
    model.poses = tracks.flatMap(track => (track.keyframes || []).map(frame => ({ id: `pose-${Date.now()}-${Math.random()}`, characterId: track.character.id, time: frame.time, pose: clone(frame.pose) })));
    activeId = model.characters[0]?.id; model.activeCharacterId = activeId; model.duration = Number(scene.duration) || model.duration;
    refreshList(); refreshInspector(); render(currentTime()); save(); setStatus(`Loaded ${model.characters.length} character(s) from ${scene.name || 'the active scene'}.`);
  }
  function ensureModel() {
    if (!model || !Array.isArray(model.characters)) model = defaultModel();
    model.activeCharacterId ||= model.characters[0]?.id;
    activeId ||= model.activeCharacterId;
    if (typeof state !== 'undefined') state.stickmanStudio = model;
  }
  function active() { ensureModel(); return model.characters.find(c => c.id === activeId) || model.characters[0]; }
  function activeScene() { const app = appState(); return root.TimelineStudio?.getActiveScene?.() || app?.scenes?.find(scene => scene.id === app?.activeSceneId); }
  function appState() { try { return state; } catch (_) { return root.state || null; } }
  function setStatus(text) { const node = dialog?.querySelector('.stickman-status'); if (node) node.textContent = text; }
  function evaluate(character, time) {
    if (character.motion && typeof core.evaluateMotion === 'function') {
      return core.evaluateMotion(character, time, character.motion);
    }
    if (typeof core.evaluateCharacter === 'function') return core.evaluateCharacter(character, time);
    return character;
  }
  function drawCharacter(character, time, ghost = false) {
    const evaluated = evaluate(character, time) || character;
    const joints = jointsOf(evaluated);
    const color = character.style?.lineColor || character.color || '#172033';
    const width = Number(character.style?.lineWidth || character.lineWidth || 5);
    ctx.save();
    ctx.globalAlpha = ghost ? .18 : 1;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.lineCap = character.style?.lineCap || 'round'; ctx.lineJoin = character.style?.lineJoin || 'round';
    for (const bone of bonesOf(evaluated)) {
      const a = point(joints[bone.parent]), b = point(joints[bone.child]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const head = point(joints.head || joints.neck);
    const radius = Number(character.style?.headSize || character.headSize || 28);
    ctx.beginPath(); ctx.arc(head.x, head.y - radius * .7, radius, 0, Math.PI * 2); ctx.stroke();
    const expression = character.expression?.name || 'neutral';
    if (expression !== 'neutral') {
      ctx.save(); ctx.lineWidth = Math.max(2, width * .65); ctx.strokeStyle = color;
      const faceY = head.y - radius * .72, eyeY = faceY - radius * .12;
      if (['surprised', 'scared'].includes(expression)) { ctx.beginPath(); ctx.arc(head.x - radius * .32, eyeY, radius * .12, 0, Math.PI * 2); ctx.arc(head.x + radius * .32, eyeY, radius * .12, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(head.x - radius * .3, eyeY, radius * .07, 0, Math.PI * 2); ctx.arc(head.x + radius * .3, eyeY, radius * .07, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); if (['happy', 'determined'].includes(expression)) ctx.arc(head.x, faceY + radius * .18, radius * .25, 0, Math.PI); else if (['sad', 'angry'].includes(expression)) ctx.arc(head.x, faceY + radius * .34, radius * .22, Math.PI, Math.PI * 2); else ctx.moveTo(head.x - radius * .18, faceY + radius * .28), ctx.lineTo(head.x + radius * .18, faceY + radius * .28); ctx.stroke(); ctx.restore();
    }
    for (const accessory of character.accessories || []) {
      if (accessory.type === 'circle') { const p = joints[accessory.joint] || head; ctx.beginPath(); ctx.strokeStyle = accessory.color || color; ctx.arc(p.x + (accessory.x || 0), p.y + (accessory.y || 0), Number(accessory.radius) || 12, 0, Math.PI * 2); ctx.stroke(); }
      if (accessory.type === 'rect') { const p = joints[accessory.joint] || head; ctx.strokeStyle = accessory.color || color; ctx.strokeRect(p.x + (accessory.x || 0), p.y + (accessory.y || 0), Number(accessory.width) || 24, Number(accessory.height) || 16); }
      if (accessory.type === 'svg' && accessory.path && typeof Path2D !== 'undefined') { const p = joints[accessory.joint] || joints.root; try { ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = accessory.color || color; ctx.stroke(new Path2D(accessory.path)); ctx.restore(); } catch (error) { console.warn('Accessory SVG path could not be rendered.', error); } }
    }
    for (const [name, joint] of Object.entries(joints)) {
      const p = point(joint);
      ctx.beginPath(); ctx.arc(p.x, p.y, name === selectedJoint && character.id === activeId ? 7 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function render(time = 0) {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ensureModel();
    for (const character of model.characters) {
      if (character.id !== activeId) drawCharacter(character, time);
    }
    const current = active();
    if (current) {
      const settings = model.onionSkin || { enabled: true, previous: 2, next: 2, opacity: .18 };
      const poses = model.poses.filter(p => p.characterId === current.id).sort((a, b) => a.time - b.time);
      if (settings.enabled) {
        poses.filter(p => p.time < time).slice(-Math.max(0, settings.previous || 0)).forEach(pose => drawCharacter({ ...current, pose: pose.pose }, time, true));
        poses.filter(p => p.time > time).slice(0, Math.max(0, settings.next || 0)).forEach(pose => drawCharacter({ ...current, pose: pose.pose }, time, true));
      }
      drawCharacter(current, time);
    }
  }
  function refreshList() {
    const list = dialog?.querySelector('.stickman-character-list');
    if (!list) return;
    list.replaceChildren(...model.characters.map(character => {
      const button = document.createElement('button');
      button.className = `stickman-character-item${character.id === activeId ? ' active' : ''}`;
      button.innerHTML = `<span class="stickman-character-dot" style="background:${character.color || '#172033'}"></span><span>${character.name || 'Character'}</span>`;
      button.onclick = () => { activeId = character.id; model.activeCharacterId = activeId; selectedJoint = null; refreshList(); refreshInspector(); render(currentTime()); };
      return button;
    }));
  }
  function refreshInspector() {
    const c = active(), name = dialog?.querySelector('[data-field=name]'), color = dialog?.querySelector('[data-field=color]');
    const width = dialog?.querySelector('[data-field=width]'), head = dialog?.querySelector('[data-field=head]');
    if (!c) return;
    if (name) name.value = c.name || '';
    if (color) color.value = c.color || '#172033';
    if (width) width.value = c.style?.lineWidth || c.lineWidth || 5;
    if (head) head.value = c.style?.headSize || c.headSize || 28;
    const expression = dialog?.querySelector('[data-field=expression]'), cap = dialog?.querySelector('[data-field=linecap]'), join = dialog?.querySelector('[data-field=linejoin]');
    const constraints = dialog?.querySelector('[data-field=constraints]'), stretch = dialog?.querySelector('[data-field=stretch]');
    if (expression) expression.value = c.expression?.name || 'neutral';
    if (cap) cap.value = c.style?.lineCap || 'round';
    if (join) join.value = c.style?.lineJoin || 'round';
    if (constraints) constraints.checked = c.rig?.constraints?.enabled !== false;
    if (stretch) stretch.checked = c.rig?.stretch === true;
  }
  function updateCharacter() {
    const c = active(); if (!c) return;
    c.name = dialog.querySelector('[data-field=name]').value.trim() || 'Character';
    c.color = dialog.querySelector('[data-field=color]').value;
    c.style ||= {};
    c.style.lineWidth = Number(dialog.querySelector('[data-field=width]').value) || 5;
    c.style.headSize = Number(dialog.querySelector('[data-field=head]').value) || 28;
    refreshList(); render(currentTime()); save();
  }
  function presetCharacter() {
    const preset = dialog.querySelector('[data-field=preset]').value;
    const specs = {
      basic: { name: 'Basic Stickman', color: '#172033', scale: 1 },
      fighter: { name: 'Fighter', color: '#b91c1c', scale: 1.05 },
      ninja: { name: 'Ninja', color: '#312e81', scale: .98 },
      runner: { name: 'Runner', color: '#0369a1', scale: 1.08 },
      scientist: { name: 'Scientist', color: '#15803d', scale: .95 },
      comedic: { name: 'Comedic', color: '#c2410c', scale: .86 },
    };
    const spec = specs[preset] || specs.basic, replacement = core.createCharacter({ name: spec.name, color: spec.color, scale: spec.scale, root: jointsOf(active()).root });
    replacement.id = active().id; replacement.expression = core.defaultExpression(preset === 'comedic' ? 'surprised' : 'neutral');
    model.characters = model.characters.map(character => character.id === active().id ? replacement : character);
    refreshList(); refreshInspector(); render(currentTime()); save(); setStatus(`${spec.name} preset applied to the selected character.`);
  }
  function updateRig() {
    const c = active(); if (!c) return;
    const rig = c.rig || (c.rig = {});
    rig.constraints ||= {}; rig.constraints.enabled = dialog.querySelector('[data-field=constraints]').checked;
    rig.stretch = dialog.querySelector('[data-field=stretch]').checked;
    const selected = dialog.querySelector('[data-field=joint]').value;
    const pin = dialog.querySelector('[data-field=pin]').checked;
    if (selected) core.setPin(c, selected, pin);
    const expression = dialog.querySelector('[data-field=expression]').value;
    c.expression = core.defaultExpression(expression);
    c.style.lineCap = dialog.querySelector('[data-field=linecap]').value;
    c.style.lineJoin = dialog.querySelector('[data-field=linejoin]').value;
    render(currentTime()); save(); setStatus('Rig, expression, and drawing style updated.');
  }
  function resetPose() { const c = active(); if (c) { core.resetPose(c); render(currentTime()); addPose(); setStatus('Rest pose restored.'); } }
  function validateRig() { const result = core.validateRig(active()); setStatus(result.valid ? `Rig valid: ${result.joints} joints, ${result.bones} bones.` : `Rig issues: ${result.errors.join(' ')}`); }
  function addAccessory() {
    const c = active(), type = window.prompt('Accessory type: circle or rect', 'circle');
    if (!c || !['circle', 'rect'].includes(type)) return setStatus('Accessory cancelled. Use circle or rect.');
    c.accessories ||= []; c.accessories.push(type === 'circle' ? { id: `accessory-${Date.now()}`, type, joint: 'head', radius: 34, color: c.color } : { id: `accessory-${Date.now()}`, type, joint: 'neck', width: 70, height: 24, color: c.color });
    render(currentTime()); save(); setStatus(`${type} accessory added. It remains editable in the character asset.`);
  }
  function importAccessory() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.svg,image/svg+xml';
    input.onchange = () => { const file = input.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const source = String(reader.result), match = source.match(/\bd\s*=\s*["']([^"']+)["']/i); if (!match) return setStatus('SVG must contain a path with a d attribute.'); const c = active(); c.accessories ||= []; c.accessories.push({ id: `accessory-${Date.now()}`, type: 'svg', joint: 'root', path: match[1], order: c.accessories.length }); render(currentTime()); save(); setStatus('SVG path accessory imported locally.'); }; reader.readAsText(file); };
    input.click();
  }
  function duplicateCharacter() {
    const copy = clone(active()); copy.id = `character-${Date.now().toString(36)}`; copy.name = `${copy.name || 'Character'} copy`; copy.rig.pins = {};
    model.characters.push(copy); activeId = copy.id; model.activeCharacterId = activeId; refreshList(); refreshInspector(); render(currentTime()); save(); setStatus('Character duplicated independently.');
  }
  function exportCharacter() {
    const blob = new Blob([JSON.stringify({ type: 'inkplainer-character', version: 2, character: core.normalizeCharacter(clone(active())) }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${active().name || 'character'}.ink-character.json`; link.click(); URL.revokeObjectURL(link.href);
  }
  function importCharacter() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = () => { const file = input.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try {
      const data = JSON.parse(reader.result), imported = core.normalizeCharacter(data.character || data);
      imported.id = `character-${Date.now().toString(36)}`; imported.name = `${imported.name || 'Character'} imported`; model.characters.push(imported); activeId = imported.id; model.activeCharacterId = activeId; refreshList(); refreshInspector(); render(currentTime()); save(); setStatus('Character imported as an independent asset.');
    } catch (error) { console.error(error); setStatus('Invalid character JSON.'); } }; reader.readAsText(file); };
    input.click();
  }
  function currentTime() { return Number(dialog?.querySelector('[data-field=time]')?.value || 0); }
  function setTime(value) {
    const input = dialog?.querySelector('[data-field=time]'); if (!input) return;
    input.value = Math.max(0, Math.min(model.duration, Number(value) || 0));
    const label = dialog.querySelector('.stickman-time'); if (label) label.textContent = `${Number(input.value).toFixed(2)}s`;
    render(Number(input.value));
  }
  function addCharacter() {
    const index = model.characters.length + 1;
    const character = core.createCharacter({ name: `Character ${index}`, color: '#2563eb', root: { x: 260 + (index % 3) * 220, y: 290 } });
    character.keyframes = []; model.characters.push(character); activeId = character.id; model.activeCharacterId = activeId;
    refreshList(); refreshInspector(); render(currentTime()); save();
  }
  function deleteCharacter() {
    if (model.characters.length <= 1) return setStatus('At least one character is required.');
    model.characters = model.characters.filter(c => c.id !== activeId); activeId = model.characters[0].id; model.activeCharacterId = activeId;
    refreshList(); refreshInspector(); render(currentTime()); save();
  }
  function addPose() {
    const c = active(); if (!c) return;
    const pose = typeof core.capturePose === 'function' ? core.capturePose(c) : { joints: clone(jointsOf(c)) };
    model.poses = model.poses.filter(p => !(p.characterId === c.id && Math.abs(p.time - currentTime()) < .001));
    model.poses.push({ id: `pose-${Date.now()}`, characterId: c.id, time: currentTime(), pose });
    model.poses.sort((a, b) => a.time - b.time); setStatus(`Saved ${c.name} pose at ${currentTime().toFixed(2)}s`); save();
  }
  function applyMotion() {
    const c = active(), motion = dialog.querySelector('[data-field=motion]').value;
    if (!c) return;
    c.motion = motion ? { name: motion, start: currentTime(), duration: model.duration - currentTime(), loop: true } : null;
    render(currentTime()); setStatus(motion ? `${motion} motion applied; edit the generated character afterward.` : 'Motion cleared.'); save();
  }
  function mirror() {
    const c = active();
    if (typeof core.mirrorPose === 'function') c.pose = core.mirrorPose(c.pose || { joints: jointsOf(c) });
    else c.pose = { joints: Object.fromEntries(Object.entries(jointsOf(c)).map(([k, p]) => [k, { ...p, x: canvas.width - p.x }])) };
    render(currentTime()); save(); setStatus('Pose mirrored.');
  }
  function hitJoint(x, y) {
    const joints = jointsOf(active()); let best = null, distance = 18;
    for (const [name, value] of Object.entries(joints)) {
      const p = point(value), d = Math.hypot(p.x - x, p.y - y);
      if (d < distance) { distance = d; best = name; }
    }
    return best;
  }
  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function dragStart(event) { const p = pointer(event); selectedJoint = hitJoint(p.x, p.y); if (selectedJoint) canvas.setPointerCapture(event.pointerId); }
  function dragMove(event) {
    if (!selectedJoint) return;
    const c = active(), p = pointer(event);
    if (typeof core.moveJoint === 'function') core.moveJoint(c, selectedJoint, p, { solveIK: true });
    else { jointsOf(c)[selectedJoint] = p; if (typeof core.forwardKinematics === 'function') core.forwardKinematics(c); }
    render(currentTime());
  }
  function dragEnd() { if (selectedJoint) { addPose(); selectedJoint = null; render(currentTime()); } }
  function save() {
    state.stickmanStudio = serialize();
    window.TimelineStudio?.autoSaveToLocalStorage?.();
  }
  function serialize() { ensureModel(); return clone(model); }
  function restore(value) { model = clone(value); ensureModel(); if (dialog) { refreshList(); refreshInspector(); render(currentTime()); } }
  function exportPose() {
    const blob = new Blob([JSON.stringify({ version: 1, characterId: active().id, pose: core.capturePose ? core.capturePose(active()) : { joints: clone(jointsOf(active())) } }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${active().name || 'stickman'}-pose.json`; link.click(); URL.revokeObjectURL(link.href);
  }
  function importPose() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json';
    input.onchange = () => { const file = input.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); active().pose = data.pose; render(currentTime()); save(); setStatus('Pose imported.'); } catch (error) { console.error(error); setStatus('Invalid pose JSON.'); } }; reader.readAsText(file); };
    input.click();
  }
  function tick(now) {
    if (!playing) return;
    const elapsed = (now - playStarted) / 1000;
    setTime(elapsed % model.duration);
    raf = requestAnimationFrame(tick);
  }
  function togglePlay() { playing = !playing; if (playing) { playStarted = performance.now() - currentTime() * 1000; raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); }
  function open() { ensureModel(); if (!dialog) build(); const scene = activeScene(); const context = dialog.querySelector('[data-scene-context]'); if (context) context.textContent = scene ? `Editing: ${scene.name || 'Active scene'}` : 'No active project scene'; refreshList(); refreshInspector(); dialog.showModal(); render(currentTime()); }
  function build() {
    dialog = document.createElement('dialog'); dialog.id = 'stickman-studio-dialog';
    dialog.innerHTML = `<div class="stickman-shell"><header class="stickman-head"><span class="stickman-brand">Stickman Studio</span><span class="stickman-context" data-scene-context></span><button data-action="play">Play</button><button data-action="pose">+ Pose</button><button data-action="send">Merge into active scene</button><button data-action="close">Close</button></header><div class="stickman-guide"><strong>Character Builder + Rigging Studio</strong><span>1. Create/select a character or preset</span><span>2. Drag wrists/ankles for constrained IK</span><span>3. Configure rig, expression, and style</span><span>4. Save poses or merge into the active scene</span><small>Each character has an independent stable ID, rig, rest pose, expressions, accessories, and reusable poses. Exported character assets stay local and editable.</small></div><div class="stickman-work"><aside class="stickman-library"><div class="stickman-section-title">Character library</div><div class="stickman-character-list"></div><button class="stickman-add" data-action="add">+ Create character</button><button class="stickman-add" data-action="duplicate">Duplicate selected</button><button class="stickman-add" data-action="delete">Delete selected</button><button class="stickman-add" data-action="load">Load from scene</button><div class="stickman-section-title">Original presets</div><select data-field="preset"><option value="basic">Basic stickman</option><option value="fighter">Fighter</option><option value="ninja">Ninja</option><option value="runner">Runner</option><option value="scientist">Scientist</option><option value="comedic">Comedic character</option></select><button class="stickman-add" data-action="preset">Apply preset</button><p class="stickman-hint">Drag wrists and ankles for two-bone IK. Drag the root to move the whole character. The active character is isolated from every other character.</p></aside><main class="stickman-stage"><div class="stickman-canvas-wrap"><canvas id="stickman-canvas" width="960" height="540"></canvas></div><div class="stickman-stage-bar"><label>Timeline</label><input data-field="time" type="range" min="0" max="8" step=".01" value="0"><span class="stickman-time">0.00s</span><button data-action="mirror">Mirror</button><select data-field="motion"><option value="">No motion</option><option>idle</option><option>walk</option><option>run</option><option>sprint</option><option>jump</option><option>land</option><option>fall</option><option>roll</option><option>punch</option><option>kick</option><option>block</option><option>dodge</option><option>fight</option><option>dance</option><option>wave</option><option>point</option><option>laugh</option><option>cry</option><option>death</option><option>surprise</option></select><button data-action="motion">Apply motion</button><button data-action="delete-pose">Delete pose</button></div></main><aside class="stickman-inspector"><div class="stickman-section-title">Character Builder</div><div class="stickman-fields"><label class="stickman-field full">Name<input data-field="name"></label><label class="stickman-field">Line<input data-field="color" type="color"></label><label class="stickman-field">Width<input data-field="width" type="number" min="1" max="24" step=".5"></label><label class="stickman-field">Head<input data-field="head" type="number" min="8" max="80"></label><label class="stickman-field">Expression<select data-field="expression"><option>neutral</option><option>happy</option><option>angry</option><option>sad</option><option>surprised</option><option>scared</option><option>confused</option><option>determined</option></select></label><label class="stickman-field">Line cap<select data-field="linecap"><option>round</option><option>butt</option><option>square</option></select></label><label class="stickman-field">Line join<select data-field="linejoin"><option>round</option><option>bevel</option><option>miter</option></select></label></div><div class="stickman-section-title">Rigging</div><div class="stickman-fields"><label class="stickman-field">Joint<select data-field="joint"><option value="leftWrist">Left wrist</option><option value="rightWrist">Right wrist</option><option value="leftAnkle">Left ankle</option><option value="rightAnkle">Right ankle</option><option value="leftElbow">Left elbow</option><option value="rightElbow">Right elbow</option></select></label><label class="stickman-field check"><input data-field="pin" type="checkbox"> Pin joint</label><label class="stickman-field check"><input data-field="constraints" type="checkbox" checked> Constraints</label><label class="stickman-field check"><input data-field="stretch" type="checkbox"> Allow stretch</label></div><div class="stickman-actions"><button class="primary" data-action="update">Apply builder/rig</button><button data-action="reset">Rest pose</button><button data-action="validate">Validate rig</button><button data-action="accessory">+ Accessory</button><button data-action="svg-accessory">Import SVG</button><button data-action="export-character">Export character</button><button data-action="import-character">Import character</button><button data-action="export">Export pose</button><button data-action="import">Import pose</button></div><p class="stickman-hint">Pins are constrained IK targets. Fixed-length limbs remain consistent unless Allow stretch is enabled. Use Validate rig before saving a reusable asset.</p></aside></div><footer class="stickman-status">Ready. Create a character or load one from the active scene.</footer></div>`;
    document.body.append(dialog); canvas = dialog.querySelector('#stickman-canvas'); ctx = canvas.getContext('2d');
    dialog.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => ({ play: togglePlay, pose: addPose, send: sendToScene, close: () => dialog.close(), add: addCharacter, duplicate: duplicateCharacter, delete: deleteCharacter, load: loadFromScene, preset: presetCharacter, mirror, motion: applyMotion, 'delete-pose': deletePose, update: updateRig, reset: resetPose, validate: validateRig, accessory: addAccessory, 'svg-accessory': importAccessory, 'export-character': exportCharacter, 'import-character': importCharacter, export: exportPose, import: importPose }[button.dataset.action])()));
    dialog.querySelector('[data-field=time]').addEventListener('input', event => setTime(event.target.value));
    canvas.addEventListener('pointerdown', dragStart); canvas.addEventListener('pointermove', dragMove); canvas.addEventListener('pointerup', dragEnd); canvas.addEventListener('pointercancel', dragEnd);
    for (const field of ['name', 'color', 'width', 'head']) dialog.querySelector(`[data-field=${field}]`).addEventListener('change', updateCharacter);
  }
  root.StickmanStudio = { open, serialize, restore, render };
  function installLaunchButton() {
    const anchor = document.getElementById('btn-projects');
    if (!anchor || document.getElementById('stickman-launch')) return;
    const button = document.createElement('button');
    button.id = 'stickman-launch'; button.type = 'button'; button.textContent = 'Stickman Studio';
    button.title = 'Open the offline stickman animation workspace'; button.onclick = open; anchor.after(button);
  }
  setTimeout(installLaunchButton, 260);
  const launchRetry = setInterval(() => {
    installLaunchButton();
    if (document.getElementById('stickman-launch')) clearInterval(launchRetry);
  }, 250);
  root.addEventListener('load', installLaunchButton);
})(window);
