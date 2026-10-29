'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const N=require('../simulator/engine/network'),W=require('../simulator/engine/wiring').data,C=require('../simulator/engine/core'),LS=require('../simulator/ui/ls-view'),S=require('../simulator/ui/ls-switches'),V=require('../simulator/ui/ls-presets'),Line=require('../simulator/engine/line');
const survey=require('../references/transcriptions/switch-survey.json'),blocks=require('../references/transcriptions/block-signals.json');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(survey.source),survey.sha256);assert.equal(hash(blocks.source),blocks.sha256);
const report={version:'0.26.2',date:'2026-10-29',source:survey.source,sha256:survey.sha256,stations:[],restoredCircuits:['B998T','B997T','B1033T'],blocks:blocks.indicators.length,numberGaps:Line.graph.edges.filter(e=>e.numberGap).length,issues:[]};
for(const st of N.stations.filter(s=>s.controlled)){
 const c=C.forStation(st.id),def=W[st.id],source=survey.stations[st.id];assert.equal(hash(source.image),source.sha256);
 assert.deepEqual(Object.keys(c.points).sort(),source.groups);
 const state=c.initial(),layout=LS.layout(def,LS.wingOf(st,def)),normal=S.build(st,def,c,state,layout.pt),view=LS.render(st,def,c,state,{preset:st.id});
 const controls=[...view.svg.matchAll(/data-point-control="([^"]+)"/g)].map(m=>m[1]),visible=new Set(controls.map(id=>c.pointParts[id]||id)),groups=[];
 for(const id of source.groups){
  assert(visible.has(id),st.id+' control missing '+id);assert(normal.states.some(s=>s.id===id),st.id+' blade missing '+id);
  const s=c.initial();assert(!c.dispatch(s,{type:'point',id,value:'R'}).ok);assert(c.dispatch(s,{type:'mode',value:'CCM'}).ok);
  for(const value of ['R','N']){assert(c.dispatch(s,{type:'point',id,value}).ok);assert.equal(s.points[id],value);assert(S.build(st,def,c,s,layout.pt).states.filter(x=>x.id===id).every(x=>x.position===value));}
  const r=c.initial();r.points[id]='R';assert.notDeepEqual(S.build(st,def,c,r,layout.pt).cuts.filter(x=>x.id===id),normal.cuts.filter(x=>x.id===id));
  c.dispatch(s,{type:'pointLock',id,lock:true});assert(!c.dispatch(s,{type:'point',id,value:'R'}).ok);c.dispatch(s,{type:'pointLock',id,lock:false});c.dispatch(s,{type:'fault',kind:'point',id,on:true});assert(!c.dispatch(s,{type:'point',id,value:'R'}).ok);
  groups.push({id,parts:Object.entries(c.pointParts).filter(([,g])=>g===id).map(([p])=>p),routeLocks:Object.entries(c.routes).filter(([,r])=>r.pointLocks.includes(id)).map(([id])=>id),normalReverseVerified:true,manualLockAndFaultVerified:true});
 }
 report.stations.push({id:st.id,slide:source.slide,groups});
}
const seen=[];
for(const view of V.list()){const st=N.catalog[view.station],c=C.forStation(st.id),svg=LS.render(st,W[st.id],c,c.initial(),{preset:view.id}).svg;seen.push(...[...svg.matchAll(/data-block-id="([^"]+)"/g)].map(m=>m[1]));}
assert.equal(seen.length,274);assert.equal(new Set(seen).size,274);
for(const b of blocks.indicators){assert.equal(b.code,b.anchorCode);assert(Line.graph.circuits[/^B\d+T/.exec(b.code)[0]],b.code);const [x,,w]=b.sourceSymbol,[a,,width]=b.sourceCell;assert(Math.abs(b.fraction-(x+w/2-a)/width)<.0001);}
report.switchGroups=report.stations.reduce((n,s)=>n+s.groups.length,0);report.pairedControls=report.stations.reduce((n,s)=>n+s.groups.reduce((n,g)=>n+g.parts.length,0),0);report.canonicalCircuits=Object.keys(Line.graph.circuits).length;
fs.writeFileSync('docs/source-equipment-audit-v0.26.2.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({switchGroups:report.switchGroups,pairedControls:report.pairedControls,blocks:report.blocks,canonicalCircuits:report.canonicalCircuits,numberGaps:report.numberGaps,issues:report.issues}));
