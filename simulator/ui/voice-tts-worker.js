// 음성 1인 모드 상대 대사 읽기(TTS) 작업 스레드: Supertonic 2 (Supertone · OpenRAIL, 한국어 지원)를 이 앱 안에서 돌린다.
// 처음 한 번 모델(약 260MB)을 내려받아 캐시에 둔 뒤로는 인터넷 없이 동작한다. 준비 전이나 실패하면 화면이 기본 TTS로 대신 읽는다.
import {pipeline,env} from '../vendor/transformers/transformers.min.js';
env.allowLocalModels=false;env.useBrowserCache=true;
env.backends.onnx.wasm.wasmPaths=new URL('../vendor/transformers/',import.meta.url).href;
env.backends.onnx.wasm.numThreads=typeof SharedArrayBuffer==='function'?Math.max(1,Math.min(4,(navigator.hardwareConcurrency||4)>>1)):1;
const MODEL='onnx-community/Supertonic-TTS-2-ONNX',VOICES=`https://huggingface.co/${MODEL}/resolve/main/voices/`;
let tts=null,loading=null;const progress={};
function load(){
 if(loading)return loading;
 loading=pipeline('text-to-speech',MODEL,{device:'wasm',progress_callback:p=>{if(p.status==='progress'&&p.file){progress[p.file]=[p.loaded||0,p.total||0];const t=Object.values(progress).reduce((a,[l,s])=>[a[0]+l,a[1]+s],[0,0]);self.postMessage({type:'progress',loaded:t[0],total:t[1]});}}})
  .then(x=>{tts=x;self.postMessage({type:'ready'});},e=>{loading=null;self.postMessage({type:'error',message:String(e?.message||e)});});
 return loading;
}
self.onmessage=async e=>{
 const m=e.data;
 if(m.type==='load'){load();return;}
 if(m.type==='speak'){
  try{await load();if(!tts)throw Error('TTS 모델 없음');
   const out=await tts('<ko>'+m.text+'</ko>',{speaker_embeddings:VOICES+(m.voice||'M1')+'.bin',num_inference_steps:6,speed:m.speed||1.05});
   const audio=out.audio instanceof Float32Array?out.audio:new Float32Array(out.audio);
   self.postMessage({type:'audio',id:m.id,audio,rate:out.sampling_rate},[audio.buffer]);}
  catch(err){self.postMessage({type:'fail',id:m.id,message:String(err?.message||err)});}
 }
};
