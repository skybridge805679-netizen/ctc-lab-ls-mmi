/* 구술 릴레이 (운행선관리 구술 연습): 문제를 이어서 내고, 교육생이 말한 내용(음성인식)에서 핵심 항목을 하나씩 체크한다.
 * - 문제 은행: engine/oral-line.js (기출 items + 교재 book). 문항마다 말해야 할 핵심 항목(key)이 있다.
 * - 항목 판정: 그 문제에서 지금까지 말한 글 전체에 그 항목의 글 조각(음절 두 개씩)이 충분히 들어 있으면 체크. 조사·어순이 달라도 핵심어가 맞으면 된다.
 * - 출제: 간격 반복(Anki 방식) — 틀린 문제는 곧 다시, 맞힌 문제는 점점 뜸하게. 끄면 무작위.
 * 화면(ui/oral-relay.js)과 시험이 같은 규칙을 쓴다. */
(function(root){'use strict';
const node=typeof module!=='undefined',O=node?require('./oral-line'):root.SimOralLine;
const all=()=>[...(O?.items||[]).map(x=>({...x,set:'기출'})),...(O?.book||[]).map(x=>({...x,set:'교재'}))];
// 범위: 'all' 전범위 · 'exam' 기출만 · 'ch:<장 이름>' 그 장만
function pool(scope='all'){const list=all();if(scope==='exam')return list.filter(x=>x.set==='기출'||(x.tags||[]).includes('기출'));if(String(scope).startsWith('ch:')){const ch=scope.slice(3);return list.filter(x=>x.ch===ch);}return list;}
const chapters=()=>O?.CHAPTERS||[...new Set(all().map(x=>x.ch))];
// 글 조각: 숫자도 남긴다 (「30초」「90초」「3분」이 핵심인 항목이 있다). 번호 머리(1. ① 가.)와 문장부호는 뺀다
const DIGIT={영:0,공:0,일:1,이:2,삼:3,사:4,오:5,육:6,칠:7,팔:8,구:9};
const clean=t=>String(t||'').replace(/^\s*(\d+[.)]|[①-⑳]|[가-하][.)])\s*/,'').replace(/[^가-힣A-Za-z0-9]/g,'');
const grams=t=>{const s=clean(t),g=new Set();for(let i=0;i<s.length-1;i++)g.add(s.slice(i,i+2));if(s.length===1)g.add(s);return g;};
const recall=(key,heard)=>{const g=grams(key);if(!g.size)return 0;let hit=0;for(const x of g)if(heard.has(x))hit++;return hit/g.size;};
// 항목의 핵심어: 문제 글에 이미 나온 말(「종합시험운행의 …」)은 실제 구술에서 되풀이하지 않으므로 빼고 본다 (남는 조각이 너무 적으면 전체로)
function keyGrams(item,k){const g=grams(k),q=grams(item.q),own=new Set([...g].filter(x=>!q.has(x)));return own.size>=3?own:g;}
// 항목 길이에 따라 기준을 다르게: 짧은 항목은 거의 그대로, 긴 항목은 핵심어 절반 이상이면 인정
const need=n=>n>=12?0.5:n>=6?0.55:0.75;
// 지금까지 말한 글(transcript)에서 새로 체크되는 항목 번호
// 항목만의 단어: 문제 글에 없는 단어에서 조사·이음말을 뗀 것 (「종합시험운행의 일정」 → 일정)
const PARTICLE=/(으로서|으로|에서|에게|부터|까지|이며|이고|하여|하고|하는|되는|된|의|은|는|이|가|을|를|에|와|과|로|도|및|등)$/;
const words=(item,k)=>{const q=clean(item.q);return String(k).replace(/[^\uAC00-\uD7A3A-Za-z0-9\s]/g,' ').split(/\s+/).map(w=>w.replace(PARTICLE,'')).filter(w=>w.length>=2&&!q.includes(w)&&!/^(및|등|그|밖에|경우|필요한|사항|대한|관한|위한|대하여|위하여|관하여|따른|따라|있는|없는|해당)$/.test(w));};
// 지금까지 말한 글(transcript)에서 새로 체크되는 항목 번호: 글 조각 비율 또는 항목만의 단어 대부분
function check(item,transcript,done=[]){const heard=grams(transcript),said=clean(transcript),out=[];item.key.forEach((k,i)=>{if(done.includes(i))return;
 const g=keyGrams(item,k);let hit=0;for(const x of g)if(heard.has(x))hit++;
 const w=words(item,k),len=w.reduce((a,x)=>a+x.length,0),wordHit=len?w.filter(x=>said.includes(x)).reduce((a,x)=>a+x.length,0)/len:0;      // 글자 수로 가중 (긴 핵심어가 중요)
 if(g.size&&hit/g.size>=need(g.size)||len>=2&&wordHit>=0.6)out.push(i);});return out;}
// 항목별 맞힌 정도 (결과 화면에서 모범 답안 줄과 빠진 항목을 짝짓는 데에도 쓴다)
const similar=(a,b)=>recall(a,grams(b));
// 「이상입니다」: 구술을 마칠 때 하는 말 → 그 문제를 끝내고 지금까지 말한 항목으로 채점 (빠진 항목은 오답).
// 「200m 이상입니다」「2년 이상입니다」처럼 수량 뒤의 「이상」은 답의 일부다 → 말 첫머리, 문장부호 뒤, 문장을 맺은 말(…합니다·…요·…함) 뒤일 때만 끝으로 본다.
// 반환: 끝말 앞에 함께 말한 글 (없으면 '') · 끝말이 아니면 null
const END=/(^|[.,!?…]\s*|(?:다|요|죠|함|음|임|됨|있음|없음)[.,!?]?\s+)이상\s*(?:입니다|임니다|입니당|입니다요|임다|이에요|이요|입니다만)?[\s.,!?~…]*(?:감사합니다[\s.!]*)?$/;
function endOf(t){const s=String(t||'').trim(),m=s.match(END);if(!m)return null;const head=s.slice(0,m.index+m[1].length).trim();
 if(m[1]===''&&!/^이상\s*(?:입니다|임니다|입니당|입니다요|임다|이에요|이요|입니다만)?[\s.,!?~…]*(?:감사합니다[\s.!]*)?$/.test(s))return null;return head;}
const isSkip=t=>/^\s*(패스|다음\s*문제|넘어가|모르겠)/.test(String(t||''))||/^(패스|패쓰|파스|빠스|pass)[.!]?$/i.test(String(t||'').trim());
// Whisper 문맥 힌트: 그 문제의 핵심 항목들 (정해진 몇 개 중 무엇을 말했는지 고르는 문제가 된다)
const hint=item=>[item.ch,...item.key].join('. ').slice(0,560)+'. 이상입니다. 패스.';      // 끝말은 맨 뒤(앞 문맥은 뒤쪽이 남는다)
// ── 간격 반복 (SM-2를 줄인 것): 점수 비율로 다시/어려움/좋음을 정한다
const DAY=86400000;
function grade(stat={},fraction,now=Date.now()){
 const s={reps:0,ease:2.5,interval:0,lapses:0,...stat};s.last=now;s.score=Math.round(fraction*100);s.best=Math.max(s.best||0,s.score);s.seen=(s.seen||0)+1;
 if(fraction<0.6){s.lapses++;s.reps=0;s.interval=0;s.ease=Math.max(1.3,s.ease-0.2);s.due=now+3*60*1000;}           // 다시: 몇 문제 뒤(3분)
 else if(fraction<0.9){s.ease=Math.max(1.3,s.ease-0.15);s.interval=s.reps?Math.max(1,s.interval*1.2):0.5;s.reps++;s.due=now+s.interval*DAY;}   // 어려움
 else{s.interval=s.reps===0?1:s.reps===1?3:Math.round(s.interval*s.ease);s.reps++;s.due=now+s.interval*DAY;}       // 좋음
 return s;
}
// 다음 문제: (간격 반복) 기한이 된 문제(오래 밀린 것부터) → 처음 보는 문제(무작위) → 가장 가까운 기한. 방금 낸 문제는 피한다
function pick(items,stats={},{now=Date.now(),recent=[],srs=true,random=Math.random}={}){
 const avail=items.filter(x=>!recent.includes(x.id)),list=avail.length?avail:items;if(!list.length)return null;
 if(!srs)return list[Math.floor(random()*list.length)];
 const due=list.filter(x=>stats[x.id]?.due!=null&&stats[x.id].due<=now).sort((a,b)=>stats[a.id].due-stats[b.id].due);if(due.length)return due[0];
 const fresh=list.filter(x=>!stats[x.id]);if(fresh.length)return fresh[Math.floor(random()*fresh.length)];
 return [...list].sort((a,b)=>(stats[a.id]?.due||0)-(stats[b.id]?.due||0))[0];
}
// 모범 답안에서 말하지 못한 항목의 말을 찾아 표시한다: 답안 한 줄에 항목이 여럿 들어 있어도 빠진 부분만 강조된다
// 반환: 줄마다 [{text, miss}] 조각. 단어(조사 뗀 것)가 빠진 항목에 들어 있고 말한 항목에는 없으면 빠진 부분.
function highlight(item,missed){
 const q=clean(item.q),miss=missed.map(i=>clean(item.key[i])),got=item.key.map((k,i)=>missed.includes(i)?null:clean(k)).filter(Boolean);
 return item.a.map(line=>{const text=String(line).replace(/^\s*(\d+[.)]|[①-⑳])\s*/,''),parts=text.split(/(\s+)/),out=[];
  for(const p of parts){const w=clean(p).replace(PARTICLE,'');const m=!/^\s*$/.test(p)&&w.length>=2&&miss.some(k=>k.includes(w))&&!got.some(k=>k.includes(w))&&!q.includes(w);      // 문제 글에 이미 나온 말은 칠하지 않는다
   const last=out.at(-1);if(last&&(last.miss===m||/^\s+$/.test(p)))last.text+=p;else out.push({text:p,miss:m});}
  return out;});
}
const api={highlight,all,pool,chapters,check,similar,isSkip,endOf,hint,grade,pick,recall,grams};
if(node)module.exports=api;else root.SimOralRelay=api;
})(typeof window!=='undefined'?window:globalThis);
