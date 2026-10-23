(function(root){
'use strict';
// 운전정리 대장 창: 스케줄 변경을 운전명령 / 관제승인 / 단순 운전정리로 분류해 보여 준다 (교통관제운영 1권 p.50-52).
const doc=SimDOM.document,$=id=>doc.getElementById(id),L=root.SimLedger,T=root.SimTimetable;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamps=new Map();      // change index -> clock when first seen
function seen(){
 const model=root.SimDiagram.getModel(),now=root.SimDiagram.clock?.()??0;
 model.changes.forEach((c,i)=>{if(!stamps.has(i))stamps.set(i,now);});
 return model.changes;
}
function draw(){
 const changes=seen(),filter=$('ldFilter').value,rows=L.entries(changes).filter(r=>!filter||r.cls===filter);
 $('ldRows').innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.label)}</td><td>${esc(r.kind)}</td><td>${esc(r.text)}</td><td>${T.clock(stamps.get(r.index)??0)}</td></tr>`).join(''):'<tr class="empty"><td colspan="4">기록된 운전정리가 없습니다</td></tr>';
 const all=L.entries(changes);
 $('ldCount').textContent=`운전명령 ${all.filter(r=>r.cls===L.ORDER).length}건 · 관제승인 ${all.filter(r=>r.cls===L.APPROVAL).length}건 · 단순 운전정리 ${all.filter(r=>r.cls===L.SIMPLE).length}건`;
}
function init(){
 const m=root.SimMMI;
 const w=m.createWindow('ledger',{title:'운전정리 대장 (교육용)',x:170,y:80,width:760,body:`<div class="rpt"><div class="idm-note">스케줄을 바꾸면 변경 종류에 따라 <b>운전명령</b>(운행변경·종별변경·운행휴지·임시열차운행 등), <b>관제승인</b>(운전시각변경·반복변경 등), <b>단순 운전정리</b>(출발·도착선 변경, 임시대피, 간격조정 — 별도 명령·승인 없음)로 나뉘어 기록됩니다. 승인번호는 종류별 순번이며, 분류는 교재 분류를 이 시뮬레이터의 변경 종류에 맞춘 것입니다.</div><div class="rpt-cond"><label>구분 <select id="ldFilter"><option value="">전체</option><option>운전명령</option><option>관제승인</option><option>단순 운전정리</option></select></label></div><div class="idm-table rpt-table"><table><thead><tr><th>구분·번호</th><th>종류</th><th>내용</th><th>시각</th></tr></thead><tbody id="ldRows"></tbody></table></div><div class="idm-note" id="ldCount"></div><div class="idm-buttons"><button type="button" class="sched-btn" id="ldClose">닫기</button></div></div>`});
 $('ldFilter').onchange=draw;$('ldClose').onclick=()=>m.close('ledger');
 w.opener=draw;root.SimDiagram.onRender(()=>{seen();if(!w.el.hidden)draw();});
 setInterval(()=>{if(w.el.hidden)seen();else draw();},1000);   // the T/G may be closed, so also watch on a timer
 seen();draw();
}
root.SimLedgerUI={init,draw};
})(window);
