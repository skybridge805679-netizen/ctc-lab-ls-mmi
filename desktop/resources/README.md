# ORPHEIA 앱 아이콘

2026-10-31 imagegen으로 제작했습니다. #BEE3E3 민트·아이보리·짙은 청록색 바탕에 오르페이아의 리라와 선로를 결합하고 금색 브리지를 더했습니다. 투명한 외곽과 둥근 타일로 Dock·작업표시줄에서 읽히는 실루엣을 우선했습니다.

- 생성 원본: `docs/assets/orpheia-app-icon-source.png` (1280×1280 RGBA, 무수정 보존)
- `icon.png`: 1024×1024, Linux 및 실행 중 Mac Dock·트레이
- `icon.ico`: Windows 16·20·24·32·40·48·64·128·256px, 32비트 알파
- `icon.icns`: Mac 16~1024px 및 Retina 표현

변환은 디자인 수정 없이 Electron nativeImage의 고품질 축소와 ICO/ICNS 포맷 인코딩만 수행합니다. 다시 생성하려면 `npx electron tools/build-app-icons.cjs`를 실행합니다. Linux 환경에서는 Xvfb가 필요할 수 있습니다. 메타데이터·해시는 `MANIFEST.json`을 확인하세요.

기존 캐릭터 엠블럼·배너·브리핑 에셋은 프로그램 내부에서 계속 사용합니다.
