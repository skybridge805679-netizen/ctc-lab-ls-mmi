(function(root){
'use strict';
// Queries span the LS window and every adopted window (MMI, T/G); MMI overlays use the MMI body. Native DOM is untouched.
const primary=document, listeners=[], extras=new Map();   // role -> Document
const docs=()=>[primary,...extras.values()];
const api={
 getElementById:id=>docs().map(d=>d.getElementById(id)).find(Boolean)||null,
 querySelector:s=>docs().map(d=>d.querySelector(s)).find(Boolean)||null,
 querySelectorAll:s=>docs().flatMap(d=>Array.from(d.querySelectorAll(s))),
 addEventListener(type,fn,options){if(type==='DOMContentLoaded'){primary.addEventListener(type,fn,options);return;}listeners.push({type,fn,options});for(const d of docs())d.addEventListener(type,fn,options);},
 removeEventListener(type,fn,options){for(const d of docs())d.removeEventListener(type,fn,options);for(let i=listeners.length-1;i>=0;i--)if(listeners[i].type===type&&listeners[i].fn===fn)listeners.splice(i,1);}
};
const facade=new Proxy(primary,{get(target,key){if(key==='body')return (extras.get('mmi')||primary).body;if(key in api)return api[key];const value=target[key];return typeof value==='function'?value.bind(target):value;}});
function setDocument(role,next){
 const prev=extras.get(role)||null;if(prev===next)return;
 for(const r of listeners){prev?.removeEventListener(r.type,r.fn,r.options);next?.addEventListener(r.type,r.fn,r.options);}
 if(next)extras.set(role,next);else extras.delete(role);
}
root.SimDOM={document:facade,primary,setDocument,setMMIDocument:next=>setDocument('mmi',next)};
})(window);
