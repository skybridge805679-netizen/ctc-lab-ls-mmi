(function(root){
'use strict';
// Windows added from the real-MMI photos of 2026-10-22: [CA028_01] 온라인열차스케줄ID관리, [CA018_05] 진입예고열차정리,
// [CF003_1] 열차위치추적, and the 시스템 조회 lists. Window layouts follow the photos; the behaviour behind them is the
// simulator's own (the original screens were only photographed, never operated). Sample IDs/names are invented teaching data.
const doc=document,$=id=>doc.getElementById(id),N=root.SimNetwork,T=root.SimTimetable;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const model=()=>root.SimDiagram.getModel(),mmi=()=>root.SimMMI;
let host=null;
const clock=()=>host?.context().state.clock??0;
const ymd=d=>d.replaceAll('-','');
const SAMPLE_NOTE='교육용 구성 — 원본 화면은 사진으로 확인하지 못해 목록 형식만 임의로 만들었습니다.';
const pad=n=>String(n).padStart(2,'0');
const close=id=>mmi().close(id);

// ---------------------------------------------------------------- [CA028_01] 온라인열차스케줄ID관리
const SCHEDULES=[{id:'01001',name:'교육용 기본 시각표'},{id:'01002',name:'교육용 지연 연습'},{id:'01999',name:'시험용 시각표'}];
const assigned=new Map(),picked=new Set();let idmSchedule=null;
const keyOf=(y,m,d)=>`${y}${pad(m)}${pad(d)}`;
function serviceDay(offset=0){const d=new Date(model().serviceDate+'T00:00:00');d.setDate(d.getDate()+offset);return keyOf(d.getFullYear(),d.getMonth()+1,d.getDate());}
function idmRender(){
 const year=Number($('idmYear').value),month=Number($('idmMonth').value),today=serviceDay();
 $('idmCal').innerHTML=Array.from({length:6},(_,i)=>{
  const y=year+Math.floor((month-1+i)/12),m=(month-1+i)%12+1,first=new Date(y,m-1,1).getDay(),days=new Date(y,m,0).getDate();
  const cells=Array.from({length:42},(_,c)=>{const d=c-first+1;if(d<1||d>days)return '<td></td>';const k=keyOf(y,m,d),cls=[assigned.has(k)?'set':'',picked.has(k)?'pick':'',k===today?'today':'',c%7===0?'sun':c%7===6?'sat':''].join(' ');return `<td><button type="button" class="${cls}" data-date="${k}">${d}</button></td>`;});
  const rows=Array.from({length:6},(_,r)=>`<tr>${cells.slice(r*7,r*7+7).join('')}</tr>`).join('');
  return `<table class="idm-month"><caption>${y}년 ${m}월</caption><thead><tr>${'일월화수목금토'.split('').map((n,k)=>`<th class="${k===0?'sun':k===6?'sat':''}">${n}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
 }).join('');
 const rows=[...assigned].sort().map(([k,v])=>`<tr class="${picked.has(k)?'sel':''}" data-date="${k}"><td>${k}</td><td>[${v.id}]${esc(v.name)}</td><td>ORPHEIA</td><td>${k}</td></tr>`).join('');
 $('idmRows').innerHTML=rows||'<tr class="empty"><td colspan="4">예약된 스케줄 ID가 없습니다</td></tr>';
 const day=doc.querySelector('input[name="idmDay"]:checked').value==='tomorrow'?serviceDay(1):today,cur=assigned.get(day);
 $('idmSetId').value=cur?.id??'';$('idmSetName').value=cur?.name??'';
 $('idmList').innerHTML=SCHEDULES.map(s=>`<tr class="${idmSchedule===s.id?'sel':''}" data-sid="${s.id}"><td>${s.id}</td><td>${esc(s.name)}</td></tr>`).join('');
}
function initScheduleId(){
 const now=new Date(model().serviceDate+'T00:00:00');
 assigned.set(serviceDay(),SCHEDULES[0]);
 mmi().createWindow('scheduleId',{title:'[CA028_01] 온라인열차스케줄ID관리',x:80,y:50,width:980,body:`<div class="idm">
<div class="idm-left"><fieldset><legend>운행일 선택</legend><div class="idm-row"><label><input id="idmYear" type="number" min="2020" max="2040" value="${now.getFullYear()}" aria-label="년"></label><select id="idmMonth" aria-label="월">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i===now.getMonth()?'selected':''}>${i+1}월</option>`).join('')}</select></div>
<div class="idm-row">표시정보 <i class="idm-key set"></i>설정 <i class="idm-key"></i>비설정</div><label class="idm-row">노선<select aria-label="노선"><option>경부선</option></select></label></fieldset>
<div class="idm-cap">온라인 열차스케줄 ID 목록</div><div class="idm-table"><table><thead><tr><th>날짜</th><th>스케줄명</th><th>작성자</th><th>작성일</th></tr></thead><tbody id="idmRows"></tbody></table></div></div>
<div class="idm-cal" id="idmCal"></div>
<div class="idm-right"><fieldset><legend>열차스케줄 ID 설정</legend><div class="idm-row">설정일자<label><input type="radio" name="idmDay" value="today" checked>오늘</label><label><input type="radio" name="idmDay" value="tomorrow">내일</label></div>
<label class="idm-row">설정된 스케줄ID<input id="idmSetId" readonly></label><label class="idm-row">설정된 스케줄명<input id="idmSetName" readonly></label>
<div class="idm-search"><div>검색조건</div><label class="idm-row"><input type="checkbox" checked disabled>노선<select aria-label="검색 노선"><option>01-경부선</option></select></label><label class="idm-row"><input type="checkbox" checked disabled>구분<select aria-label="검색 구분"><option>9-응시자</option></select></label><button type="button" class="sched-btn" id="idmSearch">검색</button></div></fieldset>
<div class="idm-cap">열차스케줄 ID 목록</div><div class="idm-table"><table><thead><tr><th>스케줄ID</th><th>스케줄명</th></tr></thead><tbody id="idmList"></tbody></table></div></div>
<div class="idm-note">${esc(SAMPLE_NOTE)} 예약된 ID는 이 창의 달력에만 기록되며 실행 중인 시각표는 바꾸지 않습니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="idmFind">온라인열차스케줄 ID 검색</button><button type="button" class="sched-btn primary" id="idmApply">온라인 ID 예약적용</button><button type="button" class="sched-btn" id="idmOffline">오프라인ID 실시간변경</button><button type="button" class="sched-btn" id="idmClose">닫기</button></div></div>`});
 $('idmYear').onchange=$('idmMonth').onchange=idmRender;
 for(const el of doc.querySelectorAll('input[name="idmDay"]'))el.onchange=idmRender;
 $('idmCal').onclick=e=>{const b=e.target.closest('[data-date]');if(!b)return;const k=b.dataset.date;picked.has(k)?picked.delete(k):picked.add(k);idmRender();};
 $('idmRows').onclick=e=>{const r=e.target.closest('[data-date]');if(!r)return;const k=r.dataset.date;picked.has(k)?picked.delete(k):picked.add(k);idmRender();};
 $('idmList').onclick=e=>{const r=e.target.closest('[data-sid]');if(r){idmSchedule=r.dataset.sid;idmRender();}};
 $('idmSearch').onclick=$('idmFind').onclick=()=>{idmRender();mmi().log('event','온라인 스케줄 ID 목록 조회');};
 $('idmApply').onclick=()=>{
  if(!idmSchedule){mmi().alertBox('예약할 열차스케줄 ID를 목록에서 선택하세요.');return;}
  if(!picked.size){mmi().alertBox('스케줄을 적용할 운행일을 달력에서 선택하세요.');return;}
  const sch=SCHEDULES.find(s=>s.id===idmSchedule),days=[...picked].sort();for(const k of days)assigned.set(k,sch);picked.clear();idmRender();
  mmi().log('event',`온라인 ID 예약적용 [${sch.id}] ${days.join(',')}`);mmi().record('schedule',{type:'idReserve',train:'',text:JSON.stringify({id:sch.id,days}),console:'MMI-1'});mmi().alertBox(`[${sch.id}] ${sch.name} 예약적용 완료 (${days.length}일)`);
 };
 $('idmOffline').onclick=()=>mmi().alertBox('오프라인 ID 실시간변경은 구현하지 않았습니다. 원본 화면을 확인하지 못했습니다.');
 $('idmClose').onclick=()=>close('scheduleId');
 idmRender();
}

// ---------------------------------------------------------------- [CA018_05] 진입예고열차정리
const notices=[]; // {station, signal, train, date}
const controlled=()=>N.stations.filter(s=>s.controlled);
const arrivalSignals=st=>{const C=root.SimCore.forStation(st);return Object.keys(C.signals).filter(id=>C.signals[id].kind==='장내').sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));};
function entRender(rows,caption=''){
 $('entRows').innerHTML=rows.length?rows.map((n,i)=>{const t=model().trains.find(x=>x.id===n.train),call=t?.calls.find(c=>c.station===n.station);
  return `<tr data-i="${notices.indexOf(n)}"><td></td><td>${i+1}</td><td>${esc(n.train)}</td><td>${call?T.clock(call.departure):''}</td><td>${t?esc(N.catalog[t.calls.at(-1).station].name):''}</td><td>${n.date}</td></tr>`;}).join(''):'<tr class="empty"><td colspan="6">표시할 진입예고열차가 없습니다</td></tr>';
 $('entCaption').textContent=caption;
}
function entTrains(){
 const station=$('entStationList').value,dir=doc.querySelector('input[name="entDir"]:checked').value;
 $('entTrains').innerHTML=model().trains.filter(t=>t.direction===dir&&!t.cancelled&&t.calls.some(c=>c.station===station)).map(t=>`<option value="${esc(t.id)}">${esc(t.id)}</option>`).join('');
}
function entSignals(){const station=$('entStationList').value;$('entSig').innerHTML=arrivalSignals(station).map(id=>`<option value="${id}">SG_${esc(id)}</option>`).join('');$('entStationShow').value=station?mmi().stationInfo(station).name:'';}
function entShow(whole){
 const station=$('entStationList').value,signal=$('entSig').value;
 $('entStationOut').value=mmi().stationInfo(station).name;$('entSignalOut').value=whole?'':'SG_'+signal;
 entRender(notices.filter(n=>n.station===station&&(whole||n.signal===signal)),whole?'등록열차검색':'진입예고열차표시');
}
function initEntry(){
 mmi().createWindow('entryNotice',{title:'[CA018_05] 진입예고열차정리',x:120,y:70,width:900,body:`<div class="ent">
<fieldset class="ent-info"><legend>진입예고열차정보</legend><div class="idm-row"><label>역정보<input id="entStationOut" readonly></label><label>신호기<input id="entSignalOut" readonly></label></div>
<div class="idm-table ent-table"><table><thead><tr><th></th><th>순번</th><th>열차번호</th><th>출발시간</th><th>종착역</th><th>날짜</th></tr></thead><tbody id="entRows"></tbody></table></div><div class="idm-row"><button type="button" class="sched-btn" id="entDel">선택열차삭제</button><button type="button" class="sched-btn" id="entDelBefore">선택열차이전삭제</button><span id="entCaption" class="idm-hint"></span></div></fieldset>
<fieldset class="ent-search"><legend>진입예고열차검색</legend><label class="idm-row">신호기<select id="entSig"></select></label><div class="idm-row">날짜<label><input type="radio" name="entDay" value="today" checked>오늘</label><label><input type="radio" name="entDay" value="tomorrow">내일</label></div><label class="idm-row">구간정보<select><option>경부선</option></select></label><div>역정보</div>
<select id="entStationList" size="9" aria-label="역정보">${controlled().map(s=>`<option value="${s.id}">${esc(s.name)} [${s.code}]</option>`).join('')}</select><input id="entStationShow" type="hidden"><button type="button" class="sched-btn" id="entShow">진입예고열차표시</button></fieldset>
<fieldset class="ent-reg"><legend>진입예고열차등록</legend><div class="idm-row">열차선택<label><input type="radio" name="entDir" value="up" checked>상행</label><label><input type="radio" name="entDir" value="down">하행</label></div><div>열차번호</div>
<select id="entTrains" size="10" multiple aria-label="열차번호"></select><div class="idm-row"><button type="button" class="sched-btn" id="entAdd">열차등록</button><button type="button" class="sched-btn" id="entFind">등록열차검색</button></div></fieldset>
<div class="idm-note">${esc(SAMPLE_NOTE)} 신호기 목록은 해당 역의 장내신호기이며, 등록 내용은 이 창에만 저장됩니다.</div><div class="idm-buttons"><button type="button" class="sched-btn" id="entClose">닫기</button></div></div>`});
 $('entStationList').selectedIndex=0;entSignals();entTrains();entShow(false);
 $('entStationList').onchange=()=>{entSignals();entTrains();entShow(false);};$('entSig').onchange=()=>entShow(false);
 for(const el of doc.querySelectorAll('input[name="entDir"]'))el.onchange=entTrains;
 $('entShow').onclick=()=>entShow(false);$('entFind').onclick=()=>entShow(true);
 $('entAdd').onclick=()=>{
  const station=$('entStationList').value,signal=$('entSig').value,picked=[...$('entTrains').selectedOptions].map(o=>o.value);
  if(!picked.length){mmi().alertBox('등록할 열차번호를 선택하세요.');return;}
  const day=new Date(model().serviceDate+'T00:00:00');if(doc.querySelector('input[name="entDay"]:checked').value==='tomorrow')day.setDate(day.getDate()+1);const date=keyOf(day.getFullYear(),day.getMonth()+1,day.getDate());let added=0;
  for(const train of picked)if(!notices.some(n=>n.station===station&&n.signal===signal&&n.train===train)){notices.push({station,signal,train,date});added++;}
  entShow(false);mmi().log('event',`${mmi().stationInfo(station).name}역 SG_${signal} 진입예고열차 ${added}건 등록`);mmi().alertBox(added?`${added}건의 진입예고열차를 등록했습니다.`:'이미 등록된 열차입니다.');
 };
 const selected=()=>{const row=$('entRows').querySelector('tr.sel');return row?Number(row.dataset.i):-1;};
 $('entRows').onclick=e=>{const row=e.target.closest('tr[data-i]');if(!row)return;$('entRows').querySelectorAll('tr.sel').forEach(r=>r.classList.remove('sel'));row.classList.add('sel');};
 $('entDel').onclick=()=>{const i=selected();if(i<0){mmi().alertBox('삭제할 열차를 선택하세요.');return;}const [n]=notices.splice(i,1);entShow(false);mmi().log('event',`진입예고열차 ${n.train} 삭제`);};
 $('entDelBefore').onclick=()=>{
  const i=selected();if(i<0){mmi().alertBox('기준이 되는 열차를 선택하세요.');return;}
  const n=notices[i],station=n.station,list=notices.filter(x=>x.station===station&&x.signal===n.signal),cut=list.indexOf(n);
  if(!cut){mmi().alertBox('선택한 열차 앞에 삭제할 열차가 없습니다.');return;}
  for(const x of list.slice(0,cut))notices.splice(notices.indexOf(x),1);entShow(false);mmi().log('event',`진입예고열차 ${n.train} 이전 ${cut}건 삭제`);
 };
 $('entClose').onclick=()=>close('entryNotice');
}

// ---------------------------------------------------------------- [CF003_1] 열차위치추적
let trackTimer=null,tracking=null;
const running=dir=>model().trains.filter(t=>(dir==='all'||t.direction===dir)&&T.position(t,clock()));
// numbers typed by hand on the LS (열차번호제어) are not in the timetable but can still be traced (실기1 p.51)
function manualStation(number){
 const lsm=root.SimLSUI?.getModel?.();if(!lsm)return null;
 for(const st of controlled())for(const rows of Object.values(lsm.stations[st.id]?.windows||{}))if(rows.some(r=>r.number===number))return st.id;
 return null;
}
function badge(text){
 let el=$('lsTraceBadge');
 if(!el){el=doc.createElement('div');el.id='lsTraceBadge';el.className='ls-trace-badge';el.setAttribute('role','status');($('lsDisplay')||doc.body).appendChild(el);}
 el.hidden=!text;el.textContent=text||'';
}
function nearestControlled(order){return controlled().reduce((best,s)=>Math.abs(s.order-order)<Math.abs(best.order-order)?s:best);}
function traceStep(){
 const train=model().trains.find(t=>t.id===tracking),pos=train&&T.position(train,clock());
 let stationId=pos?nearestControlled(pos.order).id:manualStation(tracking);
 if(!stationId){$('traceMsg').textContent=`>> ${tracking} 열차번호를 LS 화면에서 찾을 수 없어 추적을 종료합니다.`;traceStop();return;}
 if(host.context().station!==stationId)host.selectStation(stationId);
 badge(`▶ 열차추적중 ${tracking}`);
 $('traceMsg').textContent=`>> ${tracking} 추적 중 · ${mmi().stationInfo(stationId).name} LS 화면`;
}
function traceStop(){clearInterval(trackTimer);trackTimer=null;tracking=null;badge('');if($('traceStart')){$('traceStart').disabled=false;$('traceStop').disabled=true;}}
function initTrace(){
 const win=mmi().createWindow('trace',{title:'[CF003_1]열차위치추적',x:200,y:90,width:700,body:`<div class="trc"><div class="trc-left"><div>열차번호</div><label class="idm-row">노선<select aria-label="노선"><option>경부선</option></select></label>
<div class="idm-row"><label><input type="radio" name="traceDir" value="all" checked>전체</label><label><input type="radio" name="traceDir" value="up">상행</label><label><input type="radio" name="traceDir" value="down">하행</label></div>
<button type="button" class="sched-btn" id="traceLoad">열차번호목록</button><label class="idm-row">열차번호<input id="traceInput" maxlength="6" autocomplete="off" placeholder="K1131"></label><select id="traceList" size="12" aria-label="열차번호 목록"></select></div>
<div class="trc-right"><div>LS 화면 선택</div><div class="trc-monitors">${[1,2,3].map(n=>`<button type="button" class="trc-mon" data-mon="${n}" ${n>1?'disabled title="이 실습기에는 LS 화면이 1개뿐입니다"':''} aria-pressed="${n===1}"><span>${n}</span></button>`).join('')}</div></div>
<div class="trc-msg" id="traceMsg" role="status"></div><div class="idm-buttons"><button type="button" class="sched-btn primary" id="traceStart">추적시작</button><button type="button" class="sched-btn" id="traceStop" disabled>추적종료</button><button type="button" class="sched-btn" id="traceClose">닫기</button></div></div>`});
 const load=()=>{const dir=doc.querySelector('input[name="traceDir"]:checked').value,list=running(dir);$('traceList').innerHTML=list.map(t=>`<option value="${esc(t.id)}">${esc(t.id)}</option>`).join('');if(list.length)$('traceList').selectedIndex=0;$('traceInput').value=list[0]?.id??'';$('traceMsg').textContent=`>> 총 [${list.length}]건의 운행열차번호를 수신하였습니다.`;};
 $('traceLoad').onclick=load;$('traceList').onchange=()=>{$('traceInput').value=$('traceList').value;};
 $('traceStart').onclick=()=>{const id=$('traceInput').value.trim().toUpperCase();if(!id){mmi().alertBox('추적할 열차번호를 선택하거나 입력하세요.');return;}if(!model().trains.some(t=>t.id===id)&&!manualStation(id)){mmi().alertBox(`${id} 열차번호를 찾을 수 없습니다.`);return;}tracking=id;$('traceStart').disabled=true;$('traceStop').disabled=false;traceStep();trackTimer=setInterval(traceStep,1000);mmi().log('event',`열차위치추적 시작 · ${id}`);};
 $('traceStop').onclick=()=>{if(tracking)mmi().log('event',`열차위치추적 종료 · ${tracking}`);traceStop();$('traceMsg').textContent='>> 추적을 종료했습니다.';};
 $('traceClose').onclick=()=>{traceStop();close('trace');};
 win.el.querySelector('.mmi-close').addEventListener('click',traceStop);
 for(const el of doc.querySelectorAll('input[name="traceDir"]'))el.onchange=load;
 win.opener=load;
}

// ---------------------------------------------------------------- menu actions (도구모음설정)
function act(name,button){
 const target={logAlarm:'#alarmLogBody',logEvent:'#eventLogBody'}[name];if(!target)return;
 const pane=doc.querySelector(target).closest('.mmi-log'),on=pane.hidden;pane.hidden=!on;button.setAttribute('aria-checked',String(on));
 doc.querySelector('.mmi-logs').classList.toggle('single',[...doc.querySelectorAll('.mmi-log')].filter(p=>!p.hidden).length<2);
}
function init(api){host=api;initScheduleId();initEntry();initTrace();root.SimMMIReports.init(host);}
root.SimMMIWindows={init,act,notices:()=>structuredClone(notices),assigned:()=>[...assigned]};
})(window);
