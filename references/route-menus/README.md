# LS 진로 메뉴 목록

| 파일 | 내용 |
|---|---|
| `ls-route-menus-transcribed.txt` | 사용자가 실제 LS 팝업에서 옮기고 확인한 목록(청량리·동묘앞·종각·지하서울·서울). **확정본** |
| `ls-route-menus-draft.txt` | 나머지 10개 역의 **초안**. 장내·출발은 규칙으로 추정, 입환은 배선상 가능한 후보 전체. 틀린 항목만 지우고 확정본에 합칠 것 |

## 사용
1. 초안에서 실제 LS 팝업에 없는 진로 토큰(`RT_…`)을 지운다(빠진 진로가 있으면 추가).
2. 확정한 역을 `ls-route-menus-transcribed.txt`로 옮긴다(역 id 한 줄 + `신호기 - RT_신호기_도착지, …` 줄).
3. `node tools/build-route-menus.cjs` → `simulator/route-menus.js` 재생성(배선에서 도출되지 않는 진로가 있으면 실패하며 이유를 출력).
4. `node tools/compare-route-menus.cjs`로 도출 결과와 대조, `node simulator/route-menus.test.cjs`로 확인.

확정 목록이 없는 역은 LS 팝업이 도출된 진로 전체를 보여 준다. MMI 진로 목록은 매뉴얼 근거(지하서울 3A_B070T 등)를 위해 도출 전체를 유지한다.
