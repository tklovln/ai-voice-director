"use strict";

const scene = JSON.parse(document.getElementById("scene-data").textContent);
const $ = (id) => document.getElementById(id);
const audio = $("audio");
const state = { index: 0, running: false, phase: "line", subtitleTime: 0, gapTime: 0,
  lastTick: performance.now(), token: 0, filter: "all", role: "all", directed: false,
  single: false, stopAfterIndex: null, finished: false, speed: 1 };
const line = () => scene.lines[state.index];
const actor = () => scene.cast[line().speaker];
// Which two characters own the stage is a per-scene decision, so the slots are
// filled from the script rather than hard-coded to one cast.
const LEADS = [["lead-a", scene.stage.leads[0]], ["lead-b", scene.stage.leads[1]]]
  .filter(([, speaker]) => speaker && scene.cast[speaker]);
const LEAD_SPEAKERS = LEADS.map(([, speaker]) => speaker);
const duration = () => line().audio?.duration_s ?? line().subtitle_duration_ms / 1000;
const position = () => line().audio ? Math.max(0, audio.currentTime - line().audio.start_s) : state.subtitleTime;
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function textWithTags(element, text) {
  element.replaceChildren();
  for (const part of text.split(/(\[[^\]]+\])/g)) {
    if (part.startsWith("[") && part.endsWith("]")) {
      const tag = document.createElement("span");
      tag.className = "audio-tag";
      tag.textContent = part;
      element.append(tag);
    } else element.append(document.createTextNode(part));
  }
}

function updateCaption() {
  $("caption-text").classList.toggle("directed", state.directed);
  if (state.directed) textWithTags($("caption-text"), line().text);
  else $("caption-text").textContent = line().source_text;
  $("caption-original").setAttribute("aria-pressed", String(!state.directed));
  $("caption-directed").setAttribute("aria-pressed", String(state.directed));
}

function renderList() {
  const list = $("script-list");
  list.replaceChildren();
  let count = 0;
  scene.lines.forEach((item, index) => {
    if (state.role !== "all" && item.speaker !== state.role) return;
    if (state.filter === "voiced" && !item.audio) return;
    if (state.filter === "subtitles" && item.audio) return;
    count++;
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.className = "line-button";
    button.id = `select-${item.line_id}`;
    button.dataset.index = index;
    button.setAttribute("aria-current", String(state.index === index));
    button.setAttribute("aria-label", `第 ${item.order} 句 ${item.character}`);
    const order = document.createElement("span");
    order.className = "line-order";
    order.textContent = String(item.order).padStart(2, "0");
    const body = document.createElement("span");
    const top = document.createElement("span");
    top.className = "line-top";
    const name = document.createElement("strong");
    name.style.color = scene.cast[item.speaker].color;
    name.textContent = item.character;
    const type = document.createElement("span");
    type.className = `line-type ${item.audio ? "voiced" : ""}`;
    type.textContent = item.audio ? `● ${item.audio.duration_s.toFixed(1)}s` : "○ 字幕";
    if (item.utterance_size > 1) type.textContent += ` · ${item.utterance_index + 1}/${item.utterance_size}`;
    top.append(name, type);
    const preview = document.createElement("span");
    preview.className = "line-preview";
    preview.textContent = item.source_text;
    body.append(top, preview);
    button.append(order, body);
    button.addEventListener("click", () => selectLine(index));
    li.append(button);
    list.append(li);
  });
  $("list-count").textContent = `${count} / ${scene.lines.length}`;
  if (!count) {
    const message = document.createElement("li");
    message.className = "list-help";
    message.textContent = "這個篩選條件沒有台詞。";
    list.append(message);
  }
}

function updateListSelection() {
  for (const button of $("script-list").querySelectorAll("button")) {
    button.setAttribute("aria-current", String(Number(button.dataset.index) === state.index));
  }
  const current = $(`select-${line().line_id}`);
  if (current) {
    const list = $("script-list");
    const rect = current.getBoundingClientRect();
    const bounds = list.getBoundingClientRect();
    if (rect.top < bounds.top || rect.bottom > bounds.bottom) {
      list.scrollTop += rect.top - bounds.top - list.clientHeight / 2 + rect.height / 2;
    }
  }
}

function renderSelected() {
  const current = line();
  $("stage").dataset.lineId = current.line_id;
  $("stage").dataset.utteranceId = current.utterance_id;
  $("scene-progress").textContent = `${String(current.order).padStart(2, "0")} / ${scene.lines.length}`;
  $("speaker-name").textContent = current.character;
  $("speaker-name").style.color = actor().color;
  $("delivery-badge").textContent = current.audio
    ? current.utterance_size > 1 ? `同段配音 ${current.utterance_index + 1}/${current.utterance_size}` : "情緒配音"
    : "字幕串場";
  $("emotion-label").textContent = current.emotion;
  $("line-id").textContent = current.line_id.toUpperCase();
  $("inspector-emotion").textContent = current.emotion;
  $("intensity").value = current.intensity;
  $("intensity-label").textContent = `表演強度 ${Math.round(current.intensity * 100)}%`;
  $("direction-note").textContent = current.direction;
  $("voice-name").textContent = current.voice_name ?? "字幕串場";
  $("voice-status").textContent = current.audio
    ? `Eleven v3 · ${current.utterance_size > 1 ? `${current.utterance_size} 句同次生成` : "單句生成"}`
    : "已備妥情緒稿 · 按閱讀時間接續";
  $("utterance-note").textContent = current.utterance_size > 1
    ? `${current.utterance_line_ids.map(id => Number(id.split("_").at(-1))).join("–")} 同段 · ${current.utterance_emotion}：${current.utterance_reason}` : "";
  $("utterance-note").hidden = current.utterance_size < 2;
  $("tts-input-label").textContent = current.utterance_size > 1 ? "整段模型輸入" : "模型輸入";
  $("audition-utterance").hidden = !current.audio || current.utterance_size < 2;
  $("original-text").textContent = current.source_text;
  textWithTags($("tts-text"), current.tts_text);
  $("edit-note").hidden = !current.text_edit_note;
  $("edit-note").textContent = current.text_edit_note;
  const notes = [
    ...current.pronunciations.map(rule => `讀音 ${rule.word} → /${rule.ipa}/：${rule.note}`),
    ...(current.tuning_note ? [`調參：${current.tuning_note}`] : []),
  ];
  $("tuning-notes").replaceChildren(...notes.map(text => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  $("tuning-notes").hidden = !notes.length;
  $("request-settings").textContent = JSON.stringify({
    mode: current.mode, voice: current.voice_name, voice_settings: current.voice_settings,
    utterance_id: current.utterance_id, line_ids: current.utterance_line_ids,
    pause_after_ms: current.pause_after_ms,
    ...(current.audio ? { start_s: current.audio.start_s, end_s: current.audio.end_s,
      duration_s: current.audio.duration_s, internal_pause: "contained in continuous take" }
      : { subtitle_duration_ms: current.subtitle_duration_ms }),
  }, null, 2);
  for (const [slot, speaker] of LEADS) {
    const active = current.speaker === speaker;
    const portraits = scene.cast[speaker].portraits;
    const image = $(`${slot}-portrait`);
    image.src = portraits[active ? current.expression : "normal"] ?? portraits.normal;
    image.parentElement.classList.toggle("active", active);
    image.parentElement.classList.toggle("inactive", !active);
  }
  const supporting = !LEAD_SPEAKERS.includes(current.speaker) && current.speaker !== scene.stage.narrator;
  $("support-speaker").hidden = !supporting;
  $("support-initial").textContent = current.character;
  const portrait = actor().portraits[current.expression] ?? actor().portraits.normal;
  $("support-portrait").hidden = !portrait;
  $("support-initial").hidden = Boolean(portrait);
  if (portrait) {
    $("support-portrait").src = portrait;
    $("support-portrait").alt = `${current.character}角色立繪`;
  } else $("support-portrait").removeAttribute("src");
  $("download-clip").hidden = !current.audio;
  if (current.audio) {
    $("download-clip").href = current.audio.download_url;
    $("download-clip").download = `${current.line_id}_${current.character}.wav`;
  } else $("download-clip").removeAttribute("href");
  $("waveform").replaceChildren();
  $("waveform").classList.toggle("silent", !current.audio);
  for (const peak of current.audio?.waveform ?? Array(80).fill(0.12)) {
    const bar = document.createElement("i");
    bar.style.height = `${Math.max(5, peak * 100)}%`;
    $("waveform").append(bar);
  }
  $("seek").max = duration();
  updateCaption();
  updateListSelection();
  updateControls();
  updateProgress();
}

function targetIndex(step) {
  let index = state.index + step;
  while (index >= 0 && index < scene.lines.length) {
    if (!$("only-voiced").checked || scene.lines[index].audio) return index;
    index += step;
  }
  return -1;
}

function updateControls() {
  const label = state.running ? "暫停播放" : state.finished ? "重新播放" : "播放場景";
  $("play-label").textContent = label;
  $("play").setAttribute("aria-label", label);
  $("play-icon").textContent = state.running ? "Ⅱ" : "▶";
  $("stage").classList.toggle("playing", state.running && state.phase === "line");
  $("previous").disabled = targetIndex(-1) === -1;
  $("next").disabled = targetIndex(1) === -1;
  $("playback-status").textContent = state.finished ? "本幕播放完畢" : state.phase === "gap"
    ? (state.running ? "句間停頓…" : "已暫停 · 句間停頓")
    : state.running ? (line().audio ? `正在配音 · ${line().character}` : `字幕串場 · ${line().character}`)
    : `準備 / 已暫停 · ${line().audio ? line().voice_name : "字幕串場"}`;
}

function updateProgress() {
  const current = Math.min(position(), duration());
  $("seek").value = current;
  $("clip-time").textContent = `${formatTime(current)} / ${formatTime(duration())}`;
  const fraction = current / Math.max(duration(), 0.001);
  const bars = $("waveform").children;
  for (let i = 0; i < bars.length; i++) bars[i].classList.toggle("heard", i / bars.length < fraction);
}

function selectLine(index, play = false) {
  if (index < 0 || index >= scene.lines.length) return;
  state.token++;
  state.running = false;
  audio.pause();
  audio.removeAttribute("src");
  state.index = index;
  state.phase = "line";
  state.subtitleTime = 0;
  state.gapTime = 0;
  state.finished = false;
  state.single = false;
  state.stopAfterIndex = null;
  state.lastTick = performance.now();
  $("playback-error").hidden = true;
  if (line().audio) audio.src = line().audio.url;
  audio.load();
  if (line().audio) audio.currentTime = line().audio.start_s;
  audio.playbackRate = state.speed;
  renderSelected();
  if (play) resume();
}

function showPlaybackError(message) {
  state.running = false;
  audio.pause();
  $("playback-error").textContent = message;
  $("playback-error").hidden = false;
  updateControls();
}

async function resume() {
  const token = ++state.token;
  state.running = true;
  state.lastTick = performance.now();
  $("playback-error").hidden = true;
  if (state.phase === "line" && position() >= duration() - 0.01) {
    state.subtitleTime = 0;
    if (line().audio) audio.currentTime = line().audio.start_s;
  }
  updateControls();
  if (line().audio && state.phase === "line") {
    try { await audio.play(); }
    catch (error) {
      if (token === state.token) showPlaybackError(`播放失敗：${error.message}。請重新按播放。`);
    }
  }
}

function pause() {
  state.token++;
  state.running = false;
  audio.pause();
  updateControls();
}

function finishLine() {
  if (!state.running || state.phase !== "line") return;
  if (state.single || state.stopAfterIndex === state.index
      || (!$("auto-advance").checked && state.stopAfterIndex === null)) {
    pause();
    if (line().audio) audio.currentTime = line().audio.end_s;
    return;
  }
  const next = scene.lines[state.index + 1];
  if (line().audio && next?.audio && next.utterance_id === line().utterance_id) {
    // Same take: only change subtitle/portrait. Keep the audio resource and clock
    // running, including the natural pause captured inside the generated take.
    state.index++;
    renderSelected();
    return;
  }
  audio.pause();
  state.phase = "gap";
  state.gapTime = 0;
  state.lastTick = performance.now();
  updateControls();
}

function advance() {
  const next = targetIndex(1);
  if (next >= 0) selectLine(next, true);
  else {
    pause();
    state.finished = true;
    state.phase = "line";
    updateControls();
  }
}

function playScene() {
  if (state.running) return pause();
  if (state.finished) {
    const first = $("only-voiced").checked ? scene.lines.findIndex(item => item.audio) : 0;
    selectLine(first);
  }
  if ($("only-voiced").checked && !line().audio) {
    const next = targetIndex(1);
    if (next < 0) return;
    selectLine(next);
  }
  state.single = false;
  state.stopAfterIndex = null;
  resume();
}

function tick(timestamp) {
  const elapsed = (timestamp - state.lastTick) / 1000 * state.speed;
  state.lastTick = timestamp;
  if (state.running) {
    if (state.phase === "gap") {
      state.gapTime += elapsed;
      if (state.gapTime * 1000 >= line().pause_after_ms) advance();
    } else if (!line().audio) {
      state.subtitleTime = Math.min(duration(), state.subtitleTime + elapsed);
      if (state.subtitleTime >= duration()) finishLine();
    } else {
      while (state.running && state.phase === "line" && line().audio
             && audio.currentTime >= line().audio.end_s - 0.003) finishLine();
    }
  }
  updateProgress();
  requestAnimationFrame(tick);
}

$("play").addEventListener("click", playScene);
$("previous").addEventListener("click", () => selectLine(targetIndex(-1), state.running));
$("next").addEventListener("click", () => selectLine(targetIndex(1), state.running));
$("audition").addEventListener("click", () => { selectLine(state.index); state.single = true; resume(); });
$("audition-utterance").addEventListener("click", () => {
  const uid = line().utterance_id;
  const first = scene.lines.findIndex(item => item.utterance_id === uid);
  const last = first + line().utterance_size - 1;
  selectLine(first);
  state.stopAfterIndex = last;
  resume();
});
$("only-voiced").addEventListener("change", () => {
  if ($("only-voiced").checked && state.running && !line().audio) {
    const next = targetIndex(1);
    if (next >= 0) selectLine(next, true);
    else pause();
  }
  updateControls();
});
$("seek").addEventListener("input", () => {
  const value = Number($("seek").value);
  state.phase = "line";
  state.gapTime = 0;
  state.finished = false;
  if (line().audio) {
    audio.currentTime = line().audio.start_s + value;
    if (state.running && audio.paused) resume();
  } else state.subtitleTime = value;
  state.lastTick = performance.now();
  updateProgress();
  updateControls();
});
$("speed").addEventListener("change", () => {
  state.speed = Number($("speed").value);
  audio.playbackRate = state.speed;
  state.lastTick = performance.now();
});
$("volume").addEventListener("input", () => { audio.volume = Number($("volume").value); });
$("caption-original").addEventListener("click", () => { state.directed = false; updateCaption(); });
$("caption-directed").addEventListener("click", () => { state.directed = true; updateCaption(); });
$("role-filter").addEventListener("change", () => { state.role = $("role-filter").value; renderList(); });
for (const button of document.querySelectorAll("[data-filter]")) {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    for (const item of document.querySelectorAll("[data-filter]")) item.setAttribute("aria-pressed", String(item === button));
    renderList();
  });
}
$("copy-input").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(line().tts_text);
    $("copy-input").textContent = "已複製";
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents($("tts-text"));
    selection.removeAllRanges();
    selection.addRange(range);
    $("copy-input").textContent = "已選取，請複製";
  }
  setTimeout(() => { $("copy-input").textContent = "複製"; }, 2000);
});
audio.addEventListener("ended", finishLine);
audio.addEventListener("error", () => {
  if (line().audio && audio.getAttribute("src")) showPlaybackError("音檔載入失敗，請確認 demo 的 assets/audio 已完整建置。");
});
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, select, textarea, button, a, summary")) return;
  if (event.code === "Space") { event.preventDefault(); playScene(); }
  if (event.code === "ArrowRight") { event.preventDefault(); selectLine(targetIndex(1), state.running); }
  if (event.code === "ArrowLeft") { event.preventDefault(); selectLine(targetIndex(-1), state.running); }
});

$("scene-title").textContent = scene.display_title;
$("scene-eyebrow").textContent = scene.page.series;
if (scene.page.scene_label) {
  const separator = document.createElement("span");
  separator.textContent = "/";
  $("scene-eyebrow").append(separator, document.createTextNode(scene.page.scene_label));
}
$("scene-description").textContent = scene.description;
$("total-count").textContent = scene.lines.length;
$("voiced-count").textContent = scene.tts_count;
$("utterance-count").textContent = scene.tts_request_count;
for (const [slot, speaker] of LEADS) {
  const member = scene.cast[speaker];
  $(`${slot}-portrait`).alt = `${member.name}角色立繪`;
  $(`${slot}-label`).textContent = member.name;
  if (member.voice_name) {
    const voice = document.createElement("small");
    voice.textContent = member.voice_name;
    $(`${slot}-label`).append(voice);
  }
}
$("lead-b-wrap").hidden = LEADS.length < 2;
$("voiced-cast-note").textContent = [...new Set(scene.lines
  .filter(item => item.audio).map(item => item.character))].join(" / ");
for (const [id, url] of [["site-link", scene.site?.site_root], ["sibling-link", scene.site?.sibling?.url]]) {
  const label = id === "site-link" ? scene.site?.site_name ?? "回總覽" : scene.site?.sibling?.label;
  if (!url || !label) continue;
  const link = $(id);
  link.href = url;
  link.textContent = id === "site-link" ? `↩ ${label}` : `${label} →`;
  link.hidden = false;
}
$("casting-note").textContent = scene.casting_note;
$("scene-direction").textContent = scene.director_note;
for (const [id, member] of Object.entries(scene.cast)) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = member.name;
  $("role-filter").append(option);
}
audio.volume = Number($("volume").value);
renderList();
selectLine(0);
requestAnimationFrame(tick);
