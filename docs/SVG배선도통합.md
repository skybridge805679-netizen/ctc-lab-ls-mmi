# v0.9.0 SVG 배선도 통합

Claude의 `1fefa75`(그 이전 접근쇄정·오버랩 `fb86c23` 포함)와 GPT 작업을 통합했다. 원본 PDF와 PPTX는 참고 자료로 보존하며 LS 런타임은 이미지를 읽지 않는다.

## 표시 데이터와 상태

- `wiring.js`: 15개 취급역 선로 연결, 신호기 246개, 전환기 그룹 118개, 연습 경로 621개.
- `wings.js`: Claude가 추출한 구내 및 관할 중간역 구간의 초기 자료.
- `schematic-source.json`: GPT가 별도로 추출한 PDF 2–4쪽의 수평 궤도 칸·승강장 목록. 원시 OCR 후보와 좌표를 함께 보존한다.
- `schematic-details.js`: 두 추출 결과를 결합한 표시 데이터. 관할 경계를 적용하고, 첫 추출에서 빠진 긴 6T·7T 등의 칸을 보완한다. 730개 구간 레코드가 있으며 조작 가능한 궤도회로의 수를 뜻하지 않는다.
- `ls-view.js`: 궤도 칸·이름, 구내 및 중간역 승강장, 신호기·전환기 명칭 및 상태, 캡슐 표시, SP/SS 표지를 SVG로 렌더링한다. 전환기 분기 상태는 선형 표시와 이름표로 표시하며 LS 조작 버튼은 없다. MMI의 전환기 제어는 유지한다.
- `core.js`: 진로 설정·점유·통과·정지·접근쇄정의 한 상태를 LS, MMI, 진로 현황판이 공유한다. 장치명 N1/N2/C/REC/UPS/ShP/EIS1/EIS2/DTS1/DTS2/RC는 보존하고 통신 상태를 임의로 진행·정상으로 표시하지 않는다.

표시 범위는 청량리–제기동, 동묘앞–신설동·동대문·종로5가·종로3가, 종각–시청, 서울–남영, 노량진–대방·신길, 영등포–신도림, 구로–가산디지털·독산, 금천구청–석수·관악, 안양–명학, 군포–당정, 의왕–성균관대·화서를 포함한다. 지하서울·용산·금정·수원도 개별 화면으로 전환한다. 스케줄은 33개 역을 유지한다.

## 대조 및 수정

15개 역 캡처를 `docs/preview-v0.9.0-*.png`로 남긴다. 원본과 대조하면서 구내 승강장, 금정의 제어 대상이 아닌 통과 선로, 긴 구내 궤도 칸, SP/SS 표지와 캡슐 표시 누락을 보완했다. 구로 `T1T`는 원본의 `YT1T`, `OT`는 `DT`, 금천구청 `54TIT`는 `54T1T`, 의왕 `OT`는 `DT`로 확인해 보정했다. 두 번째 추출의 `TT`·`IT`·`OT` 후보 6개 구간도 원본 확대본에서 6T·55T·4T 또는 무기명 구간으로 확인했다. `BOO1T`, `BO14T`, `XIT` 등 문자/숫자 혼동도 정규화한다. OCR 후보는 원본 파일과 원시 데이터에 보존한다.

자동 추출만으로 모든 미세 표기와 캡슐 표시의 의미까지 검증했다는 뜻은 아니다. 원본의 무기명 칸에 임의 번호를 붙이지 않으며, 이름 없는 구간은 내부 키로 관리한다. SP/SS는 원본 표지로 표시하고 별도 안전 설비의 제어 동작을 만들지 않는다. 실제 연동표·측방방호·과주여유거리 계산·궤도별 열차 추적은 구현 완료 범위가 아니다.

## 연동 보완

기존 오버랩이 잡힌 후 반대 위치를 요구하는 새 진로를 설정할 때도 경합을 거부한다. 금천구청 2B-6T ↔ 3A-B963T, 1B-1T ↔ 4B-B968T의 양쪽 설정 순서를 검증한다. 일부 진로가 이미 접근쇄정 중인 상태에서 일괄정지를 해도 기존 해정 시각을 뒤로 미루지 않는다.

## 생성과 검증

추출 도구만 Pillow·numpy·scipy와 시스템 tesseract를 사용한다. 앱 실행은 정적 HTML/JS만 필요하다.

```sh
python3 tools/extract-schematic.py
python3 tools/build-schematic-details.py
for t in core practice network schedule wiring interlocking station-views ls-view; do node simulator/$t.test.cjs; done
python3 simulator/ls.browser.test.py
python3 simulator/schematic.browser.test.py
python3 simulator/browser.test.py
python3 simulator/network.browser.test.py
python3 simulator/interlocking.browser.test.py
```

Claude의 `tools/extract-wings.py`는 OpenCV·RapidOCR가 별도로 필요하다. 재생성 시 OCR 결과를 원본과 대조하고 세부 데이터를 다시 결합한다.
