'use strict';
const {_electron}=require('playwright'),{expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'orpheia-engine-'));let app;const errors=[];
(async()=>{
 const executablePath=process.env.ORPHEIA_PACKAGED_EXECUTABLE?path.resolve(process.env.ORPHEIA_PACKAGED_EXECUTABLE):require('electron');
 const args=process.env.ORPHEIA_PACKAGED_EXECUTABLE?['--orpheia-smoke-test']:[path.join(__dirname,'..'),'--orpheia-smoke-test'];if(process.env.ORPHEIA_TEST_NO_SANDBOX==='1')args.unshift('--no-sandbox');
 app=await _electron.launch({executablePath,args,env:{...process.env,ORPHEIA_TEST_USER_DATA:profile},timeout:60000});
 const ls=await app.firstWindow();ls.on('pageerror',e=>errors.push(String(e)));await ls.waitForFunction(()=>!!window.SimRemote&&!!window.SimWorkspace?.detached());
 const pid=await ls.evaluate(()=>SimRemote.snapshot.pid),renderer=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getOSProcessId());assert.notEqual(pid,renderer);
 await ls.evaluate(()=>SimRemote.command({type:'clock',paused:true}));
 await ls.selectOption('#lsStationSelect','geumcheon');await ls.locator('[data-mode="CCM"]').click();await ls.click('#dialogConfirm');await ls.locator('[data-point-control="51A"]').click();await expect(ls.locator('#actionDialog')).toContainText('SW_51A');await ls.click('#dialogConfirm');await ls.waitForFunction(()=>SimRemote.snapshot.states.geumcheon.points['52']==='R');await expect(ls.locator('[data-switch-connection="52"]')).toHaveAttribute('data-connected','true');
 const t=await ls.evaluate(()=>SimRemote.snapshot.timetable.trains.find(t=>t.direction==='up'&&t.calls.some(c=>c.station==='yongsan')).id);
 let mmi=app.windows().find(p=>p!==ls);await mmi.click('#mmiScenarioBtn');await mmi.selectOption('#scSelect','yongsan-5');await mmi.fill('#scTrain',t);await mmi.click('#scStart');
 for(const action of [{type:'mode',value:'CCM',source:'MMI'},{type:'stop',id:'2A',source:'LS'},{type:'tick',seconds:90},{type:'route',id:'2A-5T',source:'LS'}])assert.ok((await ls.evaluate(a=>SimMMI.run(a),action)).ok);
 assert.ok(await ls.evaluate(()=>SimRemote.snapshot.scenario.jobs.some(j=>j.phase==='moving')));
 await ls.evaluate(()=>SimMMI.run({type:'tick',seconds:60}));await expect(ls.locator('[data-train-slot="5T"]')).toContainText(t);
 await ls.evaluate(()=>SimMMI.open('schedule'));await mmi.selectOption('#scheduleKind','회송열차');await mmi.click('#scheduleApply');await mmi.click('#mmiAlertOk');
 await ls.evaluate(()=>{const sec=SimLine.line.sections[0];SimRemote.command({type:'line',key:sec.west+'>'+sec.east+':'+sec.trunk[0],on:true,enforce:false});SimEquipment.set('yongsan','N2',true);});
 const edited=await mmi.inputValue('#scheduleSelected');assert.equal(await ls.evaluate(id=>SimRemote.snapshot.timetable.trains.find(t=>t.id===id).kind,edited),'회송열차');
 assert.ok(await ls.evaluate(()=>SimRemote.command({type:'drill:create',options:{select:false}}).ok));
 // The native LS window can become a miniature desktop window without clipping.
 for(const [width,height]of [[1440,1000],[960,720],[640,480],[360,280],[1280,450]]){
  await app.evaluate(({BrowserWindow},b)=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('LS')).setBounds(b),{width,height});
  await expect.poll(()=>ls.evaluate(w=>innerWidth<=w&&innerWidth>w-50,width)).toBe(true);
  await expect.poll(()=>ls.evaluate(()=>Math.abs(document.querySelector('.ls-viewport').getBoundingClientRect().width-innerWidth))).toBeLessThan(2);
  await expect.poll(()=>ls.evaluate(()=>{const f=SimViewport.fit(innerWidth,innerHeight);return Math.abs(Number(document.querySelector('.ls-viewport').style.zoom)-f.scale);})).toBeLessThan(.00001);
  const metrics=await ls.evaluate(()=>{const svg=document.getElementById('trackSvg'),m=svg.getScreenCTM(),r=svg.getBoundingClientRect();return {x:m.a,y:m.d,left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:innerWidth,h:innerHeight,header:[...document.querySelectorAll('.top-actions button')].every(b=>b.getBoundingClientRect().right<=innerWidth+1)};});
  assert.ok(Math.abs(metrics.x-metrics.y)<.00001,JSON.stringify(metrics));assert.ok(metrics.left>=-1&&metrics.right<=metrics.w+1&&metrics.top>=0&&metrics.bottom<=metrics.h+1,JSON.stringify(metrics));assert.ok(metrics.header,JSON.stringify(metrics));
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('LS')).setBounds({width:1440,height:1000}));
 const before=await ls.evaluate(()=>{SimRemote.command({type:'clock',paused:false});return SimRemote.snapshot.states.yongsan.clock;});
 // Block the renderer deliberately: only the independent process can advance time.
 await ls.evaluate(()=>{const until=performance.now()+2200;while(performance.now()<until){};});
 await ls.evaluate(()=>SimRemote.poll());assert.ok(await ls.evaluate(clock=>SimRemote.snapshot.states.yongsan.clock>clock,before));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('LS')).close());
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('LS')).isVisible()),false);
 await ls.reload({waitUntil:'load'});await ls.waitForFunction(()=>!!window.SimRemote&&!!window.SimWorkspace?.detached());
 assert.equal(await ls.evaluate(()=>SimRemote.snapshot.pid),pid);assert.equal(await ls.evaluate(()=>SimRemote.snapshot.line.enforce),false);assert.ok(await ls.evaluate(()=>SimRemote.snapshot.line.single.length>0));assert.ok(await ls.evaluate(()=>SimEquipment.isFault('yongsan','N2')));assert.ok(await ls.evaluate(()=>SimDrill.baseline()?.length>0));assert.ok(await ls.evaluate(()=>SimRemote.command({type:'drill:grade'}).message.includes('경합')));await expect(ls.locator('[data-train-slot="5T"]')).toContainText(t);
 assert.equal(await ls.evaluate(id=>SimRemote.snapshot.timetable.trains.find(t=>t.id===id).kind,edited),'회송열차');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('LS')).show());
 assert.deepEqual(errors,[]);console.log(`PASS independent engine PID ${pid}, scenario motion, timetable persistence, renderer stall/close/reload survival and proportional native desktop resizing`);
 await app.close();app=null;
 const disk=require('./session-store.cjs').read(path.join(profile,'engine-session.orpheia'));assert.equal(disk.format,'ORPHEIA-SESSION');assert.equal(disk.timetable.trains.find(x=>x.id===edited).kind,'회송열차');
 app=await _electron.launch({executablePath,args,env:{...process.env,ORPHEIA_TEST_USER_DATA:profile},timeout:60000});
 const reopened=await app.firstWindow();reopened.on('pageerror',e=>errors.push(String(e)));await reopened.waitForFunction(()=>!!window.SimRemote&&!!window.SimWorkspace?.detached());
 assert.notEqual(await reopened.evaluate(()=>SimRemote.snapshot.pid),pid);assert.equal(await reopened.evaluate(()=>SimRemote.snapshot.clock.paused),true);await expect(reopened.locator('[data-train-slot="5T"]')).toContainText(t);assert.equal(await reopened.evaluate(id=>SimRemote.snapshot.timetable.trains.find(x=>x.id===id).kind,edited),'회송열차');assert.ok(await reopened.evaluate(()=>SimEquipment.isFault('yongsan','N2')));assert.deepEqual(errors,[]);
 console.log('PASS durable native restart restores train numbers, timetable, equipment and scenario into a new paused engine');await app.close();app=null;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(app)await app.close();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
