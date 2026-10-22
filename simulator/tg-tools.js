(function(root){
'use strict';
// T/G window chrome and functions after the real photos (menu names, 편집(E) shortcuts, tooltips of five icons) and the
// 실기1 textbook (5장 4절, p.130-151): 화면모드(툴팁보기·십자선보기·돋보기·영역확대), Dia 보기(확대/축소, 역축/시간축 설정,
// 열차정보보기옵션, 열차별 색상 및 선속성), 즐겨찾기(F9), 열차검색, 편집(복사·붙여넣기·생성·수정·노트). The icons whose functions were
// never seen stay disabled. Kilometre-post values are not in the sources, so the crosshair shows time and station only.
const doc=document,$=id=>doc.getElementById(id),D=()=>root.SimDiagram,T=()=>root.SimTimetable,N=()=>root.SimNetwork;
const SPANS=[10,15,30,60,120,180,360,720],ROWS=[12,16,20,26,32,44];
const KINDS=['전동열차','일반열차','회송열차','KTX'];
const FAV='orpheia.tg.favorite';
let copied=null,mode='tooltip',area=null,crossPt=null,graph=null,notes=null;
const status=text=>{$('tgStatus').textContent=text;};
const selectedTrain=()=>$('graphTrain').value;
const info=id=>root.SimMMI?.stationInfo(id)??{name:id,code:''};
const store={get(){try{return JSON.parse(localStorage.getItem(FAV)||'null');}catch{return null;}},set(v){try{localStorage.setItem(FAV,JSON.stringify(v));}catch{}}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// the icons in the order photographed (top to bottom)
const TOOLS=[
 {g:'📂',tip:'(기능명 미확인)'},
 {g:'⎘',tip:'열차복사(C)',run:'copy'},{g:'📋',tip:'붙여놓기(V)',run:'paste'},{g:'NEW',tip:'열차생성(A)',run:'create'},{g:'✎',tip:'열차정보수정(F5)',run:'edit'},
 {g:'📁',tip:'(기능명 미확인)'},{g:'UNDO',tip:'(기능명 미확인 · 구현하지 않음)'},{g:'DO',tip:'(기능명 미확인 · 구현하지 않음)'},{g:'☰',tip:'(기능명 미확인)'},
 {g:'📁✔',tip:'(기능명 미확인)'},{g:'📁🔍',tip:'(기능명 미확인)'},
 {g:'ZOOM◯',tip:'확대영역설정',run:'axisDialog'},{g:'▭',tip:'툴팁 보기',run:'m:tooltip'},{g:'┼',tip:'십자선보기',run:'m:cross'},
 {g:'ZOOM',tip:'영역 확대',run:'m:area'},{g:'🔍',tip:'돋보기',run:'m:magnify'},
 {g:'💾',tip:'(기능명 미확인)'},{g:'💾',tip:'(기능명 미확인)'}
];
const MENUS=[
 {label:'파일(F)',items:[{label:'열기(O)',run:'open'},{label:'인쇄(P)',run:'print'}]},
 {label:'편집(E)',items:[{label:'열차복사(C)',key:'Ctrl+C',run:'copy'},{label:'붙여놓기(V)',key:'Ctrl+V',run:'paste'},{label:'열차생성(A)',key:'Ctrl+A',run:'create'},{label:'열차정보수정(F5)',key:'F5',run:'edit'},{label:'노트편집(N)',key:'Ctrl+N',run:'note'}]},
 {label:'보기(V)',items:[{label:'현재시각으로(F9)',key:'F9',run:'jumpNow'},{label:'경합 표시 (교육용)',run:'t:conflicts',check:'conflicts',off:true},{label:'경합해소 실습 (교육용)',run:'drill'}]},
 {label:'Dia 보기(V)',items:[
  {label:'확대/축소',items:[{label:'시간축 확대',key:'+',run:'timeIn'},{label:'시간축 축소',key:'-',run:'timeOut'},{label:'역축 확대',key:'*',run:'stationIn'},{label:'역축 축소',key:'/',run:'stationOut'}]},
  {label:'다이얼로그',items:[{label:'역축/시간축 설정',run:'axisDialog'},{label:'열차정보보기옵션',run:'viewDialog'}]},
  {label:'보이기/감추기',items:[{label:'계획선',run:'t:plan',check:'plan'},{label:'열차번호',run:'t:numbers',check:'numbers'},{label:'현재위치',run:'t:position',check:'position'}]},
  {label:'열차별 색상 및 선속성',run:'styleDialog'}]},
 {label:'화면설정(D)',items:[
  {label:'화면모드설정',items:[{label:'툴팁보기',run:'m:tooltip',mode:'tooltip'},{label:'십자선보기',run:'m:cross',mode:'cross'},{label:'돋보기',run:'m:magnify',mode:'magnify'},{label:'영역확대',run:'m:area',mode:'area'}]},
  {label:'열차검색',run:'findDialog'}]},
 {label:'즐겨찾기',items:[{label:'즐겨찾기설정',run:'favSet'},{label:'즐겨찾기가기',run:'favGo'}]},
 {label:'도움말(H)'}
];

// ---------------------------------------------------------------- floating dialogs (small MMI windows)
const dialogs={};
function dialog(id,title,body,setup,width=380){
 if(!dialogs[id]){dialogs[id]=true;root.SimMMI.createWindow(id,{title,x:260,y:90,width,body});setup?.();}
 return root.SimMMI.open(id);
}
const closeDialog=id=>root.SimMMI.close(id);
const stationOpts=()=>N().stations.map(s=>`<option value="${s.id}">${esc(info(s.id).name)}</option>`).join('');
const ensureOption=(sel,value,text)=>{if(![...sel.options].some(o=>o.value===String(value))){const o=doc.createElement('option');o.value=value;o.textContent=text;const at=[...sel.options].find(x=>+x.value>+value);sel.insertBefore(o,at||null);}};
const fire=id=>$(id).dispatchEvent(new Event('change'));
const hhmm=sec=>{const v=((8*3600+Math.round(sec))%86400+86400)%86400;return `${String(Math.floor(v/3600)).padStart(2,'0')}:${String(Math.floor(v%3600/60)).padStart(2,'0')}`;};
const toSec=v=>+v.slice(0,2)*3600+ +v.slice(3,5)*60-8*3600;

// ---------------------------------------------------------------- actions
function step(list,current,dir){const i=list.findIndex(x=>x>=current);const at=i<0?list.length-1:i;const to=Math.max(0,Math.min(list.length-1,at+dir));return list[to];}
function applyMode(){
 for(const b of doc.querySelectorAll('.tg-tool[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
 for(const b of doc.querySelectorAll('[data-tg-mode]'))b.setAttribute('aria-checked',String(b.dataset.tgMode===mode));
 $('diaSvg').classList.toggle('tg-selecting',mode==='area');
 D().setOption('tooltips',mode==='tooltip');
 clearOverlays();
}
function setMode(m){mode=mode===m?'':m;crossPt=null;applyMode();status(mode?`${{tooltip:'툴팁보기',cross:'십자선보기',magnify:'돋보기',area:'영역확대'}[mode]} · ${{tooltip:'열차를 선택하면 기본정보가 표시됩니다.',cross:'그래프를 클릭하면 시간과 위치가 표시됩니다.',magnify:'확대할 곳을 클릭하세요.',area:'확대할 영역을 끌어서 지정하세요.'}[mode]}`:'화면모드 해제');}
const ACTIONS={
 open(){root.SimMMI.alertBox('스케줄 열기는 구현하지 않았습니다. 현재는 오늘 운행일의 온라인 스케줄 1개만 다룹니다.');},
 print(){
  const f=doc.createElement('iframe');f.style.cssText='position:fixed;width:0;height:0;border:0';doc.body.appendChild(f);
  const d=f.contentDocument;d.open();d.write(`<!doctype html><meta charset="utf-8"><title>온라인 열차그래프</title><style>body{margin:0}svg{width:100%;height:auto}</style>${$('diaSvg').outerHTML}`);d.close();
  try{f.contentWindow.focus();f.contentWindow.print();}catch{}setTimeout(()=>f.remove(),1500);status('인쇄 대화상자를 열었습니다.');
 },
 copy(){if(!selectedTrain())return;copied=selectedTrain();status(`${copied} 열차를 복사했습니다. (붙여놓기를 해야 열차가 생성됩니다)`);},
 paste(){if(!copied){status('복사한 열차가 없습니다.');return;}root.SimScheduleUI.open('copy',copied);status(`${copied} 붙여넣기 · 열차스케줄 추가 창`);},
 create(){root.SimScheduleUI.open('create');$('schedulePatternOpen').click();status('열차생성 · 패턴을 선택하세요.');},
 edit(){if(notes?.selected()&&notes.edit()){status('선택한 노트를 수정합니다.');return;}root.SimScheduleUI.open('edit',selectedTrain());status(`${selectedTrain()} 열차정보수정`);},
 note(){notes?notes.open():status('노트편집을 사용할 수 없습니다.');},
 jumpNow(){const L=D().layout();$('graphStart').value=hhmm(Math.max(-8*3600,D().clock()-Number($('graphSpan').value)*60/6));fire('graphStart');status('현재 시각으로 이동했습니다.');},
 timeIn(){const v=step(SPANS,Number($('graphSpan').value),-1);ensureOption($('graphSpan'),v,`${v}분`);$('graphSpan').value=String(v);fire('graphSpan');status(`시간축 확대 · ${v}분`);},
 timeOut(){const v=step(SPANS,Number($('graphSpan').value),1);ensureOption($('graphSpan'),v,`${v}분`);$('graphSpan').value=String(v);fire('graphSpan');status(`시간축 축소 · ${v}분`);},
 stationIn(){const v=step(ROWS,Number($('graphRow').value),1);ensureOption($('graphRow'),v,String(v));$('graphRow').value=String(v);fire('graphRow');status(`역축 확대 · ${v}`);},
 stationOut(){const v=step(ROWS,Number($('graphRow').value),-1);ensureOption($('graphRow'),v,String(v));$('graphRow').value=String(v);fire('graphRow');status(`역축 축소 · ${v}`);},
 axisDialog(){dialog('tgAxis','역축/시간축 설정',`<div class="pat-dlg"><label><span>시작역</span><select id="axFrom">${stationOpts()}</select></label><label><span>마지막역</span><select id="axTo">${stationOpts()}</select></label><label><span>시작시간</span><input type="time" id="axStart"></label><label><span>종착시간</span><input type="time" id="axEnd"></label><div><button type="button" class="sched-btn primary" id="axApply">적용</button> <button type="button" class="sched-btn" id="axClose">닫기</button></div></div>`,()=>{
   $('axClose').onclick=()=>closeDialog('tgAxis');
   $('axApply').onclick=()=>{
    const from=N().catalog[$('axFrom').value].order,to=N().catalog[$('axTo').value].order;
    if(from>=to){root.SimMMI.alertBox('시작역은 마지막역보다 앞이어야 합니다.');return;}
    if(!$('axStart').value||!$('axEnd').value){root.SimMMI.alertBox('시작시간과 종착시간을 입력하세요.');return;}
    let span=(toSec($('axEnd').value)-toSec($('axStart').value))/60;if(span<=0)span+=1440;
    span=Math.min(Math.max(Math.round(span),5),1440);
    $('graphFrom').value=$('axFrom').value;$('graphTo').value=$('axTo').value;$('graphStart').value=$('axStart').value;ensureOption($('graphSpan'),span,`${span}분`);$('graphSpan').value=String(span);
    fire('graphFrom');status(`역축/시간축 설정 · ${info($('axFrom').value).name}~${info($('axTo').value).name} · ${$('axStart').value}부터 ${span}분`);closeDialog('tgAxis');
   };
  });
  $('axFrom').value=$('graphFrom').value;$('axTo').value=$('graphTo').value;$('axStart').value=$('graphStart').value;$('axEnd').value=hhmm(toSec($('graphStart').value)+Number($('graphSpan').value)*60);},
 viewDialog(){dialog('tgView','열차정보보기옵션',`<div class="pat-dlg"><div><b>스케줄선택</b> <label><input type="checkbox" id="vwPlan"> 최초 계획선 표시</label></div><div><b>부대표시선택</b> <label><input type="checkbox" id="vwNumbers"> 열차번호</label> <label><input type="checkbox" id="vwPosition"> 현재위치</label></div>
<div><b>열차방향선택</b> <select id="vwDir"><option value="all">전체</option><option value="up">상행</option><option value="down">하행</option></select></div><div><b>열차종류선택</b> ${KINDS.map((k,i)=>`<label><input type="checkbox" name="vwKind" value="${k}">${k}</label>`).join(' ')}</div>
<div class="idm-note">요일별 표시는 요일별 시각표가 없어 제공하지 않습니다.</div><div><button type="button" class="sched-btn primary" id="vwApply">적용</button> <button type="button" class="sched-btn" id="vwClose">닫기</button></div></div>`,()=>{
   $('vwClose').onclick=()=>closeDialog('tgView');
   $('vwApply').onclick=()=>{
    const kinds=new Set([...doc.querySelectorAll('input[name="vwKind"]:checked')].map(i=>i.value));
    $('graphDirection').value=$('vwDir').value;
    D().setOptions({plan:$('vwPlan').checked,numbers:$('vwNumbers').checked,position:$('vwPosition').checked,kinds:kinds.size===KINDS.length?null:kinds});
    status(kinds.size?'열차정보보기 옵션을 적용했습니다.':'표시할 열차종류가 없습니다.');closeDialog('tgView');
   };
  },420);
  $('vwPlan').checked=D().getOption('plan');$('vwNumbers').checked=D().getOption('numbers');$('vwPosition').checked=D().getOption('position');$('vwDir').value=$('graphDirection').value;
  const kinds=D().getOption('kinds');for(const i of doc.querySelectorAll('input[name="vwKind"]'))i.checked=!kinds||kinds.has(i.value);},
 styleDialog(){dialog('tgStyle','열차별 색상 및 선속성',`<div class="pat-dlg">${KINDS.map(k=>`<label><span>${k}</span><input type="color" data-sty-color="${k}" value="#1b2a78"><select data-sty-dash="${k}"><option value="dotted">점선</option><option value="solid">실선</option><option value="dashed">파선</option></select></label>`).join('')}<div><button type="button" class="sched-btn primary" id="stOk">확인</button> <button type="button" class="sched-btn" id="stReset">초기값</button> <button type="button" class="sched-btn" id="stClose">닫기</button></div></div>`,()=>{
   const read=()=>Object.fromEntries(KINDS.map(k=>[k,{color:doc.querySelector(`[data-sty-color="${k}"]`).value,dash:doc.querySelector(`[data-sty-dash="${k}"]`).value}]));
   $('stOk').onclick=()=>{D().setOption('styles',read());status('열차별 색상 및 선속성을 적용했습니다.');};
   $('stReset').onclick=()=>{for(const k of KINDS){doc.querySelector(`[data-sty-color="${k}"]`).value='#1b2a78';doc.querySelector(`[data-sty-dash="${k}"]`).value='dotted';}D().setOption('styles',{});status('열차별 색상 및 선속성을 초기값으로 되돌렸습니다.');};
   $('stClose').onclick=()=>closeDialog('tgStyle');
  });},
 findDialog(){dialog('tgFind','열차검색',`<div class="pat-dlg"><label><span>열차번호</span><input id="fdNumber" list="fdList" maxlength="6" autocomplete="off"><datalist id="fdList"></datalist></label><div><button type="button" class="sched-btn primary" id="fdGo">검색</button> <button type="button" class="sched-btn" id="fdClose">닫기</button></div></div>`,()=>{
   $('fdClose').onclick=()=>closeDialog('tgFind');
   $('fdGo').onclick=()=>{
    const id=$('fdNumber').value.trim().toUpperCase(),t=D().getModel().trains.find(x=>x.id===id);
    if(!t){root.SimMMI.alertBox(`${id||'열차번호'} 열차를 찾을 수 없습니다.`);return;}
    $('graphDirection').value='all';$('graphFrom').value=N().stations[0].id;$('graphTo').value=N().stations.at(-1).id;
    $('graphStart').value=hhmm(Math.max(-8*3600,t.calls[0].arrival-300));D().selectTrain(id);fire('graphStart');status(`${id} 열차로 이동했습니다.`);closeDialog('tgFind');
   };
  });$('fdList').innerHTML=D().getModel().trains.map(t=>`<option value="${esc(t.id)}">`).join('');},
 favSet(){store.set({from:$('graphFrom').value,to:$('graphTo').value,start:$('graphStart').value,span:$('graphSpan').value,row:$('graphRow').value});status('즐겨찾기를 설정했습니다. 다음 실행 때도 이 화면으로 열립니다.');},
 favGo(){const f=store.get();if(!f){status('저장된 즐겨찾기가 없습니다.');return;}applyFav(f);status('즐겨찾기로 이동했습니다.');},
 drill(){root.SimMMI.open('conflictDrill');},'t:conflicts'(b){toggle('conflicts',b);},'t:plan'(b){toggle('plan',b);},'t:numbers'(b){toggle('numbers',b);},'t:position'(b){toggle('position',b);}
};
function toggle(key,btn){const on=!D().getOption(key);D().setOption(key,on);btn?.setAttribute('aria-checked',String(on));}
function applyFav(f){$('graphFrom').value=f.from;$('graphTo').value=f.to;$('graphStart').value=f.start;ensureOption($('graphSpan'),f.span,`${f.span}분`);$('graphSpan').value=f.span;ensureOption($('graphRow'),f.row,f.row);$('graphRow').value=f.row;fire('graphFrom');}
function run(name,btn){if(name.startsWith('m:'))return setMode(name.slice(2));return ACTIONS[name]?.(btn);}

// ---------------------------------------------------------------- plot interaction
function toData(e){
 const svg=$('diaSvg'),L=D().layout();if(!L)return null;
 const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse());
 if(p.x<L.left||p.x>L.left+L.plotW||p.y<L.plotTop||p.y>L.plotTop+L.plotH)return null;
 return {x:p.x,y:p.y,t:L.start+(p.x-L.left)/L.plotW*L.span,o:L.from+(p.y-L.top)/L.row};
}
const stationAt=o=>{const names=N().stations;return names[Math.max(0,Math.min(names.length-1,Math.round(o)))];};
function clearOverlays(){$('diaCross')?.remove();doc.querySelector('.tg-lens')?.remove();doc.querySelector('.tg-info')?.remove();}
function drawOverlay(){
 const svg=$('diaSvg'),L=D().layout();svg.querySelector('#diaCross')?.remove();if(!L)return;
 let g='';
 if(mode==='cross'&&crossPt)g+=`<line x1="${L.left}" y1="${crossPt.y}" x2="${L.left+L.plotW}" y2="${crossPt.y}" stroke="#d6251f" stroke-dasharray="4 3"/><line x1="${crossPt.x}" y1="${L.plotTop}" x2="${crossPt.x}" y2="${L.plotTop+L.plotH}" stroke="#d6251f" stroke-dasharray="4 3"/>`;
 if(area){const x1=L.left+(Math.min(area.t1,area.t2)-L.start)/L.span*L.plotW,x2=L.left+(Math.max(area.t1,area.t2)-L.start)/L.span*L.plotW,y1=L.top+(Math.min(area.o1,area.o2)-L.from)*L.row,y2=L.top+(Math.max(area.o1,area.o2)-L.from)*L.row;g+=`<rect x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" fill="rgba(49,106,197,.18)" stroke="#316ac5" stroke-dasharray="4 3"/>`;}
 if(g)svg.insertAdjacentHTML('beforeend',`<g id="diaCross" pointer-events="none">${g}</g>`);
}
function zoomArea(){
 if(!area){status('먼저 영역을 끌어서 지정하세요.');return;}
 const [t1,t2]=[area.t1,area.t2].sort((a,b)=>a-b),[o1,o2]=[area.o1,area.o2].sort((a,b)=>a-b),need=Math.max(5,Math.ceil((t2-t1)/60));
 $('graphStart').value=hhmm(Math.floor(t1/60)*60);ensureOption($('graphSpan'),need,`${need}분`);$('graphSpan').value=String(need);
 const from=Math.max(0,Math.floor(o1)),to=Math.min(N().stations.length-1,Math.ceil(o2));
 if(to>from){$('graphFrom').value=N().stations[from].id;$('graphTo').value=N().stations[to].id;}
 area=null;fire('graphFrom');status('영역을 확대했습니다.');
}
function showInfo(train,e){
 doc.querySelector('.tg-info')?.remove();
 const t=D().getModel().trains.find(x=>x.id===train);if(!t)return;
 const box=doc.createElement('div');box.className='tg-info';
 box.innerHTML=`<b>${esc(t.id)}</b> · ${esc(t.kind)} · ${t.direction==='down'?'하행':'상행'}${t.cancelled?' · 운휴':''}<br>시발 ${esc(info(t.calls[0].station).name)} ${T().clock(t.calls[0].departure)}<br>종착 ${esc(info(t.calls.at(-1).station).name)} ${T().clock(t.calls.at(-1).arrival)}<br>연계열번 ${esc(t.relatedTrain||'—')}`;
 const host=doc.querySelector('.tg-body'),r=host.getBoundingClientRect();box.style.left=Math.min(e.clientX-r.left+12,r.width-230)+'px';box.style.top=(e.clientY-r.top+12)+'px';host.appendChild(box);
}
function showLens(d,e){
 doc.querySelector('.tg-lens')?.remove();
 const svg=$('diaSvg'),host=doc.querySelector('.tg-body'),r=host.getBoundingClientRect(),w=150,h=100;
 const lens=doc.createElement('div');lens.className='tg-lens';
 lens.innerHTML=`<svg viewBox="${d.x-w/2} ${d.y-h/2} ${w} ${h}" width="300" height="200" aria-hidden="true">${svg.innerHTML}</svg>`;
 lens.firstChild.querySelector('#diaCross')?.remove();
 lens.style.left=Math.max(0,Math.min(e.clientX-r.left+14,r.width-304))+'px';lens.style.top=Math.max(0,e.clientY-r.top+14)+'px';host.appendChild(lens);
}
function bindPlot(){
 const svg=$('diaSvg');let drag=null;
 svg.addEventListener('pointerdown',e=>{
  const d=toData(e);
  if(mode==='area'&&d){drag={t:d.t,o:d.o};area={t1:d.t,o1:d.o,t2:d.t,o2:d.o};svg.setPointerCapture(e.pointerId);e.preventDefault();}
 });
 svg.addEventListener('pointermove',e=>{if(drag){const d=toData(e);if(d){area={t1:drag.t,o1:drag.o,t2:d.t,o2:d.o};drawOverlay();}}});
 svg.addEventListener('pointerup',()=>{if(drag){drag=null;if(area&&Math.abs(area.t1-area.t2)<30&&Math.abs(area.o1-area.o2)<.3)area=null;if(area)zoomArea();else status('영역을 지정하지 못했습니다.');drawOverlay();}});
 svg.addEventListener('click',e=>{
  const d=toData(e);
  if(mode==='cross'&&d){crossPt=d;status(`${T().clock(d.t)} · ${info(stationAt(d.o).id).name}`);drawOverlay();}
  else if(mode==='magnify'&&d)showLens(d,e);
  else if(mode==='tooltip'){const tr=e.target.closest('[data-dia-train]');if(tr)showInfo(tr.dataset.diaTrain,e);else doc.querySelector('.tg-info')?.remove();}
 });
 new MutationObserver(()=>{if(!svg.querySelector('#diaCross')&&(area||crossPt))drawOverlay();}).observe(svg,{childList:true});
}

// ---------------------------------------------------------------- menu + toolbar
function menuHtml(items){return `<ul class="tg-list">${items.map(it=>it.items?`<li class="tg-has-sub"><button type="button" aria-haspopup="true"><span>${it.label}</span><i>▸</i></button>${menuHtml(it.items)}</li>`:`<li><button type="button" data-tg-run="${it.run}" ${it.mode?`data-tg-mode="${it.mode}" role="menuitemcheckbox" aria-checked="${mode===it.mode}"`:''} ${it.check?`data-tg-check="${it.check}" role="menuitemcheckbox" aria-checked="${it.off?'false':'true'}"`:''}><span>${it.label}</span>${it.key?`<kbd>${it.key}</kbd>`:''}</button></li>`).join('')}</ul>`;}
function init(panel){
 graph=panel;
 for(const v of SPANS)ensureOption($('graphSpan'),v,`${v}분`);
 for(const v of ROWS)ensureOption($('graphRow'),v,String(v));
 const bar=doc.createElement('div');bar.className='tg-menubar';
 bar.innerHTML=MENUS.map(m=>`<div class="tg-top"><button type="button" class="tg-menu" ${m.items?'':'title="원본 메뉴 항목을 아직 확인하지 못했습니다"'}>${m.label}</button>${m.items?menuHtml(m.items):''}</div>`).join('');
 graph.insertBefore(bar,graph.firstChild);
 const closeAll=()=>bar.querySelectorAll('.open').forEach(e=>e.classList.remove('open'));
 bar.addEventListener('click',e=>{
  const item=e.target.closest('[data-tg-run]');if(item){closeAll();run(item.dataset.tgRun,item);return;}
  const sub=e.target.closest('.tg-has-sub>button');if(sub){const li=sub.parentElement,was=li.classList.contains('open');li.parentElement.querySelectorAll(':scope>.open').forEach(x=>x.classList.remove('open'));if(!was)li.classList.add('open');return;}
  const top=e.target.closest('.tg-top');if(!top)return;const was=top.classList.contains('open');closeAll();
  if(top.querySelector('.tg-list')){if(!was)top.classList.add('open');}else status('이 메뉴의 원본 항목은 아직 확인하지 못했습니다.');
 });
 doc.addEventListener('pointerdown',e=>{if(!e.target.closest('.tg-menubar'))closeAll();});
 const scroll=graph.querySelector('.graph-scroll'),body=doc.createElement('div');body.className='tg-body';
 const tools=doc.createElement('div');tools.className='tg-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','T/G 도구');
 tools.innerHTML=TOOLS.map((t,i)=>{const m=t.run?.startsWith('m:')?t.run.slice(2):'';return `<button type="button" class="tg-tool" data-i="${i}" ${m?`data-mode="${m}" aria-pressed="${mode===m}"`:''} title="${t.tip}" aria-label="${t.tip}" ${t.run?'':'disabled'}><span>${t.g}</span></button>`;}).join('');
 tools.addEventListener('click',e=>{const b=e.target.closest('.tg-tool');if(!b||b.disabled)return;run(TOOLS[b.dataset.i].run,b);});
 scroll.parentNode.insertBefore(body,scroll);body.append(tools,scroll);
 const bottom=doc.createElement('div');bottom.id='tgStatus';bottom.className='tg-status';bottom.textContent='준비';bottom.setAttribute('role','status');
 body.after(bottom);
 graph.addEventListener('keydown',e=>{
  if(e.target.closest('input,select,textarea'))return;
  const k=e.key,lk=k.toLowerCase();
  const map=e.ctrlKey?{c:'copy',v:'paste',a:'create',n:'note',r:'edit'}:{F5:'edit',F9:'jumpNow','+':'timeIn','=':'timeIn','-':'timeOut','/':'stationOut','*':'stationIn'};
  const name=map[e.ctrlKey?lk:k];if(name){e.preventDefault();ACTIONS[name]();}
 });
 graph.tabIndex=-1;
 bindPlot();
 const fav=store.get();if(fav)applyFav(fav);
 applyMode();
}
root.SimTG={init,actions:ACTIONS,setNotes:n=>{notes=n;}};
})(window);
