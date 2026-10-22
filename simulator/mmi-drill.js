(function(root){
'use strict';
// 경합해소 실습: the "경합 시나리오" exam (references/scenarios/경합 시나리오.hwpx) on top of the 실기3 경합 detection (4장).
// A temporary train B0000 is copied from the first down train and sped up over a stretch so that it closes in on its leader.
// The operator finds the conflict on the T/G and resolves it at the nearest upstream 해소역 by moving the time (+2분) and the
// arrival/departure routes of B0000 there. Grading is not part of the real system; it only checks what the scenario text asks for.
const doc=document,$=id=>doc.getElementById(id),N=root.SimNetwork,T=root.SimTimetable;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ID='B0000',OFFSET=240,SHIFTS=[50,100,150,150,150,100,50];
const mmi=()=>root.SimMMI,D=()=>root.SimDiagram,model=()=>D().getModel();
const name=id=>mmi().stationInfo(id).name;
let baseline=null,start=null;

function problemTrain(){return model().trains.find(t=>t.id===ID);}
function generate(){
 if(problemTrain()){say('이미 출제된 문제가 있습니다. 채점하거나 [초기화] 후 다시 출제하세요.');return;}
 // the last down train, so that nothing runs behind B0000 and a +2분 shift cannot create a 3rd conflict by itself
 const leader=model().trains.filter(t=>t.direction==='down'&&!t.cancelled).at(-1);
 if(!leader){say('기준이 되는 하행 열차가 없습니다.');return;}
 const made=T.copy(model(),leader.id,ID,leader.calls[0].departure+OFFSET,{});
 if(!made.ok){say(made.message);return;}
 const train=problemTrain(),a=N.stations.findIndex(s=>s.id==='yeongdeungpo')+1;
 SHIFTS.forEach((shift,k)=>{const c=train.calls[a+k];if(!c)return;c.arrival-=shift;c.departure-=shift;});
 // everything after the sped-up stretch is as copied; legs only ever get shorter by <=50 s, so the order stays valid
 train.plan=train.calls.map(c=>({...c}));
 if(!T.valid(train)){T.remove(model(),ID);say('문제 열차를 만들지 못했습니다. 시각표를 확인하세요.');return;}
 const found=T.conflicts(model());
 if(!found.length){T.remove(model(),ID);say('경합이 만들어지지 않았습니다.');return;}
 baseline=structuredClone(train.calls);start={station:found[0].station,leader:leader.id};
 D().selectTrain(ID);D().render();
 mmi().log('event','경합해소 실습 출제');
 say(`문제가 출제되었습니다. 온라인 열차그래프에서 ${leader.id}과 ${ID}의 경합을 찾아 해소하세요. (경합 발생 위치와 해소역은 직접 판단합니다)`);
 list();
}
function say(text){$('drillMsg').textContent=text;}
function list(){
 const found=T.conflicts(model());
 $('drillRows').innerHTML=found.length?found.map(c=>`<tr><td>${esc(c.type)}</td><td>${esc(c.trains.join(' + '))}</td><td>${esc(name(c.station))}</td><td>${T.clock(c.time)}</td></tr>`).join(''):'<tr class="empty"><td colspan="4">검지된 경합이 없습니다</td></tr>';
 $('drillCount').textContent=`총 ${found.length}건`;
}
function grade(){
 const train=problemTrain();
 if(!train||!baseline){say('출제된 문제가 없습니다. [문제 출제]를 누르세요.');return;}
 const remaining=T.conflicts(model());
 if(remaining.length){list();say(`경합이 ${remaining.length}건 남아 있습니다. 경합 구간은 ${name(remaining[0].station)}부터입니다 — 다시 확인하세요.`);return;}
 const changed=train.calls.findIndex((c,i)=>c.arrival!==baseline[i].arrival||c.departure!==baseline[i].departure||c.arrivalRoute!==baseline[i].arrivalRoute||c.departureRoute!==baseline[i].departureRoute);
 if(changed<0){say('B0000을 수정하지 않았는데 경합이 없습니다. 상태를 확인하세요.');return;}
 const nearest=T.nearestResolveStation(start.station,'down'),at=train.calls[changed].station;
 const parts=[];
 if(at!==nearest)parts.push(`경합은 해소되었지만 해소역이 원칙과 다릅니다. 경합지(${name(start.station)})에서 가장 가까운 앞쪽 해소역은 ${name(nearest)}역이며, 수정은 ${name(at)}역에서 시작했습니다. (※ 해소역: ${T.RESOLVE_STATIONS.map(name).join('·')})`);
 const idx=train.calls.findIndex(c=>c.station===nearest),cur=train.calls[idx],base=baseline[idx];
 if(idx>=0&&cur.arrivalRoute===base.arrivalRoute&&cur.departureRoute===base.departureRoute)parts.push(`${name(nearest)}역의 도착진로·출발진로를 수정하지 않았습니다.`);
 if(idx>=0&&cur.departure<=base.departure)parts.push(`${name(nearest)}역 출발시각을 늦추지 않았습니다. (해소역에서 +2분)`);
 list();
 if(parts.length){say(parts.join(' '));mmi().log('event','경합해소 실습 채점 · 보완 필요');return;}
 say(`합격: ${name(nearest)}역에서 시각(${T.clock(cur.departure)})과 진로(${cur.arrivalRoute||'—'} / ${cur.departureRoute||'—'})를 수정해 경합을 해소했습니다. 다른 열차와의 3차 경합도 없습니다.`);
 mmi().log('event','경합해소 실습 채점 · 합격');
}
function reset(){if(problemTrain())T.remove(model(),ID);baseline=null;start=null;D().render();list();say('초기화했습니다.');}
function init(){
 const win=mmi().createWindow('conflictDrill',{title:'경합해소 실습 (교육용)',x:140,y:80,width:620,body:`<div class="rpt drill"><ol class="drill-steps"><li>[문제 출제]로 경합 상황을 만듭니다. (임시열차 B0000이 앞 열차를 따라잡습니다)</li><li>열차스케줄 → 온라인 열차그래프에서 열차를 검색하고, 십자선보기·돋보기로 경합 구간을 찾습니다.</li><li>“○○열차와 ○○열차가 ○○역~○○역 구간에서 경합, ○○역에서 해소하겠습니다.”</li><li>열차스케줄 관리(수정)에서 해소역의 시각을 +2분 늦추고(다른 열차와의 3차 경합 주의), 도착진로·출발진로를 수정한 뒤 편집적용합니다.</li><li>※ 경합해소는 경합지에서 가장 가까운 앞쪽 해소역에서 합니다. 해소역: 용산·영등포·금천구청·안양·군포·의왕</li></ol>
<div class="idm-table rpt-table"><table><thead><tr><th>경합 종류</th><th>열차</th><th>역</th><th>시각</th></tr></thead><tbody id="drillRows"></tbody></table></div>
<div class="idm-note">경합 목록은 확인용입니다(실제 시스템의 경합검지 기능). 최소 운전시격 ${T.MIN_HEADWAY}초는 교재의 “2~3분” 설명에 맞춘 교육용 값입니다. 채점은 이 시뮬레이터의 기능입니다. <span id="drillCount"></span></div>
<div id="drillMsg" class="trc-msg" role="status">[문제 출제]를 눌러 시작하세요.</div>
<div class="idm-buttons"><button type="button" class="sched-btn primary" id="drillNew">문제 출제</button><button type="button" class="sched-btn" id="drillList">경합 목록 보기</button><button type="button" class="sched-btn primary" id="drillGrade">채점</button><button type="button" class="sched-btn" id="drillReset">초기화</button><button type="button" class="sched-btn" id="drillClose">닫기</button></div></div>`});
 $('drillNew').onclick=generate;$('drillList').onclick=list;$('drillGrade').onclick=grade;$('drillReset').onclick=reset;$('drillClose').onclick=()=>mmi().close('conflictDrill');
 win.opener=list;list();
}
root.SimDrill={init,generate,grade,reset};
})(window);
