const assert=require('node:assert/strict');
const N=require('../engine/network'),W=require('../engine/wiring'),Core=require('../engine/core'),LS=require('./ls-view'),S=require('./ls-switches');
const scene=(station,state)=>{const st=N.catalog[station],def=W.data[station],C=Core.forStation(station),L=LS.layout(def,LS.wingOf(st,def));return S.build(st,def,C,state,L.pt);};
let count=0;
for(const st of N.stations.filter(s=>s.controlled)){
 const C=Core.forStation(st.id),state=C.initial(),normal=scene(st.id,state);
 assert.deepEqual([...new Set(normal.states.map(s=>s.id))].sort(),Object.keys(C.points).sort(),st.id+' missing physical blades');
 for(const id of Object.keys(C.points)){
  const reversed=C.initial();reversed.points[id]='R';const rev=scene(st.id,reversed);
  assert.notDeepEqual(rev.cuts.filter(c=>c.id===id),normal.cuts.filter(c=>c.id===id),st.id+' '+id+' gap geometry must change');
  assert(rev.states.filter(s=>s.id===id).every(s=>s.position==='R'&&s.connected));count++;
 }
}
assert.equal(count,119);console.log('PASS all 119 switch groups change physical gap/connection geometry for N/R');
{
 const C=Core.forStation('seoul'),state=C.initial();C.dispatch(state,{type:'mode',value:'CCM'});
 const normal=scene('seoul',state),n58=normal.connectors.find(c=>c.id==='58');
 assert(C.dispatch(state,{type:'route',id:'4C-B902T'}).ok);
 const established=scene('seoul',state),r58=established.connectors.find(c=>c.id==='58');
 assert.notDeepEqual(r58.points,n58.points);assert(r58.locked);assert.equal(r58.position,'R');
 assert.equal(established.connectors.find(c=>c.id==='59').position,'N');
 assert(C.dispatch(state,{type:'approach',signal:'4C'}).ok);assert(C.dispatch(state,{type:'stop',id:'4C'}).ok);
 assert(C.dispatch(state,{type:'point',id:'58',value:'N'}).ok===false);
 assert.deepEqual(scene('seoul',state).connectors.find(c=>c.id==='58').points,r58.points);
 C.dispatch(state,{type:'tick',seconds:30});assert(!state.routes['4C-B902T']);
 const released=scene('seoul',state).connectors.find(c=>c.id==='58');assert.equal(released.position,'R');assert(!released.locked);
 assert(C.dispatch(state,{type:'point',id:'58',value:'N'}).ok);assert.deepEqual(scene('seoul',state).connectors.find(c=>c.id==='58').points,n58.points);
 console.log('PASS photographed Seoul 4C route connects 58/56/55, holds its shape through approach locking, then permits N');
}

{
 const C=Core.forStation('seoul'),s=C.initial(),normal=scene('seoul',s),c=normal.connectors.find(c=>c.id==='58');
 assert.equal(c.kind,'scissors');assert(Math.abs(c.endpoints[1][0]-c.endpoints[0][0])>80,'reserve a broad source-like scissors footprint');assert(c.glyphMask);assert.equal(c.fullPoints.length,5);
 C.dispatch(s,{type:'mode',value:'CCM'});assert(C.dispatch(s,{type:'route',id:'4C-B902T'}).ok);
 const selected=scene('seoul',s).connectors.find(c=>c.id==='58');assert(!selected.glyphMask);
 const view=LS.render(N.catalog.seoul,W.data.seoul,C,s),route=view.svg.match(/data-active-route="4C-B902T"[^>]*d="([^"]+)"/)[1];
 for(const p of selected.fullPoints.slice(1,-1))assert(route.includes(p.join(' ')),'green route must follow the pinched scissors neck');
 console.log('PASS source-shaped scissors slot opens in N and the established route follows its complete R geometry');
}
