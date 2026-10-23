'use strict';
const path=require('node:path'),{spawnSync}=require('node:child_process');
const transient=text=>/\b(?:50[0234]|429)\b|EAI_AGAIN|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed/i.test(text);
async function install({run=()=>spawnSync(process.execPath,[path.join(path.dirname(require.resolve('electron/package.json')),'install.js')],{encoding:'utf8',env:process.env}),wait=ms=>new Promise(r=>setTimeout(r,ms)),attempts=4,log=console.log}={}){
 for(let i=0;i<attempts;i++){
  const result=run(),text=String(result.stdout||'')+String(result.stderr||'')+String(result.error?.message||'');
  if(result.status===0){log('Electron executable ready (checksum-verified installer/cache).');return;}
  if(!transient(text)||i===attempts-1)throw new Error('Electron install failed: '+text);
  const delay=2000*2**i;log(`Electron download temporarily unavailable; retry ${i+2}/${attempts} in ${delay/1000}s.`);await wait(delay);
 }
}
if(require.main===module)install().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={install,transient};
