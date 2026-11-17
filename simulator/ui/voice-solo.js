(function(root){
'use strict';
// 음성 1인 모드 (FTS 교육설정 「음성 1인 모드」): 교수 없이 교육생이 말과 LS 조작만으로 실습한다.
//  · 마이크를 계속 듣다가 말이 끝나면(무음 0.9초) 그 한 마디를 받아써(Whisper, ui/voice-stt-worker.js) 엔진에 넘긴다 (fts op:'voice').
//  · 엔진이 대본의 한 단계로 알아들으면 그 말에 나온 열차만 반응하고, 상대(기관사·역·관제팀장) 대사를 돌려준다 → 여기서 음성으로 읽는다.
//  · 상대 대사를 읽는 동안은 듣지 않는다 (자기 소리를 다시 받아쓰지 않게).
// 상대를 고르는 화면이나 「말하기」 버튼은 없다. 화면에는 들은 말과 알아들은 단계만 보인다.
const STT_URL=new URL('ui/voice-stt-worker.js',root.location?.href||'').href;
const S={prep:false,prepHeard:[],level:0,doc:null,on:false,worker:null,model:'',progress:null,stream:null,ctx:null,node:null,src:null,speaking:false,mutedUntil:0,busy:0,heard:[],played:0,sessionKey:'',error:'',send:null,seq:0};
// Whisper가 무음·잡음에서 자주 지어내는 말 (방송 끝인사 등) — 무전으로 넘기지 않는다
const HALLUCINATION=/^(감사합니다\.?|시청해 ?주셔서 감사합니다\.?|구독과 좋아요.*|MBC 뉴스.*|\.+|…+)$/;

function worker(){
 if(S.worker)return S.worker;
 try{S.worker=new Worker(STT_URL,{type:'module'});}catch(e){S.error='음성인식을 시작하지 못했습니다: '+e.message;return null;}
 S.worker.onmessage=e=>{const m=e.data;
  if(m.type==='progress')S.progress=m;
  else if(m.type==='ready'){S.model=m.device==='webgpu'?'그래픽카드 가속':'CPU '+m.threads+'코어';S.progress=null;}
  else if(m.type==='text'){S.busy=Math.max(0,S.busy-1);heard(m.text,m.ms);}
  else if(m.type==='error'){S.busy=Math.max(0,S.busy-1);S.error='음성인식 오류: '+m.message;}
  render();};
 S.worker.postMessage({type:'load'});return S.worker;
}
// 받아쓴 한 마디 → 엔진
function heard(text,ms){
 text=String(text||'').trim();if(!text||HALLUCINATION.test(text))return;
 if(S.prep&&!S.on){S.prepHeard.unshift(text);S.prepHeard.length=Math.min(S.prepHeard.length,5);return;}      // 음성 준비(마이크 시험): 받아쓴 글만 보여 준다
 const r=S.send?S.send(text):{ok:false,message:'엔진 연결 없음'};
 S.heard.unshift({at:Date.now(),text,ms,ok:r?.ok!==false&&(!!r?.matched?.length||!!r?.ack),ack:!!r?.ack,matched:r?.matched||[],message:r?.ok===false?r.message:''});S.heard.length=Math.min(S.heard.length,12);
}
// ── 마이크와 말 끊기(VAD): 소리 크기로 말의 시작과 끝을 찾는다
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
 const rate=S.ctx.sampleRate,frame=2048/rate,pre=[],PRE=Math.ceil(0.3/frame);let floor=0.005,talk=null,quiet=0;
 S.node.onaudioprocess=e=>{
  const x=new Float32Array(e.inputBuffer.getChannelData(0));let sum=0;for(const v of x)sum+=v*v;const rms=Math.sqrt(sum/x.length);
  if(S.speaking||Date.now()<S.mutedUntil||!(S.on||S.prep)){talk=null;pre.length=0;S.level=0;return;}
  const thr=Math.max(0.012,floor*3.5);
  if(!talk){floor=floor*0.95+rms*0.05;pre.push(x);if(pre.length>PRE)pre.shift();if(rms>thr){talk={chunks:[...pre,x],voiced:1};quiet=0;pre.length=0;}S.level=rms/thr;return;}
  talk.chunks.push(x);if(rms>thr){talk.voiced++;quiet=0;}else quiet+=frame;S.level=rms/thr;
  const len=talk.chunks.length*frame;
  if(quiet>=0.9||len>=25){const t=talk;talk=null;if(t.voiced*frame>=0.35)transcribe(t.chunks,rate);}
 };
 S.src.connect(S.node);S.node.connect(S.ctx.destination);render();
}
function transcribe(chunks,rate){
 const n=chunks.reduce((a,c)=>a+c.length,0),audio=new Float32Array(n);let o=0;for(const c of chunks){audio.set(c,o);o+=c.length;}
 let pcm=audio;if(rate!==16000){const r=rate/16000,out=new Float32Array(Math.floor(n/r));for(let i=0;i<out.length;i++)out[i]=audio[Math.floor(i*r)];pcm=out;}
 const w=worker();if(!w)return;S.busy++;w.postMessage({type:'transcribe',id:++S.seq,audio:pcm},[pcm.buffer]);render();
}
// 휴대폰 마이크(원격 리모컨)에서 온 한 마디: 16kHz · 16비트. PC 마이크로 들은 것과 똑같이 받아쓴다 (상대 대사를 읽는 동안 온 소리는 버린다)
function phoneAudio(u8){
 if(!(S.on||S.prep)||S.speaking||Date.now()<S.mutedUntil)return;
 const i16=new Int16Array(u8.buffer,u8.byteOffset,Math.floor(u8.byteLength/2)),f=new Float32Array(i16.length);for(let i=0;i<i16.length;i++)f[i]=i16[i]/32768;
 S.phoneAt=Date.now();transcribe([f],16000);
}
try{root.OrpheiaEngine?.onRemoteAudio?.(phoneAudio);}catch{}
function stopListening(){try{S.node?.disconnect();S.src?.disconnect();S.ctx?.close();}catch{}for(const t of S.stream?.getTracks()||[])t.stop();S.stream=S.ctx=S.node=S.src=null;}
// ── 상대 대사 읽기: Supertonic 2 (ui/voice-tts-worker.js, 배역마다 다른 목소리). 모델 준비 전이나 실패하면 기본 TTS로 읽는다.
const TTS_URL=new URL('ui/voice-tts-worker.js',root.location?.href||'').href;
// 기관사는 열차마다 다른 남자 목소리, 역은 여자 목소리, 관제팀장·운영실은 다른 여자 목소리, 복구반·검수반은 남자 목소리
const VOICE={driver:['M1','M2','M3','M5'],station:['F1','F4'],chief:['F3'],crew:['M4']};
const pickVoice=l=>{const list=VOICE[l.who]||['M1'];const h=[...String(l.name)].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7);return list[Math.abs(h)%list.length];};
// 열번·숫자를 무전에서 읽는 말로 (TTS가 「K1210」을 바르게 읽지 못한다): K1210 → 케이 천이백십
const KO=['','일','이','삼','사','오','육','칠','팔','구'],LETTER={K:'케이',A:'에이',G:'지',M:'엠'};
const koNum=n=>{n=Number(n);if(!n)return '공';let s='';for(const [u,w] of [[1000,'천'],[100,'백'],[10,'십']]){const d=Math.floor(n/u)%10;if(d)s+=(d>1?KO[d]:'')+w;}return s+KO[n%10];};
const readable=t=>String(t).replace(/([KAGM])(\d{3,4})/g,(m,l,d)=>LETTER[l]+' '+(d[0]==='0'?[...d].map(x=>x==='0'?'공':KO[x]).join(''):koNum(d))).replace(/(\d+)호/g,(m,d)=>koNum(d)+'호').replace(/<|>/g,' ');
const T={worker:null,ready:false,failed:false,queue:[],playing:false,ctx:null,seq:0,wait:new Map(),progress:null};
function ttsWorker(){if(T.worker||T.failed)return T.worker;try{T.worker=new Worker(TTS_URL,{type:'module'});}catch{T.failed=true;return null;}
 T.worker.onmessage=e=>{const m=e.data;if(m.type==='ready'){T.ready=true;T.progress=null;}else if(m.type==='progress')T.progress=m;else if(m.type==='error'){T.failed=true;}
  else if(m.type==='audio'||m.type==='fail'){const cb=T.wait.get(m.id);T.wait.delete(m.id);cb?.(m);}render();};
 T.worker.postMessage({type:'load'});return T.worker;}
function synth(line){return new Promise(res=>{const w=ttsWorker();if(!w||!T.ready){res(null);return;}const id=++T.seq;T.wait.set(id,m=>res(m.type==='audio'?m:null));w.postMessage({type:'speak',id,text:readable(line.text),voice:pickVoice(line),speed:line.who==='driver'?1.12:1.05});});}
function playPcm(m){return new Promise(res=>{T.ctx??=new AudioContext();const b=T.ctx.createBuffer(1,m.audio.length,m.rate);b.copyToChannel(m.audio,0);const src=T.ctx.createBufferSource();src.buffer=b;src.connect(T.ctx.destination);src.onended=res;T.ctx.resume?.();src.start();});}
function fallback(line){return new Promise(res=>{const synth=root.speechSynthesis;if(!synth){res();return;}const u=new SpeechSynthesisUtterance(readable(line.text));u.lang='ko-KR';u.pitch={driver:0.8,station:1.15,chief:0.95,crew:1.25}[line.who]||1;u.rate=1.1;u.onend=u.onerror=()=>res();synth.speak(u);setTimeout(res,Math.min(20000,600+line.text.length*180));});}
async function drain(){if(T.playing)return;T.playing=true;S.speaking=true;render();
 while(T.queue.length){const line=T.queue.shift(),pcm=await synth(line);if(pcm)await playPcm(pcm);else await fallback(line);}
 T.playing=false;S.speaking=false;S.mutedUntil=Date.now()+350;render();}
function speakLines(lines){T.queue.push(...lines);drain();}
// FTS 화면이 엔진 상태를 받을 때마다 부른다
function sync(fts,send,doc){
 S.send=send;if(doc)S.doc=doc;const session=fts?.session,idx=session?Math.min(session.current,session.items.length-1):-1,item=session?.items[idx],v=session?.voice?.items?.[idx];
 const live=!!(session?.voice&&!session.finished&&item?.status==='진행');
 const key=session?session.id+':'+idx+':'+(session.attempt||0):'';
 if(key!==S.sessionKey){S.sessionKey=key;S.played=0;S.heard=[];}
 if(live&&!S.on){S.on=true;S.error='';worker();ttsWorker();listen();}
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
 const p=S.progress||T.progress&&!T.ready&&{...T.progress,tts:true},mb=x=>Math.round(x/1e6),phone=Date.now()-(S.phoneAt||0)<120000,status=S.error&&!phone?`⚠ ${S.error}`:p&&!p.total?'음성 모델 준비 중…':p&&p.total?`${p.tts?'목소리(TTS)':'음성인식'} 모델 내려받는 중 ${mb(p.loaded)} / ${mb(p.total)}MB (처음 한 번만)`:!st.live?'음성 1인 모드 · 문제가 진행되면 듣기 시작합니다':S.speaking?'🔊 상대 응답 중 — 끝나면 다시 듣습니다':S.busy?'⏳ 받아쓰는 중…':(phone?'🎙 듣는 중 (휴대폰 마이크) — 무전하듯 말하세요':'🎙 듣는 중 — 무전하듯 말하세요');
 const done=Object.keys(st.v?.done||{}).length;
 const html=`<div class="fts-voice ${S.speaking?'speaking':''}"><div class="fts-voice-status"><b>${esc(status)}</b><small>${S.model?'받아쓰기: '+esc(S.model)+' · ':''}${T.ready?'목소리: Supertonic · ':T.failed?'목소리: 기본 TTS · ':''}알아들은 말 ${done}개</small></div>
<ul class="fts-voice-log">${S.heard.map(h=>`<li class="${h.ok?'ok':'miss'}"><span>${h.ok?'✔':'✖'}</span><div><q>${esc(h.text)}</q>${h.ok?`<small>${h.ack?'응답 (관제 이상 · 수신 이상)':h.matched.map(m=>esc(m.comm+' · '+m.text.slice(0,48))).join('<br>')}</small>`:`<small>${esc(h.message||'대본의 말과 맞지 않습니다 — 열차번호·역 이름을 또렷하게 다시 말해 보세요')}</small>`}</div></li>`).join('')||'<li class="empty">아직 들은 말이 없습니다.</li>'}</ul>
${S.error&&!S.stream&&!phone?'<button type="button" class="sched-btn primary" id="ftsVoiceRetry">🎙 마이크 다시 연결</button>':''}<details class="fts-voice-type"><summary>마이크 없이 시험 (글로 입력)</summary><form id="ftsVoiceForm"><input id="ftsVoiceText" placeholder="예: K1210열차 금천구청역 정차" autocomplete="off"><button class="sched-btn">입력</button></form></details></div>`;
 if(html===last)return;const open=box.querySelector('details')?.open,typed=box.querySelector('#ftsVoiceText')?.value||'',focus=D.activeElement?.id==='ftsVoiceText';last=html;box.innerHTML=html;
 const d=box.querySelector('details');if(open)d.open=true;const inp=box.querySelector('#ftsVoiceText');inp.value=typed;if(focus)inp.focus();
 box.querySelector('#ftsVoiceRetry')?.addEventListener('click',()=>{S.error='';stopListening();listen();render();});
 box.querySelector('#ftsVoiceForm').onsubmit=e=>{e.preventDefault();const t=inp.value.trim();if(!t)return;inp.value='';heard(t,0);render();};
}
// ── 음성 준비 (교육설정에서 「음성 1인 모드」를 켰을 때): 모델을 미리 받고, 마이크 소리 크기와 받아쓰기를 시험하고, 목소리를 들어 본다
let prepTimer=0;
function prepare(doc){if(doc)S.doc=doc;S.prep=true;S.error='';worker();ttsWorker();listen();clearInterval(prepTimer);prepTimer=setInterval(renderPrep,200);renderPrep();}
function stopPrep(){S.prep=false;clearInterval(prepTimer);if(!S.on)stopListening();renderPrep();}
function renderPrep(){
 const D=S.doc?.()||root.document,box=D?.getElementById('suVoicePrep');if(!box){if(S.prep&&!D?.getElementById('ftsVoice'))stopPrepSoon();return;}
 if(!S.prep){if(box.dataset.on){box.innerHTML='';delete box.dataset.on;}return;}
 const mb=x=>Math.round(x/1e6),row=(name,p,ready,failed,done)=>`<li><b>${name}</b> ${ready?`✔ 준비됨${done?' · '+esc(done):''}`:failed?'⚠ 준비 실패':p&&p.total?`내려받는 중 ${mb(p.loaded)} / ${mb(p.total)}MB`:'준비 중…'}</li>`;
 const lvl=Math.max(0,Math.min(1,(S.level||0)/3)),mic=S.stream?`<span class="fts-meter"><i style="width:${Math.round(lvl*100)}%"></i></span>`:'';
 const html=`<div class="fts-voice-prep"><div class="fts-voice-status"><b>음성 준비</b><small>처음 한 번 모델을 내려받습니다 (약 500MB · 인터넷 필요). 그 뒤로는 인터넷 없이 동작합니다.</small></div>
<ul>${row('음성인식 (Whisper)',S.progress,!!S.model,false,S.model)}${row('목소리 (Supertonic)',T.progress,T.ready,T.failed,'')}
<li><b>마이크</b> ${S.error&&!S.stream?'⚠ '+esc(S.error):S.stream?'✔ 듣는 중 '+mic+' <small>말하면 막대가 움직입니다</small>':'연결 중… (처음이면 마이크 허용을 묻습니다)'}</li>
<li><b>받아쓰기 시험</b> ${S.prepHeard.length?S.prepHeard.map(t=>`<q>${esc(t)}</q>`).join(' '):S.busy?'⏳ 받아쓰는 중…':S.model?'「K1210열차 금천구청역 정차」처럼 말해 보세요':'음성인식 모델이 준비되면 시험할 수 있습니다'}</li></ul>
<div class="fts-row-btns"><button type="button" class="sched-btn" id="suVoiceHear" ${T.playing?'disabled':''}>🔊 목소리 들어 보기</button>${!S.stream?'<button type="button" class="sched-btn primary" id="suVoiceRetry">🎙 마이크 다시 연결</button>':''}<button type="button" class="sched-btn" id="suVoiceStop">마이크 시험 끝내기</button></div></div>`;
 if(box.dataset.html===html)return;box.dataset.html=html;box.dataset.on='1';box.innerHTML=html;
 box.querySelector('#suVoiceHear').onclick=()=>speakLines([{who:'driver',name:'K1210 기관사',text:'K1210 열차. 수신 이상!'},{who:'station',name:'금천구청역',text:'금천구청역, 수신 이상!'}]);
 box.querySelector('#suVoiceStop').onclick=stopPrep;
 box.querySelector('#suVoiceRetry')?.addEventListener('click',()=>{S.error='';stopListening();listen();renderPrep();});
}
let stopping=0;function stopPrepSoon(){clearTimeout(stopping);stopping=setTimeout(()=>{const D=S.doc?.()||root.document;if(S.prep&&!D?.getElementById('suVoicePrep'))stopPrep();},1500);}      // 교육설정 화면을 떠나면 마이크 시험을 끝낸다
root.SimVoiceSolo={sync,render,heard,readable,prepare,stopPrep,phoneAudio,state:()=>({on:S.on,speaking:S.speaking,busy:S.busy,model:S.model,error:S.error,heard:S.heard.slice()})};
})(typeof window!=='undefined'?window:globalThis);
