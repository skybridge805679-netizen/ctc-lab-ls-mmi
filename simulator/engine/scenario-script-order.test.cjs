'use strict';
// 비상시 조치 9문제를 원문 대본의 순서 그대로(통보 → 조작) FTS에서 끝까지 푼다.
// 열차는 지시를 받으면 본선을 따라 이어 달리고, 그 때문에 목표가 막히거나 가짜 열차번호 중복 알람이 나지 않아야 한다.
const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('./runtime.cjs'),E=require('./emergency.js');
function play(sc){
 const r=R.create();r.command({type:'fts',op:'bootstrap'});const ok=r.command({type:'fts',op:'start',scenario:'SC-'+sc.id,professor:'001',student:'tester',autoRun:false});assert.ok(ok.ok,ok.message);
 const S=()=>r.snapshot(),item=()=>S().fts.session?.items[0],tick=n=>{for(let i=0;i<n;i+=5)r.command({type:'tick',seconds:5});};
 const row=n=>{for(const [station,s] of Object.entries(S().ls.stations))for(const [slot,rows] of Object.entries(s.windows))for(const x of rows)if(x.number===n)return {station,slot,uid:x.uid,direction:x.direction};return null;};
 const ctl=(station,action)=>r.command({type:'control',station,action:{...action,source:'LS'}}),standing=(st,id)=>Object.keys(S().states[st].routes).some(k=>k.startsWith(id+'-')),notes=[];
 tick(5);
 for(const st of sc.steps){if(item().status!=='진행')break;
  if(st.kind==='say'){if(st.tag){const x=r.command({type:'fts',op:'manual',key:'comm:'+st.tag,checked:true});if(!x.ok)notes.push('통보 '+st.tag+': '+x.message);}tick(5);continue;}
  const a=st.act;let res={ok:true};
  if(a.type==='mode')res=ctl(a.station,{type:'mode',value:a.value});
  else if(a.type==='stop'){for(const id of a.ids)if(standing(a.station,id))ctl(a.station,{type:'stop',id});for(let i=0;i<24&&a.ids.some(id=>standing(a.station,id));i++)tick(5);}   // 접근쇄정이 풀릴 때까지
  else if(a.type==='route'){for(let i=0;i<30;i++){res=ctl(a.station,{type:'route',id:a.id});if(res.ok)break;tick(5);}}
  else if(a.type==='rename'){const f=row(a.from);res=f?r.command({type:'numbers',action:{op:'rename',...f,number:a.to}}):{ok:false,message:a.from+' 없음'};}
  else if(a.type==='delete'){const f=row(a.number);res=f?r.command({type:'numbers',action:{op:'delete',...f}}):{ok:true};}
  else if(a.type==='move'){const f=row(a.number),slot=a.slot||E.platform(a.station,f?.direction);
   // 구원연결은 열번을 옮기지 않고 구원열차가 스스로 도착하기를 기다린 뒤 중복 알람을 확인한다
   if(/구원연결/.test(st.text)){for(let i=0;i<40&&!(row(a.number)?.station===a.station&&row(a.number)?.slot===slot);i++)tick(5);res={ok:row(a.number)?.slot===slot,message:'구원열차 미도착'};r.command({type:'alarm:ack',texts:['열차번호 중복']});}
   else res=f?r.command({type:'numbers',action:{op:'move',...f,targetStation:a.station,targetSlot:slot}}):{ok:false,message:a.number+' 없음'};}
  if(res.ok===false)notes.push(st.text.slice(0,40)+' → '+res.message);
  tick(5);
 }
 r.command({type:'alarm:ack',texts:['열차번호 중복']});tick(60);
 const it=S().fts.session.items[0],p=S().ftsRunLibrary.problems.find(p=>p.id===it.problem);
 return {status:it.status,score:it.score,error:it.error,notes,missing:p.objectives.filter(o=>(it.obj||{})[o.id]==null).map(o=>o.id),
  alarms:S().events.filter(e=>e.kind==='alarm'&&/중복/.test(e.text)).map(e=>(e.text.match(/[A-Z]\d{4}/g)||[]).join('+'))};
}
// 대본이 만드는 중복 알람: 충돌·추돌과 구원연결뿐이다
const ALARMS={'em-02':['K0602+K0604','K0604+G0606'],'em-03':['K0450+K0452','K0452+G0454'],'em-05':['K1208+G1210'],'em-06':['K0452+G0454'],'em-06-1':['K0452+G0454']};
for(const sc of E.list)test(`${sc.id} completes with full marks in the script order`,()=>{
 const o=play(sc);assert.equal(o.error,undefined);assert.deepEqual(o.notes,[]);assert.deepEqual(o.missing,[]);assert.equal(o.status,'완료');assert.equal(o.score,100);
 assert.deepEqual(o.alarms,ALARMS[sc.id]||[]);
});
