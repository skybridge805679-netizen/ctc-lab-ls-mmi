(function(root){
'use strict';
// 관제 실기 시나리오 window: runs the 부본선 대피 exam scripts of scenarios.js. The 'do' steps tick themselves when the station
// state / operator events match (in order); the spoken 'say' lines are ticked by the operator. Grading is this simulator's own.
const doc=document,$=id=>doc.getElementById(id),SC=()=>root.SimScenarios;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmi=()=>root.SimMMI;
let host=null,run=null,timer=null,passed=false;
// ---- the trains of the scenario on the LS 열번창 (direction + number), moved as the script advances
const lsm=()=>root.SimLSUI.getModel();
function findRow(number){
 for(const [station,st] of Object.entries(lsm().stations))for(const [slot,rows] of Object.entries(st.windows))for(const r of rows)if(r.number===number)return {station,slot,uid:r.uid};
 return null;
}
function clearNumbers(numbers){for(const n of numbers){let f;while((f=findRow(n)))root.SimLSUI.dispatch({op:'delete',...f});}}
function placeCast(){
 const sc=run.sc;clearNumbers(run.cast.map(c=>c.id));
 for(const c of run.cast){const r=root.SimLSUI.dispatch({op:'insert',station:sc.station,slot:c.slot,number:c.id,direction:c.dir});if(!r.ok)mmi().log('event',`열차번호 표시 실패 · ${c.id} · ${r.message}`);}
}
function moveCast(key,slot){
 const c=run.cast.find(x=>x.key===key);if(!c)return;
 const f=findRow(c.id);if(!f)return;
 if(slot===null)root.SimLSUI.dispatch({op:'delete',...f});
 else if(f.slot!==slot)root.SimLSUI.dispatch({op:'move',station:f.station,slot:f.slot,uid:f.uid,targetStation:run.sc.station,targetSlot:slot});
}
// when a tagged step is newly done, queue its moves (each `after` sim-seconds after the previous one); the queue runs on the station clock
function fireBeats(){
 run.sc.steps.forEach((s,i)=>{
  if(!s.tag||!run.done[i]||run.fired.has(s.tag))return;
  run.fired.add(s.tag);let due=station().clock;
  for(const m of SC().movesFor(run.sc,s.tag)){due+=m.after;run.queue.push({due,key:m.key,slot:m.slot});}
 });
}
function runQueue(){
 let moved=false;const now=station().clock;
 while(run.queue.length&&run.queue[0].due<=now){const m=run.queue.shift();moveCast(m.key,m.slot);moved=true;}
 if(moved)mmi().render();
}
const station=()=>host.context().stationStates[run.sc.station];
const ctx=()=>({state:station(),model:root.SimDiagram.getModel()});
function render(){
 const box=$('scSteps');if(!run){box.innerHTML='';return;}
 const fill=t=>SC().fill(t,run),firstOpen=run.sc.steps.findIndex((s,i)=>s.kind==='do'&&!run.done[i]);
 box.innerHTML=run.sc.steps.map((s,i)=>s.kind==='do'
  ?`<li class="sc-do ${run.done[i]?'done':''} ${i===firstOpen?'current':''}"><span class="sc-mark">${run.done[i]?'✔':i===firstOpen?'▶':'○'}</span><span>${esc(fill(s.text))}${i===firstOpen&&s.hint?`<small class="sc-hint">힌트: ${esc(s.hint)}</small>`:''}</span></li>`
  :`<li class="sc-say ${run.done[i]?'done':''}"><label><input type="checkbox" data-say="${i}" ${run.done[i]?'checked':''}><span>${esc(fill(s.text))}</span></label></li>`).join('');
 const total=run.sc.steps.length,doneCount=run.done.filter(Boolean).length;
 $('scProgress').textContent=`진행 ${doneCount}/${total}`;
 const doOpen=run.sc.steps.some((s,i)=>s.kind==='do'&&!run.done[i]),sayOpen=run.sc.steps.some((s,i)=>s.kind==='say'&&!run.done[i]);
 if(!doOpen&&!sayOpen){$('scStatus').textContent='합격: 조작과 구술 항목을 모두 마쳤습니다. 이상입니다!';if(!passed){passed=true;mmi().log('event',`실기 시나리오 합격 · ${run.sc.title}`);}}
 else if(!doOpen)$('scStatus').textContent='조작은 모두 끝났습니다. 남은 구술(체크) 항목을 확인하세요.';
 else $('scStatus').textContent='진행 중 — ▶ 표시된 조작을 하세요. 조작은 위에서부터 순서대로 인식됩니다.';
}
function evaluate(){if(!run)return;if(SC().advance(run,ctx()))render();fireBeats();runQueue();}
const current=()=>SC().list.find(s=>s.id===$('scSelect').value);
// The faulty train is chosen from the CURRENT timetable (it changes from scenario to scenario); any number may also be typed.
function fillTrains(){
 const sc=current(),ids=SC().candidates(sc,root.SimDiagram.getModel());
 $('scTrainList').innerHTML=ids.map(id=>`<option value="${esc(id)}">`).join('');
 if(!ids.includes($('scTrain').value))$('scTrain').value=ids[0]||'';
 $('scTrainNote').textContent=ids.length?`${sc.direction==='up'?'상행':'하행'} · ${doc.getElementById('scSelect').selectedOptions[0].textContent.split(' ')[0]}에 서는 열차 ${ids.length}개`:'이 역에 서는 열차가 현재 시간표에 없습니다. 열차스케줄 관리에서 열차를 만들거나 번호를 직접 입력하세요.';
}
function start(){
 const sc=current(),train=$('scTrain').value.trim().toUpperCase();
 if(sc.steps.some(s=>s.kind==='do'&&/스케줄 수정/.test(s.text))&&!root.SimDiagram.getModel().trains.some(t=>t.id===train&&t.calls.some(c=>c.station===sc.station))){mmi().alertBox(`스케줄 수정 단계가 있어 ${train||'고장열차'}가 이 역에 서는 시간표 열차여야 합니다. 열차를 선택하세요.`);return;}
 host.selectStation(sc.station);
 SC().seed(sc,host.context().stationStates[sc.station]);
 mmi().rebase(sc.station);
 run=SC().newRun(sc,train);passed=false;run.fired=new Set();run.queue=[];run.cast=SC().pickCast(sc,root.SimDiagram.getModel(),train);placeCast();
 $('scProblem').innerHTML=`<b>문제</b> ${esc(SC().fill(sc.problem,run))}<br><small>고장열차: ${esc(train||'지정 안 함')} · 출처: ${esc(sc.source)}</small><br><small>LS 열번창 등장 열차: ${run.cast.map(c=>`${esc(c.id)}(${c.dir==='up'?'상':'하'}${c.role==='fault'?' · 고장':c.role==='follow'?' · 후속':' · '+esc(c.label||'타 열차')})`).join(' / ')}</small>`;
 $('scNotes').innerHTML=sc.notes.map(n=>`<li>${esc(n)}</li>`).join('');
 host.run({type:'tick',seconds:0});   // redraw the LS with the seeded station
 mmi().log('event',`실기 시나리오 시작 · ${sc.title}`);
 render();
}
function init(api){
 host=api;
 const win=mmi().createWindow('scenario',{title:'관제 실기 시나리오 (대피 5종)',x:90,y:40,width:820,body:`<div class="rpt sc"><div class="rpt-cond"><label>시나리오<select id="scSelect">${SC().list.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></label><label>고장열차<input id="scTrain" list="scTrainList" maxlength="6" autocomplete="off"><datalist id="scTrainList"></datalist></label><small id="scTrainNote"></small><button type="button" class="sched-btn primary" id="scStart">시작 (역 상태를 시나리오 초기값으로)</button><span id="scProgress"></span></div>
<div id="scProblem" class="sc-problem">시나리오를 고르고 [시작]을 누르세요.</div>
<ol id="scSteps" class="sc-steps"></ol>
<div id="scStatus" class="trc-msg" role="status"></div>
<ul id="scNotes" class="sc-notes"></ul>
<div class="idm-note">교육용 구성 — 대본은 references/scenarios의 실기 대본이며, 열차번호는 지금 시간표의 열차를 고르거나 직접 입력합니다(시간표는 수시로 바뀌는 자료라 고정하지 않았습니다). 조작 인식과 채점은 이 시뮬레이터의 기능입니다. 시작하면 해당 역의 상태가 AUTO + 시나리오 초기 진로로 바뀝니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="scClose">닫기</button></div></div>`});
 $('scStart').onclick=start;$('scSelect').onchange=fillTrains;win.opener=fillTrains;$('scClose').onclick=()=>mmi().close('scenario');
 $('scSteps').onchange=e=>{const i=e.target.dataset?.say;if(i===undefined||!run)return;run.done[Number(i)]=e.target.checked;render();};
 mmi().onEvent(e=>{if(!run)return;run.events.push(e);evaluate();});
 timer=setInterval(evaluate,500);
}
root.SimScenarioUI={init};
})(window);
