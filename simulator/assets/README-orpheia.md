# ORPHEIA 디자인 에셋

기본 실행은 [orpheia/](orpheia/README.md)의 생성 PNG 3종을 로컬에서 사용한다. 원형 엠블럼은 브랜드·창·favicon, 투명 캐릭터는 MMI 대기 배경·가이드, 배너는 헤더에 적용한다. 네트워크나 외부 폰트/CDN이 필요 없다.

MMI 대기 캐릭터만 사용자 이미지로 바꾸려면 `mmi.js` 전에 `window.SimMMITheme = {mascotUrl: 'assets/custom-guide.png'}`를 지정한다. 파일을 함께 배포해야 한다. 기본 에셋은 전부 실행 ZIP에 포함한다. 생성 출처와 원본 PNG 해시는 `orpheia/MANIFEST.json`을 따른다.
