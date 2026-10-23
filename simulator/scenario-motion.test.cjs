const assert=require('node:assert/strict'),M=require('./scenario-motion'),Core=require('./core'),SC=require('./scenarios'),EM=require('./emergency'),Ops=require('./ls-operations'),TW=require('./train-windows');
function world(){const model=Ops.create(Object.fromEntries(Object.entries(TW.data).map(([id,ws])=>[id,ws.map(w=>w.slot)]))),ls=model.initial(),states=Object.fromEntries(Object.keys(TW.data).map(id=>[id,Core.forStation(id).initial()]));const engine=M.create({states:()=>states,model:()=>ls,validate:a=>model.dispatch(structuredClone(ls),a),commit:a=>model.dispatch(ls,a)});return {ls,states,engine,add:(station,slot,number='K1004',direction='up')=>{assert(model.dispatch(ls,{op:'insert',station,slot,number,direction}).ok);return ls.stations[station].windows[slot].at(-1).uid;},tick:n=>{for(const s of Object.values(states))s.clock+=n;engine.step();}};}
for(const sc of SC.list){const w=world(),f=sc.cast.find(c=>c.role==='fault'),to=sc.beats.route[0][1],uid=w.add(sc.station,f.slot,'K1004',f.dir),s=w.states[sc.station],C=Core.forStation(sc.station),id=M.candidates(sc.station,f.slot,to,f.dir)[0];assert(id,sc.id);C.dispatch(s,{type:'mode',value:'CCM'});w.engine.request({op:'move',station:sc.station,slot:f.slot,uid,targetStation:sc.station,targetSlot:to});assert.equal(w.engine.list()[0].phase,'waiting');assert(C.dispatch(s,{type:'route',id}).ok);w.engine.step();assert(s.routes[id].occupied);assert(w.ls.stations[sc.station].windows[f.slot].length);w.tick(10);assert(!w.ls.stations[sc.station].windows[to]?.length);w.tick(50);assert(w.ls.stations[sc.station].windows[to].some(t=>t.uid===uid));assert(!s.routes[id]);}
console.log('PASS all five siding scenarios: wait for signal, occupy, hold original window while moving, arrive and release at 60x');
{
const w=world(),s=w.states.yongsan,C=Core.forStation('yongsan'),uid=w.add('yongsan','B607T');C.dispatch(s,{type:'mode',value:'CCM'});C.dispatch(s,{type:'route',id:'2A-5T'});C.dispatch(s,{type:'pointLock',id:'21',lock:true});w.engine.request({op:'move',station:'yongsan',slot:'B607T',uid,targetStation:'yongsan',targetSlot:'5T'});w.engine.reset();assert(!Object.values(s.routes).some(r=>r.occupied));assert(w.ls.stations.yongsan.windows.B607T.some(t=>t.uid===uid));
}
for(const sc of EM.list){const w=world();for(const c of EM.castFor(sc)){assert(M.point(c.station,c.slot),sc.id+' '+c.slot);w.add(c.station,c.slot,c.number,c.dir);}for(const moves of Object.values(sc.autos))for(const a of moves)if(a.op==='move')assert(M.point(a.station,a.slot),sc.id+' automatic destination missing');for(const st of sc.steps)if(st.act?.type==='move'&&st.act.slot)assert(M.point(st.act.station,st.act.slot),sc.id+' manual destination missing');}
console.log('PASS all nine emergency scenarios: every initial, automatic and manual destination maps to native geometry');
{
const w=world(),uid=w.add('jonggak','B055T','K0608');assert(w.engine.request({op:'move',station:'jonggak',slot:'B055T',uid,targetStation:'dongmyo',targetSlot:'B011T'},true).ok);assert.equal(w.engine.list()[0].phase,'handover');assert(w.states.jonggak.scenarioMotions.length&&w.states.dongmyo.scenarioMotions.length);assert.equal(Object.keys(w.states.jonggak.routes).length,0);w.tick(20);assert(w.ls.stations.dongmyo.windows.B011T.some(t=>t.uid===uid));assert.equal(w.states.jonggak.scenarioMotions.length,0);
}
{
const w=world(),uid=w.add('dongmyo','B021T','K0606');w.engine.request({op:'move',station:'dongmyo',slot:'B021T',uid,targetStation:'dongmyo',targetSlot:'B017T'});assert.equal(w.engine.list()[0].phase,'block');w.tick(20);assert(w.ls.stations.dongmyo.windows.B017T.some(t=>t.uid===uid));
}
console.log('PASS opposite-line handover and intermediate-block travel animate without inventing interlocking routes');
// Every emergency manual movement is an explicit display handover, including rescue coupling.
let manualCount=0;
for(const sc of EM.list)for(const step of sc.steps){
 const a=step.act;if(a?.type!=='move')continue;
 const w=world(),cast=EM.castFor(sc),f=cast.find(t=>t.number===a.number||t.number.replace(/\D/g,'')===a.number.replace(/\D/g,''));assert(f,sc.id+' cast '+a.number);
 const target=a.slot||TW.data[a.station].find(t=>/^\dT$/.test(t.slot)).slot,uid=w.add(f.station,f.slot,a.number,f.dir);
 if(f.station===a.station&&f.slot===target){manualCount++;continue;}
 assert(w.engine.request({op:'move',station:f.station,slot:f.slot,uid,targetStation:a.station,targetSlot:target},true).ok);
 assert(['handover','block'].includes(w.engine.list()[0].phase),sc.id);w.tick(20);assert(w.ls.stations[a.station].windows[target].some(t=>t.uid===uid),sc.id);manualCount++;
}
assert.equal(manualCount,EM.list.flatMap(sc=>sc.steps).filter(s=>s.act?.type==='move').length);console.log('PASS '+manualCount+' emergency manual transfer/coupling instructions: no premature arrival or invented route');
{
 const w=world(),s=w.states.yongsan,C=Core.forStation('yongsan'),uid=w.add('yongsan','B607T');C.dispatch(s,{type:'mode',value:'CCM'});C.dispatch(s,{type:'route',id:'2A-5T'});s.faults.signals.push('2A');
 w.engine.request({op:'move',station:'yongsan',slot:'B607T',uid,targetStation:'yongsan',targetSlot:'5T'});assert.equal(w.engine.list()[0].phase,'waiting');assert(!s.routes['2A-5T'].occupied);s.faults.signals=[];w.engine.step();assert(s.routes['2A-5T'].occupied);assert(M.inTransit(s,uid));
 C.dispatch(s,{type:'clear',id:'2A-5T'});w.tick(30);assert.equal(w.engine.list()[0].phase,'cancelled');assert(!w.ls.stations.yongsan.windows['5T']?.length);assert(!M.inTransit(s,uid));
}
console.log('PASS active route faults hold movement; external clear cancels the journey instead of teleporting the train');
{
 const w=world(),s=w.states.dongmyo,C=Core.forStation('dongmyo');EM.seed(EM.list.find(s=>s.id==='em-02'),w.states);const uid=w.add('dongmyo','2T','G0602');
 assert(s.routes['3A-B015T'],'departure seed must lead to the boundary, not the Gunja dead-end');w.engine.request({op:'delete',station:'dongmyo',slot:'2T',uid});assert(s.routes['3A-B015T'].occupied);w.tick(20);assert.equal(w.ls.stations.dongmyo.windows['2T'].length,0);assert.equal(w.engine.list()[0].phase,'done');
}
console.log('PASS emergency departure follows its seeded boundary route and clears only after passage');
let cueCount=0;
for(const sc of EM.list)for(const [tag,actions]of Object.entries(EM.MOTION[sc.key])){
 for(const number of new Set(actions.map(a=>a.number))){
  const f=EM.castFor(sc).find(t=>t.number===number||t.number.replace(/\D/g,'')===number.replace(/\D/g,''))||Object.values(sc.autos).flat().find(a=>a.op==='insert'&&a.number.replace(/\D/g,'')===number.replace(/\D/g,''));assert(f,sc.id+' cue actor '+number);
  const w=world(),uid=w.add(f.station,f.slot,number,f.dir);
  for(const a of actions.filter(a=>a.number===number))assert(w.engine.request(a.op==='delete'?{op:'delete',station:f.station,slot:f.slot,uid}:{op:'move',station:f.station,slot:f.slot,uid,targetStation:a.station,targetSlot:a.slot,handover:a.handover}).ok,sc.id+' '+tag);
  for(let i=0;i<12&&w.engine.busy();i++)w.tick(20);
  assert(!w.engine.busy(),sc.id+' '+tag+' '+number+' '+JSON.stringify(w.engine.list().filter(j=>j.phase==='waiting').map(j=>j.reason)));cueCount++;
 }
}
console.log('PASS all nine emergency scripts: '+cueCount+' spoken resumption/reroute/departure journeys finish through interlocking and boundary handover');
const T=require('./timetable');let sidingJourneys=0;
for(const sc of SC.list){
 const model=T.initial(),cast=SC.pickCast(sc,model,SC.candidates(sc,model)[0]);
 for(const actor of cast){
  const moves=Object.values(sc.beats).flat().filter(m=>m[0]===actor.key);if(!moves.length)continue;
  const w=world(),uid=w.add(sc.station,actor.slot,actor.id,actor.dir);
  for(const [,slot]of moves)assert(w.engine.request(slot===null?{op:'delete',station:sc.station,slot:actor.slot,uid}:{op:'move',station:sc.station,slot:actor.slot,uid,targetStation:sc.station,targetSlot:slot}).ok,sc.id+' '+actor.key);
  for(let i=0;i<30&&w.engine.busy();i++)w.tick(20);
  assert(!w.engine.busy(),sc.id+' '+actor.key+' '+JSON.stringify(w.engine.list().filter(j=>j.phase==='waiting').map(j=>j.reason)));sidingJourneys++;
 }
}
console.log('PASS all five siding scripts: '+sidingJourneys+' fault/following/other train journeys finish, including departure and exit');
{
 const w=world(),a=w.add('yongsan','B607T','K1004'),b=w.add('yongsan','B607T','K1006');
 const move=uid=>({op:'move',station:'yongsan',slot:'B607T',uid,targetStation:'yongsan',targetSlot:'7T'});
 w.engine.request(move(a));w.engine.request(move(b));assert.equal(w.engine.list()[1].phase,'waiting');w.tick(20);assert.equal(w.engine.list()[1].phase,'waiting');assert.equal(w.ls.stations.yongsan.windows['7T'].length,1);
 w.engine.request({op:'move',station:'yongsan',slot:'7T',uid:a,targetStation:'yongsan',targetSlot:'B605T'});w.tick(20);w.tick(20);assert(w.ls.stations.yongsan.windows['7T'].some(t=>t.uid===b));
}
console.log('PASS following train waits for route resources and occupied destination until the leader departs');
