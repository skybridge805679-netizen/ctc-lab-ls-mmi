(function(root){
'use strict';
// Train schedule dialogs laid out after the photos of the real MMI and T/G (2026-10-30):
// [MA007_01] 열차운행패턴 관리 · [PTN_LOAD] 열차패턴선택 · [TRN_ADD] 온라인 열차 스케줄 추가 · 온라인 열차 스케줄 수정 (계획정보 / 실적정보)
// · [CA028_03] 실적 전송 · 출력 미리보기 (온라인 열차 스케줄 경유역). Field names and column order follow the photos.
const doc=SimDOM.document,N=root.SimNetwork,P=root.SimPatterns,R=root.SimScheduleRoutes;
const T=()=>root.SimTimetable,D=()=>root.SimDiagram,M=()=>root.SimMMI;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KINDS=['KTX','무궁화호','전동열차','화물','일반열차','회송열차'];
const OPERATOR='MMI-1';   // 이 PC의 운영자 (사진의 실제 운영자 ID는 옮기지 않음)
const PATTERN_KEY='orpheia.patterns.v1';
const name=id=>M()?.stationInfo(id)?.name||N.catalog[id]?.name||id;
const code=id=>{const c=M()?.stationInfo(id)?.code;return c&&c!=='—'?c:'';};
const clock=s=>T().clock(s);
const dur=s=>{s=Math.max(0,Math.round(s));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':');};
const parse=v=>{const m=/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(v??'').trim());if(!m||+m[1]>23||+m[2]>59||+(m[3]||0)>59)return NaN;return +m[1]*3600+ +m[2]*60+ +(m[3]||0);};
const atClock=v=>parse(v)-28800;
const dirText=d=>d==='down'?'하행':'상행';
const now=()=>D().clock();
const stamp=()=>new Date().toLocaleString('sv-SE',{timeZone:'Asia/Seoul'});
const alert=(text,done)=>M().alertBox(text,done);
// a table rebuilt from a change handler blurs the edited cell, which fires change again: ignore that echo
let busy=false;const once=fn=>e=>{if(busy)return;busy=true;try{fn(e);}finally{busy=false;}};

// ---------------------------------------------------------------- pattern store (kept on this computer)
let patterns=null;
function patternList(){
 if(patterns)return patterns;
 try{const saved=JSON.parse(localStorage.getItem(PATTERN_KEY)||'null');patterns=Array.isArray(saved)&&saved.length&&saved.every(p=>!P.validate(p))?saved:P.seed();}catch{patterns=P.seed();}
 return patterns;
}
function savePatterns(){try{localStorage.setItem(PATTERN_KEY,JSON.stringify(patterns));}catch{}}

// ---------------------------------------------------------------- windows
const made={};
function make(id,title,body,opts,setup){
 if(!made[id]){made[id]=M().createWindow(id,{title,x:opts.x??120,y:opts.y??40,width:opts.width,body,container:opts.container||null});setup?.(made[id].el);}
 return made[id];
}
function win(...args){make(...args);return M().open(args[0]);}
const q=(id,sel)=>made[id].el.querySelector(sel);
const qa=(id,sel)=>[...made[id].el.querySelectorAll(sel)];
const routeSelect=(station,kind,value,attrs)=>{const list=R?R.options(station,kind):[];const opts=['',...list,...(value&&!list.includes(value)?[value]:[])];return `<select ${attrs}>${opts.map(o=>`<option value="${esc(o)}" ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select>`;};
function badRoute(calls){
 for(const c of calls){
  if(!R.validate(c.station,c.arrivalRoute||'','arrival'))return `${name(c.station)}역에 없는 도착진로입니다: ${c.arrivalRoute}`;
  if(!R.validate(c.station,c.departureRoute||'','departure'))return `${name(c.station)}역에 없는 출발진로입니다: ${c.departureRoute}`;
 }
 return null;
}

// ---------------------------------------------------------------- [MA007_01] 열차운행패턴 관리
const mgr={sel:null,draft:null,isNew:false,filter:{direction:'all',kind:'',name:''}};
function mgrPattern(){return mgr.draft||patternList().find(p=>p.id===mgr.sel)||null;}
function mgrGrid(){
 const p=mgrPattern(),edit=!!mgr.draft;
 const head='<tr><th></th><th>역 코드</th><th>역 이름</th><th>진입 시간</th><th>정차 시간</th><th>진출 시간</th><th>진입 진로</th><th>진출 진로</th><th>방향</th></tr>';
 const stationSel=(value,i)=>`<select data-pm-row="${i}" data-pm-field="station" aria-label="${i+1}번째 역 이름"><option value="">${value?'(행 삭제)':'(역 추가)'}</option>${N.stations.map(s=>`<option value="${s.id}" ${s.id===value?'selected':''}>${esc(name(s.id))}</option>`).join('')}</select>`;
 const time=(c,i,f,v)=>edit?`<input data-pm-row="${i}" data-pm-field="${f}" value="${dur(v)}" maxlength="8" aria-label="${esc(name(c.station))} ${{arrive:'진입',dwell:'정차',depart:'진출'}[f]} 시간">`:dur(v);
 const rows=(p?.calls||[]).map((c,i)=>`<tr><td>${String(i+1).padStart(2,'0')}</td><td>${esc(code(c.station))}</td><td>${edit?stationSel(c.station,i):esc(name(c.station))}</td><td>${time(c,i,'arrive',c.arrive)}</td><td>${time(c,i,'dwell',c.dwell)}</td><td>${time(c,i,'depart',P.depart(c))}</td>
<td>${edit?routeSelect(c.station,'arrival',c.arrivalRoute,`data-pm-row="${i}" data-pm-field="arrivalRoute" aria-label="${esc(name(c.station))} 진입 진로"`):esc(c.arrivalRoute)}</td><td>${edit?routeSelect(c.station,'departure',c.departureRoute,`data-pm-row="${i}" data-pm-field="departureRoute" aria-label="${esc(name(c.station))} 진출 진로"`):esc(c.departureRoute)}</td><td>${p?dirText(p.direction):''}</td></tr>`).join('');
 const add=edit?`<tr class="ptn-new"><td>*</td><td></td><td>${stationSel('',p.calls.length)}</td><td colspan="6"></td></tr>`:'';
 q('pattern','#pmGrid').innerHTML=`<table><thead>${head}</thead><tbody>${rows}${add}</tbody></table>`;
 for(const [f,k] of [['pmReg','registrar'],['pmRegAt','registeredAt'],['pmMod','modifier'],['pmModAt','modifiedAt']])q('pattern','#'+f).value=p?.[k]||'';
 q('pattern','#pmSave').disabled=!edit;
 q('pattern','#pmState').textContent=edit?(mgr.isNew?'새 패턴 작성 중 · [저장]을 누르면 등록됩니다.':'수정 중 · [저장]을 누르면 반영됩니다.'):'';
}
// the list keeps the conditions of the last [조회]; the same fields name a pattern being written
function mgrList(){
 const rows=P.search(patternList(),mgr.filter);
 q('pattern','#pmList').innerHTML=`<table><thead><tr><th></th><th>패턴명</th><th>방향</th><th>열차종별</th></tr></thead><tbody>${rows.map((p,i)=>`<tr data-pm-id="${p.id}" class="${p.id===mgr.sel?'sel':''}" tabindex="0"><td>${String(i+1).padStart(2,'0')}</td><td>${esc(p.name)}</td><td>${dirText(p.direction)}</td><td>${esc(p.kind)}</td></tr>`).join('')||'<tr class="empty"><td colspan="4">조회된 패턴이 없습니다.</td></tr>'}</tbody></table>`;
}
function mgrEdit(e){
 const el=e.target.closest('[data-pm-field]');if(!el||!mgr.draft)return;
 const i=+el.dataset.pmRow,f=el.dataset.pmField,calls=mgr.draft.calls;
 if(f==='station'){
  if(!el.value){calls.splice(i,1);}
  else if(i>=calls.length){const last=calls.at(-1);calls.push({station:el.value,arrive:last?P.depart(last)+60:0,dwell:0,arrivalRoute:'',departureRoute:''});}
  else{calls[i].station=el.value;calls[i].arrivalRoute='';calls[i].departureRoute='';}
  mgrGrid();return;
 }
 if(f.endsWith('Route')){calls[i][f]=el.value;return;}
 const v=parse(el.value);if(Number.isNaN(v)){mgrGrid();return;}
 if(f==='arrive')calls[i].arrive=v;else if(f==='dwell')calls[i].dwell=v;else calls[i].dwell=Math.max(0,v-calls[i].arrive);
 mgrGrid();
}
function buildPatternManager(){
 const kinds=KINDS.map(k=>`<option>${k}</option>`).join('');
 make('pattern','[MA007_01] 열차운행패턴 관리',`<div class="ptn-mgr">
<fieldset class="ptn-main"><legend>열차운행패턴 관리</legend><div class="sched-calls ptn-grid" id="pmGrid"></div>
<div class="ptn-meta"><label>등록자ID<input id="pmReg" readonly></label><label>등록일시<input id="pmRegAt" readonly></label><label>최종수정자ID<input id="pmMod" readonly></label><label>최종수정일시<input id="pmModAt" readonly></label></div>
<div class="ptn-btns"><button type="button" class="sched-btn" id="pmAdd">추가</button><button type="button" class="sched-btn" id="pmEdit">수정</button><button type="button" class="sched-btn" id="pmDel">삭제</button><button type="button" class="sched-btn" id="pmCopy">패턴복사</button><span id="pmState" class="ptn-state" role="status"></span></div></fieldset>
<div class="ptn-side"><fieldset><legend>열차운행패턴 조건</legend><label><span>패턴이름</span><input id="pmName" maxlength="40"></label><label><span>노선정보</span><select id="pmLine"><option>경부선</option></select></label>
<label><span>열차종별</span><select id="pmKind"><option value="">선택안함</option>${kinds}</select></label>
<div class="ptn-dir"><span>열차운행방향</span><label><input type="radio" name="pmDir" value="all" checked>전체</label><label><input type="radio" name="pmDir" value="up">상행</label><label><input type="radio" name="pmDir" value="down">하행</label></div>
<button type="button" class="sched-btn" id="pmFind">조회</button></fieldset>
<fieldset class="ptn-listbox"><legend>열차운행패턴 목록</legend><div class="sched-calls" id="pmList"></div></fieldset>
<div class="ptn-btns end"><button type="button" class="sched-btn primary" id="pmSave">저장</button><button type="button" class="sched-btn" id="pmClose">닫기</button></div></div></div>`,{x:60,y:30,width:1180},()=>{
  const draftField=()=>{if(!mgr.draft)return;mgr.draft.name=q('pattern','#pmName').value.trim();if(q('pattern','#pmKind').value)mgr.draft.kind=q('pattern','#pmKind').value;const d=q('pattern','input[name="pmDir"]:checked').value;if(d!=='all'&&d!==mgr.draft.direction){mgr.draft.direction=d;mgrGrid();}};
  q('pattern','#pmFind').onclick=()=>{mgr.filter={direction:q('pattern','input[name="pmDir"]:checked').value,kind:q('pattern','#pmKind').value,name:q('pattern','#pmName').value};mgrList();};
  q('pattern','#pmName').onchange=draftField;q('pattern','#pmKind').onchange=draftField;for(const r of qa('pattern','input[name="pmDir"]'))r.onchange=draftField;
  q('pattern','#pmList').onclick=e=>{const tr=e.target.closest('[data-pm-id]');if(!tr)return;mgr.sel=tr.dataset.pmId;mgr.draft=null;mgrList();mgrGrid();};
  q('pattern','#pmGrid').onchange=once(mgrEdit);
  q('pattern','#pmAdd').onclick=()=>{
   const d=q('pattern','input[name="pmDir"]:checked').value;
   mgr.draft={id:P.nextId(patternList()),name:q('pattern','#pmName').value.trim(),line:P.LINE,kind:q('pattern','#pmKind').value||'KTX',direction:d==='up'?'up':'down',source:'user',registrar:OPERATOR,registeredAt:'',modifier:'',modifiedAt:'',calls:[]};
   mgr.isNew=true;mgrGrid();
  };
  q('pattern','#pmEdit').onclick=()=>{const p=patternList().find(p=>p.id===mgr.sel);if(!p){alert('수정할 패턴을 목록에서 선택하세요.');return;}mgr.draft=structuredClone(p);mgr.isNew=false;q('pattern','#pmName').value=p.name;mgrGrid();};
  q('pattern','#pmCopy').onclick=()=>{const p=patternList().find(p=>p.id===mgr.sel);if(!p){alert('복사할 패턴을 목록에서 선택하세요.');return;}mgr.draft={...structuredClone(p),id:P.nextId(patternList()),name:p.name+'_복사',source:'user',registrar:OPERATOR,registeredAt:'',modifier:'',modifiedAt:''};mgr.isNew=true;q('pattern','#pmName').value=mgr.draft.name;mgrGrid();};
  q('pattern','#pmDel').onclick=()=>{const p=patternList().find(p=>p.id===mgr.sel);if(!p){alert('삭제할 패턴을 목록에서 선택하세요.');return;}M().confirmBox(`${p.name} 패턴을 삭제하시겠습니까?`,()=>{patterns=patternList().filter(x=>x.id!==p.id);savePatterns();mgr.sel=null;mgr.draft=null;mgrList();mgrGrid();});};
  q('pattern','#pmSave').onclick=()=>{
   if(!mgr.draft)return;const bad=P.validate(mgr.draft);if(bad){alert(bad);return;}
   M().confirmBox('열차운행패턴을 저장하시겠습니까?',()=>{
    const p=mgr.draft,at=stamp();p.modifier=OPERATOR;p.modifiedAt=at;if(mgr.isNew){p.registrar=OPERATOR;p.registeredAt=at;patternList().push(p);}else patterns=patternList().map(x=>x.id===p.id?p:x);
    savePatterns();mgr.sel=p.id;mgr.draft=null;mgr.isNew=false;mgrList();mgrGrid();alert('저장되었습니다.');
   });
  };
  q('pattern','#pmClose').onclick=()=>M().close('pattern');
 });
 made.pattern.opener=()=>{if(!mgr.sel)mgr.sel=patternList()[0]?.id||null;mgrList();mgrGrid();};
}
function openPatternManager(){return M().open('pattern');}

// ---------------------------------------------------------------- [PTN_LOAD] 열차패턴선택
const loads={};
function openPatternLoad({container=null,onPick}={}){
 const id=container?'ptnLoadTg':'ptnLoad',st=loads[id]??={sel:null,calls:null,onPick:null};st.onPick=onPick;
 const kinds=KINDS.map(k=>`<option>${k}</option>`).join('');
 win(id,'[PTN_LOAD]열차패턴선택',`<div class="ptn-load"><div class="ptn-l">
<fieldset><legend>열차패턴리스트</legend><div class="sched-calls ptn-list" data-pl="list"></div></fieldset>
<fieldset><legend>경유역 정보</legend><div class="sched-calls ptn-calls" data-pl="calls"></div></fieldset></div>
<div class="ptn-r"><fieldset><legend>열차패턴 검색조건</legend><label><span>노선선택</span><select><option>경부선</option></select></label><label><span>열차종별</span><select data-pl="kind"><option value="">전체</option>${KINDS.map(k=>`<option ${k==='KTX'?'selected':''}>${k}</option>`).join('')}</select></label>
<div class="ptn-dir"><span>열차방향</span><label><input type="radio" name="${id}Dir" value="up">상행</label><label><input type="radio" name="${id}Dir" value="down" checked>하행</label><label><input type="radio" name="${id}Dir" value="all">모두</label></div>
<button type="button" class="sched-btn" data-pl="find">열차패턴조회</button></fieldset>
<fieldset><legend>적용패턴 역정보</legend><label><span>출 발 역</span><select data-pl="from" aria-label="출발역"></select></label><label><span>종 착 역</span><select data-pl="to" aria-label="종착역"></select></label></fieldset>
<div class="ptn-btns end"><button type="button" class="sched-btn primary" data-pl="ok">확인</button><button type="button" class="sched-btn" data-pl="cancel">취소</button></div></div></div>`,{x:150,y:50,width:1060,container},()=>{
  const list=()=>{
   // the list stays empty until [열차패턴조회] (photo 2026-10-30)
   const dir=q(id,`input[name="${id}Dir"]:checked`).value,rows=st.queried?P.search(patternList(),{kind:q(id,'[data-pl=kind]').value,direction:dir}):[];
   if(!rows.some(p=>p.id===st.sel)){st.sel=null;st.calls=null;}
   q(id,'[data-pl=list]').innerHTML=`<table><thead><tr><th>순서</th><th>열차패턴명</th><th>등록자</th><th>등록일자</th><th>수정자</th><th>수정일자</th><th>선택된 패턴 ID</th></tr></thead><tbody>${rows.map((p,i)=>`<tr data-pl-id="${p.id}" class="${p.id===st.sel?'sel':''}"><td>${String(i+1).padStart(2,'0')}</td><td title="${esc(p.name)}">${esc(p.name)}</td><td>${esc(p.registrar)}</td><td>${esc(p.registeredAt)}</td><td>${esc(p.modifier)}</td><td>${esc(p.modifiedAt)}</td><td>${p.id}</td></tr>`).join('')||(st.queried?'<tr class="empty"><td colspan="7">조회된 패턴이 없습니다.</td></tr>':'')}</tbody></table>`;
   calls();
  };
  // 경유역 정보는 고칠 수 있다: edits change only what is applied, the stored pattern stays as it is
  const calls=()=>{
   const c=st.calls||[],stations=c.map(x=>`<option value="${x.station}">${esc(name(x.station))}</option>`).join('');
   q(id,'[data-pl=calls]').innerHTML=`<table><thead><tr><th>역명</th><th>도착시간</th><th>정차시간</th><th>출발시간</th><th>도착진로</th><th>출발진로</th></tr></thead><tbody>${c.map((x,i)=>`<tr><td>${esc(name(x.station))}</td><td><input data-pl-row="${i}" data-pl-field="arrive" value="${dur(x.arrive)}" maxlength="8" aria-label="${esc(name(x.station))} 도착시간"></td><td><input data-pl-row="${i}" data-pl-field="dwell" value="${dur(x.dwell)}" maxlength="8" aria-label="${esc(name(x.station))} 정차시간"></td><td>${dur(P.depart(x))}</td><td>${routeSelect(x.station,'arrival',x.arrivalRoute,`data-pl-row="${i}" data-pl-field="arrivalRoute" aria-label="${esc(name(x.station))} 도착진로"`)}</td><td>${routeSelect(x.station,'departure',x.departureRoute,`data-pl-row="${i}" data-pl-field="departureRoute" aria-label="${esc(name(x.station))} 출발진로"`)}</td></tr>`).join('')}</tbody></table>`;
   const from=q(id,'[data-pl=from]'),to=q(id,'[data-pl=to]');from.innerHTML=stations;to.innerHTML=stations;
   if(c.length){from.value=c[0].station;to.value=c.at(-1).station;}
  };
  q(id,'[data-pl=find]').onclick=()=>{st.queried=true;list();};st.list=list;
  q(id,'[data-pl=list]').onclick=e=>{const tr=e.target.closest('[data-pl-id]');if(!tr)return;st.sel=tr.dataset.plId;st.calls=structuredClone(patternList().find(p=>p.id===st.sel).calls);list();};
  q(id,'[data-pl=calls]').onchange=once(e=>{
   const el=e.target.closest('[data-pl-field]');if(!el)return;const x=st.calls[+el.dataset.plRow],f=el.dataset.plField;
   if(f.endsWith('Route')){x[f]=el.value;return;}
   const v=parse(el.value);if(!Number.isNaN(v))x[f]=v;
   const keep=[q(id,'[data-pl=from]').value,q(id,'[data-pl=to]').value];calls();q(id,'[data-pl=from]').value=keep[0];q(id,'[data-pl=to]').value=keep[1];
  });
  q(id,'[data-pl=cancel]').onclick=()=>M().close(id);
  q(id,'[data-pl=ok]').onclick=()=>{
   const p=patternList().find(p=>p.id===st.sel);if(!p){alert('열차패턴을 선택하세요.');return;}
   const edited={...p,calls:st.calls},bad=P.validate(edited);if(bad){alert(bad);return;}
   const from=q(id,'[data-pl=from]').value,to=q(id,'[data-pl=to]').value;
   if(!P.apply(edited,{from,to})){alert('출발역과 종착역을 패턴의 진행 순서대로 선택하세요.');return;}
   M().close(id);st.onPick?.({pattern:structuredClone(edited),from,to});
  };
  list();
 });
 st.queried=false;st.sel=null;st.calls=null;st.list();
 return made[id];
}

// ---------------------------------------------------------------- shared: 상세정보 fields and 역스케줄 table
function detailHtml(p,edit){
 const sel=(f,opts,label,extra='')=>`<label><span>${label}</span><select id="${p}${f}" ${extra}>${opts.map(o=>`<option>${o}</option>`).join('')}</select></label>`;
 return `<fieldset class="trn-detail"><legend>온라인 열차스케줄 상세정보</legend>
${sel('Day',['오늘','내일'],'운행일자','disabled title="현재 운행일만 다룹니다"')}
<label><span>열차번호</span><input id="${p}Id" maxlength="6" autocomplete="off" ${edit?'readonly':''}></label>
<label><span>운행방향</span><select id="${p}Dir" disabled><option value="down">하행</option><option value="up">상행</option></select></label>
${sel('Kind',KINDS,'열차종별')}${sel('Service',['정기','부정기'],'운행구분')}
<label><span>주운행선</span><output>경부선</output></label>
${sel('Vehicle',['기본값'],'운용차종')}${sel('Speed',['기본값'],'속도종별')}
<label><span>시발역명</span><select id="${p}From" ${edit?'disabled':''}></select></label><label><span>시발시각</span><input id="${p}Start" maxlength="8" ${edit?'readonly':''}></label>
<label><span>종착역명</span><select id="${p}To" ${edit?'disabled':''}></select></label><label><span>종착시각</span><input id="${p}End" readonly></label>
${sel('Attr',['기본값'],'열차속성')}${sel('Split',['기본값'],'분할합병')}
<label><span>입/출고</span><select id="${p}Depot"><option value="">기본</option><option>입고</option><option>출고</option></select></label>
<label><span>연계열번</span><input id="${p}Related" maxlength="6" autocomplete="off"></label><label><span>차량수</span><input id="${p}Cars" type="number" min="1" max="20"></label><label><span>운행경과일</span><input id="${p}Days" value="0" readonly></label>
<div class="trn-flags">${['직통','영업','회차','회송','주박'].map(f=>`<label><input type="checkbox" name="${p}Flag" value="${f}">${f}여부</label>`).join('')}</div></fieldset>`;
}
function readDetail(p,train){
 const g=f=>doc.getElementById(p+f);
 const flags=[...doc.querySelectorAll(`input[name="${p}Flag"]:checked`)].map(i=>i.value);if(g('Depot').value)flags.unshift(g('Depot').value);
 return {...train,kind:g('Kind').value,service:g('Service').value,carCount:Number(g('Cars').value)||10,relatedTrain:g('Related').value.trim().toUpperCase(),flags};
}
function fillDetail(p,train,{edit}){
 const g=f=>doc.getElementById(p+f),c=train.calls,opts=c.map(x=>`<option value="${x.station}">${esc(name(x.station))}</option>`).join('');
 g('Id').value=edit?train.id:(g('Id').value||'');g('Dir').value=train.direction;g('Kind').value=train.kind;g('Service').value=train.service||'정기';
 g('From').innerHTML=edit?opts:g('From').innerHTML;g('To').innerHTML=edit?opts:g('To').innerHTML;
 g('From').value=c[0].station;g('To').value=c.at(-1).station;g('Start').value=clock(c[0].departure);g('End').value=clock(c.at(-1).arrival);
 g('Related').value=train.relatedTrain||'';g('Cars').value=train.carCount??'';g('Depot').value=(train.flags||[]).find(f=>f==='입고'||f==='출고')||'';
 for(const box of doc.querySelectorAll(`input[name="${p}Flag"]`))box.checked=(train.flags||[]).includes(box.value);
}
const actuals=new Map();   // [CA028_03] 실적 전송: manual actual times per train|station
function actualOf(train,call){
 const sent=actuals.get(train.id+'|'+call.station)||{},t=now();
 const arrival=sent.arrival??(call.arrival<=t&&!call.cancelled?call.arrival:null),departure=sent.departure??(call.departure<=t&&!call.cancelled?call.departure:null);
 return {arrival,departure,dwell:arrival!==null&&departure!==null?departure-arrival:null};
}
function callsTable(p,train,{edit,lockPast}){
 const t=lockPast?now():-Infinity;
 const head=`<tr><th>순서</th><th>역명</th><th>방향</th><th>정차구분</th><th>플랫폼</th>${edit?'<th>운휴여부</th>':''}<th>도착일</th><th>도착시각</th><th>출발일</th><th>출발시간</th><th>정차시간</th><th>도착진로명</th><th>출발진로명</th></tr>`;
 const rows=train.calls.map((c,i)=>{
  const last=i===train.calls.length-1,doneA=c.arrival<=t,doneD=c.departure<=t,n=esc(name(c.station));
  const lock=done=>done?'disabled title="실적이 있어 수정할 수 없습니다"':'';
  const time=(f,v,done)=>`<input data-${p}-row="${i}" data-${p}-field="${f}" value="${f==='dwell'?dur(v):clock(v)}" maxlength="8" aria-label="${n} ${{arrival:'도착시각',departure:'출발시간',dwell:'정차시간'}[f]}" ${lock(done)}>`;
  const stop=c.stopType||(i===0?'시발':last?'종착':'정차');
  return `<tr class="${c.cancelled?'cx':''}"><td>${String(i+1).padStart(2,'0')}</td><td>${n}</td><td>${dirText(train.direction)}</td><td>${esc(stop)}</td><td>0</td>${edit?`<td><select data-${p}-row="${i}" data-${p}-field="cancelled" aria-label="${n} 운휴여부" ${lock(doneD)}><option value="">운행</option><option value="1" ${c.cancelled?'selected':''}>운휴</option></select></td>`:''}
<td>오늘</td><td>${i===0?clock(c.arrival):time('arrival',c.arrival,doneA)}</td><td>오늘</td><td>${last?'00:00:00':time('departure',c.departure,doneD)}</td><td>${i===0||last?'00:00:00':time('dwell',c.departure-c.arrival,doneD)}</td>
<td>${i===0?'':routeSelect(c.station,'arrival',c.arrivalRoute||'',`data-${p}-row="${i}" data-${p}-field="arrivalRoute" aria-label="${n} 도착진로명" ${lock(doneA)}`)}</td><td>${last?'':routeSelect(c.station,'departure',c.departureRoute||'',`data-${p}-row="${i}" data-${p}-field="departureRoute" aria-label="${n} 출발진로명" ${lock(doneD)}`)}</td></tr>`;
 }).join('');
 return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}
// 시간설정 동기화: a changed time moves every later time with it; unchecked, only that cell changes
function editCall(p,train,el,sync){
 const i=+el.dataset[p+'Row'],f=el.dataset[p+'Field'],calls=train.calls,c=calls[i];
 if(f==='arrivalRoute'||f==='departureRoute'){c[f]=el.value;return false;}
 if(f==='cancelled'){c.cancelled=!!el.value;return true;}
 const v=f==='dwell'?parse(el.value):atClock(el.value);if(Number.isNaN(v))return true;
 const old=f==='dwell'?c.departure-c.arrival:c[f],delta=v-old;if(!delta)return true;
 if(!sync){if(f==='dwell')c.departure=c.arrival+v;else c[f]=v;if(i===calls.length-1)c.departure=c.arrival;if(i===0)c.arrival=c.departure;return true;}
 for(let k=i;k<calls.length;k++){if(k>i||f==='arrival')calls[k].arrival+=delta;if(k>i||f!=='arrival')calls[k].departure+=delta;}
 if(i===0)c.arrival=c.departure;
 return true;
}
function shiftAll(train,start){const d=start-train.calls[0].departure;for(const c of train.calls){c.arrival+=d;c.departure+=d;}}

// ---------------------------------------------------------------- [TRN_ADD] 온라인 열차 스케줄 추가
const add={pattern:null,train:null};
function addTable(){q('trnAdd','#taCalls').innerHTML=callsTable('ta',add.train,{edit:false,lockPast:false});doc.getElementById('taEnd').value=clock(add.train.calls.at(-1).arrival);doc.getElementById('taStart').value=clock(add.train.calls[0].departure);}
function addApply(from,to,start){
 const calls=P.apply(add.pattern,{from,to,start});if(!calls)return false;
 add.train={...(add.train||{}),direction:N.catalog[to].order>N.catalog[from].order?'down':'up',calls};
 doc.getElementById('taDir').value=add.train.direction;addTable();return true;
}
function openAdd({pattern,from,to,start=-28800,train=null},container){
 const opts=pattern.calls.map(x=>`<option value="${x.station}">${esc(name(x.station))}</option>`).join('');
 win('trnAdd','[TRN_ADD] 온라인 열차 스케줄 추가',`<div class="trn-dlg"><div class="trn-cap">온라인 열차 스케줄 추가</div><div class="trn-body">${detailHtml('ta',false)}
<fieldset class="trn-calls"><legend>온라인 역스케줄 상세정보</legend><div class="sched-calls" id="taCalls"></div></fieldset></div>
<div class="trn-foot"><label><input type="checkbox" id="taSync" checked>시간설정 동기화</label><span><button type="button" class="sched-btn primary" id="taOk">확인</button><button type="button" class="sched-btn" id="taCancel">취소</button></span></div></div>`,{x:40,y:24,width:1240,container},()=>{
  const g=id=>doc.getElementById(id);
  g('taCalls').onchange=once(e=>{const el=e.target.closest('[data-ta-field]');if(el&&editCall('ta',add.train,el,g('taSync').checked))addTable();});
  g('taStart').onchange=once(()=>{const v=atClock(g('taStart').value);if(Number.isNaN(v)){g('taStart').value=clock(add.train.calls[0].departure);return;}if(g('taSync').checked)shiftAll(add.train,v);else{add.train.calls[0].departure=v;add.train.calls[0].arrival=v;}addTable();});
  const reslice=()=>{if(!addApply(g('taFrom').value,g('taTo').value,add.train.calls[0].departure)){alert('시발역과 종착역을 패턴의 진행 순서대로 선택하세요.');g('taFrom').value=add.train.calls[0].station;g('taTo').value=add.train.calls.at(-1).station;}};
  g('taFrom').onchange=reslice;g('taTo').onchange=reslice;
  g('taCancel').onclick=()=>M().close('trnAdd');
  g('taOk').onclick=()=>{
   const id=g('taId').value.trim().toUpperCase();if(!/^[A-Z][0-9]{3,5}$/.test(id)){alert('열차번호를 입력하세요. (예: A0001)');return;}
   const bad=badRoute(add.train.calls);if(bad){alert(bad);return;}
   const train=readDetail('ta',{...add.train,id,cancelled:false,calls:add.train.calls.map(c=>({...c,cancelled:false}))});
   const result=T().create(D().getModel(),train);
   if(result.ok){M().close('trnAdd');D().selectTrain(id);}
   alert(result.message);
  };
 });
 add.pattern=pattern;add.train={id:'',direction:pattern.direction,kind:train?.kind||pattern.kind,service:train?.service||'정기',flags:[],carCount:null,relatedTrain:''};
 doc.getElementById('taFrom').innerHTML=opts;doc.getElementById('taTo').innerHTML=opts;doc.getElementById('taId').value='';
 addApply(from,to,start);fillDetail('ta',{...add.train,carCount:''},{edit:false});
 return made.trnAdd;
}
// T/G Ctrl+C then Ctrl+V (photo 2026-10-30): [TRN_ADD] opens filled with the copied train's stations, times and routes;
// only 열차번호 is left empty
function openCopy(id,container){
 const t=D().getModel().trains.find(x=>x.id===id);if(!t){alert('복사한 열차를 찾을 수 없습니다.');return null;}
 const base=t.calls[0].departure;
 const pattern={name:t.id,direction:t.direction,kind:t.kind,calls:t.calls.map((c,i)=>({station:c.station,arrive:i?c.arrival-base:0,dwell:i&&i<t.calls.length-1?c.departure-c.arrival:0,arrivalRoute:c.arrivalRoute||'',departureRoute:c.departureRoute||''}))};
 return openAdd({pattern,from:t.calls[0].station,to:t.calls.at(-1).station,start:base,train:t},container);
}

// ---------------------------------------------------------------- 온라인 열차 스케줄 수정 (계획정보 · 실적정보)
const mod={train:null,revision:0};
function modTables(){
 const tr=mod.train;
 q('trnEdit','#teCalls').innerHTML=callsTable('te',tr,{edit:true,lockPast:true});
 q('trnEdit','#teActual').innerHTML=`<table><thead><tr><th>역명</th><th>방향</th><th>정차구분</th><th>플랫폼</th><th>운휴여부</th><th>도착일</th><th>도착시간</th><th>출발일</th><th>출발시간</th><th>정차시간</th><th>도착진로명</th><th>출발진로명</th></tr></thead><tbody>${tr.calls.map((c,i)=>{const a=actualOf(tr,c);return `<tr><td>${esc(name(c.station))}</td><td>${dirText(tr.direction)}</td><td>${esc(c.stopType||(i===0?'시발':i===tr.calls.length-1?'종착':'정차'))}</td><td>0</td><td>${c.cancelled?'운휴':'운행'}</td><td>오늘</td><td>${a.arrival===null?'':clock(a.arrival)}</td><td>오늘</td><td>${a.departure===null?'':clock(a.departure)}</td><td>${a.dwell===null?'':dur(a.dwell)}</td><td>${a.arrival===null?'':esc(c.arrivalRoute||'')}</td><td>${a.departure===null?'':esc(c.departureRoute||'')}</td></tr>`;}).join('')}</tbody></table>`;
 doc.getElementById('teEnd').value=clock(tr.calls.at(-1).arrival);doc.getElementById('teStart').value=clock(tr.calls[0].departure);
}
function openEdit(id,container){
 const source=D().getModel().trains.find(t=>t.id===id);if(!source){alert('수정할 열차를 그래프에서 선택하세요.');return null;}
 win('trnEdit','온라인 열차 스케줄 수정',`<div class="trn-dlg"><div class="trn-cap">온라인 열차 스케줄 수정</div><div class="trn-body">${detailHtml('te',true)}
<fieldset class="trn-calls"><legend>온라인 역스케줄 상세정보</legend><div class="trn-sub">열차스케줄 계획정보</div><div class="sched-calls trn-half" id="teCalls"></div><div class="trn-sub">열차스케줄 실적정보</div><div class="sched-calls trn-half" id="teActual"></div></fieldset></div>
<div class="trn-foot"><label><input type="checkbox" id="teSync" checked>시간설정 동기화</label><span><button type="button" class="sched-btn primary" id="teOk">확인</button><button type="button" class="sched-btn" id="teCancel">취소</button></span></div></div>`,{x:40,y:24,width:1240,container},()=>{
  const g=id=>doc.getElementById(id);
  g('teCalls').onchange=once(e=>{const el=e.target.closest('[data-te-field]');if(el&&editCall('te',mod.train,el,g('teSync').checked))modTables();});
  g('teCancel').onclick=()=>M().close('trnEdit');
  g('teOk').onclick=()=>{
   const model=D().getModel();
   if(mod.revision!==model.changes.length){alert('다이아에서 스케줄이 변경되었습니다. 다시 열어서 수정하세요.');return;}
   const bad=badRoute(mod.train.calls);if(bad){alert(bad);return;}
   const draft=readDetail('te',structuredClone(mod.train));draft.cancelled=draft.calls.every(c=>c.cancelled);delete draft.plan;
   const result=T().update(model,mod.train.id,draft);
   if(result.ok){M().close('trnEdit');D().selectTrain(mod.train.id);}
   alert(result.message);
  };
 });
 mod.train=structuredClone(source);mod.revision=D().getModel().changes.length;
 fillDetail('te',mod.train,{edit:true});modTables();
 return made.trnEdit;
}

// ---------------------------------------------------------------- [CA028_03] 실적 전송
function openActual(train,station,onSent){
 if(!train||!station){alert('실적을 입력할 열차와 경유역을 선택하세요.');return null;}
 const day=n=>`<label><input type="radio" name="${n}" value="-1">어제</label><label><input type="radio" name="${n}" value="0" checked>오늘</label><label><input type="radio" name="${n}" value="1">내일</label>`;
 win('schedActual','[CA028_03]실적 전송',`<div class="pat-dlg act-dlg"><b>실적수정정보</b><label><span>노선</span><input value="경부선" readonly></label><label><span>역명</span><input id="actStation" readonly></label><label><span>열차번호</span><input id="actTrain" readonly></label>
<div class="ptn-dir"><span>도착일</span>${day('actArrDay')}</div><label><span>도착시각</span><input id="actArr" placeholder=" : : " maxlength="8"></label>
<div class="ptn-dir"><span>출발일</span>${day('actDepDay')}</div><label><span>출발시각</span><input id="actDep" placeholder=" : : " maxlength="8"></label>
<div class="ptn-btns end"><button type="button" class="sched-btn primary" id="actSend">전송</button><button type="button" class="sched-btn" id="actClose">닫기</button></div></div>`,{x:420,y:160,width:360},()=>{
  const g=id=>doc.getElementById(id);
  g('actClose').onclick=()=>M().close('schedActual');
  g('actSend').onclick=()=>{
   const st=made.schedActual.target,read=(f,d)=>{const v=g(f).value.trim();if(!v)return undefined;const s=atClock(v);return Number.isNaN(s)?NaN:s+86400*Number(doc.querySelector(`input[name="${d}"]:checked`).value);};
   const arrival=read('actArr','actArrDay'),departure=read('actDep','actDepDay');
   if(Number.isNaN(arrival)||Number.isNaN(departure)){alert('시각은 HH:MM:SS 형식으로 입력하세요.');return;}
   if(arrival===undefined&&departure===undefined){alert('도착시각 또는 출발시각을 입력하세요.');return;}
   if(arrival!==undefined&&departure!==undefined&&departure<arrival){alert('출발시각은 도착시각보다 늦어야 합니다.');return;}
   const key=st.train+'|'+st.station,prev=actuals.get(key)||{};actuals.set(key,{...prev,...(arrival!==undefined?{arrival}:{}),...(departure!==undefined?{departure}:{})});
   M().log('event',`${name(st.station)}역 ${st.train} 실적 전송${arrival!==undefined?` 도착 ${clock(arrival)}`:''}${departure!==undefined?` 출발 ${clock(departure)}`:''}`);
   made.schedActual.onSent?.();alert('실적을 전송했습니다.');
  };
 });
 made.schedActual.target={train:train.id,station};made.schedActual.onSent=onSent;
 const sent=actuals.get(train.id+'|'+station)||{};
 doc.getElementById('actStation').value=name(station);doc.getElementById('actTrain').value=train.id;
 doc.getElementById('actArr').value=sent.arrival!==undefined?clock(sent.arrival):'';doc.getElementById('actDep').value=sent.departure!==undefined?clock(sent.departure):'';
 return made.schedActual;
}

// ---------------------------------------------------------------- 출력 미리보기 (온라인 열차 스케줄 경유역)
function reportHtml(train){
 const date=D().getModel().serviceDate||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}),c=train.calls;
 const rows=c.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(code(x.station))}</td><td>${esc(name(x.station))}</td><td>${i===0?'00:00:00':clock(x.arrival)}</td><td>${i===0||i===c.length-1?'00:00:00':dur(x.departure-x.arrival)}</td><td>${i===c.length-1?'00:00:00':clock(x.departure)}</td><td>${esc(x.arrivalRoute||'')}</td><td>${esc(x.departureRoute||'')}</td></tr>`).join('');
 return `<div class="rp-page"><h1>온라인 열차 스케줄 경유역</h1><div class="rp-head"><span>운영자ID :</span><b>${OPERATOR}</b><span></span><b></b><span>스케줄ID :</span><b>${esc(date)}</b><span>차 량 수 :</span><b>${esc(train.carCount??'')}</b><span>운행방향 :</span><b>${dirText(train.direction)}</b><span>출 발 역 :</span><b>${esc(name(c[0].station))}</b><span>열차번호 :</span><b>${esc(train.id)}</b><span>연결열번 :</span><b>${esc(train.relatedTrain||'')}</b><span>열차종별 :</span><b>${esc(train.kind)}</b><span>종 착 역 :</span><b>${esc(name(c.at(-1).station))}</b></div>
<table><thead><tr><th>번호</th><th>역번호</th><th>역명</th><th>도착시각</th><th>정차시각</th><th>출발시각</th><th>도착진로</th><th>출발진로</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
const REPORT_CSS='.rp-page{font-family:"Malgun Gothic",sans-serif;color:#000;background:#fff;padding:18px 26px}.rp-page h1{font-size:30px;text-align:center;margin:6px 0 10px;border-bottom:2px solid #000;padding-bottom:8px}.rp-head{display:grid;grid-template-columns:90px 1fr 90px 1fr;gap:6px 8px;font-size:13px;margin:10px 0 14px}.rp-head span{font-weight:700}.rp-page table{width:100%;border-collapse:collapse;font-size:12px}.rp-page th{background:#d9d9d9}.rp-page th,.rp-page td{border:1px solid #000;padding:3px 6px;text-align:center}';
function openPrint(train){
 if(!train){alert('인쇄할 열차스케줄을 먼저 조회하세요.');return null;}
 win('schedPrint','출력 미리보기 윈도우',`<div class="rp-tools"><button type="button" class="sched-btn primary" id="prvPrint">인쇄</button><button type="button" class="sched-btn" id="prvClose">닫기</button></div><div class="rp-sheet" id="prvSheet"></div><style>${REPORT_CSS}</style>`,{x:200,y:30,width:860},()=>{
  doc.getElementById('prvClose').onclick=()=>M().close('schedPrint');
  doc.getElementById('prvPrint').onclick=()=>{
   const f=doc.createElement('iframe');f.style.cssText='position:fixed;width:0;height:0;border:0';doc.body.appendChild(f);
   const d=f.contentDocument;d.open();d.write(`<!doctype html><meta charset="utf-8"><title>온라인 열차 스케줄 경유역</title><style>${REPORT_CSS}</style>${doc.getElementById('prvSheet').innerHTML}`);d.close();
   try{f.contentWindow.focus();f.contentWindow.print();}catch{}setTimeout(()=>f.remove(),1500);
  };
 });
 doc.getElementById('prvSheet').innerHTML=reportHtml(train);
 return made.schedPrint;
}

// the MMI menu entry 열차운행패턴 관리(P) opens the real window instead of a placeholder
function init(){buildPatternManager();}
root.SimScheduleDialogs={init,openPatternManager,openPatternLoad,openAdd,openCopy,openEdit,openActual,openPrint,actualOf,patterns:patternList,reportHtml,
 resetPatterns(){patterns=P.seed();savePatterns();}};
})(window);
