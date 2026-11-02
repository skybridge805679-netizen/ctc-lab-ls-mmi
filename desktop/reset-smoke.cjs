'use strict';
const {_electron:electron}=require('playwright'),{expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Store=require('./session-store.cjs');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'orpheia-factory-reset-'));let app;
(async()=>{
 const packaged=process.env.ORPHEIA_PACKAGED_EXECUTABLE,args=packaged?['--orpheia-smoke-test']:[path.join(__dirname,'..'),'--orpheia-smoke-test'];if(process.env.ORPHEIA_TEST_NO_SANDBOX==='1')args.unshift('--no-sandbox');
 app=await electron.launch({executablePath:packaged?path.resolve(packaged):require('electron'),args,env:{...process.env,ORPHEIA_TEST_USER_DATA:profile},timeout:60000});
 const ls=await app.firstWindow();await ls.waitForFunction(()=>window.SimWorkspace?.detached());
 await ls.evaluate(()=>{
  SimRemote.command({type:'clock',paused:true});
  const library={version:1,problems:[{id:'P-RESET',subject:'비상 시 조치',name:'삭제 대상',limit:600,score:100,checks:[{condition:{type:'manual',label:'구술'}}],phenomena:[{type:'insertTrain',station:'uiwang',slot:'B1012T',number:'K7777',direction:'up'}]}],situations:[{id:'S-RESET',name:'추가 상황',problems:['P-RESET']}],scenarios:[{id:'SC-RESET',name:'추가 교육',situations:['S-RESET']}],schedules:[]};
  if(!SimRemote.command({type:'fts',op:'library',library}).ok)throw Error('seed library failed');
  if(!SimRemote.command({type:'fts',op:'start',scenario:'SC-RESET',professor:'001',student:'tester',autoRun:false}).ok)throw Error('seed training failed');
  SimRemote.command({type:'clock',paused:true});SimRemote.command({type:'tick',seconds:40});
  SimRemote.command({type:'control',station:'anyang',action:{type:'mode',value:'CCM'}});
  localStorage.setItem('orpheia.fts.library.v1',JSON.stringify(library));localStorage.setItem('ctclab-v03-completed','[1,2]');localStorage.setItem('orpheia.preferred',JSON.stringify({1:['suwon'],2:[],3:[]}));sessionStorage.setItem('reset-test','old');
  selectStation('uiwang');SimFTSUI.open();SimWorkspace.openGraph();OrpheiaEngine.openView('ls','guro');
 });
 await expect.poll(()=>app.windows().length).toBeGreaterThan(3);
 const prior=await ls.evaluate(()=>SimRemote.snapshot.states.uiwang.clock);
 ls.once('dialog',dialog=>dialog.dismiss());await ls.click('#resetBtn');assert.equal(await ls.evaluate(()=>SimRemote.snapshot.states.uiwang.clock),prior);assert.ok(await ls.evaluate(()=>SimRemote.snapshot.ftsLibrary.scenarios.some(s=>s.id==='SC-RESET')));
 ls.once('dialog',async dialog=>{assert.match(dialog.message(),/シナリオ|시나리오/);await dialog.accept();});await ls.click('#resetBtn');
 await ls.waitForFunction(()=>window.SimRemote?.snapshot.states.uiwang.clock===0&&!window.SimResetting,null,{timeout:15000});
 await ls.waitForFunction(()=>SimWorkspace.detached());await expect.poll(()=>app.windows().length).toBe(2);
 const s=await ls.evaluate(()=>SimRemote.snapshot);assert.equal(s.fts.session,null);assert.equal(s.fts.history.length,0);assert.ok(!s.ftsLibrary.scenarios.some(s=>s.id==='SC-RESET'));assert.equal(s.states.anyang.mode,'AUTO');assert.equal(s.clock.paused,true);assert.equal(s.auto.enabled,false);assert.equal(s.timetable.trains.length,0);assert.ok(Object.values(s.ls.stations).every(st=>Object.values(st.windows).every(rows=>rows.length===0)));
 assert.equal(await ls.evaluate(()=>localStorage.getItem('ctclab-v03-completed')),null);assert.equal(await ls.evaluate(()=>sessionStorage.getItem('reset-test')),null);assert.equal(await ls.evaluate(()=>localStorage.getItem('orpheia.preferred')),null);
 const mmi=app.windows().find(p=>p!==ls);await expect(mmi.locator('#mmiShell')).toBeVisible();await expect(mmi.locator('.mmi-appbar')).toHaveCount(0);await expect(ls.locator('#lsStationSelect,#guideBtn,#exportBtn,#previousStation,#nextStation')).toHaveCount(0);
 for(const file of ['engine-session.orpheia','engine-session.orpheia.bak']){const saved=Store.read(path.join(profile,file));assert.ok(!saved.fts.library.scenarios.some(s=>s.id==='SC-RESET'));assert.equal(saved.states.anyang.clock,0);}
 console.log('PASS native complete reset: cancel retains data; confirmed reset clears inserted training, all stations, local settings and both recovery files, closes extra views and rebuilds clean LS/MMI');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(app)await app.close().catch(()=>{});fs.rmSync(profile,{recursive:true,force:true});});
