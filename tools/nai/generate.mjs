// NovelAI 이미지 생성 (GitHub Actions에서 실행 — 토큰은 저장소 시크릿 NAI_TOKEN, 절대 출력하지 않는다)
// 사용: node tools/nai/generate.mjs <요청.json>... --out <폴더>
// 요청 JSON (nai/requests/*.json) — 적지 않은 값은 tools/nai/preset.json(주인님 기본 세팅)을 쓴다:
//   { "name": "orpheia-01", "prompt": "1girl, ...", "negative": "...", "width": 832, "height": 1216, "seed": 123, "n": 1,
//     "transparent": false,       // true면 투명 배경 PNG (V5)
//     "base": true,                 // false면 기본 프롬프트(작가·퀄리티 태그)를 앞에 붙이지 않는다
//     "characters": [{ "prompt": "girl, ...", "uc": "", "center": { "x": 0.3, "y": 0.5 } }],
//     "action": "generate" | "img2img" | "infill" | "balance",
//     "image": "nai/inputs/a.png", "strength": 0.7, "noise": 0,      // img2img · infill
//     "mask": "nai/inputs/a-mask.png", "addOriginal": true }            // infill: 흰색 = 다시 그릴 곳
// 결과: <out>/<name>/image_N.png + request.json(토큰 없음) + response 메타
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const HOST='https://image.novelai.net';
const QUALITY={standard:', very aesthetic, masterpiece, no text',light:', very aesthetic, amazing quality, no text',none:''};      // 웹 「퀄리티 태그」가 붙이는 말 (V5)
const UC_PRESET={heavy:0,light:1,furry:2,human:3,none:4};      // V5 번호
const args=process.argv.slice(2),outIdx=args.indexOf('--out'),out=outIdx>=0?args.splice(outIdx,2)[1]:'nai-out',files=args;
const token=process.env.NAI_TOKEN;if(!token){console.error('NAI_TOKEN이 없습니다 (저장소 시크릿).');process.exit(2);}
const preset=JSON.parse(fs.readFileSync(new URL('./preset.json',import.meta.url),'utf8'));
const auth={Authorization:'Bearer '+token};
const b64=f=>fs.readFileSync(f).toString('base64');
async function balance(){const r=await fetch(HOST+'/user/subscription',{headers:auth});if(!r.ok)return {error:r.status+' '+(await r.text()).slice(0,200)};const j=await r.json();
 const s=j.trainingStepsLeft||{};return {tier:j.tier,active:j.active,anlas:(s.fixedTrainingStepsLeft||0)+(s.purchasedTrainingSteps||0)};}
function body(q){
 const base=q.base===false?'':preset.prompt,prompt=(base+(q.prompt||'')).replace(/[,\s]+$/,'')+(q.transparent?', transparent background':'')+QUALITY[q.quality??preset.qualityPreset];      // 투명 배경(V5): 퀄리티 문구 앞에 태그 + straight_alpha
 const uc=(q.base===false?'':preset.uc)+(q.negative||'');
 const chars=q.characters||[],coords=chars.some(c=>c.center&&(c.center.x||c.center.y));
 const action=q.action||'generate',seed=q.seed??Math.floor(Math.random()*4294967288)+1;
 const p={params_version:4,width:q.width||preset.width,height:q.height||preset.height,scale:q.scale??preset.scale,sampler:q.sampler||preset.sampler,steps:q.steps||preset.steps,seed,n_samples:q.n||1,
  ucPreset:UC_PRESET[q.ucPreset||preset.ucPreset]??4,qualityToggle:(q.quality??preset.qualityPreset)!=='none',sm:false,sm_dyn:false,dynamic_thresholding:false,controlnet_strength:1,legacy:false,
  add_original_image:false,cfg_rescale:q.cfg_rescale??preset.cfg_rescale,noise_schedule:q.noise_schedule||preset.noise_schedule,legacy_v3_extend:false,uncond_scale:1,
  negative_prompt:uc,prompt,reference_image_multiple:[],reference_information_extracted_multiple:[],reference_strength_multiple:[],extra_noise_seed:seed,...(q.transparent?{straight_alpha:true}:{}),
  v4_prompt:{use_coords:coords,use_order:true,caption:{base_caption:prompt,char_captions:chars.map(c=>({char_caption:c.prompt,centers:[c.center||{x:0,y:0}]}))}},
  v4_negative_prompt:{use_coords:coords,use_order:true,caption:{base_caption:uc,char_captions:chars.map(c=>({char_caption:c.uc||'',centers:[c.center||{x:0,y:0}]}))},legacy_uc:false}};
 let model=q.model||preset.model;
 if(action==='img2img'||action==='infill'){p.image=b64(q.image);p.strength=q.strength??0.7;p.noise=q.noise??0;p.color_correct=true;}
 if(action==='infill'){p.mask=b64(q.mask);p.add_original_image=q.addOriginal??true;p.inpaintImg2ImgStrength=q.inpaintStrength??1;if(!model.endsWith('-inpainting'))model+='-inpainting';}
 return {input:prompt,model,action,parameters:p};
}
fs.mkdirSync(out,{recursive:true});
const before=await balance();console.log('구독:',JSON.stringify(before));
let failed=0;
for(const f of files){
 const q=JSON.parse(fs.readFileSync(f,'utf8')),name=(q.name||path.basename(f,'.json')).replace(/[^\w.-]/g,'_'),dir=path.join(out,name);
 if(fs.existsSync(path.join(dir,'done.json'))){console.log('건너뜀(이미 있음):',name);continue;}
 fs.mkdirSync(dir,{recursive:true});
 if(q.action==='balance'){fs.writeFileSync(path.join(dir,'done.json'),JSON.stringify({balance:before,at:new Date().toISOString()},null,1));console.log('잔액 확인:',name);continue;}
 const req=body(q);const shown={...req,parameters:{...req.parameters,image:req.parameters.image?'(base64)':undefined,mask:req.parameters.mask?'(base64)':undefined}};
 fs.writeFileSync(path.join(dir,'request.json'),JSON.stringify({source:f,...shown},null,1));
 const t0=Date.now(),r=await fetch(HOST+'/ai/generate-image',{method:'POST',headers:{...auth,'Content-Type':'application/json',Accept:'application/zip'},body:JSON.stringify(req)});
 if(!r.ok){const msg=r.status+' '+(await r.text()).slice(0,500);console.error('실패',name,msg);fs.writeFileSync(path.join(dir,'error.json'),JSON.stringify({status:r.status,message:msg,at:new Date().toISOString()},null,1));failed++;continue;}
 const zip=path.join(dir,'result.zip');fs.writeFileSync(zip,Buffer.from(await r.arrayBuffer()));execFileSync('unzip',['-o','-q',zip,'-d',dir]);fs.rmSync(zip);
 const images=fs.readdirSync(dir).filter(x=>x.endsWith('.png'));
 fs.writeFileSync(path.join(dir,'done.json'),JSON.stringify({images,seed:req.parameters.seed,ms:Date.now()-t0,at:new Date().toISOString()},null,1));
 console.log('완료',name,images.join(','),((Date.now()-t0)/1000).toFixed(1)+'초');
 await new Promise(res=>setTimeout(res,6000));      // 동시 생성 잠금(429) 피하기 — 한 장씩, 6초 간격
}
const after=await balance();console.log('구독(후):',JSON.stringify(after));
if(failed)process.exit(1);
