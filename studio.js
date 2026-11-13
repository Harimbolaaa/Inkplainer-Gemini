/* Inkplainer local creative tools. All artwork, templates and math are bundled. */
const StudioUI = (() => {
  'use strict';
  const { clone, clamp, channels } = StudioCore;
  const NS = 'http://www.w3.org/2000/svg';
  const expanded = new Set();
  const geometryCache = new WeakMap();
  const imageVersions = new WeakMap();
  const easings = [
    ['linear', 'Linear'], ['ease-in-out', 'Ease In-Out'], ['spring', 'Spring'],
    ['bounce', 'Bounce'], ['expo', 'Expo'],
  ];
  let library, librarySide, libraryMain, libraryStatus, libraryTabs;
  let presetDialog, keyDialog, vectorDialog;
  let tab = 'assets', category = 'All', query = '', savedTemplates = [];
  let scaleMode = '2500', collectionFilter = 'All', styleFilter = 'all', classFilter = 'all', tagFilter = '';
  let filteredAssets = [], virtualGrid = null, virtualTop = null, virtualBottom = null, virtualCountLabel = null;
  const previewCache = new Map();
  const favoriteIds = new Set((() => {
    try { return JSON.parse(localStorage.getItem('inkplainer_asset_favorites_v1') || '[]'); } catch (_) { return []; }
  })());
  let recentIds = (() => {
    try { return JSON.parse(localStorage.getItem('inkplainer_asset_recent_v1') || '[]'); } catch (_) { return []; }
  })();
  let primaryColor = '#c7d2fe', strokeColor = '#182234';
  let templateDB;
  let initialized = false;
  let pen = null, vectorOverlay, vectorPanel;
  let penStroke = '#182234', penFill = '#c7d2fe', penWidth = 4, penNoFill = true;
  let selectedNode = null;
  let activeKey = null;

  // Small DOM primitives follow the project's native controls and design tokens.
  function el(tag, className, text, attrs = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    }
    return node;
  }
  function icon(path) {
    const svg = document.createElementNS(NS, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'studio-icon' })) svg.setAttribute(k, v);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', path);
    svg.append(p);
    return svg;
  }
  function button(label, action, className = 'studio-action', path) {
    const b = el('button', className, undefined, { type: 'button' });
    if (path) b.append(icon(path));
    b.append(document.createTextNode(label));
    b.addEventListener('click', action);
    return b;
  }
  function field(label, input) {
    const wrap = el('label', 'studio-field');
    wrap.append(el('span', '', label), input);
    return wrap;
  }
  function number(value, opts = {}) {
    const n = el('input', 'studio-input', null, { type: 'number', ...opts });
    n.value = value;
    return n;
  }
  function select(options, value, className = 'studio-select') {
    const node = el('select', className);
    for (const [v, label] of options) node.append(el('option', '', label, { value: v }));
    node.value = value;
    return node;
  }
  function createDialog(title, subtitle, small = false) {
    const d = el('dialog', `studio-dialog${small ? ' small' : ''}`);
    const head = el('div', 'studio-dialog-head');
    const titles = el('div');
    const headingId = `studio-title-${Math.random().toString(36).slice(2, 8)}`;
    titles.append(el('div', 'studio-eyebrow', 'Inkplainer · Local creative tools'), el('h2', 'studio-heading', title, { id: headingId }));
    if (subtitle) titles.append(el('p', 'studio-subtitle', subtitle));
    const close = button('', () => d.close(), 'studio-close', 'M6 6l12 12M18 6L6 18');
    close.setAttribute('aria-label', 'Close dialog');
    head.append(titles, close);
    d.append(head);
    d.setAttribute('aria-labelledby', headingId);
    d.addEventListener('click', e => { if (e.target === d && e.offsetX < 0) d.close(); });
    document.body.append(d);
    return d;
  }
  function openDialog(d) {
    window.StudioEffects?.stopPreview();
    TimelineStudio.pausePreviewAll();
    if (!d.open) d.showModal();
  }
  function errorMessage(error, prefix) {
    console.error(prefix, error);
    showToast(`${prefix}. ${error?.name === 'QuotaExceededError' ? 'Browser storage is full.' : 'Please try again.'}`, null, 4000);
  }
  function activeScene() { return TimelineStudio.getActiveScene(); }
  function localTime() {
    const sc = activeScene();
    return sc ? clamp(state.playheadTime - TimelineStudio.getSceneStartOffset(sc.id), 0, sc.duration) : 0;
  }
  function hasMotion(layers = []) {
    return layers.some(l => l.visible !== false && (l.svgMotion || l.gsapEffect || l.keyframes?.length || l.rotation || (l.trimPath ?? 100) < 100));
  }
  function nextId() {
    const max = (state.scenes || []).flatMap(s => s.layers || []).reduce((n, l) => Math.max(n, Number(l.id) || 0), _layerIdCounter);
    _layerIdCounter = max + 1;
    window._layerIdCounter = _layerIdCounter;
    return _layerIdCounter;
  }
  function makeLayer(name, img, props = {}) {
    const w = props.w || img.width, h = props.h || img.height;
    return {
      id: nextId(), name, img, x: 0, y: 0, w, h, baseW: w, baseH: h,
      resizePct: 100, rotation: 0, opacity: 1, trimPath: 100,
      animStyle: state.animStyle || 'scanner', hand: state.hand || 'custom1', animOrder: null,
      visible: true, hasPngAlpha: true, groupId: null, speed: 40, handSpeed: 6,
      inPoint: 0, outPoint: activeScene()?.duration || 8, keyframes: [],
      ...props,
    };
  }
  function imageFromSource(source) {
    return new Promise((resolve, reject) => {
      if (!source) { reject(new Error('Missing local image data')); return; }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to decode local image'));
      img.src = source;
    });
  }
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const svgURL = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  function geometry(vector) {
    let result = geometryCache.get(vector);
    if (result) return result;
    result = vector.paths.map(part => {
      const d = part.nodes ? StudioCore.penPath(part.nodes, part.closed) : part.d;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      return { d, path: new Path2D(d), length: Math.max(.001, p.getTotalLength()) };
    });
    geometryCache.set(vector, result);
    return result;
  }
  function vectorSVG(vector, trim = 100) {
    if (trim >= 100) {
      const content = vector.paths.map(part => {
        const d = part.nodes ? StudioCore.penPath(part.nodes, part.closed) : part.d;
        const fill = part.fill && vector.fill !== 'none' ? vector.fill : 'none';
        return `<path d="${esc(d)}" fill="${esc(fill)}" fill-opacity="1" stroke="${esc(vector.stroke)}" stroke-width="${vector.strokeWidth}" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="0"/>`;
      }).join('');
      return `<svg xmlns="${NS}" width="${vector.width}" height="${vector.height}" viewBox="0 0 ${vector.width} ${vector.height}"><g stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>`;
    }
    const paths = geometry(vector);
    const total = paths.reduce((n, p) => n + p.length, 0);
    let budget = total * clamp(trim, 0, 100) / 100;
    const content = paths.map((path, i) => {
      const fraction = clamp(budget / path.length, 0, 1);
      budget -= path.length;
      const fill = vector.paths[i].fill && vector.fill !== 'none' ? vector.fill : 'none';
      return `<path d="${esc(path.d)}" fill="${esc(fill)}" fill-opacity="${clamp((trim - 90) / 10, 0, 1)}" stroke="${fraction > 0 ? esc(vector.stroke) : 'none'}" stroke-width="${vector.strokeWidth}" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="${100 * (1 - fraction)}"/>`;
    }).join('');
    return `<svg xmlns="${NS}" width="${vector.width}" height="${vector.height}" viewBox="0 0 ${vector.width} ${vector.height}"><g stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>`;
  }
  async function refreshVectorImage(layer) {
    const version = (imageVersions.get(layer) || 0) + 1;
    imageVersions.set(layer, version);
    geometryCache.delete(layer.vectorData);
    const img = await imageFromSource(svgURL(vectorSVG(layer.vectorData)));
    if (imageVersions.get(layer) === version) layer.img = img;
  }
  function drawVector(c, vector, trim) {
    if (trim <= 0) return;
    const paths = geometry(vector);
    const total = paths.reduce((n, p) => n + p.length, 0);
    let remaining = total * trim / 100;
    const fillAlpha = clamp((trim - 90) / 10, 0, 1);
    c.lineWidth = vector.strokeWidth;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = vector.stroke;
    for (let i = 0; i < paths.length; i++) {
      const part = paths[i];
      if (vector.paths[i].fill && vector.fill !== 'none' && fillAlpha > 0) {
        c.save();
        c.globalAlpha *= fillAlpha;
        c.fillStyle = vector.fill;
        c.fill(part.path);
        c.restore();
      }
      const drawn = clamp(remaining, 0, part.length);
      if (drawn > 0 && vector.strokeWidth > 0) {
        c.setLineDash([part.length, part.length]);
        c.lineDashOffset = part.length - drawn;
        c.stroke(part.path);
      }
      remaining -= part.length;
    }
    c.setLineDash([]);
    c.lineDashOffset = 0;
  }
  function drawLayer(c, layer, pose) {
    if (!layer.img || pose.w <= 0 || pose.h <= 0) return;
    if (pen?.mode === 'nodes' && pen.layerId === layer.id) return;
    c.save();
    // Position is the original layer origin; scale/rotation use its center anchor.
    const cx = pose.x + layer.w / 2, cy = pose.y + layer.h / 2;
    c.translate(cx, cy);
    c.rotate((pose.rotation || 0) * Math.PI / 180);
    c.translate(-pose.w / 2, -pose.h / 2);
    const trim = clamp(pose.trimPath ?? 100, 0, 100);
    const draw = output => {
      output.save();
      if (layer.svgMotion && Number.isFinite(pose.gsapTime) && window.SVGMotion) {
        if (trim < 100) { output.beginPath(); output.rect(0, 0, pose.w * trim / 100, pose.h); output.clip(); }
        if (!SVGMotion.draw(output, layer.svgMotion, pose.gsapTime, pose.w, pose.h)) output.drawImage(layer.img, 0, 0, pose.w, pose.h);
      } else if (layer.vectorData) {
        output.scale(pose.w / layer.vectorData.width, pose.h / layer.vectorData.height);
        drawVector(output, layer.vectorData, trim);
      } else {
        if (trim < 100) {
          output.beginPath(); output.rect(0, 0, pose.w * trim / 100, pose.h); output.clip();
        }
        output.drawImage(layer.img, 0, 0, pose.w, pose.h);
      }
      output.restore();
    };
    if (window.EffectManager && layer.gsapEffect && Number.isFinite(pose.gsapTime) && !window.StudioEffects?.isPreviewing(layer)) {
      EffectManager.renderAt(c, layer, layer.gsapEffect, pose.gsapTime, draw, pose.w, pose.h);
    } else if (window.EffectManager) EffectManager.render(c, layer, draw, pose.w, pose.h);
    else draw(c);
    c.restore();
  }
  function commit(label, action) {
    if (state.recording) { showToast('Cancel the export before editing your scene'); return false; }
    TimelineStudio.pausePreviewAll();
    pushUndoSnapshot(label);
    action();
    TimelineStudio.saveWorkingStateToActiveScene();
    renderLayerList();
    TimelineStudio.seekToGlobalTime(state.playheadTime);
    scheduleAutoSave();
    return true;
  }

  // ── Asset library ─────────────────────────────────────────────────────────
  function buildLibrary() {
    library = createDialog('Assets & Templates', 'A local collection for your next story. Nothing to download, nothing to upload.');
    library.id = 'assets-templates-dialog';
    libraryTabs = el('div', 'studio-tabs');
    for (const [value, label] of [['assets', 'SVG assets'], ['templates', 'Scene templates'], ['saved', 'My templates']]) {
      const b = button(label, () => setTab(value), 'studio-tab');
      b.dataset.tab = value;
      libraryTabs.append(b);
    }
    libraryTabs.append(el('span', 'studio-offline', '100% offline'));
    const body = el('div', 'studio-library-body');
    librarySide = el('aside', 'studio-library-side');
    libraryMain = el('div', 'studio-library-main');
    libraryMain.addEventListener('scroll', () => {
      if (tab === 'assets') renderVisibleAssetWindow();
    }, { passive: true });
    body.append(librarySide, libraryMain);
    libraryStatus = el('span', '', '2,500 core SVGs · 10,000+ scalable catalog · 12 composed scenes');
    const footer = el('div', 'studio-footer');
    footer.append(libraryStatus, el('span', '', 'Your work stays in this browser.'));
    library.append(libraryTabs, body, footer);
  }
  function openLibrary(value = 'assets') {
    if (state.recording) { showToast('Cancel the export before opening the library'); return; }
    if (pen) { showToast('Finish or cancel your vector edit first'); return; }
    openDialog(library);
    setTab(value);
  }
  function setTab(value) {
    tab = value;
    libraryTabs.querySelectorAll('[data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
      b.setAttribute('aria-pressed', b.dataset.tab === tab);
    });
    librarySide.replaceChildren();
    libraryMain.replaceChildren();
    if (tab === 'assets') renderAssets();
    else if (tab === 'templates') renderBuiltinTemplates();
    else renderSavedTemplates();
  }
  function colorControl(label, value, action) {
    const input = el('input', '', null, { type: 'color', value });
    input.addEventListener('input', () => action(input.value));
    return field(label, input);
  }
  function renderAssets() {
    const scaleSwitch = el('div', 'studio-scale-switch');
    for (const [mode, label] of [['2500', 'Core 2,500'], ['10000', 'Extended 10,000+']]) {
      const b = button(label, () => setCatalogScale(mode), `studio-scale-btn${scaleMode === mode ? ' active' : ''}`);
      b.dataset.scaleMode = mode;
      scaleSwitch.append(b);
    }
    const search = el('input', 'studio-search', null, {
      type: 'search',
      placeholder: 'Search name, tag, class, style…',
      'aria-label': 'Search local assets',
      value: query,
    });
    search.oninput = () => { query = search.value; paintAssets(); };
    const colOptions = [['All', 'All 10 collections'], ...(StudioAssets.collections || []).map(c => [c, c])];
    const colSelect = select(colOptions, collectionFilter);
    colSelect.id = 'studio-collection-filter';
    colSelect.setAttribute('aria-label', 'Filter by collection');
    colSelect.onchange = () => {
      collectionFilter = colSelect.value;
      if (category !== 'All' && category !== 'Favorites' && category !== 'Recent') {
        const catMeta = StudioAssets.categories.find(c => c.name === category);
        if (collectionFilter !== 'All' && catMeta && catMeta.collection !== collectionFilter) category = 'All';
      }
      renderCategorySidebarList(catList);
      paintAssets();
    };
    const catList = el('div', 'studio-category-list');
    renderCategorySidebarList(catList);
    librarySide.append(
      scaleSwitch,
      search,
      el('div', 'studio-section-label', 'Collection & 50 Categories'),
      colSelect,
      catList,
      el('div', 'studio-section-label', 'Make it yours'),
      colorControl('Fill color', primaryColor, v => { primaryColor = v; previewCache.clear(); paintAssets(); }),
      el('div', 'studio-section-label', 'Outline'),
      colorControl('Stroke color', strokeColor, v => { strokeColor = v; previewCache.clear(); paintAssets(); }),
      el('p', 'studio-subtitle', 'Colors and stroke weight remain editable after insertion. Use Vector style on the canvas toolbar.'));
    buildAssetMainPane();
    paintAssets();
  }
  function renderCategorySidebarList(container) {
    container.replaceChildren();
    const totalCount = scaleMode === '10000' ? 10000 : StudioAssets.assets.length;
    const perCatCount = scaleMode === '10000' ? 200 : 50;
    const quickItems = [
      ['All', 'All categories', totalCount],
      ['Favorites', 'Favorites', favoriteIds.size],
      ['Recent', 'Recently used', recentIds.length],
    ];
    for (const [key, label, count] of quickItems) {
      const b = button(label, () => {
        category = key;
        container.querySelectorAll('[data-category]').forEach(n => n.classList.toggle('active', n.dataset.category === key));
        paintAssets();
      }, `studio-category${category === key ? ' active' : ''}`);
      b.dataset.category = key;
      b.append(el('span', 'studio-counter', count));
      container.append(b);
    }
    const cats = (StudioAssets.categories || []).filter(c => collectionFilter === 'All' || c.collection === collectionFilter);
    for (const cat of cats) {
      const b = button(cat.name, () => {
        category = cat.name;
        container.querySelectorAll('[data-category]').forEach(n => n.classList.toggle('active', n.dataset.category === cat.name));
        paintAssets();
      }, `studio-category${category === cat.name ? ' active' : ''}`);
      b.dataset.category = cat.name;
      b.append(el('span', 'studio-counter', perCatCount));
      container.append(b);
    }
  }
  function buildAssetMainPane() {
    const filterBar = el('div', 'studio-filter-bar');
    const styleRow = el('div', 'studio-style-row');
    const allStyleBtn = button('All styles', () => {
      styleFilter = 'all';
      styleRow.querySelectorAll('[data-style-filter]').forEach(n => n.classList.toggle('active', n.dataset.styleFilter === 'all'));
      paintAssets();
    }, `studio-pill${styleFilter === 'all' ? ' active' : ''}`);
    allStyleBtn.dataset.styleFilter = 'all';
    styleRow.append(allStyleBtn);
    for (const st of StudioAssets.styles || []) {
      const b = button(st.name, () => {
        styleFilter = st.id;
        styleRow.querySelectorAll('[data-style-filter]').forEach(n => n.classList.toggle('active', n.dataset.styleFilter === st.id));
        paintAssets();
      }, `studio-pill${styleFilter === st.id ? ' active' : ''}`);
      b.dataset.styleFilter = st.id;
      b.title = st.description;
      styleRow.append(b);
    }
    const tagRow = el('div', 'studio-tag-row');
    const classSelect = select([['all', 'All classes'], ...(StudioAssets.classes || []).map(c => [c, `Class: ${c}`])], classFilter);
    classSelect.id = 'studio-class-filter';
    classSelect.setAttribute('aria-label', 'Filter by class');
    classSelect.onchange = () => { classFilter = classSelect.value; paintAssets(); };
    tagRow.append(classSelect);
    for (const t of StudioAssets.popularTags || []) {
      const chip = button(`#${t}`, () => {
        tagFilter = tagFilter === t ? '' : t;
        tagRow.querySelectorAll('[data-tag-filter]').forEach(n => n.classList.toggle('active', n.dataset.tagFilter === tagFilter));
        paintAssets();
      }, `studio-tag-chip${tagFilter === t ? ' active' : ''}`);
      chip.dataset.tagFilter = t;
      tagRow.append(chip);
    }
    filterBar.append(styleRow, tagRow);
    virtualCountLabel = el('div', 'studio-count-label');
    virtualTop = el('div');
    virtualGrid = el('div', 'studio-grid');
    virtualBottom = el('div');
    libraryMain.replaceChildren(filterBar, virtualCountLabel, virtualTop, virtualGrid, virtualBottom);
  }
  function setCatalogScale(mode) {
    scaleMode = String(mode) === '10000' ? '10000' : '2500';
    if (tab === 'assets' && library?.open) renderAssets();
  }
  function toggleFavoriteAsset(id) {
    if (favoriteIds.has(id)) favoriteIds.delete(id);
    else favoriteIds.add(id);
    try { localStorage.setItem('inkplainer_asset_favorites_v1', JSON.stringify([...favoriteIds])); } catch (_) {}
    const favCounter = librarySide?.querySelector('[data-category="Favorites"] .studio-counter');
    if (favCounter) favCounter.textContent = favoriteIds.size;
    if (category === 'Favorites') paintAssets();
    else renderVisibleAssetWindow();
  }
  function themedAsset(asset) {
    return { ...clone(asset.vector), fill: primaryColor, stroke: strokeColor };
  }
  function assetPreviewURL(asset) {
    const key = `${asset.id}|${primaryColor}|${strokeColor}`;
    let url = previewCache.get(key);
    if (!url) {
      url = svgURL(vectorSVG(themedAsset(asset)));
      if (previewCache.size > 2400) previewCache.clear();
      previewCache.set(key, url);
    }
    return url;
  }
  function paintAssets() {
    if (tab !== 'assets') return;
    if (!virtualGrid || !libraryMain.contains(virtualGrid)) buildAssetMainPane();
    filteredAssets = StudioAssets.search({
      query,
      category,
      collection: collectionFilter,
      style: styleFilter,
      className: classFilter,
      tag: tagFilter,
      scaleMode,
      favorites: favoriteIds,
      recent: recentIds,
    });
    libraryMain.scrollTop = 0;
    const activeScaleLabel = scaleMode === '10000' ? '10,000+ Extended Catalog' : '2,500 Core Library';
    virtualCountLabel.replaceChildren(
      el('span', '', `${category === 'All' ? 'All categories' : category} · ${filteredAssets.length.toLocaleString()} SVG${filteredAssets.length === 1 ? '' : 's'} (${activeScaleLabel})`),
      el('span', '', 'Virtualized offline catalog · Click to add to scene')
    );
    libraryStatus.textContent = `${scaleMode === '10000' ? '10,000' : '2,500'} bundled SVGs · 50 categories · 9 styles · 100% offline`;
    renderVisibleAssetWindow();
  }
  function renderVisibleAssetWindow() {
    if (!virtualGrid) return;
    const total = filteredAssets.length;
    if (!total) {
      virtualTop.style.height = '0px';
      virtualBottom.style.height = '0px';
      virtualGrid.replaceChildren(el('div', 'studio-empty', 'No assets match your filters. Try another search term, style, class or category.'));
      return;
    }
    const cols = Math.max(1, Math.floor((libraryMain.clientWidth - 48) / 144)) || 5;
    const rowH = 192;
    const totalRows = Math.ceil(total / cols);
    const filterOffset = (virtualCountLabel?.offsetTop || 90) + 28;
    const scrollY = Math.max(0, libraryMain.scrollTop - filterOffset);
    const firstRow = Math.max(0, Math.floor(scrollY / rowH) - 2);
    const visibleRows = Math.max(12, Math.ceil((libraryMain.clientHeight || 600) / rowH) + 6);
    const lastRow = Math.min(totalRows, firstRow + visibleRows);
    const startIdx = firstRow * cols;
    const endIdx = Math.min(total, lastRow * cols);

    virtualTop.style.height = `${firstRow * rowH}px`;
    virtualBottom.style.height = `${Math.max(0, (totalRows - lastRow) * rowH)}px`;

    const cards = [];
    for (let i = startIdx; i < endIdx; i++) {
      const asset = filteredAssets[i];
      const card = button('', () => insertAsset(asset.id), 'studio-card');
      card.dataset.assetId = asset.id;
      card.dataset.assetStyle = asset.style;
      card.setAttribute('aria-label', `Add ${asset.name}`);
      const isFav = favoriteIds.has(asset.id);
      const fav = button('', e => {
        e.stopPropagation();
        toggleFavoriteAsset(asset.id);
      }, `studio-fav-btn${isFav ? ' active' : ''}`, 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9Z');
      fav.dataset.favId = asset.id;
      fav.title = isFav ? 'Remove from favorites' : 'Save to favorites';
      fav.setAttribute('aria-label', fav.title);
      const tagWrap = el('div', 'studio-card-tags');
      for (const tag of (asset.tags || []).slice(0, 2)) {
        tagWrap.append(el('span', 'studio-card-tag', tag));
      }
      card.append(
        fav,
        el('img', 'studio-preview', null, { src: assetPreviewURL(asset), alt: asset.name, loading: 'lazy' }),
        el('div', 'studio-card-name', asset.name),
        el('div', 'studio-card-meta', `${asset.category} · ${asset.style}`),
        tagWrap
      );
      cards.push(card);
    }
    virtualGrid.replaceChildren(...cards);
  }
  async function insertAsset(id) {
    const asset = StudioAssets.getAssetById ? StudioAssets.getAssetById(id) : StudioAssets.assets.find(a => a.id === id);
    if (!asset || state.recording) return;
    const sceneId = state.activeSceneId;
    const data = themedAsset(asset);
    try {
      const img = await imageFromSource(svgURL(vectorSVG(data)));
      if (sceneId !== state.activeSceneId) return;
      recentIds = [asset.id, ...recentIds.filter(x => x !== asset.id)].slice(0, 40);
      try { localStorage.setItem('inkplainer_asset_recent_v1', JSON.stringify(recentIds)); } catch (_) {}
      const w = Math.min(state.canvasW * .28, 360);
      const layer = makeLayer(asset.name, img, {
        kind: 'vector', vectorData: data, w, h: w * data.height / data.width,
        baseW: w, baseH: w * data.height / data.width,
        x: (state.canvasW - w) / 2, y: (state.canvasH - w * data.height / data.width) / 2,
      });
      pushUndoSnapshot('Insert Local SVG');
      state.layers.push(layer);
      state.selectedLayerId = layer.id;
      TimelineStudio.saveWorkingStateToActiveScene();
      renderLayerList();
      selectLayer(layer.id);
      redrawLayersOnCanvas();
      drawSelectionHandles();
      scheduleAutoSave();
      library.close();
      showToast(`${asset.name} added. Use Presets to animate it.`);
    } catch (error) { errorMessage(error, 'Could not insert SVG'); }
  }

  async function insertMotionDesign(value, options = {}) {
    if (state.recording || pen) throw new Error('Terminez l’édition ou l’export en cours.');
    const sceneId = state.activeSceneId, projectId = currentProjectId;
    const data = SVGMotionCore.normalize(value);
    if (!data) throw new Error('Le design animé est invalide.');
    const img = await SVGMotion.poster(data), prepared = SVGMotion.getPrepared(data);
    if (sceneId !== state.activeSceneId || projectId !== currentProjectId) throw new Error('Le projet a changé. Ouvrez à nouveau l’atelier.');
    const duration = SVGMotionCore.timing(data, prepared.parts.length).total;
    const existing = options.updateId && getLayerById(options.updateId);
    if (options.updateId && !existing?.svgMotion) throw new Error('Le calque d’origine n’existe plus.');
    TimelineStudio.pausePreviewAll();
    TimelineStudio.cancelPreviewForSingleSceneRun();
    window.StudioEffects?.stopPreview(false);
    const before = TimelineStudio.serializeProjectState(false);
    let after;
    CommandHistory.execute({
      label: existing ? 'Edit SVG Motion Design' : options.append ? 'Append Animated SVG Scene' : 'Insert Animated SVG',
      execute() {
        if (existing) {
          existing.svgMotion = data; existing.img = img; existing.name = data.name;
          const owner = activeScene();
          const previousEnd = existing.outPoint;
          existing.outPoint = (existing.inPoint || 0) + duration;
          const otherEnd = Math.max(0, ...owner.layers.filter(layer => layer !== existing).map(layer => layer.outPoint || 0));
          owner.duration = Math.abs(owner.duration - previousEnd) < .01
            ? Math.max(.5, existing.outPoint, otherEnd) : Math.max(owner.duration, existing.outPoint);
          state.selectedLayerId = existing.id;
        } else {
          const size = Math.min(state.canvasW * .45, state.canvasH * .75, 560);
          const start = options.append ? 0 : localTime();
          const layer = makeLayer(data.name, img, {
            kind: 'svg-motion', svgMotion: data, x: (state.canvasW - size) / 2, y: (state.canvasH - size) / 2,
            w: size, h: size, baseW: size, baseH: size, inPoint: start, outPoint: start + duration,
          });
          if (options.append) {
            const owner = {
              id: `scene-${crypto.randomUUID()}`, name: data.name, duration: Math.max(.5, duration),
              canvasBg: clone(state.canvasBg), layers: [layer], groups: [], selectedLayerId: layer.id,
              transitionOut: { type: 'cut', duration: .6 },
            };
            state.scenes.push(owner);
            TimelineStudio.applySceneToWorkingState(owner);
          } else {
            activeScene().duration = Math.max(activeScene().duration, layer.outPoint);
            state.layers.push(layer); state.selectedLayerId = layer.id;
          }
        }
        TimelineStudio.saveWorkingStateToActiveScene();
        renderLayerList(); selectLayer(state.selectedLayerId);
        const layer = getSelectedLayer();
        TimelineStudio.seekToGlobalTime(TimelineStudio.getSceneStartOffset(state.activeSceneId) + layer.inPoint + Math.min(.7, duration * .2));
        scheduleAutoSave();
        after = TimelineStudio.serializeProjectState(false);
      },
      undo() { TimelineStudio.deserializeProjectState(before); scheduleAutoSave(); },
      redo() { TimelineStudio.deserializeProjectState(after); scheduleAutoSave(); },
    });
    return getSelectedLayer();
  }

  // ── Local scene templates ─────────────────────────────────────────────────
  function templatesStore(mode, action) {
    if (!templateDB) templateDB = new Promise((resolve, reject) => {
      const request = indexedDB.open('InkplainerLocalTemplates', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('templates', { keyPath: 'id' });
      request.onsuccess = () => {
        const database = request.result;
        migrateLegacyTemplates(database).then(() => resolve(database), reject);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Template database is busy'));
    }).catch(error => { templateDB = null; throw error; });
    return templateDB.then(database => new Promise((resolve, reject) => {
      const tx = database.transaction('templates', mode);
      const request = action(tx.objectStore('templates'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error || request.error);
      tx.onabort = () => reject(tx.error || new Error('Template storage transaction was aborted'));
    }));
  }
  async function migrateLegacyTemplates(database) {
    let legacy, imported;
    try {
      legacy = JSON.parse(localStorage.getItem('inkplainer_scene_templates_v1') || '[]');
      imported = JSON.parse(localStorage.getItem('inkplainer_scene_templates_imported_v2') || '[]');
    } catch (_) { return; }
    if (!Array.isArray(legacy) || !Array.isArray(imported)) return;
    const candidates = legacy.filter(t => t.id && Array.isArray(t.layers) && !imported.includes(t.id));
    if (!candidates.length) return;
    await new Promise((resolve, reject) => {
      const tx = database.transaction('templates', 'readwrite'), store = tx.objectStore('templates');
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        for (const old of candidates) {
          const id = `legacy-${old.id}`;
          if (keys.result.includes(id)) continue;
          const duration = Math.max(5, ...old.layers.flatMap(l => (l.keyframes || []).map(k => Number(k.time) || 0)));
          store.put({
            id, version: 1, name: old.name || 'Imported template', savedAt: old.createdAt || Date.now(),
            canvasW: 1280, canvasH: 720,
            scene: {
              name: old.name, duration, canvasBg: { type: 'solid', val: old.background || '#ffffff' },
              groups: [], selectedLayerId: 1, transitionOut: { type: 'cut', duration: .6 },
              layers: old.layers.map((l, i) => ({ ...l, id: i + 1, inPoint: 0, outPoint: duration,
                vectorData: StudioCore.normalizeVector(l.vectorData) })),
            },
          });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Legacy template import was aborted'));
    });
    // Leave the original collection untouched so downgrading remains safe.
    try {
      localStorage.setItem('inkplainer_scene_templates_imported_v2', JSON.stringify([...imported, ...candidates.map(t => t.id)]));
    } catch (_) { /* The IndexedDB copy is already durable even if localStorage is full. */ }
  }
  function textSVG(text, size, width, height, color, weight = 400) {
    return `<svg xmlns="${NS}" width="${width}" height="${height}"><text x="0" y="${size}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${esc(color)}">${esc(text)}</text></svg>`;
  }
  function builtinComposition(template, overrides = {}) {
    const index = StudioAssets.templates.indexOf(template);
    const palettes = [
      ['#f7f8fb', '#d8defa', '#172033'], ['#fbf8f2', '#e7c98a', '#35291f'],
      ['#f2f8f5', '#a9d8c3', '#17352b'], ['#faf3f6', '#e6b6c8', '#432639'],
      ['#f4f6f8', '#b9c9d8', '#1d2939'], ['#fff6ee', '#f2b48a', '#472516'],
      ['#f5f2fb', '#c4b5fd', '#2d1f4d'], ['#f1f7f3', '#9bc7a7', '#193326'],
      ['#fff8e8', '#f4c95d', '#49350f'], ['#f5f5f2', '#c9cbc7', '#1f2421'],
    ];
    const paletteIndex = ['indigo', 'sand', 'mint', 'rose', 'slate', 'coral', 'violet', 'forest', 'amber', 'mono'].indexOf(template.palette);
    const [background, fill, stroke] = palettes[(paletteIndex < 0 ? index : paletteIndex) % palettes.length];
    const title = { name: 'Title', x: 86, y: 72, w: 820, h: 75, text: overrides.title || template.name, size: 52, weight: 700 };
    const subtitle = { name: 'Subtitle', x: 90, y: 160, w: 900, h: 42, text: overrides.subtitle || template.description, size: 22, weight: 400 };
    const layouts = {
      split: [[100, 300, 250], [520, 270, 350], [970, 330, 210]],
      hero: [[475, 260, 430], [90, 430, 190], [1000, 430, 190]],
      diagonal: [[100, 300, 220], [470, 240, 280], [860, 290, 330]],
      grid: [[120, 270, 250], [500, 270, 250], [880, 270, 250]],
      radial: [[500, 245, 300], [210, 390, 220], [850, 390, 220]],
      'bottom-row': [[100, 420, 230], [510, 420, 230], [920, 420, 230]],
      'left-rail': [[110, 270, 180], [420, 310, 330], [900, 270, 260]],
      'center-stage': [[100, 315, 180], [470, 245, 390], [1000, 315, 180]],
      stacked: [[120, 250, 300], [120, 370, 300], [120, 490, 300]],
      cards: [[110, 285, 300], [490, 285, 300], [870, 285, 300]],
      timeline: [[100, 350, 240], [500, 350, 240], [900, 350, 240]],
      quote: [[760, 270, 360], [110, 350, 230], [410, 350, 230]],
    };
    const columns = layouts[template.layout] || layouts[template.variant % 3 === 1 ? 'split' : template.variant % 3 === 2 ? 'grid' : 'cards'];
    const objects = template.items.map((id, i) => {
      const a = StudioAssets.getAssetById ? StudioAssets.getAssetById(id) : StudioAssets.assets.find(asset => asset.id === id);
      const source = a || StudioAssets.getAssetById('star');
      const vector = clone(source.vector);
      vector.fill = fill;
      vector.stroke = stroke;
      return { name: source.name, vector, x: columns[i][0], y: columns[i][1], w: columns[i][2], h: columns[i][2] * vector.height / vector.width };
    });
    const labels = objects.map((obj, i) => ({
      name: `Label ${i + 1}`, text: overrides[`label-${i + 1}`] || `${String(i + 1).padStart(2, '0')}  ${obj.name}`,
      x: obj.x + 12, y: template.layout === 'stacked' ? obj.y + 92 : 590, w: Math.max(180, obj.w - 24), h: 42, size: template.style === 'neo-brutalist' ? 22 : 20, weight: 700,
    }));
    return { background, fill, stroke, title, subtitle, objects, labels, family: template.family || 'business', style: template.style || 'editorial', layout: template.layout || 'cards' };
  }
  function templatePreview(template) {
    const c = builtinComposition(template);
    let body = `<rect width="1280" height="720" fill="${c.background}"/><rect x="72" y="58" width="8" height="126" rx="4" fill="${c.fill}"/><path d="M88 224H1190" stroke="${c.fill}" stroke-width="2" opacity=".8"/><rect x="72" y="620" width="1136" height="1" fill="${c.stroke}" opacity=".18"/>`;
    if (c.layout === 'diagonal') body += `<path d="M0 680L1280 120" stroke="${c.fill}" stroke-width="5" opacity=".22"/><circle cx="1120" cy="120" r="90" fill="${c.fill}" opacity=".16"/>`;
    if (c.layout === 'radial' || c.layout === 'center-stage') body += `<circle cx="640" cy="410" r="210" fill="none" stroke="${c.fill}" stroke-width="2" opacity=".4"/><circle cx="640" cy="410" r="270" fill="none" stroke="${c.fill}" stroke-width="1" opacity=".2"/>`;
    if (c.layout === 'cards' || c.layout === 'grid') body += `<rect x="86" y="250" width="1108" height="300" rx="24" fill="${c.fill}" opacity=".08"/>`;
    if (c.layout === 'quote') body += `<text x="88" y="315" font-family="Georgia,serif" font-size="110" fill="${c.fill}" opacity=".35">“</text>`;
    for (const t of [c.title, c.subtitle, ...c.labels]) {
      body += `<text x="${t.x}" y="${t.y + t.size}" font-family="Arial,sans-serif" font-size="${t.size}" font-weight="${t.weight}" fill="${c.stroke}">${esc(t.text)}</text>`;
    }
    for (const a of c.objects) body += `<svg x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" viewBox="0 0 ${a.vector.width} ${a.vector.height}">${vectorSVG(a.vector).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`;
    return svgURL(`<svg xmlns="${NS}" width="1280" height="720" viewBox="0 0 1280 720">${body}</svg>`);
  }
  function templateSide(saved) {
    librarySide.append(el('div', 'studio-eyebrow', saved ? 'Your private collection' : 'Start with a story'),
      el('p', 'studio-subtitle', saved
        ? 'Reusable scenes saved in IndexedDB. Layers, groups, timing, keyframes and vector nodes stay intact.'
        : 'Complete scenes with editable artwork, text and animation. Each template is added as a new scene; your current work is preserved.'),
      el('div', 'studio-section-label', 'Save your own scene'));
    const form = el('form', 'studio-save-form');
    const name = el('input', 'studio-input', null, {
      type: 'text', placeholder: 'Template name', maxlength: 80, required: true,
      'aria-label': 'Template name', id: 'scene-template-name',
    });
    const save = button('Save as template', () => {}, 'studio-action primary');
    save.type = 'submit';
    const status = el('div', 'studio-status', 'Saved on this device. Clearing browser storage deletes local templates.', { role: 'status' });
    form.append(name, save, status);
    form.onsubmit = async e => {
      e.preventDefault();
      save.disabled = true;
      status.classList.remove('error');
      status.textContent = 'Saving complete scene…';
      try {
        await saveAsTemplate(name.value);
        name.value = '';
        status.textContent = 'Saved. Find it in My templates.';
        if (tab === 'saved') renderSavedTemplates();
      } catch (error) {
        status.classList.add('error');
        status.textContent = `Could not save: ${error.message}. Browser storage may be unavailable or full.`;
      } finally { save.disabled = false; }
    };
    librarySide.append(form);
  }
  function renderBuiltinTemplates() {
    templateSide(false);
    const count = el('div', 'studio-count-label', `${StudioAssets.templates.length} ready-to-use editorial compositions · Added as new scenes`);
    const grid = el('div', 'studio-grid templates');
    for (const template of StudioAssets.templates) {
      const card = button('', () => openTemplateInspector(template), 'studio-card');
      card.dataset.templateId = template.id;
      card.append(el('img', 'studio-preview', null, { src: templatePreview(template), alt: `${template.name} scene preview`, loading: 'lazy' }),
        el('div', 'studio-card-name', template.name), el('div', 'studio-card-meta', `${template.family || 'business'} · ${template.description}`));
      grid.append(card);
    }
    libraryMain.append(count, grid);
    libraryStatus.textContent = 'Editable text · Native SVG artwork · Composed keyframes';
  }
  function openTemplateInspector(template) {
    const preview = el('img', 'studio-template-inspector-preview', null, { src: templatePreview(template), alt: `${template.name} preview` });
    const title = el('input', 'studio-input', null, { type: 'text', maxlength: 120, 'aria-label': 'Template title' });
    title.value = template.name;
    const subtitle = el('textarea', 'studio-input', template.description, { rows: 3, maxlength: 220, 'aria-label': 'Template subtitle' });
    const labels = (template.items || []).map((item, index) => {
      const asset = StudioAssets.getAssetById(item);
      const input = el('input', 'studio-input', null, { type: 'text', maxlength: 80, 'aria-label': `Template label ${index + 1}` });
      input.value = `${String(index + 1).padStart(2, '0')}  ${asset?.name || item}`;
      return input;
    });
    const form = el('div', 'studio-template-inspector');
    const heading = el('div', 'studio-inspector-heading');
    heading.append(button('← Back to templates', renderBuiltinTemplates, 'studio-action'), el('div', 'studio-card-name', template.name), el('div', 'studio-card-meta', `${template.family || 'business'} · Premium editorial layout`));
    const fields = el('div', 'studio-template-fields');
    fields.append(field('Title', title), field('Subtitle', subtitle));
    labels.forEach((input, index) => fields.append(field(`Label ${index + 1}`, input)));
    const actions = el('div', 'studio-template-inspector-actions');
    const insert = button('Insert customized scene', async () => {
      insert.disabled = true; libraryStatus.textContent = 'Preparing customized scene…';
      try {
        await applyBuiltinTemplate(template.id, {
          title: title.value.trim() || template.name,
          subtitle: subtitle.value.trim() || template.description,
          ...Object.fromEntries(labels.map((input, index) => [`label-${index + 1}`, input.value.trim()])),
        });
      } finally { insert.disabled = false; }
    }, 'studio-action primary');
    actions.append(insert);
    form.append(heading, preview, fields, actions);
    libraryMain.replaceChildren(form);
  }
  async function saveAsTemplate(name) {
    if (state.recording) throw new Error('Cancel the export before saving a template');
    if (!name.trim()) throw new Error('Please enter a template name');
    if (!state.layers.length) throw new Error('Add at least one layer first');
    const snapshot = TimelineStudio.serializeProjectState(false);
    const scene = snapshot.scenes.find(s => s.id === snapshot.activeSceneId);
    const entry = {
      id: crypto.randomUUID(), name: name.trim(), version: 1,
      canvasW: state.canvasW, canvasH: state.canvasH, savedAt: Date.now(),
      scene: clone(scene),
    };
    await templatesStore('readwrite', store => store.put(entry));
    showToast('Scene saved as a local template');
    return entry;
  }
  async function renderSavedTemplates() {
    librarySide.replaceChildren();
    templateSide(true);
    libraryMain.replaceChildren(el('div', 'studio-empty', 'Loading local templates…'));
    libraryStatus.textContent = 'Stored in this browser · No accounts · No network';
    try {
      savedTemplates = (await templatesStore('readonly', store => store.getAll())).sort((a, b) => b.savedAt - a.savedAt);
      if (tab !== 'saved') return;
      const count = el('div', 'studio-count-label', `${savedTemplates.length} saved scene${savedTemplates.length === 1 ? '' : 's'}`);
      const grid = el('div', 'studio-grid templates');
      for (const entry of savedTemplates) {
        const wrap = el('div', 'studio-template-tile');
        const card = button('', () => applySavedTemplate(entry.id), 'studio-card');
        card.dataset.savedTemplateId = entry.id;
        if (entry.scene.thumbnailDataUrl) card.append(el('img', 'studio-preview', null, { src: entry.scene.thumbnailDataUrl, alt: `${entry.name} preview` }));
        card.append(el('div', 'studio-card-name', entry.name), el('div', 'studio-card-meta',
          `${entry.scene.layers.length} layers · ${entry.scene.duration.toFixed(1)}s · ${new Date(entry.savedAt).toLocaleDateString()}`));
        const remove = button('Delete template', async () => {
          if (!confirm(`Delete “${entry.name}” from local templates? Your project will not be changed.`)) return;
          try { await templatesStore('readwrite', store => store.delete(entry.id)); renderSavedTemplates(); }
          catch (error) { errorMessage(error, 'Could not delete template'); }
        }, 'studio-template-delete');
        wrap.append(card, remove);
        grid.append(wrap);
      }
      if (!savedTemplates.length) grid.append(el('div', 'studio-empty', 'No saved templates yet. Save your current scene using the form on the left.'));
      libraryMain.replaceChildren(count, grid);
    } catch (error) {
      if (tab === 'saved') libraryMain.replaceChildren(el('div', 'studio-empty', `Local storage is unavailable: ${error.message}. Allow this site to store data and try again.`));
    }
  }
  async function createTextLayer(item, color, scaleX, scaleY, duration) {
    const source = svgURL(textSVG(item.text, item.size, item.w, item.h, color, item.weight));
    const img = await imageFromSource(source);
    return makeLayer(item.name, img, {
      x: item.x * scaleX, y: item.y * scaleY, w: item.w * scaleX, h: item.h * scaleY,
      baseW: item.w * scaleX, baseH: item.h * scaleY, kind: 'text', outPoint: duration,
      _textContent: item.text, _textFont: 'Arial', _textSize: item.size * scaleY,
      _textBold: item.weight === 700, _textItalic: false, _textColor: color,
      _textAlign: 'left', _textLineHeight: 1.3, _textSpacing: 0,
    });
  }
  async function applyBuiltinTemplate(id, overrides = {}) {
    if (state.recording) return;
    const t = StudioAssets.templates.find(entry => entry.id === id);
    if (!t) return;
    libraryStatus.textContent = 'Preparing local scene…';
    try {
      const composition = builtinComposition(t, overrides), duration = 8;
      const sx = state.canvasW / 1280, sy = state.canvasH / 720;
      const layers = [];
      for (const [i, text] of [composition.title, composition.subtitle, ...composition.labels].entries()) {
        const layer = await createTextLayer(text, composition.stroke, sx, sy, duration);
        const time = i < 2 ? i * .15 : .9 + (i - 2) * 1.6;
        StudioCore.put(layer, 'opacity', time, 0, 'ease-in-out');
        StudioCore.put(layer, 'opacity', time + .6, 1, 'ease-in-out');
        layers.push(layer);
      }
      for (const [i, item] of composition.objects.entries()) {
        const img = await imageFromSource(svgURL(vectorSVG(item.vector)));
        const layer = makeLayer(item.name, img, {
          kind: 'vector', vectorData: item.vector, x: item.x * sx, y: item.y * sy,
          w: item.w * sx, h: item.h * sy, baseW: item.w * sx, baseH: item.h * sy, outPoint: duration,
        });
        StudioCore.applyPreset(layer, 'draw', .7 + i * 1.6, 1.5);
        layers.push(layer);
      }
      insertScene({
        id: `scene-${crypto.randomUUID()}`, name: t.name, duration,
        canvasBg: { type: 'solid', val: composition.background }, layers, groups: [],
        selectedLayerId: layers[0]?.id, transitionOut: { type: 'cut', duration: .6 },
      }, 'Insert Scene Template');
      library.close();
      showToast(`${t.name} added as a new scene`);
    } catch (error) { errorMessage(error, 'Could not apply scene template'); }
  }
  function insertScene(scene, label) {
    TimelineStudio.cancelPreviewForSingleSceneRun();
    cancelAnimationFrame(state.animFrame);
    state.playing = false;
    state.bgCanvas = null;
    TimelineStudio.saveWorkingStateToActiveScene();
    pushUndoSnapshot(label);
    const index = state.scenes.findIndex(s => s.id === state.activeSceneId);
    state.scenes.splice(index + 1, 0, scene);
    TimelineStudio.applySceneToWorkingState(scene);
    state.playheadTime = TimelineStudio.getSceneStartOffset(scene.id);
    state.done = false;
    TimelineStudio.renderTimeline();
    redrawLayersOnCanvas();
    drawSelectionHandles();
    scheduleAutoSave();
  }
  async function applySavedTemplate(id) {
    if (state.recording) return;
    try {
      const entry = await templatesStore('readonly', store => store.get(id));
      if (!entry?.scene) throw new Error('Template not found');
      const scene = clone(entry.scene);
      const idMap = new Map(), groupMap = new Map();
      const sx = state.canvasW / entry.canvasW, sy = state.canvasH / entry.canvasH;
      scene.layers = await Promise.all(scene.layers.map(async data => {
        const vectorData = StudioCore.normalizeVector(data.vectorData);
        const svgMotion = window.SVGMotionCore?.normalize(data.svgMotion);
        if (svgMotion) await SVGMotion.prepare(svgMotion);
        const img = await imageFromSource(vectorData ? svgURL(vectorSVG(vectorData)) : data.imageDataURL);
        const newId = nextId();
        idMap.set(data.id, newId);
        const origImg = data.origImageDataURL ? await imageFromSource(data.origImageDataURL) : null;
        const layer = { ...data, id: newId, img, vectorData, svgMotion: svgMotion || undefined, _origImg: origImg || undefined,
          x: data.x * sx, y: data.y * sy, w: data.w * sx, h: data.h * sy,
          baseW: (data.baseW ?? data.w) * sx, baseH: (data.baseH ?? data.h) * sy };
        layer.keyframes = (data.keyframes || []).map(k => ({
          ...k, id: `kf-${crypto.randomUUID()}`,
          ...(Number.isFinite(k.x) ? { x: k.x * sx } : {}),
          ...(Number.isFinite(k.y) ? { y: k.y * sy } : {}),
        }));
        if (layer._textSize) layer._textSize *= sy;
        for (const [key, s] of [['_origX', sx], ['_origY', sy], ['_origW', sx], ['_origH', sy]]) {
          const saved = { _origX: data.origX, _origY: data.origY, _origW: data.origW, _origH: data.origH }[key];
          if (Number.isFinite(saved)) layer[key] = saved * s;
        }
        delete layer.imageDataURL; delete layer.origImageDataURL;
        return layer;
      }));
      scene.groups = (scene.groups || []).map(g => {
        const newId = `group-${crypto.randomUUID()}`;
        groupMap.set(g.id, newId);
        return { ...g, id: newId, layerIds: (g.layerIds || []).map(oldId => idMap.get(oldId)).filter(Boolean) };
      });
      scene.layers.forEach(l => { l.groupId = groupMap.get(l.groupId) || null; });
      scene.selectedLayerId = idMap.get(scene.selectedLayerId) || scene.layers[0]?.id || null;
      scene.id = `scene-${crypto.randomUUID()}`;
      scene.name = entry.name;
      insertScene(scene, 'Insert Saved Template');
      library.close();
      showToast(`${entry.name} restored with all scene structure`);
    } catch (error) { errorMessage(error, 'Could not restore template'); }
  }

  // ── Independent property tracks & keyframe inspector ─────────────────────
  function renderChannels(layer, hRow, headers, lanes, offset) {
    const disclosure = button(expanded.has(layer.id) ? '▾' : '▸', e => {
      e.stopPropagation();
      if (expanded.has(layer.id)) expanded.delete(layer.id);
      else expanded.add(layer.id);
      TimelineStudio.renderTimeline();
    }, 'studio-track-toggle');
    disclosure.setAttribute('aria-label', `Expand ${layer.name} animation properties`);
    disclosure.setAttribute('aria-expanded', expanded.has(layer.id));
    hRow.prepend(disclosure);
    hRow.dataset.layerId = layer.id;
    if (layer.svgMotion && window.SVGWorkshop) {
      const badge = button('SVG', event => { event.stopPropagation(); SVGWorkshop.open(layer); }, 'studio-gsap-badge studio-motion-badge', 'M4 4h16v16H4zM9 8l7 4-7 4z');
      badge.title = 'Modifier ce design dans l’atelier SVG';
      badge.setAttribute('aria-label', `Modifier le SVG animé ${layer.name}`);
      badge.dataset.svgMotionLayer = layer.id;
      badge.disabled = !!state.recording;
      hRow.append(badge);
    }
    if (layer.gsapEffect && window.StudioEffects) {
      const name = EffectManager.catalog.find(entry => entry.key === layer.gsapEffect.effect)?.name || layer.gsapEffect.effect;
      const badge = button('GSAP', event => {
        event.stopPropagation();
        if (state.recording) return;
        selectLayer(layer.id);
        StudioEffects.open();
      }, 'studio-gsap-badge', 'm13 2-9 12h7l-1 8 10-13h-7z');
      badge.dataset.gsapLayer = layer.id;
      badge.title = `${name} · ${layer.gsapEffect.duration}s — Régler l’effet`;
      badge.setAttribute('aria-label', `Régler ${name} pour ${layer.name}`);
      badge.disabled = !!state.recording;
      hRow.append(badge);
    }
    const lane = lanes.lastElementChild;
    lane.dataset.layerId = layer.id;
    lane.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('application/x-inkplainer-preset')) {
        e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      }
    });
    lane.addEventListener('drop', e => {
      const id = e.dataTransfer.getData('application/x-inkplainer-preset');
      if (!id) return;
      e.preventDefault();
      applyPreset(id, layer);
    });
    if (!expanded.has(layer.id)) return;
    const evaluated = StudioCore.evaluate(layer, localTime());
    for (const channel of channels) {
      const header = el('div', 'studio-channel-header', null, { 'data-property': channel.key, 'data-layer-id': layer.id });
      const label = el('span', 'studio-channel-name', channel.label);
      const display = channel.key === 'opacity' ? evaluated[channel.key] * 100 : evaluated[channel.key];
      const input = number(+display.toFixed(2), {
        step: channel.key === 'opacity' ? 1 : channel.step,
        ...(channel.min !== undefined ? { min: channel.min } : {}),
        ...(channel.max !== undefined ? { max: channel.key === 'opacity' ? 100 : channel.max } : {}),
        'aria-label': `${layer.name} ${channel.label}`,
      });
      input.className = 'studio-channel-input';
      input.onchange = () => setPropertyAtPlayhead(layer, channel.key, Number(input.value));
      const add = button('◆', () => addKeyframes(layer, channel.key), 'studio-channel-add');
      add.title = `Add ${channel.label} keyframe at playhead`;
      add.setAttribute('aria-label', add.title);
      header.append(label, input, el('span', 'studio-channel-unit', channel.unit), add);
      headers.append(header);
      const propertyLane = el('div', 'studio-channel-lane', null, { 'data-property': channel.key, 'data-layer-id': layer.id });
      const line = el('div', 'studio-channel-span');
      line.style.left = `${(offset + (layer.inPoint || 0)) * state.timelineZoom}px`;
      line.style.width = `${((layer.outPoint || activeScene().duration) - (layer.inPoint || 0)) * state.timelineZoom}px`;
      propertyLane.append(line);
      for (const frame of (layer.keyframes || []).filter(k => Number.isFinite(k[channel.key]))) {
        const diamond = button('', e => {
          e.stopPropagation();
          if (diamond.dataset.dragged !== 'true') editKeyframe(e, layer, frame, channel.key);
          delete diamond.dataset.dragged;
        }, 'tl-kf-diamond');
        diamond.style.left = `${(offset + frame.time) * state.timelineZoom}px`;
        diamond.title = `${channel.label} · ${frame.time.toFixed(2)}s · ${frame[channel.key]} · ${frame.easings?.[channel.key] || frame.easing || 'ease-in-out'}`;
        diamond.setAttribute('aria-label', diamond.title);
        diamond.onmousedown = e => startKeyDrag(e, layer, frame, channel.key, diamond, offset);
        propertyLane.append(diamond);
      }
      lanes.append(propertyLane);
    }
  }
  function updateTrackValues() {
    document.querySelectorAll('.studio-channel-header').forEach(header => {
      const layer = getLayerById(Number(header.dataset.layerId));
      const input = header.querySelector('input');
      if (!layer || document.activeElement === input) return;
      const value = StudioCore.evaluate(layer, localTime())[header.dataset.property];
      input.value = +(header.dataset.property === 'opacity' ? value * 100 : value).toFixed(2);
    });
  }
  function syncTrackScroll() {
    const scroll = document.getElementById('tl-scroll-area');
    const headers = document.querySelector('.tl-headers-col');
    if (!scroll || !headers) return;
    // Both columns need the same scroll range, including the horizontal scrollbar.
    headers.style.setProperty('--studio-scrollbar-gap', `${scroll.offsetHeight - scroll.clientHeight}px`);
    headers.scrollTop = scroll.scrollTop;
  }
  function setPropertyAtPlayhead(layer, key, rawValue) {
    const config = channels.find(c => c.key === key);
    let value = key === 'opacity' ? rawValue / 100 : rawValue;
    if (!Number.isFinite(value)) return;
    if (config.min !== undefined) value = Math.max(config.min, value);
    if (config.max !== undefined) value = Math.min(config.max, value);
    commit(`Keyframe ${config.label}`, () => StudioCore.put(layer, key, +localTime().toFixed(4), value));
  }
  function addKeyframes(layer = getSelectedLayer(), key) {
    if (!layer) { showToast('Select a layer first'); return; }
    const property = key || document.getElementById('studio-key-property')?.value || 'all';
    const pose = StudioCore.evaluate(layer, localTime());
    const keys = property === 'all' ? channels.map(c => c.key) : [property];
    commit('Add Property Keyframe', () => keys.forEach(k => StudioCore.put(layer, k, +localTime().toFixed(4), pose[k])));
    expanded.add(layer.id);
    TimelineStudio.renderTimeline();
  }
  function startKeyDrag(e, layer, frame, key, diamond, offset) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startTime = frame.time;
    let moved = false;
    const move = me => {
      if (!moved && Math.abs(me.clientX - startX) < 3) return;
      if (!moved) { TimelineStudio.pausePreviewAll(); pushUndoSnapshot('Move Property Keyframe'); moved = true; }
      const duration = activeScene().duration;
      let t = clamp(startTime + (me.clientX - startX) / state.timelineZoom, 0, duration);
      if (state.projectSettings.magneticSnap !== false && !me.altKey) t = Math.round(t * 10) / 10;
      diamond.style.left = `${(offset + t) * state.timelineZoom}px`;
      diamond.dataset.time = t;
      diamond.dataset.dragged = 'true';
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (!moved) return;
      const t = Number(diamond.dataset.time);
      const value = frame[key], ease = frame.easings?.[key] || frame.easing || 'ease-in-out';
      delete frame[key];
      if (frame.easings) delete frame.easings[key];
      StudioCore.put(layer, key, +t.toFixed(4), value, ease);
      pruneFrames(layer);
      TimelineStudio.renderTimeline();
      TimelineStudio.seekToGlobalTime(state.playheadTime);
      scheduleAutoSave();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }
  function pruneFrames(layer) {
    layer.keyframes = layer.keyframes.filter(k => channels.some(c => Number.isFinite(k[c.key])));
  }
  function editKeyframe(event, layer, frame, property) {
    event?.stopPropagation();
    if (state.recording) { showToast('Cancel the export before editing keyframes'); return; }
    TimelineStudio.pausePreviewAll();
    if (!keyDialog) keyDialog = createDialog('Keyframe inspector', 'Edit values independently. Easing controls the segment to the next keyframe.', true);
    keyDialog.querySelector('.studio-small-body')?.remove();
    const body = el('div', 'studio-small-body');
    body.append(el('div', 'studio-kf-heading', layer.name));
    const time = number(frame.time.toFixed(3), { min: 0, max: activeScene().duration, step: .01 });
    body.append(field('Scene time (seconds)', time));
    const relevant = channels.filter(c => property ? c.key === property : Number.isFinite(frame[c.key]));
    const controls = [];
    for (const config of relevant) {
      const row = el('div', 'studio-form-grid');
      const value = number(config.key === 'opacity' ? frame[config.key] * 100 : frame[config.key], {
        step: config.key === 'opacity' ? 1 : config.step, 'data-key-value': config.key,
      });
      const ease = select(easings, frame.easings?.[config.key] || frame.easing || 'ease-in-out');
      ease.dataset.keyEasing = config.key;
      controls.push({ config, value, ease });
      row.append(field(`${config.label} (${config.unit})`, value), field('Easing to next key', ease));
      body.append(row);
    }
    const actions = el('div', 'studio-actions');
    actions.append(button('Delete key', () => {
      commit('Delete Property Keyframe', () => {
        for (const config of relevant) {
          delete frame[config.key];
          if (frame.easings) delete frame.easings[config.key];
        }
        pruneFrames(layer);
      });
      keyDialog.close();
    }, 'studio-action danger'), button('Save changes', () => {
      if (!Number.isFinite(time.valueAsNumber)) return;
      const values = controls.map(c => {
        let v = c.value.valueAsNumber;
        if (c.config.key === 'opacity') v /= 100;
        if (c.config.min !== undefined) v = Math.max(c.config.min, v);
        if (c.config.max !== undefined) v = Math.min(c.config.max, v);
        return { key: c.config.key, value: v, easing: c.ease.value };
      });
      if (values.some(v => !Number.isFinite(v.value))) return;
      commit('Edit Property Keyframe', () => {
        for (const v of values) {
          delete frame[v.key];
          if (frame.easings) delete frame.easings[v.key];
        }
        const t = +clamp(time.valueAsNumber, 0, activeScene().duration).toFixed(4);
        for (const v of values) StudioCore.put(layer, v.key, t, v.value, v.easing);
        pruneFrames(layer);
      });
      keyDialog.close();
    }, 'studio-action primary'));
    body.append(actions);
    keyDialog.append(body);
    activeKey = { layerId: layer.id, frameId: frame.id };
    openDialog(keyDialog);
  }
  function openPresets() {
    if (state.recording) { showToast('Cancel the export before applying presets'); return; }
    if (pen) { showToast('Finish or cancel vector editing first'); return; }
    window.StudioEffects?.stopPreview();
    if (!presetDialog) {
      presetDialog = createDialog('Animation presets', 'Apply to the selected layer, or drag a preset onto a layer track. All generated keys remain editable.');
      presetDialog.classList.add('studio-preset-dialog');
    }
    presetDialog.querySelector('.studio-library-main')?.remove();
    const body = el('div', 'studio-library-main');
    const controls = el('div', 'studio-count-label');
    const duration = number(2, { min: .1, max: 60, step: .1, id: 'preset-duration' });
    duration.classList.add('studio-duration');
    controls.append(el('span', '', getSelectedLayer() ? `Selected layer: ${getSelectedLayer().name}` : 'Select a layer to apply a preset'));
    controls.append(field('Duration (seconds)', duration));
    const grid = el('div', 'studio-grid presets');
    for (const preset of StudioCore.presets) {
      const card = button('', () => applyPreset(preset.id), 'studio-card');
      card.draggable = true;
      card.dataset.presetId = preset.id;
      const curve = document.createElementNS(NS, 'svg');
      curve.setAttribute('viewBox', '0 0 200 75');
      curve.setAttribute('class', 'studio-preset-curve');
      const p = document.createElementNS(NS, 'path');
      const values = [];
      for (let i = 0; i <= 60; i++) values.push(`${i === 0 ? 'M' : 'L'}${15 + i * 170 / 60} ${60 - StudioCore.ease(i / 60, preset.easing) * 42}`);
      p.setAttribute('d', values.join(' '));
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2');
      curve.append(p);
      card.append(curve, el('div', 'studio-card-name', preset.name),
        el('div', 'studio-card-meta', `${preset.group} · ${easings.find(e => e[0] === preset.easing)[1]} · ${preset.frames.length} poses`));
      card.ondragstart = e => {
        e.dataTransfer.setData('application/x-inkplainer-preset', preset.id);
        e.dataTransfer.effectAllowed = 'copy';
      };
      grid.append(card);
    }
    body.append(controls, grid);
    presetDialog.append(body);
    TimelineStudio.pausePreviewAll();
    // A non-modal dialog keeps the underlying timeline available as a drop target.
    if (!presetDialog.open) presetDialog.show();
  }
  function applyPreset(id, layer = getSelectedLayer()) {
    if (state.recording) { showToast('Cancel the export before applying presets'); return; }
    if (!layer) { showToast('Select a layer or drop the preset on its track'); return; }
    const sc = activeScene();
    const start = clamp(localTime(), layer.inPoint ?? 0, (layer.outPoint ?? sc.duration) - .01);
    const requested = Number(document.getElementById('preset-duration')?.value) || 2;
    const duration = Math.max(.01, Math.min(requested, (layer.outPoint ?? sc.duration) - start));
    commit('Apply Animation Preset', () => StudioCore.applyPreset(layer, id, start, duration));
    expanded.add(layer.id);
    TimelineStudio.renderTimeline();
    if (presetDialog?.open) presetDialog.close();
    showToast('Preset applied. Expand the layer to edit individual keys.');
  }

  // ── Native Bézier pen and node editing ─────────────────────────────────────
  function buildPenTools() {
    vectorOverlay = el('canvas', '', null, { id: 'studio-vector-overlay', 'aria-label': 'Vector path editor' });
    document.getElementById('canvas-wrapper').append(vectorOverlay);
    vectorOverlay.addEventListener('pointerdown', penDown);
    vectorOverlay.addEventListener('pointermove', penMove);
    vectorOverlay.addEventListener('pointerup', penUp);
    vectorOverlay.addEventListener('pointercancel', penUp);
    vectorOverlay.addEventListener('dblclick', e => { e.preventDefault(); if (pen?.mode === 'pen' && pen.nodes.length >= 2) finishPen(); });
    vectorPanel = el('div', 'studio-vector-panel', null, { id: 'studio-vector-panel' });
    const canvasArea = document.getElementById('canvas-area');
    canvasArea.after(vectorPanel);
    const toolbar = document.getElementById('tool-toolbar');
    canvasArea.before(toolbar);
    document.getElementById('main').classList.add('studio-main-tools');
    toolbar.classList.add('studio-tools');
    const pick = button('Select', () => cancelPen(), 'tool-btn', 'M5 3l14 10-7 1-3 7Z');
    const draw = button('Pen', () => startPen(), 'tool-btn', 'M4 20l3-8L17 2l5 5L12 17ZM7 12l5 5');
    draw.id = 'studio-pen-tool';
    draw.title = 'Pen tool (P) — click anchors, drag Bézier handles';
    const nodes = button('Nodes', () => startNodes(), 'tool-btn', 'M4 4h5v5H4ZM15 15h5v5h-5ZM9 6h4a4 4 0 0 1 4 4v5');
    nodes.id = 'studio-node-tool';
    nodes.title = 'Edit the selected custom vector (A)';
    const style = button('Vector style', () => openVectorStyle(), 'tool-btn', 'M12 3L4 14a8 8 0 0 0 16 0Z');
    style.id = 'studio-vector-style';
    toolbar.prepend(pick, draw, nodes, style, el('div', 'tool-divider'));
    toolbar.classList.add('visible');
    new ResizeObserver(() => { if (pen) drawPen(); }).observe(document.getElementById('canvas-wrapper'));
  }
  function startPen() {
    if (state.recording) return;
    if (pen && pen.nodes.length && !confirm('Discard the unfinished path?')) return;
    window.StudioEffects?.stopPreview();
    TimelineStudio.pausePreviewAll();
    closeTextEditor(true);
    deactivateTextPlacement();
    if (_cropState) cancelCrop();
    pen = { mode: 'pen', nodes: [], closed: false, history: [], future: [], drag: null };
    selectedNode = null;
    showPenPanel();
    vectorOverlay.className = 'editing';
    document.getElementById('studio-pen-tool').classList.add('active');
    drawPen();
    window.StudioEffects?.syncSelection();
  }
  function startNodes() {
    if (state.recording) return;
    const layer = getSelectedLayer();
    if (!layer?.vectorData?.paths.some(p => p.nodes)) {
      showToast('Select a shape created with the Pen tool to edit its nodes');
      return;
    }
    window.StudioEffects?.stopPreview();
    TimelineStudio.pausePreviewAll();
    closeTextEditor(true);
    deactivateTextPlacement();
    if (_cropState) cancelCrop();
    const part = layer.vectorData.paths.find(p => p.nodes);
    const pose = StudioCore.evaluate(layer, localTime());
    if (pose.w < .01 || pose.h < .01) { showToast('Move the playhead to a visible scale before editing nodes'); return; }
    pen = {
      mode: 'nodes', layerId: layer.id, vector: clone(layer.vectorData),
      nodes: clone(part.nodes), closed: !!part.closed, history: [], future: [], drag: null,
      pose, layer: { x: layer.x, y: layer.y, w: layer.w, h: layer.h },
      pathIndex: layer.vectorData.paths.indexOf(part),
    };
    penStroke = layer.vectorData.stroke;
    penFill = layer.vectorData.fill === 'none' ? penFill : layer.vectorData.fill;
    penNoFill = layer.vectorData.fill === 'none';
    penWidth = layer.vectorData.strokeWidth;
    selectedNode = null;
    showPenPanel();
    vectorOverlay.className = 'editing nodes';
    document.getElementById('studio-node-tool').classList.add('active');
    TimelineStudio.renderSceneCompositeToContext(_mainCtx, activeScene(), localTime(), false);
    drawPen();
    window.StudioEffects?.syncSelection();
  }
  function showPenPanel() {
    document.getElementById('main').classList.add('studio-pen-editing');
    vectorPanel.classList.add('open');
    const hint = el('div', 'studio-vector-hint', pen.mode === 'pen'
      ? 'Click to add anchors. Drag to curve. Click the first anchor to close. Enter to finish · Esc to cancel.'
      : 'Drag anchors or handles. Alt-drag breaks handle symmetry. Delete removes a node. Enter applies · Esc cancels.');
    const row = el('div', 'studio-row');
    const stroke = colorControl('Stroke', penStroke, v => { penStroke = v; drawPen(); });
    const fill = colorControl('Fill', penFill, v => { penFill = v; drawPen(); });
    const width = number(penWidth, { min: .5, max: 40, step: .5, 'aria-label': 'Vector stroke width' });
    width.oninput = () => { penWidth = clamp(Number(width.value) || .5, .5, 40); drawPen(); };
    const noFill = el('input', '', null, { type: 'checkbox' });
    noFill.checked = penNoFill;
    noFill.onchange = () => { penNoFill = noFill.checked; drawPen(); };
    const transparent = field('No fill', noFill);
    row.append(stroke, fill, field('Width', width), transparent,
      button(pen.closed ? 'Open path' : 'Close path', () => {
        if (pen.nodes.length < 3) { showToast('Use at least 3 anchors for a closed path'); return; }
        rememberPen();
        pen.closed = !pen.closed;
        showPenPanel(); drawPen();
      }),
      button(pen.mode === 'nodes' ? 'Apply' : 'Finish', () => finishPen(), 'studio-action primary'),
      button('Cancel', () => cancelPen()));
    vectorPanel.replaceChildren(hint, row);
    fitCanvas();
  }
  function penPoint(e) {
    const rect = vectorOverlay.getBoundingClientRect();
    const world = { x: (e.clientX - rect.left) * state.canvasW / rect.width, y: (e.clientY - rect.top) * state.canvasH / rect.height };
    return pen.mode === 'nodes' ? worldToVector(world) : world;
  }
  function worldToVector(p) {
    const v = pen.vector, pose = pen.pose, layer = pen.layer;
    const cx = pose.x + layer.w / 2, cy = pose.y + layer.h / 2;
    const a = -(pose.rotation || 0) * Math.PI / 180;
    const dx = p.x - cx, dy = p.y - cy;
    return { x: ((dx * Math.cos(a) - dy * Math.sin(a)) + pose.w / 2) * v.width / pose.w,
      y: ((dx * Math.sin(a) + dy * Math.cos(a)) + pose.h / 2) * v.height / pose.h };
  }
  function vectorToWorld(p) {
    if (pen.mode !== 'nodes') return p;
    const { vector: v, pose, layer } = pen;
    const x = p.x * pose.w / v.width - pose.w / 2, y = p.y * pose.h / v.height - pose.h / 2;
    const a = (pose.rotation || 0) * Math.PI / 180;
    return { x: pose.x + layer.w / 2 + x * Math.cos(a) - y * Math.sin(a),
      y: pose.y + layer.h / 2 + x * Math.sin(a) + y * Math.cos(a) };
  }
  function hitNode(p, includeHandles = true) {
    const rect = vectorOverlay.getBoundingClientRect();
    const radius = 9 * state.canvasW / rect.width;
    const world = vectorToWorld(p);
    let best = null, distance = radius;
    pen.nodes.forEach((n, index) => {
      for (const type of includeHandles ? ['in', 'out', 'anchor'] : ['anchor']) {
        const pos = vectorToWorld({ x: type === 'anchor' ? n.x : n[`${type}X`], y: type === 'anchor' ? n.y : n[`${type}Y`] });
        const d = Math.hypot(pos.x - world.x, pos.y - world.y);
        if (d <= distance) { distance = d; best = { index, type }; }
      }
    });
    return best;
  }
  function rememberPen() {
    pen.history.push({ nodes: clone(pen.nodes), closed: pen.closed });
    if (pen.history.length > 60) pen.history.shift();
    pen.future = [];
  }
  function penDown(e) {
    if (!pen || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const p = penPoint(e);
    if (pen.mode === 'pen') {
      const first = pen.nodes[0];
      const rect = vectorOverlay.getBoundingClientRect();
      if (pen.nodes.length > 2 && Math.hypot(p.x - first.x, p.y - first.y) < 10 * state.canvasW / rect.width) {
        rememberPen(); pen.closed = true; showPenPanel(); drawPen(); return;
      }
      if (pen.closed) { showToast('Finish the closed path, or open it to add anchors'); return; }
      rememberPen();
      pen.nodes.push({ x: p.x, y: p.y, inX: p.x, inY: p.y, outX: p.x, outY: p.y });
      selectedNode = pen.nodes.length - 1;
      pen.drag = { index: selectedNode, type: 'new', start: p };
    } else {
      const hit = hitNode(p);
      selectedNode = hit?.index ?? null;
      if (hit) { rememberPen(); pen.drag = { ...hit, start: p }; }
    }
    vectorOverlay.setPointerCapture(e.pointerId);
    drawPen();
  }
  function penMove(e) {
    if (!pen) return;
    const p = penPoint(e);
    if (!pen.drag) {
      vectorOverlay.style.cursor = pen.mode === 'pen' ? 'crosshair' : (hitNode(p) ? 'move' : 'default');
      return;
    }
    e.preventDefault();
    const d = pen.drag, n = pen.nodes[d.index];
    if (d.type === 'new') {
      const dx = p.x - d.start.x, dy = p.y - d.start.y;
      Object.assign(n, { inX: n.x - dx, inY: n.y - dy, outX: n.x + dx, outY: n.y + dy });
    } else if (d.type === 'anchor') {
      const dx = p.x - n.x, dy = p.y - n.y;
      n.x += dx; n.y += dy; n.inX += dx; n.inY += dy; n.outX += dx; n.outY += dy;
    } else {
      n[`${d.type}X`] = p.x; n[`${d.type}Y`] = p.y;
      if (!e.altKey) {
        const opposite = d.type === 'in' ? 'out' : 'in';
        n[`${opposite}X`] = 2 * n.x - p.x; n[`${opposite}Y`] = 2 * n.y - p.y;
      }
    }
    drawPen();
  }
  function penUp(e) {
    if (!pen) return;
    if (vectorOverlay.hasPointerCapture(e.pointerId)) vectorOverlay.releasePointerCapture(e.pointerId);
    pen.drag = null;
  }
  function drawPen() {
    if (!pen) return;
    vectorOverlay.width = state.canvasW; vectorOverlay.height = state.canvasH;
    const c = vectorOverlay.getContext('2d');
    const rect = vectorOverlay.getBoundingClientRect();
    const size = state.canvasW / rect.width;
    c.save();
    if (pen.mode === 'nodes') {
      const { pose, layer, vector: v } = pen;
      c.translate(pose.x + layer.w / 2, pose.y + layer.h / 2);
      c.rotate((pose.rotation || 0) * Math.PI / 180);
      c.translate(-pose.w / 2, -pose.h / 2);
      c.scale(pose.w / v.width, pose.h / v.height);
    }
    if (pen.nodes.length > 1) {
      const path = new Path2D(StudioCore.penPath(pen.nodes, pen.closed));
      c.strokeStyle = penStroke; c.lineWidth = penWidth; c.lineCap = 'round'; c.lineJoin = 'round';
      if (pen.closed && !penNoFill) { c.fillStyle = penFill; c.fill(path); }
      c.stroke(path);
    }
    c.restore();
    for (const [index, n] of pen.nodes.entries()) {
      const a = vectorToWorld(n), i = vectorToWorld({ x: n.inX, y: n.inY }), o = vectorToWorld({ x: n.outX, y: n.outY });
      c.lineWidth = size;
      c.strokeStyle = '#6366f1';
      c.beginPath(); c.moveTo(i.x, i.y); c.lineTo(o.x, o.y); c.stroke();
      for (const h of [i, o]) {
        c.fillStyle = '#fff'; c.fillRect(h.x - 2.5 * size, h.y - 2.5 * size, 5 * size, 5 * size);
        c.strokeRect(h.x - 2.5 * size, h.y - 2.5 * size, 5 * size, 5 * size);
      }
      c.beginPath(); c.arc(a.x, a.y, 4.5 * size, 0, 2 * Math.PI);
      c.fillStyle = index === selectedNode ? '#6366f1' : '#fff'; c.fill(); c.stroke();
    }
  }
  function normalizePen(nodes, closed, stroke, fill, width) {
    const xs = nodes.flatMap(n => [n.x, n.inX, n.outX]), ys = nodes.flatMap(n => [n.y, n.inY, n.outY]);
    const pad = Math.max(width * 2, 6);
    const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    const w = Math.max(1, Math.max(...xs) - x + pad), h = Math.max(1, Math.max(...ys) - y + pad);
    const localNodes = nodes.map(n => ({
      x: n.x - x, y: n.y - y, inX: n.inX - x, inY: n.inY - y, outX: n.outX - x, outY: n.outY - y,
    }));
    return { x, y, vector: { width: w, height: h, stroke, fill, strokeWidth: width,
      paths: [{ nodes: localNodes, closed, fill: closed }] } };
  }
  async function finishPen() {
    if (!pen || pen.nodes.length < 2) { showToast('Add at least two anchors to finish a path'); return; }
    const editing = pen;
    const fill = penNoFill ? 'none' : penFill;
    try {
      if (editing.mode === 'pen') {
        const data = normalizePen(editing.nodes, editing.closed, penStroke, fill, penWidth);
        const img = await imageFromSource(svgURL(vectorSVG(data.vector)));
        if (pen !== editing) return;
        pushUndoSnapshot('Draw Bézier Path');
        const layer = makeLayer('Custom Bézier Path', img, {
          kind: 'vector', vectorData: data.vector, x: data.x, y: data.y,
          w: data.vector.width, h: data.vector.height, baseW: data.vector.width, baseH: data.vector.height,
        });
        state.layers.push(layer);
        state.selectedLayerId = layer.id;
        expanded.add(layer.id);
      } else {
        const layer = getLayerById(editing.layerId);
        if (!layer) { cancelPen(); return; }
        const data = clone(editing.vector);
        Object.assign(data, { stroke: penStroke, fill, strokeWidth: penWidth });
        Object.assign(data.paths[editing.pathIndex], { nodes: clone(editing.nodes), closed: editing.closed, fill: editing.closed });
        const img = await imageFromSource(svgURL(vectorSVG(data)));
        if (pen !== editing) return;
        pushUndoSnapshot('Edit Bézier Nodes');
        layer.vectorData = data;
        layer.img = img;
      }
      cancelPen();
      TimelineStudio.saveWorkingStateToActiveScene();
      renderLayerList();
      redrawLayersOnCanvas();
      drawSelectionHandles();
      scheduleAutoSave();
      showToast('Vector path saved. Apply a Draw preset to animate its stroke.');
    } catch (error) { errorMessage(error, 'Could not save vector path'); }
  }
  function cancelPen() {
    const wasNodeEditing = pen?.mode === 'nodes';
    pen = null;
    selectedNode = null;
    vectorPanel?.classList.remove('open');
    document.getElementById('main')?.classList.remove('studio-pen-editing');
    if (vectorPanel) fitCanvas();
    if (vectorOverlay) {
      vectorOverlay.className = '';
      vectorOverlay.getContext('2d').clearRect(0, 0, vectorOverlay.width, vectorOverlay.height);
    }
    document.getElementById('studio-pen-tool')?.classList.remove('active');
    document.getElementById('studio-node-tool')?.classList.remove('active');
    if (wasNodeEditing && activeScene()) TimelineStudio.renderSceneCompositeToContext(_mainCtx, activeScene(), localTime(), false);
    drawSelectionHandles();
    window.StudioEffects?.syncSelection();
  }
  function openVectorStyle() {
    if (pen) { showToast('Edit the style in the path toolbar below the canvas'); return; }
    const layer = getSelectedLayer();
    if (!layer?.vectorData) { showToast('Select a library SVG or custom Pen path'); return; }
    if (!vectorDialog) vectorDialog = createDialog('Vector style', 'SVG colors and stroke weight are editable entirely offline.', true);
    vectorDialog.querySelector('.studio-small-body')?.remove();
    const body = el('div', 'studio-small-body');
    let stroke = layer.vectorData.stroke, fill = layer.vectorData.fill;
    const form = el('div', 'studio-form-grid');
    form.append(colorControl('Stroke color', stroke, v => { stroke = v; }),
      colorControl('Fill color', fill === 'none' ? '#c7d2fe' : fill, v => { fill = v; }));
    const width = number(layer.vectorData.strokeWidth, { min: .5, max: 40, step: .5 });
    const none = el('input', '', null, { type: 'checkbox' });
    none.checked = fill === 'none';
    body.append(el('div', 'studio-kf-heading', layer.name), form, field('Stroke width (SVG units)', width), field('No fill', none));
    const actions = el('div', 'studio-actions');
    actions.append(button('Cancel', () => vectorDialog.close()), button('Apply style', async () => {
      if (!Number.isFinite(width.valueAsNumber)) return;
      const data = { ...clone(layer.vectorData), stroke, fill: none.checked ? 'none' : (fill === 'none' ? '#c7d2fe' : fill), strokeWidth: clamp(width.valueAsNumber, .5, 40) };
      try {
        const img = await imageFromSource(svgURL(vectorSVG(data)));
        commit('Change Vector Style', () => { layer.vectorData = data; layer.img = img; });
        vectorDialog.close();
      } catch (error) { errorMessage(error, 'Could not apply SVG style'); }
    }, 'studio-action primary'));
    body.append(actions);
    vectorDialog.append(body);
    openDialog(vectorDialog);
  }
  function downloadVector() {
    const layer = getSelectedLayer();
    if (!layer?.vectorData) { showToast('Select a vector layer to download its SVG'); return; }
    const blob = new Blob([vectorSVG(layer.vectorData, layer.trimPath ?? 100)], { type: 'image/svg+xml' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${layer.name.replace(/[^\w-]+/g, '-') || 'vector'}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function keyboard(e) {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (e.target.closest('#sidebar-pane-gsap, [data-gsap-launch], .studio-gsap-badge') && [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.stopImmediatePropagation();
      return;
    }
    const dialog = document.querySelector('.studio-dialog[open]');
    if (dialog) {
      // Native dialogs handle Escape; prevent application-level shortcuts underneath.
      if (e.key === 'Escape' && !dialog.matches(':modal')) { e.preventDefault(); dialog.close(); }
      e.stopImmediatePropagation();
      return;
    }
    if (!pen) {
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === 'p') { e.preventDefault(); e.stopImmediatePropagation(); startPen(); }
        if (e.key.toLowerCase() === 'a') { e.preventDefault(); e.stopImmediatePropagation(); startNodes(); }
      }
      return;
    }
    if (typing) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); cancelPen(); }
    else if (e.key === 'Enter') { e.preventDefault(); finishPen(); }
    else if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      const redo = e.shiftKey || e.key.toLowerCase() === 'y';
      const source = redo ? pen.future : pen.history;
      const target = redo ? pen.history : pen.future;
      if (source.length) {
        target.push({ nodes: clone(pen.nodes), closed: pen.closed });
        Object.assign(pen, source.pop()); selectedNode = null; showPenPanel(); drawPen();
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (selectedNode !== null) {
        rememberPen(); pen.nodes.splice(selectedNode, 1); selectedNode = null;
        if (pen.nodes.length < 3) pen.closed = false;
        drawPen();
      }
    }
  }
  function init() {
    if (initialized) return;
    initialized = true;
    if (window.EffectManager) EffectManager.configure({
      canvas: {
        renderAll() {
          const scene = activeScene();
          if (scene) TimelineStudio.renderSceneCompositeToContext(_mainCtx, scene, localTime(), false);
        },
      },
      beforeApply(target) {
        if (!state.layers.includes(target)) return true;
        if (state.recording || pen) return false;
        TimelineStudio.pausePreviewAll();
        cancelAnimationFrame(state.animFrame);
        state.playing = false;
        state.bgCanvas = null;
        hctx.clearRect(0, 0, state.canvasW, state.canvasH);
        sctx.clearRect(0, 0, state.canvasW, state.canvasH);
        const overlay = document.getElementById('outline-overlay');
        if (overlay) overlay.style.display = 'none';
        return true;
      },
    });
    buildLibrary();
    buildPenTools();
    const launch = button('Assets & Templates', () => openLibrary(), 'studio-launch', 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z');
    launch.id = 'btn-assets-templates';
    document.getElementById('btn-projects').after(launch);
    if (window.StudioEffects) StudioEffects.init({ el, button, field, number, select, icon });
    if (window.SVGWorkshop) SVGWorkshop.init({ el, button, field, number, select, icon, createDialog });
    const toolbar = document.querySelector('.tl-toolbar-group:has([onclick*="addKeyframeAtPlayhead"])');
    const property = select([['all', 'All properties'], ...channels.map(c => [c.key, c.label])], 'all', 'studio-tl-select');
    property.id = 'studio-key-property';
    property.setAttribute('aria-label', 'Property to add keyframe');
    const presets = button('Motion presets', () => openPresets(), 'tl-btn');
    presets.id = 'studio-motion-presets';
    toolbar.querySelector('[onclick*="addKeyframeAtPlayhead"]').after(property, presets);
    const exportSVG = button('SVG', () => downloadVector(), 'tool-btn', 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5');
    exportSVG.title = 'Download the selected vector as SVG';
    document.getElementById('tool-toolbar').append(exportSVG);
    document.addEventListener('keydown', keyboard, true);
    const scroll = document.getElementById('tl-scroll-area');
    scroll.addEventListener('scroll', syncTrackScroll);
    new ResizeObserver(syncTrackScroll).observe(scroll);
    TimelineStudio.renderTimeline();
  }
  return {
    init, hasMotion, drawLayer, drawVector, vectorSVG, refreshVectorImage,
    openLibrary, insertAsset, insertMotionDesign, saveAsTemplate, applyBuiltinTemplate, applySavedTemplate,
    setCatalogScale, toggleFavoriteAsset, getFilteredAssets: () => filteredAssets,
    renderChannels, updateTrackValues, syncTrackScroll, addKeyframes, editKeyframe,
    openPresets, applyPreset, startPen, startNodes, cancelPen, finishPen,
    isEditing: () => !!pen,
    closeEditors: () => { window.StudioEffects?.stopPreview(false); if (window.EffectManager) EffectManager.stopAll(); cancelPen(); if (keyDialog?.open) keyDialog.close(); if (vectorDialog?.open) vectorDialog.close(); activeKey = null; },
  };
})();
window.StudioUI = StudioUI;
window.addEventListener('load', () => setTimeout(StudioUI.init, 220));
