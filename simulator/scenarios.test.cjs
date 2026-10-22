const assert=require('assert');
const S=require('./scenarios.js'),Core=require('./core.js'),T=require('./timetable.js');
const flows={
 'yongsan-5':[['mode','CCM'],['stop','2A'],['tick',90],['route','2A-5T'],['mode','AUTO'],['sched','K1002','yongsan','3C_B605T']],
 'yongsan-4':[['mode','CCM'],['stop','1B'],['tick',90],['route','1B-4T'],['mode','AUTO'],['sched','K1131','yongsan','4C_B610T']],
 'yeongdeungpo-1':[['mode','CCM'],['stop','1A'],['stop','4B'],['tick',90],['route','1A-1T'],['mode','AUTO'],['sched','K1131','yeongdeungpo','4A_B622T']],
 'geumcheon-1':[['mode','CCM'],['stop','1B'],['stop','4B'],['tick',90],['route','1B-1T'],['mode','AUTO'],['mode','CCM'],['route','4A-B644T'],['mode','AUTO']],
 'geumcheon-6':[['mode','CCM'],['stop','2B'],['tick',90],['route','2B-6T'],['mode','AUTO'],['mode','CCM'],['stop','2B'],['tick',90],['route','3A-B639T'],['mode','AUTO']]
};
assert.strictEqual(S.list.length,5);
for(const sc of S.list){
 const state={},model=T.initial(),c=Core.forStation(sc.station);
 S.seed(sc,state);
 assert.strictEqual(state.mode,'AUTO',sc.id);
 assert.ok(sc.seed.routes.every(id=>state.routes[id]),sc.id+' seed routes');
 const run=S.newRun(sc);
 // nothing is done before the operator acts
 S.advance(run,{state,model});assert.ok(!run.done.some((d,i)=>d&&sc.steps[i].kind==='do'),sc.id+' pre-done');
 const doCount=sc.steps.filter(s=>s.kind==='do').length;
 const emit=e=>{run.events.push({ok:true,station:sc.station,...e});S.advance(run,{state,model});};
 for(const f of flows[sc.id]){
  if(f[0]==='mode'){const r=c.dispatch(state,{type:'mode',value:f[1],source:'LS'});assert.ok(r.ok,sc.id+' mode '+f[1]+' '+r.message);emit({type:'mode',value:f[1]});}
  else if(f[0]==='stop'){const r=c.dispatch(state,{type:'stop',id:f[1],source:'LS'});assert.ok(r.ok,sc.id+' stop '+f[1]+' '+r.message);emit({type:'stop',id:f[1]});}
  else if(f[0]==='tick'){c.dispatch(state,{type:'tick',seconds:f[1]});S.advance(run,{state,model});}
  else if(f[0]==='route'){const r=c.dispatch(state,{type:'route',id:f[1],source:'LS'});assert.ok(r.ok,sc.id+' route '+f[1]+' '+r.message);emit({type:'route',id:f[1]});}
  else if(f[0]==='sched'){const t=model.trains.find(x=>x.id===f[1]),call=t.calls.find(x=>x.station===f[2]);call.departureRoute=f[3];S.advance(run,{state,model});}
 }
 const done=run.done.filter((d,i)=>d&&sc.steps[i].kind==='do').length;
 assert.strictEqual(done,doCount,`${sc.id}: ${done}/${doCount} do-steps; first undone: ${sc.steps.find((s,i)=>s.kind==='do'&&!run.done[i])?.text}`);
}
// order matters: setting the route before releasing does not complete later steps
{const sc=S.list[0],state={},model=T.initial(),c=Core.forStation(sc.station);S.seed(sc,state);const run=S.newRun(sc);
 c.dispatch(state,{type:'mode',value:'CCM',source:'LS'});
 run.events.push({ok:true,type:'mode',station:'yongsan',value:'CCM'});S.advance(run,{state,model});
 assert.ok(run.done[1]&&!run.done[3]);
 run.events.push({ok:false,type:'stop',station:'yongsan',id:'2A'});S.advance(run,{state,model});assert.ok(!run.done[3],'refused events do not count');}
console.log('scenarios: ok');
