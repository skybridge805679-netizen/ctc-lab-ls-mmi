(function(root){
'use strict';
// One engine in the LS window. Adopt live MMI nodes, never start a second simulator.
const doc=document;let popup=null,anchor=null,poll=null,restoring=false;
// LS 상단의 MMI 창 버튼은 없앴다(MMI는 실습 화면 메뉴 · Ctrl/⌘+2). 상태 표시는 화면 밖 버튼에 둔다.
const spare=doc.createElement('button'),button=()=>doc.getElementById('detachMMIBtn')||spare;
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
// FTS 제어통제 is the instructor's program: its own window like the T/G, sharing the same engine and DOM. Without pop-ups it opens in the LS page.
let fts=null,ftsHome=null,ftsPoll=null,ftsClosing=false;
function closeFts(){
 if(!fts||ftsClosing)return;ftsClosing=true;
 const old=fts;clearInterval(ftsPoll);ftsPoll=null;
 const panel=old.document.getElementById('ftsPanel');
 if(panel&&ftsHome?.parentNode){delete panel.dataset.detached;panel.hidden=true;ftsHome.parentNode.insertBefore(panel,ftsHome);}
 root.SimDOM.setDocument('fts',null);ftsHome?.remove();ftsHome=null;fts=null;
 if(!old.closed)old.close();ftsClosing=false;resize();
}
function openFts(){
 if(fts&&!fts.closed){fts.focus();return true;}
 const panel=root.SimDOM.document.getElementById('ftsPanel');if(!panel)return false;
 const next=root.open('about:blank','orpheia-fts-'+sessionId,'popup,width=1440,height=960,resizable=yes,scrollbars=yes');
 if(!next)return false;
 fts=next;const d=next.document;d.title='ORPHEIA · FTS 제어통제';d.documentElement.lang='ko';
 const base=d.createElement('base');base.href=doc.baseURI;d.head.appendChild(base);
 for(const css of doc.querySelectorAll('link[rel="stylesheet"]')){const link=d.createElement('link');link.rel='stylesheet';link.href=css.href;link.onload=resize;d.head.appendChild(link);}
 d.body.className='fts-detached';
 ftsHome=doc.createComment('FTS return position');panel.before(ftsHome);
 panel.classList.remove('fts-inline');panel.dataset.detached='1';d.body.appendChild(panel);panel.hidden=false;
 root.SimDOM.setDocument('fts',d);
 next.addEventListener('resize',resize);next.addEventListener('beforeunload',closeFts);
 ftsPoll=root.setInterval(()=>{if(next.closed)closeFts();},500);
 resize();next.focus();return true;
}
// 문제 발생 화면: 교육생이 보는 독립 창 (MMI 창 안이 아니다). FTS가 문제를 낼 때 연다.
let prob=null,probHome=null,probPoll=null,probClosing=false;
function closeProblem(){
 if(!prob||probClosing)return;probClosing=true;
 const old=prob;clearInterval(probPoll);probPoll=null;
 const panel=old.document.getElementById('problemPanel');
 if(panel&&probHome?.parentNode){delete panel.dataset.detached;panel.hidden=true;probHome.parentNode.insertBefore(panel,probHome);}
 root.SimDOM.setDocument('problem',null);probHome?.remove();probHome=null;prob=null;
 if(!old.closed)old.close();probClosing=false;resize();
}
function openProblem(){
 // 이미 떠 있으면 그대로 내용만 바뀐다 — 교육생이 LS·MMI에서 조작 중일 때 포커스를 빼앗지 않는다
 if(prob&&!prob.closed){if(root.OrpheiaEngine?.native!==false)root.OrpheiaEngine?.openView?.('problem');return true;}   // 데스크톱: 최소화돼 있으면 포커스 없이 다시 보이게
 const panel=root.SimDOM.document.getElementById('problemPanel');if(!panel)return false;
 const next=root.open('about:blank','orpheia-problem-'+sessionId,'popup,width=1120,height=900,resizable=yes,scrollbars=yes');
 if(!next)return false;
 prob=next;const d=next.document;d.title='ORPHEIA · 문제 발생';d.documentElement.lang='ko';
 const base=d.createElement('base');base.href=doc.baseURI;d.head.appendChild(base);
 for(const css of doc.querySelectorAll('link[rel="stylesheet"]')){const link=d.createElement('link');link.rel='stylesheet';link.href=css.href;link.onload=resize;d.head.appendChild(link);}
 d.body.className='problem-detached';
 probHome=doc.createComment('problem return position');panel.before(probHome);
 panel.classList.remove('problem-inline');panel.dataset.detached='1';d.body.appendChild(panel);panel.hidden=false;
 root.SimDOM.setDocument('problem',d);
 next.addEventListener('resize',resize);next.addEventListener('beforeunload',closeProblem);
 probPoll=root.setInterval(()=>{if(next.closed)closeProblem();},500);
 resize();return true;
}
const sessionId=Math.random().toString(36).slice(2);
root.SimWorkspace={detach,closeMMI:park,openGraph,closeGraph,openFts,closeFts,ftsDetached:()=>!!fts&&!fts.closed,openProblem,closeProblem,problemDetached:()=>!!prob&&!prob.closed,graphDetached:()=>!!tg&&!tg.closed,detached:()=>!!popup&&!popup.closed,focusMMI:()=>popup?.focus()};
button().onclick=detach;button().setAttribute('aria-pressed','false');
root.addEventListener('pagehide',()=>{if(popup&&!popup.closed)popup.close();if(tg&&!tg.closed)tg.close();if(fts&&!fts.closed)fts.close();if(prob&&!prob.closed)prob.close();});
})(window);
