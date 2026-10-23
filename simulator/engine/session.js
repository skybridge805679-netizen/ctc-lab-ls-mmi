(function(root){
'use strict';
const Core=typeof module!=='undefined'?require('./core.js'):root.SimCore;
const Network=typeof module!=='undefined'?require('./network.js'):root.SimNetwork;
// Station ownership and clock progression are independent of DOM/window lifetime.
function create({selected='underground-seoul'}={}){
 const cores=new Map(Network.stations.filter(s=>s.controlled).map(s=>[s.id,Core.forStation(s.id)]));
 const states=Object.fromEntries([...cores].map(([id,c])=>[id,c.initial()]));
 if(!cores.has(selected))throw new RangeError('Unknown controlled station');
 const core=id=>{const c=cores.get(id);if(!c)throw new RangeError('Unknown controlled station');return c;};
 return {states,core,get selected(){return selected;},get state(){return states[selected];},
  select(id){core(id);selected=id;return states[id];},
  dispatch(id,action){return core(id).dispatch(states[id],action);},
  tick(seconds){for(const [id,c]of cores)c.dispatch(states[id],{type:'tick',seconds});return {ok:true};},
  snapshot(){return structuredClone({selected,stations:states});}
 };
}
const api={create};if(typeof module!=='undefined')module.exports=api;else root.SimSession=api;
})(typeof window!=='undefined'?window:globalThis);
