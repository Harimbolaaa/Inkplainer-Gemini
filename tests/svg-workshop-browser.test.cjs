const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { browser } = require('./browser-utils.cjs');

const fixture = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 20 240 180">
<defs><linearGradient id="paint"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
<clipPath id="clip"><rect x="20" y="25" width="170" height="150" rx="12"/></clipPath></defs>
<style>.paint{fill:url(#paint);stroke:#25324b;stroke-width:3}</style>
<g opacity=".7" clip-path="url(#clip)" transform="translate(8 10)">
<rect class="paint" x="25" y="35" width="110" height="80" rx="18"/>
<circle fill="#ef4444" cx="120" cy="100" r="24"/></g>
<svg x="150" y="100" width="80" height="80" viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="#059669"/></svg>
<path d="M30 165L75 135L110 167" fill="none" stroke="#1e293b" stroke-width="5" stroke-linecap="round"/>
</svg>`;

test('SVG workshop imports, designs, loops, exports and composes real offline animations', { timeout: 240000 }, async t => {
  const b = await browser(), temp = mkdtempSync(join(tmpdir(), 'inkplainer-svg-workshop-'));
  t.after(async () => { await b.close(); rmSync(temp, { recursive: true, force: true }); });
  const file = join(temp, 'transformed-gradient.svg'); writeFileSync(file, fixture);
  const errors = [], remote = [];
  b.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
  b.on('Network.requestWillBeSent', e => {
    if (/^https?:/.test(e.request.url) && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(e.request.url)) remote.push(e.request.url);
  });
  await b.call('Page.enable'); await b.call('Runtime.enable'); await b.call('Network.enable');
  await b.call('Network.setBlockedURLs', { urls: ['https://*', 'http://external.invalid/*'] });
  await b.call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('wb_onboarding_done_v1','1')` });
  const url = process.env.SITE_URL || 'http://127.0.0.1:3000/';
  await b.call('Page.navigate', { url });
  await b.waitFor(`document.getElementById('btn-svg-workshop') && currentProjectId`, 20000);
  await b.evaluate(`(async()=>{
    await StudioUI.insertAsset('rocket');
    window.__originalMotionLayer={id:getSelectedLayer().id,x:getSelectedLayer().x,y:getSelectedLayer().y,name:getSelectedLayer().name};
    window.__workshopDownloads=[];
    HTMLAnchorElement.prototype.click=function(){__workshopDownloads.push(this.download)};
  })()`);
  const click = async selector => {
    const point = await b.evaluate(`(async()=>{
      const n=document.querySelector(${JSON.stringify(selector)});
      if(!n)throw new Error('Missing control: '+${JSON.stringify(selector)});
      n.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);
      if(hit!==n&&!n.contains(hit))throw new Error('Obscured control '+${JSON.stringify(selector)}+' by '+hit?.outerHTML.slice(0,160));
      return{x,y};
    })()`);
    await b.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await b.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await b.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  };
  const edit = (id, value, event = 'input') => b.evaluate(`(()=>{
    const n=document.getElementById(${JSON.stringify(id)});if(!n)throw new Error('Missing input');
    n.value=${JSON.stringify(String(value))};n.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));
  })()`);
  const ready = async () => {
    await b.waitFor(`!document.getElementById('svg-add-to-project').disabled || document.getElementById('svg-workshop-status').classList.contains('error')`, 20000);
    const state = await b.evaluate(`({disabled:document.getElementById('svg-add-to-project').disabled,message:document.getElementById('svg-workshop-status').textContent})`);
    assert.equal(state.disabled, false, state.message);
  };
  const showFirstHold = async () => {
    const time = await b.evaluate(`(()=>{
      const t=SVGWorkshop.getTiming(),d=SVGWorkshop.getDesign();
      return Math.round((t.steps[0].end-.03)/(d.loop?t.cycle:t.total)*1000);
    })()`);
    await edit('svg-workshop-seek', time);
  };

  await t.test('the visible workshop starts a real preview without changing existing work', async () => {
    await click('#btn-svg-workshop'); await ready();
    await b.waitFor(`Number(document.getElementById('svg-workshop-seek').value)>30`);
    assert.deepEqual(await b.evaluate(`({
      open:document.getElementById('svg-workshop-dialog').open,
      shapes:document.querySelectorAll('[data-motion-shape]').length,
      steps:document.querySelectorAll('[data-motion-step]').length,
      layers:state.layers.length,
      libraries:typeof anime.easing==='function'&&typeof SVG==='function'&&typeof DOMPurify.sanitize==='function'
    })`), { open: true, shapes: 24, steps: 3, layers: 1, libraries: true });
    await edit('svg-workshop-seek', 0);
    await b.evaluate(`window.__emptyWorkshopFrame=document.getElementById('svg-workshop-preview').toDataURL()`);
    await edit('svg-workshop-seek', 220);
    assert.equal(await b.evaluate(`document.getElementById('svg-workshop-preview').toDataURL()!==__emptyWorkshopFrame`), true);
  });

  await t.test('all 24 basic shapes decode and render, including paths and open strokes', async () => {
    const ids = await b.evaluate(`SVGMotionCore.shapes.map(s=>s.id)`);
    const frames = new Set();
    for (const id of ids) {
      await b.evaluate(`document.querySelector('[data-motion-shape="${id}"]').click()`);
      await ready(); await showFirstHold();
      frames.add(await b.evaluate(`document.getElementById('svg-workshop-preview').toDataURL()`));
    }
    assert.equal(frames.size, 24);
    assert.equal(await b.evaluate(`state.layers.length`), 1);
    await edit('svg-shape-search', 'cercle');
    assert.equal(await b.evaluate(`document.querySelectorAll('[data-motion-shape]').length`), 1);
    await edit('svg-shape-search', '');
    await click('[data-motion-shape="star"]'); await ready();
  });

  await t.test('steps can be appended, customized, duplicated, reordered and removed', async () => {
    await edit('svg-add-preset', 'wave', 'change');
    await click('#svg-add-step');
    await edit('svg-step-duration-range', 2.4);
    await edit('svg-step-hold', .4);
    await edit('svg-step-amount-range', 1.5);
    await edit('svg-step-easing', 'easeOutBounce', 'change');
    let d = await b.evaluate(`SVGWorkshop.getDesign()`);
    assert.equal(d.steps.length, 4);
    assert.deepEqual([d.steps[3].preset, d.steps[3].duration, d.steps[3].hold, d.steps[3].amount, d.steps[3].easing], ['wave', 2.4, .4, 1.5, 'easeOutBounce']);
    await click('.motion-step.selected [aria-label^="Dupliquer"]');
    assert.equal(await b.evaluate(`SVGWorkshop.getDesign().steps.length`), 5);
    await click('.motion-step.selected [aria-label^="Déplacer avant"]');
    d = await b.evaluate(`SVGWorkshop.getDesign()`);
    assert.equal(d.steps[3].preset, 'wave');
    assert.notEqual(d.steps[3].id, d.steps[4].id);
    await click('.motion-step.selected [aria-label^="Supprimer"]');
    assert.equal(await b.evaluate(`SVGWorkshop.getDesign().steps.length`), 4);
    assert.equal(await b.evaluate(`state.layers.length`), 1);
  });

  await t.test('fill, outline, scale and timing controls genuinely affect the live pixels', async () => {
    await showFirstHold();
    await b.evaluate(`window.__oldWorkshopColor=document.getElementById('svg-workshop-preview').toDataURL()`);
    await edit('svg-fill', '#f59e0b');
    await edit('svg-stroke', '#0f172a');
    await edit('svg-stroke-width-range', 6);
    await edit('svg-design-scale-range', .85);
    await ready(); await showFirstHold();
    const result = await b.evaluate(`(()=>{
      const c=document.getElementById('svg-workshop-preview'),rgba=c.getContext('2d').getImageData(0,0,512,512).data;
      let orange=0;for(let i=0;i<rgba.length;i+=4)if(rgba[i]>235&&rgba[i+1]>145&&rgba[i+1]<175&&rgba[i+2]<30)orange++;
      return{changed:c.toDataURL()!==__oldWorkshopColor,orange,data:SVGWorkshop.getDesign(),scaleInput:document.getElementById('svg-design-scale').value};
    })()`);
    assert.equal(result.changed, true);
    assert.ok(result.orange > 1000);
    assert.equal(result.data.strokeWidth, 6);
    assert.equal(result.data.scale, .85);
    assert.equal(result.scaleInput, '0.85');
  });

  await t.test('text uses local fonts and whole graphemes, with a real per-letter stagger', async () => {
    await click('[data-motion-source="text"]');
    await edit('svg-workshop-text', 'ÉA\u0301Z\n42');
    await edit('svg-text-font', 'Caveat', 'change');
    await edit('svg-text-spacing-range', 2);
    await ready(); await showFirstHold();
    const result = await b.evaluate(`({
      parts:document.querySelector('.motion-preview-head .motion-hint').textContent,
      mode:SVGWorkshop.getDesign().mode,
      text:SVGWorkshop.getDesign().text,
      font:SVGWorkshop.getDesign().font,
      spread:SVGWorkshop.getTiming().spread,
      loaded:document.fonts.check('700 96px Caveat')
    })`);
    assert.ok(result.parts.startsWith('5 lettres'), result.parts);
    assert.equal(result.mode, 'parts');
    assert.equal(result.font, 'Caveat');
    assert.equal(result.loaded, true);
    assert.ok(result.spread > 0);
    assert.equal(result.text, 'ÉA\u0301Z\n42');
    const svg = await b.evaluate(`(async()=>{const blob=await SVGWorkshop.exportSVG(false);return await blob.text()})()`);
    assert.ok(svg.includes('<text'));
    assert.ok(svg.includes('data:font/woff2;base64,'));
    assert.ok(svg.includes('ÉA\u0301Z'));
    assert.ok(!svg.includes('url(./fonts/'));
  });

  await t.test('native SVG upload preserves gradients, group opacity and nested transforms', async () => {
    await click('[data-motion-source="svg"]');
    const doc = await b.call('DOM.getDocument');
    const input = await b.call('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#svg-workshop-file' });
    await b.call('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [file] });
    await b.waitFor(`SVGWorkshop.getDesign().kind==='svg'`);
    await ready();
    const result = await b.evaluate(`(async()=>{
      const d=SVGWorkshop.getDesign(),p=await SVGMotion.prepare(d);
      const original=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(${JSON.stringify(fixture)})});
      const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=512;a.height=b.height=512;
      const ac=a.getContext('2d'),bc=b.getContext('2d'),l=SVGMotionCore.layout(d,p.width,p.height);
      SVGMotion.render(ac,d,p,0,512,512,{neutral:true});bc.drawImage(original,l.x,l.y,p.width*l.scale,p.height*l.scale);
      const ap=ac.getImageData(0,0,512,512).data,bp=bc.getImageData(0,0,512,512).data;
      let diff=0;for(let i=0;i<ap.length;i++)diff+=Math.abs(ap[i]-bp[i]);
      return {parts:p.parts.length,diff:diff/ap.length,name:d.name,gradient:p.parts.some(part=>part.source?.includes('linearGradient')),
        fillDisabled:document.getElementById('svg-fill').disabled};
    })()`);
    assert.ok(result.parts >= 3, JSON.stringify(result));
    assert.ok(result.diff < 4, `Imported SVG differs from its native rendering by ${result.diff}`);
    assert.equal(result.gradient, true);
    assert.equal(result.name, 'transformed-gradient');
    assert.equal(result.fillDisabled, true);
    await click('#svg-preserve-colors');
    await edit('svg-fill', '#e11d48');
    await ready();
    assert.equal(await b.evaluate(`SVGWorkshop.getDesign().preserveColors`), false);
  });

  await t.test('unsafe SVG content is neutralized without external requests or script execution', async () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>window.__svgExecuted=true</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="https://external.invalid/test" onerror="window.__svgExecuted=true"/></div></foreignObject><style>.x{fill:url(https://external.invalid/paint)}</style><rect class="x" x="10" y="10" width="80" height="80" fill="#22c55e" onload="window.__svgExecuted=true"/><use href="https://external.invalid/a.svg#b"/></svg>`;
    assert.equal(await b.evaluate(`SVGWorkshop.importSVG(${JSON.stringify(source)},'SVG sécurisé')`), true);
    await ready();
    const result = await b.evaluate(`({
      executed:!!window.__svgExecuted,source:SVGWorkshop.getDesign().svg,
      measurementHosts:[...document.querySelectorAll('body > div')].filter(n=>n.style.left==='-20000px').length
    })`);
    assert.equal(result.executed, false);
    assert.equal(result.measurementHosts, 0);
    assert.ok(!/external\.invalid|<script|foreignObject|\bonload=/i.test(result.source));
    assert.equal(await b.evaluate(`SVGWorkshop.importSVG('<svg><bad>','Mauvais')`), false);
    assert.ok(await b.evaluate(`document.getElementById('svg-workshop-status').classList.contains('error')`));
    await click('[data-motion-source="shape"]');
    await click('[data-motion-shape="circle"]'); await ready();
  });

  await t.test('GIFs decode into changing frames with exact loop and transparency metadata', async () => {
    await b.evaluate(`(()=>{
      while(SVGWorkshop.getDesign().steps.length>1)document.querySelector('.motion-step:last-child [aria-label^="Supprimer"]').click();
      document.querySelector('.motion-step-select').click();
    })()`);
    await edit('svg-step-duration', .4);
    await edit('svg-step-hold', .1);
    await edit('svg-cycle-gap', .1);
    await edit('svg-export-size', 256, 'change');
    await edit('svg-export-fps', 12, 'change');
    const encoded = await b.evaluate(`(async()=>{
      const blob=await SVGWorkshop.exportGIF(false),bytes=new Uint8Array(await blob.arrayBuffer());
      const decoder=new ImageDecoder({type:'image/gif',data:bytes});await decoder.tracks.ready;
      const count=decoder.tracks.selectedTrack.frameCount,hashes=[];
      for(const frameIndex of [0,Math.floor(count/2),count-1]){
        const {image}=await decoder.decode({frameIndex}),c=document.createElement('canvas');c.width=c.height=256;
        const ctx=c.getContext('2d');ctx.drawImage(image,0,0);image.close();
        const pixels=ctx.getImageData(0,0,256,256).data;let hash=0;for(let i=0;i<pixels.length;i+=4)hash=(hash+pixels[i]*3+pixels[i+1]*5+pixels[i+2]*7)>>>0;
        hashes.push(hash);
      }
      decoder.close();let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);
      const loopAt=raw.indexOf('NETSCAPE2.0');
      return {type:blob.type,size:blob.size,count,hashes,repeat:loopAt<0?-1:bytes[loopAt+13]|bytes[loopAt+14]<<8,header:raw.slice(0,6),
        turbo:document.getElementById('svg-workshop-status').textContent.includes('Turbo')};
    })()`);
    assert.equal(encoded.header, 'GIF89a');
    assert.equal(encoded.type, 'image/gif');
    assert.ok(encoded.size > 1000);
    assert.ok(encoded.count >= 6);
    assert.ok(new Set(encoded.hashes).size >= 2);
    assert.equal(encoded.repeat, 0);
    assert.equal(encoded.turbo, true);
    await click('#svg-loop');
    await edit('svg-iterations', 3);
    await edit('svg-background', 'transparent', 'change');
    const transparent = await b.evaluate(`(async()=>{
      const blob=await SVGWorkshop.exportGIF(false),bytes=new Uint8Array(await blob.arrayBuffer());
      let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);const at=raw.indexOf('NETSCAPE2.0');
      const decoder=new ImageDecoder({type:'image/gif',data:bytes});await decoder.tracks.ready;
      const {image}=await decoder.decode({frameIndex:Math.floor(decoder.tracks.selectedTrack.frameCount/2)});
      const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);image.close();decoder.close();
      return {repeat:bytes[at+13]|bytes[at+14]<<8,alpha:ctx.getImageData(0,0,1,1).data[3],frames:Math.ceil(SVGWorkshop.getTiming().cycle*12)};
    })()`);
    assert.equal(transparent.repeat, 2);
    assert.equal(transparent.alpha, 0);
  });

  await t.test('standalone animated SVG is valid, script-free and actually animates in the browser', async () => {
    const result = await b.evaluate(`(async()=>{
      const blob=await SVGWorkshop.exportSVG(false),text=await blob.text(),doc=new DOMParser().parseFromString(text,'image/svg+xml');
      if(doc.querySelector('parsererror'))throw new Error(doc.querySelector('parsererror').textContent);
      const svg=document.importNode(doc.documentElement,true);svg.style.cssText='position:fixed;left:-10000px;top:0';
      document.body.append(svg);svg.pauseAnimations();
      const stroke=svg.querySelector('path[stroke-dasharray]');
      svg.setCurrentTime(.05);await new Promise(requestAnimationFrame);const first=getComputedStyle(stroke).strokeDashoffset;
      svg.setCurrentTime(.3);await new Promise(requestAnimationFrame);const second=getComputedStyle(stroke).strokeDashoffset;
      const result={type:blob.type,first,second,transforms:svg.querySelectorAll('animateTransform').length,repeat:svg.querySelector('animate').getAttribute('repeatCount'),
        script:!!svg.querySelector('script'),links:[...svg.querySelectorAll('image')].every(n=>n.getAttribute('href').startsWith('data:image/svg+xml;'))};
      svg.remove();return result;
    })()`);
    assert.equal(result.type, 'image/svg+xml');
    assert.notEqual(result.first, result.second);
    assert.ok(result.transforms >= 3);
    assert.equal(result.repeat, '3');
    assert.equal(result.script, false);
    assert.equal(result.links, true);
    const restored = await b.evaluate(`(async()=>{
      const before=SVGWorkshop.getDesign(),blob=await SVGWorkshop.exportSVG(false);
      const ok=await SVGWorkshop.importSVG(await blob.text(),'Réimport');
      return {ok,kind:SVGWorkshop.getDesign().kind,steps:SVGWorkshop.getDesign().steps.length,before:before.steps.length};
    })()`);
    await ready();
    assert.equal(restored.ok, true);
    assert.equal(restored.kind, 'shape');
    assert.equal(restored.steps, restored.before);
  });

  await t.test('a long GIF export cancels without a partial file and leaves controls usable', async () => {
    await edit('svg-step-duration', 60);
    await edit('svg-export-fps', 20, 'change');
    await click('#svg-export-gif');
    await b.waitFor(`SVGWorkshop.isExporting()`);
    await click('#svg-cancel-export');
    await b.waitFor(`!SVGWorkshop.isExporting()`);
    assert.deepEqual(await b.evaluate(`({
      files:__workshopDownloads.length,usable:!document.getElementById('svg-add-to-project').disabled,
      cancelled:document.getElementById('svg-workshop-status').textContent.toLowerCase().includes('annulé')
    })`), { files: 0, usable: true, cancelled: true });
  });

  await t.test('adding a long animated design preserves other layers and supports repeated undo/redo', async () => {
    const expectedDuration = await b.evaluate(`SVGWorkshop.getTiming().total`);
    await click('#svg-add-to-project');
    await b.waitFor(`!document.getElementById('svg-workshop-dialog').open && state.layers.some(l=>l.svgMotion)`);
    const result = await b.evaluate(`(()=>{
      const l=state.layers.find(l=>l.svgMotion),old=state.layers.find(l=>l.id===__originalMotionLayer.id);
      window.__motionLayerId=l.id;
      return {layers:state.layers.length,original:{id:old.id,x:old.x,y:old.y,name:old.name},before:__originalMotionLayer,
        duration:l.outPoint-l.inPoint,sceneDuration:TimelineStudio.getActiveScene().duration,motion:StudioUI.hasMotion(state.layers),
        prepared:!!SVGMotion.getPrepared(l.svgMotion),badge:!!document.querySelector('[data-svg-motion-layer="'+l.id+'"]')};
    })()`);
    assert.equal(result.layers, 2);
    assert.deepEqual(result.original, result.before);
    assert.ok(Math.abs(result.duration - expectedDuration) < .001);
    assert.ok(result.sceneDuration >= expectedDuration);
    assert.ok(expectedDuration > 100);
    assert.equal(result.motion, true); assert.equal(result.prepared, true); assert.equal(result.badge, true);
    for (let i = 0; i < 2; i++) {
      await b.evaluate(`undo()`);
      await b.waitFor(`state.layers.length===1 && !state.layers.some(l=>l.svgMotion)`);
      await b.evaluate(`redo()`);
      await b.waitFor(`state.layers.length===2 && state.layers.some(l=>l.svgMotion)`);
    }
  });

  await t.test('saved projects and reusable templates retain SVG motion after a page reload', async () => {
    await b.evaluate(`(async()=>{
      await StudioUI.saveAsTemplate('SVG animation complète');
      TimelineStudio.autoSaveToLocalStorage();saveProject();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(['projects'],'readonly'),req=tx.objectStore('projects').get(currentProjectId);
        req.onsuccess=()=>req.result?.state?.scenes[0]?.layers.some(l=>l.svgMotion)?resolve():reject(new Error('SVG motion not saved'));
        req.onerror=()=>reject(req.error);
      });
    })()`);
    await b.call('Page.reload');
    await b.waitFor(`document.getElementById('btn-svg-workshop') && state.layers.some(l=>l.svgMotion)`, 20000);
    const result = await b.evaluate(`(()=>{
      const l=state.layers.find(l=>l.svgMotion),sc=TimelineStudio.getActiveScene();
      const c=document.createElement('canvas');c.width=state.canvasW;c.height=state.canvasH;
      TimelineStudio.seekToGlobalTime(30);const frame=canvas.toDataURL();
      TimelineStudio.renderSceneCompositeToContext(c.getContext('2d'),sc,30,false);
      return {ready:!!SVGMotion.getPrepared(l.svgMotion),duration:l.svgMotion.steps[0].duration,exact:frame===c.toDataURL(),keys:l.keyframes.length};
    })()`);
    assert.deepEqual(result, { ready: true, duration: 60, exact: true, keys: 0 });
  });

  await t.test('saved SVG layers reopen for editing and new scenes append at the end for longer films', async () => {
    const id = await b.evaluate(`state.layers.find(l=>l.svgMotion).id`);
    await click(`[data-svg-motion-layer="${id}"]`); await ready();
    assert.equal(await b.evaluate(`document.getElementById('svg-add-to-project').textContent`), 'Mettre à jour le calque');
    await edit('svg-fill', '#0891b2'); await ready();
    await click('#svg-add-to-project');
    await b.waitFor(`!document.getElementById('svg-workshop-dialog').open`);
    assert.deepEqual(await b.evaluate(`({count:state.layers.length,fill:state.layers.find(l=>l.svgMotion).svgMotion.fill})`), { count: 2, fill: '#0891b2' });
    const firstId = await b.evaluate(`state.activeSceneId`);
    await click(`[data-svg-motion-layer="${id}"]`); await ready(); await click('#svg-append-scene');
    await b.waitFor(`state.scenes.length===2 && !document.getElementById('svg-workshop-dialog').open`);
    const secondId = await b.evaluate(`state.activeSceneId`);
    await click('#btn-svg-workshop'); await ready(); await click('#svg-append-scene');
    await b.waitFor(`state.scenes.length===3 && !document.getElementById('svg-workshop-dialog').open`);
    assert.deepEqual(await b.evaluate(`({
      ids:state.scenes.slice(0,2).map(s=>s.id),counts:state.scenes.map(s=>s.layers.length),
      duration:state.scenes.reduce((n,s)=>n+s.duration,0),activeLast:state.activeSceneId===state.scenes.at(-1).id
    })`).then(value => ({ ...value, duration: value.duration > 300 })), { ids: [firstId, secondId], counts: [2, 1, 1], duration: true, activeLast: true });
    await click('#btn-svg-workshop'); await ready();
    await edit('svg-step-duration', .4);
    await edit('svg-iterations', 1);
    await click('#svg-add-to-project');
    await b.waitFor(`!document.getElementById('svg-workshop-dialog').open`);
    assert.ok(await b.evaluate(`TimelineStudio.getActiveScene().duration<2`), 'Generated scenes should shrink with their only animation');
    await b.evaluate(`StudioUI.openLibrary('saved')`);
    await b.waitFor(`document.querySelector('[data-saved-template-id]')`);
    await b.evaluate(`document.querySelector('[data-saved-template-id]').click()`);
    await b.waitFor(`state.scenes.length===4 && !document.getElementById('assets-templates-dialog').open`);
    assert.equal(await b.evaluate(`state.layers.find(l=>l.svgMotion).svgMotion.steps[0].duration`), 60);
  });

  await t.test('project GIF, WebM and MP4 exporters capture the new SVG renderer', async st => {
    await b.evaluate(`(()=>{
      const sc=TimelineStudio.getActiveScene(),l=sc.layers.find(l=>l.svgMotion);
      l.inPoint=0;l.outPoint=.6;l.svgMotion.steps=[SVGMotionCore.step('float',{duration:.6,hold:0})];l.svgMotion.gap=0;l.svgMotion.iterations=1;
      sc.layers=[l];sc.groups=[];sc.selectedLayerId=l.id;sc.duration=.6;sc.transitionOut={type:'cut',duration:.6};
      state.scenes=[sc];state.layers=sc.layers;state.groups=[];state.playheadTime=0;
      TimelineStudio.applySceneToWorkingState(sc);
      window.__motionProjectFrames=new Set();window.__motionProjectDownloads=[];
      const original=SVGMotion.draw;
      SVGMotion.draw=function(c,d,t,w,h){if(state.recording)__motionProjectFrames.add(Math.round(t*1000));return original(c,d,t,w,h)};
      HTMLAnchorElement.prototype.click=function(){
        const item={name:this.download};__motionProjectDownloads.push(item);
        item.ready=fetch(this.href).then(r=>r.blob()).then(async b=>{
          item.type=b.type;item.size=b.size;item.header=[...new Uint8Array(await b.arrayBuffer()).slice(0,12)];
        });
      };
    })()`);
    for (const format of ['gif', 'webm', 'mp4']) {
      await st.test(format, async inner => {
        if (format === 'mp4' && !await b.evaluate(`(async()=>typeof VideoEncoder!=='undefined'&&(await VideoEncoder.isConfigSupported({codec:'avc1.42001f',width:1280,height:720,bitrate:4000000,framerate:30})).supported)()`)) {
          inner.skip('H.264 is unavailable in this Chromium build'); return;
        }
        const result = await b.evaluate(`(async()=>{
          __motionProjectFrames.clear();state.exportFormat=${JSON.stringify(format)};
          await TimelineStudio.exportSequentialProject(document.getElementById('export-progress-text'),document.getElementById('export-progress-bar'));
          const item=__motionProjectDownloads.at(-1);await item.ready;
          return {name:item.name,size:item.size,header:item.header,frames:__motionProjectFrames.size};
        })()`);
        assert.ok(result.name.endsWith(`.${format}`));
        assert.ok(result.size > 500); assert.ok(result.frames >= 3);
        if (format === 'gif') assert.equal(String.fromCharCode(...result.header.slice(0, 6)), 'GIF89a');
        if (format === 'webm') assert.deepEqual(result.header.slice(0, 4), [26, 69, 223, 163]);
        if (format === 'mp4') assert.equal(String.fromCharCode(...result.header.slice(4, 8)), 'ftyp');
      });
    }
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
});
