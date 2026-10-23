const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const N=require('./network.js'),C=require('./core.js'),T=require('./timetable.js');
let tests=0;
function test(name,fn){fn();tests++;console.log('PASS '+name);}
test('all 33 stations and 15 controlled stations have source assets',()=>{
 assert.equal(N.stations.length,33);assert.equal(new Set(N.stations.map(s=>s.id)).size,33);
 assert.equal(N.stations.filter(s=>s.controlled).length,15);
 for(const station of N.stations)assert(fs.existsSync(path.join(__dirname,'..',station.image)),station.name);
});
test('new PDF coordinate maps cover every station signal within its source registration window',()=>{
 for(const station of N.stations.filter(s=>s.controlled)){
  assert(station.image.startsWith('assets/line-map/'));assert([2,3,4].includes(station.map.page));
  const [x,y,w,h]=station.map.referenceWindow;
  for(const id of Object.keys(C.forStation(station.id).signals)){
   const point=station.map.signals[id];assert(point,station.name+' '+id);
   assert(point.x>=x&&point.x<=x+w&&point.y>=y&&point.y<=y+h,station.name+' '+id);
  }
  assert.equal(station.map.modes.length,3);
 }
});
test('every catalogued route sets, blocks point movement, cancels and releases',()=>{
 for(const station of N.stations.filter(s=>s.controlled)){
  const core=C.forStation(station.id);
  assert(Object.keys(core.routes).length>0,station.name);
  for(const id of Object.keys(core.routes)){
   const state=core.initial();assert.equal(core.dispatch(state,{type:'route',id}).ok,false);
   core.dispatch(state,{type:'mode',value:'CCM'});
   assert(core.dispatch(state,{type:'route',id}).ok,station.name+' '+id);
   assert.equal(state.signals[core.routes[id].signal],'GO');
   const point=core.routes[id].pointLocks[0];
   if(point)assert.equal(core.dispatch(state,{type:'point',id:point,value:'R'}).ok,false);
   core.dispatch(state,{type:'cancel',target:'stop'});assert(state.routes[id]);
   assert(core.dispatch(state,{type:'stop',id:core.routes[id].signal}).ok);
   assert.deepEqual(state.routes,{});
  }
 }
});
test('station state is independent and noninterlocked stations reject controls',()=>{
 const core=C.forStation('guro'),a=core.initial(),b=C.forStation('guro').initial();
 core.dispatch(a,{type:'mode',value:'CCM'});core.dispatch(a,{type:'route',id:'1A-1T'});
 assert.deepEqual(b.routes,{});assert.equal(b.mode,'AUTO');
 for(const station of N.stations.filter(s=>!s.controlled)){
  const c=C.forStation(station.id),s=c.initial();
  assert.equal(c.dispatch(s,{type:'mode',value:'CCM'}).ok,false);
  assert(c.dispatch(s,{type:'scan',scope:'current'}).ok);
 }
 assert.throws(()=>C.forStation('not-a-station'),RangeError);
});
test('train plans cover every station in opposite monotonic orders',()=>{
 const model=T.initial();assert.equal(model.trains.length,12);
 for(const t of model.trains){
  assert.equal(t.calls.length,33);
  for(let i=0;i<t.calls.length;i++){
   assert(t.calls[i].arrival<=t.calls[i].departure);
   if(i)assert(t.calls[i].arrival>t.calls[i-1].departure);
  }
  const orders=t.calls.map(c=>N.catalog[c.station].order);
  assert.deepEqual(orders,t.direction==='down'?Array.from({length:33},(_,i)=>i):Array.from({length:33},(_,i)=>32-i));
 }
});
test('delay affects selected and subsequent calls only, leaving plan and other trains intact',()=>{
 const model=T.initial(),before=structuredClone(model),train=model.trains[0];
 assert(T.delay(model,train.id,train.calls[10].station,2).ok);
 train.calls.forEach((call,i)=>{assert.equal(call.arrival,before.trains[0].calls[i].arrival+(i<10?0:120));assert.equal(call.departure,before.trains[0].calls[i].departure+(i<10?0:120));});
 assert.deepEqual(train.plan,before.trains[0].plan);assert.deepEqual(model.trains.slice(1),before.trains.slice(1));
 const snapshot=structuredClone(model);
 for(const [id,station,minutes]of [['missing','guro',2],[train.id,'missing',2],[train.id,'guro',-1],[train.id,'guro',1.5],[train.id,'guro',121]])assert.equal(T.delay(model,id,station,minutes).ok,false);
 assert.deepEqual(model,snapshot);
});
test('position interpolates in both directions, handles dwell and cancellation',()=>{
 const model=T.initial();
 for(const train of [model.trains[0],model.trains[6]]){
  assert.equal(T.position(train,-1),null);assert.equal(T.position(train,10).status,'정차');
  const p=T.position(train,90);assert.equal(p.status,'운행');
  assert.equal(p.order,train.direction==='down'?0.5:31.5);
  assert(T.cancel(model,train.id).ok);assert.equal(T.position(train,90),null);
  assert.equal(T.delay(model,train.id,'guro',2).ok,false);
  assert(T.cancel(model,train.id).ok);assert(T.position(train,90));
  assert.equal(T.position(train,train.calls.at(-1).departure+1),null);
 }
});
console.log(tests+' network/timetable tests passed');
