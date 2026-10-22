(function(root){
'use strict';
// 관제 실기 시나리오 window: runs the 부본선 대피 exam scripts of scenarios.js. The 'do' steps tick themselves when the station
// state / operator events match (in order); the spoken 'say' lines are ticked by the operator. Grading is this simulator's own.
const doc=document,$=id=>doc.getElementById(id),SC=()=>root.SimScenarios;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmi=()=>root.SimMMI;
let host=null,run=null,timer=null,passed=false;
const station=()=>host.context().stationStates[run.sc.station];
const ctx=()=>({state:station(),model:root.SimDiagram.getModel()});
function render(){
 const box=$('scSteps');if(!run){box.innerHTML='';return;}
 const firstOpen=run.sc.steps.findIndex((s,i)=>s.kind==='do'&&!run.done[i]);
 box.innerHTML=run.sc.steps.map((s,i)=>s.kind==='do'
  ?`<li class="sc-do ${run.done[i]?'done':''} ${i===firstOpen?'current':''}"><span class="sc-mark">${run.done[i]?'✔':i===firstOpen?'▶':'○'}</span><span>${esc(s.text)}${i===firstOpen&&s.hint?`<small class="sc-hint">힌트: ${esc(s.hint)}</small>`:''}</span></li>`
  :`<li class="sc-say ${run.done[i]?'done':''}"><label><input type="checkbox" data-say="${i}" ${run.done[i]?'checked':''}><span>${esc(s.text)}</span></label></li>`).join('');
 const total=run.sc.steps.length,doneCount=run.done.filter(Boolean).length;
 $('scProgress').textContent=`진행 ${doneCount}/${total}`;
 const doOpen=run.sc.steps.some((s,i)=>s.kind==='do'&&!run.done[i]),sayOpen=run.sc.steps.some((s,i)=>s.kind==='say'&&!run.done[i]);
 if(!doOpen&&!sayOpen){$('scStatus').textContent='합격: 조작과 구술 항목을 모두 마쳤습니다. 이상입니다!';if(!passed){passed=true;mmi().log('event',`실기 시나리오 합격 · ${run.sc.title}`);}}
 else if(!doOpen)$('scStatus').textContent='조작은 모두 끝났습니다. 남은 구술(체크) 항목을 확인하세요.';
 else $('scStatus').textContent='진행 중 — ▶ 표시된 조작을 하세요. 조작은 위에서부터 순서대로 인식됩니다.';
}
function evaluate(){if(!run)return;if(SC().advance(run,ctx()))render();}
function start(){
 const sc=SC().list.find(s=>s.id===$('scSelect').value);
 host.selectStation(sc.station);
 SC().seed(sc,host.context().stationStates[sc.station]);
 mmi().rebase(sc.station);
 run=SC().newRun(sc);passed=false;
 $('scProblem').innerHTML=`<b>문제</b> ${esc(sc.problem)}<br><small>${esc(sc.trains)} · 출처: ${esc(sc.source)}</small>`;
 $('scNotes').innerHTML=sc.notes.map(n=>`<li>${esc(n)}</li>`).join('');
 host.run({type:'tick',seconds:0});   // redraw the LS with the seeded station
 mmi().log('event',`실기 시나리오 시작 · ${sc.title}`);
 render();
}
function init(api){
 host=api;
 mmi().createWindow('scenario',{title:'관제 실기 시나리오 (대피 5종)',x:90,y:40,width:820,body:`<div class="rpt sc"><div class="rpt-cond"><label>시나리오<select id="scSelect">${SC().list.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></label><button type="button" class="sched-btn primary" id="scStart">시작 (역 상태를 시나리오 초기값으로)</button><span id="scProgress"></span></div>
<div id="scProblem" class="sc-problem">시나리오를 고르고 [시작]을 누르세요.</div>
<ol id="scSteps" class="sc-steps"></ol>
<div id="scStatus" class="trc-msg" role="status"></div>
<ul id="scNotes" class="sc-notes"></ul>
<div class="idm-note">교육용 구성 — 대본은 references/scenarios의 실기 대본이며, 열차번호는 시뮬레이터의 열차로 바꿨습니다. 조작 인식과 채점은 이 시뮬레이터의 기능입니다. 시작하면 해당 역의 상태가 AUTO + 시나리오 초기 진로로 바뀝니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="scClose">닫기</button></div></div>`});
 $('scStart').onclick=start;$('scClose').onclick=()=>mmi().close('scenario');
 $('scSteps').onchange=e=>{const i=e.target.dataset?.say;if(i===undefined||!run)return;run.done[Number(i)]=e.target.checked;render();};
 mmi().onEvent(e=>{if(!run)return;run.events.push(e);evaluate();});
 timer=setInterval(evaluate,500);
}
root.SimScenarioUI={init};
})(window);
