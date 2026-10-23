(function(root){
'use strict';
// One engine in the LS window. Adopt live MMI nodes, never start a second simulator.
const doc=document;let popup=null,anchor=null,poll=null,restoring=false;
const button=()=>doc.getElementById('detachMMIBtn');
const overlays=d=>Array.from(d.querySelectorAll('.mmi-alarm,.mmi-shield:not([data-ls-owned])'));
function transfer(node,target){const modal=node.matches('dialog[open]');if(modal)node.close();target.appendChild(node);if(modal)node.showModal();}
function resize(){root.dispatchEvent(new Event('resize'));}
// Closed MMI documents stay alive in a hidden, same-origin iframe, never in LS.
// This preserves event handlers, drafts and screen-local modal dialogs.
const parking=doc.createElement('iframe');parking.id='mmiParking';parking.hidden=true;parking.setAttribute('aria-hidden','true');parking.title='MMI session storage';doc.body.appendChild(parking);
function park(){
 if(!popup||restoring)return;restoring=true;
 const old=popup;clearInterval(poll);poll=null;
 const parked=parking.contentDocument;
 const shell=old.document.getElementById('mmiShell');if(shell)parked.body.appendChild(shell);
 root.SimDOM.setMMIDocument(parked);
 for(const el of overlays(old.document))transfer(el,parked.body);
 anchor?.remove();anchor=null;popup=null;
 doc.body.classList.add('workspace-split');button().textContent='↗ MMI 창 열기';button().setAttribute('aria-pressed','false');
 if(!old.closed)old.close();restoring=false;
}
function detach(){
 if(popup&&!popup.closed){popup.focus();return;}
 const shell=root.SimDOM.document.getElementById('mmiShell');if(!shell)return;
 const next=root.open('about:blank','orpheia-mmi-'+sessionId,'popup,width=1440,height=1000,resizable=yes,scrollbars=yes');
 if(!next){button().textContent='팝업 허용 후 MMI 새 창';return;}
 popup=next;const d=next.document;d.title='ORPHEIA · MMI';d.documentElement.lang='ko';
 const base=d.createElement('base');base.href=doc.baseURI;d.head.appendChild(base);
 for(const css of doc.querySelectorAll('link[rel="stylesheet"]')){const link=d.createElement('link');link.rel='stylesheet';link.href=css.href;link.onload=resize;d.head.appendChild(link);}
 d.body.className='mmi-detached';
 anchor=doc.createComment('MMI return position');shell.before(anchor);d.body.appendChild(shell);
 root.SimDOM.setMMIDocument(d);
 for(const source of [doc,parking?.contentDocument].filter(Boolean))for(const el of overlays(source))transfer(el,d.body);
 doc.body.classList.add('workspace-split');button().textContent='↗ MMI 창 보기';button().setAttribute('aria-pressed','true');
 next.addEventListener('resize',resize);
 // Preserve the document before closing; LS never adopts visible MMI content.
 next.addEventListener('beforeunload',park);
 poll=root.setInterval(()=>{if(next.closed)park();},500);
 resize();next.focus();
}
// 열차 그래프(T/G)는 MMI의 하위 창이 아니라 독립 창이다. 같은 엔진·DOM을 입양해 쓰고, 팝업이 막히면 MMI 안 창으로 돌아간다.
let tg=null,tgHome=null,tgPoll=null,tgClosing=false;
function closeGraph(){
 if(!tg||tgClosing)return;tgClosing=true;
 const old=tg;clearInterval(tgPoll);tgPoll=null;
 const panel=old.document.getElementById('graphPanel');
 if(panel&&tgHome?.parentNode){delete panel.dataset.detached;panel.hidden=true;tgHome.parentNode.insertBefore(panel,tgHome);}
 root.SimDOM.setDocument('graph',null);tgHome?.remove();tgHome=null;tg=null;
 if(!old.closed)old.close();tgClosing=false;resize();
}
function openGraph(){
 if(tg&&!tg.closed){tg.focus();return true;}
 const panel=root.SimDOM.document.getElementById('graphPanel');if(!panel)return false;
 const next=root.open('about:blank','orpheia-tg-'+sessionId,'popup,width=1500,height=900,resizable=yes,scrollbars=yes');
 if(!next)return false;
 tg=next;const d=next.document;d.title='ORPHEIA · 열차 그래프';d.documentElement.lang='ko';
 const base=d.createElement('base');base.href=doc.baseURI;d.head.appendChild(base);
 for(const css of doc.querySelectorAll('link[rel="stylesheet"]')){const link=d.createElement('link');link.rel='stylesheet';link.href=css.href;link.onload=resize;d.head.appendChild(link);}
 d.body.className='tg-detached';
 tgHome=doc.createComment('T/G return position');panel.before(tgHome);
 panel.dataset.detached='1';d.body.appendChild(panel);panel.hidden=false;
 root.SimDOM.setDocument('graph',d);
 d.getElementById('onlineGraphBtn')?.click();d.getElementById('closeGraph')?.addEventListener('click',()=>root.setTimeout(closeGraph));
 next.addEventListener('resize',resize);next.addEventListener('beforeunload',closeGraph);
 tgPoll=root.setInterval(()=>{if(next.closed)closeGraph();},500);
 resize();next.focus();return true;
}
const sessionId=Math.random().toString(36).slice(2);
root.SimWorkspace={detach,closeMMI:park,openGraph,closeGraph,graphDetached:()=>!!tg&&!tg.closed,detached:()=>!!popup&&!popup.closed,focusMMI:()=>popup?.focus()};
button().onclick=detach;button().setAttribute('aria-pressed','false');
root.addEventListener('pagehide',()=>{if(popup&&!popup.closed)popup.close();if(tg&&!tg.closed)tg.close();});
})(window);
