(function(root){'use strict';
if(!root.OrpheiaEngine){if(new URLSearchParams(root.location.search).get('desktop')==='1'){root.SimSession.create=()=>{throw new Error('Desktop engine bridge unavailable; local simulation is disabled.');};}return;}
const requested=new URLSearchParams(root.location.search).get('lsStation');let viewStation=root.SimLSPresets.get(requested)?.station||null;root.SimExtraLS=!!viewStation;
let mirror=null,cursor=0,version=-1;const pending=[];
function reconcile(target,source){
 if(Array.isArray(source)){if(!Array.isArray(target))target=[];target.length=source.length;for(let i=0;i<source.length;i++)target[i]=reconcile(target[i],source[i]);return target;}
 if(source&&typeof source==='object'){if(!target||typeof target!=='object'||Array.isArray(target))target={};for(const k of Object.keys(target))if(!(k in source))delete target[k];for(const [k,v]of Object.entries(source))target[k]=reconcile(target[k],v);return target;}
 return source;
}
function apply(snapshot){
 const replay=root.SimReplay?.active?.();
 if(!mirror)mirror=snapshot;
 else for(const [key,value]of Object.entries(snapshot)){if(replay&&['states','ls'].includes(key))continue;mirror[key]=reconcile(mirror[key],value);}
 cursor=snapshot.seq;version=snapshot.version;
 if(root.SimLine?.state){root.SimLine.state.enforce=mirror.line.enforce;root.SimLine.state.single.clear();for(const key of mirror.line.single)root.SimLine.state.single.add(key);}
 if(root.SimLine?.journeys){root.SimLine.journeys.clear();for(const [id,code]of mirror.journeys)root.SimLine.journeys.set(id,code);}
 if(!root.SimExtraLS)pending.push(...(snapshot.events||[]));drain();
}
function drain(){if(!root.SimMMI||!root.SimDOM.document.getElementById('mmiShell'))return;while(pending.length){const event=pending.shift();if(event.kind==='log')root.SimMMI.log(event.channel,event.text,undefined,event.level);if(event.kind==='markAuto')root.SimMMI.markAuto(event.key);if(event.kind==='alarm')root.SimMMI.raiseAlarm(event.text,event.state,event.level,event.station);}}
root.addEventListener('DOMContentLoaded',()=>setTimeout(drain,0));
function command(action){const response=root.OrpheiaEngine.request(action,cursor,version);if(response.error)throw new Error(response.error);apply(response.snapshot);return response.result;}
command({type:'poll'});
// A reconnected display leaves historical projection and resumes the intact live session.
if(mirror.clock.replay)command({type:'replay',on:false});
const nativeCore=root.SimCore,coreCache=new Map();
function core(id){if(!coreCache.has(id)){const metadata=nativeCore.forStation(id),preview=metadata.dispatch;metadata.dispatch=(state,action)=>state===mirror.states[id]?command({type:'control',station:id,action}):preview(state,action);coreCache.set(id,metadata);}return coreCache.get(id);}
root.SimCore={...nativeCore,forStation:core};
root.SimSession={create:()=>({states:mirror.states,core,get selected(){return viewStation||mirror.selected;},get state(){return mirror.states[mirror.selected];},select:id=>{if(root.SimExtraLS)viewStation=id;else command({type:'select',station:id});return mirror.states[id];},dispatch:(station,action)=>command({type:'control',station,action}),tick:seconds=>command({type:'tick',seconds}),snapshot:()=>structuredClone({selected:mirror.selected,stations:mirror.states})})};
const timetable=root.SimTimetable;
for(const method of ['delay','cancel','setCancelled','create','update','remove','copy','import','undo','redo']){const local=timetable[method];timetable[method]=(model,...args)=>model===mirror.timetable?command({type:'timetable',method,args}):local(model,...args);}
const localHistory=timetable.history;timetable.history=model=>model===mirror.timetable?mirror.editHistory:localHistory(model);
const initial=timetable.initial;timetable.initial=()=>mirror.timetable;
root.SimRemote={command,poll:()=>command({type:'poll'}),get snapshot(){return mirror;},reset:station=>command({type:'station:reset',station})};
})(window);
