(function(root){'use strict';
const data=typeof module!=='undefined'?require('./assessment-data'):root.SimAssessmentData;
const subjects={plan:'열차운행계획',operation:'철도관제시스템 운용 및 실무',line:'열차운행선 관리',emergency:'비상시조치',integrated:'통합 실기'};
const limitsFor=id=>((data.emergency[id]||data.scenarios?.[id])?.minutes||[]).map(m=>m*60);
const labelSeconds=s=>Math.floor(s/60)+'분'+(s%60?' '+s%60+'초':'');
const subjectOf=sc=>sc.group==='emergency'?'emergency':sc.group==='schedule'?'plan':'operation';
function create(){
 let state={session:null,task:null,history:[],serial:0};
 const validSeconds=s=>Number.isFinite(s)&&s>=1&&s<=86400;
 const active=record=>record&&['running','expired'].includes(record.status);
 const elapsed=(r,now)=>Math.max(0,(r.endedAt??now)-r.startedAt);
 const view=(r,now)=>r?{...r,elapsed:elapsed(r,now),remaining:r.limitSeconds===null?null:Math.max(0,r.limitSeconds-elapsed(r,now)),overtime:r.limitSeconds===null?0:Math.max(0,elapsed(r,now)-r.limitSeconds)}:null;
 function archive(r){if(r)state.history.unshift({...r});state.history=state.history.slice(0,100);}
 function finishTask(now,result='completed',key){if(!active(state.task)||key&&state.task.key!==key)return;state.task={...state.task,status:result,endedAt:now,timely:state.task.limitSeconds===null?null:elapsed(state.task,now)<=state.task.limitSeconds};archive(state.task);}
 function finish(now,result='ended'){finishTask(now,result==='ended'?'stopped':result);if(active(state.session)){state.session={...state.session,status:result,endedAt:now,timely:elapsed(state.session,now)<=state.session.limitSeconds};archive(state.session);}}
 function start({seconds=data.totalSeconds,subject='integrated'}={},now){if(!validSeconds(seconds)||!subjects[subject])throw Error('시험 시간과 과목을 확인하세요.');finish(now,'restarted');state.session={key:'exam-'+(++state.serial),title:subjects[subject],subject,limitSeconds:seconds,startedAt:now,status:'running',basis:seconds===data.totalSeconds?'교재 전체 60분':'사용자 설정'};state.task=null;return snapshot(now);}
 function begin({key,title,subject='operation',limitSeconds=null,practiceIndex=null}={},now){if(!key||!title||!subjects[subject]||limitSeconds!==null&&!validSeconds(limitSeconds))throw Error('실습 시간 설정을 확인하세요.');if(!active(state.session))start({},now);if(state.task?.key===key&&active(state.task))return;finishTask(now,'replaced');state.task={key,title,subject,limitSeconds,practiceIndex,startedAt:now,status:'running'};}
 function beginScenario(sc,run,now,limitSeconds){const options=limitsFor(sc.id);if(limitSeconds===undefined)limitSeconds=options[0]??null;run.assessmentKey??='scenario:'+sc.id+':'+run.started+':'+(++state.serial);begin({key:run.assessmentKey,title:sc.title,subject:subjectOf(sc),limitSeconds},now);}
 function update(now){const events=[];for(const key of ['session','task']){const r=state[key];if(r?.status==='running'&&r.limitSeconds!==null&&elapsed(r,now)>=r.limitSeconds){r.status='expired';events.push({key:r.key,text:r.title+' 제한시간 종료 · 조작과 열차 운행은 계속됩니다.'});}}return events;}
 function snapshot(now){return {session:view(state.session,now),task:view(state.task,now),history:state.history.map(r=>view(r,r.endedAt))};}
 function restore(saved){if(!saved){state={session:null,task:null,history:[],serial:0};return;}const copy=structuredClone(saved);if(!Array.isArray(copy.history)||!Number.isInteger(copy.serial))throw Error('Invalid assessment checkpoint');for(const r of [copy.session,copy.task,...copy.history])if(r&&(!Number.isFinite(r.startedAt)||r.limitSeconds!==null&&!validSeconds(r.limitSeconds)))throw Error('Invalid assessment time');state=copy;}
 return {start,begin,beginScenario,finishTask,finish,update,snapshot,checkpoint:()=>structuredClone(state),restore};
}
const api={data,subjects,limitsFor,labelSeconds,subjectOf,create};if(typeof module!=='undefined')module.exports=api;else root.SimAssessment=api;
})(typeof globalThis!=='undefined'?globalThis:this);
