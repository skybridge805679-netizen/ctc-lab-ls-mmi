'use strict';
const {app,BrowserWindow,Menu,screen,dialog,session}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {fitWindow,readState,writeState}=require('./window-state.cjs');
// Renderers load only our bundled simulator, with no Node or privileged IPC bridge.
const entry=path.join(__dirname,'../simulator/index.html');
const entryURL=pathToFileURL(entry).href;
const prefs={nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false};
let ls=null,mmi=null,graph=null,stateFile,layout={},quitting=false;
if(process.argv.includes('--orpheia-smoke-test')&&process.env.ORPHEIA_TEST_USER_DATA)app.setPath('userData',process.env.ORPHEIA_TEST_USER_DATA);
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
else{
 app.on('second-instance',()=>{if(ls){if(ls.isMinimized())ls.restore();ls.show();ls.focus();}});
 app.whenReady().then(()=>{
  stateFile=path.join(app.getPath('userData'),'window-layout.json');layout=readState(stateFile);
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,respond)=>respond(false));
  session.defaultSession.on('will-download',(_event,item)=>item.setSaveDialogOptions({defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))}));
  installMenu();createLS();
 });
 app.on('before-quit',()=>{quitting=true;});
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
  dialog.showErrorBox('관제 화면 실행 오류','관제 화면이 종료되었습니다. 앱을 다시 실행하세요. 저장하지 않은 실습 상태는 복구되지 않습니다.');
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
  // Native same-origin window.open keeps the live MMI DOM and single engine.
  ls.webContents.executeJavaScript('window.SimWorkspace.detach()',true).catch(error=>console.error('MMI 분리 실패:',error.message));
 });
 ls.on('closed',()=>{ls=null;for(const w of [mmi,graph])if(w&&!w.isDestroyed())w.close();});
 ls.loadURL(entryURL);
}
function script(code){if(ls&&!ls.isDestroyed())ls.webContents.executeJavaScript(code,true).catch(error=>console.error(error.message));}
function installMenu(){
 const workspace={label:'실습 화면',submenu:[
  {label:'LS 창으로',accelerator:'CmdOrCtrl+1',click:()=>{ls?.show();ls?.focus();}},
  {label:'MMI 창으로 / 분리',accelerator:'CmdOrCtrl+2',click:()=>script('window.SimWorkspace.detach()')},
  {label:'열차 그래프 창',accelerator:'CmdOrCtrl+3',click:()=>script('window.SimWorkspace.openGraph()')},
  {type:'separator'},
  {label:'조작 기록 저장',accelerator:'CmdOrCtrl+S',click:()=>script('document.getElementById("exportBtn").click()')},
  {role:'togglefullscreen',label:'전체 화면'}
 ]};
 const menu=[...(process.platform==='darwin'?[{label:app.name,submenu:[{role:'about',label:'ORPHEIA 정보'},{type:'separator'},{role:'hide',label:'숨기기'},{role:'hideOthers',label:'다른 앱 숨기기'},{type:'separator'},{role:'quit',label:'종료'}]}]:[]),workspace,
  {label:'편집',submenu:[{role:'undo',label:'실행 취소'},{role:'redo',label:'다시 실행'},{type:'separator'},{role:'cut',label:'잘라내기'},{role:'copy',label:'복사'},{role:'paste',label:'붙여넣기'},{role:'selectAll',label:'모두 선택'}]},
  {label:'창',submenu:[{role:'minimize',label:'최소화'},...(process.platform==='darwin'?[{role:'front',label:'모두 앞으로'}]:[{role:'quit',label:'프로그램 종료'}])]}
 ];
 if(!app.isPackaged)menu.push({label:'개발',submenu:[{role:'toggleDevTools'}]});
 Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}
