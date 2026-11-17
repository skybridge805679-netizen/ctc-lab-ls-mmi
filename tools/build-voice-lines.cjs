'use strict';
// 음성 1인 모드의 상대 대사(기관사·역·관제팀장·안내)를 미리 음성 파일로 만든다 → simulator/assets/voice/<목소리-해시>.ogg + index.json
// 대사는 대본에 정해져 있으므로 미리 만들어 두면 바로 재생된다 (그 자리에서 TTS를 만들면 한 줄마다 기다린다).
// 대본·대사가 바뀌면 다시 돌린다. 이미 있는 파일은 건너뛴다(--force: 모두 다시). 없는 대사는 앱이 그 자리에서 만들어 읽는다.
// 준비: npm i --no-save @huggingface/transformers@4.3.2 · ffmpeg(libopus)   사용: node tools/build-voice-lines.cjs [--force]
const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const V=require('../simulator/engine/voice.js'),F=require('../simulator/engine/fts.js');
const OUT=path.join(__dirname,'../simulator/assets/voice'),MODEL='onnx-community/Supertonic-TTS-2-ONNX';
(async()=>{
 const force=process.argv.includes('--force'),{pipeline,env}=await import(require('url').pathToFileURL(require.resolve('@huggingface/transformers',{paths:[process.cwd(),...(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean)]})).href);
 if(process.env.HF_CACHE)env.cacheDir=process.env.HF_CACHE;
 const lines=new Map();for(const p of F.seed().problems.filter(p=>/^P-(em|ev)/.test(p.id)))for(const l of V.linesOf(p))lines.set(V.lineKey(l),l);
 fs.mkdirSync(OUT,{recursive:true});const idxFile=path.join(OUT,'index.json'),index=force?{}:(()=>{try{return JSON.parse(fs.readFileSync(idxFile,'utf8'));}catch{return {};}})();
 const tts=await pipeline('text-to-speech',MODEL),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'orpheia-voice-'));let made=0;
 for(const [key,l] of lines){
  const file=path.join(OUT,key+'.ogg');if(!force&&index[key]&&fs.existsSync(file))continue;
  const out=await tts('<ko>'+V.readable(l.text)+'</ko>',{speaker_embeddings:`https://huggingface.co/${MODEL}/resolve/main/voices/${V.voiceOf(l)}.bin`,num_inference_steps:8,speed:l.who==='driver'?1.12:1.05});
  const wav=path.join(tmp,key+'.wav');await out.save(wav);
  execFileSync('ffmpeg',['-loglevel','error','-y','-i',wav,'-ac','1','-ar','24000','-c:a','libopus','-b:a','24k','-application','voip',file]);
  index[key]={s:+(out.audio.length/out.sampling_rate).toFixed(2),t:l.text.slice(0,40)};made++;
  if(made%20===0)console.log(made,'/',lines.size);
 }
 for(const k of Object.keys(index))if(!lines.has(k)){delete index[k];fs.rmSync(path.join(OUT,k+'.ogg'),{force:true});}      // 대본에서 사라진 대사
 fs.writeFileSync(idxFile,JSON.stringify(index,null,0)+'\n');fs.rmSync(tmp,{recursive:true,force:true});
 console.log(`음성 대사 ${lines.size}줄 (새로 만든 것 ${made}) → simulator/assets/voice/`);
})().catch(e=>{console.error(e);process.exit(1);});
