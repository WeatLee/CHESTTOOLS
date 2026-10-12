# 肺部 3D Procedure 模型（原始碼）

由「肺部 3D 衛教模型」（`Tools/lung-education-src/`）分出的 procedure 教學版本。衛教版維持原樣，兩者各自建置。

## 和衛教版的差異

- **支氣管樹**：改用 BodyParts3D 的氣管、主支氣管及各肺段支氣管樹網格，和肺葉同一座標，不再使用手繪中心線。
- **支氣管鏡路徑**：由 `build-airway-routes.mjs` 在真實氣道腔內追蹤。氣道以 1 mm 體素化後，以靠近管腔中心為優先的最短路徑，從氣管上端走到各肺段末端；18 條路徑都在管腔內。左右路徑在隆突以上合併成一條共用的氣管中心線。
- **新增構造**：食道、奇靜脈／半奇靜脈、橫膈、雙側迷走神經、左膈神經（BodyParts3D）。BodyParts3D 沒有右膈神經主幹，所以右膈神經是沿上腔靜脈和右心房外側的示意路徑。
- **骨骼**：肋骨 1–12、肋軟骨、胸骨、C7–L1 椎骨、鎖骨、肩胛骨。可單獨開關。
- **男性外觀**：BodyParts3D 皮膚網格，依使用者指示只顯示胸部：頸部中段到下肋緣，左右在肩部切齊（不含手臂）。單純開關；開骨骼或各示範時自動變透明。肌肉不呈現。
- **工具列**：講解情境為自然外觀、五肺葉、看內部；骨骼與外觀為單純開關（開骨骼時外觀自動透明）；各區可收合。開啟外觀時，聽診放在胸壁上；Stridor 只在頸部與上段氣管聽得到。
- **主動脈弓分支**：頭臂動脈、左頸總動脈、左右鎖骨下動脈（BodyParts3D）。
- **奇靜脈**：建置時把與氣道、椎骨、手繪主動脈重疊的部分平滑推出（build-procedure-mesh.mjs 的 pushOut）。
- **胸水 pigtail 引流**：第 7 肋間後腋線、沿第 8 肋上緣置入（位置以 BodyParts3D 肋骨與皮膚量測），可選左右；大量胸水 → 置入、尖端捲曲 → 引流、肺再擴張。導管被肋骨擋住的部分以淡影顯示。
- **支氣管穿出肺面的修正**：BodyParts3D 有 10 個右肺肺段支氣管片段超出肺表面 3–16 mm（右外基底段整片在肺外）。建置時以 `lung-volume.mjs` 量測與肺體積的距離：路徑尖端只取肺內（距肺 ≤ 2 mm）的點，所以病灶預設點與支鏡終點都在肺內；網格則切掉任一頂點離肺 1 mm 以上的周邊三角形，再丟掉孤立小片段（< 30 頂點）。氣管與主支氣管不動。建置順序因此是路徑 → 網格 → 淋巴結。
- **左頸總動脈**：BodyParts3D 的左頸總動脈只有頸部，從弓上方 1.7 單位才開始；胸腔部分由程式從弓畫到與右頸總動脈同高（y 1.84），底端的小碎片已丟棄。
- **鎖骨下靜脈**：左右鎖骨下靜脈（BodyParts3D FJ3486、FJ3587）從頸內靜脈交會處往肩部走，在鎖骨下動脈前方；和頸內靜脈、上腔靜脈同一個開關（「頸內與鎖骨下靜脈、上腔靜脈」）。需另下載到 `procedure-subset/veins/`。
- **面板順序與預設**：顯示構造、骨骼與外觀、放置病灶、支氣管鏡、EBUS-TBNA、胸水、胸水引流、呼吸音。支氣管鏡示範時強制顯示病灶（沿用目前病灶，未設定時用預設），離開後恢復原設定；TBNA 示範開始時預設隱藏心臟、大血管、食道與奇靜脈，結束後恢復；顯示骨骼或外觀不再改變相機（比例固定）。
- **EBUS-TBNA**：IASLC 2R/2L/4R/4L/7/10R/10L/11Rs/11Ri/11L 共 10 站。淋巴結位置由 build-node-stations.mjs 從教科書位置出發，避開顯示中的氣道、心臟、大血管、奇靜脈、食道與主動脈；鏡身沿追蹤路徑前進，超音波扇形找到淋巴結，穿刺針經氣道壁進入並來回抽吸。示範時心臟與食道半透明。

## 已知限制

- BodyParts3D 的肺段支氣管樹只到肺段和少數次肺段分支，末端偏向肺門，不會延伸到胸膜下。
- 右內側基底段（RS7）的支氣管在原始資料中非常靠近中線（距中線 9–24 mm），沿肺葉內側緣走。
- 淋巴結站為示意：多數與周邊構造的重疊在 1.5 mm 以內；11L 與葉間肺動脈重疊約 5 mm。
- 大型示範病灶（例如 8 cm）會沿所選路徑往肺門移，以保持在肺內並可取樣；靠近氣管時，支氣管鏡會停在氣管內。
- 模型用於說明解剖關係與檢查流程，並非臨床影像、病人專屬解剖或器械物理模擬。解剖網格、支氣管鏡路徑與取樣動作仍需醫師持續審核。

## 建置

```
npm ci
node build-airway-routes.mjs <D:\AI COWORK\sources\body-parts-source\procedure-subset>
node build-procedure-mesh.mjs <同上>
node build-node-stations.mjs
npm test
npm run build:web
```

- 原始網格以 `sources/body-parts-source/bp3d_subset.py --download` 下載到 `procedure-subset/`（約 68 MB，281 個 OBJ；之後另下載左右鎖骨下動脈主幹 2 個 OBJ 到 `procedure-subset/arteries/`，並從 organ-subset 複製左頸總動脈）。下載範本見 `docs/lung-procedure-anatomy-review.md`。
- `build:web` 的輸出在 `web/`。發布時將 `web/lung-procedure.html` 和 `web/lung-procedure/` 複製到 Chesttools 的 `Tools/`。
- 這台機器的 `python` 是 Microsoft Store 空殼，建置腳本都用 node。肺葉與器官網格沿用衛教版的 `build-lung-mesh.py`、`build-organ-mesh.py`（需 `py -3`）。

## 授權

肺、心臟、大血管、支氣管樹、食道、奇靜脈、橫膈、神經、骨骼與皮膚網格改作自 BodyParts3D 4.3（CC BY-SA 2.1 JP）；介面使用 Three.js（MIT）。詳見 `THIRD_PARTY_NOTICES.txt`。
