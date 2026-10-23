(function(root){
'use strict';
// UI binding of autocontrol.js: the on/off switch (MMI bar + 프로그램 환경설정), numbers moving through the LS 열번창, trouble log.
const doc=document,$=id=>doc.getElementById(id),A=()=>root.SimAuto,mmi=()=>root.SimMMI;
const KEY='orpheia.autocontrol';
let host=null,engine=null,enabled=false,reflect=false;
const RKEY='orpheia.autoreflect';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=id=>mmi().stationInfo(id).name;
const model=()=>root.SimLSUI.getModel();

// ---- numbers: the virtual train's number follows it through the station's 열번창 (one place at a time)
function removeEverywhere(number){
 for(const [station,st] of Object.entries(model().stations))for(const [slot,rows] of Object.entries(st.windows))for(const r of [...rows])if(r.number===number)root.SimLSUI.dispatch({op:'delete',station,slot,uid:r.uid});
}
const numbers={
 place(station,slot,train){removeEverywhere(train.id);if(slot)root.SimLSUI.dispatch({op:'insert',station,slot,number:train.id,direction:train.direction});},
 depart(station,slot,train){removeEverywhere(train.id);if(slot)root.SimLSUI.dispatch({op:'insert',station,slot,number:train.id,direction:train.direction});},
 remove(station,train){removeEverywhere(train.id);},
 // 선로망: 역을 빠져나간 열차번호는 같은 본선의 다음 연동역 진입 열번창(경계 회로)으로 넘어간다 — 그 역의 자동제어가 승강장에 놓을 때까지 그곳에 서 있다
 handoff(station,train,dest){
  const h=dest&&root.SimLine.handoff(station,dest,id=>(root.SimTrainWindows.data[id]||[]).map(w=>w.slot));
  if(h)root.SimLSUI.dispatch({op:'insert',station:h.station,slot:h.slot,number:train.id,direction:train.direction});
 }
};

function label(){const b=$('mmiAutoBtn');if(b){b.textContent=`자동제어 ${enabled?'ON':'OFF'}`;b.setAttribute('aria-pressed',String(enabled));}const c=$('acEnabled');if(c)c.checked=enabled;}
function set(on){
 enabled=!!on;engine.reset();try{localStorage.setItem(KEY,enabled?'1':'0');}catch{}
 label();mmi().log('event',`열차 자동제어(AUTO) ${enabled?'사용':'중지'}`);
 if(enabled&&step())mmi().render();
 drawTroubles();
}
function step(){
 if(!enabled||!host||mmi().replaying())return false;
 const model=root.SimDiagram.getModel(),reserved=new Set(root.SimScenarioUI?.reservedNumbers?.()||[]);
 const events=engine.run({states:host.context().stationStates,model:{...model,trains:model.trains.filter(t=>!reserved.has(t.id))},numbers,reflect});
 for(const e of events){
  if(e.type==='route')mmi().markAuto(`${e.station}|${e.route}|설정`);
  else if((e.type==='arrived'||e.type==='left')&&e.route)mmi().markAuto(`${e.station}|${e.route}|해정`);
  if(e.type==='trouble')mmi().log('event',`${name(e.station)}역 자동진로제어 트러블등록 · ${e.train} ${e.route} · ${e.reason}`,undefined,'W');
  else if(e.type==='delay')mmi().log('event',`${name(e.station)}역 ${e.train} 신호 대기 지연 · 도착 ${e.arrDelay}초 · 출발 ${e.depDelay}초`,undefined,'W');
  else if(e.type==='reflected')mmi().log('event',`${e.train} 지연 ${e.seconds}초를 ${name(e.station)}역 이후 스케줄에 반영`);
  else if(e.type==='resolved')mmi().log('event',`${name(e.station)}역 자동진로제어 트러블 해소 · ${e.train} ${e.route}`);
 }
 if(events.length){drawTroubles();drawDelays();}
 return events.length>0;
}
function drawTroubles(){
 const body=$('acTroubles');if(!body)return;
 const list=engine.troubles();
 body.innerHTML=list.length?list.map(t=>`<tr><td>${esc(name(t.station))}</td><td>${esc(t.train)}</td><td>${esc(t.route)}</td><td>${esc(t.reason)}</td></tr>`).join(''):'<tr class="empty"><td colspan="4">등록된 트러블이 없습니다</td></tr>';
}
function drawDelays(){
 const body=$('acDelays');if(!body)return;
 const list=engine.actuals();
 body.innerHTML=list.length?list.map(d=>`<tr><td>${esc(name(d.station))}</td><td>${esc(d.train)}</td><td>${root.SimTimetable.clock(d.planArrival)}</td><td>${d.arrDelay}초</td><td>${root.SimTimetable.clock(d.planDeparture)}</td><td>${d.depDelay}초</td></tr>`).join(''):'<tr class="empty"><td colspan="6">기록된 지연이 없습니다</td></tr>';
}
function init(api){
 host=api;
 engine=A().create({core:root.SimCore,stations:root.SimNetwork.stations});
 try{enabled=localStorage.getItem(KEY)==='1';reflect=localStorage.getItem(RKEY)==='1';}catch{enabled=false;}
 const win=mmi().createWindow('settings',{title:'프로그램 환경설정',x:150,y:80,width:700,body:`<div class="rpt"><fieldset class="rpt-cond"><legend>열차 자동제어 (AUTO)</legend><label class="nt-check"><input type="checkbox" id="acEnabled"> 열차 자동제어 사용 — AUTO 모드 역에서 스케줄의 도착·출발진로를 시각에 맞춰 자동으로 설정합니다</label></fieldset>
<div class="idm-note">실기3 3.4 기준: 트리거 시점(도착 ${A().TRIGGER_LEAD}초 전)에 접근 열차를 감지해 장내진로 → 출발진로 순으로 요구하고, 진로를 쓸 수 없으면 <b>트러블 등록</b>해 조건이 풀리면 다시 요구합니다. 요구 시점에 역이 AUTO가 아니면 요구하지 않습니다. 가상 열차는 시간표대로 움직이며 열번창의 번호도 따라 움직입니다. 복선만, 입환·분할·병합·역진로(ANTI)·TTB는 다루지 않습니다. 켜고 끄는 값은 이 브라우저에 저장됩니다.</div>
<div class="idm-cap">트러블 등록 목록</div><div class="idm-table rpt-table"><table><thead><tr><th>역</th><th>열차</th><th>진로</th><th>사유</th></tr></thead><tbody id="acTroubles"></tbody></table></div>
<div class="idm-cap">신호 대기 지연 실적</div><div class="idm-table rpt-table"><table><thead><tr><th>역</th><th>열차</th><th>계획 도착</th><th>도착 지연</th><th>계획 출발</th><th>출발 지연</th></tr></thead><tbody id="acDelays"></tbody></table></div><label class="nt-check"><input type="checkbox" id="acReflect"> 지연을 뒤 역의 스케줄에 반영 (기본 꺼짐 — 켜면 시간표가 바뀝니다)</label>
<div class="idm-buttons"><button type="button" class="sched-btn" id="acClose">닫기</button></div></div>`});
 $('acEnabled').onchange=e=>set(e.target.checked);$('acReflect').checked=reflect;$('acReflect').onchange=e=>{reflect=e.target.checked;try{localStorage.setItem(RKEY,reflect?'1':'0');}catch{}};$('acClose').onclick=()=>mmi().close('settings');win.opener=()=>{label();drawTroubles();drawDelays();};
 const btn=$('mmiAutoBtn');if(btn)btn.onclick=()=>set(!enabled);
 label();drawTroubles();if(enabled)step();
}
root.SimAutoUI={init,step,enabled:()=>enabled,set};
})(window);
