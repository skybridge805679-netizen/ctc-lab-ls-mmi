(function(root){
'use strict';
const $=id=>document.getElementById(id),N=root.SimNetwork,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let host,lastStation;
const model=()=>root.SimLSUI.getModel(),station=()=>host.context().station,rows=(st,slot)=>model().stations[st]?.windows[slot]||[];
function options(el,list,value){el.innerHTML=list.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');if(list.some(x=>x[0]===value))el.value=value;}
function slots(id,st){const el=$(id),value=el.value;options(el,root.SimTrainWindows.data[st].map(w=>[w.slot,w.code+(w.slot.includes('@')?' ('+w.slot.split('@')[1]+')':'')]),value);}
function refresh(){
 if(!host||!$('mmiTrainStation'))return;
 const st=station(),changed=lastStation!==st;lastStation=st;$('mmiTrainStation').value=st;slots('mmiTrainSlot',st);
 const source=rows(st,$('mmiTrainSlot').value),old=$('mmiTrainEntry').value;
 options($('mmiTrainEntry'),source.map(t=>[t.uid,(t.direction==='up'?'<':'>')+t.number]),old);
 slots('mmiTrainTargetSlot',$('mmiTrainTargetStation').value);
 options($('mmiTrainTargetEntry'),rows($('mmiTrainTargetStation').value,$('mmiTrainTargetSlot').value).map(t=>[t.uid,t.number]),$('mmiTrainTargetEntry').value);
 const op=$('mmiTrainOp').value,entry=source.find(t=>t.uid===$('mmiTrainEntry').value);
 $('mmiTrainEntry').disabled=op==='insert';$('mmiTrainDestination').hidden=!['move','swap'].includes(op);$('mmiTrainTargetEntryRow').hidden=op!=='swap';$('mmiTrainNumberRow').hidden=!['insert','rename'].includes(op);
 $('mmiTrainApply').disabled=op!=='insert'&&!entry;
 $('mmiTrainProperty').disabled=!entry;
 if(changed&&op==='rename'&&entry)fillNumber();
 $('mmiTrainSchedule').innerHTML=root.SimDiagram.getModel().trains.map(t=>`<option value="${esc(t.id)}"></option>`).join('');
 $('mmiTrainSummary').textContent=`${N.catalog[st].name} · ${source.length}개 번호 · LS 열번창과 같은 표시 상태`;
}
function fillNumber(){const t=rows(station(),$('mmiTrainSlot').value).find(t=>t.uid===$('mmiTrainEntry').value);if(t){$('mmiTrainNumber').value=t.number;$('mmiTrainDirection').value=t.direction;}}
function init(api){
 host=api;const stationOptions=N.stations.filter(s=>s.controlled).map(s=>`<option value="${s.id}">${esc(s.name)} [${s.code}]</option>`).join('');
 root.SimMMI.createWindow('trainNumber',{title:'[CA012_01] 열차번호제어',x:60,y:40,width:600,body:`<form id="mmiTrainForm" class="mmi-train-form"><label>작업구분<select id="mmiTrainOp"><option value="insert">삽입</option><option value="delete">삭제</option><option value="rename">수정</option><option value="move">이동</option><option value="swap">교환</option></select></label><label>제어역<select id="mmiTrainStation">${stationOptions}</select></label><label>열번창<select id="mmiTrainSlot"></select></label><label>등록된 번호<select id="mmiTrainEntry"></select></label><div id="mmiTrainNumberRow"><label>열차번호<input id="mmiTrainNumber" list="mmiTrainSchedule" maxlength="8" autocomplete="off"><datalist id="mmiTrainSchedule"></datalist></label><label>운행방향<select id="mmiTrainDirection"><option value="up">상행</option><option value="down">하행</option></select></label></div><fieldset id="mmiTrainDestination"><legend>이동·교환 목적지</legend><label>목적역<select id="mmiTrainTargetStation">${stationOptions}</select></label><label>목적 열번창<select id="mmiTrainTargetSlot"></select></label><label id="mmiTrainTargetEntryRow">교환할 번호<select id="mmiTrainTargetEntry"></select></label></fieldset><p id="mmiTrainSummary" role="status"></p><div class="mmi-train-buttons"><button type="submit" id="mmiTrainApply" class="sched-btn primary">확인</button><button type="button" id="mmiTrainProperty" class="sched-btn">열차 속성·그래프</button><button type="button" id="mmiTrainClose" class="sched-btn">닫기</button></div></form>`});
 $('mmiTrainTargetStation').value=station();
 $('mmiTrainStation').onchange=e=>host.selectStation(e.target.value);
 for(const id of ['mmiTrainTargetStation','mmiTrainTargetSlot'])$(id).onchange=refresh;
 $('mmiTrainOp').onchange=()=>{refresh();if($('mmiTrainOp').value==='rename')fillNumber();};
 $('mmiTrainSlot').onchange=()=>{refresh();fillNumber();};$('mmiTrainEntry').onchange=fillNumber;
 $('mmiTrainClose').onclick=()=>root.SimMMI.close('trainNumber');
 $('mmiTrainForm').onsubmit=e=>{e.preventDefault();const operation={op:$('mmiTrainOp').value,station:station(),slot:$('mmiTrainSlot').value,uid:$('mmiTrainEntry').value,number:$('mmiTrainNumber').value,direction:$('mmiTrainDirection').value,targetStation:$('mmiTrainTargetStation').value,targetSlot:$('mmiTrainTargetSlot').value,targetUid:$('mmiTrainTargetEntry').value};host.openAction('열차번호 '+$('mmiTrainOp').selectedOptions[0].textContent,`<p>${esc(N.catalog[operation.station].name)} · ${esc(operation.slot)} 열번창에 적용하시겠습니까?</p>`,{type:'lsOperation',operation,source:'MMI'});};
 $('mmiTrainProperty').onclick=()=>{const t=rows(station(),$('mmiTrainSlot').value).find(t=>t.uid===$('mmiTrainEntry').value);if(!t)return;const scheduled=root.SimDiagram.getModel().trains.find(x=>x.id===t.number);if(!scheduled){host.toast(t.number+' · 등록된 온라인 스케줄 없음');return;}root.SimDiagram.selectTrain(t.number);root.SimMMI.open('graph');};
 refresh();
}
root.SimMMITrains={init,refresh};
})(window);
