(function(root){'use strict';
const network=()=>typeof module!=='undefined'?require('../engine/network'):root.SimNetwork;
const sources=typeof module!=='undefined'?require('./ls-corridor-source'):root.SimLSCorridorSource;
// 역간 감시 화면(CCM 없음). host 역 화면에서 cut 오른쪽(right까지)을 떼어 원본 PPT 슬라이드 좌표로 다시 배치한다.
const CORRIDORS=[
 {id:'anyang-geumjeong',host:'anyang',next:'geumjeong',name:'안양~금정',slide:13,cut:1162,right:1334},
 {id:'gunpo-uiwang',host:'gunpo',next:'uiwang',name:'군포~의왕',slide:16,cut:1131,right:1303},
 {id:'uiwang-suwon',host:'uiwang',next:'suwon',name:'의왕~수원',slide:18,cut:1331,right:1835}
];
const CORRIDOR='uiwang-suwon';
const corridorOf=id=>CORRIDORS.find(c=>c.id===id);
const hosted=station=>CORRIDORS.find(c=>c.host===station);
function list(){return network().stations.filter(s=>s.controlled).flatMap(s=>{const c=hosted(s.id);return [{id:s.id,station:s.id,name:s.name},...(c?[{id:c.id,station:c.host,name:c.name,monitor:true,plates:sources[c.slide].plates.map(p=>p.name)}]:[])];});}
function get(id){return list().find(v=>v.id===id);}
// 원본 노란 화살표가 가리키는 이웃 화면(역간 감시 화면 포함)
function neighbours(id){const views=list(),i=views.findIndex(v=>v.id===id);return {left:views[i-1]||null,right:views[i+1]||null};}
// Circuit ownership follows source identities, never the position chosen for drawing.
// Moving a viewport boundary cannot create, destroy or reconnect engine circuits.
function circuitView(station,code){
 const spec=hosted(station);if(!spec)return station;
 const source=sources[spec.slide];
 if(source.cells.some(c=>c.code===code))return spec.id;
 if(source.handoff.includes(code))return spec.next;
 return station;
}
const definitions=new WeakMap();
function prepare(st,def,data,wing,preset){
 const spec=hosted(st.id);
 if(!spec||!preset)return {def,data,wing,split:false,corridor:false};
 const corridor=preset===spec.id,source=sources[spec.slide],CUT=spec.cut,RIGHT=spec.right;
 const sourceX=x=>CUT+x/source.size[0]*(RIGHT-CUT);
 const inside=x=>corridor?x>=CUT&&x<=RIGHT:x<CUT;
 let cells=data.cells.filter(c=>circuitView(st.id,c[3])===(corridor?spec.id:st.id));
 if(corridor)cells=source.cells.map(item=>{const original=data.cells.find(c=>c[3]===item.code);if(!original)throw Error('Missing corridor circuit '+item.code);return [sourceX(item.box[0]),original[1],item.box[2]/source.size[0]*(RIGHT-CUT),item.code];});
 if(corridor){
  let cache=definitions.get(def);if(!cache){cache={};definitions.set(def,cache);}
  let derived=cache[spec.id];
  if(!derived){const rows=[...new Set(cells.map(c=>Math.round(c[1])))].sort((a,b)=>a-b);derived={...def,rails:rows.map((y,i)=>{const row=cells.filter(c=>Math.abs(c[1]-y)<3).sort((a,b)=>a[0]-b[0]);return ['corridor-'+i,[[Math.min(...row.map(c=>c[0])),y],[Math.max(...row.map(c=>c[0]+c[2])),y]],null,row[0][3],row.at(-1)[3]];}),links:[],signals:[]};cache[spec.id]=derived;}
  def=derived;
 }
 const filtered={...wing,cells:wing.cells.filter(c=>circuitView(st.id,c[3])===(corridor?spec.id:st.id)),diags:wing.diags.filter(poly=>poly.every(p=>inside(p[0]))),platforms:wing.platforms.filter(p=>inside((p[0]+p[2])/2)),plates:wing.plates.filter(p=>inside((p.box[0]+p.box[2])/2)),labels:wing.labels.filter(p=>inside(p[0])),signals:wing.signals.filter(p=>inside(p[0])),markers:corridor?[]:wing.markers,fixed:corridor?{brackets:[],captions:[]}:wing.fixed};
 if(corridor){
  filtered.cells=cells;filtered.diags=[];filtered.labels=[];filtered.signals=[];
  filtered.plates=source.plates.map(p=>({name:p.name,box:[sourceX(p.box[0]),0,sourceX(p.box[0]+p.box[2]),25]}));
  filtered.platforms=source.platforms.map(p=>{const row=cells.find(c=>c[3]===p.code)[1],h=p.box[3];return [sourceX(p.box[0]),row+p.offset-h/2,sourceX(p.box[0]+p.box[2]),row+p.offset+h/2,'o',p.offset];});
 }
 return {def,data:{...data,cells,joins:[],markers:(data.markers||[]).filter(m=>inside(m[0]))},wing:filtered,split:true,corridor,slide:spec.slide};
}
function windows(items,def,cells,split,corridor,slide){
 if(!split)return items;
 const has=code=>cells.some(c=>c[3].replaceAll(' · ','')===code)||def.rails.some(r=>r[0]===code||r[3]===code||r[4]===code);
 return items.filter(item=>(item.slide===slide)===corridor).flatMap(item=>has(item.code)?[{...item,anchorCode:item.code}]:has(item.anchorCode)?[item]:[]);
}
const api={list,get,neighbours,circuitView,prepare,windows,CORRIDOR,CORRIDORS};if(typeof module!=='undefined')module.exports=api;else root.SimLSPresets=api;
})(typeof globalThis!=='undefined'?globalThis:this);
