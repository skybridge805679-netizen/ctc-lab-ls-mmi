const assert=require('node:assert/strict');
const N=require('./network.js'),C=require('./core.js');
let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++;}
function ccm(id){const core=C.forStation(id),state=core.initial();core.dispatch(state,{type:'mode',value:'CCM'});return {core,state};}
test('all 15 stations expose all traced train and shunt signals with visible, lockable routes',()=>{
 let signals=0,routes=0;
 for(const st of N.stations.filter(s=>s.controlled)){
  signals+=Object.keys(st.signals).length;
  for(const signal of Object.keys(st.signals))assert(Object.values(st.routes).some(r=>r.signal===signal),st.id+' '+signal);
  for(const [id,r]of Object.entries(st.routes)){
   routes++;assert.equal(st.map.paths[id],r.path);assert(r.resources.length>0);assert(r.path.startsWith('M'));assert(!r.path.includes('NaN'));
   for(const p of r.pointLocks)assert(st.points[p],st.id+' '+p);
   const {core,state}=ccm(st.id);assert(core.dispatch(state,{type:'route',id}).ok);
   for(const p of r.pointLocks)assert.equal(core.dispatch(state,{type:'point',id:p,value:'R'}).ok,false);
   assert(core.dispatch(state,{type:'occupy',id}).ok);assert.equal(state.signals[r.signal],'STOP');
   assert(core.dispatch(state,{type:'stop',id:r.signal}).ok);assert.equal(state.routes[id].status,'LOCKED');
   assert(core.dispatch(state,{type:'clear',id}).ok);assert.deepEqual(state.routes,{});assert.deepEqual(state.occupied,{});
  }
 }
 assert(signals>200);assert(routes>500);console.log('Verified '+signals+' signals / '+routes+' geometric routes');
});
test('Anyang and Geumcheon refuge tracks and Suwon terminal tracks are reachable',()=>{
 for(const [station,ids]of Object.entries({anyang:['1A-1T','1A-2T','1B-3T','2B-4T','2A-5T','2A-6T'],yongsan:['2A-7T','4F-B610T','2A-4T'],geumcheon:['1A-1T','1A-2T','2A-5T','2A-6T'],suwon:['1A-1T','1A-2T','1A-3T','1B-4T','3A-B1035T','3G-B1036T'],dongmyo:['24-B015T'],jonggak:['53-B045T','51-1T'],'underground-seoul':['21-1T']})){
  for(const id of ids)assert(N.catalog[station].routes[id],station+' '+id);
 }
});
test('independent routes coexist; a shared throat rejects conflicts without changing the first route',()=>{
 const {core,state}=ccm('anyang');
 assert(core.dispatch(state,{type:'route',id:'1A-1T'}).ok);
 assert(core.dispatch(state,{type:'route',id:'2A-5T'}).ok);
 const before=structuredClone(state.routes);
 assert.equal(core.dispatch(state,{type:'route',id:'1A-2T'}).ok,false);
 assert.deepEqual(state.routes,before);
 core.dispatch(state,{type:'stop',id:'1A'});assert(state.routes['2A-5T']);
});
test('point movement outside a set route remains available and manual locks reject routes',()=>{
 const {core,state}=ccm('underground-seoul');core.dispatch(state,{type:'route',id:'3A-B065T'});
 assert(core.dispatch(state,{type:'point',id:'51',value:'R'}).ok);
 assert.equal(core.dispatch(state,{type:'point',id:'21',value:'R'}).ok,false);
 core.dispatch(state,{type:'stop',id:'3A'});core.dispatch(state,{type:'pointLock',id:'21',lock:true});
 assert.equal(core.dispatch(state,{type:'route',id:'3A-B065T'}).ok,false);
 core.dispatch(state,{type:'pointLock',id:'21',lock:false});assert(core.dispatch(state,{type:'route',id:'3A-B065T'}).ok);
});
test('continuous route re-arms after passage; all-stop suppresses re-arm and preserves occupied locks',()=>{
 const {core,state}=ccm('anyang'),id='1A-1T';
 core.dispatch(state,{type:'route',id,control:'continuous'});core.dispatch(state,{type:'occupy',id});core.dispatch(state,{type:'clear',id});
 assert.equal(state.routes[id].status,'SET');assert.equal(state.signals['1A'],'GO');
 core.dispatch(state,{type:'occupy',id});core.dispatch(state,{type:'stopAll'});assert.equal(state.routes[id].status,'LOCKED');
 core.dispatch(state,{type:'clear',id});assert.deepEqual(state.routes,{});assert.equal(state.signals['1A'],'STOP');
});
test('Guro crossing structures do not join unrelated upper and lower tracks',()=>{
 assert.deepEqual(N.catalog.yongsan.routes['2A-7T'].geometryRails,['YT','7T']);
 const r=N.catalog.guro.routes['2A-5T'];assert(r);assert.deepEqual(r.geometryRails,['5T']);
 assert(!N.catalog.guro.routes['1A-3T']);
});
console.log(count+' wiring tests passed');
