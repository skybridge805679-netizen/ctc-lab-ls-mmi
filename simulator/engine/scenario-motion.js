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
 const found=Object.entries(C.routes).flatMap(([id,r])=>{
  const sig=def.signals.find(s=>s[0]===r.signal);if(!sig||sig[4]!==dir)return [];
  const ry=LS.railY(def,sig[1],sig[2]);
  if(platform?sig[1]!==from:Math.abs(a[1]-ry)>8||(sig[2]-a[0])*dir<-10)return [];
  if(!platform&&def.signals.some(other=>other[0]!==sig[0]&&/^\d+[AB]$/.test(other[0])&&other[4]===dir&&Math.abs(LS.railY(def,other[1],other[2])-a[1])<8&&(other[2]-a[0])*dir>=0&&(other[2]-sig[2])*dir<-.1))return [];
  const end=point(station,r.destination);if(!end)return [];
  if(targetPlatform?r.destination!==to:!/^B/.test(r.destination)||Math.abs(end[1]-b[1])>8)return [];
  return [{id,score:(r.destination===to?0:100000)+Math.abs(sig[2]-a[0])+Math.abs(end[0]-b[0])}];
 }).sort((a,b)=>a.score-b.score).map(x=>x.id);
 if(found.length||platform||!targetPlatform)return found;
 // 진입 열번창이 화면상 다른 줄에 그려진 역(노량진 상2선 B931T — 대방 쪽): 그 칸이 이 역의 진입 칸이면 그 본선 장내신호기의 진로로 찾는다
 const trunk=L.trunkOf(from),entry=trunk&&L.entrySlot(station,trunk,direction,(TW.data[station]||[]).map(w=>w.slot));
 const sig=entry===from&&L.arrivalSignal(station,trunk,direction);
 return sig?Object.keys(C.routes).filter(id=>C.routes[id].signal===sig&&C.routes[id].destination===to):[];
}
// 출발 지시를 받은 열차는 역을 벗어나 사라지지 않고 같은 본선을 따라 다음 역들로 이어 달린다 (베타 피드백).
// 경로: 출발 폐색 → 중간역 열번창 → 다음 연동역 진입 열번창 → 그 역 본선 승강장 → … 관제구간 끝.
// 본선이 여러 선로로 갈리는 역(구로 상2선 4T·5T, 용산 등)은 장내신호기 앞 열번창까지 달려 거기서 장내 진로를 기다린다 (follow).
// 진로가 서면 그 선로로 들어가 다시 이어 달린다. (전에는 그 역 앞 구간을 아예 만들지 않아 출발 직후 사라졌다)
// 장내·출발은 진로로만 지나고(진로가 없으면 그 앞에서 기다린다), 폐색 사이는 인계 이동이다.
// 시뮬레이션 시간은 압축돼 있다: 폐색 한 칸 20초(실제 역간 2~3분), 구원연결 40초, 비상 대본 하나 9~12분.
// 대본의 「각 역 n분 추가정차」도 같은 비율로 줄인다: 대본 1분 = 시뮬레이션 10초 (5분 → 50초, 3분 → 30초).
const DWELL_SCALE=1/6;
function onward(station,slot,direction){
 const legs=[],down=direction==='down',has=(id,x)=>(TW?.data?.[id]||[]).some(w=>w.slot===x),stations=L?.line?.stations||{};
 const push=l=>{const last=legs.at(-1)||{station,slot};if(last.station===l.station&&last.slot===l.slot)return;legs.push(l);};
 let cur=station,S=stations[cur],trunk=L.trunkOf(slot);
 if(!trunk)trunk=Object.keys(S?.trunks||{}).find(t=>t.endsWith(down?'D':'U')&&S.trunks[t].rails.includes(slot));
 if(!trunk||trunk.endsWith('D')!==down)return legs;
 let T=S?.trunks[trunk],rail=T?.rails.includes(slot)?slot:null;
 if(!rail){               // 폐색 열번창: 이 역으로 들어오는 쪽이면 승강장으로, 나가는 쪽이면 다음 역으로
  if(!T)return legs;const n=L.numberOf(slot),approach=down?n<=L.numberOf(T.left):n>=L.numberOf(T.right);
  if(approach){if(T.rails.length!==1){
    // 갈림 역: 장내 바로 앞 열번창까지는 폐색을 따라가고(앞 칸의 선행열차를 건너뛰지 않는다) 거기서 진로를 기다린다
    const entry=L.entrySlot(cur,trunk,direction,(TW.data[cur]||[]).map(w=>w.slot))||slot;
    if(entry!==slot)push({station:cur,slot:entry,stop:true});
    legs.push({station:cur,slot:entry,follow:[...T.rails]});return legs;}
   rail=T.rails[0];push({station:cur,slot:rail});}
 }
 let startN=!rail&&L.numberOf(slot)!==null?L.numberOf(slot):null;      // 폐색 열번창에서 출발: 그 칸의 번호
 for(let hop=0;hop<16;hop++){
  let nx=L.next(cur,trunk,direction);
  if(!nx&&rail){const sib=Object.keys(S.trunks).find(x=>x!==trunk&&x.endsWith(trunk.at(-1))&&S.trunks[x].rails.includes(rail)&&L.next(cur,x,direction));if(sib){trunk=sib;T=S.trunks[trunk];nx=L.next(cur,trunk,direction);}}   // 1호선 직결: 지하 본선(M) ↔ 전동차선(E)
  if(!nx)break;
  const S2=stations[nx.station],T2=S2?.trunks[trunk];if(!T2||!T2.rails.length)break;const fork=T2.rails.length>1;
  // 다음 역 장내 앞(진입 쪽)에 열번창이 없으면 장내 신호를 지킬 수 없다: 거기서 이어 달리기를 끝낸다 (예: 노량진 하1선 — 가장 가까운 칸이 역을 지난 대방)
  const entry=L.entrySlot(nx.station,trunk,direction,(TW.data[nx.station]||[]).map(w=>w.slot)),en=entry&&L.numberOf(entry);
  if(!entry||(down?en>L.numberOf(T2.left):en<L.numberOf(T2.right)))break;
  const exitCode=down?T.right:T.left,fromRail=!!rail&&(legs.at(-1)||{slot}).slot===rail,mark=legs.length;
  if(fromRail&&has(cur,exitCode))push({station:cur,slot:exitCode});
  const leaving=fromRail&&!has(cur,exitCode)?exitCode:null;let first=true;      // 출발 폐색 열번창이 없는 역은 출발 진로를 지난 뒤 바로 다음 열번창으로
  const hop1=l=>{push({...l,handover:true,...(first&&leaving?{exitCode:leaving}:{})});first=false;};
  // 역 사이 폐색에서 출발하면 이미 지나온 중간역 칸은 건너뛴다 (군포 B1008T의 하행 K0805가 뒤쪽 당정 B1006T로 되돌아가던 문제)
  const behind=x=>startN!==null&&L.numberOf(x)!==null&&(down?L.numberOf(x)<=startN:L.numberOf(x)>=startN);
  for(const v of L.viaStations(cur,nx.station,trunk))if(has(v.host,v.slot)&&!behind(v.slot))hop1({station:v.host,slot:v.slot,stop:true});
  startN=null;      // 중간역 (독산·가산디지털 등): 정차하는 역
  hop1({station:nx.station,slot:entry});
  // 폐색 하나씩 따라간다: 바로 앞 열번창이 비면 들어가고, 선행열차가 있으면 그 뒤 폐색에서 기다린다 (자동폐색).
  // (전에는 다음 역 장내 앞까지 전부 비어야 승강장을 떠났다. 그러면 후속열차가 사고 열차 뒤로 다가오는 모습이 나오지 않는다)
  if(fork){legs.push({station:nx.station,slot:entry,follow:[...T2.rails]});break;}
  cur=nx.station;S=S2;T=T2;rail=T2.rails[0];push({station:cur,slot:rail,stop:true});
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
  if(action.op==='stop')return stop(action.uid,action.targetStation);
  let check=action.op==='follow'?{ok:true}:host.validate({...action,station:f.station,slot:f.slot});
  if(!check.ok&&action.op==='move'&&jobs.some(j=>j.uid===action.uid&&!['done','cancelled'].includes(j.phase)))check=host.validate({op:'insert',station:action.targetStation,slot:action.targetSlot,number:f.train.number,direction:f.train.direction});
  if(!check.ok)return check;
  if(action.op==='delete'&&!manual&&!action.runOn){
    // 「각 역 n분 추가정차」: 그 열차는 역마다 n분 더 선다(dwell 초). 이미 이어 달리는 중이면 새로 경로를 만들지 않고 정차 시간만 바꾼다 —
    // 나중의 「정상운행 하세요」(dwell 없음)가 추가정차를 푼다.
    if(action.dwell!==undefined||!action.keepHold)dwellOf.set(action.uid,Math.round((action.dwell||0)*DWELL_SCALE));      // dwell: 대본의 추가정차(초) → 시뮬레이션 시간
    const chain=jobs.filter(j=>j.uid===action.uid&&j.action.runOn&&!['done','cancelled'].includes(j.phase));
    if(chain.length&&!action.keepHold){const d=dwellOf.get(action.uid)||0;for(const j of chain)if(j.action.stopHold){j.action.hold=d;if(!d)j.notBefore=null;else if(j.notBefore!=null)j.notBefore=Math.min(j.notBefore,now(j)+d);}step();return {ok:true,pending:true,message:f.train.number+(d?` 각 역 추가정차 (시뮬레이션 ${d}초)`:' 정상운행')};}
  }
  const existing=jobs.find(j=>j.uid===action.uid&&!['done','cancelled'].includes(j.phase)&&j.action.op===action.op&&j.action.targetStation===action.targetStation&&j.action.targetSlot===action.targetSlot);
  if(existing){if(manual){existing.manual=true;step();}return {ok:true,pending:true,message:manual?'수동 이동 확인 · 진행 대기':'이미 이동 대기 중입니다.'};}
  const previous=[...jobs].reverse().find(j=>j.uid===action.uid&&!['done','cancelled'].includes(j.phase));
  if(action.op==='delete'&&!manual&&!action.runOn){      // 자동 출발: 본선을 따라 이어 달린 뒤 관제구간 밖으로
   const from=previous?.action.op==='move'?{station:previous.action.targetStation||previous.station,slot:previous.action.targetSlot}:{station:f.station,slot:f.slot};
   const legs=onward(from.station,from.slot,f.train.direction);let result=null;
   if(!action.keepHold)holds.delete(action.uid);
   const dwell=dwellOf.get(action.uid)||0;
   let afterStop=!action.keepHold||!!W.data[from.station]?.rails.some(r=>r[0]===from.slot);      // 처음 출발은 지금 선 역에서부터, 갈림 역 진로를 받아 들어간 뒤에는 그 승강장에서부터 추가정차
   for(const [i,l] of legs.entries()){const hold=afterStop?{stopHold:true,hold:dwell}:{};afterStop=!!l.stop;if(l.follow){const r=request({op:'follow',uid:action.uid,station:f.station,slot:f.slot,targetStation:l.station,targetSlot:l.slot,rails:l.follow,runOn:true,background:i>0,...hold},false);return result||r;}const r=request({op:'move',uid:action.uid,station:f.station,slot:f.slot,targetStation:l.station,targetSlot:l.slot,handover:!!l.handover,...(l.exitCode?{exitCode:l.exitCode}:{}),...(l.clear?{clear:l.clear}:{}),...(i===0&&action.handSignal?{handSignal:true}:{}),runOn:true,background:i>0,...hold},false);result??=r;if(!r.ok)break;}
   const last=request({...action,runOn:true,background:legs.length>0,...(afterStop?{stopHold:true,hold:dwell}:{})},false);return result||last;
  }
  const j={id:'SCM'+(++serial),uid:action.uid,number:f.train.number,background:!!action.background,station:f.station,fromStation:previous?.action.targetStation||f.station,from:previous?.action.targetSlot||f.slot,to:action.targetSlot||'관제구간 밖',action:{...action},manual,phase:'waiting',reason:'앞 열차 통과 대기'};jobs.push(j);step();return {ok:true,pending:j.phase!=='done',message:f.train.number+' 이동 접수 · '+(j.reason||'진행 중')};
 }
 function begin(j,f){
  L?.refresh(states(),ls());
  j.station=f.station;j.fromStation=f.station;j.from=f.slot;j.number=f.train.number;
  // 장내 앞 대기: 갈림 역의 장내 진로가 서면(관제사가 세우거나 AUTO 역이 세우면) 그 선로로 들어가고, 도착한 뒤 다시 이어 달린다
  if(j.action.op==='follow'||j.follow){
   j.follow??={rails:j.action.rails||[],background:j.action.background};
   const s=states()[f.station],C=cachedCore(f.station),rails=j.follow.rails;
   const all=rails.flatMap(r=>candidates(f.station,f.slot,r,f.train.direction).filter(id=>C.routes[id].destination===r));
   // AUTO 역은 그 열차의 스케줄에 정해진 도착진로만 내준다. 스케줄에 없는 열차(번호를 바꾼 회송·구원열차 등)는 관제사가 진로를 세울 때까지 기다린다.
   const planned=s.mode==='AUTO'?host.scheduled?.(f.train.number,f.station,'arrival',f.train.was):null,auto=planned===undefined?all[0]:planned&&all.includes(planned)?planned:null;
   const set=all.find(id=>s.routes[id]&&!s.routes[id].occupied&&!s.routes[id].lock),pick=set||auto;
   if(!pick){j.action={op:'follow',uid:j.uid,rails,background:j.follow.background};j.reason=!all.length?'일치하는 장내 진로가 없습니다':s.mode==='AUTO'?'스케줄에 도착진로 없음 · 장내 진로 설정 대기':'장내 진로 설정 대기 · '+rails.join('/');return;}
   j.action={op:'move',uid:j.uid,targetStation:f.station,targetSlot:C.routes[pick].destination,runOn:true,background:j.follow.background,resume:true};j.to=j.action.targetSlot;
  }
  if(j.action.op==='move'&&j.action.targetStation===f.station&&j.action.targetSlot===f.slot){j.phase='done';return;}
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
  // 수신호 출발: 관제 승인으로 역이 출발 수신호를 현시한 열차는 출발신호기 진로 없이 떠난다 (상황별 대응 요령 · 동묘앞 23B 선로전환기 불량)
  if(j.action.handSignal&&a&&b&&target===f.station){j.phase='handover';j.fromTime=s.clock;j.until=s.clock+30;j.reason='수신호 출발 · '+to;(s.scenarioMotions??=[]).push({id:j.id,uid:j.uid,number:j.number,points:[a,b],from:s.clock,to:s.clock+30});return;}
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
   // 자동진로(AUTO)는 스케줄에 열차별·역별 운행정보가 있는 열차에, 그 스케줄의 진로만 낸다 (실기3 열차운행계획 「자동진로제어 시스템 기본 전제 조건」).
   // 스케줄이 없는 열차(번호를 바꾼 회송·구원열차 G…, 임시 번호)나 스케줄과 다른 진로는 관제사가 CCM에서 진로를 세울 때까지 기다린다. 입환진로는 자동진로 대상이 아니다.
   // host.scheduled: 진로 id = 스케줄 진로, null = 스케줄(그 역 진로) 없음, undefined = 이 호스트는 스케줄을 모른다(배선으로 고른다 · 단위 시험용)
   if(!s.routes[id]&&s.mode==='AUTO'&&host.scheduled){
    const kind=C.signals[C.routes[id].signal].kind==='장내'?'arrival':'departure',planned=host.scheduled(j.number,f.station,kind,f.train.was);
    if(planned!==undefined){
     if(!planned){j.reason=`스케줄에 ${kind==='arrival'?'도착':'출발'}진로 없음 · 진로 설정 대기`;return;}
     if(planned!==id){if(ids.includes(planned))id=planned;else{j.reason=`스케줄 진로 ${planned} · 진로 설정 대기`;return;}}
    }
   }
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
  let changed=false;const resume=[];
  for(const j of jobs){
   if(['done','cancelled'].includes(j.phase))continue;
   const f=locate(j.uid);
   if(!f){release(j);j.phase='cancelled';changed=true;continue;}
   if(j.phase==='waiting'){
    if(jobs.some(p=>p!==j&&p.uid===j.uid&&p.id!==j.id&&jobs.indexOf(p)<jobs.indexOf(j)&&!['done','cancelled'].includes(p.phase)))continue;
    // 정차 지시: 지정한 역(없으면 처음 닿는 역)의 승강장에 닿으면 남은 이어 달리기를 버리고 선다
    if(j.action.hold>0){j.notBefore??=now(j)+j.action.hold;if(now(j)<j.notBefore){const r='추가정차 · '+Math.ceil(j.notBefore-now(j))+'초 남음';changed||=j.reason!==r;j.reason=r;continue;}}
    const h=holds.get(j.uid);if(h&&!j.manual&&W.data[f.station]?.rails.some(r=>r[0]===f.slot)&&(!h.station||h.station===f.station)){for(const p of jobs)if(p.uid===j.uid&&!['done','cancelled'].includes(p.phase)){release(p);p.phase='cancelled';p.reason='정차 지시 · '+(N.catalog[f.station]?.name||f.station);}holds.set(j.uid,{...h,held:f.station});changed=true;continue;}
    const phase=j.phase,reason=j.reason;begin(j,f);changed||=phase!==j.phase||reason!==j.reason;
   }else if(f.station!==j.station||f.slot!==j.from||(j.route&&states()[j.station]?.routes[j.route]?.train?.scenario!==j.id)){
    release(j);j.phase='cancelled';j.reason='열차 위치·모의점유 변경으로 취소';changed=true;
   }else if(now(j)>=j.until){
    const operation=j.legTo?{op:'move',station:f.station,slot:f.slot,uid:j.uid,targetStation:f.station,targetSlot:j.legTo}:{...j.action,station:f.station,slot:f.slot,uid:j.uid};
    const result=host.commit(operation,j);
    if(result.ok){release(j);j.route=null;j.phase=j.legTo?'waiting':'done';j.reason=j.legTo?'다음 진로 진행 대기':'도착';j.legTo=null;changed=true;if(j.phase==='waiting')begin(j,locate(j.uid));else if(j.action.resume)resume.push(j.uid);}else{j.reason=result.message;}
   }
  }
  for(const uid of resume){const f=locate(uid);if(!f||jobs.some(p=>p.uid===uid&&!['done','cancelled'].includes(p.phase)))continue;const h=holds.get(uid);if(h&&(!h.station||h.station===f.station)){holds.set(uid,{...h,held:f.station});continue;}request({op:'delete',uid,station:f.station,slot:f.slot,keepHold:true},false);}
  return changed;
 }
 // 끝난 작업은 오래된 것부터 버린다 (긴 실습에서 목록과 세션 저장 크기가 끝없이 커지지 않게) — 진행 중인 작업은 건드리지 않는다
 function prune(){const over=jobs.length-120;if(over<=0)return;let n=0;jobs=jobs.filter(j=>!(n<over&&['done','cancelled'].includes(j.phase)&&++n));}
 function step(){let changed=false;for(let i=0;i<Math.min(jobs.length+1,32);i++){const result=stepOnce();changed||=result;if(!result)break;}prune();return changed;}
 // 「○○역 정차」: 달리는 열차를 그 역 승강장에 세운다. 이미 승강장에 서 있으면 떠나지 않게 남은 이동을 지운다. 다시 보내려면 출발(delete) 요청.
 const holds=new Map(),dwellOf=new Map();
 function stop(uid,station){const f=locate(uid);if(!f)return {ok:false,message:'정차시킬 열차번호가 없습니다.'};if(station&&!W.data[station])return {ok:false,message:'정차역을 확인하세요.'};holds.set(uid,{station:station||null});step();return {ok:true,message:f.train.number+' '+(station?(N.catalog[station]?.name||station)+'역 ':'다음 역 ')+'정차 지시'};}
 function cancel(uid){for(const j of jobs)if(j.uid===uid&&!['done','cancelled'].includes(j.phase)){release(j);j.phase='cancelled';j.reason='수동 열차번호 조작';}}
 function reset(){for(const j of jobs)release(j);jobs=[];holds.clear();dwellOf.clear();}
 return {request,step,reset,cancel,stop,holds:()=>[...holds].map(([uid,h])=>({uid,...h})),checkpoint:()=>({serial,jobs:structuredClone(jobs),holds:[...holds],dwell:[...dwellOf]}),restore:data=>{serial=data.serial;jobs=structuredClone(data.jobs);holds.clear();for(const [k,v] of data.holds||[])holds.set(k,v);dwellOf.clear();for(const [k,v] of data.dwell||[])dwellOf.set(k,v);},list:()=>jobs.map(j=>({...j,action:{...j.action}})),busy:()=>jobs.some(j=>!j.background&&!['done','cancelled'].includes(j.phase))};
}
const inTransit=(state,uid)=>Object.values(state?.routes||{}).some(r=>r.occupied&&r.train?.scenario&&r.train.uid===uid)||(state?.scenarioMotions||[]).some(m=>m.uid===uid);
const api={create,candidates,point,inTransit,onward,DWELL_SCALE};if(node)module.exports=api;else root.SimScenarioMotion=api;
})(typeof window!=='undefined'?window:globalThis);
