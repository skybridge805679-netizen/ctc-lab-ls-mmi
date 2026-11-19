(function(){
'use strict';
// 모바일 리모컨: 교수 PC의 앱(원격 조작 서버)에 붙어 FTS 진행만 한다. 엔진 상태는 서버가 만든 요약(remote:view)만 받는다.
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=s=>{s=Math.max(0,Math.round(s||0));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
let net={},view=null,busy=false,signature='',opened=new Set(),lastAt=0;
async function call(action){
 const r=await fetch('/api/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
 if(r.status===401){location.replace('/');throw new Error('로그아웃');}
 const j=await r.json();if(j.error)throw new Error(j.error);if(j.net)net=j.net;if(j.view){view=j.view;lastAt=Date.now();render();}return j.result;
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
 tickClock();voicePanel(v,running,net);
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
// 음성 1인 모드: 휴대폰을 마이크로 쓴다. 「🎙 휴대폰 마이크 켜기」를 한 번 누르면 마이크 사용 동의를 받고,
// 그 뒤로는 계속 듣다가 말하는 동안의 소리를 교수 PC로 이어 보낸다. PC 앱이 받아써(Whisper) 판정한다.
// 휴대폰 브라우저는 보안 주소(https)에서만 마이크를 준다 — http로 들어왔으면 https 주소로 안내한다.
const M={on:false,stream:null,ctx:null,node:null,level:0,sent:0,busy:false,error:'',wake:null,https:0,queue:[]};
async function micOn(){
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){M.error='insecure';voiceRefresh();return;}
 try{M.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
 catch(e){M.error=e.name==='NotAllowedError'?'마이크 사용이 거부되었습니다. 브라우저 주소창의 자물쇠(또는 ⓘ) → 권한에서 마이크를 허용하세요.':'마이크를 켜지 못했습니다: '+(e.message||e.name);voiceRefresh();return;}
 M.error='';M.on=true;try{M.wake=await navigator.wakeLock?.request('screen');}catch{}
 M.ctx=new (window.AudioContext||window.webkitAudioContext)();await M.ctx.resume?.();
 const src=M.ctx.createMediaStreamSource(M.stream);M.node=M.ctx.createScriptProcessor(4096,1,1);
 // 말하는 동안(시작 0.5초 전부터, 마지막 소리 뒤 1.5초까지)의 소리를 16kHz·16비트로 바꿔 0.5초씩 이어 보낸다.
 // 어디서 한 마디를 끊을지는 PC가 정한다 (PC 마이크와 같은 규칙 · engine/voice-segment.js) — 쉬지 않고 길게 말해도 숨 고르기에서 나뉜다.
 const rate=M.ctx.sampleRate,frame=4096/rate,pre=[],PRE=Math.ceil(0.5/frame);let floor=0.005,hang=0;
 M.node.onaudioprocess=e=>{
  const x=new Float32Array(e.inputBuffer.getChannelData(0));let sum=0;for(const v of x)sum+=v*v;const rms=Math.sqrt(sum/x.length),thr=Math.max(0.012,floor*3.5);M.level=rms/thr;
  const pcm=to16k(x,rate);
  if(rms>thr){if(hang<=0){M.queue.push(...pre);pre.length=0;}hang=1.5;}else if(hang<=0){floor=floor*0.95+rms*0.05;}
  if(hang>0){M.queue.push(pcm);hang-=frame;pump();}else{pre.push(pcm);if(pre.length>PRE)pre.shift();}
 };
 src.connect(M.node);M.node.connect(M.ctx.destination);voiceRefresh();
}
function micOff(){M.on=false;M.queue=[];try{M.node?.disconnect();M.ctx?.close();}catch{}for(const t of M.stream?.getTracks()||[])t.stop();M.stream=M.ctx=M.node=null;try{M.wake?.release();}catch{}M.wake=null;voiceRefresh();}
const to16k=(x,rate)=>{const r=rate/16000,out=new Int16Array(Math.floor(x.length/r));for(let i=0;i<out.length;i++){const v=Math.max(-1,Math.min(1,x[Math.floor(i*r)]));out[i]=v<0?v*0x8000:v*0x7fff;}return out;};
// 보낼 소리를 모아 0.5초 이상이면 보낸다. 한 번에 하나씩 순서대로 (네트워크가 밀리면 최근 20초만 남긴다)
async function pump(){
 if(M.busy)return;let n=M.queue.reduce((a,c)=>a+c.length,0);if(n<8000)return;
 while(n>320000){n-=M.queue.shift().length;}
 const out=new Int16Array(n);let o=0;for(const c of M.queue){out.set(c,o);o+=c.length;}M.queue=[];
 let bin='';const u8=new Uint8Array(out.buffer);for(let i=0;i<u8.length;i+=0x8000)bin+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));
 M.busy=true;
 try{const res=await fetch('/api/audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pcm:btoa(bin)})});const j=await res.json();if(j.error){if(Date.now()-(M.toastAt||0)>5000){M.toastAt=Date.now();toast(j.error);}}else M.sent++;}catch(e){if(Date.now()-(M.toastAt||0)>5000){M.toastAt=Date.now();toast('보내지 못했습니다: '+e.message);}}
 finally{M.busy=false;if(M.on)pump();}
}
let voiceView=null;
function voicePanel(v,running,net){
 voiceView={v,running,net};if(net?.https)M.https=net.https;
 let box=$('rcVoice');
 // 음성 1인 모드 문제가 진행 중이거나, 교수 PC에서 구술 연습(말하기)을 하는 중이면 휴대폰을 마이크로 쓴다
 const kind=v.oral?'oral':v.voice&&v.problem?'voice':'';
 if(!kind){if(box)box.remove();if(M.on&&!v.voice)micOff();return;}
 if(box&&box.dataset.kind!==kind){box.remove();box=null;}
 if(!box){box=document.createElement('section');box.id='rcVoice';box.className='voice';box.dataset.kind=kind;
  box.innerHTML=`<h2>${kind==='oral'?'🎙 구술 연습 (휴대폰 마이크)':'📻 무전 (음성 1인 모드)'}</h2><div id="rcMic"></div><ul class="list" id="rcVoiceLog"></ul>
${kind==='oral'?'':`<details class="typed"><summary>마이크 대신 키보드로 보내기</summary><form id="rcVoiceForm"><textarea id="rcVoiceText" rows="2" placeholder="예: K1210열차 금천구청역 정차" enterkeyhint="send"></textarea><button type="submit" class="go">보내기</button></form></details>`}`;
  $('lists').before(box);
  const t=$('rcVoiceText');if(t){const send=async()=>{const text=t.value.trim();if(!text)return;t.value='';await act({type:'fts',op:'voice',text});};
  $('rcVoiceForm').onsubmit=e=>{e.preventDefault();send();};t.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});}
  box.addEventListener('click',e=>{if(e.target.id==='rcMicOn')micOn();if(e.target.id==='rcMicOff')micOff();});}
 voiceRefresh();
 const log=kind==='oral'?`<li class="item"><div class="tap"><b>${esc(v.oral.question||'다음 문제를 기다리는 중')}</b><small>${v.oral.total?`항목 ${v.oral.got} / ${v.oral.total}`:''}${v.oral.heard?' · 들은 말: '+esc(v.oral.heard):''}</small></div></li>`:(v.voice.heard||[]).map(h=>`<li class="item ${h.ok?'done':''}"><div class="tap"><b>${h.ok?'✔':h.partial?'◐':'✖'} ${esc(h.text)}</b><small>${h.ok?esc(h.steps.join(' / ')||'응답'):h.partial?'통보 일부 — 이어서 말하세요':'대본의 말과 맞지 않습니다 — 열차번호·역 이름을 또렷하게'}</small></div></li>`).join('')||'<li class="empty">아직 들은 무전이 없습니다.</li>';
 if($('rcVoiceLog').innerHTML!==log)$('rcVoiceLog').innerHTML=log;
}
function voiceRefresh(){
 const box=$('rcMic');if(!box)return;
 const secure=location.protocol==='https:'?'':M.https?`https://${location.hostname}:${M.https}/`:'';
 const html=M.error==='insecure'?`<p class="warn">휴대폰 마이크는 보안 주소에서만 쓸 수 있습니다.${secure?` <a href="${esc(secure)}">${esc(secure)}</a> 로 다시 접속하세요 (처음 한 번 「안전하지 않음」 경고가 나오면 [고급 → 계속]).`:''}</p>`
  :M.on?`<p class="mic-on">🎙 휴대폰 마이크로 듣는 중 <span class="meter"><i style="width:${Math.round(Math.max(0,Math.min(1,M.level/3))*100)}%"></i></span>${M.busy?' · 보내는 중…':''}</p><p class="hint">무전하듯 말하세요. 말이 끝나면 PC가 받아써 판정합니다 (보낸 말 ${M.sent}개). 화면을 켜 둔 채로 두세요.</p><button type="button" id="rcMicOff">마이크 끄기</button>`
  :`${M.error?`<p class="warn">${esc(M.error)}</p>`:''}<button type="button" class="go" id="rcMicOn">🎙 휴대폰 마이크 켜기</button><p class="hint">누르면 마이크 사용 동의를 묻습니다. 그 뒤로는 휴대폰이 계속 듣습니다.</p>`;
 if(box.dataset.html!==html){box.dataset.html=html;box.innerHTML=html;}
}
setInterval(()=>{if(M.on)voiceRefresh();},250);
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
