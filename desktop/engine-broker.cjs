'use strict';
const path=require('node:path');
function create({utilityProcess,stateFile,onWarning=console.warn,onFatal=console.error}){
 const child=utilityProcess.fork(path.join(__dirname,'engine-process.cjs'),stateFile?[stateFile]:[],{serviceName:'ORPHEIA simulation engine',stdio:'pipe'});
 let serial=0,dead=false;const pending=new Map();let readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const startup=setTimeout(()=>{readyReject(new Error('엔진 시작 시간이 초과되었습니다.'));child.kill();},10000);
 child.on('message',message=>{
  if(message.ready){clearTimeout(startup);readyResolve(message.pid);return;}
  if(message.warning){onWarning(message.warning);return;}
  if(message.fatal){onFatal(message.fatal);return;}
  const p=pending.get(message.id);if(!p)return;clearTimeout(p.timer);pending.delete(message.id);p.reply(message);
 });
 child.on('exit',code=>{clearTimeout(startup);dead=true;const error='엔진 프로세스 연결이 종료되었습니다 ('+code+').';readyReject(new Error(error));for(const p of pending.values()){clearTimeout(p.timer);p.reply({error});}pending.clear();onFatal(error);});
 function request(action,since,reply,version=-1){if(dead){reply({error:'Engine offline'});return;}
  const id=++serial,timer=setTimeout(()=>{pending.delete(id);reply({error:'엔진 명령 응답 시간이 초과되었습니다. 명령을 자동 재전송하지 않습니다.'});},5000);
  pending.set(id,{timer,reply});child.postMessage({id,action,since,version});
 }
 return {ready,request,stop:()=>child.kill(),pid:()=>child.pid};
}
module.exports={create};
