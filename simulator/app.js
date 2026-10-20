'use strict';
const $=id=>document.getElementById(id),C=window.SimCore;
let state=C.initial(),paused=false,practice='guided',activeTask=null,taskIndex=0,taskStart=0,dialogAction=null,toastTimer,completed=[];
try{completed=JSON.parse(localStorage.getItem('ctclab-v03-completed')||'[]');if(!Array.isArray(completed))completed=[];}catch{}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
const tasks=[
 {title:'LS에서 CCM 전환',desc:'원본 LS의 모드 버튼을 이용해 CCM으로 바꾸세요.',hint:'원본 화면 상단 CCM 버튼 → 예. MMI에도 현재 CCM이 표시됩니다.',source:'CTC 매뉴얼 p.14–15',check:e=>e.some(x=>x.type==='mode'&&x.source==='LS'&&x.value==='CCM')&&state.mode==='CCM'},
 {title:'MMI에서 모드 전환',desc:'MMI 현장설비제어를 이용해 CCM으로 전환하세요.',hint:'역제어모드 설정 → CCM → 확인.',source:'CTC 매뉴얼 p.16–17',check:e=>e.some(x=>x.type==='mode'&&x.source==='MMI'&&x.value==='CCM')&&state.mode==='CCM'},
 {title:'하행 장내 경로 확인',desc:'CCM 전환 후 LS의 1A에서 1A-1T 경로를 확인하세요. 녹색 진로와 진행 표시를 확인하세요.',hint:'1A는 상단 선로의 왼쪽 장내신호기입니다. XT → 21AT → 1T를 대조하세요.',source:'배선도 슬라이드 5 / 실무5 본문 p.362',check:e=>e.some(x=>x.type==='route'&&x.source==='LS'&&x.id==='1A-1T')&&!!state.routes['1A-1T']},
 {title:'상행 출발 경로 확인',desc:'MMI에서 3A-B065T를 선택하고, 하단 선로의 상행 출발 경로를 확인하세요.',hint:'CCM → 진로제어 → 3A → 3A-B065T → 설정 → 확인. 21BT → X1T → B065T입니다.',source:'CTC 매뉴얼 p.6 / 배선도 슬라이드 5',check:e=>e.some(x=>x.type==='route'&&x.source==='MMI'&&x.id==='3A-B065T')&&!!state.routes['3A-B065T']},
 {title:'3A의 두 출발 경로 비교',desc:'3A-B070T를 설정한 뒤 해정하고 3A-B065T를 설정하여 건넘선 경유 경로와 직진 경로를 비교하세요.',hint:'3A-B070T는 21B에서 21A 쪽으로 건너 상단 B070T로 향합니다. 3A-B065T는 하단 B065T로 향합니다.',source:'CTC 매뉴얼 p.6의 실제 진로목록',check:e=>['3A-B070T','3A-B065T'].every(id=>e.some(x=>x.type==='route'&&x.id===id))},
 {title:'건넘선 전환기 조작',desc:'CCM에서 21번과 22번 전환기를 각각 조작하세요.',hint:'LS의 전환기 영역 → 예, 또는 MMI 선로전환기제어 → 정·반위 → 확인. 진로가 없는 상태에서 정위·반위 조작을 연습하세요.',source:'배선도 슬라이드 5 · 21A/B와 22A/B',check:e=>['21','22'].every(id=>e.some(x=>x.type==='point'&&x.id===id))},
 {title:'LOCAL 현장 인계',desc:'LOCAL 요청을 현장에서 거절한 뒤, 다시 요청하여 수락하세요.',hint:'LOCAL → 예 → 현장 거절. 다시 LOCAL → 예 → 현장 수락.',source:'CTC 매뉴얼 p.15',check:e=>{const i=e.findIndex(x=>x.type==='handover'&&!x.accept);return i>=0&&e.slice(i+1).some(x=>x.type==='handover'&&x.accept)&&state.mode==='LOCAL';}},
 {title:'베이스스캔 범위 비교',desc:'LS에서 현재역 스캔, MMI에서 전체 제어역 스캔을 실행하세요.',hint:'LS 우클릭 → 현재역 스캔. MMI 베이스스캔 → 전체 제어역 → 확인.',source:'CTC 매뉴얼 p.8–10',check:e=>e.some(x=>x.type==='scan'&&x.source==='LS'&&x.scope==='current')&&e.some(x=>x.type==='scan'&&x.source==='MMI'&&x.scope==='all')}
];
function toast(msg,error=false){$('toast').textContent=msg;$('toast').className='show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').className='',5000);}
function run(a){const r=C.dispatch(state,a);render();if(a.type!=='tick')toast(r.message,!r.ok);return r;}
function openAction(title,body,action,label='예 · 실행'){$('dialogConfirm').hidden=false;$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;dialogAction=action;$('actionDialog').returnValue='';$('dialogConfirm').textContent=label;$('actionDialog').showModal();}
function routeDetails(id){const r=C.routes[id];return `<div class="route-detail"><b>${escapeHTML(id)}</b><p>${r.pathTracks.join(' → ')}</p><p class="evidence">${r.evidence}</p><p>${r.source.map(escapeHTML).join('<br>')}</p><p class="pending-note">접근 열차가 없는 기본 조작 연습 · 세부 연동조건은 구현 범위 안내 참조</p></div>`;}
function drawTracks(){
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
function renderLogs(){$('logCount').textContent=state.logs.length+' events';$('logList').innerHTML=state.logs.length?state.logs.slice(0,100).map(l=>`<div class="log-row"><span class="log-time">${time(l.time)}</span><div><p>${escapeHTML(l.message)}</p><div class="log-meta">${escapeHTML(l.source)} · <span class="${l.result==='완료'?'result-ok':'result-bad'}">${l.result}</span></div></div></div>`).join(''):'<p class="empty">첫 조작을 기다리고 있습니다.</p>';}
function render(){
 $('clock').textContent=time(state.clock);$('stateMode').textContent=state.mode;$('stateOwner').textContent=state.mode==='LOCAL'?'현장역':'관제실';$('stateRoutes').textContent=Object.keys(state.routes).length+'개 설정';$('stateScan').textContent=state.clock<state.scanUntil?'재수신 완료':'정상';
 $('lsStatus').textContent='CCM → 신호기 클릭 → 진로 선택 · 설정된 신호기 클릭 → 정지·해정';
 $('mmiState').textContent=`현재 ${state.mode} · LS와 같은 상태 · ${Object.keys(state.routes).length}개 진로 설정`;
 $('handoverBar').hidden=!state.pending;if(state.pending)$('handoverBar').innerHTML=`<span>${state.pending} 요청 · 가상 현장 응답 대기</span><button data-handover="yes">현장 수락</button><button data-handover="no">현장 거절</button>`;
 $('completedCount').textContent=`${completed.length} / 8 완료`;drawTracks();$('routeEvidence').innerHTML+='<p class="point-states">전환기 조작 상태: '+Object.entries(state.points).map(([id,v])=>id+' '+(v==='N'?'정위':'반위')).join(' · ')+'</p>';renderLogs();
}
function routeOptions(){$('mmiRoute').innerHTML=Object.keys(C.routes).filter(id=>C.routes[id].signal===$('mmiSignal').value).map(id=>`<option>${id}</option>`).join('');$('mmiRoute').onchange=()=>{$('mmiRouteEvidence').innerHTML=routeDetails($('mmiRoute').value);};$('mmiRouteEvidence').innerHTML=routeDetails($('mmiRoute').value);}
function fields(){const type=$('controlSelect').value;let html='';$('mmiApply').textContent='확인 · 명령 실행';
 if(type==='mode')html='<span class="field-label">제어모드</span><div class="radio-row">'+['AUTO','CCM','LOCAL'].map(v=>`<label><input type="radio" name="mmiMode" value="${v}" ${v==='CCM'?'checked':''}>${v}</label>`).join('')+'</div>';
 if(type==='route'){html='<label class="field-label" for="mmiSignal">신호기 · 근거가 있는 목록</label><select id="mmiSignal">'+['1A','2A','3A','4A'].map(id=>`<option>${id}</option>`).join('')+'</select><label class="field-label" for="mmiRoute">확인된 경로</label><select id="mmiRoute"></select><div class="radio-row"><label><input name="routeAction" type="radio" value="select" checked>설정</label><label><input name="routeAction" type="radio" value="withdraw">해정</label></div><div id="mmiRouteEvidence" class="compact-evidence"></div>';$('mmiApply').textContent='확인 · 진로 제어';}
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
function startTask(){if(state.logs.length&&!confirm('현재 상태와 기록을 초기화하고 과제를 시작할까요?'))return;state=C.initial();taskStart=0;activeTask=taskIndex;paused=false;$('pauseBtn').textContent='Ⅱ 일시정지';$('controlSelect').value='mode';fields();render();taskView();toast('과제 시작 · '+tasks[taskIndex].title);}
$('taskSelect').innerHTML=tasks.map((t,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${t.title}</option>`).join('');$('taskSelect').onchange=e=>{taskIndex=+e.target.value;taskView();};
document.querySelectorAll('[data-practice]').forEach(b=>b.onclick=()=>{practice=b.dataset.practice;document.querySelectorAll('[data-practice]').forEach(x=>x.classList.toggle('selected',x===b));taskView();});
$('lsDisplay').onclick=e=>{const mode=e.target.closest('[data-mode]'),signal=e.target.closest('[data-signal]'),point=e.target.closest('[data-point]');if(mode)openAction(mode.dataset.mode+' 모드 전환',`제어모드를 ${mode.dataset.mode}로 전환하시겠습니까?`,{type:'mode',value:mode.dataset.mode,source:'LS'});else if(signal)signalAction(signal.dataset.signal);else if(point)pointAction(point.dataset.point);};
$('trackSvg').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
$('lsDisplay').oncontextmenu=e=>{e.preventDefault();openAction('베이스스캔','가상 상태정보를 재수신합니다.<select id="lsScope" aria-label="베이스스캔 범위"><option value="current">현재역 베이스스캔</option><option value="all">전체역 베이스스캔</option></select>',()=>({type:'scan',scope:$('lsScope').value,source:'LS'}));};
$('actionDialog').addEventListener('close',()=>{if(!dialogAction)return;const a=typeof dialogAction==='function'?dialogAction():dialogAction;dialogAction=null;if($('actionDialog').returnValue==='confirm')run(a);else run({type:'cancel',target:a.type,source:'LS'});});
$('handoverBar').onclick=e=>{const b=e.target.closest('[data-handover]');if(b)run({type:'handover',accept:b.dataset.handover==='yes',source:'현장'});};
$('controlSelect').onchange=fields;$('mmiApply').onclick=()=>{const type=$('controlSelect').value,checked=n=>document.querySelector(`input[name="${n}"]:checked`).value;
 if(type==='mode')run({type,value:checked('mmiMode'),source:'MMI'});
 if(type==='route')run({type:checked('routeAction')==='select'?'route':'withdraw',id:$('mmiRoute').value,source:'MMI'});
 if(type==='point')run({type:'point',id:$('mmiPoint').value,value:checked('pointPosition'),source:'MMI'});
 if(type==='scan')run({type,scope:checked('mmiScope'),source:'MMI'});
};
$('mmiCancel').onclick=()=>{run({type:'cancel',source:'MMI'});fields();};$('pauseBtn').onclick=()=>{paused=!paused;$('pauseBtn').textContent=paused?'▶ 계속':'Ⅱ 일시정지';};$('skipBtn').onclick=()=>run({type:'tick',seconds:10});
$('resetBtn').onclick=()=>{if(!confirm('현재 상태와 조작 기록을 초기화할까요?'))return;state=C.initial();activeTask=null;paused=false;$('pauseBtn').textContent='Ⅱ 일시정지';fields();render();taskView();};
$('startTask').onclick=startTask;$('nextTask').onclick=()=>{taskIndex=(taskIndex+1)%tasks.length;taskView();};
$('checkTask').onclick=()=>{if(activeTask!==taskIndex)return toast('먼저 이 과제를 시작하세요.',true);const ok=tasks[taskIndex].check(state.events.slice(taskStart));if(ok){if(!completed.includes(taskIndex))completed.push(taskIndex);try{localStorage.setItem('ctclab-v03-completed',JSON.stringify(completed));}catch{}taskView();$('taskResult').className='complete-banner';$('taskResult').textContent='✓ 목표 조작과 경로 확인을 완료했습니다.';render();}else $('taskResult').textContent='필수 조작과 경로 확인을 다시 확인하세요.';toast(ok?'과제 달성':'아직 과제를 완료하지 않았습니다.',!ok);};
for(const id of ['guideBtn','footerGuide'])$(id).onclick=()=>$('guideDialog').showModal();$('closeGuide').onclick=()=>$('guideDialog').close();
$('overviewBtn').textContent='배선 확대 ↗';$('overviewBtn').onclick=()=>{const panel=document.querySelector('.ls-panel');panel.classList.toggle('expanded');$('overviewBtn').textContent=panel.classList.contains('expanded')?'확대 닫기 ↙':'배선 확대 ↗';};
$('fieldMenu').onclick=()=>toast('현장제어 · 확인된 경로 및 설비 구성');$('systemMenu').onclick=()=>document.querySelector('.log-panel').scrollIntoView({behavior:'smooth'});$('workspaceNav').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
$('exportBtn').onclick=()=>{const data={app:'CTC LAB v0.3',exportedAt:new Date().toISOString(),sources:C.sources,routeCatalog:C.routes,interlockingVerified:false,state};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ctc-lab-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
setInterval(()=>{if(!paused&&!$('actionDialog').open&&!$('guideDialog').open){C.dispatch(state,{type:'tick',seconds:1});$('clock').textContent=time(state.clock);$('stateScan').textContent=state.clock<state.scanUntil?'재수신 완료':'정상';}},1000);
fields();render();taskView();
