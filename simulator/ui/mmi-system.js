(function(root){
'use strict';
// 시스템상태조회 (실기1 4장 6절 가, p.71-76): 사령설비상태조회(서버상태정보 · 주무/신호 관제사 콘솔 · 선관제사 콘솔),
// LDTS상태(선별 1계·2계 상태와 수동 계절체), 터미널서버 상태(역별 포트 상태). 화면 배치는 원본을 확인하지 못한 교육용 구성이다.
// LDTS·터미널서버 포트는 「설비 장애 설정(교육용)」의 DTS1·DTS2·EIS1·EIS2·RC·UPS 장애와 엔진의 운용계를 그대로 보여 준다.
// 서버·콘솔 장애는 모의하지 않는다 (항상 정상, [재송신]은 수신 시각만 갱신).
const doc=SimDOM.document,$=id=>doc.getElementById(id),N=root.SimNetwork;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmi=()=>root.SimMMI,E=()=>root.SimEquipment;
const stations=()=>N.stations.filter(s=>s.controlled);
const name=id=>mmi().stationInfo(id).name,code=id=>mmi().stationInfo(id).code;
const stamp=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
const STATE={ACTIVE:'운용',STANDBY:'대기',FAIL:'장애'};
const NOTE='교육용 구성 — 메뉴 경로와 기능은 교재(실기1 4장 6절)를 따르며 화면 배치는 원본을 확인하지 못했습니다.';
const table=(id,cols)=>`<div class="idm-table rpt-table"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody id="${id}"></tbody></table></div>`;
const rows=(list,cols)=>list.length?list.map(r=>`<tr${r.attr||''}>${r.cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr class="empty"><td colspan="${cols}">표시할 정보가 없습니다</td></tr>`;

// ---- 사령설비상태조회: 세 탭
const SERVERS=[['수도권 CTC 서버','1계 운용 · 2계 대기'],['스케줄 관리 서버','1계 운용 · 2계 대기'],['통신 서버','1계 운용 · 2계 대기'],['수도권 Regulation 서버 (경합검지)','1계 운용 · 2계 대기'],['GIS 서버','운용']];
const CONSOLES=[['주무관제사 콘솔','MMI-1 (이 PC)','사용 중'],['신호관제사 콘솔','MMI-2','대기']];
const LINE_CONSOLES=[['선관제사 콘솔 1','경부선 (지하청량리~영등포)'],['선관제사 콘솔 2','경부선 (구로~수원)']];
function initServer(){
 let tab='server',at=stamp();
 const draw=()=>{
  for(const b of doc.querySelectorAll('[data-sys-tab]'))b.classList.toggle('on',b.dataset.sysTab===tab);
  const head=tab==='server'?['서버','이중계 상태','상태','수신시각']:tab==='console'?['콘솔','단말','사용','상태','수신시각']:['콘솔','관할 제어영역','상태','수신시각'];
  const list=tab==='server'?SERVERS.map(([n,d])=>({cells:[esc(n),esc(d),'<b class="sys-ok">정상</b>',at]})):tab==='console'?CONSOLES.map(([n,t,u])=>({cells:[esc(n),esc(t),esc(u),'<b class="sys-ok">정상</b>',at]})):LINE_CONSOLES.map(([n,a])=>({cells:[esc(n),esc(a),'<b class="sys-ok">정상</b>',at]}));
  $('sysServerHead').innerHTML=`<tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr>`;$('sysServerBody').innerHTML=rows(list,head.length);
 };
 const w=mmi().createWindow('serverStatus',{title:'사령설비상태조회',x:120,y:70,width:760,body:`<div class="rpt"><div class="sys-tabs" role="tablist"><button type="button" class="sched-btn" data-sys-tab="server">서버상태정보</button><button type="button" class="sched-btn" data-sys-tab="console">콘솔상태정보 (주무/신호)</button><button type="button" class="sched-btn" data-sys-tab="line">콘솔상태정보 (선관제사)</button></div>
<div class="idm-table rpt-table"><table><thead id="sysServerHead"></thead><tbody id="sysServerBody"></tbody></table></div><div class="idm-note">${NOTE} 서버·콘솔 장애는 모의하지 않습니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn primary" id="sysServerResend">재송신</button><button type="button" class="sched-btn" id="sysServerClose">닫기</button></div></div>`});
 for(const b of doc.querySelectorAll('[data-sys-tab]'))b.onclick=()=>{tab=b.dataset.sysTab;draw();};
 $('sysServerResend').onclick=()=>{at=stamp();draw();mmi().log('event','사령설비 상태정보 재송신 요청');};
 $('sysServerClose').onclick=()=>mmi().close('serverStatus');
 w.opener=()=>{at=stamp();draw();};draw();
}

// ---- LDTS상태: 1계·2계 버튼을 눌러 수동 계절체
function initLdts(){
 const draw=()=>{
  $('ldtsBody').innerHTML=rows(stations().map(s=>{const L=E().ldts(s.id),act=L.find(x=>x.state==='ACTIVE'),bad=L.every(x=>x.state==='FAIL');
   return {cells:[esc(name(s.id)),esc(code(s.id)),...L.map(x=>`<button type="button" class="ldts-side ${x.state.toLowerCase()}" data-ldts="${s.id}" data-side="${x.side}" title="${x.side}계 ${STATE[x.state]}${x.state==='ACTIVE'?'':' · 눌러서 계절체'}">${x.side}계 ${x.state}</button>`),
    act?`${act.side}계`:`${E().sideOf(s.id)}계 (장애)`,bad?'<b class="sys-bad">통신 두절</b>':L.some(x=>x.state==='FAIL')?'<b class="sys-warn">한 계 장애</b>':'정상']};}),6);
 };
 const w=mmi().createWindow('ldtsStatus',{title:'LDTS 상태보기',x:140,y:80,width:760,body:`<div class="rpt"><fieldset class="rpt-cond"><legend>선 선택</legend><label>선<select aria-label="선"><option>경부선</option></select></label><span class="sys-legend"><i class="ldts-side active">ACTIVE</i>운용 <i class="ldts-side standby">STANDBY</i>대기 <i class="ldts-side fail">FAIL</i>장애</span></fieldset>
${table('ldtsBody',['역명','역코드','LDTS 1계','LDTS 2계','운용계','상태'])}<div class="idm-note">대기(STANDBY)계나 장애(FAIL)난 운용계를 누르면 확인 후 수동 계절체합니다. 계절체는 장비계절체 수동조작 이력에 남습니다. 장애는 「설비 장애 설정(교육용)」의 DTS1·DTS2로 만듭니다.</div>
<div class="idm-buttons"><button type="button" class="sched-btn" id="ldtsClose">닫기</button></div></div>`});
 $('ldtsBody').onclick=e=>{const b=e.target.closest('[data-ldts]');if(!b)return;const st=b.dataset.ldts,side=+b.dataset.side,now=E().sideOf(st),to=side===now?3-now:side;
  if(side===now&&b.classList.contains('active')){mmi().alertBox(`${name(st)}역 LDTS ${now}계는 정상 운용 중입니다. 절체하려면 대기계를 선택하세요.`);return;}
  mmi().confirmBox(`${name(st)}역 LDTS를 ${now}계에서 ${to}계로 계절체하시겠습니까?`,()=>{const r=E().switchover(st,side);
   if(!r.ok){mmi().alertBox(r.message,null,{icon:'error'});draw();return;}
   mmi().record('equip',{station:name(st),device:'LDTS',text:`${r.from}계 → ${r.to}계 수동 계절체`,console:'MMI-1'});draw();});};
 $('ldtsClose').onclick=()=>mmi().close('ldtsStatus');
 w.opener=draw;draw();
 setInterval(()=>{if(!w.el.hidden)draw();},1000);      // LDTS 상태가 바뀌면 자동 갱신 (교재)
}

// ---- 터미널서버 상태: 역별 터미널서버와 포트
const PORTS=[['1','LDTS 1계','DTS1'],['2','LDTS 2계','DTS2'],['3','전자연동장치 1계','EIS1'],['4','전자연동장치 2계','EIS2'],['5','건널목 상태표 장치','RC'],['6','무정전 전원공급장치','UPS'],['7','예비',''],['8','예비','']];
function initTerminal(){
 let picked='';
 const portBad=(st,dev)=>dev&&E().isFault(st,dev);
 const draw=()=>{
  $('tsBody').innerHTML=rows(stations().map(s=>{const bad=PORTS.filter(p=>portBad(s.id,p[2])).length;return {attr:` data-ts="${s.id}" class="${picked===s.id?'sel':''}"`,cells:[`TS-${esc(code(s.id))}`,esc(name(s.id)),bad?`<b class="sys-bad">포트 이상 ${bad}</b>`:'<b class="sys-ok">정상</b>']};}),3);
  $('tsPortCap').textContent=picked?`${name(picked)}역 터미널서버 포트상태`:'터미널서버를 누르거나 역을 검색하세요';
  $('tsPorts').innerHTML=picked?rows(PORTS.map(([n,d,dev])=>({cells:[n,esc(d),dev?(portBad(picked,dev)?'<b class="sys-bad">이상</b>':'<b class="sys-ok">정상</b>'):'미사용']})),3):rows([],3);
 };
 const w=mmi().createWindow('terminalStatus',{title:'터미널서버 상태보기',x:160,y:90,width:820,body:`<div class="rpt"><fieldset class="rpt-cond"><legend>검색조건</legend><label>역<select id="tsStation">${stations().map(s=>`<option value="${s.id}">${esc(name(s.id))}</option>`).join('')}</select></label><button type="button" class="sched-btn" id="tsFind">검색</button></fieldset>
<div class="sys-two"><div><div class="idm-cap">터미널서버 목록</div>${table('tsBody',['터미널서버','역','상태'])}</div><div><div class="idm-cap" id="tsPortCap"></div>${table('tsPorts',['포트','연결 장치','상태'])}</div></div>
<div class="idm-note">${NOTE} 포트 상태는 설비 장애 설정과 같습니다.</div><div class="idm-buttons"><button type="button" class="sched-btn" id="tsClose">닫기</button></div></div>`});
 $('tsBody').onclick=e=>{const r=e.target.closest('[data-ts]');if(r){picked=r.dataset.ts;$('tsStation').value=picked;draw();}};
 $('tsFind').onclick=()=>{picked=$('tsStation').value;draw();};
 $('tsClose').onclick=()=>mmi().close('terminalStatus');
 w.opener=draw;draw();setInterval(()=>{if(!w.el.hidden)draw();},1000);
}

function init(){initServer();initLdts();initTerminal();}
root.SimMMISystem={init};
})(window);
