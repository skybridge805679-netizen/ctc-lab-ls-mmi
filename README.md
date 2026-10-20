# CTC LAB — LS·MMI 관제 조작 연습

매뉴얼과 교육장 배선도에 맞춰 LS와 MMI 조작을 반복 연습하는 프로그램입니다. **현재 v0.4는 지하서울 기본 조작 연습판이며 전체 시험설비 재현은 아직 완성되지 않았습니다.**

[v0.4 실행본 ZIP](archive/CTC-LAB-v0.4.zip)을 내려받아 압축을 풀어도 됩니다.

## 바로 실행
저장소를 내려받고 `simulator/index.html`을 브라우저로 여세요. 빌드나 외부 라이브러리가 필요 없습니다.
로컬 서버를 쓰려면 `python3 -m http.server 8765 --directory simulator` 실행 후 http://localhost:8765/ 에 접속합니다. localhost는 실행 중인 본인 컴퓨터에서만 열립니다.

1. LS 상단 CCM → 예.
2. 3A 신호기 → RT_3A_B065T.
3. B065T–X1T–21BT 녹색 경로와 3A 진행 표시 확인.
4. 3A 재클릭 → 예: 정지·해정. 취소하면 유지.
5. MMI 진로제어에서 같은 설정·해정 연습 가능.

## 개발 검증
```sh
node simulator/core.test.cjs
node simulator/practice.test.cjs
node --check simulator/app.js
```
Playwright와 Chromium이 있는 환경에서는 `python3 simulator/browser.test.py`로 데스크톱·모바일에서 9개 과제 전체를 검증합니다. 파일 직접 실행 검증은 브라우저 정책이 허용하는 환경에서 `--include-file`을 추가합니다.

## 문서 안내
- [제작 지침](docs/제작지침.md): 목표, 고증 원칙, 구현 판단 기준
- [구현 현황](docs/구현현황.md): 작동하는 기능과 미구현 범위
- [조작 절차 체크리스트](docs/조작절차체크리스트.md): 매뉴얼 페이지별 절차와 현재 검증 범위
- [앞으로 할 일](docs/개발로드맵.md): 우선순위와 완료 조건
- [참고자료 원본·목록](references/README.md): 교재·매뉴얼·배선도·시나리오 15개와 원본 검증 정보
- [자료 근거](docs/자료근거.md): 문서 페이지와 CAI 사진의 역할
- [개발 인수인계](docs/개발인수인계.md): 구조·실행·검증·후속 작업 시작점
- [검증 기록](simulator/검증결과.md)
- [변경 이력](CHANGELOG.md)
- [백업 목록](BACKUP-MANIFEST.json)

## 백업 범위
최신 소스·필수 배선 이미지·미리보기·과거 v0.1/v0.2/v0.3 ZIP을 보존합니다. 사용자가 제공한 PDF·PPTX·HWP·HWPX 원본 15개는 [references](references/README.md)에 보존했습니다. 프로그램에 필요한 PPT 추출 배선 이미지도 포함했습니다. CAI 사진 원본과 이번 대화에 표시된 노선 PNG 4장은 아직 파일로 보관하지 못했으며, 상세 상태는 참고자료 목록에 기록했습니다.

이 저장소는 개인 학습용 비공개 백업입니다. 첨부 자료에 대한 별도 공개 재배포 허가는 부여하지 않습니다.

![v0.3 실행 화면](docs/preview-v0.3.png)
