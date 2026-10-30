(function(root){'use strict';
const $=id=>SimDOM.document.getElementById(id),A=root.SimAssessment,local=A.create(),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let host;
const now=()=>host?.context().state.clock||0;
const statuses={running:'진행 중',expired:'시간 종료',completed:'완료',stopped:'중지',replaced:'다음 실습으로 전환',ended:'종료',restarted:'재시작'};
const format=seconds=>{seconds=Math.max(0,Math.ceil(seconds));return Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');};
function snapshot(){return root.SimRemote?root.SimRemote.snapshot.assessment:local.snapshot(now());}
function command(op,options,key){if(root.SimRemote)root.SimRemote.command({type:'assessment',op,options,key});else{if(op==='start')local.start(options,now());if(op==='begin')local.begin(options,now());if(op==='complete'||op==='cancel')local.finishTask(now(),op==='complete'?'completed':'stopped',key);if(op==='finish')local.finish(now());}if(op==='start'||op==='begin')host.resume();render();}
function beginScenario(sc,run,limit){if(!root.SimRemote){local.beginScenario(sc,run,now(),limit);host.resume();render();}}
function complete(key){command('complete',null,key);}
function render(){if(!host)return;if(!root.SimRemote)for(const e of local.update(now()))root.SimMMI?.log('event',e.text);
 const s=snapshot(),session=s?.session,task=s?.task;
 $('clockLabel').textContent=!session?'시험·실습 대기':session.status==='expired'?'제한시간 종료':!['running','expired'].includes(session.status)?'시험 종료':host.context().paused?'시험 일시정지':'시험 남은 시간';
 $('clock').textContent=session?format(session.remaining):'--:--';
 $('assessmentPhase').textContent=task?(A.subjects[task.subject]+(task.remaining===null?'':' · 상황 '+format(task.remaining))+(task.status==='completed'?(task.timely===false?' · 완료(시간초과)':' · 완료'):task.status==='expired'?' · 시간초과':'')):session?A.subjects[session.subject]+' · '+session.basis:'선택한 실습을 시작하세요';
 $('assessmentBtn').dataset.status=session?.status||'idle';$('assessmentBtn').title=task?task.title+' · 진행 상태와 시간 기준 보기':'교재 기준 통합 60분 · 과목별 임의 배분 없음';
 $('pauseBtn').title='열차·대본·시험 제한시간을 함께 일시정지합니다.';$('skipBtn').title='열차·대본·시험 제한시간을 함께 10초 진행합니다.';
 if($('scTimerStatus'))$('scTimerStatus').textContent=task?`전체 ${format(session.remaining)} · ${task.limitSeconds===null?'과목별 독립 제한 없음':'상황 '+format(task.remaining)} · ${statuses[task.status]||task.status}`:'';
}
function open(){
 const s=snapshot(),task=s?.task,session=s?.session;
 host.openAction('시험·실습 시간',`<p>교재의 통합 실기 기준은 <b>60분</b>입니다. 열차운행계획·시스템운용·운행선 관리의 시간을 임의로 나누지 않습니다. 과목과 시나리오를 바꿔도 전체 남은 시간은 이어집니다.</p><p>열차·대본과 같은 실습 가상시간을 씁니다. 일시정지·배속·+10초는 카운트다운에도 반영됩니다. 시간 종료 후에도 LS 조작과 운행을 계속하며 시간 내 완료 여부를 기록합니다.</p><label class="field-label" for="assessmentSubject">실습 범위</label><select id="assessmentSubject">${Object.entries(A.subjects).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select><label class="field-label" for="assessmentMinutes">전체 제한시간 (분)</label><input id="assessmentMinutes" type="number" min="1" max="1440" step="1" value="60"><p>60분 이외의 값은 사용자 설정으로 기록합니다. 출처: 실무5 PDF 2·10·202쪽. 비상 대본의 별도 시간은 시나리오 창에서 선택합니다.</p>${task?`<p><b>${esc(task.title)}</b><br>${esc(A.subjects[task.subject])} · ${task.limitSeconds===null?'독립 제한 없음':format(task.remaining)+' 남음'} · ${esc(statuses[task.status]||task.status)}<br>전체 잔여 ${format(session.remaining)}</p>`:''}<div class="assessment-actions"><button type="button" id="assessmentStart" class="primary">${session&&['running','expired'].includes(session.status)?'새 시험 시작':'시험 시작'}</button>${session?'<button type="button" id="assessmentFinish">시험 종료·기록</button>':''}</div><p>최근 기록: ${(s?.history||[]).slice(0,4).map(r=>esc(r.title)+' '+format(r.elapsed)+(r.timely===false?' (시간초과)':'')+' · '+esc(statuses[r.status]||r.status)).join('<br>')||'없음'}</p>`,null,'닫기');
 $('assessmentStart').onclick=()=>{const minutes=Number($('assessmentMinutes').value);if(!Number.isInteger(minutes)||minutes<1||minutes>1440){$('assessmentMinutes').reportValidity();return;}command('start',{seconds:minutes*60,subject:$('assessmentSubject').value});$('actionDialog').close();host.render();};
 if($('assessmentFinish'))$('assessmentFinish').onclick=()=>{command('finish');$('actionDialog').close();host.render();};
}
function init(api){host=api;$('assessmentBtn').onclick=open;render();}
root.SimAssessmentUI={init,render,snapshot,isRunning:()=>['running','expired'].includes(snapshot()?.session?.status),beginScenario,complete,cancel:key=>command('cancel',null,key),beginTask:(key,title,subject='operation',practiceIndex=null)=>command('begin',{key,title,subject,practiceIndex,limitSeconds:null}),finish:()=>command('finish')};
})(window);
