(function(root){'use strict';
const network=()=>typeof module!=='undefined'?require('../engine/network'):root.SimNetwork;
const CUT=1331,CORRIDOR='uiwang-suwon';
const source=typeof module!=='undefined'?require('./ls-corridor-source'):root.SimLSCorridorSource;
const sourceX=x=>CUT+x/source.size[0]*(1835-CUT);
function list(){return network().stations.filter(s=>s.controlled).flatMap(s=>[{id:s.id,station:s.id,name:s.name},...(s.id==='uiwang'?[{id:CORRIDOR,station:'uiwang',name:'의왕~수원',monitor:true}]:[])]);}
function get(id){return list().find(v=>v.id===id);}
const definitions=new WeakMap();
function prepare(st,def,data,wing,preset){
 if(st.id!=='uiwang'||!preset)return {def,data,wing,split:false,corridor:false};
 const corridor=preset===CORRIDOR,inside=x=>corridor?x>=CUT:x<CUT;
 let cells=data.cells.filter(c=>inside(c[0]+c[2]/2));
 if(corridor)cells=source.cells.map(item=>{const original=cells.find(c=>c[3]===item.code);if(!original)throw Error('Missing corridor circuit '+item.code);return [sourceX(item.box[0]),original[1],item.box[2]/source.size[0]*(1835-CUT),item.code];});
 if(corridor){
  let derived=definitions.get(def);
  if(!derived){const rows=[...new Set(cells.map(c=>Math.round(c[1])))].sort((a,b)=>a-b);derived={...def,rails:rows.map((y,i)=>{const row=cells.filter(c=>Math.abs(c[1]-y)<3).sort((a,b)=>a[0]-b[0]);return ['corridor-'+i,[[Math.min(...row.map(c=>c[0])),y],[Math.max(...row.map(c=>c[0]+c[2])),y]],null,row[0][3],row.at(-1)[3]];}),links:[],signals:[]};definitions.set(def,derived);}
  def=derived;
 }
 const filtered={...wing,cells:wing.cells.filter(c=>inside(c[0]+c[2]/2)),diags:wing.diags.filter(poly=>poly.every(p=>inside(p[0]))),platforms:wing.platforms.filter(p=>inside((p[0]+p[2])/2)),plates:wing.plates.filter(p=>inside((p.box[0]+p.box[2])/2)),labels:wing.labels.filter(p=>inside(p[0])),signals:wing.signals.filter(p=>inside(p[0])),markers:corridor?[]:wing.markers,fixed:corridor?{brackets:[],captions:[]}:wing.fixed};
 if(corridor){
  filtered.cells=cells;filtered.diags=[];filtered.labels=[];filtered.signals=[];
  filtered.plates=source.plates.map(p=>({name:p.name,box:[sourceX(p.box[0]),0,sourceX(p.box[0]+p.box[2]),25]}));
  filtered.platforms=source.platforms.map(p=>{const row=cells.find(c=>c[3]===p.code)[1],h=p.box[3];return [sourceX(p.box[0]),row+p.offset-h/2,sourceX(p.box[0]+p.box[2]),row+p.offset+h/2,'o',p.offset];});
 }
 return {def,data:{...data,cells,joins:[]},wing:filtered,split:true,corridor};
}
function windows(items,def,cells,split,corridor){
 if(!split)return items;
 const has=code=>cells.some(c=>c[3].replaceAll(' · ','')===code)||def.rails.some(r=>r[0]===code||r[3]===code||r[4]===code);
 return items.filter(item=>(item.slide===18)===corridor).flatMap(item=>has(item.code)?[{...item,anchorCode:item.code}]:has(item.anchorCode)?[item]:[]);
}
const api={list,get,prepare,windows,CORRIDOR};if(typeof module!=='undefined')module.exports=api;else root.SimLSPresets=api;
})(typeof globalThis!=='undefined'?globalThis:this);
