// Writes docs/LS확인요청.md: per station, what is confirmed / presumed / unknown, for the user to check on the real LS.
const fs=require('fs'),path=require('path'),Core=require('../simulator/core.js'),N=require('../simulator/network.js'),MENUS=require('../simulator/route-menus.js'),WG=require('../simulator/wings.js'),W=require('../simulator/wiring.js');
const rule=(C,id)=>{const r=C.routes[id],s=C.signals[r.signal],d=r.destination,m=d.match(/^B(\d+)T/);if(s.kind==='장내')return !m;if(m){const even=(+m[1])%2===0;return s.dir===1?even:!even;}return /^(A1T|AT)$/.test(d);};
const nat=(a,b)=>a.localeCompare(b,'en',{numeric:true});
// User answers (same format as the transcribed lists), one file per answering session.
const answers={};const adir=path.join(__dirname,'../references/route-menus/answers');
for(const f of fs.existsSync(adir)?fs.readdirSync(adir).filter(f=>f.endsWith('.txt')):[]){let st=null;
 for(const l of fs.readFileSync(path.join(adir,f),'utf8').split('\n').filter(Boolean)){
  if(!/ - /.test(l)){st=l.trim();answers[st]=answers[st]||{};continue;}
  const [sig,rest]=l.split(' - ');answers[st][sig.trim()]=rest.split(',').map(s=>s.trim().replace(/^RT_\w+?_/,''));}}
// The named cell just inside a boundary cell (e.g. B605T -> AT): the destination some shunt routes show instead of the boundary.
function innerCells(st,def){const cells=WG[st]?.cells||[],xs=def.rails.flatMap(r=>r[1].map(p=>p[0])),lo=Math.min(...xs),hi=Math.max(...xs),mid=(lo+hi)/2,out={};
 const names=[...new Set(def.rails.flatMap(r=>[r[3],r[4]]).filter(n=>/^B\d+T/.test(n||'')))];
 for(const n of names){const bs=cells.filter(c=>c[3]===n);if(!bs.length)continue;const b=bs.sort((p,q)=>Math.abs(p[0]-mid)-Math.abs(q[0]-mid))[0];
  const near=cells.filter(c=>c!==b&&Math.abs(c[1]-b[1])<8&&(Math.abs(c[0]+c[2]-b[0])<12||Math.abs(b[0]+b[2]-c[0])<12)&&c[3]&&/^[A-Z]{1,3}T$|^[A-Z]\dT$/.test(c[3]));
  const pick=near.sort((p,q)=>Math.abs(p[0]-mid)-Math.abs(q[0]-mid))[0];if(pick)out[n]=pick[3];}
 return out;}
let md=`# LS 진로 목록 확인 요청 (나머지 10개 역)

사용자가 **실제 LS 화면에서 확인**해 주실 항목만 모았습니다. 시뮬레이터 구현은 GPT가 이어서 하므로(인수인계: [인수인계-GPT.md](인수인계-GPT.md)), 이 문서는 **내용 정리와 확인**용입니다. 이 문서는 \`node tools/make-verification-sheet.cjs\`로 생성합니다.

## 표기
| 표기 | 뜻 | 확인 필요 |
|---|---|---|
| ✔ | 교재(실무5 부록 A)·대본으로 확인된 진로 | 낮음(그대로 두어도 됨) |
| ○ | 장내·출발 진로 중 5개 역 목록에서 귀납한 규칙으로 「있다」고 추정 | 중간 |
| ✗ | 같은 규칙으로 「LS에 없다」고 추정한 진로 | 중간(실제로 있으면 알려 주세요) |
| ? | 입환신호기 후보. 배선상 가능한 것 전부이며 **근거 없음** | **높음** |

## 답하는 방법
역 이름 아래에 **다른 점만** 적어 주세요. 「그대로」도 괜찮습니다.
\`\`\`
용산
삭제: RT_21_1T, RT_21_2T
추가: RT_2A_BT
순서: 3A 팝업은 B605T가 먼저
신호기: 28번 없음 / 29번 있음
\`\`\`
LS 팝업을 **캡처**해 주셔도 됩니다(읽어서 목록으로 만들 수 있습니다). 입력 부담이 크면 입환신호기부터 하나씩 확인해 주세요.

## 이미 알려진 한계
- 입환 진로(258개)는 근거 자료가 없어 **전부 후보**입니다. 실제 허용 여부는 LS에서만 알 수 있습니다.
- 장내·출발 규칙(장내=구내 선로, 출발=진행 방향과 번호 짝·홀이 맞는 경계 선로)은 5개 역 38개 중 37개가 맞았고(거짓 1개), 복잡한 역에서는 미검증입니다.
- 칸 이름 도착지(BT, YT 등)는 배선 데이터에 아직 없는 경우가 있어, 아래 「칸 이름 후보」에 있는 이름이 LS 메뉴에 나오는지 알려 주세요.
- 메뉴 **순서**는 시뮬레이터 도출 순서입니다. 실제 LS와 다르면 알려 주세요.
`;
const clean=n=>/^[A-Z]{1,3}T$|^[A-Z]\dT$/.test(n);
const stats={m1:0,m2:0,m3:0,sh:0,cells:0,answered:0,signals:0};
for(const st of N.stations.filter(s=>s.controlled&&!MENUS[s.id])){
 const C=Core.forStation(st.id),def=W.data[st.id],ids=Object.keys(C.routes);
 const sigs=Object.keys(C.signals).sort(nat),main=sigs.filter(s=>C.signals[s].kind!=='입환'),shunt=sigs.filter(s=>C.signals[s].kind==='입환');
 md+=`\n---\n\n## ${st.name} (${st.id})\n\n**신호기** — 장내·출발: ${main.map(s=>s+(C.signals[s].kind==='장내'?'(장내)':'(출발)')).join(' ')} / 입환: ${shunt.join(' ')}\n→ LS와 신호기 번호가 같은지 확인해 주세요.\n\n**장내·출발 진로**\n\n`;
 for(const sig of main){const rs=ids.filter(id=>C.routes[id].signal===sig);
  const parts=rs.filter(id=>rule(C,id)).map(id=>(C.routes[id].geometryDerived?'○':'✔')+C.routes[id].destination);
  const ex=rs.filter(id=>!rule(C,id)).map(id=>'✗'+C.routes[id].destination);
  for(const id of rs){if(!rule(C,id))stats.m3++;else if(C.routes[id].geometryDerived)stats.m2++;else stats.m1++;}
  const ans=answers[st.id]?.[sig];stats.signals++;
  if(ans){stats.answered++;md+=`- ${sig}: ✅ **사용자 확인** ${ans.join(' ')}  (초안: ${[...parts,...ex].join(' ')||'없음'})\n`;}
  else md+=`- ${sig}: ${[...parts,...ex].join(' ')||'(진로 없음)'}\n`;}
 const inner=innerCells(st.id,def);
 md+=`\n**입환 진로 (미확인 후보 ?)**${Object.keys(inner).length?` — 경계 뒤 괄호는 그 경계 **안쪽 칸 이름**입니다`:''}\n\n`;
 for(const sig of shunt){const rs=ids.filter(id=>C.routes[id].signal===sig),ans=answers[st.id]?.[sig];stats.signals++;
  if(ans){stats.answered++;md+=`- ${sig}: ✅ **사용자 확인** ${ans.join(' ')}  (초안: ${rs.map(id=>'?'+C.routes[id].destination).join(' ')||'없음'})\n`;continue;}
  stats.sh+=rs.length;md+=`- ${sig}: ${rs.map(id=>'?'+C.routes[id].destination+(inner[C.routes[id].destination]?'(안쪽 '+inner[C.routes[id].destination]+')':'')).join(' ')||'(진로 없음)'}\n`;}
 const names=new Set([...def.rails.map(r=>r[0]),...def.rails.flatMap(r=>[r[3],r[4]]).filter(Boolean)]);
 const xs=def.rails.flatMap(r=>r[1].map(p=>p[0])),lo=Math.min(...xs),hi=Math.max(...xs);
 const cells=[...new Set((WG[st.id]?.cells||[]).filter(c=>c[3]&&clean(c[3])&&c[0]>=lo&&c[0]<=hi&&!names.has(c[3])).map(c=>c[3]))].sort();
 stats.cells+=cells.length;
 if(Object.keys(inner).length)md+=`\n**경계 ↔ 안쪽 칸**: ${Object.entries(inner).map(([b,c])=>b+'↔'+c).join(' / ')}\n→ 입환 팝업에서 경계(B…T) 대신 **안쪽 칸 이름**(예: 용산은 RT_23_AT처럼)이 나오는지 알려 주세요.\n`;
 md+=`\n**칸 이름 후보** (원본 이미지에서 읽은 구내 궤도 칸 이름): ${cells.join(' ')||'없음'}\n→ 이 이름을 도착지로 하는 진로(예: RT_xx_${cells[0]||'BT'})가 LS 메뉴에 있으면 알려 주세요. 없으면 그대로 두세요.\n`;
}
md+=`\n---\n\n## 규모\n사용자 확인 완료 신호기 ${stats.answered} / ${stats.signals}. 장내·출발: 교재 확인 ✔ ${stats.m1}개, 규칙 추정 ○ ${stats.m2}개, 규칙 제외 ✗ ${stats.m3}개 / 입환 후보 ? ${stats.sh}개 / 칸 이름 후보 ${stats.cells}개.\n`;
fs.writeFileSync(path.join(__dirname,'../docs/LS확인요청.md'),md);
console.log('written',md.length,'chars',stats);

// --- Capture guide: which popups to screenshot (signals not yet answered; fully-confirmed main signals are optional) ---
{
 const rows=[];let total=0,optional=0;
 for(const st of N.stations.filter(s=>s.controlled&&!MENUS[s.id])){
  const C=Core.forStation(st.id),ids=Object.keys(C.routes),need=[],opt=[],done=[];
  for(const sig of Object.keys(C.signals).sort(nat)){
   if(answers[st.id]?.[sig]){done.push(sig);continue;}
   const rs=ids.filter(id=>C.routes[id].signal===sig);if(!rs.length)continue;
   const shunt=C.signals[sig].kind==='입환',sure=!shunt&&rs.filter(id=>rule(C,id)).every(id=>!C.routes[id].geometryDerived)&&rs.every(id=>rule(C,id));
   (sure?opt:need).push(sig);}
  total+=need.length;optional+=opt.length;
  rows.push(`| ${st.name} | ${need.join(' ')||'—'} | ${opt.join(' ')||'—'} | ${done.join(' ')||'—'} |`);}
 fs.writeFileSync(path.join(__dirname,'../docs/LS캡처안내.md'),`# LS 팝업 캡처 안내

손으로 쓰지 말고 **LS 신호기 팝업(\`[ 진로 제어 ]\` 목록)을 캡처**해서 채팅에 붙여 주세요. 제가 \`tools/parse-popup-screenshots.py\`로 읽어서 확정 목록으로 만듭니다.

## 방법
1. LS에서 신호기를 클릭해 팝업이 뜬 상태로 캡처합니다(팝업만 잘라도 되고, 화면 전체도 괜찮습니다). 글자가 작지 않게 원래 크기 이상으로 찍어 주세요.
2. 한 메시지에 **역 이름을 먼저 쓰고**(예: 「노량진」) 그 역의 팝업 캡처를 여러 장 붙입니다. 순서는 상관없습니다. 한 장에 팝업 여러 개가 있어도 됩니다.
3. 팝업의 신호기 이름(\`RT_23_…\`의 23)이 보이면 충분합니다. 진로가 하나도 없는 신호기는 「23 없음」처럼 글로 알려 주세요.
4. 읽은 결과와 「확인 필요」 항목(처음 보는 칸 이름, 읽기 불확실한 글자)을 바로 돌려드립니다.

## 캡처할 신호기 (역별)
- **필수**: 입환 전체와, 장내·출발 중 규칙 추정(○)·제외(✗)가 들어 있는 신호기.
- **선택**: 교재로 확인된(✔) 장내·출발 신호기(그대로일 가능성이 높음). 시간이 없으면 건너뛰어도 됩니다.
- **완료**: 이미 답해 주신 신호기.

| 역 | 필수 | 선택 | 완료 |
|---|---|---|---|
${rows.join('\n')}

필수 ${total}개, 선택 ${optional}개. 진로 순서는 화면에 보이는 순서대로 기록합니다.
`);
 console.log('capture guide: required',total,'optional',optional);}
