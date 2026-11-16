'use strict';
// 시나리오 자동 점검: 비상시조치 대본을 처음부터 끝까지 대본 순서대로 실행해(통보 확인 · 대본의 LS 조작)
//  ① 대본 조작이 실패하거나 오래 기다려야 하는 곳(접근쇄정 · 진로 거부 · 열차 미통과)
//  ② 끝난 뒤에도 서 있는 열차(이어 달리지 못한 열차)와 그 이유
//  ③ 열번창 이름과 다른 회로를 밟는 등 접근쇄정 판정에 쓰인 회로
// 를 보고한다.  사용: node simulator/tools/audit-scenarios.cjs [em-03 ...] [--json]
const D=require('../engine/emergency-data.js'),R=require('../engine/runtime.cjs'),E=require('../engine/emergency.js'),IL=require('../engine/interlocking.js'),N=require('../engine/network.js');
const args=process.argv.slice(2),json=args.includes('--json'),only=args.filter(a=>!a.startsWith('--'));
function audit(sc,{autoRun=false,problemId='P-'+sc.id}={}){
 const r=R.create(),lib=r.snapshot().ftsLibrary;
 if(!lib.problems.some(p=>p.id===problemId))return {id:sc.id,problem:problemId,error:'FTS 문제 없음'};
 lib.situations.push({id:'S-AUDIT',name:'audit',problems:[problemId]});lib.scenarios.push({id:'SC-AUDIT',name:'audit',situations:['S-AUDIT']});
 r.command({type:'fts',op:'library',library:lib});const st=r.command({type:'fts',op:'start',scenario:'SC-AUDIT',professor:'001',student:'tester',autoRun});
 if(!st.ok)return {id:sc.id,problem:problemId,error:'시작 실패: '+st.message};
 let clock=0;const tick=s=>{for(let i=0;i<s;i+=5){r.command({type:'tick',seconds:5});clock+=5;}};
 tick(5);
 const snap=()=>r.snapshot(),rows=()=>{const out={};for(const [station,s] of Object.entries(snap().ls.stations))for(const [slot,list] of Object.entries(s.windows))for(const x of list)out[x.number]={station,slot,uid:x.uid};return out;};
 const ctl=(station,action)=>r.command({type:'control',station,action:{...action,source:'LS'}});
 const findings=[],ops=[];let lastNo=0,lastSay=null;
 function act(a){
  if(a.type==='mode'){const s=snap().states[a.station];if(s.mode===a.value)return {ok:true,message:'이미 '+a.value};const o=ctl(a.station,{type:'mode',value:a.value});if(o.ok&&s.mode==='LOCAL'||/요청/.test(o.message||''))ctl(a.station,{type:'handover',accept:true});return o;}
  if(a.type==='stop'){const msgs=[];let ok=true;for(const id of a.ids){const o=ctl(a.station,{type:'stop',id});msgs.push(id+': '+o.message);if(!o.ok&&!/설정된 진로가 없습니다/.test(o.message))ok=false;if(/접근쇄정/.test(o.message||'')){const w=IL.approachTrain(a.station,id,snap().states[a.station]);findings.push({kind:'접근쇄정',step:a.text,station:a.station,signal:id,message:o.message,by:w});}}return {ok,message:msgs.join(' / ')};}
  if(a.type==='route')return ctl(a.station,{type:'route',id:a.id});
  if(a.type==='rename'){const f=rows()[a.from];if(!f)return {ok:false,message:a.from+' 열번 없음'};return r.command({type:'numbers',action:{op:'rename',...f,number:a.to}});}
  if(a.type==='move'){const f=rows()[a.number];if(!f)return {ok:false,message:a.number+' 열번 없음'};return r.command({type:'numbers',action:{op:'move',...f,targetStation:a.station,targetSlot:a.slot||'1T'}});}
  if(a.type==='delete'){const f=rows()[a.number];if(!f)return {ok:true,message:a.number+' 이미 없음'};return r.command({type:'numbers',action:{op:'delete',...f}});}
  return {ok:false,message:'모르는 조작 '+a.type};
 }
 for(const s of sc.steps){
  if(s.kind==='say'&&s.no){lastNo=s.no;lastSay=s;}
  if(s.kind==='say'){if(s.tag)r.command({type:'fts',op:'manual',key:'comm:'+s.tag,checked:true});tick(10);continue;}
  if(s.kind!=='do'||!s.act)continue;
  const a={...s.act,text:s.text};
  // 대본의 「~열차 ○○ 통과 확인 후 진로 취급」: 진로를 세우기 전에 그 역을 지나가는 중인 열차가 지나갈 때까지 기다린다 (최대 3분)
  // 원문 그 단계에 「X열차 (역) 통과 확인 후」가 있으면, X가 그 역을 지나갈 때까지(또는 관제구간을 벗어날 때까지) 기다린다 (최대 5분)
  // 대본 조작은 「n번 통보 앞」에 놓인다(emergency.js before[n]): 앞뒤 통보 단계의 원문을 함께 본다
  {const idx=sc.steps.indexOf(s),norm=t=>String(t||'').replace(/\s+/g,''),near=[lastSay,sc.steps.slice(idx).find(x=>x.kind==='say'&&x.no)].filter(Boolean).map(x=>norm(x.heading)),body=(D.scenarios[sc.key]?.steps||[]).filter(x=>near.includes(norm(x.title))).flatMap(x=>x.body),need=[...new Set(body.filter(l=>/통과 (확인|후)/.test(l)&&!/통과\s*(되기\s*)?전/.test(l)).flatMap(l=>l.match(/[KAG]\d{4}/g)||[]))];
   for(const n of need)for(let w=0;w<300;w+=10){const p=rows()[n];if(!p)break;const dir=(snap().ls.stations[p.station].windows[p.slot].find(x=>x.number===n)?.direction==='down')?1:-1;if((N.catalog[p.station].order-N.catalog[a.station].order)*dir>0)break;tick(10);}
  }
  if(a.type==='route'){for(let w=0;w<180;w+=10){const busy=(snap().scenario?.jobs||[]).some(j=>!['done','cancelled'].includes(j.phase)&&j.phase!=='waiting'&&(j.station===a.station||j.action?.targetStation===a.station))||Object.values(snap().states[a.station].routes||{}).some(x=>x.status==='APPROACH_LOCK');if(!busy)break;tick(10);}}   // 접근쇄정이 풀릴 때까지도 기다린다 (교육생처럼 — 거부 3회 감점을 피함)
  let res=act(a),waited=0;
  // 대본이 「~통과 확인 후」 등을 기다리는 조작: 최대 3분까지 다시 시도
  while(!res.ok&&waited<180){tick(10);waited+=10;res=act(a);}
  ops.push({text:s.text,ok:res.ok,waited,at:clock,status:snap().fts.session.items[0].status,elapsed:snap().fts.session.items[0].elapsed,message:res.message});
  if(!res.ok)findings.push({kind:'조작 실패',step:s.text,message:res.message});
  else if(waited>=60)findings.push({kind:'오래 기다림',step:s.text,waited,message:res.message});
  tick(5);
 }
 tick(900);
 const final=snap(),jobs=final.scenario?.jobs||[],cast=new Set([...E.numbersOf(sc),...Object.keys(rows())]);
 const stuck=[];
 for(const [number,f] of Object.entries(rows())){
  if(!cast.has(number))continue;
  const active=jobs.filter(j=>j.number===number&&!['done','cancelled'].includes(j.phase));
  if(active.length)stuck.push({number,at:f.station+':'+f.slot,phase:active[0].phase,reason:active[0].reason,next:active[0].to});
 }
 const item=final.fts.session.items[0];
 const prob=final.ftsRunLibrary.problems.find(p=>p.id===problemId),unmet=(prob.objectives||[]).filter(o=>!o.optional&&item.obj?.[o.id]==null).map(o=>o.label+(item.missed?.[o.id]!=null?' (놓침)':''));
 return {id:sc.id,problem:problemId,status:item.status,score:item.score,deducted:item.deducted,ops:ops.length,opList:ops,limit:prob.timeLimit,findings,stuck,unmet,
  trains:Object.fromEntries(Object.entries(rows()).filter(([n])=>cast.has(n)).map(([n,f])=>[n,f.station+':'+f.slot]))};
}
const list=E.list.filter(s=>!only.length||only.includes(s.id));
let results;
if(args.includes('--variants')){      // 상황별 변형 문제: 같은 대본을 본 문제처럼 진행 (상황 변경 주입 없이 처음 배치·이어 달리기 점검)
 const F=require('../engine/fts.js'),ids=F.seed().problems.filter(p=>/^P-em-/.test(p.id)&&!E.list.some(s=>'P-'+s.id===p.id)).map(p=>p.id);
 results=ids.map(pid=>{const sc=[...E.list].sort((a,b)=>b.id.length-a.id.length).find(s=>pid.startsWith('P-'+s.id+'-'));try{return audit(sc,{problemId:pid});}catch(e){return {id:pid,error:e.stack};}});
}else results=list.map(sc=>{try{return audit(sc);}catch(e){return {id:sc.id,error:e.stack};}});
if(json)console.log(JSON.stringify(results,null,1));
else for(const x of results){
 console.log(`\n=== ${x.id} (${x.problem}) ${x.error?'오류: '+x.error:`상태 ${x.status} · 점수 ${x.score} · 대본 조작 ${x.ops}개`}`);
 for(const f of x.findings||[])console.log(`  [${f.kind}] ${f.step} — ${f.message}${f.by?` (접근 판정: ${f.by.code} ${f.by.train})`:''}${f.waited?` · ${f.waited}초 대기`:''}`);
 for(const s of x.stuck||[])console.log(`  [서 있음] ${s.number} @ ${s.at} → ${s.next} · ${s.phase} · ${s.reason}`);
 for(const u of x.unmet||[])console.log('  [목표 미달] '+u);
 if(x.trains)console.log('  끝 위치: '+Object.entries(x.trains).map(([n,p])=>n+' '+p).join(', '));
}
module.exports={audit};
