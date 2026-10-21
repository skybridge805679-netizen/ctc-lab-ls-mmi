'use strict';
const $=id=>document.getElementById(id),BaseCore=window.SimCore,N=window.SimNetwork;
let C=BaseCore,selectedStation='underground-seoul',mapZoom=1;
const stationStates=Object.fromEntries(N.stations.filter(st=>st.controlled).map(st=>[st.id,BaseCore.forStation(st.id).initial()]));
let state=stationStates[selectedStation],paused=false,practice='guided',activeTask=null,taskIndex=0,taskStart=0,dialogAction=null,toastTimer,completed=[];
try{completed=JSON.parse(localStorage.getItem('ctclab-v03-completed')||'[]');if(!Array.isArray(completed))completed=[];}catch{}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
const tasks=window.SimPractice.tasks;
completed=[...new Set(completed.filter(i=>Number.isInteger(i)&&i>=0&&i<tasks.length))];
function toast(msg,error=false){$('toast').textContent=msg;$('toast').className='show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').className='',5000);}
function run(a){let r;if(a.type==='tick'){for(const [id,st]of Object.entries(stationStates))BaseCore.forStation(id).dispatch(st,a);r={ok:true};}else if(a.type==='scan'&&a.scope==='all'){for(const [id,st]of Object.entries(stationStates))BaseCore.forStation(id).dispatch(st,a);r={ok:true,message:'전체 15개 취급역 상태 재수신'};}else r=C.dispatch(state,a);render();if(a.type!=='tick')toast(r.message,!r.ok);return r;}
function openAction(title,body,action,label='예 · 실행'){$('dialogConfirm').hidden=false;$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;dialogAction=action;$('actionDialog').returnValue='';$('dialogConfirm').textContent=label;$('actionDialog').showModal();}
function routeDetails(id){const r=C.routes[id];return `<div class="route-detail"><b>${escapeHTML(id)}</b><p>${r.pathTracks.join(' → ')}</p><p class="evidence">${r.evidence}</p><p>${r.source.map(escapeHTML).join('<br>')}</p><p class="pending-note">배선 연결 연습 모델 · 경로의 공유 구간·전환기를 쇄정합니다. 실설비 진로표와 세부 연동조건은 별도 검증 대상입니다</p></div>`;}
const mapHotspots={
 'cheongnyangni':[20,8,265,35],'dongmyo':[435,8,265,35],'jonggak':[850,8,270,35],'underground-seoul':[1260,8,285,35],'seoul':[1690,8,300,35],
 'yongsan':[30,245,280,35],'noryangjin':[370,245,240,35],'yeongdeungpo':[790,245,260,35],'guro':[1110,245,265,35],'geumcheon':[1540,245,300,35],
 'anyang':[15,520,270,40],'geumjeong':[365,520,250,40],'gunpo':[630,520,200,40],'uiwang':[1070,520,270,40],'suwon':[1770,520,270,40]
};
function stationView(){return $('mapSheet').value==='station';}
function mapPages(){if(stationView())return [N.catalog[selectedStation].map.page];return $('mapSheet').value==='all'?[2,4,3]:[Number($('mapSheet').value)];}
function sheetOffset(page){return mapPages().indexOf(page)*800;}
function drawTracks(){
 const pages=mapPages(),svgElement=$('trackSvg');
 $('mapOverview').textContent=stationView()?'전체노선 보기':'선택역 화면으로';
 let svg='';
 for(const [index,page]of pages.entries()){
  svg+=`<g data-sheet="${page}" transform="translate(0 ${index*800})"><image href="assets/line-map/page-${page}.jpg" width="2048" height="768"/>`;
  if(page===1){
   for(const [id,[x,y,w,h]]of Object.entries(mapHotspots))svg+=`<g data-map-station="${id}" tabindex="0" role="button" aria-label="${N.catalog[id].name} 구간으로 이동"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/><title>${N.catalog[id].name} · ${stationStates[id].mode} · ${Object.keys(stationStates[id].routes).length} 진로</title></g>`;
  }else for(const st of N.stations.filter(st=>st.controlled&&(!stationView()||st.id===selectedStation)&&(st.map.page===page||st.map.copies?.some(c=>c.page===page)))){
   const map=st.map,model=stationStates[st.id],core=BaseCore.forStation(st.id);
   const copy=map.page===page?{dx:0,dy:0}:map.copies.find(c=>c.page===page);
   svg+=`<g data-control-station="${st.id}" data-primary="${map.page===page}" transform="translate(${copy.dx} ${copy.dy})"><g transform="translate(${copy.headerDx||0} ${copy.headerDy||0})">`;
   for(const [i,mode]of ['AUTO','CCM','LOCAL'].entries()){
    const pos=map.modes[i];
    svg+=`<g data-mode="${mode}" role="button" tabindex="0" aria-label="${st.name} ${mode} 모드"><rect x="${pos.x}" y="${pos.y}" width="25" height="14" fill="${model.mode===mode?{AUTO:'#28e35f',CCM:'#f5e425',LOCAL:'#f5b554'}[mode]:'#fff'}" stroke="#111" stroke-width="0.4"/><text x="${pos.x+12.5}" y="${pos.y+10.2}" text-anchor="middle" font-size="9" font-weight="700" fill="#111">${mode}</text></g>`;
   }
   const last=map.modes[2];
   svg+=`<g data-stop-all="true" role="button" tabindex="0" aria-label="${st.name} 신호기 일괄정지"><rect x="${last.x+29}" y="${last.y-5}" width="40" height="29" fill="transparent"/><title>${st.name} 신호기 일괄정지</title></g>`;
   svg+='</g>';
   for(const [id,active]of Object.entries(model.routes))svg+=`<path data-active-route="${id}" data-route-station="${st.id}" d="${map.paths[id]}" stroke="${active.occupied?'#ff453b':'#36ed06'}" stroke-width="3.2" stroke-opacity="0.68" fill="none" pointer-events="none"/>`;
   for(const [id,signal]of Object.entries(core.signals)){
    const pos=map.signals[id],lampX=pos.x+pos.dir*3.3;
    if(model.signals[id]==='GO')svg+=`<ellipse cx="${lampX}" cy="${pos.y}" rx="2.5" ry="1.8" fill="${signal.kind==='입환'?'#fff':'#36ed06'}" stroke="#151515" stroke-width="0.4"/>`;
    svg+=`<g class="signal-hit" data-signal="${id}" role="button" tabindex="0" aria-label="${st.name} ${id} ${signal.kind}신호기"><rect x="${pos.x-6}" y="${pos.y-2.4}" width="12" height="4.8" fill="transparent"/><title>${st.name} ${id} ${signal.kind}신호기</title></g>`;
   }
   for(const [id,pos]of Object.entries(map.points))svg+=`<g class="point-hit" data-point="${id}" role="button" tabindex="0" aria-label="${st.name} ${id} 선로전환기"><rect x="${pos.x-3}" y="${pos.y-3}" width="6" height="6" fill="${model.points[id]==='R'?'#ffb02e88':'transparent'}" stroke="${model.blockedPoints.includes(id)?'#ff453b':'#acd8ed'}" stroke-width="0.5"/><title>${st.name} ${id} · ${model.points[id]}${model.blockedPoints.includes(id)?' · 쇄정':''}</title></g>`;
   const first=map.modes[0];svg+=`<g data-select-control="${st.id}" role="button" tabindex="0" aria-label="${st.name} MMI 제어역 선택"><rect x="${first.x+140+(copy.headerDx||0)}" y="${first.y-10+(copy.headerDy||0)}" width="85" height="42" fill="transparent" stroke="${st.id===selectedStation?'#53c9ff':'transparent'}" stroke-width="1.2"/><title>${st.name} MMI 제어역 선택</title></g></g>`;
  }
  svg+='</g>';
 }
 const height=pages.length*800-32;
 const bounds=stationView()?N.catalog[selectedStation].map.view.bounds:[0,0,2048,height];
 svgElement.setAttribute('viewBox',bounds.join(' '));svgElement.style.aspectRatio=`${bounds[2]} / ${bounds[3]}`;
 document.querySelector('.track-frame').classList.toggle('station-view',stationView());svgElement.style.width=(mapZoom*100)+'%';svgElement.style.minWidth='100%';
 svgElement.setAttribute('aria-label',stationView()?`${N.catalog[selectedStation].name} LS · ${N.catalog[selectedStation].map.view.intermediate.join(' · ')} · 관할 역간 포함`:'청량리–수원 전체 배선');svgElement.innerHTML=svg;
 $('mapZoomValue').textContent=Math.round(mapZoom*100)+'%';
 $('routeEvidence').innerHTML=Object.keys(state.routes).length?Object.keys(state.routes).map(id=>routeDetails(id)+`<div class="route-run-controls"><button data-sim-enter="${id}" ${state.routes[id].occupied?'disabled':''}>모의 열차 진입</button><button data-sim-clear="${id}" ${state.routes[id].occupied?'':'disabled'}>모의 열차 통과</button><span>${state.routes[id].occupied?'점유 · 진로 쇄정':'설정'} · ${state.routes[id].control==='continuous'?'연속제어':'단일제어'}</span></div>`).join(''):'<p class="evidence-empty">취급역의 CCM → 신호기 → 진로를 선택하세요. 중간역과 역간 배선은 화면에 그대로 유지됩니다.</p>';
}
$('mapOverview').onclick=()=>{$('mapSheet').value=stationView()?'1':'station';mapZoom=1;render();scrollToStation();};
$('mapSheet').onchange=()=>{mapZoom=1;render();scrollToStation();};
$('mapZoomIn').onclick=()=>{mapZoom=Math.min(6,mapZoom+0.5);drawTracks();};
$('mapZoomOut').onclick=()=>{mapZoom=Math.max(1,mapZoom-0.5);drawTracks();};
$('mapFit').onclick=()=>{mapZoom=1;drawTracks();};
$('routeEvidence').onclick=e=>{const enter=e.target.closest('[data-sim-enter]'),clear=e.target.closest('[data-sim-clear]');if(enter)run({type:'occupy',id:enter.dataset.simEnter,source:'모의운행'});if(clear)run({type:'clear',id:clear.dataset.simClear,source:'모의운행'});};
function scrollToStation(){if(stationView()){document.querySelector('.track-frame').scrollTo(0,0);return;}const st=N.catalog[selectedStation],offset=sheetOffset(st.map.page),frame=document.querySelector('.track-frame');if(offset<0)return;const scale=$('trackSvg').getBoundingClientRect().width/2048;frame.scrollTo({top:Math.max(0,(offset+st.map.modes[0].y-25)*scale),left:Math.max(0,(st.map.modes[0].x-60)*scale-frame.clientWidth/4),behavior:'instant'});}
function selectStation(id,scroll=true){
 if(!N.catalog[id]?.controlled)return;
 if($('actionDialog').open){toast('제어 확인창을 닫은 뒤 역을 변경하세요.',true);$('stationSelect').value=selectedStation;$('lsStationSelect').value=selectedStation;return;}
 stationStates[selectedStation]=state;
 selectedStation=id;if(scroll){$('mapSheet').value='station';mapZoom=1;}C=BaseCore.forStation(id);state=stationStates[id];
 $('stationSelect').value=id;$('lsStationSelect').value=id;
 fields();render();taskView();if(scroll)scrollToStation();
}
const stationOptions=N.stations.filter(st=>st.controlled).map(st=>`<option value="${st.id}">${st.name}${st.controlled?' ['+st.code+']':' · 비연동'}</option>`).join('');
$('stationSelect').innerHTML=stationOptions;$('lsStationSelect').innerHTML=stationOptions;
$('stationSelect').value=selectedStation;$('lsStationSelect').value=selectedStation;
$('stationSelect').onchange=e=>selectStation(e.target.value);$('lsStationSelect').onchange=e=>selectStation(e.target.value);
$('stationTabs').innerHTML=N.stations.filter(st=>st.controlled).map(st=>`<button data-station="${st.id}">${st.name}</button>`).join('');
$('stationTabs').onclick=e=>{const button=e.target.closest('[data-station]');if(button)selectStation(button.dataset.station);};
for(const [id,step]of [['previousStation',-1],['nextStation',1]])$(id).onclick=()=>{const stations=N.stations.filter(s=>s.controlled),next=stations[stations.findIndex(s=>s.id===selectedStation)+step];if(next)selectStation(next.id);};
function renderLogs(){$('logCount').textContent=state.logs.length+' events';$('logList').innerHTML=state.logs.length?state.logs.slice(0,100).map(l=>`<div class="log-row"><span class="log-time">${time(l.time)}</span><div><p>${escapeHTML(l.message)}</p><div class="log-meta">${escapeHTML(l.source)} · <span class="${l.result==='완료'?'result-ok':'result-bad'}">${l.result}</span></div></div></div>`).join(''):'<p class="empty">첫 조작을 기다리고 있습니다.</p>';}
function render(){
 const st=N.catalog[selectedStation];
 $('stationScope').textContent=`${st.name} · ${st.map.view.intermediate.join(' · ')||'구내 및 역간'}`;
 document.querySelectorAll('[data-station]').forEach(b=>b.classList.toggle('selected',b.dataset.station===selectedStation));
 document.querySelector('.window-caption').innerHTML=`현장설비제어 <span>${st.name} [${st.code}]</span>`;
 document.querySelector('.sessionbar>div:first-child').innerHTML=`<span class="live-dot"></span><b>조작·경로 확인</b><span class="bar-sep"></span><span>${st.name}</span><span class="muted">${st.code}</span>`;
 document.querySelector('.side-station').innerHTML=`<span class="live-dot"></span>${st.name} <small>${st.code}</small>`;
 document.querySelector('.fidelity-note').innerHTML=`${stationView()?st.name+' LS · '+(st.map.view.intermediate.join(' · ')||'구내 및 역간'):'전체 배선 · PDF '+($('mapSheet').value==='all'?'2·4·3':$('mapSheet').value)+'쪽'}<b>관할 중간역·역간 포함</b>`;
 const controlled=N.stations.filter(s=>s.controlled),index=controlled.findIndex(s=>s.id===selectedStation);
 $('previousStation').textContent=index>0?'◀ '+controlled[index-1].name:'시점';$('previousStation').disabled=index===0;
 $('nextStation').textContent=index<controlled.length-1?controlled[index+1].name+' ▶':'종점';$('nextStation').disabled=index===controlled.length-1;
 $('clock').textContent=time(state.clock);$('stateMode').textContent=st.controlled?state.mode:'비연동';$('stateOwner').textContent=state.mode==='LOCAL'?'현장역':'관제실';$('stateRoutes').textContent=Object.keys(state.routes).length+'개 설정';$('stateScan').textContent=state.clock<state.scanUntil?'재수신 완료':'정상';
 $('lsStatus').textContent=stationView()?'CCM → 신호기 → 진로 선택 · 좌우 화살표로 인접 취급역 이동':'전체노선 · 역 이름을 눌러 개별 LS 화면으로 이동';
 $('mmiState').textContent=`현재 ${state.mode} · LS와 같은 상태 · ${Object.keys(state.routes).length}개 진로 설정`;
 $('handoverBar').hidden=!state.pending;if(state.pending)$('handoverBar').innerHTML=`<span>${state.pending} 요청 · 가상 현장 응답 대기</span><button data-handover="yes">현장 수락</button><button data-handover="no">현장 거절</button>`;
 $('completedCount').textContent=`${completed.length} / ${tasks.length} 완료`;drawTracks();$('routeEvidence').innerHTML+='<p class="point-states">전환기 조작 상태: '+Object.entries(state.points).map(([id,v])=>id+' '+(v==='N'?'정위':'반위')).join(' · ')+'</p>';renderLogs();window.SimDiagram?.render();
}
function routeOptions(){if(!Object.keys(C.routes).length){$('mmiRoute').innerHTML='';$('mmiRouteEvidence').textContent='이 역에는 수동 진로제어가 없습니다.';return;}$('mmiRoute').innerHTML=Object.keys(C.routes).filter(id=>C.routes[id].signal===$('mmiSignal').value).map(id=>`<option>${id}</option>`).join('');$('mmiRoute').onchange=()=>{$('mmiRouteEvidence').innerHTML=routeDetails($('mmiRoute').value);};$('mmiRouteEvidence').innerHTML=routeDetails($('mmiRoute').value);}
function fields(){const type=$('controlSelect').value;$('mmiApply').disabled=!N.catalog[selectedStation].controlled&&type!=='scan';let html='';$('mmiApply').textContent='확인 · 명령 실행';
 if(type==='mode')html='<span class="field-label">제어모드</span><div class="radio-row">'+['AUTO','CCM','LOCAL'].map(v=>`<label><input type="radio" name="mmiMode" value="${v}" ${v==='CCM'?'checked':''}>${v}</label>`).join('')+'</div>';
 if(type==='route'){html='<label class="field-label" for="mmiSignal">신호기 목록</label><select id="mmiSignal">'+[...new Set(Object.values(C.routes).map(r=>r.signal))].map(id=>`<option>${id}</option>`).join('')+'</select><label class="field-label" for="mmiRoute">진로 · 배선 연결 경로</label><select id="mmiRoute"></select><div class="radio-row"><label><input name="routeAction" type="radio" value="select" checked>설정</label><label><input name="routeAction" type="radio" value="withdraw">해정</label></div><label class="field-label" for="routeControl">제어종류</label><select id="routeControl"><option value="single">진로제어</option><option value="continuous">연속진로제어</option></select><div id="mmiRouteEvidence" class="compact-evidence"></div>';$('mmiApply').textContent='확인 · 진로 제어';}
 if(type==='point'){html='<label class="field-label" for="mmiPoint">원본 선로전환기 목록</label><select id="mmiPoint">'+Object.entries(C.points).map(([id,p])=>`<option value="${id}">${id} · ${p.parts.join(' / ')}</option>`).join('')+'</select><div class="radio-row"><label><input type="radio" name="pointPosition" value="N" checked>정위 N</label><label><input type="radio" name="pointPosition" value="R">반위 R</label></div><div class="radio-row"><label><input name="pointAction" type="radio" value="move" checked>전환</label><label><input name="pointAction" type="radio" value="lock">쇄정</label><label><input name="pointAction" type="radio" value="unlock">해제</label></div><p>전환기 위치는 N/R로 표시합니다. 설정·점유 진로가 사용하는 전환기는 움직일 수 없습니다.</p>';$('mmiApply').textContent='확인 · 전환기 제어';}
 if(type==='stopAll')html='<p>선택역의 모든 설정 신호기를 정지합니다. 점유 중인 진로는 쇄정을 유지합니다.</p>';
 if(type==='scan')html='<span class="field-label">제어구분</span><div class="radio-row"><label><input type="radio" name="mmiScope" value="current" checked>선택역</label><label><input type="radio" name="mmiScope" value="all">전체 제어역</label></div>';
 $('mmiFields').innerHTML=html;if(type==='route'){routeOptions();$('mmiSignal').onchange=routeOptions;}
}
function signalAction(id){
 const active=Object.keys(state.routes).find(key=>C.routes[key].signal===id);
 if(active){openAction(id+' 신호 정지·진로 해정','신호를 정지하고 진로를 해정하시겠습니까?<p>점유 중이면 신호만 정지하고 진로 쇄정을 유지합니다</p>',{type:'stop',id,source:'LS'});return;}
 const entries=Object.keys(C.routes).filter(key=>C.routes[key].signal===id);
 if(!entries.length){toast(id+' 입환신호기의 진로목록은 아직 구현하지 않았습니다.',true);return;}
 openAction('[ 진로 제어 ]','<p>교재・대본 대조 경로와 배선 연결로 도출한 연습 경로를 구분합니다.</p>'+entries.map(key=>`<button type="button" class="route-choice" data-route-choice="${key}">RT_${key.replace('-','_')} <small>${C.routes[key].geometryDerived?'배선 연결 경로':'교재·대본 대조'}</small></button>`).join(''),null);
 $('dialogConfirm').hidden=true;
 document.querySelectorAll('[data-route-choice]').forEach(button=>button.onclick=()=>{$('actionDialog').close();$('dialogConfirm').hidden=false;run({type:'route',id:button.dataset.routeChoice,source:'LS'});});
}
function pointAction(id){const value=state.points[id]==='N'?'R':'N';openAction(id+' 선로전환기 제어',`현재 ${state.points[id]==='N'?'정위':'반위'} → ${value==='N'?'정위':'반위'}로 조작하시겠습니까?`,{type:'point',id,value,source:'LS'});}
function taskView(){const t=tasks[taskIndex];$('taskSelect').value=taskIndex;$('taskBody').innerHTML=practice==='free'?'<div class="task-card"><div class="task-heading"><span class="task-num">∞</span><h3>원본 배선도와 경로 대조</h3></div><p>1A·2A·3A·4A를 눌러 경로 근거를 확인하고, 전환기 구성을 대조하세요. 설정한 신호기를 다시 눌러 정지·해정할 수 있습니다.</p></div>':`<div class="task-card"><div class="task-heading"><span class="task-num">${String(taskIndex+1).padStart(2,'0')}</span><h3>${t.title}</h3><span class="task-badge">${completed.includes(taskIndex)?'✓ 달성':activeTask===taskIndex?'진행 중':'시작 전'}</span></div><p>${t.desc}</p>${practice==='guided'?`<p class="task-hint">↳ ${t.hint}</p>`:''}<p>근거: ${t.source}</p><p id="taskResult"></p></div>`;for(const id of ['startTask','checkTask','nextTask'])$(id).hidden=practice==='free';}
function startTask(){if(state.logs.length&&!confirm('현재 상태와 기록을 초기화하고 과제를 시작할까요?'))return;selectStation('underground-seoul');state=C.initial();state.clock=stationStates[selectedStation].clock;stationStates[selectedStation]=state;taskStart=0;activeTask=taskIndex;paused=false;$('pauseBtn').textContent='Ⅱ 일시정지';$('controlSelect').value='mode';fields();render();taskView();toast('과제 시작 · '+tasks[taskIndex].title);}
$('taskSelect').innerHTML=tasks.map((t,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${t.title}</option>`).join('');$('taskSelect').onchange=e=>{taskIndex=+e.target.value;taskView();};
document.querySelectorAll('[data-practice]').forEach(b=>b.onclick=()=>{practice=b.dataset.practice;document.querySelectorAll('[data-practice]').forEach(x=>x.classList.toggle('selected',x===b));taskView();});
$('lsDisplay').onclick=e=>{
 const station=e.target.closest('[data-map-station]');if(station){selectStation(station.dataset.mapStation);return;}
 const control=e.target.closest('[data-select-control]');if(control){selectStation(control.dataset.selectControl);return;}
 const owner=e.target.closest('[data-control-station]');if(owner&&owner.dataset.controlStation!==selectedStation){if($('actionDialog').open)return;selectStation(owner.dataset.controlStation,false);}
 const mode=e.target.closest('[data-mode]'),signal=e.target.closest('[data-signal]'),point=e.target.closest('[data-point]'),stop=e.target.closest('[data-stop-all]');
 if(mode)openAction('역제어모드 설정',N.catalog[selectedStation].name+' '+mode.dataset.mode+' 모드로 전환하시겠습니까?',{type:'mode',value:mode.dataset.mode,source:'LS'});
 else if(signal)signalAction(signal.dataset.signal);
 else if(point)pointAction(point.dataset.point);
 else if(stop)openAction('신호기 일괄정지',N.catalog[selectedStation].name+'의 설정 신호기를 모두 정지합니다. 점유 중인 진로는 쇄정을 유지합니다.',{type:'stopAll',source:'LS'});
};
$('trackSvg').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
$('lsDisplay').oncontextmenu=e=>{e.preventDefault();openAction('베이스스캔','가상 상태정보를 재수신합니다.<select id="lsScope" aria-label="베이스스캔 범위"><option value="current">현재역 베이스스캔</option><option value="all">전체역 베이스스캔</option></select>',()=>({type:'scan',scope:$('lsScope').value,source:'LS'}));};
$('actionDialog').addEventListener('close',()=>{if(!dialogAction)return;const a=typeof dialogAction==='function'?dialogAction():dialogAction;dialogAction=null;if($('actionDialog').returnValue==='confirm')run(a);else run({type:'cancel',target:a.type,id:a.id,source:'LS'});});
$('handoverBar').onclick=e=>{const b=e.target.closest('[data-handover]');if(b)run({type:'handover',accept:b.dataset.handover==='yes',source:'현장'});};
$('controlSelect').onchange=fields;$('mmiApply').onclick=()=>{const type=$('controlSelect').value,checked=n=>document.querySelector(`input[name="${n}"]:checked`).value;
 if(type==='mode')run({type,value:checked('mmiMode'),source:'MMI'});
 if(type==='route')run({type:checked('routeAction')==='select'?'route':'withdraw',id:$('mmiRoute').value,control:$('routeControl').value,source:'MMI'});
 if(type==='point'){const op=checked('pointAction');run({type:op==='move'?'point':'pointLock',id:$('mmiPoint').value,value:checked('pointPosition'),lock:op==='lock',source:'MMI'});}
 if(type==='stopAll')openAction('신호기 일괄정지',N.catalog[selectedStation].name+' 신호기를 모두 정지하시겠습니까?',{type:'stopAll',source:'MMI'});
 if(type==='scan')run({type,scope:checked('mmiScope'),source:'MMI'});
};
$('mmiCancel').onclick=()=>{run({type:'cancel',source:'MMI'});fields();};$('pauseBtn').onclick=()=>{paused=!paused;$('pauseBtn').textContent=paused?'▶ 계속':'Ⅱ 일시정지';};$('skipBtn').onclick=()=>run({type:'tick',seconds:10});
$('resetBtn').onclick=()=>{if(!confirm('현재 상태와 조작 기록을 초기화할까요?'))return;const clock=state.clock;state=C.initial();state.clock=clock;stationStates[selectedStation]=state;activeTask=null;paused=false;$('pauseBtn').textContent='Ⅱ 일시정지';fields();render();taskView();};
$('startTask').onclick=startTask;$('nextTask').onclick=()=>{taskIndex=(taskIndex+1)%tasks.length;taskView();};
$('checkTask').onclick=()=>{if(selectedStation!=='underground-seoul')return toast('지하서울로 전환해 과제를 확인하세요.',true);if(activeTask!==taskIndex)return toast('먼저 이 과제를 시작하세요.',true);const ok=tasks[taskIndex].check(state.events.slice(taskStart),state);if(ok){if(!completed.includes(taskIndex))completed.push(taskIndex);try{localStorage.setItem('ctclab-v03-completed',JSON.stringify(completed));}catch{}taskView();$('taskResult').className='complete-banner';$('taskResult').textContent='✓ 목표 조작과 경로 확인을 완료했습니다.';render();}else $('taskResult').textContent='필수 조작과 경로 확인을 다시 확인하세요.';toast(ok?'과제 달성':'아직 과제를 완료하지 않았습니다.',!ok);};
for(const id of ['guideBtn','footerGuide'])$(id).onclick=()=>$('guideDialog').showModal();$('closeGuide').onclick=()=>$('guideDialog').close();
$('overviewBtn').textContent='배선 확대 ↗';$('overviewBtn').onclick=()=>{const panel=document.querySelector('.ls-panel');panel.classList.toggle('expanded');$('overviewBtn').textContent=panel.classList.contains('expanded')?'확대 닫기 ↙':'배선 확대 ↗';};
$('fieldMenu').onclick=()=>toast('현장제어 · 확인된 경로 및 설비 구성');$('systemMenu').onclick=()=>document.querySelector('.log-panel').scrollIntoView({behavior:'smooth'});$('workspaceNav').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
$('exportBtn').onclick=()=>{const data={app:'CTC LAB v0.6.1',exportedAt:new Date().toISOString(),sources:C.sources,routeCatalog:C.routes,interlockingVerified:false,selectedStation,stations:stationStates,state};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='ctc-lab-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
setInterval(()=>{if(!paused&&!$('actionDialog').open&&!$('guideDialog').open){const seconds=Number($('graphSpeed').value);for(const st of Object.values(stationStates))C.dispatch(st,{type:'tick',seconds});window.SimDiagram.render();$('clock').textContent=time(state.clock);$('stateScan').textContent=state.clock<state.scanUntil?'재수신 완료':'정상';}},1000);
fields();render();taskView();

window.SimDiagram.init({clock:()=>state.clock,selectStation});
