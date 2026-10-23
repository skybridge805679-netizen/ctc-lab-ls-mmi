(function(root){
'use strict';
// 열차자동제어 (실기3 3.4, p.58-62): in AUTO mode the schedule (도착/출발진로, 시각) drives the routes of a station without the controller.
// Virtual trains move along the timetable: an approaching train sets the trigger point (접근 flag), the arrival route is requested,
// the train enters (occupy) and arrives (clear), then the departure route is requested, entered and cleared. Requests are only made
// while the station is in AUTO at the moment of the request; the movement itself does not depend on the mode.
// Simplifications (documented): double track only, no 입환/분할/병합, no 역진로(ANTI ROUTE)/TTB, tracks occupied by a dwelling train
// are not modelled. A train that had to wait at a signal gets its delay recorded (actuals); the schedule keeps its planned times unless
// reflect is on, in which case the following calls of that train are pushed back by the delay.
const TRIGGER_LEAD=60;   // 도착신호기 후방 2번째 폐색궤도 ≈ 60 s before arrival (교육용 값)
const ENTER_LEAD=20;     // the train needs 20 s to run through the arrival route
const DEP_LEAD=60;       // a stopping train gets its departure route 60 s before departure
const EXIT_LEAD=20;      // and needs 20 s to clear the departure route
const DELAY_MIN=30;     // 이 이상 늦으면 지연으로 기록
const PASS_DWELL=120;    // 복선: dwell ≤ 2 min counts as 통과
const T=typeof module!=='undefined'?require('./timetable.js'):root.SimTimetable;
const Network=typeof module!=='undefined'?require('./network-topology.js'):root.SimNetworkTopology;
const internal=text=>String(text||'').replace('_','-');

function create({core,stations,refresh=()=>{}}){
 const mem=new Map(),troubles=new Map(),actual=new Map(),started=new Map(),outside=new Map();
 const controlled=new Set(stations.filter(s=>s.controlled).map(s=>s.id));
 function plan(train,call){
  const a=call.arrival,d=call.departure,hasArr=!!call.arrivalRoute&&call.stopType!=='시발',hasDep=!!call.departureRoute&&call.stopType!=='종착';
  const pass=d-a<=PASS_DWELL;
  return {hasArr,hasDep,tTrig:(hasArr?a:d)-TRIGGER_LEAD,tArr:a-ENTER_LEAD,tDepReq:hasArr&&pass?a:d-DEP_LEAD,tDep:d,arrRoute:internal(call.arrivalRoute),depRoute:internal(call.departureRoute)};
 }
// 자동제어 조건 ⑥ TTB(연속통과진로)가 설정되어 있지 않을 것, ⑦ 역진로(ANTI ROUTE)가 설정되어 있지 않을 것.
 // 조건 ④⑤(신호기·전환기 고장)는 코어의 진로 설정 검사가 거절하고, ⑧(단선 허가)은 단선 구간이 없는 이 선로에는 해당하지 않는다.
 function blocked(s,c,id){
  if((s.ttb||[]).includes(id))return `${id} 진로에 연속통과진로(TTB)가 설정되어 있습니다`;
  const r=c.routes[id],dir=c.signals[r.signal].dir,res=r.resources||[];
  const anti=Object.keys(s.routes).find(o=>c.signals[c.routes[o].signal].dir!==dir&&(c.routes[o].resources||[]).some(t=>res.includes(t)));
  return anti?`${anti} 역방향 진로(ANTI ROUTE)가 설정되어 있습니다`:null;
 }
 const key=(t,c)=>t.id+'|'+c.station;
 function step({states,model,numbers,reflect=false}){
  const events=[];let changed=false;
  const emit=e=>{events.push(e);changed=true;};
  const todo=[];
  for(const train of model.trains){
   if(train.cancelled)continue;
   for(const call of train.calls){
    if(call.cancelled||!controlled.has(call.station))continue;
    todo.push({train,call,p:plan(train,call)});
   }
  }
  todo.sort((x,y)=>x.p.tTrig-y.p.tTrig);        // earliest train first (우선순위)
  for(const {train,call} of todo){
   if(outside.has(train.id))continue;
   const planned=plan(train,call);
   const station=call.station,s=states[station],c=core.forStation(station);if(!s)continue;
   const t=s.clock,k=key(train,call);let m=mem.get(k);
   if(!started.has(train.id))started.set(train.id,t);
   const calls=train.calls.filter(x=>!x.cancelled&&controlled.has(x.station)),index=calls.indexOf(call),previous=calls[index-1],prior=previous&&mem.get(key(train,previous));
   // A downstream station must not independently create the same train while it is still upstream.
   if(previous&&(!prior||prior.stage<7))continue;
   const inherited=prior?.propagatedDelay||0,p={...planned};
   for(const field of ['tTrig','tArr','tDepReq','tDep'])p[field]+=inherited;
   if(!m){m={stage:0,inheritedDelay:inherited};mem.set(k,m);}
   if(m.stage>=7)continue;
   m.inheritedDelay=inherited;
   const auto=s.mode==='AUTO'&&!s.pending;
   const R=c.routes;
   const request=(id,label)=>{
    refresh();
    if(!R[id]){const msg=`${id} 진로가 이 역에 없습니다`;if(!m.unknown?.[id]){(m.unknown??={})[id]=1;troubles.set(k,{station,train:train.id,route:id,reason:msg,since:t});emit({type:'trouble',station,train:train.id,route:id,reason:msg});}return 'unknown';}
    if(s.routes[id])return 'set';
    const why=blocked(s,c,id);
    if(why){if(m.troubleRoute!==id||m.troubleWhy!==why){m.troubleAt=t;m.troubleRoute=id;m.troubleWhy=why;troubles.set(k,{station,train:train.id,route:id,reason:why,since:t});emit({type:'trouble',station,train:train.id,route:id,reason:why});}return 'wait';}
    const r=c.dispatch(s,{type:'route',id,auto:true,source:'AUTO'});
    if(r.ok){if(troubles.delete(k))emit({type:'resolved',station,train:train.id,route:id});emit({type:'route',station,train:train.id,route:id,label});return 'set';}
    if(!m.troubleAt||m.troubleRoute!==id){m.troubleAt=t;m.troubleRoute=id;troubles.set(k,{station,train:train.id,route:id,reason:r.message,since:t});emit({type:'trouble',station,train:train.id,route:id,reason:r.message});}
    return 'wait';
   };
   // a call whose time is long gone (timetable edited, or AUTO started late) is finished without acting
   if(m.stage===0&&started.get(train.id)>planned.tDep+EXIT_LEAD+30){m.stage=7;m.skipped=true;continue;}
   if(m.stage===0&&p.hasArr&&t<p.tTrig)continue;
   if(m.stage===0&&!p.hasArr&&t<p.tTrig)continue;
   // ---- arrival side
   if(p.hasArr&&m.stage<4){
    if(numbers?.ready&&!numbers.ready(station,train))continue;
    if(m.stage===0){
     // AUTO started while the train already stands at the platform: just place its number
     if(t>=call.arrival+inherited&&started.get(train.id)>=call.arrival+inherited){m.stage=4;numbers?.place(station,R[p.arrRoute]?.destination,train);emit({type:'arrived',station,train:train.id});}
     else{
      if(R[p.arrRoute]&&!s.approach[R[p.arrRoute].signal]){c.dispatch(s,{type:'approach',signal:R[p.arrRoute].signal,present:true,source:'AUTO'});}
      m.stage=1;emit({type:'approach',station,train:train.id});
     }
    }
    if(m.stage===1){
     if(!auto)continue;                              // 요구 시점에 AUTO가 아니면 진로요구를 하지 않는다
     if(request(p.arrRoute,'장내')==='set')m.stage=2;
    }
    if(m.stage===2){
     if(numbers?.canEnter&&!numbers.canEnter(station,train))continue;
     if(!s.routes[p.arrRoute]){m.stage=1;continue;}  // the route was cancelled by the controller: ask again if still AUTO
     if(t>=p.tArr&&!s.routes[p.arrRoute].lock){
      const r=c.dispatch(s,{type:'occupy',id:p.arrRoute,number:train.id,source:'AUTO'});
      if(r.ok){s.routes[p.arrRoute].train.number=train.id;m.enteredAt=t;m.arrDelay=Math.max(0,t-planned.tArr);m.stage=3;emit({type:'enter',station,train:train.id,route:p.arrRoute});numbers?.place(station,R[p.arrRoute].destination,train);}
     }
    }
    if(m.stage===3&&t>=m.enteredAt+ENTER_LEAD){
     if(s.routes[p.arrRoute]?.occupied)c.dispatch(s,{type:'clear',id:p.arrRoute,source:'AUTO'});
     m.stage=4;emit({type:'arrived',station,train:train.id,route:p.arrRoute});
    }
   }else if(!p.hasArr&&m.stage<4){m.stage=4;numbers?.place(station,R[p.depRoute]?.geometryRails?.[0]||null,train);}
   // ---- departure side
   if(m.stage>=4&&m.stage<7){
    if(!p.hasDep){m.stage=7;m.propagatedDelay=Math.max(inherited,m.arrDelay||0);numbers?.remove(station,train);emit({type:'terminated',station,train:train.id});continue;}
    if(m.stage===4&&t>=p.tDepReq){
     if(!auto)continue;
     if(request(p.depRoute,'출발')==='set')m.stage=5;
    }
    if(m.stage===5){
     if(!s.routes[p.depRoute]){m.stage=4;continue;}
     if(t>=p.tDep&&!s.routes[p.depRoute].lock){
      refresh();
      const blocker=s.exitBlocked?.[R[p.depRoute]?.destination];if(blocker&&blocker!==train.id)continue;
      const r=c.dispatch(s,{type:'occupy',id:p.depRoute,number:train.id,source:'AUTO'});
      if(r.ok){s.routes[p.depRoute].train.number=train.id;m.leftAt=t;m.stage=6;emit({type:'depart',station,train:train.id,route:p.depRoute});numbers?.depart(station,R[p.depRoute].destination,train);}
     }
    }
    if(m.stage===6&&t>=m.leftAt+EXIT_LEAD){
     if(s.routes[p.depRoute]?.occupied)c.dispatch(s,{type:'clear',id:p.depRoute,source:'AUTO'});
     m.stage=7;m.propagatedDelay=Math.max(inherited,m.leftAt-call.departure);numbers?.remove(station,train);emit({type:'left',station,train:train.id,route:p.depRoute});
     // 신호 대기로 늦은 시분을 실적으로 남긴다 (스케줄의 계획 시각은 그대로; reflect일 때만 뒤 역의 시각을 같이 민다)
     const depDelay=Math.max(0,m.leftAt-planned.tDep),arrDelay=m.arrDelay||0;
     if(depDelay||arrDelay){
      actual.set(k,{train:train.id,station,planArrival:call.arrival,planDeparture:call.departure,arrDelay,depDelay});
      if(Math.max(depDelay,arrDelay)>=DELAY_MIN)emit({type:'delay',station,train:train.id,arrDelay,depDelay});
      if(reflect&&depDelay>=DELAY_MIN){
       const i=train.calls.findIndex(x=>x.station===station);
       if(i>=0&&i<train.calls.length-1){const copy=structuredClone(train);for(let q=i+1;q<copy.calls.length;q++){copy.calls[q].arrival+=depDelay;copy.calls[q].departure+=depDelay;}
        if(T.valid(copy)){for(let q=i+1;q<train.calls.length;q++){train.calls[q].arrival+=depDelay;train.calls[q].departure+=depDelay;}model.changes.push({type:'delay',auto:true,id:train.id,station:train.calls[i+1].station,seconds:depDelay});m.propagatedDelay=0;emit({type:'reflected',station,train:train.id,seconds:depDelay});}}
      }
     }
     const boundary=Network.physical.boundaries.find(b=>b.station===station&&b.code===R[p.depRoute]?.destination);
     if(boundary){outside.set(train.id,boundary);emit({type:'externalHandover',station,train:train.id,boundary:boundary.id});}
     else numbers?.handoff?.(station,train,R[p.depRoute]?.destination,m.propagatedDelay);
    }
   }
  }
  return {changed,events};
 }
 function run(ctx,cap=25){const all=[];for(let i=0;i<cap;i++){const r=step(ctx);all.push(...r.events);if(!r.changed)break;}return all;}
 function position(train,now){
  if(train.cancelled||!started.has(train.id))return null;
  const boundary=outside.get(train.id);if(boundary)return {station:boundary.station,order:stations.find(s=>s.id===boundary.station).order,status:'기지 인계',actual:true,boundary:boundary.id};
  const calls=train.calls.filter(c=>!c.cancelled&&controlled.has(c.station));
  const active=calls.find(c=>{const m=mem.get(key(train,c));return m&&!m.skipped&&m.stage<7;});
  if(active){const m=mem.get(key(train,active));if(m.stage>=1)return {station:active.station,order:stations.find(s=>s.id===active.station).order,status:m.stage<3?'접근':m.stage===3?'진입':m.stage===6?'출발':'정차',actual:true};}
  const done=[...calls].reverse().find(c=>{const m=mem.get(key(train,c));return m?.stage===7&&!m.skipped;});
  if(done){const m=mem.get(key(train,done));if(done.stopType==='종착')return null;
   const next=calls[calls.indexOf(done)+1],offset=m.propagatedDelay||0;
   const running=T.position({...train,calls:train.calls.map(c=>{const m=mem.get(key(train,c));return {...c,arrival:m?.enteredAt!==undefined?m.enteredAt+ENTER_LEAD:c.arrival+offset,departure:m?.leftAt??c.departure+offset};})},now);
   if(running&&(!next||Math.abs(running.order-stations.find(s=>s.id===done.station).order)<=Math.abs(stations.find(s=>s.id===next.station).order-stations.find(s=>s.id===done.station).order)))return {...running,actual:true,path:next?Network.path(done.station,next.station):null};
  }
  return null;
 }
 return {step,run,position,reset:()=>{mem.clear();troubles.clear();actual.clear();started.clear();outside.clear();},actuals:()=>[...actual.values()],troubles:()=>[...troubles.values()],stageOf:(t,c)=>mem.get(key(t,c))?.stage??0};
}
const api={create,TRIGGER_LEAD,ENTER_LEAD,DEP_LEAD,EXIT_LEAD,PASS_DWELL};
if(typeof module!=='undefined')module.exports=api;else root.SimAuto=api;
})(typeof window!=='undefined'?window:globalThis);
