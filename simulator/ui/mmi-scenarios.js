(function(root){
'use strict';
// 관제 실기 시나리오 window: runs the 부본선 대피 exam scripts of scenarios.js. The 'do' steps tick themselves when the station
// state / operator events match (in order); the spoken 'say' lines are ticked by the operator. Grading is this simulator's own.
const doc=SimDOM.document,$=id=>doc.getElementById(id),SC=()=>root.SimScenarios;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmi=()=>root.SimMMI,EM=()=>root.SimEmergency,SS=()=>root.SimScheduleScenarios;
const all=()=>SC().list.concat(EM().list,SS().list);
const isEm=sc=>sc?.group==='emergency',isSch=sc=>sc?.group==='schedule';
let host=null,run=null,timer=null,passed=false,motion=null,motionStamp='';
// ---- the trains of the scenario on the LS 열번창 (direction + number), moved as the script advances
const lsm=()=>root.SimLSUI.getModel();
function findRow(number){
 for(const [station,st] of Object.entries(lsm().stations))for(const [slot,rows] of Object.entries(st.windows))for(const r of rows)if(r.number===number)return {station,slot,uid:r.uid};
 return null;
}
function clearNumbers(numbers){for(const n of numbers){let f;while((f=findRow(n)))root.SimLSUI.dispatch({op:'delete',...f});}}
function placeCast(){
 const sc=run.sc;clearNumbers(isEm(sc)?EM().numbersOf(sc):run.cast.map(c=>c.id));
 for(const c of run.cast){const r=root.SimLSUI.dispatch({op:'insert',station:c.station||sc.station,slot:c.slot,number:c.id,direction:c.dir});if(!r.ok)mmi().log('event',`열차번호 표시 실패 · ${c.id} · ${r.message}`);}
}
function moveCast(key,slot){
 const c=run.cast.find(x=>x.key===key);if(!c)return;
 const f=findRow(c.id);if(!f)return;
 if(slot===null)motion.request({op:'delete',...f});
 else if(f.slot!==slot)motion.request({op:'move',station:f.station,slot:f.slot,uid:f.uid,targetStation:run.sc.station,targetSlot:slot});
}
// when a tagged step is newly done, queue its moves (each `after` sim-seconds after the previous one); the queue runs on the station clock
function fireBeats(){
 run.sc.steps.forEach((s,i)=>{
  if(!s.tag||!run.done[i]||run.fired.has(s.tag))return;
  run.fired.add(s.tag);let due=station().clock;
  for(const m of SC().movesFor(run.sc,s.tag)){due+=m.after;run.queue.push({due,key:m.key,slot:m.slot});run.queue.sort((a,b)=>a.due-b.due);}
 });
}
function runQueue(){
 let moved=false;const now=station().clock;
 while(run.queue.length&&run.queue[0].due<=now){const m=run.queue.shift();moveCast(m.key,m.slot);moved=true;}
 if(moved)mmi().render();
}
const station=()=>host.context().stationStates[run.sc.station];
// what the operator has open on the MMI / T/G (for the 경합·스케줄생성 시나리오)
function uiState(){
 const open=id=>{const p=$(id);return !!p&&!p.hidden&&p.closest('[data-mmi-window]')?.hidden!==true;};
 return {graphOpen:open('graphPanel'),graphTrain:$('graphTrain')?.value||'',
  tgMode:doc.querySelector('.tg-tool[data-mode][aria-pressed="true"]')?.dataset.mode||doc.querySelector('[data-tg-mode][aria-checked="true"]')?.dataset.tgMode||'',
  station:$('stationSelect')?.value||'',scheduleOpen:open('schedulePanel'),scheduleMode:doc.querySelector('input[name="scheduleMode"]:checked')?.value||'',
  scheduleSelected:$('scheduleSelected')?.value||'',patternOpen:!!doc.querySelector('[data-mmi-window="ptnLoad"]:not([hidden]),[data-mmi-window="ptnLoadTg"]:not([hidden])')};
}
const ctx=()=>({state:station(),model:root.SimDiagram.getModel(),states:host.context().stationStates,ls:root.SimLSUI.getModel(),ui:uiState()});
function render(){
 const box=$('scSteps');if(!run){box.innerHTML='';return;}
 const fill=t=>SC().fill(t,run),firstOpen=run.sc.steps.findIndex((s,i)=>s.kind==='do'&&!run.done[i]);
 box.innerHTML=run.sc.steps.map((s,i)=>s.kind==='do'
  ?`<li class="sc-do ${run.done[i]?'done':''} ${i===firstOpen?'current':''}"><span class="sc-mark">${run.done[i]?'✔':i===firstOpen?'▶':'○'}</span><span>${esc(fill(s.text))}${i===firstOpen&&s.hint?`<small class="sc-hint">힌트: ${esc(s.hint)}</small>`:''}${i===firstOpen&&run.explain?`<small class="sc-hint sc-explain">${esc(run.explain)}</small>`:''}</span></li>`
  :`<li class="sc-say ${run.done[i]?'done':''}" data-speech-step="${i}"><div class="sc-speech"><span class="sc-mark">${run.done[i]?'✔':run.speechDue?.[i]?'▶':'○'}</span>${s.lines?`<span class="sc-lines"><b>${s.no}. ${esc(s.heading||'')}</b>${s.lines.map(l=>`<span>${esc(l)}</span>`).join('')}</span>`:`<span>${esc(fill(s.text))}</span>`}</div></li>`).join('');
 const total=run.sc.steps.length,doneCount=run.done.filter(Boolean).length;
 $('scProgress').textContent=`진행 ${doneCount}/${total}`;
 const doOpen=run.sc.steps.some((s,i)=>s.kind==='do'&&!run.done[i]),sayOpen=run.sc.steps.some((s,i)=>s.kind==='say'&&!run.done[i]);
 if(!doOpen&&!sayOpen&&(motion.busy()||run.queue.length))$('scStatus').textContent='조작·구술 완료 — 열차 이동과 도착을 기다리고 있습니다.';
 else if(!doOpen&&!sayOpen){const timing=root.SimAssessmentUI?.snapshot()?.task,late=timing?.key===run.assessmentKey&&(timing.timely===false||timing.overtime>0);$('scStatus').textContent=late?'조작·구술 완료 · 대본 제한시간 초과':'합격: 조작과 구술 항목을 모두 마쳤습니다. 이상입니다!';if(!passed){passed=true;if(!root.SimRemote)root.SimAssessmentUI?.complete(run.assessmentKey);if(!root.SimRemote)mmi().log('event',`${late?'실기 시나리오 절차 완료 · 시간초과':'실기 시나리오 합격'} · ${run.sc.title}`);}}
 else if(!doOpen)$('scStatus').textContent='조작은 모두 끝났습니다. 통보·구술 대본이 자동으로 진행됩니다.';
 else $('scStatus').textContent='진행 중 — ▶ 표시된 조작을 하세요. 조작은 위에서부터 순서대로 인식됩니다.';
}
let lastRemoteUI='';
let remoteStarted=null;
function remoteRender(){run=root.SimRemote.snapshot.scenario.run;if(run&&run.started!==remoteStarted){remoteStarted=run.started;$('scSelect').value=run.sc.id;fillTrains();$('scProblem').innerHTML=`<b>문제</b> ${esc(SC().fill(run.sc.problem||'',run))}<br><small>출처: ${esc(run.sc.source||'실기 시나리오')}</small>`;$('scNotes').innerHTML=(run.sc.notes||[]).map(n=>`<li>${esc(n)}</li>`).join('');}render();renderMotion();}
function evaluate(){if(root.SimRemote){const ui=uiState(),signature=JSON.stringify(ui);if(signature!==lastRemoteUI){lastRemoteUI=signature;root.SimRemote.command({type:'scenario:ui',ui});}remoteRender();return;}if(!run||mmi().replaying())return;const c=ctx();let redraw=SC().advance(run,c);redraw=root.SimScenarioFlow.advance(run,station().clock)||redraw;if(isSch(run.sc)){const k=run.sc.steps.findIndex((x,i)=>x.kind==='do'&&!run.done[i]),text=k>=0&&run.sc.steps[k].explain?run.sc.steps[k].explain(c):'';if(text!==run.explain){run.explain=text;redraw=true;}}if(isEm(run.sc)){if(EM().applyAutos(run.sc,run,a=>a.op==='move'||a.op==='delete'?motion.request(a):root.SimLSUI.dispatch(a),()=>root.SimLSUI.getModel()).length){for(const st of new Set([...run.sc.stations,...(run.sc.castStations||[])]))mmi().checkDuplicates(st);mmi().render();}}else{fireBeats();runQueue();}if(motion.step()){mmi().syncAll(host.context().stationStates);mmi().render();render();}renderMotion();const stamp=motion.list().map(j=>j.id+j.phase+j.reason).join('|');if(redraw||stamp!==motionStamp){motionStamp=stamp;render();}}
const current=()=>all().find(s=>s.id===$('scSelect').value);
// The faulty train is chosen from the CURRENT timetable (it changes from scenario to scenario); any number may also be typed.
function fillTrains(){
 const sc=current(),limits=root.SimAssessment.limitsFor(sc.id);$('scTimeLimit').innerHTML='<option value="">전체 시험시간만</option>'+limits.map(t=>`<option value="${t}">대본 ${root.SimAssessment.labelSeconds(t)}</option>`).join('');const timing=root.SimAssessmentUI?.snapshot()?.task;$('scTimeLimit').value=run?.sc.id===sc.id&&timing?.key===run.assessmentKey?String(timing.limitSeconds??''):limits.length?String(limits[0]):'';$('scTrainRow').hidden=isEm(sc)||isSch(sc);if(isEm(sc)||isSch(sc)){$('scTrainNote').textContent='';return;}
 const ids=SC().candidates(sc,root.SimDiagram.getModel());
 $('scTrainList').innerHTML=ids.map(id=>`<option value="${esc(id)}">`).join('');
 if(!ids.includes($('scTrain').value))$('scTrain').value=ids[0]||'';
 $('scTrainNote').textContent=ids.length?`${sc.direction==='up'?'상행':'하행'} · ${doc.getElementById('scSelect').selectedOptions[0].textContent.split(' ')[0]}에 서는 열차 ${ids.length}개`:'이 역에 서는 열차가 현재 시간표에 없습니다. 열차스케줄 관리에서 열차를 만들거나 번호를 직접 입력하세요.';
}
function startEmergency(sc){
 host.selectStation(sc.station);
 EM().seed(sc,host.context().stationStates);
 for(const st of sc.stations)mmi().rebase(st);
 run=SC().newRun(sc,'');passed=false;run.fired=new Set();run.queue=[];root.SimAssessmentUI?.beginScenario(sc,run,Number($('scTimeLimit').value)||null);
 run.cast=EM().castFor(sc).map(c=>({key:c.number,id:c.number,dir:c.dir,slot:c.slot,station:c.station}));placeCast();
 $('scProblem').innerHTML=`<b>상황</b> ${esc(sc.problem)}<br>${sc.trains.map(t=>`<small>${esc(t)}</small>`).join('<br>')}<br><small>LS 열번창 등장 열차: ${run.cast.map(c=>`${esc(c.id)}(${c.dir==='up'?'상':'하'} · ${esc(mmi().stationInfo(c.station).name)})`).join(' / ')} — 비연동역에 있는 열차는 구술로만 다룹니다 · 출처: ${esc(sc.source)}</small>`;
 $('scNotes').innerHTML=sc.notes.map(n=>`<li>${esc(n)}</li>`).join('');
 host.run({type:'tick',seconds:0});
 mmi().log('event',`실기 시나리오 시작 · ${sc.title}`);
 render();
}
function startSchedule(meta){
 const m=root.SimDiagram.getModel(),D=root.SimDrill;let sc;
 if(meta.id==='sch-conflict'){
  if(m.trains.some(t=>t.id===D.ID)){D.reset();}
  const r=D.createProblem({select:false});if(!r.ok){mmi().alertBox(r.message);return;}
  const other=m.trains.find(t=>t.id!==D.ID&&t.id!==r.leader)||m.trains.find(t=>t.id!==D.ID);if(other)root.SimDiagram.selectTrain(other.id);
  sc=SS().conflictScenario({id:D.ID,leader:r.leader,nearest:r.nearest,baseline:r.baseline});
 }else sc=SS().createScenario(SS().planCreate(m));
 run=SC().newRun(sc,'');passed=false;run.fired=new Set();run.queue=[];root.SimAssessmentUI?.beginScenario(sc,run,Number($('scTimeLimit').value)||null);run.cast=[];run.explain='';
 $('scProblem').innerHTML=`<b>문제</b> ${esc(sc.problem)}<br><small>출처: ${esc(sc.source)} · 시간표는 지금 불러온 것을 씁니다</small>`;
 $('scNotes').innerHTML=sc.notes.map(n=>`<li>${esc(n)}</li>`).join('');
 mmi().log('event',`실기 시나리오 시작 · ${sc.title}`);
 render();
}
function start(){
 if(root.SimRemote){
  const r=root.SimRemote.command({type:'scenario:start',id:current().id,train:$('scTrain').value.trim().toUpperCase(),ui:uiState(),limitSeconds:Number($('scTimeLimit').value)||null});
  if(!r.ok){mmi().alertBox(r.message);return;}
  if(r.station)host.selectStation(r.station);run=root.SimRemote.snapshot.scenario.run;passed=false;
  for(const id of Object.keys(host.context().stationStates))mmi().rebase(id);
  $('scProblem').innerHTML=`<b>문제</b> ${esc(SC().fill(run.sc.problem||'',run))}<br><small>출처: ${esc(run.sc.source||'실기 시나리오')}</small>`;
  $('scNotes').innerHTML=(run.sc.notes||[]).map(n=>`<li>${esc(n)}</li>`).join('');
  mmi().render();remoteRender();return;
 }
 motion.reset();if(run)clearNumbers(isEm(run.sc)?EM().numbersOf(run.sc):run.cast.map(c=>c.id));
 if(isSch(current()))return startSchedule(current());
 if(isEm(current()))return startEmergency(current());
 const sc=current(),train=$('scTrain').value.trim().toUpperCase();
 if(sc.steps.some(s=>s.kind==='do'&&/스케줄 수정/.test(s.text))&&!root.SimDiagram.getModel().trains.some(t=>t.id===train&&t.calls.some(c=>c.station===sc.station))){mmi().alertBox(`스케줄 수정 단계가 있어 ${train||'고장열차'}가 이 역에 서는 시간표 열차여야 합니다. 열차를 선택하세요.`);return;}
 host.selectStation(sc.station);
 SC().seed(sc,host.context().stationStates[sc.station]);
 mmi().rebase(sc.station);
 run=SC().newRun(sc,train);passed=false;run.fired=new Set();run.queue=[];root.SimAssessmentUI?.beginScenario(sc,run,Number($('scTimeLimit').value)||null);run.cast=SC().pickCast(sc,root.SimDiagram.getModel(),train);placeCast();
 $('scProblem').innerHTML=`<b>문제</b> ${esc(SC().fill(sc.problem,run))}<br><small>고장열차: ${esc(train||'지정 안 함')} · 출처: ${esc(sc.source)}</small><br><small>LS 열번창 등장 열차: ${run.cast.map(c=>`${esc(c.id)}(${c.dir==='up'?'상':'하'}${c.role==='fault'?' · 고장':c.role==='follow'?' · 후속':' · '+esc(c.label||'타 열차')})`).join(' / ')}</small>`;
 $('scNotes').innerHTML=sc.notes.map(n=>`<li>${esc(n)}</li>`).join('');
 host.run({type:'tick',seconds:0});   // redraw the LS with the seeded station
 mmi().log('event',`실기 시나리오 시작 · ${sc.title}`);
 render();
}
function init(api){
 host=api;
 motion=root.SimRemote?{list:()=>root.SimRemote.snapshot.scenario.jobs,busy:()=>root.SimRemote.snapshot.scenario.jobs.some(j=>!['done','cancelled'].includes(j.phase)),reset:()=>root.SimRemote.command({type:'scenario:stop'}),request:a=>root.SimRemote.command({type:'scenario:move',action:a})}:root.SimScenarioMotion.create({states:()=>host.context().stationStates,model:lsm,validate:a=>root.SimLSUI.validate(a),commit:a=>{const result=root.SimLSUI.dispatchDirect(a);if(result.ok){for(const id of new Set([a.station,a.targetStation]))if(id)mmi().checkDuplicates(id);mmi().log('event','시나리오 열차 이동 완료 · '+a.station+' '+a.slot+' → '+(a.targetSlot||'관제구간 밖'));if(run){SC().advance(run,ctx());render();}}return result;}});
 const win=mmi().createWindow('scenario',{title:'관제 실기 시나리오 (대피 5 · 비상 9 · 스케줄 2)',x:90,y:40,width:820,body:`<div class="rpt sc"><div class="rpt-cond"><label>시나리오<select id="scSelect"><optgroup label="부본선 대피">${SC().list.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</optgroup><optgroup label="비상시 조치">${EM().list.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</optgroup><optgroup label="스케줄 연습 (MMI·그래프)">${SS().list.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</optgroup></select></label><span id="scTrainRow"><label>고장열차<input id="scTrain" list="scTrainList" maxlength="6" autocomplete="off"><datalist id="scTrainList"></datalist></label><small id="scTrainNote"></small></span><button type="button" class="sched-btn primary" id="scStart">시작 (역 상태를 시나리오 초기값으로)</button><label>상황 제한<select id="scTimeLimit"></select></label><span id="scTimerStatus"></span><span id="scProgress"></span></div>
<div id="scProblem" class="sc-problem">시나리오를 고르고 [시작]을 누르세요.</div>
<p class="idm-note">통보·구술 대본과 열차 이동은 체크 없이 가상시계를 따라 자동 진행합니다. 실제 관제 조작이 필요한 단계에서는 조작을 기다립니다. 일시정지 시 멈추며, 진로 대기 이유와 도착 상태를 아래에서 확인할 수 있습니다.</p><div id="scMotionStatus" class="sc-motion-status" role="status"></div><ol id="scSteps" class="sc-steps"></ol>
<div id="scStatus" class="trc-msg" role="status"></div>
<ul id="scNotes" class="sc-notes"></ul>
<details class="sc-variants"><summary>상황변경 시 대응 요령 (비상시조치 평가 참고 원문)</summary><pre id="scVariants"></pre></details>
<div class="idm-note">교육용 구성 — 대본은 references/scenarios의 실기 대본이며, 열차번호는 지금 시간표의 열차를 고르거나 직접 입력합니다(시간표는 수시로 바뀌는 자료라 고정하지 않았습니다). 조작 인식과 채점은 이 시뮬레이터의 기능입니다. 시작하면 해당 역의 상태가 AUTO + 시나리오 초기 진로로 바뀝니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="scStop">시나리오 중지</button><button type="button" class="sched-btn" id="scClose">닫기</button></div></div>`});
 $('scVariants').textContent=EM().variants.lines.join('\n');
 $('scStop').onclick=()=>{if(!root.SimRemote&&run?.assessmentKey)root.SimAssessmentUI?.cancel(run.assessmentKey);motion.reset();run=null;passed=false;$('scSteps').innerHTML='';$('scProgress').textContent='';$('scStatus').textContent='시나리오 중지 · 이동 대기와 시나리오 점유를 정리했습니다.';renderMotion();mmi().render();};
 $('scStart').onclick=start;$('scSelect').onchange=fillTrains;win.opener=fillTrains;$('scClose').onclick=()=>mmi().close('scenario');

 mmi().onEvent(e=>{if(!run)return;run.events.push(e);evaluate();});
 timer=setInterval(evaluate,500);
}
function renderMotion(){
 const el=$('scMotionStatus');if(!el)return;
 const jobs=motion?.list().filter(j=>!['done','cancelled'].includes(j.phase))||[];
 el.hidden=!jobs.length;
 el.innerHTML=jobs.map(j=>`<div><b>${esc(j.number)}</b><span>${esc(mmi().stationInfo(j.fromStation||j.station).name)} · ${esc(j.from)} → ${j.action.targetStation?esc(mmi().stationInfo(j.action.targetStation).name)+' · ':''}${esc(j.to)}</span><small>${esc(j.reason)}</small></div>`).join('');
}
function intercept(){return null;}
function manualNumberAction(a){if(['move','swap','delete'].includes(a.op)){motion?.cancel?.(a.uid);if(a.targetUid)motion?.cancel?.(a.targetUid);}}

function actualPosition(train){
 if(root.SimRemote)return root.SimRemote.snapshot.auto.positions[train.id]||null;
 const f=findRow(train.id);if(!f)return null;
 const catalog=root.SimNetwork.catalog,j=motion?.list().find(j=>j.uid===f.uid&&!['done','cancelled'].includes(j.phase));
 const from=catalog[f.station];if(!from)return null;
 if(j?.phase==='handover'&&j.action.targetStation){const to=catalog[j.action.targetStation],now=host.context().stationStates[j.station].clock,fraction=Math.max(0,Math.min(1,(now-j.fromTime)/(j.until-j.fromTime)));
  return {station:f.station,nextStation:to.id,order:from.order+(to.order-from.order)*fraction,status:'관할 인계',actual:true};}
 return {station:f.station,order:from.order,status:j&&j.phase!=='waiting'?'진행':j?'진로 대기':'정차',actual:true};
}
root.SimScenarioUI={init,intercept,manualNumberAction,position:actualPosition,snapshot:()=>run?{id:run.sc.id,done:[...run.done],queue:[...run.queue],motions:motion.list()}:null,motionJobs:()=>motion?.list()||[],reservedNumbers:()=>root.SimRemote?root.SimRemote.snapshot.scenario.reserved:!run||isSch(run.sc)?[]:isEm(run.sc)?EM().numbersOf(run.sc):run.cast.map(c=>c.id),stepMotion:()=>{if(root.SimRemote){evaluate();return true;}if(!motion||!run||mmi().replaying())return false;const before=motion.list().map(j=>j.id+j.phase+j.reason).join('|');evaluate();return before!==motion.list().map(j=>j.id+j.phase+j.reason).join('|');}};
})(window);
