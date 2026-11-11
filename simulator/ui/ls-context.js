(function(root){
'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let host,ops,model,menu,dialog,pending=null,lastFocus=null,drag=null,menuOpenedAt=0,overviewTimer=null,overviewIds=[];
const ctx=()=>host.context(),norm=s=>s.replaceAll(' · ','');
const rows=(station,slot)=>ops.entries(model,station,slot);
function closeMenu(){if(menu){const old=menu;menu=null;old.remove();}if(lastFocus?.isConnected)lastFocus.focus?.({preventScroll:true});}
function cancelPending(){pending=null;$('lsStage').classList.remove('select-train-target');}
function apply(a){host.run({type:'lsOperation',operation:a,source:'LS'});}
function confirm(title,body,a){closeMenu();host.openAction(title,body,()=>({type:'lsOperation',operation:typeof a==='function'?a():a,source:'LS'}));}
function editTrain(slot,uid){
 cancelPending();
 const station=ctx().station,t=rows(station,slot).find(t=>t.uid===uid);
 confirm(t?'열차번호 수정':'열차번호 입력',`<p>${esc(ctx().viewName||root.SimNetwork.catalog[station].name)} · ${esc(slot)}</p><label class="field-label" for="lsTrainNumber">열차번호</label><input id="lsTrainNumber" required pattern="[A-Za-z]{0,2}[0-9]{1,6}" maxlength="8" autocomplete="off" value="${esc(t?.number||'')}" placeholder="K1234"><label class="field-label" for="lsTrainDirection">운행방향</label><select id="lsTrainDirection"><option value="up">상행 ◀</option><option value="down">하행 ▶</option></select>`,()=>({op:t?'rename':'insert',station,slot,uid,number:$('lsTrainNumber').value,direction:$('lsTrainDirection').value}));
 $('lsTrainDirection').value=t?.direction||'up';$('lsTrainNumber').focus();$('lsTrainNumber').select();
 $('lsTrainNumber').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('dialogConfirm').click();}};
}
function chooseTarget(op,slot,uid){closeMenu();pending={op,station:ctx().station,slot,uid};$('lsStage').classList.add('select-train-target');host.toast((op==='move'?'이동할':'교환할')+' 열번창을 클릭하세요. 다른 역 선택 가능 · Esc 취소');}
function target(slot){
 if(!pending)return;const from=pending,station=ctx().station,ts=rows(station,slot);
 if(from.op==='swap'&&!ts.length){host.toast('교환할 열차번호가 있는 창을 선택하세요.',true);return;}
 const source=rows(from.station,from.slot).find(t=>t.uid===from.uid);if(!source){cancelPending();return;}
 confirm('열차번호 '+(from.op==='move'?'이동':'교환'),`<p>${esc(root.SimNetwork.catalog[from.station].name)} ${esc(from.slot)} ${esc(source.number)} → ${esc(root.SimNetwork.catalog[station].name)} ${esc(slot)}</p>`+(from.op==='swap'?`<label class="field-label" for="lsSwapNumber">교환할 열차번호</label><select id="lsSwapNumber">${ts.map(t=>`<option value="${t.uid}">${esc(t.number)}</option>`).join('')}</select>`:''),()=>({...from,targetStation:station,targetSlot:slot,targetUid:from.op==='swap'?$('lsSwapNumber').value:undefined}));cancelPending();
}
function numberMenu(slot){
 const station=ctx().station,ts=rows(station,slot);
 if(!ts.length)return [{label:'열차번호 입력',id:'train-input',action:()=>editTrain(slot)}];
 const each=fn=>ts.map(t=>({label:ts.filter(x=>x.number===t.number).length>1?t.number+' ('+(ts.indexOf(t)+1)+')':t.number,id:t.uid,action:()=>fn(t)}));
 return [
  {label:'열차번호 추가',id:'train-add',action:()=>editTrain(slot)},
  {label:'열차번호 수정',id:'train-rename',children:each(t=>editTrain(slot,t.uid))},
  {label:'열차번호 삭제',id:'train-delete',children:each(t=>confirm('열차번호 삭제',`<p>${esc(t.number)} 열차번호를 삭제하시겠습니까?</p>`,{op:'delete',station,slot,uid:t.uid}))},
  {label:'열차번호 이동',id:'train-move',children:each(t=>chooseTarget('move',slot,t.uid))},
  {label:'열차번호 교환',id:'train-swap',children:each(t=>chooseTarget('swap',slot,t.uid))},
  {label:'열차 속성 조회',id:'train-properties',...(ts.length===1?{action:()=>properties(ts[0],slot)}:{children:each(t=>properties(t,slot))})}
 ];
}
function properties(t,slot){
 closeMenu();root.SimTrainStatusUI.properties(host,t.number,ctx().state.clock);
}
function svgPoint(e,clamp=true){const svg=$('trackSvg'),p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return clamp?{x:Math.max(8,Math.min(svg.viewBox.baseVal.width-188,p.x)),y:Math.max(8,Math.min(svg.viewBox.baseVal.height-68,p.y))}:{x:p.x,y:p.y};}
function editBoard(kind,point,id){
 cancelPending();
 const station=ctx().station,b=model.stations[station].boards.find(b=>b.id===id);
 confirm('L/S 표지판 · '+kind,`<label class="field-label" for="lsBoardText">${kind==='서행표시'?'서행속도 (km/h)':'표지판 내용'}</label><input id="lsBoardText" required maxlength="80" value="${esc(b?.text||(kind==='서행표시'?'25':kind))}"><p>화면에 정보를 표시합니다. 신호·진로를 자동 제어하지 않습니다.</p>`,()=>({op:b?'boardEdit':'boardAdd',station,kind,id,text:$('lsBoardText').value,...point}));$('lsBoardText').focus();
 $('lsBoardText').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('dialogConfirm').click();}};
}
function boardMenu(id){const station=ctx().station,b=model.stations[station].boards.find(b=>b.id===id);return [
 {label:'표지판 수정',id:'board-edit',action:()=>editBoard(b.kind,{},id)},
 {label:b.fixed?'표지판 고정 해제':'L/S 표지판 설정 (고정)',id:'board-fix',action:()=>apply({op:'boardFix',station,id,fixed:!b.fixed})},
 {label:'표지판 삭제',id:'board-delete',action:()=>deleteBoard(id)}
 ];}
function deleteBoard(id){confirm('표지판 삭제','표지판을 삭제하시겠습니까?',{op:'boardDelete',station:ctx().station,id});}
function scan(scope){cancelPending();closeMenu();host.openAction('베이스스캔',`<p>설정과 열차번호를 유지하고 상태를 재수신합니다.</p><select id="lsScope"><option value="current">현재역 베이스스캔</option><option value="all">전체역 베이스스캔</option></select>`,()=>({type:'scan',scope:$('lsScope').value,source:'LS'}));$('lsScope').value=scope;}
function refreshOverview(){
 const occupied=Object.fromEntries(overviewIds.map(id=>[id,new Set(Object.entries(model.stations[id].windows).filter(([,rows])=>rows.some(t=>!root.SimScenarioMotion?.inTransit(ctx().stationStates[id],t.uid))).map(([slot])=>slot))]));
 const focused=document.activeElement?.closest('[data-overview-station]')?.dataset.overviewStation;
 const canvas=dialog.querySelector('.ls-overview-canvas'),view=root.SimLSOverview.build(overviewIds,ctx().stationStates,occupied,{aspect:canvas.clientWidth/canvas.clientHeight});canvas.innerHTML=view.svg;overviewView(view);dialog.querySelector('h2').textContent='L/S Overview · '+(root.SimLSOverview.REGIONS.find(r=>r.id===view.region)?.name||'전체 관제구간');
 for(const svg of dialog.querySelectorAll('[data-overview-detail]'))decorate(svg,svg.dataset.overviewDetail,true);
 if(focused)dialog.querySelector(`[data-overview-station="${focused}"]`)?.focus({preventScroll:true});
}
// 오버뷰 확대·이동 (베타 피드백: 더 크게 보고 싶다): 휠·+/− 단추로 확대, 끌어서 이동, 「맞춤」으로 전체. 1초마다 다시 그려도 보던 자리를 지킨다
let ovZoom=null;
function overviewView(view){const svg=dialog.querySelector('.overview-network');if(!svg)return;const full=[0,0,view.width,view.height];if(!ovZoom||ovZoom.full[2]!==view.width||ovZoom.full[3]!==view.height)ovZoom={full,box:[...full]};svg.setAttribute('viewBox',ovZoom.box.join(' '));const z=dialog.querySelector('#lsOverviewZoom');if(z)z.textContent=Math.round(ovZoom.full[2]/ovZoom.box[2]*100)+'%';}
function zoomOverview(f,cx=.5,cy=.5){if(!ovZoom)return;const [fx,fy,fw,fh]=ovZoom.full,[x,y,w,h]=ovZoom.box,nw=Math.min(fw,Math.max(fw/8,w/f)),nh=nw*fh/fw,px=x+w*cx,py=y+h*cy;ovZoom.box=[Math.min(fx+fw-nw,Math.max(fx,px-nw*cx)),Math.min(fy+fh-nh,Math.max(fy,py-nh*cy)),nw,nh];overviewView({width:fw,height:fh});}
function overview(ids){
 cancelPending();closeMenu();clearInterval(overviewTimer);overviewIds=ids;ovZoom=null;dialog.innerHTML='<header><h2>L/S Overview</h2><div class="ls-overview-tools"><button type="button" data-ov-zoom="out" aria-label="축소">−</button><span id="lsOverviewZoom">100%</span><button type="button" data-ov-zoom="in" aria-label="확대">+</button><button type="button" data-ov-zoom="fit">맞춤</button><button type="button" id="lsOverviewClose">닫기</button></div></header><div class="ls-overview-canvas"></div>';
 dialog.querySelectorAll('[data-ov-zoom]').forEach(b=>b.onclick=()=>{const k=b.dataset.ovZoom;if(k==='fit'){ovZoom.box=[...ovZoom.full];overviewView({width:ovZoom.full[2],height:ovZoom.full[3]});}else zoomOverview(k==='in'?1.4:1/1.4);});
 $('lsOverviewClose').onclick=()=>dialog.close();const canvas=dialog.querySelector('.ls-overview-canvas');
 let pan=null;canvas.onwheel=e=>{e.preventDefault();const r=canvas.querySelector('.overview-network').getBoundingClientRect();zoomOverview(e.deltaY<0?1.2:1/1.2,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);};
 canvas.onpointerdown=e=>{if(e.button!==0||!ovZoom)return;pan={x:e.clientX,y:e.clientY,box:[...ovZoom.box],moved:false};};
 canvas.onpointermove=e=>{if(!pan)return;const r=canvas.querySelector('.overview-network').getBoundingClientRect(),k=pan.box[2]/r.width,dx=(e.clientX-pan.x)*k,dy=(e.clientY-pan.y)*k;if(Math.abs(e.clientX-pan.x)+Math.abs(e.clientY-pan.y)>4)pan.moved=true;if(!pan.moved)return;const [fx,fy,fw,fh]=ovZoom.full,[x,y,w,h]=pan.box;ovZoom.box=[Math.min(fx+fw-w,Math.max(fx,x-dx)),Math.min(fy+fh-h,Math.max(fy,y-dy)),w,h];overviewView({width:fw,height:fh});canvas.classList.add('panning');};
 canvas.onpointerup=()=>{setTimeout(()=>{pan=null;canvas.classList.remove('panning');},0);};
 const select=e=>{if(pan?.moved)return;const target=e.target.closest('[data-overview-station]');if(target){dialog.close();host.selectStation(target.dataset.overviewStation);}};canvas.onclick=select;canvas.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(e);}};
 dialog.showModal();root.SimRemote.command({type:'practice',name:'overview',id:root.SimLSOverview.REGIONS.find(r=>r.rows.flat().length===ids.length&&r.rows.flat().every(x=>ids.includes(x)))?.id||'all',source:'LS'});refreshOverview();overviewTimer=setInterval(()=>{if(dialog.open)refreshOverview();else clearInterval(overviewTimer);},1000);
}
function backgroundMenu(point){const ids=root.SimNetwork.stations.filter(s=>s.controlled).map(s=>s.id);return [
 {label:'현재역 베이스스캔',id:'scan-current',action:()=>scan('current')},
 {label:'화면인쇄',id:'print',action:()=>{closeMenu();root.print();}},
 {label:'전체역 베이스스캔',id:'scan-all',action:()=>scan('all')},
 {label:'L/S 재실행',id:'restart',action:()=>{closeMenu();root.SimRemote.command({type:'practice',name:'lsRestart',station:ctx().station,source:'LS'});host.render();host.toast('L/S 화면 재표시 · 설정된 진로·열차번호·표지판 유지');}},
 {label:'L/S 표지판',id:'boards',children:root.SimLSOperations.boardTypes.map((kind,i)=>({label:kind,id:'board-'+i,action:()=>editBoard(kind,point)}))},
 {label:'L/S Overview',id:'overview',children:[{label:'전체 관제구간',id:'overview-all',action:()=>overview(ids)},...root.SimLSOverview.REGIONS.map(r=>({label:r.name,id:'overview-'+r.id,action:()=>overview(r.rows.flat())}))]}
 ];}
function openMenu(items,x,y,target){
 closeMenu();lastFocus=target?.closest('[tabindex]')||target;menu=document.createElement('div');menu.className='ls-context-menu';menu.dataset.lsContext='';menu.setAttribute('role','menu');menu.setAttribute('aria-label','LS 우클릭 메뉴');
 function build(list,level){const box=document.createElement('div');box.className=level?'ls-submenu':'ls-menu-items';box.setAttribute('role','menu');
  // 한 메뉴 단계에서는 하나만 강조·하나만 펼친다: 포인터가 들어온 행으로 포커스를 옮기고, 다른 행의 하위메뉴는 닫는다
  const closeSiblings=keep=>{for(const sibling of box.children)if(sibling!==keep){sibling.classList.remove('open');sibling.querySelector('button')?.setAttribute('aria-expanded','false');for(const o of sibling.querySelectorAll('.ls-menu-row.open'))o.classList.remove('open');}};
  for(const item of list){const row=document.createElement('div');row.className='ls-menu-row';const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.dataset.contextAction=item.id;b.textContent=item.label;
   if(item.children){b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');b.append(Object.assign(document.createElement('span'),{textContent:'▸'}));const sub=build(item.children,level+1);row.append(b,sub);
    const show=()=>{closeSiblings(row);row.classList.add('open');b.setAttribute('aria-expanded','true');sub.classList.remove('opens-left');sub.style.top='0px';const r=sub.getBoundingClientRect();sub.classList.toggle('opens-left',r.right>innerWidth-6);sub.style.top=Math.min(0,innerHeight-8-r.bottom)+'px';};row.onpointerenter=show;b.onpointerenter=()=>{b.focus({preventScroll:true});show();};b.onclick=show;b.onkeydown=e=>{if(e.key==='ArrowRight'){e.preventDefault();show();sub.querySelector('button')?.focus();}if(e.key==='ArrowLeft'){e.preventDefault();row.classList.remove('open');b.focus();}};
   }else {row.append(b);b.onpointerenter=()=>{closeSiblings(row);b.focus({preventScroll:true});};b.onclick=()=>{closeMenu();item.action();};}box.append(row);
  }return box;
 }
 menu.append(build(items,0));document.body.append(menu);menuOpenedAt=performance.now();menu.style.left=Math.max(4,Math.min(x,innerWidth-menu.offsetWidth-6))+'px';menu.style.top=Math.max(4,Math.min(y,innerHeight-menu.offsetHeight-6))+'px';
 menu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const box=e.target.closest('[role="menu"]'),bs=[...box.children].map(r=>r.querySelector('button')),at=bs.indexOf(document.activeElement),n=e.key==='Home'?0:e.key==='End'?bs.length-1:(at+(e.key==='ArrowUp'?-1:1)+bs.length)%bs.length;bs[n]?.focus();}if(e.key==='ArrowLeft'){const row=e.target.closest('.ls-submenu')?.parentElement;if(row){e.preventDefault();row.classList.remove('open');row.querySelector('button')?.focus();}}};menu.querySelector('button').focus({preventScroll:true});
}
function decorate(svg=$('trackSvg'),station=ctx().station,readonly=false){
 if(!svg)return;const monitor=svg.dataset.monitor==='true';const layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.classList.add('ls-manual-layer');
 for(const g of svg.querySelectorAll('[data-train-slot]')){
  const slot=g.dataset.trainSlot,box=g.querySelector('rect').getBBox(),ts=rows(station,slot).filter(t=>!root.SimScenarioMotion?.inTransit(ctx().stationStates[station],t.uid)),all=ts.map(t=>(t.direction==='up'?'<':'>')+t.number).join(' + '),text=ts.length?(ts[0].direction==='up'?'<':'>')+ts[0].number:'',   // 원본 LS처럼 번호 하나만 (겹친 번호는 설명·MMI 중복 알람으로)
  label=g.dataset.windowCode+' '+(all||(readonly?'열차 없음':'열차번호 입력'));
  g.classList.toggle('multiple',ts.length>1);g.classList.toggle('has-train',ts.length>0);g.setAttribute('aria-label',label);g.querySelector('title').textContent=label;
  if(text)g.insertAdjacentHTML('beforeend',`<text x="${box.x+box.width/2}" y="${box.y+box.height/2+4}" text-anchor="middle" ${text.length*7>box.width-4?`textLength="${box.width-4}" lengthAdjust="spacingAndGlyphs"`:''}>${esc(text)}</text>`);
  if(readonly){g.removeAttribute('role');g.removeAttribute('tabindex');}
 }
 let markup='';
 for(const b of monitor?[]:model.stations[station].boards){
  const w=b.w||180,h=b.h||58,slow=b.kind==='서행표시',label=slow?b.text+' km/h':b.text,title=18,size=Math.max(12,Math.min(18,Math.round((h-title)*.45)));
  // 선로상태 표시: 회색 제목줄 + 붉은 본문, 서행표시: 노란 본문 + 붉은 글자. 모두 반투명이라 아래 진로가 비친다.
  markup+=`<g class="ls-info-board ${slow?'slow':'state'} ${b.fixed?'fixed':''}" data-ls-board="${b.id}" transform="translate(${b.x} ${b.y})"><rect class="bd-body" width="${w}" height="${h}"/><rect class="bd-title" width="${w}" height="${title}"/><text x="6" y="13" class="board-kind">${esc(b.kind)}${b.fixed?' · 고정':''}</text><text class="bd-text" x="${w/2}" y="${title+(h-title)/2+size*.35}" text-anchor="middle" style="font-size:${size}px" ${label.length*size*.62>w-12?`textLength="${w-14}" lengthAdjust="spacingAndGlyphs"`:''}>${esc(label)}</text><g data-board-close="${b.id}" role="button" tabindex="0" aria-label="표지판 삭제"><rect class="bd-x" x="${w-20}" width="20" height="${title}"/><text x="${w-10}" y="13" text-anchor="middle">×</text></g>${b.fixed?'':`<path data-board-resize="${b.id}" class="bd-grip" d="M${w-14} ${h}L${w} ${h-14}V${h}Z"/>`}</g>`;}
 layer.innerHTML=readonly?markup.replace(/ role="button" tabindex="0"/g,''):markup;svg.append(layer);if(!readonly)$('lsStage').classList.toggle('select-train-target',!!pending);
}
function init(h){
 host=h;const catalog={};for(const st of root.SimNetwork.stations.filter(s=>s.controlled))catalog[st.id]=root.SimTrainWindows.data[st.id].map(w=>w.slot);ops=root.SimLSOperations.create(catalog);model=root.SimRemote.snapshot.ls;   // 열번창 상태는 엔진의 것 (ops는 읽기 도우미)
 dialog=document.createElement('dialog');dialog.id='lsOverview';dialog.className='ls-overview';document.body.append(dialog);root.addEventListener('resize',()=>{if(dialog.open)refreshOverview();});
 $('lsDisplay').oncontextmenu=e=>{e.preventDefault();if(drag)return;if(ctx().monitor){const slot=e.target.closest('[data-train-slot]');openMenu(slot?numberMenu(slot.dataset.trainSlot):[{label:'화면인쇄',id:'print',action:()=>{closeMenu();root.print();}},{label:'전체 LS 보기',id:'overview-all',action:()=>overview(root.SimNetwork.stations.filter(s=>s.controlled).map(s=>s.id))}],e.clientX,e.clientY,e.target);return;}const board=e.target.closest('[data-ls-board]'),slot=e.target.closest('[data-train-slot]'),circuit=e.target.closest('[data-track-circuit],[data-circuit-label]');const id=slot?.dataset.trainSlot||norm(circuit?.dataset.trackCircuit||circuit?.dataset.circuitLabel||'');let point={x:30,y:30};if($('trackSvg').contains(e.target))point=svgPoint(e);openMenu(board?boardMenu(board.dataset.lsBoard):slot&&catalog[ctx().station].includes(id)?numberMenu(id):backgroundMenu(point),e.clientX,e.clientY,e.target);};
 $('lsDisplay').addEventListener('click',e=>{const close=e.target.closest('[data-board-close]');if(close&&!ctx().monitor){e.stopPropagation();deleteBoard(close.dataset.boardClose);return;}const slot=e.target.closest('[data-train-slot]');if(slot&&pending){e.stopPropagation();target(slot.dataset.trainSlot);}},true);
 $('lsDisplay').addEventListener('keydown',e=>{const slot=e.target.closest('[data-train-slot]');if(slot&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();if(pending)target(slot.dataset.trainSlot);else editTrain(slot.dataset.trainSlot,rows(ctx().station,slot.dataset.trainSlot)[0]?.uid);}},true);
 $('lsDisplay').addEventListener('dblclick',e=>{const slot=e.target.closest('[data-train-slot]'),board=e.target.closest('[data-ls-board]');if(slot){e.preventDefault();editTrain(slot.dataset.trainSlot,rows(ctx().station,slot.dataset.trainSlot)[0]?.uid);}else if(board&&!ctx().monitor){const b=model.stations[ctx().station].boards.find(b=>b.id===board.dataset.lsBoard);editBoard(b.kind,{},b.id);}});
 $('lsDisplay').addEventListener('pointerdown',e=>{if(ctx().monitor)return;const b=e.target.closest('[data-ls-board]');if(e.button!==0||!b||e.target.closest('[data-board-close]'))return;const data=model.stations[ctx().station].boards.find(x=>x.id===b.dataset.lsBoard);if(data.fixed)return;const p=svgPoint(e,false),grip=!!e.target.closest('[data-board-resize]');drag={id:data.id,station:ctx().station,dx:p.x-data.x,dy:p.y-data.y,x:data.x,y:data.y,w:data.w||180,h:data.h||58,sw:data.w||180,sh:data.h||58,px:p.x,py:p.y,resize:grip,node:b};b.setPointerCapture(e.pointerId);e.preventDefault();});
 $('lsDisplay').addEventListener('pointermove',e=>{if(!drag)return;const p=svgPoint(e,false),v=$('trackSvg').viewBox.baseVal;if(drag.resize){drag.w=Math.max(60,Math.min(1200,drag.sw+p.x-drag.px));drag.h=Math.max(30,Math.min(400,drag.sh+p.y-drag.py));drag.node.querySelector('.bd-body').setAttribute('width',drag.w);drag.node.querySelector('.bd-body').setAttribute('height',drag.h);drag.node.querySelector('.bd-title').setAttribute('width',drag.w);return;}drag.x=Math.max(8,Math.min(v.width-188,p.x-drag.dx));drag.y=Math.max(8,Math.min(v.height-68,p.y-drag.dy));drag.node.setAttribute('transform',`translate(${drag.x} ${drag.y})`);});
 const end=()=>{if(drag){const d=drag;drag=null;const b=model.stations[d.station].boards.find(b=>b.id===d.id);if(d.resize){if(Math.abs(d.w-d.sw)+Math.abs(d.h-d.sh)>1)apply({op:'boardResize',station:d.station,id:d.id,w:d.w,h:d.h});else host.render();return;}if(Math.abs(d.x-b.x)+Math.abs(d.y-b.y)>1)apply({op:'boardMove',station:d.station,id:d.id,x:d.x,y:d.y});}};$('lsDisplay').addEventListener('pointerup',end);$('lsDisplay').addEventListener('pointercancel',()=>{drag=null;host.render();});
 document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target))closeMenu();},true);document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();cancelPending();}if((e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey)&&$('lsDisplay').contains(e.target)){e.preventDefault();const b=e.target.getBoundingClientRect();e.target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:b.x+12,clientY:b.y+12}));}});root.addEventListener('resize',e=>{if(e.isTrusted)closeMenu();});   // 다른 창(문제 발생·FTS·MMI)이 열리며 보내는 재배치 신호로는 열린 메뉴를 닫지 않는다
root.addEventListener('scroll',e=>{if(menu&&performance.now()-menuOpenedAt>100&&!menu.contains(e.target))closeMenu();},true);root.addEventListener('blur',closeMenu);
}
root.SimLSUI={init,decorate,dispatch:a=>root.SimRemote.command({type:'numbers',action:a}),dispatchDirect:a=>root.SimRemote.command({type:'numbers',action:a}),validate:a=>root.SimRemote.command({type:'numbers:validate',action:a}),getModel:()=>model,stationChanged:()=>{closeMenu();if(dialog?.open)dialog.close();},isInteracting:()=>!!drag||!!menu||dialog?.open,reset:station=>{root.SimRemote.command({type:'numbers:reset',station});cancelPending();},closeMenu};
})(window);
