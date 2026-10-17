# 醫學 QR Code 生成器

輸入 HTTP(S) 網址，以懸浮方塊肺臟及高醫微縮地台呈現；點擊切換正上方空拍 QR。網址本身不會縮短，亦不會送往第三方服務。QR 中央保留胸內科標誌，支援複製與 PNG 下載。

首頁入口：`Tools/medical-qr/index.html`。
首頁分享：同頁 `?embed=share`，固定編碼 `https://weatlee.github.io/CHESTTOOLS/`。此模式隱藏網址編輯，先顯示肺臟，點一下才轉空拍。首頁只在開啟 dialog 時載入 iframe，關閉回到 about:blank 釋放場景；iframe 的 Escape 經同源訊息關閉外層視窗。

## 維護

此資料夾是可重建的 TypeScript/Vite/Three.js 來源。安裝既定相依套件後：

```powershell
npm ci
npm run build
npm test
npm run test:browser
```

`dist` 內容對應旁邊 `../medical-qr/`。建置採相對資源路徑，支援 GitHub Pages `/CHESTTOOLS/` 子路徑。只更新產物與來源，不加入 node_modules、測試截圖、test-results。

瀏覽器測試使用已安裝的 Chrome/Edge。`node tests/chesttools.mjs` 檢查首頁整合，需另以 localhost:8797 服務 CHESTTOOLS 根目錄。

參數在 src/config.ts；中央標誌在 src/qr-mark.ts，原圖檔在 src/assets。QR採H容錯、四格邊界、深橄欖與暖米色；3D以同組方塊固定頂面合成，不以整張QR圖取代場景。標誌是原始圖樣分片到方塊頂面。平視肺略後傾、慢轉及輕微上下浮動，空拍暫停並回到校準角度。無WebGL使用二維QR備援。

本機驗證與發布日誌保存在維護者的 CHESTTOOLS/docs，不進公開倉庫。

## 空拍保留物件外觀

每個實體方塊使用原始材質的深淺色階，讓空拍仍看得到粉紅肺、綠色樹冠與米色屋頂。QR資料只約束明暗，不在轉場貼上整張QR。原始方塊邊緣及由實際模型高度場取樣的有限遮蔭，保留物件輪廓和高低差；所有幾何保持原高度。頂面樣式固定，不隨相機改色。中央mark照舊分片到頂面。
