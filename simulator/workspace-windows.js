(function(root){
'use strict';
// One engine in the LS window. Adopt live MMI nodes, never start a second simulator.
const doc=document;let popup=null,anchor=null,poll=null,restoring=false;
const button=()=>doc.getElementById('detachMMIBtn');
const overlays=d=>Array.from(d.querySelectorAll('.mmi-alarm,.mmi-shield:not([data-ls-owned])'));
function transfer(node,target){const modal=node.matches('dialog[open]');if(modal)node.close();target.appendChild(node);if(modal)node.showModal();}
function resize(){root.dispatchEvent(new Event('resize'));}
function restore(){
 if(!popup||restoring)return;restoring=true;
 const old=popup;clearInterval(poll);poll=null;
 const shell=old.document.getElementById('mmiShell');
 if(shell&&anchor?.parentNode)anchor.parentNode.insertBefore(shell,anchor);
 for(const el of overlays(old.document))transfer(el,doc.body);
 root.SimDOM.setMMIDocument(null);anchor?.remove();anchor=null;popup=null;
 doc.body.classList.remove('workspace-split');button().textContent='↗ MMI 새 창';button().setAttribute('aria-pressed','false');
 if(!old.closed)old.close();restoring=false;resize();
}
function detach(){
 if(popup&&!popup.closed){popup.focus();return;}
 const shell=doc.getElementById('mmiShell');if(!shell)return;
 const next=root.open('about:blank','orpheia-mmi-'+sessionId,'popup,width=1440,height=1000,resizable=yes,scrollbars=yes');
 if(!next){button().textContent='팝업 허용 후 MMI 새 창';return;}
 popup=next;const d=next.document;d.title='ORPHEIA · MMI';d.documentElement.lang='ko';
 const base=d.createElement('base');base.href=doc.baseURI;d.head.appendChild(base);
 for(const css of doc.querySelectorAll('link[rel="stylesheet"]')){const link=d.createElement('link');link.rel='stylesheet';link.href=css.href;link.onload=resize;d.head.appendChild(link);}
 d.body.className='mmi-detached';
 const toolbar=d.createElement('header');toolbar.className='detached-toolbar';
 toolbar.innerHTML='<div><span class="live-dot"></span><b>ORPHEIA / MMI</b><small>LS와 동일한 관제 세션</small></div><nav><button type="button" data-ls-focus>LS 창으로</button><button type="button" data-restore>한 화면으로</button></nav>';
 d.body.appendChild(toolbar);toolbar.querySelector('[data-ls-focus]').onclick=()=>root.focus();toolbar.querySelector('[data-restore]').onclick=restore;
 anchor=doc.createComment('MMI return position');shell.before(anchor);d.body.appendChild(shell);
 root.SimDOM.setMMIDocument(d);
 for(const el of overlays(doc))transfer(el,d.body);
 doc.body.classList.add('workspace-split');button().textContent='↗ MMI 창 보기';button().setAttribute('aria-pressed','true');
 next.addEventListener('resize',resize);
 // Restore before unload while adopted nodes are still accessible (close and reload).
 next.addEventListener('beforeunload',restore);
 poll=root.setInterval(()=>{if(next.closed)restore();},500);
 resize();next.focus();
}
const sessionId=Math.random().toString(36).slice(2);
root.SimWorkspace={detach,restore,detached:()=>!!popup&&!popup.closed,focusMMI:()=>popup?.focus()};
button().onclick=detach;button().setAttribute('aria-pressed','false');
root.addEventListener('pagehide',()=>{if(popup&&!popup.closed)popup.close();});
})(window);
