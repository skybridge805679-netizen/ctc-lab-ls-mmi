const test=require('node:test'),assert=require('node:assert');
const IL=require('./interlocking.js'),Core=require('./core.js'),N=require('./network.js');
test('overlap rule reproduces every case of the scripts',()=>{
 assert.deepEqual(IL.derivedOverlap('geumcheon','2B-6T').points,{'26':'N'});   // 전방 26B 정위 (안전측선 26BT 쪽)
 assert.deepEqual(IL.derivedOverlap('geumcheon','1B-1T').points,{'54':'R'});   // 54번 반위
 assert.deepEqual(IL.derivedOverlap('yeongdeungpo','1A-1T').points,{'57':'R'});// 4B 진로(57 정위)는 해정해야 함
 assert.deepEqual(IL.derivedOverlap('yongsan','2A-6T').points,{'26':'N'});     // 6번 통과: 출발을 먼저
 let routes=0;for(const s of N.stations.filter(s=>s.controlled))for(const id of Object.keys(s.routes))if(IL.derivedOverlap(s.id,id))routes++;
 assert.ok(routes>=12&&routes<30,'계산 규칙은 부본선 도착에만 남긴다 (본선 도착은 실물에서 확인한 것만) — '+routes);
});
test('용산 6번 통과: exit route first, then 장내; the other order is refused by the overlap',()=>{
 const C=Core.forStation('yongsan');
 let s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});
 assert.ok(C.dispatch(s,{type:'route',id:'3B-B605T'}).ok);assert.ok(C.dispatch(s,{type:'route',id:'2A-6T'}).ok);
 s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});
 assert.ok(C.dispatch(s,{type:'route',id:'2A-6T'}).ok);assert.equal(s.points['26'],'N');
 const r=C.dispatch(s,{type:'route',id:'3B-B605T'});assert.equal(r.ok,false);assert.match(r.message,/SW_\d+선로전환기 오방향 쇄정 상태/);
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
test('용산: 2A-7T and 4B-B610T stand together; 1B-3T locks point 52 so the refuge routes 2A-5T/2A-6T are refused (real LS, 2026-11-11)',()=>{
 const C=Core.forStation('yongsan'),fresh=()=>{const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});return s;},set=(s,id)=>C.dispatch(s,{type:'route',id});
 assert.deepEqual(C.routes['2A-7T'].pointPositions,{'51':'N','55':'N'});      // YT는 7T로 그대로 이어진다 — 51호 건넘선을 반위로 쓰지 않는다
 let s=fresh();assert.ok(set(s,'2A-7T').ok);assert.ok(set(s,'4B-B610T').ok);assert.ok(set(s,'1B-3T').ok);
 s=fresh();assert.ok(set(s,'1B-3T').ok);const r=set(s,'2A-5T');assert.equal(r.ok,false);assert.equal(r.message,'용산(010050)역 RT_2A_5T진로 22 요구중 SW_52선로전환기 오방향 쇄정 상태[수동진로설정불가]');
 assert.equal(set(s,'2A-6T').ok,false);
 s=fresh();assert.ok(set(s,'4B-B610T').ok);assert.equal(set(s,'2A-5T').ok,false);      // 원문: 상2선 2A-부본선과 하2선(1B-3T · 4B-B610T)의 상관관계
});
test('real LS observations of 2026-11-11: 안양 1A-2T locks point 55 against 4A-B984T; the seven pairs seen to stand together still do',()=>{
 const pair=(st,a,b)=>{const C=Core.forStation(st),s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});assert.ok(C.dispatch(s,{type:'route',id:a}).ok,st+' '+a);return C.dispatch(s,{type:'route',id:b});};
 const r=pair('anyang','1A-2T','4A-B984T');assert.equal(r.ok,false);assert.equal(r.message,'안양(010100)역 RT_4A_B984T진로 22 요구중 SW_55선로전환기 오방향 쇄정 상태[수동진로설정불가]');
 assert.ok(pair('anyang','4C-B660T','4A-B984T').ok);
 for(const [st,rules] of Object.entries(IL.parallel))for(const {routes:[a,b]} of rules)assert.ok(pair(st,a,b).ok,`${st} ${a} 설정 중 ${b}`);
 assert.equal(Object.values(IL.parallel).flat().length,20);
 // 2차 확인: 안양 1번선·2번선(55), 3번선은 없음. 용산 하선 도착은 51B까지. 문구가 가리키는 전환기도 실물과 같다
 const sw=(st,a,b)=>pair(st,a,b).message.replace(/.*요구중 /,'');
 assert.match(sw('anyang','1B-2T','4A-B984T'),/^SW_55선로전환기/);assert.match(sw('anyang','1A-2T','4A-B660T'),/^SW_55선로전환기/);assert.match(sw('anyang','1A-1T','4B-B984T'),/^SW_55선로전환기/);
 assert.match(sw('yongsan','2A-5T','1B-4T'),/^SW_51B선로전환기/);assert.match(sw('yongsan','1B-4T','2A-5T'),/^SW_51B선로전환기/);assert.match(sw('yongsan','1B-3T','2A-3T'),/^SW_51B선로전환기/);assert.match(sw('yongsan','1B-3T','2A-5T'),/^SW_52선로전환기/);
 // 대향진로: 같은 선에 반대 방향에서 들어오는 진로
 assert.equal(pair('geumcheon','2B-4T','1B-4T').message,'금천구청(010090)역 RT_1B_4T진로 요구중 대향진로( ) 설정상태 [수동진로설정불가]');
});
