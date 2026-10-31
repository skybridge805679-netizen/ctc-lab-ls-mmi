(function(root){
'use strict';
// 경합해소 실습: the "경합 시나리오" exam (references/scenarios/경합 시나리오.hwpx) on top of the 실기3 경합 detection (4장).
// A temporary train B0000 is copied from a down train of the current timetable and sped up over a stretch so that it closes in on its leader.
// The operator finds the conflict on the T/G and resolves it at the nearest upstream 해소역 by moving the time (+2분) and the
// arrival/departure routes of B0000 there. Grading is not part of the real system; it only checks what the scenario text asks for.
const doc=SimDOM.document,$=id=>doc.getElementById(id),N=root.SimNetwork,T=root.SimTimetable;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ID='B0000';
const mmi=()=>root.SimMMI,D=()=>root.SimDiagram,model=()=>D().getModel();
const name=id=>mmi().stationInfo(id).name;
// 출제(임시열차 B0000 만들기)·채점·초기화는 엔진(conflict-drill)이 한다. 이 창은 명령을 보내고 결과와 경합 목록을 보인다.
const drill=()=>root.SimRemote.snapshot.drill;
function createProblem({select=true}={}){
 const r=root.SimRemote.command({type:'drill:create',options:{select}});
 if(r.ok){if(select)D().selectTrain(ID);D().render();}
 return r;
}
function generate(){
 const r=createProblem();if(!r.ok){say(r.message);return;}
 say(`문제가 출제되었습니다. 온라인 열차그래프에서 ${r.leader}과 ${ID}의 경합을 찾아 해소하세요. (경합 발생 위치와 해소역은 직접 판단합니다)`);
 list();
}
function say(text){$('drillMsg').textContent=text;}
function list(){
 const found=T.conflicts(model());
 $('drillRows').innerHTML=found.length?found.map(c=>`<tr><td>${esc(c.type)}</td><td>${esc(c.trains.join(' + '))}</td><td>${esc(name(c.station))}</td><td>${T.clock(c.time)}</td></tr>`).join(''):'<tr class="empty"><td colspan="4">검지된 경합이 없습니다</td></tr>';
 $('drillCount').textContent=`총 ${found.length}건`;
}
function grade(){const r=root.SimRemote.command({type:'drill:grade'});list();say(r.message);}
function reset(){root.SimRemote.command({type:'drill:reset'});D().render();list();say('초기화했습니다.');}
function init(){
 const win=mmi().createWindow('conflictDrill',{title:'경합해소 실습 (교육용)',x:140,y:80,width:620,body:`<div class="rpt drill"><ol class="drill-steps"><li>[문제 출제]로 경합 상황을 만듭니다. (임시열차 B0000이 앞 열차를 따라잡습니다)</li><li>열차스케줄 → 온라인 열차그래프에서 열차를 검색하고, 십자선보기·돋보기로 경합 구간을 찾습니다.</li><li>“○○열차와 ○○열차가 ○○역~○○역 구간에서 경합, ○○역에서 해소하겠습니다.”</li><li>열차스케줄 관리(수정)에서 해소역의 시각을 +2분 늦추고(다른 열차와의 3차 경합 주의), 도착진로·출발진로를 수정한 뒤 편집적용합니다.</li><li>※ 경합해소는 경합지에서 가장 가까운 앞쪽 해소역에서 합니다. 해소역: 용산·영등포·금천구청·안양·군포·의왕</li></ol>
<div class="idm-table rpt-table"><table><thead><tr><th>경합 종류</th><th>열차</th><th>역</th><th>시각</th></tr></thead><tbody id="drillRows"></tbody></table></div>
<div class="idm-note">경합 목록은 확인용입니다(실제 시스템의 경합검지 기능). 최소 운전시격 ${T.MIN_HEADWAY}초는 교재의 “2~3분” 설명에 맞춘 교육용 값입니다. 채점은 이 시뮬레이터의 기능입니다. <span id="drillCount"></span></div>
<div id="drillMsg" class="trc-msg" role="status">[문제 출제]를 눌러 시작하세요.</div>
<div class="idm-buttons"><button type="button" class="sched-btn primary" id="drillNew">문제 출제</button><button type="button" class="sched-btn" id="drillList">경합 목록 보기</button><button type="button" class="sched-btn primary" id="drillGrade">채점</button><button type="button" class="sched-btn" id="drillReset">초기화</button><button type="button" class="sched-btn" id="drillClose">닫기</button></div></div>`});
 $('drillNew').onclick=generate;$('drillList').onclick=list;$('drillGrade').onclick=grade;$('drillReset').onclick=reset;$('drillClose').onclick=()=>mmi().close('conflictDrill');
 win.opener=list;list();
}
root.SimDrill={init,generate,grade,reset,createProblem,ID,baseline:()=>structuredClone(drill().baseline),started:()=>drill().start};
})(window);
