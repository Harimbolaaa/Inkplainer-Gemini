const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('./browser-utils.cjs');

test('video import, razor cut, scene drag-and-drop, delete, volume, SVG overlay, and WebM export E2E', { timeout: 120000 }, async (t) => {
  const b = await browser();
  t.after(() => b.close());
  const pageErrors = [];
  b.on('Runtime.exceptionThrown', e => {
    pageErrors.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text);
  });

  await b.call('Page.enable');
  await b.call('Runtime.enable');
  await b.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('wb_onboarding_done_v1', '1');`,
  });

  await b.call('Page.navigate', { url: process.env.SITE_URL || 'http://127.0.0.1:3000/' });
  await b.waitFor(`window.TimelineStudio && window.VideoCore && window.StudioUI && state.scenes.length >= 1 && currentProjectId`, 20000);

  // 1. Switch to Video tab and verify destination toggle + import into Active Scene
  await t.test('import synthetic WebM video into Active Scene and add SVG beside it', async () => {
    const res = await b.evaluate(`(async () => {
      switchTab('video');
      setVideoImportTarget('active');

      // Generate a 1.6s synthetic animated WebM with a sine audio tone
      const cvs = document.createElement('canvas');
      cvs.width = 320; cvs.height = 180;
      const cctx = cvs.getContext('2d');
      const vStream = cvs.captureStream(20);

      let audioCtx;
      try {
        audioCtx = new AudioContext();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.08;
        osc.frequency.value = 440;
        const dest = audioCtx.createMediaStreamDestination();
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        dest.stream.getAudioTracks().forEach(tr => vStream.addTrack(tr));
      } catch (_) {}

      const mime = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
      const chunks = [];
      const mr = new MediaRecorder(vStream, { mimeType: mime, videoBitsPerSecond: 600000 });
      mr.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

      const blob = await new Promise((resolve) => {
        mr.onstop = () => resolve(new Blob(chunks, { type: mime }));
        mr.start(50);
        let f = 0;
        const timer = setInterval(() => {
          cctx.fillStyle = f % 2 === 0 ? '#0ea5e9' : '#14b8a6';
          cctx.fillRect(0, 0, 320, 180);
          cctx.fillStyle = '#ffffff';
          cctx.font = 'bold 28px sans-serif';
          cctx.fillText('F' + f, 120, 100);
          f++;
          if (f >= 32) {
            clearInterval(timer);
            setTimeout(() => mr.stop(), 60);
          }
        }, 45);
      });
      if (audioCtx) { try { await audioCtx.close(); } catch (_) {} }
      vStream.getTracks().forEach(tr => tr.stop());

      const file = new File([blob], 'demo-clip.webm', { type: 'video/webm' });
      window.__testVideoFile = file;
      await importVideoFiles([file]);

      const sc = TimelineStudio.getActiveScene();
      const vLayer = sc.layers.find(l => l.kind === 'video');
      applyVideoLayoutPreset('left');
      await StudioUI.insertAsset('rocket');
      const svgLayer = getSelectedLayer();
      svgLayer.x = Math.round(state.canvasW * 0.56);
      svgLayer.y = Math.round(state.canvasH * 0.22);
      svgLayer.w = 240;
      svgLayer.h = 240;
      redrawLayersOnCanvas();

      selectLayer(vLayer.id);
      return {
        sceneCount: state.scenes.length,
        vKind: vLayer?.kind,
        vWidth: vLayer?.w,
        vLeftX: vLayer?.x,
        canvasW: state.canvasW,
        svgCount: sc.layers.filter(l => l.id !== vLayer.id).length,
        inspectorVisible: document.getElementById('video-inspector-card')?.style.display,
        clipBadge: document.querySelector('.tl-layer-clip.kind-video .tl-clip-vol-tag')?.textContent,
      };
    })()`);

    assert.equal(res.sceneCount, 1);
    assert.equal(res.vKind, 'video');
    assert.ok(res.vWidth < res.canvasW * 0.52, 'left layout preset keeps video in left half for SVGs');
    assert.equal(res.svgCount, 1);
    assert.equal(res.inspectorVisible, 'flex');
    assert.equal(res.clipBadge, '100%');
  });

  // 2. Import second video into a New Scene and verify razor cutting
  await t.test('import second video into New Scene and razor cut clip & scene', async () => {
    const res = await b.evaluate(`(async () => {
      setVideoImportTarget('new');
      await importVideoFiles([window.__testVideoFile]);
      const scCountAfterImport = state.scenes.length;
      const activeSc = TimelineStudio.getActiveScene();
      // Ensure duration >= 2.0s so cut is clearly inside bounds
      if (activeSc.duration < 2.0) {
        activeSc.duration = 2.5;
        activeSc.layers.forEach(l => {
          l.sourceDuration = Math.max(l.sourceDuration || 2.5, 2.5);
          l.outPoint = 2.5;
          l.sourceOut = 2.5;
        });
      }
      TimelineStudio.renderTimeline();

      // Enable Razor tool ('C' shortcut simulation via UI click)
      document.getElementById('tl-btn-razor').click();
      const razorActive = document.getElementById('timeline-panel').classList.contains('tl-razor-active');

      // Cut the video clip inside scene 2
      const vLayer = activeSc.layers.find(l => l.kind === 'video');
      const scStart = TimelineStudio.getSceneStartOffset(activeSc.id);
      const cutOk = TimelineStudio.cutLayerClipAtTime(activeSc.id, vLayer.id, scStart + 1.0);
      const segments = activeSc.layers.filter(l => l.kind === 'video');

      // Also test cutting scene 1 in half via cutSceneAtGlobalTime
      const sc1 = state.scenes[0];
      sc1.duration = 4.0;
      const sceneSplitOk = TimelineStudio.cutSceneAtGlobalTime(sc1.id, 2.0);
      TimelineStudio.setTimelineTool('select');

      return {
        scCountAfterImport,
        razorActive,
        cutOk,
        segmentCount: segments.length,
        seg1Out: segments[0]?.outPoint,
        seg2In: segments[1]?.inPoint,
        seg1SrcOut: segments[0]?.sourceOut,
        seg2SrcIn: segments[1]?.sourceIn,
        sceneSplitOk,
        totalScenesAfterSplit: state.scenes.length,
      };
    })()`);

    assert.equal(res.scCountAfterImport, 2);
    assert.equal(res.razorActive, true);
    assert.equal(res.cutOk, true);
    assert.equal(res.segmentCount, 2);
    assert.equal(res.seg1Out, res.seg2In);
    assert.equal(res.seg1SrcOut, res.seg2SrcIn);
    assert.equal(res.sceneSplitOk, true);
    assert.equal(res.totalScenesAfterSplit, 3);
  });

  // 3. Test Scene Drag & Drop reordering via real mouse events, Volume reduction & Mute, and Delete
  await t.test('drag-and-drop reorder scenes, lower/mute video volume, and delete clip/scene', async () => {
    const reorderRes = await b.evaluate(`(async () => {
      const beforeOrder = state.scenes.map(s => s.id);
      const blocks = Array.from(document.querySelectorAll('#tl-scenes-lane .tl-scene-block'));
      const firstRect = blocks[0].getBoundingClientRect();
      const lastRect = blocks[blocks.length - 1].getBoundingClientRect();

      blocks[0].dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, button: 0,
        clientX: firstRect.left + firstRect.width / 2,
        clientY: firstRect.top + firstRect.height / 2,
      }));
      window.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        clientX: lastRect.right - 4,
        clientY: lastRect.top + lastRect.height / 2,
      }));
      const indVisible = document.getElementById('tl-scene-drop-indicator')?.style.display;
      window.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        clientX: lastRect.right - 4,
        clientY: lastRect.top + lastRect.height / 2,
      }));
      const afterOrder = state.scenes.map(s => s.id);
      return { beforeOrder, afterOrder, indVisible };
    })()`);

    assert.equal(reorderRes.indVisible, 'block');
    assert.equal(reorderRes.afterOrder[2], reorderRes.beforeOrder[0]);

    // Volume & Mute & Audio Mix Inputs
    const volRes = await b.evaluate(`(() => {
      // Find scene with video layers and select first video layer
      const vSc = state.scenes.find(s => (s.layers || []).some(l => l.kind === 'video'));
      TimelineStudio.selectScene(vSc.id, false);
      const vLayer = vSc.layers.find(l => l.kind === 'video');
      selectLayer(vLayer.id);

      setSelectedVideoVolume(35);
      const volAfterSet = vLayer.volume;
      const mixBeforeMute = VideoCore.collectProjectAudioMixInputs(state.scenes, null);

      toggleSelectedVideoMute();
      const mutedAfter = vLayer.muted;
      toggleSelectedVideoMute();
      const unmutedAfter = vLayer.muted;

      // Capture a visual screenshot while inspecting the video + SVG workspace + timeline
      return {
        volAfterSet,
        mutedAfter,
        unmutedAfter,
        mixCount: mixBeforeMute.length,
        has35Input: mixBeforeMute.some(i => Math.abs(i.volume - 0.35) < 0.01),
      };
    })()`);

    assert.equal(volRes.volAfterSet, 0.35);
    assert.equal(volRes.mutedAfter, true);
    assert.equal(volRes.unmutedAfter, false);
    assert.equal(volRes.has35Input, true);

    await b.screenshot('/tmp/video-e2e-stage.png');

    // Delete clip and delete extra scene
    const delRes = await b.evaluate(`(() => {
      const beforeScCount = state.scenes.length;
      const activeSc = TimelineStudio.getActiveScene();
      const beforeLayerCount = activeSc.layers.length;
      TimelineStudio.deleteSelectedClipOrScene();
      const afterLayerCount = activeSc.layers.length;

      // Delete first scene via inline scene delete button
      document.querySelector('#tl-scenes-lane .tl-scene-del-btn').click();
      return {
        beforeScCount,
        afterScCount: state.scenes.length,
        beforeLayerCount,
        afterLayerCount,
      };
    })()`);

    assert.equal(delRes.afterLayerCount, delRes.beforeLayerCount - 1);
    assert.equal(delRes.afterScCount, delRes.beforeScCount - 1);
  });

  // 4. Verify live Scrubbing & Final WebM Export completes cleanly with video + SVG layers
  await t.test('scrub project and complete full WebM export without errors', async () => {
    const expRes = await b.evaluate(`(async () => {
      TimelineStudio.seekToGlobalTime(0.4, false);
      const blobs = [];
      const origCreateObjUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (b) => {
        blobs.push({ size: b.size, type: b.type });
        return origCreateObjUrl(b);
      };
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {};
      try {
        state.exportFormat = 'webm';
        state.exportQuality = 'low';
        state.projectSettings.fps = 10;
        // Keep duration compact so WebM encode runs fast
        state.scenes.forEach(s => { s.duration = Math.min(s.duration, 1.2); });
        const pt = document.createElement('div');
        const pb = document.createElement('div');
        await TimelineStudio.exportSequentialProject(pt, pb);
        return {
          blobCount: blobs.length,
          blobSize: blobs[0]?.size || 0,
          blobType: blobs[0]?.type || '',
        };
      } finally {
        URL.createObjectURL = origCreateObjUrl;
        HTMLAnchorElement.prototype.click = origClick;
      }
    })()`);

    assert.equal(expRes.blobCount, 1);
    assert.ok(expRes.blobSize > 1000, 'exported WebM blob must have real encoded bytes');
    assert.match(expRes.blobType, /video\/webm/);
  });

  assert.deepEqual(pageErrors, []);
});
