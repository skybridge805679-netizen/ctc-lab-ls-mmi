const assert=require('node:assert/strict'),G=require('./network-topology'),L=require('./line'),N=require('./network'),C=require('./core'),T=require('./timetable'),A=require('./autocontrol'),Ops=require('./ls-operations'),TW=require('./train-windows'),Motion=require('./scenario-motion');
const audit=G.audit();assert.deepEqual(audit.issues,[]);assert.equal(audit.stations,33);assert.equal(audit.routes,658);assert.equal(G.sections,L.line.sections);assert.equal(audit.nodes,692);assert.equal(audit.edges,734);assert.deepEqual(audit.inferredCompositeRoutes.map(r=>r.route).sort(),[]);
for(const a of N.stations)for(const b of N.stations){const p=G.path(a.id,b.id);assert.equal(p.stations[0],a.id);assert.equal(p.stations.at(-1),b.id);assert.equal(p.segments.length,Math.abs(a.order-b.order));}
assert.equal(G.path('missing','guro'),null);
for(const st of N.stations.filter(s=>s.controlled))for(const id of Object.keys(st.routes)){assert.deepEqual(G.localPath(st.id,id).resources,C.forStation(st.id).routes[id].resources);assert(G.localPath(st.id,id).contiguous||st.routes[id].resourceModel==='conservative-composite');}
assert(G.ports.some(p=>p.station==='guro'&&p.code==='F1T'&&p.kind==='branch-boundary'));
const reverse=L.handoff('anyang','B983T',id=>TW.data[id].map(w=>w.slot),'down');assert.equal(reverse.station,'geumjeong');assert.equal(reverse.direction,'down');assert.equal(reverse.signal,null,'no fictional opposite-direction home signal');
assert.equal(L.handoff('guro','F1T',id=>TW.data[id].map(w=>w.slot)),null,'yard boundary cannot be guessed as an interstation main line');
console.log('PASS composite graph: 33 stops, 46 main-line sections, all 692 local nodes / 734 edges and 658 route-resource paths');
const states=()=>Object.fromEntries(N.stations.filter(s=>s.controlled).map(s=>[s.id,C.forStation(s.id).initial()]));
for(const reflect of [false,true]){
 const model=T.initial();model.trains=model.trains.slice(0,1);const train=model.trains[0],plan=structuredClone(train),s=states(),engine=A.create({core:C,stations:N.stations}),seen=[],handoffs=[];
 const nums={place:(st,slot,t)=>seen.push([st,t.id]),depart(){},remove(){},handoff:(st,t,dest,delay)=>handoffs.push({st,delay})};
 C.forStation('cheongnyangni').dispatch(s.cheongnyangni,{type:'fault',kind:'signal',id:'4A',on:true});
 const tick=seconds=>{for(const [id,x]of Object.entries(s))C.forStation(id).dispatch(x,{type:'tick',seconds});return engine.run({states:s,model,numbers:nums,reflect});};
 engine.run({states:s,model,numbers:nums,reflect});
 for(let t=0;t<600;t+=10)tick(10);
 assert.equal(engine.position(train,600).station,'cheongnyangni','actual graph position stays at the faulted origin');
 assert(!seen.some(([st])=>st!=='cheongnyangni'),'no downstream train number before upstream departure');
 assert.equal(engine.stageOf(train,train.calls.find(c=>c.station==='dongmyo')),0);
 C.forStation('cheongnyangni').dispatch(s.cheongnyangni,{type:'fault',kind:'signal',id:'4A',on:false});engine.run({states:s,model,numbers:nums,reflect});tick(20);
 assert.equal(handoffs[0].delay,reflect?0:570,'reflected delay must not be counted twice by intermediate displays');
 assert.equal(train.calls[3].arrival,plan.calls[3].arrival+(reflect?570:0));
 const pos=engine.position(train,620);assert(pos.order>=0&&pos.order<1,'train must still be between origin and first intermediate stop '+JSON.stringify({reflect,pos,calls:train.calls.slice(0,4)}));
 for(let t=620;t<1040;t+=10)tick(10);
 assert(seen.some(([st])=>st==='dongmyo'),'the same train arrives downstream after actual travel');
 if(!reflect)assert.deepEqual(train.calls,plan.calls,'actual propagation does not rewrite the timetable');
}
console.log('PASS delayed upstream train cannot spawn downstream; actual position, both reflection settings and intermediate delay propagation agree');
// Both command orders must reserve an empty single-line section before any occupancy exists.
for(const order of [['jonggak','4A-B046T','underground-seoul','3A-B065T'],['underground-seoul','3A-B065T','jonggak','4A-B046T']]){
 const s=states(),[a,ar,b,br]=order;for(const id of [a,b])C.forStation(id).dispatch(s[id],{type:'mode',value:'CCM'});
 L.state.single.add('jonggak>underground-seoul:M');
 try{L.refresh(s,{stations:{}});assert(C.forStation(a).dispatch(s[a],{type:'route',id:ar}).ok);L.refresh(s,{stations:{}});const r=C.forStation(b).dispatch(s[b],{type:'route',id:br});assert(!r.ok&&r.message.includes('전방 폐색'));C.forStation(a).dispatch(s[a],{type:'stop',id:ar.split('-')[0]});L.refresh(s,{stations:{}});assert(C.forStation(b).dispatch(s[b],{type:'route',id:br}).ok);}finally{L.state.single.clear();}
}
console.log('PASS empty single-line section reserves its opposing exit in both command orders and releases with the route');
// Scenario motion must respect the same block rule even in an already-set departure route.
{
 const s=states(),ops=Ops.create(Object.fromEntries(Object.entries(TW.data).map(([id,ws])=>[id,ws.map(w=>w.slot)]))),ls=ops.initial();
 ops.dispatch(ls,{op:'insert',station:'anyang',slot:'1T',number:'K1231',direction:'down'});const uid=ls.stations.anyang.windows['1T'][0].uid;
 const cc=C.forStation('anyang');cc.dispatch(s.anyang,{type:'mode',value:'CCM'});assert(cc.dispatch(s.anyang,{type:'route',id:'4A-B984T'}).ok);
 ops.dispatch(ls,{op:'insert',station:'anyang',slot:'B984T',number:'K1233',direction:'down'});
 const motion=Motion.create({states:()=>s,model:()=>ls,validate:a=>ops.dispatch(structuredClone(ls),a),commit:a=>ops.dispatch(ls,a)});
 assert(motion.request({op:'delete',station:'anyang',slot:'1T',uid}).ok);assert.equal(motion.list()[0].phase,'waiting');assert(motion.list()[0].reason.includes('전방 폐색'));assert(L.state.enforce);
 const blocker=ls.stations.anyang.windows.B984T[0];ops.dispatch(ls,{op:'delete',station:'anyang',slot:'B984T',uid:blocker.uid});motion.step();assert.equal(motion.list()[0].phase,'moving');
}
console.log('PASS scenario movement waits for a blocked main line and resumes without disabling network protection');
