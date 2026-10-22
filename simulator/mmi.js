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
  {label:'노트관리',open:'noteManage'},
  {label:'(이 메뉴의 다른 항목은 미확인)',disabled:true}]}
];
const windows={};let host=null,zTop=20,desktop,logRows={alarm:[],event:[]};
const stamp=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d).replaceAll('-','/');

// ---------------------------------------------------------------- logs
function renderLogs(){
 for(const kind of ['alarm','event']){
  const body=$(kind+'LogBody');if(!body)continue;
  body.innerHTML=logRows[kind].length?logRows[kind].slice(0,200).map(r=>`<tr><td>[${LEVELS[r.level||'I']}]</td><td>${r.time}</td><td>${esc(r.text)}</td></tr>`).join(''):`<tr class="empty"><td colspan="3">기록 없음</td></tr>`;
 }
}
// 경고 종류 (실기1 p.87): 중대한 오류(F) · 오류(E) · 경고(W) · 안내(I) · 디버깅(D)
const LEVELS={F:'중대한 오류',E:'오류',W:'경고',I:'안내',D:'디버깅'};
// operator histories shown by the 시스템 조회 windows
const history={train:[],mode:[],field:[],ack:[],schedule:[]};
function record(kind,row){history[kind].unshift({time:stamp(new Date()),...row});if(history[kind].length>500)history[kind].length=500;}
function log(kind,text,date=new Date(),level='I'){logRows[kind].unshift({time:stamp(date),text,level});if(logRows[kind].length>500)logRows[kind].length=500;renderLogs();}
// Station names and codes as the real MMI shows them (photos): Cheongnyangni is 지하청량리; the 18 jurisdiction stations have codes too.
const REAL_NAME={cheongnyangni:'지하청량리'};
const REAL_CODE={'제기동':'010001','신설동':'010002','동대문':'010011','종로5가':'010012','종로3가':'010013','시청':'010021','남영':'010041','대방':'010051','신길':'010061','신도림':'010071','가산디지털':'010081','독산':'010082','석수':'010091','관악':'010092','명학':'010101','당정':'010121','성균관대':'010131','화서':'010132'};
function stationInfo(id){const s=N?.catalog[id];if(!s)return {name:id,code:''};return {name:REAL_NAME[id]||s.name,code:s.controlled?s.code:(REAL_CODE[s.name]||'')};}
const stationLabel=stationInfo;
const routeText=id=>'RT_'+id.replace('-','_');
// Alarm log: route set / release. Event log: mode change and base scan. A new state object (reset) is a silent baseline.
const seen={};
// ---------------------------------------------------------------- 알람메시지 (photo 2026-10-22): refused operations are announced in a salmon pop-up
const alarms=[];let alarmEl=null,beepTimer=null,audio=null;
function beep(){try{audio??=new(root.AudioContext||root.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=880;g.gain.value=.03;o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.16);}catch{}}
function mute(){clearInterval(beepTimer);beepTimer=null;if(alarmEl)alarmEl.querySelector('[data-alarm-mute]').disabled=true;}
function renderAlarm(){
 if(!alarmEl){
  alarmEl=doc.createElement('div');alarmEl.className='mmi-alarm';alarmEl.setAttribute('role','alertdialog');alarmEl.setAttribute('aria-label','알람메시지');alarmEl.hidden=true;
  alarmEl.innerHTML=`<div class="mmi-alarm-title"><span>알람메시지</span><button type="button" class="mmi-alarm-x" aria-label="알람메시지 닫기">✕</button></div><div class="mmi-alarm-body"><div class="mmi-alarm-side"></div><div class="mmi-alarm-main"><div class="mmi-alarm-cap" id="alarmCount"></div><div class="mmi-alarm-box" id="alarmText"></div></div></div><div class="mmi-alarm-foot"><button type="button" data-alarm-mute>알람음 소거</button><button type="button" data-alarm-ok id="alarmOk">확인</button></div>`;
  doc.body.appendChild(alarmEl);
  // 실물 동작(사용자 설명): 체크칸에 체크하고 [확인]을 눌러야 해당 알람이 확인 처리되어 사라지고, 체크 없이 [확인]만 누르면 계속 표시된다.
  const ack=()=>{
   const done=alarms.filter(a=>a.checked);if(!done.length)return;
   for(const a of done)record('ack',{occurred:a.time,level:a.level,station:a.station,text:`${a.text}${a.state?` [${a.state}]`:''}`,operator:'관제사',console:'MMI-1'});
   for(let i=alarms.length-1;i>=0;i--)if(alarms[i].checked)alarms.splice(i,1);
   if(!alarms.length)mute();renderAlarm();
  };
  alarmEl.querySelector('[data-alarm-ok]').onclick=ack;alarmEl.querySelector('.mmi-alarm-x').onclick=()=>{alarmEl.hidden=true;};      // 닫기 X는 확인 처리가 아니다
  alarmEl.querySelector('[data-alarm-mute]').onclick=mute;
  alarmEl.querySelector('#alarmText').onchange=e=>{const box=e.target.closest('input[data-alarm-i]');if(box&&alarms[+box.dataset.alarmI])alarms[+box.dataset.alarmI].checked=box.checked;};
 }
 $('alarmCount').textContent=`메시지 내용 (미확인 알람 갯수 : ${alarms.length}개)`;
 $('alarmText').innerHTML=alarms.map((a,i)=>[a,i]).reverse().map(([a,i])=>`<p><label><input type="checkbox" data-alarm-i="${i}" ${a.checked?'checked':''} aria-label="확인 표시"></label>발생시간 : ${esc(a.time)}<br>${esc(a.text)}${a.state?`<br>설정상태 [${esc(a.state)}]`:''}</p>`).join('');
 alarmEl.hidden=!alarms.length;
}
function raiseAlarm(text,state='',level='E',station=''){
 log('alarm',state?`${text} [${state}]`:text,undefined,level);
 alarms.push({time:stamp(new Date()),text,state,level,station});if(alarms.length>50)alarms.shift();renderAlarm();
 alarmEl.querySelector('[data-alarm-mute]').disabled=false;clearInterval(beepTimer);beep();beepTimer=setInterval(beep,2500);
}
// 열차번호 중복 알람 (실무5 p.15: 충돌·구원연결로 한 열번창에 번호가 겹치면 "K0602 + K0604 열차번호 중복 알람")
const dupSeen=new Set();
function checkDuplicates(stationId){
 const m=root.SimLSUI?.getModel?.(),st=m?.stations?.[stationId];if(!st)return;
 for(const [slot,rows] of Object.entries(st.windows||{})){
  const key=`${stationId}|${slot}`,numbers=rows.map(r=>r.number);
  if(numbers.length<2){for(const k of [...dupSeen])if(k.startsWith(key+'|'))dupSeen.delete(k);continue;}
  const sig=`${key}|${numbers.join('+')}`;
  if(dupSeen.has(sig))continue;
  for(const k of [...dupSeen])if(k.startsWith(key+'|'))dupSeen.delete(k);
  dupSeen.add(sig);const info=stationInfo(stationId);
  raiseAlarm(`${info.name}${info.code?`(${info.code})`:''}역 ${numbers.join(' + ')} 열차번호 중복`,'','E',info.name);
 }
}
const CONTROL=['route','withdraw','stop','stopAll','point','pointLock'];
// 로그재생: every state change of a station is stored with a snapshot so the LS can be replayed (실기1 p.39-42)
const replayLog={};
const SNAP_KEYS=['mode','pending','clock','points','signals','routes','approach','occupied','blockedPoints'];
function capture(stationId,state,texts){
 if(!texts.length)return;
 const ls=root.SimLSUI?.getModel?.()?.stations?.[stationId];
 const snap={state:structuredClone(Object.fromEntries(SNAP_KEYS.map(k=>[k,state[k]]))),ls:ls?structuredClone(ls):null};
 const list=replayLog[stationId]??=[];
 for(const text of texts)list.push({time:stamp(new Date()),clock:state.clock,station:stationId,text,snap});
 if(list.length>1500)list.splice(0,list.length-1500);
}
// routes set/cleared by the 열차자동제어 are not 수동조작: they are marked so the manual-operation history skips them
const autoMarks=new Set();
const eventListeners=new Set();
const emit=e=>{for(const f of eventListeners)f(e);};
function sync(stationId,state,action,result){
 if(action&&result&&action.type!=='tick')emit({...action,station:stationId,ok:result.ok!==false});
 // 제어 확인 (photo 2026-10-22): a control command outside CCM is refused with a modal error box, not an alarm pop-up
 if(action&&result&&result.ok===false&&CONTROL.includes(action.type)&&state.mode!=='CCM'){alertBox('CCM 모드가 아니므로 제어할 수 없습니다.',null,{title:'제어 확인',icon:'error'});return;}
 if(action&&result&&result.ok===false&&action.type!=='tick'){const info=stationInfo(stationId),who=`${info.name}${info.code?`(${info.code})`:''}역`;
  if(action.type==='route'&&action.id)raiseAlarm(`${who} ${routeText(action.id)}진로 요구중 ${result.message}`,'수동진로설정불가','E',info.name);else if(result.message)raiseAlarm(`${who} ${result.message}`,'','E',info.name);}
 const st=stationLabel(stationId),prev=seen[stationId],now=new Set(Object.keys(state.routes));
 if(!prev||prev.state!==state){seen[stationId]={state,routes:now,mode:state.mode};return;}
 const changes=[];
 for(const id of now)if(!prev.routes.has(id)){log('alarm',`${st.name}역 ${routeText(id)}진로설정`);if(!autoMarks.delete(`${stationId}|${id}|설정`))record('field',{station:st.name,kind:'진로',text:`${routeText(id)}진로설정`});changes.push(`${routeText(id)}진로설정`);}
 for(const id of prev.routes)if(!now.has(id)){log('alarm',`${st.name}역 ${routeText(id)}진로해정`);if(!autoMarks.delete(`${stationId}|${id}|해정`))record('field',{station:st.name,kind:'진로',text:`${routeText(id)}진로해정`});changes.push(`${routeText(id)}진로해정`);}
 if(state.mode!==prev.mode){log('event',`${st.name}[${st.code}] ${state.mode} MODE로 전환`);record('mode',{station:st.name,text:`${prev.mode} → ${state.mode}`});changes.push(`${state.mode} MODE로 전환`);}
 if(action?.type==='point'&&result?.ok){record('field',{station:st.name,kind:'선로전환기',text:`${action.id} ${action.value==='R'?'반위':'정위'} 전환`});changes.push(`전환기 ${action.id} ${action.value==='R'?'반위':'정위'}`);}
 if((action?.type==='stop'||action?.type==='stopAll')&&result?.ok){record('field',{station:st.name,kind:'신호기',text:action.type==='stopAll'?'신호기 일괄정지':`${action.id} 신호 정지`});changes.push(action.type==='stopAll'?'신호기 일괄정지':`${action.id} 신호 정지`);}
 if(action?.type==='approach'&&result?.ok)changes.push(`${action.signal} 접근 열차 ${action.present===false?'제거':'투입'}`);
 if(action?.type==='lsOperation'&&result?.ok){const op=action.operation,who=stationLabel(op.station).name;log('event',`${who} 열차표시 · ${op.op}${result.pending?' · 이동 접수':''}`);record('train',{station:who,text:`${op.op}${op.number?` · ${op.number}`:''}`});for(const id of new Set([op.station,op.targetStation]))if(id)checkDuplicates(id);changes.push(`열차번호 ${op.op}${op.number?` · ${op.number}`:''}`);}
 if(action?.type==='scan'&&result?.ok)log('event',action.scope==='all'?'전체 제어역 Basescan 수신':`${st.name}역 Basescan 수신`);
 capture(stationId,state,changes);
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
function alertBox(text,done,opts={}){
 const shield=doc.createElement('dialog');shield.className='mmi-shield';
 const box=doc.createElement('div');box.className='mmi-alert';box.setAttribute('role','alertdialog');
 box.classList.toggle('error',opts.icon==='error');
 box.innerHTML=`<div class="mmi-title"><span class="mmi-title-text">${esc(opts.title||'확인')}</span></div><p>${opts.icon==='error'?'<i class="mmi-err" aria-hidden="true">✕</i>':''}<span>${esc(text)}</span></p><button type="button" id="mmiAlertOk">확인</button>`;
 shield.appendChild(box);doc.body.appendChild(shield);shield.showModal();
 const ok=box.querySelector('button');ok.focus();ok.onclick=()=>{shield.close();shield.remove();done?.();};shield.addEventListener('cancel',e=>{e.preventDefault();ok.click();});
}
// 예/아니오 확인 상자 (the real MMI asks "[예]를 선택" before deleting or saving)
function confirmBox(text,onYes,opts={}){
 const shield=doc.createElement('dialog');shield.className='mmi-shield';
 const box=doc.createElement('div');box.className='mmi-alert';box.setAttribute('role','alertdialog');
 box.innerHTML=`<div class="mmi-title"><span class="mmi-title-text">${esc(opts.title||'확인')}</span></div><p><span>${esc(text)}</span></p><div class="mmi-confirm-row"><button type="button" id="mmiConfirmYes">예(Y)</button><button type="button" id="mmiConfirmNo">아니오(N)</button></div>`;
 shield.appendChild(box);doc.body.appendChild(shield);shield.showModal();
 const end=yes=>{shield.close();shield.remove();if(yes)onYes?.();};
 box.querySelector('#mmiConfirmYes').onclick=()=>end(true);box.querySelector('#mmiConfirmNo').onclick=()=>end(false);shield.addEventListener('cancel',e=>{e.preventDefault();end(false);});
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
// Locally bundled image-generated ORPHEIA assets; custom mascot remains optional.
function brand(){
 const portrait=root.SimMMITheme?.mascotUrl||'assets/orpheia/guide.png';
 return `<div class="mmi-wallpaper" aria-hidden="true"><div class="mmi-brand"><span class="mmi-mascot"><img src="assets/orpheia/emblem.png" alt="" width="92" height="92"></span><span class="mmi-brand-text"><b>ORPHEIA</b><em>FTS WORKSPACE</em><small>RAIL CONTROL SYSTEM</small></span></div><img class="mmi-guide" src="${esc(portrait)}" alt="" width="240" height="340" loading="lazy"></div>`;
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
 shell.innerHTML=`<div class="mmi-appbar"><span class="mmi-appicon" aria-hidden="true"></span><b>ORPHEIA MMI</b><button type="button" class="mmi-ls-link">LS 화면 ↑</button><button type="button" class="mmi-ls-link" id="mmiScenarioBtn">실기 시나리오</button><button type="button" class="mmi-ls-link" id="mmiEquipBtn">설비 장애</button><button type="button" class="mmi-ls-link" id="mmiCdrsBtn">CDRS 해소안</button><button type="button" class="mmi-ls-link" id="mmiLedgerBtn">운전정리 대장</button><button type="button" class="mmi-ls-link" id="mmiAutoBtn" aria-pressed="false">자동제어 OFF</button><span class="mmi-appnote">철도관제 실습 · ORPHEIA CONTROL SYSTEM</span></div>`;
 shell.querySelector('#mmiScenarioBtn').onclick=()=>open('scenario');
 shell.querySelector('#mmiEquipBtn').onclick=()=>open('equipment');
 shell.querySelector('#mmiCdrsBtn').onclick=()=>open('cdrs');
 shell.querySelector('#mmiLedgerBtn').onclick=()=>open('ledger');
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
  root.SimTG.init(graph);
  const w=createWindow('graph',{title:'ORPHEIA CTC ONLINE T/G',x:6,y:6,width:Math.min(1480,Math.max(900,desktop.clientWidth-14)),host:graph});w.opener=()=>{$('onlineGraphBtn')?.click();};w.closer='closeGraph';w.docked=true;w.el.classList.add('docked');}
 if(schedule){const w=createWindow('schedule',{title:'[CA028_02] 온라인 열차스케줄관리',x:300,y:420,width:1100,host:schedule});w.opener=()=>{$('onlineScheduleBtn')?.click();};w.closer='closeSchedule';}
 if(host)root.SimMMITrains.init(host);
 root.SimNotes.init(host);root.SimDrill.init(host);root.SimPreferred.init(host);root.SimEquipment.init(host);root.SimCDRSUI.init(host);root.SimLedgerUI.init(host);root.SimScenarioUI.init(host);root.SimReplay.init(host);root.SimAutoUI.init(host);
 root.SimMMIWindows.init(host);
 // every other menu entry known from the photos gets an honest "not implemented" window
 const leaves=(items,out=[])=>{for(const it of items){if(it.items)leaves(it.items,out);else if(it.open&&!windows[it.open])out.push(it);}return out;};
 for(const it of leaves(MENUS.flatMap(m=>m.items)))placeholder(it.open,it.label);
 // the old tab strip is replaced by the menu bar; its elements stay in the DOM (hidden) because other code binds to them
 old.hidden=true;
 renderLogs();root.addEventListener('resize',()=>{for(const w of Object.values(windows))if(!w.el.hidden)place(w);fitDesktop();});
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
function connect(api){host=api;root.SimDiagram.subscribe(change=>{root.SimMMITrains?.refresh();log('event',`온라인 스케줄 ${change.id||''} · ${change.type}`);record('schedule',{type:change.type,train:change.id||'',text:JSON.stringify(change),console:'MMI-1'});emit({type:'schedule',change,ok:true});});}
function refresh(){root.SimMMITrains?.refresh();}
root.SimMMI={checkDuplicates,markAuto:key=>autoMarks.add(key),replayLog:id=>replayLog[id]||[],replaying:()=>root.SimReplay?.active?.()||false,render:()=>host?.render?.(),run:a=>host.run(a),onEvent:fn=>{eventListeners.add(fn);return ()=>eventListeners.delete(fn);},rebase:id=>{delete seen[id];},confirmBox,LEVELS,history:()=>structuredClone(history),record,raiseAlarm,alarms:()=>structuredClone(alarms),labelOf:id=>windows[id]?.title,connect,refresh,dock,getLogs:()=>structuredClone(logRows),createWindow,alertBox,open,close,isOpen,log,sync,syncAll,stationInfo,menus:MENUS,windowIds:()=>Object.keys(windows)};
})(window);
