(function(root){'use strict';
const P=root.SimPlatforms,$=id=>root.SimDOM.document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function inspect(height,host){const info=P.describe(height);if(!info)return;const ctx=host.context(),trains=root.SimDiagram.getModel().trains;
 host.openAction('승강장 정보 · '+info.label,`<div class="platform-detail"><span class="platform-key ${info.css}"></span><b>${info.label}</b><span>${info.colour} 승강장 표시</span></div><p>${esc(ctx.viewName||root.SimNetwork.catalog[ctx.station].name)} 표시 구간입니다. 색은 홈 높이를 뜻합니다. 승하차 정차와 통과·입환을 구분해 확인하세요.</p><label class="field-label" for="platformTrain">확인할 열차</label><select id="platformTrain"><option value="">열차 선택</option>${trains.map(t=>`<option value="${esc(t.id)}">${esc(t.id)} · ${esc(t.kind)} · ${P.trainHeights[t.boardingHeight||'unknown']}</option>`).join('')}</select><label class="field-label" for="platformOperation">취급 목적</label><select id="platformOperation"><option value="stop">승하차 정차</option><option value="pass">통과</option><option value="shunt">승하차 없는 입환</option></select><p id="platformResult" class="platform-result" role="status"></p><p>차량의 대응 홈 높이는 MMI 열차스케줄에서 기록합니다. 이 확인은 선택한 홈과 차량의 높이 비교이며 도착선 배정이나 진로 명령을 변경하지 않습니다.</p>`,null,'닫기');
 function check(){const t=trains.find(t=>t.id===$('platformTrain').value),r=P.assess(height,t?.boardingHeight,$('platformOperation').value);$('platformResult').dataset.status=r.status;$('platformResult').textContent=r.message;}
 $('platformTrain').onchange=$('platformOperation').onchange=check;check();
}
root.SimPlatformsUI={inspect};
})(window);
