'use strict';
const $=id=>SimDOM.document.getElementById(id),N=window.SimNetwork;
const session=window.SimSession.create(),stationStates=session.states;
let C=session.core(session.selected),selectedStation=session.selected;
let selectedView=window.SimLSPresets.get(new URLSearchParams(location.search).get('lsStation'))?.id||selectedStation;
const lsViews=window.SimLSPresets.list();
let state=stationStates[selectedStation],paused=window.SimRemote?.snapshot.clock.paused??false,practice='guided',activeTask=null,taskIndex=0,taskStart=0,taskTimerKey=null,dialogAction=null,toastTimer,completed=[];
try{completed=JSON.parse(localStorage.getItem('ctclab-v03-completed')||'[]');if(!Array.isArray(completed))completed=[];}catch{}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
const tasks=window.SimPractice.tasks;
completed=[...new Set(completed.filter(i=>Number.isInteger(i)&&i>=0&&i<tasks.length))];
function toast(msg,error=false){$('toast').textContent=msg;$('toast').className='show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').className='',5000);}
function run(a){let r;if(['route','occupy'].includes(a.type)&&window.SimLine)window.SimLine.refresh(stationStates,window.SimLSUI?.getModel?.());if(window.SimMMI?.replaying?.()){toast('로그재생 중에는 조작할 수 없습니다. 재생 창의 ■ 종료를 누르세요.',true);return {ok:false,message:'로그재생 중'};}if(a.type==='tick'){session.tick(a.seconds);window.SimScenarioUI?.stepMotion();window.SimAutoUI?.step();r={ok:true};}else if(a.type==='scan'&&a.scope==='all'){for(const [id,st]of Object.entries(stationStates))session.core(id).dispatch(st,a);r={ok:true,message:'전체 15개 취급역 상태 재수신'};}else if(a.type==='lsOperation'){r=window.SimLSUI.dispatch(a.operation);if(!window.SimRemote)state.logs.unshift({time:state.clock,source:a.source||'LS',action:a.operation.op,result:r.ok?(r.pending?'접수':'완료'):'보류',message:r.message});if(r.ok&&!window.SimRemote)state.events.push({...a,time:state.clock});}else r=session.dispatch(selectedStation,a);if(window.SimMMI){if(a.type==='tick')window.SimMMI.syncAll(stationStates);else window.SimMMI.sync(selectedStation,state,a,r);}render();if(a.type!=='tick')toast(r.message,!r.ok);return r;}
// variant: '' = 기본 대화상자, 'route' = 신호기 옆 진로 제어 팝업(사진), 'confirm' = 윈도 스타일 제어 확인 상자(사진: 해정 하시겠습니까?)
function openAction(title,body,action,label='예 · 실행',variant='',at=null){
 const d=$('actionDialog');$('dialogConfirm').hidden=false;$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;dialogAction=action;d.returnValue='';
 $('dialogConfirm').textContent=label;d.querySelector('[value="cancel"]').textContent=variant==='confirm'?'아니요(N)':'아니오 · 취소';d.dataset.variant=variant;d.classList.toggle('mode-confirm',variant==='confirm');
 if(at){d.style.setProperty('--dx',Math.max(4,Math.min(at.x,innerWidth-200))+'px');d.style.setProperty('--dy',Math.max(4,Math.min(at.y,innerHeight-120))+'px');}
 d.showModal();
 if(variant==='route'&&at){const box=d.getBoundingClientRect();d.style.setProperty('--dx',Math.max(4,Math.min(at.x,innerWidth-box.width-4))+'px');d.style.setProperty('--dy',Math.max(4,Math.min(at.y,innerHeight-box.height-4))+'px');}
}
function routeDetails(id){const r=C.routes[id];return `<div class="route-detail"><b>${escapeHTML(id)}</b><p>${r.pathTracks.join(' → ')}</p><p class="evidence">${r.evidence}</p><p>${r.source.map(escapeHTML).join('<br>')}</p><p class="pending-note">배선 연결 연습 모델 · 경로의 공유 구간·전환기를 쇄정합니다. 실설비 진로표와 세부 연동조건은 별도 검증 대상입니다</p></div>`;}
const statusLabel={SET:'설정',OCCUPIED:'점유',LOCKED:'쇄정',APPROACH_LOCK:'접근쇄정'};
function boardTrains(){const ids=[...new Set(Object.values(C.routes).filter(r=>C.lockSeconds(r.signal)).map(r=>r.signal))];return ids.map(id=>{const on=!!state.approach?.[id],sec=C.lockSeconds(id);return `<button class="train-chip ${on?'on':''}" data-approach-toggle="${id}" aria-pressed="${on}" title="${id} 외방 접근구간 열차 ${on?'제거':'투입'}">${id}<small>${on?'접근 열차 있음':'열차 없음'} · ${sec}초</small></button>`;}).join('');}
function drawBoard(){
 const rows=C.lockTable(state),active=Object.keys(state.routes);
 const head='<div class="board-head"><h3>진로 · 쇄정 현황</h3><span>접근쇄정은 접근 열차가 있을 때만 걸립니다 · 장내 90초 / 출발 30초</span></div>';
 const trains=C.lockSeconds&&Object.keys(C.routes).length?`<div class="board-trains"><b>접근 열차 투입</b><div>${boardTrains()}</div></div>`:'';
 const list=rows.length?rows.map(r=>{const a=state.routes[r.id],pct=r.total?Math.round((r.total-r.remaining)/r.total*100):0;
  return `<article class="lock-row ${a.occupied?'occupied':a.lock?'locked':'set'}" data-lock-row="${r.id}"><header><b>${escapeHTML(r.id)}</b><span class="chip ${a.occupied?'occupied':a.lock?'locked':'set'}">${statusLabel[a.status]||a.status}</span><span class="muted">${a.control==='continuous'?'연속제어':'단일제어'}</span></header>`
  +(a.lock?`<div class="lock-timer" role="progressbar" aria-valuemin="0" aria-valuemax="${r.total}" aria-valuenow="${r.total-r.remaining}"><i style="width:${pct}%"></i><span>접근쇄정 남은 <b data-lock-remaining>${r.remaining}</b>초 / ${r.total}초</span></div>`:'')
  +(r.overlap?`<p class="overlap-note"><span class="chip overlap">오버랩</span> ${escapeHTML(r.overlap.note)}${Object.keys(r.overlap.points).length?' · 전환기 '+Object.entries(r.overlap.points).map(([p,v])=>p+(v==='N'?' 정위':' 반위')).join(', ')+' 쇄정':''}</p>`:'')
  +`<div class="route-run-controls"><button data-sim-enter="${r.id}" ${a.occupied||a.lock?'disabled':''}>모의 열차 진입</button><button data-sim-clear="${r.id}" ${a.occupied?'':'disabled'}>모의 열차 통과</button></div>${routeDetails(r.id)}</article>`;}).join(''):'<p class="evidence-empty">설정된 진로가 없습니다. 취급역의 CCM → 신호기 → 진로를 선택하세요.</p>';
 $('routeEvidence').innerHTML=head+trains+`<div class="lock-list">${list}</div>`;
}
// 열번창에 열차번호가 서 있는 궤도회로 = 열차 점유 (FTS는 이 구간을 붉게 표시)
// a train is still running over a route: the red occupied part moves with the clock, so redraw every tick
function trainRunning(s){return Object.values(s.routes).some(r=>r.occupied&&r.train&&s.clock<=r.train.to+1)||(s.scenarioMotions||[]).some(m=>s.clock<=m.to+1);}
function trainOccupied(id){const st=window.SimLSUI?.getModel?.().stations?.[id],set=new Set(Object.keys(stationStates[id]?.circuitOccupied||{}));if(st)for(const [slot,rows] of Object.entries(st.windows))if(rows.some(t=>!window.SimScenarioMotion?.inTransit(stationStates[id],t.uid)&&!window.SimLine?.journeys.has(t.number)))set.add(slot);return set;}
function drawTracks(){
 const monitor=!!window.SimLSPresets.get(selectedView).monitor,stage=$('lsStage'),aspect=stage.clientWidth/Math.max(160,stage.clientHeight-(monitor?0:stage.querySelector('.ls-head')?.offsetHeight||52)-14);
 const st=N.catalog[selectedStation],at=lsViews.findIndex(v=>v.id===selectedView),view=window.SimLS.render(st,window.SimWiring.data[selectedStation],C,state,{aspect,preset:selectedView,left:lsViews[at-1],right:lsViews[at+1],occupied:trainOccupied(selectedStation)});
 const head=monitor?'':`<div class="ls-head"><div class="ls-modes" role="group" aria-label="${st.name} 역제어모드">${['AUTO','CCM','LOCAL'].map(m=>`<button type="button" class="mode-btn ${m.toLowerCase()} ${state.mode===m?'on':''}" data-mode="${m}" aria-pressed="${state.mode===m}">${m}</button>`).join('')}</div><button type="button" class="stop-all" data-stop-all="true" aria-label="신호기 일괄정지"><span>신호기</span><span>일괄정지</span></button><div class="ls-name ${['cheongnyangni','dongmyo','jonggak','underground-seoul'].includes(selectedStation)?'metro':''}"><b>${escapeHTML(monitor?window.SimLSPresets.get(selectedView).name:window.SimMMI?.stationInfo(selectedStation).name||st.name)}</b><span>${st.code}</span></div><div class="ls-equipment" aria-label="원본 장치 표시">${['N1','N2','C','REC','UPS','ShP','EIS1','EIS2','DTS1','DTS2','RC'].map(name=>`<span data-equipment="${name}" title="${name} · 장치 통신 상태 미연결">${name}</span>`).join('')}</div></div>`;
 $('lsStage').dataset.controlStation=monitor?'':selectedStation;$('lsStage').dataset.preset=selectedView;$('lsStage').dataset.monitor=String(monitor);
 if(window.SimExtraLS)document.title='ORPHEIA · LS · '+window.SimLSPresets.get(selectedView).name;
 $('lsStage').innerHTML=head+`<svg id="trackSvg" class="ls-svg" data-monitor="${monitor}" viewBox="0 0 ${view.width} ${view.height}" role="img" aria-label="${escapeHTML(window.SimLSPresets.get(selectedView).name)} LS 선로 배선">${view.svg}</svg>`;
 window.SimLSUI.decorate();drawBoard();if(!monitor)window.SimEquipment?.paint(selectedStation);
}
$('routeEvidence').onclick=e=>{const tg=e.target.closest('[data-approach-toggle]');if(tg){run({type:'approach',signal:tg.dataset.approachToggle,present:!state.approach?.[tg.dataset.approachToggle],source:'모의운행'});return;}const enter=e.target.closest('[data-sim-enter]'),clear=e.target.closest('[data-sim-clear]');if(enter)run({type:'occupy',id:enter.dataset.simEnter,source:'모의운행'});if(clear)run({type:'clear',id:clear.dataset.simClear,source:'모의운행'});};
function selectStation(id,scroll=true){
 const view=window.SimLSPresets.get(id);if(!view)return;id=view.station;
 if(!N.catalog[id]?.controlled)return;
 if($('actionDialog').open){toast('제어 확인창을 닫은 뒤 역을 변경하세요.',true);$('stationSelect').value=selectedStation;$('lsStationSelect').value=selectedView;return;}
 window.SimLSUI.stationChanged();stationStates[selectedStation]=state;
 selectedStation=id;selectedView=view.id;state=session.select(id);C=session.core(id);
 $('stationSelect').value=id;showViewOption(view);
 fields();render();taskView();
}
// 역간 감시 화면은 하단 목록에 없으므로, 노란 화살표로 들어온 동안만 임시 항목으로 보여 준다.
function showViewOption(view){const el=$('lsStationSelect');el.querySelectorAll('option[data-transient]').forEach(o=>{if(o.value!==view.id)o.remove();});if(![...el.options].some(o=>o.value===view.id)){const o=document.createElement('option');o.value=view.id;o.textContent=view.name;o.dataset.transient='1';el.appendChild(o);}el.value=view.id;}
const stationOptions=N.stations.filter(st=>st.controlled).map(st=>`<option value="${st.id}">${st.name}${st.controlled?' ['+st.code+']':' · 비연동'}</option>`).join('');
$('stationSelect').innerHTML=stationOptions;$('lsStationSelect').innerHTML=lsViews.filter(v=>!v.monitor||v.id===selectedView).map(v=>`<option value="${v.id}">${v.name}${v.id===v.station?' ['+N.catalog[v.station].code+']':''}</option>`).join('');
$('stationSelect').value=selectedStation;$('lsStationSelect').value=selectedView;
window.SimPreferred&&window.SimPreferred.apply();
$('stationSelect').onchange=e=>selectStation(e.target.value);$('lsStationSelect').onchange=e=>selectStation(e.target.value);
$('stationTabs').innerHTML=lsViews.filter(v=>!v.monitor).map(v=>`<button data-station="${v.station}" data-view="${v.id}"><i class="tab-dot auto" aria-hidden="true"></i>${v.name}<b class="tab-count"></b></button>`).join('');
$('stationTabs').onclick=e=>{const button=e.target.closest('[data-view]');if(button)selectStation(button.dataset.view);};
for(const [id,step]of [['previousStation',-1],['nextStation',1]])$(id).onclick=()=>{const next=lsViews[lsViews.findIndex(v=>v.id===selectedView)+step];if(next)selectStation(next.id);};
function renderLogs(){$('logCount').textContent=state.logs.length+' events';$('logList').innerHTML=state.logs.length?state.logs.slice(0,100).map(l=>`<div class="log-row"><span class="log-time">${time(l.time)}</span><div><p>${escapeHTML(l.message)}</p><div class="log-meta">${escapeHTML(l.source)} · <span class="${['완료','접수'].includes(l.result)?'result-ok':'result-bad'}">${l.result}</span></div></div></div>`).join(''):'<p class="empty">첫 조작을 기다리고 있습니다.</p>';}
function render(){
 const task=window.SimAssessmentUI?.snapshot()?.task;if(!window.SimRemote&&task?.key===taskTimerKey&&['running','expired'].includes(task.status)&&activeTask!==null){const s=stationStates['underground-seoul'];if(tasks[activeTask].check(s.events.slice(taskStart),s))window.SimAssessmentUI.complete(taskTimerKey);}
 const st=N.catalog[selectedStation];
 const viewInfo=window.SimLSPresets.get(selectedView),hostedCorridor=window.SimLSPresets.CORRIDORS.find(c=>c.host===selectedStation),ownIntermediate=st.map.view.intermediate.filter(name=>!(hostedCorridor&&window.SimLSPresets.get(hostedCorridor.id).plates.includes(name)));
 $('stationScope').textContent=viewInfo.monitor?`${viewInfo.name} · ${viewInfo.plates.join(' · ')}`:`${st.name} · ${ownIntermediate.join(' · ')||'구내 및 역간'}`;
 SimDOM.document.querySelectorAll('#stationTabs [data-station]').forEach(b=>{const s=stationStates[b.dataset.station],monitor=!!window.SimLSPresets.get(b.dataset.view).monitor,n=monitor?0:Object.keys(s.routes).length;b.classList.toggle('selected',b.dataset.view===selectedView);b.querySelector('.tab-dot').className='tab-dot '+(monitor?'monitor':s.mode.toLowerCase());b.querySelector('.tab-count').textContent=n?n:'';b.title=monitor?window.SimLSPresets.get(b.dataset.view).name+' · 역간 운행 감시':`${N.catalog[b.dataset.station].name} · ${s.mode} · ${n}개 진로`;});
 SimDOM.document.querySelector('.window-caption').innerHTML=`현장설비제어 <span>${st.name} [${st.code}]</span>`;
 const monitor=!!window.SimLSPresets.get(selectedView).monitor;$('topStation').textContent=window.SimLSPresets.get(selectedView).name;$('topCode').textContent=monitor?'':st.code;
 $('drawerBtn').hidden=monitor;$('resetBtn').hidden=monitor;if(monitor&&window.SimShell)window.SimShell.drawer(false);
 SimDOM.document.querySelector('.fidelity-note').innerHTML=monitor?`${viewInfo.name} LS<b>역간 운행 감시 · ${viewInfo.plates.join(' · ')}</b>`:`${viewInfo.name} LS<b>${(ownIntermediate.length?'관할 '+ownIntermediate.join(' · ')+' · ':'')+'접근쇄정·오버랩 연습'}</b>`;
 SimDOM.document.querySelector('.fidelity-note').insertAdjacentHTML('beforeend','<span class="platform-legend" aria-label="승강장 범례"><span><i class="platform-key orange"></i>고상홈</span><span><i class="platform-key cyan"></i>저상홈</span></span>');
 const controlled=lsViews,index=controlled.findIndex(s=>s.id===selectedView);
 $('previousStation').textContent=index>0?'◀ '+controlled[index-1].name:'시점';$('previousStation').disabled=index===0;
 $('nextStation').textContent=index<controlled.length-1?controlled[index+1].name+' ▶':'종점';$('nextStation').disabled=index===controlled.length-1;
 window.SimAssessmentUI?.render();$('stateMode').textContent=st.controlled?state.mode:'비연동';$('stateOwner').textContent=state.mode==='LOCAL'?'현장역':'관제실';$('stateRoutes').textContent=Object.keys(state.routes).length+'개 설정';$('stateScan').textContent=state.clock<state.scanUntil?'재수신 완료':'정상';
 $('lsStatus').textContent=monitor?'역간 운행 감시 · 열번창: 열차번호 제어 · 폐색·점유 표시':'CCM → 신호기 클릭 → 진로 선택 · 우클릭: 화면 메뉴 · 열번창: 열차번호 제어';
 $('mmiState').textContent=`현재 ${state.mode} · LS와 같은 상태 · ${Object.keys(state.routes).length}개 진로 설정`;
 $('handoverBar').hidden=monitor||!state.pending;if(state.pending)$('handoverBar').innerHTML=`<span>${state.pending} 요청 · 가상 현장 응답 대기</span><button data-handover="yes">현장 수락</button><button data-handover="no">현장 거절</button>`;
 $('completedCount').textContent=`${completed.length} / ${tasks.length} 완료`;drawTracks();$('routeEvidence').innerHTML+='<p class="point-states">전환기 조작 상태: '+Object.entries(state.points).map(([id,v])=>id+' '+(v==='N'?'정위':'반위')).join(' · ')+'</p>';renderLogs();window.SimDiagram?.render();window.SimMMI?.refresh();
}
function routeOptions(){if(!Object.keys(C.routes).length){$('mmiRoute').innerHTML='';$('mmiRouteEvidence').textContent='이 역에는 수동 진로제어가 없습니다.';return;}$('mmiRoute').innerHTML=Object.keys(C.routes).filter(id=>C.routes[id].signal===$('mmiSignal').value).map(id=>`<option>${id}</option>`).join('');$('mmiRoute').onchange=()=>{$('mmiRouteEvidence').innerHTML=routeDetails($('mmiRoute').value);};$('mmiRouteEvidence').innerHTML=routeDetails($('mmiRoute').value);}
function fields(){const type=$('controlSelect').value;$('mmiApply').disabled=!N.catalog[selectedStation].controlled&&type!=='scan';let html='';$('mmiApply').textContent='확인 · 명령 실행';
 if(type==='mode')html='<span class="field-label">제어모드</span><div class="radio-row">'+['AUTO','CCM','LOCAL'].map(v=>`<label><input type="radio" name="mmiMode" value="${v}" ${v==='CCM'?'checked':''}>${v}</label>`).join('')+'</div>';
 if(type==='route'){html='<label class="field-label" for="mmiSignal">신호기 목록</label><select id="mmiSignal">'+[...new Set(Object.values(C.routes).map(r=>r.signal))].map(id=>`<option>${id}</option>`).join('')+'</select><label class="field-label" for="mmiRoute">진로 · 배선 연결 경로</label><select id="mmiRoute"></select><div class="radio-row"><label><input name="routeAction" type="radio" value="select" checked>설정</label><label><input name="routeAction" type="radio" value="withdraw">해정</label></div><label class="field-label" for="routeControl">제어종류</label><select id="routeControl"><option value="single">진로제어</option><option value="continuous">연속진로제어</option></select><div id="mmiRouteEvidence" class="compact-evidence"></div>';$('mmiApply').textContent='확인 · 진로 제어';}
 if(type==='point'){html='<label class="field-label" for="mmiPoint">원본 선로전환기 목록</label><select id="mmiPoint">'+Object.entries(C.points).map(([id,p])=>{const names=Object.keys(C.pointParts).filter(part=>C.pointParts[part]===id);return `<option value="${id}">${names.length?names.join(' / '):id}</option>`;}).join('')+Object.keys(C.pointParts).sort().map(part=>`<option value="${part}">SW_${part} · A/B 동시 전환</option>`).join('')+'</select><div class="radio-row"><label><input type="radio" name="pointPosition" value="N" checked>정위 N</label><label><input type="radio" name="pointPosition" value="R">반위 R</label></div><div class="radio-row"><label><input name="pointAction" type="radio" value="move" checked>전환</label><label><input name="pointAction" type="radio" value="lock">쇄정</label><label><input name="pointAction" type="radio" value="unlock">해제</label></div><p>전환기 위치는 N/R로 표시합니다. 설정·점유 진로가 사용하는 전환기는 움직일 수 없습니다.</p>';$('mmiApply').textContent='확인 · 전환기 제어';}
 if(type==='stopAll')html='<p>선택역의 모든 설정 신호기를 정지합니다. 점유 중인 진로는 쇄정을 유지합니다.</p>';
 if(type==='scan')html='<span class="field-label">제어구분</span><div class="radio-row"><label><input type="radio" name="mmiScope" value="current" checked>선택역</label><label><input type="radio" name="mmiScope" value="all">전체 제어역</label></div>';
 $('mmiFields').innerHTML=html;if(type==='route'){routeOptions();$('mmiSignal').onchange=routeOptions;}
}
function signalAction(id,at){
 const active=Object.keys(state.routes).find(key=>C.routes[key].signal===id);
 if(active){openAction('제어 확인','<span class="q-icon" aria-hidden="true">?</span><span class="q-text">해정 하시겠습니까?</span>',{type:'stop',id,source:'LS'},'예(Y)','confirm');return;}
 const entries=C.lsMenu(id);
 if(!entries.length){toast(id+' 입환신호기의 진로목록은 아직 구현하지 않았습니다.',true);return;}
 // 실제 LS는 신호기 옆에 "[ 진로 제어 ]" 제목과 RT_<신호기>_<도착> 목록만 보여 준다. 목록의 출처(원본/배선 도출)는 마우스를 올리면 나온다.
 openAction('[ 진로 제어 ]',entries.map(key=>`<button type="button" class="route-choice" data-route-choice="${key}" title="${C.menuVerifiedFor(id)?'원본 LS 목록':C.routes[key].geometryDerived?'배선 연결으로 도출한 경로 (실제 LS 목록은 확인되지 않음)':'교재·대본·LS 확인 경로'}">RT_${key.replace('-','_')}</button>`).join(''),null,'예 · 실행','route',at);
 $('dialogConfirm').hidden=true;
 SimDOM.document.querySelectorAll('[data-route-choice]').forEach(button=>button.onclick=()=>{$('actionDialog').close();$('dialogConfirm').hidden=false;run({type:'route',id:button.dataset.routeChoice,source:'LS'});});
}
function taskView(){const t=tasks[taskIndex];$('taskSelect').value=taskIndex;$('taskBody').innerHTML=practice==='free'?'<div class="task-card"><div class="task-heading"><span class="task-num">∞</span><h3>원본 배선도와 경로 대조</h3></div><p>1A·2A·3A·4A를 눌러 경로 근거를 확인하고, 전환기 구성을 대조하세요. 설정한 신호기를 다시 눌러 정지·해정할 수 있습니다.</p></div>':`<div class="task-card"><div class="task-heading"><span class="task-num">${String(taskIndex+1).padStart(2,'0')}</span><h3>${t.title}</h3><span class="task-badge">${completed.includes(taskIndex)?'✓ 달성':activeTask===taskIndex?'진행 중':'시작 전'}</span></div><p>${t.desc}</p>${practice==='guided'?`<p class="task-hint">↳ ${t.hint}</p>`:''}<p>근거: ${t.source}</p><p id="taskResult"></p></div>`;for(const id of ['startTask','checkTask','nextTask'])$(id).hidden=practice==='free';}
function startTask(){if(state.logs.length&&!confirm('현재 상태와 기록을 초기화하고 과제를 시작할까요?'))return;selectStation('underground-seoul');if(window.SimRemote){window.SimRemote.reset(selectedStation);state=stationStates[selectedStation];}else{state=C.initial();state.clock=stationStates[selectedStation].clock;stationStates[selectedStation]=state;}window.SimLSUI.reset(selectedStation);window.SimMMI?.syncAll(stationStates);taskStart=0;activeTask=taskIndex;paused=false;if(window.SimRemote)window.SimRemote.command({type:'clock',paused:false});$('pauseBtn').textContent='Ⅱ 일시정지';$('controlSelect').value='mode';fields();render();taskView();taskTimerKey='practice:'+taskIndex+':'+Date.now();window.SimAssessmentUI.beginTask(taskTimerKey,tasks[taskIndex].title,'operation',taskIndex);toast('과제 시작 · '+tasks[taskIndex].title);}
$('taskSelect').innerHTML=tasks.map((t,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${t.title}</option>`).join('');$('taskSelect').onchange=e=>{taskIndex=+e.target.value;taskView();};
SimDOM.document.querySelectorAll('[data-practice]').forEach(b=>b.onclick=()=>{practice=b.dataset.practice;SimDOM.document.querySelectorAll('[data-practice]').forEach(x=>x.classList.toggle('selected',x===b));taskView();});
$('lsDisplay').onclick=e=>{
 const nav=e.target.closest('[data-nav-view]');if(nav){selectStation(nav.dataset.navView);return;}   // 원본 노란 화살표: 이웃 화면으로
 if(window.SimLSPresets.get(selectedView).monitor)return;
 const mode=e.target.closest('[data-mode]'),signal=e.target.closest('[data-signal]'),stop=e.target.closest('[data-stop-all]'),point=e.target.closest('[data-point-control]');
 if(mode&&state.mode==='LOCAL'&&mode.dataset.mode==='CCM'&&!state.pending){
  // 표준화 프로토콜(교통관제운영 4권 p.383): LOCAL에서 CTC를 누르면 비상 CTC 대화상자가 뜨고, 선택하면 현장 응답 없이 바로 전환된다
  openAction('제어확인','<span class="q-icon" aria-hidden="true">?</span><div class="q-text" data-mode-confirm>역 운행모드를 CCM 모드로 전환하시겠습니까?<label class="nt-check"><input type="checkbox" id="emgCtc"> 비상 CTC (현장 응답 없이 즉시 전환)</label></div>',()=>({type:'mode',value:'CCM',source:'LS',emergency:$('emgCtc').checked}),'예(Y)','confirm');
 }else if(mode)openAction('제어확인','<span class="q-icon" aria-hidden="true">?</span><span class="q-text" data-mode-confirm>역 운행모드를 '+mode.dataset.mode+' 모드로 전환하시겠습니까?</span>',{type:'mode',value:mode.dataset.mode,source:'LS'},'예(Y)','confirm');
 else if(signal)signalAction(signal.dataset.signal,{x:e.clientX,y:e.clientY});
 else if(point){const id=point.dataset.pointControl,group=C.pointParts[id]||id,value=state.points[group]==='R'?'N':'R';if(state.mode!=='CCM'){toast('선로전환기 직접 제어는 CCM 모드에서 가능합니다.',true);return;}openAction('제어 확인','<span class="q-icon" aria-hidden="true">?</span><span class="q-text">선로전환기 SW_'+id+' 를 '+(value==='R'?'반위':'정위')+' 제어를 하시겠습니까?</span>',{type:'point',id,value,source:'LS'},'예(Y)','confirm');}
 else if(stop)openAction('신호기 일괄정지',N.catalog[selectedStation].name+'의 설정 신호기를 모두 정지합니다. 점유 중인 진로는 쇄정을 유지합니다.',{type:'stopAll',source:'LS'});
};
$('actionDialog').addEventListener('click',e=>{const d=$('actionDialog');if(d.dataset.variant==='route'&&e.target===d)d.close();});      // 팝업 밖을 누르면 닫힘
$('actionDialog').addEventListener('keydown',e=>{const d=$('actionDialog');if(d.dataset.variant!=='confirm')return;if(/^y$/i.test(e.key)){e.preventDefault();$('dialogConfirm').click();}else if(/^n$/i.test(e.key)){e.preventDefault();d.querySelector('[value="cancel"]').click();}});
$('lsStage').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};

$('actionDialog').addEventListener('close',()=>{if(!dialogAction||$('actionDialog').open)return;const a=typeof dialogAction==='function'?dialogAction():dialogAction;dialogAction=null;if($('actionDialog').returnValue==='confirm')run(a);else run({type:'cancel',target:a.type,id:a.id,source:'LS'});});
$('handoverBar').onclick=e=>{const b=e.target.closest('[data-handover]');if(b)run({type:'handover',accept:b.dataset.handover==='yes',source:'현장'});};
$('controlSelect').onchange=fields;$('mmiApply').onclick=()=>{const type=$('controlSelect').value,checked=n=>SimDOM.document.querySelector(`input[name="${n}"]:checked`).value;
 if(type==='mode')run({type,value:checked('mmiMode'),source:'MMI'});
 if(type==='route')run({type:checked('routeAction')==='select'?'route':'withdraw',id:$('mmiRoute').value,control:$('routeControl').value,source:'MMI'});
 if(type==='point'){const op=checked('pointAction');run({type:op==='move'?'point':'pointLock',id:$('mmiPoint').value,value:checked('pointPosition'),lock:op==='lock',source:'MMI'});}
 if(type==='stopAll'){
  // LS may change stations while this MMI dialog remains open. Keep its target.
  const target=selectedStation;
  window.SimMMI.confirmBox(N.catalog[target].name+' 신호기를 모두 정지하시겠습니까?',()=>{
   const action={type:'stopAll',source:'MMI'};
   if(target===selectedStation){run(action);return;}
   if(window.SimMMI.replaying()){toast('로그재생 중에는 조작할 수 없습니다.',true);return;}
   const result=session.dispatch(target,action);
   window.SimMMI.sync(target,stationStates[target],action,result);render();toast(result.message,!result.ok);
  },{title:'신호기 일괄정지'});
 }
 if(type==='scan')run({type,scope:checked('mmiScope'),source:'MMI'});
};
$('mmiCancel').onclick=()=>{run({type:'cancel',source:'MMI'});fields();};$('pauseBtn').onclick=()=>{paused=!paused;if(window.SimRemote)window.SimRemote.command({type:'clock',paused});$('pauseBtn').textContent=paused?'▶ 계속':'Ⅱ 일시정지';};$('skipBtn').onclick=()=>run({type:'tick',seconds:10});
$('resetBtn').onclick=()=>{if(!confirm('현재 상태와 조작 기록을 초기화할까요?'))return;const clock=state.clock;if(window.SimRemote){window.SimRemote.reset(selectedStation);state=stationStates[selectedStation];}else{state=C.initial();state.clock=clock;stationStates[selectedStation]=state;}window.SimLSUI.reset(selectedStation);window.SimMMI?.syncAll(stationStates);if(taskTimerKey)window.SimAssessmentUI.cancel(taskTimerKey);taskTimerKey=null;activeTask=null;paused=false;if(window.SimRemote)window.SimRemote.command({type:'clock',paused:false});$('pauseBtn').textContent='Ⅱ 일시정지';fields();render();taskView();};
$('startTask').onclick=startTask;$('nextTask').onclick=()=>{taskIndex=(taskIndex+1)%tasks.length;taskView();};
$('checkTask').onclick=()=>{if(selectedStation!=='underground-seoul')return toast('지하서울로 전환해 과제를 확인하세요.',true);if(activeTask!==taskIndex)return toast('먼저 이 과제를 시작하세요.',true);const ok=tasks[taskIndex].check(state.events.slice(taskStart),state);if(ok){window.SimAssessmentUI.complete(taskTimerKey);if(!completed.includes(taskIndex))completed.push(taskIndex);try{localStorage.setItem('ctclab-v03-completed',JSON.stringify(completed));}catch{}taskView();$('taskResult').className='complete-banner';$('taskResult').textContent='✓ 목표 조작과 경로 확인을 완료했습니다.';render();}else $('taskResult').textContent='필수 조작과 경로 확인을 다시 확인하세요.';toast(ok?'과제 달성':'아직 과제를 완료하지 않았습니다.',!ok);};
$('guideBtn').onclick=()=>$('guideDialog').showModal();$('closeGuide').onclick=()=>$('guideDialog').close();
$('fieldMenu').onclick=()=>toast('현장제어 · 확인된 경로 및 설비 구성');$('systemMenu').onclick=()=>window.SimShell?.drawer(true);
$('exportBtn').onclick=()=>{const data={app:'CTC LAB v0.27.3',exportedAt:new Date().toISOString(),sources:C.sources,routeCatalog:C.routes,interlockingVerified:false,networkAudit:window.SimNetworkTopology.audit(),actualTrainPositions:window.SimDiagram.getModel().trains.map(t=>({train:t.id,position:window.SimAutoUI.position(t,state.clock)})),selectedStation,stations:stationStates,state,lsDisplay:window.SimLSUI.getModel(),assessment:window.SimAssessmentUI.snapshot(),scenario:window.SimScenarioUI?.snapshot?.(),timetable:window.SimDiagram.getModel(),mmiLogs:window.SimMMI.getLogs(),mmiHistory:window.SimMMI.history(),notes:window.SimNotes?.export()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ctc-lab-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const lockSig=()=>Object.entries(state.routes).map(([id,r])=>id+(r.lock?'L':'')).join();
setInterval(()=>{if(window.SimRemote){try{window.SimRemote.poll();}catch(error){if(error.message==='Engine offline')return;throw error;}   // 종료 중 엔진이 먼저 멈추면 조용히 넘어간다
 paused=window.SimRemote.snapshot.clock.paused;$('pauseBtn').textContent=paused?'▶ 계속':'Ⅱ 일시정지';window.SimAutoUI?.step();window.SimScenarioUI?.stepMotion();window.SimMMI.syncAll(stationStates);render();window.SimDiagram.render();return;}if(!paused&&!window.SimMMI?.replaying?.()&&(window.SimAssessmentUI?.isRunning()||!window.SimLSUI.isInteracting()&&!$('actionDialog').open&&!$('guideDialog').open)){const seconds=Number($('graphSpeed').value),before=lockSig(),movingBefore=trainRunning(state);session.tick(seconds);const scenarioChanged=window.SimScenarioUI?.stepMotion(),autoChanged=window.SimAutoUI?.step();window.SimEquipment?.tick(state.clock);window.SimMMI?.syncAll(stationStates);if(lockSig()!==before||autoChanged||scenarioChanged||movingBefore||trainRunning(state))render();else for(const row of SimDOM.document.querySelectorAll('[data-lock-row]')){const r=state.routes[row.dataset.lockRow];if(r?.lock){const left=Math.max(0,Math.ceil(r.lock.until-state.clock));row.querySelector('[data-lock-remaining]').textContent=left;row.querySelector('.lock-timer i').style.width=Math.round((r.lock.seconds-left)/r.lock.seconds*100)+'%';}}window.SimDiagram.render();window.SimAssessmentUI?.render();$('stateScan').textContent=state.clock<state.scanUntil?'재수신 완료':'정상';}},1000);
window.SimLSUI.init({context:()=>({station:selectedStation,C,state,stationStates,monitor:!!window.SimLSPresets.get(selectedView).monitor,viewName:window.SimLSPresets.get(selectedView).name}),run,render,openAction,toast,selectStation});
window.SimAssessmentUI.init({context:()=>({state,paused}),resume:()=>{paused=false;if(window.SimRemote)window.SimRemote.command({type:'clock',paused:false});$('pauseBtn').textContent='Ⅱ 일시정지';},openAction,render});
fields();render();taskView();

window.SimField={ // 교육용 설비 상태 설정(고장·TTB)이 역 상태에 접근하는 통로
 dispatch:(id,a)=>{const r=session.dispatch(id,{...a,source:'설비'});render();return r;},
 core:id=>session.core(id),state:id=>stationStates[id],session:()=>session.snapshot()
};
window.SimDiagram.init({clock:()=>state.clock,selectStation:id=>{selectStation(id);$('lsDisplay').scrollIntoView({block:'start'});}});
window.SimMMI?.connect({context:()=>({station:selectedStation,C,state,stationStates}),run,render,selectStation,openAction,toast});
window.SimMMI?.syncAll(stationStates);

if(window.SimRemote){$('graphSpeed').value=String(window.SimRemote.snapshot.clock.speed);$('graphSpeed').addEventListener('change',()=>window.SimRemote.command({type:'clock',speed:Number($('graphSpeed').value)}));}

// Re-layout in logical desktop coordinates when the window or side drawer changes.
let lsResizeFrame;new ResizeObserver(()=>{cancelAnimationFrame(lsResizeFrame);lsResizeFrame=requestAnimationFrame(()=>drawTracks());}).observe($('lsStage'));

$('extraLSBtn').hidden=!window.OrpheiaEngine;
$('extraLSBtn').onclick=()=>window.OrpheiaEngine?.openView('ls',selectedView);
if(window.SimExtraLS){
 document.body.classList.add('workspace-split');
 window.addEventListener('DOMContentLoaded',()=>{
 $('detachMMIBtn').onclick=()=>window.OrpheiaEngine.openView('mmi');
 $('graphWinBtn').onclick=()=>window.OrpheiaEngine.openView('graph');
 window.SimWorkspace.detach=()=>window.OrpheiaEngine.openView('mmi');
 window.SimWorkspace.openGraph=()=>window.OrpheiaEngine.openView('graph');
 },{once:true});
}
