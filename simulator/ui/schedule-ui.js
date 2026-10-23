(function(root){
 'use strict';
 // [CA028_02] online train schedule window (수정 / 복사 / 생성), laid out after the real MMI photos
 const N=root.SimNetwork,T=root.SimTimetable,D=root.SimDiagram,$=id=>SimDOM.document.getElementById(id),model=D.getModel();
 let draft=null,patternKey='',draftRevision=0,patternWin=null;
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
 function table(){
  const copyMode=mode()==='copy',now=mode()==='edit'?D.clock():-Infinity;
  $('scheduleCalls').innerHTML=draft?`<table><thead><tr><th>순서</th><th>경유역</th><th>정차구분</th><th>도착시각</th><th>출발시각</th><th>도착진로</th><th>출발진로</th><th>운휴</th></tr></thead><tbody>${draft.calls.map((call,i)=>{
   // 실적이 생긴 부분은 수정할 수 없다 (실기1 p.139): the call already happened on the simulated clock
   const n=stationName(call.station),done={arrival:call.arrival<=now,departure:call.departure<=now,arrivalRoute:call.arrival<=now,departureRoute:call.departure<=now};
   const lock=f=>copyMode||done[f]?`disabled ${done[f]?'title="실적이 있어 수정할 수 없습니다"':''}`:'';
   const time=f=>`<input aria-label="${n} ${f==='arrival'?'도착':'출발'}시각" data-call="${i}" data-field="${f}" type="text" inputmode="numeric" maxlength="8" placeholder="HH:MM:SS" value="${T.clock(call[f])}" ${lock(f)}>`;
   const route=f=>`<input aria-label="${n} ${f==='arrivalRoute'?'도착':'출발'}진로" data-call="${i}" data-field="${f}" maxlength="14" value="${escape(call[f])}" ${lock(f)}>`;
   return `<tr class="${call.cancelled?'cx':''}"><td>${i+1}</td><td>${escape(n)}</td><td>${escape(call.stopType??'정차')}</td><td>${time('arrival')}</td><td>${time('departure')}</td><td>${route('arrivalRoute')}</td><td>${route('departureRoute')}</td><td>${call.cancelled?'운휴':''}${now>=call.departure?'<small class="sched-actual">실적</small>':''}</td></tr>`;}).join('')}</tbody></table>`:'<p style="padding:8px">열차를 선택하고 [온라인 열차스케줄 검색]을 누르거나, [열차운행패턴선택]에서 패턴을 적용하세요.</p>';
  summary();stationOptions();
 }
 // 연동: a changed time moves every later time up to 수정구간; 개별: only that cell
 function timeEdit(input){
  const i=Number(input.dataset.call),f=input.dataset.field,value=seconds(input.value);
  if(Number.isNaN(value)){input.value=T.clock(draft.calls[i][f]);return;}
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
  for(const cell of $('scheduleCalls').querySelectorAll('[data-field="arrival"],[data-field="departure"]'))cell.value=T.clock(draft.calls[Number(cell.dataset.call)][cell.dataset.field]);
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
  draftRevision=model.changes.length;table();message('');
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
 // 열차운행패턴선택: 노선 · 열차종별 · 운행방향 · 패턴 · 운행구간 → 선택패턴적용
 function openPattern(){
  const stations=N.stations.map(s=>`<option value="${s.id}">${escape(s.name)}</option>`).join('');
  if(!patternWin){
   patternWin=root.SimMMI.createWindow('patternSelect',{title:'열차운행패턴선택',x:340,y:120,width:380,body:`<div class="pat-dlg"><label><span>노선</span><select><option>경부선</option></select></label>
<label><span>열차종별</span><select id="patKind"><option>전동열차</option><option>일반열차</option><option>회송열차</option><option>KTX</option></select></label>
<label><span>운행방향</span><select id="patDir"><option value="down">하행</option><option value="up">상행</option></select></label>
<label><span>패턴</span><select id="patName"><option>전동 전역정차 패턴</option></select></label>
<label><span>운행구간</span><select id="patFrom">${stations}</select><select id="patTo">${stations}</select></label>
<div><button type="button" class="sched-btn primary" id="patApply">선택패턴적용</button> <button type="button" class="sched-btn" id="patClose">닫기</button></div></div>`});
   const sync=()=>{const down=$('patDir').value==='down';$('patFrom').value=down?N.stations[0].id:N.stations.at(-1).id;$('patTo').value=down?N.stations.at(-1).id:N.stations[0].id;};
   $('patDir').onchange=sync;sync();
   $('patClose').onclick=()=>root.SimMMI.close('patternSelect');
   $('patApply').onclick=()=>{
    const start=seconds($('scheduleStart').value),made=T.pattern({id:$('scheduleNumber').value.trim().toUpperCase(),from:$('patFrom').value,to:$('patTo').value,start,...attributes(),kind:$('patKind').value});
    if(!made||made.direction!==$('patDir').value){root.SimMMI.close('patternSelect');notify('운행방향과 운행구간(서로 다른 시발·종착역)을 확인하세요.');return;}
    draft=made;patternKey=key();draftRevision=model.changes.length;$('scheduleKind').value=made.kind;table();root.SimMMI.close('patternSelect');message('전역정차 패턴을 적용했습니다. 시각·진로를 확인·수정한 뒤 편집적용을 누르세요.');
   };
  }
  root.SimMMI.open('patternSelect');
 }
 const options=N.stations.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
 $('scheduleFrom').innerHTML=options;$('scheduleTo').innerHTML=options;$('scheduleTo').value=N.stations.at(-1).id;
 list();load();
 $('scheduleMenu').onclick=()=>$('scheduleSubmenu').hidden=!$('scheduleSubmenu').hidden;
 $('onlineScheduleBtn').onclick=()=>{list();load();$('schedulePanel').hidden=false;};
 $('closeSchedule').onclick=()=>{$('schedulePanel').hidden=true;draft=null;if(patternWin)root.SimMMI.close('patternSelect');};
 $('scheduleClose').onclick=()=>root.SimMMI.close('schedule');
 for(const el of SimDOM.document.querySelectorAll('input[name="scheduleMode"]'))el.onchange=load;
 for(const el of SimDOM.document.querySelectorAll('input[name="scheduleDir"],input[name="scheduleDay"]'))el.onchange=()=>list();
 $('scheduleList').onchange=load;$('scheduleLoad').onclick=load;$('scheduleDiscard').onclick=load;
 $('scheduleFind').onclick=()=>{list();load();message(`${$('scheduleList').options.length}건 조회`);};
 $('scheduleSearch').oninput=()=>list();
 $('scheduleSearch').onkeydown=e=>{if(e.key==='Enter')$('scheduleFind').click();};
 $('scheduleCalls').onchange=e=>{const input=e.target.closest('[data-call]');if(!input||!draft)return;if(input.dataset.field.endsWith('Route'))draft.calls[Number(input.dataset.call)][input.dataset.field]=input.value.trim().toUpperCase();else timeEdit(input);};
 $('schedulePatternOpen').onclick=openPattern;
 $('scheduleApply').onclick=apply;
 $('scheduleSuspend').onclick=()=>cancelRange(true);$('scheduleResume').onclick=()=>cancelRange(false);
 root.SimScheduleUI={open(m,id){const M=root.SimMMI;M.open('schedule');SimDOM.document.querySelector(`input[name="scheduleMode"][value="${m}"]`).checked=true;$('scheduleSearch').value='';list(id||selectedId());load();}};
})(window);
