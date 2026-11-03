(function(root){'use strict';
const $=id=>SimDOM.document.getElementById(id),A=root.SimAssessment;let host;
const statuses={running:'진행 중',expired:'시간 종료',completed:'완료',stopped:'중지',replaced:'다음 실습으로 전환',ended:'종료',restarted:'재시작'};
const format=seconds=>{seconds=Math.max(0,Math.ceil(seconds));return Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');};
// 시험 시간은 엔진이 관리한다. 화면은 엔진 스냅샷을 그리고 명령만 보낸다.
function snapshot(){return root.SimRemote.snapshot.assessment;}
function command(op,options,key){root.SimRemote.command({type:'assessment',op,options,key});if(op==='start'||op==='begin')host.resume();render();}
function complete(key){command('complete',null,key);}
function render(){if(!host)return;
 const s=snapshot(),session=s?.session,task=s?.task;
 $('clockLabel').textContent=!session?'시험·실습 대기':session.status==='expired'?'제한시간 종료':!['running','expired'].includes(session.status)?'시험 종료':host.context().paused?'시험 일시정지':'시험 남은 시간';
 $('clock').textContent=session?format(session.remaining):'--:--';
 $('assessmentPhase').textContent=task?(A.subjects[task.subject]+(task.remaining===null?'':' · 상황 '+format(task.remaining))+(task.status==='completed'?(task.timely===false?' · 완료(시간초과)':' · 완료'):task.status==='expired'?' · 시간초과':'')):session?A.subjects[session.subject]+' · '+session.basis:'교육 설정·기록은 FTS에서';
 $('assessmentStatus').dataset.status=session?.status||'idle';
 $('pauseBtn').title='열차·대본·시험 제한시간을 함께 일시정지합니다.';$('skipBtn').title='열차·대본·시험 제한시간을 함께 10초 진행합니다.';
 if($('scTimerStatus'))$('scTimerStatus').textContent=task?`전체 남은 시간 ${format(session.remaining)} · ${task.limitSeconds===null?'과목별 독립 제한 없음':'이 문제 남은 시간 '+format(task.remaining)} · ${statuses[task.status]||task.status}`:'';
}
function init(api){host=api;render();}
root.SimAssessmentUI={init,render,snapshot,isRunning:()=>['running','expired'].includes(snapshot()?.session?.status),complete,cancel:key=>command('cancel',null,key),beginTask:(key,title,subject='operation',practiceIndex=null)=>command('begin',{key,title,subject,practiceIndex,limitSeconds:null}),finish:()=>command('finish')};
})(window);
