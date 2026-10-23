// Exhaustive checks against the traced track resources and documented overlap rules.
// This is a model consistency audit, not a replacement for a real LS interlocking table.
const assert=require('node:assert/strict');
const N=require('./network'),Core=require('./core'),IL=require('./interlocking');
function audit(){
 const report={version:'0.19.2',scope:'15개 역 원본 배선 추적 데이터·문서화된 오버랩과의 대조. 실물 LS 연동표 전수 확인 아님.',totals:{stations:0,routes:0,pairs:0,orders:0,allowed:0,blocked:0,sharedNormalPairs:0,newlyAllowed:0,lifecycleOrders:0},stations:[],newlyAllowed:[]};
 for(const st of N.stations.filter(s=>s.controlled)){
  const C=Core.forStation(st.id),ids=Object.keys(C.routes),stat={station:st.id,name:st.name,routes:ids.length,pairs:0,allowed:0,blocked:0,sharedNormalPairs:0,newlyAllowed:0};
  report.totals.stations++;report.totals.routes+=ids.length;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const a={...C.routes[ids[i]],id:ids[i]},b={...C.routes[ids[j]],id:ids[j]},sharedTracks=a.resources.filter(t=>b.resources.includes(t)),points=a.pointLocks.filter(p=>b.pointLocks.includes(p));
   const sharedNormal=points.length>0&&points.every(p=>a.pointPositions[p]==='N'&&b.pointPositions[p]==='N');
   const overlapConflict=[[a,b],[b,a]].some(([x,y])=>{
    const rule=IL.rulesFor(st.id,x.id);return rule?.clearSignals?.includes(y.signal)||Object.entries(rule?.points||{}).some(([p,v])=>y.pointLocks.includes(p)&&y.pointPositions[p]!==v);
   });
   const blocked=a.signal===b.signal||sharedTracks.length>0||points.some(p=>!(a.pointPositions[p]==='N'&&b.pointPositions[p]==='N'))||overlapConflict;
   const outcomes=[];
   for(const [first,second] of [[a,b],[b,a]]){
    const label=`${st.id}: ${first.id} → ${second.id}`,s=C.initial();C.dispatch(s,{type:'mode',value:'CCM'});
    assert(C.dispatch(s,{type:'route',id:first.id}).ok,label+' first route');
    const before=JSON.stringify([s.routes,s.points,s.signals]);
    const result=C.dispatch(s,{type:'route',id:second.id});outcomes.push(result.ok);report.totals.orders++;
    assert.equal(result.ok,!blocked,label+' track/point/overlap decision');
    if(!result.ok){assert.equal(JSON.stringify([s.routes,s.points,s.signals]),before,label+' rejected route must not mutate field');continue;}
    for(const route of [first,second])for(const [p,v]of Object.entries({...route.pointPositions,...IL.rulesFor(st.id,route.id)?.points}))assert.equal(s.points[p],v,label+' point '+p);
    if(!sharedNormal)continue;
    assert(C.dispatch(s,{type:'occupy',id:first.id}).ok,label+' first entry');
    assert.equal(s.signals[second.signal],'GO',label+' independent signal');
    assert(C.dispatch(s,{type:'occupy',id:second.id}).ok,label+' second entry');
    assert(C.dispatch(s,{type:'clear',id:first.id}).ok,label+' first passage');
    assert(s.routes[second.id]?.occupied,label+' remaining route');
    assert(second.resources.every(t=>s.occupied[t]===second.id),label+' remaining occupancy');
    for(const p of points)assert(!C.dispatch(s,{type:'point',id:p,value:'R'}).ok,label+' shared switch remains locked');
    assert(C.dispatch(s,{type:'clear',id:second.id}).ok,label+' second passage');
    assert.equal(Object.keys(s.routes).length,0,label+' final release');
    for(const p of points)assert(C.dispatch(s,{type:'point',id:p,value:'R'}).ok,label+' switch released after last passage');
    report.totals.lifecycleOrders++;
   }
   assert.equal(outcomes[0],outcomes[1],`${st.id} command order symmetry`);
   stat.pairs++;report.totals.pairs++;
   const kind=outcomes[0]?'allowed':'blocked';stat[kind]++;report.totals[kind]++;
   if(outcomes[0]&&sharedNormal){stat.sharedNormalPairs++;report.totals.sharedNormalPairs++;
    if(!IL.parallelFor(st.id,a.id,b.id)){stat.newlyAllowed++;report.totals.newlyAllowed++;report.newlyAllowed.push({station:st.id,routes:[a.id,b.id],points:Object.fromEntries(points.map(p=>[p,'N']))});}
   }
  }
  report.stations.push(stat);
 }
 return report;
}
module.exports={audit};
