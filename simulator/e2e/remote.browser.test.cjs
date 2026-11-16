'use strict';
// 원격 조작 (브라우저): 아이폰 리모컨 화면 · PC 브라우저 앱 화면이 교수 PC 엔진에 붙는다. node simulator/e2e/remote.browser.test.cjs
const path=require('node:path'),assert=require('node:assert/strict'),{chromium,devices}=require('playwright'),R=require('../engine/runtime.cjs'),S=require('../../desktop/remote-server.cjs');
const SHOTS=process.env.REMOTE_SHOTS;
(async()=>{
 const r=R.create(),lib=r.snapshot().ftsLibrary;lib.situations.push({id:'S-G',name:'g',problems:['P-em-01']});lib.scenarios.push({id:'SC-G',name:'비상시조치 시청 침수',situations:['S-G']});r.command({type:'fts',op:'library',library:lib});
 const srv=S.create({root:path.join(__dirname,'..'),request:(action,since,reply,version)=>{try{const result=r.command(action);reply({result,snapshot:r.transport(version,since)});}catch(e){reply({error:e.message});}}});
 const info=await srv.start(0),base=`http://127.0.0.1:${info.port}/`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  // 아이폰: PIN → 리모컨
  const phone=await browser.newContext({...devices['iPhone 13']});const m=await phone.newPage();const errors=[];m.on('pageerror',e=>errors.push(String(e)));
  await m.goto(base);await m.fill('#pin',info.pin);await m.click('button[type=submit]');await m.waitForSelector('#problem');
  await m.waitForFunction(()=>document.querySelector('#scenario').textContent.includes('진행 중인 교육'));
  r.command({type:'fts',op:'start',scenario:'SC-G',professor:'001',student:'tester',autoRun:false});r.command({type:'tick',seconds:15});
  await m.waitForFunction(()=>document.querySelector('#scenario').textContent.includes('시청 침수'));
  const next=m.locator('.item.next .tap');await next.waitFor();
  if(SHOTS)await m.screenshot({path:SHOTS+'/remote-phone.png',fullPage:false});
  await next.click();await m.waitForFunction(()=>document.querySelectorAll('.item.done').length===1);
  assert.equal(Object.keys(r.snapshot().fts.session.items[0].comm||{}).length,1,'폰에서 누른 통보 확인이 엔진에 반영');
  await m.locator('.more').first().click();await m.waitForSelector('.text');
  if(SHOTS)await m.screenshot({path:SHOTS+'/remote-phone-2.png'});
  assert.deepEqual(errors,[]);
  // PC 브라우저: PIN → 앱 화면 (엔진은 원격)
  const pc=await browser.newContext({viewport:{width:1440,height:900}});const p=await pc.newPage();const perr=[];p.on('pageerror',e=>perr.push(String(e)));
  await p.goto(base);await p.fill('#pin',info.pin);await p.click('button[type=submit]');
  await p.waitForFunction(()=>!!window.SimRemote&&!!window.OrpheiaRemoteClient&&!!document.querySelector('#trackSvg'),null,{timeout:30000});
  const fromPage=await p.evaluate(()=>SimRemote.command({type:'control',station:'jonggak',action:{type:'mode',value:'CCM',source:'LS'}}));
  assert.equal(fromPage.ok,true);assert.equal(r.snapshot().states.jonggak.mode,'CCM','PC 브라우저 조작이 교수 PC 엔진에 반영');
  assert.equal(await p.evaluate(()=>SimRemote.snapshot.fts.session.student),'tester','PC 브라우저도 같은 교육을 본다');
  if(SHOTS)await p.screenshot({path:SHOTS+'/remote-pc.png'});
  assert.deepEqual(perr,[]);
  console.log('PASS 원격 조작: 아이폰 리모컨(통보 확인 반영) · PC 브라우저 앱 화면(원격 엔진 조작) · PIN 로그인');
 }finally{await browser.close();srv.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
