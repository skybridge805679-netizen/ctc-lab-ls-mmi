# ORPHEIA CTC LAB — LS·MMI 관제 실습

철도관제 실기 교재·매뉴얼과 교육장 배선도를 바탕으로, **LS(현장 표시반)와 MMI 조작, FTS 교육·평가**를 한 프로그램에서 반복 연습하는 데스크톱 앱입니다. 인터넷 없이 실행됩니다.

## 설치

[최신 릴리즈](https://github.com/skybridge805679-netizen/ctc-lab-ls-mmi/releases/latest)에서 내려받습니다.

| 운영체제 | 파일 |
|---|---|
| Windows | `…win-x64.exe` |
| Mac (Apple 실리콘) | `…mac-arm64.dmg` |

코드 서명·Apple 공증이 없어 처음 실행할 때 경고가 뜰 수 있습니다. Windows는 「추가 정보 → 실행」, Mac은 앱을 우클릭 → 「열기」로 실행하세요. 바뀐 내용은 [변경 이력](CHANGELOG.md)에 있습니다.

## 주요 기능

**LS (현장 표시반)**
- 청량리~수원 15개 취급역과 역간 화면을 코드로 그린 배선 (원본 화면 좌표 대조)
- CCM·AUTO·LOCAL 제어모드, 진로 설정·취소, 신호 정지, 선로전환기, TTB
- 연동: 진로 경합·오버랩·접근쇄정(장내 90초·출발 30초)
- 열번창 입력·수정·삭제·이동·교환, 열차 점유·이동 표시
- LS 창을 여러 개 띄워도 하나의 엔진을 공유

**MMI**
- 현장설비제어, 알람, 운행정보·열차추적, 시스템 조회
- 온라인 열차스케줄 관리·운행패턴, T/G(열차 그래프), 로그 재생
- 열차 자동제어(AUTO): 스케줄 진로만 자동으로 냄

**FTS (교육·평가)**
- 교수·교육생 교육설정, 문제 발생 화면, 시간 제한, 자동 채점, 교육이력
- 비상시 조치 9개·대피 5개 시나리오: 대본 통보 확인, 실제 열차 운행(구원·운행선 변경·회송), 상황 변경 주입
- 실기 구술 문항과 [운행선관리 구술](docs/운행선관리-구술.md)
- **원격 조작**: 같은 네트워크의 휴대폰·PC 브라우저에서 QR·PIN으로 접속. 휴대폰은 리모컨(교육 시작, 통보·구술 확인, 상황 변경, 문제 종료)

## 개발

```sh
npm install
npm start                # 데스크톱 앱 실행
npm test                 # 엔진·화면 단위 시험
npm run test:desktop     # Electron 통합 시험 (리눅스는 xvfb-run -a 와 함께)
```

- `simulator/engine/` — 관제 엔진(연동·운행·시나리오·FTS). 별도 프로세스에서 실행
- `simulator/ui/` — LS·MMI·FTS 화면
- `desktop/` — Electron 셸, 원격 조작 서버
- `simulator/tools/audit-scenarios.cjs` — 비상 시나리오를 대본 순서대로 자동 실행해 멈춘 열차·접근쇄정 판정을 점검
- main에 새 버전(`package.json`)이 올라가면 [GitHub Actions](https://github.com/skybridge805679-netizen/ctc-lab-ls-mmi/actions/workflows/desktop.yml)가 Windows·Mac 설치 파일을 빌드해 릴리즈를 만들고, 최신 5개만 남깁니다. 패치노트 규칙은 [AGENTS.md](AGENTS.md)를 따릅니다.

## 문서

- [제작 지침](docs/제작지침.md) · [구현 현황](docs/구현현황.md) · [개발 로드맵](docs/개발로드맵.md)
- [구조: 엔진과 화면](docs/구조-엔진과-화면.md) · [개발 인수인계](docs/개발인수인계.md)
- [접근쇄정과 오버랩](docs/접근쇄정과오버랩.md) · [시나리오 검수](docs/시나리오-검수.md) · [FTS 시나리오 형식](docs/FTS-시나리오-형식.md)
- [조작 절차 체크리스트](docs/조작절차체크리스트.md) · [자료 근거](docs/자료근거.md)
- [참고자료 목록](references/README.md) · [변경 이력](CHANGELOG.md)

개인 학습용 저장소입니다. 첨부 자료의 공개 재배포는 허가하지 않습니다.
