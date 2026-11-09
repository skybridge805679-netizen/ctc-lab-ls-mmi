'use strict';
// LS 화면 코드 점검: T칸(겹침·틈·원본 위치), 신호기·입환표지(누락·등 위치·기둥이 틈에 서는지), 선로전환기(그림·번호 태그·A/B 번호), 열번칸(누락·원본 위치)
// 사용: node tools/audit-ls-code.cjs [역 id]   ·   모듈: require(...).audit() → {역: {issues}}
const path=require('path'),R=path.join(__dirname,'../simulator/')+'/';
const N=require(R+'engine/network'),C=require(R+'engine/core'),W=require(R+'engine/wiring'),LS=require(R+'ui/ls-view'),X=require(R+'engine/ls-xmap'),TW=require(R+'engine/train-windows');
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
function audit(){
const out={};
for(const st of N.stations.filter(s=>s.controlled)){
 const id=st.id,core=C.forStation(id),def=W.data[id],xm=X[id],k=1600/(xm?.width||1600);
 const view=LS.render(st,def,core,core.initial(),{aspect:1600/713,preset:id});const svg=view.svg;const issues=[];
 // cells
 const cells=[...svg.matchAll(/<g class="track-cell[^"]*"([^>]*)><rect class="cell-bed" x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g)].map(m=>({code:attrs(m[1])['data-track-circuit'],x:+m[2],y:+m[3]+ +m[5]/2,r:+m[2]+ +m[4]}));
 const rows=[...new Set(cells.map(c=>Math.round(c.y)))].sort((a,b)=>a-b);
 // labels per cell
 const labels=[...svg.matchAll(/<text[^>]*data-circuit-label="([^"]+)"[^>]*x="([\d.-]+)" y="([\d.-]+)"/g)].map(m=>({l:m[1],x:+m[2],y:+m[3]}));
 // 1) gaps within rows
 for(const y of rows){const r=cells.filter(c=>Math.abs(c.y-y)<2).sort((a,b)=>a.x-b.x);
  for(let i=1;i<r.length;i++){const g=r[i].x-r[i-1].r;if(g<-0.5)issues.push(['cell-overlap',r[i-1].code,r[i].code,+g.toFixed(1),Math.round(y)]);
   else if(g<2&&r[i-1].code!==r[i].code)issues.push(['cell-nogap',r[i-1].code,r[i].code,+g.toFixed(1),Math.round(y)]);}}
 // 2) xmap source cells vs rendered
 if(xm){for(const [px,py,lab,x0,x1] of xm.cells){const e0=x0*k,e1=x1*k;const cand=cells.filter(c=>c.x<e1&&c.r>e0);
   if(!cand.length){issues.push(['xmap-missing',lab,Math.round(e0),Math.round(e1)]);continue;}
   const best=cand.sort((a,b)=>(Math.abs(a.x-e0)+Math.abs(a.r-e1))-(Math.abs(b.x-e0)+Math.abs(b.r-e1)))[0];
   const d0=best.x-e0,d1=best.r-e1,edge=e1>1580&&best.r>=1599;if(Math.abs(d0)>6||(Math.abs(d1)>6&&!edge))issues.push(['cell-off',lab||'(blank)',best.code,Math.round(e0)+'-'+Math.round(e1),Math.round(best.x)+'-'+Math.round(best.r)]);}}
 // 3) signals
 const sigs=[...svg.matchAll(/<g class="signal ([^"]*)" data-signal-view="([^"]+)" data-anchor-x="([\d.-]+)" data-lamp-y="([\d.-]+)">(.*?)<\/g>/g)].map(m=>{const lamps=[...m[5].matchAll(/<circle class="lamp (?!off)[^"]*" cx="([\d.-]+)"/g)].map(q=>+q[1]);const mast=m[5].match(/class="mast" d="M([\d.-]+) ([\d.-]+)V/);return {cls:m[1],id:m[2],ax:+m[3],ly:+m[4],lamp:lamps[0],mastY:mast?+mast[2]:null};});
 const coreSig=Object.keys(core.signals),seen=new Set(sigs.map(s=>s.id));
 for(const s of coreSig)if(!seen.has(s))issues.push(['signal-missing',s,core.signals[s].kind]);
 for(const s of sigs)if(!core.signals[s.id])issues.push(['signal-extra',s.id]);
 const wsig=new Set(def.signals.map(s=>s[0]));for(const s of coreSig)if(!wsig.has(s))issues.push(['signal-not-in-wiring',s]);
 for(const s of sigs){const v=xm?.signals?.[s.id];if(v&&s.lamp!=null&&Math.abs(s.lamp-v[0]*k)>5)issues.push(['signal-lamp-off',s.id,core.signals[s.id]?.kind,Math.round(v[0]*k),Math.round(s.lamp)]);
  if(xm&&!v)issues.push(['signal-no-source',s.id,core.signals[s.id]?.kind]);
  // mast in gap: mast foot row
  const ry=s.mastY;const row=rows.find(y=>Math.abs(y-ry)<14);if(row!=null){const inside=cells.find(c=>Math.abs(c.y-row)<2&&s.ax>c.x+1.5&&s.ax<c.r-1.5);if(inside)issues.push(['mast-in-cell',s.id,core.signals[s.id]?.kind,Math.round(s.ax),inside.code]);}}
 // 4) switches
 const conns=[...svg.matchAll(/data-switch-connection="([^"]+)" data-switch-form="([^"]+)" data-switch-endpoints="([^"]+)"/g)].map(m=>({id:m[1],form:m[2],ends:m[3].split(';').map(p=>p.split(',').map(Number))}));
 const linkIds=def.links.map(l=>l[0]),pts=Object.keys(core.initial().points);
 for(const l of linkIds)if(!conns.some(c=>c.id===l))issues.push(['switch-not-drawn',l]);
 for(const l of linkIds)if(!pts.includes(l))issues.push(['link-without-point',l]);
 const railYs=[...new Set([...svg.matchAll(/<path d="M([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)/g)].filter(m=>Math.abs(+m[2]-+m[4])<.5).map(m=>+(+m[2]).toFixed(1)))];
 for(const c of conns)for(const [x,y] of c.ends)if(!railYs.some(r=>Math.abs(r-y)<1.5)&&!rows.some(r=>Math.abs(r-y)<1.5))issues.push(['switch-end-off-rail',c.id,Math.round(x),Math.round(y)]);
 // point tags & part labels
 const tags=[...svg.matchAll(/<g class="point-tag[^"]*"([^>]*)>/g)].map(m=>{const a=attrs(m[1]);return [a['data-point-control'],a['data-point-group']||a['data-point-control']];});
 for(const p of pts)if(!tags.some(t=>t[1]===p||t[0]===p))issues.push(['point-tag-missing',p]);
 const shown=new Set(tags.map(t=>t[0]));for(const q of core.pointPartLabels||[])if(!shown.has(q.part))issues.push(["part-label-missing",q.group,q.part]);
 // 5) windows
 const wins=[...svg.matchAll(/data-train-slot="([^"]*)" data-window-code="([^"]*)" data-window-side="([^"]*)"[^>]*><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)"/g)].map(m=>({code:m[2],side:m[3],x:+m[4],w:+m[6]}));
 for(const w of (TW.data[id]||[]).filter(w=>!xm||w.slide===xm.slide)){const r=wins.find(q=>q.code===w.code&&q.side===w.side);if(!r){issues.push(['window-missing',w.code,w.side]);continue;}
  if(xm&&w.sourceWindow&&w.slide===xm.slide){const e0=w.sourceWindow[0]*k,e1=(w.sourceWindow[0]+w.sourceWindow[2])*k;if(Math.abs(r.x-e0)>6||Math.abs(r.x+r.w-e1)>6)issues.push(['window-off',w.code,w.side,Math.round(e0)+'-'+Math.round(e1),Math.round(r.x)+'-'+Math.round(r.x+r.w)]);}}
 out[id]={cells:cells.length,signals:sigs.length,switches:conns.length,windows:wins.length,issues};
}
 return out;
}
// 원본 대조로 확인한 예외 (원본도 그렇게 그려져 있다)
const KNOWN={
 dongmyo:[['cell-off','21BT'],['cell-off','21AT']],   // 원본 21BT·21AT 끝 478, 22BT와 틈 4px: 공통 틈 7px로 그려 −6
 noryangjin:[['cell-nogap'],['cell-off','1T · 51AT'],['cell-off','3T · 52AT'],['cell-off','4T · 52BT']],   // 승강장 칸과 nT는 한 회로, 원본 전사의 합친 칸을 나눠 그림
 yeongdeungpo:[['cell-nogap'],['mast-in-cell','3B'],['mast-in-cell','24']],   // 칸은 붙고 원본 틈(680–685)은 gaps로 그린다
 geumjeong:[['cell-nogap'],['mast-in-cell','3A']],   // 같은 방식 (원본 틈 685–690)
 guro:[['mast-in-cell','4A'],['mast-in-cell','54'],['mast-in-cell','53']],   // 원본에서도 기둥이 칸 안
};
const unexpected=out=>Object.fromEntries(Object.entries(out).map(([id,v])=>[id,v.issues.filter(i=>!(KNOWN[id]||[]).some(k=>k.every((x,j)=>i[j]===x)))]).filter(([,v])=>v.length));
module.exports={audit,unexpected,KNOWN};
if(require.main===module){const out=audit(),only=process.argv[2];
 for(const [id,v] of Object.entries(out)){console.log(`## ${id}  cells ${v.cells} signals ${v.signals} switches ${v.switches} windows ${v.windows}  issues ${v.issues.length}`);if(!only||only===id)for(const i of v.issues)console.log('  ',JSON.stringify(i),(KNOWN[id]||[]).some(k=>k.every((x,j)=>i[j]===x))?'(원본 확인)':'');}
 const u=unexpected(out);console.log(Object.keys(u).length?'UNEXPECTED '+JSON.stringify(u):'OK: 예상 밖 문제 없음');process.exitCode=Object.keys(u).length?1:0;}
