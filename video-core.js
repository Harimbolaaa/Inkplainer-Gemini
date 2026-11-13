/* Offline video import, timeline cut/trim, audio mix, and local IndexedDB media store for Inkplainer. */
(function (root) {
  'use strict';

  const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|mkv|ogv|ogg|avi)$/i;

  function clamp(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function isVideoFile(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    if (type.startsWith('video/')) return true;
    const name = String(file.name || '');
    return VIDEO_EXT_RE.test(name);
  }

  function computeVideoPlacement(videoW, videoH, canvasW, canvasH, preset = 'stage') {
    const vw = Math.max(16, Number(videoW) || canvasW || 1280);
    const vh = Math.max(16, Number(videoH) || canvasH || 720);
    const cw = Math.max(64, Number(canvasW) || 1280);
    const ch = Math.max(64, Number(canvasH) || 720);
    const aspect = vw / vh;

    const fitInside = (maxW, maxH) => {
      let w = maxW;
      let h = w / aspect;
      if (h > maxH) {
        h = maxH;
        w = h * aspect;
      }
      return { w: Math.max(40, Math.round(w)), h: Math.max(40, Math.round(h)) };
    };

    if (preset === 'full' || preset === 'fit') {
      const { w, h } = fitInside(cw, ch);
      return { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2), w, h };
    }
    if (preset === 'left') {
      const pad = Math.round(Math.min(cw, ch) * 0.035);
      const { w, h } = fitInside(cw * 0.48 - pad, ch - pad * 2);
      return { x: pad, y: Math.round((ch - h) / 2), w, h };
    }
    if (preset === 'right') {
      const pad = Math.round(Math.min(cw, ch) * 0.035);
      const { w, h } = fitInside(cw * 0.48 - pad, ch - pad * 2);
      return { x: Math.round(cw - w - pad), y: Math.round((ch - h) / 2), w, h };
    }
    if (preset === 'pip') {
      const pad = Math.round(Math.min(cw, ch) * 0.04);
      const { w, h } = fitInside(cw * 0.30, ch * 0.30);
      return { x: Math.round(cw - w - pad), y: Math.round(ch - h - pad), w, h };
    }
    // Default 'stage': 74% centered so SVGs/annotations easily fit around the video
    const { w, h } = fitInside(cw * 0.74, ch * 0.74);
    return { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2), w, h };
  }

  function normalizeVideoTiming(layer, sceneDuration) {
    if (!layer) return layer;
    const hasSceneDur = Number.isFinite(Number(sceneDuration)) && Number(sceneDuration) > 0;
    const scDur = hasSceneDur ? Math.max(0.5, Number(sceneDuration)) : Math.max(0.5, Number(layer.outPoint) || Number(layer.sourceDuration) || 5);
    const srcDur = Math.max(0.2, Number(layer.sourceDuration) || (Number(layer.outPoint) - Number(layer.inPoint)) || scDur);
    if (layer.kind === 'video') {
      layer.sourceDuration = Number(srcDur.toFixed(3));
      layer.sourceIn = clamp(layer.sourceIn ?? 0, 0, Math.max(0, srcDur - 0.1));
      const clipIn = Number.isFinite(layer.inPoint) ? Math.max(0, layer.inPoint) : 0;
      const maxSpan = Math.max(0.1, srcDur - layer.sourceIn);
      const rawOut = Number.isFinite(layer.outPoint) && layer.outPoint > clipIn
        ? layer.outPoint
        : Math.min(scDur, clipIn + maxSpan);
      const maxOut = hasSceneDur ? Math.min(scDur, clipIn + maxSpan) : (clipIn + maxSpan);
      const clampedOut = Math.min(rawOut, maxOut);
      layer.inPoint = Number(clipIn.toFixed(3));
      layer.outPoint = Number(Math.max(layer.inPoint + 0.1, clampedOut).toFixed(3));
      layer.sourceOut = Number(clamp(layer.sourceIn + (layer.outPoint - layer.inPoint), layer.sourceIn + 0.1, srcDur).toFixed(3));
      if (typeof layer.volume !== 'number' || !Number.isFinite(layer.volume)) layer.volume = 1;
      layer.volume = clamp(layer.volume, 0, 1);
      layer.muted = Boolean(layer.muted);
    }
    return layer;
  }

  function splitVideoLayerSegment(layer, cutLocalTime, options = {}) {
    if (!layer) return null;
    const minSlice = Number(options.minSlice) > 0 ? Number(options.minSlice) : 0.1;
    const inPt = Number(layer.inPoint) || 0;
    const outPt = Number(layer.outPoint) || 0;
    if (!Number.isFinite(cutLocalTime) || cutLocalTime <= inPt + minSlice || cutLocalTime >= outPt - minSlice) {
      return null;
    }
    const cutT = Number(cutLocalTime.toFixed(3));
    const srcDur = Math.max(0.2, Number(layer.sourceDuration) || (outPt - inPt));
    const origSrcIn = clamp(layer.sourceIn ?? 0, 0, Math.max(0, srcDur - minSlice));
    const origSrcOut = clamp(layer.sourceOut ?? (origSrcIn + (outPt - inPt)), origSrcIn + minSlice, srcDur);
    const offsetInClip = cutT - inPt;
    const splitSrcT = Number(clamp(origSrcIn + offsetInClip, origSrcIn + minSlice, origSrcOut - minSlice).toFixed(3));

    const kfs = Array.isArray(layer.keyframes) ? layer.keyframes : [];
    const leftKeyframes = kfs.filter(k => (Number(k.time) || 0) <= cutT).map(k => ({ ...k }));
    const rightKeyframes = kfs.filter(k => (Number(k.time) || 0) >= cutT).map(k => ({ ...k }));

    return {
      cutTime: cutT,
      leftPatch: {
        outPoint: cutT,
        sourceIn: origSrcIn,
        sourceOut: layer.kind === 'video' ? splitSrcT : undefined,
        keyframes: leftKeyframes,
      },
      rightSegmentProps: {
        inPoint: cutT,
        outPoint: Number(outPt.toFixed(3)),
        sourceIn: layer.kind === 'video' ? splitSrcT : undefined,
        sourceOut: layer.kind === 'video' ? origSrcOut : undefined,
        sourceDuration: layer.kind === 'video' ? srcDur : undefined,
        keyframes: rightKeyframes,
      },
    };
  }

  function trimVideoLayerEdge(layer, edge, targetLocalTime, sceneDuration) {
    if (!layer) return null;
    const minLen = 0.15;
    const scDur = Math.max(0.5, Number(sceneDuration) || 5);
    const origIn = Number(layer.inPoint) || 0;
    const origOut = Number(layer.outPoint) || scDur;

    if (layer.kind !== 'video') {
      if (edge === 'left') {
        const nextIn = Number(clamp(targetLocalTime, 0, origOut - minLen).toFixed(2));
        return { inPoint: nextIn, outPoint: origOut };
      }
      const nextOut = Number(clamp(targetLocalTime, origIn + minLen, scDur).toFixed(2));
      return { inPoint: origIn, outPoint: nextOut };
    }

    const srcDur = Math.max(minLen, Number(layer.sourceDuration) || (origOut - origIn));
    const origSrcIn = clamp(layer.sourceIn ?? 0, 0, Math.max(0, srcDur - minLen));
    const origSrcOut = clamp(layer.sourceOut ?? (origSrcIn + (origOut - origIn)), origSrcIn + minLen, srcDur);

    if (edge === 'left') {
      const minInBySource = Math.max(0, origIn - origSrcIn);
      const maxIn = origOut - minLen;
      const nextIn = Number(clamp(targetLocalTime, minInBySource, maxIn).toFixed(2));
      const delta = nextIn - origIn;
      const nextSrcIn = Number(clamp(origSrcIn + delta, 0, origSrcOut - minLen).toFixed(3));
      return {
        inPoint: nextIn,
        outPoint: origOut,
        sourceIn: nextSrcIn,
        sourceOut: origSrcOut,
      };
    } else {
      const maxOutBySource = Math.min(scDur, origIn + (srcDur - origSrcIn));
      const minOut = origIn + minLen;
      const nextOut = Number(clamp(targetLocalTime, minOut, maxOutBySource).toFixed(2));
      const nextSrcOut = Number(clamp(origSrcIn + (nextOut - origIn), origSrcIn + minLen, srcDur).toFixed(3));
      return {
        inPoint: origIn,
        outPoint: nextOut,
        sourceIn: origSrcIn,
        sourceOut: nextSrcOut,
      };
    }
  }

  function shiftVideoClipOnSceneSplit(layer, splitLocalTime, secondSceneDuration) {
    const firstDur = Math.max(0.25, Number(splitLocalTime) || 0);
    const secondDur = Math.max(0.25, Number(secondSceneDuration) || 0.5);
    const origIn = Number(layer.inPoint) || 0;
    const origOut = Number(layer.outPoint) || (firstDur + secondDur);
    const newIn = Math.max(0, Number((origIn - firstDur).toFixed(3)));
    const newOut = Math.min(secondDur, Number((origOut - firstDur).toFixed(3)));
    if (layer.kind !== 'video') {
      return { inPoint: newIn, outPoint: Math.max(newIn + 0.1, newOut) };
    }
    const srcDur = Math.max(0.2, Number(layer.sourceDuration) || (origOut - origIn));
    const origSrcIn = clamp(layer.sourceIn ?? 0, 0, srcDur);
    const passedBeforeSplit = Math.max(0, firstDur - origIn);
    const secondSrcIn = Number(clamp(origSrcIn + passedBeforeSplit, 0, Math.max(0, srcDur - 0.1)).toFixed(3));
    const maxAvail = Math.max(0.1, srcDur - secondSrcIn);
    const clampedOut = Math.min(Math.max(newIn + 0.1, newOut), newIn + maxAvail);
    const secondSrcOut = Number(clamp(secondSrcIn + (clampedOut - newIn), secondSrcIn + 0.1, srcDur).toFixed(3));
    return {
      inPoint: newIn,
      outPoint: Number(clampedOut.toFixed(3)),
      sourceIn: secondSrcIn,
      sourceOut: secondSrcOut,
      sourceDuration: srcDur,
    };
  }

  function reorderArrayMove(items, fromIndex, insertIndex) {
    if (!Array.isArray(items) || items.length < 2) {
      return { list: Array.isArray(items) ? items.slice() : [], movedToIndex: fromIndex };
    }
    if (fromIndex < 0 || fromIndex >= items.length) {
      return { list: items.slice(), movedToIndex: fromIndex };
    }
    const clampedGap = clamp(insertIndex, 0, items.length);
    let dest = clampedGap > fromIndex ? clampedGap - 1 : clampedGap;
    dest = clamp(dest, 0, items.length - 1);
    const list = items.slice();
    const [moved] = list.splice(fromIndex, 1);
    list.splice(dest, 0, moved);
    return { list, movedToIndex: dest };
  }

  function getVideoSourceTime(layer, localTime) {
    const inPt = Number(layer?.inPoint) || 0;
    const srcIn = Number(layer?.sourceIn) || 0;
    const srcDur = Math.max(0.1, Number(layer?.sourceDuration) || 9999);
    const raw = srcIn + Math.max(0, (Number(localTime) || 0) - inPt);
    return clamp(raw, 0, Math.max(0, srcDur - 0.02));
  }

  function collectProjectAudioMixInputs(scenes, audioTrack) {
    const inputs = [];
    if (audioTrack?.dataUrl) {
      inputs.push({
        type: 'track',
        dataUrl: audioTrack.dataUrl,
        startTime: 0,
        sourceOffset: 0,
        duration: Number(audioTrack.duration) || null,
        volume: clamp(audioTrack.volume ?? 0.85, 0, 1),
        muted: false,
      });
    }
    let scStart = 0;
    (scenes || []).forEach(sc => {
      const scDur = Math.max(0.5, Number(sc?.duration) || 5);
      (sc?.layers || []).forEach(layer => {
        if (!layer || layer.kind !== 'video' || layer.visible === false || !layer.videoAssetId) return;
        const vol = layer.muted ? 0 : clamp(layer.volume ?? 1, 0, 1);
        if (vol <= 0.001) return;
        const inPt = clamp(layer.inPoint ?? 0, 0, scDur);
        const outPt = clamp(layer.outPoint ?? scDur, inPt, scDur);
        const clipDur = outPt - inPt;
        if (clipDur <= 0.02) return;
        inputs.push({
          type: 'video',
          assetId: layer.videoAssetId,
          startTime: scStart + inPt,
          sourceOffset: Math.max(0, Number(layer.sourceIn) || 0),
          duration: clipDur,
          volume: vol,
          muted: false,
        });
      });
      scStart += scDur;
    });
    return inputs;
  }

  // ── Browser Runtime Store, Video Elements, IndexedDB Media Store & Offline Audio Mixer ──
  const assets = new Map();
  let _dbGetter = null;

  function setDBGetter(fn) {
    _dbGetter = typeof fn === 'function' ? fn : null;
  }

  function generateAssetId() {
    if (root.crypto?.randomUUID) return `vid-${root.crypto.randomUUID()}`;
    return `vid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function saveBlobToIndexedDB(id, blob, meta = {}) {
    const db = _dbGetter ? _dbGetter() : null;
    if (!db || !db.objectStoreNames?.contains('media') || !blob) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(['media'], 'readwrite');
        tx.objectStore('media').put({
          id,
          blob,
          name: meta.name || 'video',
          mime: meta.mime || blob.type || 'video/mp4',
          duration: Number(meta.duration) || 0,
          width: Number(meta.width) || 0,
          height: Number(meta.height) || 0,
          updatedAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  async function loadBlobFromIndexedDB(id) {
    const db = _dbGetter ? _dbGetter() : null;
    if (!db || !db.objectStoreNames?.contains('media') || !id) return null;
    return await new Promise((resolve) => {
      try {
        const tx = db.transaction(['media'], 'readonly');
        const req = tx.objectStore('media').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function registerVideoBlob(blob, meta = {}, forcedId = null) {
    if (!blob) throw new Error('Missing video blob');
    const id = forcedId || generateAssetId();
    const existing = assets.get(id);
    if (existing?.blob === blob && existing.objectUrl) {
      return existing;
    }
    if (existing?.objectUrl) {
      try { URL.revokeObjectURL(existing.objectUrl); } catch (_) {}
    }
    const objectUrl = URL.createObjectURL(blob);
    const entry = {
      id,
      blob,
      objectUrl,
      name: meta.name || existing?.name || 'Video',
      mime: meta.mime || blob.type || 'video/mp4',
      duration: Number(meta.duration) || existing?.duration || 0,
      width: Number(meta.width) || existing?.width || 0,
      height: Number(meta.height) || existing?.height || 0,
      audioBuffer: undefined,
      audioBufferPromise: null,
    };
    assets.set(id, entry);
    await saveBlobToIndexedDB(id, blob, entry);
    return entry;
  }

  async function ensureAsset(assetId) {
    if (!assetId) return null;
    const hit = assets.get(assetId);
    if (hit && hit.objectUrl) return hit;
    const rec = await loadBlobFromIndexedDB(assetId);
    if (rec?.blob) {
      return await registerVideoBlob(rec.blob, rec, assetId);
    }
    return null;
  }

  async function createHydratedVideoElement(objectUrl, targetTime = 0) {
    if (typeof document === 'undefined' || !objectUrl) return null;
    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = true;
    video.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onErr);
        if (err) reject(err);
        else resolve();
      };
      const onReady = () => finish();
      const onErr = () => finish(new Error('Could not decode imported video'));
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('canplay', onReady);
      video.addEventListener('error', onErr);
      video.src = objectUrl;
      video.load();
    });

    const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
    const seekT = clamp(targetTime, 0, Math.max(0, dur - 0.05));
    if (seekT > 0.01 && Math.abs(video.currentTime - seekT) > 0.02) {
      await seekVideoElement(video, seekT);
    }
    return video;
  }

  async function capturePosterImage(videoEl, maxDim = 480) {
    if (typeof document === 'undefined' || !videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
      return null;
    }
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    const cw = Math.max(16, Math.round(vw * scale));
    const ch = Math.max(16, Math.round(vh * scale));
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const cctx = c.getContext('2d');
    cctx.drawImage(videoEl, 0, 0, cw, ch);
    const dataUrl = c.toDataURL('image/png');
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  function seekVideoElement(videoEl, targetTime, timeoutMs = 400, setTimer = setTimeout, clearTimer = clearTimeout) {
    if (!videoEl || videoEl.readyState < 1) return Promise.resolve(false);
    const dur = Number.isFinite(videoEl.duration) && videoEl.duration > 0 ? videoEl.duration : 9999;
    const clamped = clamp(targetTime, 0, Math.max(0, dur - 0.02));
    if (Math.abs((videoEl.currentTime || 0) - clamped) <= 0.012 && videoEl.readyState >= 2) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      let done = false;
      let timerId = null;
      const finish = (ok) => {
        if (done) return;
        done = true;
        videoEl.removeEventListener('seeked', onSeeked);
        if (timerId !== null) clearTimer(timerId);
        resolve(ok);
      };
      const onSeeked = () => finish(true);
      videoEl.addEventListener('seeked', onSeeked);
      timerId = setTimer(() => finish(false), timeoutMs);
      try {
        videoEl.currentTime = clamped;
      } catch (_) {
        finish(false);
      }
    });
  }

  async function hydrateVideoLayer(layer, targetLocalTime = 0) {
    if (!layer || layer.kind !== 'video' || !layer.videoAssetId) return null;
    const entry = await ensureAsset(layer.videoAssetId);
    if (!entry) return null;
    const initSrcT = getVideoSourceTime(layer, Math.max(layer.inPoint || 0, targetLocalTime));
    if (!layer.videoEl || !layer.videoEl.src) {
      layer.videoEl = await createHydratedVideoElement(entry.objectUrl, initSrcT);
    }
    if (layer.videoEl && (!layer.sourceDuration || layer.sourceDuration <= 0)) {
      layer.sourceDuration = Number(layer.videoEl.duration) || entry.duration || 5;
    }
    if ((!layer.img || !layer.img.width) && layer.videoEl) {
      const poster = await capturePosterImage(layer.videoEl);
      if (poster) layer.img = poster;
    }
    normalizeVideoTiming(layer);
    return layer.videoEl;
  }

  function getAllProjectVideoLayers(scenes) {
    const out = [];
    (scenes || []).forEach(sc => {
      (sc?.layers || []).forEach(l => {
        if (l && l.kind === 'video' && l.videoEl) out.push({ scene: sc, layer: l });
      });
    });
    return out;
  }

  function pauseAllVideos(stateObj) {
    getAllProjectVideoLayers(stateObj?.scenes).forEach(({ layer }) => {
      const v = layer.videoEl;
      if (!v) return;
      try {
        v.muted = true;
        if (!v.paused) v.pause();
      } catch (_) {}
    });
  }

  function syncVideosForPlayback(stateObj, activeScene, localTime, options = {}) {
    const recording = Boolean(options.recording);
    const activeIds = new Set();
    if (activeScene) {
      (activeScene.layers || []).forEach(layer => {
        if (!layer || layer.kind !== 'video' || layer.visible === false || !layer.videoEl) return;
        const inPt = Number(layer.inPoint) || 0;
        const outPt = Number(layer.outPoint) || activeScene.duration || 5;
        if (localTime < inPt - 0.02 || localTime > outPt + 0.02) return;
        activeIds.add(layer);
        const v = layer.videoEl;
        const vol = (layer.muted || (layer.volume ?? 1) <= 0.001) ? 0 : clamp(layer.volume ?? 1, 0, 1);
        v.volume = vol;
        v.muted = recording || vol === 0;
        const targetSrc = getVideoSourceTime(layer, localTime);
        if (Math.abs((v.currentTime || 0) - targetSrc) > 0.22) {
          try { v.currentTime = targetSrc; } catch (_) {}
        }
        if (!recording && v.paused) {
          v.play().catch(() => {
            try {
              v.muted = true;
              v.play().catch(() => {});
            } catch (_) {}
          });
        }
      });
    }
    getAllProjectVideoLayers(stateObj?.scenes).forEach(({ layer }) => {
      if (activeIds.has(layer)) return;
      const v = layer.videoEl;
      try {
        v.muted = true;
        if (!v.paused) v.pause();
      } catch (_) {}
    });
  }

  async function seekVideosForRender(stateObj, sceneTargets, options = {}) {
    const exactSeek = Boolean(options.exactSeek);
    const setTimer = options.realSetTimeout || setTimeout;
    const clearTimer = options.realClearTimeout || clearTimeout;
    const onAsyncSeekLanded = options.onAsyncSeekLanded;

    const targetMap = new Map();
    (sceneTargets || []).forEach(({ scene, localTime }) => {
      if (!scene) return;
      (scene.layers || []).forEach(layer => {
        if (!layer || layer.kind !== 'video' || layer.visible === false || !layer.videoEl) return;
        const inPt = Number(layer.inPoint) || 0;
        const outPt = Number(layer.outPoint) || scene.duration || 5;
        if (localTime < inPt - 0.04 || localTime > outPt + 0.04) return;
        targetMap.set(layer, getVideoSourceTime(layer, localTime));
      });
    });

    const seekPromises = [];
    getAllProjectVideoLayers(stateObj?.scenes).forEach(({ layer }) => {
      const v = layer.videoEl;
      try {
        v.muted = true;
        if (!v.paused) v.pause();
      } catch (_) {}
      if (!targetMap.has(layer)) return;
      const targetSrc = targetMap.get(layer);
      if (exactSeek) {
        seekPromises.push(seekVideoElement(v, targetSrc, 360, setTimer, clearTimer));
      } else if (Math.abs((v.currentTime || 0) - targetSrc) > 0.015) {
        if (typeof onAsyncSeekLanded === 'function') {
          const onSeeked = () => {
            v.removeEventListener('seeked', onSeeked);
            onAsyncSeekLanded();
          };
          v.addEventListener('seeked', onSeeked, { once: true });
        }
        try { v.currentTime = targetSrc; } catch (_) {}
      }
    });

    if (exactSeek && seekPromises.length) {
      await Promise.all(seekPromises);
    }
  }

  async function decodeVideoAudioBuffer(assetId, actx) {
    const entry = await ensureAsset(assetId);
    if (!entry) return null;
    if (entry.audioBuffer !== undefined) return entry.audioBuffer;
    if (entry.audioBufferPromise) return entry.audioBufferPromise;

    entry.audioBufferPromise = (async () => {
      try {
        const arrBuf = await entry.blob.arrayBuffer();
        const decoded = await actx.decodeAudioData(arrBuf.slice(0));
        entry.audioBuffer = decoded || null;
        return entry.audioBuffer;
      } catch (_) {
        entry.audioBuffer = null;
        return null;
      } finally {
        entry.audioBufferPromise = null;
      }
    })();
    return entry.audioBufferPromise;
  }

  async function renderMixedProjectAudioBuffer(scenes, audioTrack, totalProjectDuration) {
    const inputs = collectProjectAudioMixInputs(scenes, audioTrack);
    if (!inputs.length) return null;

    const AudioCtx = root.AudioContext || root.webkitAudioContext;
    if (!AudioCtx) return null;
    const actx = new AudioCtx();
    const resolved = [];
    try {
      for (const item of inputs) {
        let buffer = null;
        if (item.type === 'track' && item.dataUrl) {
          try {
            const resp = await fetch(item.dataUrl);
            const arr = await resp.arrayBuffer();
            buffer = await actx.decodeAudioData(arr);
          } catch (_) {
            buffer = null;
          }
        } else if (item.type === 'video' && item.assetId) {
          buffer = await decodeVideoAudioBuffer(item.assetId, actx);
        }
        if (buffer && buffer.duration > 0.01) {
          resolved.push({ ...item, buffer });
        }
      }
    } finally {
      await actx.close().catch(() => {});
    }

    if (!resolved.length) return null;

    const maxEnd = Math.max(
      Number(totalProjectDuration) || 0,
      ...resolved.map(r => r.startTime + Math.min(r.duration ?? r.buffer.duration, Math.max(0, r.buffer.duration - r.sourceOffset)))
    );
    const targetRate = 48000;
    const targetCh = 2;
    const totalSamples = Math.max(1, Math.ceil(Math.max(0.1, maxEnd) * targetRate));
    const offline = new OfflineAudioContext(targetCh, totalSamples, targetRate);

    for (const r of resolved) {
      const avail = Math.max(0, r.buffer.duration - r.sourceOffset);
      const dur = Math.min(r.duration ?? avail, avail);
      if (dur <= 0.01) continue;
      const src = offline.createBufferSource();
      src.buffer = r.buffer;
      const gain = offline.createGain();
      gain.gain.value = r.volume;
      src.connect(gain);
      gain.connect(offline.destination);
      src.start(Math.max(0, r.startTime), Math.max(0, r.sourceOffset), dur);
    }

    return await offline.startRendering();
  }

  function getLayerDrawable(layer) {
    if (!layer) return null;
    if (layer.kind === 'video' && layer.videoEl && layer.videoEl.readyState >= 2) {
      return layer.videoEl;
    }
    return layer.img || null;
  }

  const VideoCore = {
    isVideoFile,
    computeVideoPlacement,
    normalizeVideoTiming,
    splitVideoLayerSegment,
    trimVideoLayerEdge,
    shiftVideoClipOnSceneSplit,
    reorderArrayMove,
    getVideoSourceTime,
    collectProjectAudioMixInputs,
    setDBGetter,
    registerVideoBlob,
    ensureAsset,
    createHydratedVideoElement,
    capturePosterImage,
    seekVideoElement,
    hydrateVideoLayer,
    pauseAllVideos,
    syncVideosForPlayback,
    seekVideosForRender,
    renderMixedProjectAudioBuffer,
    getLayerDrawable,
    _assets: assets,
  };

  root.VideoCore = VideoCore;
})(typeof window !== 'undefined' ? window : globalThis);
