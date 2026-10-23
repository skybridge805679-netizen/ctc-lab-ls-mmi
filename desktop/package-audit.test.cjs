'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const asar=require('@electron/asar');
const {nativeArchivePath,portableArchivePath,verifyArchive}=require('./package-audit.cjs');
// Run the real dependency's directory walker with Windows path semantics on any OS.
function windowsFilesystem(){
 const file=path.join(path.dirname(require.resolve('@electron/asar')),'filesystem.js');
 const ownRequire=createRequire(file),mod={exports:{}};
 const requireWindows=id=>id==='path'?path.win32:ownRequire(id);
 vm.runInThisContext('(function(require,module,exports){'+fs.readFileSync(file,'utf8')+'\n})',{filename:file})(requireWindows,mod,mod.exports);
 return mod.exports.Filesystem;
}
test('real ASAR Windows walker reproduces the PNG error, and native separators resolve it',()=>{
 const WindowsFS=windowsFilesystem(),tree=new WindowsFS('app.asar');
 tree.setHeader({files:{simulator:{files:{assets:{files:{orpheia:{files:{'emblem.png':{size:3,offset:'0'}}}}}}}}});
 assert.throws(()=>tree.getFile('simulator/assets/orpheia/emblem.png'),/was not found/);
 assert.equal(tree.getFile(nativeArchivePath('simulator/assets/orpheia/emblem.png',path.win32)).size,3);
});
test('forbidden ASAR entries are comparable on Windows and POSIX',()=>{
 assert.equal(portableArchivePath('\\node_modules\\playwright\\index.js'),'/node_modules/playwright/index.js');
 assert.equal(portableArchivePath('/references/private.pdf'),'/references/private.pdf');
});
test('archive audit checks actual image bytes and rejects missing and corrupt images',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orpheia-asar-'));
 try{
  const source=path.join(dir,'source'),file='simulator/assets/orpheia/emblem.png',absolute=path.join(source,nativeArchivePath(file));
  fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.writeFileSync(absolute,Buffer.from([137,80,78,71,13,10,26,10]));
  const archive=path.join(dir,'good.asar');await asar.createPackage(source,archive);
  assert.equal(verifyArchive(archive,{sourceRoot:source,files:[file]}),1);
  fs.writeFileSync(absolute,Buffer.from('corrupted'));
  assert.throws(()=>verifyArchive(archive,{sourceRoot:source,files:[file]}),/packaged file differs/);
  fs.rmSync(absolute);const missing=path.join(dir,'missing.asar');await asar.createPackage(source,missing);
  assert.throws(()=>verifyArchive(missing,{sourceRoot:source,files:[file]}),/was not found/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
