/* Unified Stickman workstation shell over the existing Studio and Production APIs. */
(function (root) {
  'use strict';
  const PREFS_KEY = 'inkplainer-stickman-workspace-v1';
  let dialog = null;
  let mode = 'beginner';
  let activeTab = 'overview';

  function appState() {
    try { return state; } catch (_) { return root.state || null; }
  }
  function readPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      mode = saved.mode === 'expert' ? 'expert' : 'beginner';
      activeTab = saved.tab || 'overview';
    } catch (error) { console.warn('Stickman workspace preferences unavailable.', error); }
  }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ mode, tab: activeTab })); }
    catch (error) { console.warn('Stickman workspace preferences could not be saved.', error); }
  }
  function scene() { return root.TimelineStudio?.getActiveScene?.(); }
  function production() {
    const current = scene();
    return current ? (root.StickmanProductionCore?.normalizeProduction?.(current.production, current.duration) || current.production) : null;
  }
  function closeThen(action) {
    if (typeof action !== 'function') return;
    dialog?.close();
    action();
  }
  function action(name) {
    const current = scene();
    if (name === 'save') return root.TimelineStudio?.autoSaveToLocalStorage?.();
    if (name === 'undo') return root.undo?.();
    if (name === 'redo') return root.redo?.();
    if (name === 'play') return root.TimelineStudio?.startPreviewAll?.();
    if (name === 'pause') return root.TimelineStudio?.pausePreviewAll?.();
    if (name === 'stop') return root.TimelineStudio?.stopPreviewAndRewind?.();
    if (name === 'previous' || name === 'next') {
      const app = appState();
      const frame = 1 / Math.max(1, Number(app?.projectSettings?.fps) || 30);
      const time = Math.max(0, Number(app?.playheadTime) || 0) + (name === 'next' ? frame : -frame);
      return root.TimelineStudio?.seekToGlobalTime?.(time);
    }
    if (name === 'keyframe') {
      const p = production();
      const track = p?.tracks?.find(item => item.type === 'character' && item.locked !== true);
      if (track && root.StickmanProductionCore?.addKeyframe) {
        root.StickmanProductionCore.addKeyframe(track, { time: Number(appState()?.playheadTime) || 0, pose: track.character?.pose || track.character?.joints });
        root.TimelineStudio?.renderTimeline?.(); root.TimelineStudio?.autoSaveToLocalStorage?.();
      }
      return;
    }
    if (name === 'character') return closeThen(() => root.StickmanStudio?.open?.());
    if (name === 'production') return closeThen(() => root.StickmanProduction?.open?.());
    if (name === 'timeline') return closeThen(() => document.querySelector('#timeline')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }));
    if (name === 'scene') return closeThen(() => document.querySelector('#btn-scenes')?.click());
    if (name === 'export') return closeThen(() => document.querySelector('#btn-export')?.click());
    if (name === 'camera' || name === 'effects' || name === 'audio') {
      return closeThen(() => root.StickmanProduction?.open?.());
    }
    if (current) root.TimelineStudio?.renderTimeline?.();
  }
  function tabContent(tab) {
    const data = {
      overview: ['Production workflow', 'Start with a character or template, merge it into the active scene, then refine timing in the native timeline. All changes remain editable and local.', [['Create / edit characters', 'character'], ['Open Production Suite', 'production'], ['Open scene manager', 'scene']]],
      character: ['Character Studio', 'Create independent characters, edit proportions and poses, then merge selected characters into the active scene.', [['Open Character Studio', 'character'], ['Load characters from scene', 'character']]],
      rigging: ['Rigging Studio', 'The existing editor exposes draggable joints and two-segment IK. Use the canvas handles to move wrists and ankles while preserving connected limbs.', [['Open Character Studio', 'character'], ['Add pose keyframe', 'keyframe']]],
      animation: ['Animation Studio', 'Apply procedural motions, save poses at exact times, and scrub deterministic frames before sending the tracks to the scene.', [['Open Character Studio', 'character'], ['Open Timeline Pro', 'timeline']]],
      timeline: ['Timeline Pro', 'Stickman rows share the native Inkplainer timeline. Production tracks can be reordered, duplicated, hidden, and previewed from the Production Suite.', [['Open Production Suite', 'production'], ['Open native timeline', 'timeline']]],
      camera: ['Camera Studio', 'Add camera keyframes and presets to the active scene. Camera evaluation is timestamp-based and shared by preview and export.', [['Open Camera controls', 'camera'], ['Open Production Suite', 'production']]],
      effects: ['Effects Studio', 'Add deterministic impact, speed-line, dust, smoke, and glow effects from the production controls. Seeded samples keep frames reproducible.', [['Open Effects controls', 'effects'], ['Open Production Suite', 'production']]],
      audio: ['Sound Studio', 'Import local audio or record voice when the browser supports it. Audio references stay in the local project; export support is capability-gated.', [['Open Sound controls', 'audio'], ['Open Production Suite', 'production']]],
      scene: ['Scene Director', 'Scenes remain owned by TimelineStudio. Use scene management for order, duration, transitions, and active-scene selection.', [['Open scene manager', 'scene'], ['Preview all scenes', 'play']]],
      export: ['Export Studio', 'Use the existing export pipeline after composing the active scene. Fast deterministic formats render timestamps directly; audio-muxed capture may remain real-time.', [['Open Export Video', 'export'], ['Save project', 'save']]],
    };
    const item = data[tab] || data.overview;
    return `<section class="stickman-workspace-panel"><div class="stickman-workspace-eyebrow">${mode === 'expert' ? 'Expert workflow' : 'Beginner workflow'}</div><h2>${item[0]}</h2><p>${item[1]}</p><div class="stickman-workspace-actions">${item[2].map(([label, key]) => `<button type="button" data-work-action="${key}">${label}</button>`).join('')}</div>${mode === 'expert' ? '<div class="stickman-workspace-details"><strong>Technical state</strong><span>Scene tracks, camera, effects, captions, audio, and markers are stored in the active scene production object.</span><span>Preview and export use the same local timestamp renderer.</span></div>' : '<div class="stickman-workspace-details"><strong>Next step</strong><span>Choose an action above. The result is written into the active project scene and remains editable.</span></div>'}</section>`;
  }
  function sceneSummary() {
    const current = scene(), p = production();
    if (!current) return 'No active scene';
    return `${current.name || 'Active scene'} · ${Number(current.duration || 0).toFixed(1)}s · ${p?.tracks?.length || 0} production tracks`;
  }
  function render() {
    if (!dialog) return;
    const tabs = dialog.querySelector('[data-workspace-tabs]');
    tabs.replaceChildren(...['overview', 'character', 'rigging', 'animation', 'timeline', 'camera', 'effects', 'audio', 'scene', 'export'].map(tab => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.workspaceTab = tab; button.textContent = tab === 'overview' ? 'Overview' : tab[0].toUpperCase() + tab.slice(1);
      button.className = tab === activeTab ? 'active' : '';
      button.onclick = () => { activeTab = tab; savePrefs(); render(); };
      return button;
    }));
    dialog.querySelector('[data-workspace-content]').innerHTML = tabContent(activeTab);
    dialog.querySelector('[data-workspace-content]').querySelectorAll('[data-work-action]').forEach(button => button.onclick = () => action(button.dataset.workAction));
    dialog.querySelector('[data-workspace-scene]').textContent = sceneSummary();
    dialog.querySelector('[data-workspace-mode]').textContent = mode === 'expert' ? 'Expert mode' : 'Beginner mode';
    dialog.querySelector('[data-workspace-mode-toggle]').textContent = mode === 'expert' ? 'Use Beginner mode' : 'Use Expert mode';
  }
  function commandPalette() {
    const query = window.prompt('Stickman command: character, production, timeline, camera, effects, audio, scene, export, play, save, undo, redo');
    if (!query) return;
    const value = query.trim().toLowerCase();
    const aliases = { character: 'character', characters: 'character', production: 'production', timeline: 'timeline', camera: 'camera', effects: 'effects', audio: 'audio', scene: 'scene', export: 'export', play: 'play', save: 'save', undo: 'undo', redo: 'redo' };
    if (aliases[value]) action(aliases[value]);
    else if (dialog) dialog.querySelector('[data-workspace-status]').textContent = `Unknown command: ${query}`;
  }
  function build() {
    dialog = document.createElement('dialog'); dialog.id = 'stickman-workspace-dialog';
    dialog.innerHTML = `<form method="dialog" class="stickman-workspace-shell"><header class="stickman-workspace-toolbar"><strong>Stickman Workstation</strong><span data-workspace-scene></span><button type="button" data-work-action="save" title="Save project">Save</button><button type="button" data-work-action="undo" title="Undo">Undo</button><button type="button" data-work-action="redo" title="Redo">Redo</button><button type="button" data-work-action="previous" title="Previous frame">◀</button><button type="button" data-work-action="play" title="Play all scenes">Play</button><button type="button" data-work-action="pause" title="Pause preview">Pause</button><button type="button" data-work-action="stop" title="Stop preview">Stop</button><button type="button" data-work-action="next" title="Next frame">▶</button><button type="button" data-work-action="keyframe" title="Add selected character keyframe">+ Key</button><button type="button" data-workspace-command title="Command palette">⌘ Commands</button><button type="button" data-workspace-mode-toggle></button><button value="close">Close</button></header><nav class="stickman-workspace-tabs" data-workspace-tabs></nav><main data-workspace-content></main><footer><span data-workspace-mode></span><span class="stickman-workspace-status" data-workspace-status>All changes use the active project scene and stay local.</span></footer></form>`;
    document.body.append(dialog);
    dialog.querySelectorAll('[data-work-action]').forEach(button => button.onclick = () => action(button.dataset.workAction));
    dialog.querySelector('[data-workspace-command]').onclick = commandPalette;
    dialog.querySelector('[data-workspace-mode-toggle]').onclick = () => { mode = mode === 'expert' ? 'beginner' : 'expert'; savePrefs(); render(); };
    dialog.addEventListener('keydown', event => {
      if (event.target.matches('input, textarea, select')) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 's') { event.preventDefault(); action('save'); }
      else if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); action(event.shiftKey ? 'redo' : 'undo'); }
      else if (key === ' ') { event.preventDefault(); action('play'); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); action('previous'); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); action('next'); }
      else if (event.key === '?') commandPalette();
    });
  }
  function open() { readPrefs(); if (!dialog) build(); render(); dialog.showModal(); }
  function install() {
    if (document.getElementById('stickman-workspace-launch')) return;
    const anchor = document.getElementById('stickman-launch');
    if (!anchor) return;
    const button = document.createElement('button'); button.id = 'stickman-workspace-launch'; button.type = 'button'; button.textContent = 'Workstation'; button.title = 'Open the professional Stickman workstation'; button.onclick = open; anchor.after(button);
  }
  root.StickmanWorkspace = { open, render };
  setTimeout(install, 320);
  const retry = setInterval(() => { install(); if (document.getElementById('stickman-workspace-launch')) clearInterval(retry); }, 250);
})(window);
