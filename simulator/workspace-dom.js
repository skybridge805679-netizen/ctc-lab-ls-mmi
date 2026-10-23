(function(root){
'use strict';
// Queries span LS and MMI; MMI overlays use the secondary body. Native DOM is untouched.
const primary=document, listeners=[];let secondary=null;
const docs=()=>secondary?[primary,secondary]:[primary];
const api={
 getElementById:id=>docs().map(d=>d.getElementById(id)).find(Boolean)||null,
 querySelector:s=>docs().map(d=>d.querySelector(s)).find(Boolean)||null,
 querySelectorAll:s=>docs().flatMap(d=>Array.from(d.querySelectorAll(s))),
 addEventListener(type,fn,options){if(type==='DOMContentLoaded'){primary.addEventListener(type,fn,options);return;}listeners.push({type,fn,options});for(const d of docs())d.addEventListener(type,fn,options);},
 removeEventListener(type,fn,options){for(const d of docs())d.removeEventListener(type,fn,options);for(let i=listeners.length-1;i>=0;i--)if(listeners[i].type===type&&listeners[i].fn===fn)listeners.splice(i,1);}
};
const facade=new Proxy(primary,{get(target,key){if(key==='body')return (secondary||primary).body;if(key in api)return api[key];const value=target[key];return typeof value==='function'?value.bind(target):value;}});
root.SimDOM={document:facade,primary,setMMIDocument(next){if(secondary===next)return;for(const r of listeners){secondary?.removeEventListener(r.type,r.fn,r.options);next?.addEventListener(r.type,r.fn,r.options);}secondary=next;}};
})(window);
