const test=require('node:test'),assert=require('node:assert');
const IL=require('./interlocking.js'),Core=require('./core.js'),N=require('./network.js');
test('overlap rule reproduces every case of the scripts',()=>{
 assert.deepEqual(IL.derivedOverlap('geumcheon','2B-6T').points,{'26':'N'});   // 전방 26B 정위 (안전측선 26BT 쪽)
 assert.deepEqual(IL.derivedOverlap('geumcheon','1B-1T').points,{'54':'R'});   // 54번 반위
 assert.deepEqual(IL.derivedOverlap('yeongdeungpo','1A-1T').points,{'57':'R'});// 4B 진로(57 정위)는 해정해야 함
 assert.deepEqual(IL.derivedOverlap('yongsan','2A-6T').points,{'26':'N'});     // 6번 통과: 출발을 먼저
 let routes=0;for(const s of N.stations.filter(s=>s.controlled))for(const id of Object.keys(s.routes))if(IL.derivedOverlap(s.id,id))routes++;
 assert.ok(routes>=30,'rule applies at many stations, not only the scripted ones');
});
test('용산 6번 통과: exit route first, then 장내; the other order is refused by the overlap',()=>{
 const C=Core.forStation('yongsan');
 let s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});
 assert.ok(C.dispatch(s,{type:'route',id:'3B-B605T'}).ok);assert.ok(C.dispatch(s,{type:'route',id:'2A-6T'}).ok);
 s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});
 assert.ok(C.dispatch(s,{type:'route',id:'2A-6T'}).ok);assert.equal(s.points['26'],'N');
 const r=C.dispatch(s,{type:'route',id:'3B-B605T'});assert.equal(r.ok,false);assert.match(r.message,/오버랩/);
 assert.equal(C.dispatch(s,{type:'point',id:'26',value:'R'}).ok,false);
});
test('approach section of every 장내 signal is the line circuit in rear of it',()=>{
 assert.deepEqual(IL.approachSection('yongsan','2A').codes,['B607T']);
 assert.deepEqual(IL.approachSection('geumcheon','2B').codes,['B641T']);
 for(const s of N.stations.filter(s=>s.controlled))for(const [id,sig] of Object.entries(s.signals))if(sig.kind==='장내')assert.ok(IL.approachSection(s.id,id).resources.length,`${s.name} ${id}`);
});
test('approach lock comes from the train in the section, not only from the manual flag',()=>{
 const C=Core.forStation('yongsan');
 const run=occupied=>{const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});C.dispatch(s,{type:'route',id:'2A-7T'});s.circuitOccupied=occupied;const r=C.dispatch(s,{type:'stop',id:'2A'});return {s,r};};
 let {s,r}=run({B607T:['A1002']});assert.match(r.message,/접근쇄정 90초/);assert.equal(s.routes['2A-7T'].status,'APPROACH_LOCK');
 C.dispatch(s,{type:'tick',seconds:90});assert.equal(s.routes['2A-7T'],undefined);
 ({s,r}=run({}));assert.equal(s.routes['2A-7T'],undefined);       // no train in rear: released at once
 ({s,r}=run({B608T:['X']}));assert.equal(s.routes['2A-7T'],undefined); // a train on another line does not count
});
