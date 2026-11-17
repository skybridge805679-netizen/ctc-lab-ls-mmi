// 음성 1인 모드 받아쓰기 작업 스레드: Whisper(onnx-community/whisper-small, 양자화)를 이 앱 안에서 돌린다.
// 처음 한 번 모델을 내려받아 캐시에 둔 뒤로는 인터넷 없이 동작한다. 그래픽카드 가속(WebGPU)이 되면 그쪽을, 아니면 CPU(WASM, 여러 코어)를 쓴다.
import {pipeline,env} from '../vendor/transformers/transformers.min.js';
env.allowLocalModels=false;env.useBrowserCache=true;
env.backends.onnx.wasm.wasmPaths=new URL('../vendor/transformers/',import.meta.url).href;
env.backends.onnx.wasm.numThreads=typeof SharedArrayBuffer==='function'?Math.max(1,Math.min(8,(navigator.hardwareConcurrency||4)-1)):1;
// 그래픽카드(WebGPU, f16)가 되면 whisper-large-v3-turbo(약 560MB, 한국어가 훨씬 정확), 아니면 whisper-small(약 250MB, CPU)
const SMALL='onnx-community/whisper-small',TURBO='onnx-community/whisper-large-v3-turbo';
let asr=null,loading=null,name='';
const progress={};
function load(){
 if(loading)return loading;
 const opts=device=>({device,dtype:{encoder_model:'q8',decoder_model_merged:'q8'},progress_callback:p=>{if(p.status==='progress'&&p.file){progress[p.file]=[p.loaded||0,p.total||0];const t=Object.values(progress).reduce((a,[l,s])=>[a[0]+l,a[1]+s],[0,0]);self.postMessage({type:'progress',loaded:t[0],total:t[1]});}}});
 loading=(async()=>{
  let gpu=null;try{gpu=await navigator.gpu?.requestAdapter();}catch{}
  if(gpu&&gpu.features?.has?.('shader-f16')){try{asr=await pipeline('automatic-speech-recognition',TURBO,{...opts('webgpu'),dtype:{encoder_model:'q4f16',decoder_model_merged:'q4f16'}});name='large-v3-turbo';return 'webgpu';}catch{asr=null;}}
  if(gpu){try{asr=await pipeline('automatic-speech-recognition',SMALL,opts('webgpu'));name='small';return 'webgpu';}catch{asr=null;}}
  asr=await pipeline('automatic-speech-recognition',SMALL,opts('wasm'));name='small';return 'cpu';
 })().then(device=>{self.postMessage({type:'ready',device,model:name,threads:env.backends.onnx.wasm.numThreads});return device;},e=>{loading=null;self.postMessage({type:'error',message:String(e?.message||e)});throw e;});
 return loading;
}
// 문맥 힌트: 지금 해야 할 대본 문장·열번·역 이름을 앞 문맥(<|startofprev|>)으로 넣고 받아쓴다 → 「K1210차 금청구청역」 대신 「K1210열차 금천구청역」
let special=null;
async function transcribe(audio,prompt){
 const tok=asr.tokenizer,id=t=>tok.convert_tokens_to_ids([t])[0];
 special??={sop:id('<|startofprev|>'),sot:id('<|startoftranscript|>'),ko:id('<|ko|>'),tr:id('<|transcribe|>'),nt:id('<|notimestamps|>')};
 const ctx=prompt?tok.encode(' '+String(prompt),{add_special_tokens:false}).slice(-180):[];
 const pre=[...(ctx.length?[special.sop,...ctx]:[]),special.sot,special.ko,special.tr,special.nt];
 const f=await asr.processor(audio),out=await asr.model.generate({...f,decoder_input_ids:[pre],max_new_tokens:160});
 const seq=out[0].tolist?out[0].tolist():Array.from(out[0].data??out[0]);
 return tok.decode(seq.slice(pre.length).map(Number),{skip_special_tokens:true}).trim();
}
self.onmessage=async e=>{
 const m=e.data;
 if(m.type==='load'){load().catch(()=>{});return;}
 if(m.type==='transcribe'){
  try{await load();const t0=performance.now();
   self.postMessage({type:'text',id:m.id,text:await transcribe(m.audio,m.prompt),ms:Math.round(performance.now()-t0)});}
  catch(err){self.postMessage({type:'error',id:m.id,message:String(err?.message||err)});}
 }
};
