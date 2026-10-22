(function(root){
'use strict';
// 시스템 조회 windows built from the search conditions and result columns of the 실기1 textbook (4장 4·7절, p.48-92).
// Layouts were never photographed, so the arrangement is the simulator's own; the data comes from the simulator:
// 실적 = a call whose time has passed on the simulated clock (with the delays and routes of the current plan).
const doc=document,$=id=>document.getElementById(id),N=root.SimNetwork,T=root.SimTimetable;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const model=()=>root.SimDiagram.getModel(),mmi=()=>root.SimMMI;
let host=null;
const now=()=>host?.context().state.clock??0;
const today=()=>model().serviceDate;
const name=id=>mmi().stationInfo(id).name;
const dirText=d=>d==='down'?'하행':'상행';
const mmss=s=>`${Math.floor(Math.abs(s)/60)}:${String(Math.round(Math.abs(s))%60).padStart(2,'0')}`;
const NOTE='교육용 구성 — 검색조건과 결과 열은 교재(실기1)를 따르며 화면 배치는 원본을 확인하지 못했습니다. 실적은 시뮬레이션 시각이 지난 경유역입니다.';
const stationOptions=(all=true)=>(all?'<option value="">전체</option>':'')+N.stations.map(s=>`<option value="${s.id}">${esc(name(s.id))}</option>`).join('');
const kindOptions='<option value="">전체</option>'+['전동열차','일반열차','회송열차','KTX'].map(k=>`<option>${k}</option>`).join('');
const dirOptions='<option value="all">전체</option><option value="up">상행</option><option value="down">하행</option>';
const date=id=>`<label>날짜<input type="date" id="${id}Date" value="${today()}"></label>`;
const line='<label>선별<select aria-label="선별"><option>경부선</option></select></label>';
// a search condition the operator switches on with its checkbox (textbook: "체크박스를 체크하여 활성화")
const opt=(id,key,label,control)=>`<label class="rpt-opt"><input type="checkbox" id="${id}Use${key}" aria-label="${label} 조건 사용">${label}${control}</label>`;

// ---- data helpers
const planOf=(train,call)=>train.plan?.find(c=>c.station===call.station)||call;
function callRows(train){
 const t=now();
 return train.calls.map((call,i)=>{
  const plan=planOf(train,call),arrDone=call.arrival<=t,depDone=call.departure<=t;
  return {train,call,i,plan,arrival:arrDone?T.clock(call.arrival):'',departure:depDone?T.clock(call.departure):'',
   stop:arrDone&&depDone?mmss(call.departure-call.arrival):'',delay:call.arrival-plan.arrival,arrDone,depDone};
 });
}
const trainsOn=(dateValue,dir='all',kind='')=>dateValue!==today()?[]:model().trains.filter(t=>(dir==='all'||t.direction===dir)&&(!kind||t.kind===kind));
const actualCols=['열차등급','열차번호','계획도착','계획출발','실적도착','정차','실적출발','도착진로','출발진로'];
const actualRow=r=>[r.train.kind,r.train.id,T.clock(r.plan.arrival),T.clock(r.plan.departure),r.arrival,r.stop,r.departure,r.call.arrivalRoute||'',r.call.departureRoute||''];

function scheduleText(row){
 const c=JSON.parse(row.text||'{}');
 return {create:'임시열차 생성',copy:'열차 복사 생성',update:'스케줄 수정',delay:`지연 ${c.minutes??''}분 적용`,cancel:c.cancelled?'전체 운휴':'운휴 복귀','partial-cancel':c.cancelled?'부분 운휴':'부분 운휴 복귀',idReserve:`스케줄 ID ${c.id??''} 예약`}[row.type]||row.type;
}
const scheduleType=row=>{const c=JSON.parse(row.text||'{}');return {create:'스케줄생성',copy:'스케줄생성',update:'스케줄수정',delay:'스케줄수정',cancel:c.cancelled?'운휴':'운휴복귀','partial-cancel':c.cancelled?'운휴':'운휴복귀',idReserve:'ID수정'}[row.type]||row.type;};
const SCHEDULE_TYPES=['ID생성','ID수정','ID삭제','스케줄생성','스케줄수정','스케줄삭제','운휴','운휴복귀'];
const dayOf=row=>row.time.slice(0,10).replaceAll('/','-');

// ---- report definitions: conditions (html) + run(read) -> {cols,rows}
// built lazily: the station names come from SimMMI, which loads after this file
const buildReports=()=>({
 trainPositions:{title:'열차위치목록 조회',cond:`${line}<label>운행방향<select id="trainPositionsDir">${dirOptions}</select></label><label>구분<select id="trainPositionsState"><option value="">전체</option><option>운행중</option><option>운행대기</option><option>운행완료</option></select></label><label>열차종별<select id="trainPositionsKind">${kindOptions}</select></label><label>열차번호<input id="trainPositionsFind" maxlength="6" placeholder="K1131"></label><button type="button" class="sched-btn" id="trainPositionsFindBtn">열차번호찾기</button>`,auto:true,
  run(v){const t=now();return {cols:['열차번호','방향','열차종별','구분','현재 위치','계획 출발','계획 도착'],rows:model().trains.filter(x=>(v.dir==='all'||x.direction===v.dir)&&(!v.kind||x.kind===v.kind)).map(x=>{
   const p=T.position(x,t),state=x.cancelled?'운휴':p?'운행중':t<x.calls[0].arrival?'운행대기':'운행완료';
   return {state,row:[x.id,dirText(x.direction),x.kind,state,p?(p.nextStation?`${name(p.station)}→${name(p.nextStation)}`:name(p.station)):'',T.clock(x.calls[0].departure),T.clock(x.calls.at(-1).arrival)]};
  }).filter(r=>!v.state||r.state===v.state).map(r=>r.row)};},
  read:id=>({dir:$(id+'Dir').value,state:$(id+'State').value,kind:$(id+'Kind').value})},
 stationActual:{title:'역실적 조회',cond:`${date('stationActual')}<label>표시시간<input type="time" id="stationActualFrom" value="08:00"> ~ <input type="time" id="stationActualTo" value="14:00"></label>${line}<label>위치<select id="stationActualDir">${dirOptions}</select></label><label>역<select id="stationActualStation">${stationOptions(false)}</select></label>`,
  run(v){const hm=x=>+x.slice(0,2)*3600+ +x.slice(3,5)*60-28800,from=v.from?hm(v.from):-Infinity,to=v.to?hm(v.to)+59:Infinity;
   return {cols:actualCols,rows:trainsOn(v.date,v.dir).flatMap(callRows).filter(r=>r.call.station===v.station&&r.plan.arrival>=from&&r.plan.arrival<=to).sort((a,b)=>a.plan.arrival-b.plan.arrival).map(actualRow)};},
  read:id=>({date:$(id+'Date').value,from:$(id+'From').value,to:$(id+'To').value,dir:$(id+'Dir').value,station:$(id+'Station').value})},
 trainActual:{title:'열차실적 조회',cond:`${date('trainActual')}${line}<button type="button" class="sched-btn" id="trainActualList">열차번호검색</button><label>운행방향<select id="trainActualDir">${dirOptions}</select></label><label>열차번호<select id="trainActualTrain" size="1"></select></label>`,
  run(v){const train=trainsOn(v.date).find(t=>t.id===v.train);return {cols:['순서','역',...actualCols.slice(2)],rows:train?callRows(train).map(r=>[r.i+1,name(r.call.station),...actualRow(r).slice(2)]):[]};},
  read:id=>({date:$(id+'Date').value,dir:$(id+'Dir').value,train:$(id+'Train').value}),
  setup(id){$('trainActualList').onclick=()=>{const list=trainsOn($('trainActualDate').value,$('trainActualDir').value);$('trainActualTrain').innerHTML=list.map(t=>`<option>${esc(t.id)}</option>`).join('');$('trainActualBody').innerHTML=`<tr class="empty"><td colspan="8">${list.length}개 열차번호를 조회했습니다. 열차번호를 선택하고 [검색]을 누르세요.</td></tr>`;};}},
 cancelledList:{title:'운휴열차조회',cond:`${line}${date('cancelledList')}`,
  run(v){const rows=[];for(const t of trainsOn(v.date)){let start=null;t.calls.forEach((c,i)=>{if(c.cancelled&&start===null)start=i;if(start!==null&&(!c.cancelled||i===t.calls.length-1)){const end=c.cancelled?i:i-1;rows.push([t.id,name(t.calls[start].station),`${name(t.calls[start].station)}~${name(t.calls[end].station)}`]);start=null;}});}
   return {cols:['열차번호','역','운휴구간'],rows};},read:id=>({date:$(id+'Date').value})},
 createdList:{title:'임시열차 조회',cond:`${date('createdList')}${line}`,
  run(v){const ids=new Set(model().changes.filter(c=>c.type==='create'||c.type==='copy').map(c=>c.id));
   return {cols:['등급','열차번호','시발역','종착역','진입시각','방향','회차열번'],rows:trainsOn(v.date).filter(t=>ids.has(t.id)).map(t=>[t.kind,t.id,name(t.calls[0].station),name(t.calls.at(-1).station),T.clock(t.calls[0].arrival),dirText(t.direction),t.relatedTrain||''])};},read:id=>({date:$(id+'Date').value})},
 delayList:{title:'지연열차조회',cond:`${date('delayList')}${line}<label>열차등급<select id="delayListKind">${kindOptions}</select></label><label>위치<select id="delayListDir">${dirOptions}</select></label><label>지연기준<select id="delayListBasis"><option value="last">마지막 역이 지연</option><option value="any">경유역 중 한 곳이라도 지연</option></select></label><label>지연시간(분 이상)<input type="number" id="delayListMin" min="0" max="120" value="1"></label>`,
  run(v){const rows=[];for(const t of trainsOn(v.date,v.dir,v.kind)){t.calls.forEach((c,i)=>{if(v.basis==='last'&&i!==t.calls.length-1)return;const d=c.arrival-planOf(t,c).arrival;if(d>0&&d>=v.min*60)rows.push([t.id,name(c.station),mmss(d),'—']);});}
   return {cols:['열차번호','역','지연시간','지연코드'],rows};},read:id=>({date:$(id+'Date').value,kind:$(id+'Kind').value,dir:$(id+'Dir').value,basis:$(id+'Basis').value,min:Number($(id+'Min').value)||0})},
 manualTrain:{title:'열차번호 수동조작 이력',cond:`${date('manualTrain')}<label>역<select id="manualTrainStation">${stationOptions()}</select></label>`,
  run(v){return {cols:['시간','역','내용'],rows:mmi().history().train.filter(r=>dayOf(r)===v.date&&(!v.station||r.station===name(v.station))).map(r=>[r.time,r.station,r.text])};},read:id=>({date:$(id+'Date').value,station:$(id+'Station').value})},
 manualMode:{title:'역제어모드 수동조작 이력',cond:`${date('manualMode')}<label>역<select id="manualModeStation">${stationOptions()}</select></label>`,
  run(v){return {cols:['시간','역','내용'],rows:mmi().history().mode.filter(r=>dayOf(r)===v.date&&(!v.station||r.station===name(v.station))).map(r=>[r.time,r.station,r.text])};},read:id=>({date:$(id+'Date').value,station:$(id+'Station').value})},
 manualField:{title:'현장설비 수동조작 이력',cond:`${date('manualField')}<label>역<select id="manualFieldStation">${stationOptions()}</select></label><label>구분<select id="manualFieldKind"><option value="">전체</option><option>선로전환기</option><option>신호기</option><option>진로</option></select></label>`,
  run(v){return {cols:['시간','역','구분','내용'],rows:mmi().history().field.filter(r=>dayOf(r)===v.date&&(!v.station||r.station===name(v.station))&&(!v.kind||r.kind===v.kind)).map(r=>[r.time,r.station,r.kind,r.text])};},read:id=>({date:$(id+'Date').value,station:$(id+'Station').value,kind:$(id+'Kind').value})},
 scheduleHistory:{title:'온라인 스케줄 이력',cond:`${line}${opt('scheduleHistory','Date','조작날짜',`<input type="date" id="scheduleHistoryDate" value="${today()}">`)}${opt('scheduleHistory','Type','조작타입',`<select id="scheduleHistoryType">${SCHEDULE_TYPES.map(x=>`<option>${x}</option>`).join('')}</select>`)}${opt('scheduleHistory','Console','콘솔정보','<select id="scheduleHistoryConsole"><option>MMI-1</option></select>')}${opt('scheduleHistory','Text','내용검색','<input id="scheduleHistoryText" placeholder="예: K1131">')}`,
  run(v){return {cols:['조작시간','조작타입','열차번호','콘솔','내용'],rows:mmi().history().schedule.filter(r=>(!v.date||dayOf(r)===v.date)&&(!v.type||scheduleType(r)===v.type)&&(!v.console||r.console===v.console)).map(r=>[r.time,scheduleType(r),r.train,r.console,scheduleText(r)]).filter(r=>!v.text||r.join(' ').includes(v.text))};},
  read:id=>({date:$(id+'UseDate').checked?$(id+'Date').value:'',type:$(id+'UseType').checked?$(id+'Type').value:'',console:$(id+'UseConsole').checked?$(id+'Console').value:'',text:$(id+'UseText').checked?$(id+'Text').value.trim():''})},
 alarmEvent:{title:'알람/이벤트조회',cond:`${opt('alarmEvent','Station','역명',`<select id="alarmEventStation">${stationOptions(false)}</select>`)}${opt('alarmEvent','Count','항목수','<input type="number" id="alarmEventCount" min="1" max="500" value="100">')}${opt('alarmEvent','Level','경고종류',`<select id="alarmEventLevel">${Object.entries(root.SimMMI?.LEVELS||{F:'중대한 오류',E:'오류',W:'경고',I:'안내',D:'디버깅'}).map(([k,l])=>`<option value="${k}">${l}(${k})</option>`).join('')}</select>`)}${opt('alarmEvent','Equip','현장설비','<input id="alarmEventEquip" placeholder="예: SG_1A, RT_4A">')}${opt('alarmEvent','Date','발생시간',`<input type="date" id="alarmEventDate" value="${today()}">`)}`,
  run(v){const l=mmi().getLogs(),L=mmi().LEVELS,rows=[...l.alarm.map(r=>['알람',r]),...l.event.map(r=>['이벤트',r])].sort((a,b)=>b[1].time.localeCompare(a[1].time));
   return {cols:['구분','종류','발생시간','내용'],rows:rows.filter(([,r])=>(!v.station||r.text.includes(name(v.station)))&&(!v.level||(r.level||'I')===v.level)&&(!v.equip||r.text.includes(v.equip))&&(!v.date||dayOf(r)===v.date)).slice(0,v.count||500).map(([k,r])=>[k,L[r.level||'I'],r.time,r.text])};},
  read:id=>({station:$(id+'UseStation').checked?$(id+'Station').value:'',count:$(id+'UseCount').checked?Number($(id+'Count').value):0,level:$(id+'UseLevel').checked?$(id+'Level').value:'',equip:$(id+'UseEquip').checked?$(id+'Equip').value.trim():'',date:$(id+'UseDate').checked?$(id+'Date').value:''})},
 alarmAck:{title:'알람메시지 확인이력 조회',cond:`${date('alarmAck')}<label>기준<select id="alarmAckBasis"><option value="confirmed">확인일시</option><option value="occurred">발생일시</option></select></label><label>조작자<input id="alarmAckOperator" placeholder="전체"></label><label>조작콘솔<input id="alarmAckConsole" placeholder="전체"></label><label>종류<select id="alarmAckLevel"><option value="">전체</option><option value="F">중대한 오류(F)</option><option value="E">오류(E)</option></select></label>`,
  run(v){const L=mmi().LEVELS;return {cols:['발생일시','확인일시','종류','조작자','조작콘솔','내용'],rows:mmi().history().ack.filter(r=>(v.basis==='occurred'?r.occurred:r.time).slice(0,10).replaceAll('/','-')===v.date&&(!v.operator||r.operator.includes(v.operator))&&(!v.console||r.console.includes(v.console))&&(!v.level||r.level===v.level)).map(r=>[r.occurred,r.time,L[r.level],r.operator,r.console,r.text])};},
  read:id=>({date:$(id+'Date').value,basis:$(id+'Basis').value,operator:$(id+'Operator').value.trim(),console:$(id+'Console').value.trim(),level:$(id+'Level').value})}
});

// 인쇄: the result table is printed through a hidden frame (the real MMI prints a 장표)
function printTable(title,head,rows){
 const f=doc.createElement('iframe');f.style.cssText='position:fixed;width:0;height:0;border:0';doc.body.appendChild(f);
 const d=f.contentDocument;d.open();d.write(`<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:12px sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #888;padding:2px 6px;text-align:left}</style><h3>${esc(title)}</h3><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);d.close();
 try{f.contentWindow.focus();f.contentWindow.print();}catch{}
 setTimeout(()=>f.remove(),1500);
}

function init(api){
 host=api;const R=buildReports();
 Object.entries(R).forEach(([id,def],k)=>{
  let last={cols:[],rows:[]};
  const draw=()=>{
   last=def.run(def.read(id));
   $(id+'Head').innerHTML=`<tr>${last.cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>`;
   $(id+'Body').innerHTML=last.rows.length?last.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join(''):`<tr class="empty"><td colspan="${last.cols.length||1}">조회된 내용이 없습니다</td></tr>`;
   $(id+'Count').textContent=`총 ${last.rows.length}건`;
  };
  const w=mmi().createWindow(id,{title:def.title,x:90+k*16,y:60+k*16,width:760,body:`<div class="rpt"><fieldset class="rpt-cond"><legend>검색조건</legend>${def.cond}</fieldset><div class="idm-table rpt-table"><table><thead id="${id}Head"></thead><tbody id="${id}Body"><tr class="empty"><td>검색조건을 입력하고 [검색]을 누르세요.</td></tr></tbody></table></div><div class="idm-note">${esc(NOTE)} <span id="${id}Count"></span></div><div class="idm-buttons"><button type="button" class="sched-btn primary" id="${id}Search">검색</button><button type="button" class="sched-btn" id="${id}Print">인쇄</button><button type="button" class="sched-btn" id="${id}Close">닫기</button></div></div>`});
  $(id+'Search').onclick=draw;
  $(id+'Print').onclick=()=>{if(!last.rows.length){mmi().alertBox('인쇄할 검색 결과가 없습니다.');return;}printTable(def.title,last.cols,last.rows);mmi().log('event',`${def.title} 인쇄`);};
  $(id+'Close').onclick=()=>mmi().close(id);
  def.setup?.(id);
  if(id==='trainPositions'){$('trainPositionsFindBtn').onclick=()=>{const n=$('trainPositionsFind').value.trim().toUpperCase(),row=[...$('trainPositionsBody').rows].find(r=>r.cells[0]?.textContent===n);if(!row){mmi().alertBox(`${n||'열차번호'} 열차를 목록에서 찾을 수 없습니다.`);return;}row.scrollIntoView({block:'center'});row.classList.add('sel');setTimeout(()=>row.classList.remove('sel'),1500);};}
  if(def.auto)w.opener=draw;
 });
}
root.SimMMIReports={init};
})(window);
