'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const asar=require('@electron/asar');
// ASAR's filesystem walker splits directories with the host's path.sep.
// A POSIX string works for one directory on Windows but fails for deeper assets.
const nativeArchivePath=(file,paths=path)=>paths.join(...file.split('/'));
const portableArchivePath=file=>file.replaceAll('\\','/');
function assetFiles(root,relative='simulator/assets'){
 return fs.readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>{
  const file=relative+'/'+entry.name;
  return entry.isDirectory()?assetFiles(root,file):file.endsWith('.md')?[]:[file];
 });
}
function verifyArchive(archive,{sourceRoot=path.join(__dirname,'..'),files}={}){
 const entry=files?'':fs.readFileSync(path.join(sourceRoot,'simulator/index.html'),'utf8');
 const entriesFromHTML=[...entry.matchAll(/(?:src|href)="((?:engine|ui)\/[^"?#]+)"/g)].map(m=>'simulator/'+m[1]);
 const required=files||[...new Set(['desktop/main.cjs','desktop/window-state.cjs','desktop/engine-broker.cjs','desktop/engine-process.cjs','desktop/preload.cjs','simulator/engine/equipment-controller.cjs','simulator/engine/runtime.cjs','simulator/engine/scenario-controller.cjs','simulator/engine/auto-controller.cjs','simulator/engine/conflict-drill.cjs','simulator/index.html',...entriesFromHTML,...assetFiles(sourceRoot)])];
 for(const file of required){
  const actual=asar.extractFile(archive,nativeArchivePath(file));
  assert.deepEqual(actual,fs.readFileSync(path.join(sourceRoot,nativeArchivePath(file))),`packaged file differs: ${file}`);
 }
 const entries=asar.listPackage(archive).map(portableArchivePath);
 assert.ok(!entries.some(f=>f.startsWith('/references/')||f.startsWith('/node_modules/playwright/')||f.startsWith('/simulator/e2e/')||/\.test\.(?:cjs|js|py)$/.test(f)),'reference archive or test runtime included');
 return required.length;
}
module.exports={nativeArchivePath,portableArchivePath,verifyArchive};
