'use strict';
// 음성 1인 모드의 음성인식·TTS 라이브러리를 npm에서 받아 simulator/vendor/transformers/에 둔다 (npm install 때 자동 실행).
// 저장소에는 넣지 않는다: 압축된 외부 라이브러리라 GitHub 비밀키 검사가 긴 이름을 키로 오인하고, 크기도 크다(27MB).
// 버전과 SHA-256을 고정해 받은 파일이 다르면 멈춘다. 이미 맞는 파일이 있으면 아무것도 하지 않는다.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),os=require('os'),{execFileSync}=require('child_process');
const OUT=path.join(__dirname,'../simulator/vendor/transformers');
const FILES=[
 {pkg:'@huggingface/transformers@4.3.2',from:'package/dist/transformers.min.js',to:'transformers.min.js',sha:'8b5a3171f8876bab2b1820a7d65eb87628e3d30bb5ea85b9dd398e76eb34decb'},
 {pkg:'onnxruntime-web@1.31.0-dev.20260914-8d85527a0',from:'package/dist/ort-wasm-simd-threaded.asyncify.mjs',to:'ort-wasm-simd-threaded.asyncify.mjs',sha:'0966b6105cd936744498aa60df7a22cbd47af3374dbc64a9ab561c08a71e3611'},
 {pkg:'onnxruntime-web@1.31.0-dev.20260914-8d85527a0',from:'package/dist/ort-wasm-simd-threaded.asyncify.wasm',to:'ort-wasm-simd-threaded.asyncify.wasm',sha:'49871f5a4409519797e127440868a6d1923339d9185907f301a5b2a1d90af082'},
];
const sha=b=>require('crypto').createHash('sha256').update(b).digest('hex');
const ok=f=>{try{return sha(fs.readFileSync(path.join(OUT,f.to)))===f.sha;}catch{return false;}};
// tar.gz에서 파일 하나 꺼내기 (외부 tar 없이 — Windows 빌드에서도)
function extract(tgz,name){const tar=zlib.gunzipSync(fs.readFileSync(tgz));for(let o=0;o+512<=tar.length;){const h=tar.subarray(o,o+512);if(!h[0])break;
 const n=h.toString('utf8',0,100).replace(/\0.*$/s,''),pre=h.toString('utf8',345,500).replace(/\0.*$/s,''),size=parseInt(h.toString('utf8',124,136).replace(/\0.*$/s,'').trim()||'0',8),full=pre?pre+'/'+n:n;
 if(full===name)return tar.subarray(o+512,o+512+size);o+=512+Math.ceil(size/512)*512;}throw Error(name+' 없음');}
function main(){
 const need=FILES.filter(f=>!ok(f));if(!need.length)return;
 fs.mkdirSync(OUT,{recursive:true});const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'orpheia-voice-'));
 try{
  for(const pkg of [...new Set(need.map(f=>f.pkg))]){
   const name=execFileSync(process.platform==='win32'?'npm.cmd':'npm',['pack','--silent','--pack-destination',tmp,pkg],{encoding:'utf8',shell:process.platform==='win32'}).trim().split(/\r?\n/).pop();
   for(const f of need.filter(x=>x.pkg===pkg)){const b=extract(path.join(tmp,name),f.from);if(sha(b)!==f.sha)throw Error(f.to+' 해시가 다릅니다 (받은 패키지 확인 필요)');fs.writeFileSync(path.join(OUT,f.to),b);console.log('음성 라이브러리 준비 · '+f.to);}
  }
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
try{main();}catch(e){console.error('음성 라이브러리를 준비하지 못했습니다 (음성 1인 모드만 쓸 수 없음): '+e.message);if(process.env.CI)process.exit(1);}
