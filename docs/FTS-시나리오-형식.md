# FTS 시나리오 JSON 형식

FTS 제어통제 시스템(MMI 상단 **FTS 제어통제**)의 문제·상황·시나리오는 모두 JSON입니다. 직접 쓰거나 AI에게 이 문서를 주고 만들게 한 뒤, **시스템관리 → 붙여넣기로 가져오기 / 가져와서 합치기**로 넣습니다. 가져오기 전에 형식 검사를 하고, 하나라도 틀리면 아무것도 바꾸지 않고 틀린 곳을 알려 줍니다(없는 역·없는 진로·빠진 항목·없는 문제/상황 참조 등).

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
| `script` | (선택) 내장 대본 ID — 대본 단계 진행률로 채점: `yongsan-5`, `yongsan-4`, `yeongdeungpo-1`, `geumcheon-1`, `geumcheon-6`, `em-01`~`em-06-2`, `sch-conflict`, `sch-create` |

점수 = 배점 × (맞은 채점 점수 / 전체 채점 점수) − 감점. 발생한 감점은 조건이 해소되어도 유지합니다. 0점 배점·가중치는 그대로 보존합니다. 대본 문제는 단계와 열차 이동/대기열이 모두 끝나야 완료됩니다.

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
| `alarm` | 알람 발생 | `text` |
| `notice` | 안내 메시지 | `text` |

`createTrain.kind`로 열차종류를 선택할 수 있습니다.

## 저장·진행

데스크톱에서는 라이브러리·진행 중 교육·고정 시험지·이력이 독립 엔진에 저장됩니다. 교육 중 편집은 다음 교육에 적용됩니다. 초기 상황에 문제가 아직 없는 초안도 저장할 수 있지만 교육을 시작하려는 시나리오는 완성되어야 합니다.

## 역 ID
`cheongnyangni` 청량리 · `jegidong` 제기동 · `sinseoldong` 신설동 · `dongmyo` 동묘앞 · `dongdaemun` 동대문 · `jongno5` 종로5가 · `jongno3` 종로3가 · `jonggak` 종각 · `cityhall` 시청 · `underground-seoul` 지하서울 · `seoul` 서울 · `namyeong` 남영 · `yongsan` 용산 · `noryangjin` 노량진 · `daebang` 대방 · `singil` 신길 · `yeongdeungpo` 영등포 · `sindorim` 신도림 · `guro` 구로 · `gasan` 가산디지털 · `doksan` 독산 · `geumcheon` 금천구청 · `seoksu` 석수 · `gwanak` 관악 · `anyang` 안양 · `myeonghak` 명학 · `geumjeong` 금정 · `gunpo` 군포 · `dangjeong` 당정 · `uiwang` 의왕 · `skku` 성균관대 · `hwaseo` 화서 · `suwon` 수원

## 예
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
