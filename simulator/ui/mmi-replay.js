(function(root){
'use strict';
// 로그재생 (프로그램 > 로그재생(R), 실기1 p.39-42): pick a station, date and time range, search the stored state changes, then play them
// back on the LS. Controls: 맨처음 · 한 줄 위 · 잠시 멈춤 · 재생 · 종료 · 한 줄 아래 · 맨끝, 재생 속도, 파일로 저장. While a replay is
// shown the live simulation is paused and operations are refused; the LS carries a "로그재생중" text. 종료 restores the live state.
const doc=SimDOM.document,$=id=>doc.getElementById(id),N=root.SimNetwork;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEYS=['mode','pending','clock','points','signals','routes','approach','occupied','blockedPoints'];
const mmi=()=>root.SimMMI;
let host=null,list=[],idx=-1,timer=null,backup=null,on=false,paused=false;
const name=id=>mmi().stationInfo(id).name;
const liveState=id=>host.context().stationStates[id];
const timeOf=t=>t.slice(11,16);

function badge(text){
 let el=$('lsReplayBadge');
 if(!el){el=doc.createElement('div');el.id='lsReplayBadge';el.className='ls-trace-badge ls-replay-badge';el.setAttribute('role','status');($('lsDisplay')||doc.body).appendChild(el);}
 el.hidden=!text;el.textContent=text||'';
}
function enter(station){
 if(on)return;
 const st=liveState(station),ls=root.SimLSUI.getModel().stations[station];
 backup={station,state:structuredClone(Object.fromEntries(KEYS.map(k=>[k,st[k]]))),ls:ls?structuredClone(ls):null};
 on=true;if(root.SimRemote)root.SimRemote.command({type:'replay',on:true});host.selectStation(station);
}
function restore(){
 if(!on)return;
 const st=liveState(backup.station);for(const k of KEYS)st[k]=structuredClone(backup.state[k]);
 if(backup.ls)root.SimLSUI.getModel().stations[backup.station]=backup.ls;
 on=false;if(root.SimRemote)root.SimRemote.command({type:'replay',on:false});badge('');backup=null;mmi().render();
}
function show(i){
 if(!list.length)return;
 idx=Math.max(0,Math.min(list.length-1,i));
 const e=list[idx];enter(e.station);
 const st=liveState(e.station);for(const k of KEYS)st[k]=structuredClone(e.snap.state[k]);
 if(e.snap.ls)root.SimLSUI.getModel().stations[e.station]=structuredClone(e.snap.ls);
 badge(`▶ 로그재생중 · ${name(e.station)} · ${idx+1}/${list.length}`);
 draw();mmi().render();
 const row=$('rpRows').querySelector(`tr[data-i="${idx}"]`);row?.scrollIntoView({block:'nearest'});
}
function draw(){
 $('rpRows').innerHTML=list.length?list.map((e,i)=>`<tr data-i="${i}" class="${i===idx?'sel':''}"><td>${i+1}</td><td>${e.time}</td><td>${Math.floor(e.clock/60)}:${String(e.clock%60).padStart(2,'0')}</td><td>${esc(name(e.station))}</td><td>${esc(e.text)}</td></tr>`).join(''):'<tr class="empty"><td colspan="5">검색 결과가 없습니다</td></tr>';
 $('rpCount').textContent=list.length?`총 ${list.length}건 · 현재 ${idx+1}번째`:'';
}
function search(){
 stop(true);
 const station=$('rpStation').value,date=$('rpDate').value.replaceAll('-','/'),from=$('rpFrom').value||'00:00',to=$('rpTo').value||'23:59';
 list=mmi().replayLog(station).filter(e=>e.time.startsWith(date)&&timeOf(e.time)>=from&&timeOf(e.time)<=to);
 idx=-1;draw();
 if(!list.length)mmi().alertBox('관련로그 정보가 없습니다!');
}
function play(){
 if(!list.length){mmi().alertBox('먼저 로그를 검색하세요.');return;}
 clearInterval(timer);paused=false;
 if(idx<0||idx>=list.length-1)show(0);else show(idx);
 const step=()=>{if(idx>=list.length-1){clearInterval(timer);timer=null;return;}show(idx+1);};
 timer=setInterval(step,Math.max(60,800/Number($('rpSpeed').value)));
 $('rpState').textContent='재생 중';
}
function pause(){if(!timer)return;clearInterval(timer);timer=null;paused=true;$('rpState').textContent='잠시 멈춤 (재생 버튼으로 이어서 재생)';}
function stop(silent){
 clearInterval(timer);timer=null;paused=false;idx=-1;restore();
 if($('rpState'))$('rpState').textContent=silent?'':'재생을 종료하고 현재 상태로 돌아왔습니다.';
 if($('rpRows'))draw();
}
function save(){
 if(!list.length){mmi().alertBox('저장할 검색 결과가 없습니다.');return;}
 const rows=[['번호','발생시각','시뮬레이션 시각','역','내용'],...list.map((e,i)=>[i+1,e.time,`${Math.floor(e.clock/60)}:${String(e.clock%60).padStart(2,'0')}`,name(e.station),e.text])];
 const csv='﻿'+rows.map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=doc.createElement('a');a.href=url;a.download='ctc-log-replay.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 mmi().log('event','로그재생 검색결과 파일 저장');
}
function init(api){
 host=api;
 const stations=N.stations.filter(s=>s.controlled).map(s=>`<option value="${s.id}">${esc(name(s.id))}</option>`).join('');
 const now=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
 const win=mmi().createWindow('logReplay',{title:'로그재생',x:110,y:50,width:760,body:`<div class="rpt"><fieldset class="rpt-cond"><legend>검색조건</legend><label>역명<select id="rpStation">${stations}</select></label><label>날짜<input type="date" id="rpDate" value="${now}"></label><label>시간<input type="time" id="rpFrom" value="00:00"> ~ <input type="time" id="rpTo" value="23:59"></label><button type="button" class="sched-btn primary" id="rpSearch">검색</button></fieldset>
<div class="idm-table rpt-table"><table><thead><tr><th>번호</th><th>발생시각</th><th>시뮬 시각</th><th>역</th><th>내용</th></tr></thead><tbody id="rpRows"><tr class="empty"><td colspan="5">역·날짜·시간을 고르고 [검색]을 누르세요.</td></tr></tbody></table></div>
<div class="rp-ctl" role="toolbar" aria-label="재생 컨트롤"><button type="button" id="rpFirst" title="맨처음으로">⏮</button><button type="button" id="rpUp" title="한 줄 위로">▲</button><button type="button" id="rpPause" title="잠시 멈춤">❚❚</button><button type="button" id="rpPlay" title="재생">▶</button><button type="button" id="rpStop" title="재생 종료">■</button><button type="button" id="rpDown" title="한 줄 아래로">▼</button><button type="button" id="rpLast" title="맨끝으로">⏭</button><label>속도<select id="rpSpeed"><option value="1">1배</option><option value="2">2배</option><option value="5">5배</option><option value="10">10배</option></select></label><span id="rpState"></span></div>
<div class="idm-note">교육용 구성 — 서버의 원시 송수신 로그 대신 이 시뮬레이터가 기록한 상태 변화(진로·모드·전환기·신호 정지·접근 열차·열차번호)를 재생합니다. 파일 저장은 엑셀로 열 수 있는 CSV입니다. 재생 중에는 시뮬레이션이 멈추고 조작할 수 없으며, [■]로 현재 상태로 돌아옵니다. <span id="rpCount"></span></div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="rpSave">파일로 저장</button><button type="button" class="sched-btn" id="rpClose">닫기</button></div></div>`});
 $('rpSearch').onclick=search;$('rpPlay').onclick=play;$('rpPause').onclick=pause;$('rpStop').onclick=()=>stop(false);
 $('rpFirst').onclick=()=>{pause();show(0);};$('rpLast').onclick=()=>{pause();show(list.length-1);};
 $('rpUp').onclick=()=>{pause();show(idx<0?0:idx-1);};$('rpDown').onclick=()=>{pause();show(idx+1);};
 $('rpRows').onclick=e=>{const r=e.target.closest('tr[data-i]');if(r){pause();show(Number(r.dataset.i));}};
 $('rpSave').onclick=save;$('rpClose').onclick=()=>{stop(true);mmi().close('logReplay');};
 win.el.querySelector('.mmi-close').addEventListener('click',()=>stop(true));
 win.opener=()=>{const cur=host.context().station;if([...$('rpStation').options].some(o=>o.value===cur))$('rpStation').value=cur;};
}
root.SimReplay={init,active:()=>on};
})(window);
