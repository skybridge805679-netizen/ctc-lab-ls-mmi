'use strict';
const fs=require('node:fs');
const path=require('node:path');
function fitBounds(saved,area,defaults={width:1440,height:1000}){
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const width=Math.round(Math.min(area.width,Math.max(900,finite(saved?.width)?saved.width:defaults.width)));
 const height=Math.round(Math.min(area.height,Math.max(600,finite(saved?.height)?saved.height:defaults.height)));
 const x=Math.round(Math.max(area.x,Math.min(area.x+area.width-width,finite(saved?.x)?saved.x:area.x+(area.width-width)/2)));
 const y=Math.round(Math.max(area.y,Math.min(area.y+area.height-height,finite(saved?.y)?saved.y:area.y+(area.height-height)/2)));
 return {x,y,width,height};
}
function readState(file){try{const data=JSON.parse(fs.readFileSync(file,'utf8'));return data&&typeof data==='object'?data:{};}catch{return {};}}
function writeState(file,state){fs.mkdirSync(path.dirname(file),{recursive:true});const temporary=file+'.tmp';fs.writeFileSync(temporary,JSON.stringify(state,null,2));fs.renameSync(temporary,file);}
module.exports={fitBounds,readState,writeState};
