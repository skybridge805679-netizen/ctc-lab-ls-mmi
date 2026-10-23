const assert=require('assert'),E=require('./emergency.js'),S=require('./scenarios.js'),Core=require('./core.js'),N=require('./network.js');
const W=require('./train-windows.js'),LSO=require('./ls-operations.js');
const catalog=Object.fromEntries(Object.entries(W.data||W).map(([s,a])=>[s,a.map(x=>x.slot)]));
const ops=LSO.create(catalog);
function bed(){const states={};for(const s of N.stations.filter(x=>x.controlled))states[s.id]=Core.forStation(s.id).initial();return {states,ls:ops.initial(),events:[]};}
const place=(b,n,st,slot)=>{const r=ops.dispatch(b.ls,{op:'insert',station:st,slot,number:n,direction:E.direction(n)});assert.ok(r.ok,r.message);};
const find=(b,n)=>{for(const [st,s] of Object.entries(b.ls.stations))for(const [slot,rows] of Object.entries(s.windows))for(const r of rows)if(r.number===n)return {station:st,slot,r};return null;};
assert.strictEqual(E.list.length,9);
for(const sc of E.list){
 const b=bed();
 // structure: steps follow the script numbering, every do-step has a check and an act, overlay keys exist in the script
 const nums=sc.steps.filter(s=>s.kind==='say').map(s=>s.no);assert.deepStrictEqual(nums,nums.map((_,i)=>i+1),sc.id+' numbering');
 for(const k of Object.keys(E.OVERLAY[sc.key].before))assert.ok(nums.includes(+k),`${sc.id}: overlay step ${k} exists`);
 assert.ok(sc.steps.filter(s=>s.kind==='say').every(s=>s.lines.length>0),sc.id+' has body lines');
 // seeding: stations reset, seeded signals show a proceed aspect where a route could be set
 E.seed(sc,b.states);
 for(const [st,sigs] of Object.entries(sc.seeds))assert.strictEqual(b.states[st].mode,'AUTO',sc.id+' '+st+' back in AUTO');
 // cast: every train stands on a real 열번창 of its station
 for(const c of E.castFor(sc)){assert.ok(c.slot&&catalog[c.station].includes(c.slot),`${sc.id}: ${c.number} slot ${c.slot} at ${c.station}`);place(b,c.number,c.station,c.slot);}
 for(const [tag,list] of Object.entries(sc.autos))for(const a of list)if(a.op==='insert'||a.op==='move')assert.ok(catalog[a.station].includes(a.slot||E.platform(a.station,a.dir)),sc.id+' auto slot');
 // a perfect operator: do the do-steps in order; each is recognised exactly when done, never before
 const run=S.newRun(sc,'');run.fired=new Set();const autos=()=>E.applyAutos(sc,run,a=>ops.dispatch(b.ls,{...a,}),()=>b.ls);
 const ctx=()=>({states:b.states,ls:b.ls});
 S.advance(run,ctx());
 for(const step of sc.steps.filter(s=>s.kind==='do')){
  const idx=sc.steps.indexOf(step);assert.ok(!run.done[idx],`${sc.id}: "${step.text}" not done before it is performed`);
  // spoken steps are ticked by the operator as the script goes on
  for(let j=0;j<idx;j++)if(sc.steps[j].kind==='say'&&!run.done[j]){run.done[j]=true;autos();}
  const a=step.act,c=Core.forStation(a.station||sc.station);
  const rec=(act,r)=>run.events.push({...act,station:a.station,ok:r.ok!==false});
  if(a.type==='mode'){const r=c.dispatch(b.states[a.station],{type:'mode',value:a.value,source:'x'});assert.ok(r.ok,r.message);rec({type:'mode',value:a.value},r);}
  else if(a.type==='stop'){for(const id of a.ids){const r=c.dispatch(b.states[a.station],{type:'stop',id,source:'x'});rec({type:'stop',id},r);}}
  else if(a.type==='route'){const r=c.dispatch(b.states[a.station],{type:'route',id:a.id,source:'x'});assert.ok(r.ok,`${sc.id}: ${a.station} ${a.id}: ${r.message}`);rec({type:'route',id:a.id},r);}
  else if(a.type==='rename'){const f=find(b,a.from);assert.ok(f,`${sc.id}: ${a.from} stands on the LS`);assert.ok(ops.dispatch(b.ls,{op:'rename',station:f.station,slot:f.slot,uid:f.r.uid,number:a.to,direction:f.r.direction}).ok);}
  else if(a.type==='move'){const f=find(b,a.number);assert.ok(f,`${sc.id}: ${a.number} stands on the LS before it is moved`);const slot=a.slot||catalog[a.station][0];assert.ok(ops.dispatch(b.ls,{op:'move',station:f.station,slot:f.slot,uid:f.r.uid,targetStation:a.station,targetSlot:slot}).ok);}
  else if(a.type==='delete'){const f=find(b,a.number);assert.ok(f,sc.id+' delete target');ops.dispatch(b.ls,{op:'delete',station:f.station,slot:f.slot,uid:f.r.uid});}
  S.advance(run,ctx());autos();
  assert.ok(run.done[idx],`${sc.id}: "${step.text}" recognised`);
 }
 assert.ok(sc.steps.filter(s=>s.kind==='do').every(s=>run.done[sc.steps.indexOf(s)]),sc.id+' all operations done');
}
// every operation block sits next to the script lines it comes from (step N-1 .. N), checked against the original text
const D=require('./emergency-data.js');
for(const sc of E.list){
 const text=n=>{const st=D.scenarios[sc.key].steps.find(x=>x.no===n);return st?st.title+' '+st.body.join(' '):'';};
 for(const [k,ops] of Object.entries(E.OVERLAY[sc.key].before)){
  const hay=(text(+k-1)+' '+text(+k)).replace(/\s+/g,' ');
  for(const op of ops){const a=op.act,need=[];
   if(a.type==='rename'){need.push(a.from,a.to);}
   else if(a.type==='move'||a.type==='delete')need.push(a.number);
   else if(a.type==='mode'){need.push(a.value==='CCM'?/CCM/i:/AUTO|Auto/);}
   else if(a.type==='stop')for(const id of a.ids)need.push(id);
   else if(a.type==='route')need.push(a.id.split('-')[0]);
   for(const n of need)assert.ok(n instanceof RegExp?n.test(hay):hay.includes(n),`${sc.id}: op "${op.text}" is not near its script lines (step ${k}); missing ${n}`);}
 }
}
assert.ok(E.variants.lines.length>100);
console.log('emergency scenarios: ok',E.list.length,E.list.reduce((n,s)=>n+s.steps.length,0),'steps');
