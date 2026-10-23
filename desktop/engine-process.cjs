'use strict';
// Authoritative state, simulation clock and durable checkpoints live outside the renderer.
const Runtime=require('../simulator/engine/runtime.cjs'),Store=require('./session-store.cjs'),fs=require('node:fs');
const stateFile=process.argv[2],warnings=[];let runtime=Runtime.create(),faulted=null,saving=Promise.resolve(),recovered=false;
if(stateFile){for(const file of [stateFile,stateFile+'.bak']){if(!fs.existsSync(file))continue;try{runtime.restore(Store.read(file));recovered=file.endsWith('.bak');break;}catch(error){runtime=Runtime.create();warnings.push('저장된 세션을 복구하지 못했습니다: '+error.message);}}}
const send=value=>process.parentPort?process.parentPort.postMessage(value):process.send?.(value);
function persist(file=stateFile){if(!file)return Promise.resolve();const data=runtime.checkpoint(),backup=!recovered;recovered=false;saving=saving.catch(()=>{}).then(()=>Store.write(file,data,{backup}));return saving;}
async function handle(message){const m=message.data??message;try{
 if(faulted)throw new Error('엔진을 중단했습니다: '+faulted);
 let result;
 if(m.action.type==='session:persist'){runtime.command({type:'clock',paused:true});await persist();result={ok:true};}
 else if(m.action.type==='session:save'){await persist(m.action.file);result={ok:true};}
 else if(m.action.type==='session:open'){const data=Store.read(m.action.file);await persist();const prior=runtime.checkpoint();try{runtime.restore(data);}catch(error){runtime.restore(prior);throw error;}result={ok:true};}
 else result=runtime.command(m.action);
 send({id:m.id,result,snapshot:runtime.transport(m.version??-1,m.since||0)});
 }catch(error){send({id:m.id,error:error.message});}}
// Serialize commands even while a file operation is awaiting disk IO.
let queue=Promise.resolve();function enqueue(m){queue=queue.then(()=>handle(m));}
if(process.parentPort)process.parentPort.on('message',enqueue);else process.on('message',enqueue);
setInterval(()=>{try{runtime.pulse();}catch(error){faulted=error.message;runtime.command({type:'clock',paused:true});send({fatal:error.message});}},1000);
let lastSaveError='';if(stateFile)setInterval(()=>persist().then(()=>{lastSaveError='';}).catch(error=>{if(error.message!==lastSaveError){lastSaveError=error.message;send({warning:'실습 자동 저장에 실패했습니다: '+error.message});}}),10000);
send({ready:true,pid:process.pid});if(warnings.length)send({warning:recovered?'이전 백업에서 세션을 복구했습니다.':warnings.join('\n')});
