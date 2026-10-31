(function(root){
'use strict';
// FTS 제어통제 시스템 window, laid out after the photos (2026-10-30): left menu 교육설정 · 시스템관리 · 사용자관리 ·
// 시나리오관리(문제 관리 · 상황 관리 · 시나리오 관리) · 모니터링관리 · 교육이력관리, and the 교육생 "문제 발생" screen.
// The library (문제·상황·시나리오·열차 스케줄) is JSON kept on this computer; it can be exported and an edited or AI-made file imported.
const doc=SimDOM.document,$=id=>doc.getElementById(id),F=()=>root.SimFTS,M=()=>root.SimMMI,D=()=>root.SimDiagram,T=()=>root.SimTimetable,N=()=>root.SimNetwork;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY={lib:'orpheia.fts.library.v1',users:'orpheia.fts.users.v1',history:'orpheia.fts.history.v1'};
const load=(k,fallback)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??fallback();}catch{return fallback();}};
const save=(k,v)=>{if(root.SimRemote&&host){if(k===KEY.users)remote({op:'users',users:v});if(k===KEY.history&&v.length===0)remote({op:'clearHistory'});}try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
const stamp=()=>new Date().toLocaleString('sv-SE',{timeZone:'Asia/Seoul'});
const nm=id=>M()?.stationInfo(id)?.name||N().catalog[id]?.name||id;
const clockText=s=>{s=Math.max(0,Math.round(s||0));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':');};
// FTS is the instructor's own program, not an MMI window: it lives in #ftsPanel (an independent window like the T/G, or
// inline in the LS page when pop-ups are blocked). Its message boxes open in the FTS document.
const panel=()=>$('ftsPanel'),ftsDoc=()=>panel()?.ownerDocument||document,ftsOpen=()=>!!panel()&&!panel().hidden;
const alert=t=>M().alertBox(t,null,{document:ftsDoc()});
const confirmBox=(t,yes)=>M().confirmBox(t,yes,{document:ftsDoc()});
let host=null,lib=null,users=null,history=null,session=null,events=[],page='setup',timer=null,localRunLibrary=null,remoteRevision=-1,lastNotice=0,monitorSignature='',problemSignature='';
const scriptIds=()=>[...(root.SimScenarios?.list||[]),...(root.SimEmergency?.list||[]),...(root.SimScheduleScenarios?.list||[])].map(s=>s.id);
const scriptTitle=id=>[...(root.SimScenarios?.list||[]),...(root.SimEmergency?.list||[]),...(root.SimScheduleScenarios?.list||[])].find(s=>s.id===id)?.title||id;
function defaults(){
 const limits=Object.fromEntries(scriptIds().map(id=>[id,root.SimAssessment?.limitsFor(id)?.[0]]).filter(([,v])=>v));
 return {...F().seed({scripts:scriptIds(),limits}),schedules:[]};
}
function persist(){if(root.SimRemote){const r=remote({op:'library',library:lib});if(!r.ok){lib=structuredClone(root.SimRemote.snapshot.ftsLibrary);alert(r.message);return false;}}save(KEY.lib,lib);return true;}
const activeLibrary=()=>root.SimRemote?.snapshot.ftsRunLibrary||localRunLibrary||lib;
function remote(action){const result=root.SimRemote.command({type:'fts',...action});syncRemote();return result;}
function syncRemote(){const value=root.SimRemote?.snapshot.fts;if(!value)return;if(remoteRevision!==value.revision){lib=structuredClone(root.SimRemote.snapshot.ftsLibrary);remoteRevision=value.revision;}session=value.session;users=structuredClone(value.users);history=structuredClone(value.history);}

const SECTIONS=['지하청량리-수원','지하청량리-영등포','지하청량리-지하서울','노량진-금천구청','용산-수원','영등포-수원'];

// ---------------------------------------------------------------- shell
const MENU=[['setup','교육설정'],['system','시스템관리'],['users','사용자관리'],['scenario','시나리오관리',[['problems','문제 관리'],['situations','상황 관리'],['scenarios','시나리오 관리']]],['monitor','모니터링관리'],['history','교육이력관리']];
function shell(){
 return `<div class="fts"><div class="fts-head"><img class="fts-banner" src="assets/orpheia/banner.png" alt="" aria-hidden="true" width="2172" height="724"><div class="fts-brand"><img src="assets/orpheia/emblem.png" alt="" width="38" height="38"><div><small>ORPHEIA · TRAINING CONTROL</small><b>FTS 제어통제 시스템</b></div></div><span class="fts-lamps"><i class="fts-engine" title="${root.SimRemote?'독립 관제 엔진 연결':'브라우저 실습'}">${root.SimRemote?'ENGINE':'LOCAL'}</i>${['CTC','EMC','SIC','DB'].map(x=>`<i class="simulated" title="${x} 모의 · 외부 장치 통신 미연결">${x} · 모의</i>`).join('')}</span></div>
<div class="fts-main"><nav class="fts-nav">${MENU.map(([id,label,sub])=>`<button type="button" data-fts-page="${sub?sub[0][0]:id}" data-fts-group="${id}">▸ ${label}</button>${sub?`<div class="fts-sub">${sub.map(([s,l])=>`<button type="button" data-fts-page="${s}">— ${l}</button>`).join('')}</div>`:''}`).join('')}</nav>
<section class="fts-workspace"><div class="fts-workspace-head"><div><small>INSTRUCTOR WORKSPACE</small><h2 id="ftsPageTitle">교육설정</h2></div><span id="ftsSessionStatus">교육 전 준비</span></div><div class="fts-body" id="ftsBody"></div></section></div></div>`;
}
function go(p){
 page=p;monitorSignature='';problemSignature='';if($('ftsPageTitle'))$('ftsPageTitle').textContent={setup:'교육설정',system:'시스템관리',users:'사용자관리',problems:'문제 관리',situations:'상황 관리',scenarios:'시나리오 관리',monitor:'모니터링관리',history:'교육이력관리'}[p];for(const b of doc.querySelectorAll('[data-fts-page]'))b.classList.toggle('on',b.dataset.ftsPage===p);
 $('ftsBody').innerHTML=PAGES[p].html();PAGES[p].bind?.();
}

// ---------------------------------------------------------------- shared bits
const table=(id,head,rows,{selected=null,key=r=>r.id,empty='자료가 없습니다.'}={})=>`<div class="fts-table" id="${id}"><table><thead><tr><th>No</th>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr data-key="${esc(key(r))}" tabindex="0" aria-selected="${selected!==null&&key(r)===selected}" class="${selected!==null&&key(r)===selected?'sel':''}"><td>${i+1}</td>${r.cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr class="empty"><td colspan="${head.length+1}">${empty}</td></tr>`}</tbody></table></div>`;
const pick=(id,fn)=>{const el=$(id);if(el)el.onclick=e=>{const tr=e.target.closest('tr[data-key]');if(tr)fn(tr.dataset.key,e);};el.onkeydown=e=>{const tr=e.target.closest('tr[data-key]');if(tr&&['Enter',' '].includes(e.key)){e.preventDefault();fn(tr.dataset.key,e);}};};
const opts=(list,value)=>list.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`;}).join('');
const stationOpts=v=>opts(N().stations.map(s=>[s.id,nm(s.id)]),v);
const yn=b=>b?'Y':'N';

// condition / phenomenon editor rows: a type and its fields; stations are picked from a list
const FIELD_LABEL={station:'역',value:'값',route:'진로',signal:'신호기',point:'전환기',number:'열차번호',slot:'열번창',train:'열차',from:'시작역',to:'마지막역',start:'시각',field:'항목',window:'창',eventType:'조작',seconds:'초',label:'내용',direction:'방향',minutes:'분',text:'문구',id:'대상',kind:'열차종류'};
function fieldInput(prefix,f,v){
 const id=`${prefix}-${f}`;
 if(['station','from','to'].includes(f))return `<label>${FIELD_LABEL[f]}<select id="${id}"><option value=""></option>${stationOpts(v)}</select></label>`;
 if(f==='value')return `<label>${FIELD_LABEL[f]}<input id="${id}" value="${esc(v??'')}" placeholder="CCM / N·R / 600 / true"></label>`;
 if(f==='field')return `<label>${FIELD_LABEL[f]}<select id="${id}">${opts([['dwell','정차시분(초)'],['arrival','도착시각'],['departure','출발시각'],['arrivalRoute','도착진로'],['departureRoute','출발진로'],['cancelled','운휴']],v)}</select></label>`;
 if(f==='kind')return `<label>열차종류<select id="${id}">${opts(T().KINDS||['전동열차','일반열차','회송열차','KTX'],v||'전동열차')}</select></label>`;
 if(f==='direction')return `<label>${FIELD_LABEL[f]}<select id="${id}">${opts([['up','상행'],['down','하행']],v)}</select></label>`;
 return `<label>${FIELD_LABEL[f]||f}<input id="${id}" value="${esc(v??'')}"></label>`;
}
const typed=v=>v==='true'?true:v==='false'?false:/^-?\d+(\.\d+)?$/.test(v)?Number(v):v;
function readFields(prefix,kind,type){const d=(kind==='cond'?F().CONDITIONS:F().PHENOMENA)[type],out={type};for(const f of d.fields.concat(kind==='phen'&&type==='createTrain'?['kind']:[]).concat(kind==='cond'&&['trainAt'].includes(type)?['slot']:[]).concat(kind==='cond'&&type==='trainExists'?['from','to','start']:[])){const el=$(`${prefix}-${f}`);if(el&&el.value!=='')out[f]=['value','seconds','minutes'].includes(f)?typed(el.value):el.value;}if(kind==='cond'&&type==='cancelled'&&$(`${prefix}-value`)?.value==='false')out.value=false;return out;}
function editorFields(prefix,kind,type,values={}){
 const d=(kind==='cond'?F().CONDITIONS:F().PHENOMENA)[type];if(!d)return '';
 let fs=[...d.fields];if(kind==='phen'&&type==='createTrain')fs.push('kind');if(kind==='cond'&&type==='trainAt')fs.push('slot');if(kind==='cond'&&type==='trainExists')fs.push('from','to','start');if(kind==='cond'&&type==='cancelled')fs.push('value');
 return fs.filter(f=>!['conditions','condition'].includes(f)).map(f=>fieldInput(prefix,f,values[f])).join('');
}

// ---------------------------------------------------------------- 문제 관리
let pSel=null,pDraft=null,pTab='phen';
const blankProblem=()=>({id:'',subject:'열차 운행 계획',name:'',limit:60,score:100,voice:'',situation:'',actions:'',trigger:{useTime:false,at:0,conditions:[]},phenomena:[],checks:[],deductions:[]});
function problemRows(filter){return lib.problems.filter(p=>(!filter.subject||p.subject===filter.subject)&&(!filter.name||p.name.includes(filter.name))).map(p=>({id:p.id,cells:[esc(p.subject),esc(p.name)+(p.script?` <small class="fts-tag">대본 ${esc(p.script)}</small>`:''),p.limit,yn(p.trigger?.useTime),yn(p.trigger?.conditions?.[0]),yn(p.trigger?.conditions?.[1]),yn(p.trigger?.conditions?.[2])]}));}
let pFilter={subject:'',name:''};
const listOf=(p,tab)=>tab==='phen'?p.phenomena:tab==='check'?p.checks:tab==='deduct'?p.deductions:p.trigger.conditions;
function pList(){
 const p=pDraft;const tab=pTab,list=listOf(p,tab);
 const text=x=>tab==='phen'?`${(F().PHENOMENA[x.type]?.label)||x.type} · ${esc(JSON.stringify({...x,type:undefined,after:undefined}).replace(/[{}"]/g,''))}`:esc(F().describe(tab==='trig'?x:x.condition));
 return `<div class="fts-table"><table><thead><tr><th></th><th>No</th><th>${tab==='phen'?'발생(초)':tab==='trig'?'조건':'항목'}</th><th>${tab==='phen'?'현상':'세부조건'}</th>${tab==='check'||tab==='deduct'?'<th>점수</th>':''}</tr></thead><tbody>${list.map((x,i)=>`<tr><td><input type="checkbox" data-del="${i}" aria-label="${i+1}번 선택"></td><td>${i+1}</td><td>${tab==='phen'?Number(x.after)||0:esc(tab==='trig'?(F().CONDITIONS[x.type]?.label||x.type):x.label||'')}</td><td>${text(x)}</td>${tab==='check'||tab==='deduct'?`<td>${x.points??(tab==='check'?1:0)}</td>`:''}</tr>`).join('')||'<tr class="empty"><td colspan="5">등록된 항목이 없습니다.</td></tr>'}</tbody></table></div>`;
}
function pEditor(){
 const p=pDraft,tab=pTab,kind=tab==='phen'?'phen':'cond',types=Object.entries(kind==='phen'?F().PHENOMENA:F().CONDITIONS).filter(([k])=>!['all','any','not'].includes(k));
 return `<div class="fts-tabs">${[['phen','현상 설정'],['check','채점 항목'],['deduct','감점사항'],['trig','발생조건']].map(([k,l])=>`<button type="button" data-ptab="${k}" class="${tab===k?'on':''}">${l}</button>`).join('')}</div>
<div class="fts-edit-row">${tab==='phen'?`<label>문제시작<input id="pfAfter" type="number" min="0" value="0">초 후 발생</label>`:''}${tab==='check'||tab==='deduct'?`<label>항목<input id="pfLabel"></label><label>점수<input id="pfPoints" type="number" min="0" value="${tab==='check'?1:10}"></label>`:''}
<label>[조건]<select id="pfType">${types.map(([k,d])=>`<option value="${k}">${esc(d.label)}</option>`).join('')}</select></label><span id="pfFields" class="fts-fields">${editorFields('pf',kind,types[0][0])}</span><button type="button" class="sched-btn" id="pfAdd">등록</button></div>
${pList()}<div class="fts-row-btns"><button type="button" class="sched-btn" id="pfDel">선택삭제</button></div>`;
}
function problemForm(){
 const p=pDraft;
 return `<div class="fts-form"><div class="fts-cap">• 추가, 수정 및 삭제</div>
<div class="fts-grid2"><label>과목명<select id="pSubject">${opts(F().SUBJECTS,p.subject)}</select></label><label>제한시간<input id="pLimit" type="number" min="1" value="${p.limit}">초</label><label>배점<input id="pScore" type="number" min="0" value="${p.score}"></label><label>대본<select id="pScript"><option value="">(없음 · 채점 항목으로 판정)</option>${opts(scriptIds().map(id=>[id,scriptTitle(id)]),p.script||'')}</select></label></div>
<label class="fts-wide">문제 명칭<textarea id="pName" rows="2">${esc(p.name)}</textarea></label><label class="fts-wide">음성 표출<textarea id="pVoice" rows="1">${esc(p.voice)}</textarea></label>
<label class="fts-wide">상황<textarea id="pSituation" rows="3">${esc(p.situation)}</textarea></label><label class="fts-wide">조치사항<textarea id="pActions" rows="3">${esc(p.actions)}</textarea></label>
<div class="fts-grid2"><label><input type="checkbox" id="pUseTime" ${p.trigger.useTime?'checked':''}>발생시간 사용</label><label>발생시간<input id="pAt" type="number" min="0" value="${p.trigger.at||0}">초 (앞 문제 종료 후)</label></div>
<div id="pTabs">${pEditor()}</div>
<div class="fts-row-btns end"><button type="button" class="sched-btn" id="pVoiceTest">음성테스트</button><button type="button" class="sched-btn" id="pCopy">복사</button><button type="button" class="sched-btn" id="pClear">Clear</button><button type="button" class="sched-btn primary" id="pSave">저 장</button><button type="button" class="sched-btn danger" id="pDelete">삭 제</button></div></div>`;
}
function readProblem(){
 const p=pDraft;Object.assign(p,{subject:$('pSubject').value,limit:Number($('pLimit').value),score:Number($('pScore').value),script:$('pScript').value||undefined,name:$('pName').value.trim(),voice:$('pVoice').value.trim(),situation:$('pSituation').value.trim(),actions:$('pActions').value.trim()});
 p.trigger.useTime=$('pUseTime').checked;p.trigger.at=Number($('pAt').value)||0;if(!p.script)delete p.script;return p;
}
function bindTabs(){
 for(const b of doc.querySelectorAll('[data-ptab]'))b.onclick=()=>{readProblem();pTab=b.dataset.ptab;$('pTabs').innerHTML=pEditor();bindTabs();};
 $('pfType').onchange=()=>{$('pfFields').innerHTML=editorFields('pf',pTab==='phen'?'phen':'cond',$('pfType').value);};
 $('pfAdd').onclick=()=>{
  const kind=pTab==='phen'?'phen':'cond',x=readFields('pf',kind,$('pfType').value),list=listOf(pDraft,pTab);
  const bad=[];if(kind==='cond'){const probe={problems:[{id:'x',subject:F().SUBJECTS[0],name:'x',limit:1,checks:[{condition:x}]}],situations:[],scenarios:[]};bad.push(...F().validate(probe).filter(e=>e.includes('채점')));}
  else{const probe={problems:[{id:'x',subject:F().SUBJECTS[0],name:'x',limit:1,checks:[{condition:{type:'manual',label:'x'}}],phenomena:[x]}],situations:[],scenarios:[]};bad.push(...F().validate(probe).filter(e=>e.includes('현상')));}
  if(bad.length){alert(bad.map(e=>e.replace(/^문제 x /,'')).join('\n'));return;}
  if(pTab==='phen')list.push({after:Number($('pfAfter').value)||0,...x});else if(pTab==='trig')list.push(x);else list.push({label:$('pfLabel').value.trim()||F().describe(x),points:Number($('pfPoints').value)||0,condition:x});
  readProblem();$('pTabs').innerHTML=pEditor();bindTabs();
 };
 $('pfDel').onclick=()=>{const list=listOf(pDraft,pTab),idx=[...doc.querySelectorAll('#pTabs [data-del]:checked')].map(i=>+i.dataset.del).sort((a,b)=>b-a);for(const i of idx)list.splice(i,1);readProblem();$('pTabs').innerHTML=pEditor();bindTabs();};
}
const nextId=(prefix,list)=>{let n=list.length+1;while(list.some(x=>x.id===prefix+String(n).padStart(3,'0')))n++;return prefix+String(n).padStart(3,'0');};
const PAGES={};
PAGES.problems={
 html:()=>`<div class="fts-split"><div class="fts-left"><div class="fts-cap">• 검색</div><div class="fts-grid2"><label>과목<select id="pfSubject"><option value="">전체</option>${opts(F().SUBJECTS,pFilter.subject)}</select></label><label>문제명칭<input id="pfName" value="${esc(pFilter.name)}"></label><button type="button" class="sched-btn" id="pfFind">검 색</button></div>
<div class="fts-cap">• 검색결과</div>${table('pTable',['과목','문제명칭','제한시간','발생시간','발생조건1','발생조건2','발생조건3'],problemRows(pFilter),{selected:pSel})}
<div class="fts-cap">발생조건</div>${table('pTrig',['발생조건 번호','발생조건'],(lib.problems.find(p=>p.id===pSel)?.trigger?.conditions||[]).map((c,i)=>({id:i,cells:[i+1,esc(F().describe(c))]})))}</div>
<div class="fts-right" id="pForm">${problemForm()}</div></div>`,
 bind(){
  $('pfFind').onclick=()=>{pFilter={subject:$('pfSubject').value,name:$('pfName').value.trim()};go('problems');};
  pick('pTable',id=>{pSel=id;pDraft=structuredClone(lib.problems.find(p=>p.id===id));pDraft.trigger??={useTime:false,at:0,conditions:[]};for(const k of ['phenomena','checks','deductions'])pDraft[k]??=[];go('problems');});
  bindTabs();
  $('pVoiceTest').onclick=()=>speak($('pVoice').value||$('pName').value);
  $('pClear').onclick=()=>{pSel=null;pDraft=blankProblem();go('problems');};
  $('pCopy').onclick=()=>{readProblem();pDraft={...structuredClone(pDraft),id:'',name:pDraft.name+' (복사)'};pSel=null;go('problems');};
  $('pSave').onclick=()=>{
   const p=readProblem();if(!p.id)p.id=nextId('P-',lib.problems);
   const probe={problems:[p],situations:[],scenarios:[]},bad=F().validate(probe,{scripts:scriptIds()});if(bad.length){alert(bad.join('\n'));return;}
   confirmBox('문제를 저장하시겠습니까?',()=>{const i=lib.problems.findIndex(x=>x.id===p.id);if(i>=0)lib.problems[i]=structuredClone(p);else lib.problems.push(structuredClone(p));persist();pSel=p.id;go('problems');alert('저장되었습니다.');});
  };
  $('pDelete').onclick=()=>{if(!pSel){alert('삭제할 문제를 선택하세요.');return;}const used=lib.situations.filter(s=>s.problems.includes(pSel));if(used.length){alert(`상황 ${used.map(s=>s.name).join(', ')}에서 쓰고 있어 삭제할 수 없습니다.`);return;}confirmBox('선택한 문제를 삭제하시겠습니까?',()=>{lib.problems=lib.problems.filter(p=>p.id!==pSel);persist();pSel=null;pDraft=blankProblem();go('problems');});};
 }
};

// ---------------------------------------------------------------- 상황 관리 (+ 열차 스케줄 설정)
let sSel=null,sFilter={name:'',section:''},schSel=null,schTrain=null;
const schedules=()=>lib.schedules||(lib.schedules=[]);
function trainRows(sch,dir){return (sch?.timetable?.trains||[]).filter(t=>t.direction===dir).map(t=>({id:t.id,cells:[esc(t.id),esc(nm(t.calls[0].station)),esc(nm(t.calls.at(-1).station)),T().clock(t.calls[0].departure),T().clock(t.calls.at(-1).arrival)]}));}
PAGES.situations={
 html(){
  const s=lib.situations.find(x=>x.id===sSel),sch=schedules().find(x=>x.id===schSel);
  const rows=lib.situations.filter(x=>(!sFilter.name||x.name.includes(sFilter.name))&&(!sFilter.section||x.section===sFilter.section)).map(x=>({id:x.id,cells:[esc(x.name),esc(x.section),esc(x.scheduleId||'')]}));
  return `<div class="fts-three"><div><div class="fts-cap">• 시나리오 상황 관리</div><div class="fts-grid2"><label>상황명칭<input id="sfName" value="${esc(sFilter.name)}"></label><label>구간<select id="sfSection"><option value="">전체</option>${opts(SECTIONS,sFilter.section)}</select></label><button type="button" class="sched-btn" id="sfFind">검 색</button></div>
${table('sTable',['시나리오 상황명칭','구간','스케줄ID'],rows,{selected:sSel})}
<div class="fts-cap">• 추가, 수정 및 삭제</div><div class="fts-grid2"><label>상황명칭<input id="sName" value="${esc(s?.name||'')}"></label><label>구간<select id="sSection">${opts(SECTIONS,s?.section||SECTIONS[0])}</select></label><label>제한시간<input id="sLimit" type="number" min="0" value="${s?.limit||0}">초</label><label>스케줄ID<input id="sSchedule" value="${esc(s?.scheduleId||'')}" maxlength="5"></label></div>
<div class="fts-cap">상황 문제 (순서대로 출제)</div>${table('sProblems',['과목','문제명칭','제한시간'],(s?.problems||[]).map((id,i)=>{const p=lib.problems.find(x=>x.id===id);return {id:String(i),cells:[esc(p?.subject),esc(p?.name||id),p?.limit??'']};}))}
<div class="fts-grid2"><select id="sAddProblem" aria-label="추가할 문제">${opts(lib.problems.map(p=>[p.id,`[${p.subject}] ${p.name}`]))}</select><button type="button" class="sched-btn" id="sAdd">문제 추가</button><button type="button" class="sched-btn" id="sRemove">선택 문제 빼기</button></div>
<div class="fts-row-btns"><button type="button" class="sched-btn" id="sClear">Clear</button><button type="button" class="sched-btn primary" id="sSave">저 장</button><button type="button" class="sched-btn danger" id="sDelete">삭 제</button></div></div>
<div><div class="fts-cap">• 열차 스케줄 설정</div>${table('schTable',['스케줄ID','스케줄명','작성자','작성일자'],schedules().map(x=>({id:x.id,cells:[esc(x.id),esc(x.name),esc(x.author||''),esc(x.createdAt||'')]})),{selected:schSel,empty:'저장된 열차 스케줄이 없습니다. 아래 [생성]으로 지금 온라인 시간표를 저장하세요.'})}
<div class="fts-cap">• 열차스케줄 ID 편집모드</div><div class="fts-grid2"><label><input type="radio" name="schMode" value="edit" checked>수정</label><label><input type="radio" name="schMode" value="create">생성</label></div>
<div class="fts-cap">• 열차스케줄ID 생성 조건</div><div class="fts-grid2"><label>스케줄ID<input id="schId" maxlength="3" placeholder="숫자3자리(사용자입력)"></label><label>구간<select id="schSection">${opts(SECTIONS)}</select></label><label>스케줄명<input id="schName"></label></div>
<div class="fts-row-btns wrap"><button type="button" class="sched-btn" id="schCopy">열차스케줄 ID간 열차 복사</button><button type="button" class="sched-btn danger" id="schDelete">열차스케줄 ID 삭제</button><button type="button" class="sched-btn" id="schApplySit">선택 시나리오 상황에 적용</button><button type="button" class="sched-btn primary" id="schApply">편집 적용</button></div>
<p class="idm-note">편집 적용: 수정 모드는 지금 온라인 시간표(MMI·T/G에서 고친 것)를 선택한 스케줄ID에 저장하고, 생성 모드는 새 스케줄ID로 저장합니다.</p></div>
<div><div class="fts-cap">• 상행 열차 정보</div>${table('schUp',['열차번호','시발역','종착역','시발시간','종착시간'],trainRows(sch,'up'),{selected:schTrain})}
<div class="fts-cap">• 하행 열차 정보</div>${table('schDown',['열차번호','시발역','종착역','시발시간','종착시간'],trainRows(sch,'down'),{selected:schTrain})}
<div class="fts-row-btns"><button type="button" class="sched-btn" id="schEdit">열차스케줄 편집</button><button type="button" class="sched-btn danger" id="schTrainDel">열차스케줄 삭제</button></div><p class="idm-note">열차스케줄 편집: 선택한 스케줄ID의 열차를 온라인 시간표로 불러옵니다. MMI·T/G에서 고친 뒤 [편집 적용]으로 저장하세요.</p></div></div>`;
 },
 bind(){
  $('sfFind').onclick=()=>{sFilter={name:$('sfName').value.trim(),section:$('sfSection').value};go('situations');};
  pick('sTable',id=>{sSel=id;schSel=lib.situations.find(s=>s.id===id).scheduleId||schSel;go('situations');});
  let pIndex=null;pick('sProblems',k=>{pIndex=+k;for(const tr of doc.querySelectorAll('#sProblems tr'))tr.classList.toggle('sel',tr.dataset.key===k);});
  const draft=()=>{const s=structuredClone(lib.situations.find(x=>x.id===sSel)||{id:'',problems:[],timetable:null});Object.assign(s,{name:$('sName').value.trim(),section:$('sSection').value,limit:Number($('sLimit').value)||0,scheduleId:$('sSchedule').value.trim()});return s;};
  const keep=s=>{const i=lib.situations.findIndex(x=>x.id===s.id);if(i>=0)lib.situations[i]=s;else lib.situations.push(s);persist();sSel=s.id;};
  $('sAdd').onclick=()=>{if(!sSel){alert('상황을 먼저 저장하거나 선택하세요.');return;}const s=draft();s.problems.push($('sAddProblem').value);keep(s);go('situations');};
  $('sRemove').onclick=()=>{if(!sSel||pIndex===null){alert('뺄 문제를 선택하세요.');return;}const s=draft();s.problems.splice(pIndex,1);keep(s);go('situations');};
  $('sClear').onclick=()=>{sSel=null;go('situations');};
  $('sSave').onclick=()=>{const s=draft();if(!s.name){alert('상황명칭을 입력하세요.');return;}if(!s.id){s.id=nextId('S-',lib.situations);if(!s.problems.length&&lib.problems[0])s.problems=[];}confirmBox('상황을 저장하시겠습니까?',()=>{keep(s);go('situations');alert(s.problems.length?'저장되었습니다.':'저장되었습니다. 문제를 추가하세요.');});};
  $('sDelete').onclick=()=>{if(!sSel){alert('삭제할 상황을 선택하세요.');return;}const used=lib.scenarios.filter(c=>c.situations.includes(sSel));if(used.length){alert(`시나리오 ${used.map(c=>c.name).join(', ')}에서 쓰고 있어 삭제할 수 없습니다.`);return;}confirmBox('선택한 상황을 삭제하시겠습니까?',()=>{lib.situations=lib.situations.filter(s=>s.id!==sSel);persist();sSel=null;go('situations');});};
  pick('schTable',id=>{schSel=id;schTrain=null;go('situations');});
  const trainPick=id=>{schTrain=id;for(const tr of doc.querySelectorAll('#schUp tr,#schDown tr'))tr.classList.toggle('sel',tr.dataset.key===id);};pick('schUp',trainPick);pick('schDown',trainPick);
  $('schApply').onclick=()=>{
   const mode=doc.querySelector('input[name="schMode"]:checked').value,model=D().getModel(),snap={serviceDate:model.serviceDate,trains:structuredClone(model.trains)};
   if(mode==='create'){const n=$('schId').value.trim();if(!/^\d{3}$/.test(n)){alert('스케줄ID는 숫자 3자리로 입력하세요.');return;}const id='01'+n;if(schedules().some(x=>x.id===id)){alert(`${id}는 이미 있는 스케줄ID입니다.`);return;}
    schedules().push({id,name:$('schName').value.trim()||'스케줄_'+id,section:$('schSection').value,author:'MMI-1',createdAt:stamp(),timetable:snap});schSel=id;}
   else{const sch=schedules().find(x=>x.id===schSel);if(!sch){alert('수정할 스케줄ID를 선택하세요.');return;}sch.timetable=snap;sch.createdAt=stamp();}
   persist();go('situations');alert(`${schSel} 열차 스케줄에 ${snap.trains.length}개 열차를 저장했습니다.`);
  };
  $('schDelete').onclick=()=>{const used=lib.situations.filter(x=>x.scheduleId===schSel);if(used.length){alert('상황에서 사용 중인 스케줄입니다: '+used.map(x=>x.name).join(', '));return;}if(!schSel){alert('삭제할 스케줄ID를 선택하세요.');return;}confirmBox(`${schSel} 열차 스케줄을 삭제하시겠습니까?`,()=>{lib.schedules=schedules().filter(x=>x.id!==schSel);persist();schSel=null;go('situations');});};
  $('schApplySit').onclick=()=>{if(!sSel||!schSel){alert('상황과 스케줄ID를 모두 선택하세요.');return;}const s=lib.situations.find(x=>x.id===sSel);s.scheduleId=schSel;persist();go('situations');};
  $('schCopy').onclick=()=>{const sch=schedules().find(x=>x.id===schSel),t=sch?.timetable?.trains.find(x=>x.id===schTrain),targets=schedules().filter(x=>x.id!==schSel);if(!t){alert('복사할 열차를 선택하세요.');return;}if(!targets.length){alert('대상 스케줄ID를 먼저 생성하세요.');return;}
   if(!M().windowIds().includes('ftsCopy'))M().createWindow('ftsCopy',{container:panel(),title:'스케줄 간 열차 복사',x:180,y:80,width:470,body:'<div class="fts-picker" id="ftsCopyBody"></div>'});
   $('ftsCopyBody').innerHTML=`<p><b>${esc(t.id)}</b> · ${esc(sch.name)}</p><label class="fts-wide">대상 스케줄<select id="ftsCopyTarget">${opts(targets.map(x=>[x.id,x.id+' · '+x.name]))}</select></label><div class="fts-row-btns end"><button type="button" class="sched-btn" id="ftsCopyClose">닫기</button><button type="button" class="sched-btn primary" id="ftsCopyApply">복사</button></div>`;
   $('ftsCopyClose').onclick=()=>M().close('ftsCopy');$('ftsCopyApply').onclick=()=>{const target=schedules().find(x=>x.id===$('ftsCopyTarget').value);if(target.timetable.trains.some(x=>x.id===t.id)){alert('대상에 같은 열차번호가 있습니다.');return;}target.timetable.trains.push(structuredClone(t));if(persist()){M().close('ftsCopy');alert(`${t.id} 열차를 ${target.id}에 복사했습니다.`);}};M().open('ftsCopy');
  };
  $('schTrainDel').onclick=()=>{const sch=schedules().find(x=>x.id===schSel);if(!sch||!schTrain){alert('삭제할 열차를 선택하세요.');return;}confirmBox(`${schTrain} 열차를 ${sch.id}에서 삭제하시겠습니까?`,()=>{sch.timetable.trains=sch.timetable.trains.filter(t=>t.id!==schTrain);persist();schTrain=null;go('situations');});};
  $('schEdit').onclick=()=>{const sch=schedules().find(x=>x.id===schSel);if(!sch){alert('스케줄ID를 선택하세요.');return;}loadSchedule(sch,true);};
 }
};
function loadSchedule(sch,announce){
 const r=T().import(D().getModel(),sch.timetable);D().render();
 if(announce)alert(r.ok?`${sch.id} 열차 스케줄을 온라인 시간표로 불러왔습니다. (${sch.timetable.trains.length}개 열차)`:r.message);
 return r;
}

// ---------------------------------------------------------------- 시나리오 관리
let cTab='new',cSel=null,cDraft=[],cPick=null,cRight=null,cRightIndex=null,cNameDraft='';
PAGES.scenarios={
 html(){
  const sits=lib.situations.filter(x=>(!sFilter.name||x.name.includes(sFilter.name))&&(!sFilter.section||x.section===sFilter.section));
  const current=cTab==='edit'?lib.scenarios.find(c=>c.id===cSel):null;
  const chosen=cDraft.map((id,index)=>{const s=lib.situations.find(s=>s.id===id);return s?{...s,index}:null;}).filter(Boolean);
  const focus=lib.situations.find(s=>s.id===(cRight||cPick));
  return `<div class="fts-tabs">${[['new','시나리오 등록'],['edit','시나리오 수정']].map(([k,l])=>`<button type="button" data-ctab="${k}" class="${cTab===k?'on':''}">${l}</button>`).join('')}</div>
<div class="fts-scn"><div><div class="fts-cap">시나리오 상황 검색</div><div class="fts-grid2"><label>상황명칭<input id="cfName" value="${esc(sFilter.name)}"></label><label>구간<select id="cfSection"><option value="">전체</option>${opts(SECTIONS,sFilter.section)}</select></label><button type="button" class="sched-btn" id="cfFind">검색</button></div>
${table('cLeft',['상황 명','스케줄ID','제한시간'],sits.map(s=>({id:s.id,cells:[esc(s.name),esc(s.scheduleId||''),s.limit||'']})),{selected:cPick})}</div>
<div class="fts-move"><button type="button" class="sched-btn" id="cIn" title="상황 추가">&gt;&gt;</button><button type="button" class="sched-btn" id="cOut" title="상황 빼기">&lt;&lt;</button></div>
<div><div class="fts-cap">${cTab==='new'?'새로운 시나리오 추가':'시나리오 수정'}</div>${cTab==='edit'?`<label class="fts-wide">시나리오<select id="cWhich">${opts(lib.scenarios.map(c=>[c.id,c.name]),cSel)}</select></label>`:''}
<div class="fts-grid2"><label>시나리오 이름<input id="cName" value="${esc(cNameDraft||current?.name||'')}"></label><button type="button" class="sched-btn primary" id="cSave">저장</button>${cTab==='edit'?'<button type="button" class="sched-btn danger" id="cDelete">삭제</button>':''}</div>
${table('cRight',['시나리오 상황 명칭','스케줄ID','제한시간'],chosen.map(s=>({id:String(s.index),cells:[esc(s.name),esc(s.scheduleId||''),s.limit||'']})),{selected:cRightIndex===null?null:String(cRightIndex)})}<div class="fts-row-btns"><button type="button" class="sched-btn" id="cUp">위로 ↑</button><button type="button" class="sched-btn" id="cDown">아래로 ↓</button></div></div></div>
<div class="fts-cap">선택 시나리오 상황 문제 리스트</div>${table('cProblems',['과목명칭','문제명칭','제한시간(초)'],(focus?.problems||[]).map(id=>{const p=lib.problems.find(x=>x.id===id);return {id,cells:[esc(p?.subject),esc(p?.name),p?.limit]};}))}`;
 },
 bind(){
  for(const b of doc.querySelectorAll('[data-ctab]'))b.onclick=()=>{cTab=b.dataset.ctab;if(cTab==='edit'){cSel=cSel||lib.scenarios[0]?.id;cDraft=[...(lib.scenarios.find(c=>c.id===cSel)?.situations||[])];cNameDraft=lib.scenarios.find(c=>c.id===cSel)?.name||'';}else{cSel=null;cDraft=[];cNameDraft='';}cRightIndex=null;go('scenarios');};
  $('cfFind').onclick=()=>{sFilter={name:$('cfName').value.trim(),section:$('cfSection').value};go('scenarios');};
  const rememberName=()=>{cNameDraft=$('cName').value;};pick('cLeft',id=>{rememberName();cPick=id;cRight=null;cRightIndex=null;go('scenarios');});pick('cRight',id=>{rememberName();cRightIndex=+id;cRight=cDraft[cRightIndex];cPick=null;go('scenarios');});
  $('cIn').onclick=()=>{if(!cPick){alert('추가할 상황을 선택하세요.');return;}rememberName();cDraft.push(cPick);go('scenarios');};
  $('cOut').onclick=()=>{if(!cRight){alert('뺄 상황을 선택하세요.');return;}rememberName();if(cRightIndex!==null)cDraft.splice(cRightIndex,1);cRight=null;cRightIndex=null;go('scenarios');};
  const reorder=delta=>{if(cRightIndex===null)return;const target=cRightIndex+delta;if(target<0||target>=cDraft.length)return;rememberName();[cDraft[target],cDraft[cRightIndex]]=[cDraft[cRightIndex],cDraft[target]];cRightIndex=target;go('scenarios');};$('cUp').onclick=()=>reorder(-1);$('cDown').onclick=()=>reorder(1);
  if($('cWhich'))$('cWhich').onchange=()=>{cSel=$('cWhich').value;cDraft=[...lib.scenarios.find(c=>c.id===cSel).situations];cNameDraft=lib.scenarios.find(c=>c.id===cSel).name;cRightIndex=null;go('scenarios');};
  $('cSave').onclick=()=>{
   const name=$('cName').value.trim();cNameDraft=name;if(!name){alert('시나리오 이름을 입력하세요.');return;}if(!cDraft.length){alert('시나리오 상황을 추가하세요.');return;}
   confirmBox('시나리오를 저장하시겠습니까?',()=>{if(cTab==='edit'){const c=lib.scenarios.find(x=>x.id===cSel);Object.assign(c,{name,situations:[...cDraft]});}else{const id=nextId('SC-',lib.scenarios);lib.scenarios.push({id,name,author:'MMI-1',createdAt:stamp(),situations:[...cDraft]});cTab='edit';cSel=id;}persist();go('scenarios');alert('저장되었습니다.');});
  };
  if($('cDelete'))$('cDelete').onclick=()=>confirmBox('선택한 시나리오를 삭제하시겠습니까?',()=>{lib.scenarios=lib.scenarios.filter(c=>c.id!==cSel);persist();cSel=lib.scenarios[0]?.id||null;cDraft=[...(lib.scenarios.find(c=>c.id===cSel)?.situations||[])];go('scenarios');});
 }
};

// ---------------------------------------------------------------- 사용자관리
PAGES.users={
 html:()=>`<div class="fts-cap">사용자 목록</div>${table('uTable',['구분','ID','이름','번호'],users.map(u=>({id:u.id,cells:[esc(u.role),esc(u.id),esc(u.name),esc(u.number||'')]})))}
<div class="fts-grid2"><label>구분<select id="uRole">${opts(['교수','교육생'])}</select></label><label>ID<input id="uId" maxlength="12"></label><label>이름<input id="uName" maxlength="20"></label><label>번호<input id="uNumber" maxlength="12"></label></div>
<div class="fts-row-btns"><button type="button" class="sched-btn primary" id="uSave">저장</button><button type="button" class="sched-btn danger" id="uDelete">삭제</button></div>`,
 bind(){
  let sel=null;pick('uTable',id=>{sel=id;const u=users.find(x=>x.id===id);$('uRole').value=u.role;$('uId').value=u.id;$('uName').value=u.name;$('uNumber').value=u.number||'';});
  $('uSave').onclick=()=>{const u={role:$('uRole').value,id:$('uId').value.trim(),name:$('uName').value.trim(),number:$('uNumber').value.trim()};if(!u.id||!u.name){alert('ID와 이름을 입력하세요.');return;}const i=users.findIndex(x=>x.id===u.id);if(i>=0)users[i]=u;else users.push(u);save(KEY.users,users);go('users');};
  $('uDelete').onclick=()=>{if(!sel)return;users=users.filter(u=>u.id!==sel);save(KEY.users,users);go('users');};
 }
};

// ---------------------------------------------------------------- 시스템관리: library file (hand-written or AI-made scenarios)
PAGES.system={
 html:()=>`<div class="fts-cap">시나리오 라이브러리 (문제 ${lib.problems.length} · 상황 ${lib.situations.length} · 시나리오 ${lib.scenarios.length} · 열차 스케줄 ${schedules().length})</div>
<p class="idm-note">원본 시스템관리 화면은 아직 확인하지 못했습니다. 여기에는 이 프로그램의 라이브러리 파일 기능만 둡니다. JSON 형식은 docs/FTS-시나리오-형식.md에 있습니다. 다른 사람이나 AI가 만든 시나리오 파일도 검사를 통과하면 그대로 들어옵니다.</p>
<div class="fts-row-btns"><button type="button" class="sched-btn" id="libExport">라이브러리 내보내기 (JSON)</button><button type="button" class="sched-btn" id="libImport">가져오기 (JSON)</button><button type="button" class="sched-btn" id="libMerge">가져와서 합치기</button><button type="button" class="sched-btn danger" id="libReset">기본 라이브러리로 되돌리기</button></div>
<div class="fts-cap">붙여넣기로 가져오기</div><textarea id="libText" rows="10" class="fts-json" placeholder='{"problems":[...],"situations":[...],"scenarios":[...]}'></textarea>
<div class="fts-row-btns"><button type="button" class="sched-btn" id="libCheck">형식 검사</button><button type="button" class="sched-btn primary" id="libPaste">검사 후 합치기</button></div><pre id="libReport" class="fts-report" role="status"></pre>`,
 bind(){
  $('libExport').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(lib,null,2)],{type:'application/json'}));const a=doc.createElement('a');a.href=url;a.download='fts-scenarios.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const file=merge=>{const input=doc.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{importLibrary(JSON.parse(await input.files[0].text()),merge);}catch(e){alert('파일을 읽지 못했습니다: '+e.message);}};input.click();};
  $('libImport').onclick=()=>file(false);$('libMerge').onclick=()=>file(true);
  $('libReset').onclick=()=>confirmBox('기본 라이브러리로 되돌리시겠습니까? 직접 만든 문제·상황·시나리오는 지워집니다.',()=>{lib=defaults();persist();go('system');});
  const parse=()=>{try{return JSON.parse($('libText').value);}catch(e){$('libReport').textContent='JSON 문법 오류: '+e.message;return null;}};
  $('libCheck').onclick=()=>{const data=parse();if(!data)return;const errors=F().validate(normalise(data),{scripts:scriptIds()});$('libReport').textContent=errors.length?`문제 ${errors.length}건\n`+errors.join('\n'):'형식 검사 통과';};
  $('libPaste').onclick=()=>{const data=parse();if(data)importLibrary(data,true);};
 }
};
const normalise=d=>({version:d?.version??F().VERSION,problems:d.problems||[],situations:d.situations||[],scenarios:d.scenarios||[],schedules:d.schedules||[]});
function importLibrary(data,merge){
 if(!data||typeof data!=='object'||Array.isArray(data)){alert('라이브러리는 JSON 객체여야 합니다.');return false;}
 const incoming=normalise(data);if(incoming.version!==F().VERSION||['problems','situations','scenarios','schedules'].some(k=>!Array.isArray(incoming[k]))){alert('라이브러리 버전과 목록 배열을 확인하세요.');return false;}const next=merge?{...lib,problems:[...lib.problems],situations:[...lib.situations],scenarios:[...lib.scenarios],schedules:[...schedules()]}:{version:F().VERSION,problems:[],situations:[],scenarios:[],schedules:[]};
 for(const k of ['problems','situations','scenarios','schedules'])for(const x of incoming[k]){const i=next[k].findIndex(y=>y.id===x.id);if(i>=0)next[k][i]=x;else next[k].push(x);}
 const errors=F().validate(next,{scripts:scriptIds()});
 if(errors.length){if($('libReport'))$('libReport').textContent=`가져오지 않았습니다 · 문제 ${errors.length}건\n`+errors.join('\n');alert(`가져오지 않았습니다. 문제 ${errors.length}건: ${errors[0]}`);return false;}
 lib=next;if(!persist())return false;if(page==='system')go('system');alert(`가져왔습니다. 문제 ${incoming.problems.length} · 상황 ${incoming.situations.length} · 시나리오 ${incoming.scenarios.length}`);return true;
}

// ---------------------------------------------------------------- 교육설정 · 시나리오 선택
let setup={professor:'',student:'',scenario:null,showActions:true,autoRun:true};
PAGES.setup={
 html(){
  const sc=lib.scenarios.find(c=>c.id===setup.scenario),prof=users.filter(u=>u.role==='교수'),stud=users.filter(u=>u.role==='교육생');
  const rows=(sc?.situations||[]).map(id=>{const s=lib.situations.find(x=>x.id===id);return {id,cells:[esc(s?.name),esc(s?.section),esc(s?.scheduleId||'')]};});
  return `<div class="fts-split"><div class="fts-left"><div class="fts-bar">시나리오 정보 관리</div><div class="fts-sub-bar">교수/교육생 사용자 선택</div>
<div class="fts-grid2"><label>교수정보<select id="suProf">${opts(prof.map(u=>[u.id,`${u.id} · ${u.name}`]),setup.professor)}</select></label><label>교육생 정보<select id="suStud">${opts(stud.map(u=>[u.id,`${u.id} · ${u.name}${u.number?' · '+u.number:''}`]),setup.student)}</select></label></div>
<div class="fts-sub-bar">교육 시나리오 정보</div><button type="button" class="sched-btn fts-pick" id="suPick">시나리오 선택</button>
<div class="fts-grid2"><label>시나리오 명칭<input readonly value="${esc(sc?.name||'')}" id="suName"></label><label>작성자<input readonly value="${esc(sc?.author||'')}"></label><label>작성일자<input readonly value="${esc(sc?.createdAt||'')}"></label></div>
${table('suSits',['시나리오상황','구간','스케줄ID'],rows)}
<label><input type="checkbox" id="suActions" ${setup.showActions?'checked':''}> 교육생 문제 발생 화면에 조치사항 표시</label><label><input type="checkbox" id="suAuto" ${setup.autoRun?'checked':''}>교육 중 시간표에 따른 열차 자동운행</label>
<div class="fts-row-btns"><button type="button" class="sched-btn primary" id="suStart">교육 시작</button><button type="button" class="sched-btn" id="suClear">Clear</button></div></div>
<div class="fts-right"><div class="fts-bar">교육 설정</div><div class="fts-sub-bar">시나리오 조회</div><div class="fts-grid2"><label>스케줄ID<input id="suSch"></label><button type="button" class="sched-btn" id="suSchFind">조회</button></div><div id="suSchList"></div></div></div>`;
 },
 bind(){
  const remember=()=>{setup.professor=$('suProf').value;setup.student=$('suStud').value;setup.showActions=$('suActions').checked;setup.autoRun=$('suAuto').checked;};
  $('suPick').onclick=()=>{remember();openPicker();};
  $('suClear').onclick=()=>{setup={professor:'',student:'',scenario:null,showActions:true};go('setup');};
  $('suSchFind').onclick=()=>{const v=$('suSch').value.trim();const list=lib.situations.filter(s=>!v||s.scheduleId===v);$('suSchList').innerHTML=table('suSchRows',['상황','스케줄ID','제한시간'],list.map(s=>({id:s.id,cells:[esc(s.name),esc(s.scheduleId||''),s.limit||'']})));};
  $('suStart').onclick=()=>{remember();startSession();};
 }
};
let pickState={name:'',author:'',scenario:null,situation:null};
function openPicker(){
 if(!M().windowIds().includes('ftsPicker'))M().createWindow('ftsPicker',{container:panel(),title:'시나리오 선택',x:180,y:40,width:980,body:'<div id="ftsPickerBody" class="fts-picker"></div>'});
 M().open('ftsPicker');renderPicker();
}
function renderPicker(){
 const list=lib.scenarios.filter(c=>(!pickState.name||c.name.includes(pickState.name))&&(!pickState.author||String(c.author).includes(pickState.author)));
 const sc=lib.scenarios.find(c=>c.id===pickState.scenario),sits=(sc?.situations||[]).map(id=>lib.situations.find(s=>s.id===id)).filter(Boolean);
 const sit=lib.situations.find(s=>s.id===pickState.situation)||sits[0];
 $('ftsPickerBody').innerHTML=`<div class="fts-grid2"><label>시나리오 이름<input id="pkName" value="${esc(pickState.name)}"></label><label>작성자 ID<input id="pkAuthor" value="${esc(pickState.author)}"></label><button type="button" class="sched-btn" id="pkFind">검 색</button></div>
${table('pkScen',['시나리오 이름','작성자ID','작성일자'],list.map(c=>({id:c.id,cells:[esc(c.name),esc(c.author||''),esc(c.createdAt||'')]})),{selected:pickState.scenario})}
${table('pkSits',['상황 명','스케줄ID','스케줄명'],sits.map(s=>({id:s.id,cells:[esc(s.name),esc(s.scheduleId||''),esc(schedules().find(x=>x.id===s.scheduleId)?.name||'')]})),{selected:sit?.id??null})}
${table('pkProbs',['과목명칭','문제명칭','제한시간(초)'],(sit?.problems||[]).map(id=>{const p=lib.problems.find(x=>x.id===id);return {id,cells:[esc(p?.subject),esc(p?.name),p?.limit]};}))}
<div class="fts-row-btns end"><button type="button" class="sched-btn primary" id="pkOk">선 택</button><button type="button" class="sched-btn" id="pkClose">닫 기</button></div>`;
 $('pkFind').onclick=()=>{pickState.name=$('pkName').value.trim();pickState.author=$('pkAuthor').value.trim();renderPicker();};
 pick('pkScen',id=>{pickState.scenario=id;pickState.situation=null;renderPicker();});
 pick('pkSits',id=>{pickState.situation=id;renderPicker();});
 $('pkOk').onclick=()=>{if(!pickState.scenario){alert('시나리오를 선택하세요.');return;}setup.scenario=pickState.scenario;M().close('ftsPicker');go('setup');};
 $('pkClose').onclick=()=>M().close('ftsPicker');
}

// ---------------------------------------------------------------- 교육 진행
const now=()=>D().clock();
function uiState(){
 const open=M().windowIds().filter(id=>M().isOpen(id));const g=$('graphPanel');if(g&&!g.hidden&&g.dataset.detached!=='1'||root.SimWorkspace?.graphOpen?.())open.push('graph');
 return {windows:[...new Set(open)],graphTrain:$('graphTrain')?.value||''};
}
function scriptProgress(id){
 const r=root.SimRemote?root.SimRemote.snapshot.scenario?.run:null,snap=r?{id:r.sc?.id,done:r.done}:root.SimScenarioUI?.snapshot?.();
 if(!snap||snap.id!==id)return {done:0,total:0};return {done:snap.done.filter(Boolean).length,total:snap.done.length,complete:r?!!r.passed:!!snap.passed};
}
function ctxFor(item){
 const p=activeLibrary().problems.find(x=>x.id===item.problem),since=item.startedAt??session.readyAt;
 return {states:host.context().stationStates,ls:root.SimLSUI.getModel(),model:D().getModel(),events:events.filter(e=>e.at>=since),ui:uiState(),manual:session.manual[session.items.indexOf(item)]||{},script:p?.script?scriptProgress(p.script):null};
}
function startSession(){
 if(root.SimRemote){const r=remote({op:'start',...setup});if(!r.ok){alert(r.message);return;}go('monitor');tick();return;}
 const sc=lib.scenarios.find(c=>c.id===setup.scenario);
 if(!sc){alert('시나리오를 선택하세요.');return;}if(!setup.professor||!setup.student){alert('교수와 교육생을 선택하세요.');return;}
 const errors=F().validate(lib,{scripts:scriptIds()});if(errors.length){alert('라이브러리 오류로 시작할 수 없습니다: '+errors[0]);return;}
 const prof=users.find(u=>u.id===setup.professor),stud=users.find(u=>u.id===setup.student);
 localRunLibrary=structuredClone(lib);root.SimAssessmentUI?.beginTask('fts:'+Date.now(),sc.name,'integrated');
 session=F().createSession(localRunLibrary,sc.id,{professor:prof?.name||setup.professor,student:stud?.id||setup.student,startedAt:now()});session.showActions=setup.showActions;session.situationLoaded=null;events=[];
 M().log('event',`교육 시작 · ${sc.name} · 교수 ${session.professor} · 교육생 ${session.student}`);
 go('monitor');tick();
}
function loadSituation(item){
 const s=activeLibrary().situations.find(x=>x.id===item.situation);if(!s||session.situationLoaded===(item.situationIndex??s.id))return;
 session.situationLoaded=item.situationIndex??s.id;const sch=schedules().find(x=>x.id===s.scheduleId);
 if(sch?.timetable)loadSchedule(sch,false);
 M().log('event',`상황 시작 · ${s.name}${sch?` · 열차 스케줄 ${sch.id}`:''}`);
}
function applyPhenomenon(ph){
 const model=D().getModel();let r={ok:true};
 const atStation=(station,fn)=>{host.selectStation(station);return fn();};
 switch(ph.type){
  case 'insertTrain':r=root.SimLSUI.dispatch({op:'insert',station:ph.station,slot:ph.slot,number:ph.number,direction:ph.direction||'up'});break;
  case 'deleteTrain':for(const [station,st] of Object.entries(root.SimLSUI.getModel().stations))for(const [slot,rows] of Object.entries(st.windows))for(const row of [...rows])if(row.number===ph.number)root.SimLSUI.dispatch({op:'delete',station,slot,uid:row.uid});break;
  case 'mode':r=atStation(ph.station,()=>host.run({type:'mode',value:ph.value,source:'SCENARIO'}));break;
  case 'route':r=atStation(ph.station,()=>{const before=host.context().stationStates[ph.station].mode;host.run({type:'mode',value:'CCM',source:'SCENARIO'});const x=host.run({type:'route',id:ph.route,source:'SCENARIO'});if(before!=='CCM')host.run({type:'mode',value:before,source:'SCENARIO'});return x;});break;
  case 'approach':r=atStation(ph.station,()=>host.run({type:'approach',signal:ph.signal,present:true,source:'SCENARIO'}));break;
  case 'createTrain':{const hms=String(ph.start||'09:00:00'),[h,m,s=0]=hms.split(':').map(Number),t=T().pattern({id:ph.train,from:ph.from,to:ph.to,start:h*3600+m*60+s-28800,kind:ph.kind||'전동열차'});r=t?T().create(model,t):{ok:false,message:'열차 생성 조건을 확인하세요.'};D().render();break;}
  case 'delay':r=T().delay(model,ph.train,ph.station,Number(ph.minutes));D().render();break;
  case 'cancel':r=T().setCancelled(model,ph.train,ph.from,ph.to,true);D().render();break;
  case 'alarm':M().raiseAlarm(ph.text,'','W');break;
  case 'notice':session.notice=ph.text;M().log('event','안내 · '+ph.text);break;
 }
 M().log('event',`현상 발생 · ${F().PHENOMENA[ph.type]?.label||ph.type}${r&&r.ok===false?' · 실패: '+(r.message||''):''}`);
}
function startScript(id){
 M().open('scenario');const sel=$('scSelect');if(!sel)return;sel.value=id;sel.dispatchEvent(new Event('change'));$('scStart').click();
}
function tick(){
 if(root.SimRemote){
  syncRemote();const state=root.SimRemote.snapshot.fts;if($('ftsSessionStatus'))$('ftsSessionStatus').textContent=session&&!session.finished?'교육 진행 · '+(session.current+1)+' / '+session.items.length+' 문제':session?'교육 종료':'교육 전 준비';if(session&&!session.finished&&!root.SimExtraLS){const ui=uiState(),sig=JSON.stringify(ui);if(tick.ui!==sig){tick.ui=sig;remote({op:'ui',ui});}}
  if(state.notice?.id!==lastNotice){lastNotice=state.notice?.id||0;if(state.notice?.kind==='activate'){speak(state.notice.text);showProblem();}}
  if(page==='monitor'&&ftsOpen())renderMonitor();if(M().isOpen('ftsProblem'))renderProblem();return;
 }
 if(!session||session.finished)return;
 const t=now();const pending=session.items[session.current];if(pending)loadSituation(pending);const out=F().advance(activeLibrary(),session,(item)=>ctxFor(item),t);
 for(const o of out){
  if(o.kind==='activate'){loadSituation(o.item);if(o.problem.script)startScript(o.problem.script);speak(o.problem.voice||o.problem.name);showProblem();M().log('event',`문제 발생 · ${o.problem.name}`);}
  if(o.kind==='phenomenon')applyPhenomenon(o.phenomenon);
  if(o.kind==='end'){const p=activeLibrary().problems.find(x=>x.id===o.item.problem);M().log('event',`문제 ${o.status} · ${p?.name} · ${o.item.score}점`);if(p?.script&&o.status!=='완료')$('scStop')?.click();}
  if(o.kind==='finished')finishSession('모든 문제 종료');
 }
 if(page==='monitor'&&ftsOpen())renderMonitor();
 if(M().isOpen('ftsProblem'))renderProblem();
}
function finishSession(reason){
 if(root.SimRemote){remote({op:'stop'});tick();return;}
 if(!session||session.closed)return;session.closed=true;session.finished=true;
 const sum=F().summary(activeLibrary(),session);
 history.unshift({id:'E'+Date.now(),at:stamp(),professor:session.professor,student:session.student,scenario:session.scenarioName,reason,...sum});save(KEY.history,history.slice(0,200));
 M().log('event',`교육 종료 · ${session.scenarioName} · ${sum.got}/${sum.full}점 (${reason})`);
 if(M().isOpen('ftsProblem'))renderProblem();if(page==='monitor')renderMonitor();
}

// ---------------------------------------------------------------- 모니터링관리
PAGES.monitor={html:()=>'<div id="ftsMonitor"></div>',bind:()=>renderMonitor()};
function renderMonitor(){
 const box=$('ftsMonitor');if(!box)return;
 if(!session){box.innerHTML='<p class="fts-empty">진행 중인 교육이 없습니다. [교육설정]에서 시나리오를 고르고 교육 시작을 누르세요.</p>';return;}
 const item=session.items[Math.min(session.current,session.items.length-1)],p=activeLibrary().problems.find(x=>x.id===item.problem),s=activeLibrary().situations.find(x=>x.id===item.situation);
 const ctx=ctxFor(item),elapsed=item.startedAt!=null?(item.endedAt??now())-item.startedAt:0;
 const remaining=Math.max(0,(p?.limit||0)-elapsed),progress=session.items.map(it=>{const q=activeLibrary().problems.find(x=>x.id===it.problem);return [it.status,it.error||'',it.score,(q?.checks||[]).map((_,i)=>!!it.met?.[i]),(q?.deductions||[]).map((_,i)=>!!it.deducted?.[i])];}),signature=JSON.stringify([session.current,progress,session.manual,session.finished,ctx.script,(p?.trigger?.conditions||[]).map((c,i)=>item.triggerMet?.[i]??F().test(c,ctx))]);
 if(monitorSignature===signature){if($('mElapsed'))$('mElapsed').value=clockText(elapsed);if($('mRemaining'))$('mRemaining').value=clockText(remaining);return;}monitorSignature=signature;
 const sits=[...new Set(session.items.map(i=>i.situation))].map(id=>activeLibrary().situations.find(x=>x.id===id));
 const manual=[];const visit=c=>{if(c?.type==='manual'&&!manual.some(k=>(k.condition.key||k.condition.label)===(c.key||c.label)))manual.push({condition:c});if(c?.conditions)c.conditions.forEach(visit);if(c?.condition)visit(c.condition);};[...(p?.checks||[]),...(p?.deductions||[])].forEach(k=>visit(k.condition));
 box.innerHTML=`<div class="fts-split"><div class="fts-left"><div class="fts-bar">교육시나리오 정보</div>
<div class="fts-grid2"><label>교수<input readonly value="${esc(session.professor)}"></label><label>교육생<input readonly value="${esc(session.student)}"></label><label class="fts-wide">시나리오 명칭<input readonly value="${esc(session.scenarioName)}"></label></div>
${table('mSits',['시나리오상황','구간','스케줄ID'],sits.map(x=>({id:x.id,cells:[esc(x.name),esc(x.section),esc(x.scheduleId||'')]})),{selected:s?.id})}
${table('mProbs',['과목명칭','제한시간(초)','문제명칭','상태','점수'],session.items.map((it,i)=>{const q=activeLibrary().problems.find(x=>x.id===it.problem);return {id:String(i),cells:[esc(q?.subject),q?.limit,esc(q?.name),`<span class="fts-st st-${esc(it.status)}">${esc(it.status)}</span>`,it.status==='대기'?'':it.score]};}),{selected:String(session.current)})}
<div class="fts-row-btns"><button type="button" class="sched-btn danger" id="mEnd" ${session.finished?'disabled':''}>교육종료</button><button type="button" class="sched-btn" id="mNext" ${session.finished?'disabled':''}>문제종료</button><button type="button" class="sched-btn" id="mShow">문제 발생 화면</button></div></div>
<div class="fts-right"><div class="fts-bar">모니터링 관리</div>
<div class="fts-grid2 fts-clock-cards"><label>남은 시간<input readonly id="mRemaining" value="${clockText(remaining)}"></label><label>제한시간<input readonly value="${clockText(p?.limit)}"></label><label>경과시간<input readonly id="mElapsed" value="${clockText(elapsed)}"></label><button type="button" class="sched-btn" id="mReload" ${session.finished?'disabled':''}>상황 재로딩</button><span class="fts-progress">${session.finished?'교육 종료':item.error?'현상 적용 오류 · 일시정지':item.status==='대기'?'발생조건 대기':'진행 중'}</span></div>
<div class="fts-grid2"><label>과목<input readonly value="${esc(p?.subject)}"></label><label class="fts-wide">문제명칭<input readonly value="${esc(p?.name)}"></label></div>
<label class="fts-wide">상황<textarea readonly rows="3">${esc(p?.situation||'')}</textarea></label><label class="fts-wide">조치사항<textarea readonly rows="3">${esc(p?.actions||'')}</textarea></label>
${item.error?`<p class="fts-error" role="alert">${esc(item.error)}</p>`:''}<div class="fts-cap">발생조건 · 세부조건</div><ul class="fts-checks">${p?.trigger?.useTime?`<li class="${item.status!=='대기'?'ok':''}">발생시간 ${p.trigger.at}초</li>`:''}${(p?.trigger?.conditions||[]).map((c,i)=>`<li class="${(item.triggerMet?.[i]??F().test(c,ctx))?'ok':''}">${esc(F().describe(c))}</li>`).join('')}
${(p?.checks||[]).map((k,i)=>`<li class="${item.met[i]?'ok':''}">${item.met[i]?'✔':'○'} ${esc(k.label||F().describe(k.condition))} <small>(${k.points??1})</small></li>`).join('')}
${(p?.deductions||[]).map((k,i)=>`<li class="${item.deducted[i]?'bad':''}">감점 ${Number(k.points)||0} · ${esc(k.label||F().describe(k.condition))}</li>`).join('')}
${p?.script?`<li class="${ctx.script?.done>=ctx.script?.total&&ctx.script?.total?'ok':''}">대본 ${esc(scriptTitle(p.script))} · ${ctx.script?.done||0}/${ctx.script?.total||0} 단계</li>`:''}</ul>
${manual.length?`<div class="fts-cap">교수 확인 (구술)</div><div class="fts-row-btns wrap">${manual.map(k=>{const key=k.condition.key||k.condition.label,on=!!session.manual[session.items.indexOf(item)]?.[key];return `<button type="button" class="sched-btn ${on?'primary':''}" data-manual="${esc(key)}" ${session.finished?'disabled':''}>${on?'✔ ':''}${esc(k.condition.label)}</button>`;}).join('')}</div>`:''}
<div class="fts-grid2"><label>스케줄ID<input readonly value="${esc(s?.scheduleId||'')}"></label><label>스케줄 명칭<input readonly value="${esc(schedules().find(x=>x.id===s?.scheduleId)?.name||'(현재 온라인 시간표)')}"></label><label>구간<input readonly value="${esc(s?.section||'')}"></label></div>
${session.finished?`<div class="fts-result">${(()=>{const r=F().summary(activeLibrary(),session);return `결과 ${r.got}/${r.full}점 (${r.percent}%)`;})()}</div>`:''}</div></div>`;
 $('mEnd').onclick=()=>confirmBox('교육을 종료하시겠습니까?',()=>{finishSession('교수 종료');});
 $('mNext').onclick=()=>{if(root.SimRemote){remote({op:'next'});tick();return;}const p2=activeLibrary().problems.find(x=>x.id===session.items[session.current]?.problem);const out=F().endCurrent(session,now());if(p2?.script)$('scStop')?.click();if(out.some(o=>o.kind==='finished'))finishSession('모든 문제 종료');tick();renderMonitor();};
 $('mShow').onclick=showProblem;
 $('mReload').onclick=()=>{if(root.SimRemote){remote({op:'reload'});tick();return;}session.situationLoaded=null;loadSituation(item);};
 for(const b of box.querySelectorAll('[data-manual]'))b.onclick=()=>{if(root.SimRemote){remote({op:'manual',key:b.dataset.manual});tick();return;}const m=session.manual[session.items.indexOf(item)]??={};m[b.dataset.manual]=!m[b.dataset.manual];tick();renderMonitor();};
}

// ---------------------------------------------------------------- 교육생 "문제 발생" 화면
function showProblem(){
 if(!M().windowIds().includes('ftsProblem'))M().createWindow('ftsProblem',{title:'문제 발생',x:230,y:20,width:1060,body:'<div id="ftsProblemBody" class="fts-problem"></div>'});
 M().open('ftsProblem');renderProblem();
}
function renderProblem(){
 const box=$('ftsProblemBody');if(!box)return;
 if(!session){box.innerHTML='<p>진행 중인 교육이 없습니다.</p>';return;}
 const item=session.items[Math.min(session.current,session.items.length-1)],p=activeLibrary().problems.find(x=>x.id===item.problem);
 const elapsed=item.startedAt!=null?(item.endedAt??now())-item.startedAt:0,remaining=Math.max(0,(p?.limit||0)-elapsed);
 const signature=JSON.stringify([session.current,item.status,item.error,session.finished,session.showActions,session.notice]);if(problemSignature===signature){if($('pbElapsed'))$('pbElapsed').textContent=clockText(elapsed);if($('pbRemaining'))$('pbRemaining').textContent=clockText(remaining);return;}problemSignature=signature;
 const waiting=item.status==='대기'&&!session.finished,title=session.finished?'교육 종료':waiting?'다음 문제 대기':item.error?'진행 확인 필요':'문제 발생',status=session.finished?'finished':item.error?'error':waiting?'waiting':'active';
 const text=value=>esc(value||'');
 const section=(key,number,label,content,empty)=>`<section class="fts-briefing-section fts-briefing-${key}" aria-labelledby="pb-${key}-label"><div class="fts-pb-cap" id="pb-${key}-label"><span aria-hidden="true">${number}</span>${label}</div><div class="fts-pb-box" data-problem-section="${key}">${content?text(content):`<span class="fts-pb-empty">${empty}</span>`}</div></section>`;
 box.dataset.status=status;
 box.innerHTML=`<div class="fts-pb-time" aria-label="문제 시간"><div class="fts-pb-clock primary"><span>남은 시간</span><b id="pbRemaining">${clockText(remaining)}</b></div><div class="fts-pb-clock"><span>제한시간</span><b>${clockText(p?.limit)}</b></div><div class="fts-pb-clock"><span>경과시간</span><b id="pbElapsed">${clockText(elapsed)}</b></div></div>
<header class="fts-briefing-hero"><div class="fts-briefing-heading"><small>ORPHEIA · SCENARIO BRIEFING</small><h2>${title}</h2><div class="fts-briefing-meta"><span>${esc(p?.subject||'관제 실습')}</span><span>문제 ${Math.min(session.current+1,session.items.length)} / ${session.items.length}</span></div><p>${session.finished?'교육 기록에서 결과와 조치 내용을 확인하세요.':waiting?'다음 문제의 발생조건을 기다리고 있습니다.':'제시된 내용을 확인하고 LS·MMI에서 조치하세요.'}</p></div><div class="fts-briefing-art" aria-hidden="true"><img src="assets/orpheia/briefing.png" alt="" width="1312" height="1199"></div></header>
<div class="fts-briefing-content">${section('name','01','문제명칭',waiting?'':p?.name,waiting?'문제 발생 대기 중입니다.':'별도로 제시된 문제명칭이 없습니다.')}
${section('situation','02','상황',waiting?'':p?.situation,waiting?'상황 발생을 기다리고 있습니다.':'별도로 제시된 상황이 없습니다.')}
${session.notice&&!waiting?`<aside class="fts-briefing-notice" role="status"><b>추가 안내</b><span>${esc(session.notice)}</span></aside>`:''}
${item.error?`<aside class="fts-briefing-error" role="alert"><b>진행 확인</b><span>${esc(item.error)}</span></aside>`:''}
${session.showActions?section('actions','03','조치사항',waiting?'':p?.actions,waiting?'문제 발생 후 표시됩니다.':'별도로 제시된 조치사항이 없습니다.'):''}</div>`;
}
function speak(text){try{if(!text||!root.speechSynthesis)return;const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';root.speechSynthesis.cancel();root.speechSynthesis.speak(u);}catch{}}

// ---------------------------------------------------------------- 교육이력관리
PAGES.history={
 html:()=>`<div class="fts-cap">교육 이력</div>${table('hTable',['일시','교수','교육생','시나리오','점수','사유'],history.map(h=>({id:h.id,cells:[esc(Number.isFinite(Date.parse(h.at))?new Date(h.at).toLocaleString('sv-SE',{timeZone:'Asia/Seoul'}):h.at),esc(h.professor),esc(h.student),esc(h.scenario),`${h.got}/${h.full} (${h.percent}%)`,esc(h.reason)]})))}<div id="hDetail"></div>
<div class="fts-row-btns"><button type="button" class="sched-btn" id="hExport">교육 이력 내보내기</button><button type="button" class="sched-btn danger" id="hClear">이력 모두 지우기</button></div>`,
 bind(){
  pick('hTable',id=>{const h=history.find(x=>x.id===id);$('hDetail').innerHTML=table('hRows',['과목','문제','상태','점수','소요(초)','미충족·오류'],h.rows.map((r,i)=>({id:String(i),cells:[esc(r.subject),esc(r.problem),esc(r.status),`${r.score}/${r.full}`,r.seconds??'',esc(r.error||(r.checks||[]).filter(c=>!c.met).map(c=>c.label).join(' · '))]})));});
  $('hExport').onclick=()=>{const a=doc.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({format:'ORPHEIA-FTS-HISTORY',version:1,history},null,2)],{type:'application/json'}));a.href=url;a.download='orpheia-fts-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('hClear').onclick=()=>confirmBox('교육 이력을 모두 지우시겠습니까?',()=>{history=[];save(KEY.history,history);go('history');});
 }
};

// ---------------------------------------------------------------- init
function init(api){
 host=api;lib=load(KEY.lib,defaults);if(!lib.schedules)lib.schedules=[];
 const errors=F().validate(lib,{scripts:scriptIds(),drafts:true});if(errors.length)lib=defaults();
 const fallbackUsers=()=>[{role:'교수',id:'001',name:'교수'},{role:'교육생',id:'tester',name:'교육생',number:'202201'}];users=load(KEY.users,fallbackUsers);if(!Array.isArray(users)||users.some(u=>!u||typeof u.id!=='string'||typeof u.name!=='string'))users=fallbackUsers();history=load(KEY.history,()=>[]);if(!Array.isArray(history))history=[];history=history.filter(h=>h&&Array.isArray(h.rows));
 setup.professor=users.find(u=>u.role==='교수')?.id||'';setup.student=users.find(u=>u.role==='교육생')?.id||'';setup.scenario=lib.scenarios[0]?.id||null;
 if(root.SimRemote){const r=root.SimRemote.command({type:'fts',op:'bootstrap',library:lib,users,history});if(!r.ok)console.warn(r.message);syncRemote();setup.professor=users.find(u=>u.role==='교수')?.id||'';setup.student=users.find(u=>u.role==='교육생')?.id||'';setup.scenario=lib.scenarios[0]?.id||null;}
 pDraft=blankProblem();
 const box=panel();box.innerHTML=shell()+'<button type="button" class="fts-inline-close" id="ftsInlineClose" aria-label="FTS 제어통제 닫기">✕ 닫기</button>';
 box.querySelector('.fts-nav').onclick=e=>{const b=e.target.closest('[data-fts-page]');if(b)go(b.dataset.ftsPage);};
 $('ftsInlineClose').onclick=close;
 M().onEvent(e=>{if(!root.SimRemote&&session&&!session.finished){events.push({...e,at:now()});}});
 timer=setInterval(()=>{try{tick();const el=$('mElapsed'),pb=$('pbElapsed');if(session&&!session.finished){const it=session.items[session.current];if(it?.startedAt!=null){if(el)el.value=clockText(now()-it.startedAt);if(pb)pb.textContent=clockText(now()-it.startedAt);}}}catch(e){console.error(e);}},500);
}
function open(){
 if(!panel())return false;go(page);
 if(root.SimWorkspace?.openFts?.())return true;           // independent window
 panel().hidden=false;panel().classList.add('fts-inline');panel().scrollIntoView({block:'start'});return true;   // pop-ups blocked: in the LS page
}
function close(){if(root.SimWorkspace?.ftsDetached?.()){root.SimWorkspace.closeFts();return;}panel().hidden=true;panel().classList.remove('fts-inline');}
root.SimFTSUI={init,open,close,isOpen:ftsOpen,go,library:()=>lib,session:()=>session,importLibrary,tick,users:()=>users,history:()=>history};
})(window);
