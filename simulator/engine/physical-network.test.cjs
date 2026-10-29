const assert=require('node:assert/strict'),L=require('./line'),N=require('./network'),G=require('./network-topology'),W=require('./wiring'),Ops=require('./ls-operations'),TW=require('./train-windows');
const g=L.graph;
assert.equal(Object.keys(g.circuits).length,320);assert.equal(new Set(g.edges.map(e=>e.id)).size,g.edges.length);
for(const e of g.edges)assert(g.nodes[e.a]&&g.nodes[e.b],e.id+' endpoints');
assert.equal(g.edges.filter(e=>e.kind==='circuit').length,320);
assert.equal(g.edges.filter(e=>e.numberGap).length,0);for(const [code,slide]of [['B997T',14],['B998T',14],['B1033T',19]])assert(g.circuits[code].sources.some(s=>s.kind==='reviewed-strip'&&s.slide===slide),'restored circuit must have PPT evidence '+code);
for(const sec of L.line.sections){const chain=g.chains[sec.id];assert.equal(chain[0],sec.westSide.match(/^B\d+T/)[0]);assert.equal(chain.at(-1),sec.eastSide.match(/^B\d+T/)[0]);for(let i=1;i<chain.length;i++)assert(g.edges.some(e=>e.a===chain[i-1]+':E'&&e.b===chain[i]+':W'));}
for(const b of g.boundaries)assert(g.edges.some(e=>e.a===b.node&&e.b===b.id&&e.kind==='external-handover'));
assert.equal(g.boundaries.length,7);
assert.equal(G.audit().inferredCompositeRoutes.length,0);for(const s of N.stations.filter(s=>s.controlled))for(const route of Object.keys(s.routes))assert(G.localPath(s.id,route).contiguous,s.id+' '+route);
assert.deepEqual(W.data.anyang.links.find(p=>p[0]==='53'),['53','2T',852,'3T',872]);
console.log('PASS source-backed graph: 320 canonical circuits, all 46 continuous chains, 7 explicit depot boundaries, 710 native routes and no invented gap codes');
const ops=Ops.create(Object.fromEntries(Object.entries(TW.data).map(([id,ws])=>[id,ws.map(w=>w.slot)]))),ls=ops.initial();
ops.dispatch(ls,{op:'insert',station:'anyang',slot:'B988T',number:'K4001',direction:'down'});
assert(!L.blockedExits(ls).anyang?.B984T,'a distant occupied circuit does not close an empty entry circuit');
ops.dispatch(ls,{op:'insert',station:'anyang',slot:'B984T',number:'K4003',direction:'down'});
assert.equal(L.blockedExits(ls).anyang.B984T,'K4003');
// The live circuit identity overrides an approximate number-window location.
L.setJourney('K4003','B986T');assert(!L.blockedExits(ls).anyang?.B984T);
assert.deepEqual(L.circuitOccupancy(ls).B986T,['K4003']);assert(!L.circuitOccupancy(ls).B984T);
L.journeys.clear();
L.state.single.add('anyang>geumjeong:E');
try{const blocked=L.blockedExits(ls);assert(blocked.anyang.B984T);assert(blocked.geumjeong.B993T,'single-line direction protection still spans the entire reserved section');}finally{L.state.single.clear();}
{const Core=require('./core'),c=Core.forStation('anyang'),s=c.initial();c.dispatch(s,{type:'mode',value:'CCM'});
 // The route may already be set when another train occupies the first circuit.
 assert(c.dispatch(s,{type:'route',id:'4A-B984T'}).ok);L.refresh({anyang:s},ls);assert(!c.dispatch(s,{type:'occupy',id:'4A-B984T'}).ok);
 const row=ls.stations.anyang.windows.B984T[0];ops.dispatch(ls,{op:'delete',station:'anyang',slot:'B984T',uid:row.uid});L.refresh({anyang:s},ls);assert(c.dispatch(s,{type:'occupy',id:'4A-B984T'}).ok);
}
console.log('PASS per-circuit occupancy, shared identity across number-window views, and section-wide single-line protection');

// A confirmed depot-boundary departure must not create the same train at the next main-line station.
{const T=require('./timetable'),A=require('./autocontrol'),Core=require('./core');const train=T.pattern({id:'G9101',from:'uiwang',to:'suwon',start:0});train.calls[0].departureRoute='4A_FT';const model={trains:[train],changes:[]},states=Object.fromEntries(N.stations.filter(s=>s.controlled).map(s=>[s.id,Core.forStation(s.id).initial()])),engine=A.create({core:Core,stations:N.stations});
 engine.run({states,model});for(let t=0;t<1000;t+=10){for(const [id,s]of Object.entries(states))Core.forStation(id).dispatch(s,{type:'tick',seconds:10});engine.run({states,model});}
 assert.equal(engine.position(train,1000).boundary,'external:uiwang:FT');assert.equal(engine.stageOf(train,train.calls.at(-1)),0);assert.equal(Object.keys(states.uiwang.routes).length,0);
}
console.log('PASS depot-boundary handover keeps the train outside the main-line progression instead of spawning it downstream');
