const assert=require('assert'),T=require('./timetable.js'),S=require('./scenarios.js'),SS=require('./schedule-scenarios.js'),R=require('./schedule-routes.js'),N=require('./network.js');
const ui={graphOpen:true,graphTrain:'',tgMode:'',station:'seoul',scheduleOpen:false,scheduleMode:'',scheduleSelected:'',patternOpen:false};
const drive=(sc,ctx)=>{const run=S.newRun(sc,'');S.advance(run,ctx);return run;};
// ---- 스케줄 생성: random problems on whatever the timetable is
for(let seed=1;seed<=30;seed++){
 let k=seed;const pick=()=>{k=(k*16807)%2147483647;return k/2147483647;};
 const model=T.initial(),p=SS.planCreate(model,pick),sc=SS.createScenario(p);
 assert.ok(!model.trains.some(t=>t.id===p.id)&&p.start>=-28800&&p.start<57600,'plan is valid '+JSON.stringify(p));
 const ctx={model,ui:{...ui},events:[]},run=S.newRun(sc,'');
 const step=i=>sc.steps.filter(s=>s.kind==='do')[i];
 S.advance(run,ctx);assert.strictEqual(run.done.filter(Boolean).length,0);
 ctx.ui.scheduleOpen=true;ctx.ui.scheduleMode='create';S.advance(run,ctx);assert.ok(run.done[0]);
 // create from the pattern the way the MMI does
 const draft=T.pattern({id:p.id,from:p.from,to:p.to,start:p.start,kind:'전동열차',carCount:10});assert.ok(draft,'pattern '+JSON.stringify(p));
 const made=T.create(model,draft);assert.ok(made.ok,made.message);
 S.advance(run,ctx);assert.ok(run.done[1]&&run.done[2],'created train recognised');
 assert.strictEqual(draft.direction,p.dir);
 ctx.ui.scheduleMode='edit';ctx.ui.scheduleSelected=p.id;S.advance(run,ctx);assert.ok(run.done[3]);
 const d=structuredClone(model.trains.find(t=>t.id===p.id));d.carCount=p.carCount;d.kind=p.kind;d.service=p.service;d.flags=[p.flag];d.relatedTrain=p.related;
 const up=T.update(model,p.id,d);assert.ok(up.ok,up.message);
 S.advance(run,ctx);assert.ok(sc.steps.filter(s=>s.kind==='do').every(s=>run.done[sc.steps.indexOf(s)]),'all done '+seed);
}
// a wrongly created train is not accepted and the hint says what differs
{const model=T.initial(),p=SS.planCreate(model,()=>0.5),sc=SS.createScenario(p);
 const wrong=T.pattern({id:p.id,from:p.from,to:p.to,start:p.start+60,kind:'전동열차'});T.create(model,wrong);
 const ctx={model,ui:{...ui,scheduleOpen:true,scheduleMode:'create'},events:[]},run=S.newRun(sc,'');S.advance(run,ctx);
 assert.ok(run.done[0]&&!run.done[2]);const st=sc.steps.filter(s=>s.kind==='do')[2];assert.ok(st.explain(ctx).includes('시작시각'));}
// ---- 경합 해소: build the same kind of exercise as the 경합해소 실습 and solve it
{let model,leaderId,nearest,baseline;
 // like the 경합해소 실습: try each down train as the leader until the +2분 at the nearest 해소역 really solves it
 for(const lead of T.initial().trains.filter(t=>t.direction==='down')){
  const m=T.initial();T.copy(m,lead.id,'B0000',lead.calls[0].departure+240,{});
  const b=m.trains.find(t=>t.id==='B0000'),a0=N.stations.findIndex(s=>s.id==='yeongdeungpo')+1;
  [50,100,150,150,150,100,50].forEach((sh,k)=>{const c=b.calls.find(x=>x.station===N.stations[a0+k]?.id);if(c){c.arrival-=sh;c.departure-=sh;}});b.plan=b.calls.map(c=>({...c}));
  const found=T.conflicts(m).filter(c=>c.trains.includes('B0000'));if(!found.length||T.conflicts(m).some(c=>c.trains.includes('B0000')&&!c.trains.includes(lead.id)))continue;
  const near=T.nearestResolveStation(found[0].station,'down'),probe=structuredClone(m),pt=probe.trains.find(t=>t.id==='B0000'),pi=pt.calls.findIndex(c=>c.station===near);
  for(let k=pi;k<pt.calls.length;k++){pt.calls[k].departure+=120;if(k>pi)pt.calls[k].arrival+=120;}
  if(T.conflicts(probe).some(c=>c.trains.includes('B0000')))continue;
  model=m;leaderId=lead.id;nearest=near;baseline=structuredClone(b.calls);break;}
 assert.ok(model,'a viable exercise exists on the sample timetable');
 const b=model.trains.find(t=>t.id==='B0000');
 const sc=SS.conflictScenario({id:'B0000',leader:leaderId,nearest,baseline}),ctx={model,ui:{...ui,graphOpen:false},events:[]},run=S.newRun(sc,'');
 S.advance(run,ctx);assert.strictEqual(run.done.filter(Boolean).length,0);
 Object.assign(ctx.ui,{graphOpen:true});S.advance(run,ctx);assert.ok(run.done[0]);
 ctx.ui.graphTrain='B0000';ctx.ui.tgMode='cross';S.advance(run,ctx);assert.ok(run.done[1]&&run.done[2]);
 ctx.ui.scheduleOpen=true;ctx.ui.scheduleMode='edit';ctx.ui.scheduleSelected='B0000';S.advance(run,ctx);assert.ok(run.done[4]);
 const train=model.trains.find(t=>t.id==='B0000'),i=train.calls.findIndex(c=>c.station===nearest);
 for(let k=i;k<train.calls.length;k++){train.calls[k].departure+=120;if(k>i)train.calls[k].arrival+=120;}
 S.advance(run,ctx);assert.ok(run.done[5],'+2분 at 해소역');
 ctx.ui.station=nearest;S.advance(run,ctx);assert.ok(run.done[6]);
 const opts=R.options(nearest,'arrival').filter(r=>r!==train.calls[i].arrivalRoute),opd=R.options(nearest,'departure').filter(r=>r!==train.calls[i].departureRoute);
 train.calls[i].arrivalRoute=opts[0];train.calls[i].departureRoute=opd[0];S.advance(run,ctx);
 assert.ok(sc.steps.filter(s=>s.kind==='do').every(s=>run.done[sc.steps.indexOf(s)]),'all do-steps of the conflict scenario done');}
console.log('schedule scenarios: ok');
