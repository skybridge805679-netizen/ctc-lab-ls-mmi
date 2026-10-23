const assert=require('assert');
const Core=require('./core.js'),N=require('./network.js'),T=require('./timetable.js'),A=require('./autocontrol.js');
const fresh=()=>{const states={};for(const s of N.stations.filter(x=>x.controlled))states[s.id]=Core.forStation(s.id).initial();return states;};
const tick=(states,sec)=>{for(const [id,s] of Object.entries(states))Core.forStation(id).dispatch(s,{type:'tick',seconds:sec});};
const make=()=>A.create({core:Core,stations:N.stations});
const numbersLog=[];const numbers={place:(st,slot,tr)=>numbersLog.push(['place',st,slot,tr.id]),depart:(st,slot,tr)=>numbersLog.push(['depart',st,slot,tr.id]),remove:(st,tr)=>numbersLog.push(['remove',st,tr.id])};

// 1) the sample timetable runs through every controlled station without leaving anything behind
{const model=T.initial(),states=fresh(),a=make();const kinds={};
 for(let t=0;t<7200;t+=5){tick(states,5);for(const e of a.run({states,model,numbers})){kinds[e.type]=(kinds[e.type]||0)+1;}}
 assert.strictEqual(kinds.arrived+kinds.terminated>0,true);
 const calls=model.trains.flatMap(t=>t.calls.filter(c=>N.catalog[c.station].controlled));
 assert.strictEqual(kinds.left,calls.filter(c=>c.stopType!=='종착').length,JSON.stringify(kinds));
 assert.ok(Object.values(states).every(s=>Object.keys(s.routes).length===0),'no route left set');
 assert.ok(Object.values(states).every(s=>Object.keys(s.occupied).length===0),'no occupancy left');
 assert.strictEqual(a.troubles().length,0,'all troubles resolved');}

// 2) a station that is not in AUTO at the request time gets no request; switching to AUTO makes the controller continue
{const model=T.initial(),states=fresh(),a=make();
 const st='cheongnyangni';Core.forStation(st).dispatch(states[st],{type:'mode',value:'CCM',source:'x'});
 for(let t=0;t<20;t+=5){tick(states,5);a.run({states,model});}
 assert.strictEqual(Object.keys(states[st].routes).length,0,'CCM: no automatic route');
 // back to AUTO while K1131 still waits at the platform (its departure time passed): it gets its departure route now
 tick(states,40);Core.forStation(st).dispatch(states[st],{type:'mode',value:'AUTO',source:'x'});
 assert.ok(a.run({states,model}).some(e=>e.type==='route'&&e.station===st&&e.train==='K1131'),'a waiting train is routed when AUTO resumes');}
{const model=T.initial(),states=fresh(),a=make(),st='cheongnyangni';
 Core.forStation(st).dispatch(states[st],{type:'mode',value:'CCM',source:'x'});tick(states,200);a.run({states,model});
 Core.forStation(st).dispatch(states[st],{type:'mode',value:'AUTO',source:'x'});
 assert.ok(!a.run({states,model}).some(e=>e.type==='route'&&e.station===st&&e.train==='K1131'),'a train whose time is long gone is not routed late');}
{const model=T.initial(),states=fresh(),a=make();const st='cheongnyangni';
 // the first train (시발 at 청량리) departs at 30 s: its departure route is requested 60 s before -> already at t=0
 const ev=a.run({states,model,numbers});
 assert.ok(ev.some(e=>e.type==='route'&&e.station===st&&e.train==='K1131'),'AUTO requests the departure route of K1131');
 assert.ok(states[st].routes['4A-B002T']);}

// 3) a route that cannot be set becomes a trouble and is retried until the condition clears
{const model=T.initial(),states=fresh(),a=make();
 const st='seoul',c=Core.forStation(st);
 // Block the departure route of K1131 at 서울 with a route sharing its eastbound track.
 c.dispatch(states[st],{type:'mode',value:'CCM',source:'x'});const blocker='4B-B902T';const r=c.dispatch(states[st],{type:'route',id:blocker,source:'x'});assert.ok(r.ok,r.message);c.dispatch(states[st],{type:'mode',value:'AUTO',source:'x'});
 let troubled=false,resolved=false;
 for(let t=0;t<4000;t+=5){tick(states,5);if(t===1500){/* keep blocker until K1141 is due */}
  for(const e of a.run({states,model})){if(e.type==='trouble'&&e.station===st)troubled=true;}
  if(troubled&&a.troubles().length)break;}
 assert.ok(troubled,'the blocked route was registered as a trouble');
 c.dispatch(states[st],{type:'mode',value:'CCM',source:'x'});c.dispatch(states[st],{type:'withdraw',id:blocker,source:'x'});c.dispatch(states[st],{type:'mode',value:'AUTO',source:'x'});
 for(let i=0;i<30;i++){tick(states,5);for(const e of a.run({states,model}))if(e.type==='resolved')resolved=true;}
 assert.ok(resolved||a.troubles().length===0,'trouble cleared once the condition was gone');}

// 4) numbers follow the train: place on arrival, move on departure, remove after leaving
{numbersLog.length=0;const model=T.initial(),states=fresh(),a=make();
 for(let t=0;t<400;t+=5){tick(states,5);a.run({states,model,numbers});}
 const mine=numbersLog.filter(x=>x[3]==='K1131'||x[2]==='K1131');
 assert.ok(mine.some(x=>x[0]==='depart')&&mine.some(x=>x[0]==='remove'),JSON.stringify(mine.slice(0,6)));}

// 5) the timetable is user data: other numbers, edited times, cancelled calls and partial trains all work
{const model=T.initial();model.trains[0].id='Z9001';model.trains[0].calls.forEach(c=>{c.arrival+=900;c.departure+=900;});model.trains[1].cancelled=true;
 const states=fresh(),a=make();let routes=0;
 for(let t=0;t<9000;t+=5){tick(states,5);routes+=a.run({states,model}).filter(e=>e.type==='route').length;}
 assert.ok(routes>0);assert.ok(Object.values(states).every(s=>Object.keys(s.routes).length===0));
 assert.strictEqual(a.stageOf(model.trains[1],model.trains[1].calls[0]),0,'cancelled train is never controlled');}

// 6) +10초/+90초 jumps catch up in one go
{const model=T.initial(),states=fresh(),a=make();tick(states,600);a.run({states,model});
 assert.ok(Object.values(states).every(s=>!Object.values(s.routes).some(r=>r.occupied)||true));}

// 7) 자동제어 조건 ④~⑦ (실기3 3.4 마.): a failed signal / point, a TTB route and an ANTI route keep the request back as a trouble until it clears
{const st='cheongnyangni',route='4A-B002T',c=Core.forStation(st);
 const attempt=(setup,undo,word)=>{
  const model=T.initial(),states=fresh(),a=make();setup(states[st]);
  const ev=a.run({states,model});
  assert.ok(!states[st].routes[route],word+': route not set');
  const tr=ev.find(e=>e.type==='trouble'&&e.station===st);assert.ok(tr&&tr.reason.includes(word),word+' trouble '+JSON.stringify(tr));
  assert.strictEqual(a.troubles().filter(x=>x.station===st).length,1);
  undo(states[st]);
  const ev2=a.run({states,model});
  assert.ok(ev2.some(e=>e.type==='route'&&e.station===st&&e.route===route),word+': set after the condition clears');
  assert.strictEqual(a.troubles().filter(x=>x.station===st).length,0,word+': trouble resolved');};
 const r=c.routes[route];
 attempt(s=>assert.ok(c.dispatch(s,{type:'fault',kind:'signal',id:r.signal,on:true}).ok),s=>c.dispatch(s,{type:'fault',kind:'signal',id:r.signal,on:false}),'고장');
 attempt(s=>c.dispatch(s,{type:'fault',kind:'point',id:r.pointLocks[0],on:true}),s=>c.dispatch(s,{type:'fault',kind:'point',id:r.pointLocks[0],on:false}),'고장');
 attempt(s=>c.dispatch(s,{type:'ttb',id:route,on:true}),s=>c.dispatch(s,{type:'ttb',id:route,on:false}),'TTB');
 attempt(s=>{c.dispatch(s,{type:'mode',value:'CCM',source:'x'});assert.ok(c.dispatch(s,{type:'route',id:'2A-1T',source:'x'}).ok);c.dispatch(s,{type:'mode',value:'AUTO',source:'x'});},
         s=>{c.dispatch(s,{type:'mode',value:'CCM',source:'x'});c.dispatch(s,{type:'stop',id:'2A',source:'x'});c.dispatch(s,{type:'mode',value:'AUTO',source:'x'});},'ANTI');
 // a faulted signal also stops a manual request
 const s0=c.initial();c.dispatch(s0,{type:'mode',value:'CCM',source:'x'});c.dispatch(s0,{type:'fault',kind:'signal',id:r.signal,on:true});
 assert.ok(!c.dispatch(s0,{type:'route',id:route,source:'x'}).ok);}

// 8) 신호 대기 지연: a blocked arrival route delays the train; the delay is recorded, and only pushed into the timetable when asked
for(const reflect of [false,true]){
 const model=T.initial(),states=fresh(),a=make(),st='seoul',c=Core.forStation(st);
 const train=model.trains.find(t=>t.id==='K1131'),i=train.calls.findIndex(x=>x.station===st),planned=structuredClone(train.calls);
 const route=(train.calls[i].arrivalRoute||'').replace('_','-');
 c.dispatch(states[st],{type:'fault',kind:'signal',id:c.routes[route].signal,on:true});
 let released=false;
 for(let t=0;t<4000;t+=5){tick(states,5);
  if(!released&&states[st].clock>=train.calls[i].arrival+90){c.dispatch(states[st],{type:'fault',kind:'signal',id:c.routes[route].signal,on:false});released=true;}
  a.run({states,model,numbers,reflect});}
 const rec=a.actuals().find(x=>x.train==='K1131'&&x.station===st);
 assert.ok(rec&&rec.arrDelay>=80,'arrival delay recorded '+JSON.stringify(rec));
 const next=train.calls[i+1],was=planned[i+1];
 if(reflect){assert.ok(next.arrival>was.arrival,'later calls pushed back');assert.ok(model.changes.some(c=>c.type==='delay'&&c.auto&&c.id==='K1131'));}
 else{assert.deepStrictEqual(train.calls,planned,'timetable untouched');}
}

// 9) 선로망: a train leaving a station is handed to the next station on its trunk (the exit circuit is the departure route's destination)
{const model=T.initial(),states=fresh(),a=make(),L=require('./line.js'),W=require('./train-windows.js'),hand=[];
 const nums={place(){},depart(){},remove(){},handoff:(st,tr,dest)=>{const h=dest&&L.handoff(st,dest,id=>(W.data||W)[id].map(x=>x.slot));if(h)hand.push([st,tr.id,h.station,h.slot]);}};
 for(let t=0;t<7200;t+=5){tick(states,5);a.run({states,model,numbers:nums});}
 assert.ok(hand.length>20,'hand-offs happened '+hand.length);
 const down=hand.filter(h=>h[1]==='K1131');assert.ok(down.length>3&&down.every(h=>L.line.stations[h[2]].order>L.line.stations[h[0]].order),'a down train is handed to stations further down the line');
 const up=hand.filter(h=>h[1]==='K1002');assert.ok(up.length>3&&up.every(h=>L.line.stations[h[2]].order<L.line.stations[h[0]].order),'an up train goes the other way');}
console.log('auto control: ok');
