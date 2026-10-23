'use strict';
const {_electron:electron}=require('playwright');
const {expect}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {fitWindow}=require('./window-state.cjs');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'orpheia-native-'));
let application;const errors=[];
(async()=>{
 const executable=process.env.ORPHEIA_PACKAGED_EXECUTABLE?path.resolve(process.env.ORPHEIA_PACKAGED_EXECUTABLE):require('electron');
 const args=process.env.ORPHEIA_PACKAGED_EXECUTABLE?['--orpheia-smoke-test']:[path.join(__dirname,'..'),'--orpheia-smoke-test'];
 if(process.env.ORPHEIA_TEST_NO_SANDBOX==='1')args.unshift('--no-sandbox');
 application=await electron.launch({executablePath:executable,args,env:{...process.env,ORPHEIA_TEST_USER_DATA:profile},timeout:60000});
 const ls=await application.firstWindow();ls.on('pageerror',e=>errors.push(String(e)));await ls.waitForFunction(()=>!!window.SimRemote);
 const enginePID=await ls.evaluate(()=>SimRemote.snapshot.pid),rendererPID=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getOSProcessId());assert.notEqual(enginePID,rendererPID);console.log('Engine process',enginePID,'renderer process',rendererPID);
 await ls.waitForFunction(()=>window.SimWorkspace?.detached());
 let mmi=application.windows().find(p=>p!==ls);assert.ok(mmi,'native MMI window');
 mmi.on('pageerror',e=>errors.push(String(e)));await expect(mmi.locator('#mmiShell')).toBeVisible();
 await ls.click('#pauseBtn');assert.equal(await mmi.evaluate(()=>typeof require),'undefined');
 assert.equal(await mmi.evaluate(()=>typeof SimCore),'undefined','no duplicate engine');
 await expect(mmi.locator('#stationSelect')).toBeHidden();   // MMI는 빈 바탕화면으로 시작하고 현장설비제어는 메뉴로 연다
 await ls.evaluate(()=>SimMMI.open('field'));
 await mmi.selectOption('#stationSelect','anyang');await mmi.selectOption('#controlSelect','mode');
 await mmi.check('[name="mmiMode"][value="CCM"]');await mmi.locator('#mmiApply').click({position:{x:12,y:12}});
 assert.equal(await ls.evaluate(()=>SimField.state('anyang').mode),'CCM');
 await ls.evaluate(()=>SimMMI.raiseAlarm('네이티브 두 창 검증'));
 await expect(mmi.locator('.mmi-alarm')).toBeVisible();await expect(ls.locator('.mmi-alarm')).toHaveCount(0);
 await ls.selectOption('#lsStationSelect','suwon');await expect(mmi.locator('#stationSelect')).toHaveValue('suwon');
 await ls.locator('[data-mode="CCM"]').click();await ls.click('#dialogConfirm');
 await ls.waitForFunction(()=>SimField.state('suwon').mode==='CCM');
 // 열차 그래프는 MMI에 종속되지 않은 독립 창으로 열린다
 await ls.evaluate(()=>SimMMI.open('graph'));await ls.waitForFunction(()=>SimWorkspace.graphDetached());
 const graph=application.windows().find(p=>p!==ls&&p!==mmi);assert.ok(graph,'native T/G window');
 graph.on('pageerror',e=>errors.push(String(e)));await expect(graph.locator('#diaSvg')).toBeVisible();await expect(mmi.locator('#diaSvg')).toHaveCount(0);
 assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.getTitle().includes('그래프')).length),1);

 // A restored window must fit the current monitor, including small CI displays.
 await application.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('MMI'));w.unmaximize();w.setBounds({x:30,y:40,width:1200,height:800},false);});
 // Native resize delivery is asynchronous on macOS. Read after the OS reports it.
 await expect.poll(()=>application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('MMI')).isMaximized())).toBe(false);
 const saved=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('MMI')).getNormalBounds());
 await mmi.close();await expect(ls.locator('#mmiShell')).toHaveCount(0);await expect(ls.locator('.mmi-alarm')).toHaveCount(0);
 await ls.waitForFunction(()=>SimDOM.document.body.ownerDocument===document.getElementById('mmiParking').contentDocument);
 await expect(graph.locator('#diaSvg')).toBeVisible();
 await ls.evaluate(()=>SimTG.actions.axisDialog());await expect(graph.locator('#axFrom')).toBeVisible();await graph.click('#axClose');
 const beforeClosedTick=await ls.evaluate(()=>SimField.state('suwon').clock);
 await ls.evaluate(()=>SimMMI.run({type:'tick',seconds:10}));
 assert.equal(await ls.evaluate(()=>SimField.state('suwon').clock),beforeClosedTick+10);
 await ls.evaluate(()=>SimMMI.raiseAlarm('MMI 종료 중 알람 보존'));
 await ls.evaluate(()=>SimMMI.alertBox('MMI 종료 중 확인창 보존'));
 await ls.click('#detachMMIBtn');await ls.waitForFunction(()=>SimWorkspace.detached());
 mmi=application.windows().find(p=>p!==ls&&p!==graph);await expect(mmi.locator('#mmiShell')).toBeVisible();
 await expect(mmi.locator('.mmi-shield[open]')).toBeVisible();await mmi.click('#mmiAlertOk');await expect(mmi.locator('#alarmText')).toContainText('MMI 종료 중 알람 보존');
 await expect(graph.locator('#diaSvg')).toBeVisible();await graph.close();await ls.waitForFunction(()=>!SimWorkspace.graphDetached());
 const area=await application.evaluate(({screen},bounds)=>screen.getDisplayMatching(bounds).workArea,saved);
 const expected=fitWindow(saved,area,'mmi');
 console.log('Native geometry:',JSON.stringify({saved,area,expected}));
 // Native window-frame conversion can round by one or two DIP. A 100px loss still fails.
 await expect.poll(async()=>{
  const current=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('MMI')).getNormalBounds());
  return Math.max(Math.abs(current.width-expected.width),Math.abs(current.height-expected.height));
 }).toBeLessThanOrEqual(2);
 const persisted=JSON.parse(fs.readFileSync(path.join(profile,'window-layout.json'),'utf8'));
 assert.ok(persisted.mmi,'native geometry was persisted');
 assert.deepEqual(errors,[]);
 fs.mkdirSync('test-results',{recursive:true});await ls.screenshot({path:'test-results/desktop-ls.png'});await mmi.screenshot({path:'test-results/desktop-mmi.png'});
 console.log(`PASS native Electron ${process.platform}/${process.arch}: automatic LS/MMI, shared control/graph, MMI closure without LS merge, hidden alarms/modals, graph/clock continuity, close/reopen and native layout`);
 await application.close();application=null;
 const layout=JSON.parse(fs.readFileSync(path.join(profile,'window-layout.json'),'utf8'));assert.ok(layout.ls&&layout.mmi);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(application)await application.close();fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
