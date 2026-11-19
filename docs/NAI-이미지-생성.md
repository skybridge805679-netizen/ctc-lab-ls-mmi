# NAI 이미지 생성 (NovelAI Diffusion)

주인님 기본 세팅과 생성 통로, 프롬프트·i2i·인페인트 정리. **따로 말씀이 없으면 모든 생성은 아래 기본 세팅을 쓴다** (`tools/nai/preset.json`).

## 기본 세팅 (2026-11-19 주인님 지정)

| 항목 | 값 |
|---|---|
| 모델 | V5 Full (`nai-diffusion-5-full`) · Anime 모드 · Effort High |
| 스텝 · 가이던스 · 샘플러 | 28 · 5 · Euler Ancestral (`k_euler_ancestral`, 노이즈 스케줄 karras) |
| 퀄리티 태그 | Standard (V5: 프롬프트 끝에 `, very aesthetic, masterpiece, no text`) |
| UC 프리셋 | None (프리셋 문구를 붙이지 않음) |
| 크기 | 832×1216 (세로) — 따로 정하지 않으면 |

**프롬프트 (앞에 붙이는 기본)**
```
1.5::artist:tsunako::, 0.7::artist:mishima kurone, artist:toosaka asagi, artist:takeshima eku::, year 2026, 0.1::neptune (sereis)::, 0.1::date a live::, {best quality, very aesthetic, best details, highres, amazing quality, high complexity}, -6::artist collaboration::, 
```
**UC**
```
worst quality, bad quality, displeasing, very displeasing, lowres, bad anatomy, bad perspective, bad proportions, bad aspect ratio, bad face, long face, bad teeth, bad neck, long neck, bad arm, bad hands, bad ass, bad leg, bad feet, bad reflection, bad shadow, bad link, bad source, wrong hand, wrong feet, missing limb, missing eye, missing tooth, missing ear, missing finger, extra faces, extra eyes, extra eyebrows, extra mouth, extra tongue, extra teeth, extra ears, extra breasts, extra arms, extra hands, extra legs, extra digits, fewer digits, cropped head, cropped torso, cropped shoulders, cropped arms, cropped legs, mutation, deformed, disfigured, unfinished, chromatic aberration, text, error, jpeg artifacts, watermark, scan, scan artifacts, 
```
- Anime 모드 = 데이터셋 태그 없음 (Furry 모드는 `fur dataset`으로 시작). Effort High = 전체 스텝 모델(`-full`). 「Medium Effort」는 `nai-diffusion-5-full-medium`(14스텝 고정).
- 기본 프롬프트의 구성: 작가 태그(가중치로 화풍 섞기) → `year 2026`(최신 화풍) → 작품 태그 0.1(아주 약한 분위기) → `{퀄리티 태그}` → `-6::artist collaboration::`(여러 작가 섞인 그림 느낌 제거). 장면·인물 태그는 이 뒤에 붙인다.

## 생성 통로 (GitHub Actions)
토큰은 저장소 시크릿 `NAI_TOKEN`이라 Actions 안에서만 쓸 수 있다.
1. `nai/requests/<이름>.json` 을 만들어 `claude/**` 브랜치에 올린다.
2. 「NAI image」 워크플로(`.github/workflows/nai-image.yml`)가 `tools/nai/generate.mjs`로 생성한다.
3. 결과는 **`nai-images` 브랜치** `out/<이름>/image_0.png` (+ `request.json` 요청 기록, `done.json` 시드·시간). 이미 만든 이름은 건너뛴다.
4. 로그에 구독 등급·Anlas 잔액을 앞뒤로 찍는다 (토큰은 찍지 않는다).

요청 예:
```json
{ "name": "orpheia-maid-01", "prompt": "1girl, solo, long hair, silver hair, green eyes, maid, maid headdress, smile, upper body, simple background" }
```
| 키 | 뜻 |
|---|---|
| `prompt` / `negative` | 기본 프롬프트·UC **뒤에** 붙는 말. `"base": false`면 기본을 붙이지 않음 |
| `width` `height` `seed` `n` `steps` `scale` | 생략하면 기본 세팅 |
| `characters` | `[{ "prompt": "...", "uc": "...", "center": {"x":0.3,"y":0.5} }]` 캐릭터별 프롬프트 (V5 최대 32) |
| `action` | `generate`(기본) · `img2img` · `infill`(인페인트) · `balance`(잔액만 확인) |
| `image` `strength` `noise` | i2i·인페인트 원본(저장소 안 경로), 바꾸는 정도, 추가 노이즈 |
| `mask` `addOriginal` | 인페인트 마스크(흰색 = 다시 그릴 곳), 원본 보존(기본 true) |

**무료 범위 (Opus 구독)**: 한 번에 1장, 28스텝 이하, 가로×세로 1,048,576픽셀(1024×1024) 이하, 원본 이미지 없음 → 0 Anlas. 832×1216·1216×832는 무료, 1024×1536은 약 45 Anlas. i2i·인페인트는 Anlas가 든다. 동시에 여러 장을 요청하면 429(잠금)라 한 장씩 6초 간격.

## API 요약 (공식 문서가 공개돼 있지 않아 커뮤니티 SDK·실측 기준)
- `POST https://image.novelai.net/ai/generate-image` · `Authorization: Bearer pst-…` · 응답은 zip(`image_0.png`, PNG 메타데이터에 프롬프트 기록). 스트림은 `/ai/generate-image-stream`.
- 본문: `input`(프롬프트), `model`, `action`, `parameters`. V5는 `v4_prompt`·`v4_negative_prompt`가 **꼭** 있어야 한다 (없으면 500).
- `v4_prompt = { caption: { base_caption, char_captions: [{ char_caption, centers: [{x,y}] }] }, use_coords, use_order }`
- 모델: `nai-diffusion-5-full` · `-full-medium` · `-curated` · 인페인트 `nai-diffusion-5-full-inpainting` (V5 Curated 인페인트는 4.5 Curated 인페인트 모델).
- V5 UC 프리셋 번호: 0 Heavy · 1 Light · 2 Furry · 3 Human · 4 None.
- 잔액: `GET https://image.novelai.net/user/subscription`.

## 프롬프트 문법 (V4~V5)
- **태그는 쉼표로 구분**, 영어 Danbooru 태그 위주(`1girl`, `long hair`, `looking at viewer`). 앞쪽 태그일수록 영향이 크다.
- **가중치**: `1.5::태그::` (숫자 배율, 여러 태그 묶기 가능 `0.7::a, b::`), `{태그}` ×1.05씩, `[태그]` ÷1.05씩. **음수 가중치** `-1::태그::`는 그 요소를 빼는 방향(UC에 넣는 것보다 강하고 국소적).
- **작가 태그** `artist:이름` — 가중치로 섞어 화풍을 만든다. `year 2026`처럼 연도 태그로 시대 화풍.
- **퀄리티·미감 태그**: `best quality`, `very aesthetic`, `masterpiece`, `amazing quality`. V5는 복잡도 태그(`low/medium/high/ultra complexity`)가 있다.
- **글자**: V5는 `Text: 문구` 로 그림 속 글자를 지정 (자동 텍스트는 따옴표 안 문구를 `, teXt:`로 붙임).
- **캐릭터 프롬프트**: 기본 프롬프트에는 장면·배경·구도·화풍, 캐릭터 칸에는 각 인물의 외모·옷·표정. 위치는 5×5 격자(A~E × 1~5, x·y 0.1~0.9). 상호작용은 `source#hug`, `target#hug`, `mutual#holding hands` 처럼 캐릭터 칸에 접두어.
- **UC**: 원하지 않는 것. 기본 UC는 손·해부학·잘림·워터마크 계열을 넓게 막는다. 특정 그림에서만 빼고 싶은 건 음수 가중치가 낫다.
- 같은 시드 + 같은 설정 = 같은 그림. 시드를 고정하고 태그 하나씩 바꿔 비교한다.

## i2i (Image2Image)
- 원본 그림을 바탕으로 다시 그린다. **strength**(0.01~0.99, V5 기본 0.7): 높을수록 많이 바뀜 — 구도만 살리기 0.6~0.8, 디테일·화풍만 다듬기 0.3~0.5. **noise**(0~0.99): 새 디테일을 더 만든다(0~0.1부터).
- 원본은 생성 크기로 맞춰진다 → 같은 비율로 준다. 프롬프트는 원본에 실제로 있는 것을 적어야 엉뚱하게 안 바뀐다.
- 쓰임: 스케치·러프 → 완성, 같은 구도로 화풍만 바꾸기, 업스케일 뒤 디테일 다시 그리기(낮은 strength).

## 인페인트 (Inpaint)
- 마스크로 칠한 곳만 다시 그린다 (흰색 = 다시 그림, 검정 = 그대로). 인페인트 전용 모델(`-inpainting`).
- 마스크는 고칠 곳보다 **조금 넉넉하게**(경계가 자연스럽게). 손·얼굴·소품 고치기, 표정 바꾸기, 물건 넣고 빼기.
- 프롬프트는 **그림 전체**를 설명한다(고칠 부분만 적지 않음). 고칠 부분 태그에 가중치를 조금 더.
- `add_original_image`(기본 켬): 마스크 밖을 원본 그대로 붙여 바뀌지 않게 — 대신 경계에 이음매가 생길 수 있다. 이음매가 보이면 끄고 strength를 낮춘다.
- `strength`(기본 0.7): 마스크 안을 얼마나 바꿀지. 원래 모양을 살리며 다듬기는 낮게, 완전히 새로 그리기는 높게.

## V5에서 안 되는 것
- 바이브 트랜스퍼(그림 분위기 참조)와 캐릭터 레퍼런스(같은 인물 유지)는 **V4.5 전용** — V5에는 없다. 같은 인물을 여러 장에서 유지하려면 고정 외모 태그 묶음 + 같은 시드 근처 + i2i/인페인트로 맞춘다.

## 만든 에셋 (앱에 들어간 것)
| 파일 | 원본 요청 | 쓰는 곳 |
|---|---|---|
| `simulator/assets/orpheia/crest.png` | 602 (5번 시안 i2i 0.7) | MMI 첫 화면 크레스트 |
| `simulator/assets/orpheia/ui/divider.png` | 801 장식선 | FTS 화면 제목 아래 · 구술 결과 점수 옆 (마스크, 금빛) |
| `…/ui/corner.png` | 802 모서리 (왼쪽 위만 잘라냄) | FTS 카드 오른쪽 위 (마스크) |
| `…/ui/mark.png` | 803 작은 문장 | FTS 왼쪽 메뉴 아래 · 구술 창 머리 (마스크) |
| `…/ui/pattern.png` | 804 바탕 무늬 | FTS 머리 왼쪽 · MMI 첫 화면 바탕 (아주 옅게) |
| `…/ui/perfect.webp` · `cheer.webp` · `listen.webp` · `wait.webp` | 101~104 (기본 세팅, 투명 배경) | 구술 결과 80점 이상·미만 · 구술 말하기 듣는 중 · 진행 중인 교육 없음 |

선 장식은 흑백 그림에서 검은 선만 남긴 투명 마스크라 CSS `mask` + 배경색으로 색을 입힌다 (`theme.css`의 `--orn`·`--orn-mint`). 색을 바꿔도 다시 만들 필요가 없다.

## 출처
- dev.to: Calling the NovelAI V5 API directly — https://dev.to/ilan_kim/calling-the-novelai-v5-api-directly-nai-diffusion-5-full-request-body-paramsversion-4310-133a
- LlmKira/novelai-python (SDK 소스: 파라미터·enum·인페인트) — https://github.com/LlmKira/novelai-python
- bedovyy/ComfyUI_NAIDGenerator — https://github.com/bedovyy/ComfyUI_NAIDGenerator
- NovelAI 문서 (태그·데이터셋·복잡도 태그) — https://docs.novelai.net/en/image/tags/
