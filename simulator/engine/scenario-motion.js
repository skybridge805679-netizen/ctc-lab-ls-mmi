/* Scenario trains use the same interlocking and virtual clock as timetable trains. */
(function(root){'use strict';
const node=typeof module!=='undefined',Core=node?require('./core'):root.SimCore,W=node?require('./wiring'):root.SimWiring,LS=node?require('./track-geometry'):root.SimTrackGeometry,N=node?require('./network'):root.SimNetwork,L=node?require('./line'):root.SimLine;
function point(station,slot){
 const def=W.data[station],r=def?.rails.find(r=>r[0]===slot);
 if(r){const x=r[2]??(r[1][0][0]+r[1].at(-1)[0])/2;return [x,LS.railY(def,r[0],x)];}
 const c=LS.sceneOf(N.catalog[station]).cells.find(c=>c[3].split(' · ').includes(slot)||c[3].replaceAll(' · ','')===slot);
 if(c)return [c[0]+c[2]/2,c[1]];
 const rail=def?.rails.find(r=>r[3]===slot||r[4]===slot);return rail?(rail[3]===slot?rail[1][0]:rail[1].at(-1)):null;
}
function candidates(station,from,to,direction){
 const def=W.data[station],C=Core.forStation(station),a=point(station,from),b=point(station,to);if(!a||!b)return [];
 const platform=def.rails.some(r=>r[0]===from),targetPlatform=def.rails.some(r=>r[0]===to),dir=direction==='up'?-1:1;
 return Object.entries(C.routes).flatMap(([id,r])=>{
  const sig=def.signals.find(s=>s[0]===r.signal);if(!sig||sig[4]!==dir)return [];
  const ry=LS.railY(def,sig[1],sig[2]);
  if(platform?sig[1]!==from:Math.abs(a[1]-ry)>8||(sig[2]-a[0])*dir<-10)return [];
  if(!platform&&def.signals.some(other=>other[0]!==sig[0]&&/^\d+[AB]$/.test(other[0])&&other[4]===dir&&Math.abs(LS.railY(def,other[1],other[2])-a[1])<8&&(other[2]-a[0])*dir>=0&&(other[2]-sig[2])*dir<-.1))return [];
  const end=point(station,r.destination);if(!end)return [];
  if(targetPlatform?r.destination!==to:!/^B/.test(r.destination)||Math.abs(end[1]-b[1])>8)return [];
  return [{id,score:(r.destination===to?0:100000)+Math.abs(sig[2]-a[0])+Math.abs(end[0]-b[0])}];
 }).sort((a,b)=>a.score-b.score).map(x=>x.id);
}
function create(host){
 let serial=0,jobs=[];const states=()=>host.states(),ls=()=>host.model();
 const locate=uid=>{for(const [station,s]of Object.entries(ls().stations))for(const [slot,rows]of Object.entries(s.windows))for(const train of rows)if(train.uid===uid)return {station,slot,train};return null;};
 const now=j=>states()[j.station]?.clock??0;
 function release(j){if(j.route&&states()[j.station]?.routes[j.route]?.train?.scenario===j.id){Core.forStation(j.station).dispatch(states()[j.station],{type:'clear',id:j.route,source:'SCENARIO'});}for(const s of Object.values(states()))if(s.scenarioMotions)s.scenarioMotions=s.scenarioMotions.filter(m=>m.id!==j.id);}
 function request(action,manual=false){
  const f=locate(action.uid);if(!f)return {ok:false,message:'이동할 열차번호가 없습니다.'};
  let check=host.validate({...action,station:f.station,slot:f.slot});
  if(!check.ok&&action.op==='move'&&jobs.some(j=>j.uid===action.uid&&!['done','cancelled'].includes(j.phase)))check=host.validate({op:'insert',station:action.targetStation,slot:action.targetSlot,number:f.train.number,direction:f.train.direction});
  if(!check.ok)return check;
  const existing=jobs.find(j=>j.uid===action.uid&&!['done','cancelled'].includes(j.phase)&&j.action.op===action.op&&j.action.targetStation===action.targetStation&&j.action.targetSlot===action.targetSlot);
  if(existing){if(manual){existing.manual=true;step();}return {ok:true,pending:true,message:manual?'수동 이동 확인 · 진행 대기':'이미 이동 대기 중입니다.'};}
  const previous=[...jobs].reverse().find(j=>j.uid===action.uid&&!['done','cancelled'].includes(j.phase));
  const j={id:'SCM'+(++serial),uid:action.uid,number:f.train.number,station:f.station,fromStation:previous?.action.targetStation||f.station,from:previous?.action.targetSlot||f.slot,to:action.targetSlot||'관제구간 밖',action:{...action},manual,phase:'waiting',reason:'앞 열차 통과 대기'};jobs.push(j);step();return {ok:true,pending:j.phase!=='done',message:f.train.number+' 이동 접수 · '+(j.reason||'진행 중')};
 }
 function begin(j,f){
  L?.refresh(states(),ls());
  j.station=f.station;j.fromStation=f.station;j.from=f.slot;j.number=f.train.number;if(j.action.op==='move'&&j.action.targetStation===f.station&&j.action.targetSlot===f.slot){j.phase='done';return;}
  const target=j.action.targetStation||f.station;let to=j.action.targetSlot;
  // Deletion at the scenario's exit beat waits for earlier movement, then leaves the displayed area.
  if(j.action.op==='delete'){
   const def=W.data[f.station],dir=f.train.direction==='up'?-1:1;
   if(def.rails.some(r=>r[0]===f.slot)){
    const C=Core.forStation(f.station),id=Object.keys(C.routes).find(id=>/^B/.test(C.routes[id].destination)&&def.signals.some(sig=>sig[0]===C.routes[id].signal&&sig[1]===f.slot&&sig[4]===dir));
    if(!id){j.reason='출발진로 확인 필요';return;}to=C.routes[id].destination;
   }else{
    const a=point(f.station,f.slot);if(!a){j.reason='출발 회로 확인 필요';return;}
    const ahead=def.signals.some(sig=>/^[12][AB]$/.test(sig[0])&&sig[4]===dir&&Math.abs(LS.railY(def,sig[1],sig[2])-a[1])<8&&(sig[2]-a[0])*dir>0);
    const rail=def.rails.find(r=>Math.abs(r[1][dir===1?r[1].length-1:0][1]-a[1])<8&&(dir===1?r[4]:r[3]));
    if(ahead&&rail){to=dir===1?rail[4]:rail[3];}
    else {const s=states()[f.station];j.phase='block';j.fromTime=s.clock;j.until=s.clock+20;j.reason='관제구간 밖으로 출발';(s.scenarioMotions??=[]).push({id:j.id,uid:j.uid,number:j.number,points:[a,[a[0]+dir*40,a[1]]],from:s.clock,to:s.clock+20});return;}
   }
  }
  const C=Core.forStation(f.station),s=states()[f.station];
  const a=point(f.station,f.slot),b=point(target,to),def=W.data[f.station];
  const straight=target===f.station&&a&&b&&Math.abs(a[1]-b[1])<6&&!def.rails.some(r=>r[0]===f.slot||r[0]===to)&&!def.signals.some(sig=>Math.abs(LS.railY(def,sig[1],sig[2])-a[1])<6&&sig[2]>Math.min(a[0],b[0])&&sig[2]<Math.max(a[0],b[0]));
  const ids=target===f.station&&!straight?candidates(f.station,f.slot,to,f.train.direction):[];
  const active=ids.find(id=>s.routes[id]&&!s.routes[id].occupied&&!s.routes[id].lock);
  const partial=!active&&!straight&&target===f.station?Object.keys(C.routes).filter(id=>!ids.length||!!s.routes[id]).filter(id=>{
   const r=C.routes[id];return r.destination!==f.slot&&!/^B/.test(r.destination)&&candidates(f.station,f.slot,r.destination,f.train.direction).includes(id)&&candidates(f.station,r.destination,to,f.train.direction).length;
  }).sort((a,b)=>Number(!!s.routes[b])-Number(!!s.routes[a]))[0]:null;
  let id=j.manual&&!active?null:active||partial||ids[0];j.legTo=id&&id===partial?C.routes[partial].destination:null;

  if(id){
   if(s.mode==='LOCAL'||s.pending){j.reason='관제 제어권 확인 대기';return;}
   const r0=C.routes[id],blocked=s.exitBlocked?.[r0.destination];
   if(blocked&&blocked!==j.number){j.reason='전방 폐색 구간에 열차 '+blocked+' · '+id;return;}
   const fault=(s.faults?.signals||[]).includes(r0.signal)||(r0.pointLocks||[]).some(p=>(s.faults?.points||[]).includes(p));
   if(fault){j.reason='진로 내 신호기·전환기 장애';return;}
   const targetRows=ls().stations[target]?.windows[to]||[];
   if(targetRows.some(t=>t.uid!==j.uid)&&W.data[target].rails.some(r=>r[0]===to)&&!j.manual){j.reason='도착 선로의 선행열차 통과 대기';return;}
   if((s.ttb||[]).includes(id)){j.reason='연속통과진로(TTB) 취급 확인 · '+id;return;}
   if(!s.routes[id]){
    if(s.mode!=='AUTO'){j.reason='진로 설정 대기 · '+id;return;}
    // The core checks mode, faults, overlaps, blocked switches and conflicting routes.
    const trial=structuredClone(s),test=C.dispatch(trial,{type:'route',id,auto:true,source:'SCENARIO'});
    if(!test.ok){j.reason=test.message;return;}
    C.dispatch(s,{type:'route',id,auto:true,source:'SCENARIO'});
   }
   if(s.routes[id].occupied||s.routes[id].lock){j.reason='앞 열차 통과·쇄정 해제 대기 · '+id;return;}
   if(s.signals[C.routes[id].signal]!=='GO'){j.reason='진행신호 대기 · '+C.routes[id].signal;return;}
   const r=C.dispatch(s,{type:'occupy',id,number:j.number,seconds:20,source:'SCENARIO'});if(!r.ok){j.reason=r.message;return;}
   Object.assign(s.routes[id].train,{scenario:j.id,uid:j.uid,number:j.number});j.route=id;j.phase='moving';j.fromTime=s.clock;j.until=s.clock+20;j.reason='진로 진행 · '+id;return;
  }
  if(!straight&&!j.manual&&!j.action.handover){j.reason='일치하는 진로가 없습니다 · 수동 이동 확인 필요';return;}
  if(!a||!b){j.reason='열번창 위치 확인 필요';return;}
  // Manual opposite-line / inter-station transfers are explicit handovers. Never invent a crossover.
  j.phase=straight?'block':'handover';j.fromTime=s.clock;j.until=s.clock+20;j.reason=straight?'역간 회로 진행':j.manual?'수동 이동 · 인계 진행':'역간 운행 · 관할 인계';
  const add=(station,points,from,to)=>{(states()[station].scenarioMotions??=[]).push({id:j.id,uid:j.uid,number:j.number,points,from:from+states()[station].clock-s.clock,to:to+states()[station].clock-s.clock,manual:j.manual});};
  if(straight)add(f.station,[a,b],s.clock,s.clock+20);
  else {add(f.station,[a,[a[0]+(f.train.direction==='up'?-30:30),a[1]]],s.clock,s.clock+10);add(target,[[b[0]+(f.train.direction==='up'?30:-30),b[1]],b],s.clock+10,s.clock+20);}
 }
 function stepOnce(){
  let changed=false;
  for(const j of jobs){
   if(['done','cancelled'].includes(j.phase))continue;
   const f=locate(j.uid);
   if(!f){release(j);j.phase='cancelled';changed=true;continue;}
   if(j.phase==='waiting'){
    if(jobs.some(p=>p!==j&&p.uid===j.uid&&p.id!==j.id&&jobs.indexOf(p)<jobs.indexOf(j)&&!['done','cancelled'].includes(p.phase)))continue;
    const phase=j.phase,reason=j.reason;begin(j,f);changed||=phase!==j.phase||reason!==j.reason;
   }else if(f.station!==j.station||f.slot!==j.from||(j.route&&states()[j.station]?.routes[j.route]?.train?.scenario!==j.id)){
    release(j);j.phase='cancelled';j.reason='열차 위치·모의점유 변경으로 취소';changed=true;
   }else if(now(j)>=j.until){
    const operation=j.legTo?{op:'move',station:f.station,slot:f.slot,uid:j.uid,targetStation:f.station,targetSlot:j.legTo}:{...j.action,station:f.station,slot:f.slot,uid:j.uid};
    const result=host.commit(operation);
    if(result.ok){release(j);j.route=null;j.phase=j.legTo?'waiting':'done';j.reason=j.legTo?'다음 진로 진행 대기':'도착';j.legTo=null;changed=true;if(j.phase==='waiting')begin(j,locate(j.uid));}else{j.reason=result.message;}
   }
  }
  return changed;
 }
 function step(){let changed=false;for(let i=0;i<Math.min(jobs.length+1,32);i++){const result=stepOnce();changed||=result;if(!result)break;}return changed;}
 function reset(){for(const j of jobs)release(j);jobs=[];}
 return {request,step,reset,list:()=>jobs.map(j=>({...j,action:{...j.action}})),busy:()=>jobs.some(j=>!['done','cancelled'].includes(j.phase))};
}
const inTransit=(state,uid)=>Object.values(state?.routes||{}).some(r=>r.occupied&&r.train?.scenario&&r.train.uid===uid)||(state?.scenarioMotions||[]).some(m=>m.uid===uid);
const api={create,candidates,point,inTransit};if(node)module.exports=api;else root.SimScenarioMotion=api;
})(typeof window!=='undefined'?window:globalThis);
