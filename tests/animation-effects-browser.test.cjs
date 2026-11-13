const test = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('./browser-utils.cjs');

test('50 GSAP effects render offline on SVG, PNG, text and Canvas shapes', { timeout: 180000 }, async t => {
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
  await b.call('Page.navigate', { url: process.env.SITE_URL || 'http://127.0.0.1:3000/' });
  await b.waitFor(`window.EffectManager && window.StudioUI && document.getElementById('studio-pen-tool') && currentProjectId`, 20000);

  await b.evaluate(`(async () => {
    const image=source=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=source});
    const bitmap=document.createElement('canvas');bitmap.width=160;bitmap.height=120;
    const c=bitmap.getContext('2d');c.fillStyle='#dc2626';c.beginPath();c.arc(80,60,44,0,Math.PI*2);c.fill();
    c.strokeStyle='#ffffff';c.lineWidth=7;c.beginPath();c.moveTo(50,25);c.lineTo(108,92);c.moveTo(50,88);c.lineTo(108,25);c.stroke();
    const png=await image(bitmap.toDataURL());
    const textCanvas=document.createElement('canvas');textCanvas.width=220;textCanvas.height=90;
    const tc=textCanvas.getContext('2d');tc.font='bold 28px Arial';tc.fillStyle='#172554';tc.fillText('Motion Studio',8,48);
    const text=await image(textCanvas.toDataURL());
    const vector=StudioAssets.getAssetById('rocket').vector;
    const svg=await image('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(StudioUI.vectorSVG(vector)));
    const makeLayer=(img,extra={})=>({img,x:90,y:70,w:160,h:120,baseW:160,baseH:120,rotation:0,resizePct:100,opacity:1,...extra});
    window.__effectFixtures={
      svg:makeLayer(svg,{vectorData:vector}),
      png:makeLayer(png),
      text:makeLayer(text,{w:220,h:90,baseW:220,baseH:90,_textContent:'Motion Studio',_textFont:'Arial',_textSize:28,_textBold:true}),
      shape:{x:90,y:70,width:160,height:120,scaleX:1,scaleY:1,rotation:0,opacity:1},
    };
    const canvas=document.createElement('canvas');canvas.width=480;canvas.height=300;
    window.__effectsCanvas=canvas;
    window.__effectPaint=(target)=>{
      const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
      if(target.img)StudioUI.drawLayer(c,target,{...target,trimPath:100});
      else {
        c.save();c.globalAlpha=target.opacity;c.translate(target.x+target.width/2,target.y+target.height/2);
        c.rotate(target.rotation*Math.PI/180);c.transform(1,Math.tan((target.skewY||0)*Math.PI/180),Math.tan((target.skewX||0)*Math.PI/180),1,0,0);
        c.scale(target.scaleX,target.scaleY);c.translate(-target.width/2,-target.height/2);
        EffectManager.render(c,target,output=>{output.fillStyle='#0d9488';output.beginPath();output.roundRect(18,20,124,80,16);output.fill();output.fillStyle='#fef3c7';output.fillRect(45,35,30,50);output.fillStyle='#172554';output.fillRect(95,40,18,40)},target.width,target.height);
        c.restore();
      }
      return canvas.toDataURL();
    };
  })()`);

  for (const kind of ['svg', 'png', 'text', 'shape']) {
    await t.test(`all 50 effects produce finite, changing and reproducible ${kind} frames`, async () => {
      const result = await b.evaluate(`(() => {
        const target=window.__effectFixtures['${kind}'],failures=[],unchanged=[];
        let total=0;
        for(const entry of EffectManager.catalog) {
          const adapter={renderAll(){window.__effectPaint(target)}};
          const before=window.__effectPaint(target);
          const tl=EffectManager.apply(target,entry.name,.8,{paused:true,repeat:0,canvas:adapter,cursor:false,seed:23});
          if(!(tl instanceof gsap.core.Timeline))failures.push(entry.name+':not-timeline');
          const frames=[];
          for(const progress of [.18,.37,.63]) {
            tl.progress(progress,false);
            frames.push(window.__effectPaint(target));
            for(const [key,value]of Object.entries(tl.data.state))if(key!=='_gsap'&&!Number.isFinite(value))failures.push(entry.name+':'+key);
          }
          if(frames.every(frame=>frame===before))unchanged.push(entry.name);
          tl.progress(.37,false);const first=window.__effectPaint(target);
          tl.progress(.7,false);tl.progress(.37,false);const second=window.__effectPaint(target);
          if(first!==second)failures.push(entry.name+':non-deterministic');
          tl.progress(1,false);EffectManager.stop(target);
          const after=window.__effectPaint(target);
          if(before!==after)failures.push(entry.name+':not-restored');
          total++;
        }
        return {total,failures,unchanged};
      })()`);
      assert.equal(result.total, 50);
      assert.deepEqual(result.failures, []);
      assert.deepEqual(result.unchanged, []);
    });
  }

  await t.test('flash and spotlight stay masked to the object rather than painting its background', async () => {
    const result = await b.evaluate(`(() => {
      const target=__effectFixtures.png,c=__effectsCanvas.getContext('2d'),data=[];
      for(const name of ['Flash Bang','Spotlight Sweep']){
        const tl=EffectManager.apply(target,name,.8,{paused:true,glow:0,canvas:{renderAll(){__effectPaint(target)}}});
        tl.progress(name==='Flash Bang'?.12:.5,false);
        __effectPaint(target);
        const corner=[...c.getImageData(target.x+2,target.y+2,1,1).data];
        data.push({name,alpha:corner[3]});
        EffectManager.stop(target);
      }
      return data;
    })()`);
    for (const { name, alpha } of result) assert.equal(alpha, 0, name);
  });

  await t.test('Fabric render protocol applies the same effects without losing its renderer or cache configuration', async () => {
    const result = await b.evaluate(`(() => {
      const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300;const c=canvas.getContext('2d');
      let renders=0;
      const proto={
        set(values){Object.assign(this,values);return this},
        setCoords(){},
        getCenterPoint(){return {x:this.left,y:this.top}},
        setPositionByOrigin(point){this.left=point.x;this.top=point.y},
        _render(ctx){ctx.fillStyle='#1d4ed8';ctx.fillRect(-this.width/2,-this.height/2,this.width,this.height);ctx.fillStyle='#fef08a';ctx.fillRect(-15,-20,30,40)},
      };
      const object=Object.assign(Object.create(proto),{left:180,top:130,width:140,height:90,scaleX:1,scaleY:1,opacity:1,angle:0,objectCaching:true});
      object.canvas={renderAll(){renders++;c.clearRect(0,0,400,300);c.save();c.translate(object.left,object.top);c.rotate(object.angle*Math.PI/180);c.scale(object.scaleX,object.scaleY);c.globalAlpha=object.opacity;object._render(c);c.restore()}};
      const original=object._render,failures=[];
      for(const entry of EffectManager.catalog) {
        const tl=EffectManager.apply(object,entry.key,.8,{paused:true,repeat:0});
        tl.progress(.37,false);object.canvas.renderAll();
        if(!Number.isFinite(object.left)||!Number.isFinite(object.angle))failures.push(entry.name);
        EffectManager.stop(object);
        if(object._render!==original||object.objectCaching!==true)failures.push(entry.name+':cleanup');
      }
      return {renders,failures};
    })()`);
    assert.ok(result.renders > 100);
    assert.deepEqual(result.failures, []);
  });

  await t.test('the application canvas renders GSAP layer effects through onUpdate and survives stopping them', async () => {
    const result = await b.evaluate(`(async () => {
      await StudioUI.insertAsset('rocket');
      const l=getSelectedLayer(),before=canvas.toDataURL();
      const tl=EffectManager.apply(l,'Wipe Right',.8,{paused:true});
      tl.progress(.3,false);const changed=canvas.toDataURL()!==before;
      tl.progress(1,false);
      EffectManager.stopAll();
      const restored=canvas.toDataURL()===before;
      const moving=EffectManager.apply(l,'Liquid Float',.8);
      await new Promise(resolve=>setTimeout(resolve,120));
      const autoPlaying=!moving.paused()&&Math.abs(EffectManager.state(l).y)>.01;
      EffectManager.stopAll();
      return {changed,restored,autoPlaying,cleared:!EffectManager.has(l)};
    })()`);
    assert.deepEqual(result, { changed: true, restored: true, autoPlaying: true, cleared: true });
  });

  await b.evaluate(`EffectManager.stopAll();gsap.ticker.sleep()`);
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
});
