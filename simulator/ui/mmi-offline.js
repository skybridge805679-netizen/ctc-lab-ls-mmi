(function(root){
'use strict';
// 오프라인 열차스케줄 (실기1 5장 2절 p.99-115 · 실기3 3장 1절 p.41-44): 스케줄 서버에 있다가 운행일에 CTC 서버로 로딩되는 스케줄.
// 이 시뮬레이터에서는 FTS 라이브러리의 열차 스케줄(lib.schedules)이 오프라인 스케줄이고, [온라인 ID 예약적용]·[오프라인ID 실시간변경]으로
// 온라인에 올린다. 온라인 스케줄과 달리 열차를 삭제할 수 있고, 고쳐도 지금 운행(자동진로제어)에는 영향이 없다.
// 스케줄 ID는 다섯 자리: 노선 2자리 + 요일 1자리(1 평일 · 2 토 · 3 일 · 4 공휴일 · 5 특수일) + 사용자 2자리. 끝이 00이면 마스터 스케줄(삭제 불가).
// 화면 배치는 원본을 확인하지 못한 교육용 구성이다.
const doc=SimDOM.document,$=id=>doc.getElementById(id),N=root.SimNetwork,T=()=>root.SimTimetable,SR=()=>root.SimScheduleRoutes;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmi=()=>root.SimMMI,FUI=()=>root.SimFTSUI;
const LINES={'01':'경부선','90':'교육용 생성'},DAYS={1:'평일',2:'토요일',3:'일요일',4:'공휴일',5:'특수일'};
const name=id=>mmi().stationInfo(id).name;
const lib=()=>root.SimRemote?.snapshot?.ftsLibrary||FUI()?.library()||{schedules:[],situations:[],problems:[]};
const schedules=()=>lib().schedules||[];
const find=id=>schedules().find(s=>s.id===id);
const master=id=>/^\d{3}00$/.test(id);
const usedBy=id=>[...(lib().situations||[]).filter(x=>x.scheduleId===id),...(lib().problems||[]).filter(x=>x.setup?.scheduleId===id)];
const stamp=()=>new Date().toLocaleString('sv-SE',{timeZone:'Asia/Seoul'});
const record=(type,id,text,train='')=>{mmi().record('offline',{type,id,train,text,console:'MMI-1'});mmi().log('event',`오프라인 스케줄 ${type} [${id}]${train?' '+train:''} · ${text}`);};
// 상대시각 스케줄(교육 시작 기준)은 「±시:분:초」, 나머지는 운행 시각
const pad=n=>String(n).padStart(2,'0');
const hms=s=>`${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`;
const fmt=(sch,s)=>sch?.relative?(s<0?'-':'+')+hms(Math.abs(s)):T().clock(s);      // 교육 시작 전에 이미 달리던 열차는 「-」
function parse(sch,text){const m=/^([+-])?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(text).trim());if(!m||+m[3]>59||+(m[4]||0)>59||(m[1]&&!sch?.relative))return NaN;const v=+m[2]*3600+ +m[3]*60+ +(m[4]||0);return sch?.relative?(m[1]==='-'?-v:v):v-28800;}
// FTS 라이브러리를 고치는 한 곳: 실패하면 되돌린다
function commit(fn){const r=FUI()?.commit(fn);root.SimRemote.poll?.();return r;}
// 오프라인 시간표를 T(시간표 엔진)로 고치기 위한 임시 모형 (원격 엔진의 온라인 시간표와 다른 객체라 로컬에서 계산)
function scratch(sch){return {serviceDate:sch.timetable.serviceDate,trains:structuredClone(sch.timetable.trains),changes:[]};}
const settle=train=>{train.plan=train.calls.map(c=>({...c}));return train;};      // 오프라인 스케줄은 계획 그 자체
function printTable(title,cols,rows){root.SimMMIReports?.printTable(title,cols,rows);}
const opts=(list,sel)=>list.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`).join('');
const fail=msg=>{mmi().alertBox(msg,null,{icon:'error'});return false;};

// ------------------------------------------------------------ 오프라인 열차스케줄ID관리
let idSel='';
function initId(){
 const draw=()=>{
  const list=schedules();if(idSel&&!find(idSel))idSel='';
  $('offIdRows').innerHTML=list.length?list.map(s=>{const line=s.id.slice(0,2),day=s.id[2],used=usedBy(s.id).length;
   return `<tr data-off-id="${esc(s.id)}" class="${s.id===idSel?'sel':''}"><td>${esc(s.id)}</td><td>${esc(s.name)}</td><td>${esc(LINES[line]||line)}</td><td>${esc(DAYS[day]||'-')}</td><td>${master(s.id)?'<b>마스터</b>':'일반'}</td><td>${s.timetable?.trains?.length??0}</td><td>${esc(s.author||'')}</td><td>${esc(s.createdAt||'')}</td><td>${used?used+'곳':''}</td></tr>`;}).join(''):'<tr class="empty"><td colspan="9">오프라인 열차스케줄 ID가 없습니다</td></tr>';
  const sel=find(idSel);$('offIdPicked').textContent=sel?`${sel.id} · ${sel.name}`:'(목록에서 선택)';$('offIdName').value=sel?.name||'';
  $('offIdTrain').innerHTML=sel?opts((sel.timetable?.trains||[]).map(t=>[t.id,`${t.id} (${name(t.calls[0].station)}→${name(t.calls.at(-1).station)})`])):'';
  $('offIdTarget').innerHTML=opts(list.filter(s=>s.id!==idSel).map(s=>[s.id,`${s.id} · ${s.name}`]));
 };
 const w=mmi().createWindow('offlineId',{title:'오프라인 열차스케줄ID관리',x:70,y:40,width:1060,body:`<div class="rpt">
<div class="idm-cap">오프라인 열차스케줄 ID 목록</div><div class="idm-table rpt-table"><table><thead><tr><th>스케줄ID</th><th>스케줄명</th><th>노선</th><th>요일</th><th>구분</th><th>열차수</th><th>작성자</th><th>작성일</th><th>사용</th></tr></thead><tbody id="offIdRows"></tbody></table></div>
<div class="sys-two"><fieldset class="rpt-cond"><legend>ID 생성</legend><label>노선<select id="offIdLine"><option value="01">01-경부선</option></select></label><label>요일<select id="offIdDay">${opts(Object.entries(DAYS).map(([k,v])=>[k,k+'-'+v]))}</select></label><label>번호<input id="offIdNo" maxlength="2" size="3" placeholder="00~99"></label><label>스케줄명<input id="offIdNewName" size="16"></label><label><input type="checkbox" id="offIdCopy"> 선택한 ID의 열차 복사</label><button type="button" class="sched-btn primary" id="offIdCreate">ID 생성</button></fieldset>
<fieldset class="rpt-cond"><legend>선택한 ID</legend><b id="offIdPicked"></b><label>스케줄명<input id="offIdName" size="18"></label><button type="button" class="sched-btn" id="offIdRename">ID 수정</button><button type="button" class="sched-btn danger" id="offIdDelete">ID 삭제</button></fieldset></div>
<fieldset class="rpt-cond"><legend>열차스케줄 ID간 열차복사</legend><label>열차<select id="offIdTrain"></select></label><label>대상 ID<select id="offIdTarget"></select></label><button type="button" class="sched-btn" id="offIdCopyTrain">열차복사</button></fieldset>
<div class="idm-note">스케줄ID = 노선 2자리 + 요일 1자리 + 번호 2자리. 번호 00은 마스터 스케줄로 삭제할 수 없습니다(해당일에 지정된 스케줄이 없으면 마스터를 로딩). 상황·문제가 쓰는 ID도 삭제할 수 없습니다. 오프라인 스케줄을 온라인에 올리는 것은 [온라인 열차스케줄ID관리]의 예약적용·실시간변경입니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="offIdClose">닫기</button></div></div>`});
 $('offIdRows').onclick=e=>{const r=e.target.closest('[data-off-id]');if(r){idSel=r.dataset.offId;draw();}};
 $('offIdCreate').onclick=()=>{
  const no=$('offIdNo').value.trim();if(!/^\d{2}$/.test(no))return fail('번호는 숫자 두 자리로 입력하세요.');
  const id=$('offIdLine').value+$('offIdDay').value+no;if(find(id))return fail(`${id}는 이미 있는 스케줄ID입니다.`);
  const src=$('offIdCopy').checked?find(idSel):null;if($('offIdCopy').checked&&!src)return fail('열차를 복사할 ID를 목록에서 선택하세요.');
  const date=root.SimDiagram?.getModel?.().serviceDate||new Date().toISOString().slice(0,10);
  const nm=$('offIdNewName').value.trim()||'스케줄_'+id;
  if(!commit(l=>{l.schedules.push({id,name:nm,section:src?.section||'지하청량리-수원',author:'MMI-1',createdAt:stamp(),...(src?.relative?{relative:true}:{}),timetable:src?structuredClone({serviceDate:src.timetable.serviceDate,trains:src.timetable.trains}):{serviceDate:date,trains:[]}});}))return;
  record('ID생성',id,src?`${nm} (${src.id} 열차 ${src.timetable.trains.length}개 복사)`:nm);idSel=id;$('offIdNo').value='';draw();
 };
 $('offIdRename').onclick=()=>{const s=find(idSel);if(!s)return fail('수정할 스케줄ID를 선택하세요.');const nm=$('offIdName').value.trim();if(!nm)return fail('스케줄명을 입력하세요.');if(nm===s.name)return;
  if(commit(l=>{const x=l.schedules.find(y=>y.id===idSel);x.name=nm;delete x.builtin;}))record('ID수정',idSel,`스케줄명 → ${nm}`);draw();};
 $('offIdDelete').onclick=()=>{const s=find(idSel);if(!s)return fail('삭제할 스케줄ID를 선택하세요.');
  if(master(s.id))return fail(`${s.id}는 마스터 스케줄(끝 두 자리 00)이라 삭제할 수 없습니다.`);
  const used=usedBy(s.id);if(used.length)return fail('상황·문제에서 사용 중인 스케줄입니다: '+used.map(x=>x.name).join(', '));
  mmi().confirmBox(`${s.id} (${s.name}) 오프라인 열차스케줄 ID를 삭제하시겠습니까?`,()=>{const id=s.id;if(commit(l=>{l.schedules=l.schedules.filter(x=>x.id!==id);}))record('ID삭제',id,s.name);idSel='';draw();});};
 $('offIdCopyTrain').onclick=()=>{const src=find(idSel),tid=$('offIdTrain').value,dst=find($('offIdTarget').value);
  if(!src||!tid)return fail('복사할 열차가 있는 ID와 열차를 선택하세요.');if(!dst)return fail('대상 스케줄ID를 선택하세요.');
  if(dst.timetable.trains.some(t=>t.id===tid))return fail(`대상 ${dst.id}에 같은 열차번호 ${tid}가 있습니다.`);
  const t=src.timetable.trains.find(x=>x.id===tid),copy=root.SimFTS.scheduleTable({timetable:{serviceDate:dst.timetable.serviceDate,trains:[t]},relative:!!src.relative!==!!dst.relative},(src.relative?1:-1)*root.SimDiagram.clock(),dst.timetable.serviceDate).trains[0];
  if(commit(l=>{const x=l.schedules.find(y=>y.id===dst.id);x.timetable.trains.push(settle(copy));delete x.builtin;}))record('스케줄생성',dst.id,`${src.id}에서 ID간 열차복사`,tid);draw();};
 $('offIdClose').onclick=()=>mmi().close('offlineId');
 w.opener=draw;draw();
}

// ------------------------------------------------------------ 오프라인 열차스케줄관리
let schId='',trainId='',dirSel='all';
function initSchedule(){
 const sch=()=>find(schId),train=()=>sch()?.timetable.trains.find(t=>t.id===trainId);
 const routeSel=(c,kind,i)=>{const key=kind==='arrival'?'arrivalRoute':'departureRoute',list=SR()?.options(c.station,kind)||[],cur=c[key]||'';
  return `<select data-off-route="${kind}" data-i="${i}" aria-label="${esc(name(c.station))} ${kind==='arrival'?'도착':'출발'}진로"><option value="">-</option>${[...new Set([cur,...list].filter(Boolean))].map(r=>`<option ${r===cur?'selected':''}>${esc(r)}</option>`).join('')}</select>`;};
 const draw=()=>{
  const list=schedules();if(!find(schId))schId=list[0]?.id||'';
  $('offSchId').innerHTML=opts(list.map(s=>[s.id,`${s.id} · ${s.name}`]),schId);
  const s=sch(),trains=(s?.timetable.trains||[]).filter(t=>dirSel==='all'||t.direction===dirSel);if(trainId&&!train())trainId='';
  $('offSchNote').textContent=s?.relative?'이 스케줄은 교육 시작 시각 기준(상대시각)입니다. 시각은 교육 시작부터 「+시:분:초」(시작 전은 「-」)로 적습니다.':'';
  $('offSchTrains').innerHTML=trains.length?trains.map(t=>`<tr data-off-train="${esc(t.id)}" class="${t.id===trainId?'sel':''}"><td>${esc(t.id)}</td><td>${esc(t.kind)}</td><td>${t.direction==='down'?'하행':'상행'}</td><td>${esc(name(t.calls[0].station))}</td><td>${esc(name(t.calls.at(-1).station))}</td><td>${fmt(s,t.calls[0].departure)}</td><td>${fmt(s,t.calls.at(-1).arrival)}</td><td>${t.calls.every(c=>c.cancelled)?'전체':t.calls.some(c=>c.cancelled)?'부분':''}</td></tr>`).join(''):'<tr class="empty"><td colspan="8">열차가 없습니다</td></tr>';
  const t=train();
  $('offSchTrainCap').textContent=t?`${t.id} 경유역 (계획)`:'열차를 선택하세요';
  $('offSchKind').innerHTML=opts(T().KINDS.map(k=>[k,k]),t?.kind);$('offSchKind').disabled=!t;
  $('offSchCalls').innerHTML=t?t.calls.map((c,i)=>`<tr><td>${i+1}</td><td>${esc(name(c.station))}</td><td><input data-off-time="arrival" data-i="${i}" value="${fmt(s,c.arrival)}" size="9" aria-label="${esc(name(c.station))} 도착시각"></td><td><input data-off-time="departure" data-i="${i}" value="${fmt(s,c.departure)}" size="9" aria-label="${esc(name(c.station))} 출발시각"></td><td>${routeSel(c,'arrival',i)}</td><td>${routeSel(c,'departure',i)}</td><td><input type="checkbox" data-off-cx="${i}" ${c.cancelled?'checked':''} aria-label="${esc(name(c.station))} 운휴"></td></tr>`).join(''):'<tr class="empty"><td colspan="7">열차 목록에서 열차를 선택하세요</td></tr>';
 };
 const w=mmi().createWindow('offlineSchedule',{title:'오프라인 열차스케줄관리',x:90,y:30,width:1180,body:`<div class="rpt">
<fieldset class="rpt-cond"><legend>스케줄 선택</legend><label>오프라인 스케줄ID<select id="offSchId"></select></label><label><input type="radio" name="offSchDir" value="all" checked>전체</label><label><input type="radio" name="offSchDir" value="up">상행</label><label><input type="radio" name="offSchDir" value="down">하행</label><span class="idm-note" id="offSchNote"></span></fieldset>
<div class="sys-two"><div><div class="idm-cap">열차 목록</div><div class="idm-table rpt-table"><table><thead><tr><th>열차번호</th><th>등급</th><th>방향</th><th>시발역</th><th>종착역</th><th>시발시각</th><th>종착시각</th><th>운휴</th></tr></thead><tbody id="offSchTrains"></tbody></table></div>
<fieldset class="rpt-cond"><legend>열차 복사</legend><label>새 열차번호<input id="offSchCopyId" size="7" placeholder="K1234"></label><label>시발 출발시각<input id="offSchCopyAt" size="9" placeholder="09:00:00"></label><button type="button" class="sched-btn" id="offSchCopy">복사</button></fieldset>
<fieldset class="rpt-cond"><legend>열차 생성 (구간 패턴)</legend><label>열차번호<input id="offSchNewId" size="7"></label><label>등급<select id="offSchNewKind"></select></label><label>시발<select id="offSchFrom"></select></label><label>종착<select id="offSchTo"></select></label><label>출발<input id="offSchNewAt" size="9" placeholder="09:00:00"></label><button type="button" class="sched-btn" id="offSchCreate">생성</button></fieldset></div>
<div><div class="idm-cap" id="offSchTrainCap"></div><label class="idm-row">등급<select id="offSchKind"></select></label><div class="idm-table rpt-table"><table><thead><tr><th>순서</th><th>역명</th><th>도착시각</th><th>출발시각</th><th>도착진로</th><th>출발진로</th><th>운휴</th></tr></thead><tbody id="offSchCalls"></tbody></table></div></div></div>
<div class="idm-note">오프라인 스케줄은 운행일 전(모레 이후) 계획을 고치는 곳이라 지금 운행에는 영향이 없습니다. 온라인 스케줄과 달리 잘못 만든 열차는 삭제할 수 있습니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn primary" id="offSchSave">수정 저장</button><button type="button" class="sched-btn danger" id="offSchDelete">열차 삭제</button><button type="button" class="sched-btn" id="offSchPrintCalls">경유역 인쇄</button><button type="button" class="sched-btn" id="offSchPrint">인쇄</button><button type="button" class="sched-btn" id="offSchClose">닫기</button></div></div>`});
 $('offSchFrom').innerHTML=$('offSchTo').innerHTML=opts(N.stations.map(x=>[x.id,name(x.id)]));$('offSchTo').value=N.stations.at(-1).id;
 $('offSchNewKind').innerHTML=opts(T().KINDS.map(k=>[k,k]),'전동열차');
 $('offSchId').onchange=()=>{schId=$('offSchId').value;trainId='';draw();};
 for(const r of doc.querySelectorAll('input[name="offSchDir"]'))r.onchange=()=>{dirSel=r.value;draw();};
 $('offSchTrains').onclick=e=>{const r=e.target.closest('[data-off-train]');if(r){trainId=r.dataset.offTrain;draw();}};
 // 한 스케줄의 시간표를 T로 바꾸고 저장: fn(m) → T 결과
 const apply=(fn,type,text,tid)=>{const s=sch();if(!s)return fail('오프라인 스케줄ID를 선택하세요.');const m=scratch(s),r=fn(m);if(!r?.ok)return fail(r?.message||'스케줄을 확인하세요.');
  const trains=m.trains.map(t=>t.id===tid?settle(t):t);
  if(!commit(l=>{const x=l.schedules.find(y=>y.id===s.id);x.timetable.trains=trains;delete x.builtin;}))return false;record(type,s.id,text,tid);return true;};
 $('offSchSave').onclick=()=>{const s=sch(),t=train();if(!t)return fail('수정할 열차를 선택하세요.');const draft=structuredClone(t);draft.kind=$('offSchKind').value;
  for(const el of doc.querySelectorAll('[data-off-time]')){const v=parse(s,el.value);if(!Number.isFinite(v))return fail(`${name(t.calls[el.dataset.i].station)}역 ${el.dataset.offTime==='arrival'?'도착':'출발'}시각을 확인하세요. (${s.relative?'±시:분:초':'시:분:초'})`);draft.calls[el.dataset.i][el.dataset.offTime]=v;}
  for(const el of doc.querySelectorAll('[data-off-route]'))draft.calls[el.dataset.i][el.dataset.offRoute==='arrival'?'arrivalRoute':'departureRoute']=el.value;
  for(const el of doc.querySelectorAll('[data-off-cx]'))draft.calls[el.dataset.offCx].cancelled=el.checked;
  draft.cancelled=draft.calls.every(c=>c.cancelled);
  // 시발역은 도착=출발, 종착역은 출발=도착으로 맞추고, 나머지는 역별로 알기 쉬운 말로 거른다
  const first=draft.calls[0],last=draft.calls.at(-1);if(first.arrival!==t.calls[0].arrival&&first.departure===t.calls[0].departure)first.departure=first.arrival;first.arrival=Math.min(first.arrival,first.departure);
  if(last.departure!==t.calls.at(-1).departure&&last.arrival===t.calls.at(-1).arrival)last.arrival=last.departure;last.departure=Math.max(last.arrival,last.departure);
  for(const [i,c] of draft.calls.entries()){if(c.arrival>c.departure)return fail(`${name(c.station)}역 출발시각이 도착시각보다 빠릅니다.`);if(i&&c.arrival<=draft.calls[i-1].departure)return fail(`${name(c.station)}역 도착시각이 앞 역(${name(draft.calls[i-1].station)}) 출발시각보다 늦어야 합니다.`);}
  if(JSON.stringify(draft)===JSON.stringify(t)){mmi().alertBox('바뀐 내용이 없습니다.');return;}
  if(apply(m=>T().update(m,t.id,draft),'스케줄수정','시각·진로·운휴·등급 수정',t.id))draw();};
 $('offSchDelete').onclick=()=>{const s=sch(),t=train();if(!t)return fail('삭제할 열차를 선택하세요.');
  mmi().confirmBox(`${t.id} 열차를 오프라인 스케줄 ${s.id}에서 삭제하시겠습니까?`,()=>{if(apply(m=>T().remove(m,t.id),'스케줄삭제','열차 삭제',t.id)){trainId='';draw();}});};
 $('offSchCopy').onclick=()=>{const s=sch(),t=train();if(!t)return fail('복사할 열차를 선택하세요.');const id=$('offSchCopyId').value.trim().toUpperCase(),at=parse(s,$('offSchCopyAt').value);
  if(!/^[A-Z][0-9]{3,5}$/.test(id))return fail('새 열차번호를 확인하세요. (예: K1234)');if(!Number.isInteger(at))return fail(`시발 출발시각을 확인하세요. (${s.relative?'±시:분:초':'시:분:초'})`);
  if(apply(m=>T().copy(m,t.id,id,at),'스케줄생성',`${t.id} 복사`,id)){trainId=id;draw();}};
 $('offSchCreate').onclick=()=>{const s=sch();if(!s)return fail('오프라인 스케줄ID를 선택하세요.');const id=$('offSchNewId').value.trim().toUpperCase(),at=parse(s,$('offSchNewAt').value);
  if(!/^[A-Z][0-9]{3,5}$/.test(id))return fail('열차번호를 확인하세요. (예: K1234)');if(!Number.isInteger(at))return fail(`출발시각을 확인하세요. (${s.relative?'±시:분:초':'시:분:초'})`);
  const draft=T().pattern({id,from:$('offSchFrom').value,to:$('offSchTo').value,start:at,kind:$('offSchNewKind').value});if(!draft)return fail('시발역과 종착역을 서로 다르게 선택하세요.');
  if(apply(m=>T().create(m,draft),'스케줄생성',`${name(draft.calls[0].station)}→${name(draft.calls.at(-1).station)} 구간 패턴 생성`,id)){trainId=id;draw();}};
 $('offSchPrintCalls').onclick=()=>{const s=sch(),t=train();if(!t)return fail('경유역을 인쇄할 열차를 선택하세요.');
  printTable(`오프라인 열차스케줄 경유역 · ${s.id} ${t.id}`,['순서','역명','도착시각','출발시각','도착진로','출발진로','운휴'],t.calls.map((c,i)=>[i+1,name(c.station),fmt(s,c.arrival),fmt(s,c.departure),c.arrivalRoute||'',c.departureRoute||'',c.cancelled?'운휴':'']));};
 $('offSchPrint').onclick=()=>{const s=sch();if(!s)return fail('오프라인 스케줄ID를 선택하세요.');
  printTable(`오프라인 열차스케줄 · ${s.id} ${s.name}`,['열차번호','등급','방향','시발역','종착역','시발시각','종착시각'],s.timetable.trains.map(t=>[t.id,t.kind,t.direction==='down'?'하행':'상행',name(t.calls[0].station),name(t.calls.at(-1).station),fmt(s,t.calls[0].departure),fmt(s,t.calls.at(-1).arrival)]));};
 $('offSchClose').onclick=()=>mmi().close('offlineSchedule');
 w.opener=draw;draw();
}

function init(){initId();initSchedule();}
root.SimOffline={init,parse,fmt,master};
})(window);
