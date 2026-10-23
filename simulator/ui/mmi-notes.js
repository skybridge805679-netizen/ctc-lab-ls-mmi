(function(root){
'use strict';
// 노트관리 ([시스템 관리] > [노트관리]) and the T/G 노트편집, after the 실기1 textbook (4장 8절 p.92-96, 5장 p.149-151).
// A note has 노트종류, 대상명, 제목, 내용(추가기록), 글자크기, 표시기간, 표시구간, 리마인더 and an optional automatic 일지 copy.
// Notes are drawn on the T/G as message boxes; a 리마인더 note pops up when its time/section comes into view.
const doc=SimDOM.document,$=id=>doc.getElementById(id),N=root.SimNetwork,T=root.SimTimetable;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KINDS=['시설물','열차번호','이벤트','시스템'];
const mmi=()=>root.SimMMI,D=()=>root.SimDiagram;
const notes=[],journals=[];let seq=0,selected='',editing=null,appendTo=null,managerSelected='';
const was={};
const stamp=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replaceAll('-','/');
const name=id=>mmi().stationInfo(id).name;
const hhmm=sec=>{const v=((8*3600+Math.round(sec))%86400+86400)%86400;return `${String(Math.floor(v/3600)).padStart(2,'0')}:${String(Math.floor(v%3600/60)).padStart(2,'0')}`;};
const toSec=v=>v?+v.slice(0,2)*3600+ +v.slice(3,5)*60-8*3600:null;
const textOf=n=>n.entries.map(e=>`[${e.time}] ${e.text}`).join('\n');

function publish(){
 D().setNotes(notes.map(n=>({id:n.id,title:n.title,text:n.entries.map(e=>e.text).join('\n'),fontSize:n.fontSize,fromSec:n.fromSec,toSec:n.toSec,fromOrder:n.fromStation?N.catalog[n.fromStation].order:null,toOrder:n.toStation?N.catalog[n.toStation].order:null})),selected);
}
function journal(n,text){if(n.journal)journals.push({date:stamp().slice(0,10),operator:n.author,text:`[노트 ${n.id}] ${n.title}: ${text}`});}

// ---------------------------------------------------------------- 노트관리 window
function rows(){
 const date=$('ntDate').value.replaceAll('-','/'),kind=$('ntKind').value,target=$('ntTarget').value.trim().toUpperCase(),op=$('ntOperator').value.trim();
 return notes.filter(n=>(!date||n.created.startsWith(date))&&(!kind||n.kind===kind)&&(!target||n.target.toUpperCase().includes(target))&&(!op||n.author.includes(op)));
}
function draw(){
 const list=rows();
 $('ntRows').innerHTML=list.length?list.map(n=>`<tr data-id="${n.id}" class="${n.id===managerSelected?'sel':''}"><td>${n.id}</td><td>${n.created}</td><td>${n.kind}</td><td>${esc(n.target)}</td><td>${esc(n.title)}</td><td>${esc(n.author)}</td></tr>`).join(''):'<tr class="empty"><td colspan="6">조회된 노트가 없습니다</td></tr>';
 const n=notes.find(x=>x.id===managerSelected);$('ntContent').value=n?textOf(n):'';
 $('ntCount').textContent=`총 ${list.length}건`;
 for(const id of ['ntAppend','ntEdit','ntDelete'])$(id).disabled=!n;
}
function initManager(){
 const win=mmi().createWindow('noteManage',{title:'노트관리',x:100,y:60,width:760,body:`<div class="rpt"><fieldset class="rpt-cond"><legend>검색조건</legend><label>생성일자<input type="date" id="ntDate"></label><label>노트종류<select id="ntKind"><option value="">전체</option>${KINDS.map(k=>`<option>${k}</option>`).join('')}</select></label><label>대상명<input id="ntTarget" placeholder="예: SG_1A, K1131"></label><label>운영자ID<input id="ntOperator" placeholder="전체"></label><button type="button" class="sched-btn primary" id="ntSearch">조회</button></fieldset>
<div class="idm-table rpt-table"><table><thead><tr><th>번호</th><th>생성일시</th><th>종류</th><th>대상명</th><th>제목</th><th>작성자</th></tr></thead><tbody id="ntRows"></tbody></table></div>
<label class="nt-content">노트내용<textarea id="ntContent" readonly rows="5"></textarea></label>
<div class="idm-note">교육용 구성 — 검색조건과 입력 항목은 교재(실기1)를 따르며 화면 배치는 원본을 확인하지 못했습니다. <span id="ntCount"></span></div>
<div class="idm-buttons"><button type="button" class="sched-btn primary" id="ntNew">새노트작성</button><button type="button" class="sched-btn" id="ntAppend">노트추가기록</button><button type="button" class="sched-btn" id="ntEdit">노트수정</button><button type="button" class="sched-btn" id="ntDelete">노트삭제</button><button type="button" class="sched-btn" id="ntClose">닫기</button></div></div>`});
 $('ntSearch').onclick=draw;
 $('ntRows').onclick=e=>{const r=e.target.closest('tr[data-id]');if(!r)return;managerSelected=r.dataset.id;draw();};
 $('ntNew').onclick=()=>editor(null);
 $('ntEdit').onclick=()=>editor(notes.find(n=>n.id===managerSelected));
 $('ntAppend').onclick=()=>appendDialog(notes.find(n=>n.id===managerSelected));
 $('ntDelete').onclick=()=>{const n=notes.find(x=>x.id===managerSelected);if(!n)return;mmi().confirmBox(`노트 ${n.id} (${n.title})를 삭제하시겠습니까?`,()=>remove(n.id),{title:'노트 삭제'});};
 $('ntClose').onclick=()=>mmi().close('noteManage');
 win.opener=draw;
}

// ---------------------------------------------------------------- editor (새노트작성 / 노트수정)
function stationOpts(){return '<option value="">구간 지정 안 함</option>'+N.stations.map(s=>`<option value="${s.id}">${esc(name(s.id))}</option>`).join('');}
function initEditor(){
 mmi().createWindow('noteEdit',{title:'새노트',x:220,y:100,width:460,body:`<div class="pat-dlg nt-edit"><label><span>노트종류</span><select id="neKind">${KINDS.map(k=>`<option>${k}</option>`).join('')}</select></label>
<label><span>대상명</span><input id="neTarget" maxlength="24" placeholder="예: SG_1A / K1131"></label><label><span>제목</span><input id="neTitle" maxlength="40"></label>
<label class="nt-body"><span>내용</span><textarea id="neBody" rows="4" maxlength="400"></textarea></label>
<label><span>글자크기</span><select id="neFont"><option>10</option><option selected>11</option><option>13</option><option>15</option></select></label>
<label><span>표시기간</span><input type="time" id="neFrom"> ~ <input type="time" id="neTo"></label>
<label><span>표시구간</span><select id="neStFrom">${stationOpts()}</select> ~ <select id="neStTo">${stationOpts()}</select></label>
<label class="nt-check"><input type="checkbox" id="neReminder"> 리마인더 (표시기간·구간이 T/G에 보이면 자동으로 알림)</label>
<label class="nt-check"><input type="checkbox" id="neJournal"> 자동 일지 생성 (내용을 내 당일 일지로 저장)</label>
<div><button type="button" class="sched-btn primary" id="neOk">확인</button> <button type="button" class="sched-btn" id="neCancel">취소</button></div></div>`});
 $('neCancel').onclick=()=>mmi().close('noteEdit');
 $('neOk').onclick=save;
}
function editor(n,defaults={}){
 editing=n||null;
 const w=mmi().open('noteEdit');w.el.querySelector('.mmi-title-text').textContent=n?`노트수정 ${n.id}`:'새노트';
 $('neKind').value=n?.kind||defaults.kind||'시설물';$('neTarget').value=n?.target??defaults.target??'';$('neTitle').value=n?.title??'';
 $('neBody').value=n?n.entries[0].text:'';$('neBody').disabled=!!n&&n.entries.length>1;$('neBody').title=n&&n.entries.length>1?'추가기록이 있는 노트의 내용은 [노트추가기록]으로 이어 씁니다':'';
 $('neFont').value=String(n?.fontSize??11);$('neFrom').value=n?.fromSec==null?'':hhmm(n.fromSec);$('neTo').value=n?.toSec==null?'':hhmm(n.toSec);
 $('neStFrom').value=n?.fromStation||'';$('neStTo').value=n?.toStation||'';$('neReminder').checked=!!n?.reminder;$('neJournal').checked=!!n?.journal;
}
function save(){
 const kind=$('neKind').value,target=$('neTarget').value.trim(),title=$('neTitle').value.trim(),body=$('neBody').value.trim();
 if(!title){mmi().alertBox('노트 제목을 입력하세요.');return;}
 if(!body){mmi().alertBox('노트 내용을 입력하세요.');return;}
 if(kind==='열차번호'&&!D().getModel().trains.some(t=>t.id===target.toUpperCase())){mmi().alertBox(`${target||'열차번호'} 열차를 찾을 수 없습니다.`);return;}
 const fromSec=toSec($('neFrom').value),toSecV=toSec($('neTo').value),a=$('neStFrom').value,b=$('neStTo').value;
 if((fromSec===null)!==(toSecV===null)){mmi().alertBox('표시기간은 시작과 끝을 모두 입력하세요.');return;}
 if(fromSec!==null&&fromSec>=toSecV){mmi().alertBox('표시기간의 끝은 시작보다 뒤여야 합니다.');return;}
 if(!!a!==!!b){mmi().alertBox('표시구간은 시작역과 마지막역을 모두 지정하세요.');return;}
 if(a&&N.catalog[a].order>N.catalog[b].order){mmi().alertBox('표시구간의 시작역은 마지막역보다 앞이어야 합니다.');return;}
 const fields={kind,target:kind==='열차번호'?target.toUpperCase():target,title,fontSize:Number($('neFont').value),fromSec,toSec:toSecV,fromStation:a,toStation:b,reminder:$('neReminder').checked,journal:$('neJournal').checked};
 if(editing){Object.assign(editing,fields);if(editing.entries.length===1)editing.entries[0].text=body;delete was[editing.id];mmi().log('event',`노트 ${editing.id} 수정`);journal(editing,'수정');}
 else{const n={id:'N'+String(++seq).padStart(4,'0'),created:stamp(),author:'관제사',entries:[{time:stamp(),text:body}],...fields};notes.unshift(n);managerSelected=n.id;mmi().log('event',`노트 ${n.id} 생성 · ${title}`);journal(n,body);}
 mmi().close('noteEdit');publish();if($('ntRows'))draw();
}
function remove(id){const i=notes.findIndex(n=>n.id===id);if(i<0)return;notes.splice(i,1);delete was[id];if(selected===id)selected='';if(managerSelected===id)managerSelected='';mmi().log('event',`노트 ${id} 삭제`);publish();draw();}

// ---------------------------------------------------------------- 노트추가기록
function initAppend(){
 mmi().createWindow('noteAppend',{title:'노트추가기록',x:260,y:120,width:420,body:`<div class="pat-dlg"><div id="naTitle"></div><label class="nt-body"><span>추가할 내용</span><textarea id="naText" rows="4" maxlength="400"></textarea></label><div><button type="button" class="sched-btn primary" id="naOk">확인</button> <button type="button" class="sched-btn" id="naCancel">취소</button></div></div>`});
 $('naCancel').onclick=()=>mmi().close('noteAppend');
 $('naOk').onclick=()=>{const text=$('naText').value.trim();if(!text){mmi().alertBox('추가할 내용을 입력하세요.');return;}appendTo.entries.push({time:stamp(),text});delete was[appendTo.id];journal(appendTo,text);mmi().log('event',`노트 ${appendTo.id} 추가기록`);mmi().close('noteAppend');publish();draw();};
}
function appendDialog(n){if(!n)return;appendTo=n;mmi().open('noteAppend');$('naTitle').textContent=`${n.id} · ${n.title}`;$('naText').value='';}

// ---------------------------------------------------------------- T/G: reminder pop-up + selecting a drawn note
function overlaps(n,L){
 const t1=n.fromSec===null?-Infinity:n.fromSec,t2=n.toSec===null?Infinity:n.toSec;
 const o1=n.fromStation?N.catalog[n.fromStation].order:-Infinity,o2=n.toStation?N.catalog[n.toStation].order:Infinity;
 return t1<=L.start+L.span&&t2>=L.start&&o1<=L.to&&o2>=L.from;
}
function onRender(L){
 for(const n of notes){
  if(!n.reminder||(n.fromSec===null&&!n.fromStation))continue;
  const now=overlaps(n,L);
  if(now&&!was[n.id])mmi().alertBox(`${n.title}\n${n.entries.map(e=>e.text).join('\n')}`,null,{title:`노트 리마인더 · ${n.id}`});
  was[n.id]=now;
 }
}
function init(){
 initManager();initEditor();initAppend();
 D().onRender(onRender);
 $('diaSvg').addEventListener('click',e=>{const g=e.target.closest('[data-dia-note]');selected=g?g.dataset.diaNote:'';publish();});
 root.SimTG?.setNotes({open:()=>mmi().open('noteManage'),selected:()=>selected,edit:()=>{const n=notes.find(x=>x.id===selected);if(n)editor(n);return !!n;},create:defaults=>editor(null,defaults)});
}
root.SimNotes={init,export:()=>structuredClone({notes,journals}),journals:()=>structuredClone(journals),list:()=>structuredClone(notes)};
})(window);
