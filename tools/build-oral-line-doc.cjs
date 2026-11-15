'use strict';
// docs/운행선관리-구술.md 를 simulator/engine/oral-line.js 에서 만든다 (FTS 문제와 같은 데이터)
const fs=require('fs'),path=require('path'),O=require('../simulator/engine/oral-line.js');
const mark=i=>[...i.tags.filter(t=>['기출','신출','예상'].includes(t)),...(i.tags.some(t=>/차$/.test(t))?['26년 '+i.tags.filter(t=>/차$/.test(t)).join('·')]:[])].join(' · ');
const asked=i=>i.tags.some(t=>/차$/.test(t)),count=i=>i.tags.filter(t=>/차$/.test(t)).length;
let md=`# 열차운행선 관리 — 구술 대비\n\n`;
md+=`근거: ${O.source}. 쪽수는 관제자격증명 표준교재 「도시철도·철도 열차운행선 관리」 기준(요약에 적힌 값).\n`;
md+=`FTS에서는 \`#3-열차운행선관리-구술 전체\`(${O.items.length}문항), \`(26년 출제)\`(${O.items.filter(asked).length}문항), \`(예상·신출)\`(${O.items.filter(i=>i.tags.includes('예상')||i.tags.includes('신출')).length}문항)으로 풀 수 있다.\n\n`;
md+=`- **기출** · **신출**: 요약의 표시 그대로\n- **26년 1차·2차·3차**: 2026년 회차별 출제 표시\n- **예상**: 요약에서 점선 상자로 표시된, 아직 회차 표시가 없는 문항\n- ※ 교재 원문과 요약이 다른 곳은 따로 적었다(일부만 대조함)\n\n`;
md+=`## 먼저 볼 것 — 26년 세 회차 모두 나온 문항\n\n`+O.items.filter(i=>count(i)===3).map(i=>`- ${i.q.replace(/\s*\(.*\)$/,'')} (교재 ${i.page||'—'}쪽)`).join('\n')+'\n\n';
md+=`## 예상 문항 (점선 상자)\n\n`+O.items.filter(i=>i.tags.includes('예상')).map(i=>`- ${i.q} (교재 ${i.page||'—'}쪽)`).join('\n')+'\n\n';
for(const ch of O.CHAPTERS){const list=O.items.filter(i=>i.ch===ch);if(!list.length)continue;
 md+=`## ${ch}\n\n`;
 for(const i of list){md+=`### ${i.q}\n\n`;const m=mark(i);md+=`${m?`**${m}**`:'출제 표시 없음'} · 교재 ${i.page||'—'}쪽${i.pageFound?' (요약에 없어 교재에서 찾은 쪽)':''}\n\n`;md+=i.a.map(x=>/^\s/.test(x)?`  ${x.trim()}`:x).map(x=>`> ${x}`).join('  \n')+'\n\n';if(i.note)md+=`※ ${i.note}\n\n`;}}
fs.writeFileSync(path.join(__dirname,'..','docs','운행선관리-구술.md'),md);
console.log('docs/운행선관리-구술.md',O.items.length,'문항');
