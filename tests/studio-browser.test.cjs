const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('./browser-utils.cjs');

test('offline studio browser integration', { timeout: 180000 }, async t => {
  const b = await browser();
  t.after(() => b.close());
  const pageErrors = [];
  const remoteRequests = [];
  let delayedLocalScript = false;
  b.on('Runtime.exceptionThrown', e => pageErrors.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
  b.on('Network.requestWillBeSent', e => {
    if (/^https:/.test(e.request.url)) remoteRequests.push(e.request.url);
  });
  await b.call('Page.enable');
  await b.call('Runtime.enable');
  await b.call('Network.enable');
  await b.call('Network.setBlockedURLs', { urls: ['https://*'] });
  b.on('Fetch.requestPaused', e => {
    delayedLocalScript = true;
    setTimeout(() => b.call('Fetch.continueRequest', { requestId: e.requestId })
      .catch(error => pageErrors.push(error.message)), 250);
  });
  await b.call('Fetch.enable', { patterns: [{ urlPattern: '*studio-core.js' }] });
  await b.call('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('wb_onboarding_done_v1','1');`,
  });
  await b.call('Page.navigate', { url: process.env.SITE_URL || 'http://127.0.0.1:3000/' });
  await b.waitFor(`window.StudioUI && document.getElementById('studio-key-property') && state.scenes.length && currentProjectId`, 20000);
  await b.call('Fetch.disable');

  await t.test('the studio launches without script exceptions even when a local module loads slowly', async () => {
    assert.equal(delayedLocalScript, true);
    assert.deepEqual(pageErrors, []);
    assert.equal(await b.evaluate(`document.querySelectorAll('#studio-pen-tool').length`), 1);
    assert.equal(await b.evaluate(`document.querySelector('#tool-toolbar').classList.contains('visible')`), true);
  });
  await t.test('the 2,500 core and 10,000+ extended local SVG catalogs decode, filter and virtualize', async () => {
    const counts = await b.evaluate(`(async () => {
      const sample = [
        ...StudioAssets.assets.slice(0, 56),
        StudioAssets.assets[500],
        StudioAssets.assets[1500],
        StudioAssets.assets[2499],
        StudioAssets.getCatalog('10000')[9999],
      ];
      let decoded=0;
      for (const asset of sample) {
        const svg=StudioUI.vectorSVG(asset.vector);
        await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{decoded++;resolve()};image.onerror=reject;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});
      }
      return {
        decoded,
        coreCount: StudioAssets.assets.length,
        extendedCount: StudioAssets.getCatalog('10000').length,
        categories: StudioAssets.categories.length,
        styles: StudioAssets.styles.length,
        templates: StudioAssets.templates.length,
        presets: StudioCore.presets.length,
      };
    })()`);
    assert.deepEqual(counts, {
      decoded: 60,
      coreCount: 2500,
      extendedCount: 10000,
      categories: 50,
      styles: 9,
      templates: 12,
      presets: 12,
    });
    await b.evaluate(`StudioUI.openLibrary()`);
    const libState = await b.evaluate(`(() => {
      const initialCards = document.querySelectorAll('[data-asset-id]').length;
      const totalCoreFiltered = StudioUI.getFilteredAssets().length;
      StudioUI.setCatalogScale('10000');
      const totalExtendedFiltered = StudioUI.getFilteredAssets().length;
      document.querySelector('[data-style-filter="duotone"]').click();
      const duotoneCount = StudioUI.getFilteredAssets().length;
      document.querySelector('[data-style-filter="all"]').click();
      StudioUI.setCatalogScale('2500');
      return { initialCards, totalCoreFiltered, totalExtendedFiltered, duotoneCount };
    })()`);
    assert.equal(libState.totalCoreFiltered, 2500);
    assert.equal(libState.totalExtendedFiltered, 10000);
    assert.ok(libState.duotoneCount > 800);
    assert.ok(libState.initialCards >= 30 && libState.initialCards <= 150);
    await b.screenshot('/tmp/inkplainer-assets.png');
    await b.evaluate(`document.querySelector('#assets-templates-dialog').close()`);
  });
  await t.test('asset insertion, trim rendering and property rows work', async () => {
    await b.evaluate(`StudioUI.insertAsset('rocket')`);
    assert.equal(await b.evaluate(`state.layers.length`), 1);
    const result = await b.evaluate(`(() => {
      const l=getSelectedLayer();
      const counts=[];
      for (const trim of [0,40,100]){
        const cvs=document.createElement('canvas');cvs.width=400;cvs.height=400;
        const c=cvs.getContext('2d');
        StudioUI.drawLayer(c,{...l,x:0,y:0,w:300,h:250},{x:0,y:0,w:300,h:250,trimPath:trim});
        const p=c.getImageData(0,0,400,400).data; let count=0;for(let i=3;i<p.length;i+=4)if(p[i])count++;
        counts.push(count);
      }
      StudioUI.addKeyframes(l,'rotation');
      return {counts, rows:document.querySelectorAll('.studio-channel-header').length,vector:!!l.vectorData};
    })()`);
    assert.equal(result.vector, true);
    assert.equal(result.rows, 6);
    assert.equal(result.counts[0], 0);
    assert.ok(result.counts[1] > 0);
    assert.ok(result.counts[2] > result.counts[1]);
    await b.screenshot('/tmp/inkplainer-editor.png');
  });
  await t.test('templates insert complete scenes without replacing existing work', async () => {
    await b.evaluate(`StudioUI.openLibrary('templates')`);
    assert.equal(await b.evaluate(`document.querySelectorAll('[data-template-id]').length`), 12);
    await b.screenshot('/tmp/inkplainer-templates.png');
    await b.evaluate(`StudioUI.applyBuiltinTemplate('pitch')`);
    const result = await b.evaluate(`({scenes:state.scenes.length,layers:state.layers.length,originalLayers:state.scenes[0].layers.length,animated:state.layers.filter(l=>l.keyframes?.length).length})`);
    assert.equal(result.scenes, 2);
    assert.ok(result.layers >= 8);
    assert.equal(result.originalLayers, 1);
    assert.equal(result.animated, result.layers);
  });
  await t.test('IndexedDB templates restore groups, text, vectors and keyframes with new IDs', async () => {
    const result = await b.evaluate(`(async () => {
      state.layers[0].groupId='test-group';state.layers[1].groupId='test-group';
      state.groups=[{id:'test-group',name:'Headline',collapsed:false,visible:true,layerIds:[state.layers[0].id,state.layers[1].id]}];
      TimelineStudio.saveWorkingStateToActiveScene();
      const before=TimelineStudio.serializeProjectState(false).scenes.find(s=>s.id===state.activeSceneId);
      const saved=await StudioUI.saveAsTemplate('Browser Test Template');
      const oldIds=before.layers.map(l=>l.id);
      await StudioUI.applySavedTemplate(saved.id);
      const group=state.groups[0];
      return {scenes:state.scenes.length,count:state.layers.length,expected:before.layers.length,
        unique:state.layers.every(l=>!oldIds.includes(l.id)),groupMatches:group.layerIds.every(id=>state.layers.some(l=>l.id===id && l.groupId===group.id)),
        text:state.layers[0]._textContent,expectedText:before.layers[0]._textContent,
        nodes:state.layers.filter(l=>l.vectorData).length,keys:state.layers[0].keyframes.length};
    })()`);
    assert.equal(result.scenes, 3);
    assert.equal(result.count, result.expected);
    assert.equal(result.unique, true);
    assert.equal(result.groupMatches, true);
    assert.equal(result.text, result.expectedText);
    assert.ok(result.nodes >= 3);
    assert.ok(result.keys >= 2);
  });
  await t.test('undo and redo restore motion/vector metadata', async () => {
    const result = await b.evaluate(`(async () => {
      const before=state.scenes.length;
      undo();
      await new Promise(resolve=>setTimeout(resolve,300));
      const undone=state.scenes.length;
      redo();
      await new Promise(resolve=>setTimeout(resolve,300));
      return {before,undone,redone:state.scenes.length,vector:state.layers.some(l=>l.vectorData),text:state.layers[0]._textContent};
    })()`);
    assert.equal(result.undone, result.before - 1);
    assert.equal(result.redone, result.before);
    assert.equal(result.vector, true);
    assert.ok(result.text);
  });
  await t.test('playhead scrubbing and keyed playback use the same pixels', async () => {
    const result = await b.evaluate(`(async () => {
      TimelineStudio.pausePreviewAll();
      const sc=TimelineStudio.getActiveScene();
      sc.duration=1.1;
      state.layers.forEach(l=>{l.outPoint=1.1;l.keyframes=[]});
      const l=state.layers.find(l=>l.vectorData);
      StudioCore.put(l,'rotation',0,0,'linear');StudioCore.put(l,'rotation',1.1,90,'linear');
      StudioCore.put(l,'trimPath',0,0,'linear');StudioCore.put(l,'trimPath',1.1,100,'linear');
      const off=TimelineStudio.getSceneStartOffset(sc.id);
      TimelineStudio.seekToGlobalTime(off+.55);
      const expected=canvas.toDataURL();
      const tmp=document.createElement('canvas');tmp.width=state.canvasW;tmp.height=state.canvasH;
      TimelineStudio.renderSceneCompositeToContext(tmp.getContext('2d'),sc,.55,false);
      const same=expected===tmp.toDataURL();
      restartAnim();
      await new Promise(r=>setTimeout(r,220));
      const moving=state.playing && state.playheadTime>off;
      TimelineStudio.pausePreviewAll(); const paused=state.playheadTime;
      await new Promise(r=>setTimeout(r,140)); const frozen=state.playheadTime===paused;
      togglePlay();
      await new Promise(r=>setTimeout(r,100));
      const resumed=state.playheadTime>paused;
      TimelineStudio.stopPreviewAndRewind();
      return {same,moving,frozen,resumed,stopped:!state.playing};
    })()`);
    assert.deepEqual(result, { same: true, moving: true, frozen: true, resumed: true, stopped: true });
  });
  const mouse = (type, x, y, buttons = 0) => b.call('Input.dispatchMouseEvent', {
    type, x, y, button: type === 'mouseMoved' && buttons === 0 ? 'none' : 'left',
    buttons, clickCount: type === 'mouseMoved' ? 0 : 1,
  });
  const drag = async (from, to) => {
    await mouse('mouseMoved', from.x, from.y);
    await mouse('mousePressed', from.x, from.y, 1);
    await mouse('mouseMoved', to.x, to.y, 1);
    await mouse('mouseReleased', to.x, to.y);
  };
  const click = p => drag(p, p);
  await t.test('native Pen gestures create editable curved and closed SVG paths', async () => {
    await b.evaluate(`document.getElementById('studio-pen-tool').click()`);
    const points = await b.evaluate(`(() => {
      const r=document.getElementById('studio-vector-overlay').getBoundingClientRect();
      return [[220,190],[320,130],[620,185],[690,250],[820,480]].map(([x,y])=>({x:r.x+x*r.width/state.canvasW,y:r.y+y*r.height/state.canvasH}));
    })()`);
    await drag(points[0], points[1]);
    await drag(points[2], points[3]);
    await click(points[4]);
    await click(points[0]);
    await b.screenshot('/tmp/inkplainer-pen.png');
    await b.evaluate(`StudioUI.finishPen()`);
    const data = await b.evaluate(`(() => {
      const l=getSelectedLayer(),p=l.vectorData.paths[0];
      return {nodes:p.nodes.length,closed:p.closed,curved:p.nodes[0].outX!==p.nodes[0].x,svg:StudioUI.vectorSVG(l.vectorData).includes('pathLength="100"'),name:l.name};
    })()`);
    assert.deepEqual(data, { nodes: 3, closed: true, curved: true, svg: true, name: 'Custom Bézier Path' });
  });
  await t.test('Node editing modifies an existing anchor while preserving path closure', async () => {
    const before = await b.evaluate(`JSON.stringify(getSelectedLayer().vectorData.paths[0].nodes[0])`);
    const position = await b.evaluate(`(() => {
      StudioUI.startNodes();
      const l=getSelectedLayer(),n=l.vectorData.paths[0].nodes[0],r=canvas.getBoundingClientRect();
      return {x:r.x+(l.x+n.x*l.w/l.vectorData.width)*r.width/state.canvasW,y:r.y+(l.y+n.y*l.h/l.vectorData.height)*r.height/state.canvasH};
    })()`);
    await drag(position, { x: position.x + 10, y: position.y + 6 });
    await b.evaluate(`StudioUI.finishPen()`);
    const after = await b.evaluate(`JSON.stringify(getSelectedLayer().vectorData.paths[0].nodes[0])`);
    assert.notEqual(after, before);
    assert.equal(await b.evaluate(`getSelectedLayer().vectorData.paths[0].closed`), true);
  });
  await t.test('native stroke, fill and width controls update the SVG layer', async () => {
    await b.evaluate(`document.getElementById('studio-vector-style').click()`);
    await b.evaluate(`(() => {
      const d=document.querySelector('.studio-dialog[open]'),colors=d.querySelectorAll('input[type=color]');
      colors[0].value='#dc2626';colors[0].dispatchEvent(new Event('input'));
      colors[1].value='#fef08a';colors[1].dispatchEvent(new Event('input'));
      d.querySelector('input[type=checkbox]').checked=false;
      d.querySelector('input[type=number]').value=7;
      Array.from(d.querySelectorAll('button')).find(b=>b.textContent==='Apply style').click();
    })()`);
    await b.waitFor(`!document.querySelector('.studio-dialog[open]')`);
    const style = await b.evaluate(`(() => {const v=getSelectedLayer().vectorData;return {stroke:v.stroke,fill:v.fill,width:v.strokeWidth}})()`);
    assert.deepEqual(style, { stroke: '#dc2626', fill: '#fef08a', width: 7 });
  });
  await t.test('property editing and easing stay independent, with aligned scrollable tracks', async () => {
    const result = await b.evaluate(`(() => {
      const l=getSelectedLayer();StudioUI.addKeyframes(l,'x');
      const header=document.querySelector('.studio-channel-header[data-layer-id="'+l.id+'"][data-property=x]');
      const input=header.querySelector('input');input.value=310;input.dispatchEvent(new Event('change'));
      const frame=l.keyframes.find(k=>Number.isFinite(k.x));
      StudioUI.editKeyframe(null,l,frame,'x');
      const d=document.querySelector('.studio-dialog[open]');
      d.querySelector('[data-key-easing=x]').value='expo';
      Array.from(d.querySelectorAll('button')).find(b=>b.textContent==='Save changes').click();
      const row=document.querySelector('.studio-channel-header[data-layer-id="'+l.id+'"][data-property=x]');
      const lane=document.querySelector('.studio-channel-lane[data-layer-id="'+l.id+'"][data-property=x]');
      return {x:l.keyframes[0].x,opacity:l.keyframes[0].opacity??null,easing:l.keyframes[0].easings.x,
        alignment:Math.abs(row.getBoundingClientRect().top-lane.getBoundingClientRect().top),
        inputColor:getComputedStyle(row.querySelector('input')).color,
        headerWidth:document.querySelector('.tl-headers-col').getBoundingClientRect().width};
    })()`);
    assert.equal(result.x, 310);
    assert.equal(result.opacity, null);
    assert.equal(result.easing, 'expo');
    assert.ok(result.alignment <= 1, `Property header/lane misalignment: ${result.alignment}`);
    assert.equal(result.inputColor, 'rgb(203, 213, 225)');
    assert.equal(result.headerWidth, 246);
    await b.screenshot('/tmp/inkplainer-properties.png');
  });
  await t.test('property headers stay aligned at the bottom of a vertically scrolled timeline', async () => {
    const result = await b.evaluate(`(async () => {
      const scroll=document.getElementById('tl-scroll-area');
      scroll.scrollTop=scroll.scrollHeight;
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const headers=[...document.querySelectorAll('.studio-channel-header')];
      const alignment=Math.max(...headers.map(header=>{
        const lane=document.querySelector('.studio-channel-lane[data-layer-id="'+header.dataset.layerId+'"][data-property="'+header.dataset.property+'"]');
        return Math.abs(header.getBoundingClientRect().top-lane.getBoundingClientRect().top);
      }));
      const distance=scroll.scrollTop;
      scroll.scrollTop=0;
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return {alignment,distance};
    })()`);
    assert.ok(result.distance > 0);
    assert.ok(result.alignment <= 1, `Scrolled property header/lane misalignment: ${result.alignment}`);
  });
  await t.test('a native preset drag onto a layer generates editable property keys', async () => {
    await b.evaluate(`StudioUI.openPresets()`);
    await b.call('Input.setInterceptDrags', { enabled: true });
    const dataReady = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Native preset drag did not start')), 5000);
      b.on('Input.dragIntercepted', e => { clearTimeout(timer); resolve(e.data); });
    });
    const points = await b.evaluate(`(() => {
      const track=document.querySelector('.tl-layer-lane[data-layer-id="'+getSelectedLayer().id+'"]');
      track.scrollIntoView({block:'center',inline:'nearest'});
      document.querySelector('[data-preset-id=float]').scrollIntoView({block:'center'});
      const card=document.querySelector('[data-preset-id=float]').getBoundingClientRect();
      const lane=track.getBoundingClientRect();
      const viewport=document.getElementById('tl-scroll-area').getBoundingClientRect();
      return {from:{x:card.x+card.width/2,y:card.y+25},to:{x:viewport.x+90,y:lane.y+lane.height/2}};
    })()`);
    await mouse('mouseMoved', points.from.x, points.from.y);
    await mouse('mousePressed', points.from.x, points.from.y, 1);
    await mouse('mouseMoved', points.from.x + 30, points.from.y + 20, 1);
    const data = await dataReady;
    assert.ok(data.items.some(item => item.mimeType === 'application/x-inkplainer-preset'));
    for (const type of ['dragEnter', 'dragOver', 'drop']) await b.call('Input.dispatchDragEvent', { type, x: points.to.x, y: points.to.y, data });
    await mouse('mouseReleased', points.to.x, points.to.y);
    await b.call('Input.setInterceptDrags', { enabled: false });
    const result = await b.evaluate(`({
      yKeys:getSelectedLayer().keyframes.filter(k=>Number.isFinite(k.y)).length,
      xKey:getSelectedLayer().keyframes.find(k=>Number.isFinite(k.x))?.x,
      dialogClosed:!document.querySelector('.studio-dialog[open]')
    })`);
    assert.equal(result.yKeys, 3);
    assert.equal(result.xKey, 310);
    assert.equal(result.dialogClosed, true);
  });
  await t.test('saved projects and local templates survive a browser page reload', async () => {
    await b.evaluate(`saveProject(currentProjectId)`);
    await b.waitFor(`new Promise(resolve=>{const tx=db.transaction('projects','readonly');const q=tx.objectStore('projects').get(currentProjectId);q.onsuccess=()=>resolve(q.result.state.scenes?.some(s=>s.layers.some(l=>l.vectorData?.paths.some(p=>p.nodes))))})`);
    await b.call('Page.reload', { ignoreCache: true });
    await b.waitFor(`window.StudioUI && document.getElementById('studio-key-property') && state.scenes.length===3 && state.layers.some(l=>l.vectorData?.paths.some(p=>p.nodes))`, 20000);
    assert.ok(await b.evaluate(`state.layers.some(l=>l.vectorData.stroke==='#dc2626' && l.vectorData.strokeWidth===7)`));
    await b.evaluate(`StudioUI.openLibrary('saved')`);
    await b.waitFor(`document.querySelector('[data-saved-template-id]')`);
    assert.equal(await b.evaluate(`document.querySelectorAll('[data-saved-template-id]').length`), 1);
    await b.evaluate(`document.getElementById('assets-templates-dialog').close()`);
  });
  await t.test('previous Make vector data and localStorage templates migrate without data loss', async () => {
    const migration = await b.evaluate(`(async()=>{
      const snap=TimelineStudio.serializeProjectState(false);
      const l=snap.scenes[0].layers.find(l=>l.vectorData?.paths.some(p=>p.nodes));
      const data=l.vectorData, part=data.paths[0];
      l.vectorData={
        bounds:{x:100,y:200,w:data.width,h:data.height},width:data.strokeWidth,stroke:data.stroke,fill:data.fill,closed:part.closed,
        points:part.nodes.map(n=>({x:n.x+100,y:n.y+200,inX:n.inX+100,inY:n.inY+200,outX:n.outX+100,outY:n.outY+200}))
      };
      localStorage.setItem('inkplainer_scene_templates_v1',JSON.stringify([{id:'legacy-test',name:'Legacy Pen Template',createdAt:1,background:'#ffffff',layers:[l]}]));
      await new Promise(resolve=>TimelineStudio.deserializeProjectState(snap,resolve));
      const migrated=state.scenes[0].layers.find(v=>v.id===l.id).vectorData;
      return {nodes:migrated.paths[0].nodes.length,expected:part.nodes.length,closed:migrated.paths[0].closed};
    })()`);
    assert.equal(migration.nodes, migration.expected);
    assert.equal(migration.closed, true);
    await b.call('Page.reload', { ignoreCache: true });
    await b.waitFor(`window.StudioUI && document.getElementById('studio-key-property') && currentProjectId && state.scenes.length===3`);
    await b.evaluate(`StudioUI.openLibrary('saved')`);
    await b.waitFor(`document.querySelector('[data-saved-template-id="legacy-legacy-test"]')`);
    assert.equal(await b.evaluate(`document.querySelectorAll('[data-saved-template-id]').length`), 2);
    assert.equal(await b.evaluate(`JSON.parse(localStorage.getItem('inkplainer_scene_templates_v1')).length`), 1);
    await b.evaluate(`document.getElementById('assets-templates-dialog').close()`);
  });
  await t.test('saved local templates can be reused in a separate new project', async () => {
    const oldProject = await b.evaluate(`currentProjectId`);
    await b.evaluate(`createNewProject()`);
    await b.waitFor(`currentProjectId!==${oldProject} && state.scenes.length===1 && state.layers.length===0`);
    await b.evaluate(`StudioUI.applySavedTemplate('legacy-legacy-test')`);
    assert.equal(await b.evaluate(`state.scenes.length`), 2);
    assert.equal(await b.evaluate(`getSelectedLayer().vectorData.paths[0].closed`), true);
    assert.ok(await b.evaluate(`getSelectedLayer().keyframes.length>0`));
  });
  await t.test('exports render animated SVGs without a network connection', async st => {
    await b.evaluate(`(() => {
      TimelineStudio.cancelPreviewForSingleSceneRun();
      const sc=TimelineStudio.getActiveScene(), l=state.layers.find(l=>l.vectorData?.paths.some(p=>p.nodes));
      sc.duration=.7;sc.layers=[l];sc.groups=[];sc.selectedLayerId=l.id;sc.transitionOut={type:'cut',duration:.6};
      l.inPoint=0;l.outPoint=.7;l.keyframes=[];
      StudioCore.applyPreset(l,'draw',0,.7);
      state.scenes=[sc];state.layers=sc.layers;state.groups=[];state.playheadTime=0;
      TimelineStudio.applySceneToWorkingState(sc);
      window.__downloads=[];
      HTMLAnchorElement.prototype.click=function(){
        const capture={name:this.download};window.__downloads.push(capture);
        capture.ready=fetch(this.href).then(r=>r.blob()).then(async blob=>{
          capture.type=blob.type;capture.size=blob.size;
          const bytes=new Uint8Array(await blob.arrayBuffer());capture.header=Array.from(bytes.slice(0,12));
          if(capture.name.endsWith('.mp4')){
            const v=document.createElement('video');v.muted=true;v.src=URL.createObjectURL(blob);
            await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=j});
            capture.duration=v.duration;URL.revokeObjectURL(v.src);
          }
        });
      };
    })()`);
    for (const fmt of ['gif', 'webm', 'mp4']) {
      await st.test(`${fmt.toUpperCase()} contains a valid local animation`, async inner => {
        if (fmt === 'mp4') {
          const h264 = await b.evaluate(`(async()=>typeof VideoEncoder!=='undefined' && (await VideoEncoder.isConfigSupported({codec:'avc1.42001f',width:1280,height:720,bitrate:4000000,framerate:30})).supported)()`);
          if (!h264) { inner.skip('H.264 encoding is not supported by this Chromium build'); return; }
        }
        const result = await b.evaluate(`(async () => {
          state.exportFormat=${JSON.stringify(fmt)};
          await Promise.race([
            TimelineStudio.exportSequentialProject(document.getElementById('export-progress-text'),document.getElementById('export-progress-bar')),
            new Promise((_,reject)=>setTimeout(()=>reject(new Error('Export timed out')),10000))
          ]);
          const item=window.__downloads[window.__downloads.length-1];await item.ready;
          return {name:item.name,size:item.size,type:item.type,header:item.header,duration:item.duration??null};
        })()`);
        assert.ok(result.name.endsWith(`.${fmt}`));
        assert.ok(result.size > 500);
        if (fmt === 'gif') assert.equal(String.fromCharCode(...result.header.slice(0,6)), 'GIF89a');
        if (fmt === 'webm') assert.deepEqual(result.header.slice(0,4), [26,69,223,163]);
        if (fmt === 'mp4') {
          assert.equal(String.fromCharCode(...result.header.slice(4,8)), 'ftyp');
          assert.ok(result.duration >= 1 && result.duration < 1.8, `A .7s scene plus final hold should retain real timing: ${result.duration}s`);
        }
      });
    }
  });
  await t.test('all export formats cancel without pending jobs or partial downloads', async st => {
    for (const fmt of ['gif', 'webm', 'mp4']) {
      await st.test(`${fmt.toUpperCase()} cancellation`, async inner => {
        if (fmt === 'mp4') {
          const h264 = await b.evaluate(`(async()=>typeof VideoEncoder!=='undefined' && (await VideoEncoder.isConfigSupported({codec:'avc1.42001f',width:1280,height:720,bitrate:4000000,framerate:30})).supported)()`);
          if (!h264) { inner.skip('H.264 is unavailable'); return; }
        }
        const result = await b.evaluate(`(async()=>{
          state.exportFormat=${JSON.stringify(fmt)};const sc=TimelineStudio.getActiveScene();sc.duration=3;state.layers[0].outPoint=3;
          const before=window.__downloads.length;
          const job=TimelineStudio.exportSequentialProject(document.getElementById('export-progress-text'),document.getElementById('export-progress-bar')).then(()=> 'completed',e=>e.name);
          await new Promise(r=>setTimeout(r,120));closeExportBanner();
          const outcome=await Promise.race([job,new Promise(r=>setTimeout(()=>r('hung'),1500))]);
          await new Promise(r=>setTimeout(r,80));
          return {outcome,playing:state.playing,recording:state.recording,newDownloads:window.__downloads.length-before};
        })()`);
        assert.equal(result.outcome, 'AbortError');
        assert.equal(result.playing, false);
        assert.equal(result.recording, false);
        assert.equal(result.newDownloads, 0);
      });
    }
  });
  await t.test('ordinary unkeyed image layers still use their original animation engine', async () => {
    await b.evaluate(`(async()=>{
      TimelineStudio.cancelPreviewForSingleSceneRun();
      const sc=TimelineStudio.getActiveScene();state.layers=[];sc.layers=state.layers;state.groups=[];sc.groups=[];
      const c=document.createElement('canvas');c.width=100;c.height=100;const cx=c.getContext('2d');
      cx.fillStyle='#1a1a1a';cx.fillRect(20,20,60,60);
      const img=await new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i);i.src=c.toDataURL()});
      state.animStyle='popbounce';state.hand='ghost';addLayer(img,'Legacy raster');
      const l=getSelectedLayer();l.animStyle='popbounce';l.hand='ghost';l.outAnim='none';l.cameraMode='static';l.speed=100;l.keyframes=[];
      restartAnim();
    })()`);
    await b.waitFor(`state.done && !state.playing`, 10000);
    assert.equal(await b.evaluate(`!!getSelectedLayer().vectorData`), false);
    assert.equal(await b.evaluate(`state._activeSlots.length`), 0);
  });
  await b.screenshot('/tmp/inkplainer-final.png');
  assert.deepEqual(pageErrors, [], `Browser exceptions:\n${pageErrors.join('\n')}`);
  assert.deepEqual(remoteRequests, [], 'The editor must not request any external resource');
});
