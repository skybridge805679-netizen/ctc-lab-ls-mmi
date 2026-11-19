'use strict';
// 음성 1인 모드 점검: 비상시조치 대본을 「대본대로 말하는 교육생」으로 끝까지 진행한다.
//  통보 단계마다 관제사의 말을 한 마디씩 음성 입력(op:'voice')으로 넣고, 대본의 LS 조작은 그 자리에서 한다.
//  알아듣지 못한 말, 통보가 확인되지 않은 곳, 정차 지시가 늦어 지나친 열차, 끝까지 서 있는 열차를 보고한다.
//  사용: node simulator/tools/audit-voice.cjs [em-05-1 ...] [--say 3] [--split] [--noisy]
//   --say: 한 마디에 걸리는 초 · --split: 긴 말을 문장마다 나눠 말함(숨 쉬며 말하기) · --noisy: 받아쓰기가 비슷한 소리로 틀림(받침 빠짐·ㅐ/ㅔ 바뀜)
const R=require('../engine/runtime.cjs'),E=require('../engine/emergency.js'),V=require('../engine/voice.js'),F=require('../engine/fts.js');
const args=process.argv.slice(2),only=args.filter(a=>/^em-/.test(a)),per=Number(args[args.indexOf('--say')+1])||3,SPLIT=args.includes('--split'),NOISY=args.includes('--noisy');
// 받아쓰기 흉내: 한글 음절 일곱 개 중 하나꼴로 받침을 빼거나 ㅐ↔ㅔ를 바꾼다 (열번·숫자는 그대로)
function noisy(t){let i=0;return [...t].map(ch=>{const c=ch.charCodeAt(0)-0xAC00;if(c<0||c>11171||(++i)%7)return ch;const a=Math.floor(c/588),m=Math.floor(c%588/28),f=c%28;return String.fromCharCode(0xAC00+a*588+(m===1?5:m===5?1:m)*28+(f&&i%2?0:f));}).join('');}
function audit(sc){
 const pid='P-'+sc.id,r=R.create(),lib=r.snapshot().ftsLibrary;
 lib.situations.push({id:'S-V',name:'v',problems:[pid]});lib.scenarios.push({id:'SC-V',name:'v',situations:['S-V']});
 r.command({type:'fts',op:'library',library:lib});const st=r.command({type:'fts',op:'start',scenario:'SC-V',professor:'001',student:'tester',autoRun:false,voice:true});if(!st.ok)return {id:sc.id,error:st.message};
 const tick=s=>{for(let i=0;i<s;i+=1)r.command({type:'tick',seconds:1});},snap=()=>r.snapshot();
 const rows=()=>{const o={};for(const [station,s] of Object.entries(snap().ls.stations))for(const [slot,l] of Object.entries(s.windows))for(const x of l)o[x.number]={station,slot,uid:x.uid};return o;};
 const ctl=(station,a)=>r.command({type:'control',station,action:{...a,source:'LS'}});
 const act=a=>{
  if(a.type==='mode'){if(snap().states[a.station].mode===a.value)return {ok:true};const o=ctl(a.station,{type:'mode',value:a.value});if(/요청/.test(o.message||''))ctl(a.station,{type:'handover',accept:true});return o;}
  if(a.type==='stop'){let ok=true;for(const id of a.ids){const o=ctl(a.station,{type:'stop',id});if(!o.ok&&!/설정된 진로가 없습니다/.test(o.message))ok=false;}return {ok};}
  if(a.type==='route'){for(let w=0;w<120&&Object.values(snap().states[a.station].routes||{}).some(x=>x.status==='APPROACH_LOCK');w++)tick(1);return ctl(a.station,{type:'route',id:a.id});}
  if(a.type==='rename'){const f=rows()[a.from];return f?r.command({type:'numbers',action:{op:'rename',...f,number:a.to}}):{ok:false,message:a.from+' 없음'};}
  if(a.type==='move'){const f=rows()[a.number];return f?r.command({type:'numbers',action:{op:'move',...f,targetStation:a.station,targetSlot:a.slot||'1T'}}):{ok:false,message:a.number+' 없음'};}
  if(a.type==='delete'){const f=rows()[a.number];return f?r.command({type:'numbers',action:{op:'delete',...f}}):{ok:true};}
  return {ok:false,message:a.type};};
 const P=V.plan(F.view(snap().ftsRunLibrary.problems.find(p=>p.id===pid),snap().fts.session.items[0])),issues=[];
 for(const s of sc.steps){
  if(s.kind==='do'&&s.act){
   // 교육생처럼: 그 역에서 움직이는 열차가 지나가고, 문구의 「○○열차 … 통과 확인 후」 열차가 그 역을 지날 때까지 기다린다
   if(s.act.type==='route')for(let w=0;w<180&&(snap().scenario?.jobs||[]).some(j=>!['done','cancelled','waiting'].includes(j.phase)&&(j.station===s.act.station||j.action?.targetStation===s.act.station));w+=5)tick(5);
   for(const n of /통과 확인 후/.test(s.text)?s.text.match(/[KAG]\d{4}/g)||[]:[])for(let w=0;w<300;w+=5){const f=rows()[n];if(!f)break;const N=require('../engine/network.js'),dir=snap().ls.stations[f.station].windows[f.slot].find(x=>x.number===n)?.direction==='down'?1:-1;if((N.catalog[f.station].order-N.catalog[s.act.station].order)*dir>0)break;tick(5);}
   if(process.env.VDEBUG&&s.act.type==='route')console.log('   before',s.text.slice(0,30),JSON.stringify((snap().scenario?.jobs||[]).filter(j=>!['done','cancelled'].includes(j.phase)&&/G0450|K0456/.test(j.number)).slice(0,3).map(j=>[j.number,j.phase,j.to,j.reason])));
   let o=act(s.act),w=0;while(!o.ok&&w<90){tick(5);w+=5;o=act(s.act);}if(!o.ok)issues.push('조작 실패 · '+s.text+' · '+(o.message||''));tick(2);continue;}
  if(s.kind!=='say'||!s.tag)continue;
  for(const step of P.steps.filter(x=>x.comm===s.tag&&x.required)){
   const v=snap().fts.session.voice.items[0];if(v.done[step.id]!=null){continue;}
   if(snap().fts.session.items[0].status!=='진행'){if(!issues.some(i=>i.startsWith('시간 종료')))issues.push('시간 종료 · '+step.id+'부터 말하지 못함 (문제 제한시간)');continue;}
   const split=t=>String(t).split(/(?<=[.!?])\s+|\s*\/\s*/).map(x=>x.trim()).filter(x=>x.replace(/[^가-힣A-Z0-9]/g,'').length>=4),parts=SPLIT&&split(step.text).length>1?split(step.text):[step.text];let o;
   for(const [k,part] of parts.entries()){o=r.command({type:'fts',op:'voice',text:NOISY?noisy(part):part});if(k<parts.length-1)tick(2);}
   if(snap().fts.session.voice.items[0].done[step.id]!=null&&!o.matched?.some(m=>m.id===step.id))o={...o,matched:[...(o.matched||[]),{id:step.id}]};      // 앞 마디에서 이미 인정됨if(process.env.VDEBUG)console.log('   ',step.id,'=>',o.matched?.map(m=>m.id).join(',')||o.message,(()=>{const f=rows()['G0450']||rows()['K0450'];const j=(snap().scenario?.jobs||[]).find(j=>/0450/.test(j.number)&&!['done','cancelled'].includes(j.phase));return JSON.stringify(f&&[f.station,f.slot])+' '+(j?j.phase+'>'+j.to+' '+j.reason:'-');})());
   if(!o.matched?.some(m=>m.id===step.id))issues.push(`못 알아들음 · ${step.id} · 「${step.text.slice(0,40)}」 → ${o.matched?.map(m=>m.id).join(',')||'없음'}`);
   tick(per);
  }
  if(!snap().fts.session.manual[0]?.['comm:'+s.tag])issues.push('통보 미확인 · '+s.tag);
 }
 tick(600);
 const S=snap(),it=S.fts.session.items[0],prob=S.ftsRunLibrary.problems.find(p=>p.id===pid);
 const late=S.fts.logs.filter(l=>/이미 .*지났습니다/.test(l.text)).map(l=>l.text.replace('음성 · ',''));
 const stuck=Object.entries(rows()).filter(([n])=>S.scenario.jobs.some(j=>j.number===n&&!['done','cancelled'].includes(j.phase))).map(([n,f])=>n+'@'+f.station+':'+f.slot);
 return {id:sc.id,status:it.status,score:it.score,issues,late,stuck,unmet:(prob.objectives||[]).filter(o=>!o.optional&&it.obj?.[o.id]==null).map(o=>o.label),left:Object.entries(rows()).map(([n,f])=>n+'@'+f.station+':'+f.slot)};
}
for(const sc of E.list.filter(s=>!only.length||only.includes(s.id))){let x;try{x=audit(sc);}catch(e){x={id:sc.id,error:e.stack};}
 console.log(`\n=== ${x.id} ${x.error?'오류 '+x.error:`상태 ${x.status} · 점수 ${x.score}`}`);
 for(const i of x.issues||[])console.log('  ['+i.split(' · ')[0]+'] '+i.split(' · ').slice(1).join(' · '));
 for(const l of x.late||[])console.log('  [늦은 정차] '+l);
 for(const u of x.unmet||[])console.log('  [목표 미달] '+u);
 if(x.left)console.log('  끝 위치: '+x.left.join(', '));}
