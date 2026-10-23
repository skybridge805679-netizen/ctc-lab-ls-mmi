const assert=require('node:assert/strict');
const Core=require('./core.js'),MENUS=require('./route-menus.js');
let n=0;function test(name,fn){fn();console.log('PASS '+name);n++;}
test('verified signals offer exactly the transcribed LS routes, in list order',()=>{
 for(const [st,sigs] of Object.entries(MENUS)){const C=Core.forStation(st);assert.equal(C.menuVerified,st!=='yongsan');
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
test('stations without a verified list fall back to all derived routes of the signal',()=>{
 const C=Core.forStation('yongsan');assert.equal(C.menuVerified,false);
 for(const sig of Object.keys(C.signals))if(!MENUS.yongsan[sig])assert.deepEqual(C.lsMenu(sig),Object.keys(C.routes).filter(id=>C.routes[id].signal===sig));
 assert.deepEqual(C.lsMenu('3E'),['3E-B915T']);assert(C.menuVerifiedFor('3E'));assert(!C.menuVerifiedFor('4F'));
});
test('every listed route can be set and released',()=>{
 for(const st of Object.keys(MENUS)){const C=Core.forStation(st);
  for(const sig of Object.keys(C.signals))for(const id of C.lsMenu(sig)){const s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});assert(C.dispatch(s,{type:'route',id}).ok,st+' '+id);assert(C.dispatch(s,{type:'stop',id:sig}).ok);}}
});
console.log(n+' route-menu tests passed');
