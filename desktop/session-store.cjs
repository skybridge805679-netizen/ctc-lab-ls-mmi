'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),zlib=require('node:zlib'),{promisify}=require('node:util'),crypto=require('node:crypto');
const MAGIC=Buffer.from('ORPHEIA-SESSION\0');
async function encode(state){const payload=await promisify(zlib.gzip)(Buffer.from(JSON.stringify(state)),{level:1});return Buffer.concat([MAGIC,crypto.createHash('sha256').update(payload).digest(),payload]);}
function decode(buffer){if(buffer.length<MAGIC.length+32||!buffer.subarray(0,MAGIC.length).equals(MAGIC))throw new Error('실습 세션 파일 형식이 아닙니다.');const payload=buffer.subarray(MAGIC.length+32),digest=crypto.createHash('sha256').update(payload).digest();if(!digest.equals(buffer.subarray(MAGIC.length,MAGIC.length+32)))throw new Error('실습 세션 파일의 무결성 검사가 실패했습니다.');return JSON.parse(zlib.gunzipSync(payload).toString('utf8'));}
function read(file){if(fs.statSync(file).size>512*1024*1024)throw new Error('세션 파일이 512MB 한도를 넘었습니다.');return decode(fs.readFileSync(file));}
async function write(file,state,{backup=true}={}){await fsp.mkdir(path.dirname(file),{recursive:true});const temp=file+'.tmp',handle=await fsp.open(temp,'w',0o600);try{await handle.writeFile(await encode(state));await handle.sync();}finally{await handle.close();}if(backup)try{await fsp.copyFile(file,file+'.bak');}catch(error){if(error.code!=='ENOENT')throw error;}await fsp.rename(temp,file);}
module.exports={encode,decode,read,write};
