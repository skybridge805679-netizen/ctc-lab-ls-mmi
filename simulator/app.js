'use strict';
const $=id=>document.getElementById(id),BaseCore=window.SimCore,N=window.SimNetwork;
let C=BaseCore,selectedStation='underground-seoul';
const stationStates=Object.fromEntries(N.stations.filter(st=>st.controlled).map(st=>[st.id,BaseCore.forStation(st.id).initial()]));
let state=stationStates[selectedStation],paused=false,practice='guided',activeTask=null,taskIndex=0,taskStart=0,dialogAction=null,toastTimer,completed=[];
try{completed=JSON.parse(localStorage.getItem('ctclab-v03-completed')||'[]');if(!Array.isArray(completed))completed=[];}catch{}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
const tasks=window.SimPractice.tasks;
completed=[...new Set(completed.filter(i=>Number.isInteger(i)&&i>=0&&i<tasks.length))];
function toast(msg,error=false){$('toast').textContent=msg;$('toast').className='show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').className='',5000);}
function run(a){let r;if(a.type==='tick'){for(const st of Object.values(stationStates))C.dispatch(st,a);r={ok:true};}else r=C.dispatch(state,a);render();if(a.type!=='tick')toast(r.message,!r.ok);return r;}
function openAction(title,body,action,label='예 · 실행'){$('dialogConfirm').hidden=false;$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;dialogAction=action;$('actionDialog').returnValue='';$('dialogConfirm').textContent=label;$('actionDialog').showModal();}
function routeDetails(id){const r=C.routes[id];return `<div class="route-detail"><b>${escapeHTML(id)}</b><p>${r.pathTracks.join(' → ')}</p><p class="evidence">${r.evidence}</p><p>${r.source.map(escapeHTML).join('<br>')}</p><p class="pending-note">접근 열차가 없는 기본 조작 연습 · 세부 연동조건은 구현 범위 안내 참조</p></div>`;}
function drawTracks(){
 if(selectedStation!=='underground-seoul'){drawStation();return;}
 let svg='<image href="assets/underground-seoul-original.png" width="1905" height="991"/>';
 // Cover only the source screenshot mode lamps, then draw current simulated modes.
 const xPositions={AUTO:226,CCM:345,LOCAL:467};
 for(const [mode,x]of Object.entries(xPositions)){const fill=state.mode===mode?({AUTO:'#28e35f',CCM:'#f5e425',LOCAL:'#f5b554'}[mode]):'#fff';svg+=`<g class="clickable" data-mode="${mode}" role="button" tabindex="0" aria-label="${mode} 모드"><rect x="${x}" y="67" width="105" height="43" fill="${fill}" stroke="#111"/><text x="${x+52}" y="96" text-anchor="middle" font-family="Arial" font-size="29" font-weight="700" fill="#050505">${mode}</text></g>`;}
 for(const [id]of Object.entries(state.routes)){const r=C.routes[id];svg+=`<path d="${r.path}" stroke="#36ed06" stroke-width="16" fill="none"/>`;}
 const labels={B065T:[500,624],X1T:[644,624],'21BT':[750,624],XT:[644,517],'21AT':[750,517],'1T':[1165,517],YT:[1650,624],'52T':[1470,624],'2T':[1160,624],B070T:[500,517],'51BT':[1390,517],Y1T:[1770,517],B072T:[1860,517]};
 for(const track of new Set(Object.keys(state.routes).flatMap(id=>C.routes[id].pathTracks))){const xy=labels[track];if(xy)svg+=`<text x="${xy[0]}" y="${xy[1]}" text-anchor="middle" fill="#111" font-size="13" pointer-events="none">${track}</text>`;}
 for(const [id,status]of Object.entries(state.signals)){if(status==='GO'){const s=C.signals[id],dx=['1A','4A'].includes(id)?37:-34;svg+=`<ellipse cx="${s.x+dx}" cy="${s.y}" rx="7" ry="6" fill="#36ed06" stroke="#151515"/>`;}}
 for(const [id,s]of Object.entries(C.signals)){const width=id.endsWith('A')?82:48;svg+=`<g class="clickable signal-hit" data-signal="${id}" role="button" tabindex="0" aria-label="${id} ${s.kind}신호기"><rect x="${s.x-45}" y="${s.y-16}" width="${width}" height="29" rx="3" fill="transparent" stroke="transparent"/><title>${id} ${s.kind} · ${Object.values(C.routes).filter(r=>r.signal===id).length?'확인된 경로 보기':'진로목록 검증 보류'}</title></g>`;}
 for(const [id,p]of Object.entries(C.points)){svg+=`<g class="clickable point-hit" data-point="${id}" role="button" tabindex="0" aria-label="${id} 선로전환기 구성"><rect x="${p.x-22}" y="${p.y-29}" width="44" height="55" rx="4" fill="#244a6833" stroke="#b9e2ff" stroke-width="1.5" stroke-dasharray="5 4"/><title>${p.parts.join(' / ')} 구성 확인 · 정·반위 조작 연습</title></g>`;}
 $('trackSvg').setAttribute('viewBox','0 0 1905 991');$('trackSvg').setAttribute('aria-label','교육장 배선도 슬라이드 5의 지하서울 원본 화면');$('trackSvg').innerHTML=svg;
 $('routeEvidence').innerHTML=Object.keys(state.routes).length?Object.keys(state.routes).map(routeDetails).join(''):'<p class="evidence-empty">신호기를 선택하면 근거가 있는 경로만 표시합니다. CCM으로 전환한 뒤 3A → RT_3A_B065T를 선택하세요.</p>';
}
function drawStation(){
 const st=N.catalog[selectedStation];
 let svg=`<image href="${st.image}" width="${st.width}" height="${st.height}"/>`;
 if(st.controlled)for(const [i,mode]of ['AUTO','CCM','LOCAL'].entries())svg+=`<g data-mode="${mode}" role="button" tabindex="0" aria-label="${mode} 모드"><rect x="${st.modeX[i]}" y="${st.modeY}" width="105" height="43" fill="${state.mode===mode?{AUTO:'#28e35f',CCM:'#f5e425',LOCAL:'#f5b554'}[mode]:'#fff'}" stroke="#111"/><text x="${st.modeX[i]+52}" y="${st.modeY+29}" text-anchor="middle" font-size="27" fill="#111">${mode}</text></g>`;
 for(const id of Object.keys(state.routes)){const r=C.routes[id];if(r.path)svg+=`<path d="${r.path}" stroke="#36ed06" stroke-width="12" fill="none"/>`;}
 for(const [id,signal]of Object.entries(C.signals)){
  if(state.signals[id]==='GO')svg+=`<circle cx="${signal.x}" cy="${signal.y}" r="8" fill="#36ed06"/>`;
  svg+=`<g class="signal-hit" data-signal="${id}" role="button" tabindex="0" aria-label="${id} ${signal.kind}신호기"><rect x="${signal.x-40}" y="${signal.y-14}" width="80" height="28" fill="transparent"/><title>${id} ${signal.kind}신호기</title></g>`;
 }
 $('trackSvg').setAttribute('viewBox',`0 0 ${st.width} ${st.height}`);$('trackSvg').setAttribute('aria-label',`${st.name} · 배선도 슬라이드 ${st.slide}`);$('trackSvg').innerHTML=svg;
 $('routeEvidence').innerHTML=Object.keys(state.routes).length?Object.keys(state.routes).map(routeDetails).join(''):`<p class="evidence-empty">${st.controlled?'CCM 전환 후 신호기 또는 MMI에서 기본 진로를 설정하세요. 상세 선형 미검증 진로는 경로선을 그리지 않고 설정 상태로 표시합니다.':'비연동역입니다. 이 구간의 원본 배선을 확인하고 연결 연동역에서 진로를 제어하세요.'}</p>`;
}
function selectStation(id){
 if(!N.catalog[id]?.controlled)return;
 if($('actionDialog').open){toast('제어 확인창을 닫은 뒤 역을 변경하세요.',true);$('stationSelect').value=selectedStation;$('lsStationSelect').value=selectedStation;return;}
 stationStates[selectedStation]=state;
 selectedStation=id;C=BaseCore.forStation(id);state=stationStates[id];
 $('stationSelect').value=id;$('lsStationSelect').value=id;
 fields();render();taskView();
}
const stationOptions=N.stations.filter(st=>st.controlled).map(st=>`<option value="${st.id}">${st.name}${st.controlled?' ['+st.code+']':' · 비연동'}</option>`).join('');
$('stationSelect').innerHTML=stationOptions;$('lsStationSelect').innerHTML=stationOptions;
$('stationSelect').value=selectedStation;$('lsStationSelect').value=selectedStation;
$('stationSelect').onchange=e=>selectStation(e.target.value);$('lsStationSelect').onchange=e=>selectStation(e.target.value);
$('stationTabs').innerHTML=N.stations.filter(st=>st.controlled).map(st=>`<button data-station="${st.id}">${st.name}</button>`).join('');
$('stationTabs').onclick=e=>{const button=e.target.closest('[data-station]');if(button)selectStation(button.dataset.station);};
function renderLogs(){$('logCount').textContent=state.logs.length+' events';$('logList').innerHTML=state.logs.length?state.logs.slice(0,100).map(l=>`<div class="log-row"><span class="log-time">${time(l.time)}</span><div><p>${escapeHTML(l.message)}</p><div class="log-meta">${escapeHTML(l.source)} · <span class="${l.result==='완료'?'result-ok':'result-bad'}">${l.result}</span></div></div></div>`).join(''):'<p class="empty">첫 조작을 기다리고 있습니다.</p>';}
function render(){
 const st=N.catalog[selectedStation];
 $('stationScope').textContent=`${st.name} · ${st.controlled?'연동역 기본 제어':'비연동역 배선 조회'} · 슬라이드 ${st.slide}`;
 document.querySelectorAll('[data-station]').forEach(b=>b.classList.toggle('selected',b.dataset.station===selectedStation));
 document.querySelector('.window-caption').innerHTML=`현장설비제어 <span>${st.name} [${st.code}]</span>`;
 document.querySelector('.sessionbar>div:first-child').innerHTML=`<span class="live-dot"></span><b>조작·경로 확인</b><span class="bar-sep"></span><span>${st.name}</span><span class="muted">${st.code}</span>`;
 document.querySelector('.side-station').innerHTML=`<span class="live-dot"></span>${st.name} <small>${st.code}</small>`;
 document.querySelector('.fidelity-note').innerHTML=`교육장 원본 · 슬라이드 ${st.slide}<b>${st.controlled?'기본 진로 · 상세 연동 미검증':'비연동역 · 연결 연동역에서 제어'}</b>`;
 $('clock').textContent=time(state.clock);$('stateMode').textContent=st.controlled?state.mode:'비연동';$('stateOwner').textContent=state.mode==='LOCAL'?'현장역':'관제실';$('stateRoutes').textContent=Object.keys(state.routes).length+'개 설정';$('stateScan').textContent=state.clock<state.scanUntil?'재수신 완료':'정상';
 $('lsStatus').textContent='CCM → 신호기 클릭 → 진로 선택 · 설정된 신호기 클릭 → 정지·해정';
 $('mmiState').textContent=`현재 ${state.mode} · LS와 같은 상태 · ${Object.keys(state.routes).length}개 진로 설정`;
 $('handoverBar').hidden=!state.pending;if(state.pending)$('handoverBar').innerHTML=`<span>${state.pending} 요청 · 가상 현장 응답 대기</span><button data-handover="yes">현장 수락</button><button data-handover="no">현장 거절</button>`;
 $('completedCount').textContent=`${completed.length} / ${tasks.length} 완료`;drawTracks();$('routeEvidence').innerHTML+='<p class="point-states">전환기 조작 상태: '+Object.entries(state.points).map(([id,v])=>id+' '+(v==='N'?'정위':'반위')).join(' · ')+'</p>';renderLogs();window.SimDiagram?.render();
}
function routeOptions(){if(!Object.keys(C.routes).length){$('mmiRoute').innerHTML='';$('mmiRouteEvidence').textContent='이 역에는 수동 진로제어가 없습니다.';return;}$('mmiRoute').innerHTML=Object.keys(C.routes).filter(id=>C.routes[id].signal===$('mmiSignal').value).map(id=>`<option>${id}</option>`).join('');$('mmiRoute').onchange=()=>{$('mmiRouteEvidence').innerHTML=routeDetails($('mmiRoute').value);};$('mmiRouteEvidence').innerHTML=routeDetails($('mmiRoute').value);}
function fields(){const type=$('controlSelect').value;$('mmiApply').disabled=!N.catalog[selectedStation].controlled&&type!=='scan';let html='';$('mmiApply').textContent='확인 · 명령 실행';
 if(type==='mode')html='<span class="field-label">제어모드</span><div class="radio-row">'+['AUTO','CCM','LOCAL'].map(v=>`<label><input type="radio" name="mmiMode" value="${v}" ${v==='CCM'?'checked':''}>${v}</label>`).join('')+'</div>';
 if(type==='route'){html='<label class="field-label" for="mmiSignal">신호기 · 근거가 있는 목록</label><select id="mmiSignal">'+[...new Set(Object.values(C.routes).map(r=>r.signal))].map(id=>`<option>${id}</option>`).join('')+'</select><label class="field-label" for="mmiRoute">확인된 경로</label><select id="mmiRoute"></select><div class="radio-row"><label><input name="routeAction" type="radio" value="select" checked>설정</label><label><input name="routeAction" type="radio" value="withdraw">해정</label></div><div id="mmiRouteEvidence" class="compact-evidence"></div>';$('mmiApply').textContent='확인 · 진로 제어';}
 if(type==='point'){html='<label class="field-label" for="mmiPoint">원본 선로전환기 목록</label><select id="mmiPoint">'+Object.entries(C.points).map(([id,p])=>`<option value="${id}">${id} · ${p.parts.join(' / ')}</option>`).join('')+'</select><div class="radio-row"><label><input type="radio" name="pointPosition" value="N" checked>정위 N</label><label><input type="radio" name="pointPosition" value="R">반위 R</label></div><p>현재 조작 상태는 아래에 표시됩니다. 배선의 정·반위 형상은 별도 재현하지 않습니다.</p>';$('mmiApply').textContent='확인 · 전환기 제어';}
 if(type==='scan')html='<span class="field-label">제어구분</span><div class="radio-row"><label><input type="radio" name="mmiScope" value="current" checked>선택역</label><label><input type="radio" name="mmiScope" value="all">전체 제어역</label></div>';
 $('mmiFields').innerHTML=html;if(type==='route'){routeOptions();$('mmiSignal').onchange=routeOptions;}
}
function signalAction(id){
 const active=Object.keys(state.routes).find(key=>C.routes[key].signal===id);
 if(active){openAction(id+' 신호 정지·진로 해정','신호를 정지하고 진로를 해정하시겠습니까?<p>현재 연습: 접근 열차 없음</p>',{type:'stop',id,source:'LS'});return;}
 const entries=Object.keys(C.routes).filter(key=>C.routes[key].signal===id);
 if(!entries.length){toast(id+' 입환신호기의 진로목록은 아직 구현하지 않았습니다.',true);return;}
 openAction('[ 진로 제어 ]',entries.map(key=>`<button type="button" class="route-choice" data-route-choice="${key}">RT_${key.replace('-','_')}</button>`).join(''),null);
 $('dialogConfirm').hidden=true;
 document.querySelectorAll('[data-route-choice]').forEach(button=>button.onclick=()=>{$('actionDialog').close();$('dialogConfirm').hidden=false;run({type:'route',id:button.dataset.routeChoice,source:'LS'});});
}
function pointAction(id){const value=state.points[id]==='N'?'R':'N';openAction(id+' 선로전환기 제어',`현재 ${state.points[id]==='N'?'정위':'반위'} → ${value==='N'?'정위':'반위'}로 조작하시겠습니까?`,{type:'point',id,value,source:'LS'});}
function taskView(){const t=tasks[taskIndex];$('taskSelect').value=taskIndex;$('taskBody').innerHTML=practice==='free'?'<div class="task-card"><div class="task-heading"><span class="task-num">∞</span><h3>원본 배선도와 경로 대조</h3></div><p>1A·2A·3A·4A를 눌러 경로 근거를 확인하고, 전환기 구성을 대조하세요. 설정한 신호기를 다시 눌러 정지·해정할 수 있습니다.</p></div>':`<div class="task-card"><div class="task-heading"><span class="task-num">${String(taskIndex+1).padStart(2,'0')}</span><h3>${t.title}</h3><span class="task-badge">${completed.includes(taskIndex)?'✓ 달성':activeTask===taskIndex?'진행 중':'시작 전'}</span></div><p>${t.desc}</p>${practice==='guided'?`<p class="task-hint">↳ ${t.hint}</p>`:''}<p>근거: ${t.source}</p><p id="taskResult"></p></div>`;for(const id of ['startTask','checkTask','nextTask'])$(id).hidden=practice==='free';}
function startTask(){if(state.logs.length&&!confirm('현재 상태와 기록을 초기화하고 과제를 시작할까요?'))return;selectStation('underground-seoul');state=C.initial();state.clock=stationStates[selectedStation].clock;stationStates[selectedStation]=state;taskStart=0;activeTask=taskIndex;paused=false;$('pauseBtn').textContent='Ⅱ 일시정지';$('controlSelect').value='mode';fields();render();taskView();toast('과제 시작 · '+tasks[taskIndex].title);}
$('taskSelect').innerHTML=tasks.map((t,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${t.title}</option>`).join('');$('taskSelect').onchange=e=>{taskIndex=+e.target.value;taskView();};
document.querySelectorAll('[data-practice]').forEach(b=>b.onclick=()=>{practice=b.dataset.practice;document.querySelectorAll('[data-practice]').forEach(x=>x.classList.toggle('selected',x===b));taskView();});
$('lsDisplay').onclick=e=>{const mode=e.target.closest('[data-mode]'),signal=e.target.closest('[data-signal]'),point=e.target.closest('[data-point]');if(mode)openAction(mode.dataset.mode+' 모드 전환',`제어모드를 ${mode.dataset.mode}로 전환하시겠습니까?`,{type:'mode',value:mode.dataset.mode,source:'LS'});else if(signal)signalAction(signal.dataset.signal);else if(point)pointAction(point.dataset.point);};
$('trackSvg').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
$('lsDisplay').oncontextmenu=e=>{e.preventDefault();openAction('베이스스캔','가상 상태정보를 재수신합니다.<select id="lsScope" aria-label="베이스스캔 범위"><option value="current">현재역 베이스스캔</option><option value="all">전체역 베이스스캔</option></select>',()=>({type:'scan',scope:$('lsScope').value,source:'LS'}));};
$('actionDialog').addEventListener('close',()=>{if(!dialogAction)return;const a=typeof dialogAction==='function'?dialogAction():dialogAction;dialogAction=null;if($('actionDialog').returnValue==='confirm')run(a);else run({type:'cancel',target:a.type,id:a.id,source:'LS'});});
$('handoverBar').onclick=e=>{const b=e.target.closest('[data-handover]');if(b)run({type:'handover',accept:b.dataset.handover==='yes',source:'현장'});};
$('controlSelect').onchange=fields;$('mmiApply').onclick=()=>{const type=$('controlSelect').value,checked=n=>document.querySelector(`input[name="${n}"]:checked`).value;
 if(type==='mode')run({type,value:checked('mmiMode'),source:'MMI'});
 if(type==='route')run({type:checked('routeAction')==='select'?'route':'withdraw',id:$('mmiRoute').value,source:'MMI'});
 if(type==='point')run({type:'point',id:$('mmiPoint').value,value:checked('pointPosition'),source:'MMI'});
 if(type==='scan')run({type,scope:checked('mmiScope'),source:'MMI'});
};
$('mmiCancel').onclick=()=>{run({type:'cancel',source:'MMI'});fields();};$('pauseBtn').onclick=()=>{paused=!paused;$('pauseBtn').textContent=paused?'▶ 계속':'Ⅱ 일시정지';};$('skipBtn').onclick=()=>run({type:'tick',seconds:10});
$('resetBtn').onclick=()=>{if(!confirm('현재 상태와 조작 기록을 초기화할까요?'))return;const clock=state.clock;state=C.initial();state.clock=clock;stationStates[selectedStation]=state;activeTask=null;paused=false;$('pauseBtn').textContent='Ⅱ 일시정지';fields();render();taskView();};
$('startTask').onclick=startTask;$('nextTask').onclick=()=>{taskIndex=(taskIndex+1)%tasks.length;taskView();};
$('checkTask').onclick=()=>{if(selectedStation!=='underground-seoul')return toast('지하서울로 전환해 과제를 확인하세요.',true);if(activeTask!==taskIndex)return toast('먼저 이 과제를 시작하세요.',true);const ok=tasks[taskIndex].check(state.events.slice(taskStart),state);if(ok){if(!completed.includes(taskIndex))completed.push(taskIndex);try{localStorage.setItem('ctclab-v03-completed',JSON.stringify(completed));}catch{}taskView();$('taskResult').className='complete-banner';$('taskResult').textContent='✓ 목표 조작과 경로 확인을 완료했습니다.';render();}else $('taskResult').textContent='필수 조작과 경로 확인을 다시 확인하세요.';toast(ok?'과제 달성':'아직 과제를 완료하지 않았습니다.',!ok);};
for(const id of ['guideBtn','footerGuide'])$(id).onclick=()=>$('guideDialog').showModal();$('closeGuide').onclick=()=>$('guideDialog').close();
$('overviewBtn').textContent='배선 확대 ↗';$('overviewBtn').onclick=()=>{const panel=document.querySelector('.ls-panel');panel.classList.toggle('expanded');$('overviewBtn').textContent=panel.classList.contains('expanded')?'확대 닫기 ↙':'배선 확대 ↗';};
$('fieldMenu').onclick=()=>toast('현장제어 · 확인된 경로 및 설비 구성');$('systemMenu').onclick=()=>document.querySelector('.log-panel').scrollIntoView({behavior:'smooth'});$('workspaceNav').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
$('exportBtn').onclick=()=>{const data={app:'CTC LAB v0.5',exportedAt:new Date().toISOString(),sources:C.sources,routeCatalog:C.routes,interlockingVerified:false,selectedStation,stations:stationStates,state};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ctc-lab-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
setInterval(()=>{if(!paused&&!$('actionDialog').open&&!$('guideDialog').open){const seconds=Number($('graphSpeed').value);for(const st of Object.values(stationStates))C.dispatch(st,{type:'tick',seconds});window.SimDiagram.render();$('clock').textContent=time(state.clock);$('stateScan').textContent=state.clock<state.scanUntil?'재수신 완료':'정상';}},1000);
fields();render();taskView();

window.SimDiagram.init({clock:()=>state.clock,selectStation});
