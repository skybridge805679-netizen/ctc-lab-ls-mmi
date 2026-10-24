(function(root){
'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let host,ops,model,menu,dialog,pending=null,lastFocus=null,drag=null,menuOpenedAt=0;
const ctx=()=>host.context(),norm=s=>s.replaceAll(' · ','');
const rows=(station,slot)=>ops.entries(model,station,slot);
function closeMenu(){if(menu){const old=menu;menu=null;old.remove();}if(lastFocus?.isConnected)lastFocus.focus?.({preventScroll:true});}
function cancelPending(){pending=null;$('lsStage').classList.remove('select-train-target');}
function apply(a){host.run({type:'lsOperation',operation:a,source:'LS'});}
function confirm(title,body,a){closeMenu();host.openAction(title,body,()=>({type:'lsOperation',operation:typeof a==='function'?a():a,source:'LS'}));}
function editTrain(slot,uid){
 cancelPending();
 const station=ctx().station,t=rows(station,slot).find(t=>t.uid===uid);
 confirm(t?'열차번호 수정':'열차번호 입력',`<p>${esc(root.SimNetwork.catalog[station].name)} · ${esc(slot)}</p><label class="field-label" for="lsTrainNumber">열차번호</label><input id="lsTrainNumber" required pattern="[A-Za-z]{0,2}[0-9]{1,6}" maxlength="8" autocomplete="off" value="${esc(t?.number||'')}" placeholder="K1234"><label class="field-label" for="lsTrainDirection">운행방향</label><select id="lsTrainDirection"><option value="up">상행 ◀</option><option value="down">하행 ▶</option></select>`,()=>({op:t?'rename':'insert',station,slot,uid,number:$('lsTrainNumber').value,direction:$('lsTrainDirection').value}));
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
 closeMenu();const schedule=root.SimDiagram.getModel().trains.find(x=>x.id===t.number);
 host.openAction('열차 속성 조회',`<dl class="ls-properties"><dt>열차번호</dt><dd>${esc(t.number)}</dd><dt>위치</dt><dd>${esc(ctx().monitor?'의왕~수원':root.SimNetwork.catalog[ctx().station].name)} · ${esc(slot)}</dd><dt>운행방향</dt><dd>${t.direction==='up'?'상행':'하행'}</dd><dt>열차종류</dt><dd>${esc(schedule?.kind||'수동 등록')}</dd><dt>스케줄</dt><dd>${schedule?(schedule.cancelled?'운휴':'등록됨'):'등록된 스케줄 없음'}</dd></dl><p>수동 열차번호 표시 · 모의 점유 상태와 별개입니다.</p>`,null,'닫기');
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
function overview(ids){
 cancelPending();closeMenu();dialog.innerHTML='<header><h2>L/S Overview</h2><button type="button" id="lsOverviewClose">닫기</button></header><div class="ls-overview-grid">'+root.SimLSPresets.list().filter(v=>ids.includes(v.station)).map(view=>{
  const id=view.station,st=root.SimNetwork.catalog[id],C=root.SimCore.forStation(id),s=ctx().stationStates[id],v=root.SimLS.render(st,root.SimWiring.data[id],C,s,{preset:view.id,occupied:new Set(Object.entries(model.stations[id].windows).filter(([,rows])=>rows.some(t=>!root.SimScenarioMotion?.inTransit(s,t.uid))).map(([slot])=>slot))}),count=Object.values(model.stations[id].windows).flat().length;
  const svg=v.svg.replace(/ id="/g,' id="ov-').replace(/url\(#/g,'url(#ov-').replace(/ tabindex="0"/g,'').replace(/data-signal="/g,'data-overview-signal="');
  return `<button class="ls-overview-station" data-overview-station="${view.id}" data-overview-control-station="${id}"><b>${esc(view.name)} · ${s.mode} · ${Object.keys(s.routes).length}개 진로 · 열차번호 ${count}개</b><svg class="ls-svg" data-monitor="${!!view.monitor}" viewBox="0 0 ${v.width} ${v.height}">${svg}</svg></button>`;
 }).join('')+'</div>';$('lsOverviewClose').onclick=()=>dialog.close();dialog.querySelectorAll('[data-overview-station]').forEach(b=>b.onclick=()=>{dialog.close();host.selectStation(b.dataset.overviewStation);});dialog.showModal();dialog.querySelectorAll('[data-overview-station]').forEach(b=>decorate(b.querySelector('svg'),b.dataset.overviewControlStation,true));
}
function backgroundMenu(point){const ids=root.SimNetwork.stations.filter(s=>s.controlled).map(s=>s.id);return [
 {label:'현재역 베이스스캔',id:'scan-current',action:()=>scan('current')},
 {label:'화면인쇄',id:'print',action:()=>{closeMenu();root.print();}},
 {label:'전체역 베이스스캔',id:'scan-all',action:()=>scan('all')},
 {label:'L/S 재실행',id:'restart',action:()=>{closeMenu();host.render();host.toast('L/S 화면 재표시 · 설정된 진로·열차번호·표지판 유지');}},
 {label:'L/S 표지판',id:'boards',children:root.SimLSOperations.boardTypes.map((kind,i)=>({label:kind,id:'board-'+i,action:()=>editBoard(kind,point)}))},
 {label:'L/S Overview',id:'overview',children:[{label:'전체 관제구간',id:'overview-all',action:()=>overview(ids)},{label:'청량리 ~ 서울',id:'overview-north',action:()=>overview(ids.slice(0,5))},{label:'용산 ~ 금천구청',id:'overview-central',action:()=>overview(ids.slice(5,10))},{label:'안양 ~ 수원',id:'overview-south',action:()=>overview(ids.slice(10))}]}
 ];}
function openMenu(items,x,y,target){
 closeMenu();lastFocus=target?.closest('[tabindex]')||target;menu=document.createElement('div');menu.className='ls-context-menu';menu.dataset.lsContext='';menu.setAttribute('role','menu');menu.setAttribute('aria-label','LS 우클릭 메뉴');
 function build(list,level){const box=document.createElement('div');box.className=level?'ls-submenu':'ls-menu-items';box.setAttribute('role','menu');
  for(const item of list){const row=document.createElement('div');row.className='ls-menu-row';const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.dataset.contextAction=item.id;b.textContent=item.label;
   if(item.children){b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');b.append(Object.assign(document.createElement('span'),{textContent:'▸'}));const sub=build(item.children,level+1);row.append(b,sub);
    const show=()=>{for(const sibling of box.children){sibling.classList.remove('open');sibling.querySelector('button')?.setAttribute('aria-expanded','false');}row.classList.add('open');b.setAttribute('aria-expanded','true');sub.classList.remove('opens-left');sub.style.top='0px';const r=sub.getBoundingClientRect();sub.classList.toggle('opens-left',r.right>innerWidth-6);sub.style.top=Math.min(0,innerHeight-8-r.bottom)+'px';};row.onpointerenter=show;b.onclick=show;b.onkeydown=e=>{if(e.key==='ArrowRight'){e.preventDefault();show();sub.querySelector('button')?.focus();}if(e.key==='ArrowLeft'){e.preventDefault();row.classList.remove('open');b.focus();}};
   }else {row.append(b);b.onclick=()=>{closeMenu();item.action();};}box.append(row);
  }return box;
 }
 menu.append(build(items,0));document.body.append(menu);menuOpenedAt=performance.now();menu.style.left=Math.max(4,Math.min(x,innerWidth-menu.offsetWidth-6))+'px';menu.style.top=Math.max(4,Math.min(y,innerHeight-menu.offsetHeight-6))+'px';
 menu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const box=e.target.closest('[role="menu"]'),bs=[...box.children].map(r=>r.querySelector('button')),at=bs.indexOf(document.activeElement),n=e.key==='Home'?0:e.key==='End'?bs.length-1:(at+(e.key==='ArrowUp'?-1:1)+bs.length)%bs.length;bs[n]?.focus();}if(e.key==='ArrowLeft'){const row=e.target.closest('.ls-submenu')?.parentElement;if(row){e.preventDefault();row.classList.remove('open');row.querySelector('button')?.focus();}}};menu.querySelector('button').focus({preventScroll:true});
}
function decorate(svg=$('trackSvg'),station=ctx().station,readonly=false){
 if(!svg)return;const monitor=svg.dataset.monitor==='true';const layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.classList.add('ls-manual-layer');
 for(const g of svg.querySelectorAll('[data-train-slot]')){
  const slot=g.dataset.trainSlot,box=g.querySelector('rect').getBBox(),ts=rows(station,slot).filter(t=>!root.SimScenarioMotion?.inTransit(ctx().stationStates[station],t.uid)),all=ts.map(t=>(t.direction==='up'?'<':'>')+t.number).join(' + '),text=ts.length>1?(ts[0].direction==='up'?'<':'>')+ts[0].number+' +'+(ts.length-1):all,label=g.dataset.windowCode+' '+(all||(readonly?'열차 없음':'열차번호 입력'));
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
 host=h;const catalog={};for(const st of root.SimNetwork.stations.filter(s=>s.controlled)){const C=root.SimCore.forStation(st.id);catalog[st.id]=root.SimTrainWindows.data[st.id].map(w=>w.slot);}ops=root.SimLSOperations.create(catalog);model=root.SimRemote?.snapshot.ls||ops.initial();
 dialog=document.createElement('dialog');dialog.id='lsOverview';dialog.className='ls-overview';document.body.append(dialog);
 $('lsDisplay').oncontextmenu=e=>{e.preventDefault();if(drag)return;if(ctx().monitor){const slot=e.target.closest('[data-train-slot]');openMenu(slot?numberMenu(slot.dataset.trainSlot):[{label:'화면인쇄',id:'print',action:()=>{closeMenu();root.print();}},{label:'전체 LS 보기',id:'overview-all',action:()=>overview(root.SimNetwork.stations.filter(s=>s.controlled).map(s=>s.id))}],e.clientX,e.clientY,e.target);return;}const board=e.target.closest('[data-ls-board]'),slot=e.target.closest('[data-train-slot]'),circuit=e.target.closest('[data-track-circuit],[data-circuit-label]');const id=slot?.dataset.trainSlot||norm(circuit?.dataset.trackCircuit||circuit?.dataset.circuitLabel||'');let point={x:30,y:30};if($('trackSvg').contains(e.target))point=svgPoint(e);openMenu(board?boardMenu(board.dataset.lsBoard):slot&&catalog[ctx().station].includes(id)?numberMenu(id):backgroundMenu(point),e.clientX,e.clientY,e.target);};
 $('lsDisplay').addEventListener('click',e=>{const close=e.target.closest('[data-board-close]');if(close&&!ctx().monitor){e.stopPropagation();deleteBoard(close.dataset.boardClose);return;}const slot=e.target.closest('[data-train-slot]');if(slot&&pending){e.stopPropagation();target(slot.dataset.trainSlot);}},true);
 $('lsDisplay').addEventListener('keydown',e=>{const slot=e.target.closest('[data-train-slot]');if(slot&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();if(pending)target(slot.dataset.trainSlot);else editTrain(slot.dataset.trainSlot,rows(ctx().station,slot.dataset.trainSlot)[0]?.uid);}},true);
 $('lsDisplay').addEventListener('dblclick',e=>{const slot=e.target.closest('[data-train-slot]'),board=e.target.closest('[data-ls-board]');if(slot){e.preventDefault();editTrain(slot.dataset.trainSlot,rows(ctx().station,slot.dataset.trainSlot)[0]?.uid);}else if(board&&!ctx().monitor){const b=model.stations[ctx().station].boards.find(b=>b.id===board.dataset.lsBoard);editBoard(b.kind,{},b.id);}});
 $('lsDisplay').addEventListener('pointerdown',e=>{if(ctx().monitor)return;const b=e.target.closest('[data-ls-board]');if(e.button!==0||!b||e.target.closest('[data-board-close]'))return;const data=model.stations[ctx().station].boards.find(x=>x.id===b.dataset.lsBoard);if(data.fixed)return;const p=svgPoint(e,false),grip=!!e.target.closest('[data-board-resize]');drag={id:data.id,station:ctx().station,dx:p.x-data.x,dy:p.y-data.y,x:data.x,y:data.y,w:data.w||180,h:data.h||58,sw:data.w||180,sh:data.h||58,px:p.x,py:p.y,resize:grip,node:b};b.setPointerCapture(e.pointerId);e.preventDefault();});
 $('lsDisplay').addEventListener('pointermove',e=>{if(!drag)return;const p=svgPoint(e,false),v=$('trackSvg').viewBox.baseVal;if(drag.resize){drag.w=Math.max(60,Math.min(1200,drag.sw+p.x-drag.px));drag.h=Math.max(30,Math.min(400,drag.sh+p.y-drag.py));drag.node.querySelector('.bd-body').setAttribute('width',drag.w);drag.node.querySelector('.bd-body').setAttribute('height',drag.h);drag.node.querySelector('.bd-title').setAttribute('width',drag.w);return;}drag.x=Math.max(8,Math.min(v.width-188,p.x-drag.dx));drag.y=Math.max(8,Math.min(v.height-68,p.y-drag.dy));drag.node.setAttribute('transform',`translate(${drag.x} ${drag.y})`);});
 const end=()=>{if(drag){const d=drag;drag=null;const b=model.stations[d.station].boards.find(b=>b.id===d.id);if(d.resize){if(Math.abs(d.w-d.sw)+Math.abs(d.h-d.sh)>1)apply({op:'boardResize',station:d.station,id:d.id,w:d.w,h:d.h});else host.render();return;}if(Math.abs(d.x-b.x)+Math.abs(d.y-b.y)>1)apply({op:'boardMove',station:d.station,id:d.id,x:d.x,y:d.y});}};$('lsDisplay').addEventListener('pointerup',end);$('lsDisplay').addEventListener('pointercancel',()=>{drag=null;host.render();});
 document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target))closeMenu();},true);document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();cancelPending();}if((e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey)&&$('lsDisplay').contains(e.target)){e.preventDefault();const b=e.target.getBoundingClientRect();e.target.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:b.x+12,clientY:b.y+12}));}});root.addEventListener('resize',closeMenu);root.addEventListener('scroll',e=>{if(menu&&performance.now()-menuOpenedAt>100&&!menu.contains(e.target))closeMenu();},true);root.addEventListener('blur',closeMenu);
}
root.SimLSUI={init,decorate,dispatch:a=>{if(root.SimRemote)return root.SimRemote.command({type:'numbers',action:a});const r=ops.dispatch(model,a);if(r.ok)root.SimScenarioUI?.manualNumberAction(a);return r;},dispatchDirect:a=>root.SimRemote?root.SimRemote.command({type:'numbers',action:a}):ops.dispatch(model,a),validate:a=>root.SimRemote?root.SimRemote.command({type:'numbers:validate',action:a}):ops.dispatch(structuredClone(model),a),getModel:()=>model,stationChanged:()=>{closeMenu();if(dialog?.open)dialog.close();},isInteracting:()=>!!drag||!!menu||dialog?.open,reset:station=>{if(root.SimRemote){root.SimRemote.command({type:'numbers:reset',station});cancelPending();return;}model.stations[station]={windows:{},boards:[]};cancelPending();},closeMenu};
})(window);
