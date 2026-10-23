(function(root){
'use strict';
// 운영자 선호화면 설정 (교통관제운영 4권 p.374-376): L/S 3개 모니터별로 표시할 역을 추가·삭제·위/아래 이동하고 [확인]으로 적용.
// This simulator has one L/S, so the chosen monitor's list is shown first in the L/S station selector (optgroup "운영자 선호화면").
const doc=SimDOM.document,$=id=>doc.getElementById(id),N=root.SimNetwork,KEY='orpheia.preferred';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stations=root.SimLSPresets.list();
let cfg={1:[],2:[],3:[]},mon=1,sel=null,pool=null;
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d[1])cfg=d;}catch(e){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch(e){}}
const label=id=>{const v=root.SimLSPresets.get(id);return v?(v.id===v.station?`${v.name} [${N.catalog[v.station].code}]`:v.name):id;};
function apply(){
 const el=$('lsStationSelect');if(!el)return;const cur=el.value,list=cfg[mon]||[];
 const opt=s=>`<option value="${s.id}">${esc(label(s.id))}</option>`;
 const pref=list.map(id=>stations.find(s=>s.id===id)).filter(Boolean);
 el.innerHTML=(pref.length?`<optgroup label="운영자 선호화면 (모니터 ${mon})">${pref.map(opt).join('')}</optgroup><optgroup label="전체 LS 화면">`:'')+stations.map(opt).join('')+(pref.length?'</optgroup>':'');
 el.value=cur;
}
function draw(){
 const list=cfg[mon];
 $('prefList').innerHTML=list.length?list.map((id,i)=>`<li data-i="${i}" class="${sel===i?'sel':''}">${esc(label(id))}</li>`).join(''):'<li class="empty">설정된 역이 없습니다 (전체 LS 화면 표시)</li>';
 $('prefPool').innerHTML=stations.map(s=>`<li data-id="${s.id}" class="${pool===s.id?'sel':''}">${esc(label(s.id))}</li>`).join('');
 doc.querySelectorAll('[data-pref-mon]').forEach(b=>b.classList.toggle('primary',+b.dataset.prefMon===mon));
}
function init(){
 const m=root.SimMMI;load();apply();
 const w=m.createWindow('preferredScreen',{title:'운영자선호화면 설정',x:200,y:90,width:560,body:`<div class="rpt pref"><div class="idm-buttons" role="group" aria-label="L/S 모니터">${[1,2,3].map(n=>`<button type="button" class="sched-btn" data-pref-mon="${n}">L/S ${n}</button>`).join('')}</div><div class="pref-cols"><div><b>L/S 화면 목록</b><ul id="prefList" class="pref-ul"></ul></div><div class="pref-mid"><button type="button" class="sched-btn" id="prefAdd">◀ 추가</button><button type="button" class="sched-btn" id="prefDel">삭제 ▶</button><button type="button" class="sched-btn" id="prefUp">▲</button><button type="button" class="sched-btn" id="prefDown">▼</button></div><div><b>전체 LS 화면</b><ul id="prefPool" class="pref-ul"></ul></div></div><div class="idm-note">모니터를 고르고 역을 추가·삭제·이동한 뒤 [확인]을 누르면 L/S 역 선택 목록 맨 위에 선호 역이 나타납니다. 선택한 모니터의 선호 목록을 현재 LS 창에 적용합니다.</div><div id="prefMsg" class="trc-msg" role="status"></div><div class="idm-buttons"><button type="button" class="sched-btn primary" id="prefOk">확인</button><button type="button" class="sched-btn" id="prefClose">닫기</button></div></div>`});
 const say=t=>{$('prefMsg').textContent=t;};
 doc.querySelectorAll('[data-pref-mon]').forEach(b=>b.onclick=()=>{mon=+b.dataset.prefMon;sel=null;draw();});
 $('prefList').onclick=e=>{const li=e.target.closest('li[data-i]');if(li){sel=+li.dataset.i;draw();}};
 $('prefPool').onclick=e=>{const li=e.target.closest('li[data-id]');if(li){pool=li.dataset.id;draw();}};
 $('prefAdd').onclick=()=>{if(!pool){say('추가할 역을 오른쪽에서 선택하세요.');return;}const l=cfg[mon],at=sel===null?l.length:sel+1;if(l.includes(pool)){say('이미 목록에 있는 역입니다.');return;}l.splice(at,0,pool);sel=at;draw();say('');};
 $('prefDel').onclick=()=>{if(sel===null){say('삭제할 역을 왼쪽에서 선택하세요.');return;}cfg[mon].splice(sel,1);sel=null;draw();say('');};
 $('prefUp').onclick=()=>{const l=cfg[mon];if(sel>0){[l[sel-1],l[sel]]=[l[sel],l[sel-1]];sel--;draw();}};
 $('prefDown').onclick=()=>{const l=cfg[mon];if(sel!==null&&sel<l.length-1){[l[sel+1],l[sel]]=[l[sel],l[sel+1]];sel++;draw();}};
 $('prefOk').onclick=()=>{save();apply();say(`L/S ${mon} 운영자 선호화면을 적용했습니다.`);m.log&&m.log('event',`운영자선호화면 설정 · L/S ${mon}`);};
 $('prefClose').onclick=()=>m.close('preferredScreen');
 w.opener=draw;draw();
}
root.SimPreferred={init,apply};
})(window);
