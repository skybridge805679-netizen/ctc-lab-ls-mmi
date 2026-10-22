const assert=require('assert');
const S=require('./scenarios.js'),Core=require('./core.js'),T=require('./timetable.js');
const flows={
 'yongsan-5':[['mode','CCM'],['stop','2A'],['tick',90],['route','2A-5T'],['mode','AUTO'],['sched','yongsan','3C_B605T']],
 'yongsan-4':[['mode','CCM'],['stop','1B'],['tick',90],['route','1B-4T'],['mode','AUTO'],['sched','yongsan','4C_B610T']],
 'yeongdeungpo-1':[['mode','CCM'],['stop','1A'],['stop','4B'],['tick',90],['route','1A-1T'],['mode','AUTO'],['sched','yeongdeungpo','4A_B622T']],
 'geumcheon-1':[['mode','CCM'],['stop','1B'],['stop','4B'],['tick',90],['route','1B-1T'],['mode','AUTO'],['mode','CCM'],['route','4A-B644T'],['mode','AUTO']],
 'geumcheon-6':[['mode','CCM'],['stop','2B'],['tick',90],['route','2B-6T'],['mode','AUTO'],['mode','CCM'],['stop','2B'],['tick',90],['route','3A-B639T'],['mode','AUTO']]
};
assert.strictEqual(S.list.length,5);
for(const sc of S.list){
 const state={},model=T.initial(),c=Core.forStation(sc.station);
 S.seed(sc,state);
 assert.strictEqual(state.mode,'AUTO',sc.id);
 assert.ok(sc.seed.routes.every(id=>state.routes[id]),sc.id+' seed routes');
 const train=S.candidates(sc,model)[0];assert.ok(train,sc.id+' has a candidate train');const run=S.newRun(sc,train);
 // nothing is done before the operator acts
 S.advance(run,{state,model});assert.ok(!run.done.some((d,i)=>d&&sc.steps[i].kind==='do'),sc.id+' pre-done');
 const doCount=sc.steps.filter(s=>s.kind==='do').length;
 const emit=e=>{run.events.push({ok:true,station:sc.station,...e});S.advance(run,{state,model});};
 for(const f of flows[sc.id]){
  if(f[0]==='mode'){const r=c.dispatch(state,{type:'mode',value:f[1],source:'LS'});assert.ok(r.ok,sc.id+' mode '+f[1]+' '+r.message);emit({type:'mode',value:f[1]});}
  else if(f[0]==='stop'){const r=c.dispatch(state,{type:'stop',id:f[1],source:'LS'});assert.ok(r.ok,sc.id+' stop '+f[1]+' '+r.message);emit({type:'stop',id:f[1]});}
  else if(f[0]==='tick'){c.dispatch(state,{type:'tick',seconds:f[1]});S.advance(run,{state,model});}
  else if(f[0]==='route'){const r=c.dispatch(state,{type:'route',id:f[1],source:'LS'});assert.ok(r.ok,sc.id+' route '+f[1]+' '+r.message);emit({type:'route',id:f[1]});}
  else if(f[0]==='sched'){const t=model.trains.find(x=>x.id===train),call=t.calls.find(x=>x.station===f[1]);call.departureRoute=f[2];S.advance(run,{state,model});}
 }
 const done=run.done.filter((d,i)=>d&&sc.steps[i].kind==='do').length;
 assert.strictEqual(done,doCount,`${sc.id}: ${done}/${doCount} do-steps; first undone: ${sc.steps.find((s,i)=>s.kind==='do'&&!run.done[i])?.text}`);
}
// order matters: setting the route before releasing does not complete later steps
{const sc=S.list[0],state={},model=T.initial(),c=Core.forStation(sc.station);S.seed(sc,state);const run=S.newRun(sc,'K1002');
 c.dispatch(state,{type:'mode',value:'CCM',source:'LS'});
 run.events.push({ok:true,type:'mode',station:'yongsan',value:'CCM'});S.advance(run,{state,model});
 assert.ok(run.done[1]&&!run.done[3]);
 run.events.push({ok:false,type:'stop',station:'yongsan',id:'2A'});S.advance(run,{state,model});assert.ok(!run.done[3],'refused events do not count');}
// the timetable is user data: other numbers, trains removed -> candidates follow the current model
{const model=T.initial();for(const tr of model.trains)tr.id='Z'+tr.id.slice(1)+'';
 const sc=S.list[0],ids=S.candidates(sc,model);assert.ok(ids.length&&ids.every(i=>i[0]==='Z'));
 const state={};S.seed(sc,state);const run=S.newRun(sc,ids[0]);const call=model.trains.find(x=>x.id===ids[0]).calls.find(x=>x.station==='yongsan');call.departureRoute='3C_B605T';
 run.events.push({ok:true,type:'mode',station:'yongsan',value:'CCM'});assert.ok(S.fill('{고장}열차 대피',run).startsWith(ids[0]));
 model.trains=model.trains.filter(x=>x.direction!=='up');assert.deepStrictEqual(S.candidates(sc,model),[]);}
console.log('scenarios: ok');
