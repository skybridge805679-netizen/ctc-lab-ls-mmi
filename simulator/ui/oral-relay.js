(function(root){
'use strict';
// 구술 릴레이 (운행선관리 구술 연습): 문제가 하나씩 뜨고, 교육생이 말하면(음성인식) 핵심 항목이 하나씩 체크된다.
//  · 항목을 다 말하면 즉시 끝, 제한 시간(기본 120초)이 지나도 끝. 다 말했으면 「이상입니다」(못 말한 항목은 오답), 모르면 「패스」.
//  · 끝나면 점수(부분점수)와 모범 답안 전체를 보여 주고, 말하지 못한 항목은 굵은 빨간 글씨로 표시한다. 몇 초 뒤 다음 문제.
//  · 출제는 간격 반복(틀린 문제는 곧 다시, 맞힌 문제는 뜸하게). 기록은 이 컴퓨터에 남는다.
// 마이크·받아쓰기는 음성 1인 모드의 것을 빌려 쓴다 (SimVoiceSolo.attach). 휴대폰 리모컨 마이크도 그대로 된다.
const R=()=>root.SimOralRelay,VS=()=>root.SimVoiceSolo;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY={settings:'orpheia-oral-settings-v1',stats:'orpheia-oral-srs-v1',log:'orpheia-oral-log-v1'};
const load=(k,d)=>{try{const v=JSON.parse(root.localStorage.getItem(k));return v??d;}catch{return d;}};
const save=(k,v)=>{try{root.localStorage.setItem(k,JSON.stringify(v));}catch{}};
const DEFAULT={mode:'speak',scope:'all',limit:120,gap:5,srs:true,read:false};      // mode: speak 말하기 · card 카드 · type 타이핑 (세 모드가 같은 간격 반복 기록을 쓴다)
const MODE={speak:'말하기',card:'카드',type:'타이핑'};
const settings=()=>({...DEFAULT,...load(KEY.settings,{})});
let win=null,doc=null,run=null;
// ── 창: 문제 발생 화면처럼 LS 창에서 띄우는 독립 창 (팝업이 막히면 이 창 안에 띄운다)
function openWindow(){
 if(win&&!win.closed){win.focus();return doc;}
 const w=root.open('about:blank','orpheia-oral-'+Date.now(),'popup,width=1100,height=860,resizable=yes,scrollbars=yes');
 if(w){win=w;doc=w.document;doc.title='ORPHEIA · 구술 연습';doc.documentElement.lang='ko';
  const base=doc.createElement('base');base.href=root.document.baseURI;doc.head.appendChild(base);
  for(const css of root.document.querySelectorAll('link[rel="stylesheet"]')){const l=doc.createElement('link');l.rel='stylesheet';l.href=css.href;doc.head.appendChild(l);}
  doc.body.className='oral-detached';doc.body.innerHTML='<main id="oralRoot" class="oral"></main>';
  w.addEventListener('beforeunload',()=>stop(true));return doc;}
 // 팝업이 막힌 환경: 같은 창 위에 띄운다
 doc=root.document;let box=doc.getElementById('oralOverlay');if(!box){box=doc.createElement('div');box.id='oralOverlay';box.className='oral-overlay';box.innerHTML='<main id="oralRoot" class="oral"></main>';doc.body.appendChild(box);}box.hidden=false;return doc;
}
const $=id=>doc?.getElementById(id);
// ── 진행
function start(opts){
 const s={...settings(),...opts};save(KEY.settings,s);
 const items=R().pool(s.scope);if(!items.length){root.alert?.('이 범위에는 문제가 없습니다.');return;}
 openWindow();run={s,items,recent:[],results:[],phase:'idle',q:null,paused:false,timer:0};
 if(s.mode==='speak')VS()?.attach(consumer);      // 마이크는 말하기 모드에서만
 bindKeys();next();
}
// 마이크 빌려 쓰기: 길게 이어 말하므로 숨 고르기에서 자르고(10~20초 — 측정해 보니 6~12초보다 Whisper가 덜 빠뜨린다), 말하는 동안에도 중간 받아쓰기로 미리 체크한다.
// 힌트에는 그 문제의 핵심 단어와 직전까지 받아쓴 글의 끝을 넣는다 (잘린 마디 앞뒤가 이어진다)
// 휴대폰 리모컨에 알린다: 구술 연습(말하기) 중이면 리모컨에 휴대폰 마이크 버튼과 지금 문제가 뜬다
function tell(on){if(run?.s.mode!=='speak'&&on)return;const q=run?.q;try{root.SimRemote?.command?.({type:'fts',op:'oral',on:!!on,question:q?.item.q||'',got:q?.done.length||0,total:q?.item.key.length||0,heard:q?.heard.at(-1)?.text||''});}catch{}}
const consumer={onText:text=>heard(text),onPartial:text=>partial(text),live:true,segment:{soft:10,gap:0.25,hard:20},hint:()=>run?.q?R().hint(run.q.item,run.q.transcript):''};
function next(){
 if(!run)return;clearTimeout(run.wait);const stats=load(KEY.stats,{});
 const item=R().pick(run.items,stats,{recent:run.recent,srs:run.s.srs});
 run.recent=[...run.recent,item.id].slice(-Math.min(5,Math.max(0,run.items.length-1)));
 run.q={item,transcript:'',heard:[],done:[],t0:Date.now(),limit:Math.max(10,Number(run.s.limit)||120)};run.phase='ask';
 render();tell(true);if(run.s.read&&run.s.mode==='speak')VS()?.announce(item.q);
 clearInterval(run.timer);if(run.s.mode!=='card')run.timer=setInterval(tick,250);      // 카드는 시간 제한 없음
 if(run.s.mode==='type')setTimeout(()=>$('oralType')?.focus(),0);
}
// 중간 받아쓰기: 아직 끝나지 않은 마디의 글로 미리 체크한다 (체크는 되돌리지 않는다). 마디가 끝나 확정된 글이 오면 버린다
function partial(text){if(!run||!['ask','grace'].includes(run.phase)||!text)return;const q=run.q;q.partial=text;
 const newly=R().check(q.item,q.transcript+' '+text,q.done);if(!newly.length){render();return;}q.done.push(...newly);q.live=(q.live||0)+newly.length;
 render();if(q.done.length===q.item.key.length)finish('all');}
// 시간이 끝났을 때 하던 말: 마저 받아쓴 뒤(최대 5초) 채점한다 — 마지막에 몰아 말한 항목이 버려지지 않게
function timeUp(){const q=run.q;if(run.s.mode!=='speak'){finish('time');return;}run.phase='grace';q.graceAt=Date.now();VS()?.flush();render();
 const wait=()=>{if(!run||run.phase!=='grace'||run.q!==q)return;const st=VS()?.state()||{};if((!st.busy&&!st.talking)||Date.now()-q.graceAt>5000){run.phase='ask';finish('time');return;}setTimeout(wait,200);};setTimeout(wait,300);}
function tick(){if(!run||run.phase!=='ask')return;const left=run.q.limit-(Date.now()-run.q.t0)/1000;const t=$('oralTime');if(t){t.textContent=clock(left);t.classList.toggle('low',left<=20);}
 const lv=$('oralLevel');if(lv){const st=VS()?.state()||{};lv.style.width=Math.round(Math.max(0,Math.min(1,(st.level||0)/3))*100)+'%';const m=$('oralMic');if(m)m.textContent=micText(st);}
 if(left<=0)timeUp();}
function heard(text){
 if(!run||!['ask','grace'].includes(run.phase)||!text)return;const q=run.q;q.partial='';
 if(R().isSkip(text)&&run.phase==='ask'){q.heard.push({text,skip:true});finish('skip');return;}
 const head=R().endOf(text),said=head??text;      // 「이상입니다」: 함께 말한 앞부분까지 채점한 뒤 끝낸다
 let newly=[];if(said.trim()){q.transcript+=' '+said;newly=R().check(q.item,q.transcript,q.done);q.done.push(...newly);}q.heard.push({text,hit:newly.length+(q.live||0),end:head!=null});q.live=0;tell(true);
 if(run.phase==='grace'){render();return;}if(q.done.length===q.item.key.length){finish('all');return;}if(head!=null){finish('end');return;}render();
}
// self: 카드에서 스스로 매긴 점수 비율 (모르겠음 0 · 헷갈림 0.7 · 알았음 1)
function finish(reason,self){
 if(!run||run.phase!=='ask')return;clearInterval(run.timer);const q=run.q,total=q.item.key.length,fraction=self!=null?self:total?q.done.length/total:0;
 const stats=load(KEY.stats,{});stats[q.item.id]=R().grade(stats[q.item.id],fraction);save(KEY.stats,stats);
 const r={id:q.item.id,score:Math.round(fraction*100),got:q.done.length,total,seconds:Math.round((Date.now()-q.t0)/1000),reason,mode:run.s.mode,missed:self!=null?(self>=1?[]:q.item.key.map((_,i)=>i)):q.item.key.map((_,i)=>i).filter(i=>!q.done.includes(i)),at:Date.now()};
 if(self!=null)r.got=Math.round(fraction*total);
 run.results.push(r);const log=load(KEY.log,[]);log.push(r);save(KEY.log,log.slice(-500));
 if(run.s.mode==='card'){next();return;}      // 카드는 정답을 이미 봤으니 바로 다음 카드
 run.phase='result';run.last=r;run.left=Number(run.s.gap)||5;render();
 const count=()=>{if(!run||run.phase!=='result')return;if(run.paused){run.wait=setTimeout(count,500);return;}if(run.left<=0){next();return;}const c=$('oralNext');if(c)c.textContent=`${run.left}초 뒤 다음 문제`;run.left--;run.wait=setTimeout(count,1000);};count();
}
function stop(closed){if(!run)return;tell(false);clearInterval(run.timer);unbindKeys();clearTimeout(run.wait);VS()?.detach(consumer);const was=run;run=null;
 if(!closed&&doc){if(win&&!win.closed){summary(was);}else{const o=doc.getElementById('oralOverlay');if(o)o.hidden=true;}}}
const clock=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const micText=st=>st.error&&!st.phone?'⚠ '+st.error:st.progress&&st.progress.total?`음성인식 모델 ${st.progress.cached?'불러오는 중':'내려받는 중'} ${Math.round(st.progress.loaded/1e6)} / ${Math.round(st.progress.total/1e6)}MB`:!st.model?'음성인식 준비 중…':st.busy?'⏳ 받아쓰는 중…':st.speaking?'🔊 문제 읽는 중':st.phone?'🎙 듣는 중 (휴대폰 마이크)':'🎙 듣는 중 — 말하세요';
// ── 화면
function render(){
 const box=$('oralRoot');if(!box||!run)return;const q=run.q,it=q.item,res=run.results,avg=res.length?Math.round(res.reduce((a,r)=>a+r.score,0)/res.length):0;
 const head=`<header class="oral-head"><div><small>운행선관리 구술 연습 · ${MODE[run.s.mode]||''} · ${esc(scopeName(run.s.scope))}</small><b>${res.length+(run.phase==='ask'?1:0)}번째 문제</b></div><div class="oral-score">푼 문제 ${res.length} · 평균 ${avg}점</div><div class="oral-time" id="oralTime">${run.phase==='ask'&&run.s.mode!=='card'?clock(q.limit-(Date.now()-q.t0)/1000):'—'}</div></header>`;
 const meta=`<p class="oral-meta">${esc(it.ch)} · ${esc(it.set)}${(it.tags||[]).filter(t=>t!=='기출'&&t!=='교재').length?' · '+esc(it.tags.filter(t=>t!=='기출'&&t!=='교재').join(' ')):''}${it.page?' · 교재 '+esc(it.page)+'쪽':''}</p>`;
 const refs=(it.ref||[]).length?`<h2>참고</h2><ul class="oral-ref">${it.ref.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
 if(run.phase==='ask'&&run.s.mode==='card'){
  box.innerHTML=`${head}<section class="oral-q">${meta}<h1>${esc(it.q)}</h1></section>
<section class="oral-keys">${q.revealed?`<h2>핵심 항목 ${it.key.length}개</h2><ol class="oral-check">${it.key.map(k=>`<li>${esc(k)}</li>`).join('')}</ol><h2>모범 답안</h2><ol class="oral-answer">${it.a.map(l=>`<li>${esc(l.replace(/^\s*(\d+[.)]|[①-⑳])\s*/,''))}</li>`).join('')}</ol>${refs}`
  :`<h2>말해야 할 항목 ${it.key.length}개</h2><p class="oral-hint">머릿속으로(또는 소리 내어) 답해 본 뒤 정답을 보세요.</p>`}</section>
<footer class="oral-foot">${q.revealed?`<button type="button" id="oralG0" class="g0">모르겠음 <kbd>1</kbd></button><button type="button" id="oralG1" class="g1">헷갈림 <kbd>2</kbd></button><button type="button" id="oralG2" class="g2">알았음 <kbd>3</kbd></button>`:`<button type="button" id="oralReveal" class="primary">정답 보기 <kbd>Space</kbd></button>`}<button type="button" id="oralStop">연습 끝내기</button></footer>`;
 }else if(run.phase==='ask'&&run.s.mode==='type'){
  box.innerHTML=`${head}<section class="oral-q">${meta}<h1>${esc(it.q)}</h1></section>
<section class="oral-keys"><h2>맞힌 항목 <span id="oralCount">${q.done.length} / ${it.key.length}</span></h2><ol id="oralSlots">${slotsOf(q)}</ol></section>
<section class="oral-type"><textarea id="oralType" rows="5" placeholder="답을 입력하세요. 맞힌 항목은 위에 바로 체크됩니다. (Ctrl+Enter 제출)">${esc(q.typed||'')}</textarea></section>
<footer class="oral-foot"><button type="button" id="oralSubmit" class="primary">제출 <kbd>Ctrl+Enter</kbd></button><button type="button" id="oralSkip">모르겠음</button><button type="button" id="oralStop">연습 끝내기</button></footer>`;
  const t=$('oralType');t.oninput=()=>{q.typed=t.value;q.done=R().check(it,t.value,[]);const sl=$('oralSlots');if(sl)sl.innerHTML=slotsOf(q);const c=$('oralCount');if(c)c.textContent=q.done.length+' / '+it.key.length;if(q.done.length===it.key.length)finish('all');};
 }else if(run.phase==='ask'||run.phase==='grace'){
  const slots=it.key.map((k,i)=>q.done.includes(i)?`<li class="ok">✔ ${esc(k)}</li>`:`<li class="todo">○ 항목 ${i+1}</li>`).join('');
  box.innerHTML=`${head}<section class="oral-q">${meta}<h1>${esc(it.q)}</h1></section>
<section class="oral-keys"><h2>말해야 할 항목 ${q.done.length} / ${it.key.length}</h2><ol>${slots}</ol></section>
<section class="oral-heard"><img class="oral-listen" src="assets/orpheia/ui/listen.webp" alt="" aria-hidden="true" width="560" height="562"><h2><span id="oralMic">${esc(micText(VS()?.state()||{}))}</span> <span class="oral-meter"><i id="oralLevel"></i></span></h2><ul>${run.phase==='grace'?'<li class="live">⏱ 시간 종료 — 하던 말을 마저 받아쓰는 중…</li>':''}${q.partial?`<li class="live"><q>${esc(q.partial)}</q> <small>듣는 중${q.live?` · +${q.live}항목`:''}</small></li>`:''}${q.heard.slice(-4).reverse().map(h=>`<li class="${h.hit?'hit':''}"><q>${esc(h.text)}</q>${h.hit?` <small>+${h.hit}항목</small>`:''}</li>`).join('')||'<li class="empty">항목을 하나씩 말하세요. 다 말했으면 「이상입니다」, 모르면 「패스」.</li>'}</ul></section>
<footer class="oral-foot"><button type="button" id="oralSkip">패스 (다음 문제)</button><button type="button" id="oralStop">연습 끝내기</button>
<details><summary>마이크 없이 시험 (글로 입력)</summary><form id="oralForm"><input id="oralText" autocomplete="off" placeholder="말할 내용을 입력"><button>입력</button></form></details></footer>`;
 }else{
  const r=run.last,missed=new Set(r.missed);
  // 모범 답안 줄 ↔ 빠진 항목: 그 줄과 가장 비슷한 항목이 빠졌으면 그 줄을 강조
  const lineMiss=line=>{let best=-1,score=0;it.key.forEach((k,i)=>{const s=Math.max(R().similar(k,line),R().similar(line,k));if(s>score){score=s;best=i;}});return score>=0.5&&missed.has(best);};
  box.innerHTML=`${head}<section class="oral-q">${meta}<h1>${esc(it.q)}</h1></section>
<section class="oral-result ${r.score===100?'perfect':''}">${r.reason!=='self'&&run.s.mode!=='card'?`<img class="oral-react" src="assets/orpheia/ui/${r.score>=80?'perfect':'cheer'}.webp" alt="" aria-hidden="true" width="560" height="560">`:''}<div class="oral-big">${r.score}점 <small>${r.got} / ${r.total}항목 · ${r.seconds}초 · ${{all:run.s.mode==='type'?'모두 맞힘':'모두 말함',time:'시간 종료',skip:run.s.mode==='type'?'모르겠음':'패스',end:'이상입니다',submit:'제출'}[r.reason]}</small></div>
<h2>핵심 항목</h2><ol class="oral-check">${it.key.map((k,i)=>missed.has(i)?`<li class="miss">✖ <b>${esc(k)}</b></li>`:`<li class="ok">✔ ${esc(k)}</li>`).join('')}</ol>
<h2>모범 답안 <small>— 말하지 못한 부분은 굵은 빨간 글씨</small></h2><ol class="oral-answer">${R().highlight(it,r.missed).map((parts,n)=>`<li class="${parts.length===1&&parts[0].miss||lineMiss(it.a[n])&&!parts.some(p=>!p.miss&&p.text.trim().length>8)?'miss':''}">${parts.map(p=>p.miss?`<mark class="miss">${esc(p.text)}</mark>`:esc(p.text)).join('')}</li>`).join('')}</ol>
${(it.ref||[]).length?`<h2>참고</h2><ul class="oral-ref">${it.ref.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</section>
<footer class="oral-foot"><span id="oralNext">${run.left}초 뒤 다음 문제</span><button type="button" id="oralGo">바로 다음</button><button type="button" id="oralPause">${run.paused?'계속':'멈춤'}</button><button type="button" id="oralStop">연습 끝내기</button></footer>`;
 }
 const on=(id,f)=>{const el=$(id);if(el)el.onclick=f;};
 on('oralSkip',()=>finish('skip'));on('oralSubmit',()=>finish('submit'));on('oralReveal',reveal);on('oralG0',()=>finish('self',0));on('oralG1',()=>finish('self',0.7));on('oralG2',()=>finish('self',1));on('oralStop',()=>stop());on('oralGo',()=>next());on('oralPause',()=>{run.paused=!run.paused;render();});
 const f=$('oralForm');if(f)f.onsubmit=e=>{e.preventDefault();const t=$('oralText').value.trim();$('oralText').value='';if(t)heard(t);setTimeout(()=>$('oralText')?.focus(),0);};
}
const slotsOf=q=>q.item.key.map((k,i)=>q.done.includes(i)?`<li class="ok">✔ ${esc(k)}</li>`:`<li class="todo">○ 항목 ${i+1}</li>`).join('');
function reveal(){if(run?.phase==='ask'&&run.s.mode==='card'&&!run.q.revealed){run.q.revealed=true;render();}}
// 단축키: 카드 Space/Enter 정답 보기 · 1/2/3 평가, 타이핑 Ctrl+Enter 제출
function onKey(e){if(!run||run.phase!=='ask')return;
 if(run.s.mode==='card'){if(!run.q.revealed&&(e.key===' '||e.key==='Enter')){e.preventDefault();reveal();}else if(run.q.revealed&&['1','2','3'].includes(e.key)){e.preventDefault();finish('self',[0,0.7,1][Number(e.key)-1]);}}
 else if(run.s.mode==='type'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finish('submit');}}
function bindKeys(){unbindKeys();doc?.addEventListener('keydown',onKey);}
function unbindKeys(){doc?.removeEventListener('keydown',onKey);}
function summary(was){const box=$('oralRoot');if(!box)return;const res=was.results,avg=res.length?Math.round(res.reduce((a,r)=>a+r.score,0)/res.length):0;const all=R().all();
 box.innerHTML=`<header class="oral-head"><div><small>운행선관리 구술 연습</small><b>연습 끝</b></div><div class="oral-score">푼 문제 ${res.length} · 평균 ${avg}점</div></header>
<section class="oral-result"><h2>이번 연습</h2><ol class="oral-check">${res.map(r=>{const it=all.find(x=>x.id===r.id);return `<li class="${r.score===100?'ok':r.score<60?'miss':''}">${r.score}점 · ${esc(it?.q||r.id)}</li>`;}).join('')||'<li>푼 문제가 없습니다.</li>'}</ol></section>
<footer class="oral-foot"><button type="button" id="oralAgain">같은 설정으로 다시</button><button type="button" id="oralClose">닫기</button></footer>`;
 $('oralAgain').onclick=()=>start(was.s);$('oralClose').onclick=()=>{if(win&&!win.closed)win.close();};}
const scopeName=s=>s==='all'?'전범위':s==='exam'?'기출':String(s).startsWith('ch:')?String(s).slice(3):s;
// ── 학습 현황 (FTS 「구술 연습」 화면)
function overview(){const stats=load(KEY.stats,{}),all=R().all(),now=Date.now(),seen=all.filter(x=>stats[x.id]),log=load(KEY.log,[]);
 return {byMode:{speak:log.filter(r=>(r.mode||'speak')==='speak').length,card:log.filter(r=>r.mode==='card').length,type:log.filter(r=>r.mode==='type').length},total:all.length,seen:seen.length,due:seen.filter(x=>stats[x.id].due<=now).length,mastered:seen.filter(x=>(stats[x.id].interval||0)>=7).length,
  weak:seen.filter(x=>stats[x.id].score<100).sort((a,b)=>(stats[a.id].score-stats[b.id].score)||(stats[b.id].lapses-stats[a.id].lapses)).slice(0,8).map(x=>({id:x.id,q:x.q,score:stats[x.id].score,lapses:stats[x.id].lapses}))};}
function reset(){save(KEY.stats,{});save(KEY.log,[]);}
root.SimOralRelayUI={start,stop,settings,overview,reset,heard:t=>heard(t),partial:t=>partial(t),state:()=>run&&{phase:run.phase,item:run.q?.item.id,done:run.q?.done.slice(),results:run.results.slice()}};
})(typeof window!=='undefined'?window:globalThis);
