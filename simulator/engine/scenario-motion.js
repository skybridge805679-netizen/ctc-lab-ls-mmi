/* Scenario trains use the same interlocking and virtual clock as timetable trains. */
(function(root){'use strict';
const node=typeof module!=='undefined',Core=node?require('./core'):root.SimCore,W=node?require('./wiring'):root.SimWiring,LS=node?require('./track-geometry'):root.SimTrackGeometry,N=node?require('./network'):root.SimNetwork,L=node?require('./line'):root.SimLine,TW=node?require('./train-windows'):root.SimTrainWindows;
function point(station,slot){
 const def=W.data[station],r=def?.rails.find(r=>r[0]===slot);
 if(r){const x=r[2]??(r[1][0][0]+r[1].at(-1)[0])/2;return [x,LS.railY(def,r[0],x)];}
 const c=LS.sceneOf(N.catalog[station]).cells.find(c=>c[3].split(' · ').includes(slot)||c[3].replaceAll(' · ','')===slot);
 if(c)return [c[0]+c[2]/2,c[1]];
 const rail=def?.rails.find(r=>r[3]===slot||r[4]===slot);return rail?(rail[3]===slot?rail[1][0]:rail[1].at(-1)):null;
}
function candidates(station,from,to,direction){
 const def=W.data[station],C=cachedCore(station),a=point(station,from),b=point(station,to);if(!a||!b)return [];
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
// 출발 지시를 받은 열차는 역을 벗어나 사라지지 않고 같은 본선을 따라 다음 역들로 이어 달린다 (베타 피드백).
// 경로: 출발 폐색 → 중간역 열번창 → 다음 연동역 진입 열번창 → 그 역 본선 승강장 → … 관제구간 끝, 또는 본선이 여러 선로로 갈리는 역(구로·용산) 앞까지.
// 장내·출발은 진로로만 지나고(진로가 없으면 그 앞에서 기다린다), 폐색 사이는 인계 이동이다.
function onward(station,slot,direction){
 const legs=[],down=direction==='down',has=(id,x)=>(TW?.data?.[id]||[]).some(w=>w.slot===x),stations=L?.line?.stations||{};
 const push=l=>{const last=legs.at(-1)||{station,slot};if(last.station===l.station&&last.slot===l.slot)return;legs.push(l);};
 let cur=station,S=stations[cur],trunk=L.trunkOf(slot);
 if(!trunk)trunk=Object.keys(S?.trunks||{}).find(t=>t.endsWith(down?'D':'U')&&S.trunks[t].rails.includes(slot));
 if(!trunk||trunk.endsWith('D')!==down)return legs;
 let T=S?.trunks[trunk],rail=T?.rails.includes(slot)?slot:null;
 if(!rail){               // 폐색 열번창: 이 역으로 들어오는 쪽이면 승강장으로, 나가는 쪽이면 다음 역으로
  if(!T)return legs;const n=L.numberOf(slot),approach=down?n<=L.numberOf(T.left):n>=L.numberOf(T.right);
  if(approach){if(T.rails.length!==1)return legs;rail=T.rails[0];push({station:cur,slot:rail});}
 }
 for(let hop=0;hop<16;hop++){
  let nx=L.next(cur,trunk,direction);
  if(!nx&&rail){const sib=Object.keys(S.trunks).find(x=>x!==trunk&&x.endsWith(trunk.at(-1))&&S.trunks[x].rails.includes(rail)&&L.next(cur,x,direction));if(sib){trunk=sib;T=S.trunks[trunk];nx=L.next(cur,trunk,direction);}}   // 1호선 직결: 지하 본선(M) ↔ 전동차선(E)
  if(!nx)break;
  const S2=stations[nx.station],T2=S2?.trunks[trunk];if(!T2||T2.rails.length!==1)break;
  // 다음 역 장내 앞(진입 쪽)에 열번창이 없으면 장내 신호를 지킬 수 없다: 거기서 이어 달리기를 끝낸다 (예: 노량진 하1선 — 가장 가까운 칸이 역을 지난 대방)
  const entry=L.entrySlot(nx.station,trunk,direction,(TW.data[nx.station]||[]).map(w=>w.slot)),en=entry&&L.numberOf(entry);
  if(!entry||(down?en>L.numberOf(T2.left):en<L.numberOf(T2.right)))break;
  const exitCode=down?T.right:T.left,fromRail=!!rail&&(legs.at(-1)||{slot}).slot===rail,mark=legs.length;
  if(fromRail&&has(cur,exitCode))push({station:cur,slot:exitCode});
  const leaving=fromRail&&!has(cur,exitCode)?exitCode:null;let first=true;      // 출발 폐색 열번창이 없는 역은 출발 진로를 지난 뒤 바로 다음 열번창으로
  const hop1=l=>{push({...l,handover:true,...(first&&leaving?{exitCode:leaving}:{})});first=false;};
  for(const v of L.viaStations(cur,nx.station,trunk))if(has(v.host,v.slot))hop1({station:v.host,slot:v.slot});
  hop1({station:nx.station,slot:entry});
  // 승강장을 떠나기 전에 다음 역 장내 앞까지의 폐색이 모두 비어 있어야 한다 (폐색 한가운데 서서 남의 진로를 막지 않는다)
  if(fromRail&&legs.length>mark)legs[mark].clear=legs.slice(mark).map(l=>({station:l.station,slot:l.slot}));
  cur=nx.station;S=S2;T=T2;rail=T2.rails[0];push({station:cur,slot:rail});
 }
 return legs;
}
const coreCache=new Map();function cachedCore(id){if(!coreCache.has(id))coreCache.set(id,Core.forStation(id));return coreCache.get(id);}
function create(host){
 let serial=0,jobs=[];const states=()=>host.states(),ls=()=>host.model();
 const locate=uid=>{for(const [station,s]of Object.entries(ls().stations))for(const [slot,rows]of Object.entries(s.windows))for(const train of rows)if(train.uid===uid)return {station,slot,train};return null;};
 const now=j=>states()[j.station]?.clock??0;
 function release(j){if(j.route&&states()[j.station]?.routes[j.route]?.train?.scenario===j.id){cachedCore(j.station).dispatch(states()[j.station],{type:'clear',id:j.route,source:'SCENARIO'});}for(const s of Object.values(states()))if(s.scenarioMotions)s.scenarioMotions=s.scenarioMotions.filter(m=>m.id!==j.id);}
 function request(action,manual=false){
  const f=locate(action.uid);if(!f)return {ok:false,message:'이동할 열차번호가 없습니다.'};
  let check=host.validate({...action,station:f.station,slot:f.slot});
  if(!check.ok&&action.op==='move'&&jobs.some(j=>j.uid===action.uid&&!['done','cancelled'].includes(j.phase)))check=host.validate({op:'insert',station:action.targetStation,slot:action.targetSlot,number:f.train.number,direction:f.train.direction});
  if(!check.ok)return check;
  const existing=jobs.find(j=>j.uid===action.uid&&!['done','cancelled'].includes(j.phase)&&j.action.op===action.op&&j.action.targetStation===action.targetStation&&j.action.targetSlot===action.targetSlot);
  if(existing){if(manual){existing.manual=true;step();}return {ok:true,pending:true,message:manual?'수동 이동 확인 · 진행 대기':'이미 이동 대기 중입니다.'};}
  const previous=[...jobs].reverse().find(j=>j.uid===action.uid&&!['done','cancelled'].includes(j.phase));
  if(action.op==='delete'&&!manual&&!action.runOn){      // 자동 출발: 본선을 따라 이어 달린 뒤 관제구간 밖으로
   const from=previous?.action.op==='move'?{station:previous.action.targetStation||previous.station,slot:previous.action.targetSlot}:{station:f.station,slot:f.slot};
   const legs=onward(from.station,from.slot,f.train.direction);let result=null;
   for(const [i,l] of legs.entries()){const r=request({op:'move',uid:action.uid,station:f.station,slot:f.slot,targetStation:l.station,targetSlot:l.slot,handover:!!l.handover,...(l.exitCode?{exitCode:l.exitCode}:{}),...(l.clear?{clear:l.clear}:{}),runOn:true,background:i>0},false);result??=r;if(!r.ok)break;}
   const last=request({...action,runOn:true,background:legs.length>0},false);return result||last;
  }
  const j={id:'SCM'+(++serial),uid:action.uid,number:f.train.number,background:!!action.background,station:f.station,fromStation:previous?.action.targetStation||f.station,from:previous?.action.targetSlot||f.slot,to:action.targetSlot||'관제구간 밖',action:{...action},manual,phase:'waiting',reason:'앞 열차 통과 대기'};jobs.push(j);step();return {ok:true,pending:j.phase!=='done',message:f.train.number+' 이동 접수 · '+(j.reason||'진행 중')};
 }
 function begin(j,f){
  L?.refresh(states(),ls());
  j.station=f.station;j.fromStation=f.station;j.from=f.slot;j.number=f.train.number;if(j.action.op==='move'&&j.action.targetStation===f.station&&j.action.targetSlot===f.slot){j.phase='done';return;}
  const target=j.action.targetStation||f.station;let to=j.action.targetSlot;
  // Deletion at the scenario's exit beat waits for earlier movement, then leaves the displayed area.
  if(j.action.op==='delete'){
   const def=W.data[f.station],dir=f.train.direction==='up'?-1:1;
   if(def.rails.some(r=>r[0]===f.slot)){
    const C=cachedCore(f.station),id=Object.keys(C.routes).find(id=>/^B/.test(C.routes[id].destination)&&def.signals.some(sig=>sig[0]===C.routes[id].signal&&sig[1]===f.slot&&sig[4]===dir));
    if(!id){if(!j.action.runOn||!j.action.background){j.reason='출발진로 확인 필요';return;}const s=states()[f.station],a=point(f.station,f.slot);j.phase='block';j.fromTime=s.clock;j.until=s.clock+20;j.reason='관제구간 밖으로 출발';if(a)(s.scenarioMotions??=[]).push({id:j.id,uid:j.uid,number:j.number,points:[a,[a[0]+dir*40,a[1]]],from:s.clock,to:s.clock+20});return;}to=C.routes[id].destination;
   }else{
    const a=point(f.station,f.slot);if(!a){j.reason='출발 회로 확인 필요';return;}
    const ahead=def.signals.some(sig=>/^[12][AB]$/.test(sig[0])&&sig[4]===dir&&Math.abs(LS.railY(def,sig[1],sig[2])-a[1])<8&&(sig[2]-a[0])*dir>0);
    const rail=def.rails.find(r=>Math.abs(r[1][dir===1?r[1].length-1:0][1]-a[1])<8&&(dir===1?r[4]:r[3]));
    if(ahead&&rail){to=dir===1?rail[4]:rail[3];}
    else {const s=states()[f.station];j.phase='block';j.fromTime=s.clock;j.until=s.clock+20;j.reason='관제구간 밖으로 출발';(s.scenarioMotions??=[]).push({id:j.id,uid:j.uid,number:j.number,points:[a,[a[0]+dir*40,a[1]]],from:s.clock,to:s.clock+20});return;}
   }
  }
  const C=cachedCore(f.station),s=states()[f.station];
  const a=point(f.station,f.slot),b=point(target,to),def=W.data[f.station];
  // 구원운전(전령법): 관제 지시로 전령자가 승차한 구원열차는 신호 없이 사고 열차가 있는 폐색 구간에 들어가 연결한다
  if(j.action.rescue&&a&&b){j.phase='handover';j.fromTime=s.clock;j.until=s.clock+40;j.reason='구원운전 (전령법) · '+(target===f.station?'':N.catalog[target]?.name+'역 ')+to+' 사고 열차로';
   const dir=f.train.direction==='up'?-1:1,addR=(station,points,from,until)=>{(states()[station].scenarioMotions??=[]).push({id:j.id,uid:j.uid,number:j.number,points,from:from+states()[station].clock-s.clock,to:until+states()[station].clock-s.clock});};
   if(target===f.station)addR(f.station,[a,b],s.clock,s.clock+40);else{addR(f.station,[a,[a[0]+dir*60,a[1]]],s.clock,s.clock+20);addR(target,[[b[0]-dir*60,b[1]],b],s.clock+20,s.clock+40);}return;}
  const straight=target===f.station&&a&&b&&Math.abs(a[1]-b[1])<6&&!def.rails.some(r=>r[0]===f.slot||r[0]===to)&&!def.signals.some(sig=>Math.abs(LS.railY(def,sig[1],sig[2])-a[1])<6&&sig[2]>Math.min(a[0],b[0])&&sig[2]<Math.max(a[0],b[0]));
  // 이어 달리기: 앞 폐색 열번창에 다른 열차가 있으면 그 뒤에서 기다린다
  // 스스로 달리는 열차(구원운전·수동 이동 제외)는 다른 열차가 있는 폐색 열번창으로 들어가지 않는다 (가짜 열차번호 중복 방지)
  if(j.action.op==='move'&&!j.manual&&!j.action.rescue){const blocks=j.action.clear||(W.data[target]?.rails.some(r=>r[0]===to)?[]:[{station:target,slot:to}]);
   for(const b of blocks){const ahead=(ls().stations[b.station]?.windows[b.slot]||[]).find(t=>t.uid!==j.uid);if(ahead){j.reason='전방 폐색에 선행열차 '+ahead.number+' · 통과 대기';return;}}}
  // 출발 폐색 열번창이 없는 역에서 다음 역으로: 출발 진로(exitCode)를 지나야 넘어간다
  const viaExit=j.action.op==='move'&&j.action.exitCode&&def.rails.some(r=>r[0]===f.slot);
  const ids=viaExit?candidates(f.station,f.slot,j.action.exitCode,f.train.direction):target===f.station&&!straight?candidates(f.station,f.slot,to,f.train.direction):[];
  const active=ids.find(id=>s.routes[id]&&!s.routes[id].occupied&&!s.routes[id].lock);
  const partial=!active&&!straight&&!j.action.runOn&&target===f.station?Object.keys(C.routes).filter(id=>!ids.length||!!s.routes[id]).filter(id=>{
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
    const result=host.commit(operation,j);
    if(result.ok){release(j);j.route=null;j.phase=j.legTo?'waiting':'done';j.reason=j.legTo?'다음 진로 진행 대기':'도착';j.legTo=null;changed=true;if(j.phase==='waiting')begin(j,locate(j.uid));}else{j.reason=result.message;}
   }
  }
  return changed;
 }
 function step(){let changed=false;for(let i=0;i<Math.min(jobs.length+1,32);i++){const result=stepOnce();changed||=result;if(!result)break;}return changed;}
 function cancel(uid){for(const j of jobs)if(j.uid===uid&&!['done','cancelled'].includes(j.phase)){release(j);j.phase='cancelled';j.reason='수동 열차번호 조작';}}
 function reset(){for(const j of jobs)release(j);jobs=[];}
 return {request,step,reset,cancel,checkpoint:()=>({serial,jobs:structuredClone(jobs)}),restore:data=>{serial=data.serial;jobs=structuredClone(data.jobs);},list:()=>jobs.map(j=>({...j,action:{...j.action}})),busy:()=>jobs.some(j=>!j.background&&!['done','cancelled'].includes(j.phase))};
}
const inTransit=(state,uid)=>Object.values(state?.routes||{}).some(r=>r.occupied&&r.train?.scenario&&r.train.uid===uid)||(state?.scenarioMotions||[]).some(m=>m.uid===uid);
const api={create,candidates,point,inTransit,onward};if(node)module.exports=api;else root.SimScenarioMotion=api;
})(typeof window!=='undefined'?window:globalThis);
