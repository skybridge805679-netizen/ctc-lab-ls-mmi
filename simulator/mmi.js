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
 {label:'프로그램',items:[{label:'(원본 메뉴 항목 미확인)',disabled:true}]},
 {label:'현장제어',items:[
  {label:'현장설비제어(A)',open:'field'},
  {label:'열차제어',items:[{label:'열차번호제어(B)',open:'trainNumber'},{label:'열차추적(T)',open:'trace'}]}]},
 {label:'열차스케줄',items:[
  {label:'열차운행패턴 관리(P)',open:'pattern'},
  {label:'온라인열차스케줄 관리',items:[{label:'온라인 열차스케줄ID관리(I)',open:'scheduleId'},{label:'온라인 열차스케줄관리(G)',open:'schedule'},{label:'진입예고열차관리(E)',open:'entryNotice'}]},
  {label:'온라인 열차그래프(O)',open:'graph'},
  {label:'오프라인 열차그래프(F)',open:'offlineGraph'},
  {label:'오프라인 열차스케줄',items:[{label:'(원본 메뉴 항목 미확인)',disabled:true}]}]},
 {label:'시스템 조회',items:[{label:'(원본 메뉴 항목 미확인)',disabled:true}]},
 {label:'시스템 관리',items:[{label:'(원본 메뉴 항목 미확인)',disabled:true}]}
];
const windows={};let zTop=20,desktop,logRows={alarm:[],event:[]};
const stamp=d=>`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;

// ---------------------------------------------------------------- logs
function renderLogs(){
 for(const kind of ['alarm','event']){
  const body=$(kind+'LogBody');if(!body)continue;
  body.innerHTML=logRows[kind].length?logRows[kind].slice(0,200).map(r=>`<tr><td>[안내]</td><td>${r.time}</td><td>${esc(r.text)}</td></tr>`).join(''):`<tr class="empty"><td colspan="3">기록 없음</td></tr>`;
 }
}
function log(kind,text,date=new Date()){logRows[kind].unshift({time:stamp(date),text});if(logRows[kind].length>500)logRows[kind].length=500;renderLogs();}
const stationLabel=id=>{const s=N?.catalog[id];return s?{name:s.name,code:s.code}:{name:id,code:''};};
const routeText=id=>'RT_'+id.replace('-','_');
// Alarm log: route set / release. Event log: mode change and base scan. A new state object (reset) is a silent baseline.
const seen={};
function sync(stationId,state,action,result){
 const st=stationLabel(stationId),prev=seen[stationId],now=new Set(Object.keys(state.routes));
 if(!prev||prev.state!==state){seen[stationId]={state,routes:now,mode:state.mode};return;}
 for(const id of now)if(!prev.routes.has(id))log('alarm',`${st.name}역 ${routeText(id)}진로설정`);
 for(const id of prev.routes)if(!now.has(id))log('alarm',`${st.name}역 ${routeText(id)}진로해정`);
 if(state.mode!==prev.mode)log('event',`${st.name}[${st.code}] ${state.mode} MODE로 전환`);
 if(action?.type==='scan'&&result?.ok)log('event',action.scope==='all'?'전체 제어역 Basescan 수신':`${st.name}역 Basescan 수신`);
 seen[stationId]={state,routes:now,mode:state.mode};
}
function syncAll(states){for(const [id,state] of Object.entries(states))sync(id,state);}

// ---------------------------------------------------------------- windows
function focus(w){w.el.style.zIndex=++zTop;for(const x of Object.values(windows))x.el.classList.toggle('active',x===w);}
function createWindow(id,{title,x=24,y=24,width,body,host=null,onClose=null}){
 const el=doc.createElement('div');el.className='mmi-win';el.dataset.mmiWindow=id;el.hidden=true;
 el.style.left=x+'px';el.style.top=y+'px';if(width)el.style.width=width+'px';
 el.innerHTML=`<div class="mmi-title"><span class="mmi-title-icon" aria-hidden="true"></span><span class="mmi-title-text">${esc(title)}</span><button type="button" class="mmi-close" aria-label="${esc(title)} 닫기">✕</button></div><div class="mmi-win-body"></div>`;
 const holder=el.querySelector('.mmi-win-body');
 if(host)holder.appendChild(host);else if(body)holder.innerHTML=body;
 desktop.appendChild(el);
 const w={id,el,host,onClose,title};windows[id]=w;
 el.addEventListener('pointerdown',()=>focus(w));
 el.querySelector('.mmi-close').onclick=()=>close(id);
 // dragging by the title bar
 const bar=el.querySelector('.mmi-title');
 bar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const sx=e.clientX-el.offsetLeft,sy=e.clientY-el.offsetTop;bar.setPointerCapture(e.pointerId);
  const move=ev=>{el.style.left=Math.max(0,ev.clientX-sx)+'px';el.style.top=Math.max(0,ev.clientY-sy)+'px';};
  const up=()=>{bar.removeEventListener('pointermove',move);bar.removeEventListener('pointerup',up);};
  bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',up);});
 if(host)new MutationObserver(()=>{el.hidden=host.hidden;}).observe(host,{attributes:true,attributeFilter:['hidden']});
 return w;
}
function open(id){
 const w=windows[id];if(!w){return null;}
 // an already open window is only brought to the front (re-running the opener would reload its draft)
 if(w.host&&w.host.hidden){w.host.hidden=false;w.opener?.();}
 w.el.hidden=false;focus(w);return w;
}
function close(id){const w=windows[id];if(!w)return;if(w.host){const btn=w.closer?$(w.closer):null;if(btn)btn.click();w.host.hidden=true;}w.el.hidden=true;}
const isOpen=id=>!!windows[id]&&!windows[id].el.hidden;

// windows that exist on the real MMI but are not implemented yet
function placeholder(id,title,note){
 createWindow(id,{title,x:60+Object.keys(windows).length*14,y:60+Object.keys(windows).length*14,width:520,body:`<div class="mmi-pending"><p><b>${esc(title)}</b></p><p>${esc(note||PENDING)}</p></div>`});
}

// ---------------------------------------------------------------- menu bar
// Wallpaper parody of the school logo: the Orpheia mascot (assets/orpheia-mascot.png, optional) or a vector lyre + ORPHEIA.
const LYRE='<svg viewBox="0 0 64 72" width="54" height="60" aria-hidden="true"><path d="M14 8c-8 8-8 26 2 34 4 3 8 5 12 5V12c0-3-3-5-6-4-3 1-5 3-8 0z" fill="none"/><path d="M12 10c-6 14-2 30 12 36 3 1 5 2 8 2s5-1 8-2c14-6 18-22 12-36" fill="none" stroke="#c9a227" stroke-width="4" stroke-linecap="round"/><path d="M20 12v34M28 10v38M36 10v38M44 12v34" stroke="#e3c25a" stroke-width="2.4" stroke-linecap="round"/><path d="M10 10h44" stroke="#c9a227" stroke-width="5" stroke-linecap="round"/><path d="M24 58h16l4 8H20z" fill="#c9a227"/></svg>';
function brand(){
 const one=`<div class="mmi-brand"><span class="mmi-mascot">${LYRE}<img src="assets/orpheia-mascot.png" alt="" onerror="this.remove()" onload="this.parentElement.querySelector('svg')?.remove()"></span><span class="mmi-brand-text"><b>ORPHEIA</b><em>MMI</em><small>電脳侍女 · LV.99</small></span></div>`;
 return `<div class="mmi-wallpaper" aria-hidden="true">${one}${one}</div>`;
}
function buildMenu(){
 const bar=doc.createElement('div');bar.className='mmi-menubar';bar.setAttribute('role','menubar');
 let openTop=null;
 const closeAll=()=>{bar.querySelectorAll('.open').forEach(e=>e.classList.remove('open'));openTop=null;};
 const list=(items,depth)=>`<ul class="mmi-menu-list" role="menu">${items.map(it=>it.items?`<li class="has-sub" role="none"><button type="button" role="menuitem" aria-haspopup="true">${esc(it.label)}<i>▸</i></button>${list(it.items,depth+1)}</li>`
  :`<li role="none"><button type="button" role="menuitem" ${it.disabled?'disabled':''} ${it.open?`data-mmi-open="${it.open}"`:''}>${esc(it.label)}</button></li>`).join('')}</ul>`;
 bar.innerHTML=MENUS.map(m=>`<div class="mmi-menu-top"><button type="button" class="mmi-top-btn" aria-haspopup="true">${esc(m.label)}</button>${list(m.items,1)}</div>`).join('');
 bar.addEventListener('click',e=>{
  const top=e.target.closest('.mmi-top-btn');
  if(top){const wrap=top.parentElement,was=wrap.classList.contains('open');closeAll();if(!was){wrap.classList.add('open');openTop=wrap;}return;}
  const sub=e.target.closest('.has-sub>button');if(sub){const li=sub.parentElement;const was=li.classList.contains('open');li.parentElement.querySelectorAll(':scope>.open').forEach(x=>x.classList.remove('open'));if(!was)li.classList.add('open');return;}
  const item=e.target.closest('[data-mmi-open]');if(item){closeAll();open(item.dataset.mmiOpen);}
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
 shell.innerHTML=`<div class="mmi-appbar"><span class="mmi-appicon" aria-hidden="true"></span><b>ORPHEIA MMI</b><span class="mmi-appnote">전뇌시녀 오르페이아의 관제 보조 단말 · 메뉴와 창 구성은 실물 사진 기준</span></div>`;
 shell.appendChild(buildMenu());
 desktop=doc.createElement('div');desktop.className='mmi-desktop';desktop.id='mmiDesktop';
 desktop.innerHTML=brand();
 shell.appendChild(desktop);
 shell.insertAdjacentHTML('beforeend',`<div class="mmi-logs"><section class="mmi-log" aria-label="알람 로그"><div class="mmi-log-head">알람 로그</div><div class="mmi-log-scroll"><table><thead><tr><th>구분</th><th>시간</th><th>알람내역</th></tr></thead><tbody id="alarmLogBody"></tbody></table></div></section><section class="mmi-log" aria-label="이벤트 로그"><div class="mmi-log-head">이벤트 로그</div><div class="mmi-log-scroll"><table><thead><tr><th>구분</th><th>시간</th><th>이벤트내역</th></tr></thead><tbody id="eventLogBody"></tbody></table></div></section></div>`);
 old.parentNode.insertBefore(shell,old);
 // hosted windows keep their element ids so the existing handlers and tests continue to work
 field.classList.add('mmi-field');
 createWindow('field',{title:'현장설비제어',x:18,y:14,width:560,host:field});
 windows.field.el.hidden=false;
 if(graph){const w=createWindow('graph',{title:'ORPHEIA CTC ONLINE T/G',x:40,y:24,width:1180,host:graph});w.opener=()=>{$('onlineGraphBtn')?.click();};w.closer='closeGraph';}
 if(schedule){const w=createWindow('schedule',{title:'[CA028_02] 온라인 열차스케줄관리',x:300,y:420,width:1100,host:schedule});w.opener=()=>{$('onlineScheduleBtn')?.click();};w.closer='closeSchedule';}
 placeholder('trainNumber','[CA012_01] 열차번호제어','열차번호제어 화면(작업구분 삽입·삭제·수정·이동·교환, 제어영역 리스트)은 사진으로 구조만 확인했으며 아직 구현하지 않았습니다.');
 placeholder('trace','열차추적(T)');
 placeholder('pattern','열차운행패턴 관리(P)');
 placeholder('scheduleId','[CA028_01] 온라인열차스케줄ID관리','온라인열차스케줄ID관리 화면(운행일 달력, 스케줄 ID 목록)은 사진으로 확인했으며 아직 구현하지 않았습니다.');
 placeholder('entryNotice','진입예고열차관리(E)');
 placeholder('offlineGraph','오프라인 열차그래프(F)');
 // the old tab strip is replaced by the menu bar; its elements stay in the DOM (hidden) because other code binds to them
 old.hidden=true;
 renderLogs();
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
root.SimMMI={open,close,isOpen,log,sync,syncAll,menus:MENUS,windowIds:()=>Object.keys(windows)};
})(window);
