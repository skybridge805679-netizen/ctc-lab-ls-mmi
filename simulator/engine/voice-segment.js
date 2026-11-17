/* 말 자르기(VAD)와 받아쓰기 결과 다듬기: 음성 1인 모드·구술 연습이 함께 쓰고, 측정 도구(tools/bench-oral-asr.cjs)도 같은 코드를 쓴다.
 * - 소리 크기(RMS)로 말의 시작·끝을 찾는다. 32ms 단위로 본다 (PC 마이크든 휴대폰에서 1초씩 온 소리든 같다).
 * - end초 동안 조용하면 한 마디 끝. 쉬지 않고 이어 말할 때는:
 *     soft초가 지나면 짧은 숨 고르기(gap초)에서 자르고, hard초가 되면 그 사이에서 소리가 가장 작은 곳에서 자른다 (단어 한가운데를 자르지 않게).
 *   한 마디가 짧을수록 Whisper가 덜 빠뜨리고, 구술 연습은 말하는 동안에도 항목이 체크된다.
 * - tidy(): Whisper가 지어내는 말(방송 끝인사·같은 말 되풀이·소리 길이에 비해 너무 많은 글자)을 걸러 낸다. */
(function(root){'use strict';
const FRAME_S=0.032;
function create(o={}){
 const opt={rate:16000,end:0.9,soft:Infinity,gap:0.2,hard:25,minVoiced:0.35,pre:0.3,floorMin:0.012,factor:3.5,...o};
 const rate=opt.rate,N=Math.round(FRAME_S*rate),fd=N/rate;
 let carry=new Float32Array(0),floor=0.005,pre=[],talk=null,level=0;
 const voicedTime=t=>t.voiced.reduce((a,v)=>a+v,0)*fd;
 function emit(frames,voiced,cut){
  if(voiced.reduce((a,v)=>a+v,0)*fd<opt.minVoiced)return;
  const audio=new Float32Array(frames.length*N);frames.forEach((f,i)=>audio.set(f,i*N));
  opt.onSegment?.(audio,{dur:audio.length/rate,cut,rate});
 }
 // talk의 앞 cut 프레임을 한 마디로 내보내고, 나머지로 이어 듣는다
 function split(cut,why){const t=talk;emit(t.frames.slice(0,cut),t.voiced.slice(0,cut),why);
  const rest={frames:t.frames.slice(cut),rms:t.rms.slice(cut),voiced:t.voiced.slice(cut),quiet:0};
  let q=0;for(let i=rest.voiced.length-1;i>=0&&!rest.voiced[i];i--)q+=fd;rest.quiet=q;
  talk=rest.voiced.some(Boolean)?rest:null;if(!talk)pre=rest.frames.slice(-Math.ceil(opt.pre/fd));}
 function frame(x){
  let sum=0;for(let i=0;i<x.length;i++)sum+=x[i]*x[i];const rms=Math.sqrt(sum/x.length),thr=Math.max(opt.floorMin,floor*opt.factor),on=rms>thr;level=rms/thr;
  if(!talk){floor=floor*0.95+rms*0.05;pre.push(x);if(pre.length>Math.ceil(opt.pre/fd))pre.shift();
   if(on){talk={frames:[...pre],rms:pre.map(()=>0),voiced:pre.map(()=>0),quiet:0};pre=[];}else return;}
  talk.frames.push(x);talk.rms.push(rms);talk.voiced.push(on?1:0);talk.quiet=on?0:talk.quiet+fd;
  const len=talk.frames.length*fd;
  if(talk.quiet>=opt.end){const t=talk;talk=null;emit(t.frames,t.voiced,'end');return;}
  if(len>=opt.soft&&talk.quiet>=opt.gap){split(talk.frames.length-Math.floor(talk.quiet/fd/2),'gap');return;}      // 숨 고르기 한가운데서 자른다
  if(len>=opt.hard){const from=Math.floor((Number.isFinite(opt.soft)?Math.min(opt.soft,opt.hard*0.5):opt.hard*0.5)/fd);let best=from;
   for(let i=from;i<talk.rms.length;i++)if(talk.rms[i]<talk.rms[best])best=i;split(best+1,'hard');}
 }
 return {
  feed(x){const all=new Float32Array(carry.length+x.length);all.set(carry);all.set(x,carry.length);let i=0;for(;i+N<=all.length;i+=N)frame(all.subarray(i,i+N).slice());carry=all.slice(i);},
  flush(){if(talk){const t=talk;talk=null;emit(t.frames,t.voiced,'flush');}},
  reset(){talk=null;pre=[];carry=new Float32Array(0);level=0;},
  set(o){Object.assign(opt,o);},
  current(){if(!talk)return null;const a=new Float32Array(talk.frames.length*N);talk.frames.forEach((f,i)=>a.set(f,i*N));return a;},      // 아직 끝나지 않은 말 (중간 받아쓰기용)
  get talking(){return !!talk;},get level(){return level;},get voiced(){return talk?voicedTime(talk):0;},
 };
}
// 소리 길이에 맞춘 받아쓰기 토큰 수: Whisper 디코더는 앞 문맥까지 448토큰이 한계다. 한국어는 1초에 대략 14토큰 이내.
const budget=dur=>Math.min(440,Math.ceil(dur*14)+16);
// Whisper가 무음·잡음·긴 소리에서 지어내는 말을 걸러 낸다. 반환: 다듬은 글 ('' = 버림)
const NOISE=/(시청해\s*주셔서\s*감사합니다|구독과\s*좋아요[^.]*|MBC\s*뉴스[^.]*|자막\s*(제공|by)[^.]*|다음\s*영상에서\s*만나요)[.!]?/g;
function tidy(text,dur){
 let t=String(text||'').replace(NOISE,' ').replace(/\s+/g,' ').trim();
 const n=(t.match(/[가-힣A-Za-z0-9]/g)||[]).length;
 if(dur>0&&n>Math.max(8,dur*11))return '';      // 소리 길이에 비해 글자가 너무 많다 (지어낸 글)
 t=t.replace(/(.{2,24}?)(?:[\s,.]*\1){2,}/g,'$1');      // 같은 말 세 번 넘게 되풀이 → 한 번
 if(/^(감사합니다|[.…\s]+)$/.test(t))return '';
 return t;
}
// 받아쓰기를 일찍 끝냈는지: Whisper는 한 마디 안에서 첫 문장이 끝나면 뒤를 버리고 끝내는 일이 있다 (「…받아야 한다.」 뒤의 문장이 통째로 빠짐).
// 그 사람의 말 빠르기(지금까지 받아쓴 1초당 글자 수)에 비해 글자가 절반 남짓도 안 되면 다시 받아쓴다 (앞 문맥 없이).
const chars=t=>(String(t||'').match(/[가-힣A-Za-z0-9]/g)||[]).length;
function speed(prev,text,dur){if(dur<2)return prev;const r=chars(text)/dur;if(!(r>1))return prev;return prev?prev*0.7+r*0.3:r;}      // 1초당 글자 수 (지수 평균)
const short=(text,dur,rate)=>dur>=3&&rate>0&&chars(text)<rate*dur*0.7;
const api={create,budget,tidy,chars,speed,short,FRAME_S};
if(typeof module!=='undefined')module.exports=api;else root.SimVoiceSegment=api;
})(typeof window!=='undefined'?window:globalThis);
