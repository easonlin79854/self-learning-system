import "./styles.css";
import { askNimTutor, deleteDoc, getProfile, hasCloudConfig, listDocs, saveDoc, saveProfile, signIn, signUp } from "./cloud.js";

const DEFAULT_PROFILE = {
  theme: "light",
  accent: "#6366f1",
  fontSize: 16,
  fontFamily: "Noto Sans TC, system-ui, sans-serif",
  nimEndpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
  nimModel: "meta/llama-3.1-70b-instruct",
  nimApiKey: "",
};

const state = {
  session: null,
  profile: { ...DEFAULT_PROFILE },
  active: "dashboard",
  exams: [],
  notes: [],
  events: [],
  pomodoro: { seconds: 25 * 60, mode: "focus", timer: null, running: false },
};

const navItems = [
  ["dashboard", "總覽", "📊"],
  ["exams", "考試成績", "📝"],
  ["notes", "雲端筆記本", "☁️"],
  ["calendar", "規劃日曆", "📅"],
  ["pomodoro", "蕃茄鐘", "🍅"],
  ["tutor", "AI 導師", "🤖"],
  ["settings", "個人化設定", "🎨"],
];

const app = document.querySelector("#app");
const setStatus = (message, type = "info") => {
  const status = document.querySelector("#status");
  if (status) {
    status.textContent = message;
    status.dataset.type = type;
  }
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

const applyProfile = () => {
  document.documentElement.dataset.theme = state.profile.theme;
  document.documentElement.style.setProperty("--accent", state.profile.accent);
  document.documentElement.style.setProperty("--font-size", `${state.profile.fontSize}px`);
  document.documentElement.style.setProperty("--font-family", state.profile.fontFamily);
};

const renderShell = () => {
  applyProfile();
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand"><span>🧠</span><div><strong>自主學習系統</strong><small>Cloud-first learning hub</small></div></div>
      <nav>${navItems.map(([id, label, icon]) => `<button class="nav-button ${state.active === id ? "active" : ""}" data-nav="${id}">${icon}<span>${label}</span></button>`).join("")}</nav>
      <div class="cloud-card"><strong>雲端狀態</strong><span>${hasCloudConfig() ? "已連接 Firebase 設定" : "尚未設定 Firebase 環境變數"}</span></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div><p class="eyebrow">${new Date().toLocaleDateString("zh-Hant", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p><h1>${navItems.find(([id]) => id === state.active)?.[1]}</h1></div>
        <button id="logout" class="ghost">登出</button>
      </header>
      <section id="view"></section>
      <p id="status" class="status" data-type="info"></p>
    </main>`;
  document.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => {
    state.active = button.dataset.nav;
    renderShell();
    renderView();
  }));
  document.querySelector("#logout").addEventListener("click", () => {
    state.session = null;
    state.exams = [];
    state.notes = [];
    state.events = [];
    renderAuth();
  });
};

const renderAuth = () => {
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-hero">
        <p class="eyebrow">Cloud-only autonomous learning</p>
        <h1>建立你的雲端自主學習系統</h1>
        <p>用側邊欄管理成績、筆記、日曆、蕃茄鐘、個人化設定與 NVIDIA NIM AI 導師。所有使用者資料都透過 Firebase 雲端讀寫，本介面不使用 localStorage 儲存資料。</p>
        <div class="feature-grid">${navItems.slice(1).map(([, label, icon]) => `<span>${icon} ${label}</span>`).join("")}</div>
      </section>
      <form id="auth-form" class="panel auth-card">
        <h2>登入 / 註冊</h2>
        <label>Email<input name="email" type="email" required autocomplete="email" /></label>
        <label>密碼<input name="password" type="password" minlength="6" required autocomplete="current-password" /></label>
        <div class="actions"><button name="action" value="signin">登入</button><button class="secondary" name="action" value="signup">建立帳號</button></div>
        <p id="status" class="status" data-type="${hasCloudConfig() ? "info" : "warn"}">${hasCloudConfig() ? "請登入以存取雲端資料。" : "請先建立 config.js 並設定 Firebase API Key 與 Project ID。"}</p>
      </form>
    </main>`;
  applyProfile();
  document.querySelector("#auth-form").addEventListener("submit", handleAuth);
};

const handleAuth = async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    setStatus("正在連線雲端身份服務…");
    state.session = event.submitter.value === "signup"
      ? await signUp(form.get("email"), form.get("password"))
      : await signIn(form.get("email"), form.get("password"));
    await loadCloudData();
    renderShell();
    renderView();
  } catch (error) {
    setStatus(error.message, "error");
  }
};

const loadCloudData = async () => {
  const profile = await getProfile(state.session);
  state.profile = { ...DEFAULT_PROFILE, ...(profile || {}) };
  if (!profile) await saveProfile(state.session, state.profile);
  [state.exams, state.notes, state.events] = await Promise.all([
    listDocs(state.session, "exams"),
    listDocs(state.session, "notes"),
    listDocs(state.session, "events"),
  ]);
};

const averageScore = () => state.exams.length ? (state.exams.reduce((sum, exam) => sum + Number(exam.score || 0), 0) / state.exams.length).toFixed(1) : "--";

const renderView = () => {
  const view = document.querySelector("#view");
  if (state.active === "dashboard") view.innerHTML = dashboardView();
  if (state.active === "exams") view.innerHTML = examsView();
  if (state.active === "notes") view.innerHTML = notesView();
  if (state.active === "calendar") view.innerHTML = calendarView();
  if (state.active === "pomodoro") view.innerHTML = pomodoroView();
  if (state.active === "tutor") view.innerHTML = tutorView();
  if (state.active === "settings") view.innerHTML = settingsView();
  bindViewEvents();
};

const dashboardView = () => `
  <div class="cards">
    <article class="metric"><span>平均分數</span><strong>${averageScore()}</strong></article>
    <article class="metric"><span>雲端筆記</span><strong>${state.notes.length}</strong></article>
    <article class="metric"><span>日曆計畫</span><strong>${state.events.length}</strong></article>
    <article class="metric"><span>蕃茄鐘</span><strong>${Math.ceil(state.pomodoro.seconds / 60)} 分</strong></article>
  </div>
  <section class="panel"><h2>最近學習狀態</h2><div class="timeline">${[...state.exams, ...state.notes, ...state.events].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 6).map((item) => `<div><strong>${escapeHtml(item.title || item.subject || item.name)}</strong><small>${new Date(item.updatedAt || Date.now()).toLocaleString("zh-Hant")}</small></div>`).join("") || "<p>開始新增成績、筆記或日曆計畫吧。</p>"}</div></section>`;

const examsView = () => `
  <section class="panel"><h2>登錄考試分數與備註</h2><form id="exam-form" class="grid-form"><input name="subject" placeholder="科目" required /><input name="score" type="number" min="0" max="100" placeholder="分數" required /><input name="date" type="date" required /><textarea name="note" placeholder="備註與檢討"></textarea><button>儲存到雲端</button></form></section>
  <section class="list">${state.exams.map((exam) => `<article class="panel item"><div><h3>${escapeHtml(exam.subject)}</h3><p>${escapeHtml(exam.note)}</p><small>${exam.date} · ${exam.score} 分</small></div><button class="danger" data-delete="exams" data-id="${exam.id}">刪除</button></article>`).join("")}</section>`;

const notesView = () => `
  <section class="panel"><h2>雲端筆記本</h2><form id="note-form" class="grid-form"><input name="title" placeholder="筆記標題" required /><textarea name="content" placeholder="重點、摘要、待釐清問題" required></textarea><button>同步筆記</button></form></section>
  <section class="list">${state.notes.map((note) => `<article class="panel item"><div><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.content)}</p><small>更新：${new Date(note.updatedAt).toLocaleString("zh-Hant")}</small></div><button class="danger" data-delete="notes" data-id="${note.id}">刪除</button></article>`).join("")}</section>`;

const calendarView = () => `
  <section class="panel"><h2>自訂學習日曆</h2><form id="event-form" class="grid-form"><input name="title" placeholder="任務名稱" required /><input name="date" type="date" required /><select name="type"><option>複習</option><option>作業</option><option>考試</option><option>專題</option></select><textarea name="detail" placeholder="規劃內容"></textarea><button>加入雲端日曆</button></form></section>
  <section class="list">${state.events.sort((a, b) => a.date.localeCompare(b.date)).map((item) => `<article class="panel item"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p><small>${item.date} · ${item.type}</small></div><button class="danger" data-delete="events" data-id="${item.id}">刪除</button></article>`).join("")}</section>`;

const pomodoroView = () => `
  <section class="panel pomodoro"><h2>蕃茄鐘</h2><div class="timer">${String(Math.floor(state.pomodoro.seconds / 60)).padStart(2, "0")}:${String(state.pomodoro.seconds % 60).padStart(2, "0")}</div><p>目前模式：${state.pomodoro.mode === "focus" ? "專注" : "休息"}</p><div class="actions"><button id="toggle-timer">${state.pomodoro.running ? "暫停" : "開始"}</button><button id="reset-timer" class="secondary">重設</button><button id="switch-timer" class="ghost">切換專注/休息</button></div></section>`;

const tutorView = () => `
  <section class="panel"><h2>NVIDIA NIM AI 導師</h2><form id="tutor-form" class="grid-form"><textarea name="question" placeholder="輸入你想請 AI 導師拆解的觀念、題目或讀書計畫" required></textarea><button>詢問 AI 導師</button></form><div id="tutor-answer" class="answer">AI 會根據你的成績、近期筆記與日曆規劃給出建議。</div></section>`;

const settingsView = () => `
  <section class="panel"><h2>個人化設定</h2><form id="settings-form" class="grid-form"><label>深色/淺色<select name="theme"><option value="light" ${state.profile.theme === "light" ? "selected" : ""}>淺色</option><option value="dark" ${state.profile.theme === "dark" ? "selected" : ""}>深色</option></select></label><label>喜好顏色<input name="accent" type="color" value="${state.profile.accent}" /></label><label>字體大小<input name="fontSize" type="range" min="14" max="22" value="${state.profile.fontSize}" /></label><label>字形<input name="fontFamily" value="${escapeHtml(state.profile.fontFamily)}" /></label><label>NIM Endpoint<input name="nimEndpoint" value="${escapeHtml(state.profile.nimEndpoint)}" /></label><label>NIM 模型<input name="nimModel" value="${escapeHtml(state.profile.nimModel)}" /></label><label>NIM API Key<input name="nimApiKey" type="password" value="${escapeHtml(state.profile.nimApiKey)}" /></label><button>儲存設定到雲端</button></form><p class="hint">正式部署建議把 NIM API Key 放在雲端函式或後端代理，避免瀏覽器暴露金鑰。</p></section>`;

const bindViewEvents = () => {
  document.querySelector("#exam-form")?.addEventListener("submit", async (event) => saveCollection(event, "exams", state.exams));
  document.querySelector("#note-form")?.addEventListener("submit", async (event) => saveCollection(event, "notes", state.notes));
  document.querySelector("#event-form")?.addEventListener("submit", async (event) => saveCollection(event, "events", state.events));
  document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => removeCollection(button.dataset.delete, button.dataset.id)));
  document.querySelector("#settings-form")?.addEventListener("submit", saveSettings);
  document.querySelector("#tutor-form")?.addEventListener("submit", askTutor);
  document.querySelector("#toggle-timer")?.addEventListener("click", toggleTimer);
  document.querySelector("#reset-timer")?.addEventListener("click", () => resetTimer(state.pomodoro.mode));
  document.querySelector("#switch-timer")?.addEventListener("click", () => resetTimer(state.pomodoro.mode === "focus" ? "break" : "focus"));
};

const saveCollection = async (event, collection, target) => {
  event.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    const saved = await saveDoc(state.session, collection, payload);
    target.unshift(saved);
    event.currentTarget.reset();
    renderView();
    setStatus("已儲存到雲端。", "success");
  } catch (error) { setStatus(error.message, "error"); }
};

const removeCollection = async (collection, id) => {
  try {
    await deleteDoc(state.session, collection, id);
    state[collection] = state[collection].filter((item) => item.id !== id);
    renderView();
    setStatus("已從雲端刪除。", "success");
  } catch (error) { setStatus(error.message, "error"); }
};

const saveSettings = async (event) => {
  event.preventDefault();
  const next = Object.fromEntries(new FormData(event.currentTarget));
  state.profile = { ...state.profile, ...next, fontSize: Number(next.fontSize) };
  try {
    await saveProfile(state.session, state.profile);
    applyProfile();
    renderShell();
    renderView();
    setStatus("個人化設定已同步到雲端。", "success");
  } catch (error) { setStatus(error.message, "error"); }
};

const askTutor = async (event) => {
  event.preventDefault();
  const answer = document.querySelector("#tutor-answer");
  const question = new FormData(event.currentTarget).get("question");
  answer.textContent = "AI 導師思考中…";
  try {
    const content = await askNimTutor({
      endpoint: state.profile.nimEndpoint,
      apiKey: state.profile.nimApiKey,
      model: state.profile.nimModel,
      messages: [
        { role: "system", content: "你是繁體中文自主學習 AI 導師。請根據學生的雲端成績、筆記與日曆規劃，提供具體、鼓勵且可執行的建議。" },
        { role: "user", content: JSON.stringify({ question, exams: state.exams.slice(0, 8), notes: state.notes.slice(0, 5), events: state.events.slice(0, 8) }) },
      ],
    });
    answer.textContent = content;
  } catch (error) { answer.textContent = error.message; }
};

const toggleTimer = () => {
  state.pomodoro.running = !state.pomodoro.running;
  if (state.pomodoro.running) {
    state.pomodoro.timer = setInterval(() => {
      state.pomodoro.seconds -= 1;
      if (state.pomodoro.seconds <= 0) resetTimer(state.pomodoro.mode === "focus" ? "break" : "focus");
      if (state.active === "pomodoro") renderView();
    }, 1000);
  } else {
    clearInterval(state.pomodoro.timer);
  }
  renderView();
};

const resetTimer = (mode) => {
  clearInterval(state.pomodoro.timer);
  state.pomodoro = { mode, seconds: mode === "focus" ? 25 * 60 : 5 * 60, running: false, timer: null };
  renderView();
};

renderAuth();
