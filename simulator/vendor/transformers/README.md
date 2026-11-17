# 음성인식 라이브러리 (오프라인)

음성 1인 모드의 받아쓰기(Whisper)와 목소리(Supertonic)에 쓴다. `ui/voice-stt-worker.js`·`ui/voice-tts-worker.js`가 불러온다.

아래 세 파일은 저장소에 넣지 않는다. `npm install`(CI의 `npm ci` 포함) 때 `tools/vendor-voice.cjs`가 npm에서 고정 버전을 받아 SHA-256을 확인하고 여기에 둔다.

- `transformers.min.js` — @huggingface/transformers 4.3.2 (Apache-2.0, `LICENSE-transformers.txt`)
- `ort-wasm-simd-threaded.asyncify.{mjs,wasm}` — onnxruntime-web 1.31.0-dev.20260914-8d85527a0 (MIT, `LICENSE-onnxruntime.txt`)

음성 모델(onnx-community/whisper-small, 양자화 약 250MB)은 처음 쓸 때 한 번 내려받아 앱 캐시에 둔다. 그 뒤로는 인터넷 없이 동작한다.
