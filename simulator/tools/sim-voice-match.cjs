// 음성 판정 빠른 시험: 비상 대본의 관제 말을 차례로 (문장마다 나눠·받아쓰기 틀리게) 넣고 못 알아들음·한참 뒤 단계 잘못 인정을 센다 (열차 운행 없이 판정만)
// 사용: node simulator/tools/sim-voice-match.cjs [저장소 경로] [--split] [--noisy] [-v]
// 빠른 판정 시험: 대본 순서대로 관제 말을 (나눠) 말하며 controller와 같은 기억 규칙으로 match — 시간·열차 운행 없이 판정만
const root=process.argv[2]&&!process.argv[2].startsWith('-')?require('path').resolve(process.argv[2]):require('path').join(__dirname,'../..');const V=require(root+'/simulator/engine/voice.js'),F=require(root+'/simulator/engine/fts.js');
const SPLIT=process.argv.includes('--split'),NOISY=process.argv.includes('--noisy'),WRONG=process.argv.includes('--wrong');
function noisy(t){let i=0;return [...t].map(ch=>{const c=ch.charCodeAt(0)-0xAC00;if(c<0||c>11171||(++i)%7)return ch;const a=Math.floor(c/588),m=Math.floor(c%588/28),f=c%28;return String.fromCharCode(0xAC00+a*588+(m===1?5:m===5?1:m)*28+(f&&i%2?0:f));}).join('');}
const split=t=>String(t).split(/(?<=[.!?])\s+|\s*\/\s*/).map(x=>x.trim()).filter(x=>x.replace(/[^가-힣A-Z0-9]/g,'').length>=4);
let miss=0,wrong=0,total=0;const rows=[];
for(const p of F.seed().problems.filter(p=>/^P-em-/.test(p.id))){
 const P=V.plan(F.view(p,{status:'진행'})),done={},mem={};let ctx=null,t=0;
 const next=n=>{const o=[];for(const c of P.comms)for(const id of c.steps){const s=P.steps.find(x=>x.id===id);if(s.required&&done[id]==null){o.push(s);if(o.length>=n)return o;}}return o;};
 const hear=text=>{t+=4;const near=next(4);for(const id of Object.keys(mem))if(done[id]!=null||!near.some(s=>s.id===id))delete mem[id];
  const open=P.comms.find(c=>c.steps.some(id=>{const s=P.steps.find(x=>x.id===id);return s.required&&done[id]==null;}));
  const said=V.trainsIn(text,P.known),c=ctx&&t-ctx.at<=20?ctx.trains:[];
  const r=V.match(P,done,text,{current:open?.id,near:near.map(s=>s.id),memory:mem,context:c});if(said.length)ctx={trains:said,at:t};
  if(!r.length&&r.partial)(mem[r.partial.id]??=[]).push(text);for(const h of r){done[h.step.id]=t;delete mem[h.step.id];}return r;};
 for(const s of P.steps){if(!s.required||done[s.id]!=null)continue;total++;
  const parts=SPLIT&&split(s.text).length>1?split(s.text):[s.text];const got=[];
  for(const part of parts)for(const h of hear(NOISY?noisy(part):part))got.push(h.step.id);
  const extra=got.filter(id=>id!==s.id&&P.steps.find(x=>x.id===id).text!==s.text&&P.steps.findIndex(x=>x.id===id)>P.steps.findIndex(x=>x.id===s.id)+3);      // 한참 뒤 단계를 잘못 인정
  if(done[s.id]==null){miss++;rows.push(`${p.id} ${s.id} 못 알아들음 「${s.text.slice(0,50)}」 → ${got.join(',')||'없음'}`);}
  if(extra.length){wrong+=extra.length;rows.push(`${p.id} ${s.id} 잘못 인정 ${extra.join(',')}`);}
 }
}
console.log(`단계 ${total} · 못 알아들음 ${miss} · 한참 뒤 단계 잘못 인정 ${wrong}`);if(process.argv.includes('-v'))console.log(rows.join('\n'));
