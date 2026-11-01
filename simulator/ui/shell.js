(function(root){
'use strict';
// LS 창의 보조 UI: 우측 드로어(진로·쇄정·연습 기록)와 별도 창 열기 버튼.
const $=id=>document.getElementById(id);
function drawer(on){const el=$('sideDrawer');if(!el)return;const open=on??el.hidden;el.hidden=!open;$('drawerBtn')?.setAttribute('aria-expanded',String(open));}
let viewport;
function fit(){const f=root.SimViewport.fit(root.innerWidth,root.innerHeight);viewport.style.zoom=String(f.scale);viewport.style.width=f.width+'px';viewport.style.height=f.height+'px';}
function init(){
 viewport=document.createElement('div');viewport.className='ls-viewport';
 const header=document.querySelector('.ls-topbar'),main=document.querySelector('body>main');header.before(viewport);viewport.append(header,main);
 root.addEventListener('resize',fit);fit();
 $('drawerClose').onclick=()=>drawer(false);
 // 데스크톱은 메인 프로세스가 창을 앞으로 가져온다(뒤에 있거나 최소화된 창도). 브라우저는 이 페이지가 연다.
 $('ftsWinBtn').onclick=()=>root.OrpheiaEngine&&root.OrpheiaEngine.native!==false?root.OrpheiaEngine.openView('fts'):root.SimFTSUI?.open();
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sideDrawer').hidden&&!document.querySelector('dialog[open]'))drawer(false);});
}
root.SimShell={drawer};
init();
})(window);
