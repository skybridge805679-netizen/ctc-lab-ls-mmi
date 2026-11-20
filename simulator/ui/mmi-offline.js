(function(root){
'use strict';
// 오프라인 열차스케줄 (실기1 5장 2절 p.99-115 · 실기3 3장 1절 p.41-44): 스케줄 서버에 있다가 운행일에 CTC 서버로 로딩되는 스케줄.
// 이 시뮬레이터에서는 FTS 라이브러리의 열차 스케줄(lib.schedules)이 오프라인 스케줄이고, [온라인 ID 예약적용]·[오프라인ID 실시간변경]으로
// 온라인에 올린다. 고쳐도 지금 운행(자동진로제어)에는 영향이 없다.
// 스케줄 ID는 다섯 자리: 노선 2자리 + 구분(요일) 1자리(1 평일 · 2 토 · 3 일 · 4 공휴일 · 5 특수일) + 사용자 2자리. 끝이 00이면 마스터 스케줄(삭제 불가).
// 조작 순서는 교재 그대로: 검색조건(노선·구분) → [검색] → 목록 선택 → 편집모드(수정·복사·생성) → [편집적용]. [편집적용] 전에 [닫기]를 누르면 반영되지 않는다.
// 화면 배치는 원본 사진이 없어 교재 그림 설명을 따른 교육용 구성이다.
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
const dayOf=id=>DAYS[id[2]]||'-';
// 상대시각 스케줄(교육 시작 기준)은 「±시:분:초」, 나머지는 운행 시각
const pad=n=>String(n).padStart(2,'0');
const hms=s=>`${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`;
const fmt=(sch,s)=>sch?.relative?(s<0?'-':'+')+hms(Math.abs(s)):T().clock(s);      // 교육 시작 전에 이미 달리던 열차는 「-」
function parse(sch,text){const m=/^([+-])?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(text).trim());if(!m||+m[3]>59||+(m[4]||0)>59||(m[1]&&!sch?.relative))return NaN;const v=+m[2]*3600+ +m[3]*60+ +(m[4]||0);return sch?.relative?(m[1]==='-'?-v:v):v-28800;}
const dur=s=>hms(Math.max(0,s));
const timeHint=sch=>sch?.relative?'±시:분:초':'시:분:초';
// FTS 라이브러리를 고치는 한 곳: 실패하면 되돌린다
function commit(fn){const r=FUI()?.commit(fn);root.SimRemote.poll?.();return r;}
function scratch(sch){return {serviceDate:sch.timetable.serviceDate,trains:structuredClone(sch.timetable.trains),changes:[]};}
const settle=train=>{train.plan=train.calls.map(c=>({...c}));return train;};      // 오프라인 스케줄은 계획 그 자체
const printTable=(title,cols,rows)=>root.SimMMIReports?.printTable(title,cols,rows);
const opts=(list,sel)=>list.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(sel)?'selected':''}>${esc(l)}</option>`).join('');
const fail=msg=>{mmi().alertBox(msg,null,{icon:'error'});return false;};
const radio=n=>doc.querySelector(`input[name="${n}"]:checked`)?.value;
// 검색조건: 노선 · 구분
const condHtml=p=>`<label>노선<select id="${p}Line">${opts([['','전체'],...Object.entries(LINES)].map(([k,v])=>[k,k?k+'-'+v:v]))}</select></label><label>구분<select id="${p}Day">${opts([['','전체'],...Object.entries(DAYS)].map(([k,v])=>[k,k?k+'-'+v:v]))}</select></label><button type="button" class="sched-btn" id="${p}Find">검색</button>`;
const searchList=p=>schedules().filter(s=>(!$(p+'Line').value||s.id.startsWith($(p+'Line').value))&&(!$(p+'Day').value||s.id[2]===$(p+'Day').value));
const COLS={id:s=>esc(s.id)+(master(s.id)?' <small>마스터</small>':''),name:s=>esc(s.name),day:s=>esc(dayOf(s.id)),author:s=>esc(s.author||''),date:s=>esc(s.createdAt||'')};
const idRows=(list,sel,attr,cols=['id','name','day'],empty='검색조건을 고르고 [검색]을 누르세요')=>list.length?list.map(s=>`<tr ${attr}="${esc(s.id)}" class="${s.id===sel?'sel':''}">${cols.map(c=>`<td>${COLS[c](s)}</td>`).join('')}</tr>`).join(''):`<tr class="empty"><td colspan="${cols.length}">${empty}</td></tr>`;
const trainRows=(sch,list,sel,attr)=>list.length?list.map(t=>`<tr ${attr}="${esc(t.id)}" class="${t.id===sel?'sel':''}"><td>${esc(t.id)}</td><td>${esc(t.kind)}</td><td>${esc(name(t.calls[0].station))}</td><td>${esc(name(t.calls.at(-1).station))}</td><td>${fmt(sch,t.calls[0].departure)}</td><td>${fmt(sch,t.calls.at(-1).arrival)}</td></tr>`).join(''):'<tr class="empty"><td colspan="6">열차가 없습니다</td></tr>';
const TRAIN_HEAD='<tr><th>열차번호</th><th>등급</th><th>시발역</th><th>종착역</th><th>시발시간</th><th>종착시간</th></tr>';

// ------------------------------------------------------------ 오프라인 열차스케줄ID관리
let idSel='',idShown=null;
function initId(){
 const draw=()=>{
  if(idSel&&!find(idSel))idSel='';
  $('offIdRows').innerHTML=idRows((idShown||[]).map(find).filter(Boolean),idSel,'data-off-id',['id','name','day','author','date']);
  const sel=find(idSel),m=radio('offIdMode');
  $('offIdPickedId').value=sel?.id||'';
  $('offIdName').disabled=m!=='edit';for(const el of $('offIdNewBox').querySelectorAll('input,select'))el.disabled=m==='edit';
  $('offIdNewCap').textContent=m==='copy'?`복사할 원본: ${sel?sel.id+' · '+sel.name:'(목록에서 선택)'}`:m==='create'?'빈 스케줄ID를 새로 만듭니다':'';
 };
 const w=mmi().createWindow('offlineId',{title:'오프라인 열차스케줄ID관리',x:70,y:40,width:1040,body:`<div class="rpt off-id">
<div class="sys-two"><div><fieldset class="rpt-cond"><legend>검색조건</legend>${condHtml('offId')}</fieldset>
<div class="idm-cap">오프라인 스케줄ID 목록</div><div class="idm-table rpt-table"><table><thead><tr><th>스케줄ID</th><th>스케줄명</th><th>구분</th><th>작성자</th><th>작성일</th></tr></thead><tbody id="offIdRows"></tbody></table></div></div>
<div><fieldset class="rpt-cond"><legend>열차스케줄 ID 편집모드</legend><label><input type="radio" name="offIdMode" value="edit" checked>수정</label><label><input type="radio" name="offIdMode" value="copy">복사</label><label><input type="radio" name="offIdMode" value="create">생성</label></fieldset>
<fieldset class="rpt-cond"><legend>선택된 스케줄</legend><label>스케줄ID<input id="offIdPickedId" readonly size="6"></label><label>스케줄명<input id="offIdName" size="22"></label></fieldset>
<fieldset class="rpt-cond" id="offIdNewBox"><legend>열차스케줄ID 생성 및 복사 조건</legend><label>노선<select id="offIdLine2"><option value="01">01-경부선</option></select></label><label>구분<select id="offIdDay2">${opts(Object.entries(DAYS).map(([k,v])=>[k,k+'-'+v]))}</select></label><label>번호<input id="offIdNo" maxlength="2" size="3" placeholder="00~99"></label><label>스케줄명<input id="offIdNewName" size="18"></label><small id="offIdNewCap" class="idm-note"></small></fieldset>
<div class="idm-note">스케줄ID = 노선 2자리 + 구분(요일) 1자리 + 번호 2자리. 번호 00은 마스터 스케줄로 삭제할 수 없습니다(해당일에 지정된 스케줄이 없으면 마스터를 로딩). 상황·문제가 쓰는 ID도 삭제할 수 없습니다. [편집적용] 전에 [닫기]를 누르면 반영되지 않습니다.</div></div></div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="offIdCopyOpen">열차스케줄 ID간 열차복사</button><button type="button" class="sched-btn danger" id="offIdDelete">열차스케줄 ID 삭제</button><button type="button" class="sched-btn primary" id="offIdApply">편집적용</button><button type="button" class="sched-btn" id="offIdClose">닫기</button></div></div>`});
 $('offIdFind').onclick=()=>{idShown=searchList('offId').map(s=>s.id);draw();};
 $('offIdRows').onclick=e=>{const r=e.target.closest('[data-off-id]');if(r){idSel=r.dataset.offId;$('offIdName').value=find(idSel)?.name||'';draw();}};
 for(const r of doc.querySelectorAll('input[name="offIdMode"]'))r.onchange=draw;
 $('offIdApply').onclick=()=>{
  const m=radio('offIdMode'),sel=find(idSel);
  if(m==='edit'){if(!sel)return fail('수정할 스케줄ID를 목록에서 선택하세요.');const nm=$('offIdName').value.trim();if(!nm)return fail('스케줄명을 입력하세요.');if(nm===sel.name)return fail('바뀐 내용이 없습니다.');
   if(commit(l=>{const x=l.schedules.find(y=>y.id===sel.id);x.name=nm;delete x.builtin;}))record('ID수정',sel.id,`스케줄명 → ${nm}`);draw();return;}
  const no=$('offIdNo').value.trim();if(!/^\d{2}$/.test(no))return fail('번호는 숫자 두 자리로 입력하세요.');
  const id=$('offIdLine2').value+$('offIdDay2').value+no;if(find(id))return fail(`${id}는 이미 있는 스케줄ID입니다.`);
  if(m==='copy'&&!sel)return fail('복사할 스케줄ID를 목록에서 선택하세요.');
  const date=root.SimDiagram?.getModel?.().serviceDate||new Date().toISOString().slice(0,10),nm=$('offIdNewName').value.trim()||(m==='copy'?sel.name+' 복사':'스케줄_'+id);
  if(!commit(l=>{l.schedules.push({id,name:nm,section:sel?.section||'지하청량리-수원',author:'MMI-1',createdAt:stamp(),...(m==='copy'&&sel.relative?{relative:true}:{}),timetable:m==='copy'?structuredClone({serviceDate:sel.timetable.serviceDate,trains:sel.timetable.trains}):{serviceDate:date,trains:[]}});}))return;
  record('ID생성',id,m==='copy'?`${nm} (${sel.id}에서 ID 복사 · 열차 ${sel.timetable.trains.length}개)`:nm);
  idSel=id;if(idShown&&!idShown.includes(id))idShown.push(id);if(!idShown)idShown=[id];$('offIdName').value=nm;$('offIdNo').value='';$('offIdNewName').value='';draw();
 };
 $('offIdDelete').onclick=()=>{const s=find(idSel);if(!s)return fail('삭제할 스케줄ID를 목록에서 선택하세요.');
  if(master(s.id))return fail(`${s.id}는 마스터 스케줄(끝 두 자리 00)이라 삭제할 수 없습니다.`);
  const used=usedBy(s.id);if(used.length)return fail('상황·문제에서 사용 중인 스케줄입니다: '+used.map(x=>x.name).join(', '));
  mmi().confirmBox(`${s.id} (${s.name}) 오프라인 열차스케줄 ID를 삭제하시겠습니까?`,()=>{const id=s.id;if(commit(l=>{l.schedules=l.schedules.filter(x=>x.id!==id);}))record('ID삭제',id,s.name);idSel='';draw();});};
 $('offIdCopyOpen').onclick=()=>openIdCopy();
 $('offIdClose').onclick=()=>mmi().close('offlineId');
 w.opener=()=>{idShown=null;idSel='';$('offIdName').value='';draw();};draw();
}

// ------------------------------------------------------------ 열차스케줄 ID간 열차복사 (원본 → 대상, [>>]·[<<], [편집적용])
const cp={src:'',dst:'',srcShown:null,dstShown:null,train:'',dstTrain:'',draft:null,added:[],removed:[]};
function initIdCopy(){
 const side=(p,label)=>`<fieldset class="rpt-cond"><legend>오프라인 열차스케줄ID (${label})</legend>${condHtml(p)}</fieldset><div class="idm-cap">오프라인 스케줄ID 목록 (${label})</div><div class="idm-table rpt-table off-short"><table><thead><tr><th>스케줄ID</th><th>스케줄명</th><th>구분</th></tr></thead><tbody id="${p}Ids"></tbody></table></div><div class="idm-cap">열차번호 목록 (${label})</div><div class="idm-table rpt-table off-short"><table><thead>${TRAIN_HEAD}</thead><tbody id="${p}Trains"></tbody></table></div>`;
 mmi().createWindow('offlineIdCopy',{title:'열차스케줄 ID간 열차복사',x:110,y:50,width:1160,body:`<div class="rpt"><div class="off-copy"><div>${side('offCpS','원본')}</div>
<div class="off-copy-mid"><fieldset class="rpt-cond"><legend>복사될 열차스케줄 정보</legend><label>열차번호<input id="offCpNo" size="8" placeholder="K1234"></label><label>출발시간<input id="offCpAt" size="10"></label></fieldset><button type="button" class="sched-btn primary" id="offCpAdd" title="원본 열차를 대상에 복사">&gt;&gt;</button><button type="button" class="sched-btn" id="offCpDel" title="대상에서 선택한 열차를 삭제">&lt;&lt;</button></div>
<div>${side('offCpD','대상')}</div></div><div class="idm-note" id="offCpNote"></div>
<div class="idm-buttons"><button type="button" class="sched-btn primary" id="offCpApply">편집적용</button><button type="button" class="sched-btn" id="offCpClose">닫기</button></div></div>`});
 $('offCpSFind').onclick=()=>{cp.srcShown=searchList('offCpS').map(s=>s.id);drawIdCopy();};
 $('offCpDFind').onclick=()=>{cp.dstShown=searchList('offCpD').map(s=>s.id);drawIdCopy();};
 $('offCpSIds').onclick=e=>{const r=e.target.closest('[data-cps]');if(r){cp.src=r.dataset.cps;cp.train='';drawIdCopy();}};
 $('offCpDIds').onclick=e=>{const r=e.target.closest('[data-cpd]');if(!r)return;if(cp.added.length||cp.removed.length){fail('대상을 바꾸기 전에 [편집적용]으로 저장하거나 [닫기]로 취소하세요.');return;}cp.dst=r.dataset.cpd;cp.draft=structuredClone(find(cp.dst).timetable.trains);cp.dstTrain='';drawIdCopy();};
 $('offCpSTrains').onclick=e=>{const r=e.target.closest('[data-cpst]');if(!r)return;cp.train=r.dataset.cpst;const s=find(cp.src),d=find(cp.dst)||s,t=s.timetable.trains.find(x=>x.id===cp.train);
  $('offCpNo').value=t.id;$('offCpAt').value=fmt(d,convert(s,d,t.calls[0].departure));drawIdCopy();};
 $('offCpDTrains').onclick=e=>{const r=e.target.closest('[data-cpdt]');if(r){cp.dstTrain=r.dataset.cpdt;drawIdCopy();}};
 $('offCpAdd').onclick=()=>{const s=find(cp.src),d=find(cp.dst);if(!s||!cp.train)return fail('원본 스케줄ID와 복사할 열차번호를 선택하세요.');if(!d||!cp.draft)return fail('대상 스케줄ID를 선택하세요.');
  const id=$('offCpNo').value.trim().toUpperCase(),at=parse(d,$('offCpAt').value);if(!/^[A-Z][0-9]{3,5}$/.test(id))return fail('복사될 열차번호를 확인하세요. (예: K1234)');if(!Number.isInteger(at))return fail(`출발시간을 확인하세요. (${timeHint(d)})`);
  if(cp.draft.some(t=>t.id===id))return fail(`대상 ${d.id}에 같은 열차번호 ${id}가 있습니다.`);
  const m={serviceDate:d.timetable.serviceDate,trains:[structuredClone(s.timetable.trains.find(t=>t.id===cp.train))],changes:[]},r=T().copy(m,cp.train,id,at);if(!r.ok)return fail(r.message);
  cp.draft.push(settle(m.trains.find(t=>t.id===id)));cp.added.push(id);cp.removed=cp.removed.filter(x=>x!==id);cp.dstTrain=id;drawIdCopy();};
 $('offCpDel').onclick=()=>{if(!cp.draft||!cp.dstTrain)return fail('열차번호 목록(대상)에서 삭제할 열차번호를 선택하세요.');const id=cp.dstTrain;cp.draft=cp.draft.filter(t=>t.id!==id);
  if(cp.added.includes(id))cp.added=cp.added.filter(x=>x!==id);else cp.removed.push(id);cp.dstTrain='';drawIdCopy();};
 $('offCpApply').onclick=()=>{const d=find(cp.dst);if(!d||(!cp.added.length&&!cp.removed.length))return fail('복사하거나 삭제한 열차가 없습니다.');const trains=cp.draft,added=cp.added,removed=cp.removed;
  if(!commit(l=>{const x=l.schedules.find(y=>y.id===d.id);x.timetable.trains=trains;delete x.builtin;}))return;
  for(const id of added)record('스케줄생성',d.id,`${cp.src}에서 ID간 열차복사`,id);for(const id of removed)record('스케줄삭제',d.id,'ID간 열차복사 화면에서 삭제',id);
  cp.added=[];cp.removed=[];cp.draft=structuredClone(find(d.id).timetable.trains);drawIdCopy();mmi().alertBox(`${d.id}에 저장했습니다. (복사 ${added.length} · 삭제 ${removed.length})`);};
 $('offCpClose').onclick=()=>mmi().close('offlineIdCopy');
}
// 원본·대상의 시각 기준이 다르면(상대시각 ↔ 운행시각) 지금 시각으로 바꿔 보여 준다
function convert(s,d,v){if(!!s.relative===!!d.relative)return v;const now=Math.round(root.SimDiagram?.clock?.()??0);return s.relative?v+now:v-now;}
function drawIdCopy(){
 const s=find(cp.src),d=find(cp.dst);
 $('offCpSIds').innerHTML=idRows((cp.srcShown||[]).map(find).filter(Boolean),cp.src,'data-cps');
 $('offCpDIds').innerHTML=idRows((cp.dstShown||[]).map(find).filter(Boolean),cp.dst,'data-cpd');
 $('offCpSTrains').innerHTML=s?trainRows(s,s.timetable.trains,cp.train,'data-cpst'):trainRows(null,[],'','');
 $('offCpDTrains').innerHTML=d&&cp.draft?trainRows(d,cp.draft,cp.dstTrain,'data-cpdt'):trainRows(null,[],'','');
 $('offCpNote').textContent=(cp.added.length||cp.removed.length)?`저장 전: 복사 ${cp.added.length} · 삭제 ${cp.removed.length}. [편집적용]을 눌러야 저장됩니다.`:'원본 열차를 고르고 복사될 열차번호·출발시간을 넣은 뒤 [>>]. 잘못 복사한 열차는 대상에서 골라 [<<]. [편집적용]을 눌러야 저장되며, 그 전에 [닫기]를 누르면 복사되지 않습니다.';
}
function openIdCopy(){Object.assign(cp,{src:idSel||'',dst:'',srcShown:idSel?[idSel]:null,dstShown:null,train:'',dstTrain:'',draft:null,added:[],removed:[]});mmi().open('offlineIdCopy');$('offCpNo').value='';$('offCpAt').value='';drawIdCopy();}

// ------------------------------------------------------------ 오프라인 열차스케줄관리
let schId='',schShown=null,trainId='';
function initSchedule(){
 const draw=()=>{
  if(schId&&!find(schId))schId='';
  $('offSchIds').innerHTML=idRows((schShown||[]).map(find).filter(Boolean),schId,'data-off-sch');
  const s=find(schId),kind=$('offSchKindFilter').value,list=(s?.timetable.trains||[]).filter(t=>!kind||t.kind===kind);if(trainId&&!list.some(t=>t.id===trainId))trainId='';
  $('offSchUp').innerHTML=trainRows(s,list.filter(t=>t.direction==='up'),trainId,'data-off-train');
  $('offSchDown').innerHTML=trainRows(s,list.filter(t=>t.direction==='down'),trainId,'data-off-train');
  $('offSchCap').textContent=s?`${s.id} · ${s.name}${s.relative?' (교육 시작 기준 상대시각)':''}`:'스케줄ID를 고르면 열차정보가 표시됩니다';
 };
 mmi().createWindow('offlineSchedule',{title:'오프라인 열차스케줄관리',x:90,y:30,width:1140,body:`<div class="rpt">
<div class="off-sch"><div><fieldset class="rpt-cond"><legend>검색조건</legend>${condHtml('offSch')}</fieldset><div class="idm-cap">오프라인 스케줄ID 목록</div><div class="idm-table rpt-table"><table><thead><tr><th>스케줄ID</th><th>스케줄명</th><th>구분</th></tr></thead><tbody id="offSchIds"></tbody></table></div>
<label class="idm-row">열차종별<select id="offSchKindFilter">${opts([['','전체'],...T().KINDS.map(k=>[k,k])])}</select></label></div>
<div><div class="idm-cap" id="offSchCap"></div><fieldset class="rpt-cond off-group"><legend>상행열차정보</legend><div class="idm-table rpt-table off-short"><table><thead>${TRAIN_HEAD}</thead><tbody id="offSchUp"></tbody></table></div></fieldset>
<fieldset class="rpt-cond off-group"><legend>하행열차정보</legend><div class="idm-table rpt-table off-short"><table><thead>${TRAIN_HEAD}</thead><tbody id="offSchDown"></tbody></table></div></fieldset></div></div>
<div class="idm-note">오프라인 스케줄은 운행일 전(모레 이후) 계획을 고치는 곳이라 지금 운행에는 영향이 없습니다. 열차를 고르고 [열차스케줄 편집]에서 수정·복사·생성합니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn primary" id="offSchEdit">열차스케줄 편집</button><button type="button" class="sched-btn danger" id="offSchDelete">열차스케줄 삭제</button><button type="button" class="sched-btn" id="offSchPrint">열차스케줄 인쇄</button><button type="button" class="sched-btn" id="offSchClose">닫기</button></div></div>`}).opener=()=>{schShown=null;schId='';trainId='';draw();};
 $('offSchFind').onclick=()=>{schShown=searchList('offSch').map(s=>s.id);draw();};
 $('offSchIds').onclick=e=>{const r=e.target.closest('[data-off-sch]');if(r){schId=r.dataset.offSch;trainId='';draw();}};
 $('offSchKindFilter').onchange=draw;
 for(const id of ['offSchUp','offSchDown'])$(id).onclick=e=>{const r=e.target.closest('[data-off-train]');if(r){trainId=r.dataset.offTrain;draw();}};
 $('offSchEdit').onclick=()=>{const s=find(schId);if(!s)return fail('오프라인 스케줄ID를 목록에서 선택하세요.');openEdit(s.id,trainId);};
 // 교재: 열차를 선택한 뒤 [열차스케줄 삭제]를 누르면 선택된 열차가 삭제된다
 $('offSchDelete').onclick=()=>{const s=find(schId);if(!s||!trainId)return fail('삭제할 열차를 상행·하행 열차정보에서 선택하세요.');const id=trainId,m=scratch(s),r=T().remove(m,id);if(!r.ok)return fail(r.message);
  if(commit(l=>{const x=l.schedules.find(y=>y.id===s.id);x.timetable.trains=m.trains;delete x.builtin;})){record('스케줄삭제',s.id,'열차 삭제',id);trainId='';}draw();};
 $('offSchPrint').onclick=()=>{const s=find(schId);if(!s)return fail('인쇄할 오프라인 스케줄ID를 선택하세요.');
  printTable(`오프라인 열차스케줄 · ${s.id} ${s.name}`,['열차번호','등급','방향','시발역','종착역','시발시간','종착시간'],s.timetable.trains.map(t=>[t.id,t.kind,t.direction==='down'?'하행':'상행',name(t.calls[0].station),name(t.calls.at(-1).station),fmt(s,t.calls[0].departure),fmt(s,t.calls.at(-1).arrival)]));};
 $('offSchClose').onclick=()=>mmi().close('offlineSchedule');
 api.refreshSchedule=draw;
}

// ------------------------------------------------------------ 오프라인 열차스케줄 편집 (편집모드 수정·복사·생성, [열차운행패턴선택], 연동·개별, [인쇄], [편집적용])
const ed={id:'',train:'',draft:null};
function initEdit(){
 mmi().createWindow('offlineEdit',{title:'오프라인 열차스케줄 편집',x:130,y:60,width:1080,body:`<div class="rpt">
<div class="off-edit-top"><fieldset class="rpt-cond"><legend>열차스케줄 편집모드</legend><label><input type="radio" name="offEdMode" value="edit" checked>수정</label><label><input type="radio" name="offEdMode" value="copy">복사</label><label><input type="radio" name="offEdMode" value="create">생성</label><button type="button" class="sched-btn" id="offEdPattern">열차운행패턴선택</button></fieldset>
<fieldset class="rpt-cond"><legend>열차수정정보</legend><label>열차번호<input id="offEdNo" size="8"></label><label>연계열차<input id="offEdRelated" size="8"></label><label>차량수<input id="offEdCars" type="number" min="1" max="20" style="width:4.5em"></label><label>열차등급<select id="offEdKind">${opts(T().KINDS.map(k=>[k,k]))}</select></label><label>시작시간<input id="offEdStart" size="10"></label></fieldset>
<fieldset class="rpt-cond"><legend>수정타입</legend><label><input type="radio" name="offEdType" value="linked" checked>연동설정</label><label><input type="radio" name="offEdType" value="single">개별설정</label></fieldset></div>
<div class="idm-cap" id="offEdCap"></div><div class="idm-table rpt-table"><table><thead><tr><th>순서</th><th>역명</th><th>도착시간</th><th>정차시간</th><th>출발시간</th><th>도착진로</th><th>출발진로</th><th>운휴</th></tr></thead><tbody id="offEdCalls"></tbody></table></div>
<div class="idm-note" id="offEdNote"></div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="offEdPrint">인쇄</button><button type="button" class="sched-btn primary" id="offEdApply">편집적용</button><button type="button" class="sched-btn" id="offEdClose">닫기</button></div></div>`});
 for(const r of doc.querySelectorAll('input[name="offEdMode"]'))r.onchange=()=>loadEdit(r.value);
 $('offEdPattern').onclick=()=>{const s=find(ed.id);root.SimScheduleDialogs.openPatternLoad({onPick:({pattern,from,to})=>{
  const start=parse(s,$('offEdStart').value);if(!Number.isInteger(start)){fail(`패턴을 적용할 시작시간을 먼저 입력하세요. (${timeHint(s)})`);return;}
  const calls=root.SimPatterns.apply(pattern,{from,to,start});if(!calls){fail('시작시간과 패턴 구간을 확인하세요.');return;}
  const old=ed.draft;ed.draft={id:radio('offEdMode')==='edit'&&old?old.id:$('offEdNo').value.trim().toUpperCase(),direction:N.catalog[to].order>N.catalog[from].order?'down':'up',kind:pattern.kind||$('offEdKind').value,service:old?.service||'정기',flags:old?.flags||[],carCount:Number($('offEdCars').value)||10,relatedTrain:$('offEdRelated').value.trim().toUpperCase(),boardingHeight:old?.boardingHeight||'unknown',cancelled:false,calls};
  if(T().KINDS.includes(ed.draft.kind))$('offEdKind').value=ed.draft.kind;drawEdit();$('offEdNote').textContent=`${pattern.name} 패턴을 적용했습니다. 시각·진로를 확인한 뒤 [편집적용]을 누르세요.`;}});};
 $('offEdCalls').onchange=e=>{const el=e.target.closest('[data-ed-row]');if(!el||!ed.draft)return;const s=find(ed.id),i=+el.dataset.edRow,f=el.dataset.edField,c=ed.draft.calls[i];
  if(f==='cancelled'){c.cancelled=el.checked;return;}if(f.endsWith('Route')){c[f]=el.value;return;}
  const v=f==='dwell'?(()=>{const m=/^(\d{1,2}):(\d{2}):(\d{2})$/.exec(el.value.trim());return m?+m[1]*3600+ +m[2]*60+ +m[3]:NaN;})():parse(s,el.value);
  if(!Number.isFinite(v)){fail(`${name(c.station)}역 ${f==='dwell'?'정차시간(시:분:초)':f==='arrival'?'도착시간':'출발시간'}을 확인하세요.${f==='dwell'?'':` (${timeHint(s)})`}`);drawEdit();return;}
  const key=f==='dwell'?'departure':f,next=f==='dwell'?c.arrival+v:v,delta=next-c[key];
  // 연동설정: 그 역부터 뒤 역 시각이 함께 밀린다 · 개별설정: 그 칸만 (실기1 p.105)
  if(radio('offEdType')==='linked'){for(let k=i;k<ed.draft.calls.length;k++){const x=ed.draft.calls[k];if(k>i||key==='arrival')x.arrival+=delta;x.departure+=delta;}}else c[key]=next;
  drawEdit();};
 $('offEdPrint').onclick=()=>{const s=find(ed.id),t=ed.draft;if(!t)return fail('인쇄할 열차 스케줄이 없습니다.');
  printTable(`오프라인 열차스케줄 경유역 · ${s.id} ${t.id||$('offEdNo').value}`,['순서','역명','도착시간','정차시간','출발시간','도착진로','출발진로','운휴'],t.calls.map((c,i)=>[i+1,name(c.station),fmt(s,c.arrival),dur(c.departure-c.arrival),fmt(s,c.departure),c.arrivalRoute||'',c.departureRoute||'',c.cancelled?'운휴':'']));};
 $('offEdApply').onclick=applyEdit;
 $('offEdClose').onclick=()=>mmi().close('offlineEdit');
}
function routeSel(c,kind,i){const key=kind==='arrival'?'arrivalRoute':'departureRoute',list=SR()?.options(c.station,kind)||[],cur=c[key]||'';if(!list.length&&!cur)return '';
 return `<select data-ed-row="${i}" data-ed-field="${key}" aria-label="${esc(name(c.station))} ${kind==='arrival'?'도착':'출발'}진로"><option value=""></option>${[...new Set([cur,...list].filter(Boolean))].map(r=>`<option ${r===cur?'selected':''}>${esc(r)}</option>`).join('')}</select>`;}
function drawEdit(){
 const s=find(ed.id),t=ed.draft,m=radio('offEdMode');
 $('offEdCap').textContent=`경유역 정보 · ${s?.id||''}${t?.id&&m==='edit'?' · '+t.id:''}`;
 $('offEdCalls').innerHTML=t?t.calls.map((c,i)=>`<tr><td>${i+1}</td><td>${esc(name(c.station))}</td><td><input data-ed-row="${i}" data-ed-field="arrival" value="${fmt(s,c.arrival)}" size="9" aria-label="${esc(name(c.station))} 도착시간"></td><td><input data-ed-row="${i}" data-ed-field="dwell" value="${dur(c.departure-c.arrival)}" size="8" aria-label="${esc(name(c.station))} 정차시간"></td><td><input data-ed-row="${i}" data-ed-field="departure" value="${fmt(s,c.departure)}" size="9" aria-label="${esc(name(c.station))} 출발시간"></td><td>${i?routeSel(c,'arrival',i):''}</td><td>${routeSel(c,'departure',i)}</td><td><input type="checkbox" data-ed-row="${i}" data-ed-field="cancelled" ${c.cancelled?'checked':''} aria-label="${esc(name(c.station))} 운휴"></td></tr>`).join(''):`<tr class="empty"><td colspan="8">${m==='create'?'시작시간을 넣고 [열차운행패턴선택]으로 패턴을 적용하세요':'열차스케줄관리에서 열차를 선택하세요'}</td></tr>`;
}
function loadEdit(m){
 const s=find(ed.id),src=s?.timetable.trains.find(t=>t.id===ed.train);
 for(const r of doc.querySelectorAll('input[name="offEdMode"]'))r.checked=r.value===m;
 ed.draft=m==='create'?null:src?structuredClone(src):null;
 $('offEdNo').value=m==='edit'?src?.id||'':'';$('offEdNo').readOnly=m==='edit';
 $('offEdRelated').value=src&&m==='edit'?src.relatedTrain||'':'';$('offEdCars').value=src?.carCount??10;$('offEdKind').value=src?.kind||'전동열차';
 $('offEdStart').value=m==='create'?'':src?fmt(s,src.calls[0].departure):'';$('offEdStart').disabled=m==='edit';
 $('offEdPattern').disabled=m==='copy';
 $('offEdNote').textContent=m==='edit'?'열차번호·운행방향·시발/종착역은 바꿀 수 없습니다. 경유역 정보를 고친 뒤 [편집적용]을 누르세요.':m==='copy'?'새 열차번호·연계열차·차량수를 넣고 [편집적용]을 누르세요. 시작시간을 바꾸면 전체 시각이 함께 옮겨집니다.':'시작시간을 넣고 [열차운행패턴선택]으로 패턴을 적용한 뒤 열차번호를 넣고 [편집적용]을 누르세요.';
 drawEdit();
}
function openEdit(id,train){ed.id=id;ed.train=train||'';mmi().open('offlineEdit');loadEdit(train?'edit':'create');}
function applyEdit(){
 const s=find(ed.id),m=radio('offEdMode'),src=s?.timetable.trains.find(t=>t.id===ed.train);if(!s)return fail('오프라인 스케줄ID가 없습니다.');
 if(!ed.draft)return fail(m==='create'?'[열차운행패턴선택]으로 패턴을 먼저 적용하세요.':'수정할 열차를 열차스케줄관리에서 선택하세요.');
 if(m!=='create'&&!src)return fail('원래 열차를 찾을 수 없습니다. 열차스케줄관리에서 다시 선택하세요.');
 const id=(m==='edit'?src.id:$('offEdNo').value).trim().toUpperCase(),rel=$('offEdRelated').value.trim().toUpperCase(),cars=Number($('offEdCars').value);
 if(!/^[A-Z][0-9]{3,5}$/.test(id))return fail('열차번호를 확인하세요. (예: K1234)');if(rel&&!/^[A-Z][0-9]{3,5}$/.test(rel))return fail('연계열차 번호를 확인하세요.');if(rel===id)return fail('연계열차는 자기 열차번호와 달라야 합니다.');
 if(!Number.isInteger(cars)||cars<1||cars>20)return fail('차량수는 1~20량입니다.');
 if(m!=='edit'&&s.timetable.trains.some(t=>t.id===id))return fail(`${s.id}에 같은 열차번호 ${id}가 있습니다.`);
 const draft=structuredClone(ed.draft);Object.assign(draft,{id,relatedTrain:rel,carCount:cars,kind:$('offEdKind').value});
 if(m==='copy'){const at=parse(s,$('offEdStart').value);if(!Number.isInteger(at))return fail(`시작시간을 확인하세요. (${timeHint(s)})`);const delta=at-draft.calls[0].departure;for(const c of draft.calls){c.arrival+=delta;c.departure+=delta;}}
 const first=draft.calls[0],last=draft.calls.at(-1);first.arrival=Math.min(first.arrival,first.departure);last.departure=Math.max(last.arrival,last.departure);
 for(const [i,c] of draft.calls.entries()){if(c.arrival>c.departure)return fail(`${name(c.station)}역 출발시간이 도착시간보다 빠릅니다.`);if(i&&c.arrival<=draft.calls[i-1].departure)return fail(`${name(c.station)}역 도착시간이 앞 역(${name(draft.calls[i-1].station)}) 출발시간보다 늦어야 합니다.`);}
 draft.cancelled=draft.calls.every(c=>c.cancelled);delete draft.plan;
 if(m==='edit'){const was=structuredClone(src);delete was.plan;if(JSON.stringify(draft)===JSON.stringify(was))return fail('바뀐 내용이 없습니다.');}
 // 수정 모드에서 [열차운행패턴선택]으로 경유역 구성이 바뀌면 그 열차를 새 패턴으로 다시 만든다 (같은 열차번호)
 const sm=scratch(s),rebuilt=m==='edit'&&(draft.calls.length!==src.calls.length||draft.calls.some((c,i)=>c.station!==src.calls[i].station));
 let r;if(m==='edit'&&!rebuilt)r=T().update(sm,src.id,draft);else{if(rebuilt)T().remove(sm,src.id);r=T().create(sm,draft);}if(!r.ok)return fail(r.message);
 const trains=sm.trains.map(t=>t.id===id?settle(t):t);
 if(!commit(l=>{const x=l.schedules.find(y=>y.id===s.id);x.timetable.trains=trains;delete x.builtin;}))return;
 record(m==='edit'?'스케줄수정':'스케줄생성',s.id,m==='edit'?'경유역 시각·진로·운휴·열차정보 수정':m==='copy'?`${src.id} 복사`:'열차운행패턴으로 생성',id);
 ed.train=id;api.refreshSchedule?.();loadEdit('edit');mmi().alertBox(`${id} 열차를 오프라인 스케줄 ${s.id}에 ${m==='edit'?'수정':'저장'}했습니다.`);
}

function init(){initId();initIdCopy();initSchedule();initEdit();}
const api={init,parse,fmt,master,openEdit,refreshSchedule:null};
root.SimOffline=api;
})(window);
