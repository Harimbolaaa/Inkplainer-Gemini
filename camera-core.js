/* Shared, DOM-independent camera & magnetic snap math for canvas, preview & export. */
(function (root) {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function ease(t, name = 'ease-in-out') {
    const u = clamp(Number(t) || 0, 0, 1);
    if (u === 0 || u === 1) return u;
    if (name === 'linear') return u;
    if (name === 'expo') return u < 0.5 ? (2 ** (20 * u - 10)) / 2 : (2 - (2 ** (-20 * u + 10))) / 2;
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  }

  function normalizeLayerCamera(cam, canvasW = 1280, canvasH = 720, fallbackZoom = 1.8) {
    const c = cam || {};
    return {
      enabled: !!c.enabled,
      cx: Number.isFinite(Number(c.cx)) ? Number(c.cx) : canvasW / 2,
      cy: Number.isFinite(Number(c.cy)) ? Number(c.cy) : canvasH / 2,
      zoom: clamp(Number(c.zoom) || Number(fallbackZoom) || 1.8, 0.5, 4.0),
      transitionDur: clamp(Number(c.transitionDur) || 0.7, 0.1, 3.0),
      easing: c.easing || 'ease-in-out',
    };
  }

  function normalizeSceneCamera(cam) {
    const c = cam || {};
    return {
      defaultZoom: clamp(Number(c.defaultZoom) || 1.0, 0.5, 4.0),
      endResetToFull: c.endResetToFull !== false,
      transitionDur: clamp(Number(c.transitionDur) || 0.7, 0.1, 3.0),
    };
  }

  function normalizeSceneCameraKeyframes(kfs, scDur = 5.0, canvasW = 1280, canvasH = 720) {
    if (!Array.isArray(kfs)) return [];
    const maxDur = Math.max(0.5, Number(scDur) || 5.0);
    return kfs
      .filter(k => k && Number.isFinite(Number(k.time)))
      .map((k, idx) => ({
        id: String(k.id || `camkf-${idx}-${Math.round(Number(k.time) * 1000)}`),
        time: clamp(Number(Number(k.time).toFixed(2)), 0, maxDur),
        presetId: k.presetId || 'custom',
        label: String(k.label || 'Caméra'),
        cx: Number.isFinite(Number(k.cx)) ? Number(k.cx) : canvasW / 2,
        cy: Number.isFinite(Number(k.cy)) ? Number(k.cy) : canvasH / 2,
        zoom: clamp(Number(k.zoom) || 1.0, 0.5, 4.0),
        transitionDur: clamp(Number(k.transitionDur) || 0.7, 0.1, 3.0),
        easing: k.easing || 'ease-in-out',
      }))
      .sort((a, b) => a.time - b.time);
  }

  function computeAutoFrameForLayer(layer, canvasW = 1280, canvasH = 720, paddingRatio = 1.38) {
    if (!layer) return { cx: canvasW / 2, cy: canvasH / 2, zoom: 1.0 };
    const lw = Math.max(40, Number(layer.w) || 200);
    const lh = Math.max(40, Number(layer.h) || 200);
    const cx = (Number(layer.x) || 0) + lw / 2;
    const cy = (Number(layer.y) || 0) + lh / 2;
    const fitZoom = Math.min(canvasW / (lw * paddingRatio), canvasH / (lh * paddingRatio));
    return {
      cx,
      cy,
      zoom: clamp(Math.round(fitZoom * 100) / 100, 0.65, 3.6),
    };
  }

  const CAMERA_PRESETS = [
    { id: 'wide',        label: 'Vue 1×',      desc: 'Plan large 100% du canvas', kind: 'single', rx: 0.5,  ry: 0.5,  zoom: 1.0,  trans: 0.7 },
    { id: 'focus-layer', label: 'Focus Calque',desc: 'Cadre automatiquement le calque sélectionné', kind: 'layer', zoom: 1.8, trans: 0.7 },
    { id: 'zoom-soft',   label: 'Zoom 1.5×',   desc: 'Zoom léger centré (ou sur le calque)', kind: 'single', rx: 0.5,  ry: 0.5,  zoom: 1.5,  trans: 0.7, followLayerCenter: true },
    { id: 'closeup',     label: 'Gros plan',   desc: 'Zoom 2.25× sur le sujet', kind: 'single', rx: 0.5,  ry: 0.5,  zoom: 2.25, trans: 0.7, followLayerCenter: true },
    { id: 'macro',       label: 'Macro 3×',    desc: 'Focus serré 3.1× sur détail', kind: 'single', rx: 0.5,  ry: 0.5,  zoom: 3.1,  trans: 0.7, followLayerCenter: true },
    { id: 'corner-nw',   label: 'Haut-G',      desc: 'Cadrage quadrant haut-gauche', kind: 'single', rx: 0.28, ry: 0.28, zoom: 1.9,  trans: 0.75 },
    { id: 'corner-ne',   label: 'Haut-D',      desc: 'Cadrage quadrant haut-droite', kind: 'single', rx: 0.72, ry: 0.28, zoom: 1.9,  trans: 0.75 },
    { id: 'corner-sw',   label: 'Bas-G',       desc: 'Cadrage quadrant bas-gauche', kind: 'single', rx: 0.28, ry: 0.72, zoom: 1.9,  trans: 0.75 },
    { id: 'corner-se',   label: 'Bas-D',       desc: 'Cadrage quadrant bas-droite', kind: 'single', rx: 0.72, ry: 0.72, zoom: 1.9,  trans: 0.75 },
    { id: 'push-in',     label: 'Push-In',     desc: 'Mouvement progressif 1× → 2.15× (2 clés)', kind: 'sequence', trans: 1.2 },
    { id: 'pan-lr',      label: 'Pan G→D',     desc: 'Travelling gauche vers droite (2 clés)', kind: 'sequence', trans: 1.4 },
    { id: 'reset-out',   label: 'Dézoom',      desc: 'Retour doux vers vue globale', kind: 'single', rx: 0.5,  ry: 0.5,  zoom: 1.0,  trans: 0.9 },
  ];

  function buildCameraShotsFromPreset(presetId, options = {}) {
    const W = Number(options.canvasW) || 1280;
    const H = Number(options.canvasH) || 720;
    const scDur = Math.max(0.5, Number(options.sceneDuration) || 5.0);
    const t = clamp(Number(options.localTime) || 0, 0, scDur);
    const layer = options.layer || null;
    const trans = clamp(Number(options.transitionDur) || 0.7, 0.1, 3.0);
    const preset = CAMERA_PRESETS.find(p => p.id === presetId) || CAMERA_PRESETS[0];

    const layerCenter = layer
      ? { cx: (Number(layer.x) || 0) + (Number(layer.w) || 0) / 2, cy: (Number(layer.y) || 0) + (Number(layer.h) || 0) / 2 }
      : { cx: W / 2, cy: H / 2 };

    if (preset.id === 'focus-layer') {
      const auto = layer
        ? computeAutoFrameForLayer(layer, W, H, 1.38)
        : { cx: W / 2, cy: H / 2, zoom: 1.8 };
      return [{
        time: Number(t.toFixed(2)),
        presetId: preset.id,
        label: layer?.name ? `Focus · ${layer.name}` : preset.label,
        cx: auto.cx,
        cy: auto.cy,
        zoom: auto.zoom,
        transitionDur: trans,
        easing: 'ease-in-out',
      }];
    }

    if (preset.id === 'push-in') {
      const endT = clamp(Number(Math.min(scDur, t + Math.max(0.6, preset.trans)).toFixed(2)), Math.min(scDur, t + 0.25), scDur);
      return [
        {
          time: Number(t.toFixed(2)),
          presetId: 'wide',
          label: 'Push-In Départ',
          cx: W / 2,
          cy: H / 2,
          zoom: 1.0,
          transitionDur: 0.45,
          easing: 'ease-in-out',
        },
        {
          time: endT,
          presetId: 'push-in',
          label: 'Push-In Arrivée',
          cx: layerCenter.cx,
          cy: layerCenter.cy,
          zoom: 2.15,
          transitionDur: Math.max(0.35, Number((endT - t).toFixed(2))),
          easing: 'ease-in-out',
        },
      ];
    }

    if (preset.id === 'pan-lr') {
      const endT = clamp(Number(Math.min(scDur, t + Math.max(0.8, preset.trans)).toFixed(2)), Math.min(scDur, t + 0.3), scDur);
      return [
        {
          time: Number(t.toFixed(2)),
          presetId: 'pan-lr-start',
          label: 'Pan Gauche',
          cx: W * 0.3,
          cy: H * 0.5,
          zoom: 1.75,
          transitionDur: 0.5,
          easing: 'ease-in-out',
        },
        {
          time: endT,
          presetId: 'pan-lr',
          label: 'Pan Droite',
          cx: W * 0.7,
          cy: H * 0.5,
          zoom: 1.75,
          transitionDur: Math.max(0.4, Number((endT - t).toFixed(2))),
          easing: 'ease-in-out',
        },
      ];
    }

    const useLayer = !!preset.followLayerCenter && !!layer;
    return [{
      time: Number(t.toFixed(2)),
      presetId: preset.id,
      label: preset.label,
      cx: useLayer ? layerCenter.cx : W * (preset.rx ?? 0.5),
      cy: useLayer ? layerCenter.cy : H * (preset.ry ?? 0.5),
      zoom: clamp(Number(preset.zoom) || 1.0, 0.5, 4.0),
      transitionDur: Number((preset.trans || trans).toFixed(2)),
      easing: 'ease-in-out',
    }];
  }

  function getCameraFrameRect(cam, canvasW = 1280, canvasH = 720) {
    const zoom = clamp(Number(cam?.zoom) || 1.0, 0.5, 4.0);
    const cx = Number.isFinite(Number(cam?.cx)) ? Number(cam.cx) : canvasW / 2;
    const cy = Number.isFinite(Number(cam?.cy)) ? Number(cam.cy) : canvasH / 2;
    const w = canvasW / zoom;
    const h = canvasH / zoom;
    return {
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
      cx,
      cy,
      zoom,
    };
  }

  function cameraFromFrameRect(rect, canvasW = 1280, canvasH = 720) {
    const w = clamp(Number(rect?.w) || canvasW, canvasW / 4.0, canvasW / 0.5);
    const zoom = clamp(canvasW / w, 0.5, 4.0);
    const h = canvasH / zoom;
    const cx = (Number(rect?.x) || 0) + w / 2;
    const cy = (Number(rect?.y) || 0) + h / 2;
    return { cx, cy, zoom: Math.round(zoom * 100) / 100 };
  }

  function _resolveLayerTargetPose(layer, defaultPose, defaultCamMode, defaultZoom, canvasW, canvasH, options) {
    if (!layer) return defaultPose;
    if (layer.camera?.enabled) {
      const nc = normalizeLayerCamera(layer.camera, canvasW, canvasH, layer.cameraZoom || defaultZoom);
      return {
        cx: nc.cx,
        cy: nc.cy,
        zoom: nc.zoom,
        transitionDur: nc.transitionDur,
        easing: nc.easing,
        isCustom: true,
      };
    }
    const mode = layer.cameraMode || defaultCamMode || 'static';
    if (mode === 'pan-to-next') {
      const auto = computeAutoFrameForLayer(layer, canvasW, canvasH, 1.42);
      const maxZoom = clamp(Number(layer.cameraZoom) || Number(defaultZoom) || 1.8, 1.1, 4.0);
      return {
        cx: auto.cx,
        cy: auto.cy,
        zoom: clamp(auto.zoom, 1.2, maxZoom),
        transitionDur: 0.7,
        easing: 'ease-in-out',
        isCustom: true,
      };
    }
    if (mode === 'follow-hand') {
      const tip = options?.handTip;
      const cx = (tip && Number.isFinite(tip.x)) ? tip.x : ((Number(layer.x) || 0) + (Number(layer.w) || 0) / 2);
      const cy = (tip && Number.isFinite(tip.y)) ? tip.y : ((Number(layer.y) || 0) + (Number(layer.h) || 0) / 2);
      return {
        cx,
        cy,
        zoom: clamp(Number(layer.cameraZoom) || Number(defaultZoom) || 1.8, 1.0, 4.0),
        transitionDur: 0.45,
        easing: 'ease-in-out',
        isCustom: true,
      };
    }
    return { ...defaultPose, transitionDur: 0.7, easing: 'ease-in-out', isCustom: false };
  }

  function _evaluateTimelineKeyframes(kfs, t, scDur, sceneCam, canvasW, canvasH) {
    const base = { cx: canvasW / 2, cy: canvasH / 2, zoom: sceneCam.defaultZoom || 1.0 };
    const first = kfs[0];
    if (t <= first.time) {
      if (first.time <= 0.05) {
        return {
          cx: first.cx,
          cy: first.cy,
          zoom: first.zoom,
          active: Math.abs(first.zoom - 1) > 0.004 || Math.hypot(first.cx - canvasW / 2, first.cy - canvasH / 2) > 1,
        };
      }
      const transDur = Math.min(first.transitionDur || 0.7, first.time);
      const transStart = first.time - transDur;
      if (t <= transStart) {
        return { cx: base.cx, cy: base.cy, zoom: base.zoom, active: Math.abs(base.zoom - 1) > 0.004 };
      }
      const u = ease((t - transStart) / Math.max(0.02, transDur), first.easing || 'ease-in-out');
      const cx = base.cx + (first.cx - base.cx) * u;
      const cy = base.cy + (first.cy - base.cy) * u;
      const zoom = base.zoom + (first.zoom - base.zoom) * u;
      return { cx, cy, zoom, active: Math.abs(zoom - 1) > 0.004 || Math.hypot(cx - canvasW / 2, cy - canvasH / 2) > 1 };
    }

    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i];
      const b = kfs[i + 1];
      if (t <= b.time) {
        const gap = Math.max(0.02, b.time - a.time);
        const transDur = Math.min(b.transitionDur || 0.7, gap);
        const transStart = b.time - transDur;
        if (t <= transStart) {
          return {
            cx: a.cx,
            cy: a.cy,
            zoom: a.zoom,
            active: Math.abs(a.zoom - 1) > 0.004 || Math.hypot(a.cx - canvasW / 2, a.cy - canvasH / 2) > 1,
          };
        }
        const u = ease((t - transStart) / Math.max(0.02, transDur), b.easing || 'ease-in-out');
        const cx = a.cx + (b.cx - a.cx) * u;
        const cy = a.cy + (b.cy - a.cy) * u;
        const zoom = a.zoom + (b.zoom - a.zoom) * u;
        return {
          cx,
          cy,
          zoom,
          active: Math.abs(zoom - 1) > 0.004 || Math.hypot(cx - canvasW / 2, cy - canvasH / 2) > 1,
        };
      }
    }

    const last = kfs[kfs.length - 1];
    if (sceneCam.endResetToFull && scDur - last.time > 0.35 && (Math.abs(last.zoom - 1) > 0.01 || Math.hypot(last.cx - canvasW / 2, last.cy - canvasH / 2) > 2)) {
      const resetDur = Math.min(sceneCam.transitionDur || 0.7, Math.max(0.25, (scDur - last.time) * 0.55));
      const resetStart = Math.max(last.time + 0.05, scDur - resetDur);
      if (t >= resetStart) {
        const u = ease((t - resetStart) / Math.max(0.02, scDur - resetStart), 'ease-in-out');
        const cx = last.cx + (canvasW / 2 - last.cx) * u;
        const cy = last.cy + (canvasH / 2 - last.cy) * u;
        const zoom = last.zoom + (1.0 - last.zoom) * u;
        return { cx, cy, zoom, active: Math.abs(zoom - 1) > 0.004 || Math.hypot(cx - canvasW / 2, cy - canvasH / 2) > 1 };
      }
    }

    return {
      cx: last.cx,
      cy: last.cy,
      zoom: last.zoom,
      active: Math.abs(last.zoom - 1) > 0.004 || Math.hypot(last.cx - canvasW / 2, last.cy - canvasH / 2) > 1,
    };
  }

  function evaluateSceneCameraAtTime(scene, localTime, orderedLayers = null, canvasW = 1280, canvasH = 720, options = {}) {
    const fullView = { cx: canvasW / 2, cy: canvasH / 2, zoom: 1.0, active: false };
    if (!scene) return fullView;

    const scDur = Math.max(0.5, Number(scene.duration) || 5.0);
    const t = clamp(Number(localTime) || 0, 0, scDur);
    const sceneCam = normalizeSceneCamera(scene.camera);

    const kfs = normalizeSceneCameraKeyframes(scene.cameraKeyframes, scDur, canvasW, canvasH);
    if (kfs.length > 0) {
      return _evaluateTimelineKeyframes(kfs, t, scDur, sceneCam, canvasW, canvasH);
    }

    const layers = Array.isArray(orderedLayers) ? orderedLayers : (scene.layers || []).filter(l => l && l.visible !== false);
    const defaultCamMode = options.defaultCameraMode || 'static';
    const defaultZoom = options.defaultCameraZoom || 1.8;
    const basePose = {
      cx: canvasW / 2,
      cy: canvasH / 2,
      zoom: sceneCam.defaultZoom || 1.0,
      transitionDur: sceneCam.transitionDur,
      easing: 'ease-in-out',
    };

    const anyLayerCamera = layers.some(l =>
      l?.camera?.enabled ||
      (l?.cameraMode && l.cameraMode !== 'static')
    );
    if (!anyLayerCamera && Math.abs(basePose.zoom - 1) < 0.005 && defaultCamMode === 'static') {
      return fullView;
    }

    if (!layers.length) {
      return { cx: basePose.cx, cy: basePose.cy, zoom: basePose.zoom, active: Math.abs(basePose.zoom - 1) > 0.005 };
    }

    const allFullSceneSpan = layers.length > 1 && layers.every(l =>
      (l.inPoint ?? 0) <= 0.05 && Math.abs((l.outPoint ?? scDur) - scDur) <= 0.15
    );
    const sliceDur = scDur / layers.length;

    const timeline = layers.map((layer, idx) => {
      const start = allFullSceneSpan ? idx * sliceDur : clamp(Number(layer.inPoint ?? 0), 0, scDur);
      const end = allFullSceneSpan ? (idx + 1) * sliceDur : clamp(Number(layer.outPoint ?? scDur), start + 0.05, scDur);
      const pose = _resolveLayerTargetPose(layer, basePose, defaultCamMode, defaultZoom, canvasW, canvasH, options);
      return { layer, start, end, pose };
    });

    // Find active or most recent layer segment at time `t`
    let activeIdx = timeline.findIndex(item => t >= item.start && t <= item.end);
    if (activeIdx === -1) {
      if (t < timeline[0].start) {
        return { cx: basePose.cx, cy: basePose.cy, zoom: basePose.zoom, active: true };
      }
      let prevIdx = -1;
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (timeline[i].start <= t) {
          prevIdx = i;
          break;
        }
      }
      activeIdx = Math.max(0, prevIdx);
    }

    const cur = timeline[activeIdx];
    const prevPose = activeIdx > 0 ? timeline[activeIdx - 1].pose : basePose;
    const isLast = activeIdx === timeline.length - 1;

    // Optional end-of-scene VideoScribe zoom-out back to full canvas
    if (sceneCam.endResetToFull && isLast) {
      const resetDur = Math.min(sceneCam.transitionDur, Math.max(0.35, (cur.end - cur.start) * 0.25), scDur * 0.3);
      const resetStart = Math.max(cur.start + 0.15, scDur - resetDur);
      if (t >= resetStart) {
        const u = ease((t - resetStart) / Math.max(0.05, scDur - resetStart), 'ease-in-out');
        return {
          cx: cur.pose.cx + (canvasW / 2 - cur.pose.cx) * u,
          cy: cur.pose.cy + (canvasH / 2 - cur.pose.cy) * u,
          zoom: cur.pose.zoom + (1.0 - cur.pose.zoom) * u,
          active: true,
        };
      }
    }

    const segSpan = Math.max(0.08, cur.end - cur.start);
    const transDur = Math.min(cur.pose.transitionDur || 0.7, segSpan * 0.55);
    const elapsed = Math.max(0, t - cur.start);
    const rawU = transDur > 0 ? clamp(elapsed / transDur, 0, 1) : 1;
    const u = ease(rawU, cur.pose.easing || 'ease-in-out');

    const cx = prevPose.cx + (cur.pose.cx - prevPose.cx) * u;
    const cy = prevPose.cy + (cur.pose.cy - prevPose.cy) * u;
    const zoom = prevPose.zoom + (cur.pose.zoom - prevPose.zoom) * u;

    return {
      cx,
      cy,
      zoom,
      active: Math.abs(zoom - 1) > 0.004 || Math.hypot(cx - canvasW / 2, cy - canvasH / 2) > 1,
    };
  }

  function computeMagneticSnap(movingRect, siblingRects = [], canvasW = 1280, canvasH = 720, threshold = 8) {
    const r = {
      x: Number(movingRect?.x) || 0,
      y: Number(movingRect?.y) || 0,
      w: Math.max(1, Number(movingRect?.w) || 1),
      h: Math.max(1, Number(movingRect?.h) || 1),
    };
    const mCenterX = r.x + r.w / 2;
    const mRight = r.x + r.w;
    const mCenterY = r.y + r.h / 2;
    const mBottom = r.y + r.h;

    const xTargets = [
      { pos: canvasW / 2, kind: 'canvas-center', start: 0, end: canvasH },
      { pos: 0, kind: 'canvas-edge', start: 0, end: canvasH },
      { pos: canvasW, kind: 'canvas-edge', start: 0, end: canvasH },
    ];
    const yTargets = [
      { pos: canvasH / 2, kind: 'canvas-center', start: 0, end: canvasW },
      { pos: 0, kind: 'canvas-edge', start: 0, end: canvasW },
      { pos: canvasH, kind: 'canvas-edge', start: 0, end: canvasW },
    ];

    for (const s of siblingRects) {
      if (!s) continue;
      const sx = Number(s.x) || 0;
      const sy = Number(s.y) || 0;
      const sw = Math.max(1, Number(s.w) || 1);
      const sh = Math.max(1, Number(s.h) || 1);
      const minY = Math.min(r.y, sy) - 16;
      const maxY = Math.max(mBottom, sy + sh) + 16;
      const minX = Math.min(r.x, sx) - 16;
      const maxX = Math.max(mRight, sx + sw) + 16;
      xTargets.push(
        { pos: sx, kind: 'layer-edge', start: minY, end: maxY },
        { pos: sx + sw / 2, kind: 'layer-center', start: minY, end: maxY },
        { pos: sx + sw, kind: 'layer-edge', start: minY, end: maxY }
      );
      yTargets.push(
        { pos: sy, kind: 'layer-edge', start: minX, end: maxX },
        { pos: sy + sh / 2, kind: 'layer-center', start: minX, end: maxX },
        { pos: sy + sh, kind: 'layer-edge', start: minX, end: maxX }
      );
    }

    let bestX = null;
    const mXEdges = [
      { edge: 'left', val: r.x, offset: 0 },
      { edge: 'center', val: mCenterX, offset: r.w / 2 },
      { edge: 'right', val: mRight, offset: r.w },
    ];
    for (const edge of mXEdges) {
      for (const tgt of xTargets) {
        const diff = Math.abs(edge.val - tgt.pos);
        if (diff <= threshold && (!bestX || diff < bestX.diff)) {
          bestX = { diff, snappedPos: tgt.pos - edge.offset, guide: { axis: 'x', ...tgt } };
        }
      }
    }

    let bestY = null;
    const mYEdges = [
      { edge: 'top', val: r.y, offset: 0 },
      { edge: 'center', val: mCenterY, offset: r.h / 2 },
      { edge: 'bottom', val: mBottom, offset: r.h },
    ];
    for (const edge of mYEdges) {
      for (const tgt of yTargets) {
        const diff = Math.abs(edge.val - tgt.pos);
        if (diff <= threshold && (!bestY || diff < bestY.diff)) {
          bestY = { diff, snappedPos: tgt.pos - edge.offset, guide: { axis: 'y', ...tgt } };
        }
      }
    }

    const guides = [];
    if (bestX) guides.push(bestX.guide);
    if (bestY) guides.push(bestY.guide);

    return {
      x: bestX ? bestX.snappedPos : r.x,
      y: bestY ? bestY.snappedPos : r.y,
      snappedX: !!bestX,
      snappedY: !!bestY,
      guides,
    };
  }

  const api = {
    clamp,
    ease,
    CAMERA_PRESETS,
    normalizeLayerCamera,
    normalizeSceneCamera,
    normalizeSceneCameraKeyframes,
    buildCameraShotsFromPreset,
    computeAutoFrameForLayer,
    getCameraFrameRect,
    cameraFromFrameRect,
    evaluateSceneCameraAtTime,
    computeMagneticSnap,
  };

  root.CameraCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
