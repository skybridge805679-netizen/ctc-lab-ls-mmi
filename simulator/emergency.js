(function(root){
'use strict';
// 비상시 조치 시나리오 (references/scenarios/emergency/*.hwp 9종): 원문 대본(emergency-data.js)의 번호별 단계를 체크리스트로 보여 주고,
// 대본에 적힌 MMI/LS 조작(CCM 전환, 신호기 정지, 진로 설정, 열차번호 수정·이동·삭제, AUTO 전환)을 순서대로 인식한다.
// 열차는 대본의 번호를 그대로 쓰고, 연동역(LS 열번창이 있는 역)에 서 있는 열차만 LS에 놓는다. 비연동역(시청·석수·가산디지털 등)은 대본 구술로만 다룬다.
const isNode=typeof module!=='undefined';
const D=isNode?require('./emergency-data.js'):root.SimEmergencyData;
const N=isNode?require('./network.js'):root.SimNetwork;
const R=isNode?require('./schedule-routes.js'):root.SimScheduleRoutes;
const core=()=>isNode?require('./core.js'):root.SimCore;
const nm=id=>N.catalog[id]?.name||id;

// ---- predicates over ctx = {states, events, ls}
const rowOf=(ctx,number)=>{for(const [station,st] of Object.entries(ctx.ls?.stations||{}))for(const [slot,rows] of Object.entries(st.windows))if(rows.some(r=>r.number===number))return {station,slot};return null;};
const modeAt=(st,value)=>ctx=>ctx.events.some(e=>e.ok&&e.type==='mode'&&e.station===st&&e.value===value)&&ctx.states[st].mode===value;
const stopAt=(st,sigs)=>ctx=>sigs.every(s=>ctx.states[st].signals[s]==='STOP'&&!Object.keys(ctx.states[st].routes).some(r=>r.startsWith(s+'-')));
const routeAt=(st,id)=>ctx=>!!ctx.states[st].routes[id];
const renamed=(from,to)=>ctx=>!!rowOf(ctx,to)&&!rowOf(ctx,from);
const deleted=n=>ctx=>!rowOf(ctx,n);
const movedTo=(n,station,slot)=>ctx=>{const r=rowOf(ctx,n);return !!r&&r.station===station&&(!slot||r.slot===slot);};

// ---- step builders
const mode=(st,v)=>({act:{type:'mode',station:st,value:v},text:`${nm(st)}역 ${v} 전환`,check:modeAt(st,v),hint:v==='CCM'?'MMI 현장설비제어 → 역제어모드 설정, 또는 LS 상단 CCM':'역제어모드 AUTO (CCM에서만 전환 가능)'});
const stop=(st,sigs,extra='')=>({act:{type:'stop',station:st,ids:sigs},text:`${nm(st)}역 ${sigs.join('·')} 정지${extra}`,check:stopAt(st,sigs),hint:'LS에서 신호기를 눌러 정지 확인창 [예] (접근 열차가 있으면 접근쇄정 후 해정)'});
const route=(st,id,label='진행')=>({act:{type:'route',station:st,id},text:`${nm(st)}역 ${id} ${label}`,check:routeAt(st,id),hint:'CCM → 신호기 → 진로 선택'});
const rename=(from,to,st,tag)=>({tag,act:{type:'rename',station:st,from,to},text:`${nm(st)}역 열차번호 ${from} → ${to} 수정 (지적확인환호)`,check:renamed(from,to),hint:'LS 열번창 우클릭 → 열차번호 수정'});
const move=(n,st,slot,label)=>({act:{type:'move',number:n,station:st,slot},text:label||`열차번호 ${n} → ${nm(st)}역${slot?' '+slot:''} 열번창으로 이동`,check:movedTo(n,st,slot),hint:'LS 열번창 우클릭 → 열차번호 이동 (반대선 운행은 자동 이동되지 않아 수동 이동)'});
const del=(n,st)=>({act:{type:'delete',station:st,number:n},text:`${nm(st)}역 열차번호 ${n} 삭제 (지적확인환호)`,check:deleted(n),hint:'LS 열번창 우클릭 → 열차번호 삭제'});

// ---- per scenario overlay
// before[n]: operations shown just before spoken step n (do-steps are recognised in list order);
// cast: [number, station] trains standing on an LS 열번창 at start (platform track of its direction); seeds: signals that show a proceed
// aspect at start so that the stop can really be done; autos[tag]: automatic LS changes when a spoken step is ticked (tag "n<no>") or an operation is done
const SUB={'01': '단선지령식', '02': '회송·구원연결·단선지령식', '03': '구원·운행선 변경·회송', '04': '운행선 변경·회송', '05': '구원·운행선 변경', '05-1': '운행선 변경·정상복구', '06': '구원연결', '06-1': '역간정차', '06-2': '자력회송'};
const OVERLAY={
 '01':{station:'jonggak',stations:['jonggak','underground-seoul'],
  cast:[['K1137','jonggak'],['K1008','underground-seoul']],
  seeds:{jonggak:['4A','2A'],'underground-seoul':['3A','1A']},
  before:{
   13:[mode('jonggak','CCM'),stop('jonggak',['4A','2A']),mode('underground-seoul','CCM'),stop('underground-seoul',['3A','1A'])],
   15:[route('jonggak','53-B045T','입환표지 진로설정'),route('underground-seoul','21-1T','입환표지 진로설정')],
   16:[move('K1137','underground-seoul',null,'K1137 열차번호 종각역 → 지하서울역 이동 (반대선 운행이라 수동 이동)')],
   21:[mode('jonggak','AUTO'),mode('underground-seoul','AUTO')]}},
 '02':{station:'dongmyo',stations:['dongmyo','jonggak'],
  cast:[['K0602','dongmyo']],
  seeds:{dongmyo:['3A','1B','4A'],jonggak:['2A','1A','4A']},
  autos:{
   n1:[{op:'insert',number:'K0604',station:'dongmyo',dir:'up'}],                       // K0604 충돌 → 같은 열번창에 두 번호 (열차번호 중복 알람)
   g0602:[{op:'delete',number:'G0602'},{op:'insert',number:'K0606',station:'dongmyo',slot:'B017T',dir:'up'}],   // 회송 출발, 구원열차 도착
   g0604:[{op:'delete',number:'G0604'}]},
  before:{
   16:[rename('K0602','G0602','dongmyo','g0602')],
   20:[mode('dongmyo','CCM'),stop('dongmyo',['3A','1B','4A']),mode('jonggak','CCM'),stop('jonggak',['2A','1A','4A']),route('jonggak','51-1T','입환표지 진로설정'),route('dongmyo','24-B015T','입환표지 진로설정')],
   22:[rename('K0606','G0606','dongmyo')],
   24:[move('G0606','dongmyo','2T','G0606 열차번호를 K0604가 있는 열번창으로 이동 (구원연결 → 열차번호 중복 알람 확인)'),del('G0606','dongmyo')],
   25:[rename('K0604','G0604','dongmyo','g0604')],
   26:[mode('dongmyo','AUTO'),mode('jonggak','AUTO')]},
  },
 '03':{station:'anyang',stations:['anyang','geumcheon'],
  cast:[['K0456','anyang'],['A1002','anyang','4T'],['K0401','geumcheon'],['A1001','geumcheon','1T']],
  seeds:{anyang:['3B','3C','2B'],geumcheon:['2A']},
  before:{
   17:[mode('anyang','CCM'),stop('anyang',['3B','3C','2B']),mode('geumcheon','CCM'),stop('geumcheon',['2A']),route('geumcheon','2B-5T','장내 진행'),mode('geumcheon','AUTO'),route('anyang','3B-B655T','출발 진행'),mode('anyang','AUTO')]}},
 '04':{station:'anyang',stations:['anyang','gunpo','geumjeong'],
  cast:[['K0809','geumjeong'],['K0811','anyang'],['K1114','gunpo']],
  seeds:{anyang:['4B','4C','1B'],gunpo:['1A','1B']},
  before:{
   11:[mode('anyang','CCM'),stop('anyang',['4B','4C','1B']),mode('gunpo','CCM'),stop('gunpo',['1A','1B']),route('anyang','4C-B660T','출발 진행 (교재 표기 4B-B660T — 이 시뮬레이터의 안양역 진로는 4C-B660T)'),mode('anyang','AUTO'),route('gunpo','1B-1T','장내 진행'),mode('gunpo','AUTO')],
   17:[rename('K0809','G0809','geumjeong')]}},
 '05':{station:'geumcheon',stations:['geumcheon','guro'],
  cast:[['K1212','geumcheon'],['A0168','guro']],
  seeds:{geumcheon:['3B','3C','2B'],guro:['2A','2B','3A']},
  before:{
   8:[mode('geumcheon','CCM'),stop('geumcheon',['3B','3C','2B']),mode('guro','CCM'),stop('guro',['2A','2B','3A']),route('geumcheon','3B-B639T','출발 진행'),mode('geumcheon','AUTO'),route('guro','2B-5T','장내 진행'),mode('guro','AUTO')]}},
 '05-1':{station:'geumcheon',stations:['geumcheon','guro'],
  cast:[['K1210','geumcheon']],
  seeds:{geumcheon:['3B'],guro:['2A','3A']},
  before:{
   8:[mode('geumcheon','CCM'),stop('geumcheon',['3B']),mode('geumcheon','AUTO'),mode('guro','CCM'),stop('guro',['2A','3A']),mode('guro','AUTO')]}},
 '06':{station:'anyang',stations:['anyang','geumcheon'],
  cast:[['K0456','anyang'],['A1004','anyang','4T'],['K0401','geumcheon'],['A1001','geumcheon','1T']],
  seeds:{anyang:['3B','3C','2B'],geumcheon:['2A','2B']},
  before:{
   14:[mode('anyang','CCM'),stop('anyang',['3B','3C','2B']),mode('geumcheon','CCM'),stop('geumcheon',['2A','2B']),route('geumcheon','2B-5T','장내 진행 (A1004 금천구청역 통과 확인 후)'),mode('geumcheon','AUTO'),route('anyang','3B-B655T','출발 진행'),mode('anyang','AUTO')]}},
 '06-1':{station:'anyang',stations:['anyang','geumcheon'],
  cast:[['K0456','anyang'],['A1004','anyang','4T'],['K0401','geumcheon'],['A1001','geumcheon','1T']],
  seeds:{anyang:['3B','3C','2B'],geumcheon:['2A','2B']},
  before:{
   14:[mode('anyang','CCM'),stop('anyang',['3B','3C','2B']),mode('geumcheon','CCM'),stop('geumcheon',['2A','2B']),route('geumcheon','2B-5T','장내 진행 (A1004 금천구청역 통과 확인 후)'),mode('geumcheon','AUTO'),route('anyang','3B-B655T','출발 진행'),mode('anyang','AUTO')]}},
 '06-2':{station:'anyang',stations:['anyang','geumcheon'],
  cast:[['K0456','anyang'],['A1004','anyang','4T'],['K0401','geumcheon'],['A1001','geumcheon','1T']],
  seeds:{anyang:['3B'],geumcheon:['2A']},
  before:{
   11:[mode('anyang','CCM'),stop('anyang',['3B']),mode('geumcheon','CCM'),stop('geumcheon',['2A']),route('geumcheon','2B-5T','장내 진행'),mode('geumcheon','AUTO'),route('anyang','3B-B655T','출발 진행'),mode('anyang','AUTO')]}}
};
// where in the script each operation block belongs can only be checked against the original text; see simulator/emergency.test.cjs for the structural checks
const direction=number=>(+String(number).slice(-1))%2?'down':'up';       // 홀수 = 하행, 짝수 = 상행 (대본의 번호 체계)
const platform=(st,dir)=>{const a=R.routesFor(st,dir,false,false).arrivalRoute||'';return a.split('_')[1]||null;};
// automatic LS changes: run when the step carrying the tag is done (spoken steps are tagged n<no>); `dispatch` is the LS operation function
function applyAutos(sc,run,dispatch,model){
 const out=[];
 sc.steps.forEach((st,i)=>{
  if(!st.tag||!run.done[i]||run.fired.has(st.tag))return;run.fired.add(st.tag);
  for(const a of sc.autos[st.tag]||[]){
   const f=(()=>{for(const [station,x] of Object.entries(model().stations))for(const [slot,rows] of Object.entries(x.windows))for(const r of rows)if(r.number===a.number)return {station,slot,uid:r.uid};return null;})();
   if(a.op==='insert'){if(!f)out.push(dispatch({op:'insert',station:a.station,slot:a.slot||platform(a.station,a.dir),number:a.number,direction:a.dir}));}
   else if(f&&a.op==='delete')out.push(dispatch({op:'delete',...f}));
   else if(f&&a.op==='move')out.push(dispatch({op:'move',...f,targetStation:a.station,targetSlot:a.slot}));
  }
 });
 return out;
}
const clean=s=>String(s).replace(/\s+$/,'');

function build(key){
 const d=D.scenarios[key],o=OVERLAY[key];if(!d||!o)return null;
 const steps=[],tags=new Set();
 for(const st of d.steps){
  for(const op of (o.before[st.no]||[]))steps.push({kind:'do',...op});
  steps.push({kind:'say',tag:'n'+st.no,no:st.no,heading:st.title,lines:st.body.map(clean),text:st.title+' '+st.body.join(' ')});
 }
 const header=d.header.filter(l=>!/^\d+(-\d)?\.\s/.test(l)),at=header.findIndex(l=>/관계열차/.test(l)),strip=l=>l.replace(/^[❒❍]\s*/,'').replace(/\s{2,}/g,' ').trim();
 const problem=header.slice(0,at<0?header.length:at).map(strip).filter(Boolean).join(' · ');
 const trains=(at<0?[]:header.slice(at)).map(strip).filter(Boolean);
 return {id:'em-'+key,group:'emergency',key,title:key+' '+d.title.replace(/^\d+(-\d)?\.\s*/,'').replace(/\s*\(.*$/,'')+' · '+(/\(([^,)]+)[,)]/.exec(d.title)?.[1]||'').trim()+' ('+SUB[key]+')',
  source:d.source,station:o.station,stations:o.stations,problem,trains,steps,cast:o.cast,seeds:o.seeds,autos:o.autos||{},notes:header.filter(l=>/^※/.test(l)).map(strip)};
}
const list=Object.keys(OVERLAY).map(build).filter(Boolean);

// ---- engine pieces used by the scenario window
function seed(sc,states){
 const c0=core();
 for(const st of sc.stations){const c=c0.forStation(st);for(const k of Object.keys(states[st]))delete states[st][k];Object.assign(states[st],c.initial());}
 for(const [st,sigs] of Object.entries(sc.seeds)){
  const c=c0.forStation(st),s=states[st];c.dispatch(s,{type:'mode',value:'CCM',source:'SCENARIO'});
  for(const sig of sigs){const id=Object.keys(c.routes).filter(r=>c.routes[r].signal===sig&&!/^B/.test(c.routes[r].destination)).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}))[0]||Object.keys(c.routes).find(r=>c.routes[r].signal===sig);
   if(id)c.dispatch(s,{type:'route',id,source:'SCENARIO'});}      // a route that cannot be set (conflict) just stays stopped
  c.dispatch(s,{type:'mode',value:'AUTO',source:'SCENARIO'});
 }
}
const castFor=sc=>sc.cast.map(([number,station,slot])=>({number,station,dir:direction(number),slot:slot||platform(station,direction(number))}));
// every number a scenario may put on the LS (cast, automatic changes, operator renames) so a restart can clear them
function numbersOf(sc){
 const set=new Set(sc.cast.map(c=>c[0]));
 for(const list of Object.values(sc.autos))for(const a of list)set.add(a.number);
 for(const st of sc.steps)if(st.act)for(const k of ['from','to','number'])if(st.act[k])set.add(st.act[k]);
 return [...set];
}
const api={numbersOf,list,seed,castFor,applyAutos,direction,platform,OVERLAY,variants:D.variants};
if(isNode)module.exports=api;else root.SimEmergency=api;
})(typeof window!=='undefined'?window:globalThis);
