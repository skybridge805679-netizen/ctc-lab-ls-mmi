const assert=require('node:assert/strict');
const Core=require('./core.js'),MENUS=require('./route-menus.js');
// 사용자 목록(2026-10-29)에 일부 신호기가 빠진 역: 빠진 신호기는 도출 진로 전체를 보여 준다.
const PARTIAL=['yeongdeungpo','guro','geumcheon'];
let n=0;function test(name,fn){fn();console.log('PASS '+name);n++;}
test('verified signals offer exactly the transcribed LS routes, in list order',()=>{
 for(const [st,sigs] of Object.entries(MENUS)){const C=Core.forStation(st);assert.equal(C.menuVerified,!PARTIAL.includes(st),st);
  for(const [sig,dests] of Object.entries(sigs))assert.deepEqual(C.lsMenu(sig),dests.map(d=>sig+'-'+d),st+' '+sig);}
});
test('user-confirmed cases: Underground Seoul 3A has only RT_3A_B065T; Cheongnyangni 4B -> B002T; Seoul 54 -> B902T, BT',()=>{
 assert.deepEqual(Core.forStation('underground-seoul').lsMenu('3A'),['3A-B065T']);
 assert.deepEqual(Core.forStation('cheongnyangni').lsMenu('4B'),['4B-B002T']);
 assert.deepEqual(Core.forStation('seoul').lsMenu('54'),['54-B902T','54-BT']);
});
test('the MMI list still has every derived route, including 3A-B070T from the manual',()=>{
 assert(Core.forStation('underground-seoul').routes['3A-B070T']);
});
test('signals missing from a station list fall back to all derived routes of the signal',()=>{
 const C=Core.forStation('guro');assert.equal(C.menuVerified,false);
 for(const sig of Object.keys(C.signals))if(!MENUS.guro[sig])assert.deepEqual(C.lsMenu(sig),Object.keys(C.routes).filter(id=>C.routes[id].signal===sig));
 assert.deepEqual(C.lsMenu('4A'),['4A-B950T','4A-F1T','4A-F2T']);assert(C.menuVerifiedFor('4A'));assert(!C.menuVerifiedFor('53'));
});
test('user notes 2026-10-29: yard circuits and the Uiwang 2T->3T crossover give the listed routes',()=>{
 assert.deepEqual(Core.forStation('suwon').lsMenu('23'),['23-XT','23-AT']);
 assert.deepEqual(Core.forStation('uiwang').lsMenu('4A'),['4A-B1014T','4A-B692T']);
 assert.deepEqual(Core.forStation('uiwang').lsMenu('4C'),['4C-B692T']);
 assert.deepEqual(Core.forStation('geumcheon').lsMenu('53'),['53-54T1T']);
 assert.deepEqual(Core.forStation('yongsan').lsMenu('1B'),['1B-1T','1B-2T','1B-3T','1B-4T','1B-5T','1B-6T']);
});
test('every listed route can be set and released',()=>{
 for(const st of Object.keys(MENUS)){const C=Core.forStation(st);
  for(const sig of Object.keys(C.signals))for(const id of C.lsMenu(sig)){const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});assert(C.dispatch(s,{type:'route',id}).ok,st+' '+id);assert(C.dispatch(s,{type:'stop',id:sig}).ok);}}
});
console.log(n+' route-menu tests passed');
