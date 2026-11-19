# ORPHEIA 앱 아이콘

2026-11-19 오르페이아 크레스트로 바꿨습니다. 크레스트는 NovelAI V5로 만든 시안(리본을 단 추상 리라 + 날카로운 붓 획, `docs/assets/orpheia-crest-source.png`)을 민트색으로 바꿔, 짙은 청록 둥근 타일에 얇은 금색 안쪽 선과 함께 얹었습니다. 바깥은 투명합니다.

- 아이콘 원본: `docs/assets/orpheia-app-icon-source.png` (1280×1280 RGBA)
- `icon.png`: 1024×1024, Linux 및 실행 중 Mac Dock·트레이
- `icon.ico`: Windows 16·20·24·32·40·48·64·128·256px, 32비트 알파
- `icon.icns`: Mac 16~1024px 및 Retina 표현

다시 만들려면 `npx electron tools/build-app-icons.cjs` (Linux는 `xvfb-run -a … --no-sandbox`). 메타데이터·해시는 `MANIFEST.json`.
앱 안의 크레스트(투명 PNG, 짙은 청록 선): `simulator/assets/orpheia/crest.png` — MMI 첫 화면.
