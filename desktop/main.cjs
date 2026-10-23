'use strict';
const {app,BrowserWindow,Menu,screen,dialog,session,ipcMain,utilityProcess,Tray}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const stations=require('../simulator/engine/network').stations.filter(s=>s.controlled),extraLS=new Set();
const trustedLS=sender=>[ls,...extraLS].some(win=>win&&!win.isDestroyed()&&win.webContents===sender);
const {fitWindow,readState,writeState}=require('./window-state.cjs');
// Sandboxed renderers load bundled UI and a single constrained simulation IPC bridge.
const entry=path.join(__dirname,'../simulator/index.html');
const entryURL=pathToFileURL(entry).href;
const prefs={nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false,preload:path.join(__dirname,'preload.cjs')};
let ls=null,mmi=null,graph=null,stateFile,layout={},quitting=false,engine=null,tray=null;
if(process.argv.includes('--orpheia-smoke-test')&&process.env.ORPHEIA_TEST_USER_DATA)app.setPath('userData',process.env.ORPHEIA_TEST_USER_DATA);
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
else{
 app.on('second-instance',()=>{if(ls){if(ls.isMinimized())ls.restore();ls.show();ls.focus();}});
 app.whenReady().then(async()=>{
  stateFile=path.join(app.getPath('userData'),'window-layout.json');layout=readState(stateFile);
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,respond)=>respond(false));
  session.defaultSession.on('will-download',(_event,item)=>item.setSaveDialogOptions({defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))}));
  engine=require('./engine-broker.cjs').create({utilityProcess,stateFile:path.join(app.getPath('userData'),'engine-session.orpheia'),onWarning:message=>{if(!quitting)dialog.showMessageBox({type:'warning',title:'실습 저장 알림',message});},onFatal:message=>{if(!quitting){console.error(message);dialog.showErrorBox('관제 엔진 연결 오류',message+' 실시간 조작을 중단했습니다. 프로그램을 종료하고 다시 실행하세요.');}}});
  await engine.ready;
  ipcMain.on('orpheia:engine',(event,message)=>{
   if(!trustedLS(event.sender)||event.senderFrame!==event.sender.mainFrame){event.returnValue={error:'Untrusted engine client'};return;}
   if(!message||typeof message.action?.type!=='string'||message.action.type.startsWith('session:')||!Number.isFinite(message.since)||message.since<0){event.returnValue={error:'Invalid engine request'};return;}
   engine.request(message.action,message.since,response=>{event.returnValue=response;},message.version??-1);
  });
  ipcMain.on('orpheia:view',(event,{kind,station}={})=>{if(!trustedLS(event.sender)||event.senderFrame!==event.sender.mainFrame)return;if(kind==='ls')createExtraLS(station);else if(kind==='mmi')script('SimWorkspace.detach()');else if(kind==='graph')script('SimWorkspace.openGraph()');});
  installMenu();createLS();
  if(process.platform!=='darwin'){tray=new Tray(path.join(__dirname,'resources/icon.png'));tray.setToolTip('ORPHEIA · 관제 엔진 실행 중');tray.setContextMenu(Menu.buildFromTemplate([{label:'LS 창 열기',click:()=>{ls?.show();ls?.focus();}},{label:'MMI 창 열기',click:()=>script('SimWorkspace.detach()')},{type:'separator'},{label:'프로그램 종료',click:()=>app.quit()}]));tray.on('double-click',()=>{ls?.show();ls?.focus();});}

 }).catch(error=>{dialog.showErrorBox('관제 엔진 시작 오류',error.message);app.quit();});
 app.on('before-quit',event=>{if(quitting)return;event.preventDefault();quitting=true;const finish=()=>{engine?.stop();tray?.destroy();app.quit();};if(engine)engine.request({type:'session:persist'},0,response=>{if(response.error)dialog.showErrorBox('실습 저장 실패',response.error);finish();});else finish();});
 app.on('window-all-closed',()=>app.quit());
 app.on('activate',()=>{if(!ls)createLS();else ls.show();});
}
function savedBounds(role){
 const displays=screen.getAllDisplays(),saved=layout[role];
 const display=saved?.bounds?screen.getDisplayMatching(saved.bounds):(role!=='ls'?(displays.find(d=>d.id!==screen.getPrimaryDisplay().id)||screen.getPrimaryDisplay()):screen.getPrimaryDisplay());
 return fitWindow(saved?.bounds,display.workArea,role);
}
function remember(win,role){
 const save=()=>{
  if(win.isDestroyed()||win.isMinimized())return;
  layout[role]={bounds:win.getNormalBounds(),maximized:win.isMaximized()};
  try{writeState(stateFile,layout);}catch(error){console.error('창 배치 저장 실패:',error.message);}
 };
 win.on('resize',save);win.on('move',save);win.on('close',save);
 if(layout[role]?.maximized)win.maximize();
}
function protect(win){
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.webContents.on('will-redirect',event=>event.preventDefault());
 win.webContents.on('render-process-gone',(_event,details)=>{
  if(quitting||details.reason==='clean-exit')return;
  dialog.showMessageBox({type:'error',title:'관제 화면 실행 오류',message:'화면이 종료되었지만 별도 엔진의 운행 상태는 유지됩니다.',detail:'화면을 다시 불러오면 현재 엔진 상태로 연결합니다.',buttons:['화면 다시 열기','나중에'],defaultId:0}).then(({response})=>{const target=extraLS.has(win)?win:ls;if(response===0&&target&&!target.isDestroyed())target.reload();});
 });
}
function createLS(){
 ls=new BrowserWindow({...savedBounds('ls'),show:false,title:'ORPHEIA · LS',backgroundColor:'#edf4f1',icon:path.join(__dirname,'resources/icon.png'),webPreferences:prefs});
 remember(ls,'ls');protect(ls);
 ls.webContents.setWindowOpenHandler(({url,frameName})=>{
  if(url!=='about:blank')return {action:'deny'};
  if(frameName.startsWith('orpheia-mmi-')&&!mmi)return {action:'allow',overrideBrowserWindowOptions:{...savedBounds('mmi'),title:'ORPHEIA · MMI',backgroundColor:'#e6efec',autoHideMenuBar:true,webPreferences:prefs}};
  if(frameName.startsWith('orpheia-tg-')&&!graph)return {action:'allow',overrideBrowserWindowOptions:{...savedBounds('graph'),title:'ORPHEIA · 열차 그래프',backgroundColor:'#1e1e1e',autoHideMenuBar:true,webPreferences:prefs}};
  return {action:'deny'};
 });
 ls.webContents.on('did-create-window',(child,{frameName})=>{
  const isGraph=frameName.startsWith('orpheia-tg-');
  if(isGraph)graph=child;else mmi=child;
  remember(child,isGraph?'graph':'mmi');protect(child);
  child.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  child.on('closed',()=>{if(mmi===child)mmi=null;if(graph===child)graph=null;});
 });
 ls.once('ready-to-show',()=>ls?.show());
 ls.webContents.on('did-finish-load',()=>{
  ls.setTitle('ORPHEIA · LS');
  // Native same-origin window.open shares presentation; authoritative state stays in the utility process.
  ls.webContents.executeJavaScript('window.SimWorkspace.detach()',true).catch(error=>console.error('MMI 분리 실패:',error.message));
 });
 ls.on('close',event=>{if(!quitting){event.preventDefault();ls.hide();}});
 ls.on('closed',()=>{ls=null;for(const w of [mmi,graph])if(w&&!w.isDestroyed())w.close();});
 ls.loadURL(entryURL+'?desktop=1');
}
function createExtraLS(station){
 if(!require('../simulator/ui/ls-presets').get(station))return;
 const win=new BrowserWindow({...savedBounds('ls:'+station),minWidth:320,minHeight:240,show:false,title:'ORPHEIA · LS',backgroundColor:'#686d68',icon:path.join(__dirname,'resources/icon.png'),webPreferences:prefs});
 extraLS.add(win);remember(win,'ls:'+station);protect(win);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.once('ready-to-show',()=>win.show());win.on('closed',()=>extraLS.delete(win));
 win.loadURL(entryURL+'?desktop=1&lsStation='+encodeURIComponent(station));
}
function script(code){if(ls&&!ls.isDestroyed())ls.webContents.executeJavaScript(code,true).catch(error=>console.error(error.message));}
function installMenu(){
 const workspace={label:'실습 화면',submenu:[
  {label:'LS 창으로',accelerator:'CmdOrCtrl+1',click:()=>{ls?.show();ls?.focus();}},
  {label:'LS 추가 창',submenu:require('../simulator/ui/ls-presets').list().map(st=>({label:st.name,click:()=>createExtraLS(st.id)}))},
  {label:'MMI 창으로 / 분리',accelerator:'CmdOrCtrl+2',click:()=>script('window.SimWorkspace.detach()')},
  {label:'열차 그래프 창',accelerator:'CmdOrCtrl+3',click:()=>script('window.SimWorkspace.openGraph()')},
  {type:'separator'},
  {label:'실습 세션 저장…',accelerator:'CmdOrCtrl+Shift+S',click:()=>sessionFile(false)},
  {label:'실습 세션 열기…',accelerator:'CmdOrCtrl+O',click:()=>graph?.isFocused()?script('SimTimetableFiles.open()'):sessionFile(true)},
  {label:'조작 기록 저장',accelerator:'CmdOrCtrl+S',click:()=>script(graph?.isFocused()?'SimTimetableFiles.save()':'document.getElementById("exportBtn").click()')},
  {role:'togglefullscreen',label:'전체 화면'}
 ]};
 const menu=[...(process.platform==='darwin'?[{label:app.name,submenu:[{role:'about',label:'ORPHEIA 정보'},{type:'separator'},{role:'hide',label:'숨기기'},{role:'hideOthers',label:'다른 앱 숨기기'},{type:'separator'},{role:'quit',label:'종료'}]}]:[]),workspace,
  {label:'편집',submenu:[{label:'실행 취소',accelerator:'CmdOrCtrl+Z',click:()=>editHistory(false)},{label:'다시 실행',accelerator:'CmdOrCtrl+Shift+Z',click:()=>editHistory(true)},{type:'separator'},{role:'cut',label:'잘라내기'},{role:'copy',label:'복사'},{role:'paste',label:'붙여넣기'},{role:'selectAll',label:'모두 선택'}]},
  {label:'창',submenu:[{role:'minimize',label:'최소화'},...(process.platform==='darwin'?[{role:'front',label:'모두 앞으로'}]:[{role:'quit',label:'프로그램 종료'}])]}
 ];
 if(!app.isPackaged)menu.push({label:'개발',submenu:[{role:'toggleDevTools'}]});
 Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}

async function sessionFile(open){
 const filters=[{name:'ORPHEIA 실습 세션',extensions:['orpheia']}],choice=open?await dialog.showOpenDialog({title:'실습 세션 열기',filters,properties:['openFile']}):await dialog.showSaveDialog({title:'실습 세션 저장',filters,defaultPath:path.join(app.getPath('downloads'),'orpheia-session.orpheia')});
 if(choice.canceled)return;const file=open?choice.filePaths[0]:choice.filePath;
 engine.request({type:open?'session:open':'session:save',file},0,response=>{if(response.error)dialog.showErrorBox('실습 세션 파일 오류',response.error);else if(open)ls?.reload();});
}

async function editHistory(redo){const win=BrowserWindow.getFocusedWindow();if(!win)return;const input=await win.webContents.executeJavaScript('!!document.activeElement?.closest("input,textarea,[contenteditable=true]")');if(win===graph&&!input)script('SimTimetableFiles.'+(redo?'redo':'undo')+'()');else win.webContents[redo?'redo':'undo']();}
