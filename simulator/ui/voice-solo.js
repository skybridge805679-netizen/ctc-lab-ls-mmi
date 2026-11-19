(function(root){
'use strict';
// 음성 1인 모드 (FTS 교육설정 「음성 1인 모드」): 교수 없이 교육생이 말과 LS 조작만으로 실습한다.
//  · 마이크를 계속 듣다가 말이 끝나면(무음 0.9초, engine/voice-segment.js) 그 한 마디를 받아써(Whisper, ui/voice-stt-worker.js) 엔진에 넘긴다 (fts op:'voice').
//  · 엔진이 대본의 한 단계로 알아들으면 그 말에 나온 열차만 반응하고, 상대(기관사·역·관제팀장) 대사를 돌려준다 → 여기서 음성으로 읽는다.
//  · 상대 대사를 읽는 동안은 듣지 않는다 (자기 소리를 다시 받아쓰지 않게).
// 상대를 고르는 화면이나 「말하기」 버튼은 없다. 화면에는 들은 말과 알아들은 단계만 보인다.
const STT_URL=new URL('ui/voice-stt-worker.js',root.location?.href||'').href;
const S={consumer:null,prep:false,prepHeard:[],level:0,doc:null,on:false,worker:null,model:'',progress:null,stream:null,ctx:null,node:null,src:null,speaking:false,mutedUntil:0,busy:0,seg:{},jobs:new Map(),rate:0,heard:[],played:0,sessionKey:'',error:'',send:null,seq:0};
// Whisper가 무음·잡음에서 자주 지어내는 말 (방송 끝인사 등) — 무전으로 넘기지 않는다
const HALLUCINATION=/^(감사합니다\.?|시청해 ?주셔서 감사합니다\.?|구독과 좋아요.*|MBC 뉴스.*|\.+|…+)$/;

function worker(){
 if(S.worker)return S.worker;
 try{root.navigator?.storage?.persist?.();}catch{}      // 내려받은 모델(캐시)을 저장공간이 부족해도 브라우저가 지우지 않게 「영구 저장」을 요청
 try{S.worker=new Worker(STT_URL,{type:'module'});}catch(e){S.error='음성인식을 시작하지 못했습니다: '+e.message;return null;}
 S.worker.onmessage=e=>{const m=e.data;
  if(m.type==='progress')S.progress=m;
  else if(m.type==='ready'){S.model=(m.model?'Whisper '+m.model+' · ':'')+(m.device==='webgpu'?'그래픽카드 가속':'CPU '+m.threads+'코어');S.progress=null;}
  else if(m.type==='text'){S.busy=Math.max(0,S.busy-1);const job=S.jobs.get(m.id)||{};S.jobs.delete(m.id);
   const text=root.SimVoiceSegment?root.SimVoiceSegment.tidy(m.text,job.dur||0):m.text;if(!job.partial&&root.SimVoiceSegment)S.rate=root.SimVoiceSegment.speed(S.rate,text,job.dur||0);      // 지어낸 글(되풀이·방송 끝인사·소리에 비해 너무 많은 글자) 거르기
   if(job.partial){if(m.id===S.partialId)try{S.consumer?.onPartial?.(text);}catch(e){console.error(e);}}else heard(text,m.ms);}
  else if(m.type==='error'){S.busy=Math.max(0,S.busy-1);S.jobs.delete(m.id);S.error='음성인식 오류: '+m.message;}
  render();};
 S.worker.postMessage({type:'load'});return S.worker;
}
// 받아쓴 한 마디 → 엔진
function heard(text,ms){
 text=String(text||'').trim();if(!text||HALLUCINATION.test(text))return;
 if(S.consumer){try{S.consumer.onText(text);}catch(e){console.error(e);}return;}      // 구술 연습 등 다른 화면이 마이크를 빌려 쓰는 중
 if(S.prep&&!S.on){S.prepHeard.unshift(text);S.prepHeard.length=Math.min(S.prepHeard.length,5);return;}      // 음성 준비(마이크 시험): 받아쓴 글만 보여 준다
 const r=S.send?S.send(text):{ok:false,message:'엔진 연결 없음'};
 S.heard.unshift({at:Date.now(),text,ms,ok:r?.ok!==false&&(!!r?.matched?.length||!!r?.ack),ack:!!r?.ack,matched:r?.matched||[],next:r?.next||'',message:r?.ok===false?r.message:''});S.heard.length=Math.min(S.heard.length,12);
}
// ── 마이크와 말 끊기(VAD): engine/voice-segment.js. PC 마이크와 휴대폰 마이크는 각자 따로 자른다.
// 음성 1인 모드는 무음 0.9초에서 한 마디(무전 한 마디). 구술 연습처럼 길게 이어 말하는 화면은 consumer.segment로 숨 고르기 자르기(6~12초)를 켠다.
const SEG_FTS={end:0.9,soft:Infinity,hard:25};
const muted=()=>S.speaking||Date.now()<S.mutedUntil||!(S.on||S.prep||S.consumer);
function seg(src,rate){const o={...SEG_FTS,...(S.consumer?.segment||{})};
 if(!S.seg[src]||S.seg[src].rate!==rate){S.seg[src]=root.SimVoiceSegment.create({...o,rate,onSegment:(a,info)=>transcribe([a],info.rate,{dur:a.length/info.rate})});S.seg[src].rate=rate;}
 else S.seg[src].set(o);return S.seg[src];}
// 중간 받아쓰기(consumer.live): 아직 끝나지 않은 말을 2.5초마다 받아써 미리 체크한다 (받아쓰기가 놀고 있을 때만 — 밀리지 않게). 확정은 마디가 끝날 때.
function live(){const c=S.consumer;if(!c?.live||S.busy)return;const g=Object.values(S.seg).find(x=>x?.talking);if(!g)return;
 const a=g.current();if(!a||a.length/g.rate<2.5||Date.now()-(S.liveAt||0)<2500)return;S.liveAt=Date.now();transcribe([a],g.rate,{dur:a.length/g.rate,partial:true});}
function flush(){for(const g of Object.values(S.seg))g?.flush();}
async function listen(){
 if(S.stream)return;
 const mac=/Mac/.test(navigator.platform||navigator.userAgent),GUIDE=mac?'macOS 시스템 설정 → 개인정보 보호 및 보안 → 마이크에서 「ORPHEIA CTC LAB」을 켠 뒤 [마이크 다시 연결]':'Windows 설정 → 개인 정보 → 마이크 → 「데스크톱 앱이 마이크에 액세스하도록 허용」을 켠 뒤 [마이크 다시 연결]';
 // 데스크톱 앱: 운영체제 마이크 허용부터 받는다 (macOS는 여기서 허용 창이 뜬다)
 try{const os=await root.OrpheiaEngine?.mic?.();if(os&&['denied','restricted'].includes(os.status)){S.error='마이크 사용이 막혀 있습니다 — '+GUIDE;render();return;}}catch{}
 try{
  S.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
 }catch(e){S.error='마이크를 쓸 수 없습니다: '+(e.name==='NotAllowedError'?'마이크 사용이 막혀 있습니다 — '+GUIDE:e.name==='NotFoundError'?'연결된 마이크가 없습니다 (휴대폰 리모컨의 「📻 무전」을 쓰세요)':(e.message||e.name));render();return;}
 S.ctx=new AudioContext({sampleRate:16000});S.ctx.resume?.();S.src=S.ctx.createMediaStreamSource(S.stream);
 S.node=S.ctx.createScriptProcessor(2048,1,1);
 S.node.onaudioprocess=e=>{const x=new Float32Array(e.inputBuffer.getChannelData(0));
  if(muted()){S.seg.pc?.reset();S.level=0;return;}seg('pc',S.ctx.sampleRate).feed(x);S.level=S.seg.pc.level;live();};
 S.src.connect(S.node);S.node.connect(S.ctx.destination);render();
}
function transcribe(chunks,rate,opt={}){
 const n=chunks.reduce((a,c)=>a+c.length,0),audio=new Float32Array(n);let o=0;for(const c of chunks){audio.set(c,o);o+=c.length;}
 let pcm=audio;if(rate!==16000){const r=rate/16000,out=new Float32Array(Math.floor(n/r));for(let i=0;i<out.length;i++)out[i]=audio[Math.floor(i*r)];pcm=out;}
 const w=worker();if(!w)return;S.busy++;const id=++S.seq;if(opt.partial)S.partialId=id;S.jobs.set(id,{dur:opt.dur||pcm.length/16000,partial:!!opt.partial});
 const dur=pcm.length/16000,minChars=!opt.partial&&dur>=3&&S.rate?Math.ceil(S.rate*dur*0.7):0;      // 일찍 끝낸 받아쓰기 다시 (engine/voice-segment.js short)
 w.postMessage({type:'transcribe',id,audio:pcm,prompt:(S.consumer?.hint?.()??S.state?.v?.hint)||'',partial:!!opt.partial,minChars},[pcm.buffer]);render();
}
// 휴대폰은 말하는 동안(앞뒤 여유 포함) 소리를 0.5초씩 이어 보낸다 → PC 마이크와 같은 규칙으로 여기서 자른다
function phoneAudio(u8){
 if(muted()){S.seg.phone?.reset();return;}
 const i16=new Int16Array(u8.buffer,u8.byteOffset,Math.floor(u8.byteLength/2)),f=new Float32Array(i16.length);for(let i=0;i<i16.length;i++)f[i]=i16[i]/32768;
 S.phoneAt=Date.now();const g=seg('phone',16000);g.feed(f);if(!S.stream)S.level=g.level;live();
}
try{root.OrpheiaEngine?.onRemoteAudio?.(phoneAudio);}catch{}
function stopListening(){for(const g of Object.values(S.seg))g?.reset();try{S.node?.disconnect();S.src?.disconnect();S.ctx?.close();}catch{}for(const t of S.stream?.getTracks()||[])t.stop();S.stream=S.ctx=S.node=S.src=null;}
// ── 상대 대사 읽기: Supertonic 2 (ui/voice-tts-worker.js, 배역마다 다른 목소리). 모델 준비 전이나 실패하면 기본 TTS로 읽는다.
const TTS_URL=new URL('ui/voice-tts-worker.js',root.location?.href||'').href;
const V=()=>root.SimVoice;      // engine/voice.js: 목소리 고르기 · 읽기 쉬운 글 · 미리 만든 음성 파일 이름 (파일 생성 도구와 같은 규칙)
const readable=t=>V()?.readable(t)??String(t);
const T={files:null,buffers:new Map(),worker:null,ready:false,failed:false,queue:[],playing:false,ctx:null,seq:0,wait:new Map(),progress:null};
function ttsWorker(){if(T.worker||T.failed)return T.worker;try{T.worker=new Worker(TTS_URL,{type:'module'});}catch{T.failed=true;return null;}
 T.worker.onmessage=e=>{const m=e.data;if(m.type==='ready'){T.ready=true;T.progress=null;}else if(m.type==='progress')T.progress=m;else if(m.type==='error'){T.failed=true;}
  else if(m.type==='audio'||m.type==='fail'){const cb=T.wait.get(m.id);T.wait.delete(m.id);cb?.(m);}render();};
 T.worker.postMessage({type:'load'});return T.worker;}
function synth(line){return new Promise(res=>{const w=ttsWorker();if(!w||!T.ready){res(null);return;}const id=++T.seq;T.wait.set(id,m=>res(m.type==='audio'?m:null));w.postMessage({type:'speak',id,text:readable(line.text),voice:V()?.voiceOf(line)||'M1',speed:line.who==='driver'?1.12:1.05});});}
function playPcm(m){return new Promise(res=>{T.ctx??=new AudioContext();const b=T.ctx.createBuffer(1,m.audio.length,m.rate);b.copyToChannel(m.audio,0);const src=T.ctx.createBufferSource();src.buffer=b;src.connect(T.ctx.destination);src.onended=res;T.ctx.resume?.();src.start();});}
function fallback(line){return new Promise(res=>{const synth=root.speechSynthesis;if(!synth){res();return;}const u=new SpeechSynthesisUtterance(readable(line.text));u.lang='ko-KR';u.pitch={driver:0.8,station:1.15,chief:0.95,crew:1.25}[line.who]||1;u.rate=1.1;u.onend=u.onerror=()=>res();synth.speak(u);setTimeout(res,30000+line.text.length*200);});}      // 끝날 때까지 기다린다 (어림 시간으로 다음 대사를 먼저 시작하면 겹친다)
// 미리 만든 대사 음성 (simulator/assets/voice, tools/build-voice-lines.cjs): 대본의 상대 대사는 바로 재생한다. 목록에 없는 말만 그 자리에서 만든다.
function files(){return T.files??=fetch(new URL('assets/voice/index.json',root.location.href)).then(r=>r.ok?r.json():{}).catch(()=>({}));}
function decoded(key){if(!T.buffers.has(key)){T.ctx??=new AudioContext();T.buffers.set(key,fetch(new URL('assets/voice/'+key+'.ogg',root.location.href)).then(r=>r.arrayBuffer()).then(b=>T.ctx.decodeAudioData(b)).catch(()=>null));}return T.buffers.get(key);}
function playBuffer(buf){return new Promise(res=>{const src=T.ctx.createBufferSource();src.buffer=buf;src.connect(T.ctx.destination);src.onended=res;T.ctx.resume?.();src.start();});}
async function drain(){if(T.playing)return;T.playing=true;S.speaking=true;render();
 const index=await files();
 while(T.queue.length){const line=T.queue.shift(),key=V()?.lineKey(line);
  for(const next of T.queue.slice(0,2)){const k=V()?.lineKey(next);if(k&&index[k])decoded(k);}      // 다음 대사도 미리 풀어 둔다
  const buf=key&&index[key]?await decoded(key):null;if(buf){await playBuffer(buf);continue;}
  ttsWorker();const pcm=await synth(line);if(pcm)await playPcm(pcm);else await fallback(line);}
 T.playing=false;S.speaking=false;S.mutedUntil=Date.now()+350;render();}
function speakLines(lines){T.queue.push(...lines);drain();}
// FTS 화면이 엔진 상태를 받을 때마다 부른다
function sync(fts,send,doc){
 if(root.SimExtraLS)return;      // 음성은 주 LS 창 하나에서만 (「LS +」로 연 창마다 듣고 읽으면 대사가 겹치고 받아쓰기가 중복된다)
 S.send=send;if(doc)S.doc=doc;const session=fts?.session,idx=session?Math.min(session.current,session.items.length-1):-1,item=session?.items[idx],v=session?.voice?.items?.[idx];
 const live=!!(session?.voice&&!session.finished&&item?.status==='진행');
 const key=session?session.id+':'+idx+':'+(session.attempt||0):'';
 if(key!==S.sessionKey){S.sessionKey=key;S.played=0;S.heard=[];}
 if(live&&!S.on){S.on=true;S.error='';worker();files();listen();}
 else if(!live&&S.on){S.on=false;if(!S.prep)stopListening();}
 if(live)S.prep=false;
 if(v?.queue?.length){const fresh=v.queue.filter(q=>q.seq>S.played);if(fresh.length){S.played=fresh.at(-1).seq;speakLines(fresh);}}
 S.state={live,v,item,voice:!!session?.voice};render();
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let last='';
function render(){
 renderPrep();const D=S.doc?.()||root.document,box=D?.getElementById('ftsVoice');if(!box)return;
 const st=S.state||{};if(!st.voice){if(box.innerHTML)box.innerHTML='';last='';return;}
 const p=S.progress||T.progress&&!T.ready&&{...T.progress,tts:true},mb=x=>Math.round(x/1e6),phone=Date.now()-(S.phoneAt||0)<120000,status=S.error&&!phone?`⚠ ${S.error}`:p&&!p.total?'음성 모델 준비 중…':p&&p.total?`${p.tts?'목소리(TTS)':'음성인식'} 모델 ${p.cached?'불러오는 중':'내려받는 중'} ${mb(p.loaded)} / ${mb(p.total)}MB${p.cached?' (저장된 모델)':' (처음 한 번만)'}`:!st.live?'음성 1인 모드 · 문제가 진행되면 듣기 시작합니다':S.speaking?'🔊 상대 응답 중 — 끝나면 다시 듣습니다':S.busy?'⏳ 받아쓰는 중…':(phone?'🎙 듣는 중 (휴대폰 마이크) — 무전하듯 말하세요':'🎙 듣는 중 — 무전하듯 말하세요');
 const done=Object.keys(st.v?.done||{}).length;
 const html=`<div class="fts-voice ${S.speaking?'speaking':''}"><div class="fts-voice-status"><b>${esc(status)}</b><small>${S.model?'받아쓰기: '+esc(S.model)+' · ':''}알아들은 말 ${done}개</small></div>
<ul class="fts-voice-log">${S.heard.map(h=>`<li class="${h.ok?'ok':'miss'}"><span>${h.ok?'✔':'✖'}</span><div><q>${esc(h.text)}</q>${h.ok?`<small>${h.ack?'응답 (관제 이상 · 수신 이상)':h.matched.map(m=>esc(m.comm+' · '+m.text.slice(0,48))).join('<br>')}</small>`:`<small>${esc(h.message||(h.next?'다음에 할 말: '+h.next:'대본의 말과 맞지 않습니다 — 열차번호·역 이름을 또렷하게 다시 말해 보세요'))}</small>`}</div></li>`).join('')||'<li class="empty">아직 들은 말이 없습니다.</li>'}</ul>
${S.error&&!S.stream&&!phone?'<button type="button" class="sched-btn primary" id="ftsVoiceRetry">🎙 마이크 다시 연결</button>':''}<details class="fts-voice-type"><summary>마이크 없이 시험 (글로 입력)</summary><form id="ftsVoiceForm"><input id="ftsVoiceText" placeholder="예: K1210열차 금천구청역 정차" autocomplete="off"><button class="sched-btn">입력</button></form></details></div>`;
 if(html===last)return;const open=box.querySelector('details')?.open,typed=box.querySelector('#ftsVoiceText')?.value||'',focus=D.activeElement?.id==='ftsVoiceText';last=html;box.innerHTML=html;
 const d=box.querySelector('details');if(open)d.open=true;const inp=box.querySelector('#ftsVoiceText');inp.value=typed;if(focus)inp.focus();
 box.querySelector('#ftsVoiceRetry')?.addEventListener('click',()=>{S.error='';stopListening();listen();render();});
 box.querySelector('#ftsVoiceForm').onsubmit=e=>{e.preventDefault();const t=inp.value.trim();if(!t)return;inp.value='';heard(t,0);render();};
}
// ── 음성 준비 (교육설정에서 「음성 1인 모드」를 켰을 때): 모델을 미리 받고, 마이크 소리 크기와 받아쓰기를 시험하고, 목소리를 들어 본다
let prepTimer=0;
function prepare(doc){if(doc)S.doc=doc;S.prep=true;S.error='';worker();files().then(x=>{T.count=Object.keys(x||{}).length;renderPrep();});listen();clearInterval(prepTimer);prepTimer=setInterval(renderPrep,200);renderPrep();}
function stopPrep(){S.prep=false;clearInterval(prepTimer);if(!S.on)stopListening();renderPrep();}
function renderPrep(){
 const D=S.doc?.()||root.document,box=D?.getElementById('suVoicePrep');if(!box){if(S.prep&&!D?.getElementById('ftsVoice'))stopPrepSoon();return;}
 if(!S.prep){if(box.dataset.on){box.innerHTML='';delete box.dataset.on;}return;}
 const mb=x=>Math.round(x/1e6),row=(name,p,ready,failed,done)=>`<li><b>${name}</b> ${ready?`✔ 준비됨${done?' · '+esc(done):''}`:failed?'⚠ 준비 실패':p&&p.total?`${p.cached?'불러오는 중 (저장된 모델)':'내려받는 중'} ${mb(p.loaded)} / ${mb(p.total)}MB`:'준비 중…'}</li>`;
 const lvl=Math.max(0,Math.min(1,(S.level||0)/3)),mic=S.stream?`<span class="fts-meter"><i style="width:${Math.round(lvl*100)}%"></i></span>`:'';
 const html=`<div class="fts-voice-prep"><div class="fts-voice-status"><b>음성 준비</b><small>처음 한 번 음성인식 모델을 내려받아 이 컴퓨터에 저장합니다 (인터넷 필요). 그 뒤로는 저장된 모델을 불러와 인터넷 없이 동작합니다.</small></div>
<ul>${row('음성인식 (Whisper)',S.progress,!!S.model,false,S.model)}<li><b>상대 대사 음성</b> ${T.count?`✔ 미리 만든 음성 ${T.count}줄 (바로 재생)`:'준비 중…'}${T.worker?` · 대본 밖 말: ${T.ready?'Supertonic ✔':T.progress&&T.progress.total?'Supertonic '+(T.progress.cached?'불러오는 중 ':'내려받는 중 ')+mb(T.progress.loaded)+' / '+mb(T.progress.total)+'MB':'준비 중'}`:''}</li>
<li><b>마이크</b> ${S.error&&!S.stream?'⚠ '+esc(S.error):S.stream?'✔ 듣는 중 '+mic+' <small>말하면 막대가 움직입니다</small>':'연결 중… (처음이면 마이크 허용을 묻습니다)'}</li>
<li><b>받아쓰기 시험</b> ${S.prepHeard.length?S.prepHeard.map(t=>`<q>${esc(t)}</q>`).join(' '):S.busy?'⏳ 받아쓰는 중…':S.model?'「K1210열차 금천구청역 정차」처럼 말해 보세요':'음성인식 모델이 준비되면 시험할 수 있습니다'}</li></ul>
<div class="fts-row-btns"><button type="button" class="sched-btn" id="suVoiceHear" ${T.playing?'disabled':''}>🔊 목소리 들어 보기</button>${!S.stream?'<button type="button" class="sched-btn primary" id="suVoiceRetry">🎙 마이크 다시 연결</button>':''}<button type="button" class="sched-btn" id="suVoiceStop">마이크 시험 끝내기</button></div></div>`;
 if(box.dataset.html===html)return;box.dataset.html=html;box.dataset.on='1';box.innerHTML=html;
 box.querySelector('#suVoiceHear').onclick=()=>speakLines([{who:'driver',name:'K1210 기관사',text:'K1210 열차. 수신 이상!'},{who:'station',name:'가산디지털역',text:'가산디지털역, 수신 이상!'}]);
 box.querySelector('#suVoiceStop').onclick=stopPrep;
 box.querySelector('#suVoiceRetry')?.addEventListener('click',()=>{S.error='';stopListening();listen();renderPrep();});
}
let stopping=0;function stopPrepSoon(){clearTimeout(stopping);stopping=setTimeout(()=>{const D=S.doc?.()||root.document;if(S.prep&&!D?.getElementById('suVoicePrep'))stopPrep();},1500);}      // 교육설정 화면을 떠나면 마이크 시험을 끝낸다
// FTS 안내(문제 발생·상황 변경) 음성도 상대 대사와 같은 줄에 세워 차례로 읽는다 (동시에 읽으면 겹친다)
function announce(text){if(root.SimExtraLS||!text)return;T.queue.push({who:'chief',name:'안내',text});drain();}
// 다른 화면(구술 연습)이 마이크·받아쓰기를 빌려 쓴다: onText(받아쓴 한 마디), hint()(Whisper 문맥 힌트)
function attach(c){S.consumer=c;S.error='';worker();listen();}
function detach(c){if(!c||S.consumer===c){S.consumer=null;if(!S.on&&!S.prep)stopListening();}}
root.SimVoiceSolo={attach,detach,flush,announce,sync,render,heard,readable,prepare,stopPrep,phoneAudio,state:()=>({talking:Object.values(S.seg).some(g=>g?.talking),on:S.on,speaking:S.speaking,busy:S.busy,model:S.model,error:S.error,heard:S.heard.slice(),progress:S.progress,level:S.level||0,stream:!!S.stream,phone:Date.now()-(S.phoneAt||0)<120000})};
})(typeof window!=='undefined'?window:globalThis);
