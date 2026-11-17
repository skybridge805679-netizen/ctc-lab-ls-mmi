'use strict';
// 구술 연습 받아쓰기 측정: 모범 답안을 쉬지 않고 읽은 소리(Supertonic TTS)를 앱과 같은 말 자르기·Whisper·항목 판정에 넣어
// 방식별로 「말한 항목이 체크된 비율(인정률)」과 「다른 문항 답으로 체크된 비율(잘못 인정률)」을 잰다.
// 기계 목소리라 사람보다 점수가 좋게 나온다 — 방식끼리 비교하는 용도.
// 준비: npm i --no-save @huggingface/transformers@4.3.2   사용: node tools/bench-oral-asr.cjs [--n 24] [--speed 1.0,1.25] [--noise 0.004] [--only A,C]
const fs=require('fs'),path=require('path');
const R=require('../simulator/engine/oral-relay.js'),G=require('../simulator/engine/voice-segment.js');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d;};
const IDS=arg('ids','')?arg('ids').split(','):null,N=+arg('n',10),SPEEDS=arg('speed','1.1').split(',').map(Number),NOISE=+arg('noise',0.004),CACHE=process.env.BENCH_CACHE||path.join(require('os').tmpdir(),'orpheia-oral-bench');
// 방식: legacy = 지금까지(0.9초/25초 자르기, 항목 문장 힌트 180토큰, 160토큰), 나머지는 단계별로 하나씩 더한다
const SEG={end:0.9,soft:6,gap:0.2,hard:12};
const STRATS={
 A:{name:'이전 (25초 자르기·문장 힌트·160토큰)',seg:{end:0.9,hard:25,legacyHard:true},hint:'keys',ctx:180,tokens:()=>160},
 B:{name:'숨 고르기 자르기·토큰 예산·문장 힌트',seg:SEG,hint:'keys',ctx:180,tokens:G.budget,tidy:true},
 C:{name:'B + 직전 글 문맥',seg:SEG,hint:'keys',prev:true,ctx:180,tokens:G.budget,tidy:true},
 D:{name:'C, 힌트를 단어로',seg:SEG,hint:'words',prev:true,ctx:180,tokens:G.budget,tidy:true},
 R:{name:'D + 일찍 끝낸 받아쓰기 다시',seg:SEG,hint:'words',prev:true,ctx:180,tokens:G.budget,tidy:true,retry:true},
 W:{name:'R, 자르기 10~20초',seg:{end:0.9,soft:10,gap:0.25,hard:20},hint:'words',prev:true,ctx:180,tokens:G.budget,tidy:true,retry:true},
 H:{name:'C, 힌트 없음',seg:SEG,hint:'none',prev:true,ctx:180,tokens:G.budget,tidy:true},
};
const ONLY=arg('only','')?arg('only').split(','):['A','R','W'];
function seeded(seed){return()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};}
function pickItems(){if(IDS)return R.all().filter(x=>IDS.includes(x.id));const rnd=seeded(7),all=R.all().filter(x=>x.key.length>=3&&x.key.length<=8);const out=[];const pool=[...all];
 while(out.length<N&&pool.length)out.push(pool.splice(Math.floor(rnd()*pool.length),1)[0]);return out;}
const lineText=l=>String(l).replace(/^\s*(\d+[.)]|[①-⑳]|[가-하][.)])\s*/,'').replace(/[()「」『』\[\]]/g,' ').replace(/\s+/g,' ').trim();
function resample(x,from,to){const r=from/to,out=new Float32Array(Math.floor(x.length/r));for(let i=0;i<out.length;i++){const p=i*r,j=Math.floor(p),f=p-j;out[i]=(x[j]||0)*(1-f)+(x[j+1]||0)*f;}return out;}
function trim(x,thr=0.01){let a=0,b=x.length;while(a<b&&Math.abs(x[a])<thr)a++;while(b>a&&Math.abs(x[b-1])<thr)b--;return x.subarray(Math.max(0,a-400),Math.min(x.length,b+400));}
(async()=>{
 const mod=await import(require('url').pathToFileURL(require.resolve('@huggingface/transformers',{paths:[process.cwd(),...(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)]})).href);
 const {pipeline,env}=mod;if(process.env.HF_CACHE)env.cacheDir=process.env.HF_CACHE;
 fs.mkdirSync(CACHE,{recursive:true});const items=pickItems();let tts=null;
 // 1) 소리: 답안 줄마다 읽고 앞뒤 무음을 잘라 0.08초 간격으로 붙인다 (쉬지 않고 말하기)
 async function audioOf(item,speed,lines){
  const f=path.join(CACHE,`${item.id}-${speed}-${require('crypto').createHash('md5').update(lines.join('|')).digest('hex').slice(0,8)}.f32`);if(fs.existsSync(f))return new Float32Array(fs.readFileSync(f).buffer.slice(0));
  tts??=await pipeline('text-to-speech','onnx-community/Supertonic-TTS-2-ONNX');const parts=[];
  for(const t of lines){if(!t)continue;const o=await tts('<ko>'+t+'</ko>',{speaker_embeddings:'https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX/resolve/main/voices/M1.bin',num_inference_steps:8,speed});
   parts.push(trim(resample(o.audio,o.sampling_rate,16000)),new Float32Array(1280));}
  const n=parts.reduce((a,p)=>a+p.length,0),out=new Float32Array(n+16000);let o=8000;for(const p of parts){out.set(p,o);o+=p.length;}
  fs.writeFileSync(f,Buffer.from(out.buffer));return out;
 }
 // 2) Whisper: 앱의 작업 스레드(ui/voice-stt-worker.js)와 같은 방식 (앞 문맥 + 한국어 받아쓰기)
 const asr=await pipeline('automatic-speech-recognition','onnx-community/whisper-small',{dtype:{encoder_model:'q8',decoder_model_merged:'q8'}});
 const tok=asr.tokenizer,id=t=>tok.convert_tokens_to_ids([t])[0],sp={sop:id('<|startofprev|>'),sot:id('<|startoftranscript|>'),ko:id('<|ko|>'),tr:id('<|transcribe|>'),nt:id('<|notimestamps|>')};
 async function transcribe(audio,prompt,st){const dur=audio.length/16000,want=st.tokens(dur);
  const room=Math.max(0,Math.min(st.ctx,448-want-6)),ctx=prompt&&room?tok.encode(' '+prompt,{add_special_tokens:false}).slice(-room):[];
  const pre=[...(ctx.length?[sp.sop,...ctx]:[]),sp.sot,sp.ko,sp.tr,sp.nt];
  const f=await asr.processor(audio),out=await asr.model.generate({...f,decoder_input_ids:[pre],max_new_tokens:Math.min(want,447-pre.length)});
  const seq=out[0].tolist?out[0].tolist():Array.from(out[0].data??out[0]);return tok.decode(seq.slice(pre.length).map(Number),{skip_special_tokens:true}).trim();}
 function segments(audio,st){const segs=[];
  if(st.seg.legacyHard){for(let i=0;i<audio.length;i+=25*16000)segs.push(audio.subarray(i,Math.min(audio.length,i+25*16000)));return segs;}      // 쉬지 않으면 25초마다 그냥 잘렸다
  const v=G.create({...st.seg,onSegment:a=>segs.push(a)});for(let i=0;i<audio.length;i+=2048)v.feed(audio.subarray(i,i+2048));v.flush();return segs;}
 const rows=[];
 // 읽기: 모범 답안 전부 · 앞 절반만 (절반만 말했는데 나머지 항목이 체크되면 잘못 인정 — 힌트를 베껴 쓰는지 본다)
 const readings=item=>{const all=item.a.map(lineText).filter(Boolean);let half=all.slice(0,Math.ceil(all.length/2));
  if(all.length===1){const w=all[0].split(' ');half=[w.slice(0,Math.ceil(w.length/2)).join(' ')];}return [['전부',all],['절반',half]];};
 for(const speed of SPEEDS)for(const item of items)for(const [rd,lines] of readings(item)){
  let audio=await audioOf(item,speed,lines);const truth=R.check(item,lines.join(' '));if(NOISE){const rnd=seeded(item.id.length*31+speed*100);audio=audio.map(x=>x+(rnd()*2-1)*NOISE);}
  for(const k of ONLY){const st=STRATS[k];let said='',rate=0,retries=0;const texts=[];const t0=Date.now();const segs=segments(audio,st);
   for(const s of segs){const prompt=st.hint==='none'?(st.prev?said.slice(-60):''):st.hint==='keys'?R.hint(item,'','keys')+(st.prev?' '+said.slice(-60):''):R.hint(item,st.prev?said:'');
    const dur=s.length/16000;let t=await transcribe(s,prompt,st);
    if(st.retry&&G.short(t,dur,rate)){const again=await transcribe(s,'',st);if(G.chars(again)>G.chars(t)&&G.chars(again)<=dur*11){t=again;retries++;}}
    if(st.tidy)t=G.tidy(t,dur);rate=G.speed(rate,t,dur);texts.push(t);said+=' '+t;}
   const det=R.check(item,said),got=det.filter(i=>truth.includes(i)).length,over=det.filter(i=>!truth.includes(i)).length,notTruth=item.key.length-truth.length,others=items.filter(x=>x!==item).slice(0,6),fp=others.reduce((a,o)=>a+R.check(o,said).length,0)/others.reduce((a,o)=>a+o.key.length,0);
   rows.push({k,speed,rd,retries,id:item.id,truth:truth.length,over,notTruth,dur:+(audio.length/16000).toFixed(1),segs:segs.length,recall:truth.length?got/truth.length:1,fp,ms:Date.now()-t0,text:said.trim()});
   console.error(`${k} ${rd} ${item.id} ${(audio.length/16000).toFixed(0)}s ${segs.length}마디 ${got}/${truth.length}(+${over}) fp=${fp.toFixed(2)} ${((Date.now()-t0)/1000).toFixed(1)}s`);}
 }
 fs.writeFileSync(path.join(CACHE,'result.json'),JSON.stringify(rows,null,1));
 console.log('\n| 방식 | 인정률 (말한 항목) | 전부 체크 | 잘못 인정: 안 말한 항목 | 잘못 인정: 다른 문항 | 마디 수 | 받아쓰기 시간 |\n|---|---|---|---|---|---|---|');
 for(const k of ONLY){const r=rows.filter(x=>x.k===k);if(!r.length)continue;const avg=f=>r.reduce((a,x)=>a+f(x),0)/r.length,full=r.filter(x=>x.rd==='전부');
  const ov=r.reduce((a,x)=>a+x.over,0),nt=r.reduce((a,x)=>a+x.notTruth,0);
  console.log(`| ${k} ${STRATS[k].name} | ${(avg(x=>x.recall)*100).toFixed(1)}% | ${full.filter(x=>x.recall===1).length}/${full.length} | ${ov}/${nt} | ${(avg(x=>x.fp)*100).toFixed(1)}% | ${avg(x=>x.segs).toFixed(1)} | ${(avg(x=>x.ms)/1000).toFixed(1)}초 |`);}
 console.log('\n자세한 결과:',path.join(CACHE,'result.json'));
})().catch(e=>{console.error(e);process.exit(1);});
