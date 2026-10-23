'use strict';
const {performance}=require('node:perf_hooks'),T=require('../simulator/engine/timetable'),N=require('../simulator/engine/network'),{create}=require('../simulator/engine/runtime.cjs');
const count=Number(process.argv[2]||10000),trains=[];
for(let i=0;i<count;i++){const start=i%(N.stations.length-1),group=Math.floor(i/(N.stations.length-1)),train=T.pattern({id:'K'+(10000+i),from:N.stations[start].id,to:N.stations[start+1].id,start:group*180});if(!T.valid(train))throw new Error('Invalid benchmark train');trains.push(train);}
const model={trains,serviceDate:'2026-10-23'},r=create();let start=performance.now();const imported=r.command({type:'timetable',method:'import',args:[model]}),importMs=performance.now()-start;if(!imported.ok)throw new Error(imported.message);
start=performance.now();const conflicts=T.conflicts(model),conflictMs=performance.now()-start;
start=performance.now();const full=r.transport(),fullMs=performance.now()-start,fullBytes=Buffer.byteLength(JSON.stringify(full));let idleBytes=0;start=performance.now();for(let i=0;i<1000;i++)idleBytes+=Buffer.byteLength(JSON.stringify(r.transport(full.version,full.seq)));const idleMs=(performance.now()-start)/1000;
start=performance.now();r.command({type:'tick',seconds:1});const patch=r.transport(full.version,full.seq),tickAndPatchMs=performance.now()-start,patchBytes=Buffer.byteLength(JSON.stringify(patch));if(patch.timetable)throw new Error('Unchanged timetable retransmitted');
console.log(JSON.stringify({platform:process.platform,node:process.version,trains:count,calls:trains.reduce((n,t)=>n+t.calls.length,0),conflicts:conflicts.length,importMs,conflictMs,fullMs,fullBytes,idlePollMs:idleMs,idlePollBytes:idleBytes/1000,tickAndPatchMs,patchBytes},null,2));
