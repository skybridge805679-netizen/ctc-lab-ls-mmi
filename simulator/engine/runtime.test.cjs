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
