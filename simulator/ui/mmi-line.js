(function(root){
'use strict';
// 선로망 현황 (교육용): 구간별 점유 열차, 폐색 점유 검사 켜기/끄기, 단선지령식 시행·복귀 (비상시 조치 01·02의 상선/하선 단선지령식)
const doc=SimDOM.document,$=id=>doc.getElementById(id),L=root.SimLine;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nm=id=>root.SimNetwork.catalog[id]?.name||id;
const SERIES={M:'지하철',G:'일반선',E:'전동선'};
function draw(){
 const ls=root.SimLSUI.getModel();
 const occupied=L.circuitOccupancy(ls,Object.fromEntries(root.SimNetwork.stations.filter(s=>s.controlled).map(s=>[s.id,root.SimField.state(s.id)])));
 const rows=L.line.sections.map(sec=>({sec,nums:[...new Set(L.graph.chains[sec.id].flatMap(c=>occupied[c]||[]))]}));
 const audit=root.SimNetworkTopology.audit();
 $('lnSummary').textContent=`${audit.stations}개 역 · ${L.line.sections.length}개 본선 구간 · ${audit.controlled}개 구내망 · ${audit.routes}개 진로 · ${Object.keys(L.graph.circuits).length}개 회로`;
 const busy=rows;
 $('lnRows').innerHTML=busy.length?busy.map(r=>`<tr><td>${esc(nm(r.sec.west))} → ${esc(nm(r.sec.east))}</td><td>${esc(L.NAMES[r.sec.trunk])}</td><td>${esc(r.nums.join(', ')||'비점유')}</td><td><details><summary>${L.graph.chains[r.sec.id].length}개 회로</summary>${L.graph.chains[r.sec.id].map(c=>esc(c)+(occupied[c]?.length?' ['+esc(occupied[c].join(', '))+']':'')).join(' → ')}</details></td><td>${L.state.single.has(`${r.sec.west}>${r.sec.east}:${r.sec.trunk[0]}`)?'단선지령식':'상용폐색'}</td></tr>`).join(''):'<tr class="empty"><td colspan="4">점유된 구간이 없습니다</td></tr>';
 $('lnEnforce').checked=L.state.enforce;
 $('lnSingleList').textContent=L.state.single.size?[...L.state.single].map(k=>{const [p,x]=k.split(':'),[a,b]=p.split('>');return `${nm(a)}~${nm(b)} ${SERIES[x]}`;}).join(' · '):'시행 중인 단선지령식 없음';
}
function pairs(){
 const seen=new Set(),out=[];
 for(const sec of L.line.sections){const k=`${sec.west}>${sec.east}:${sec.trunk[0]}`;if(seen.has(k))continue;
  if(L.line.sections.some(x=>x!==sec&&x.west===sec.west&&x.east===sec.east&&x.trunk[0]===sec.trunk[0])){seen.add(k);out.push({k,label:`${nm(sec.west)} ~ ${nm(sec.east)} · ${SERIES[sec.trunk[0]]}`});}}
 return out;
}
function init(){
 const m=root.SimMMI;
 const w=m.createWindow('lineNet',{title:'선로망 현황 (교육용)',x:210,y:100,width:720,body:`<div class="rpt"><div class="idm-note">노선의 본선(큰 가지)을 구간으로 이어, 원본 회로별로 점유를 확인하고 바로 앞 회로가 점유된 출발 진로를 막습니다. AUTO·수동 제어·시나리오가 같은 폐색 검사를 사용합니다.</div><div class="idm-cap" id="lnSummary"></div><label class="nt-check"><input type="checkbox" id="lnEnforce"> 폐색 점유 검사</label><div class="idm-table rpt-table"><table><thead><tr><th>구간</th><th>본선</th><th>열차</th><th>회로 연결</th><th>폐색방식</th></tr></thead><tbody id="lnRows"></tbody></table></div><div class="rpt-cond"><label>단선지령식 구간 <select id="lnPair">${pairs().map(p=>`<option value="${p.k}">${esc(p.label)}</option>`).join('')}</select></label><button type="button" class="sched-btn" id="lnSingleOn">시행</button><button type="button" class="sched-btn" id="lnSingleOff">상용폐색 복귀</button></div><div class="idm-note" id="lnSingleList"></div><details><summary>기지 입출고 경계 7곳</summary><ul>${L.graph.boundaries.map(b=>`<li>${esc(nm(b.station))} · ${esc(b.code)} · ${esc(b.name)} — 기지 내부는 제공 자료 범위 밖</li>`).join('')}</ul></details><div class="idm-buttons"><button type="button" class="sched-btn" id="lnClose">닫기</button></div></div>`});
 $('lnEnforce').onchange=e=>{if(root.SimRemote)root.SimRemote.command({type:'line',enforce:e.target.checked});else L.state.enforce=e.target.checked;m.log('event',`폐색 점유 검사 ${L.state.enforce?'사용':'해제'}`);draw();};
 $('lnSingleOn').onclick=()=>{const k=$('lnPair').value,[p,x]=k.split(':'),[a,b]=p.split('>');if(root.SimRemote)root.SimRemote.command({type:'line',key:k,on:true});else L.state.single.add(k);m.log('event',`${nm(a)}~${nm(b)} ${SERIES[x]} 단선지령식 시행`);draw();};
 $('lnSingleOff').onclick=()=>{const k=$('lnPair').value,[p,x]=k.split(':'),[a,b]=p.split('>');const had=L.state.single.has(k);if(root.SimRemote)root.SimRemote.command({type:'line',key:k,on:false});else L.state.single.delete(k);if(had)m.log('event',`${nm(a)}~${nm(b)} ${SERIES[x]} 상용폐색 복귀`);draw();};
 $('lnClose').onclick=()=>m.close('lineNet');
 w.opener=draw;setInterval(()=>{if(!w.el.hidden)draw();},1000);draw();
}
root.SimLineUI={init,draw};
})(window);
