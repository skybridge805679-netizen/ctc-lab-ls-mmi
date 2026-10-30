'use strict';
// Authoritative instructor session: no DOM, browser timer or renderer-local training state.
const F=require('./fts');
const clone=structuredClone,active=s=>s&&!s.finished;
function create(host){
 let library=clone(host.defaults()),users=[{role:'교수',id:'001',name:'교수'},{role:'교육생',id:'tester',name:'교육생',number:'202201'}],history=[],session=null,runLibrary=null,events=[],ui={},revision=0,sequence=0,notice=null,configured=false;
 const now=()=>host.context().now;
 const announce=(kind,text)=>{notice={id:++sequence,kind,text,index:session?.current};host.log(text,kind==='error'?'E':'I');};
 const error=r=>{if(r?.ok===false)throw Error(r.message||'현상 적용 실패');return r;};
 const current=()=>session?.items[session.current];
 const problem=it=>runLibrary.problems.find(p=>p.id===it.problem);
 const taskKey=it=>'fts:'+session.id+':'+session.current+':'+(session.attempt||0);
 function context(it,elapsed){const c=host.context(),p=problem(it);return {...c,events:events.filter(e=>e.seq>(it.eventSeq??0)&&e.source!=='FTS'),elapsed,ui,manual:session.manual[session.current]||{},script:p.script?host.scriptStatus(p.script):null};}
 function syncAssessment(it){const p=problem(it);host.beginTask({key:it.taskKey,title:p.name,subject:{'열차 운행 계획':'plan','철도관제시스템 운용':'operation','운행선 관리':'line','비상 시 조치':'emergency'}[p.subject],limitSeconds:p.limit});}
 function apply(ph){const action=(station,a)=>error(host.apply({type:'control',station,action:{...a,source:'FTS'}}));const c=host.context();switch(ph.type){
  case 'insertTrain':error(host.apply({type:'numbers',action:{op:'insert',station:ph.station,slot:ph.slot,number:ph.number,direction:ph.direction}}));break;
  case 'deleteTrain':for(const [station,s]of Object.entries(c.ls.stations))for(const [slot,rows]of Object.entries(s.windows))for(const r of [...rows])if(r.number===ph.number)error(host.apply({type:'numbers',action:{op:'delete',station,slot,uid:r.uid}}));break;
  case 'mode':if(c.states[ph.station].mode!==ph.value)action(ph.station,{type:'mode',value:ph.value});break;
  case 'route':{const before=c.states[ph.station].mode;if(before==='LOCAL')throw Error('LOCAL 역의 진로는 CCM 전환 후 설정하세요.');try{if(before!=='CCM')action(ph.station,{type:'mode',value:'CCM'});action(ph.station,{type:'route',id:ph.route});}finally{if(before!=='CCM')action(ph.station,{type:'mode',value:before});}break;}
  case 'approach':action(ph.station,{type:'approach',signal:ph.signal,present:true});break;
  case 'createTrain':{const [h,m,s=0]=ph.start.split(':').map(Number),t=host.pattern({id:ph.train,from:ph.from,to:ph.to,start:h*3600+m*60+s-28800,kind:ph.kind||'전동열차'});error(host.apply({type:'timetable',method:'create',args:[t]}));break;}
  case 'delay':error(host.apply({type:'timetable',method:'delay',args:[ph.train,ph.station,ph.minutes]}));break;
  case 'cancel':error(host.apply({type:'timetable',method:'setCancelled',args:[ph.train,ph.from,ph.to,true]}));break;
  case 'alarm':host.alarm(ph.text);break;
  case 'notice':session.notice=ph.text;break;
  default:throw Error('지원하지 않는 현상');
 }host.log('현상 발생 · '+F.PHENOMENA[ph.type].label);}
 function loadSituation(it){if(session.loadedEntry===it.situationIndex)return;host.stopScript();const s=runLibrary.situations.find(s=>s.id===it.situation),sch=runLibrary.schedules?.find(x=>x.id===s.scheduleId),t=s.timetable||sch?.timetable;if(t)error(host.apply({type:'timetable',method:'import',args:[t]}));session.loadedEntry=it.situationIndex;session.situationStartedAt=now();session.situationDeadline=s.limit?now()+s.limit:null;session.notice='';host.log('상황 시작 · '+s.name);}
 function close(reason){if(!session||session.closed)return;const t=now();host.stopScript();for(let i=session.current;i<session.items.length;i++){const it=session.items[i];if(it.status==='진행'){it.endedAt=t;it.status='종료';host.endTask(it.taskKey,'stopped');}else if(it.status==='대기'){it.status='미실시';it.endedAt=t;}}
  session.finished=true;session.closed=true;session.endedAt=t;session.reason=reason;const sum=F.summary(runLibrary,session);history.unshift({id:session.id,at:new Date().toISOString(),professor:session.professor,student:session.student,scenario:session.scenarioName,reason,duration:t-session.startedAt,overtime:Math.max(0,t-session.startedAt-(session.totalLimit||3600)),...sum,attempts:clone(session.attempts||[])});history=history.slice(0,200);host.finishAssessment();host.pause(true);announce('finished',`교육 종료 · ${session.scenarioName} · ${sum.got}/${sum.full}점 (${reason})`);
 }
 function fail(it,e){it.error=String(e.message||e);host.pause(true);announce('error','교육 현상 적용 오류 · '+it.error+' · 상황 재로딩 또는 교육 종료로 처리하세요.');}
 function ended(it,status){host.endTask(it.taskKey,status==='완료'?'completed':'stopped');host.stopScript();announce('end',`문제 ${status} · ${problem(it).name} · ${it.score}점`);}
 function step(){if(!active(session))return;const it=current();if(!it){close('모든 문제 종료');return;}if(it.error)return;
  try{loadSituation(it);
   if(session.situationDeadline!==null&&now()>=session.situationDeadline){const entry=it.situationIndex;host.stopScript();while(current()?.situationIndex===entry){const x=current();if(x.startedAt===null)x.startedAt=now();F.finish(session,x,'시간초과',now());ended(x,'시간초과');}if(session.finished)close('상황 제한시간 종료');return;}
   for(let pass=0;pass<4&&active(session);pass++){
    const out=F.advance(runLibrary,session,(x,e)=>context(x,e),now());if(!out.length)break;let again=false;
    for(const o of out){
     if(o.kind==='activate'){o.item.eventSeq=sequence;o.item.taskKey=taskKey(o.item);if(o.problem.script)error(host.startScript(o.problem.script,o.problem.train,o.item.taskKey,ui));syncAssessment(o.item);announce('activate',o.problem.voice||o.problem.name);again=true;}
     if(o.kind==='phenomenon'){apply(o.phenomenon);again=true;}
     if(o.kind==='end'){ended(o.item,o.status);again=false;}
     if(o.kind==='finished')close('모든 문제 종료');
    }if(!again)break;
   }
  }catch(e){fail(current()||it,e);}
 }
 function configure(next){const errors=F.validate(next,{scripts:host.scripts,drafts:true});if(errors.length)return {ok:false,message:errors.join('\n')};library=clone(next);library.schedules??=[];configured=true;revision++;return {ok:true};}
 function command(a){switch(a.op){
  case 'bootstrap':if(!configured){if(a.library){const r=configure(a.library);if(!r.ok)return r;}if(Array.isArray(a.history))history=clone(a.history.slice(0,200));if(Array.isArray(a.users)&&a.users.length){const r=command({op:'users',users:a.users});if(!r.ok)return r;}configured=true;}return {ok:true};
  case 'library':return configure(a.library);
  case 'users':if(!Array.isArray(a.users)||a.users.some(u=>!u||!['교수','교육생'].includes(u.role)||typeof u.id!=='string'||!u.id||typeof u.name!=='string'||!u.name)||new Set(a.users.map(u=>u.id)).size!==a.users.length)return {ok:false,message:'사용자 ID·이름·구분을 확인하세요.'};users=clone(a.users);revision++;return {ok:true};
  case 'start':{if(active(session))return {ok:false,message:'진행 중인 교육을 먼저 종료하세요.'};const sc=library.scenarios.find(s=>s.id===a.scenario);if(!sc)return {ok:false,message:'시나리오를 선택하세요.'};const sits=library.situations.filter(s=>sc.situations.includes(s.id)),pids=sits.flatMap(s=>s.problems),selected={...library,scenarios:[sc],situations:sits,problems:library.problems.filter(p=>pids.includes(p.id))};const errors=F.validate(selected,{scripts:host.scripts});if(errors.length)return {ok:false,message:errors.join('\n')};const prof=users.find(u=>u.id===a.professor&&u.role==='교수'),stud=users.find(u=>u.id===a.student&&u.role==='교육생');if(!prof||!stud)return {ok:false,message:'교수와 교육생을 선택하세요.'};configured=true;runLibrary=clone(library);session=F.createSession(runLibrary,sc.id,{professor:prof.name,student:stud.id,startedAt:now()});Object.assign(session,{id:'E'+Date.now()+'-'+(++sequence),showActions:a.showActions!==false,loadedEntry:null,attempt:0,attempts:[]});events=[];const budget=host.startAssessment();session.totalLimit=budget?.session?.limitSeconds||3600;host.pause(false);host.auto(a.autoRun!==false);announce('start','교육 시작 · '+sc.name);step();return {ok:true};}
  case 'ui':if(!a.ui||!Array.isArray(a.ui.windows)||a.ui.windows.length>100)return {ok:false,message:'화면 상태를 확인하세요.'};ui=clone(a.ui);return {ok:true};
  case 'manual':{const it=current();if(!active(session)||!it||it.error)return {ok:false,message:'진행 중인 문제가 없습니다.'};const p=problem(it),allowed=[];const visit=c=>{if(c?.type==='manual')allowed.push(c.key||c.label);if(Array.isArray(c?.conditions))c.conditions.forEach(visit);if(c?.condition)visit(c.condition);};[...(p.checks||[]),...(p.deductions||[])].forEach(k=>visit(k.condition));if(!allowed.includes(a.key))return {ok:false,message:'현재 문제의 구술 확인 항목이 아닙니다.'};const m=session.manual[session.current]??={};m[a.key]=a.checked??!m[a.key];host.log('교수 확인 · '+a.key+' · '+(m[a.key]?'확인':'취소'));return {ok:true};}
  case 'next':if(active(session)){const it=current();if(it){ended(it,'종료');F.endCurrent(session,now());if(session.finished)close('모든 문제 종료');}}return {ok:true};
  case 'stop':close('교수 종료');return {ok:true};
  case 'reload':{if(!active(session))return {ok:false,message:'진행 중인 교육이 없습니다.'};const it=current(),entry=it.situationIndex,indices=session.items.map((x,i)=>x.situationIndex===entry?i:-1).filter(i=>i>=0);session.attempts.push({entry,at:now(),items:clone(indices.map(i=>session.items[i]))});for(const i of indices){const x=session.items[i];Object.assign(x,{status:'대기',startedAt:null,endedAt:null,met:[],deducted:[],score:0});delete x.error;delete x.fired;delete session.manual[i];}session.current=indices[0];session.readyAt=now();session.loadedEntry=null;session.attempt++;host.pause(false);announce('reload','상황 재로딩 · 이전 시도 기록 보존');step();return {ok:true};}
  case 'clearHistory':history=[];return {ok:true};
  default:return {ok:false,message:'알 수 없는 FTS 명령'};
 }}
 function event(e){if(active(session)){events.push({...clone(e),seq:++sequence,at:now()});if(events.length>4000)events.shift();}}
 function checkpoint(){return clone({library,users,history,session,runLibrary,events,ui,revision,sequence,notice,configured});}
 function restore(data){if(!data){session=null;runLibrary=null;events=[];ui={};notice=null;return;}validateCheckpoint(data,host.scripts);({library,users,history,session,runLibrary,events,ui,revision,sequence,notice,configured}=clone(data));}
 return {command,step,event,checkpoint,restore,isActive:()=>active(session),ownsScript:()=>!!(active(session)&&current()&&problem(current()).script),library:()=>library,runLibrary:()=>runLibrary,snapshot:()=>({session,history,users,revision,notice})};
}
function validateCheckpoint(d,scripts){if(!d||!Number.isInteger(d.sequence)||d.sequence<0||!Number.isInteger(d.revision)||d.revision<0||F.validate(d.library,{scripts,drafts:true}).length||d.runLibrary&&F.validate(d.runLibrary,{scripts,drafts:true}).length||!Array.isArray(d.users)||d.users.some(u=>!u||typeof u.id!=='string'||typeof u.name!=='string'||!['교수','교육생'].includes(u.role))||!Array.isArray(d.history)||d.history.some(h=>!h||!Array.isArray(h.rows)||!Number.isFinite(h.got)||!Number.isFinite(h.full))||!Array.isArray(d.events)||!Number.isInteger(d.sequence)||!Number.isInteger(d.revision))throw Error('Invalid FTS checkpoint');if(d.session){const s=d.session;if(!d.runLibrary||!Array.isArray(s.items)||!Number.isInteger(s.current)||s.current<0||s.current>s.items.length||!Number.isFinite(s.startedAt)||!s.manual||s.items.some(it=>!d.runLibrary.problems.some(p=>p.id===it.problem)||!d.runLibrary.situations.some(x=>x.id===it.situation)||!Number.isInteger(it.situationIndex)||!Number.isFinite(it.score)||!Array.isArray(it.met)||!Array.isArray(it.deducted)||it.startedAt!==null&&!Number.isFinite(it.startedAt)||it.endedAt!==null&&!Number.isFinite(it.endedAt)||!['대기','진행','완료','시간초과','종료','미실시'].includes(it.status)))throw Error('Invalid FTS session');}}
module.exports={create,validateCheckpoint};
