(function(root){'use strict';
const details=typeof module!=='undefined'?require('./schematic-details'):root.SimSchematicDetails;
function railY(def,id,x){
 const poly=def.rails.find(r=>r[0]===id)[1];
 for(let i=1;i<poly.length;i++){
  const a=poly[i-1],b=poly[i];
  if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&a[0]!==b[0])return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
 }
 return poly[0][1];
}
// 관악 belongs to the Anyang screen. Move its complete source strip, retaining the source registration.
const GWANAK={cut:1496,dx:-1607.4,dy:108.8};
function sourceSceneOf(st){
 const data=details[st.id];if(!['geumcheon','anyang'].includes(st.id))return data;
 const g=details.geumcheon,{cut,dx,dy}=GWANAK;
 if(st.id==='geumcheon')return {...data,cells:data.cells.filter(c=>c[0]<cut).map(([x,y,w,label])=>[x,y,Math.min(w,cut-x),label]),capsules:data.capsules.filter(c=>c[0]<cut)};
 return {...data,cells:[...data.cells.filter(c=>c[0]>=109),...g.cells.filter(c=>c[0]+c[2]>cut).map(([x,y,w,label])=>[Math.max(x,cut)+dx,y+dy,x+w-Math.max(x,cut),label])],capsules:[...data.capsules,...g.capsules.filter(c=>c[0]>=cut).map(([x,y,...rest])=>[x+dx,y+dy,...rest])]};
}
function sceneOf(st){
 const data=sourceSceneOf(st);let cells=data.cells;
 for(const [x,y]of data.ignoreCells||[])cells=cells.filter(c=>Math.abs(c[0]-x)>1||Math.abs(c[1]-y)>2);
 for(const strip of data.strips||[]){
  const {left,right,y,codes}=strip,next=[];
  for(const c of cells){
   const [x,row,w,label]=c;if(Math.abs(row-y)>6||x+w<=left||x>=right){next.push(c);continue;}
   if(x<left)next.push([x,row,left-x,label]);if(x+w>right)next.push([right,row,x+w-right,label]);
  }
  const weights=strip.widths||codes.map(()=>1),total=weights.reduce((a,b)=>a+b,0);let x=left;
  codes.forEach((label,i)=>{const w=(right-left)*weights[i]/total;next.push([x,y,w-2,label]);x+=w;});cells=next;
 }
 return {...data,cells:cells.filter(c=>c[2]>=2)};
}
const api={railY,sceneOf,sourceSceneOf,GWANAK};if(typeof module!=='undefined')module.exports=api;else root.SimTrackGeometry=api;
})(typeof globalThis!=='undefined'?globalThis:this);
