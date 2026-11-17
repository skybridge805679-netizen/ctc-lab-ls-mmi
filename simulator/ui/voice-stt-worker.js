// 음성 1인 모드 받아쓰기 작업 스레드: Whisper(onnx-community/whisper-small, 양자화)를 이 앱 안에서 돌린다.
// 처음 한 번 모델을 내려받아 캐시에 둔 뒤로는 인터넷 없이 동작한다. 그래픽카드 가속(WebGPU)이 되면 그쪽을, 아니면 CPU(WASM, 여러 코어)를 쓴다.
import {pipeline,env} from '../vendor/transformers/transformers.min.js';
env.allowLocalModels=false;env.useBrowserCache=true;
env.backends.onnx.wasm.wasmPaths=new URL('../vendor/transformers/',import.meta.url).href;
env.backends.onnx.wasm.numThreads=typeof SharedArrayBuffer==='function'?Math.max(1,Math.min(8,(navigator.hardwareConcurrency||4)-1)):1;
const MODEL='onnx-community/whisper-small';
let asr=null,loading=null;
const progress={};
function load(){
 if(loading)return loading;
 const opts=device=>({device,dtype:{encoder_model:'q8',decoder_model_merged:'q8'},progress_callback:p=>{if(p.status==='progress'&&p.file){progress[p.file]=[p.loaded||0,p.total||0];const t=Object.values(progress).reduce((a,[l,s])=>[a[0]+l,a[1]+s],[0,0]);self.postMessage({type:'progress',loaded:t[0],total:t[1]});}}});
 loading=(async()=>{
  // 그래픽카드가 실제로 잡힐 때만 WebGPU를 쓴다 (실패한 WebGPU 시도가 CPU 경로까지 막지 않게)
  let gpu=null;try{gpu=await navigator.gpu?.requestAdapter();}catch{}
  if(gpu){try{asr=await pipeline('automatic-speech-recognition',MODEL,opts('webgpu'));return 'webgpu';}catch{asr=null;}}
  asr=await pipeline('automatic-speech-recognition',MODEL,opts('wasm'));return 'cpu';
 })().then(device=>{self.postMessage({type:'ready',device,threads:env.backends.onnx.wasm.numThreads});return device;},e=>{loading=null;self.postMessage({type:'error',message:String(e?.message||e)});throw e;});
 return loading;
}
self.onmessage=async e=>{
 const m=e.data;
 if(m.type==='load'){load().catch(()=>{});return;}
 if(m.type==='transcribe'){
  try{await load();const t0=performance.now();const r=await asr(m.audio,{language:'korean',task:'transcribe'});
   self.postMessage({type:'text',id:m.id,text:String(r?.text||'').trim(),ms:Math.round(performance.now()-t0)});}
  catch(err){self.postMessage({type:'error',id:m.id,message:String(err?.message||err)});}
 }
};
