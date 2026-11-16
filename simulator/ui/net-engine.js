(function(root){
'use strict';
// 원격 PC 브라우저 접속(데스크톱 앱의 원격 조작 서버 · ?remote=1): 엔진은 교수 PC의 앱 안에 있고, 이 페이지는 같은
// request(action, since, version) 형식으로 네트워크 너머의 엔진에 붙는다. 화면 코드는 그대로(page-engine.js는 건너뛴다).
if(root.OrpheiaEngine||!/[?&]remote=1\b/.test(root.location.search))return;
function request(action,since=0,version=-1){
 const x=new XMLHttpRequest();x.open('POST','/api/request',false);x.setRequestHeader('Content-Type','application/json');
 try{x.send(JSON.stringify({action,since,version}));}catch{return {error:'교수 PC의 원격 조작 서버에 연결할 수 없습니다.'};}
 if(x.status===401){root.location.href='/';return {error:'접속이 끊겼습니다.'};}
 try{return JSON.parse(x.responseText);}catch{return {error:'원격 응답을 읽을 수 없습니다.'};}
}
function openView(kind){
 if(kind==='mmi')root.SimWorkspace?.detach?.();
 else if(kind==='graph')root.SimWorkspace?.openGraph?.();
 else if(kind==='fts')root.SimFTSUI?.open?.();
}
root.OrpheiaRemoteClient=true;
root.OrpheiaEngine={request,openView,reset:async()=>{alert('프로그램 전체 초기화는 교수 PC의 앱에서만 할 수 있습니다.');return {ok:false};}};
})(window);
