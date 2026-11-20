(function(root){
 'use strict';
 // [CA028_02] online train schedule window (수정 / 복사 / 생성), laid out after the real MMI photos
 const N=root.SimNetwork,T=root.SimTimetable,D=root.SimDiagram,$=id=>SimDOM.document.getElementById(id),model=D.getModel();
 let draft=null,patternKey='',draftRevision=0,selRow=0,selEnd=null,needle='';
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const seconds=value=>{if(!/^\d{2}:\d{2}(:\d{2})?$/.test(value))return NaN;const [h,m,s=0]=value.split(':').map(Number);return h*3600+m*60+s-28800;};
 const radio=name=>SimDOM.document.querySelector(`input[name="${name}"]:checked`)?.value;
 const mode=()=>radio('scheduleMode'),selectedId=()=>$('scheduleList').value;
 const stationName=id=>root.SimMMI?.stationInfo?.(id).name||N.catalog[id].name;
 const attributes=()=>({kind:$('scheduleKind').value,carCount:Number($('scheduleCars').value),relatedTrain:$('scheduleRelated').value.trim().toUpperCase(),service:$('scheduleService').value,flags:[...SimDOM.document.querySelectorAll('input[name="scheduleFlag"]:checked')].map(i=>i.value)});
 const key=()=>[draft?.calls[0]?.station,draft?.calls.at(-1)?.station,$('scheduleStart').value].join('|');
 function message(text){$('scheduleMessage').textContent=text;}
 // modal 확인 box; failures and completions are both announced like on the real MMI
 function notify(text){message(text);root.SimMMI?.alertBox(text);}
 // 열차번호 목록 (사진 2026-11-11): 실적이 없는 열차는 "K0010(미운행열차)". 검색 결과 건수는 목록 아래 한 줄에 나온다.
 const ran=t=>{const A=root.SimScheduleDialogs?.actualOf;return !!A&&t.calls.some(c=>{const a=A(t,c);return a.arrival!==null||a.departure!==null;});};
 function list(keep=selectedId()){
  const dir=radio('scheduleDir'),day=radio('scheduleDay')||'today';
  const rows=day==='today'?model.trains.filter(t=>(dir==='all'||t.direction===dir)&&(!needle||t.id.includes(needle))):[];
  $('scheduleList').innerHTML=rows.map(t=>`<option value="${t.id}">${t.id}(${ran(t)?'운행열차':'미운행열차'})</option>`).join('');
  if(rows.some(t=>t.id===keep))$('scheduleList').value=keep;else if(rows.length)$('scheduleList').selectedIndex=0;
  $('scheduleCount').textContent=`${rows.length}의 열차번호가 검색되었습니다.`;
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
 // columns of the photographed [CA028_02] (2026-11-11): 진로 칸은 그 역의 진로를 고르는 목록, 운휴 칸은 "□운행" / "■운휴",
 // 실적 칸은 운행 전 " : : ". 시발역의 도착·정차시간은 00:00:00으로 나온다.
 function table(){
  const copyMode=mode()==='copy',now=mode()==='edit'?D.clock():-Infinity,dir=draft?.direction==='down'?'하행':'상행',source=draft&&model.trains.find(t=>t.id===draft.id),R=root.SimScheduleRoutes;
  const hms=s=>s===null?' : : ':T.clock(s),dur=s=>s===null?' : : ':[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':');
  $('scheduleCalls').innerHTML=`<table><thead><tr><th>역명</th><th>방향</th><th>도착일</th><th>도착시간</th><th>정차시간</th><th>출발일</th><th>출발시간</th><th>도착진로</th><th>출발진로</th><th>운휴</th><th>실적도착시간</th><th>실적정차시간</th><th>실적출발시간</th><th>실적도착진로</th><th>실적출발진로</th></tr></thead><tbody>${(draft?.calls??[]).map((call,i)=>{
   // 실적이 생긴 부분은 수정할 수 없다 (실기1 p.139): the call already happened on the simulated clock
   const n=stationName(call.station),done={arrival:call.arrival<=now,departure:call.departure<=now,dwell:call.departure<=now,arrivalRoute:call.arrival<=now,departureRoute:call.departure<=now,cancelled:call.departure<=now};
   const lock=f=>copyMode||done[f]?`disabled ${done[f]?'title="실적이 있어 수정할 수 없습니다"':''}`:'';
   const first=i===0;
   const time=f=>first&&f!=='departure'?'00:00:00':`<input aria-label="${n} ${{arrival:'도착',departure:'출발',dwell:'정차'}[f]}시간" data-call="${i}" data-field="${f}" type="text" inputmode="numeric" maxlength="8" value="${f==='dwell'?dur(call.departure-call.arrival):T.clock(call[f])}" ${lock(f)}>`;
   const route=f=>{const kind=f==='arrivalRoute'?'arrival':'departure',cur=call[f]||'',opts=R?R.choices(call.station,kind,draft.direction):[];
    if(!opts.length&&!cur)return '';
    const all=[...new Set([...(cur&&!opts.includes(cur)?[cur]:[]),...opts])];
    return `<select aria-label="${n} ${kind==='arrival'?'도착':'출발'}진로" data-call="${i}" data-field="${f}" ${lock(f)}><option value=""></option>${all.map(o=>`<option ${o===cur?'selected':''}>${escape(o)}</option>`).join('')}</select>`;};
   const a=source&&root.SimScheduleDialogs?root.SimScheduleDialogs.actualOf(source,source.calls.find(c=>c.station===call.station)||call):{arrival:null,departure:null,dwell:null};
   return `<tr data-sc-row="${i}" class="${call.cancelled?'cx':''}"><td class="${i>=Math.min(selRow,selEnd??selRow)&&i<=Math.max(selRow,selEnd??selRow)?'sc-sel':''}">${escape(n)}</td><td>${dir}</td><td>오늘</td><td>${time('arrival')}</td><td>${time('dwell')}</td><td>오늘</td><td>${time('departure')}</td><td>${first?'':route('arrivalRoute')}</td><td>${route('departureRoute')}</td><td><label class="sched-cx"><input type="checkbox" data-call="${i}" data-field="cancelled" aria-label="${n} 운휴" ${call.cancelled?'checked':''} ${lock('cancelled')}>${call.cancelled?'운휴':'운행'}</label></td><td>${hms(a.arrival)}</td><td>${dur(a.dwell)}</td><td>${hms(a.departure)}</td><td>${a.arrival===null?'':escape(call.arrivalRoute||'')}</td><td>${a.departure===null?'':escape(call.departureRoute||'')}</td></tr>`;}).join('')}</tbody></table>`;
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
  if(root.SimMMI&&!$('scheduleFrom').dataset.named){for(const id of ['scheduleFrom','scheduleTo']){$(id).dataset.named='1';for(const o of $(id).options)o.textContent=stationName(o.value);}}
  const m=mode(),source=model.trains.find(t=>t.id===selectedId());
  const create=m==='create';
  for(const el of $('scheduleCreateBox').querySelectorAll('input'))el.disabled=m==='edit';
  $('schedulePatternOpen').disabled=!create;
  for(const el of SimDOM.document.querySelectorAll('[name="scheduleEditType"],#scheduleEditTo,#scheduleSuspend,#scheduleResume,[name="scheduleCancelType"],#scheduleCancelFrom,#scheduleCancelTo'))el.disabled=create;
  if(create){
   draft=null;$('scheduleNumber').value='A0000';$('scheduleStart').value='09:00:00';
  }else if(source){
   draft=structuredClone(source);
   if(m==='edit'){$('scheduleNumber').value='';$('scheduleStart').value='';}
   $('scheduleKind').value=source.kind;$('scheduleCars').value=source.carCount??10;$('scheduleRelated').value=source.relatedTrain??'';$('scheduleService').value=source.service??'정기';
   for(const box of SimDOM.document.querySelectorAll('input[name="scheduleFlag"]'))box.checked=(source.flags??[]).includes(box.value);
   if(m==='copy'){$('scheduleFrom').value=source.calls[0].station;$('scheduleTo').value=source.calls.at(-1).station;$('scheduleNumber').value='C'+source.id.slice(1);$('scheduleStart').value=T.clock(source.calls[0].departure);}
  }else draft=null;
  if(m==='edit')$('scheduleSearch').value=source?source.id:'';
  draftRevision=model.changes.length;selRow=0;selEnd=null;pendingCx=[];table();message('');
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
   if(m==='edit'&&pendingCx.length){
    // 운휴 구간 설정은 따로 보내고, 그 밖에 고친 것(시각·진로·속성·개별 운휴 체크)만 수정으로 보낸다
    const source=model.trains.find(t=>t.id===id),covered=new Set();
    for(const op of pendingCx){const a=candidate.calls.findIndex(c=>c.station===op.from),b=candidate.calls.findIndex(c=>c.station===op.to);for(let k=a;k<=b;k++)covered.add(k);}
    for(const k of covered)candidate.calls[k].cancelled=source.calls[k].cancelled??false;
    candidate.cancelled=candidate.calls.every(c=>c.cancelled);
    const same=JSON.stringify({...candidate,cancelled:undefined,plan:undefined})===JSON.stringify({...source,cancelled:undefined,plan:undefined});
    result=same?{ok:true,message:''}:T.update(model,id,candidate);
    if(result.ok){const msgs=[result.message].filter(Boolean);for(const op of pendingCx){const r=T.setCancelled(model,id,op.from,op.to,op.cancelled);msgs.push(r.message);if(!r.ok){result=r;break;}}if(result.ok)result={ok:true,message:msgs.join(' · ')};}
   }else{
    candidate.cancelled=candidate.calls.every(c=>c.cancelled);
    result=m==='create'?T.create(model,candidate):T.update(model,id,candidate);
   }
  }
  if(result.ok){const target=m==='edit'?id:newId;if(m!=='edit')SimDOM.document.querySelector('input[name="scheduleMode"][value="edit"]').checked=true;$('scheduleSearch').value='';needle='';list(target);load();D.selectTrain(target);}
  notify(result.message);
 }
 // 운휴운행설정 (실기1 p.128-129): [운휴]·[운행]과 경유역 우클릭 「운휴설정」·「운행설정」은 화면의 설정만 바꾸고, [편집적용]을 눌러야 송신된다.
 // [닫기]를 누르면 설정한 운휴는 취소된다. 편집적용 때 구간마다 운휴/운행 명령(T.setCancelled)으로 보내 운휴 이력·운전정리 대장이 그대로 남는다.
 let pendingCx=[];
 function cancelRange(cancelled,range){
  if(!draft||mode()!=='edit'){notify('운휴/운행을 설정할 열차를 [수정]에서 먼저 조회하세요.');return;}
  const part=radio('scheduleCancelType')==='part',from=range?range[0]:part?$('scheduleCancelFrom').value:draft.calls[0].station,to=range?range[1]:part?$('scheduleCancelTo').value:draft.calls.at(-1).station;
  const a=draft.calls.findIndex(c=>c.station===from),b=draft.calls.findIndex(c=>c.station===to);
  if(a<0||b<0||b<a){notify('운휴 구간의 시작역과 마지막역을 열차 진행 순서대로 선택하세요.');return;}
  const now=D.clock();if(draft.calls.slice(a,b+1).some(c=>c.departure<=now)){notify('실적이 생긴 역은 운휴·운행을 바꿀 수 없습니다.');return;}
  for(let k=a;k<=b;k++)draft.calls[k].cancelled=cancelled;
  pendingCx.push({from,to,cancelled});table();
  message(`${stationName(from)}~${stationName(to)} ${cancelled?'운휴':'운행'} 설정 · [편집적용]을 누르면 송신됩니다.`);
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
 const options=N.stations.map(s=>`<option value="${s.id}">${stationName(s.id)}</option>`).join('');
 $('scheduleFrom').innerHTML=options;$('scheduleTo').innerHTML=options;$('scheduleTo').value=N.stations.at(-1).id;
 list();load();
 $('scheduleMenu').onclick=()=>$('scheduleSubmenu').hidden=!$('scheduleSubmenu').hidden;
 $('onlineScheduleBtn').onclick=()=>{list();load();$('schedulePanel').hidden=false;};
 $('closeSchedule').onclick=()=>{$('schedulePanel').hidden=true;draft=null;pendingCx=[];root.SimMMI.close('ptnLoad');};
 $('scheduleClose').onclick=()=>root.SimMMI.close('schedule');
 for(const el of SimDOM.document.querySelectorAll('input[name="scheduleMode"]'))el.onchange=load;
 for(const el of SimDOM.document.querySelectorAll('input[name="scheduleDir"],input[name="scheduleDay"]'))el.onchange=()=>list();
 $('scheduleList').onchange=load;$('scheduleLoad').onclick=load;
 $('scheduleFind').onclick=()=>{list();load();};
 $('scheduleSearch').oninput=()=>{needle=$('scheduleSearch').value.trim().toUpperCase();list();};
 $('scheduleSearch').onkeydown=e=>{if(e.key==='Enter')$('scheduleFind').click();};
 $('scheduleCalls').onchange=e=>{const input=e.target.closest('[data-call]');if(!input||!draft)return;const i=Number(input.dataset.call),f=input.dataset.field;
  if(f==='cancelled'){draft.calls[i].cancelled=input.checked;table();}else if(f.endsWith('Route'))draft.calls[i][f]=input.value;else timeEdit(input);};
 const paintSel=()=>{const [a,b]=[selRow,selEnd??selRow].sort((x,y)=>x-y);for(const tr of $('scheduleCalls').querySelectorAll('[data-sc-row]')){const i=Number(tr.dataset.scRow);tr.firstElementChild.classList.toggle('sc-sel',i>=a&&i<=b);}};
 // 경유역 이름 칸을 눌러 고르고, Shift를 누른 채 누르면 구간을 고른다
 $('scheduleCalls').onclick=e=>{const tr=e.target.closest('[data-sc-row]');if(!tr||e.target.closest('input,select'))return;const i=Number(tr.dataset.scRow);if(e.shiftKey)selEnd=i;else{selRow=i;selEnd=null;}paintSel();};
 // 우클릭: 「운휴설정」·「운행설정」 (실기1 p.129)
 $('scheduleCalls').oncontextmenu=e=>{const tr=e.target.closest('[data-sc-row]');if(!tr||!draft)return;e.preventDefault();const i=Number(tr.dataset.scRow),[a,b]=[selRow,selEnd??selRow].sort((x,y)=>x-y);if(i<a||i>b){selRow=i;selEnd=null;paintSel();}
  const [lo,hi]=[selRow,selEnd??selRow].sort((x,y)=>x-y),range=[draft.calls[lo].station,draft.calls[hi].station],doc=SimDOM.document;
  doc.querySelector('.sc-menu')?.remove();const menu=doc.createElement('div');menu.className='sc-menu';menu.setAttribute('role','menu');
  menu.innerHTML=`<button type="button" role="menuitem" data-cx="1">운휴설정</button><button type="button" role="menuitem" data-cx="0">운행설정</button>`;
  menu.style.left=e.clientX+'px';menu.style.top=e.clientY+'px';doc.body.appendChild(menu);menu.querySelector('button').focus();
  const off=()=>{menu.remove();doc.removeEventListener('pointerdown',away,true);};const away=ev=>{if(!menu.contains(ev.target))off();};doc.addEventListener('pointerdown',away,true);
  menu.onkeydown=ev=>{if(ev.key==='Escape')off();};menu.onclick=ev=>{const b=ev.target.closest('[data-cx]');if(!b)return;off();cancelRange(b.dataset.cx==='1',range);};};
 $('schedulePrint').disabled=false;$('schedulePrint').removeAttribute('title');
 $('schedulePrint').onclick=()=>root.SimScheduleDialogs.openPrint(draft&&{...draft,id:mode()==='edit'?draft.id:$('scheduleNumber').value.trim().toUpperCase()});
 $('scheduleActual').disabled=false;$('scheduleActual').removeAttribute('title');
 $('scheduleActual').onclick=()=>{const t=draft&&model.trains.find(x=>x.id===draft.id);if(!t||mode()!=='edit'){notify('실적을 입력할 열차를 [수정]에서 조회하세요.');return;}root.SimScheduleDialogs.openActual(t,draft.calls[Math.min(selRow,draft.calls.length-1)].station,()=>table());};
 $('schedulePatternOpen').onclick=openPattern;
 $('scheduleApply').onclick=apply;
 $('scheduleSuspend').onclick=()=>cancelRange(true);$('scheduleResume').onclick=()=>cancelRange(false);
 root.SimScheduleUI={open(m,id){const M=root.SimMMI;M.open('schedule');SimDOM.document.querySelector(`input[name="scheduleMode"][value="${m}"]`).checked=true;$('scheduleSearch').value='';needle='';list(id||selectedId());load();}};
})(window);
