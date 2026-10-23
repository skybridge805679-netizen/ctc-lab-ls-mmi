'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fitBounds,readState,writeState}=require('./window-state.cjs');
test('a disconnected monitor is clamped to visible work area',()=>{
 const b=fitBounds({x:6000,y:-900,width:4000,height:2400},{x:0,y:25,width:1440,height:875});
 assert.deepEqual(b,{x:0,y:25,width:1440,height:875});
});
test('negative monitor coordinates and valid saved positions are preserved',()=>{
 const b={x:-1800,y:80,width:1300,height:800};assert.deepEqual(fitBounds(b,{x:-1920,y:0,width:1920,height:1080}),b);
});
test('invalid values cannot make a window inaccessible',()=>{
 const b=fitBounds({x:NaN,y:Infinity,width:-1,height:'bad'},{x:0,y:0,width:1280,height:720});
 assert.ok(b.x>=0&&b.y>=0&&b.width<=1280&&b.height<=720);
});
test('missing or corrupt layout uses defaults; native geometry round trips',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orpheia-layout-')),file=path.join(dir,'layout.json');
 try{assert.deepEqual(readState(file),{});fs.writeFileSync(file,'broken');assert.deepEqual(readState(file),{});const state={mmi:{bounds:{x:5,y:20,width:1200,height:800},maximized:true}};writeState(file,state);assert.deepEqual(readState(file),state);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
