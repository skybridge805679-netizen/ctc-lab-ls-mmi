(function(root){
'use strict';
// "ORPHEIA MMI" shell (a parody of the real school MMI; no school logo is used): Windows-style menu bar, floating windows and the alarm / event log panes, as seen on the real MMI
// (photos 2026-10-21). Existing panels (field control, graph, schedule) are hosted as windows; their element ids are kept.
const N=root.SimNetwork,doc=document,$=id=>doc.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PENDING='원본 화면을 아직 확인하지 못해 구현하지 않았습니다.';
// Menu structure copied from the photos. Items without `open` are known names whose windows are not implemented yet;
// menus whose entries were never photographed are marked as unknown.
const MENUS=[
 {label:'프로그램',items:[
  {label:'로그재생(R)',open:'logReplay'},
  {label:'도구모음설정',items:[{label:'메뉴바',disabled:true},{label:'상태표시줄',disabled:true},{sep:true},{label:'이벤트로그창',act:'logEvent'},{label:'알람로그창',act:'logAlarm'}]},
  {label:'프로그램 환경설정',open:'settings'}]},
 {label:'현장제어',items:[
  {label:'현장설비제어(A)',open:'field'},
  {label:'열차제어',items:[{label:'열차번호제어(B)',open:'trainNumber'},{label:'열차추적(T)',open:'trace'}]}]},
 {label:'열차스케줄',items:[
  {label:'열차운행패턴 관리(P)',open:'pattern'},
  {label:'온라인열차스케줄 관리',items:[{label:'온라인 열차스케줄ID관리(I)',open:'scheduleId'},{label:'온라인 열차스케줄관리(G)',open:'schedule'},{label:'진입예고열차관리(E)',open:'entryNotice'}]},
  {label:'온라인 열차그래프(O)',open:'graph'},
  {label:'오프라인 열차그래프(F)',open:'offlineGraph'},
  {label:'오프라인 열차스케줄',items:[{label:'(원본 메뉴 항목 미확인)',disabled:true}]}]},
 {label:'시스템 조회',items:[
  {label:'경광등상태',open:'beacon'},{label:'알람메시지 확인이력 조회',open:'alarmAck'},
  {label:'수동제어 이력 조회',items:[{label:'열차번호 수동조작 이력',open:'manualTrain'},{label:'역제어모드 수동조작 이력',open:'manualMode'},{label:'현장설비 수동조작 이력',open:'manualField'}]},
  {sep:true},{label:'열차위치목록 조회',open:'trainPositions'},{sep:true},
  {label:'열차스케줄 이력조회',items:[{label:'온라인 스케줄 이력',open:'scheduleHistory'}]},
  {label:'알람/이벤트조회',open:'alarmEvent'},{sep:true},
  {label:'실적조회',items:[{label:'역실적 조회',open:'stationActual'},{label:'열차실적 조회',open:'trainActual'},{sep:true},{label:'운휴열차조회',open:'cancelledList'},{label:'임시열차 조회',open:'createdList'},{label:'지연열차조회',open:'delayList'}]}]},
 {label:'시스템 관리',items:[
  {label:'제어화면 관리',items:[{label:'운영자선호화면 설정',open:'preferredScreen'},{sep:true},{label:'모니터 위치 설정',open:'monitorPos'},{label:'RAIL Track ROUTE',open:'railRoute'},{label:'FTS 스케줄편집',open:'ftsEdit'}]},
  {label:'(이 메뉴의 다른 항목은 미확인)',disabled:true}]}
];
const windows={};let host=null,zTop=20,desktop,logRows={alarm:[],event:[]};
const stamp=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d).replaceAll('-','/');

// ---------------------------------------------------------------- logs
function renderLogs(){
 for(const kind of ['alarm','event']){
  const body=$(kind+'LogBody');if(!body)continue;
  body.innerHTML=logRows[kind].length?logRows[kind].slice(0,200).map(r=>`<tr><td>[안내]</td><td>${r.time}</td><td>${esc(r.text)}</td></tr>`).join(''):`<tr class="empty"><td colspan="3">기록 없음</td></tr>`;
 }
}
function log(kind,text,date=new Date()){logRows[kind].unshift({time:stamp(date),text});if(logRows[kind].length>500)logRows[kind].length=500;renderLogs();}
// Station names and codes as the real MMI shows them (photos): Cheongnyangni is 지하청량리; the 18 jurisdiction stations have codes too.
const REAL_NAME={cheongnyangni:'지하청량리'};
const REAL_CODE={'제기동':'010001','신설동':'010002','동대문':'010011','종로5가':'010012','종로3가':'010013','시청':'010021','남영':'010041','대방':'010051','신길':'010061','신도림':'010071','가산디지털':'010081','독산':'010082','석수':'010091','관악':'010092','명학':'010101','당정':'010121','성균관대':'010131','화서':'010132'};
function stationInfo(id){const s=N?.catalog[id];if(!s)return {name:id,code:''};return {name:REAL_NAME[id]||s.name,code:s.controlled?s.code:(REAL_CODE[s.name]||'')};}
const stationLabel=stationInfo;
const routeText=id=>'RT_'+id.replace('-','_');
// Alarm log: route set / release. Event log: mode change and base scan. A new state object (reset) is a silent baseline.
const seen={};
function sync(stationId,state,action,result){
 const st=stationLabel(stationId),prev=seen[stationId],now=new Set(Object.keys(state.routes));
 if(!prev||prev.state!==state){seen[stationId]={state,routes:now,mode:state.mode};return;}
 for(const id of now)if(!prev.routes.has(id))log('alarm',`${st.name}역 ${routeText(id)}진로설정`);
 for(const id of prev.routes)if(!now.has(id))log('alarm',`${st.name}역 ${routeText(id)}진로해정`);
 if(state.mode!==prev.mode)log('event',`${st.name}[${st.code}] ${state.mode} MODE로 전환`);
 if(action?.type==='lsOperation'&&result?.ok)log('event',`${stationLabel(action.operation.station).name} 열차표시 · ${action.operation.op}`);
 if(action?.type==='scan'&&result?.ok)log('event',action.scope==='all'?'전체 제어역 Basescan 수신':`${st.name}역 Basescan 수신`);
 seen[stationId]={state,routes:now,mode:state.mode};
}
function syncAll(states){for(const [id,state] of Object.entries(states))sync(id,state);}

// ---------------------------------------------------------------- windows
function focus(w){w.el.style.zIndex=++zTop;for(const x of Object.values(windows))x.el.classList.toggle('active',x===w);}
function createWindow(id,{title,x=24,y=24,width,body,host=null,onClose=null}){
 const el=doc.createElement('div');el.className='mmi-win';el.dataset.mmiWindow=id;el.hidden=true;
 el.style.left=x+'px';el.style.top=y+'px';if(width)el.style.width=width+'px';
 el.innerHTML=`<div class="mmi-title"><span class="mmi-title-icon" aria-hidden="true"></span><span class="mmi-title-text">${esc(title)}</span><button type="button" class="mmi-dock" aria-label="${esc(title)} 도킹 전환" title="도킹 / 창으로 전환">도킹</button><button type="button" class="mmi-close" aria-label="${esc(title)} 닫기">✕</button></div><div class="mmi-win-body"></div>`;
 const holder=el.querySelector('.mmi-win-body');
 if(host)holder.appendChild(host);else if(body)holder.innerHTML=body;
 desktop.appendChild(el);
 const w={id,el,host,onClose,title};windows[id]=w;
 el.addEventListener('pointerdown',()=>focus(w));el.addEventListener('focusin',()=>focus(w));
 el.querySelector('.mmi-close').onclick=()=>close(id);el.querySelector('.mmi-dock').onclick=()=>dock(id,!w.docked);
 // dragging by the title bar
 const bar=el.querySelector('.mmi-title');
 bar.addEventListener('pointerdown',e=>{if(e.target.closest('button')||w.docked)return;const sx=e.clientX-el.offsetLeft,sy=e.clientY-el.offsetTop;bar.setPointerCapture(e.pointerId);
  const move=ev=>{place(w,ev.clientX-sx,ev.clientY-sy);};
  const up=()=>{bar.removeEventListener('pointermove',move);bar.removeEventListener('pointerup',up);bar.removeEventListener('pointercancel',up);fitDesktop();};
  bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',up);bar.addEventListener('pointercancel',up);e.preventDefault();});
 if(host)new MutationObserver(()=>{el.hidden=host.hidden;fitDesktop();}).observe(host,{attributes:true,attributeFilter:['hidden']});
 return w;
}
// modal message box (원본의 "확인" 대화상자): a shield blocks the desktop until it is acknowledged
function alertBox(text,done){
 const shield=doc.createElement('dialog');shield.className='mmi-shield';
 const box=doc.createElement('div');box.className='mmi-alert';box.setAttribute('role','alertdialog');
 box.innerHTML=`<div class="mmi-title"><span class="mmi-title-text">확인</span></div><p>${esc(text)}</p><button type="button" id="mmiAlertOk">확인</button>`;
 shield.appendChild(box);doc.body.appendChild(shield);shield.showModal();
 const ok=box.querySelector('button');ok.focus();ok.onclick=()=>{shield.close();shield.remove();done?.();};shield.addEventListener('cancel',e=>{e.preventDefault();ok.click();});
}
function fitDesktop(){
 if(!desktop)return;let bottom=0;for(const w of Object.values(windows))if(!w.el.hidden)bottom=Math.max(bottom,w.el.offsetTop+w.el.offsetHeight);
 desktop.style.minHeight=Math.max(760,bottom+16)+'px';
}
function place(w,x=w.el.offsetLeft,y=w.el.offsetTop){if(w.docked)return;w.el.style.left=Math.max(0,Math.min(desktop.clientWidth-w.el.offsetWidth,x))+'px';w.el.style.top=Math.max(0,y)+'px';}
function dock(id,on=true){const w=windows[id];if(!w)return;w.docked=on;w.el.classList.toggle('docked',on);w.el.querySelector('.mmi-dock').textContent=on?'창으로':'도킹';desktop.classList.toggle('has-docked',Object.values(windows).some(w=>w.docked&&!w.el.hidden));if(!on)place(w);fitDesktop();}
function open(id){
 const w=windows[id];if(!w){return null;}
 // an already open window is only brought to the front (re-running the opener would reload its draft)
 if(w.host&&w.host.hidden){w.host.hidden=false;w.opener?.();w.el.querySelector('.mmi-win-body').scrollTop=0;}
 const wasHidden=w.el.hidden;w.el.hidden=false;if(!w.host&&wasHidden)w.opener?.();focus(w);place(w);dock(id,!!w.docked);fitDesktop();return w;
}
function close(id){const w=windows[id];if(!w)return;if(w.host){const btn=w.closer?$(w.closer):null;if(btn)btn.click();w.host.hidden=true;}w.el.hidden=true;desktop.classList.toggle('has-docked',Object.values(windows).some(x=>x.docked&&!x.el.hidden));fitDesktop();}
const isOpen=id=>!!windows[id]&&!windows[id].el.hidden;

// windows that exist on the real MMI but are not implemented yet
function placeholder(id,title,note){
 createWindow(id,{title,x:60+Object.keys(windows).length*14,y:60+Object.keys(windows).length*14,width:520,body:`<div class="mmi-pending"><p><b>${esc(title)}</b></p><p>${esc(note||PENDING)}</p></div>`});
}

// ---------------------------------------------------------------- menu bar
// Wallpaper parody of the school logo: the Orpheia mascot (assets/orpheia-mascot.png, optional) or a vector lyre + ORPHEIA.
const LYRE='<svg viewBox="0 0 64 72" width="54" height="60" aria-hidden="true"><path d="M14 8c-8 8-8 26 2 34 4 3 8 5 12 5V12c0-3-3-5-6-4-3 1-5 3-8 0z" fill="none"/><path d="M12 10c-6 14-2 30 12 36 3 1 5 2 8 2s5-1 8-2c14-6 18-22 12-36" fill="none" stroke="#c9a227" stroke-width="4" stroke-linecap="round"/><path d="M20 12v34M28 10v38M36 10v38M44 12v34" stroke="#e3c25a" stroke-width="2.4" stroke-linecap="round"/><path d="M10 10h44" stroke="#c9a227" stroke-width="5" stroke-linecap="round"/><path d="M24 58h16l4 8H20z" fill="#c9a227"/></svg>';
function brand(){
 const one=`<div class="mmi-brand"><span class="mmi-mascot">${LYRE}${root.SimMMITheme?.mascotUrl?`<img src="${esc(root.SimMMITheme.mascotUrl)}" alt="" onerror="this.remove()" onload="this.parentElement.querySelector('svg')?.remove()">`:''}</span><span class="mmi-brand-text"><b>ORPHEIA</b><em>MMI</em><small>RAIL CONTROL SYSTEM</small></span></div>`;
 return `<div class="mmi-wallpaper" aria-hidden="true">${one}${one}</div>`;
}
function buildMenu(){
 const bar=doc.createElement('div');bar.className='mmi-menubar';bar.setAttribute('role','menubar');
 let openTop=null;
 const closeAll=()=>{bar.querySelectorAll('.open').forEach(e=>e.classList.remove('open'));openTop=null;};
 const list=(items,depth)=>`<ul class="mmi-menu-list" role="menu">${items.map(it=>it.sep?`<li class="mmi-sep" role="separator"></li>`:it.items?`<li class="has-sub" role="none"><button type="button" role="menuitem" aria-haspopup="true">${esc(it.label)}<i>▸</i></button>${list(it.items,depth+1)}</li>`
  :`<li role="none"><button type="button" role="menuitem" ${it.disabled?'disabled':''} ${it.open?`data-mmi-open="${it.open}"`:''} ${it.act?`data-mmi-act="${it.act}" role="menuitemcheckbox" aria-checked="true"`:''}>${esc(it.label)}</button></li>`).join('')}</ul>`;
 bar.innerHTML=MENUS.map(m=>`<div class="mmi-menu-top"><button type="button" class="mmi-top-btn" aria-haspopup="true">${esc(m.label)}</button>${list(m.items,1)}</div>`).join('');
 bar.addEventListener('click',e=>{
  const top=e.target.closest('.mmi-top-btn');
  if(top){const wrap=top.parentElement,was=wrap.classList.contains('open');closeAll();if(!was){wrap.classList.add('open');openTop=wrap;}return;}
  const sub=e.target.closest('.has-sub>button');if(sub){const li=sub.parentElement;const was=li.classList.contains('open');li.parentElement.querySelectorAll(':scope>.open').forEach(x=>x.classList.remove('open'));if(!was)li.classList.add('open');return;}
  const item=e.target.closest('[data-mmi-open]');if(item){closeAll();open(item.dataset.mmiOpen);return;}
  const act=e.target.closest('[data-mmi-act]');if(act){closeAll();root.SimMMIWindows?.act(act.dataset.mmiAct,act);}
 });
 bar.addEventListener('mouseover',e=>{const top=e.target.closest('.mmi-menu-top');if(top&&openTop&&top!==openTop){closeAll();top.classList.add('open');openTop=top;}});
 doc.addEventListener('pointerdown',e=>{if(!e.target.closest('.mmi-menubar'))closeAll();});
 doc.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();});
 return bar;
}

// ---------------------------------------------------------------- shell
function init(){
 const old=doc.querySelector('.mmi-panel');if(!old)return;
 const field=old.querySelector('.mmi-window'),graph=$('graphPanel'),schedule=$('schedulePanel');
 const shell=doc.createElement('section');shell.className='panel mmi-shell';shell.id='mmiShell';
 shell.innerHTML=`<div class="mmi-appbar"><span class="mmi-appicon" aria-hidden="true"></span><b>ORPHEIA MMI</b><button type="button" class="mmi-ls-link">LS 화면 ↑</button><span class="mmi-appnote">철도관제 실습 · ORPHEIA CONTROL SYSTEM</span></div>`;
 shell.querySelector('.mmi-ls-link').onclick=()=>$('lsDisplay').scrollIntoView({block:'start'});
 const toMMI=doc.createElement('button');toMMI.className='text-btn';toMMI.textContent='MMI 화면 ↓';toMMI.onclick=()=>shell.scrollIntoView({block:'start'});doc.querySelector('.ls-panel .panel-title').append(toMMI);
 shell.appendChild(buildMenu());
 desktop=doc.createElement('div');desktop.className='mmi-desktop';desktop.id='mmiDesktop';
 desktop.innerHTML=brand();
 shell.appendChild(desktop);
 shell.insertAdjacentHTML('beforeend',`<div class="mmi-logs"><section class="mmi-log" aria-label="알람 로그"><div class="mmi-log-head">알람 로그</div><div class="mmi-log-scroll"><table><thead><tr><th>구분</th><th>시간</th><th>알람내역</th></tr></thead><tbody id="alarmLogBody"></tbody></table></div></section><section class="mmi-log" aria-label="이벤트 로그"><div class="mmi-log-head">이벤트 로그</div><div class="mmi-log-scroll"><table><thead><tr><th>구분</th><th>시간</th><th>이벤트내역</th></tr></thead><tbody id="eventLogBody"></tbody></table></div></section></div>`);
 old.parentNode.insertBefore(shell,old);
 // hosted windows keep their element ids so the existing handlers and tests continue to work
 field.classList.add('mmi-field');
 createWindow('field',{title:'현장설비제어',x:18,y:14,width:560,host:field});
 windows.field.el.hidden=false;dock('field',true);
 if(graph){
  const bar=doc.createElement('div');bar.className='tg-menubar';
  bar.innerHTML=['파일(F)','편집(E)','보기(V)','Dia 보기(V)','화면설정(D)','즐겨찾기','도움말(H)'].map(n=>`<button type="button" class="tg-menu" title="원본 메뉴 항목을 아직 확인하지 못했습니다">${n}</button>`).join('');
  graph.insertBefore(bar,graph.firstChild);
  bar.addEventListener('click',e=>{if(e.target.closest('.tg-menu'))$('graphMessage').textContent='이 메뉴의 원본 항목은 아직 확인하지 못했습니다. 아래 교육용 도구로 시간 범위·검색·지연·운휴를 조작하세요.';});
  const w=createWindow('graph',{title:'ORPHEIA CTC ONLINE T/G',x:6,y:6,width:Math.min(1480,Math.max(900,desktop.clientWidth-14)),host:graph});w.opener=()=>{$('onlineGraphBtn')?.click();};w.closer='closeGraph';w.docked=true;w.el.classList.add('docked');}
 if(schedule){const w=createWindow('schedule',{title:'[CA028_02] 온라인 열차스케줄관리',x:300,y:420,width:1100,host:schedule});w.opener=()=>{$('onlineScheduleBtn')?.click();};w.closer='closeSchedule';}
 if(host)root.SimMMITrains.init(host);
 root.SimMMIWindows.init(host);
 // every other menu entry known from the photos gets an honest "not implemented" window
 const leaves=(items,out=[])=>{for(const it of items){if(it.items)leaves(it.items,out);else if(it.open&&!windows[it.open])out.push(it);}return out;};
 for(const it of leaves(MENUS.flatMap(m=>m.items)))placeholder(it.open,it.label);
 // the old tab strip is replaced by the menu bar; its elements stay in the DOM (hidden) because other code binds to them
 old.hidden=true;
 renderLogs();root.addEventListener('resize',()=>{for(const w of Object.values(windows))if(!w.el.hidden)place(w);fitDesktop();});
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
function connect(api){host=api;root.SimDiagram.subscribe(change=>{root.SimMMITrains?.refresh();log('event',`온라인 스케줄 ${change.id||''} · ${change.type}`);});}
function refresh(){root.SimMMITrains?.refresh();}
root.SimMMI={labelOf:id=>windows[id]?.title,connect,refresh,dock,getLogs:()=>structuredClone(logRows),createWindow,alertBox,open,close,isOpen,log,sync,syncAll,stationInfo,menus:MENUS,windowIds:()=>Object.keys(windows)};
})(window);
