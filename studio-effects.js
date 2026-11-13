/* Offline GSAP inspector. Draft previews never alter the saved layer settings. */
const StudioEffects = (() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const categories = { In: 'Entrée', Out: 'Sortie', Text: 'Texte', Idle: 'Boucle', Emphasis: 'Accent' };
  const paths = {
    In: 'M4 12h15m-5-5 5 5-5 5M5 5v14',
    Out: 'M4 12h15m-5-5 5 5-5 5M21 5v14',
    Text: 'M4 5h16M12 5v15m-4 0h8',
    Idle: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1',
    Emphasis: 'm13 2-9 12h7l-1 8 10-13h-7z',
  };
  const n = (key, label, value, min = 0, max = 1000, step = 1) => ({ key, label, value, min, max, step });
  const color = (key, label, value) => ({ key, label, value, type: 'color' });
  const parameters = {
    smoothOvershoot: [n('distance', 'Distance (px)', 90)],
    cinematicFadeScale: [n('scale', 'Échelle initiale', 1.18, 0, 5, .01)],
    dynamicGlitchIn: [n('intensity', 'Intensité (px)', 65, 0, 200)],
    elasticPop: [],
    blurReveal: [n('blur', 'Flou (px)', 24, 0, 80), n('distance', 'Distance (px)', 18)],
    dropSquash: [n('distance', 'Hauteur (px)', 260)],
    flip3DIn: [n('angle', 'Angle (°)', -90, -720, 720)],
    zoomSpin: [n('angle', 'Rotation (°)', -180, -1080, 1080)],
    wipeRight: [],
    slideBounce: [n('distance', 'Distance (px)', 320)],
    shrinkVanish: [],
    flyAway: [n('distance', 'Distance X (px)', 700, -2000, 2000), n('height', 'Hauteur (px)', 450), n('angle', 'Rotation (°)', 35, -720, 720)],
    pixelDissolve: [n('columns', 'Colonnes', 16, 2, 64), n('rows', 'Lignes', 12, 2, 64)],
    spinOut: [n('angle', 'Rotation (°)', 540, -1440, 1440)],
    swishLeft: [n('distance', 'Distance (px)', 650)],
    blurOut: [n('blur', 'Flou (px)', 30, 0, 80)],
    implode: [],
    slideDownFade: [n('distance', 'Distance (px)', 180)],
    sinkHole: [n('distance', 'Distance (px)', 130), color('holeColor', 'Couleur du trou', '#0f172a')],
    fold3DOut: [n('angle', 'Angle (°)', 90, -720, 720)],
    typewriterPro: [{ key: 'cursor', label: 'Curseur de saisie', value: true, type: 'checkbox' }, color('cursorColor', 'Couleur du curseur', '#111827')],
    staggeredPopUp: [n('distance', 'Distance (px)', 55), n('stagger', 'Décalage / lettre (s)', .04, 0, 2, .01)],
    neonFlicker: [n('glow', 'Lueur (px)', 24, 0, 100), color('glowColor', 'Couleur de lueur', '#38bdf8')],
    decodeMatrix: [color('color', 'Couleur du décodage', '#22c55e'), { key: 'characters', label: 'Alphabet de décodage', value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\{}[]', type: 'text' }],
    waveText: [n('amplitude', 'Amplitude (px)', 16, 0, 100)],
    trackingInReveal: [n('spacing', 'Espacement (px)', 30, 0, 100)],
    jitterText: [n('amplitude', 'Amplitude (px)', 12, 0, 100)],
    flipBoard: [n('stagger', 'Décalage / lettre (s)', .04, 0, 2, .01)],
    sliceText: [n('distance', 'Distance (px)', 100), n('strips', 'Nombre de bandes', 24, 4, 96)],
    kineticScroll: [n('distance', 'Distance (px)', 95), n('stagger', 'Décalage / lettre (s)', .04, 0, 2, .01)],
    liquidFloat: [n('amplitude', 'Amplitude (px)', 16, 0, 200)],
    heartbeatPulse: [n('scale', 'Échelle maximale', 1.16, .1, 3, .01)],
    continuousParallaxDrift: [n('distance', 'Distance (px)', 35, 0, 300)],
    gentleSwing: [n('angle', 'Angle (°)', 8, 0, 90)],
    shakeRumble: [n('amplitude', 'Amplitude (px)', 6, 0, 100), n('frequency', 'Secousses / cycle', 20, 3, 80)],
    glowPulse: [n('glow', 'Lueur (px)', 28, 0, 100), color('glowColor', 'Couleur de lueur', '#38bdf8')],
    wobble: [n('angle', 'Angle (°)', 8, 0, 90)],
    breathingScale: [n('scale', 'Échelle maximale', 1.055, .1, 3, .005)],
    orbitRing: [n('radius', 'Rayon (px)', 40, 0, 500), n('ellipse', 'Ratio de l’ellipse', .55, 0, 2, .05)],
    wavyDistortion: [n('amplitude', 'Amplitude (px)', 10, 0, 100), n('strips', 'Nombre de bandes', 24, 4, 96)],
    rubberBand: [],
    flashBang: [n('glow', 'Lueur (px)', 45, 0, 100), color('flashColor', 'Couleur du flash', '#ffffff'), color('glowColor', 'Couleur de lueur', '#38bdf8')],
    tadaCelebrate: [],
    jello: [],
    cameraShake: [n('intensity', 'Intensité (px)', 22, 0, 200), n('frequency', 'Secousses / cycle', 24, 4, 96)],
    colorInvertFlash: [],
    rippleEffect: [n('amplitude', 'Amplitude (px)', 14, 0, 100), n('lineWidth', 'Épaisseur (px)', 2, .5, 20, .5), color('color', 'Couleur de l’onde', '#60a5fa')],
    glitchBurst: [n('intensity', 'Intensité (px)', 55, 0, 200)],
    spotlightSweep: [],
    popOut3D: [],
  };
  const customEase = new Set(['smoothOvershoot', 'cinematicFadeScale', 'elasticPop', 'blurReveal', 'flip3DIn', 'zoomSpin', 'wipeRight', 'slideBounce', 'shrinkVanish', 'flyAway', 'spinOut', 'swishLeft', 'blurOut', 'slideDownFade', 'sinkHole', 'fold3DOut']);
  const pivotEffects = new Set(['smoothOvershoot', 'cinematicFadeScale', 'elasticPop', 'dropSquash', 'zoomSpin', 'shrinkVanish', 'flyAway', 'spinOut', 'swishLeft', 'blurOut', 'implode', 'sinkHole', 'liquidFloat', 'heartbeatPulse', 'gentleSwing', 'wobble', 'breathingScale', 'rubberBand', 'flashBang', 'tadaCelebrate', 'jello', 'cameraShake', 'popOut3D']);
  const glyphEffects = new Set(['typewriterPro', 'staggeredPopUp', 'decodeMatrix', 'waveText', 'trackingInReveal', 'jitterText', 'flipBoard', 'kineticScroll']);
  const easeOptions = [
    ['', 'Courbe originale'], ['none', 'Linéaire'], ['power2.in', 'Accélération'],
    ['power2.out', 'Décélération'], ['power2.inOut', 'Ease In-Out'],
    ['back.out(1.7)', 'Dépassement'], ['elastic.out(1,.45)', 'Élastique'],
    ['bounce.out', 'Rebond'], ['expo.inOut', 'Exponentielle'], ['sine.inOut', 'Sinusoïdale'],
  ];
  let el, button, field, number, select, icon;
  let pane, settingsBody, catalogGrid, effectSelect, resultCount, targetName, status, transport, progress, clock, live, applyButton, removeButton, playButton, pauseButton, stopButton;
  let target = null, previewTarget = null, draft = null, dirty = false, filter = 'All', search = '', refreshFrame = 0;
  let initialized = false;
  const catalog = () => window.EffectManager?.catalog || [];
  const entryFor = key => catalog().find(e => e.key === key);
  const scene = () => TimelineStudio.getActiveScene();
  const sceneTime = () => Math.max(0, state.playheadTime - TimelineStudio.getSceneStartOffset(scene().id));
  const defaultConfig = key => ({
    effect: key, duration: 1.2, delay: 0, repeat: entryFor(key)?.category === 'Idle' ? -1 : 0,
    repeatDelay: 0, yoyo: false, options: {},
  });
  function descriptors(key) {
    const result = [...(parameters[key] || [])];
    if (pivotEffects.has(key)) result.push(n('originX', 'Ancrage X (0–1)', .5, 0, 1, .05),
      n('originY', 'Ancrage Y (0–1)', key === 'gentleSwing' ? 0 : key === 'dropSquash' ? 1 : .5, 0, 1, .05));
    if (['flip3DIn', 'fold3DOut', 'popOut3D', 'sinkHole'].includes(key)) {
      result.push(n('perspective', 'Perspective (px)', 800, 100, 2400, 50), n('mesh', 'Précision 3D', 8, 2, 24));
    }
    if (glyphEffects.has(key)) result.push(n('slices', 'Bandes pour une image', 12, 2, 60));
    if (['dynamicGlitchIn', 'glitchBurst', 'rippleEffect'].includes(key)) result.push(n('strips', 'Nombre de bandes', 24, 4, 96));
    if (['dynamicGlitchIn', 'pixelDissolve', 'decodeMatrix', 'jitterText', 'shakeRumble', 'cameraShake', 'glitchBurst'].includes(key)) {
      result.push(n('seed', 'Graine aléatoire', 17, 0, 9999));
    }
    return result;
  }
  function normalize(value) {
    if (!value || !entryFor(value.effect)) return null;
    const result = defaultConfig(value.effect);
    for (const [key, min, max] of [['duration', .05, 60], ['delay', 0, 300], ['repeat', -1, 99], ['repeatDelay', 0, 60]]) {
      if (Number.isFinite(value[key])) result[key] = Math.max(min, Math.min(max, value[key]));
    }
    result.repeat = Math.floor(result.repeat);
    result.yoyo = value.yoyo === true;
    for (const p of descriptors(value.effect)) {
      const v = value.options?.[p.key];
      if (v === undefined) continue;
      if (p.type === 'checkbox') result.options[p.key] = v === true;
      else if (p.type === 'color' && /^#[0-9a-f]{6}$/i.test(v)) result.options[p.key] = v;
      else if (p.type === 'text' && typeof v === 'string' && v.length) result.options[p.key] = v.slice(0, 120);
      else if (!p.type && Number.isFinite(v)) result.options[p.key] = Math.max(p.min, Math.min(p.max, v));
    }
    if (customEase.has(value.effect) && easeOptions.some(([v]) => v && v === value.options?.ease)) result.options.ease = value.options.ease;
    return result;
  }
  function announce(text, error = false) {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('error', error);
  }
  function canEdit() {
    return !!target && state.layers.includes(target) && target.visible !== false && !state.recording && !StudioUI.isEditing() && !!window.gsap;
  }
  function renderPreview() {
    if (scene()) TimelineStudio.renderSceneCompositeToContext(_mainCtx, scene(), sceneTime(), false);
  }
  function updateTransport() {
    if (!initialized) return;
    const tl = previewTarget && EffectManager.get(previewTarget);
    const usable = canEdit();
    playButton.disabled = !usable;
    pauseButton.disabled = !tl;
    stopButton.disabled = !tl;
    progress.disabled = !usable;
    applyButton.disabled = !usable;
    removeButton.disabled = !usable || !target?.gsapEffect;
    settingsBody.disabled = !usable;
    effectSelect.disabled = state.recording || !window.gsap;
    pauseButton.setAttribute('aria-pressed', String(!!tl?.paused()));
    pauseButton.title = tl?.paused() ? 'Reprendre l’aperçu' : 'Mettre l’aperçu en pause';
    pauseButton.setAttribute('aria-label', pauseButton.title);
    pauseButton.replaceChildren(icon(tl?.paused() ? 'm8 5 11 7-11 7z' : 'M8 5v14M16 5v14'));
    transport.classList.toggle('is-playing', !!tl && !tl.paused() && (tl.repeat() < 0 || tl.totalProgress() < 1));
    if (!tl) { progress.value = 0; progress.style.setProperty('--pct', '0%'); clock.textContent = '0.00 s'; return; }
    const total = tl.repeat() < 0 ? tl.duration() : tl.totalDuration();
    const current = tl.repeat() < 0 ? tl.time() : tl.totalTime();
    progress.value = Math.round(current / total * 1000);
    progress.style.setProperty('--pct', `${Number(progress.value) / 10}%`);
    clock.textContent = `${current.toFixed(2)} / ${total.toFixed(2)} s${tl.repeat() < 0 ? ` · ${tl.iteration()}` : ''}`;
  }
  function stopPreview(redraw = true) {
    cancelAnimationFrame(refreshFrame);
    refreshFrame = 0;
    const previous = previewTarget;
    previewTarget = null;
    if (previous) EffectManager.stop(previous);
    updateTransport();
    if (previous && redraw) { renderPreview(); drawSelectionHandles(); }
  }
  function preview(paused = false, at = 0) {
    if (!canEdit()) {
      announce(state.recording ? 'Export en cours : réglages verrouillés.' : 'Sélectionnez un calque visible et terminez l’édition vectorielle.', true);
      return;
    }
    stopPreview(false);
    if (sceneTime() < (target.inPoint || 0) || sceneTime() >= (target.outPoint ?? scene().duration)) {
      TimelineStudio.seekToGlobalTime(TimelineStudio.getSceneStartOffset(scene().id) + (target.inPoint || 0));
    }
    previewTarget = target;
    try {
      const tl = EffectManager.apply(target, draft.effect, draft.duration, {
        ...draft.options, delay: draft.delay, repeat: draft.repeat,
        repeatDelay: draft.repeatDelay, yoyo: draft.yoyo, paused: true,
        onUpdate: updateTransport,
        onStart: () => announce(dirty ? 'Aperçu en direct · modifications non appliquées.' : 'Aperçu en direct sur le canevas.'),
        onComplete: () => { updateTransport(); announce('Aperçu terminé. Rejouez ou faites glisser le curseur.'); },
      });
      const span = tl.repeat() < 0 ? tl.duration() : tl.totalDuration();
      tl.totalTime(at * span, false);
      if (!paused) {
        if (at > 0) tl.play();
        else tl.restart(true);
      }
      renderPreview();
      updateTransport();
      if (paused) announce('Aperçu en pause · ajustez les paramètres ou le curseur.');
      else if (draft.delay > 0 && at === 0) announce(`Délai initial : ${draft.delay.toFixed(2)} s…`);
    } catch (error) {
      previewTarget = null;
      updateTransport();
      announce(`Aperçu indisponible : ${error.message}`, true);
    }
  }
  function changed(restart = false) {
    dirty = true;
    announce('Modifications non appliquées · « Appliquer » pour les conserver.');
    if (!live.checked || !canEdit()) return;
    cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      const tl = previewTarget && EffectManager.get(previewTarget);
      const paused = !!tl?.paused();
      const at = tl ? (tl.repeat() < 0 ? tl.progress() : tl.totalProgress()) : 0;
      preview(paused, restart || (!paused && at >= 1) ? 0 : at);
    });
  }
  function inputFor(p, value, update, id) {
    let input, range = null;
    if (p.type === 'checkbox') {
      input = el('input', '', null, { type: 'checkbox', id });
      input.checked = value;
      input.addEventListener('change', () => { update(input.checked); changed(); });
    } else if (p.type === 'color' || p.type === 'text') {
      input = el('input', 'studio-input', null, { type: p.type, id, maxlength: 120 });
      input.value = value;
      if (p.type === 'text') input.placeholder = 'Alphabet par défaut';
      input.addEventListener('input', () => { update(input.value || undefined); changed(); });
    } else {
      input = number(value, { min: p.min, max: p.max, step: p.step, id });
      let accepted = value;
      if (p.key === 'stagger') input.placeholder = 'Auto';
      else {
        range = el('input', 'gsap-control-range', null, {
          type: 'range', min: p.min, max: p.max, step: p.step,
          id: `${id}-range`, 'aria-label': `${p.label} — curseur`,
        });
        range.addEventListener('input', () => {
          input.value = range.value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
      const syncRange = () => {
        if (!range) return;
        range.disabled = !Number.isFinite(input.valueAsNumber) || !input.validity.valid;
        if (!range.disabled) {
          range.value = input.value;
          range.style.setProperty('--pct', `${(Number(range.value) - p.min) / (p.max - p.min) * 100}%`);
        }
      };
      input.addEventListener('input', () => {
        if (p.key === 'stagger' && input.value === '') { update(undefined); changed(); return; }
        const valid = Number.isFinite(input.valueAsNumber) && input.validity.valid;
        input.setAttribute('aria-invalid', String(!valid));
        syncRange();
        if (valid) {
          accepted = input.valueAsNumber;
          update(accepted); changed(p.key === 'delay');
        }
      });
      input.addEventListener('change', () => {
        if (p.key === 'stagger' && input.value === '') return;
        if (!Number.isFinite(input.valueAsNumber)) {
          input.value = accepted;
          input.setAttribute('aria-invalid', 'false');
          syncRange();
          return;
        }
        const bounded = Math.max(p.min, Math.min(p.max, input.valueAsNumber));
        input.value = Number((p.min + Math.round((bounded - p.min) / p.step) * p.step).toFixed(6));
        input.setAttribute('aria-invalid', 'false');
        accepted = input.valueAsNumber;
        syncRange();
        update(accepted);
        changed(p.key === 'delay');
      });
      syncRange();
    }
    if (range) {
      const wrap = el('div', 'studio-field gsap-numeric-field');
      const row = el('div', 'gsap-number-row');
      row.append(range, input);
      wrap.append(el('label', '', p.label, { for: id }), row);
      return wrap;
    }
    const wrap = field(p.label, input);
    if (p.type === 'checkbox') wrap.classList.add('gsap-check');
    return wrap;
  }
  function renderSettings() {
    settingsBody.replaceChildren();
    const entry = entryFor(draft.effect);
    const title = el('div', 'gsap-current-row');
    const reset = button('Réinitialiser', () => {
      draft = defaultConfig(draft.effect);
      renderSettings();
      changed(true);
    }, 'gsap-reset');
    reset.id = 'gsap-reset';
    title.append(el('div', 'gsap-current-title', entry.name), reset);
    settingsBody.append(title, el('p', 'gsap-hint', `${categories[entry.category]} · ${entry.category === 'Text' ? 'Lettres ou bandes d’image.' : 'Réglages indépendants des keyframes.'}`));
    const timing = el('div', 'gsap-fields');
    for (const p of [n('duration', 'Durée / cycle (s)', 1.2, .05, 60, .05), n('delay', 'Délai initial (s)', 0, 0, 300, .05),
      n('repeat', 'Répétitions (−1 = ∞)', 0, -1, 99), n('repeatDelay', 'Pause / cycle (s)', 0, 0, 60, .05)]) {
      timing.append(inputFor(p, draft[p.key], v => { draft[p.key] = p.key === 'repeat' ? Math.floor(v) : v; }, `gsap-${p.key}`));
    }
    settingsBody.append(timing, inputFor({ key: 'yoyo', label: 'Aller-retour (yoyo)', type: 'checkbox' }, draft.yoyo, v => { draft.yoyo = v; }, 'gsap-yoyo'));
    if (customEase.has(entry.key)) {
      const ease = select(easeOptions, draft.options.ease || '');
      ease.id = 'gsap-ease';
      ease.addEventListener('change', () => { if (ease.value) draft.options.ease = ease.value; else delete draft.options.ease; changed(); });
      settingsBody.append(field('Courbe de mouvement', ease));
    }
    const specific = el('div', 'gsap-fields');
    const advanced = el('details', 'gsap-advanced');
    advanced.append(el('summary', '', 'Rendu avancé'));
    const advancedFields = el('div', 'gsap-fields');
    const ordinary = new Set((parameters[entry.key] || []).map(p => p.key));
    for (const p of descriptors(entry.key)) {
      const isText = !!(target?._textContent || target?.text);
      if (p.key === 'slices' && isText || p.key === 'characters' && !isText) continue;
      let value = draft.options[p.key] ?? (p.key === 'stagger' ? '' : p.value);
      if (p.key === 'cursorColor' && draft.options[p.key] === undefined) value = target?._textColor || p.value;
      const control = inputFor(p, value, v => { if (v === undefined) delete draft.options[p.key]; else draft.options[p.key] = v; }, `gsap-option-${p.key}`);
      if (p.type === 'text') control.classList.add('gsap-full');
      (ordinary.has(p.key) ? specific : advancedFields).append(control);
    }
    if (specific.children.length) settingsBody.append(el('div', 'gsap-section-label', 'Paramètres de l’effet'), specific);
    if (advancedFields.children.length) { advanced.append(advancedFields); settingsBody.append(advanced); }
    updateTransport();
  }
  function renderCatalog() {
    effectSelect.value = draft.effect;
    const entries = catalog().filter(e => (filter === 'All' || e.category === filter) && `${e.name} ${categories[e.category]} ${e.key}`.toLocaleLowerCase().includes(search));
    resultCount.textContent = `${entries.length} / ${catalog().length} effets`;
    catalogGrid.replaceChildren();
    for (const entry of entries) {
      const card = button('', () => choose(entry.key), 'gsap-effect');
      card.dataset.gsapEffect = entry.key;
      card.setAttribute('aria-pressed', String(draft?.effect === entry.key));
      card.append(icon(paths[entry.category]), el('span', '', entry.name));
      catalogGrid.append(card);
    }
    if (!entries.length) catalogGrid.append(el('p', 'gsap-hint gsap-full', 'Aucun effet. Essayez un autre nom ou une autre catégorie.'));
  }
  function choose(key) {
    if (!entryFor(key) || state.recording) return;
    stopPreview(false);
    draft = { ...defaultConfig(key), duration: draft?.duration || 1.2, delay: draft?.delay || 0 };
    dirty = true;
    pane.querySelector('.gsap-library').open = false;
    renderCatalog();
    renderSettings();
    announce('Effet sélectionné · appliquez-le pour le conserver dans le projet.');
    if (live.checked && canEdit()) preview();
  }
  function syncSelection(force = false) {
    if (!initialized) return;
    const selected = getSelectedLayer() || null;
    if (selected !== target || force) {
      stopPreview(false);
      target = selected;
      draft = normalize(target?.gsapEffect) || defaultConfig('elasticPop');
      dirty = false;
      renderCatalog();
      renderSettings();
      announce(target?.gsapEffect ? 'Effet enregistré · inclus dans la timeline et les exports.' : 'L’aperçu est temporaire. Appliquez l’effet pour le sauvegarder.');
    }
    targetName.textContent = target?.name || 'Aucun calque sélectionné';
    pane.querySelector('.gsap-empty').hidden = !!target;
    pane.querySelector('.gsap-target').hidden = !target;
    if (state.recording) announce('Export en cours : réglages verrouillés.');
    else if (target?.visible === false) announce('Ce calque est masqué. Rendez-le visible pour tester l’effet.', true);
    else if (StudioUI.isEditing()) announce('Terminez l’édition vectorielle pour régler les effets GSAP.');
    document.querySelectorAll('.studio-gsap-badge').forEach(badge => { badge.disabled = !!state.recording; });
    updateTransport();
  }
  function apply() {
    if (!canEdit()) return;
    for (const input of settingsBody.querySelectorAll('input')) if (!input.reportValidity()) return;
    stopPreview(false);
    commitEffect(normalize(draft), 'Apply GSAP Effect');
    dirty = false;
    announce('Effet appliqué · sauvegarde automatique, timeline et exports.');
    updateTransport();
  }
  function remove() {
    if (!canEdit() || !target.gsapEffect) return;
    stopPreview(false);
    commitEffect(null, 'Remove GSAP Effect');
    announce('Effet retiré. Vos keyframes et réglages de dessin sont conservés.');
    updateTransport();
  }
  function commitEffect(value, label) {
    TimelineStudio.saveWorkingStateToActiveScene();
    const sceneId = scene().id, layerId = target.id;
    const before = target.gsapEffect ? clone(target.gsapEffect) : null;
    const after = value ? clone(value) : null;
    // Keep a complete reversible command, scoped to this layer's effect only.
    const write = effect => {
      stopPreview(false);
      TimelineStudio.pausePreviewAll();
      const owner = state.scenes.find(s => s.id === sceneId);
      const layer = owner?.layers.find(l => l.id === layerId);
      if (!layer) return;
      if (effect) layer.gsapEffect = clone(effect);
      else delete layer.gsapEffect;
      TimelineStudio.renderTimeline();
      syncSelection(true);
      TimelineStudio.seekToGlobalTime(state.playheadTime);
      scheduleAutoSave();
    };
    CommandHistory.execute({ label, execute: () => write(after), undo: () => write(before), redo: () => write(after) });
  }
  function open() {
    if (!initialized) return;
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('is-collapsed')) UIPanelSystem.toggle('left-sidebar');
    switchSidebarTab('gsap');
    syncSelection();
    document.getElementById('stab-gsap').scrollIntoView({ block: 'nearest' });
  }
  function syncVisibility() {
    if (!initialized) return;
    const visible = document.getElementById('stab-gsap').classList.contains('active') &&
      !document.getElementById('sidebar').classList.contains('is-collapsed');
    document.querySelectorAll('[data-gsap-launch]').forEach(control => {
      control.classList.toggle('active', visible);
      control.setAttribute('aria-expanded', String(visible));
    });
  }
  function init(primitives) {
    if (initialized) return;
    ({ el, button, field, number, select, icon } = primitives);
    const tab = button('GSAP', open, 'sidebar-tab-btn', paths.Emphasis);
    tab.id = 'stab-gsap';
    tab.title = '50 effets GSAP · aperçu en temps réel';
    document.querySelector('.sidebar-tab-row').append(tab);
    pane = el('section', 'sidebar-tab-pane gsap-pane', null, { id: 'sidebar-pane-gsap', 'aria-label': 'Effets GSAP' });
    const heading = el('div', 'gsap-heading');
    heading.append(el('div', 'studio-eyebrow', 'Motion lab'), el('h3', '', 'Effets GSAP'), el('span', 'gsap-local', 'LOCAL · 50'));
    const targetRow = el('div', 'gsap-target');
    targetName = el('span');
    targetRow.append(icon('M4 4h16v16H4zM8 8h8v8H8z'), targetName);
    effectSelect = el('select', 'studio-select', null, { id: 'gsap-effect-select', 'aria-label': 'Effet GSAP à tester' });
    for (const [category, label] of Object.entries(categories)) {
      const group = el('optgroup', '', null, { label });
      catalog().filter(entry => entry.category === category).forEach(entry => {
        group.append(el('option', '', entry.name, { value: entry.key }));
      });
      effectSelect.append(group);
    }
    effectSelect.addEventListener('change', () => choose(effectSelect.value));
    const empty = el('div', 'gsap-empty');
    const demo = button('Ajouter un SVG de test', async () => {
      if (state.recording || StudioUI.isEditing()) return;
      demo.disabled = true;
      try { await StudioUI.insertAsset('rocket'); syncSelection(); open(); }
      finally { demo.disabled = false; }
    }, 'studio-action');
    demo.id = 'gsap-add-demo';
    empty.append(el('p', 'gsap-hint', 'Sélectionnez un calque, ou ajoutez un SVG pour commencer.'), demo);
    const searchInput = el('input', 'studio-search', null, { type: 'search', placeholder: 'Rechercher parmi les 50 effets…', 'aria-label': 'Rechercher un effet GSAP', id: 'gsap-search' });
    searchInput.addEventListener('input', () => { search = searchInput.value.trim().toLocaleLowerCase(); renderCatalog(); });
    const filters = el('div', 'gsap-categories');
    for (const [key, label] of [['All', 'Tous'], ...Object.entries(categories)]) {
      const b = button(label, () => {
        filter = key;
        filters.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node === b)));
        renderCatalog();
      }, 'gsap-category');
      b.dataset.gsapCategory = key;
      b.setAttribute('aria-pressed', String(key === filter));
      filters.append(b);
    }
    resultCount = el('span', 'gsap-count', '', { 'aria-live': 'polite' });
    catalogGrid = el('div', 'gsap-catalog', null, { 'aria-label': 'Catalogue des effets' });
    settingsBody = el('fieldset', 'gsap-settings');
    transport = el('div', 'gsap-transport');
    const liveRow = el('div', 'gsap-live-row');
    live = el('input', '', null, { type: 'checkbox', id: 'gsap-live' });
    live.checked = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    live.addEventListener('change', () => { if (live.checked && canEdit()) preview(); else if (!live.checked) stopPreview(); });
    liveRow.append(field('Aperçu automatique', live), el('span', 'gsap-live-indicator', 'TEMPS RÉEL'));
    const controls = el('div', 'gsap-play-controls');
    playButton = button('Rejouer', () => preview(), 'studio-action', 'M4 11a8 8 0 1 1 2 7M4 4v7h7');
    playButton.id = 'gsap-play';
    pauseButton = button('', () => {
      const tl = previewTarget && EffectManager.get(previewTarget);
      if (!tl) return;
      tl.paused(!tl.paused());
      updateTransport();
    }, 'studio-action');
    pauseButton.id = 'gsap-pause';
    stopButton = button('', () => { stopPreview(); announce('Aperçu arrêté · pose de la timeline restaurée.'); }, 'studio-action', 'M6 6h12v12H6z');
    stopButton.id = 'gsap-stop';
    stopButton.setAttribute('aria-label', 'Arrêter et restaurer la pose');
    clock = el('output', 'gsap-clock', '0.00 s', { 'aria-label': 'Temps de l’aperçu' });
    controls.append(playButton, pauseButton, stopButton);
    progress = el('input', 'gsap-progress', null, { type: 'range', min: 0, max: 1000, value: 0, step: 1, id: 'gsap-progress', 'aria-label': 'Position dans l’aperçu GSAP' });
    progress.addEventListener('input', () => {
      const at = Number(progress.value) / 1000;
      const tl = previewTarget && EffectManager.get(previewTarget);
      if (!tl) preview(true, at);
      else { tl.pause().totalTime(at * (tl.repeat() < 0 ? tl.duration() : tl.totalDuration()), false); updateTransport(); renderPreview(); }
      announce('Aperçu en pause · déplacement image par image.');
    });
    const actions = el('div', 'gsap-apply-actions');
    applyButton = button('Appliquer au calque', apply, 'studio-action primary', 'M5 12l4 4L19 6');
    applyButton.id = 'gsap-apply';
    removeButton = button('Retirer', remove, 'studio-action danger');
    removeButton.id = 'gsap-remove';
    actions.append(applyButton, removeButton);
    status = el('p', 'gsap-status', '', { role: 'status', 'aria-live': 'polite', id: 'gsap-status' });
    transport.append(liveRow, controls, progress, clock, actions, status);
    const dependencies = el('details', 'gsap-dependencies');
    dependencies.append(el('summary', '', 'Moteur & dépendances locales'));
    dependencies.append(el('p', 'gsap-hint', `GSAP ${window.gsap?.version || 'indisponible'} · Canvas 2D · 50 effets embarqués. Aucune installation ni connexion requise.`));
    const license = el('a', '', 'Licence GSAP', { href: 'vendor/gsap.LICENSE.txt', target: '_blank', rel: 'noopener' });
    dependencies.append(license, el('p', 'gsap-hint', 'La licence GSAP restreint les éditeurs visuels concurrents : un accord écrit peut être nécessaire.'));
    const library = el('details', 'gsap-library', null, { open: '' });
    const libraryTitle = el('summary');
    libraryTitle.append(document.createTextNode('Catalogue des effets'), resultCount);
    const libraryBody = el('div', 'gsap-library-body');
    libraryBody.append(searchInput, filters, catalogGrid);
    library.append(libraryTitle, libraryBody);
    pane.append(heading, targetRow, empty, field('Effet à tester', effectSelect), library, settingsBody, dependencies, transport);
    document.getElementById('sidebar-pane-drawing').after(pane);
    const launch = button('Effets GSAP', open, 'studio-action', paths.Emphasis);
    launch.id = 'btn-gsap-effects';
    document.getElementById('btn-assets-templates').after(launch);
    const tool = button('Effets GSAP', open, 'tool-btn', paths.Emphasis);
    tool.id = 'studio-gsap-tool';
    document.getElementById('studio-vector-style').after(tool);
    for (const control of [launch, tool]) {
      control.dataset.gsapLaunch = '';
      control.title = 'Ouvrir les 50 effets GSAP et leurs réglages en temps réel';
      control.setAttribute('aria-controls', 'sidebar-pane-gsap');
    }
    initialized = true;
    draft = defaultConfig('elasticPop');
    syncSelection(true);
    syncVisibility();
    new MutationObserver(syncVisibility).observe(document.getElementById('sidebar'), { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && previewTarget && !document.querySelector('dialog[open]') && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) stopPreview();
    });
  }
  return { init, open, syncSelection, syncVisibility, stopPreview, normalize, isPreviewing: layer => previewTarget === layer && EffectManager.has(layer) };
})();
window.StudioEffects = StudioEffects;
