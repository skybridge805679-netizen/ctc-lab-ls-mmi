(function(root){
'use strict';
// 관제 실기 시나리오 창 (대피 5 · 비상 9 · 스케줄 2 대본): 대본 진행·채점·열차 이동은 모두 엔진(scenario-controller)이 한다.
// 이 창은 엔진 스냅샷의 대본 단계·이동 대기를 그리고, 시작·중지와 화면 상태(그래프·스케줄 창 열림)를 엔진에 보낸다.
const doc=SimDOM.document,$=id=>doc.getElementById(id),SC=()=>root.SimScenarios;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmi=()=>root.SimMMI,EM=()=>root.SimEmergency,SS=()=>root.SimScheduleScenarios;
const all=()=>SC().list.concat(EM().list,SS().list);
const isEm=sc=>sc?.group==='emergency',isSch=sc=>sc?.group==='schedule';
const engine=()=>root.SimRemote;
let host=null,run=null,lastUI='',started=null;
const jobs=()=>engine().snapshot.scenario.jobs||[];
// what the operator has open on the MMI / T/G (for the 경합·스케줄생성 시나리오)
function uiState(){
 const open=id=>{const p=$(id);return !!p&&!p.hidden&&p.closest('[data-mmi-window]')?.hidden!==true;};
 return {graphOpen:open('graphPanel'),graphTrain:$('graphTrain')?.value||'',
  tgMode:doc.querySelector('.tg-tool[data-mode][aria-pressed="true"]')?.dataset.mode||doc.querySelector('[data-tg-mode][aria-checked="true"]')?.dataset.tgMode||'',
  station:$('stationSelect')?.value||'',scheduleOpen:open('schedulePanel'),scheduleMode:doc.querySelector('input[name="scheduleMode"]:checked')?.value||'',
  scheduleSelected:$('scheduleSelected')?.value||'',patternOpen:!!doc.querySelector('[data-mmi-window="ptnLoad"]:not([hidden]),[data-mmi-window="ptnLoadTg"]:not([hidden])')};
}
function render(){
 const box=$('scSteps');if(!box)return;if(!run){box.innerHTML='';return;}
 const fill=t=>SC().fill(t,run),firstOpen=run.sc.steps.findIndex((s,i)=>s.kind==='do'&&!run.done[i]);
 box.innerHTML=run.sc.steps.map((s,i)=>s.kind==='do'
  ?`<li class="sc-do ${run.done[i]?'done':''} ${i===firstOpen?'current':''}"><span class="sc-mark">${run.done[i]?'✔':i===firstOpen?'▶':'○'}</span><span>${esc(fill(s.text))}${i===firstOpen&&s.hint?`<small class="sc-hint">힌트: ${esc(s.hint)}</small>`:''}${i===firstOpen&&run.explain?`<small class="sc-hint sc-explain">${esc(run.explain)}</small>`:''}</span></li>`
  :`<li class="sc-say ${run.done[i]?'done':''}" data-speech-step="${i}"><div class="sc-speech"><span class="sc-mark">${run.done[i]?'✔':run.speechDue?.[i]?'▶':'○'}</span>${s.lines?`<span class="sc-lines"><b>${s.no}. ${esc(s.heading||'')}</b>${s.lines.map(l=>`<span>${esc(l)}</span>`).join('')}</span>`:`<span>${esc(fill(s.text))}</span>`}</div></li>`).join('');
 $('scProgress').textContent=`진행 ${run.done.filter(Boolean).length}/${run.sc.steps.length}`;
 const doOpen=run.sc.steps.some((s,i)=>s.kind==='do'&&!run.done[i]),sayOpen=run.sc.steps.some((s,i)=>s.kind==='say'&&!run.done[i]),busy=jobs().some(j=>!['done','cancelled'].includes(j.phase));
 if(!doOpen&&!sayOpen&&(busy||run.queue?.length))$('scStatus').textContent='조작·구술 완료 — 열차 이동과 도착을 기다리고 있습니다.';
 else if(!doOpen&&!sayOpen){const timing=root.SimAssessmentUI?.snapshot()?.task,late=timing?.key===run.assessmentKey&&(timing.timely===false||timing.overtime>0);$('scStatus').textContent=late?'조작·구술 완료 · 대본 제한시간 초과':'합격: 조작과 구술 항목을 모두 마쳤습니다. 이상입니다!';}
 else if(!doOpen)$('scStatus').textContent='조작은 모두 끝났습니다. 통보·구술 대본이 자동으로 진행됩니다.';
 else $('scStatus').textContent='진행 중 — ▶ 표시된 조작을 하세요. 조작은 위에서부터 순서대로 인식됩니다.';
}
function renderMotion(){
 const el=$('scMotionStatus');if(!el)return;
 const open=jobs().filter(j=>!['done','cancelled'].includes(j.phase));
 el.hidden=!open.length;
 el.innerHTML=open.map(j=>`<div><b>${esc(j.number)}</b><span>${esc(mmi().stationInfo(j.fromStation||j.station).name)} · ${esc(j.from)} → ${j.action.targetStation?esc(mmi().stationInfo(j.action.targetStation).name)+' · ':''}${esc(j.to)}</span><small>${esc(j.reason)}</small></div>`).join('');
}
function showProblem(){
 if(!run)return;$('scSelect').value=run.sc.id;fillTrains();
 const cast=(run.cast||[]).map(c=>`${esc(c.id)}(${c.dir==='up'?'상':'하'}${c.key==='fault'?' · 고장':String(c.key).startsWith('follow')?' · 후속':c.key==='other'?' · '+esc(c.label||'타 열차'):' · '+esc(mmi().stationInfo(c.station||run.sc.station).name)})`).join(' / ');
 $('scProblem').innerHTML=`<b>${isEm(run.sc)?'상황':'문제'}</b> ${esc(SC().fill(run.sc.problem||'',run))}${isEm(run.sc)?'<br>'+(run.sc.trains||[]).map(t=>`<small>${esc(t)}</small>`).join('<br>'):''}${run.train?`<br><small>고장열차: ${esc(run.train)}</small>`:''}${cast?`<br><small>LS 열번창 등장 열차: ${cast}</small>`:''}<br><small>출처: ${esc(run.sc.source||'실기 시나리오')}</small>`;
 $('scNotes').innerHTML=(run.sc.notes||[]).map(n=>`<li>${esc(n)}</li>`).join('');
}
// 화면 상태가 바뀌면 엔진에 알리고(스케줄 대본의 조작 인식), 엔진의 대본 진행을 그린다
function evaluate(){
 if(!host||!$('scSteps'))return;
 // 화면 상태는 대본이 진행 중일 때만 엔진에 보낸다 (보낼 때마다 엔진 상태 판이 바뀌어 화면을 다시 그리게 된다)
 if(engine().snapshot.scenario.run){const ui=uiState(),signature=JSON.stringify(ui);if(signature!==lastUI){lastUI=signature;engine().command({type:'scenario:ui',ui});}}else lastUI='';
 run=engine().snapshot.scenario.run;if(run&&run.started!==started){started=run.started;showProblem();}
 render();renderMotion();
}
const current=()=>all().find(s=>s.id===$('scSelect').value);
// The faulty train is chosen from the CURRENT timetable (it changes from scenario to scenario); any number may also be typed.
function fillTrains(){
 const sc=current(),limits=root.SimAssessment.limitsFor(sc.id);$('scTimeLimit').innerHTML='<option value="">전체 시험시간만</option>'+limits.map(t=>`<option value="${t}">대본 ${root.SimAssessment.labelSeconds(t)}</option>`).join('');const timing=root.SimAssessmentUI?.snapshot()?.task;$('scTimeLimit').value=run?.sc.id===sc.id&&timing?.key===run.assessmentKey?String(timing.limitSeconds??''):limits.length?String(limits[0]):'';$('scTrainRow').hidden=isEm(sc)||isSch(sc);if(isEm(sc)||isSch(sc)){$('scTrainNote').textContent='';return;}
 const ids=SC().candidates(sc,root.SimDiagram.getModel());
 $('scTrainList').innerHTML=ids.map(id=>`<option value="${esc(id)}">`).join('');
 if(!ids.includes($('scTrain').value))$('scTrain').value=ids[0]||'';
 $('scTrainNote').textContent=ids.length?`${sc.direction==='up'?'상행':'하행'} · ${doc.getElementById('scSelect').selectedOptions[0].textContent.split(' ')[0]}에 서는 열차 ${ids.length}개`:'이 역에 서는 열차가 현재 시간표에 없습니다. 열차스케줄 관리에서 열차를 만들거나 번호를 직접 입력하세요.';
}
function start(){
 const r=engine().command({type:'scenario:start',id:current().id,train:$('scTrain').value.trim().toUpperCase(),ui:uiState(),limitSeconds:Number($('scTimeLimit').value)||null});
 if(!r.ok){mmi().alertBox(r.message);return;}
 if(r.station)host.selectStation(r.station);
 for(const id of Object.keys(host.context().stationStates))mmi().rebase(id);
 run=engine().snapshot.scenario.run;started=run?.started;showProblem();mmi().render();render();renderMotion();
}
function init(api){
 host=api;
 const win=mmi().createWindow('scenario',{title:'관제 실기 시나리오 (대피 5 · 비상 9 · 스케줄 2)',x:90,y:40,width:820,body:`<div class="rpt sc"><div class="rpt-cond"><label>시나리오<select id="scSelect"><optgroup label="부본선 대피">${SC().list.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</optgroup><optgroup label="비상시 조치">${EM().list.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</optgroup><optgroup label="스케줄 연습 (MMI·그래프)">${SS().list.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</optgroup></select></label><span id="scTrainRow"><label>고장열차<input id="scTrain" list="scTrainList" maxlength="6" autocomplete="off"><datalist id="scTrainList"></datalist></label><small id="scTrainNote"></small></span><button type="button" class="sched-btn primary" id="scStart">시작 (역 상태를 시나리오 초기값으로)</button><label>상황 제한<select id="scTimeLimit"></select></label><span id="scTimerStatus"></span><span id="scProgress"></span></div>
<div id="scProblem" class="sc-problem">시나리오를 고르고 [시작]을 누르세요.</div>
<p class="idm-note">통보·구술 대본과 열차 이동은 체크 없이 가상시계를 따라 자동 진행합니다. 실제 관제 조작이 필요한 단계에서는 조작을 기다립니다. 일시정지 시 멈추며, 진로 대기 이유와 도착 상태를 아래에서 확인할 수 있습니다.</p><div id="scMotionStatus" class="sc-motion-status" role="status"></div><ol id="scSteps" class="sc-steps"></ol>
<div id="scStatus" class="trc-msg" role="status"></div>
<ul id="scNotes" class="sc-notes"></ul>
<details class="sc-variants"><summary>상황변경 시 대응 요령 (비상시조치 평가 참고 원문)</summary><pre id="scVariants"></pre></details>
<div class="idm-note">교육용 구성 — 대본은 references/scenarios의 실기 대본이며, 열차번호는 지금 시간표의 열차를 고르거나 직접 입력합니다(시간표는 수시로 바뀌는 자료라 고정하지 않았습니다). 조작 인식과 채점은 이 시뮬레이터의 기능입니다. 시작하면 해당 역의 상태가 AUTO + 시나리오 초기 진로로 바뀝니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="scStop">시나리오 중지</button><button type="button" class="sched-btn" id="scClose">닫기</button></div></div>`});
 $('scVariants').textContent=EM().variants.lines.join('\n');
 $('scStop').onclick=()=>{const r=engine().command({type:'scenario:stop'});if(r?.ok===false){mmi().alertBox(r.message);return;}run=null;$('scSteps').innerHTML='';$('scProgress').textContent='';$('scStatus').textContent='시나리오 중지 · 이동 대기와 시나리오 점유를 정리했습니다.';renderMotion();mmi().render();};
 $('scStart').onclick=start;$('scSelect').onchange=fillTrains;win.opener=fillTrains;$('scClose').onclick=()=>mmi().close('scenario');
 mmi().onEvent(()=>evaluate());
 setInterval(evaluate,500);
}
root.SimScenarioUI={
 request:a=>engine().command({type:'scenario:move',action:a}),
 init,intercept:()=>null,manualNumberAction:()=>{},
 position:train=>engine().snapshot.auto.positions[train.id]||null,
 snapshot:()=>run?{id:run.sc.id,passed:!!run.passed,done:[...run.done],queue:[...(run.queue||[])],motions:jobs()}:null,
 motionJobs:()=>jobs(),reservedNumbers:()=>engine().snapshot.scenario.reserved,
 stepMotion:()=>{evaluate();return true;}
};
})(window);
