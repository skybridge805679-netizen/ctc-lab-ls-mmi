(function(root){
 'use strict';
 function create(config=null){
 // A visible route path is evidence about geometry, not an interlocking table.
 const {sources,routes,points,signals}=config;
 const IL=typeof module!=='undefined'?require('./interlocking.js'):root.SimInterlocking;
 const overlapOf=id=>IL.rulesFor(config.id,id);
 const lockSeconds=signal=>IL.approach.seconds[signals[signal]?.kind]||0;
 const remaining=(s,r)=>Math.max(0,Math.ceil(r.lock.until-s.clock));
 function overlapBlocker(s,id,skip){
  const requested=overlapOf(id),candidate=routes[id];
  for(const other of Object.keys(s.routes)){
   if(other===skip)continue;
   const active=routes[other],existing=overlapOf(other);
   for(const [pid,pos]of Object.entries(requested?.points||{})){
    if((active.pointLocks||[]).includes(pid)&&active.pointPositions[pid]!==pos)return other;
    if(existing?.points[pid]&&existing.points[pid]!==pos)return other;
   }
   for(const [pid,pos]of Object.entries(existing?.points||{})){
    if((candidate.pointLocks||[]).includes(pid)&&candidate.pointPositions[pid]!==pos)return other;
   }
   if(existing?.clearSignals?.includes(candidate.signal))return other;
  }
  return null;
 }
 function initial(){return {mode:'AUTO',pending:null,clock:0,points:Object.fromEntries(Object.keys(points).map(id=>[id,'N'])),signals:Object.fromEntries(Object.keys(signals).map(id=>[id,'STOP'])),routes:{},approach:{},occupied:{},blockedPoints:[],logs:[],events:[],scans:{current:0,all:0},scanUntil:0,inspected:[]};}
 function dispatch(s,a){
  const log=(ok,message)=>{s.logs.unshift({time:s.clock,source:a.source||'안내',action:a.type,result:ok?'완료':'보류',message});if(ok)s.events.push({...a,time:s.clock});return{ok,message};};
  if(config?.controlled===false&&['mode','route','withdraw','stop','point'].includes(a.type))return log(false,'비연동역입니다. 연결 연동역에서 진로를 제어하세요.');
  if(a.type==='tick'){s.clock+=a.seconds||1;for(const [id,r] of Object.entries(s.routes))if(r.lock&&s.clock>=r.lock.until){delete s.routes[id];s.signals[routes[id].signal]='STOP';s.logs.unshift({time:s.clock,source:'연동장치',action:'approachRelease',result:'완료',message:id+' 접근쇄정 '+r.lock.seconds+'초 경과 · 진로 해정'});s.events.push({type:'approachRelease',id,time:s.clock});}return{ok:true};}
  if(a.type==='approach'){
   const sig=signals[a.signal];if(!sig||!lockSeconds(a.signal))return log(false,'접근쇄정은 장내·출발신호기에만 적용됩니다.');
   const present=a.present!==false,active=Object.keys(s.routes).find(id=>routes[id].signal===a.signal);
   if(present&&s.approach[a.signal])return log(false,a.signal+' 외방에 이미 접근 열차가 있습니다.');
   if(!present&&!s.approach[a.signal])return log(false,a.signal+' 외방에 접근 열차가 없습니다.');
   if(!present&&active&&s.routes[active].lock)return log(false,'접근쇄정 중에는 접근 열차를 제거할 수 없습니다. 남은 '+remaining(s,s.routes[active])+'초');
   if(present)s.approach[a.signal]=true;else delete s.approach[a.signal];
   return log(true,present?a.signal+' 외방 접근구간에 열차 진입 · 이후 신호를 정지하면 접근쇄정 '+lockSeconds(a.signal)+'초':a.signal+' 접근 열차 제거');
  }
  if(a.type==='cancel'){a={...a,activeRoutes:Object.keys(s.routes)};return log(true,'확인 취소 · 제어명령 전송 없음');}
  if(a.type==='mode'){
   if(!['AUTO','CCM','LOCAL'].includes(a.value))return log(false,'제어모드를 확인하세요.');
   if(s.pending)return log(false,'현장 인계 응답을 먼저 처리하세요.');
   if(s.mode===a.value)return log(false,'이미 '+a.value+' 모드입니다.');
   if(a.value==='AUTO'&&s.mode!=='CCM')return log(false,'AUTO는 CCM에서만 전환할 수 있습니다.');
   if(a.value==='LOCAL'||s.mode==='LOCAL'){s.pending=a.value;return log(true,a.value+' 전환 요청 · 현장 응답 대기');}
   s.mode=a.value;return log(true,a.value+' 모드 전환 완료');
  }
  if(a.type==='handover'){
   if(!s.pending)return log(false,'진행 중인 인계 요청이 없습니다.');
   const target=s.pending;s.pending=null;if(a.accept)s.mode=target;
   return log(true,a.accept?'현장 수락 · '+s.mode+' 전환 완료':'현장 거절 · '+s.mode+' 유지');
  }
  if(a.type==='scan'){
   if(!['current','all'].includes(a.scope))return log(false,'범위를 선택하세요.');
   s.scans[a.scope]++;s.scanUntil=s.clock+3;return log(true,(a.scope==='all'?'전체 제어역':'현재역')+' 베이스스캔 · 가상 상태 재수신');
  }
  if(['route','withdraw','stop','stopAll','point','pointLock'].includes(a.type)&& (s.mode!=='CCM'||s.pending))return log(false,'CCM 모드와 제어권을 확인하세요.');
  if(a.type==='route'){
   const r=routes[a.id];if(!r)return log(false,'등록되지 않은 진로입니다.');
   if(s.routes[a.id])return log(false,s.routes[a.id].lock?a.id+' 접근쇄정 중 · 남은 '+remaining(s,s.routes[a.id])+'초 후 해정됩니다.':'이미 설정된 진로입니다.');
   if((r.resources||[]).some(t=>s.occupied[t]))return log(false,'진로 안에 점유된 구간이 있습니다.');
   if((r.pointLocks||[]).some(id=>s.blockedPoints.includes(id)))return log(false,'진로 내 전환기가 쇄정되어 있습니다.');
   const conflict=Object.keys(s.routes).find(id=>routes[id].signal===r.signal||(routes[id].resources||[]).some(t=>(r.resources||[]).includes(t))||(routes[id].pointLocks||[]).some(t=>(r.pointLocks||[]).includes(t)));
   if(conflict)return log(false,s.routes[conflict].lock?conflict+' 접근쇄정 중 · 남은 '+remaining(s,s.routes[conflict])+'초 후에 설정하세요.':conflict+' 진로와 경합합니다. 먼저 정지·해정하세요.');
   const ov=overlapOf(a.id);
   if(ov?.clearSignals){const open=Object.keys(s.routes).find(id=>ov.clearSignals.includes(routes[id].signal));if(open)return log(false,'오버랩 구간의 '+routes[open].signal+' 신호를 먼저 해정하세요. ('+ov.note+')');}
   const ob=overlapBlocker(s,a.id);if(ob)return log(false,'오버랩 쇄정 전환기가 '+ob+' 진로와 충돌합니다.');
   for(const [pid,pos] of Object.entries(ov?.points||{}))if(s.blockedPoints.includes(pid)&&s.points[pid]!==pos)return log(false,'오버랩 전환기 '+pid+'이 수동 쇄정되어 있습니다.');
   for(const [id,position]of Object.entries({...(r.pointPositions||{}),...(ov?.points||{})}))s.points[id]=position;
   s.routes[a.id]={status:'SET',control:a.control||'single',occupied:false};s.signals[r.signal]='GO';
   return log(true,a.id+' 진로 설정 · '+r.signal+' 진행');
  }
  if(a.type==='withdraw'||a.type==='stop'||a.type==='stopAll'){
   const ids=a.type==='withdraw'?[a.id]:Object.keys(s.routes).filter(id=>a.type==='stopAll'||routes[id].signal===a.id);
   if(!ids.length||!s.routes[ids[0]])return log(false,'설정된 진로가 없습니다.');
   if(ids.every(id=>s.routes[id]?.lock))return log(false,ids.join(', ')+' 이미 접근쇄정 중 · 남은 '+Math.max(...ids.map(id=>remaining(s,s.routes[id])))+'초');
   let waiting=Math.max(0,...ids.filter(id=>s.routes[id]?.lock).map(id=>remaining(s,s.routes[id])));
   for(const id of ids){if(s.routes[id].lock)continue;const sig=routes[id].signal,seconds=lockSeconds(sig);s.signals[sig]='STOP';s.routes[id].control='single';
    if(s.routes[id].occupied)s.routes[id].status='LOCKED';
    else if(s.approach[sig]&&seconds){s.routes[id].status='APPROACH_LOCK';s.routes[id].lock={start:s.clock,seconds,until:s.clock+seconds};waiting=Math.max(waiting,seconds);}
    else delete s.routes[id];}
   if(waiting)return log(true,'신호 정지 · 접근 열차가 있어 접근쇄정 '+waiting+'초 후 진로 해정');
   if(ids.some(id=>s.routes[id]?.occupied))return log(true,'신호 정지 · 점유 구간의 진로 쇄정 유지');
   return log(true,ids.join(', ')+' 신호 정지 · 진로 해정 완료 (접근 열차 없는 기본 연습)');
  }
  if(a.type==='point'){
   if(!points[a.id]||!['N','R'].includes(a.value))return log(false,'전환기와 정·반위를 선택하세요.');
   if(s.blockedPoints.includes(a.id))return log(false,'수동 쇄정된 전환기입니다.');
   const using=Object.keys(s.routes).find(id=>(routes[id].pointLocks||[]).includes(a.id));
   if(using)return log(false,s.routes[using].lock?'접근쇄정 중 · 남은 '+remaining(s,s.routes[using])+'초 후 조작하세요.':'이 전환기를 사용하는 진로를 먼저 해정하세요.');
   const ovUse=Object.keys(s.routes).find(id=>overlapOf(id)?.points[a.id]);
   if(ovUse)return log(false,ovUse+' 진로의 오버랩 쇄정 전환기입니다. 진로를 해정한 뒤 조작하세요.');
   s.points[a.id]=a.value;return log(true,a.id+' 전환기 '+(a.value==='N'?'정위':'반위')+' 조작 연습 완료');
  }
  if(a.type==='pointLock'){
   if(!points[a.id])return log(false,'전환기를 확인하세요.');
   if(a.lock&&!s.blockedPoints.includes(a.id))s.blockedPoints.push(a.id);
   if(!a.lock)s.blockedPoints=s.blockedPoints.filter(id=>id!==a.id);
   return log(true,a.id+' 전환기 '+(a.lock?'수동 쇄정':'수동 쇄정 해제'));
  }
  if(a.type==='occupy'){
   const r=routes[a.id],active=s.routes[a.id];if(!r||!active)return log(false,'설정된 진로를 선택하세요.');
   if(active.occupied)return log(false,'이미 점유된 진로입니다.');
   if(active.lock)return log(false,'접근쇄정 중에는 정지신호입니다. 남은 '+remaining(s,active)+'초');
   delete s.approach[r.signal];active.occupied=true;active.status='OCCUPIED';s.signals[r.signal]='STOP';
   for(const t of r.resources)s.occupied[t]=a.id;
   return log(true,a.id+' 모의 열차 진입 · 신호 정지 · 진로 쇄정');
  }
  if(a.type==='clear'){
   const r=routes[a.id],active=s.routes[a.id];if(!r||!active?.occupied)return log(false,'점유된 진로를 선택하세요.');
   for(const t of r.resources)delete s.occupied[t];
   if(active.control==='continuous'&&s.mode==='CCM'&&!s.pending&&!r.pointLocks.some(id=>s.blockedPoints.includes(id))){active.occupied=false;active.status='SET';s.signals[r.signal]='GO';}
   else delete s.routes[a.id];
   return log(true,a.id+' 모의 열차 통과 · '+(s.routes[a.id]?'연속진로 재설정':'진로 해정'));
  }
  if(a.type==='inspectPoint'){
   if(!points[a.id])return log(false,'원본에 없는 전환기 번호입니다.');
   if(!s.inspected.includes(a.id))s.inspected.push(a.id);
   return log(true,a.id+' 전환기 확인 · 구성 '+points[a.id].parts.join(' / ')+' · 정·반위는 미확인');
  }
  if(a.type==='inspectSignal'&&signals[a.id])return log(true,a.id+' '+signals[a.id].kind+' 위치 확인 · 진로목록 검증 보류');
  return log(false,'근거가 확인되지 않은 조작입니다.');
 }
 function lockTable(s){return Object.entries(s.routes).map(([id,r])=>{const ov=overlapOf(id);return {id,signal:routes[id].signal,status:r.status,remaining:r.lock?remaining(s,r):0,total:r.lock?.seconds||0,overlap:ov?{points:ov.points,note:ov.note,clearSignals:ov.clearSignals||[]}:null};});}
 return {initial,dispatch,routes,points,signals,sources,lockTable,lockSeconds,overlapOf};
 }
 const network=typeof module!=='undefined'?require('./network.js'):root.SimNetwork;
 const api=create(network.catalog['underground-seoul']);
 api.forStation=id=>{if(!network.catalog[id])throw new RangeError('Unknown station');return create(network.catalog[id]);};
 if(typeof module!=='undefined')module.exports=api;else root.SimCore=api;
})(typeof window!=='undefined'?window:globalThis);
