'use strict';
function create(root){
const NAMES=['N1','N2','C','REC','UPS','ShP','EIS1','EIS2','DTS1','DTS2','RC'];
const INFO={EIS1:'전자연동장치 1계',EIS2:'전자연동장치 2계',DTS1:'역정보전송장치 1계',DTS2:'역정보전송장치 2계',RC:'건널목 상태표 장치',UPS:'무정전 전원공급장치'};
const SEND=3*3600;
const faults={},active={};let last=null,sent=[];      // active: 역별 LDTS 운용계 (1 또는 2, 없으면 1계)
const key=(st,n)=>st+'/'+n;
const label=n=>INFO[n]?`${n}(${INFO[n]})`:n;
const name=id=>root.SimMMI?.stationInfo?.(id)?.name||id;
function isFault(st,n){return !!faults[key(st,n)];}
function set(st,n,on){
 if(!NAMES.includes(n))return false;
 const was=isFault(st,n);on=!!on;if(was===on)return false;
 if(on)faults[key(st,n)]=true;else delete faults[key(st,n)];
 const m=root.SimMMI;
 if(m){
  if(on){m.raiseAlarm(`${name(st)}역 ${n==='RC'?'건널목 장애':label(n)+' 장애'}`,'장애','E',name(st));
   if(n==='DTS1'||n==='DTS2'){const side=+n.slice(3),other=3-side;
    if(isFault(st,'DTS'+other))m.raiseAlarm(`${name(st)}역 LDTS 1계·2계 모두 장애 (현장 상태 수신 불가)`,'장애','F',name(st));
    else if(side===sideOf(st))m.raiseAlarm(`${name(st)}역 LDTS ${side}계(운용계) 장애 · ${other}계로 수동 계절체 필요`,'장애','W',name(st));}}
  else{m.log('event',`${name(st)}역 ${label(n)} 복구`);if((n==='DTS1'||n==='DTS2')&&!isFault(st,'DTS1')&&!isFault(st,'DTS2'))sendTime(`${name(st)}역 LDTS 복구`);}
 }
 paint(st);return true;
}
function paint(){}
// LDTS 상태보기 (실기1 4장 6절 가): 1계·2계마다 ACTIVE(운용)·STANDBY(대기)·FAIL(장애). 수동 계절체는 대기계나 장애난 운용계를 눌러 한다.
function sideOf(st){return active[st]===2?2:1;}
function ldts(st){return [1,2].map(side=>({side,state:isFault(st,'DTS'+side)?'FAIL':side===sideOf(st)?'ACTIVE':'STANDBY'}));}
function switchover(st,side){
 side=+side;if(side!==1&&side!==2)return {ok:false,message:'절체할 계(1계·2계)를 확인하세요.'};
 const now=sideOf(st),to=side===now?3-now:side;
 if(side===now&&!isFault(st,'DTS'+now))return {ok:false,message:`LDTS ${now}계는 정상 운용 중입니다. 절체하려면 대기계를 선택하세요.`};
 if(isFault(st,'DTS'+to))return {ok:false,message:`LDTS ${to}계가 장애 상태라 절체할 수 없습니다.`};
 active[st]=to;root.SimMMI?.log('event',`${name(st)}역 LDTS 수동 계절체 ${now}계 → ${to}계`);
 return {ok:true,from:now,to,message:`${name(st)}역 LDTS ${now}계 → ${to}계 계절체 완료`};
}
function ldtsMap(){return {...active};}
function sendTime(why){sent.push(why);root.SimMMI?.log('event',`표준시각 전송 (${why})`);}
// called every simulated step with the clock in seconds of the day
function tick(clock){
 const t=((clock%86400)+86400)%86400;
 if(last!==null&&last<SEND&&t>=SEND)sendTime('매일 03:00:00');
 last=t;
}
function faultList(){return Object.keys(faults);}
function reset(){for(const k of faultList())delete faults[k];for(const k of Object.keys(active))delete active[k];last=null;sent=[];}
return {checkpoint:()=>({faults,last,sent,active}),restore:data=>{reset();Object.assign(faults,data.faults);Object.assign(active,data.active||{});last=data.last;sent=data.sent;},set,sideOf,ldts,switchover,ldtsMap,isFault,tick,faultList,reset,sentTimes:()=>sent.slice()};
}
module.exports={create};
