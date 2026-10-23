'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fit}=require('./viewport');
test('miniature desktop windows preserve scale and cover both dimensions',()=>{
 for(const [w,h]of [[1920,1080],[1440,900],[960,720],[640,480],[360,280],[1280,450]]){const f=fit(w,h);assert.ok(f.scale>0&&f.scale<=1);assert.ok(f.width>=1280&&f.height>=720);assert.ok(Math.abs(f.width*f.scale-w)<.001);assert.ok(Math.abs(f.height*f.scale-h)<.001);}
});
