'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');const {create}=require('./runtime.cjs');
test('the complete headless runtime owns controls, timetable, numbers and scenario movement',()=>{
 const r=create();r.command({type:'clock',paused:true});const model=r.snapshot().timetable,t=model.trains.find(t=>t.direction==='up'&&t.calls.some(c=>c.station==='yongsan'));
 assert.ok(r.command({type:'scenario:start',id:'yongsan-5',train:t.id}).ok);
 for(const action of [{type:'mode',value:'CCM'},{type:'stop',id:'2A'}])assert.ok(r.command({type:'control',station:'yongsan',action}).ok);
 r.command({type:'tick',seconds:90});assert.ok(r.command({type:'control',station:'yongsan',action:{type:'route',id:'2A-5T'}}).ok);
 assert.equal(r.snapshot().scenario.jobs[0].phase,'moving');r.command({type:'tick',seconds:60});
 assert.ok(r.snapshot().scenario.jobs.every(j=>j.phase==='done'));assert.ok(r.snapshot().ls.stations.yongsan.windows['5T'].some(row=>row.number===t.id));
 const train=r.snapshot().timetable.trains[0];assert.ok(r.command({type:'timetable',method:'delay',args:[train.id,train.calls[0].station,2]}).ok);assert.equal(r.snapshot().timetable.trains[0].calls[0].departure,train.calls[0].departure+120);
});
test('replay blocks authoritative commands and clock, while presentation cannot mutate the engine',()=>{
 const r=create(),copy=r.snapshot();copy.states.anyang.mode='CCM';assert.equal(r.snapshot().states.anyang.mode,'AUTO');r.command({type:'replay',on:true});r.pulse();assert.equal(r.snapshot().states.anyang.clock,0);assert.equal(r.command({type:'control',station:'anyang',action:{type:'mode',value:'CCM'}}).ok,false);r.command({type:'replay',on:false});r.pulse();assert.equal(r.snapshot().states.anyang.clock,1);
});
test('automatic running uses actual circuits without any UI callbacks',()=>{
 const r=create();r.command({type:'auto',enabled:true});for(let i=0;i<1200;i++)r.command({type:'tick',seconds:10});const s=r.snapshot();assert.equal(s.states.anyang.clock,12000);assert.equal(s.auto.troubles.length,0);assert.equal(s.auto.transits.length,0);assert.equal(s.auto.enabled,true);
});
test('line protection, single-line operation and equipment faults belong to the engine snapshot',()=>{
 const r=create(),Line=require('./line'),sec=Line.line.sections[0],key=sec.west+'>'+sec.east+':'+sec.trunk[0];
 assert.ok(r.command({type:'line',enforce:false,key,on:true}).ok);assert.deepEqual(r.snapshot().line,{enforce:false,single:[key]});
 r.command({type:'equipment',station:'anyang',name:'DTS1',on:true});assert.ok(r.snapshot().equipment.faults.includes('anyang/DTS1'));assert.ok(r.snapshot().events.some(e=>e.kind==='alarm'));
 r.command({type:'equipment',station:'anyang',name:'DTS1',on:false});assert.equal(r.snapshot().equipment.faults.length,0);assert.equal(r.snapshot().equipment.sent.length,1);
 r.command({type:'line',enforce:true,key,on:false});assert.deepEqual(r.snapshot().line,{enforce:true,single:[]});
});
test('all nine emergency scenarios initialise and evaluate without renderer callbacks',()=>{
 for(const sc of require('./emergency').list){const r=create();assert.ok(r.command({type:'scenario:start',id:sc.id}).ok,sc.id);r.command({type:'tick',seconds:10});assert.equal(r.snapshot().scenario.run.sc.id,sc.id);}
});
test('runtime and every transitive application dependency stay out of the UI directory',()=>{
 const fs=require('node:fs'),path=require('node:path'),visited=new Set();
 function walk(file){if(visited.has(file))return;visited.add(file);assert.ok(!file.includes(path.sep+'ui'+path.sep),file);const source=fs.readFileSync(file,'utf8');for(const [,name]of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){const dependency=require.resolve(path.resolve(path.dirname(file),name));walk(dependency);}}
 walk(require.resolve('./runtime.cjs'));assert.ok(visited.size>15);
});
test('manual LS relocation is immediate and cancels simulated progress for that number',()=>{
 const r=create(),t=r.snapshot().timetable.trains.find(t=>t.direction==='up'&&t.calls.some(c=>c.station==='yongsan'));
 r.command({type:'scenario:start',id:'yongsan-5',train:t.id});for(const action of [{type:'mode',value:'CCM'},{type:'stop',id:'2A'}])r.command({type:'control',station:'yongsan',action});r.command({type:'tick',seconds:90});r.command({type:'control',station:'yongsan',action:{type:'route',id:'2A-5T'}});
 let s=r.snapshot(),job=s.scenario.jobs.find(j=>j.phase==='moving');assert.ok(job);const row=Object.entries(s.ls.stations.yongsan.windows).find(([,rows])=>rows.some(t=>t.uid===job.uid));
 const moved=r.command({type:'numbers',action:{op:'move',station:'yongsan',slot:row[0],uid:job.uid,targetStation:'yongsan',targetSlot:'5T'}});assert.ok(moved.ok);assert.ok(!moved.pending);s=r.snapshot();assert.ok(s.ls.stations.yongsan.windows['5T'].some(t=>t.uid===job.uid));assert.equal(s.scenario.jobs.find(j=>j.uid===job.uid).phase,'cancelled');assert.ok(!Object.values(s.states.yongsan.routes).some(r=>r.train?.uid===job.uid));
 r.command({type:'tick',seconds:30});assert.ok(r.snapshot().ls.stations.yongsan.windows['5T'].some(t=>t.uid===job.uid));
});
test('spoken scenario events and real movement progress on the clock without check actions',()=>{
 const r=create();r.command({type:'scenario:start',id:'em-03'});let before=r.snapshot();r.command({type:'tick',seconds:600});const after=r.snapshot(),run=after.scenario.run;
 assert.ok(run.done.filter(Boolean).length>before.scenario.run.done.filter(Boolean).length);assert.ok(after.scenario.jobs.length>0);assert.ok(run.sc.steps.some((s,i)=>s.kind==='do'&&!run.done[i]),'actual operator controls are still required');assert.ok(!run.events.some(e=>e.type==='scenario:say'));
});
test('delta transport omits unchanged tables, preserves missed updates and resynchronises',()=>{
 const r=create(),full=r.transport();assert.equal(full.delta,false);assert.ok(full.timetable);const idle=r.transport(full.version,full.seq);assert.equal(idle.timetable,undefined);assert.ok(JSON.stringify(idle).length<100);
 r.command({type:'tick',seconds:1});r.command({type:'control',station:'anyang',action:{type:'mode',value:'CCM'}});const patch=r.transport(full.version,full.seq);assert.equal(patch.states.anyang.mode,'CCM');assert.equal(patch.states.anyang.clock,1);assert.equal(patch.timetable,undefined);assert.ok(r.transport(-1).timetable);
});
test('a checkpoint restores a moving scenario, controls, timetable and auto settings while paused',()=>{
 const r=create();r.command({type:'scenario:start',id:'em-03'});r.command({type:'tick',seconds:600});r.command({type:'auto',reflect:true});const saved=r.checkpoint(),n=create();n.restore(saved);const s=n.snapshot();assert.equal(s.clock.paused,true);assert.equal(s.states.anyang.clock,saved.states.anyang.clock);assert.equal(s.scenario.run.sc.id,'em-03');assert.deepEqual(s.scenario.jobs,saved.scenario.motion.jobs);assert.equal(s.auto.reflect,true);n.command({type:'tick',seconds:10});assert.equal(n.snapshot().states.anyang.clock,saved.states.anyang.clock+10);
});
test('scenario setup preserves the line-wide clock and zero-second refresh does not advance time',()=>{const r=create();r.command({type:'tick',seconds:123});r.command({type:'scenario:start',id:'em-03'});assert.ok(Object.values(r.snapshot().states).every(s=>s.clock===123));r.command({type:'tick',seconds:0});assert.ok(Object.values(r.snapshot().states).every(s=>s.clock===123));});
