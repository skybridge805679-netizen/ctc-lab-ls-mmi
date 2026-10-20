(function(root){
 'use strict';
 // A visible route path is evidence about geometry, not an interlocking table.
 const sources={wiring:'배선도(관제교육장).pptx · 슬라이드 5',mmi:'CTC 운영 매뉴얼 · 인쇄 p.6 · PDF 6쪽',down:'실무5 · 본문 p.362 · PDF 370쪽',up:'실무5 · 본문 p.374 · PDF 382쪽'};
 const routes={
  '1A-1T':{signal:'1A',pathTracks:['XT','21AT','1T'],path:'M575 512H1233',source:[sources.wiring,sources.down],evidence:'배선도·교재 경로 대조',switchConditions:null,releaseSeconds:null},
  '2A-2T':{signal:'2A',pathTracks:['YT','52T','2T'],path:'M1744 619H936',source:[sources.wiring,sources.up],evidence:'배선도·교재 경로 대조',switchConditions:null,releaseSeconds:null},
  '3A-B070T':{signal:'3A',pathTracks:['21BT','21AT','XT','B070T'],path:'M936 619H868L804 512H435',source:[sources.wiring,sources.mmi],evidence:'매뉴얼 MMI 진로목록 확인',switchConditions:null,releaseSeconds:null},
  '3A-B065T':{signal:'3A',pathTracks:['21BT','X1T','B065T'],path:'M936 619H435',source:[sources.wiring,sources.mmi,sources.up],evidence:'매뉴얼 MMI 진로목록 확인',switchConditions:null,releaseSeconds:null},
  '4A-B072T':{signal:'4A',pathTracks:['51BT','Y1T','B072T'],path:'M1233 512H1902',source:[sources.wiring,sources.down],evidence:'배선도·교재 경로 대조',switchConditions:null,releaseSeconds:null}
 };
 const points={'21':{parts:['21A','21B'],x:827,y:568},'22':{parts:['22A','22B'],x:878,y:568},'51':{parts:['51A','51B'],x:1452,y:551},'52':{parts:['52'],x:1357,y:606}};
 const signals={'1A':{x:575,y:494,kind:'장내',direction:'하행'},'2A':{x:1744,y:638,kind:'장내',direction:'상행'},'3A':{x:936,y:638,kind:'출발',direction:'상행'},'4A':{x:1233,y:494,kind:'출발',direction:'하행'},'21':{x:575,y:602,kind:'입환'},'22':{x:936,y:654,kind:'입환'},'23':{x:936,y:530,kind:'입환'},'51':{x:1610,y:583,kind:'입환'},'52':{x:1233,y:479,kind:'입환'},'53':{x:1233,y:602,kind:'입환'}};
 function initial(){return {mode:'AUTO',pending:null,clock:0,points:Object.fromEntries(Object.keys(points).map(id=>[id,'N'])),signals:Object.fromEntries(Object.keys(signals).map(id=>[id,'STOP'])),routes:{},logs:[],events:[],scans:{current:0,all:0},scanUntil:0,inspected:[]};}
 function dispatch(s,a){
  const log=(ok,message)=>{s.logs.unshift({time:s.clock,source:a.source||'안내',action:a.type,result:ok?'완료':'보류',message});if(ok)s.events.push({...a,time:s.clock});return{ok,message};};
  if(a.type==='tick'){s.clock+=a.seconds||1;return{ok:true};}
  if(a.type==='cancel')return log(true,'확인 취소 · 제어명령 전송 없음');
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
  if(['route','withdraw','stop','point'].includes(a.type)&& (s.mode!=='CCM'||s.pending))return log(false,'CCM 모드와 제어권을 확인하세요.');
  if(a.type==='route'){
   const r=routes[a.id];if(!r)return log(false,'등록되지 않은 진로입니다.');
   if(s.routes[a.id])return log(false,'이미 설정된 진로입니다.');
   const conflict=Object.keys(s.routes).find(id=>routes[id].signal===r.signal||routes[id].pathTracks.some(t=>r.pathTracks.includes(t))||(['1A','3A'].includes(r.signal)&&['1A','3A'].includes(routes[id].signal)));
   if(conflict)return log(false,conflict+' 진로를 먼저 정지·해정하세요.');
   s.routes[a.id]={status:'SET',control:a.control||'single'};s.signals[r.signal]='GO';
   return log(true,a.id+' 진로 설정 · '+r.signal+' 진행');
  }
  if(a.type==='withdraw'||a.type==='stop'){
   const ids=a.type==='withdraw'?[a.id]:Object.keys(s.routes).filter(id=>routes[id].signal===a.id);
   if(!ids.length||!s.routes[ids[0]])return log(false,'설정된 진로가 없습니다.');
   for(const id of ids){s.signals[routes[id].signal]='STOP';delete s.routes[id];}
   return log(true,ids.join(', ')+' 신호 정지 · 진로 해정 완료 (접근 열차 없는 기본 연습)');
  }
  if(a.type==='point'){
   if(!points[a.id]||!['N','R'].includes(a.value))return log(false,'전환기와 정·반위를 선택하세요.');
   const side=['21','22'].includes(a.id)?['1A','3A']:['2A','4A'];
   if(Object.keys(s.routes).some(id=>side.includes(routes[id].signal)))return log(false,'같은 쪽에 설정된 진로를 먼저 해정하세요.');
   s.points[a.id]=a.value;return log(true,a.id+' 전환기 '+(a.value==='N'?'정위':'반위')+' 조작 연습 완료');
  }
  if(a.type==='inspectPoint'){
   if(!points[a.id])return log(false,'원본에 없는 전환기 번호입니다.');
   if(!s.inspected.includes(a.id))s.inspected.push(a.id);
   return log(true,a.id+' 전환기 확인 · 구성 '+points[a.id].parts.join(' / ')+' · 정·반위는 미확인');
  }
  if(a.type==='inspectSignal'&&signals[a.id])return log(true,a.id+' '+signals[a.id].kind+' 위치 확인 · 진로목록 검증 보류');
  return log(false,'근거가 확인되지 않은 조작입니다.');
 }
 const api={initial,dispatch,routes,points,signals,sources};if(typeof module!=='undefined')module.exports=api;else root.SimCore=api;
})(typeof window!=='undefined'?window:globalThis);
