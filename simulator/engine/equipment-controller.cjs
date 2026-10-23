'use strict';
function create(root){
const NAMES=['N1','N2','C','REC','UPS','ShP','EIS1','EIS2','DTS1','DTS2','RC'];
const INFO={EIS1:'전자연동장치 1계',EIS2:'전자연동장치 2계',DTS1:'역정보전송장치 1계',DTS2:'역정보전송장치 2계',RC:'건널목 상태표 장치',UPS:'무정전 전원공급장치'};
const SEND=3*3600;
const faults={};let last=null,sent=[];
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
  if(on)m.raiseAlarm(`${name(st)}역 ${n==='RC'?'건널목 장애':label(n)+' 장애'}`,'장애','E',name(st));
  else{m.log('event',`${name(st)}역 ${label(n)} 복구`);if((n==='DTS1'||n==='DTS2')&&!isFault(st,'DTS1')&&!isFault(st,'DTS2'))sendTime(`${name(st)}역 LDTS 복구`);}
 }
 paint(st);return true;
}
function paint(){}
function sendTime(why){sent.push(why);root.SimMMI?.log('event',`표준시각 전송 (${why})`);}
// called every simulated step with the clock in seconds of the day
function tick(clock){
 const t=((clock%86400)+86400)%86400;
 if(last!==null&&last<SEND&&t>=SEND)sendTime('매일 03:00:00');
 last=t;
}
function faultList(){return Object.keys(faults);}
function reset(){for(const k of faultList())delete faults[k];last=null;sent=[];}
return {set,isFault,tick,faultList,reset,sentTimes:()=>sent.slice()};
}
module.exports={create};
