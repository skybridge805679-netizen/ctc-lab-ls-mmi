# FTS 시나리오 JSON 형식

FTS 제어통제 시스템(LS 상단 **↗ FTS** · 실습 화면 → FTS 제어통제 창, Ctrl/⌘+4)의 문제·상황·시나리오는 모두 JSON입니다. 직접 쓰거나 AI에게 이 문서를 주고 만들게 한 뒤, **시스템관리 → 붙여넣기로 가져오기 / 가져와서 합치기**로 넣습니다. 가져오기 전에 형식 검사를 하고, 하나라도 틀리면 아무것도 바꾸지 않고 틀린 곳을 알려 줍니다(없는 역·없는 진로·빠진 항목·없는 문제/상황 참조 등).

## 구조

```json
{
  "problems":   [ 문제, ... ],
  "situations": [ 상황, ... ],
  "scenarios":  [ 시나리오, ... ],
  "schedules":  [ 열차 스케줄, ... ]   // 선택
}
```

### 문제
| 키 | 뜻 |
|---|---|
| `id` | 고유 ID (예: `P-101`) |
| `subject` | 과목: `철도관제시스템 운용`, `운행선 관리`, `열차 운행 계획`, `비상 시 조치` |
| `name` | 문제명칭 (교육생 화면 첫 줄) |
| `limit` | 제한시간(초) — 넘으면 `시간초과`로 끝나고 다음 문제로 |
| `score` | 배점 (기본 100) |
| `voice` | 음성 표출 문구 (없으면 문제명칭을 읽음) |
| `situation`, `actions` | 상황 · 조치사항 (교육생 화면) |
| `trigger` | 발생조건 `{"useTime":true,"at":30,"conditions":[조건,...]}` — 앞 문제가 끝나고 `at`초 뒤, 조건이 모두 맞으면 발생 |
| `phenomena` | 현상: `[{"after":0, "type":..., ...}]` — 문제 시작 `after`초 뒤에 시스템이 일으킴 |
| `checks` | 채점 항목: `[{"label":"...","points":1,"condition":조건}]` — 모두 맞으면 `완료` |
| `deductions` | 감점사항: `[{"label":"...","points":10,"condition":조건}]` |
| `setup` | (능동형) 초기 상태 — 문제가 시작될 때 LS에 한 번 적용 (아래) |
| `objectives` | (능동형) 순서 없는 목표 `[{"id","label","condition","points","deadline","final","optional","hint"}]` |
| `communications` | (능동형) 통보·지시 `[{"id","label","text","points","deadline"}]` — 교수가 모니터링에서 확인 |
| `reactions` | (능동형) 상황 반응 `[{"id","label","when":조건,"after":초,"do":[현상,...]}]` |
| `script` | (선택) 내장 대본 ID — 대본 단계 진행률로 채점: `sch-conflict`, `sch-create` (부본선 대피·비상시 조치 대본도 쓸 수 있지만 기본 라이브러리는 아래 능동형 데이터 문제를 씁니다) |

점수 = 배점 × (얻은 점수 / 전체 점수) − 감점. 전체 점수는 채점 항목 + 목표 + 통보의 점수 합입니다. 발생한 감점은 조건이 해소되어도 유지합니다. 0점 배점·가중치는 그대로 보존합니다. 대본 문제는 단계와 열차 이동/대기열이 모두 끝나야 완료됩니다.

### 능동형 문제 (순서 없는 목표)

실제 교육훈련기관의 실기처럼, **무엇을 먼저 지시하고 조작할지는 관제사가 상황을 보고 판단**하도록 만든 형식입니다. 대본의 순서는 `actions`(조치사항)에 '참고 순서(예시)'로만 남기고, 채점은 순서를 보지 않습니다.

- **목표(`objectives`)**: 조건이 한 번이라도 맞으면 그 시각으로 달성 기록(래치)합니다. 순서는 상관없습니다.
  - `final: true` — 문제가 끝날 때 그 상태여야 하는 목표(예: AUTO 복귀). 매 순간 다시 확인하므로 중간에 풀리면 미달성으로 돌아갑니다.
  - `deadline` — 문제 시작 후 초. 넘겨서 달성하면 점수 절반.
  - `optional: true` — 점수에는 들어가지만 완료 판정에는 필요 없음.
  - 꼭 필요한 순서만 조건으로 묶습니다: `{"type":"all","conditions":[{"type":"objective","id":"rename-G0606"}, 조건]}` = rename-G0606 목표가 먼저 이루어져야 인정. (문제관리 화면의 **선행 목표**)
- **통보·지시(`communications`)**: 교육생이 말로 하는 지시·통보. 모니터링 화면의 [확인]으로 교수가 체크하며, 순서는 없습니다(조건 키 `comm:<id>`).
- **상황 반응(`reactions`)**: `when` 조건이 처음 맞은 시각(없으면 문제 시작)부터 `after`초 뒤에 `do`의 현상을 한 번 일으킵니다. 교육생의 판단·조작에 따라 상황이 움직이게 하는 장치입니다(예: 구원열차 번호를 바꾸면 그 열차가 접근, 통보를 하면 후속열차가 진로를 기다려 출발).
- **초기 상태(`setup`)**: `{"reset":[역],"clear":[열차번호],"routes":[{"station","route"}],"approach":[{"station","signal"}],"modes":[{"station","value"}],"trains":[{"station","slot","number","direction"}]}` — 이 순서로 적용합니다(역 초기화 → 지울 번호 → 진로 → 접근 열차 → 제어모드 → 열번 표시).
- 완료 = 채점 항목 모두 + 필수 목표·통보 모두. 목표·통보·채점 항목·대본 중 하나는 있어야 합니다.

**기본 라이브러리**: 부본선 대피 5종(`P-yongsan-5` …)과 비상시 조치 9종(`P-em-01` … `P-em-06-2`)은 대본을 이 형식으로 바꾼 데이터 문제입니다(`simulator/engine/fts-builtins.js`). 대본의 조작 단계 = 목표, 말하는 단계 = 통보, 단계 뒤의 열차 이동·번호 변화 = 상황 반응, 대본 시작 LS = 초기 상태. 모든 문제가 대본과 다른 순서로 조작해도 완료되는지 시험합니다(`simulator/engine/fts-builtins.test.cjs`). 응용 문제는 문제관리에서 기본 문제를 **복사 (응용)** 한 뒤 목표·통보·반응·초기 상태를 고쳐 만듭니다.

### 상황
`{"id":"S-1","name":"상황명칭","section":"지하청량리-수원","scheduleId":"01201","limit":600,"problems":["P-101","P-102"]}`
— `scheduleId`가 `schedules`에 있으면 상황이 시작될 때 그 열차 스케줄을 온라인 시간표로 불러옵니다. 없으면 지금 시간표를 씁니다. `limit`가 0보다 크면 상황 시작부터 발생조건 대기를 포함한 전체 시간제한이며, 만료 시 해당 상황의 진행·대기 문제를 시간초과로 처리합니다.

### 시나리오
`{"id":"SC-1","name":"시나리오 이름","author":"C001","createdAt":"2026-10-30 12:00:00","situations":["S-1","S-2"]}`

### 열차 스케줄
`{"id":"01201","name":"스케줄명","section":"지하청량리-수원","timetable":{"serviceDate":"2026-10-30","trains":[...]}}` — `trains`는 시간표 JSON(실습 화면 → 시간표 JSON 저장)의 열차 형식. 상황 관리의 [편집 적용]으로 지금 시간표에서 만드는 것이 가장 쉽습니다.

## 조건 (발생조건 · 채점 · 감점)
| type | 뜻 | 필수 키 |
|---|---|---|
| `mode` | 역제어모드 | `station`, `value` |
| `route` | 진로 설정 | `station`, `route` |
| `signalStop` | 신호 정지 | `station`, `signal` |
| `point` | 선로전환기 | `station`, `point`, `value` |
| `trainAt` | 열번창 열차번호 | `number`, `station` |
| `trainGone` | 열차번호 없음 | `number` |
| `trainExists` | 스케줄 열차 있음 | `train` |
| `trainMissing` | 스케줄 열차 없음 | `train` |
| `schedule` | 스케줄 값 | `train`, `station`, `field`, `value` |
| `cancelled` | 구간 운휴/운행 | `train`, `from`, `to` |
| `windowOpen` | MMI 창 열림 | `window` |
| `graphTrain` | 그래프 열차 선택 | `train` |
| `event` | 조작 기록 | `eventType` |
| `signalCancelled` | 신호 취소 조작 (정지·진로 취소 조작을 함) | `station`, `signal` |
| `failedOp` | 거부된 조작 (연동 조건 위반 등) — `count`회 이상 | (`count`, `station`, `eventType`) |
| `objective` | 목표 달성 (같은 문제의 목표 id) | `id` |
| `communication` | 통보 확인 (같은 문제의 통보 id) | `id` |
| `elapsed` | 경과시간 | `seconds` |
| `script` | 대본 단계 완료 |  |
| `manual` | 교수 확인 (구술) | `label` |
| `all` | 모두 | `conditions` |
| `any` | 하나 이상 | `conditions` |
| `not` | 아님 | `condition` |

덧붙일 수 있는 키: `trainAt.slot`(열번창), `trainExists.from/to/start`(시발·종착·출발시각 HH:MM:SS), `cancelled.value`(false면 부활운행), `event.station/id/value`, `script.steps`, `manual.key`.
- `mode.value`: `CCM`·`AUTO`·`LOCAL` · `point.value`: `N`(정위)·`R`(반위)
- `schedule.field`: `dwell`(정차시분, 초) · `arrival`/`departure`(HH:MM:SS) · `arrivalRoute`/`departureRoute`(예 `1B_3T`) · `cancelled`
- `event.eventType`: 현재 문제가 시작된 뒤의 실제 MMI·LS 조작 종류 — `mode`, `route`, `stop`, `withdraw`, `point`, `lsOperation`, `schedule` 등
- `route`는 역의 진로표에 있는 ID만 됩니다 (예: 용산 `2A-5T`). 진로 이름은 LS 진로 메뉴와 같습니다.

## 현상
| type | 뜻 | 필수 키 |
|---|---|---|
| `insertTrain` | 열번창 열차번호 표시 | `station`, `slot`, `number`, `direction` |
| `deleteTrain` | 열차번호 지우기 | `number` |
| `route` | 진로 설정 | `station`, `route` |
| `mode` | 역제어모드 | `station`, `value` |
| `approach` | 접근 열차 | `station`, `signal` |
| `createTrain` | 스케줄 열차 생성 | `train`, `from`, `to`, `start` |
| `delay` | 열차 지연 | `train`, `station`, `minutes` |
| `cancel` | 구간 운휴 | `train`, `from`, `to` |
| `moveTrain` | 열차번호 즉시 이동 | `number`, `station`, `slot` |
| `runTrain` | 열차 운행 — 진로가 설정되기를 기다려 구간마다 이동 | `number`, `legs:[{"station","slot","handover"}]`, (`exit`) |
| `resetStation` | 역 상태 초기화 | `station` |
| `alarm` | 알람 발생 | `text` |
| `notice` | 안내 메시지 | `text` |

`createTrain`: `kind`로 열차종류, 출발시각은 `start`(HH:MM:SS) 또는 `startIn`(지금부터 초, 음수 가능), `replace:true`면 같은 번호 스케줄을 지우고 새로 만듭니다(재로딩해도 오류 없이). `runTrain.legs`의 `handover:true`는 이웃 역 LS로 넘어가는 구간, `exit:true`는 마지막에 화면 밖으로 나감.

## 저장·진행

데스크톱에서는 라이브러리·진행 중 교육·고정 시험지·이력이 독립 엔진에 저장됩니다. 교육 중 편집은 다음 교육에 적용됩니다. 초기 상황에 문제가 아직 없는 초안도 저장할 수 있지만 교육을 시작하려는 시나리오는 완성되어야 합니다.

## 역 ID
`cheongnyangni` 청량리 · `jegidong` 제기동 · `sinseoldong` 신설동 · `dongmyo` 동묘앞 · `dongdaemun` 동대문 · `jongno5` 종로5가 · `jongno3` 종로3가 · `jonggak` 종각 · `cityhall` 시청 · `underground-seoul` 지하서울 · `seoul` 서울 · `namyeong` 남영 · `yongsan` 용산 · `noryangjin` 노량진 · `daebang` 대방 · `singil` 신길 · `yeongdeungpo` 영등포 · `sindorim` 신도림 · `guro` 구로 · `gasan` 가산디지털 · `doksan` 독산 · `geumcheon` 금천구청 · `seoksu` 석수 · `gwanak` 관악 · `anyang` 안양 · `myeonghak` 명학 · `geumjeong` 금정 · `gunpo` 군포 · `dangjeong` 당정 · `uiwang` 의왕 · `skku` 성균관대 · `hwaseo` 화서 · `suwon` 수원

## 예 (채점 항목형)
```json
{"problems":[{"id":"AI-1","subject":"운행선 관리","name":"용산역 2A-5T 장내 진로를 설정하시오","limit":60,
  "situation":"용산역 상선 부본선 진입 준비","actions":"CCM 전환 → 2A → RT_2A_5T",
  "phenomena":[{"after":0,"type":"insertTrain","station":"yongsan","slot":"B607T","number":"A1002","direction":"up"}],
  "checks":[{"label":"CCM 전환","condition":{"type":"mode","station":"yongsan","value":"CCM"}},
              {"label":"2A-5T 진로","points":2,"condition":{"type":"route","station":"yongsan","route":"2A-5T"}}],
  "deductions":[{"label":"2A-7T 오취급","points":20,"condition":{"type":"route","station":"yongsan","route":"2A-7T"}}]}],
 "situations":[{"id":"AI-S1","name":"용산 부본선 연습","section":"용산-수원","limit":120,"problems":["AI-1"]}],
 "scenarios":[{"id":"AI-C1","name":"AI 연습 시나리오","situations":["AI-S1"]}]}
```

## 예 (능동형)
```json
{"problems":[{"id":"AI-2","subject":"운행선 관리","name":"용산역 상선 고장열차를 5번 부본선으로 대피시키시오","limit":600,
  "situation":"A1002열차 차량고장 · 후속 A1004 접근","actions":"참고 순서(예시): CCM → 2A 취소 → 통보 → 2A-5T → AUTO",
  "setup":{"reset":["yongsan"],"clear":["A1002","A1004"],"routes":[{"station":"yongsan","route":"2A-7T"}],"approach":[{"station":"yongsan","signal":"2A"}],
           "modes":[{"station":"yongsan","value":"AUTO"}],"trains":[{"station":"yongsan","slot":"B607T","number":"A1002","direction":"up"}]},
  "objectives":[{"id":"stop-2A","label":"2A 신호 취소","condition":{"type":"signalCancelled","station":"yongsan","signal":"2A"},"points":2,"deadline":60},
                {"id":"route-5T","label":"2A-5T 장내","condition":{"type":"route","station":"yongsan","route":"2A-5T"},"points":2},
                {"id":"auto","label":"AUTO 복귀","final":true,"condition":{"type":"all","conditions":[{"type":"event","eventType":"mode","station":"yongsan","value":"AUTO"},{"type":"mode","station":"yongsan","value":"AUTO"}]}}],
  "communications":[{"id":"c1","label":"후속열차 주의운전 통보","text":"후속열차, 관제 이상! 선행열차 용산역 부본선 대피 대기중입니다."}],
  "reactions":[{"id":"r1","label":"후속열차 접근","when":{"type":"communication","id":"c1"},"after":30,
                "do":[{"type":"insertTrain","station":"yongsan","slot":"B607T","number":"A1004","direction":"up"}]},
               {"id":"r2","label":"고장열차 부본선 진입","when":{"type":"objective","id":"route-5T"},
                "do":[{"type":"runTrain","number":"A1002","legs":[{"station":"yongsan","slot":"5T"}]}]}],
  "deductions":[{"label":"거부된 조작 3회 이상","points":10,"condition":{"type":"failedOp","count":3}}]}],
 "situations":[{"id":"AI-S2","name":"용산 대피 (능동형)","limit":600,"problems":["AI-2"]}],
 "scenarios":[{"id":"AI-C2","name":"능동형 연습","situations":["AI-S2"]}]}
```
