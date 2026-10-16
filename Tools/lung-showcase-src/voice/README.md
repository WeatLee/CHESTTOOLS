# 展示頁語音（預錄）

- 檔名：`<語言>/<展示id>-<步驟序號>.mp3`（序號從 1 起）。語言：zh 中文（zh-TW-HsiaoChenNeural）、vi（vi-VN-HoaiMyNeural）、ms（ms-MY-YasminNeural）、id（id-ID-GadisNeural）。
- 產生：`VOICE_PY=<含 edge-tts 的 python> node build-voice.mjs [語言…]`；已存在的檔案會略過，改稿後先移走舊檔再重產。講稿與翻譯在 `src/voice-text.js`。
- 翻譯由 Claude 撰寫，**尚未經母語者或臨床人員審核**；步驟內容與網頁一樣只是示意。CT 第 2 步的語音不念「約 X 公分」（深度會隨病灶變）。
- 台語（nan）尚無錄音：Edge TTS 沒有台語聲音。取得音檔並放入 `voice/nan/` 後，在 `src/voice.js` 的 READY 加入 `nan`，並補 `voice-text.js` 的台語稿。
- 音檔由微軟 Edge 神經語音服務產生，只送出步驟文字；公開發布前請再確認該服務的使用條款。
