(function(root){
'use strict';
// 열차 자동제어(AUTO) 화면: 켜고 끄기(프로그램 환경설정)와 트러블·지연 목록. 계산은 엔진(auto-controller)이 한다.
const doc=SimDOM.document,$=id=>doc.getElementById(id),A=()=>root.SimAuto,mmi=()=>root.SimMMI;
// 열차 자동제어(AUTO)의 계산·열번 이동·트러블 등록은 엔진(auto-controller)이 한다. 이 파일은 켜고 끄기·설정 창·목록만 그린다.
let host=null,enabled=false,reflect=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=id=>mmi().stationInfo(id).name;
const auto=()=>root.SimRemote.snapshot.auto;
const engine={troubles:()=>auto().troubles,actuals:()=>auto().actuals};

function label(){const c=$('acEnabled');if(c)c.checked=enabled;}
function set(on){root.SimRemote.command({type:'auto',enabled:!!on});enabled=!!on;label();drawTroubles();drawDelays();}
function step(){enabled=auto().enabled;reflect=auto().reflect;label();drawTroubles();drawDelays();return true;}
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
 enabled=auto().enabled;reflect=auto().reflect;
 const win=mmi().createWindow('settings',{title:'프로그램 환경설정',x:150,y:80,width:700,body:`<div class="rpt"><fieldset class="rpt-cond"><legend>열차 자동제어 (AUTO)</legend><label class="nt-check"><input type="checkbox" id="acEnabled"> 열차 자동제어 사용 — AUTO 모드 역에서 스케줄의 도착·출발진로를 시각에 맞춰 자동으로 설정합니다</label></fieldset>
<div class="idm-note">실기3 3.4 기준: 트리거 시점(도착 ${A().TRIGGER_LEAD}초 전)에 접근 열차를 감지해 장내진로 → 출발진로 순으로 요구하고, 진로를 쓸 수 없으면 <b>트러블 등록</b>해 조건이 풀리면 다시 요구합니다. 요구 시점에 역이 AUTO가 아니면 요구하지 않습니다. 가상 열차는 앞 역의 실제 출발·통과를 기다립니다. 지연은 운행에 전파되며 시간표 반영은 별도 선택입니다. 복선만, 입환·분할·병합·역진로(ANTI)·TTB는 다루지 않습니다. 켜고 끄는 값은 이 브라우저에 저장됩니다.</div>
<div class="idm-cap">트러블 등록 목록</div><div class="idm-table rpt-table"><table><thead><tr><th>역</th><th>열차</th><th>진로</th><th>사유</th></tr></thead><tbody id="acTroubles"></tbody></table></div>
<div class="idm-cap">신호 대기 지연 실적</div><div class="idm-table rpt-table"><table><thead><tr><th>역</th><th>열차</th><th>계획 도착</th><th>도착 지연</th><th>계획 출발</th><th>출발 지연</th></tr></thead><tbody id="acDelays"></tbody></table></div><label class="nt-check"><input type="checkbox" id="acReflect"> 지연을 뒤 역의 스케줄에 반영 (기본 꺼짐 — 켜면 시간표가 바뀝니다)</label>
<div class="idm-buttons"><button type="button" class="sched-btn" id="acClose">닫기</button></div></div>`});
 $('acEnabled').onchange=e=>set(e.target.checked);$('acReflect').checked=reflect;$('acReflect').onchange=e=>{reflect=e.target.checked;root.SimRemote.command({type:'auto',reflect});};$('acClose').onclick=()=>mmi().close('settings');win.opener=()=>{label();drawTroubles();drawDelays();};
 label();drawTroubles();if(enabled)step();
}
function position(train){return auto().positions[train.id]??null;}
root.SimAutoUI={init,step,transits:()=>auto().transits,enabled:()=>auto().enabled,actuals:()=>engine.actuals(),position,set};
})(window);
