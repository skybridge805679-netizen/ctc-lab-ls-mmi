(function(root){
 'use strict';
 const N=root.SimNetwork,T=root.SimTimetable,D=root.SimDiagram,$=id=>document.getElementById(id),model=D.getModel();
 let draft=null,patternKey='',draftRevision=0;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const seconds=value=>{if(!/^\d{2}:\d{2}(:\d{2})?$/.test(value))return NaN;const [h,m,s=0]=value.split(':').map(Number);return h*3600+m*60+s-28800;};
 const key=()=>[$('scheduleFrom').value,$('scheduleTo').value,$('scheduleStart').value].join('|');
 function message(text){$('scheduleMessage').textContent=text;}
 function list(id=$('scheduleTrain').value){$('scheduleTrain').innerHTML=model.trains.map(t=>`<option>${escape(t.id)}</option>`).join('');if(model.trains.some(t=>t.id===id))$('scheduleTrain').value=id;}
 function attributes(){return {kind:$('scheduleKind').value,carCount:Number($('scheduleCars').value),relatedTrain:$('scheduleRelated').value.trim().toUpperCase()};}
 function table(){
  const readOnly=$('scheduleMode').value==='copy';
  $('scheduleCalls').innerHTML=draft?`<table><thead><tr><th>순서</th><th>경유역</th><th>도착</th><th>출발</th><th>번선·진로 메모</th></tr></thead><tbody>${draft.calls.map((call,i)=>`<tr><td>${i+1}</td><td>${N.catalog[call.station].name}</td><td><input aria-label="${N.catalog[call.station].name} 도착시각" data-call="${i}" data-field="arrival" type="time" step="1" value="${T.clock(call.arrival)}" ${readOnly?'disabled':''}></td><td><input aria-label="${N.catalog[call.station].name} 출발시각" data-call="${i}" data-field="departure" type="time" step="1" value="${T.clock(call.departure)}" ${readOnly?'disabled':''}></td><td><input aria-label="${N.catalog[call.station].name} 번선 진로 메모" data-call="${i}" data-field="track" maxlength="32" value="${escape(call.track)}" ${readOnly?'disabled':''}></td></tr>`).join('')}</tbody></table>`:'<p>열차패턴정보를 적용하면 전체 경유역을 확인할 수 있습니다.</p>';
 }
 function load(){
  const mode=$('scheduleMode').value,source=model.trains.find(t=>t.id===$('scheduleTrain').value);
  $('scheduleNumber').readOnly=mode==='edit';$('scheduleFrom').disabled=mode!=='create';$('scheduleTo').disabled=mode!=='create';$('scheduleStart').disabled=mode==='edit';$('schedulePattern').disabled=mode!=='create';$('scheduleCancelled').disabled=mode!=='edit';
  if(mode==='create'){
   draft=null;$('scheduleNumber').value='K2001';$('scheduleFrom').value=N.stations[0].id;$('scheduleTo').value=N.stations.at(-1).id;$('scheduleStart').value='09:00:00';$('scheduleCancelled').checked=false;
  }else{
   draft=structuredClone(source);$('scheduleNumber').value=mode==='copy'?'C'+source.id.slice(1):source.id;
   $('scheduleFrom').value=source.calls[0].station;$('scheduleTo').value=source.calls.at(-1).station;$('scheduleStart').value=T.clock(source.calls[0].departure);
   $('scheduleKind').value=source.kind;$('scheduleCars').value=source.carCount??10;$('scheduleRelated').value=source.relatedTrain??'';$('scheduleCancelled').checked=mode==='edit'&&source.cancelled;
  }
  draftRevision=model.changes.length;table();message('');
 }
 const options=N.stations.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
 $('scheduleFrom').innerHTML=options;$('scheduleTo').innerHTML=options;$('scheduleDate').value=model.serviceDate;
 list();load();
 $('scheduleMenu').onclick=()=>$('scheduleSubmenu').hidden=!$('scheduleSubmenu').hidden;
 $('onlineScheduleBtn').onclick=()=>{list();load();$('schedulePanel').hidden=false;$('schedulePanel').scrollIntoView({behavior:'smooth'});};
 $('closeSchedule').onclick=()=>{$('schedulePanel').hidden=true;draft=null;};
 $('scheduleMode').onchange=load;$('scheduleTrain').onchange=load;$('scheduleLoad').onclick=load;$('scheduleDiscard').onclick=load;
 $('scheduleFind').onclick=()=>{const id=$('scheduleSearch').value.trim().toUpperCase();if(!model.trains.some(t=>t.id===id)){message('해당 열차번호가 없습니다.');return;}list(id);load();message(id+' 스케줄 조회');};
 $('scheduleSearch').onkeydown=e=>{if(e.key==='Enter')$('scheduleFind').click();};
 $('schedulePattern').onclick=()=>{draft=T.pattern({id:$('scheduleNumber').value.trim().toUpperCase(),from:$('scheduleFrom').value,to:$('scheduleTo').value,start:seconds($('scheduleStart').value),...attributes()});if(!draft){message('서로 다른 시발·종착역과 시작출발시각을 지정하세요.');table();return;}patternKey=key();draftRevision=model.changes.length;table();message('교육용 전역정차 패턴 적용: 역간 2분 운행·중간역 30초 정차. 시각을 확인·수정한 뒤 편집 적용하세요.');};
 $('scheduleApply').onclick=()=>{
  const mode=$('scheduleMode').value,id=$('scheduleTrain').value,newId=$('scheduleNumber').value.trim().toUpperCase();
  if(draftRevision!==model.changes.length){message('다이아에서 스케줄이 변경되었습니다. 다시 조회한 뒤 편집하세요.');return;}
  let result;
  if(mode==='copy')result=T.copy(model,id,newId,seconds($('scheduleStart').value),attributes());
  else{
   if(!draft){message('열차패턴정보를 먼저 적용하거나 스케줄을 조회하세요.');return;}
   if(mode==='create'&&patternKey!==key()){message('시발·종착·시작시각 변경 후 열차패턴정보를 다시 적용하세요.');return;}
   const candidate=structuredClone(draft);candidate.id=newId;Object.assign(candidate,attributes());candidate.cancelled=mode==='edit'&&$('scheduleCancelled').checked;
   $('scheduleCalls').querySelectorAll('[data-call]').forEach(input=>{candidate.calls[Number(input.dataset.call)][input.dataset.field]=input.dataset.field==='track'?input.value:seconds(input.value);});
   result=mode==='create'?T.create(model,candidate):T.update(model,id,candidate);
  }
  if(result.ok){$('scheduleMode').value='edit';list(newId);load();D.selectTrain(newId);}
  message(result.message);
 };
})(window);
