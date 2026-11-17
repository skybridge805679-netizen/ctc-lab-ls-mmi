(function(){
'use strict';
// 모바일 리모컨: 교수 PC의 앱(원격 조작 서버)에 붙어 FTS 진행만 한다. 엔진 상태는 서버가 만든 요약(remote:view)만 받는다.
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=s=>{s=Math.max(0,Math.round(s||0));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
let view=null,busy=false,signature='',opened=new Set(),lastAt=0;
async function call(action){
 const r=await fetch('/api/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
 if(r.status===401){location.replace('/');throw new Error('로그아웃');}
 const j=await r.json();if(j.error)throw new Error(j.error);if(j.view){view=j.view;lastAt=Date.now();render();}return j.result;
}
function toast(text){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),1800);}
function ask(text){return new Promise(res=>{const d=$('confirm');$('confirmText').textContent=text;$('yes').onclick=()=>{d.close();res(true);};$('no').onclick=()=>{d.close();res(false);};d.showModal();});}
async function act(action,done){if(busy)return;busy=true;try{const r=await call(action);if(r&&r.ok===false)toast(r.message||'처리하지 못했습니다.');else if(done)toast(done);}catch(e){toast(e.message);}finally{busy=false;}}
function render(){
 const v=view||{active:false},running=v.active&&!v.finished;
 $('scenario').textContent=v.scenario||'진행 중인 교육 없음';$('people').textContent=v.professor?`교수: ${v.professor} · 교육생: ${v.student}`:'아래에서 시나리오를 골라 시작하세요';
 $('problem').textContent=v.problem?.name||'진행 중인 교육이 없습니다';$('progress').textContent=v.total?`문제 ${v.index+1} / ${v.total}`:'';
 $('status').textContent=v.finished?'교육 종료':v.problem?.status||'';$('status').hidden=!$('status').textContent;
 $('error').hidden=!v.problem?.error;$('error').textContent=v.problem?.error||'';
 for(const id of ['reload','next','stop'])$(id).disabled=!running;
 tickClock();voicePanel(v,running);
 const sig=JSON.stringify([v.index,v.finished,v.problem?.status,v.comms,v.branches,v.manual,v.result,[...opened]]);if(sig===signature)return;signature=sig;
 if(!v.problem){$('lists').innerHTML=startForm(v.setup);return;}
 const next=(v.comms||[]).find(c=>c.at==null&&!c.optional)||(v.comms||[]).find(c=>c.at==null);
 let html='';
 if(v.result)html+=`<div class="result">결과 ${v.result.got}/${v.result.full}점 (${v.result.percent}%)</div>`;
 if(v.comms?.length){const left=v.comms.filter(c=>c.at==null&&!c.optional).length;html+=`<h2>통보 확인 · 남은 ${left}개</h2><ul class="list">`+v.comms.map(c=>`<li class="item ${c.at!=null?'done':''} ${c===next&&running?'next':''}"><button type="button" class="tap" data-key="${esc(c.key)}" ${c.at!=null||!running?'disabled':''}><b>${esc(c.label)}</b><small>${c.at!=null?'확인 '+clock(c.at):c===next?'다음 통보 · 교육생이 말하면 누르세요':'확인 대기'}</small></button>${c.text?`<button type="button" class="more" data-open="${esc(c.key)}" aria-expanded="${opened.has(c.key)}">${opened.has(c.key)?'접기':'대본'}</button>`:''}</li>${opened.has(c.key)?`<li class="text">${esc(c.text)}</li>`:''}`).join('')+'</ul>';}
 if(v.manual?.length)html+=`<h2>구술 확인</h2><div class="chips">`+v.manual.map(m=>`<button type="button" class="chip ${m.on?'on':''}" data-key="${esc(m.key)}" ${!running?'disabled':''}>${m.on?'✔ ':''}${esc(m.label)}</button>`).join('')+'</div>';
 if(v.branches?.length)html+=`<h2>상황 변경 (감독관 주입)</h2><ul class="list">`+v.branches.map(b=>`<li class="item branch ${b.at!=null?'done':''}"><button type="button" class="tap" data-branch="${esc(b.key)}" data-label="${esc(b.label)}" ${b.at!=null||!running||v.problem.status!=='진행'?'disabled':''}><b>${esc(b.label)}</b><small>${b.at!=null?'주입 '+clock(b.at):'누르면 상황을 바꿉니다'}</small></button></li>`).join('')+'</ul>';
 if(v.finished&&v.setup)html+=startForm(v.setup,'새 교육 시작');
 $('lists').innerHTML=html||'<p class="empty">이 문제에는 교수가 누를 항목이 없습니다.</p>';
}
// 교육 시작: 시나리오 · 교수 · 교육생을 골라 리모컨에서 바로 시작 (교수 PC의 FTS 교육설정과 같은 명령)
let pick={scenario:'',filter:''};
function startForm(setup,title='교육 시작'){
 if(!setup)return '<p class="empty">교수 PC에 연결 중입니다…</p>';
 const sel=(id,list,label)=>`<label class="field"><span>${label}</span><select id="${id}">${list.map(u=>`<option value="${esc(u.id)}">${esc(u.name||u.id)}${u.name&&u.name!==u.id?' ('+esc(u.id)+')':''}</option>`).join('')}</select></label>`;
 const shown=setup.scenarios.filter(s=>!pick.filter||s.name.includes(pick.filter));
 return `<h2>${title}</h2><div class="start">${sel('rcProf',setup.professors,'교수')}${sel('rcStud',setup.students,'교육생')}
<label class="field"><span>시나리오 찾기</span><input id="rcFilter" type="search" placeholder="예: 비상시조치, 구술" value="${esc(pick.filter)}"></label></div>
<ul class="list">${shown.map(s=>`<li class="item ${pick.scenario===s.id?'next':''}"><button type="button" class="tap" data-scenario="${esc(s.id)}"><b>${esc(s.name)}</b><small>문제 ${s.count}개</small></button></li>`).join('')||'<li class="empty">맞는 시나리오가 없습니다.</li>'}</ul>
<div class="start"><button type="button" id="rcStart" class="go" ${pick.scenario?'':'disabled'}>${pick.scenario?'선택한 시나리오로 교육 시작':'시나리오를 고르세요'}</button></div>`;
}
// 음성 1인 모드: 휴대폰을 마이크로 쓴다. 휴대폰 키보드의 음성 입력(🎤)으로 무전을 말하면 받아쓴 글을 교수 PC에 보낸다
// (이 리모컨은 같은 네트워크의 http 주소라 웹페이지가 마이크를 직접 쓸 수 없다 — 키보드 음성 입력은 된다)
function voicePanel(v,running){
 let box=$('rcVoice');
 if(!v.voice||!v.problem){if(box)box.remove();return;}
 if(!box){box=document.createElement('section');box.id='rcVoice';box.className='voice';
  box.innerHTML=`<h2>📻 무전 (음성 1인 모드)</h2><p class="hint">입력칸을 누르고 키보드의 🎤 음성 입력으로 무전하듯 말한 뒤 [보내기]. 말이 끝날 때마다 한 마디씩 보내세요.</p>
<form id="rcVoiceForm"><textarea id="rcVoiceText" rows="2" placeholder="예: K1210열차 금천구청역 정차" enterkeyhint="send"></textarea><button type="submit" class="go">보내기</button></form><ul class="list" id="rcVoiceLog"></ul>`;
  $('lists').before(box);
  const t=$('rcVoiceText');
  const send=async()=>{const text=t.value.trim();if(!text)return;t.value='';await act({type:'fts',op:'voice',text});};
  $('rcVoiceForm').onsubmit=e=>{e.preventDefault();send();};
  t.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});}
 $('rcVoiceText').disabled=!running;
 const log=(v.voice.heard||[]).map(h=>`<li class="item ${h.ok?'done':''}"><div class="tap"><b>${h.ok?'✔':'✖'} ${esc(h.text)}</b><small>${h.ok?esc(h.steps.join(' / ')||'응답'):'대본의 말과 맞지 않습니다 — 열차번호·역 이름을 또렷하게'}</small></div></li>`).join('')||'<li class="empty">아직 보낸 무전이 없습니다.</li>';
 if($('rcVoiceLog').innerHTML!==log)$('rcVoiceLog').innerHTML=log;
}
function tickClock(){const v=view;if(!v?.problem){$('remaining').textContent='--:--';return;}const live=v.active&&!v.finished&&v.problem.status==='진행',r=Math.max(0,v.remaining-(live?(Date.now()-lastAt)/1000:0));$('remaining').textContent=clock(r);document.querySelector('.clock').classList.toggle('low',live&&r<=60);}
$('lists').addEventListener('input',e=>{if(e.target.id==='rcFilter'){pick.filter=e.target.value.trim();const keep=[$('rcProf')?.value,$('rcStud')?.value];signature='';render();const f=$('rcFilter');if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length);}if(keep[0]&&$('rcProf'))$('rcProf').value=keep[0];if(keep[1]&&$('rcStud'))$('rcStud').value=keep[1];}});
$('lists').addEventListener('click',async e=>{
 const sc=e.target.closest('[data-scenario]');if(sc){const keep=[$('rcProf')?.value,$('rcStud')?.value];pick.scenario=sc.dataset.scenario;signature='';render();if(keep[0]&&$('rcProf'))$('rcProf').value=keep[0];if(keep[1]&&$('rcStud'))$('rcStud').value=keep[1];return;}
 if(e.target.id==='rcStart'&&pick.scenario){const name=view?.setup?.scenarios.find(s=>s.id===pick.scenario)?.name||'';if(await ask(`「${name}」 교육을 시작할까요?`)){const professor=$('rcProf').value,student=$('rcStud').value;await act({type:'fts',op:'start',scenario:pick.scenario,professor,student},'교육 시작');pick.scenario='';}return;}
 const open=e.target.closest('[data-open]');if(open){const k=open.dataset.open;opened.has(k)?opened.delete(k):opened.add(k);render();return;}
 const b=e.target.closest('[data-branch]');if(b&&!b.disabled){if(await ask(`상황 변경 「${b.dataset.label}」을(를) 주입할까요? 되돌릴 수 없습니다.`))act({type:'fts',op:'manual',key:b.dataset.branch},'상황 변경 주입');return;}
 const t=e.target.closest('[data-key]');if(t&&!t.disabled){navigator.vibrate?.(20);act({type:'fts',op:'manual',key:t.dataset.key});}
});
$('reload').onclick=async()=>{if(await ask('이 상황을 처음부터 다시 로딩할까요?'))act({type:'fts',op:'reload'},'상황 재로딩');};
$('next').onclick=async()=>{if(await ask('지금 문제를 종료하고 다음 문제로 넘어갈까요?'))act({type:'fts',op:'next'},'문제 종료');};
$('stop').onclick=async()=>{if(await ask('교육을 종료할까요?'))act({type:'fts',op:'stop'},'교육 종료');};
async function poll(){if(!busy){try{await call({type:'remote:view'});}catch(e){if(e.message!=='로그아웃')$('scenario').textContent='연결 끊김 · 다시 연결 중…';}}setTimeout(poll,1000);}
setInterval(tickClock,250);poll();
})();
