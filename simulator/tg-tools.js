(function(root){
'use strict';
// Chrome of the real T/G window (photos 2026-10-21/22): menu bar, the vertical icon toolbar, a status bar ("준비").
// Confirmed from the photos: the 편집(E) menu entries with their shortcuts and the tooltips 확대영역설정 / 툴팁 보기 / 십자선보기 /
// 영역 확대 / 돋보기. The other icons are drawn in the photographed order but their functions were never seen, so they are
// disabled. The behaviour behind the confirmed ones (area zoom, crosshair, …) is the simulator's own interpretation.
const doc=document,$=id=>doc.getElementById(id),D=()=>root.SimDiagram,T=()=>root.SimTimetable,N=()=>root.SimNetwork;
const SPANS=[30,60,120,360];
let copied=null,area=null,areaMode=false,cross=false,graph=null;
const status=text=>{$('tgStatus').textContent=text;};
const selectedTrain=()=>$('graphTrain').value;

// the icons in the order photographed (top to bottom); `known` ones are wired, the rest keep an honest "unknown" tooltip
const TOOLS=[
 {g:'📂',tip:'(기능명 미확인)'},
 {g:'⎘',tip:'열차복사(C)',run:'copy'},{g:'📋',tip:'붙여놓기(V)',run:'paste'},{g:'NEW',tip:'열차생성(A)',run:'create'},{g:'✎',tip:'열차정보수정(F5)',run:'edit'},
 {g:'📁',tip:'(기능명 미확인)'},{g:'UNDO',tip:'(기능명 미확인 · 구현하지 않음)'},{g:'DO',tip:'(기능명 미확인 · 구현하지 않음)'},{g:'☰',tip:'(기능명 미확인)'},
 {g:'📁✔',tip:'(기능명 미확인)'},{g:'📁🔍',tip:'(기능명 미확인)'},
 {g:'ZOOM◯',tip:'확대영역설정',run:'areaMode',cls:'area'},{g:'▭',tip:'툴팁 보기',run:'tooltips',cls:'tips'},{g:'┼',tip:'십자선보기',run:'cross',cls:'cross'},
 {g:'ZOOM',tip:'영역 확대',run:'zoomArea'},{g:'🔍',tip:'돋보기',run:'magnify'},
 {g:'💾',tip:'(기능명 미확인)'},{g:'💾',tip:'(기능명 미확인)'}
];
const MENUS=[
 {label:'파일(F)'},
 {label:'편집(E)',items:[{label:'열차복사(C)',key:'Ctrl+C',run:'copy'},{label:'붙여놓기(V)',key:'Ctrl+V',run:'paste'},{label:'열차생성(A)',key:'Ctrl+A',run:'create'},{label:'열차정보수정(F5)',key:'F5',run:'edit'},{label:'노트편집(N)',key:'Ctrl+N',run:'note'}]},
 {label:'보기(V)'},{label:'Dia 보기(V)'},{label:'화면설정(D)'},{label:'즐겨찾기'},{label:'도움말(H)'}
];

const ACTIONS={
 copy(){if(!selectedTrain())return;copied=selectedTrain();status(`${copied} 열차를 복사했습니다.`);},
 paste(){if(!copied){status('복사한 열차가 없습니다.');return;}root.SimScheduleUI.open('copy',copied);status(`${copied} 복사 스케줄 창을 열었습니다.`);},
 create(){root.SimScheduleUI.open('create');status('열차생성');},
 edit(){root.SimScheduleUI.open('edit',selectedTrain());status(`${selectedTrain()} 열차정보수정`);},
 note(){status('노트편집은 구현하지 않았습니다. 원본 화면을 확인하지 못했습니다.');},
 tooltips(btn){const on=!(D().getOption('tooltips'));D().setOption('tooltips',on);btn?.setAttribute('aria-pressed',String(on));status(`툴팁 보기 ${on?'켬':'끔'}`);},
 cross(btn){cross=!cross;btn?.setAttribute('aria-pressed',String(cross));if(!cross)doc.querySelector('#diaCross')?.remove();status(cross?'십자선보기 · 그래프 위에서 시각과 역을 확인하세요.':'십자선보기 끔');},
 areaMode(btn){areaMode=!areaMode;btn?.setAttribute('aria-pressed',String(areaMode));$('diaSvg').classList.toggle('tg-selecting',areaMode);status(areaMode?'확대영역설정 · 그래프에서 끌어서 영역을 지정한 뒤 영역 확대를 누르세요.':'확대영역설정 끔');},
 zoomArea(){
  if(!area){status('먼저 확대영역설정으로 영역을 지정하세요.');return;}
  const L=D().layout(),[t1,t2]=[area.t1,area.t2].sort((a,b)=>a-b),[o1,o2]=[area.o1,area.o2].sort((a,b)=>a-b);
  const startSec=Math.floor((t1+8*3600)/60)*60,h=Math.floor(startSec/3600)%24,m=Math.floor(startSec%3600/60),need=(t2-t1)/60;
  $('graphStart').value=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  $('graphSpan').value=String(SPANS.find(s=>s>=need)||360);
  const from=Math.max(0,Math.floor(o1)),to=Math.min(N().stations.length-1,Math.ceil(o2));
  if(to>from){$('graphFrom').value=N().stations[from].id;$('graphTo').value=N().stations[to].id;}
  area=null;for(const id of ['graphFrom','graphSpan'])$(id).dispatchEvent(new Event('change'));status('영역을 확대했습니다.');
 },
 magnify(){const i=SPANS.indexOf(Number($('graphSpan').value));if(i<=0){status('더 확대할 수 없습니다.');return;}$('graphSpan').value=String(SPANS[i-1]);$('graphSpan').dispatchEvent(new Event('change'));status(`돋보기 · 시간 범위 ${SPANS[i-1]}분`);}
};

// svg point -> data (time in seconds from 08:00, station order)
function toData(e){
 const svg=$('diaSvg'),L=D().layout();if(!L)return null;
 const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse());
 if(p.x<L.left||p.x>L.left+L.plotW||p.y<L.plotTop||p.y>L.plotTop+L.plotH)return null;
 return {x:p.x,y:p.y,t:L.start+(p.x-L.left)/L.plotW*L.span,o:L.from+(p.y-L.top)/L.row};
}
function drawOverlay(info){
 const svg=$('diaSvg'),L=D().layout();svg.querySelector('#diaCross')?.remove();if(!L)return;
 let g='';
 if(cross&&info)g+=`<line x1="${L.left}" y1="${info.y}" x2="${L.left+L.plotW}" y2="${info.y}" stroke="#d6251f" stroke-dasharray="4 3"/><line x1="${info.x}" y1="${L.plotTop}" x2="${info.x}" y2="${L.plotTop+L.plotH}" stroke="#d6251f" stroke-dasharray="4 3"/>`;
 if(area){const x1=L.left+(Math.min(area.t1,area.t2)-L.start)/L.span*L.plotW,x2=L.left+(Math.max(area.t1,area.t2)-L.start)/L.span*L.plotW,y1=L.top+(Math.min(area.o1,area.o2)-L.from)*L.row,y2=L.top+(Math.max(area.o1,area.o2)-L.from)*L.row;g+=`<rect x="${x1}" y="${y1}" width="${x2-x1}" height="${y2-y1}" fill="rgba(49,106,197,.18)" stroke="#316ac5" stroke-dasharray="4 3"/>`;}
 if(g)svg.insertAdjacentHTML('beforeend',`<g id="diaCross" pointer-events="none">${g}</g>`);
}
function bindPlot(){
 const svg=$('diaSvg');let drag=null;
 svg.addEventListener('pointermove',e=>{
  const d=toData(e);
  if(d&&cross){const names=N().stations,idx=Math.max(0,Math.min(names.length-1,Math.round(d.o)));status(`${T().clock(d.t)} · ${root.SimMMI?.stationInfo(names[idx].id).name??names[idx].id}`);}
  if(drag&&d){area={t1:drag.t,o1:drag.o,t2:d.t,o2:d.o};}
  drawOverlay(d);
 });
 svg.addEventListener('pointerdown',e=>{if(!areaMode)return;const d=toData(e);if(!d)return;drag={t:d.t,o:d.o};area={t1:d.t,o1:d.o,t2:d.t,o2:d.o};svg.setPointerCapture(e.pointerId);e.preventDefault();});
 svg.addEventListener('pointerup',()=>{if(drag){drag=null;if(area&&Math.abs(area.t1-area.t2)<30&&Math.abs(area.o1-area.o2)<.3)area=null;status(area?'영역을 지정했습니다. 영역 확대를 누르세요.':'확대영역설정');drawOverlay(null);}});
 // the plot is redrawn every second; keep a selected area/crosshair visible after a redraw
 new MutationObserver(()=>{if(!svg.querySelector('#diaCross')&&(area||cross))drawOverlay(null);}).observe(svg,{childList:true});
}

function init(panel){
 graph=panel;
 const bar=doc.createElement('div');bar.className='tg-menubar';
 bar.innerHTML=MENUS.map((m,i)=>`<div class="tg-top"><button type="button" class="tg-menu" ${m.items?'':'title="원본 메뉴 항목을 아직 확인하지 못했습니다"'}>${m.label}</button>${m.items?`<ul class="tg-list">${m.items.map(it=>`<li><button type="button" data-tg-run="${it.run}"><span>${it.label}</span><kbd>${it.key}</kbd></button></li>`).join('')}</ul>`:''}</div>`).join('');
 graph.insertBefore(bar,graph.firstChild);
 const closeAll=()=>bar.querySelectorAll('.tg-top.open').forEach(e=>e.classList.remove('open'));
 bar.addEventListener('click',e=>{
  const run=e.target.closest('[data-tg-run]');if(run){closeAll();ACTIONS[run.dataset.tgRun]?.();return;}
  const top=e.target.closest('.tg-top');if(!top)return;const was=top.classList.contains('open');closeAll();
  if(top.querySelector('.tg-list')){if(!was)top.classList.add('open');}else status('이 메뉴의 원본 항목은 아직 확인하지 못했습니다.');
 });
 doc.addEventListener('pointerdown',e=>{if(!e.target.closest('.tg-top'))closeAll();});
 // body: icon toolbar | plot
 const scroll=graph.querySelector('.graph-scroll'),body=doc.createElement('div');body.className='tg-body';
 const tools=doc.createElement('div');tools.className='tg-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','T/G 도구');
 tools.innerHTML=TOOLS.map((t,i)=>`<button type="button" class="tg-tool ${t.cls||''}" data-i="${i}" title="${t.tip}" aria-label="${t.tip}" ${t.run?`aria-pressed="${t.run==='tooltips'}"`:'disabled'}><span>${t.g}</span></button>`).join('');
 // plain action buttons are not toggles
 for(const b of tools.querySelectorAll('.tg-tool'))if(!['areaMode','tooltips','cross'].includes(TOOLS[b.dataset.i].run))b.removeAttribute('aria-pressed');
 tools.addEventListener('click',e=>{const b=e.target.closest('.tg-tool');if(!b||b.disabled)return;ACTIONS[TOOLS[b.dataset.i].run]?.(b);});
 scroll.parentNode.insertBefore(body,scroll);body.append(tools,scroll);
 const bottom=doc.createElement('div');bottom.id='tgStatus';bottom.className='tg-status';bottom.textContent='준비';bottom.setAttribute('role','status');
 body.after(bottom);
 // shortcuts of the 편집(E) menu while the T/G window has focus
 graph.addEventListener('keydown',e=>{
  if(e.target.closest('input,select,textarea'))return;
  const k=e.key.toLowerCase();
  const map=e.ctrlKey?{c:'copy',v:'paste',a:'create',n:'note'}:{f5:'edit'};
  const run=map[k];if(run){e.preventDefault();ACTIONS[run]();}
 });
 graph.tabIndex=-1;
 bindPlot();
}
root.SimTG={init,actions:ACTIONS};
})(window);
