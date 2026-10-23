(function(root){
'use strict';
// LS 창의 보조 UI: 우측 드로어(진로·쇄정·연습 기록)와 별도 창 열기 버튼.
const $=id=>document.getElementById(id);
function drawer(on){const el=$('sideDrawer');if(!el)return;const open=on??el.hidden;el.hidden=!open;$('drawerBtn').setAttribute('aria-expanded',String(open));}
let viewport;
function fit(){const f=root.SimViewport.fit(root.innerWidth,root.innerHeight);viewport.style.zoom=String(f.scale);viewport.style.width=f.width+'px';viewport.style.height=f.height+'px';}
function init(){
 viewport=document.createElement('div');viewport.className='ls-viewport';
 const header=document.querySelector('.ls-topbar'),main=document.querySelector('body>main');header.before(viewport);viewport.append(header,main);
 root.addEventListener('resize',fit);fit();
 $('drawerBtn').onclick=()=>drawer();$('drawerClose').onclick=()=>drawer(false);
 $('graphWinBtn').onclick=()=>root.SimWorkspace?.openGraph();
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sideDrawer').hidden&&!document.querySelector('dialog[open]'))drawer(false);});
}
root.SimShell={drawer};
init();
})(window);
