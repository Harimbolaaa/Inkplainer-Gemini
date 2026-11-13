/* A local, non-destructive SVG animation workbench. No project changes until Add. */
const SVGWorkshop = (() => {
  'use strict';
  const C = SVGMotionCore;
  let el, button, field, number, select, icon, createDialog;
  let dialog, sourcePanel, inspector, sequence, canvas, status, stats, countLabel, playButton, seek, clock;
  let addButton, appendButton, gifButton, svgButton, cancelButton, exportProgress, exportLabel;
  let design, prepared, selectedStep, sourceTab = 'shape', shapeQuery = '', shapeCategory = 'Toutes';
  let items = [], selectedItem = 0;
  let editingId = null, projectId = null, initialized = false, loading = false, playing = false;
  let elapsed = 0, raf = 0, lastTick = 0, sourceVersion = 0, sourceTimer = 0, exportJob = null;
  let history = [], historyIndex = -1;
  let resolution = 512, fps = 24;
  const clone = value => JSON.parse(JSON.stringify(value));
  const partCount = () => prepared?.parts.length || 1;
  const timing = () => C.timing(design, partCount());
  const span = () => design.loop ? timing().cycle : timing().total;
  const durationText = seconds => seconds < 60 ? `${seconds.toFixed(2)} s` : `${Math.floor(seconds / 60)} min ${(seconds % 60).toFixed(1)} s`;
  const path = {
    play: 'm8 5 11 7-11 7z', pause: 'M8 5v14M16 5v14', restart: 'M4 10a8 8 0 1 1 2 8M4 3v7h7',
    plus: 'M12 5v14M5 12h14', close: 'M6 6l12 12M18 6L6 18', upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
    download: 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5', shape: 'M4 4h7v7H4zM17 4l5 7H12zM9 18a5 5 0 1 1-10 0 5 5 0 0 1 10 0m5-4h8v8h-8z',
  };
  function snapshot() { return design ? clone(design) : null; }
  function remember() {
    const current = snapshot();
    if (!current) return;
    const previous = history[historyIndex];
    if (previous && JSON.stringify(previous) === JSON.stringify(current)) return;
    history = history.slice(0, historyIndex + 1);
    history.push(current);
    if (history.length > 50) history.shift();
    historyIndex = history.length - 1;
    updateHistoryActions();
  }
  function updateHistoryActions() {
    const undo = dialog?.querySelector('#svg-undo');
    const redo = dialog?.querySelector('#svg-redo');
    if (undo) undo.disabled = historyIndex <= 0 || loading || !!exportJob;
    if (redo) redo.disabled = historyIndex >= history.length - 1 || loading || !!exportJob;
  }
  function restoreHistory(index) {
    if (index < 0 || index >= history.length || exportJob) return;
    design = clone(history[index]); historyIndex = index; selectedStep = design.steps[0].id;
    prepared = null; elapsed = 0; sourceVersion++;
    renderSource(); renderInspector(); renderSequence(); updateStats(); scheduleSource();
    announce(index === 0 ? 'Version initiale restaurée.' : 'Modification restaurée.');
    updateHistoryActions();
  }
  function undo() { restoreHistory(historyIndex - 1); }
  function redo() { restoreHistory(historyIndex + 1); }
  function copyConfiguration() {
    if (!design || !navigator.clipboard) { announce('La copie n’est pas disponible dans ce navigateur.', true); return; }
    navigator.clipboard.writeText(JSON.stringify(C.normalize(design), null, 2))
      .then(() => announce('Configuration copiée dans le presse-papiers.'))
      .catch(() => announce('Impossible de copier la configuration.', true));
  }
  function importConfiguration() {
    if (exportJob || !navigator.clipboard?.readText) { announce('La lecture du presse-papiers n’est pas disponible.', true); return; }
    navigator.clipboard.readText().then(source => {
      let candidate;
      try { candidate = C.normalize(JSON.parse(source)); } catch (_) { candidate = null; }
      if (!candidate) throw new Error('La configuration copiée est invalide.');
      items[selectedItem] = candidate; design = candidate; selectedStep = design.steps[0].id; prepared = null; elapsed = 0; sourceVersion++;
      remember();
      renderSource(); renderInspector(); renderSequence(); updateStats(); scheduleSource();
      announce('Configuration importée.');
    }).catch(error => announce(error.message || 'Impossible de lire la configuration.', true));
  }
  function announce(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }
  function updateActions() {
    const unavailable = loading || !prepared || !!exportJob;
    for (const b of [addButton, appendButton, gifButton, svgButton]) b.disabled = unavailable;
    addButton.textContent = editingId ? 'Mettre à jour le calque' : 'Ajouter au projet';
    cancelButton.hidden = !exportJob;
    updateHistoryActions();
  }
  function selectItem(index) {
    if (index < 0 || index >= items.length || exportJob) return;
    items[selectedItem] = design;
    selectedItem = index; design = items[selectedItem]; prepared = null; elapsed = 0;
    selectedStep = design.steps[0].id;
    renderSource(); renderInspector(); renderSequence(); updateStats(); scheduleSource();
  }
  function addItem() {
    if (exportJob || items.length >= 32) return;
    items[selectedItem] = design;
    const next = C.create(); next.name = `Élément ${items.length + 1}`;
    items.push(next); selectedItem = items.length - 1; design = next; prepared = null; elapsed = 0;
    selectedStep = design.steps[0].id; sourceTab = design.kind;
    renderSource(); renderInspector(); renderSequence(); updateStats(); scheduleSource();
    announce('Nouvel élément ajouté. Choisissez une forme, un SVG ou un texte.');
  }
  function removeItem(index = selectedItem) {
    if (items.length <= 1 || exportJob) return;
    items.splice(index, 1); selectedItem = Math.max(0, Math.min(index, items.length - 1));
    design = items[selectedItem]; prepared = null; elapsed = 0; selectedStep = design.steps[0].id;
    renderSource(); renderInspector(); renderSequence(); updateStats(); scheduleSource();
  }
  function duplicateItem() {
    if (items.length >= 32 || exportJob) return;
    items[selectedItem] = design;
    const copy = C.normalize(clone(design)); copy.name = `${design.name} · copie`;
    items.splice(selectedItem + 1, 0, copy); selectedItem += 1; design = copy; prepared = null; elapsed = 0;
    selectedStep = design.steps[0].id; renderSource(); renderInspector(); renderSequence(); updateStats(); scheduleSource();
    announce('Élément dupliqué.');
  }
  function updateStats() {
    const t = timing(), frames = Math.max(2, Math.ceil(t.cycle * fps));
    stats.textContent = `${design.steps.length} étapes · ${durationText(t.cycle)} / cycle · ${durationText(t.total)} dans le projet`;
    countLabel.textContent = `${items.length} objet${items.length > 1 ? 's' : ''} · ${partCount()} ${prepared?.text ? (partCount() > 1 ? 'lettres' : 'lettre') : (partCount() > 1 ? 'éléments' : 'élément')} · ${resolution} × ${resolution}`;
    dialog.querySelector('#svg-export-estimate').textContent = `${frames} images / cycle · ${fps} i/s · ${design.loop ? 'boucle infinie' : `${design.iterations} lecture${design.iterations > 1 ? 's' : ''}`}`;
    elapsed = Math.max(0, Math.min(elapsed, span()));
    updateActions();
  }
  function paint() {
    if (!dialog?.open) return;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 512, 512);
    if (prepared) SVGMotion.render(c, design, prepared, elapsed, 512, 512, { background: true });
    const length = span();
    seek.value = Math.round(elapsed / length * 1000);
    seek.style.setProperty('--pct', `${Number(seek.value) / 10}%`);
    clock.textContent = `${elapsed.toFixed(2)} / ${length.toFixed(2)} s`;
    const active = C.stateAt(design, elapsed, 0, partCount());
    sequence.querySelectorAll('[data-motion-step]').forEach(card => {
      card.classList.toggle('is-current', card.dataset.motionStep === active.step);
      card.style.setProperty('--step-progress', card.dataset.motionStep === active.step ? `${active.progress * 100}%` : '0%');
    });
  }
  function syncPlayButton() {
    playButton.replaceChildren(icon(playing ? path.pause : path.play), document.createTextNode(playing ? 'Pause' : 'Lecture'));
    playButton.setAttribute('aria-pressed', String(playing));
  }
  function pause() { playing = false; cancelAnimationFrame(raf); raf = 0; if (playButton) syncPlayButton(); }
  function play() {
    if (loading || !prepared || exportJob) return;
    if (elapsed >= span() - .001) elapsed = 0;
    playing = true; lastTick = performance.now(); syncPlayButton();
    cancelAnimationFrame(raf);
    const tick = now => {
      if (!playing || !dialog.open) return;
      elapsed += Math.min(.1, (now - lastTick) / 1000); lastTick = now;
      if (elapsed >= span()) {
        if (design.loop) elapsed %= span();
        else { elapsed = span(); pause(); }
      }
      paint();
      if (playing) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function edit(action, options = {}) {
    if (exportJob) return;
    const relative = elapsed / span();
    action();
    remember();
    elapsed = options.reset ? 0 : relative * span();
    renderSequence();
    updateStats();
    if (options.inspector) renderInspector();
    if (options.source) scheduleSource();
    else paint();
  }
  function scheduleSource() {
    const version = ++sourceVersion;
    clearTimeout(sourceTimer); loading = true; updateActions();
    announce('Préparation du motif local…');
    sourceTimer = setTimeout(async () => {
      try {
        const next = await SVGMotion.prepare(design);
        if (version !== sourceVersion || !dialog.open) return;
        prepared = next; loading = false;
        updateStats(); renderSequence(); paint();
        announce(next.warnings.length ? next.warnings.join(' ') : 'Prêt. Ajustez les réglages : le canevas se met à jour en direct.');
        if (playing && !raf) play();
      } catch (error) {
        if (version !== sourceVersion) return;
        loading = false; prepared = null; pause(); updateActions(); paint();
        announce(error.message, true);
      }
    }, 70);
  }
  function numeric(label, id, value, min, max, step, onChange) {
    const wrap = el('div', 'studio-field motion-numeric');
    const row = el('div', 'motion-number-row');
    const range = el('input', 'motion-range', null, { type: 'range', min, max, step, id: `${id}-range`, 'aria-label': `${label} — curseur` });
    const input = number(value, { min, max, step, id });
    let accepted = value;
    const sync = () => {
      range.value = input.value;
      range.style.setProperty('--pct', `${(Number(range.value) - min) / (max - min) * 100}%`);
    };
    input.addEventListener('input', () => {
      if (!Number.isFinite(input.valueAsNumber) || !input.validity.valid) return;
      accepted = input.valueAsNumber; sync(); onChange(accepted);
    });
    input.addEventListener('change', () => {
      if (!Number.isFinite(input.valueAsNumber)) input.value = accepted;
      else input.value = Number((min + Math.round((C.clamp(input.valueAsNumber, min, max) - min) / step) * step).toFixed(6));
      accepted = input.valueAsNumber; sync(); onChange(accepted);
    });
    range.addEventListener('input', () => { input.value = range.value; input.dispatchEvent(new Event('input', { bubbles: true })); });
    sync(); row.append(range, input);
    wrap.append(el('label', '', label, { for: id }), row);
    return wrap;
  }
  function check(label, id, checked, action) {
    const input = el('input', '', null, { type: 'checkbox', id });
    input.checked = checked;
    input.addEventListener('change', () => action(input.checked));
    const wrap = field(label, input); wrap.classList.add('motion-check');
    return wrap;
  }
  function colorControl(label, id, value, action) {
    const input = el('input', '', null, { type: 'color', id, value });
    input.addEventListener('input', () => action(input.value));
    return field(label, input);
  }
  function renderInspector() {
    inspector.replaceChildren();
    inspector.append(el('div', 'motion-eyebrow', '02 / PERSONNALISER'));
    const name = el('input', 'studio-input', null, { id: 'svg-design-name', maxlength: 80 });
    name.value = design.name;
    name.addEventListener('input', () => { design.name = name.value || 'Design animé'; });
    inspector.append(field('Nom du design', name));
    if (design.kind === 'svg') {
      inspector.append(check('Conserver les couleurs du SVG', 'svg-preserve-colors', design.preserveColors, value => edit(() => { design.preserveColors = value; }, { source: true, inspector: true })));
    }
    const colors = el('div', 'motion-pair');
    colors.append(colorControl('Remplissage', 'svg-fill', design.fill, value => edit(() => { design.fill = value; }, { source: true })),
      colorControl(design.kind === 'svg' && design.preserveColors ? 'Contour du tracé' : 'Contour', 'svg-stroke', design.stroke, value => edit(() => { design.stroke = value; }, { source: true })));
    if (design.kind === 'svg' && design.preserveColors) colors.querySelector('#svg-fill').disabled = true;
    inspector.append(colors, check('Sans remplissage', 'svg-no-fill', design.noFill, value => edit(() => { design.noFill = value; }, { source: true })));
    const stroke = numeric('Épaisseur du contour', 'svg-stroke-width', design.strokeWidth, 0, 20, .5, value => edit(() => { design.strokeWidth = value; }, { source: true }));
    if (design.kind === 'svg' && design.preserveColors) {
      inspector.querySelector('#svg-no-fill').disabled = true;
    }
    inspector.append(stroke, numeric('Taille du motif', 'svg-design-scale', design.scale, .35, 1.4, .05, value => edit(() => { design.scale = value; })));
    const mode = select([['all', 'Tout ensemble'], ['parts', 'Éléments / lettres décalés']], design.mode);
    mode.id = 'svg-animation-mode';
    mode.addEventListener('change', () => edit(() => { design.mode = mode.value; }, { inspector: true }));
    inspector.append(field('Animer', mode));
    const stagger = numeric('Décalage entre éléments (s)', 'svg-stagger', design.stagger, 0, .5, .01, value => edit(() => { design.stagger = value; }));
    if (design.mode === 'all') stagger.querySelectorAll('input').forEach(input => { input.disabled = true; });
    inspector.append(stagger);
    const selected = design.steps.find(s => s.id === selectedStep) || design.steps[0];
    selectedStep = selected.id;
    const preset = C.presets.find(p => p.id === selected.preset);
    const heading = el('div', 'motion-inspector-step');
    heading.append(el('div', 'motion-eyebrow', `ÉTAPE ${String(design.steps.indexOf(selected) + 1).padStart(2, '0')}`), el('h3', '', preset.name), el('p', 'motion-hint', preset.description));
    inspector.append(heading);
    inspector.append(numeric('Durée de l’étape (s)', 'svg-step-duration', selected.duration, .15, 60, .05, value => edit(() => { selected.duration = value; })),
      numeric('Pause après l’étape (s)', 'svg-step-hold', selected.hold, 0, 30, .05, value => edit(() => { selected.hold = value; })));
    if (['slide', 'rise', 'float', 'pulse', 'spin', 'swing', 'bounce', 'wave', 'exit'].includes(selected.preset)) {
      inspector.append(numeric('Intensité du mouvement', 'svg-step-amount', selected.amount, 0, 3, .05, value => edit(() => { selected.amount = value; })));
    }
    if (selected.preset !== 'hold') {
      const easing = select(C.easings, selected.easing);
      easing.id = 'svg-step-easing';
      easing.addEventListener('change', () => edit(() => { selected.easing = easing.value; }));
      inspector.append(field('Courbe de mouvement', easing));
    }
    const exportSettings = el('details', 'motion-export-settings');
    exportSettings.open = true;
    exportSettings.append(el('summary', '', 'Boucle & export'));
    const body = el('div', 'motion-details-body');
    body.append(check('GIF / SVG en boucle infinie', 'svg-loop', design.loop, value => edit(() => { design.loop = value; }, { inspector: true })),
      numeric(design.loop ? 'Cycles dans le projet' : 'Nombre de lectures', 'svg-iterations', design.iterations, 1, 20, 1, value => edit(() => { design.iterations = value; })),
      check('Aller-retour (yoyo)', 'svg-yoyo', design.yoyo, value => edit(() => { design.yoyo = value; })),
      numeric('Pause entre les cycles (s)', 'svg-cycle-gap', design.gap, 0, 10, .05, value => edit(() => { design.gap = value; })));
    const background = select([['#ffffff', 'Blanc'], ['transparent', 'Transparent'], ['#111827', 'Nuit'], ['#f4f1eb', 'Papier']], design.background);
    background.id = 'svg-background';
    background.addEventListener('change', () => edit(() => { design.background = background.value; }));
    body.append(field('Fond de l’aperçu et des exports', background), el('p', 'motion-hint', 'Le fond de votre projet est conservé. Pour un GIF avec des fondus doux, préférez un fond uni.'));
    const outputs = el('div', 'motion-pair');
    const size = select([[256, '256 px'], [512, '512 px'], [768, '768 px'], [1024, '1024 px']], resolution);
    size.id = 'svg-export-size'; size.addEventListener('change', () => { resolution = Number(size.value); updateStats(); });
    const rate = select([[12, '12 i/s'], [20, '20 i/s'], [24, '24 i/s'], [30, '30 i/s']], fps);
    rate.id = 'svg-export-fps'; rate.addEventListener('change', () => { fps = Number(rate.value); updateStats(); });
    outputs.append(field('Résolution GIF', size), field('Fluidité', rate)); body.append(outputs);
    exportSettings.append(body); inspector.append(exportSettings);
    const speed = el('div', 'motion-speed-note');
    speed.append(icon('M13 2 4 14h7l-1 8 10-13h-7z'), el('span', '', `Export Turbo : jusqu’à ${Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1 || 2))} workers locaux, palettes en parallèle et mémoire bornée.`));
    inspector.append(speed);
  }
  function useShape(shape) {
    edit(() => { design.kind = 'shape'; design.shape = shape.id; design.name = `${shape.name} animé`; }, { source: true, reset: true, inspector: true });
    renderSource();
  }
  function renderSource() {
    sourcePanel.replaceChildren();
    const objectBar = el('div', 'motion-object-bar');
    objectBar.append(el('div', 'motion-eyebrow', `ÉLÉMENTS · ${items.length}/32`));
    const objectList = el('div', 'motion-object-list');
    items.forEach((item, index) => {
      const card = el('div', `motion-object${index === selectedItem ? ' active' : ''}`);
      const choose = button(`${index + 1}. ${item.name}`, () => selectItem(index), 'motion-object-select');
      choose.setAttribute('aria-pressed', String(index === selectedItem));
      const remove = button('', () => removeItem(index), 'motion-object-remove', path.close);
      remove.setAttribute('aria-label', `Supprimer ${item.name}`); remove.disabled = items.length <= 1;
      card.append(choose, remove); objectList.append(card);
    });
    const objectActions = el('div', 'motion-object-actions');
    objectActions.append(button('Ajouter', addItem, 'studio-action', path.plus), button('Dupliquer', duplicateItem, 'studio-action'));
    objectBar.append(objectList, objectActions); sourcePanel.append(objectBar);
    const tabs = el('div', 'motion-source-tabs');
    for (const [id, label] of [['shape', 'Formes'], ['svg', 'SVG'], ['text', 'Texte']]) {
      const tab = button(label, () => {
        if (exportJob) return;
        sourceTab = id;
        if (id === 'text' && design.kind !== 'text') edit(() => { design.kind = 'text'; design.name = 'Texte animé'; design.mode = 'parts'; }, { source: true, reset: true, inspector: true });
        renderSource();
      }, `motion-source-tab${sourceTab === id ? ' active' : ''}`);
      tab.dataset.motionSource = id; tab.setAttribute('aria-pressed', String(sourceTab === id)); tabs.append(tab);
    }
    sourcePanel.append(el('div', 'motion-eyebrow', '01 / CHOISIR LE MOTIF'), tabs);
    if (sourceTab === 'shape') {
      const search = el('input', 'studio-search', null, { id: 'svg-shape-search', type: 'search', placeholder: 'Chercher une forme…', 'aria-label': 'Rechercher une forme' });
      search.value = shapeQuery;
      const categories = el('div', 'motion-shape-categories');
      for (const category of ['Toutes', 'Géométrie', 'Symboles', 'Traits']) {
        const b = button(category, () => { shapeCategory = category; renderSource(); }, `motion-category${shapeCategory === category ? ' active' : ''}`);
        categories.append(b);
      }
      const grid = el('div', 'motion-shape-grid');
      const paintShapes = () => {
        grid.replaceChildren();
        for (const shape of C.shapes.filter(s => (shapeCategory === 'Toutes' || s.category === shapeCategory) && s.name.toLocaleLowerCase().includes(shapeQuery))) {
              const card = button('', () => useShape(shape), 'motion-shape');
          card.dataset.motionShape = shape.id;
          card.setAttribute('aria-pressed', String(design.kind === 'shape' && design.shape === shape.id));
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), p = document.createElementNS(svg.namespaceURI, 'path');
          svg.setAttribute('viewBox', '0 0 256 256'); svg.setAttribute('aria-hidden', 'true');
          p.setAttribute('d', shape.d); p.setAttribute('fill', shape.open ? 'none' : '#e2e5ff');
          p.setAttribute('stroke', '#646c96'); p.setAttribute('stroke-width', '10'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
          svg.append(p); card.append(svg, el('span', '', shape.name)); grid.append(card);
        }
        if (!grid.children.length) grid.append(el('p', 'motion-hint', 'Aucune forme ne correspond à cette recherche.'));
      };
      search.addEventListener('input', () => { shapeQuery = search.value.trim().toLocaleLowerCase(); paintShapes(); });
      sourcePanel.append(search, categories, grid, el('p', 'motion-hint', '24 essentiels, entièrement locaux. Chaque forme peut être redimensionnée, recolorée et animée.'));
      paintShapes();
    } else if (sourceTab === 'svg') {
      const drop = el('div', 'motion-dropzone');
      const input = el('input', '', null, { id: 'svg-workshop-file', type: 'file', accept: '.svg,image/svg+xml', hidden: '' });
      input.addEventListener('change', () => { if (input.files[0]) importFile(input.files[0]); });
      drop.append(icon(path.upload), el('strong', '', 'Votre SVG, en mouvement'), el('p', 'motion-hint', 'Glissez votre fichier ici ou choisissez-le sur votre appareil.'), button('Importer un SVG', () => input.click(), 'studio-action'), input);
      drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragging'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
      drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('dragging'); if (event.dataTransfer.files[0]) importFile(event.dataTransfer.files[0]); });
      const paste = el('details', 'motion-paste');
      paste.append(el('summary', '', 'Ou coller du code SVG'));
      const source = el('textarea', 'studio-input', null, { id: 'svg-workshop-code', rows: 7, spellcheck: false, 'aria-label': 'Code SVG à importer', placeholder: '<svg viewBox="0 0 256 256">…</svg>' });
      paste.append(source, button('Utiliser ce SVG', () => importSVG(source.value, 'SVG importé'), 'studio-action'));
      sourcePanel.append(drop, paste, el('p', 'motion-hint', 'Tracés, formes, groupes, dégradés et contours. Jusqu’à 2 Mo ; les SVG très détaillés sont animés en un seul bloc. Pas de scripts, de liens externes ni d’images intégrées.'));
    } else {
      const text = el('textarea', 'studio-input motion-text-input', null, { id: 'svg-workshop-text', rows: 4, maxlength: 240, 'aria-label': 'Texte à animer' });
      text.value = design.text;
      text.addEventListener('input', () => edit(() => { design.text = text.value; }, { source: true }));
      const font = select(C.fonts.map(f => [f, f]), design.font);
      font.id = 'svg-text-font'; font.addEventListener('change', () => edit(() => { design.font = font.value; }, { source: true }));
      sourcePanel.append(field('Vos lettres, vos mots', text), field('Police locale', font),
        check('Texte en gras', 'svg-text-bold', design.bold, value => edit(() => { design.bold = value; }, { source: true })),
        numeric('Espacement des lettres', 'svg-text-spacing', design.letterSpacing, -4, 20, .5, value => edit(() => { design.letterSpacing = value; }, { source: true })),
        el('p', 'motion-hint', 'Accents, caractères Unicode et plusieurs lignes. Le mode « éléments / lettres décalés » anime les lettres sans couper les caractères composés.'));
    }
    const dependencies = el('details', 'motion-dependencies');
    dependencies.append(el('summary', '', 'Bibliothèques locales'), el('p', 'motion-hint', `SVG.js 3.2.5 · Anime.js 3.2.2 · DOMPurify ${DOMPurify.version} · gifenc 1.0.3. Aucune requête à un CDN. Licences et empreintes dans vendor/.`));
    sourcePanel.append(dependencies);
  }
  function renderSequence() {
    sequence.replaceChildren();
    const times = timing().steps;
    for (const [index, step] of design.steps.entries()) {
      const preset = C.presets.find(p => p.id === step.preset);
      const card = el('div', `motion-step${selectedStep === step.id ? ' selected' : ''}`, null, { 'data-motion-step': step.id });
      const choose = button('', () => {
        selectedStep = step.id;
        elapsed = times[index].start + times[index].active * .35;
        renderSequence(); renderInspector(); paint();
      }, 'motion-step-select');
      choose.setAttribute('aria-pressed', String(selectedStep === step.id));
      choose.append(el('span', 'motion-step-number', String(index + 1).padStart(2, '0')), el('span', 'motion-step-name', preset.name), el('span', 'motion-step-time', `${step.duration.toFixed(2)} s${step.hold ? ` + ${step.hold.toFixed(2)}` : ''}`));
      const actions = el('div', 'motion-step-actions');
      for (const [label, svgPath, action, disabled] of [
        ['Déplacer avant', 'm14 6-6 6 6 6', () => { [design.steps[index - 1], design.steps[index]] = [step, design.steps[index - 1]]; }, index === 0],
        ['Déplacer après', 'm10 6 6 6-6 6', () => { [design.steps[index], design.steps[index + 1]] = [design.steps[index + 1], step]; }, index === design.steps.length - 1],
        ['Dupliquer', 'M8 3h13v13M3 8h13v13H3z', () => { const copy = { ...step, id: crypto.randomUUID() }; design.steps.splice(index + 1, 0, copy); selectedStep = copy.id; }, design.steps.length >= 64],
        ['Supprimer', 'M6 6l12 12M18 6L6 18', () => { design.steps.splice(index, 1); selectedStep = design.steps[Math.max(0, index - 1)].id; }, design.steps.length === 1],
      ]) {
        const b = button('', () => edit(action, { inspector: true }), 'motion-step-action', svgPath);
        b.setAttribute('aria-label', `${label} : ${preset.name}, étape ${index + 1}`); b.title = label; b.disabled = disabled; actions.append(b);
      }
      card.append(choose, actions); sequence.append(card);
    }
    dialog.querySelector('#svg-add-step').disabled = design.steps.length >= 64 || !!exportJob;
  }
  async function importSVG(source, name = 'SVG importé') {
    if (exportJob) return false;
    const version = ++sourceVersion;
    clearTimeout(sourceTimer); loading = true; updateActions(); announce('Vérification du SVG local…');
    try {
      if (typeof source !== 'string' || source.length > 2 * 1024 * 1024) throw new Error('Le fichier SVG doit faire moins de 2 Mo.');
      const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
      const metadata = xml.querySelector('metadata#inkplainer-motion-v1');
      let candidate, warnings = [];
      if (metadata && !xml.querySelector('parsererror')) {
        try { candidate = C.normalize(JSON.parse(metadata.textContent)); } catch (_) { /* Fall through to the ordinary, sanitized SVG importer. */ }
        if (candidate?.kind === 'svg') candidate.svg = new XMLSerializer().serializeToString(SVGMotion.sanitize(candidate.svg).root);
      }
      if (!candidate) {
        const clean = SVGMotion.sanitize(source);
        warnings = clean.warnings;
        candidate = C.normalize({
          ...design, kind: 'svg', svg: new XMLSerializer().serializeToString(clean.root),
          name: name.replace(/\.svg$/i, '').slice(0, 80), preserveColors: true, mode: 'parts',
        });
      }
      const next = await SVGMotion.prepare(candidate);
      if (version !== sourceVersion || !dialog.open) return false;
      items[selectedItem] = design;
      items.push(candidate); selectedItem = items.length - 1;
      design = candidate; prepared = next; sourceTab = design.kind; elapsed = 0; loading = false;
      if (!design.steps.some(step => step.id === selectedStep)) selectedStep = design.steps[0].id;
      renderSource(); renderInspector(); renderSequence(); updateStats(); paint();
      const messages = [...new Set([...warnings, ...next.warnings])];
      announce(messages.length ? messages.join(' ') : 'SVG prêt. Vos couleurs, éléments et étapes restent personnalisables.');
      if (playing && !raf) play();
      return true;
    } catch (error) {
      if (version === sourceVersion) { loading = false; updateActions(); announce(error.message, true); }
      return false;
    }
  }
  async function importFile(file) {
    if (file.size > 2 * 1024 * 1024) { announce('Le fichier SVG doit faire moins de 2 Mo.', true); return; }
    if (exportJob) return;
    const version = ++sourceVersion;
    loading = true; updateActions(); announce('Lecture du SVG local…');
    try {
      const source = await file.text();
      if (version !== sourceVersion || !dialog.open) return;
      await importSVG(source, file.name);
    } catch (error) { loading = false; updateActions(); announce(`Import impossible : ${error.message}`, true); }
  }
  function download(blob, extension) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = `${design.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 70) || 'animation'}.${extension}`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function lockExport(job) {
    pause(); exportJob = job;
    job.controls = [...dialog.querySelectorAll('input,select,textarea,button')].filter(control => !control.classList.contains('studio-close') && control !== cancelButton)
      .map(control => [control, control.disabled]);
    job.controls.forEach(([control]) => { control.disabled = true; });
    exportProgress.hidden = false; exportProgress.value = 0; exportLabel.hidden = false;
    cancelButton.hidden = false; cancelButton.disabled = false;
  }
  function unlockExport(job) {
    job.controls.forEach(([control, disabled]) => { if (control.isConnected) control.disabled = disabled; });
    if (exportJob === job) exportJob = null;
    exportProgress.hidden = true; exportLabel.hidden = true; cancelButton.hidden = true;
    updateActions();
  }
  function cancelExport() {
    if (!exportJob) return;
    exportJob.cancelled = true;
    exportJob.worker?.terminate();
    exportJob.quantizers?.forEach(worker => worker.terminate());
    for (const reject of exportJob.rejectors || []) reject(new DOMException('Export annulé', 'AbortError'));
  }
  async function exportGIF(shouldDownload = true) {
    if (exportJob || loading || !prepared) throw new Error('Attendez la fin de la préparation.');
    const t = timing(), frames = Math.max(2, Math.ceil(t.cycle * fps)), size = resolution;
    if (frames > 1800 || frames * size * size > 500000000) throw new Error('Ce GIF serait trop volumineux. Réduisez la résolution ou les étapes ; utilisez les scènes et l’export vidéo pour une longue durée.');
    const cores = navigator.hardwareConcurrency || 4;
    const workerCount = Math.max(2, Math.min(8, cores - 1 || 2, frames));
    const workerURL = new URL('svg-motion-gif-worker.js', document.baseURI);
    const encoderURL = new URL(workerURL); encoderURL.searchParams.set('role', 'encode');
    const quantizerURL = new URL(workerURL); quantizerURL.searchParams.set('role', 'quantize');
    const job = {
      cancelled: false,
      worker: new Worker(encoderURL, { type: 'module' }),
      quantizers: Array.from({ length: workerCount }, () => new Worker(quantizerURL, { type: 'module' })),
      rejectors: new Set(),
    };
    lockExport(job);
    const startedAt = performance.now();
    const request = (worker, message, expected, transfer = []) => new Promise((resolve, reject) => {
      if (job.cancelled) { reject(new DOMException('Export annulé', 'AbortError')); return; }
      job.rejectors.add(reject);
      worker.onmessage = event => {
        if (event.data.type === 'error') { job.rejectors.delete(reject); reject(new Error(event.data.message)); }
        else if (event.data.type === expected) { job.rejectors.delete(reject); resolve(event.data); }
      };
      worker.onerror = event => { job.rejectors.delete(reject); reject(new Error(event.message || 'Le worker GIF ne peut pas démarrer.')); };
      worker.postMessage(message, transfer);
    });
    try {
      announce(`Mode Turbo · ${workerCount} workers de palette · encodage en flux…`);
      await request(job.worker, { type: 'start', width: size, height: size, repeat: design.loop ? 0 : design.iterations === 1 ? -1 : design.iterations - 1 }, 'ready');
      const frame = document.createElement('canvas'); frame.width = frame.height = size;
      const c = frame.getContext('2d', { willReadFrequently: true });
      // Keep only one batch of RGBA frames in memory while quantizing all of
      // that batch in parallel. Results are then streamed to one ordered encoder.
      for (let start = 0; start < frames; start += workerCount) {
        const tasks = [];
        for (let offset = 0; offset < workerCount && start + offset < frames; offset++) {
          const index = start + offset;
          if (job.cancelled) throw new DOMException('Export annulé', 'AbortError');
          c.clearRect(0, 0, size, size);
          SVGMotion.render(c, design, prepared, index * t.cycle / frames, size, size, { background: true });
          const rgba = c.getImageData(0, 0, size, size).data;
          const delay = Math.max(2, Math.round((index + 1) * t.cycle * 100 / frames) - Math.round(index * t.cycle * 100 / frames)) * 10;
          tasks.push(request(job.quantizers[offset], {
            type: 'frame', index, buffer: rgba.buffer, delay, transparent: design.background === 'transparent',
          }, 'quantized', [rgba.buffer]));
        }
        const quantized = await Promise.all(tasks);
        const result = await request(job.worker, { type: 'indexed-batch', items: quantized }, 'batch', quantized.map(item => item.indexed));
        exportProgress.value = (result.index + 1) / frames;
        exportLabel.textContent = `GIF Turbo ${workerCount}× · ${result.index + 1} / ${frames} images`;
        await new Promise(requestAnimationFrame);
      }
      const result = await request(job.worker, { type: 'finish' }, 'done');
      if (job.cancelled) throw new DOMException('Export annulé', 'AbortError');
      const blob = new Blob([result.buffer], { type: 'image/gif' });
      if (shouldDownload) download(blob, 'gif');
      announce(`GIF prêt en ${((performance.now() - startedAt) / 1000).toFixed(2)} s · Turbo ${workerCount}× · ${(blob.size / 1024).toFixed(0)} Ko · ${frames} images · ${design.loop ? 'boucle infinie' : `${design.iterations} lectures`}.`);
      return blob;
    } catch (error) {
      announce(error.name === 'AbortError' ? 'Export annulé. Aucun fichier partiel téléchargé.' : error.message, error.name !== 'AbortError');
      throw error;
    } finally {
      job.worker.terminate();
      job.quantizers.forEach(worker => worker.terminate());
      unlockExport(job);
    }
  }
  async function exportSVG(shouldDownload = true) {
    if (exportJob || loading || !prepared) throw new Error('Attendez la fin de la préparation.');
    const job = { cancelled: false }; lockExport(job);
    try {
      exportLabel.textContent = 'Préparation du SVG animé autonome…';
      const source = await SVGMotion.animatedSVG(design, prepared, fps, {
        cancelled: () => job.cancelled,
        onProgress: value => { exportProgress.value = value; },
      });
      if (job.cancelled) throw new DOMException('Export annulé', 'AbortError');
      const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
      if (xml.querySelector('parsererror')) throw new Error('Le SVG animé ne peut pas être sérialisé.');
      xml.documentElement.setAttribute('width', resolution); xml.documentElement.setAttribute('height', resolution);
      const blob = new Blob([new XMLSerializer().serializeToString(xml)], { type: 'image/svg+xml' });
      if (blob.size > 20 * 1024 * 1024) throw new Error('Ce SVG animé dépasse 20 Mo. Simplifiez le motif ou la séquence.');
      if (shouldDownload) download(blob, 'svg');
      announce(`SVG animé prêt · ${(blob.size / 1024).toFixed(0)} Ko · autonome et sans script.`);
      return blob;
    } catch (error) { announce(error.name === 'AbortError' ? 'Export annulé.' : error.message, error.name !== 'AbortError'); throw error; }
    finally { unlockExport(job); }
  }
  async function addToProject(append = false) {
    if (projectId !== currentProjectId) { announce('Le projet a changé. Rouvrez l’atelier.', true); return; }
    if (loading || exportJob || !prepared) return;
    items[selectedItem] = design;
    const values = items.map(item => C.normalize(item));
    if (values.some(value => !value)) { announce('Un élément de la composition est invalide.', true); return; }
    loading = true; updateActions();
    try {
      for (const [index, value] of values.entries()) {
        await SVGMotion.prepare(value);
        await StudioUI.insertMotionDesign(value, {
          append: append && index === 0,
          updateId: !append && index === selectedItem ? editingId : null,
        });
      }
      dialog.close(); showToast(`${values.length} élément${values.length > 1 ? 's' : ''} animé${values.length > 1 ? 's' : ''} ajouté${values.length > 1 ? 's' : ''} au projet.`);
    } catch (error) { announce(error.message, true); }
    finally { loading = false; updateActions(); }
  }
  function open(layer = getSelectedLayer()) {
    if (!initialized || state.recording || StudioUI.isEditing()) { showToast('Terminez l’édition ou l’export en cours.'); return; }
    pause(); window.StudioEffects?.stopPreview(); TimelineStudio.pausePreviewAll();
    cancelAnimationFrame(state.animFrame); state.playing = false;
    design = layer?.svgMotion ? C.normalize(clone(layer.svgMotion)) : C.create();
    items = [design]; selectedItem = 0;
    editingId = layer?.svgMotion ? layer.id : null; projectId = currentProjectId;
    selectedStep = design.steps[0].id; sourceTab = design.kind; prepared = null; elapsed = 0;
    history = [snapshot()]; historyIndex = 0;
    sourceVersion++; shapeQuery = ''; shapeCategory = 'Toutes';
    renderSource(); renderInspector(); renderSequence(); updateStats();
    if (!dialog.open) dialog.showModal();
    playing = !matchMedia('(prefers-reduced-motion: reduce)').matches; syncPlayButton();
    scheduleSource();
  }
  function init(primitives) {
    if (initialized) return;
    ({ el, button, field, number, select, icon, createDialog } = primitives);
    dialog = createDialog('Atelier SVG', 'Des formes, des lettres, du mouvement. Composez une boucle ou ajoutez-la à votre histoire.');
    dialog.id = 'svg-workshop-dialog'; dialog.classList.add('svg-workshop');
    dialog.querySelector('.studio-eyebrow').textContent = 'Inkplainer · Motion design local';
    const body = el('div', 'motion-workspace');
    sourcePanel = el('aside', 'motion-sources');
    inspector = el('aside', 'motion-inspector');
    const preview = el('section', 'motion-preview');
    const previewHead = el('div', 'motion-preview-head');
    countLabel = el('span', 'motion-hint');
    previewHead.append(el('span', 'motion-eyebrow', 'APERÇU EN DIRECT'), countLabel);
    const stage = el('div', 'motion-stage');
    canvas = el('canvas', 'motion-canvas', null, { id: 'svg-workshop-preview', width: 512, height: 512, 'aria-label': 'Aperçu du design animé' });
    stage.append(canvas);
    const controls = el('div', 'motion-playbar');
    const restart = button('', () => { elapsed = 0; lastTick = performance.now(); paint(); }, 'studio-action', path.restart);
    restart.setAttribute('aria-label', 'Revenir au début de l’animation');
    playButton = button('Lecture', () => playing ? pause() : play(), 'studio-action', path.play); playButton.id = 'svg-workshop-play';
    seek = el('input', 'motion-range', null, { id: 'svg-workshop-seek', type: 'range', min: 0, max: 1000, step: 1, value: 0, 'aria-label': 'Position dans l’animation SVG' });
    seek.addEventListener('input', () => { pause(); elapsed = Number(seek.value) / 1000 * span(); paint(); });
    clock = el('output', 'motion-clock', '0.00 s');
    controls.append(restart, playButton, seek, clock);
    const undoButton = button('Annuler', undo, 'studio-action', 'M5 12h14M5 12l5-5M5 12l5 5');
    undoButton.id = 'svg-undo'; undoButton.title = 'Annuler (Ctrl/Cmd+Z)';
    const redoButton = button('Rétablir', redo, 'studio-action', 'M19 12H5m14 0-5-5m5 5-5 5');
    redoButton.id = 'svg-redo'; redoButton.title = 'Rétablir (Ctrl/Cmd+Y)';
    controls.append(undoButton, redoButton);
    status = el('p', 'motion-status', '', { id: 'svg-workshop-status', role: 'status', 'aria-live': 'polite' });
    preview.append(previewHead, stage, controls, status);
    body.append(sourcePanel, preview, inspector);
    const timeline = el('section', 'motion-sequence-area');
    const head = el('div', 'motion-sequence-head');
    const titles = el('div');
    stats = el('span', 'motion-hint'); titles.append(el('strong', '', '03 / Composer la séquence'), stats);
    const adding = el('div', 'motion-sequence-add');
    const preset = select(C.presets.map(p => [p.id, p.name]), 'float'); preset.id = 'svg-add-preset'; preset.setAttribute('aria-label', 'Animation à ajouter à la séquence');
    const add = button('Ajouter une étape', () => {
      if (design.steps.length >= 64 || exportJob) return;
      const next = C.step(preset.value); design.steps.push(next); selectedStep = next.id;
      remember();
      const t = timing().steps.at(-1); elapsed = t.start + t.active * .35;
      renderSequence(); renderInspector(); updateStats(); paint();
      sequence.lastElementChild?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, 'studio-action', path.plus);
    add.id = 'svg-add-step'; adding.append(preset, add); head.append(titles, adding);
    sequence = el('div', 'motion-sequence', null, { id: 'svg-workshop-sequence', 'aria-label': 'Étapes de l’animation' });
    timeline.append(head, sequence);
    const footer = el('div', 'motion-workshop-footer');
    const exports = el('div', 'motion-export-actions');
    svgButton = button('SVG animé', () => exportSVG().catch(error => { if (error.name !== 'AbortError') announce(error.message, true); }), 'studio-action', path.download);
    svgButton.id = 'svg-export-svg';
    gifButton = button('GIF animé', () => exportGIF().catch(error => { if (error.name !== 'AbortError') announce(error.message, true); }), 'studio-action', path.download);
    gifButton.id = 'svg-export-gif'; exports.append(svgButton, gifButton);
    const feedback = el('div', 'motion-export-feedback');
    const estimate = el('span', 'motion-hint', '', { id: 'svg-export-estimate' });
    exportProgress = el('progress', '', null, { max: 1, value: 0, hidden: '', 'aria-label': 'Progression de l’export' });
    exportLabel = el('span', 'motion-hint', '', { hidden: '' });
    cancelButton = button('Annuler l’export', cancelExport, 'studio-action danger'); cancelButton.id = 'svg-cancel-export'; cancelButton.hidden = true;
    feedback.append(estimate, exportProgress, exportLabel, cancelButton);
    const actions = el('div', 'motion-project-actions');
    appendButton = button('Ajouter à la suite', () => addToProject(true), 'studio-action');
    appendButton.id = 'svg-append-scene'; appendButton.title = 'Ajouter une nouvelle scène à la fin du projet, sans remplacer les précédentes';
    addButton = button('Ajouter au projet', () => addToProject(false), 'studio-action primary');
    addButton.id = 'svg-add-to-project'; actions.append(appendButton, addButton);
    footer.append(exports, feedback, actions);
    dialog.append(body, timeline, footer);
    const tools = el('div', 'motion-utility-actions');
    const copy = button('Copier JSON', copyConfiguration, 'studio-action');
    copy.id = 'svg-copy-config'; copy.title = 'Copier la configuration de cette animation';
    const paste = button('Coller JSON', importConfiguration, 'studio-action');
    paste.id = 'svg-paste-config'; paste.title = 'Importer une configuration depuis le presse-papiers';
    tools.append(copy, paste);
    dialog.querySelector('.studio-dialog-head').append(tools);
    dialog.addEventListener('keydown', event => {
      if (event.key === ' ' && event.target === dialog) { event.preventDefault(); playing ? pause() : play(); }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    });
    dialog.addEventListener('close', () => { pause(); sourceVersion++; clearTimeout(sourceTimer); cancelExport(); });
    dialog.addEventListener('cancel', event => { if (exportJob) { event.preventDefault(); cancelExport(); } });
    const launch = button('Atelier SVG', () => open(), 'tool-btn motion-workshop-launch', path.shape);
    launch.id = 'btn-svg-workshop'; launch.title = 'Créer un SVG animé ou un GIF en boucle';
    document.getElementById('studio-gsap-tool').after(launch);
    const libraryLink = button('Atelier SVG animé', () => { document.getElementById('assets-templates-dialog').close(); open(); }, 'studio-tab');
    document.querySelector('#assets-templates-dialog .studio-tabs').insertBefore(libraryLink, document.querySelector('#assets-templates-dialog .studio-offline'));
    initialized = true;
  }
  return { init, open, pause, importSVG, importFile, exportGIF, exportSVG, cancelExport, getDesign: () => clone(design), getTiming: () => timing(), isExporting: () => !!exportJob };
})();
window.SVGWorkshop = SVGWorkshop;
