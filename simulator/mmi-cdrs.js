(function(root){
'use strict';
// CDRS 해소안 창: 경합 검지 → 해소안 제시 → [확인] 승인(스케줄 자동 변경) / [취소](수동 운전정리). 교통관제운영 2권 5장 2.3.
const doc=SimDOM.document,$=id=>doc.getElementById(id),C=root.SimCDRS,T=root.SimTimetable,N=root.SimNetwork;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nm=id=>N.catalog[id]?.name||id;
let dismissed=[],plans=[],lastCount=0,timer=null;
const model=()=>root.SimDiagram.getModel();
function detect(announce){
 plans=C.propose(model(),dismissed);
 if(announce&&plans.length>lastCount)root.SimMMI.raiseAlarm(`CDRS 경합 검지 ${plans.length}건`,'경합','W');
 lastCount=plans.length;draw();
}
function draw(){
 $('cdrsRows').innerHTML=plans.length?plans.map((p,i)=>`<tr><td>${esc(p.conflict.type)}</td><td>${esc(p.conflict.trains.join(' + '))}</td><td>${esc(nm(p.conflict.station))}</td><td>${T.clock(p.conflict.time)}</td><td>${esc(C.describe(p))}</td><td><button type="button" class="sched-btn primary" data-cdrs-ok="${i}" ${p.plan?'':'disabled'}>확인</button> <button type="button" class="sched-btn" data-cdrs-no="${i}">취소</button></td></tr>`).join(''):'<tr class="empty"><td colspan="6">제시할 해소안이 없습니다</td></tr>';
 $('cdrsCount').textContent=`검지된 경합 ${plans.length}건${dismissed.length?` · 취소한 해소안 ${dismissed.length}건`:''}`;
}
function init(){
 const m=root.SimMMI;
 const w=m.createWindow('cdrs',{title:'열차경합시스템 CDRS (교육용)',x:150,y:70,width:860,body:`<div class="rpt"><div class="idm-note">경합이 검지되면 해소안이 제시됩니다. [확인]하면 해당 열차의 시각·진로가 자동으로 바뀌고, [취소]하면 해소안이 철회되어 열차스케줄 관리에서 직접 수정해야 합니다. 해소안 계산은 이 시뮬레이터의 단순화입니다.</div><div class="idm-table rpt-table"><table><thead><tr><th>경합 종류</th><th>열차</th><th>역</th><th>시각</th><th>제시 해소안</th><th>취급</th></tr></thead><tbody id="cdrsRows"></tbody></table></div><div class="idm-note" id="cdrsCount"></div><div id="cdrsMsg" class="trc-msg" role="status"></div><div class="idm-buttons"><button type="button" class="sched-btn" id="cdrsDetect">경합 검지</button><button type="button" class="sched-btn" id="cdrsRestore">취소한 해소안 다시 제시</button><button type="button" class="sched-btn" id="cdrsClose">닫기</button></div></div>`});
 $('cdrsRows').onclick=e=>{
  const ok=e.target.closest('[data-cdrs-ok]'),no=e.target.closest('[data-cdrs-no]');
  if(ok){const p=plans[+ok.dataset.cdrsOk],r=C.approve(model(),p);$('cdrsMsg').textContent=r.message;if(r.ok){m.log('event',r.message);root.SimDiagram.render();detect(false);}}
  if(no){const p=plans[+no.dataset.cdrsNo];dismissed.push(p.key);$('cdrsMsg').textContent='해소안을 취소했습니다. 열차스케줄 관리에서 수동으로 운전정리를 하세요.';m.log('event','CDRS 해소안 취소 · 수동 운전정리');detect(false);}
 };
 $('cdrsDetect').onclick=()=>{$('cdrsMsg').textContent='';detect(true);};
 $('cdrsRestore').onclick=()=>{dismissed=[];detect(false);};
 $('cdrsClose').onclick=()=>m.close('cdrs');
 w.opener=()=>detect(false);detect(false);
}
root.SimCDRSUI={init,detect,plans:()=>plans};
})(window);
