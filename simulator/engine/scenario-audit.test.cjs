'use strict';
// 시나리오 검수(docs/시나리오-검수.md): 시작 배치와 시작 진로가 원문·배선에 맞는지 구조로 지킨다
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
 const leaves=(id,tag)=>E.list.find(s=>s.id===id).autos[tag].filter(a=>a.op==='delete'&&!a.dwell).map(a=>a.number);
 const extra=(id,tag)=>E.list.find(s=>s.id===id).autos[tag].filter(a=>a.op==='delete'&&a.dwell).map(a=>a.number+'+'+a.dwell);
 assert.deepEqual(leaves('em-04','n12'),['K1110','K1112','A1003','A0346','K1114','K1116','K1118']);
 // 「각 역 추가정차」 선행 열차도 LS에 서 있다가, 정상운행 지시(없으면 마지막 정상 운행 통보)에 떠난다
 const cast=id=>E.castFor(E.list.find(s=>s.id===id)).map(c=>c.number);
 for(const [id,held] of Object.entries({'em-01':['K1133','K1131','K1004','K1002'],'em-02':['K0605'],'em-03':['K0448','K0446','K0399'],'em-04':['K0807','K0805','K1110','K1112'],'em-05':['K1204','K1206'],'em-05-1':['K1204','K1206'],'em-06':['K0450','K0399'],'em-06-1':['K0450','K0399'],'em-06-2':['K0450','K0399']})){
  const sc=E.list.find(s=>s.id===id),gone=new Set(Object.values(sc.autos).flat().filter(a=>a.op==='delete').map(a=>a.number));
  for(const n of held){assert.ok(cast(id).includes(n),id+' '+n+' 배치');assert.ok(gone.has(n),id+' '+n+' 출발');}}
 assert.deepEqual(leaves('em-02','n12'),['K0607','K0605']);assert.deepEqual(leaves('em-03','n15'),['K0399']);
 for(const id of ['em-06','em-06-1','em-06-2'])assert.deepEqual(leaves(id,'n2'),['A1002']);
 assert.deepEqual(leaves('em-05-1','n3'),['A0168']);
 // 「각 역 n분 추가정차」 통보: 그 열차들은 그때부터 역마다 n분 더 서며 운행한다 (원문 그 줄의 열차·분)
 assert.deepEqual(extra('em-03','n6'),['K0448+300','K0446+300','K0399+300']);assert.deepEqual(extra('em-05','n3'),['K1206+180','K1204+180']);assert.deepEqual(extra('em-04','n5'),['K0807+180','K0805+180','K1112+180','K1110+180']);
 // 금천구청 1번 대피: 후속열차는 하1선에서 하2선 열번창으로 건너뛰지 않는다
 assert.deepEqual(S.list.find(s=>s.id==='geumcheon-1').beats.enter,[['follow1','3T'],['follow1',null,30]]);
});
test('a train told to leave runs on along its main line to the next stations instead of vanishing',()=>{
 const M=require('./scenario-motion.js'),path=(a,b,c)=>M.onward(a,b,c).map(l=>l.station+':'+l.slot);
 assert.deepEqual(path('anyang','3T','down').slice(0,4),['anyang:B660T','anyang:B666T','gunpo:B678T','gunpo:2T']);       // 하1선: 안양 → 명학 → 군포
 assert.equal(path('anyang','3T','down').at(-1),'suwon:4T');
 assert.deepEqual(path('gunpo','B1005T','up').slice(0,3),['gunpo:4T','gunpo:B999T','geumjeong:B997T']);                    // 당정(상2선) → 군포 → 금정
 assert.equal(path('jonggak','B060T','down')[1],'underground-seoul:1T');                                                    // 시청 하선 → 지하서울, 서울에서 전동차선으로 직결
 assert.ok(path('jonggak','B060T','down').includes('yongsan:1T'));
 assert.deepEqual(path('geumcheon','B967T','up'),['geumcheon:5T','geumcheon:B963T','guro:B959T','guro:B953T','guro:B953T']);     // 본선이 갈리는 구로는 장내 앞 열번창까지 가서 진로를 기다린다
 assert.deepEqual(M.onward('geumcheon','B967T','up').at(-1).follow,['4T','5T']);
 // 출발 폐색 열번창이 없는 역은 출발 진로를 지난 뒤에 넘어간다
 assert.equal(M.onward('geumcheon','3T','down')[0].exitCode,'B644T');
 // 승강장을 떠나기 전에 다음 역 장내 앞까지 비어 있어야 한다
 assert.equal(M.onward('anyang','3T','down')[0].clear,undefined);   // 폐색 하나씩 따라간다 (장내 앞까지 전부 비기를 기다리지 않는다)
});
