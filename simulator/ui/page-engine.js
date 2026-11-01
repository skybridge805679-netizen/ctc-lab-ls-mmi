(function(root){
'use strict';
// 엔진 연결부 (데스크톱 앱이 아닐 때). 데스크톱 앱에서는 preload가 OrpheiaEngine을 주고, 엔진(engine/runtime.cjs)은
// 별도 프로세스에서 돈다. 브라우저에서 index.html을 열면(자동 시험 포함) 같은 runtime.cjs를 이 페이지 안에서 돌리고
// 똑같은 request(action, since, version) 형식으로 연결한다. 화면 코드는 엔진 경로 하나만 가진다 — 브라우저 전용 계산은 없다.
if(root.OrpheiaEngine)return;
const cache=new Map();
function fetchText(url){const x=new XMLHttpRequest();x.open('GET',url,false);x.send();return x.status===200||(x.status===0&&x.responseText)?x.responseText:null;}
function resolve(id,dir){
 const base=new URL(id,dir).href;
 for(const url of /\.(c?js|json)$/.test(base)?[base]:[base+'.js',base+'.cjs',base+'/index.js']){if(cache.has(url))return {url};const text=fetchText(url);if(text!==null)return {url,text};}
 throw new Error('엔진 모듈을 찾을 수 없습니다: '+id);
}
const shim={pid:0,env:{},platform:'browser'};
function load(id,dir){
 const {url,text}=resolve(id,dir);if(cache.has(url))return cache.get(url).exports;
 const module={exports:{}};cache.set(url,module);
 if(url.endsWith('.json')){module.exports=JSON.parse(text);return module.exports;}
 const here=url.slice(0,url.lastIndexOf('/')+1);
 new Function('module','exports','require','process',text+'\n//# sourceURL='+url)(module,module.exports,next=>{if(/^node:/.test(next))throw new Error('브라우저 엔진에서 쓸 수 없는 모듈: '+next);return load(next,here);},shim);
 return module.exports;
}
let runtime=load('./engine/runtime.cjs',document.baseURI).create();
if(sessionStorage.getItem('orpheia.fresh-start')){sessionStorage.removeItem('orpheia.fresh-start');runtime.command({type:'clock',paused:true});}
function request(action,since=0,version=-1){
 try{
  let result;
  if(action?.type==='session:persist'){runtime.command({type:'clock',paused:true});result={ok:true};}
  else if(['session:save','session:open'].includes(action?.type))result={ok:false,message:'세션 파일은 데스크톱 앱에서 저장·열기합니다.'};
  else result=runtime.command(action);
  return {result,snapshot:runtime.transport(version??-1,since||0)};
 }catch(error){return {error:error.message};}
}
// 창 열기: 데스크톱은 메인 프로세스가 창을 만든다. 여기서는 이 페이지의 창 관리(SimWorkspace)가 연다.
function openView(kind){
 if(kind==='mmi')root.SimWorkspace?.detach?.();
 else if(kind==='graph')root.SimWorkspace?.openGraph?.();
 else if(kind==='fts')root.SimFTSUI?.open?.();
}
root.setInterval(()=>{try{runtime.pulse();}catch(error){console.error(error);}},1000);
root.OrpheiaEngine={reset:async()=>{runtime.command({type:'clock',paused:true});runtime=load('./engine/runtime.cjs',document.baseURI).create();runtime.command({type:'clock',paused:true});localStorage.clear();sessionStorage.clear();sessionStorage.setItem('orpheia.fresh-start','1');root.location.reload();return {ok:true};},request,openView,native:false};
})(window);
