(function(root){
'use strict';
const $=id=>SimDOM.document.getElementById(id),N=root.SimNetwork,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let host,lastStation;
const model=()=>root.SimLSUI.getModel(),station=()=>host.context().station,rows=(st,slot)=>model().stations[st]?.windows[slot]||[];
function options(el,list,value){el.innerHTML=list.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');if(list.some(x=>x[0]===value))el.value=value;}
function slots(id,st){const el=$(id),value=el.value;options(el,root.SimTrainWindows.data[st].map(w=>[w.slot,w.code+(w.slot.includes('@')?' ('+w.slot.split('@')[1]+')':'')]),value);}
// [CA012_01] 열차번호제어 (사진 2026-11-11): 왼쪽 제어영역리스트, 작업구분(삽입·삭제·수정·이동·교환), 운행열차목록 표(열번창 × 1~4번째 열차).
// 표의 칸을 누르면 그 열번창과 열차가 선택된다. 아래 숨은 선택 상자들이 선택 상태를 들고 있다.
const OPS={insert:'삽입',delete:'삭제',rename:'수정',move:'이동',swap:'교환'};
const GUIDE={insert:'삽입 : [역], 운행열차목록 [열차번호창],[열차번호입력]',delete:'삭제 : [역], 운행열차목록 [열차번호]',rename:'수정 : [역], 운행열차목록 [열차번호],[새열차번호입력]',move:'이동 : [역], 운행열차목록 [열차번호], 목적 [역],[열차번호창]',swap:'교환 : [역], 운행열차목록 [열차번호], 목적 [역],[열차번호]'};
function grid(st){
 const slot=$('mmiTrainSlot').value,uid=$('mmiTrainEntry').value,list=root.SimTrainWindows.data[st],ins=$('mmiTrainOp').value==='insert';
 $('mmiTrainGrid').innerHTML=`<table><thead><tr><th>열차번호창</th><th>1</th><th>2</th><th>3</th><th>4</th></tr></thead><tbody>${list.map(w=>{const r=rows(st,w.slot),on=w.slot===slot;return `<tr class="${on?'sel':''}" data-tn-slot="${esc(w.slot)}"><th>${esc(w.code)}${w.slot.includes('@')?' ('+esc(w.slot.split('@')[1])+')':''}</th>${[0,1,2,3].map(i=>{const t=r[i],hit=on&&(ins?i===Math.min(r.length,3):!!t&&t.uid===uid);return `<td class="${hit?'hit':''}" ${t?`data-tn-uid="${esc(t.uid)}"`:''}>${t?esc((t.direction==='up'?'<':'>')+t.number):''}</td>`;}).join('')}</tr>`;}).join('')}</tbody></table>`;
}
function refresh(){
 if(!host||!$('mmiTrainStation'))return;
 const st=station(),changed=lastStation!==st;lastStation=st;$('mmiTrainStation').value=st;$('mmiTrainStationName').textContent=root.SimMMI.stationInfo(st).name;slots('mmiTrainSlot',st);
 const source=rows(st,$('mmiTrainSlot').value),old=$('mmiTrainEntry').value;
 options($('mmiTrainEntry'),source.map(t=>[t.uid,(t.direction==='up'?'<':'>')+t.number]),old);
 slots('mmiTrainTargetSlot',$('mmiTrainTargetStation').value);
 options($('mmiTrainTargetEntry'),rows($('mmiTrainTargetStation').value,$('mmiTrainTargetSlot').value).map(t=>[t.uid,t.number]),$('mmiTrainTargetEntry').value);
 const op=$('mmiTrainOp').value,entry=source.find(t=>t.uid===$('mmiTrainEntry').value);
 for(const r of SimDOM.document.querySelectorAll('input[name="mmiTrainOpR"]'))r.checked=r.value===op;
 $('mmiTrainGuide').textContent=GUIDE[op];
 $('mmiTrainDestination').hidden=!['move','swap'].includes(op);$('mmiTrainTargetEntryRow').hidden=op!=='swap';
 $('mmiTrainNumber').readOnly=op!=='insert';$('mmiTrainNew').disabled=op!=='rename';
 if(op!=='insert')$('mmiTrainNumber').value=entry?entry.number:'';
 $('mmiTrainSlotShow').textContent=(root.SimTrainWindows.data[st].find(w=>w.slot===$('mmiTrainSlot').value)?.code)||'';
 $('mmiTrainApply').disabled=op!=='insert'&&!entry;
 $('mmiTrainProperty').disabled=!entry;
 if(changed&&op==='rename'&&entry)fillNumber();
 $('mmiTrainSchedule').innerHTML=root.SimDiagram.getModel().trains.map(t=>`<option value="${esc(t.id)}"></option>`).join('');
 $('mmiTrainSummary').textContent=`${root.SimMMI.stationInfo(st).name} · ${$('mmiTrainSlotShow').textContent} · ${source.length}개 번호`;
 grid(st);
}
function fillNumber(){const t=rows(station(),$('mmiTrainSlot').value).find(t=>t.uid===$('mmiTrainEntry').value);if(t){$('mmiTrainNew').value=t.number;$('mmiTrainDirection').value=t.direction;}}
function init(api){
 host=api;const stationOptions=N.stations.filter(s=>s.controlled).map(s=>`<option value="${s.id}">${esc(root.SimMMI.stationInfo(s.id).name)}[${s.code}]</option>`).join('');
 root.SimMMI.createWindow('trainNumber',{title:'[CA012_01] 열차번호제어',x:60,y:40,width:860,body:`<form id="mmiTrainForm" class="fc-win tn-win">
<div class="fc-left"><fieldset><legend>현장설비제어</legend><div class="fc-picked"><span>선택역명</span><b id="mmiTrainStationName"></b></div><div class="fc-head">제어영역리스트</div><select id="mmiTrainStation" size="15" aria-label="제어영역리스트">${stationOptions}</select></fieldset><div class="tn-left-btns"><button type="button" id="mmiTrainRefresh" class="sched-btn">새로고침</button><button type="button" id="mmiTrainProperty" class="sched-btn">열차 속성 조회</button></div></div>
<div class="fc-right">
<fieldset><legend>작업구분</legend><div class="tn-ops">${Object.entries(OPS).map(([v,l])=>`<label><input type="radio" name="mmiTrainOpR" value="${v}" ${v==='insert'?'checked':''}>${l}</label>`).join('')}</div></fieldset>
<fieldset><legend id="mmiTrainGuide"></legend><div class="tn-fields" id="mmiTrainNumberRow"><label>열차번호<input id="mmiTrainNumber" list="mmiTrainSchedule" maxlength="8" autocomplete="off"><datalist id="mmiTrainSchedule"></datalist></label><span>열번창 <b id="mmiTrainSlotShow"></b></span><label>새열차번호<input id="mmiTrainNew" maxlength="8" autocomplete="off"></label><label>방향<select id="mmiTrainDirection"><option value="up">상행</option><option value="down">하행</option></select></label></div></fieldset>
<div><div class="fc-head">운행열차목록</div><div id="mmiTrainGrid" class="tn-grid"></div></div>
<fieldset id="mmiTrainDestination"><legend>이동·교환 목적지</legend><div class="tn-fields"><label>목적역<select id="mmiTrainTargetStation">${stationOptions}</select></label><label>목적 열번창<select id="mmiTrainTargetSlot"></select></label><label id="mmiTrainTargetEntryRow">교환할 번호<select id="mmiTrainTargetEntry"></select></label></div></fieldset>
<p id="mmiTrainSummary" class="mmi-state" role="status"></p>
<div class="mmi-actions"><span class="fc-src tn-src"><select id="mmiTrainOp" tabindex="-1">${Object.entries(OPS).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><select id="mmiTrainSlot" tabindex="-1"></select><select id="mmiTrainEntry" tabindex="-1"></select></span><button type="submit" id="mmiTrainApply" class="sched-btn">확인</button><button type="button" id="mmiTrainClose" class="sched-btn">닫기</button></div>
</div></form>`});
 $('mmiTrainTargetStation').value=station();
 $('mmiTrainStation').onchange=e=>host.selectStation(e.target.value);
 for(const id of ['mmiTrainTargetStation','mmiTrainTargetSlot'])$(id).onchange=refresh;
 $('mmiTrainOp').onchange=()=>{refresh();if($('mmiTrainOp').value==='rename')fillNumber();};
 for(const r of SimDOM.document.querySelectorAll('input[name="mmiTrainOpR"]'))r.onchange=()=>{$('mmiTrainOp').value=r.value;$('mmiTrainOp').onchange();};
 $('mmiTrainSlot').onchange=()=>{refresh();fillNumber();};$('mmiTrainEntry').onchange=()=>{refresh();fillNumber();};
 $('mmiTrainGrid').onclick=e=>{const tr=e.target.closest('[data-tn-slot]');if(!tr)return;$('mmiTrainSlot').value=tr.dataset.tnSlot;refresh();const td=e.target.closest('[data-tn-uid]');if(td){$('mmiTrainEntry').value=td.dataset.tnUid;refresh();}fillNumber();};
 $('mmiTrainRefresh').onclick=refresh;
 $('mmiTrainClose').onclick=()=>root.SimMMI.close('trainNumber');
 $('mmiTrainForm').onsubmit=e=>{e.preventDefault();const op=$('mmiTrainOp').value,operation={source:'MMI',op,station:station(),slot:$('mmiTrainSlot').value,uid:$('mmiTrainEntry').value,number:op==='rename'?$('mmiTrainNew').value:$('mmiTrainNumber').value,direction:$('mmiTrainDirection').value,targetStation:$('mmiTrainTargetStation').value,targetSlot:$('mmiTrainTargetSlot').value,targetUid:$('mmiTrainTargetEntry').value};host.openAction('열차번호 '+OPS[op],`<p>${esc(root.SimMMI.stationInfo(operation.station).name)} · ${esc(operation.slot)} 열번창에 적용하시겠습니까?</p>`,{type:'lsOperation',operation,source:'MMI'});};
 $('mmiTrainProperty').onclick=()=>{const t=rows(station(),$('mmiTrainSlot').value).find(t=>t.uid===$('mmiTrainEntry').value);if(!t)return;root.SimTrainStatusUI.properties(host,t.number,host.context().state.clock);};
 refresh();
}
root.SimMMITrains={init,refresh};
})(window);
