'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fork}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
function launch(file){const child=fork(path.join(__dirname,'engine-process.cjs'),[file],{stdio:['ignore','ignore','ignore','ipc']}),pending=new Map();let serial=0;const ready=new Promise(resolve=>child.on('message',m=>{if(m.ready)resolve();const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);p.resolve(m);}}));return {ready,request(action){return new Promise(resolve=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);resolve({error:'timeout'});},5000);pending.set(id,{resolve,timer});child.send({id,action,since:0,version:-1});});},stop:()=>new Promise(resolve=>{child.once('exit',resolve);child.kill();})};}
test('the process restores a valid backup after a corrupt autosave and rejects a malformed session atomically',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orpheia-process-')),file=path.join(dir,'state.orpheia');let engine=launch(file);
 try{await engine.ready;await engine.request({type:'clock',paused:true});await engine.request({type:'tick',seconds:600});assert.ok((await engine.request({type:'session:persist'})).result.ok);await engine.request({type:'tick',seconds:10});await engine.request({type:'session:persist'});await engine.stop();engine=null;
  const bytes=fs.readFileSync(file);bytes[bytes.length-1]^=1;fs.writeFileSync(file,bytes);engine=launch(file);await engine.ready;let reply=await engine.request({type:'poll'});assert.equal(reply.snapshot.states.anyang.clock,600);assert.equal(reply.snapshot.clock.paused,true);
  const bad=path.join(dir,'bad.orpheia');fs.writeFileSync(bad,'broken');assert.ok((await engine.request({type:'session:open',file:bad})).error);reply=await engine.request({type:'poll'});assert.equal(reply.snapshot.states.anyang.clock,600);
 }finally{if(engine)await engine.stop();fs.rmSync(dir,{recursive:true,force:true});}
});

test('factory reset clears all training data and both recovery files survive restart cleanly',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orpheia-reset-')),file=path.join(dir,'state.orpheia'),Store=require('./session-store.cjs');let engine=launch(file);
 const library={version:1,problems:[{id:'P-RESET',subject:'비상 시 조치',name:'삭제 대상',limit:600,score:100,checks:[{condition:{type:'manual',label:'구술'}}],phenomena:[{type:'insertTrain',station:'uiwang',slot:'B1012T',number:'K7777',direction:'up'}]}],situations:[{id:'S-RESET',name:'추가 상황',problems:['P-RESET']}],scenarios:[{id:'SC-RESET',name:'추가 교육',situations:['S-RESET']}],schedules:[]};
 try{await engine.ready;await engine.request({type:'clock',paused:true});
  assert.ok((await engine.request({type:'fts',op:'library',library})).result.ok);
  assert.ok((await engine.request({type:'fts',op:'start',scenario:'SC-RESET',professor:'001',student:'tester',autoRun:false})).result.ok);
  await engine.request({type:'control',station:'anyang',action:{type:'mode',value:'CCM'}});
  await engine.request({type:'equipment',station:'anyang',name:'DTS1',on:true});
  await engine.request({type:'tick',seconds:40});await engine.request({type:'session:persist'});await engine.request({type:'session:persist'});
  assert.equal(Store.read(file+'.bak').fts.library.scenarios[0].id,'SC-RESET');
  const reply=await engine.request({type:'session:reset'});assert.ok(reply.result.ok);assert.equal(reply.snapshot.delta,false);
  function clean(s){assert.equal(s.clock.paused,true);assert.equal(s.states.anyang.mode,'AUTO');assert.equal(s.states.anyang.clock,0);assert.equal(s.fts.session,null);assert.equal(s.fts.history.length,0);assert.ok(!s.ftsLibrary.scenarios.some(x=>x.id==='SC-RESET'));assert.equal(s.equipment.faults.length,0);assert.equal(s.auto.enabled,false);assert.equal(s.scenario.run,null);assert.ok(Object.values(s.ls.stations).every(st=>Object.values(st.windows).every(rows=>rows.length===0)));assert.equal(s.timetable.trains.length,12);}
  clean(reply.snapshot);
  for(const name of [file,file+'.bak']){const saved=Store.read(name);assert.ok(!saved.fts.library.scenarios.some(x=>x.id==='SC-RESET'));assert.equal(saved.states.anyang.clock,0);}
  await engine.stop();engine=null;
  // Corrupt the primary file: even fallback must not resurrect the erased education.
  fs.writeFileSync(file,'broken');engine=launch(file);await engine.ready;clean((await engine.request({type:'poll'})).snapshot);
 }finally{if(engine)await engine.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
