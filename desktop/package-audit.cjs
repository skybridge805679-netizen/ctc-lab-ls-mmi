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
 const required=files||['desktop/main.cjs','desktop/window-state.cjs','simulator/index.html','simulator/workspace-dom.js','simulator/workspace-windows.js','simulator/core.js',...assetFiles(sourceRoot)];
 for(const file of required){
  const actual=asar.extractFile(archive,nativeArchivePath(file));
  assert.deepEqual(actual,fs.readFileSync(path.join(sourceRoot,nativeArchivePath(file))),`packaged file differs: ${file}`);
 }
 const entries=asar.listPackage(archive).map(portableArchivePath);
 assert.ok(!entries.some(f=>f.startsWith('/references/')||f.startsWith('/node_modules/playwright/')),'reference archive or test runtime included');
 return required.length;
}
module.exports={nativeArchivePath,portableArchivePath,verifyArchive};
