(function(root){
 'use strict';
 // [MA007_01] 열차운행패턴 / [PTN_LOAD] 열차패턴선택 data. A pattern is a list of stations with times relative to the
 // origin (진입 시간 · 정차 시간 · 진출 시간) and the entry/exit routes, exactly the columns of the real screens.
 // Two patterns were photographed with every row (2026-10-30): '추석' (상행 수원→서울) on MA007_01 and
 // '여객_하_(서울-수원)_NEW' (하행, ID 0120202) on PTN_LOAD / TRN_ADD. The two 전동 patterns carry names seen in the real
 // list but their rows were not photographed, so they are filled from this simulator's 전역정차 run times (source:'simulator').
 const N=typeof module!=='undefined'?require('./network.js'):root.SimNetwork;
 const R=typeof module!=='undefined'?require('./schedule-routes.js'):root.SimScheduleRoutes;
 const T=()=>typeof module!=='undefined'?require('./timetable.js'):root.SimTimetable;
 const LINE='경부선',MIG={registrar:'MIG_USR',registeredAt:'2021-12-30 16:04:30',modifier:'MIG_USR',modifiedAt:'2021-12-30 16:04:30'};
 const sec=v=>{const [m,s]=v.split(':').map(Number);return m*60+s;};
 // [station, 진입, 정차, 진입진로, 진출진로] — 진출 = 진입 + 정차
 const rows=list=>list.map(([station,arrive,dwell='0:00',arrivalRoute='',departureRoute=''])=>({station,arrive:sec(arrive),dwell:sec(dwell),arrivalRoute,departureRoute}));
 const PHOTO=[
  {id:'0120202',name:'여객_하_(서울-수원)_NEW',kind:'KTX',direction:'down',source:'photo',calls:rows([
   ['seoul','0:00','0:00','','4B_B602T'],['namyeong','1:00'],['yongsan','3:30','0:00','1B_3T','4B_B610T'],['noryangjin','5:30','0:00','1B_3T','4B_B614T'],
   ['daebang','7:30'],['singil','9:00'],['yeongdeungpo','11:00','2:00','1A_2T','4B_B622T'],['sindorim','15:00'],['guro','16:30','0:00','1A_1T','4B_B630T'],
   ['gasan','18:00'],['doksan','19:30'],['geumcheon','21:00','0:00','1B_3T','4C_B644T'],['seoksu','23:00'],['gwanak','25:00'],
   ['anyang','26:30','0:00','1B_3T','4C_B660T'],['myeonghak','27:30'],['geumjeong','28:30'],['gunpo','31:00','0:00','1B_2T','4B_B680T'],['dangjeong','32:00'],
   ['uiwang','33:30','0:00','1B_3T','4C_B692T'],['skku','34:30'],['hwaseo','35:30'],['suwon','36:30','0:00','1B_3T','']])},
  {id:'0110001',name:'추석',kind:'KTX',direction:'up',source:'photo',calls:rows([
   ['suwon','0:00','0:00','','3C_B709T'],['hwaseo','1:00'],['skku','2:00'],['uiwang','3:00','0:00','2B_4T','3C_B685T'],['dangjeong','4:30'],
   ['gunpo','5:30','0:00','2B_3T','3B_B673T'],['geumjeong','8:00'],['myeonghak','9:00'],['anyang','10:00','0:00','2B_4T','3C_B655T'],['gwanak','11:30'],['seoksu','13:30'],
   ['geumcheon','15:30','0:00','2B_6T','3C_B639T'],['doksan','16:30'],['gasan','17:30'],['guro','19:00','0:00','2B_2T','3D_B627T'],['sindorim','20:30'],
   ['yeongdeungpo','22:30','0:00','2B_3T','3C_B619T2T'],['singil','24:30'],['daebang','25:30'],['noryangjin','27:00','0:00','2A_4T','3A_B613T'],
   ['yongsan','29:00','0:00','2A_7T','3A_B605T'],['namyeong','30:00'],['seoul','31:00','0:00','2A_7T','']])}
 ];
 // the remaining names of the photographed list whose rows are unknown are not invented
 function simulated(id,name,from,to){
  const t=T().pattern({id:'X0000',from,to,start:0});
  return {id,name,kind:'KTX',direction:t.direction,source:'simulator',calls:t.calls.map(c=>({station:c.station,arrive:Math.max(0,c.arrival),dwell:c.departure-Math.max(0,c.arrival),arrivalRoute:c.arrivalRoute||'',departureRoute:c.departureRoute||''}))};
 }
 function seed(){
  return [...PHOTO,simulated('0129103','전동_하_(청량리-수원)_NEW','cheongnyangni','suwon'),simulated('0119103','전동_상_(수원-청량리)_NEW','suwon','cheongnyangni')]
   .map(p=>({line:LINE,...MIG,...structuredClone(p)}));
 }
 const depart=c=>c.arrive+c.dwell;
 // row checks of the 저장 button: stations in running order, times not going back, routes that exist at the station
 function validate(p){
  if(!p||!String(p.name||'').trim())return '패턴이름을 입력하세요.';
  if(!['up','down'].includes(p.direction))return '방향을 선택하세요.';
  if(!Array.isArray(p.calls)||p.calls.length<2)return '경유역을 2개 이상 등록하세요.';
  const sign=p.direction==='down'?1:-1;
  for(let i=0;i<p.calls.length;i++){
   const c=p.calls[i],st=N.catalog[c.station];
   if(!st)return `${i+1}번째 역을 선택하세요.`;
   if(![c.arrive,c.dwell].every(v=>Number.isInteger(v)&&v>=0))return `${st.name}: 시간을 확인하세요.`;
   if(i){const prev=p.calls[i-1];if((st.order-N.catalog[prev.station].order)*sign<=0)return `${st.name}: 역 순서가 ${p.direction==='down'?'하행':'상행'} 방향과 맞지 않습니다.`;if(c.arrive<=depart(prev))return `${st.name}: 진입 시간이 앞 역 진출 시간보다 늦어야 합니다.`;}
   if(!R.validate(c.station,c.arrivalRoute||'','arrival'))return `${st.name}역에 없는 진입 진로입니다: ${c.arrivalRoute}`;
   if(!R.validate(c.station,c.departureRoute||'','departure'))return `${st.name}역에 없는 진출 진로입니다: ${c.departureRoute}`;
  }
  return null;
 }
 // 적용패턴 역정보 (출발역 · 종착역): the stretch of the pattern a new train runs, shifted to its 시발시각
 function apply(p,{from=p.calls[0].station,to=p.calls.at(-1).station,start=0}={}){
  const a=p.calls.findIndex(c=>c.station===from),b=p.calls.findIndex(c=>c.station===to);
  if(a<0||b<0||b<=a)return null;
  const part=p.calls.slice(a,b+1),offset=start-depart(part[0]);
  return part.map((c,i)=>{
   const first=i===0,last=i===part.length-1,arrival=first?start:c.arrive+offset;
   return {station:c.station,arrival,departure:last?arrival:first?start:depart(c)+offset,track:'',stopType:first?'시발':last?'종착':'정차',arrivalRoute:first?'':c.arrivalRoute||'',departureRoute:last?'':c.departureRoute||''};
  });
 }
 function nextId(list){const max=Math.max(120000,...list.map(p=>Number(p.id)||0));return String(max+1).padStart(7,'0');}
 function search(list,{kind='',direction='all',name=''}={}){
  const needle=name.trim();
  return list.filter(p=>(!kind||p.kind===kind)&&(direction==='all'||p.direction===direction)&&(!needle||p.name.includes(needle)));
 }
 const api={LINE,seed,validate,apply,nextId,search,depart};
 if(typeof module!=='undefined')module.exports=api;else root.SimPatterns=api;
})(typeof globalThis!=='undefined'?globalThis:this);
