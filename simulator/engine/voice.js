/* 음성 1인 모드: 교육생의 무전 한 마디(음성인식 결과)를 대본의 한 단계로 알아듣고, 그 말에 나온 열차만 반응하게 한다.
 * - 대본 통보 하나(n3 등)에 여러 상대와의 회화가 들어 있다. 음성 모드에서는 관제사의 말 한 마디가 한 단계다.
 *   「K1210열차 금천구청역 정차」를 알아들으면 K1210만 금천구청역에 선다 (통보 n3 전체를 기다리지 않는다).
 * - 대본의 상대 대사(기관사·역·관제팀장)는 그 단계 뒤에 상대 응답으로 돌려준다 (화면이 음성으로 읽는다).
 * - 통보의 필요한 말을 다 하면 그 통보를 확인한 것으로 FTS에 넘긴다 (교수가 통보 체크를 누르던 것과 같다).
 * 대본 말 나누기(utterances)는 오르페이아 게임(ctc-drill.js)의 방식을 따랐다. */
(function(root){'use strict';
const node=typeof module!=='undefined',N=node?require('./network'):root.SimNetwork,L=node?require('./line'):root.SimLine;

// ── 대본 원문 → 말 단위. 「(관)」「(기)」「(석수역)」이 말을 열고, 들여쓴 줄은 이어진다. 괄호만 있는 줄은 다른 표현, 「※」 줄은 운영자 메모.
function utterances(text){
 const out=[];let cur=null,note=false;
 for(const raw of String(text||'').split('\n')){
  const l=raw.replace(/\(_|_\)/g,'').replace(/_/g,''),drop=t=>t.replace(/\s{2,}\([^)]*\)/g,' ');
  if(/^\s*[\d-]+\s*$/.test(l)||!l.trim())continue;
  if(/^\s*※/.test(l)){note=true;continue;}
  const m=l.match(/^\s*\(?([^()\s\d][^()\s]{0,13})\)\s*(.*)$/);
  if(m){note=false;cur={sp:m[1],text:drop(m[2])};out.push(cur);continue;}
  const t=drop(l).trim();if(note||!t||/^\(.*\)$/.test(t))continue;
  if(cur)cur.text+=' '+t.replace(/^-\s*/,'');else out.push(cur={sp:'관',text:t});
 }
 for(const u of out)u.text=u.text.replace(/~{2,}/g,' — ').replace(/\s+/g,' ').trim();
 return out.filter(u=>u.text);
}
// 말하는 사람 → 배역 (화면 표시·음성 높낮이)
function role(sp,text){
 const train=(text.match(/([A-Z]\d{3,4})\s*열차/)||[])[1];
 if(sp==='관')return {who:'controller',name:'관제'};
 if(sp==='기'||/열차$/.test(sp))return {who:'driver',name:`${train||''} 기관사`.trim()};
 if(/팀장|운영실/.test(sp))return {who:'chief',name:sp};
 if(/복구반|검수반|전기|기동/.test(sp))return {who:'crew',name:sp};
 return {who:'station',name:sp.replace('역/열차','역')};
}
const TRAIN=/[KAGM][A-Z]?\d{3,4}/g;
// 관제사의 의례적인 말(「관제 이상」「수신 이상」)만 남은 단계는 채점하지 않는다
const FILLER=/(철도)?관제\s*이상!?|수신\s*이상!?|이상!|확인!|관제이상/g;
const core=t=>String(t).replace(FILLER,' ').replace(/[^가-힣A-Z0-9]/g,'');

// ── 음성인식 결과 정리: 한글 숫자·알파벳 읽기를 열번 표기로 (「케이 천이백십」→ K1210, 「케이 공사오이」→ K0452)
const DIGIT={영:0,공:0,빵:0,일:1,하나:1,이:2,둘:2,삼:3,셋:3,사:4,넷:4,오:5,육:6,륙:6,칠:7,팔:8,구:9};
function koNumber(s){
 if(/[천백십]/.test(s)){let v=0,cur=0;for(const ch of s){if(ch in DIGIT&&ch.length===1)cur=DIGIT[ch];else if(ch==='천'){v+=(cur||1)*1000;cur=0;}else if(ch==='백'){v+=(cur||1)*100;cur=0;}else if(ch==='십'){v+=(cur||1)*10;cur=0;}}return String(v+cur);}
 return [...s].map(ch=>DIGIT[ch]??'').join('');
}
function normalize(text){
 let t=String(text||'').toUpperCase().replace(/[‐-―]/g,'-');
 t=t.replace(/케이\s*/g,'K').replace(/에이\s*/g,'A').replace(/(쥐|지)\s*(?=[\d영공일이삼사오육칠팔구천백])/g,'G').replace(/엠\s*(?=[\d영공일이삼사오육칠팔구])/g,'M');
 // 한글로 읽은 숫자는 열번 자리에서만 바꾼다 (알파벳 뒤 · 「열차」 앞) — 「금천구청」의 「천」을 숫자로 읽지 않게
 const KN='[영공빵일이삼사오육륙칠팔구천백십]';
 t=t.replace(new RegExp('([KAGM])\\s*('+KN+'+)','g'),(m,l,n)=>l+koNumber(n)).replace(new RegExp('('+KN+'{2,})\\s*(?=열차)','g'),m=>koNumber(m.trim()));
 t=t.replace(/([KAGM])\s*-?\s*(\d)/g,'$1$2').replace(/(\d)\s+(?=\d)/g,'$1');
 return t.replace(/\s+/g,' ').trim();
}
// 들은 말에서 열번 찾기: 문제의 열차 목록 중 가장 가까운 번호 (음성인식이 「K-1200 8」「K11이」「1210차」처럼 흔들려도)
const lev=(a,b)=>{const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t;}}return d[b.length];};
function trainsIn(text,known){
 const out=new Set(),norm=normalize(text).replace(/(\d)([일이삼사오육칠팔구공영])(?=\s|열차|차|$)/g,(m,d,k)=>d+DIGIT[k]);
 for(const m of norm.matchAll(/([KAGM])?[\s-]*((?:\d[\s-]?){2,5}\d)/g)){
  const digits=m[2].replace(/[\s-]/g,''),pool=known.filter(k=>!m[1]||k[0]===m[1]),score=k=>Math.min(lev(digits,k.slice(1)),lev(digits,k.slice(1).replace(/^0+/,'')));
  const best=Math.min(...pool.map(score));let hit=pool.filter(k=>score(k)===best);
  if(hit.length>1){const pre=hit.filter(k=>digits.startsWith(k.slice(1))||digits.startsWith(k.slice(1).replace(/^0+/,'')));if(pre.length===1)hit=pre;}      // 「K1210이」: 조사가 숫자로 읽힌 것
  if(hit.length===1&&(best===0||best<=Math.floor(digits.length/4)+(m[1]?1:0)))out.add(hit[0]);
 }
 return [...out];
}
// 역 이름 (비연동 중간역 포함). 음성인식이 「가산디지털단지」「금천구청」처럼 붙이거나 떼어 써도 찾는다
const NAMES=N.stations.map(s=>({id:s.id,name:s.name,key:s.name.replace(/\s/g,'')})).sort((a,b)=>b.key.length-a.key.length);
// 세 글자 이상 역 이름은 한 글자 틀린 받아쓰기도 찾는다 (「금청구청」 → 금천구청)
const levS=(a,b)=>{const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t;}}return d[b.length];};
function stationsIn(text){const t=String(text).replace(/\s/g,''),out=[];let rest=t;
 for(const s of NAMES)if(rest.includes(s.key)){out.push(s.id);rest=rest.split(s.key).join('#');}
 for(const s of NAMES){if(out.includes(s.id)||s.key.length<3)continue;for(let i=0;i+s.key.length<=rest.length;i++){const w=rest.slice(i,i+s.key.length);if(!w.includes('#')&&levS(w,s.key)<=1&&w[0]===s.key[0]){out.push(s.id);rest=rest.slice(0,i)+'#'+rest.slice(i+s.key.length);break;}}}
 return out;}

// ── 문제 → 음성 단계. 통보마다 관제사의 말 한 마디가 한 단계.
//  to: 그 말을 받는 열차(앞 말에서 이어짐) · stop: 「○○열차 ○○역 정차 / 출발 정지」 · reply: 그 말 뒤 상대 대사 · lead: 상대가 먼저 거는 무전
function plan(problem){
 const comms=[],steps=[],known=new Set();
 for(const c of problem.communications||[]){
  const us=utterances(c.text),lead=[];let i=0;
  while(i<us.length&&us[i].sp!=='관'){lead.push({...role(us[i].sp,us[i].text),text:us[i].text});i++;}
  const mine=[];let to=null;
  for(;i<us.length;i++){
   const u=us[i];if(u.sp!=='관'){mine.at(-1)?.reply.push({...role(u.sp,u.text),text:u.text});continue;}
   const named=[...new Set(u.text.match(TRAIN)||[])];named.forEach(n=>known.add(n));
   if(named.length)to=named;else if(/^(철도관제에서|[가-힣]+역[,.\s]|관제팀장|관제운영실|사고복구반|기동검수반)/.test(u.text))to=null;
   const m=u.text.match(/([KAGM]\d{3,4})\s*열차\s*[.,]?\s*([가-힣]+?)역\s*(정차|출발\s*정지)/),st=m&&stationsIn(m[2]+'역')[0];
   const body=core(u.text);
   mine.push({id:c.id+'#'+mine.length,comm:c.id,label:c.label,text:u.text,to:named.length?named:to||[],stations:stationsIn(u.text),
    stop:m&&st?{number:m[1],station:st,kind:m[3].replace(/\s/g,'')}:null,required:body.length>=4,reply:[]});
  }
  for(const r of lead)for(const n of r.text.match(TRAIN)||[])known.add(n);
  comms.push({id:c.id,label:c.label,lead,steps:mine.map(s=>s.id),incoming:lead.length>0});steps.push(...mine);
 }
 for(const t of problem.setup?.trains||[])known.add(t.number);
 // 원문 오기(「K809」)는 같은 번호의 4자리 열번(K0809)으로 하나만 남긴다
 const list=[...known],canon=list.filter(k=>!list.some(o=>o!==k&&o[0]===k[0]&&Number(o.slice(1))===Number(k.slice(1))&&o.length>k.length));
 return {comms,steps,known:canon};
}
// 음절 두 개씩 겹친 조각 (띄어쓰기·조사 차이에 덜 민감하다)
// 열번(숫자)은 따로 맞추므로 글 조각 비교에서는 뺀다 — 열번만 같고 내용이 다른 말(「K1208 석수역 정차」 vs 「K1208 정상운행 가능」)을 비슷하다고 보지 않게
const grams=t=>{const s=core(normalize(t).replace(/[KAGM]?[\s-]*\d[\d\s-]*/g,' ')),g=new Set();for(let i=0;i<s.length-1;i++)g.add(s.slice(i,i+2));return g;};
// 들은 말이 어느 단계인가: 열차가 나오는 단계는 그 열번을 들어야 하고, 글 조각이 충분히 겹쳐야 한다.
// 한 번에 이어 말한 여러 단계(「K1210열차 관제 이상… 신호 확인 출발」)도 함께 알아듣는다.
const better=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]>b[i];return false;};
function match(p,done,said,{current,near=[]}={}){
 const heard=grams(said),trains=trainsIn(said,p.known),places=stationsIn(normalize(said)),cands=[],order=new Map(p.steps.map((s,i)=>[s.id,i])),ci=p.comms.findIndex(c=>c.id===current);
 for(const s of p.steps){
  if(done[s.id]!=null||!s.required)continue;      // 0초에 한 말도 한 것
  const g=grams(s.text);if(!g.size)continue;
  const own=(s.text.match(TRAIN)||[]);
  const same=(a,b)=>a[0]===b[0]&&Number(a.slice(1))===Number(b.slice(1));      // 원문의 「K809」 = K0809
  if(own.length&&!own.some(n=>trains.some(t=>same(t,n))))continue;                                    // 열차에게 한 말은 그 열번을 들어야 한다
  if(!own.length&&s.to.length&&trains.length&&!s.to.some(n=>trains.some(t=>same(t,n))))continue;      // 다른 열차에게 한 말
  if(s.stop&&!places.includes(s.stop.station))continue;
  if(s.stop&&(s.stop.kind==='출발정지')!==/출발/.test(said))continue;      // 「정차」와 「출발 정지」는 다른 지시                                         // 정차 지시는 역 이름까지
  if(s.stations.length&&places.length&&!s.stations.some(x=>places.includes(x)))continue;
  cands.push({step:s,g,ahead:ci>=0?Math.max(0,p.comms.findIndex(c=>c.id===s.comm)-ci):0});
 }
 // 한 문장에 이어 말한 여러 단계: 가장 많이 겹치는 단계부터 그 조각을 가져가고, 남은 조각으로 다음 단계를 본다
 // (긴 지시 속 「K1208열차」 같은 짧은 호출 단계가 덩달아 인정되지 않게)
 const left=new Set(heard),out=[];
 for(;;){
  let best=null;
  for(const c of cands){if(out.some(o=>o.step===c.step))continue;let hit=0;for(const x of c.g)if(left.has(x))hit++;const recall=hit/c.g.size;
   const s=c.step,call=core(s.text.replace(TRAIN,'')).replace(/열차/g,'').length<3,soon=near.includes(s.id)&&!call,ok=(recall>=(soon?0.35:0.5)&&hit/left.size>=(soon?0.25:call?0.6:0.4))||      /* 짧은 호출(「K1208열차. 관제 이상!」)은 들은 말이 거의 그 호출뿐일 때만 — 정차 지시를 호출로 잘못 인정하지 않게 */      /* 다음에 할 말(대본 순서 가까운 단계)은 받아쓰기가 조금 틀려도 인정 */(s.stop&&trains.some(t=>t[0]===s.stop.number[0]&&Number(t.slice(1))===Number(s.stop.number.slice(1)))&&/정차|정지/.test(said)&&(s.stop.kind==='출발정지')===/출발/.test(said));if(!ok||!hit)continue;      // 남은 말의 상당 부분이 그 단계여야 한다 (정차 지시를 되풀이했을 때 짧은 호출 단계로 잘못 인정하지 않게)
   const key=[hit+(s.stop?3:0),recall,-c.ahead,-order.get(s.id)];      // 겹친 조각 수 → 겹친 비율 → 지금 통보에 가까운 것 → 대본 순서
   if(!best||better(key,best.key))best={c,key,recall};}
  if(!best)break;
  out.push({step:best.c.step,score:best.recall});for(const x of best.c.g)left.delete(x);
  if(left.size<2)break;
 }
 return out;
}
// 비연동 중간역의 정차 칸: 그 역 본선(상·하행)의 열번창. 원본 LS의 정지위치 회로(B969T)가 열번창이 아니면 그 회로를 밟는 열번창(B967T)
function stopSlot(station,direction,trunkHint){
 const I=L.INTERMEDIATE[station];if(!I)return null;
 const want=direction==='down'?'D':'U',keys=Object.keys(I.slots).filter(k=>k.endsWith(want)),key=trunkHint&&keys.includes(trunkHint)?trunkHint:keys.find(k=>k.startsWith('E'))||keys[0];
 const slot=I.slots[key];return {host:I.host,slot,trunk:key};
}
// 의례적인 응답만 한 말 (「철도관제 이상」「수신 이상」) — 채점할 말은 아니지만 알아들은 것으로 본다
const isAck=t=>core(normalize(t)).replace(/철도|관제|수신|이상/g,'').length<3;
// ── 상대 대사 음성 (화면 · 미리 만든 음성 파일 도구가 같이 쓴다)
// 배역별 목소리: 기관사는 열차마다 다른 남자 목소리, 역은 여자, 관제팀장·운영실·안내는 다른 여자, 복구반·검수반은 남자 (Supertonic 2 목소리 이름)
const VOICES={driver:['M1','M2','M3','M5'],station:['F1','F4'],chief:['F3'],crew:['M4']};
const fnv=t=>{let h=0x811c9dc5;for(const c of String(t)){h^=c.codePointAt(0);h=Math.imul(h,0x01000193)>>>0;}return h;};
const voiceOf=l=>{const list=VOICES[l.who]||['M1'];return list[fnv(l.name)%list.length];};
// 열번·숫자를 무전에서 읽는 말로 (TTS가 「K1210」을 바르게 읽지 못한다): K1210 → 케이 천이백십, 3호 → 삼호
const KO=['','일','이','삼','사','오','육','칠','팔','구'],LETTERS={K:'케이',A:'에이',G:'지',M:'엠'};
const koNum=n=>{n=Number(n);if(!n)return '공';let s='';for(const [u,w] of [[1000,'천'],[100,'백'],[10,'십']]){const d=Math.floor(n/u)%10;if(d)s+=(d>1?KO[d]:'')+w;}return s+KO[n%10];};
const readable=t=>String(t).replace(/([KAGM])(\d{3,4})/g,(m,l,d)=>LETTERS[l]+' '+(d[0]==='0'?[...d].map(x=>x==='0'?'공':KO[x]).join(''):koNum(d))).replace(/(\d+)호/g,(m,d)=>koNum(d)+'호').replace(/[<>]/g,' ').replace(/\s+/g,' ').trim();
// 미리 만든 음성 파일 이름: 목소리 + 읽는 글
const lineKey=l=>{const v=voiceOf(l),t=readable(l.text);return v+'-'+fnv(v+'|'+t).toString(16).padStart(8,'0');};
// 문제의 모든 상대 대사와 FTS 안내 (미리 만들 목록): 기본 통보 + 상황 변경 통보, 문제 발생 안내, 상황 변경 안내
function linesOf(problem){
 const out=[],add=l=>{if(l?.text&&!out.some(x=>x.name===l.name&&x.text===l.text&&x.who===l.who))out.push(l);};
 const comms=[...(problem.communications||[]),...(problem.branches||[]).flatMap(b=>b.communications||[])];
 const P=plan({...problem,communications:comms});for(const c of P.comms)c.lead.forEach(add);for(const s of P.steps)s.reply.forEach(add);
 if(problem.voice||problem.name)add({who:'chief',name:'안내',text:problem.voice||problem.name});
 for(const b of problem.branches||[]){const said=String(b.text||b.label).split('\n')[0].replace(/^[\s▪•·-]+/,'').trim()||b.label;add({who:'chief',name:'안내',text:'상황 변경 · '+said});}
 return out;
}
const api={isAck,voiceOf,readable,lineKey,linesOf,utterances,role,normalize,trainsIn,stationsIn,plan,match,stopSlot,koNumber};
if(node)module.exports=api;else root.SimVoice=api;
})(typeof window!=='undefined'?window:globalThis);
