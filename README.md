# AI Voice Director — 試聽頁

IndexTTS-2.0 語音克隆 + 情緒控制的試聽 demo。8 個角色，各以一段參考音（timbre
anchor）克隆音色，再用 `emotion_desc` 經 Qwen 分類器導出情緒向量（`emo_alpha 0.6`，
未正規化）驅動情緒。每格音檔下標與參考音的音色相似度。

純 static。`index.html` 在根目錄，音檔在 `assets/`。

## 本地看

```bash
python3 -m http.server 8000
# 開 http://localhost:8000/
```

## GitHub Pages

Settings → Pages → Source 選 `main` 分支的根目錄即可。`.nojekyll` 已加，避免 Jekyll
處理打亂 `assets/` 底下的檔名。

## 內容

| 目錄 | 來源 |
|---|---|
| `assets/pipeline_new3_i_a06` | yuan_neutral / robot_el / joker_el |
| `assets/pipeline_roles3_i_a06` | clk_0016 / clk_0019 / clk_0037（店員角色） |
| `assets/pipeline_el2_i_a06` | catgirl_el / tigerman_el |
| `assets/refs_chinese`, `assets/refs_roles` | 各角色的參考音 |
