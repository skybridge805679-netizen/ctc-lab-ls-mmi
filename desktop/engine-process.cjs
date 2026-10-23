'use strict';
// The authoritative engine runs here in an Electron utility process (or Node fork tests).
const runtime=require('../simulator/engine/runtime.cjs').create();
let faulted=null;
const send=value=>process.parentPort?process.parentPort.postMessage(value):process.send?.(value);
function handle(message){const m=message.data??message;try{if(faulted)throw new Error('엔진을 중단했습니다: '+faulted);const result=runtime.command(m.action);send({id:m.id,result,snapshot:runtime.snapshot(m.since||0)});}catch(error){send({id:m.id,error:error.message});}}
if(process.parentPort)process.parentPort.on('message',handle);else process.on('message',handle);
setInterval(()=>{try{runtime.pulse();}catch(error){faulted=error.message;runtime.command({type:'clock',paused:true});send({fatal:error.message});}},1000);
send({ready:true,pid:process.pid});
