const test = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('./browser-utils.cjs');

test('offline GSAP inspector, live editing, saved playback and exports', { timeout: 180000 }, async t => {
  const b = await browser();
  t.after(() => b.close());
  const errors = [], remote = [];
  b.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
  b.on('Network.requestWillBeSent', e => {
    if (/^https?:/.test(e.request.url) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(e.request.url)) remote.push(e.request.url);
  });
  await b.call('Page.enable');
  await b.call('Runtime.enable');
  await b.call('Network.enable');
  await b.call('Network.setBlockedURLs', { urls: ['https://*'] });
  await b.call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('wb_onboarding_done_v1','1')` });
  const url = process.env.SITE_URL || 'http://127.0.0.1:3000/';
  await b.call('Page.navigate', { url });
  await b.waitFor(`document.getElementById('btn-gsap-effects') && currentProjectId`, 20000);
  const click = async selector => {
    const p = await b.evaluate(`(async () => {
      const n=document.querySelector(${JSON.stringify(selector)});
      if(!n)throw new Error('Control not found: '+${JSON.stringify(selector)});
      n.scrollIntoView({block:'nearest',behavior:'instant'});
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);
      if(hit!==n&&!n.contains(hit))throw new Error('Control obscured: '+${JSON.stringify(selector)}+' by '+hit?.outerHTML.slice(0,180));
      return {x,y};
    })()`);
    await b.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
    await b.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
    await b.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount: 1 });
  };
  const edit = (id, value, event = 'input') => b.evaluate(`(() => {
    const n=document.getElementById(${JSON.stringify(id)});
    n.value=${JSON.stringify(String(value))};n.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));
  })()`);
  const choose = async key => {
    await b.evaluate(`(() => {
      document.querySelector('.gsap-library').open=true;
      document.querySelector('[data-gsap-category=All]').click();
      const s=document.getElementById('gsap-search');s.value='';s.dispatchEvent(new Event('input'));
    })()`);
    await click(`[data-gsap-effect="${key}"]`);
  };

  await t.test('visible launch, empty state, five categories and search are connected', async () => {
    await click('#btn-gsap-effects');
    assert.deepEqual(await b.evaluate(`({
      open:document.getElementById('stab-gsap').classList.contains('active'),
      count:document.querySelectorAll('[data-gsap-effect]').length,
      disabled:document.getElementById('gsap-apply').disabled,
      empty:!document.querySelector('.gsap-empty').hidden
    })`), { open: true, count: 50, disabled: true, empty: true });
    for (const category of ['In', 'Out', 'Text', 'Idle', 'Emphasis']) {
      await click(`[data-gsap-category="${category}"]`);
      assert.equal(await b.evaluate(`document.querySelectorAll('[data-gsap-effect]').length`), 10);
    }
    await click('[data-gsap-category="All"]');
    await edit('gsap-search', 'glitch');
    assert.deepEqual(await b.evaluate(`[...document.querySelectorAll('[data-gsap-effect]')].map(n=>n.dataset.gsapEffect)`), ['dynamicGlitchIn', 'glitchBurst']);
    await edit('gsap-search', 'no such effect');
    assert.equal(await b.evaluate(`document.querySelectorAll('[data-gsap-effect]').length`), 0);
    await edit('gsap-search', '');
    assert.deepEqual(await b.evaluate(`({
      groups:document.querySelectorAll('#gsap-effect-select optgroup').length,
      options:document.querySelectorAll('#gsap-effect-select option').length,
      selected:document.getElementById('gsap-effect-select').value
    })`), { groups: 5, options: 50, selected: 'elasticPop' });
  });

  await t.test('canvas shortcut opens the inspector and reflects sidebar visibility', async () => {
    await click('#stab-animation');
    assert.equal(await b.evaluate(`document.getElementById('studio-gsap-tool').getAttribute('aria-expanded')`), 'false');
    await b.evaluate(`document.getElementById('studio-gsap-tool').focus()`);
    await b.call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await b.call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    assert.deepEqual(await b.evaluate(`({
      open:document.getElementById('stab-gsap').classList.contains('active'),
      expanded:document.getElementById('studio-gsap-tool').getAttribute('aria-expanded'),
      project:state.playing
    })`), { open: true, expanded: 'true', project: false });
    await b.evaluate(`(async()=>{
      UIPanelSystem.toggle('left-sidebar',true);
      await new Promise(requestAnimationFrame);
      await Promise.all(document.getElementById('sidebar').getAnimations().map(a=>a.finished.catch(()=>{})));
    })()`);
    await b.waitFor(`document.getElementById('btn-gsap-effects').getAttribute('aria-expanded')==='false'`);
    await click('#studio-gsap-tool');
    await b.evaluate(`(async()=>{
      await new Promise(requestAnimationFrame);
      await Promise.all(document.getElementById('sidebar').getAnimations().map(a=>a.finished.catch(()=>{})));
    })()`);
    assert.deepEqual(await b.evaluate(`({
      collapsed:document.getElementById('sidebar').classList.contains('is-collapsed'),
      expanded:document.getElementById('btn-gsap-effects').getAttribute('aria-expanded')
    })`), { collapsed: false, expanded: 'true' });
  });

  await t.test('adding a test SVG keeps the inspector open and launches a real animation', async () => {
    await click('#gsap-add-demo');
    await b.waitFor(`state.layers.length===1 && !document.getElementById('gsap-play').disabled`);
    await b.evaluate(`window.__gsapBase=canvas.toDataURL();window.__gsapOriginal={x:getSelectedLayer().x,y:getSelectedLayer().y,w:getSelectedLayer().w,h:getSelectedLayer().h,opacity:getSelectedLayer().opacity}`);
    await choose('smoothOvershoot');
    await b.waitFor(`EffectManager.get(getSelectedLayer())?.time()>.02`);
    assert.deepEqual(await b.evaluate(`({
      playing:!EffectManager.get(getSelectedLayer()).paused(),
      saved:!!getSelectedLayer().gsapEffect,
      panel:document.getElementById('stab-gsap').classList.contains('active'),
      compact:!document.querySelector('.gsap-library').open,
      target:document.querySelector('.gsap-target').textContent
    })`), { playing: true, saved: false, panel: true, compact: true, target: 'Rocket' });
  });

  await t.test('duration, easing and distance update paused preview pixels without editing the layer', async () => {
    await edit('gsap-duration', 2);
    await edit('gsap-ease', 'none', 'change');
    await b.waitFor(`EffectManager.get(getSelectedLayer()).duration()===2`);
    await click('#gsap-pause');
    await edit('gsap-progress', 400);
    assert.equal(await b.evaluate(`EffectManager.state(getSelectedLayer()).y`), 54);
    await b.evaluate(`window.__gsapPausedPixels=canvas.toDataURL()`);
    await edit('gsap-option-distance', 180);
    await b.waitFor(`Math.abs(EffectManager.state(getSelectedLayer()).y-108)<.0001`);
    const result = await b.evaluate(`(() => {
      const l=getSelectedLayer(),tl=EffectManager.get(l);
      return {paused:tl.paused(),progress:tl.progress(),changed:canvas.toDataURL()!==__gsapPausedPixels,
        base:{x:l.x,y:l.y,w:l.w,h:l.h,opacity:l.opacity},original:__gsapOriginal,keys:l.keyframes.length};
    })()`);
    assert.equal(result.paused, true);
    assert.equal(result.progress, .4);
    assert.equal(result.changed, true);
    assert.deepEqual(result.base, result.original);
    assert.equal(result.keys, 0);
    await click('#gsap-pause');
    await b.waitFor(`EffectManager.get(getSelectedLayer()).progress()>.41`);
    await click('#gsap-stop');
    assert.deepEqual(await b.evaluate(`({session:EffectManager.has(getSelectedLayer()),restored:canvas.toDataURL()===__gsapBase})`), { session: false, restored: true });
  });

  await t.test('all 50 cards provide functioning seekable previews and applicable controls', async () => {
    const result = await b.evaluate(`(() => {
      const failures=[],unchanged=[];
      for(const entry of EffectManager.catalog){
        document.querySelector('.gsap-library').open=true;
        document.querySelector('[data-gsap-effect="'+entry.key+'"]').click();
        const tl=EffectManager.get(getSelectedLayer());
        if(!(tl instanceof gsap.core.Timeline)) {failures.push(entry.key+':timeline');continue}
        const frames=[];
        for(const progress of [180,370,630]){
          const range=document.getElementById('gsap-progress');range.value=progress;range.dispatchEvent(new Event('input'));
          frames.push(canvas.toDataURL());
          for(const [key,value]of Object.entries(EffectManager.state(getSelectedLayer())))if(key!=='_gsap'&&!Number.isFinite(value))failures.push(entry.key+':'+key);
        }
        if(frames.every(f=>f===__gsapBase))unchanged.push(entry.key);
        for(const input of document.querySelectorAll('.gsap-settings input')){
          if(input.disabled||!input.checkValidity())failures.push(entry.key+':'+input.id);
          if(input.type==='number'&&input.id!=='gsap-option-stagger'){
            const range=document.getElementById(input.id+'-range');
            if(!range||range.valueAsNumber!==input.valueAsNumber)failures.push(entry.key+':unmatched-slider:'+input.id);
          }
        }
        if(entry.key==='flipBoard' && document.getElementById('gsap-option-perspective'))failures.push('unsupported glyph perspective');
      }
      return {count:EffectManager.catalog.length,failures,unchanged};
    })()`);
    assert.equal(result.count, 50);
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.unchanged, []);
  });

  await t.test('permanent selector switches all 50 effects while the catalog stays closed', async () => {
    const result = await b.evaluate(`(() => {
      const selector=document.getElementById('gsap-effect-select'),failures=[];
      for(const entry of EffectManager.catalog){
        selector.value=entry.key;selector.dispatchEvent(new Event('change'));
        const tl=EffectManager.get(getSelectedLayer());
        if(tl?.data.effectName!==entry.name)failures.push(entry.key+':timeline');
        if(document.querySelector('.gsap-current-title').textContent!==entry.name)failures.push(entry.key+':settings');
        if(document.querySelector('[data-gsap-effect="'+entry.key+'"]').getAttribute('aria-pressed')!=='true')failures.push(entry.key+':card');
        if(document.querySelector('.gsap-library').open)failures.push(entry.key+':catalog');
      }
      return {failures,count:selector.options.length};
    })()`);
    assert.equal(result.count, 50);
    assert.deepEqual(result.failures, []);
  });

  await t.test('native slider and keyboard edits change preview pixels and stay synchronized with exact values', async () => {
    await edit('gsap-effect-select', 'liquidFloat', 'change');
    await edit('gsap-progress', 250);
    await b.evaluate(`window.__beforeRangePixels=canvas.toDataURL()`);
    await click('#gsap-option-amplitude-range');
    await b.waitFor(`Math.abs(EffectManager.state(getSelectedLayer()).y+document.getElementById('gsap-option-amplitude').valueAsNumber)<.0001`);
    const first = await b.evaluate(`({
      amplitude:document.getElementById('gsap-option-amplitude').valueAsNumber,
      range:document.getElementById('gsap-option-amplitude-range').valueAsNumber,
      changed:canvas.toDataURL()!==__beforeRangePixels,
      paused:EffectManager.get(getSelectedLayer()).paused(),
      saved:!!getSelectedLayer().gsapEffect
    })`);
    assert.ok(first.amplitude >= 80 && first.amplitude <= 120);
    assert.equal(first.amplitude, first.range);
    assert.equal(first.changed, true);
    assert.equal(first.paused, true);
    assert.equal(first.saved, false);
    await b.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await b.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    assert.equal(await b.evaluate(`document.getElementById('gsap-option-amplitude').valueAsNumber`), first.amplitude + 1);
    await edit('gsap-duration-range', 2.5);
    await b.waitFor(`EffectManager.get(getSelectedLayer()).duration()===2.5`);
    assert.equal(await b.evaluate(`document.getElementById('gsap-duration').valueAsNumber`), 2.5);
    await edit('gsap-duration', 1.5);
    assert.equal(await b.evaluate(`document.getElementById('gsap-duration-range').valueAsNumber`), 1.5);
    await edit('gsap-duration', '');
    await edit('gsap-duration', '', 'change');
    assert.deepEqual(await b.evaluate(`({
      value:document.getElementById('gsap-duration').valueAsNumber,
      range:document.getElementById('gsap-duration-range').valueAsNumber,
      invalid:document.getElementById('gsap-duration').getAttribute('aria-invalid')
    })`), { value: 1.5, range: 1.5, invalid: 'false' });
  });

  await t.test('live slider edits preserve playing progress while delay edits restart the wait', async () => {
    await click('#gsap-play');
    await b.evaluate(`(() => {
      window.__oldLiveTimeline=EffectManager.get(getSelectedLayer());
      __oldLiveTimeline.progress(.4,false);
    })()`);
    await edit('gsap-option-amplitude-range', 90);
    await b.waitFor(`EffectManager.get(getSelectedLayer())!==__oldLiveTimeline`);
    const playing = await b.evaluate(`({
      playing:!EffectManager.get(getSelectedLayer()).paused(),
      progress:EffectManager.get(getSelectedLayer()).progress(),
      amplitude:document.getElementById('gsap-option-amplitude').valueAsNumber
    })`);
    assert.equal(playing.playing, true);
    assert.ok(playing.progress >= .39, `Live editing restarted at ${playing.progress}`);
    assert.equal(playing.amplitude, 90);
    await edit('gsap-delay-range', .3);
    await b.waitFor(`EffectManager.get(getSelectedLayer()).delay()===.3`);
    assert.equal(await b.evaluate(`(async()=>{
      await new Promise(resolve=>setTimeout(resolve,70));
      return EffectManager.get(getSelectedLayer()).time();
    })()`), 0);
    await edit('gsap-delay', 0);
    await b.waitFor(`EffectManager.get(getSelectedLayer()).delay()===0`);
    await click('#gsap-stop');
  });

  await t.test('live toggle, loop, repeat pause, yoyo, reset and invalid input behave as displayed', async () => {
    await choose('liquidFloat');
    await click('#gsap-live');
    assert.equal(await b.evaluate(`EffectManager.has(getSelectedLayer())`), false);
    await edit('gsap-option-amplitude', 60);
    await edit('gsap-duration', 1.2);
    assert.equal(await b.evaluate(`EffectManager.has(getSelectedLayer())`), false);
    await click('#gsap-play');
    await edit('gsap-progress', 250);
    assert.equal(await b.evaluate(`EffectManager.state(getSelectedLayer()).y`), -60);
    await edit('gsap-repeat', 2);
    await edit('gsap-repeatDelay', .2);
    await click('#gsap-yoyo');
    await click('#gsap-play');
    assert.deepEqual(await b.evaluate(`(() => {
      const tl=EffectManager.get(getSelectedLayer());
      return {repeat:tl.repeat(),repeatDelay:tl.repeatDelay(),yoyo:tl.yoyo(),duration:tl.totalDuration()};
    })()`), { repeat: 2, repeatDelay: .2, yoyo: true, duration: 4 });
    await edit('gsap-duration', 0);
    await click('#gsap-apply');
    assert.equal(await b.evaluate(`!!getSelectedLayer().gsapEffect`), false);
    await click('#gsap-reset');
    assert.deepEqual(await b.evaluate(`({duration:document.getElementById('gsap-duration').value,amplitude:document.getElementById('gsap-option-amplitude').value,repeat:document.getElementById('gsap-repeat').value})`), { duration: '1.2', amplitude: '16', repeat: '-1' });
    await click('#gsap-live');
    await edit('gsap-option-amplitude', 38);
    await b.waitFor(`!!EffectManager.get(getSelectedLayer())`);
    await click('#gsap-apply');
    assert.equal(await b.evaluate(`getSelectedLayer().gsapEffect.options.amplitude`), 38);
  });

  await t.test('applied-layer badge opens the saved effect without changing it', async () => {
    const id = await b.evaluate(`getSelectedLayer().id`);
    await click('#stab-animation');
    assert.ok((await b.evaluate(`document.querySelector('[data-gsap-layer="${id}"]').title`)).includes('Liquid Float'));
    await click(`[data-gsap-layer="${id}"]`);
    assert.deepEqual(await b.evaluate(`({
      layer:getSelectedLayer().id,
      open:document.getElementById('stab-gsap').classList.contains('active'),
      effect:document.getElementById('gsap-effect-select').value,
      amplitude:document.getElementById('gsap-option-amplitude').valueAsNumber,
      range:document.getElementById('gsap-option-amplitude-range').valueAsNumber,
      saved:getSelectedLayer().gsapEffect.options.amplitude
    })`), { layer: id, open: true, effect: 'liquidFloat', amplitude: 38, range: 38, saved: 38 });
  });

  await t.test('applied effects are deterministic with keyframes, delays, repeats and project scrubbing', async () => {
    const result = await b.evaluate(`(() => {
      const l=getSelectedLayer(),sc=TimelineStudio.getActiveScene();
      StudioCore.put(l,'rotation',0,0,'linear');StudioCore.put(l,'rotation',sc.duration,60,'linear');
      StudioCore.put(l,'trimPath',0,10,'linear');StudioCore.put(l,'trimPath',sc.duration,100,'linear');
      const copy=document.createElement('canvas');copy.width=state.canvasW;copy.height=state.canvasH;
      const failures=[];
      for(const entry of EffectManager.catalog){
        l.gsapEffect={effect:entry.key,duration:.8,delay:.1,repeat:1,repeatDelay:.15,yoyo:true,options:{seed:19}};
        TimelineStudio.seekToGlobalTime(.4);const first=canvas.toDataURL();
        TimelineStudio.renderSceneCompositeToContext(copy.getContext('2d'),sc,.4,false);
        if(copy.toDataURL()!==first)failures.push(entry.key+':composite');
        TimelineStudio.seekToGlobalTime(1.3);TimelineStudio.seekToGlobalTime(.4);
        if(canvas.toDataURL()!==first)failures.push(entry.key+':seek');
        if(EffectManager.has(l))failures.push(entry.key+':editable-target');
        StudioEffects.syncSelection(true);
        document.getElementById('gsap-play').click();
        EffectManager.get(l).pause().totalTime(.3,false);
        if(canvas.toDataURL()!==first)failures.push(entry.key+':preview-pixels');
        StudioEffects.stopPreview(false);
      }
      l.gsapEffect={effect:'liquidFloat',duration:1.2,delay:.1,repeat:-1,repeatDelay:.2,yoyo:true,options:{amplitude:38}};
      StudioEffects.syncSelection(true);
      return {failures,keys:l.keyframes.length,serialized:TimelineStudio.serializeProjectState().scenes[0].layers[0].gsapEffect};
    })()`);
    assert.deepEqual(result.failures, []);
    assert.equal(result.keys, 2);
    assert.equal(result.serialized.options.amplitude, 38);
    assert.equal(result.serialized.yoyo, true);
  });

  await t.test('the initial delay is respected by live previews and native preview edits are retained', async () => {
    await edit('gsap-delay', .35);
    await click('#gsap-play');
    const beforeDelay = await b.evaluate(`(async()=>{
      await new Promise(resolve=>setTimeout(resolve,90));
      return EffectManager.get(getSelectedLayer()).time();
    })()`);
    assert.equal(beforeDelay, 0);
    await b.waitFor(`EffectManager.get(getSelectedLayer()).time()>.01`);
    const retained = await b.evaluate(`(() => {
      const l=getSelectedLayer(),before=l.x;l.x+=17;
      document.getElementById('gsap-stop').click();
      const retained=l.x===before+17;l.x=before;
      return retained;
    })()`);
    assert.equal(retained, true);
  });

  await t.test('removal, undo and redo preserve GSAP settings and independent keys', async () => {
    await click('#gsap-remove');
    assert.equal(await b.evaluate(`!!getSelectedLayer().gsapEffect`), false);
    await b.evaluate(`undo()`);
    await b.waitFor(`getSelectedLayer()?.gsapEffect?.options.amplitude===38`);
    await b.evaluate(`redo()`);
    await b.waitFor(`getSelectedLayer() && !getSelectedLayer().gsapEffect`);
    assert.equal(await b.evaluate(`getSelectedLayer().keyframes.length`), 2);
    await b.evaluate(`undo()`);
    await b.waitFor(`getSelectedLayer()?.gsapEffect?.options.amplitude===38`);
  });

  await t.test('saved project and template restore GSAP settings after reload', async () => {
    await b.evaluate(`(async()=>{
      await StudioUI.saveAsTemplate('GSAP motion test');
      TimelineStudio.autoSaveToLocalStorage();saveProject();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(['projects'],'readonly'),req=tx.objectStore('projects').get(currentProjectId);
        req.onsuccess=()=>req.result?.state?.scenes[0]?.layers[0]?.gsapEffect?.options.amplitude===38?resolve():reject(new Error('GSAP project was not saved'));
        req.onerror=()=>reject(req.error);
      });
    })()`);
    await b.call('Page.reload');
    await b.waitFor(`document.getElementById('btn-gsap-effects') && getSelectedLayer()?.gsapEffect?.options.amplitude===38`, 20000);
    assert.deepEqual(await b.evaluate(`({
      duration:getSelectedLayer().gsapEffect.duration,repeat:getSelectedLayer().gsapEffect.repeat,
      keys:getSelectedLayer().keyframes.length,motion:StudioUI.hasMotion(state.layers)
    })`), { duration: 1.2, repeat: -1, keys: 2, motion: true });
    await b.evaluate(`StudioUI.openLibrary('saved')`);
    await b.waitFor(`document.querySelector('[data-saved-template-id]')`);
    await b.evaluate(`document.querySelector('[data-saved-template-id]').click()`);
    await b.waitFor(`state.scenes.length===2 && !document.getElementById('assets-templates-dialog').open`);
    assert.equal(await b.evaluate(`getSelectedLayer().gsapEffect.options.amplitude`), 38);
  });

  await t.test('switching layers or starting project playback stops transient previews', async () => {
    await b.evaluate(`StudioEffects.open()`);
    await click('#gsap-play');
    await b.waitFor(`EffectManager.has(getSelectedLayer())`);
    await b.evaluate(`window.__previousGSAPLayer=getSelectedLayer();StudioUI.insertAsset('bulb')`);
    await b.waitFor(`state.layers.length===2 && !EffectManager.has(__previousGSAPLayer)`);
    assert.equal(await b.evaluate(`document.querySelector('.gsap-target').textContent`), 'Lightbulb');
    assert.equal(await b.evaluate(`document.getElementById('stab-gsap').classList.contains('active')`), true);
    await b.evaluate(`selectLayer(__previousGSAPLayer.id);StudioEffects.open()`);
    await click('#gsap-play');
    await b.evaluate(`TimelineStudio.startPreviewAll()`);
    await b.waitFor(`state.playing && !EffectManager.has(getSelectedLayer())`);
    await b.evaluate(`TimelineStudio.pausePreviewAll()`);
    await b.evaluate(`StudioEffects.open();document.getElementById('gsap-play').click();StudioUI.startPen()`);
    assert.deepEqual(await b.evaluate(`({
      stopped:!EffectManager.has(getSelectedLayer()),locked:document.getElementById('gsap-apply').disabled
    })`), { stopped: true, locked: true });
    await b.evaluate(`StudioUI.cancelPen()`);
    assert.equal(await b.evaluate(`document.getElementById('gsap-apply').disabled`), false);
    await b.evaluate(`StudioEffects.open();document.getElementById('gsap-play').focus()`);
    await b.call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await b.call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    assert.deepEqual(await b.evaluate(`({effect:EffectManager.has(getSelectedLayer()),project:state.playing})`), { effect: true, project: false });
    await b.evaluate(`StudioEffects.stopPreview()`);
  });

  await t.test('saved text effects rebuild their glyph layout after the text changes', async () => {
    const result = await b.evaluate(`(async()=>{
      const makeImage=async text=>{
        const c=document.createElement('canvas');c.width=280;c.height=90;
        const ctx=c.getContext('2d');ctx.font='bold 28px Arial';ctx.fillStyle='#172554';ctx.fillText(text,0,48);
        return new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.src=c.toDataURL()});
      };
      const settings={effect:'typewriterPro',duration:1,repeat:0,options:{cursor:false}};
      const layer={img:await makeImage('AB'),x:0,y:0,w:280,h:90,_textContent:'AB',_textFont:'Arial',_textSize:28,_textBold:true,gsapEffect:settings};
      const c=document.createElement('canvas');c.width=280;c.height=90;const ctx=c.getContext('2d');
      const paint=l=>{ctx.clearRect(0,0,280,90);StudioUI.drawLayer(ctx,l,{...l,gsapTime:.4,trimPath:100});return c.toDataURL()};
      paint(layer);
      layer._textContent='CHANGING TEXT';layer.img=await makeImage(layer._textContent);
      const changed=paint(layer),fresh=paint({...layer});
      return changed===fresh;
    })()`);
    assert.equal(result, true);
  });

  await t.test('GIF, WebM and MP4 capture GSAP motion rather than a static preview', async st => {
    await b.evaluate(`(() => {
      TimelineStudio.cancelPreviewForSingleSceneRun();StudioEffects.stopPreview();
      const sc=TimelineStudio.getActiveScene(),l=sc.layers.find(l=>l.gsapEffect);
      sc.duration=.65;sc.layers=[l];sc.groups=[];sc.selectedLayerId=l.id;sc.transitionOut={type:'cut',duration:.6};
      l.inPoint=0;l.outPoint=.65;l.keyframes=[];
      l.gsapEffect={effect:'smoothOvershoot',duration:.65,delay:0,repeat:0,repeatDelay:0,yoyo:false,options:{distance:180,ease:'none'}};
      state.scenes=[sc];state.layers=sc.layers;state.groups=[];state.playheadTime=0;
      TimelineStudio.applySceneToWorkingState(sc);
      window.__downloads=[];window.__gsapExportFrames=new Set();
      const original=StudioUI.drawLayer;
      StudioUI.drawLayer=function(c,layer,pose){if(state.recording&&Number.isFinite(pose.gsapTime))__gsapExportFrames.add(Math.round(pose.gsapTime*1000));return original(c,layer,pose)};
      HTMLAnchorElement.prototype.click=function(){
        const item={name:this.download};__downloads.push(item);
        item.ready=fetch(this.href).then(r=>r.blob()).then(async blob=>{
          item.type=blob.type;item.size=blob.size;
          item.header=[...new Uint8Array(await blob.arrayBuffer()).slice(0,12)];
        });
      };
    })()`);
    for (const fmt of ['gif', 'webm', 'mp4']) {
      await st.test(fmt, async inner => {
        if (fmt === 'mp4' && !await b.evaluate(`(async()=>typeof VideoEncoder!=='undefined'&&(await VideoEncoder.isConfigSupported({codec:'avc1.42001f',width:1280,height:720,bitrate:4000000,framerate:30})).supported)()`)) {
          inner.skip('H.264 is unavailable in this Chromium build'); return;
        }
        const result = await b.evaluate(`(async()=> {
          __gsapExportFrames.clear();state.exportFormat=${JSON.stringify(fmt)};
          if(state.exportFormat==='gif')getSelectedLayer().gsapEffect={effect:'liquidFloat',duration:.4,repeat:-1,options:{amplitude:40}};
          else getSelectedLayer().gsapEffect={effect:'smoothOvershoot',duration:.65,repeat:0,options:{distance:180,ease:'none'}};
          await TimelineStudio.exportSequentialProject(document.getElementById('export-progress-text'),document.getElementById('export-progress-bar'));
          const item=__downloads.at(-1);await item.ready;
          return {name:item.name,size:item.size,header:item.header,frames:__gsapExportFrames.size,unlocked:!document.getElementById('gsap-apply').disabled};
        })()`);
        assert.ok(result.name.endsWith(`.${fmt}`));
        assert.ok(result.size > 500);
        assert.ok(result.frames >= 4, `${result.frames} sampled motion frames`);
        assert.equal(result.unlocked, true);
        if (fmt === 'gif') assert.equal(String.fromCharCode(...result.header.slice(0, 6)), 'GIF89a');
        if (fmt === 'webm') assert.deepEqual(result.header.slice(0, 4), [26, 69, 223, 163]);
        if (fmt === 'mp4') assert.equal(String.fromCharCode(...result.header.slice(4, 8)), 'ftyp');
      });
    }
  });

  await t.test('reduced-motion preferences disable automatic preview but not explicit playback', async () => {
    await b.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await b.call('Page.reload');
    await b.waitFor(`document.getElementById('btn-gsap-effects') && !!getSelectedLayer()`, 20000);
    await b.evaluate(`StudioEffects.open()`);
    assert.equal(await b.evaluate(`document.getElementById('gsap-live').checked`), false);
    await choose('elasticPop');
    assert.equal(await b.evaluate(`EffectManager.has(getSelectedLayer())`), false);
    await click('#gsap-play');
    assert.equal(await b.evaluate(`EffectManager.has(getSelectedLayer())`), true);
  });

  await b.evaluate(`StudioEffects.stopPreview();EffectManager.stopAll();gsap.ticker.sleep()`);
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
});
