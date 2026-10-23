'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('OrpheiaEngine',{request:(action,since=0,version=-1)=>ipcRenderer.sendSync('orpheia:engine',{action,since,version})});
