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

## 頁面

| 路徑 | 內容 |
|---|---|
| `/` | IndexTTS-2.0 語音克隆 ＋ 情緒控制試聽（8 角色） |
| `/convenientstore_m_poc/` | 便利商店 NPC 選角（菲菲／紙袋君／虎面，各 1 基準音 ＋ 喜怒哀） |

`convenientstore_m_poc/` 由 emotts repo 的 `scripts/build_casting_page.py` 產生：把 studio 的
選角頁靜態化，state 內嵌在 HTML、音檔與立繪複製到 `assets/`，並移除生成按鈕——公開頁面不該
有能花掉 API 額度的入口。音檔用 24 kHz WAV 母帶而不是 48 kbps M4A，因為這個頁面就是要聽音色。

## 內容

| 目錄 | 來源 |
|---|---|
| `assets/pipeline_new3_i_a06` | yuan_neutral / robot_el / joker_el |
| `assets/pipeline_roles3_i_a06` | clk_0016 / clk_0019 / clk_0037（店員角色） |
| `assets/pipeline_el2_i_a06` | catgirl_el / tigerman_el |
| `assets/refs_chinese`, `assets/refs_roles` | 各角色的參考音 |
