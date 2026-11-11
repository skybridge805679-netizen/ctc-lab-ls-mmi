'use strict';
// 시나리오 검수(docs/시나리오-검수-v0.39.45.md): 시작 배치와 시작 진로가 원문·배선에 맞는지 구조로 지킨다
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('./emergency.js'),B=require('./fts-builtins.js'),W=require('./wiring.js'),L=require('./line.js'),Core=require('./core.js'),S=require('./scenarios.js');
const problems=B.emergency({});
const lineOf=(station,slot)=>{const rail=W.data[station]?.rails.find(r=>r[0]===slot),t=L.trunkOf(slot)||L.trunkOf(rail?.[3])||L.trunkOf(rail?.[4]);return t?t[0]:null;};
test('emergency casts: one train per window at the start, 일반열차(A) on the 1선(G) and 전동열차(K) on the 2선(E·M)',()=>{
 for(const sc of E.list){const seen=new Set();
  for(const c of E.castFor(sc)){const key=c.station+'|'+c.slot;assert.ok(!seen.has(key),`${sc.id}: ${key}에 두 열차`);seen.add(key);
   const line=lineOf(c.station,c.slot);assert.ok(line,`${sc.id} ${c.number}: ${key} 선별 확인 불가`);
   if(c.number.startsWith('A'))assert.equal(line,'G',`${sc.id} ${c.number} ${key}`);else assert.ok(['E','M'].includes(line),`${sc.id} ${c.number} ${key}`);}}
});
test('emergency setup routes are the normal route of each signal: no crossover or siding route stands before the student acts',()=>{
 const fallback=new Set(['guro|3A-B949T']);   // 구로 3A는 선로 끝이 폐색이 아니어서(AT) 예전 방식으로 고른다
 for(const p of problems)for(const {station,route} of p.setup.routes){const sig=Core.forStation(station).routes[route].signal;
  assert.ok(E.straightRoute(station,sig)===route||fallback.has(station+'|'+route),`${p.id}: ${station} ${route}`);}
 const of=id=>problems.find(p=>p.id===id).setup.routes.map(r=>r.station+':'+r.route);
 assert.deepEqual(of('P-em-03'),['anyang:3B-B981T','anyang:3C-B655T','geumcheon:2A-5T']);
 assert.deepEqual(of('P-em-04'),['anyang:4B-B984T','gunpo:1A-1T','gunpo:1B-2T']);
 assert.ok(of('P-em-02').includes('jonggak:2A-2T'));
});
test('trains told to leave in the source scripts have a movement cue',()=>{
 const leaves=(id,tag)=>E.list.find(s=>s.id===id).autos[tag].filter(a=>a.op==='delete').map(a=>a.number);
 assert.deepEqual(leaves('em-04','n12'),['A1003','A0346','K1114','K1116','K1118']);
 for(const id of ['em-06','em-06-1','em-06-2'])assert.deepEqual(leaves(id,'n2'),['A1002']);
 assert.deepEqual(leaves('em-05-1','n3'),['A0168']);
 // 금천구청 1번 대피: 후속열차는 하1선에서 하2선 열번창으로 건너뛰지 않는다
 assert.deepEqual(S.list.find(s=>s.id==='geumcheon-1').beats.enter,[['follow1','3T'],['follow1',null,30]]);
});
