(function(root){
'use strict';
// CDRS 열차경합시스템 (교통관제운영 2권 5장 2절): 경합을 검지하면 해소안(해소역에서 시각·진로 변경)을 관제사에게 제시한다.
// 관제사가 [확인]하면 스케줄의 시각·진로가 자동으로 바뀌고(승인), [취소]하면 해소안이 철회되어 관제사가 수동으로 운전정리를 한다.
// 해소안은 현재 시간표의 복사본에서 실제로 경합이 풀리는지 확인한 것만 제시한다. 알고리즘은 이 시뮬레이터의 단순화입니다(실제 CDRS는 대피역 변경 등 최적화).
const T=typeof module!=='undefined'?require('./timetable.js'):root.SimTimetable;
const N=typeof module!=='undefined'?require('./network.js'):root.SimNetwork;
const R=typeof module!=='undefined'?require('./schedule-routes.js'):root.SimScheduleRoutes;
const STEPS=[60,120,180,240,300,420,600];
const key=c=>[c.type,c.station,...c.trains].join('|');
const involving=(list,id)=>list.filter(c=>c.trains.includes(id));
function shifted(train,index,sec){for(let k=index;k<train.calls.length;k++){train.calls[k].departure+=sec;if(k>index)train.calls[k].arrival+=sec;}}
function tryFix(model,conflict,id,mode,arg){
 const m=structuredClone(model),train=m.trains.find(t=>t.id===id),before=T.conflicts(m);
 if(!train)return null;
 const at=mode==='route'?train.calls.findIndex(c=>c.station===conflict.station):train.calls.findIndex(c=>c.station===arg.station);
 if(at<0||train.calls[at].cancelled)return null;
 if(mode==='route')train.calls[at].arrivalRoute=arg.route;else shifted(train,at,arg.sec);
 if(!T.valid(train))return null;
 const after=T.conflicts(m);
 if(after.some(c=>key(c)===key(conflict))||after.length>=before.length)return null;
 if(after.some(c=>involving([c],id).length&&!before.some(b=>key(b)===key(c))))return null;     // no new conflict
 return true;
}
function propose(model,dismissed=[]){
 const out=[];
 for(const c of T.conflicts(model)){
  if(dismissed.includes(key(c)))continue;
  const candidates=c.type==='추월경합'?[c.trains[0],c.trains[1]]:[c.trains[1],c.trains[0]];
  let found=null;
  for(const id of candidates){
   const train=model.trains.find(t=>t.id===id);if(!train)continue;
   const at=train.calls.find(x=>x.station===c.station);
   if(c.type==='플랫폼 할당 경합'&&at){
    const want=train.direction==='down'?/^1/:/^2/,other=model.trains.find(t=>t.id===c.trains.find(x=>x!==id))?.calls.find(x=>x.station===c.station)?.arrivalRoute;
    for(const route of (R.options(c.station,'arrival')||[]).filter(r=>want.test(r)&&r!==at.arrivalRoute&&r!==other))
     if(tryFix(model,c,id,'route',{route})){found={kind:'route',train:id,station:c.station,route,from:at.arrivalRoute};break;}
    if(found)break;
   }
   const st=T.nearestResolveStation(c.station,train.direction);
   if(!st)continue;
   for(const sec of STEPS)if(tryFix(model,c,id,'delay',{station:st,sec})){found={kind:'delay',train:id,station:st,sec};break;}
   if(found)break;
  }
  out.push({key:key(c),conflict:c,plan:found});
 }
 return out;
}
function describe(p){
 const nm=id=>N.catalog[id]?.name||id;
 if(!p.plan)return '자동 해소안을 만들 수 없습니다 (수동 운전정리 필요)';
 return p.plan.kind==='route'?`${p.plan.train} ${nm(p.plan.station)}역 도착진로 ${p.plan.from||'—'} → ${p.plan.route}`:`${p.plan.train} ${nm(p.plan.station)}역에서 ${p.plan.sec/60}분 지연`;
}
// 승인: 해소안대로 스케줄을 자동 변경한다.
function approve(model,p){
 const plan=p.plan;if(!plan)return {ok:false,message:'적용할 해소안이 없습니다.'};
 const train=model.trains.find(t=>t.id===plan.train),at=train?.calls.findIndex(c=>c.station===plan.station);
 if(!train||at<0)return {ok:false,message:'열차를 찾을 수 없습니다.'};
 if(plan.kind==='route')train.calls[at].arrivalRoute=plan.route;else shifted(train,at,plan.sec);
 model.changes.push({type:'cdrs',id:plan.train,station:plan.station,...(plan.kind==='route'?{route:plan.route}:{minutes:plan.sec/60})});
 return {ok:true,message:`CDRS 해소안 승인: ${describe(p)}`};
}
const api={propose,approve,describe,key};
if(typeof module!=='undefined')module.exports=api;else root.SimCDRS=api;
})(typeof window!=='undefined'?window:globalThis);
