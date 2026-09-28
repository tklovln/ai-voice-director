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
| `/convenientstore_m_poc/` | 便利商店 NPC 選角（菲菲／紙袋君／虎面，各 1 基準音 ＋ 喜怒哀，三引擎可切） |
| `/story_tiger_s10/` | 虎面支線 S10 整幕對白（28 句劇本，14 句配音走 11 段 TTS，逐句字幕與情緒稿對照） |
| `/story_paperbag_s1/` | 紙袋君支線 S1（31 句；菲菲 ElevenLabs ＋ 紙袋君 Gemini 3.8，共 23 句配音／16 段 TTS） |

`convenientstore_m_poc/` 由 emotts repo 的 `scripts/build_casting_page.py` 產生：把 studio 的
選角頁靜態化，state 內嵌在 HTML、音檔與立繪複製到 `assets/`，並移除生成按鈕——公開頁面不該
有能花掉 API 額度的入口。音檔用 24 kHz WAV 母帶而不是 48 kbps M4A，因為這個頁面就是要聽音色。

情緒卡上方的 **Engine** 切換是引擎 A/B：

| 選項 | 引擎 | 文字前處理 | 產生工具 |
|---|---|---|---|
| `original` | ElevenLabs `eleven_v3`（audio tag ＋ stability/style/speed 控制表演） | — | `scripts/npcvoice_elevenlabs.py` |
| `cosy3 zero-shot` | CosyVoice3 `inference_zero_shot` | wetext | `scripts/cosy3_poc_emotions.py` |
| `cosy3 cross-lingual` | CosyVoice3 `inference_cross_lingual`，情緒走 instruct | 停用（`<\|` 在 tts_text） | 同上 |
| `indextts 2.5` | IndexTTS-2.5，`emotext`、`emo_alpha 0.6`、未正規化情緒向量 | 繁體直進，字元級 | `scripts/poc_indextts_emotions.py` |
| `indextts 2.0` | 同上參數，但 CPU-only 環境 | opencc `tw2sp`，**詞彙級** | `--index-version 2` |

五邊刻意只差引擎：同三個角色、同三句台詞、**同一個 reference**，並走同一條 mastering
（24 kHz mono／−16 LUFS），所以聽到的差異不含音量或句子的干擾。基準音本身不隨引擎切換——
它是所有引擎共同的輸入。

> CosyVoice3 的 prompt 音檔有 30 秒硬上限（`frontend.py:96` assert），而 PoC 的 reference 是
> 26.5–40.2 秒，所以 `scripts/cosy3_prep_refs.py` 先裁到 28 秒並產生對應的
> `prompt_text`（`inference_zero_shot` 需要參考音的逐字稿）。裁切後的逐字稿是用 Whisper
> 定位切點、再取「已知全文」的前綴，所以用字正確而長度對齊。

### 三種 CosyVoice3 方法的差別在「LM 看得到什麼」

| 方法 | `prompt_text`→LM | `llm_prompt_speech_token`→LM | 音色來源 |
|---|---|---|---|
| `inference_zero_shot` | ✓ 逐字稿 | **✓ 參考音的 speech token** | LM ＋ flow |
| `inference_cross_lingual` | ✗ 刪除 | ✗ 刪除 | 只有 flow |
| `inference_instruct2`（`out/cosy3_instruct` 用的） | ✓ instruct | ✗ 刪除 | 只有 flow |

`zero_shot` 是唯一會把參考音的 speech token 餵進 LM 的路徑，所以也是唯一「韻律與發音有機會
從參考音轉移」的路徑。用 CosyVoice3 自己的 `campplus.onnx`（就是它算 `flow_embedding` 的那個
網路）量說話人相似度，這個機制差異直接反映在數字上（跨角色底線 0.204）：

| 引擎 | mean | min | max |
|---|---|---|---|
| CosyVoice3 `zs_emo` | **0.850** | 0.776 | 0.904 |
| CosyVoice3 `zs` | **0.847** | 0.780 | 0.925 |
| CosyVoice3 `zs_short`（10s ref） | 0.827 | 0.751 | 0.876 |
| CosyVoice3 `xl_tw` | 0.816 | 0.698 | 0.881 |
| IndexTTS 2.0 | 0.738 | 0.554 | 0.827 |
| CosyVoice3 `xl` | 0.716 | 0.611 | 0.827 |
| IndexTTS 2.5 | 0.692 | 0.529 | 0.808 |
| ElevenLabs original | 0.656 | 0.485 | 0.802 |

ElevenLabs 敬陪末座是預期的：它的 `stability 0.1` / `similarity_boost 0.3` 就是刻意讓聲線偏離
基準音以換取表演幅度。**注意這個指標量的是身分，不是口音**，兩者不能互推。

`out/cosy3_poc/` 另外含兩個沒上頁面的變體：`zs_emo`（instruct 塞在 `<|endofprompt|>` 之前，
測情緒能否與轉移並存）與 `xl_tw`（instruct 加台灣腔指令——CosyVoice3 的
`instruct_list` 有 17 種中國方言但**沒有台灣**條目，所以這是在確認而不是假設它無效）。

### 為什麼 2.0 與 2.5 都留著

IndexTTS **沒有口音提示詞**，口音只由 `spk_audio_prompt` 決定（見 `scripts/index_tw_accent_test.py`），
所以台灣腔是靠 reference 帶進來的。唯一的文字側風險是版本差異，實測（`TextNormalizer` vs opencc）：

```
輸入        我搭計程車去便利商店買泡麵，順便用滑鼠把網路上的資料影印到隨身碟。
2.0 tw2sp   我搭出租车去便利商店买方便面，顺便用鼠标把网络上的数据复印到U盘。   <- 台灣用詞被改寫
2.5 WeText  我搭计程车去便利商店买泡面,顺便用滑鼠把网路上的资料影印到随身碟.   <- 用詞保留
```

`tw2sp` 是詞彙級映射，會把台灣用詞換成大陸用詞，唸出來就是大陸腔；2.5 的 WeTextProcessing 是
字元級，不動用詞。目前這三句台詞不含觸發詞（`poc_indextts_emotions.py` 的
`assert_no_accent_damage` 會在生成前擋下觸發的情況），但 2.0／2.5 併排留著才能用耳朵驗這件事。
2.5 另外是 GPU 環境，本機實測 ~7s/句 vs 2.0 CPU 的 ~35s/句。

## `story_*`：整幕劇本配音

由 emotts repo 的 `scripts/story_tts.py publish` 產生，與 `convenientstore_m_poc/` 平行——
每個頁面都是自帶 `assets/` 與 `.nojekyll` 的獨立目錄，可各自發佈。頁首互相連結。

選角頁聽的是**單句口頭禪的音色與情緒**；這些頁面聽的是**一整幕連起來還像不像同一個人**。

| 頁面 | 劇本 | 配音 |
|---|---|---|
| `story_tiger_s10/` | 虎面 S10〈傳奇片刻：傳承〉28 句 | 虎面 `Tiger` 12 句 ＋ 菲菲 `fei_fei_final` 2 句，走 11 段 TTS |
| `story_paperbag_s1/` | 紙袋君 S1〈頭戴紙袋的應徵者〉31 句 | 菲菲 `fei_fei_final` 11 句／8 段 ＋ Gemini 3.8 紙袋君 12 句／8 段 |

沒有指定聲線的角色保留完整台詞，以字幕串場，情緒稿一樣備妥。

| 這些頁面能回答的問題 | 頁面上的做法 |
|---|---|
| 一整幕的音色是否穩定 | 相鄰、同角色且情緒接近的台詞合併成一次 TTS，而不是逐句各生一次 |
| 一個角色的情緒幅度夠不夠 | 菲菲：期待 → 驚疑 → 慌張 → 吐槽 → 秒答應 → 佩服；紙袋君用沉穩男聲回應 |
| 情緒指示到底送了什麼進模型 | 原文／情緒稿字幕切換，右欄顯示各引擎的實際文字、語氣 metadata 與句中 tags |
| 節奏是不是被後處理弄壞 | 同段播放整份母帶，以引擎字元時間戳或 Whisper 詞級時間對齊切字幕 |

逐句試聽用 **只播本句**，整段用 **只播本段**；連續播放會依劇情順序走完整幕，
字幕按閱讀時間接續。`script.json` / `script.csv` / `utterances.csv` 可直接從頁面下載。

音檔使用 24 kHz WAV 母帶。合併段落只做一次 −16 LUFS 正規化，
所以段落內句子之間的強弱關係是生成時的原樣；逐句下載檔是同一份母帶的原樣切片。
兩頁共用同一份模板與同一支瀏覽器檢查，舞台角色與頁面標題由各自的 `scene.json` 指定。
做法與重跑方式見 emotts repo 的 `story/tts/tiger_s10/README.md`（共用說明）與
`story/tts/paperbag_s1/README.md`（本幕差異與沉默空拍的處理）。

Gemini 紙袋君先依角色表設計固定聲線，之後的 8 段 TTS 共用同一個 voice ID。
原情緒稿在 adapter 中轉成 `speech_metadata.style` 與 `<short pause>` 等瞬時標記；
頁面可查看各句的實際模型輸入，並分別開啟紙袋君的「台灣華語試聽」與「原生設計樣本」，
也能展開固定繁體中文試聽稿。原生樣本與固定稿都通過中文語言檢查後才用該聲線生成台詞。
完整接法見 emotts 的 `story/tts/paperbag_s1/README_GEMINI.md`。

## 內容

| 目錄 | 來源 |
|---|---|
| `assets/pipeline_new3_i_a06` | yuan_neutral / robot_el / joker_el |
| `assets/pipeline_roles3_i_a06` | clk_0016 / clk_0019 / clk_0037（店員角色） |
| `assets/pipeline_el2_i_a06` | catgirl_el / tigerman_el |
| `assets/refs_chinese`, `assets/refs_roles` | 各角色的參考音 |
