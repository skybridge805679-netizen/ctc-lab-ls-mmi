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
 assert.notDeepEqual(r58.segments,n58.segments);assert(r58.locked);assert.equal(r58.position,'R');
 assert.equal(established.connectors.find(c=>c.id==='59').position,'N');
 assert(C.dispatch(state,{type:'approach',signal:'4C'}).ok);assert(C.dispatch(state,{type:'stop',id:'4C'}).ok);
 assert(C.dispatch(state,{type:'point',id:'58',value:'N'}).ok===false);
 assert.deepEqual(scene('seoul',state).connectors.find(c=>c.id==='58').segments,r58.segments);
 C.dispatch(state,{type:'tick',seconds:30});assert(!state.routes['4C-B902T']);
 const released=scene('seoul',state).connectors.find(c=>c.id==='58');assert.equal(released.position,'R');assert(!released.locked);
 assert(C.dispatch(state,{type:'point',id:'58',value:'N'}).ok);assert.deepEqual(scene('seoul',state).connectors.find(c=>c.id==='58').segments,n58.segments);
 console.log('PASS photographed Seoul 4C route connects 58/56/55, holds its shape through approach locking, then permits N');
}

{
 const C=Core.forStation('seoul'),s=C.initial(),normal=scene('seoul',s),c=normal.connectors.find(c=>c.id==='58');
 assert.equal(c.kind,'scissors');assert(Math.abs(c.endpoints[1][0]-c.endpoints[0][0])>80,'reserve a broad source-like scissors footprint');assert.equal(c.segments.length,2);assert.equal(c.fullPoints.length,5);assert(c.crossings.some(x=>x.other==='59'));
 C.dispatch(s,{type:'mode',value:'CCM'});assert(C.dispatch(s,{type:'route',id:'4C-B902T'}).ok);
 const selected=scene('seoul',s).connectors.find(c=>c.id==='58');assert.equal(selected.segments.length,2);
 const view=LS.render(N.catalog.seoul,W.data.seoul,C,s),route=view.svg.match(/data-active-route="4C-B902T"[^>]*d="([^"]+)"/)[1];
 for(const p of selected.fullPoints)assert(route.includes(p.join(' ')),'green route must follow both surveyed endpoints');
 console.log('PASS four-piece diamond and straight selected route through the quarter separators');
}

{
 let pairCases=0;
 for(const st of N.stations.filter(s=>s.controlled)){
  const C=Core.forStation(st.id),base=scene(st.id,C.initial());
  for(const a of base.connectors)for(const cross of a.crossings.filter(x=>+a.id<+x.other))for(const pattern of ['NN','RN','NR','RR']){
   const state=C.initial();state.points[a.id]=pattern[0];state.points[cross.other]=pattern[1];const before=structuredClone(state),view=scene(st.id,state);assert.deepEqual(state,before);
   for(const [id,other]of [[a.id,cross.other],[cross.other,a.id]]){
    const own=view.connectors.find(c=>c.id===id);assert.equal(own.fullPoints.length,5,'tapered source-like crossing arms');
    assert.equal(own.segments.length,2,st.id+' '+id+' '+pattern);assert.equal(view.diamonds.find(d=>d.id===own.crossings[0].diamond).members.length,2);
    assert.equal(own.quarters.length,2);for(const q of own.quarters){assert.equal(q.points.length,4);const [a,b,c,d]=q.points;assert(Math.abs(a[1]-b[1])<.01,'outer face parallel to the main rail');assert(Math.abs(c[1]-d[1])<.01,'flat inner face');assert(Math.abs(b[0]-a[0])>=Math.abs(c[0]-d[0]),'outer face must be wider than the inner face');}
   }pairCases++;
  }
 }
 assert.equal(pairCases,32);console.log('PASS all 8 physical crossing pairs in NN/RN/NR/RR: four diamond quarters, separated circuits and unchanged controls');
 const crossing=S.intersection([0,0],[100,80],[0,80],[100,0]);assert.deepEqual(crossing.point,[50,40]);assert.equal(S.intersection([0,0],[100,0],[100,0],[100,100]),null,'shared endpoint is a turnout, not a crossing');
 assert.deepEqual(S.splitLine([0,0],[100,0],[[40,60],[45,70]]),[[[0,0],[40,0]],[[70,0],[100,0]]]);
}
