(function(root){
'use strict';
// 구술 릴레이 (운행선관리 구술 연습): 문제가 하나씩 뜨고, 교육생이 말하면(음성인식) 핵심 항목이 하나씩 체크된다.
//  · 항목을 다 말하면 즉시 끝, 제한 시간(기본 120초)이 지나도 끝. 「패스」라고 말하면 넘어간다.
//  · 끝나면 점수(부분점수)와 모범 답안 전체를 보여 주고, 말하지 못한 항목은 굵은 빨간 글씨로 표시한다. 몇 초 뒤 다음 문제.
//  · 출제는 간격 반복(틀린 문제는 곧 다시, 맞힌 문제는 뜸하게). 기록은 이 컴퓨터에 남는다.
// 마이크·받아쓰기는 음성 1인 모드의 것을 빌려 쓴다 (SimVoiceSolo.attach). 휴대폰 리모컨 마이크도 그대로 된다.
const R=()=>root.SimOralRelay,VS=()=>root.SimVoiceSolo;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY={settings:'orpheia-oral-settings-v1',stats:'orpheia-oral-srs-v1',log:'orpheia-oral-log-v1'};
const load=(k,d)=>{try{const v=JSON.parse(root.localStorage.getItem(k));return v??d;}catch{return d;}};
const save=(k,v)=>{try{root.localStorage.setItem(k,JSON.stringify(v));}catch{}};
const DEFAULT={scope:'all',limit:120,gap:5,srs:true,read:false};
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
 VS()?.attach(consumer);next();
}
const consumer={onText:text=>heard(text),hint:()=>run?.q?R().hint(run.q.item):''};
function next(){
 if(!run)return;clearTimeout(run.wait);const stats=load(KEY.stats,{});
 const item=R().pick(run.items,stats,{recent:run.recent,srs:run.s.srs});
 run.recent=[...run.recent,item.id].slice(-Math.min(5,Math.max(0,run.items.length-1)));
 run.q={item,transcript:'',heard:[],done:[],t0:Date.now(),limit:Math.max(10,Number(run.s.limit)||120)};run.phase='ask';
 render();if(run.s.read)VS()?.announce(item.q);
 clearInterval(run.timer);run.timer=setInterval(tick,250);
}
function tick(){if(!run||run.phase!=='ask')return;const left=run.q.limit-(Date.now()-run.q.t0)/1000;const t=$('oralTime');if(t){t.textContent=clock(left);t.classList.toggle('low',left<=20);}
 const lv=$('oralLevel');if(lv){const st=VS()?.state()||{};lv.style.width=Math.round(Math.max(0,Math.min(1,(st.level||0)/3))*100)+'%';const m=$('oralMic');if(m)m.textContent=micText(st);}
 if(left<=0)finish('time');}
function heard(text){
 if(!run||run.phase!=='ask'||!text)return;const q=run.q;
 if(R().isSkip(text)){q.heard.push({text,skip:true});finish('skip');return;}
 q.transcript+=' '+text;const newly=R().check(q.item,q.transcript,q.done);q.done.push(...newly);q.heard.push({text,hit:newly.length});
 render();if(q.done.length===q.item.key.length)finish('all');
}
function finish(reason){
 if(!run||run.phase!=='ask')return;clearInterval(run.timer);const q=run.q,total=q.item.key.length,fraction=total?q.done.length/total:0;
 const stats=load(KEY.stats,{});stats[q.item.id]=R().grade(stats[q.item.id],fraction);save(KEY.stats,stats);
 const r={id:q.item.id,score:Math.round(fraction*100),got:q.done.length,total,seconds:Math.round((Date.now()-q.t0)/1000),reason,missed:q.item.key.map((_,i)=>i).filter(i=>!q.done.includes(i)),at:Date.now()};
 run.results.push(r);const log=load(KEY.log,[]);log.push(r);save(KEY.log,log.slice(-500));
 run.phase='result';run.last=r;run.left=Number(run.s.gap)||5;render();
 const count=()=>{if(!run||run.phase!=='result')return;if(run.paused){run.wait=setTimeout(count,500);return;}if(run.left<=0){next();return;}const c=$('oralNext');if(c)c.textContent=`${run.left}초 뒤 다음 문제`;run.left--;run.wait=setTimeout(count,1000);};count();
}
function stop(closed){if(!run)return;clearInterval(run.timer);clearTimeout(run.wait);VS()?.detach(consumer);const was=run;run=null;
 if(!closed&&doc){if(win&&!win.closed){summary(was);}else{const o=doc.getElementById('oralOverlay');if(o)o.hidden=true;}}}
const clock=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const micText=st=>st.error&&!st.phone?'⚠ '+st.error:st.progress&&st.progress.total?`음성인식 모델 내려받는 중 ${Math.round(st.progress.loaded/1e6)} / ${Math.round(st.progress.total/1e6)}MB`:!st.model?'음성인식 준비 중…':st.busy?'⏳ 받아쓰는 중…':st.speaking?'🔊 문제 읽는 중':st.phone?'🎙 듣는 중 (휴대폰 마이크)':'🎙 듣는 중 — 말하세요';
// ── 화면
function render(){
 const box=$('oralRoot');if(!box||!run)return;const q=run.q,it=q.item,res=run.results,avg=res.length?Math.round(res.reduce((a,r)=>a+r.score,0)/res.length):0;
 const head=`<header class="oral-head"><div><small>운행선관리 구술 연습 · ${esc(scopeName(run.s.scope))}</small><b>${res.length+(run.phase==='ask'?1:0)}번째 문제</b></div><div class="oral-score">푼 문제 ${res.length} · 평균 ${avg}점</div><div class="oral-time" id="oralTime">${run.phase==='ask'?clock(q.limit-(Date.now()-q.t0)/1000):'—'}</div></header>`;
 const meta=`<p class="oral-meta">${esc(it.ch)} · ${esc(it.set)}${(it.tags||[]).filter(t=>t!=='기출'&&t!=='교재').length?' · '+esc(it.tags.filter(t=>t!=='기출'&&t!=='교재').join(' ')):''}${it.page?' · 교재 '+esc(it.page)+'쪽':''}</p>`;
 if(run.phase==='ask'){
  const slots=it.key.map((k,i)=>q.done.includes(i)?`<li class="ok">✔ ${esc(k)}</li>`:`<li class="todo">○ 항목 ${i+1}</li>`).join('');
  box.innerHTML=`${head}<section class="oral-q">${meta}<h1>${esc(it.q)}</h1></section>
<section class="oral-keys"><h2>말해야 할 항목 ${q.done.length} / ${it.key.length}</h2><ol>${slots}</ol></section>
<section class="oral-heard"><h2><span id="oralMic">${esc(micText(VS()?.state()||{}))}</span> <span class="oral-meter"><i id="oralLevel"></i></span></h2><ul>${q.heard.slice(-4).reverse().map(h=>`<li class="${h.hit?'hit':''}"><q>${esc(h.text)}</q>${h.hit?` <small>+${h.hit}항목</small>`:''}</li>`).join('')||'<li class="empty">항목을 하나씩 말하세요. 「패스」라고 말하면 넘어갑니다.</li>'}</ul></section>
<footer class="oral-foot"><button type="button" id="oralSkip">패스 (다음 문제)</button><button type="button" id="oralStop">연습 끝내기</button>
<details><summary>마이크 없이 시험 (글로 입력)</summary><form id="oralForm"><input id="oralText" autocomplete="off" placeholder="말할 내용을 입력"><button>입력</button></form></details></footer>`;
 }else{
  const r=run.last,missed=new Set(r.missed);
  // 모범 답안 줄 ↔ 빠진 항목: 그 줄과 가장 비슷한 항목이 빠졌으면 그 줄을 강조
  const lineMiss=line=>{let best=-1,score=0;it.key.forEach((k,i)=>{const s=Math.max(R().similar(k,line),R().similar(line,k));if(s>score){score=s;best=i;}});return score>=0.5&&missed.has(best);};
  box.innerHTML=`${head}<section class="oral-q">${meta}<h1>${esc(it.q)}</h1></section>
<section class="oral-result ${r.score===100?'perfect':''}"><div class="oral-big">${r.score}점 <small>${r.got} / ${r.total}항목 · ${r.seconds}초 · ${{all:'모두 말함',time:'시간 종료',skip:'패스'}[r.reason]}</small></div>
<h2>핵심 항목</h2><ol class="oral-check">${it.key.map((k,i)=>missed.has(i)?`<li class="miss">✖ <b>${esc(k)}</b></li>`:`<li class="ok">✔ ${esc(k)}</li>`).join('')}</ol>
<h2>모범 답안 <small>— 말하지 못한 부분은 굵은 빨간 글씨</small></h2><ol class="oral-answer">${R().highlight(it,r.missed).map((parts,n)=>`<li class="${parts.length===1&&parts[0].miss||lineMiss(it.a[n])&&!parts.some(p=>!p.miss&&p.text.trim().length>8)?'miss':''}">${parts.map(p=>p.miss?`<mark class="miss">${esc(p.text)}</mark>`:esc(p.text)).join('')}</li>`).join('')}</ol>
${(it.ref||[]).length?`<h2>참고</h2><ul class="oral-ref">${it.ref.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</section>
<footer class="oral-foot"><span id="oralNext">${run.left}초 뒤 다음 문제</span><button type="button" id="oralGo">바로 다음</button><button type="button" id="oralPause">${run.paused?'계속':'멈춤'}</button><button type="button" id="oralStop">연습 끝내기</button></footer>`;
 }
 const on=(id,f)=>{const el=$(id);if(el)el.onclick=f;};
 on('oralSkip',()=>finish('skip'));on('oralStop',()=>stop());on('oralGo',()=>next());on('oralPause',()=>{run.paused=!run.paused;render();});
 const f=$('oralForm');if(f)f.onsubmit=e=>{e.preventDefault();const t=$('oralText').value.trim();$('oralText').value='';if(t)heard(t);setTimeout(()=>$('oralText')?.focus(),0);};
}
function summary(was){const box=$('oralRoot');if(!box)return;const res=was.results,avg=res.length?Math.round(res.reduce((a,r)=>a+r.score,0)/res.length):0;const all=R().all();
 box.innerHTML=`<header class="oral-head"><div><small>운행선관리 구술 연습</small><b>연습 끝</b></div><div class="oral-score">푼 문제 ${res.length} · 평균 ${avg}점</div></header>
<section class="oral-result"><h2>이번 연습</h2><ol class="oral-check">${res.map(r=>{const it=all.find(x=>x.id===r.id);return `<li class="${r.score===100?'ok':r.score<60?'miss':''}">${r.score}점 · ${esc(it?.q||r.id)}</li>`;}).join('')||'<li>푼 문제가 없습니다.</li>'}</ol></section>
<footer class="oral-foot"><button type="button" id="oralAgain">같은 설정으로 다시</button><button type="button" id="oralClose">닫기</button></footer>`;
 $('oralAgain').onclick=()=>start(was.s);$('oralClose').onclick=()=>{if(win&&!win.closed)win.close();};}
const scopeName=s=>s==='all'?'전범위':s==='exam'?'기출':String(s).startsWith('ch:')?String(s).slice(3):s;
// ── 학습 현황 (FTS 「구술 연습」 화면)
function overview(){const stats=load(KEY.stats,{}),all=R().all(),now=Date.now(),seen=all.filter(x=>stats[x.id]);
 return {total:all.length,seen:seen.length,due:seen.filter(x=>stats[x.id].due<=now).length,mastered:seen.filter(x=>(stats[x.id].interval||0)>=7).length,
  weak:seen.filter(x=>stats[x.id].score<100).sort((a,b)=>(stats[a.id].score-stats[b.id].score)||(stats[b.id].lapses-stats[a.id].lapses)).slice(0,8).map(x=>({id:x.id,q:x.q,score:stats[x.id].score,lapses:stats[x.id].lapses}))};}
function reset(){save(KEY.stats,{});save(KEY.log,[]);}
root.SimOralRelayUI={start,stop,settings,overview,reset,heard:t=>heard(t),state:()=>run&&{phase:run.phase,item:run.q?.item.id,done:run.q?.done.slice(),results:run.results.slice()}};
})(typeof window!=='undefined'?window:globalThis);
