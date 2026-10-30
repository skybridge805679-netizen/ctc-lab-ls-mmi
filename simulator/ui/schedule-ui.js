(function(root){
 'use strict';
 // [CA028_02] online train schedule window (수정 / 복사 / 생성), laid out after the real MMI photos
 const N=root.SimNetwork,T=root.SimTimetable,D=root.SimDiagram,$=id=>SimDOM.document.getElementById(id),model=D.getModel();
 let draft=null,patternKey='',draftRevision=0,selRow=0;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const seconds=value=>{if(!/^\d{2}:\d{2}(:\d{2})?$/.test(value))return NaN;const [h,m,s=0]=value.split(':').map(Number);return h*3600+m*60+s-28800;};
 const radio=name=>SimDOM.document.querySelector(`input[name="${name}"]:checked`)?.value;
 const mode=()=>radio('scheduleMode'),selectedId=()=>$('scheduleList').value;
 const stationName=id=>N.catalog[id].name;
 const attributes=()=>({kind:$('scheduleKind').value,carCount:Number($('scheduleCars').value),relatedTrain:$('scheduleRelated').value.trim().toUpperCase(),service:$('scheduleService').value,flags:[...SimDOM.document.querySelectorAll('input[name="scheduleFlag"]:checked')].map(i=>i.value)});
 const key=()=>[draft?.calls[0]?.station,draft?.calls.at(-1)?.station,$('scheduleStart').value].join('|');
 function message(text){$('scheduleMessage').textContent=text;}
 // modal 확인 box; failures and completions are both announced like on the real MMI
 function notify(text){message(text);root.SimMMI?.alertBox(text);}
 function list(keep=selectedId()){
  const dir=radio('scheduleDir'),needle=$('scheduleSearch').value.trim().toUpperCase();
  const rows=model.trains.filter(t=>(dir==='all'||t.direction===dir)&&(!needle||t.id.includes(needle)));
  $('scheduleList').innerHTML=rows.map(t=>`<option value="${t.id}">${t.id}${t.cancelled?'(미운행열차)':''}</option>`).join('');
  if(rows.some(t=>t.id===keep))$('scheduleList').value=keep;else if(rows.length)$('scheduleList').selectedIndex=0;
  $('scheduleCount').textContent=`열차번호 목록 ${rows.length}건`;
 }
 function stationOptions(){
  const calls=draft?draft.calls:[],opts=calls.map(c=>`<option value="${c.station}">${stationName(c.station)}</option>`).join('');
  for(const id of ['scheduleCancelFrom','scheduleCancelTo','scheduleEditTo']){const v=$(id).value;$(id).innerHTML=opts;if(calls.length)$(id).value=calls.some(c=>c.station===v)?v:(id==='scheduleCancelFrom'?calls[0].station:calls.at(-1).station);}

 }
 function summary(){
  const c=draft?.calls;
  $('scheduleSelected').value=draft?.id??'';$('scheduleFromName').value=c?stationName(c[0].station):'';$('scheduleToName').value=c?stationName(c.at(-1).station):'';
  $('scheduleStartShow').value=c?T.clock(c[0].departure):'';$('scheduleEndShow').value=c?T.clock(c.at(-1).arrival):'';
 }
 // columns of the photographed [CA028_02] (2026-10-30): 운휴 is a check box (■운휴 / □운행), 실적 columns stay " : : " until run
 function table(){
  const copyMode=mode()==='copy',now=mode()==='edit'?D.clock():-Infinity,dir=draft?.direction==='down'?'하행':'상행',source=draft&&model.trains.find(t=>t.id===draft.id);
  const hms=s=>s===null?' : : ':T.clock(s),dur=s=>s===null?' : : ':[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':');
  $('scheduleCalls').innerHTML=draft?`<table><thead><tr><th>역명</th><th>방향</th><th>도착일</th><th>도착시간</th><th>정차시간</th><th>출발일</th><th>출발시간</th><th>도착진로</th><th>출발진로</th><th>운휴</th><th>실적도착시간</th><th>실적정차시간</th><th>실적출발시간</th></tr></thead><tbody>${draft.calls.map((call,i)=>{
   // 실적이 생긴 부분은 수정할 수 없다 (실기1 p.139): the call already happened on the simulated clock
   const n=stationName(call.station),done={arrival:call.arrival<=now,departure:call.departure<=now,dwell:call.departure<=now,arrivalRoute:call.arrival<=now,departureRoute:call.departure<=now,cancelled:call.departure<=now};
   const lock=f=>copyMode||done[f]?`disabled ${done[f]?'title="실적이 있어 수정할 수 없습니다"':''}`:'';
   const time=f=>`<input aria-label="${n} ${{arrival:'도착',departure:'출발',dwell:'정차'}[f]}시간" data-call="${i}" data-field="${f}" type="text" inputmode="numeric" maxlength="8" placeholder="HH:MM:SS" value="${f==='dwell'?dur(call.departure-call.arrival):T.clock(call[f])}" ${lock(f)}>`;
   const route=f=>`<input aria-label="${n} ${f==='arrivalRoute'?'도착':'출발'}진로" data-call="${i}" data-field="${f}" maxlength="14" value="${escape(call[f])}" ${lock(f)}>`;
   const a=source&&root.SimScheduleDialogs?root.SimScheduleDialogs.actualOf(source,source.calls.find(c=>c.station===call.station)||call):{arrival:null,departure:null,dwell:null};
   return `<tr data-sc-row="${i}" class="${call.cancelled?'cx':''}"><td class="${i===selRow?'sc-sel':''}">${escape(n)}</td><td>${dir}</td><td>오늘</td><td>${time('arrival')}</td><td>${time('dwell')}</td><td>오늘</td><td>${time('departure')}</td><td>${route('arrivalRoute')}</td><td>${route('departureRoute')}</td><td><label class="sched-cx"><input type="checkbox" data-call="${i}" data-field="cancelled" aria-label="${n} 운휴" ${call.cancelled?'checked':''} ${lock('cancelled')}>${call.cancelled?'운휴':'운행'}</label></td><td>${hms(a.arrival)}</td><td>${dur(a.dwell)}</td><td>${hms(a.departure)}</td></tr>`;}).join('')}</tbody></table>`:'<p style="padding:8px">열차를 선택하고 [온라인 열차스케줄 검색]을 누르거나, [열차운행패턴선택]에서 패턴을 적용하세요.</p>';
  summary();stationOptions();
 }
 // 연동: a changed time moves every later time up to 수정구간; 개별: only that cell
 function timeEdit(input){
  const i=Number(input.dataset.call),dwell=input.dataset.field==='dwell',f=dwell?'departure':input.dataset.field;
  const value=dwell?seconds(input.value)+28800+draft.calls[i].arrival:seconds(input.value);
  if(Number.isNaN(value)){table();return;}
  const delta=value-draft.calls[i][f];
  if(radio('scheduleEditType')==='linked'){
   const end=Math.max(i,draft.calls.findIndex(c=>c.station===$('scheduleEditTo').value));
   for(let k=i;k<=end;k++){
    const call=draft.calls[k];
    if(k>i||f==='arrival')call.arrival+=delta;
    call.departure+=delta;
   }
  }else draft.calls[i][f]=value;
  // Preserve the focused next cell when a time field commits on blur. Replacing
  // the table here would detach the route input the operator just clicked.
  for(const cell of $('scheduleCalls').querySelectorAll('[data-field="arrival"],[data-field="departure"],[data-field="dwell"]')){const c=draft.calls[Number(cell.dataset.call)];if(cell.dataset.field==='dwell'){const d=c.departure-c.arrival;cell.value=[Math.floor(d/3600),Math.floor(d%3600/60),d%60].map(v=>String(v).padStart(2,'0')).join(':');}else cell.value=T.clock(c[cell.dataset.field]);}
  summary();
 }
 function load(){
  const m=mode(),source=model.trains.find(t=>t.id===selectedId());
  const create=m==='create';
  $('scheduleCreateBox').hidden=m==='edit';$('scheduleNumber').readOnly=m==='edit';
  $('schedulePatternOpen').disabled=!create;
  for(const el of SimDOM.document.querySelectorAll('[name="scheduleEditType"],#scheduleEditTo,#scheduleSuspend,#scheduleResume,[name="scheduleCancelType"],#scheduleCancelFrom,#scheduleCancelTo'))el.disabled=create;
  if(create){
   draft=null;$('scheduleNumber').value='A0000';$('scheduleStart').value='09:00:00';
  }else if(source){
   draft=structuredClone(source);
   if(m==='edit')$('scheduleNumber').value=source.id;
   $('scheduleKind').value=source.kind;$('scheduleCars').value=source.carCount??10;$('scheduleRelated').value=source.relatedTrain??'';$('scheduleService').value=source.service??'정기';
   for(const box of SimDOM.document.querySelectorAll('input[name="scheduleFlag"]'))box.checked=(source.flags??[]).includes(box.value);
   if(m==='copy'){$('scheduleFrom').value=source.calls[0].station;$('scheduleTo').value=source.calls.at(-1).station;$('scheduleNumber').value='C'+source.id.slice(1);$('scheduleStart').value=T.clock(source.calls[0].departure);}
  }else draft=null;
  draftRevision=model.changes.length;selRow=0;table();message('');
 }
 // a hand-typed route must exist at that controlled station (arrival = 장내, departure = 출발 signal)
 function badRoute(){
  const R=root.SimScheduleRoutes;if(!R||!draft)return null;
  for(const c of draft.calls){
   if(!R.validate(c.station,c.arrivalRoute,'arrival'))return `${stationName(c.station)}역에 없는 도착진로입니다: ${c.arrivalRoute}`;
   if(!R.validate(c.station,c.departureRoute,'departure'))return `${stationName(c.station)}역에 없는 출발진로입니다: ${c.departureRoute}`;
  }
  return null;
 }
 function apply(){
  const m=mode(),id=selectedId(),newId=$('scheduleNumber').value.trim().toUpperCase();
  const bad=m==='copy'?null:badRoute();if(bad){notify(bad);return;}
  if(draftRevision!==model.changes.length){notify('다이아에서 스케줄이 변경되었습니다. 다시 조회한 뒤 편집하세요.');return;}
  let result;
  if(m==='copy')result=T.copy(model,id,newId,seconds($('scheduleStart').value),{...attributes(),from:$('scheduleFrom').value,to:$('scheduleTo').value});
  else{
   if(!draft){notify('열차운행패턴을 먼저 적용하거나 스케줄을 조회하세요.');return;}
   if(m==='create'&&patternKey!==key()){notify('시발·종착·시작시각 변경 후 열차운행패턴을 다시 적용하세요.');return;}
   const candidate=structuredClone(draft);Object.assign(candidate,attributes());
   if(m==='create')candidate.id=newId;
   candidate.cancelled=candidate.calls.every(c=>c.cancelled);
   result=m==='create'?T.create(model,candidate):T.update(model,id,candidate);
  }
  if(result.ok){const target=m==='edit'?id:newId;if(m!=='edit')SimDOM.document.querySelector('input[name="scheduleMode"][value="edit"]').checked=true;$('scheduleSearch').value='';list(target);load();D.selectTrain(target);}
  notify(result.message);
 }
 function cancelRange(cancelled){
  if(!draft||mode()==='create'){notify('운휴/운행을 설정할 열차를 먼저 조회하세요.');return;}
  const part=radio('scheduleCancelType')==='part',id=draft.id,from=part?$('scheduleCancelFrom').value:draft.calls[0].station,to=part?$('scheduleCancelTo').value:draft.calls.at(-1).station;
  const result=T.setCancelled(model,id,from,to,cancelled);
  if(result.ok){list(id);load();D.selectTrain(id);}
  notify(result.message);
 }
 // [열차운행패턴선택] opens [PTN_LOAD]; the chosen stretch starts at 시작시간
 function openPattern(){
  root.SimScheduleDialogs.openPatternLoad({onPick:({pattern,from,to})=>{
   const calls=root.SimPatterns.apply(pattern,{from,to,start:seconds($('scheduleStart').value)});
   if(!calls){notify('시작시간과 패턴 구간을 확인하세요.');return;}
   draft={id:$('scheduleNumber').value.trim().toUpperCase(),direction:N.catalog[to].order>N.catalog[from].order?'down':'up',...attributes(),cancelled:false,calls};
   patternKey=key();draftRevision=model.changes.length;table();message(`${pattern.name} 패턴을 적용했습니다. 시각·진로를 확인·수정한 뒤 편집적용을 누르세요.`);
  }});
 }
 const options=N.stations.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
 $('scheduleFrom').innerHTML=options;$('scheduleTo').innerHTML=options;$('scheduleTo').value=N.stations.at(-1).id;
 list();load();
 $('scheduleMenu').onclick=()=>$('scheduleSubmenu').hidden=!$('scheduleSubmenu').hidden;
 $('onlineScheduleBtn').onclick=()=>{list();load();$('schedulePanel').hidden=false;};
 $('closeSchedule').onclick=()=>{$('schedulePanel').hidden=true;draft=null;root.SimMMI.close('ptnLoad');};
 $('scheduleClose').onclick=()=>root.SimMMI.close('schedule');
 for(const el of SimDOM.document.querySelectorAll('input[name="scheduleMode"]'))el.onchange=load;
 for(const el of SimDOM.document.querySelectorAll('input[name="scheduleDir"],input[name="scheduleDay"]'))el.onchange=()=>list();
 $('scheduleList').onchange=load;$('scheduleLoad').onclick=load;$('scheduleDiscard').onclick=load;
 $('scheduleFind').onclick=()=>{list();load();message(`${$('scheduleList').options.length}건 조회`);};
 $('scheduleSearch').oninput=()=>list();
 $('scheduleSearch').onkeydown=e=>{if(e.key==='Enter')$('scheduleFind').click();};
 $('scheduleCalls').onchange=e=>{const input=e.target.closest('[data-call]');if(!input||!draft)return;const i=Number(input.dataset.call),f=input.dataset.field;
  if(f==='cancelled'){draft.calls[i].cancelled=input.checked;table();}else if(f.endsWith('Route'))draft.calls[i][f]=input.value.trim().toUpperCase();else timeEdit(input);};
 $('scheduleCalls').onclick=e=>{const tr=e.target.closest('[data-sc-row]');if(!tr||e.target.closest('input'))return;selRow=Number(tr.dataset.scRow);for(const td of $('scheduleCalls').querySelectorAll('td.sc-sel'))td.classList.remove('sc-sel');tr.firstElementChild.classList.add('sc-sel');};
 $('schedulePrint').disabled=false;$('schedulePrint').removeAttribute('title');
 $('schedulePrint').onclick=()=>root.SimScheduleDialogs.openPrint(draft&&{...draft,id:mode()==='edit'?draft.id:$('scheduleNumber').value.trim().toUpperCase()});
 $('scheduleActual').disabled=false;$('scheduleActual').removeAttribute('title');
 $('scheduleActual').onclick=()=>{const t=draft&&model.trains.find(x=>x.id===draft.id);if(!t||mode()!=='edit'){notify('실적을 입력할 열차를 [수정]에서 조회하세요.');return;}root.SimScheduleDialogs.openActual(t,draft.calls[Math.min(selRow,draft.calls.length-1)].station,()=>table());};
 $('schedulePatternOpen').onclick=openPattern;
 $('scheduleApply').onclick=apply;
 $('scheduleSuspend').onclick=()=>cancelRange(true);$('scheduleResume').onclick=()=>cancelRange(false);
 root.SimScheduleUI={open(m,id){const M=root.SimMMI;M.open('schedule');SimDOM.document.querySelector(`input[name="scheduleMode"][value="${m}"]`).checked=true;$('scheduleSearch').value='';list(id||selectedId());load();}};
})(window);
