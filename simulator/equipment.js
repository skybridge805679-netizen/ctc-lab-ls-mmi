(function(root){
'use strict';
// 역 공통설비 상태 (교통관제운영 4권 p.384-386, 408): 표준화 프로토콜 역은 전자연동장치 1계·2계(EIS1/EIS2) 상태와 건널목(RC) 장애값을 받는다.
// 교육용 장애 설정으로 설비를 고장 상태로 만들면 L/S 공통설비 표시가 붉게 바뀌고 알람이 올라간다. 표준시각은 매일 03:00:00 전송, LDTS(DTS1·DTS2) 복구 시에도 전송.
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
let refresh=null;
function paint(st){
 if(refresh)refresh();
 for(const el of document.querySelectorAll('#lsStage [data-equipment]')){
  const n=el.dataset.equipment,bad=isFault(st,n);
  el.classList.toggle('fault',bad);
  el.title=`${label(n)} · ${bad?'장애':'정상'}`;
 }
}
function sendTime(why){sent.push(why);root.SimMMI?.log('event',`표준시각 전송 (${why})`);}
// called every simulated step with the clock in seconds of the day
function tick(clock){
 const t=((clock%86400)+86400)%86400;
 if(last!==null&&last<SEND&&t>=SEND)sendTime('매일 03:00:00');
 last=t;
}
function faultList(){return Object.keys(faults);}
function reset(){for(const k of faultList())delete faults[k];last=null;sent=[];}
function init(){
 const doc=SimDOM.document,$=id=>doc.getElementById(id),m=root.SimMMI;
 const cur=()=>$('lsStage')?.dataset.controlStation||'';
 const draw=()=>{const st=cur();$('eqStation').textContent=st?name(st)+'역':'-';$('eqList').innerHTML=NAMES.map(n=>`<label><input type="checkbox" data-eq="${n}" ${isFault(st,n)?'checked':''}> ${label(n)}</label>`).join('');
  const F=root.SimField;
  if(F&&st){const c=F.core(st),s=F.state(st),keep=id=>$(id).value;
   const fill=(id,list)=>{const v=keep(id);$(id).innerHTML=list.map(x=>`<option>${x}</option>`).join('');if(list.includes(v))$(id).value=v;};
   fill('eqSig',Object.keys(c.signals));fill('eqPt',Object.keys(c.points));fill('eqRt',Object.keys(c.routes));
   $('eqSigFault').checked=(s.faults?.signals||[]).includes($('eqSig').value);$('eqPtFault').checked=(s.faults?.points||[]).includes($('eqPt').value);$('eqTtb').checked=(s.ttb||[]).includes($('eqRt').value);}
  $('eqTime').textContent=sent.length?'표준시각 전송 '+sent.length+'회 (최근: '+sent[sent.length-1]+')':'표준시각 전송 기록 없음 (매일 03:00:00, LDTS 복구 시)';};
 const w=m.createWindow('equipment',{title:'설비 장애 설정 (교육용)',x:220,y:110,width:560,body:`<div class="rpt"><div class="idm-note">L/S 공통설비 표시(N1 … RC)를 장애로 만들어 알람과 표시를 연습합니다. 현재 L/S 역: <b id="eqStation"></b></div><div id="eqList" class="rpt-cond"></div><div class="idm-note"><b>신호기·전환기·TTB</b> (자동제어 조건 ④⑤⑥)</div><div class="rpt-cond"><label>신호기 <select id="eqSig"></select></label><label><input type="checkbox" id="eqSigFault"> 고장</label><label>전환기 <select id="eqPt"></select></label><label><input type="checkbox" id="eqPtFault"> 고장</label><label>진로 <select id="eqRt"></select></label><label><input type="checkbox" id="eqTtb"> TTB(연속통과진로)</label></div><div class="idm-note" id="eqTime"></div><div class="idm-buttons"><button type="button" class="sched-btn" id="eqClear">모두 복구</button><button type="button" class="sched-btn" id="eqClose">닫기</button></div></div>`});
 $('eqList').onchange=e=>{const c=e.target.closest('[data-eq]');if(c){set(cur(),c.dataset.eq,c.checked);draw();}};
 const field=(a)=>{const r=root.SimField.dispatch(cur(),a);if(r.ok)m.log('event',`${name(cur())}역 ${r.message}`);draw();};
 $('eqSig').onchange=$('eqPt').onchange=$('eqRt').onchange=draw;
 $('eqSigFault').onchange=e=>field({type:'fault',kind:'signal',id:$('eqSig').value,on:e.target.checked});
 $('eqPtFault').onchange=e=>field({type:'fault',kind:'point',id:$('eqPt').value,on:e.target.checked});
 $('eqTtb').onchange=e=>field({type:'ttb',id:$('eqRt').value,on:e.target.checked});
 $('eqClear').onclick=()=>{const st=cur();for(const n of NAMES)set(st,n,false);const S=root.SimField?.state(st);if(S){for(const id of [...(S.faults?.signals||[])])root.SimField.dispatch(st,{type:'fault',kind:'signal',id,on:false});for(const id of [...(S.faults?.points||[])])root.SimField.dispatch(st,{type:'fault',kind:'point',id,on:false});for(const id of [...(S.ttb||[])])root.SimField.dispatch(st,{type:'ttb',id,on:false});}draw();};
 $('eqClose').onclick=()=>m.close('equipment');
 w.opener=draw;refresh=draw;draw();
}
root.SimEquipment={init,NAMES,INFO,set,isFault,paint,tick,faultList,reset,sentTimes:()=>sent.slice()};
})(window);
