'use strict';
// 같은 네트워크의 PC·스마트폰 브라우저로 접속하는 원격 조작 서버 (기본 꺼짐 · 교수가 FTS 화면에서 켠다).
//  - PIN(4자리) 로그인 → HttpOnly 쿠키 토큰. 잘못된 PIN이 이어지면 잠시 잠근다.
//  - 모바일(스마트폰·태블릿): 리모컨 화면만. 서버도 리모컨 명령(교육 진행 · 통보·구술 확인 · 상황 변경 · 문제 종료·재로딩·교육 종료)만 받는다.
//  - PC 브라우저: 앱과 같은 화면(LS·MMI·FTS·그래프·문제 화면). 엔진 연결만 네트워크로 바뀐다(ui/net-engine.js). 세션 파일·전체 초기화는 막는다.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
const MOBILE=/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i;
const REMOTE_OPS=new Set(['start','manual','next','reload','stop']);
// 모바일 리모컨이 보낼 수 있는 명령: 리모컨 요약 조회와 FTS 진행 명령(교육 시작 포함)뿐 (진로·신호·열번·시간표·문제 편집 등은 받지 않는다)
function remoteAllowed(action){if(action?.type==='remote:view')return true;if(action?.type!=='fts'||!REMOTE_OPS.has(action.op))return false;
 if(action.op==='manual')return typeof action.key==='string';if(action.op==='start')return ['scenario','professor','student'].every(k=>typeof action[k]==='string');return true;}
// 리모컨 명령은 허용한 필드만 엔진에 넘긴다 (교육 시작에 문제 라이브러리 등을 끼워 보내지 못하게)
function remoteAction(a){if(a.type==='remote:view')return {type:'remote:view'};if(a.op==='manual')return {type:'fts',op:'manual',key:a.key};if(a.op==='start')return {type:'fts',op:'start',scenario:a.scenario,professor:a.professor,student:a.student};return {type:'fts',op:a.op};}
// PC 브라우저: 앱 화면과 같지만 세션 파일·프로그램 초기화는 이 PC 앱에서만
function pcAllowed(action){return typeof action?.type==='string'&&!action.type.startsWith('session:');}
function addresses(){return Object.values(os.networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4'&&!a.internal).map(a=>a.address);}
function create({root,request,onChange=()=>{}}){
 let server=null,port=0,pin='',failures=0,lockedUntil=0;const clients=new Map(),sockets=new Set();
 const changed=()=>{try{onChange(info());}catch{}};
 function info(){return {on:!!server,port,pin:server?pin:'',urls:server?addresses().map(a=>`http://${a}:${port}/`):[],clients:[...clients.values()].map(c=>({id:c.id,role:c.role,address:c.address,agent:c.agent,last:c.last}))};}
 const token=req=>(/(?:^|;\s*)orpheia_remote=([a-f0-9]{48})/.exec(req.headers.cookie||'')||[])[1];
 const client=req=>{const t=token(req),c=t&&clients.get(t);if(c){c.last=Date.now();}return c;};
 const send=(res,status,body,type='text/plain; charset=utf-8',extra={})=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra});res.end(body);};
 const json=(res,status,value,extra)=>send(res,status,JSON.stringify(value),TYPES['.json'],extra);
 function readBody(req,limit=30_000_000){return new Promise((resolve,reject)=>{let size=0;const chunks=[];req.on('data',c=>{size+=c.length;if(size>limit){reject(new Error('too large'));req.destroy();}else chunks.push(c);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'));}catch(e){reject(e);}});req.on('error',reject);});}
 const engine=(action,since,version)=>new Promise(resolve=>request(action,since,resolve,version));
 function staticFile(res,rel){
  const file=path.resolve(root,'.'+path.posix.normalize('/'+rel));if(!file.startsWith(path.resolve(root)+path.sep))return send(res,403,'forbidden');
  fs.readFile(file,(err,data)=>err?send(res,404,'not found'):send(res,200,data,TYPES[path.extname(file)]||'application/octet-stream'));
 }
 async function handle(req,res){
  const url=new URL(req.url,'http://remote'),c=client(req),mobile=MOBILE.test(req.headers['user-agent']||'');
  if(url.pathname==='/api/login'&&req.method==='POST'){
   if(Date.now()<lockedUntil)return json(res,429,{ok:false,message:'PIN을 여러 번 틀렸습니다. 잠시 후 다시 시도하세요.'});
   let body;try{body=await readBody(req,1000);}catch{return json(res,400,{ok:false,message:'잘못된 요청'});}
   const given=String(body.pin||'');
   if(!pin||given.length!==pin.length||!crypto.timingSafeEqual(Buffer.from(given),Buffer.from(pin))){if(++failures>=5){failures=0;lockedUntil=Date.now()+60000;}return json(res,401,{ok:false,message:'PIN이 맞지 않습니다.'});}
   failures=0;const t=crypto.randomBytes(24).toString('hex');
   clients.set(t,{id:t.slice(0,8),role:mobile?'remote':'pc',address:(req.socket.remoteAddress||'').replace(/^::ffff:/,''),agent:(req.headers['user-agent']||'').slice(0,120),last:Date.now()});changed();
   return json(res,200,{ok:true,role:mobile?'remote':'pc'},{'Set-Cookie':`orpheia_remote=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200`});
  }
  if(url.pathname==='/api/login'&&req.method==='GET')return send(res,405,'');
  if(!c){
   if(url.pathname.startsWith('/api/'))return json(res,401,{error:'접속이 끊겼습니다. PIN을 다시 입력하세요.'});
   if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/remote.html')return staticFile(res,'remote-login.html');
   return send(res,401,'login required');
  }
  if(url.pathname==='/api/logout'&&req.method==='POST'){clients.delete(token(req));changed();return send(res,200,'',undefined,{'Set-Cookie':'orpheia_remote=; Path=/; Max-Age=0'});}
  if(url.pathname==='/api/request'&&req.method==='POST'){
   let body;try{body=await readBody(req);}catch{return json(res,400,{error:'잘못된 요청'});}
   const action=body.action;
   if(c.role==='remote'){
    if(!remoteAllowed(action))return json(res,403,{error:'리모컨에서는 할 수 없는 조작입니다.'});
    const r=await engine(remoteAction(action),0,-1);if(r.error)return json(res,200,{error:r.error});
    const view=action.type==='remote:view'?r:await engine({type:'remote:view'},0,-1);
    return json(res,200,{result:r.result,view:view.result});
   }
   if(!pcAllowed(action)||!Number.isFinite(body.since)||body.since<0)return json(res,403,{error:'원격 PC에서는 할 수 없는 조작입니다. (세션 파일·전체 초기화는 이 PC 앱에서)'});
   return json(res,200,await engine(action,body.since,body.version??-1));
  }
  // 화면: 모바일은 리모컨만, PC는 앱 화면
  if(c.role==='remote'){
   if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/remote.html')return staticFile(res,'remote.html');
   if(/^\/(ui\/remote-control\.(js|css)|assets\/[\w.-]+)$/.test(url.pathname))return staticFile(res,url.pathname);
   return send(res,403,'리모컨 접속에서는 열 수 없는 화면입니다.');
  }
  if(url.pathname==='/')return send(res,302,'',undefined,{Location:'/index.html?remote=1'});
  if(url.pathname==='/remote.html')return staticFile(res,'remote.html');
  return staticFile(res,url.pathname);
 }
 function start(preferred=8765){
  if(server)return Promise.resolve(info());
  pin=String(crypto.randomInt(0,10000)).padStart(4,'0');failures=0;lockedUntil=0;
  return new Promise((resolve,reject)=>{
   const s=http.createServer((req,res)=>{handle(req,res).catch(()=>{try{send(res,500,'error');}catch{}});});
   s.on('connection',k=>{sockets.add(k);k.on('close',()=>sockets.delete(k));});
   let tries=0;const listen=p=>{s.once('error',e=>{if(e.code==='EADDRINUSE'&&tries++<20)listen(p+1);else reject(e);});s.listen(p,'0.0.0.0',()=>{server=s;port=s.address().port;changed();resolve(info());});};
   listen(preferred);
  });
 }
 function stop(){if(!server)return;for(const sock of sockets)sock.destroy();server.close();server=null;port=0;pin='';clients.clear();changed();}
 function kick(id){for(const [t,c]of clients)if(c.id===id)clients.delete(t);changed();}
 return {start,stop,info,kick};
}
module.exports={create,remoteAllowed,remoteAction,pcAllowed,MOBILE};
