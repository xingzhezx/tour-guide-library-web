const STORAGE_KEY = "tourGuideLibraryV1";
const AUTH_USERS_KEY = "tourGuideUsersV1";
const AUTH_SESSION_KEY = "tourGuideSessionV1";
const WEB_SEARCH_SETTINGS_KEY = "tourGuideWebSearchSettingsV1";
const PDFJS_LIB_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
const PDFJS_WORKER_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
const OCR_LIB_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const OCR_LANG = "chi_sim+eng";
const OCR_FALLBACK_MIN_CHARS = 40;
const OCR_MAX_PAGES = 12;
const HF_TRANSFORMERS_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
const ASR_MODEL_ID = "Xenova/whisper-tiny";
const MAMMOTH_BROWSER_URL =
  "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js";
const DB_NAME = "tourGuideLibraryDB";
const DB_VERSION = 1;
const AUDIO_STORE = "audioBlobs";
const EDITOR_SECTIONS = ["intro", "script", "webscript", "tips", "catalog", "audio"];
const TAVILY_API_URL = "https://api.tavily.com/search";
const TAVILY_MAX_QUERY_LENGTH = 400;
const STARTER_TEMPLATES = [
  {
    id: "ancient_town",
    title: "古城古镇模板",
    subtitle: "适合历史街区、坊巷、古镇路线",
    intro: "适合围绕街区格局、历史沿革、代表建筑与人文故事展开讲解。",
    namePrefix: "古镇景区模板",
  },
  {
    id: "museum",
    title: "博物馆模板",
    subtitle: "适合展馆、纪念馆、陈列馆",
    intro: "适合按展厅顺序整理背景介绍、重点藏品、人物故事和参观提醒。",
    namePrefix: "博物馆讲解模板",
  },
  {
    id: "mountain",
    title: "山岳景区模板",
    subtitle: "适合山、水、峡谷、自然保护地",
    intro: "适合强调地理环境、核心景点、游览路线、安全提示和天气准备。",
    namePrefix: "山岳景区模板",
  },
  {
    id: "heritage",
    title: "文化遗产模板",
    subtitle: "适合遗址、公园、历史名胜",
    intro: "适合突出遗产价值、年代背景、修缮保护和看点串联。",
    namePrefix: "文化遗产模板",
  },
];
let pdfJsLoaderPromise = null;
let ocrLoaderPromise = null;
let asrPipelinePromise = null;
let mammothLoaderPromise = null;
let storageQuotaWarned = false;
let dbPromise = null;
const audioObjectUrls = new Map();

const state = {
  spots: [],
  selectedId: null,
  search: "",
  mobileView: "list",
  selectedCatalogId: "",
  editorSection: "",
  authUser: "",
  currentView: "home",
  homeTab: "featured",
  webSearchApiKey: "",
};

const el = {
  body: document.body,
  authOverlay: document.querySelector("#authOverlay"),
  authUsername: document.querySelector("#authUsername"),
  authPassword: document.querySelector("#authPassword"),
  authLoginBtn: document.querySelector("#authLoginBtn"),
  authRegisterBtn: document.querySelector("#authRegisterBtn"),
  searchSettingsOverlay: document.querySelector("#searchSettingsOverlay"),
  searchSettingsBtn: document.querySelector("#searchSettingsBtn"),
  searchSettingsCloseBtn: document.querySelector("#searchSettingsCloseBtn"),
  searchSettingsSaveBtn: document.querySelector("#searchSettingsSaveBtn"),
  searchSettingsClearBtn: document.querySelector("#searchSettingsClearBtn"),
  searchApiKeyInput: document.querySelector("#searchApiKeyInput"),
  currentUser: document.querySelector("#currentUser"),
  logoutBtn: document.querySelector("#logoutBtn"),
  homeViewBtn: document.querySelector("#homeViewBtn"),
  libraryViewBtn: document.querySelector("#libraryViewBtn"),
  dashboardView: document.querySelector("#dashboardView"),
  libraryShell: document.querySelector("#libraryShell"),
  dashboardEnterBtn: document.querySelector("#dashboardEnterBtn"),
  dashboardImportInput: document.querySelector("#dashboardImportInput"),
  homeCreateBtn: document.querySelector("#homeCreateBtn"),
  homeFeaturedBtn: document.querySelector("#homeFeaturedBtn"),
  homeMineBtn: document.querySelector("#homeMineBtn"),
  templateGrid: document.querySelector("#templateGrid"),
  recentGrid: document.querySelector("#recentGrid"),
  featuredPanel: document.querySelector("#featuredPanel"),
  minePanel: document.querySelector("#minePanel"),
  statSpots: document.querySelector("#statSpots"),
  statAudios: document.querySelector("#statAudios"),
  statWebScripts: document.querySelector("#statWebScripts"),
  statTips: document.querySelector("#statTips"),
  spotList: document.querySelector("#spotList"),
  searchInput: document.querySelector("#searchInput"),
  addSpotBtn: document.querySelector("#addSpotBtn"),
  deleteBtn: document.querySelector("#deleteBtn"),
  emptyState: document.querySelector("#emptyState"),
  spotForm: document.querySelector("#spotForm"),
  nameInput: document.querySelector("#nameInput"),
  introInput: document.querySelector("#introInput"),
  scriptInput: document.querySelector("#scriptInput"),
  polishScriptBtn: document.querySelector("#polishScriptBtn"),
  webScriptInput: document.querySelector("#webScriptInput"),
  tipsInput: document.querySelector("#tipsInput"),
  fieldMenu: document.querySelector("#fieldMenu"),
  fieldOpenButtons: Array.from(document.querySelectorAll(".field-open-btn")),
  sectionPanels: Array.from(document.querySelectorAll(".section-panel")),
  sectionBackButtons: Array.from(document.querySelectorAll(".back-btn")),
  catalogList: document.querySelector("#catalogList"),
  catalogPreview: document.querySelector("#catalogPreview"),
  refreshCatalogBtn: document.querySelector("#refreshCatalogBtn"),
  fetchIntroBtn: document.querySelector("#fetchIntroBtn"),
  fetchWebScriptBtn: document.querySelector("#fetchWebScriptBtn"),
  fetchTipsBtn: document.querySelector("#fetchTipsBtn"),
  audioInput: document.querySelector("#audioInput"),
  audioList: document.querySelector("#audioList"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  jobStatus: document.querySelector("#jobStatus"),
  mobileNav: document.querySelector("#mobileNav"),
  mobileListBtn: document.querySelector("#mobileListBtn"),
  mobileEditorBtn: document.querySelector("#mobileEditorBtn"),
};

init();

async function init() {
  loadWebSearchSettings();
  bindEvents();
  updateSearchSettingsView();
  registerServiceWorker();
  const loggedIn = await restoreSession();
  if (!loggedIn) {
    openAuthOverlay();
    renderAll();
    updateMobileMode();
    return;
  }
  await bootstrapUserData();
}

async function bootstrapUserData() {
  loadState();
  if (!state.selectedId && state.spots.length) {
    state.selectedId = state.spots[0].id;
  }
  renderAll();
  updateMobileMode();
  await migrateInlineAudiosToIndexedDb();
  renderAll();
  updateAuthHeader();
}

function bindEvents() {
  el.authLoginBtn?.addEventListener("click", handleAuthLogin);
  el.authRegisterBtn?.addEventListener("click", handleAuthRegister);
  el.logoutBtn?.addEventListener("click", handleAuthLogout);
  el.searchSettingsBtn?.addEventListener("click", openSearchSettings);
  el.searchSettingsCloseBtn?.addEventListener("click", closeSearchSettings);
  el.searchSettingsSaveBtn?.addEventListener("click", handleSaveSearchSettings);
  el.searchSettingsClearBtn?.addEventListener("click", handleClearSearchSettings);
  el.homeViewBtn?.addEventListener("click", () => switchAppView("home"));
  el.libraryViewBtn?.addEventListener("click", () => switchAppView("library"));
  el.dashboardEnterBtn?.addEventListener("click", () => switchAppView("library"));
  el.dashboardImportInput?.addEventListener("change", handleUnifiedImport);
  el.homeCreateBtn?.addEventListener("click", createSpot);
  el.homeFeaturedBtn?.addEventListener("click", () => switchHomeTab("featured"));
  el.homeMineBtn?.addEventListener("click", () => switchHomeTab("mine"));
  el.authPassword?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAuthLogin();
    }
  });
  el.addSpotBtn.addEventListener("click", createSpot);
  el.deleteBtn.addEventListener("click", deleteCurrentSpot);
  el.searchInput.addEventListener("input", () => {
    state.search = el.searchInput.value.trim().toLowerCase();
    renderList();
  });
  el.spotForm.addEventListener("submit", (event) => {
    event.preventDefault();
    el.scriptInput.value = refinePersonalScriptText(el.scriptInput.value);
    syncFormToState();
    alert("已保存当前景区资料。");
  });
  ["input", "change"].forEach((eventName) => {
    el.nameInput.addEventListener(eventName, handleAutoSave);
    el.introInput.addEventListener(eventName, handleAutoSave);
    el.scriptInput.addEventListener(eventName, handleAutoSave);
    el.webScriptInput.addEventListener(eventName, handleAutoSave);
    el.tipsInput.addEventListener(eventName, handleAutoSave);
  });
  el.refreshCatalogBtn.addEventListener("click", () => {
    const current = getCurrentSpot();
    if (!current) return;
    current.catalog = buildSpotCatalog(current);
    state.selectedCatalogId = current.catalog[0]?.id || "";
    saveState();
    renderCatalog(current);
  });
  el.fieldOpenButtons.forEach((btn) => {
    btn.addEventListener("click", () => openEditorSection(btn.dataset.section || ""));
  });
  el.sectionBackButtons.forEach((btn) => {
    btn.addEventListener("click", () => openEditorSection(""));
  });
  if (el.fetchIntroBtn) {
    el.fetchIntroBtn.addEventListener("click", handleFetchIntroFromWeb);
  }
  if (el.polishScriptBtn) {
    el.polishScriptBtn.addEventListener("click", handlePolishPersonalScript);
  }
  if (el.fetchWebScriptBtn) {
    el.fetchWebScriptBtn.addEventListener("click", handleFetchWebScriptFromWeb);
  }
  if (el.fetchTipsBtn) {
    el.fetchTipsBtn.addEventListener("click", handleFetchTipsFromWeb);
  }
  el.audioInput.addEventListener("change", handleAudioUpload);
  el.exportBtn.addEventListener("click", exportData);
  el.importInput.addEventListener("change", handleUnifiedImport);
  el.mobileListBtn.addEventListener("click", () => switchMobileView("list"));
  el.mobileEditorBtn.addEventListener("click", () => switchMobileView("editor"));
  window.addEventListener("resize", updateMobileMode);
  window.addEventListener("beforeunload", () => {
    audioObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    audioObjectUrls.clear();
  });
}

function loadWebSearchSettings() {
  try {
    const raw = localStorage.getItem(WEB_SEARCH_SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.webSearchApiKey = String(parsed?.tavilyApiKey || "").trim();
  } catch (error) {
    state.webSearchApiKey = "";
  }
}

function saveWebSearchSettings() {
  localStorage.setItem(
    WEB_SEARCH_SETTINGS_KEY,
    JSON.stringify({ tavilyApiKey: state.webSearchApiKey || "" }),
  );
}

function updateSearchSettingsView() {
  if (el.searchApiKeyInput) {
    el.searchApiKeyInput.value = state.webSearchApiKey || "";
  }
  if (el.searchSettingsBtn) {
    el.searchSettingsBtn.textContent = state.webSearchApiKey
      ? "搜索设置已连接"
      : "搜索设置";
  }
}

function openSearchSettings() {
  updateSearchSettingsView();
  el.searchSettingsOverlay?.classList.remove("hidden");
}

function closeSearchSettings() {
  el.searchSettingsOverlay?.classList.add("hidden");
}

function handleSaveSearchSettings() {
  state.webSearchApiKey = String(el.searchApiKeyInput?.value || "").trim();
  saveWebSearchSettings();
  updateSearchSettingsView();
  closeSearchSettings();
  alert(state.webSearchApiKey ? "搜索设置已保存。" : "已清空搜索密钥。");
}

function handleClearSearchSettings() {
  state.webSearchApiKey = "";
  saveWebSearchSettings();
  updateSearchSettingsView();
  if (el.searchApiKeyInput) {
    el.searchApiKeyInput.value = "";
  }
  alert("已清空 Tavily API Key。");
}

function getScopedStorageKey() {
  return `${STORAGE_KEY}_${state.authUser || "guest"}`;
}

function loadState() {
  if (!state.authUser) return;
  const raw = localStorage.getItem(getScopedStorageKey());
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeData(parsed);
    state.spots = normalized.spots;
    state.selectedId = normalized.selectedId;
  } catch (error) {
    console.warn("Failed to read local data", error);
  }
}

function normalizeData(input) {
  const rawSpots = extractSpotArray(input);
  const spots = Array.isArray(rawSpots)
    ? rawSpots.map((spot) => ({
        id: String(spot.id || createId()),
        name: String(spot.name || "未命名景区"),
        intro: String(spot.intro || ""),
        script: String(spot.script || ""),
        webScript: String(spot.webScript || spot.netScript || ""),
        tips: normalizeTips(spot.tips),
        audios: Array.isArray(spot.audios)
          ? spot.audios
              .map((audio) => ({
                id: String(audio.id || createId()),
                name: String(audio.name || "未命名录音"),
                type: String(audio.type || "audio/mpeg"),
                size: Number(audio.size || 0),
                dataUrl: String(audio.dataUrl || ""),
                storage: String(audio.storage || (audio.dataUrl ? "inline" : "idb")),
              }))
              .filter((audio) => audio.dataUrl || audio.storage === "idb")
          : [],
        catalog: Array.isArray(spot.catalog)
          ? spot.catalog
              .map((item) => ({
                id: String(item.id || createId()),
                title: String(item.title || "未命名目录"),
                field: String(item.field || "script"),
                content: String(item.content || ""),
              }))
              .filter((item) => item.title)
          : [],
      }))
    : [];

  const selectedId = spots.some((item) => item.id === input?.selectedId)
    ? input.selectedId
    : spots[0]?.id || null;

  return { spots, selectedId };
}

function cloneSpotsWithNewIds(spots) {
  return (spots || []).map((spot) => ({
    ...spot,
    id: createId(),
    audios: Array.isArray(spot.audios)
      ? spot.audios.map((audio) => ({
          ...audio,
          id: createId(),
        }))
      : [],
    catalog: Array.isArray(spot.catalog)
      ? spot.catalog.map((item) => ({
          ...item,
          id: createId(),
        }))
      : [],
  }));
}

function saveState() {
  if (!state.authUser) return false;
  const payload = {
    spots: state.spots,
    selectedId: state.selectedId,
  };
  try {
    localStorage.setItem(getScopedStorageKey(), JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("Failed to save local data", error);
    if (!storageQuotaWarned) {
      storageQuotaWarned = true;
      alert("本地存储空间不足：数据可能无法持久保存，建议尽快导出备份。");
    }
    return false;
  }
}

function readUsers() {
  try {
    const raw = localStorage.getItem(AUTH_USERS_KEY);
    if (!raw) return {};
    const users = JSON.parse(raw);
    return users && typeof users === "object" ? users : {};
  } catch (error) {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users || {}));
}

function normalizeAuthUsername(username) {
  return String(username || "").trim().toLowerCase();
}

async function hashPassword(password) {
  const text = String(password || "");
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  }
  return btoa(unescape(encodeURIComponent(text)));
}

async function restoreSession() {
  const sessionUser = normalizeAuthUsername(localStorage.getItem(AUTH_SESSION_KEY));
  if (!sessionUser) return false;
  const users = readUsers();
  if (!users[sessionUser]) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return false;
  }
  state.authUser = sessionUser;
  return true;
}

function openAuthOverlay() {
  el.authOverlay?.classList.remove("hidden");
  el.currentUser?.classList.add("hidden");
  el.logoutBtn?.classList.add("hidden");
}

function closeAuthOverlay() {
  el.authOverlay?.classList.add("hidden");
}

function updateAuthHeader() {
  if (!state.authUser) {
    el.currentUser?.classList.add("hidden");
    el.logoutBtn?.classList.add("hidden");
    return;
  }
  if (el.currentUser) {
    el.currentUser.textContent = `账号：${state.authUser}`;
    el.currentUser.classList.remove("hidden");
  }
  el.logoutBtn?.classList.remove("hidden");
}

function migrateLegacyStorageForUser() {
  const scopedKey = getScopedStorageKey();
  if (localStorage.getItem(scopedKey)) return;
  const legacy = localStorage.getItem(STORAGE_KEY);
  if (!legacy) return;
  localStorage.setItem(scopedKey, legacy);
}

function resetStateForAuth() {
  state.spots = [];
  state.selectedId = null;
  state.selectedCatalogId = "";
  state.editorSection = "";
  state.search = "";
  state.currentView = "home";
  state.homeTab = "featured";
  if (el.searchInput) {
    el.searchInput.value = "";
  }
}

async function handleAuthLogin() {
  const username = normalizeAuthUsername(el.authUsername?.value);
  const password = String(el.authPassword?.value || "");
  if (!username || !password) {
    alert("请输入账号和密码。");
    return;
  }
  const users = readUsers();
  const record = users[username];
  if (!record) {
    alert("账号不存在，请先注册。");
    return;
  }
  const hash = await hashPassword(password);
  if (record.passwordHash !== hash) {
    alert("密码错误，请重试。");
    return;
  }
  localStorage.setItem(AUTH_SESSION_KEY, username);
  state.authUser = username;
  migrateLegacyStorageForUser();
  resetStateForAuth();
  if (el.authPassword) el.authPassword.value = "";
  closeAuthOverlay();
  await bootstrapUserData();
}

async function handleAuthRegister() {
  const username = normalizeAuthUsername(el.authUsername?.value);
  const password = String(el.authPassword?.value || "");
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    alert("账号需为 3-24 位，仅支持字母/数字/下划线。");
    return;
  }
  if (password.length < 6) {
    alert("密码至少 6 位。");
    return;
  }

  const users = readUsers();
  if (users[username]) {
    alert("账号已存在，请直接登录。");
    return;
  }

  users[username] = {
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  writeUsers(users);
  localStorage.setItem(AUTH_SESSION_KEY, username);
  state.authUser = username;
  resetStateForAuth();
  if (el.authPassword) el.authPassword.value = "";
  closeAuthOverlay();
  await bootstrapUserData();
}

function handleAuthLogout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  state.authUser = "";
  resetStateForAuth();
  if (el.authPassword) el.authPassword.value = "";
  updateAuthHeader();
  renderAll();
  openAuthOverlay();
}

function createId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

async function openAppDb() {
  if (!("indexedDB" in window)) {
    throw new Error("INDEXEDDB_UNSUPPORTED");
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("DB_OPEN_FAILED"));
  });
  return dbPromise;
}

async function idbPutAudioBlob(id, blob) {
  const db = await openAppDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).put(blob, id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("DB_WRITE_FAILED"));
  });
}

async function idbGetAudioBlob(id) {
  const db = await openAppDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readonly");
    const req = tx.objectStore(AUDIO_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("DB_READ_FAILED"));
  });
}

async function idbDeleteAudioBlob(id) {
  const db = await openAppDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("DB_DELETE_FAILED"));
  });
}

async function createAudioEntryFromFile(file) {
  const audioId = createId();
  try {
    await idbPutAudioBlob(audioId, file);
    return {
      id: audioId,
      name: file.name,
      type: file.type || "audio/mpeg",
      size: file.size,
      storage: "idb",
    };
  } catch (error) {
    console.warn("IndexedDB unavailable, fallback to inline audio", error);
    return {
      id: audioId,
      name: file.name,
      type: file.type || "audio/mpeg",
      size: file.size,
      storage: "inline",
      dataUrl: await fileToDataURL(file),
    };
  }
}

async function migrateInlineAudiosToIndexedDb() {
  let changed = false;
  for (const spot of state.spots) {
    for (const audio of spot.audios || []) {
      if (audio.storage === "idb") continue;
      if (!audio.dataUrl) continue;
      try {
        const blob = await dataUrlToBlob(audio.dataUrl);
        await idbPutAudioBlob(audio.id, blob);
        audio.storage = "idb";
        audio.size = blob.size;
        delete audio.dataUrl;
        changed = true;
      } catch (error) {
        console.warn("Failed to migrate audio", error);
      }
    }
    if (!Array.isArray(spot.catalog) || !spot.catalog.length) {
      spot.catalog = buildSpotCatalog(spot);
      changed = true;
    }
  }
  if (changed) {
    saveState();
  }
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function revokeAudioObjectUrl(audioId) {
  const existing = audioObjectUrls.get(audioId);
  if (!existing) return;
  URL.revokeObjectURL(existing);
  audioObjectUrls.delete(audioId);
}

async function resolveAudioSource(audio) {
  if (audio.storage === "idb") {
    const cached = audioObjectUrls.get(audio.id);
    if (cached) return cached;
    const blob = await idbGetAudioBlob(audio.id);
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    audioObjectUrls.set(audio.id, url);
    return url;
  }
  return audio.dataUrl || "";
}

async function deleteAudioEntry(audio) {
  if (audio.storage === "idb") {
    try {
      await idbDeleteAudioBlob(audio.id);
    } catch (error) {
      console.warn("Failed to delete audio blob", error);
    }
    revokeAudioObjectUrl(audio.id);
  }
}

function normalizeTips(tips) {
  if (Array.isArray(tips)) {
    return tips.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof tips === "string") {
    return tips
      .split(/\r?\n|[;；]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function extractSpotArray(input) {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input.spots)) return input.spots;
  if (Array.isArray(input.scenicSpots)) return input.scenicSpots;
  if (Array.isArray(input.data?.spots)) return input.data.spots;
  if (Array.isArray(input.items)) return input.items;
  return [];
}

function getCurrentSpot() {
  return state.spots.find((spot) => spot.id === state.selectedId) || null;
}

function normalizeEditorSection(section) {
  const value = String(section || "").trim().toLowerCase();
  return EDITOR_SECTIONS.includes(value) ? value : "";
}

function sectionFromPanelId(panelId) {
  const shortId = String(panelId || "").replace(/^section/, "").toLowerCase();
  return normalizeEditorSection(shortId);
}

function openEditorSection(section) {
  state.editorSection = normalizeEditorSection(section);
  renderEditorSections();
}

function renderEditorSections() {
  const current = getCurrentSpot();
  const activeSection = normalizeEditorSection(state.editorSection);
  state.editorSection = activeSection;

  if (!current) {
    el.fieldMenu?.classList.add("hidden");
    el.sectionPanels.forEach((panel) => panel.classList.add("hidden"));
    return;
  }

  el.fieldMenu?.classList.toggle("hidden", Boolean(activeSection));
  el.fieldOpenButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === activeSection);
  });
  el.sectionPanels.forEach((panel) => {
    const section = sectionFromPanelId(panel.id);
    panel.classList.toggle("hidden", section !== activeSection);
  });
}

function buildEmptySpot(name = `新景区 ${state.spots.length + 1}`) {
  return {
    id: createId(),
    name,
    intro: "",
    script: "",
    webScript: "",
    tips: [],
    audios: [],
    catalog: buildSpotCatalog({ intro: "", script: "", webScript: "", tips: [] }),
  };
}

function buildTemplateSpot(template) {
  const templateTitle = String(template?.title || "景区模板").trim();
  const templateName = `${template?.namePrefix || templateTitle} ${state.spots.length + 1}`;
  return polishRecognizedSpot({
    id: createId(),
    name: templateName,
    intro: [
      `${templateName}适合建立标准化带团资料。`,
      String(template?.intro || "").trim(),
      "建议补充景区区位、核心看点、历史背景和现场讲解节奏。",
    ]
      .filter(Boolean)
      .join("\n"),
    script: [
      `各位游客，欢迎来到${templateName}。`,
      "接下来我会按照景区概况、核心看点、沿线故事和游览提醒四个部分为大家讲解。",
      "你可以把现场口播、互动提问、时间节点和集合提示继续补充到这里。",
    ].join("\n\n"),
    webScript: "",
    tips: [
      "出团前确认开放时间、票务政策和预约要求。",
      "集合点、洗手间、停车区和补给点建议提前写清楚。",
      "遇到台阶、湿滑路段或人流密集区域时补充安全提示。",
    ],
    audios: [],
    catalog: [],
  });
}

function insertSpotAndOpen(spot, options = {}) {
  const normalized = polishRecognizedSpot(spot);
  state.spots.unshift(normalized);
  state.selectedId = normalized.id;
  state.selectedCatalogId = normalized.catalog[0]?.id || "";
  state.editorSection = normalizeEditorSection(options.section);
  state.currentView = "library";
  switchMobileView("editor");
  saveState();
  renderAll();
}

function createSpot() {
  insertSpotAndOpen(buildEmptySpot(), { section: "" });
}

function deleteCurrentSpot() {
  const current = getCurrentSpot();
  if (!current) return;
  const ok = confirm(`确认删除“${current.name}”吗？此操作无法撤销。`);
  if (!ok) return;

  Promise.all((current.audios || []).map((audio) => deleteAudioEntry(audio))).catch(
    () => {},
  );

  state.spots = state.spots.filter((spot) => spot.id !== state.selectedId);
  state.selectedId = state.spots[0]?.id || null;
  state.selectedCatalogId = "";
  state.editorSection = "";
  if (!state.selectedId) {
    switchMobileView("list");
  }
  saveState();
  renderAll();
}

function handleAutoSave() {
  const current = getCurrentSpot();
  if (!current) return;
  syncFormToState();
  renderList();
  renderCatalog(current);
}

function handlePolishPersonalScript() {
  const current = getCurrentSpot();
  if (!current) return;

  const before = String(el.scriptInput.value || "");
  const after = refinePersonalScriptText(before);
  el.scriptInput.value = after;
  syncFormToState();
  renderList();
  renderCatalog(current);
  openEditorSection("script");

  if (before.trim() === after.trim()) {
    alert("个人讲解词已是较优状态，无需额外精修。");
  } else {
    alert("个人讲解词已完成精修。");
  }
}

function syncFormToState() {
  const current = getCurrentSpot();
  if (!current) return;
  current.name = el.nameInput.value.trim() || "未命名景区";
  current.intro = el.introInput.value.trim();
  current.script = el.scriptInput.value.trim();
  current.webScript = el.webScriptInput.value.trim();
  current.tips = el.tipsInput.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  current.catalog = buildSpotCatalog(current);
  if (!current.catalog.some((item) => item.id === state.selectedCatalogId)) {
    state.selectedCatalogId = current.catalog[0]?.id || "";
  }
  saveState();
}

function switchHomeTab(tab) {
  state.homeTab = tab === "mine" ? "mine" : "featured";
  renderDashboard();
}

function switchAppView(view) {
  state.currentView = view === "library" ? "library" : "home";
  if (state.currentView === "library" && state.spots.length && !state.selectedId) {
    state.selectedId = state.spots[0].id;
    state.selectedCatalogId = state.spots[0]?.catalog?.[0]?.id || "";
  }
  renderAll();
}

function renderAppView() {
  const onHome = state.currentView !== "library";
  el.dashboardView?.classList.toggle("hidden", !onHome);
  el.libraryShell?.classList.toggle("hidden", onHome);
  el.homeViewBtn?.classList.toggle("active", onHome);
  el.libraryViewBtn?.classList.toggle("active", !onHome);
}

function getDashboardStats() {
  return state.spots.reduce(
    (acc, spot) => {
      acc.spots += 1;
      acc.audios += Array.isArray(spot.audios) ? spot.audios.length : 0;
      acc.webScripts += splitScriptIntoSections(spot.webScript || "").length;
      acc.tips += Array.isArray(spot.tips) ? spot.tips.length : 0;
      return acc;
    },
    { spots: 0, audios: 0, webScripts: 0, tips: 0 },
  );
}

function buildCardMeta(spot) {
  return [
    `${splitScriptIntoSections(spot.script || "").length} 段个人讲解`,
    `${splitScriptIntoSections(spot.webScript || "").length} 段网络讲解`,
    `${Array.isArray(spot.tips) ? spot.tips.length : 0} 条注意事项`,
    `${Array.isArray(spot.audios) ? spot.audios.length : 0} 条录音`,
  ].join(" · ");
}

function renderTemplateCards() {
  if (!el.templateGrid) return;
  el.templateGrid.innerHTML = "";

  STARTER_TEMPLATES.forEach((template) => {
    const card = document.createElement("article");
    card.className = "work-card template-card";

    const kicker = document.createElement("span");
    kicker.className = "card-kicker";
    kicker.textContent = "标准模板";

    const title = document.createElement("h4");
    title.className = "card-title";
    title.textContent = template.title;

    const subtitle = document.createElement("p");
    subtitle.className = "card-subtitle";
    subtitle.textContent = template.subtitle;

    const intro = document.createElement("p");
    intro.className = "card-copy";
    intro.textContent = template.intro;

    const action = document.createElement("button");
    action.type = "button";
    action.className = "ghost card-action";
    action.textContent = "使用模板";
    action.addEventListener("click", () => {
      insertSpotAndOpen(buildTemplateSpot(template));
    });

    card.append(kicker, title, subtitle, intro, action);
    el.templateGrid.appendChild(card);
  });
}

function renderRecentCards() {
  if (!el.recentGrid) return;
  el.recentGrid.innerHTML = "";

  if (!state.spots.length) {
    const empty = document.createElement("article");
    empty.className = "work-card empty-card";

    const title = document.createElement("h4");
    title.className = "card-title";
    title.textContent = "还没有景区资料";

    const copy = document.createElement("p");
    copy.className = "card-copy";
    copy.textContent = "先用模板新建，或从首页直接导入 TXT、PDF、DOC、音频资料。";

    const action = document.createElement("button");
    action.type = "button";
    action.textContent = "立即新建";
    action.addEventListener("click", createSpot);

    empty.append(title, copy, action);
    el.recentGrid.appendChild(empty);
    return;
  }

  state.spots.slice(0, 6).forEach((spot, index) => {
    const card = document.createElement("article");
    card.className = "work-card recent-card";

    const kicker = document.createElement("span");
    kicker.className = "card-kicker";
    kicker.textContent = index === 0 ? "最近编辑" : "景区资料";

    const title = document.createElement("h4");
    title.className = "card-title";
    title.textContent = spot.name;

    const subtitle = document.createElement("p");
    subtitle.className = "card-subtitle";
    subtitle.textContent = buildCardMeta(spot);

    const preview = document.createElement("p");
    preview.className = "card-copy";
    preview.textContent =
      String(spot.intro || spot.script || "还没有内容，点击进入后开始补充。")
        .replace(/\s+/g, " ")
        .slice(0, 88) || "还没有内容，点击进入后开始补充。";

    const action = document.createElement("button");
    action.type = "button";
    action.className = "ghost card-action";
    action.textContent = "继续编辑";
    action.addEventListener("click", () => {
      state.selectedId = spot.id;
      state.selectedCatalogId = spot.catalog?.[0]?.id || "";
      state.editorSection = "";
      state.currentView = "library";
      switchMobileView("editor");
      saveState();
      renderAll();
    });

    card.append(kicker, title, subtitle, preview, action);
    el.recentGrid.appendChild(card);
  });
}

function renderDashboard() {
  const stats = getDashboardStats();
  if (el.statSpots) el.statSpots.textContent = String(stats.spots);
  if (el.statAudios) el.statAudios.textContent = String(stats.audios);
  if (el.statWebScripts) el.statWebScripts.textContent = String(stats.webScripts);
  if (el.statTips) el.statTips.textContent = String(stats.tips);

  const showMine = state.homeTab === "mine";
  el.homeFeaturedBtn?.classList.toggle("active", !showMine);
  el.homeMineBtn?.classList.toggle("active", showMine);
  el.featuredPanel?.classList.toggle("hidden", showMine);
  el.minePanel?.classList.toggle("hidden", !showMine);

  renderTemplateCards();
  renderRecentCards();
}

function renderAll() {
  renderAppView();
  renderDashboard();
  renderList();
  renderEditor();
  updateMobileMode();
}

function renderList() {
  const query = state.search;
  const filtered = state.spots.filter((spot) => {
    return !query || spot.name.toLowerCase().includes(query);
  });

  el.spotList.innerHTML = "";
  if (!filtered.length) {
    const li = document.createElement("li");
    li.textContent = "没有匹配结果";
    li.className = "spot-meta";
    el.spotList.appendChild(li);
    return;
  }

  filtered.forEach((spot) => {
    const li = document.createElement("li");
    li.className = spot.id === state.selectedId ? "active" : "";

    const nameDiv = document.createElement("div");
    nameDiv.className = "spot-name";
    nameDiv.textContent = spot.name;

    const metaDiv = document.createElement("div");
    metaDiv.className = "spot-meta";
    const webSections = splitScriptIntoSections(spot.webScript || "").length;
    metaDiv.textContent =
      `录音 ${spot.audios.length} 条 | 网络讲解 ${webSections} 段 | 注意事项 ${spot.tips.length} 条`;

    li.appendChild(nameDiv);
    li.appendChild(metaDiv);
    li.addEventListener("click", () => {
      state.selectedId = spot.id;
      state.selectedCatalogId = spot.catalog?.[0]?.id || "";
      state.editorSection = "";
      state.currentView = "library";
      switchMobileView("editor");
      saveState();
      renderAll();
    });
    el.spotList.appendChild(li);
  });
}

function renderEditor() {
  const current = getCurrentSpot();
  if (!current) {
    state.editorSection = "";
    el.emptyState.classList.remove("hidden");
    el.spotForm.classList.add("hidden");
    renderEditorSections();
    return;
  }

  el.emptyState.classList.add("hidden");
  el.spotForm.classList.remove("hidden");

  el.nameInput.value = current.name;
  el.introInput.value = current.intro;
  el.scriptInput.value = current.script;
  el.webScriptInput.value = current.webScript || "";
  el.tipsInput.value = current.tips.join("\n");
  if (!Array.isArray(current.catalog) || !current.catalog.length) {
    current.catalog = buildSpotCatalog(current);
  }
  if (!state.selectedCatalogId) {
    state.selectedCatalogId = current.catalog[0]?.id || "";
  }
  renderCatalog(current);
  renderAudioList(current);
  renderEditorSections();
}

function renderAudioList(spot) {
  el.audioList.innerHTML = "";
  if (!spot.audios.length) {
    const li = document.createElement("li");
    li.className = "spot-meta";
    li.textContent = "暂无录音文件";
    el.audioList.appendChild(li);
    return;
  }

  spot.audios.forEach((audio) => {
    const li = document.createElement("li");
    li.className = "audio-item";

    const title = document.createElement("div");
    title.className = "audio-title";

    const left = document.createElement("span");
    left.textContent = `${audio.name} (${formatSize(audio.size)})`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "danger audio-remove";
    removeBtn.textContent = "删除";
    removeBtn.addEventListener("click", async () => {
      await deleteAudioEntry(audio);
      spot.audios = spot.audios.filter((item) => item.id !== audio.id);
      saveState();
      renderAll();
    });

    title.appendChild(left);
    title.appendChild(removeBtn);

    const player = document.createElement("audio");
    player.controls = true;
    player.preload = "metadata";
    resolveAudioSource(audio)
      .then((src) => {
        if (src) {
          player.src = src;
        } else {
          left.textContent = `${audio.name} (${formatSize(audio.size)}) [音频不存在]`;
        }
      })
      .catch(() => {
        left.textContent = `${audio.name} (${formatSize(audio.size)}) [加载失败]`;
      });
    player.addEventListener("play", () => {
      stopOtherAudios(player);
      li.classList.add("playing");
    });
    player.addEventListener("pause", () => {
      li.classList.remove("playing");
    });
    player.addEventListener("ended", () => {
      li.classList.remove("playing");
    });

    li.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button")) {
        return;
      }
      if (player.paused) {
        player.play().catch(() => {});
      } else {
        player.pause();
      }
    });

    li.appendChild(title);
    li.appendChild(player);
    el.audioList.appendChild(li);
  });
}

function renderCatalog(spot) {
  if (!el.catalogList || !el.catalogPreview) return;
  const catalog = Array.isArray(spot.catalog) && spot.catalog.length
    ? spot.catalog
    : buildSpotCatalog(spot);
  spot.catalog = catalog;

  el.catalogList.innerHTML = "";
  if (!catalog.length) {
    const li = document.createElement("li");
    li.className = "spot-meta";
    li.textContent = "暂无目录内容";
    el.catalogList.appendChild(li);
    el.catalogPreview.textContent = "点击目录项后在这里查看对应内容。";
    return;
  }

  if (!catalog.some((item) => item.id === state.selectedCatalogId)) {
    state.selectedCatalogId = catalog[0].id;
  }

  catalog.forEach((item) => {
    const li = document.createElement("li");
    li.className = "catalog-item";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `catalog-btn ${item.id === state.selectedCatalogId ? "active" : ""}`;
    btn.textContent = item.title;
    btn.addEventListener("click", () => openCatalogItem(item, spot));
    li.appendChild(btn);
    el.catalogList.appendChild(li);
  });

  const selected = catalog.find((item) => item.id === state.selectedCatalogId) || catalog[0];
  if (selected) {
    el.catalogPreview.textContent = selected.content || "该目录暂无内容。";
  }
}

function openCatalogItem(item, spot) {
  state.selectedCatalogId = item.id;
  el.catalogPreview.textContent = item.content || "该目录暂无内容。";
  renderCatalog(spot);

  const fieldSection = normalizeEditorSection(item.field);
  if (fieldSection) {
    openEditorSection(fieldSection);
  }
  if (item.field === "intro") {
    focusFieldWithSnippet(el.introInput, item.content);
  } else if (item.field === "script") {
    focusFieldWithSnippet(el.scriptInput, item.content);
  } else if (item.field === "webscript") {
    focusFieldWithSnippet(el.webScriptInput, item.content);
  } else if (item.field === "tips") {
    focusFieldWithSnippet(el.tipsInput, item.content);
  }
}

function focusFieldWithSnippet(input, snippet) {
  if (!input) return;
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  input.focus();

  const text = String(input.value || "");
  const target = String(snippet || "").slice(0, 30);
  if (!target) return;
  const pos = text.indexOf(target);
  if (pos >= 0 && typeof input.setSelectionRange === "function") {
    input.setSelectionRange(pos, pos + target.length);
  }
  input.classList.add("flash-focus");
  window.setTimeout(() => input.classList.remove("flash-focus"), 800);
}

function buildSpotCatalog(spot) {
  const catalog = [];
  const intro = String(spot.intro || "").trim();
  const script = String(spot.script || "").trim();
  const webScript = String(spot.webScript || "").trim();
  const tips = Array.isArray(spot.tips) ? spot.tips : [];

  if (intro) {
    catalog.push({
      id: "intro_0",
      title: "景区介绍",
      field: "intro",
      content: intro,
    });
  }

  const scriptSections = splitScriptIntoSections(script);
  scriptSections.forEach((section, index) => {
    catalog.push({
      id: `script_${index}`,
      title: `个人讲解词 ${index + 1}`,
      field: "script",
      content: section,
    });
  });

  const webScriptSections = splitScriptIntoSections(webScript);
  webScriptSections.forEach((section, index) => {
    catalog.push({
      id: `webscript_${index}`,
      title: `网络讲解词 ${index + 1}`,
      field: "webscript",
      content: section,
    });
  });

  tips.forEach((tip, index) => {
    catalog.push({
      id: `tips_${index}`,
      title: `注意事项 ${index + 1}`,
      field: "tips",
      content: tip,
    });
  });

  return catalog.slice(0, 32);
}

function splitScriptIntoSections(script) {
  const text = String(script || "").trim();
  if (!text) return [];
  const byBlankLine = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (byBlankLine.length >= 2) {
    return byBlankLine;
  }

  const sentences = splitChineseSentences(text);
  if (!sentences.length) {
    return [text];
  }
  const size = Math.max(2, Math.ceil(sentences.length / 3));
  const sections = [];
  for (let i = 0; i < sentences.length; i += size) {
    sections.push(sentences.slice(i, i + size).join(""));
  }
  return sections;
}

function stopOtherAudios(currentPlayer) {
  const players = Array.from(el.audioList.querySelectorAll("audio"));
  players.forEach((item) => {
    if (item !== currentPlayer) {
      item.pause();
    }
  });
}

function formatSize(size) {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(2)}MB`;
}

async function handleAudioUpload() {
  const current = getCurrentSpot();
  const files = Array.from(el.audioInput.files || []);
  if (!current || !files.length) return;

  const audios = [];
  const failures = [];
  for (const file of files) {
    try {
      audios.push(await createAudioEntryFromFile(file));
    } catch (error) {
      failures.push(file.name);
      console.warn(error);
    }
  }

  current.audios.push(...audios);
  saveState();
  renderAll();
  if (failures.length) {
    alert(`有 ${failures.length} 个音频保存失败：${failures.join("、")}。`);
  }
  el.audioInput.value = "";
}

async function handleAudioTranscribeImport(inputFiles, options = {}) {
  const files = Array.isArray(inputFiles)
    ? inputFiles
    : Array.from(inputFiles || []);
  const silent = Boolean(options.silent);
  if (!files.length) return;

  const importedIds = [];
  const failures = [];
  setJobStatus(`准备语音识别引擎（首次会下载模型，可能需要 1-3 分钟）...`);

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const positionText = `${index + 1}/${files.length}`;
      const baseName = deriveSpotNameFromFile(file.name);
      let spot = null;
      try {
        setJobStatus(`处理中 ${positionText}：${file.name}（解析音频中）...`);
        const audioEntry = await createAudioEntryFromFile(file);

        spot = {
          id: createId(),
          name: baseName,
          intro: "",
          script: "",
          webScript: "",
          tips: [],
          audios: [audioEntry],
        };
        state.spots.unshift(spot);
        importedIds.push(spot.id);
        saveState();
        renderAll();

        setJobStatus(`处理中 ${positionText}：${file.name}（语音转文字中）...`);
        const rawTranscript = await transcribeAudioFile(file);
        if (!rawTranscript) {
          throw new Error("ASR_EMPTY");
        }
        const refined = buildSpotFromTranscript(rawTranscript, file.name);

        spot.name = refined.name || spot.name;
        spot.script = appendText(spot.script, refined.script || rawTranscript);
        spot.tips = mergeTips(spot.tips, refined.tips);
        spot.catalog = buildSpotCatalog(spot);
      } catch (error) {
        failures.push(file.name);
        if (spot) {
          spot.script = appendText(
            spot.script,
            "自动转写失败，请手动填写讲解词。",
          );
          spot.catalog = buildSpotCatalog(spot);
        }
        console.warn(error);
      }

      saveState();
      renderAll();
    }

    state.selectedId = importedIds[0] || state.selectedId;
    const selectedSpot = state.spots.find((spot) => spot.id === state.selectedId);
    state.selectedCatalogId = selectedSpot?.catalog?.[0]?.id || "";
    state.editorSection = "script";
    switchMobileView("editor");
    saveState();
    renderAll();

    const successCount = files.length - failures.length;
    let message = `音频导入完成：成功转写 ${successCount} 个，失败 ${failures.length} 个。`;
    if (failures.length) {
      message += ` 失败文件：${failures.join("、")}。`;
    }
    if (!silent) {
      alert(message);
    }
    return {
      importedCount: successCount,
      failedFiles: failures,
      skippedCount: 0,
    };
  } finally {
    clearJobStatus(1800);
  }
}

async function handleTxtImport(inputFiles, options = {}) {
  const files = Array.isArray(inputFiles)
    ? inputFiles
    : Array.from(inputFiles || []);
  const silent = Boolean(options.silent);
  if (!files.length) return;

  const importedIds = [];
  const failures = [];
  setJobStatus(`准备导入 TXT，共 ${files.length} 个文件...`);

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const positionText = `${index + 1}/${files.length}`;
      setJobStatus(`处理中 ${positionText}：${file.name}（读取文本中）...`);

      try {
        const text = await readTextWithEncodingDetection(file);
        if (!text) {
          throw new Error("TXT_EMPTY");
        }

        const refined = buildSpotFromTranscript(text, file.name);

        const draftSpot = {
          id: createId(),
          name: refined.name || deriveSpotNameFromFile(file.name),
          intro: "",
          script: refined.script || text,
          webScript: "",
          tips: mergeTips([], refined.tips),
          audios: [],
          catalog: [],
        };
        const spot = polishRecognizedSpot(draftSpot);

        state.spots.unshift(spot);
        importedIds.push(spot.id);
      } catch (error) {
        failures.push(file.name);
        console.warn(error);
      }
    }

    state.selectedId = importedIds[0] || state.selectedId;
    const selectedSpot = state.spots.find((spot) => spot.id === state.selectedId);
    state.selectedCatalogId = selectedSpot?.catalog?.[0]?.id || "";
    state.editorSection = "script";
    switchMobileView("editor");
    saveState();
    renderAll();

    const successCount = importedIds.length;
    let message = `TXT 导入完成：成功 ${successCount} 个，失败 ${failures.length} 个。`;
    if (failures.length) {
      message += ` 失败文件：${failures.join("、")}。`;
    }
    if (!silent) {
      alert(message);
    }
    return {
      importedCount: importedIds.length,
      failedFiles: failures,
    };
  } finally {
    clearJobStatus(1400);
  }
}

async function handleWordImport(inputFiles, options = {}) {
  const files = Array.isArray(inputFiles)
    ? inputFiles
    : Array.from(inputFiles || []);
  const silent = Boolean(options.silent);
  if (!files.length) return;

  const importedIds = [];
  const failures = [];
  setJobStatus(`准备导入 Word，共 ${files.length} 个文件...`);

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const positionText = `${index + 1}/${files.length}`;
      setJobStatus(`处理中 ${positionText}：${file.name}（解析 Word 中）...`);

      try {
        const text = await extractTextFromWordFile(file);
        if (!text) {
          throw new Error("WORD_EMPTY");
        }

        const refined = buildSpotFromTranscript(text, file.name);
        const draftSpot = {
          id: createId(),
          name: refined.name || deriveSpotNameFromFile(file.name),
          intro: "",
          script: refined.script || text,
          webScript: "",
          tips: mergeTips([], refined.tips),
          audios: [],
          catalog: [],
        };
        const spot = polishRecognizedSpot(draftSpot);

        state.spots.unshift(spot);
        importedIds.push(spot.id);
      } catch (error) {
        failures.push(file.name);
        console.warn(error);
      }
    }

    state.selectedId = importedIds[0] || state.selectedId;
    const selectedSpot = state.spots.find((spot) => spot.id === state.selectedId);
    state.selectedCatalogId = selectedSpot?.catalog?.[0]?.id || "";
    state.editorSection = "script";
    switchMobileView("editor");
    saveState();
    renderAll();

    const successCount = importedIds.length;
    let message = `Word 导入完成：成功 ${successCount} 个，失败 ${failures.length} 个。`;
    if (failures.length) {
      message += ` 失败文件：${failures.join("、")}。`;
    }
    if (!silent) {
      alert(message);
    }
    return {
      importedCount: importedIds.length,
      failedFiles: failures,
    };
  } finally {
    clearJobStatus(1600);
  }
}

async function extractTextFromWordFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const mime = String(file?.type || "").toLowerCase();
  const isDocx = name.endsWith(".docx") || mime.includes("wordprocessingml");
  if (isDocx) {
    await ensureMammothLoaded();
    const buffer = await readFileAsArrayBuffer(file);
    const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
    return normalizeImportedText(result?.value || "");
  }

  const isDoc = name.endsWith(".doc") || mime === "application/msword";
  if (isDoc) {
    const text = await extractLegacyDocText(file);
    if (text.length < 20) {
      throw new Error("DOC_PARSE_FAILED");
    }
    return text;
  }
  throw new Error("WORD_UNSUPPORTED");
}

async function ensureMammothLoaded() {
  if (window.mammoth) return;
  if (mammothLoaderPromise) {
    await mammothLoaderPromise;
    return;
  }

  mammothLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MAMMOTH_BROWSER_URL;
    script.async = true;
    script.onload = () => {
      if (!window.mammoth) {
        reject(new Error("MAMMOTH_LOAD_FAILED"));
        return;
      }
      resolve();
    };
    script.onerror = () => reject(new Error("MAMMOTH_LOAD_FAILED"));
    document.head.appendChild(script);
  });

  try {
    await mammothLoaderPromise;
  } catch (error) {
    mammothLoaderPromise = null;
    throw error;
  }
}

async function extractLegacyDocText(file) {
  const buffer = await readFileAsArrayBuffer(file);
  const decoded = decodeBufferWithBestEncoding(buffer, [
    "gb18030",
    "utf-8",
    "utf-16le",
    "utf-16be",
    "big5",
    "windows-1252",
  ]);
  const cleaned = cleanupLegacyDocText(decoded);
  if (cleaned.length > 40) return cleaned;

  const fallback = extractPrintableTextFromBinary(buffer);
  return cleanupLegacyDocText(fallback);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("AUDIO_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function deriveSpotNameFromFile(fileName) {
  const pure = String(fileName || "")
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/(的?讲解词?|导游词|解说词|讲解稿|讲解|导览词|资料|文案|录音|音频|扫描件|文字版|完整版|整理版)$/g, "")
    .trim();
  return pure || `新景区 ${state.spots.length + 1}`;
}

function sanitizeSpotNameLabel(rawName) {
  return String(rawName || "")
    .replace(/[()（）【】\[\]<>《》]/g, " ")
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(景区介绍|景点介绍|景区详情|讲解词|导游词|解说词|讲解稿|讲解内容|注意事项)$/g, "")
    .replace(/(的?讲解词?|导游词|解说词|讲解稿|讲解|导览词|资料|文案|录音|音频|扫描件|文字版|完整版|整理版)$/g, "")
    .trim();
}

function isLikelyGenericSpotName(name) {
  const value = sanitizeSpotNameLabel(name).replace(/\s+/g, "");
  if (!value) return true;
  if (/^(新景区\d*|未命名景区|讲解|导游词|讲解词|景区|景点|旅游|资料)$/.test(value)) {
    return true;
  }
  if (/(讲解|导游|解说|资料|文案|录音|音频|扫描件|文字版|完整版|整理版)/.test(value)) {
    return true;
  }
  if (/^(?:中国)?[\u4e00-\u9fa5]{2,6}(?:省|市|县|区|州|盟|旗)$/.test(value)) {
    return true;
  }
  return false;
}

function extractScenicNameCandidates(text) {
  const source = normalizeImportedText(String(text || "")).slice(0, 4000);
  if (!source) return [];

  const weighted = new Map();
  const addCandidate = (raw, score = 1) => {
    const candidate = sanitizeSpotNameLabel(raw).replace(/\s+/g, "");
    if (!candidate || candidate.length < 2 || candidate.length > 18) return;
    if (/^(讲解|导游词|讲解词|景区|景点|旅游|资料|游客|大家)$/.test(candidate)) return;
    if (/^(营业时间|门票价格|优惠政策|导览图|其他提醒)$/.test(candidate)) return;
    if (/^(?:中国)?[\u4e00-\u9fa5]{2,6}(?:省|市|县|区|州|盟|旗)$/.test(candidate)) return;
    const current = weighted.get(candidate) || 0;
    weighted.set(candidate, current + score);
  };

  const suffixPattern =
    /([一-龥]{2,18}(?:风景名胜区|风景区|景区|景点|公园|古镇|古城|街区|博物馆|纪念馆|陈列馆|展览馆|故居|遗址|名胜区|度假区|寺|宫|祠|院|楼|桥|塔|山|湖|江|河|溪|谷|洞|巷))/g;
  for (const match of source.matchAll(suffixPattern)) {
    addCandidate(match[1], 8);
  }

  const introPatterns = [
    /(?:欢迎来到|来到|走进|前往|参观|游览|我们现在来到|这里是)([一-龥]{2,12})/g,
    /([一-龥]{2,12})(?:位于|坐落于|始建于|建于|地处|地处于)/g,
    /(?:本次讲解|今天讲解|今天介绍|本次介绍)([一-龥]{2,12})/g,
  ];
  introPatterns.forEach((regex) => {
    for (const match of source.matchAll(regex)) {
      addCandidate(match[1], 6);
    }
  });

  const scenicWords = Array.from(weighted.keys());
  scenicWords.forEach((candidate) => {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hits = source.match(new RegExp(escaped, "g")) || [];
    if (hits.length > 1) {
      addCandidate(candidate, hits.length * 2);
    }
    if (/(风景名胜区|风景区|景区|景点|公园|古镇|古城|街区|博物馆|纪念馆|遗址)/.test(candidate)) {
      addCandidate(candidate, 4);
    }
  });

  return Array.from(weighted.entries())
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .map(([name]) => name);
}

function inferScenicNameFromSpotContent(spot) {
  const text = [
    spot?.intro || "",
    spot?.script || "",
    spot?.webScript || "",
    Array.isArray(spot?.tips) ? spot.tips.join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n");
  return extractScenicNameCandidates(text)[0] || "";
}

async function transcribeAudioFile(file) {
  const transcriber = await ensureAsrPipeline();
  const mono = await decodeAudioToMonoFloat32(file);
  const output = await transcriber(mono, {
    language: "zh",
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
  });
  return extractAsrText(output);
}

async function ensureAsrPipeline() {
  if (asrPipelinePromise) {
    return asrPipelinePromise;
  }
  asrPipelinePromise = (async () => {
    const mod = await import(HF_TRANSFORMERS_URL);
    const createPipeline = mod.pipeline;
    const pipe = await createPipeline("automatic-speech-recognition", ASR_MODEL_ID, {
      progress_callback: (info) => {
        if (!info || typeof info !== "object") return;
        if (info.status === "progress" && typeof info.progress === "number") {
          const percent = Math.round(info.progress * 100);
          if (percent >= 0 && percent <= 100) {
            setJobStatus(`下载语音模型中：${percent}%...`);
          }
        }
      },
    });
    return pipe;
  })();

  try {
    return await asrPipelinePromise;
  } catch (error) {
    asrPipelinePromise = null;
    throw error;
  }
}

async function decodeAudioToMonoFloat32(file) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("AUDIO_CONTEXT_UNSUPPORTED");
  }

  const context = new AudioCtx();
  try {
    const buffer = await readFileAsArrayBuffer(file);
    const decoded = await context.decodeAudioData(buffer.slice(0));
    const channels = decoded.numberOfChannels;
    const length = decoded.length;

    if (channels === 1) {
      return decoded.getChannelData(0).slice();
    }

    const mono = new Float32Array(length);
    for (let c = 0; c < channels; c += 1) {
      const channelData = decoded.getChannelData(c);
      for (let i = 0; i < length; i += 1) {
        mono[i] += channelData[i] / channels;
      }
    }
    return mono;
  } finally {
    context.close().catch(() => {});
  }
}

function extractAsrText(output) {
  if (typeof output === "string") {
    return output.trim();
  }
  if (output && typeof output.text === "string") {
    return output.text.trim();
  }
  return "";
}

function buildSpotFromTranscript(rawText, fileName) {
  const cleaned = cleanTranscriptText(rawText);
  const sentences = splitChineseSentences(cleaned);

  const intro = sentences.slice(0, 3).join("");
  const script = formatScriptText(cleaned, sentences);
  const tips = buildTipsFromTranscript(sentences);
  const guessedName = guessSpotNameFromText(cleaned) || deriveSpotNameFromFile(fileName);

  return polishRecognizedSpot({
    name: guessedName,
    intro: intro || cleaned.slice(0, 120),
    script: script || cleaned,
    webScript: "",
    tips,
    audios: [],
    catalog: [],
  });
}

function cleanTranscriptText(rawText) {
  return String(rawText || "")
    .replace(/[ \t]+/g, " ")
    .replace(/(?:^|[，。！？\s])(嗯|啊|呃|这个|那个|然后|就是)(?=[，。！？\s]|$)/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[。]{2,}/g, "。")
    .trim();
}

function polishRecognizedSpot(spot) {
  const polishedIntro = polishTextBlock(spot.intro, 3);
  const polishedScript = polishScriptBlock(spot.script);
  const polishedTips = polishTips(spot.tips);
  const normalized = {
    ...spot,
    name: String(spot.name || "未命名景区").trim(),
    intro: polishedIntro,
    script: polishedScript,
    webScript: String(spot.webScript || ""),
    tips: polishedTips,
  };
  normalized.catalog = buildSpotCatalog(normalized);
  return normalized;
}

function polishTextBlock(text, maxSentences = 0) {
  const base = cleanTranscriptText(String(text || ""))
    .replace(/\s+/g, "")
    .replace(/([。！？!?])/g, "$1\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const selected = maxSentences > 0 ? base.slice(0, maxSentences) : base;
  return selected.join("\n");
}

function polishScriptBlock(text) {
  return refinePersonalScriptText(cleanTranscriptText(text));
}

function polishTips(tips) {
  return mergeTips(
    [],
    normalizeTips(
      (Array.isArray(tips) ? tips : [])
        .map((item) =>
          String(item || "")
            .replace(/^[\-*•\d\.\)、\s]+/, "")
            .trim(),
        )
        .join("\n"),
    ),
  ).map((item) => (/[。！？]$/.test(item) ? item : `${item}。`));
}

function refinePersonalScriptText(rawText) {
  const normalized = normalizeImportedText(String(rawText || ""))
    .replace(/^【[^】]{1,20}】\s*$/gm, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .replace(/([，。！？；：、])\1+/g, "$1")
    .replace(/[,]{2,}/g, "，")
    .replace(/[.]{2,}/g, "。")
    .replace(/\s*([，。！？；：、])\s*/g, "$1");

  if (!normalized) return "";

  const replacements = [
    [/景去/g, "景区"],
    [/讲解次/g, "讲解词"],
    [/导游次/g, "导游词"],
    [/游客们门/g, "游客们"],
    [/请大加/g, "请大家"],
    [/请大家们/g, "请大家"],
    [/请勿要/g, "请勿"],
    [/历史文华/g, "历史文化"],
    [/古建祝/g, "古建筑"],
    [/这理/g, "这里"],
    [/我门/g, "我们"],
  ];

  let corrected = normalized;
  replacements.forEach(([pattern, value]) => {
    corrected = corrected.replace(pattern, value);
  });

  const rawSentences = splitChineseSentences(
    corrected
      .replace(/\n+/g, "")
      .replace(/([。！？!?])/g, "$1\n"),
  );

  const cleanedSentences = rawSentences
    .map((line) => polishScriptSentence(line))
    .filter(Boolean);

  if (!cleanedSentences.length) {
    return corrected;
  }

  const merged = mergeVeryShortSentences(cleanedSentences, 8);
  return buildStructuredScriptParagraphs(merged);
}

function polishScriptSentence(sentence) {
  let line = String(sentence || "")
    .replace(/^[\-*•\d\.\)、\s]+/, "")
    .replace(/^(那么|然后|这个|就是|呃|嗯)+/g, "")
    .replace(/\s+/g, "")
    .replace(/([，。！？；：、])[，。！？；：、]+/g, "$1")
    .trim();

  if (!line) return "";
  line = line.replace(/([，。！？；：、])\1+/g, "$1");
  line = line.replace(/([一-龥A-Za-z])\1{3,}/g, "$1$1");
  line = line.replace(/(的)(的+)/g, "$1");
  line = line.replace(/(了)(了+)/g, "$1");
  line = line.replace(/(我们)(我们+)/g, "$1");

  if (!/[。！？]$/.test(line)) {
    line += "。";
  }
  return line;
}

function mergeVeryShortSentences(sentences, minLength = 8) {
  const result = [];
  sentences.forEach((line) => {
    const current = String(line || "").trim();
    if (!current) return;
    if (!result.length) {
      result.push(current);
      return;
    }
    if (current.length < minLength) {
      result[result.length - 1] += current;
      return;
    }
    result.push(current);
  });
  return result;
}

function buildStructuredScriptParagraphs(sentences) {
  const source = Array.isArray(sentences) ? sentences.filter(Boolean) : [];
  if (!source.length) return "";

  const sections = [];
  source.forEach((line, index) => {
    const topic = classifyScriptSentenceTopic(line, index, source.length);
    const prev = sections[sections.length - 1];
    if (!prev || prev.key !== topic.key || isExplicitTransitionLine(line)) {
      sections.push({
        key: topic.key,
        title: topic.title,
        lines: [line],
      });
      return;
    }
    prev.lines.push(line);
  });

  const compacted = compactTinyScriptSections(sections);
  const hasMeaningfulTopic = compacted.some((sec) => sec.key !== "generic");
  if (!hasMeaningfulTopic || compacted.length <= 1) {
    return fallbackScriptParagraphs(source);
  }

  return compacted.map((section) => section.lines.join("")).join("\n\n");
}

function classifyScriptSentenceTopic(sentence, index, total) {
  const line = String(sentence || "");

  if (
    /注意|请勿|不要|禁止|安全|保管|防滑|小心|集合|排队|文明|温馨提示/.test(
      line,
    )
  ) {
    return { key: "tips", title: "游览提示" };
  }
  if (/欢迎|各位游客|大家好|今天我们|现在我们|此刻我们/.test(line) || index === 0) {
    return { key: "opening", title: "开场引入" };
  }
  if (/位于|坐落于|面积|地处|地理位置|等级景区|国家级|世界遗产/.test(line)) {
    return { key: "overview", title: "景区概况" };
  }
  if (/始建于|建于|距今|历史|朝代|文化|遗址|文物|名人|典故/.test(line)) {
    return { key: "history", title: "历史文化" };
  }
  if (
    /看点|亮点|特色|建筑|古厝|坊巷|牌坊|街区|景点|雕刻|展馆|可看到|请看/.test(
      line,
    )
  ) {
    return { key: "highlight", title: "看点讲解" };
  }
  if (
    /最后|以上|到这里|讲解完毕|祝大家|祝各位|感谢大家/.test(line) ||
    (index >= total - 1 && line.length <= 36)
  ) {
    return { key: "ending", title: "结语收束" };
  }
  return { key: "generic", title: "讲解内容" };
}

function isExplicitTransitionLine(line) {
  return /接下来|随后|然后|再往前|下一处|接着看|首先|最后/.test(
    String(line || ""),
  );
}

function compactTinyScriptSections(sections) {
  const result = [];
  sections.forEach((section) => {
    if (!section || !section.lines?.length) return;
    const text = section.lines.join("");
    const prev = result[result.length - 1];
    const isTiny = section.lines.length <= 1 && text.length <= 22;
    if (prev && (isTiny || section.key === "generic")) {
      prev.lines.push(...section.lines);
      if (prev.key === "generic" && section.key !== "generic") {
        prev.key = section.key;
        prev.title = section.title;
      }
      return;
    }
    result.push({
      key: section.key,
      title: section.title,
      lines: [...section.lines],
    });
  });
  return result;
}

function fallbackScriptParagraphs(sentences) {
  const chunkSize = Math.max(2, Math.ceil(sentences.length / 4));
  const parts = [];
  for (let i = 0; i < sentences.length; i += chunkSize) {
    parts.push(sentences.slice(i, i + chunkSize).join(""));
  }
  return parts.join("\n\n");
}

function normalizeImportedText(rawText) {
  return String(rawText || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitChineseSentences(text) {
  const normalized = String(text || "")
    .replace(/\n+/g, "")
    .trim();
  if (!normalized) return [];
  const parts = [];
  let current = "";
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    current += char;
    if ("。！？!?".includes(char)) {
      const sentence = current.trim();
      if (sentence) {
        parts.push(sentence);
      }
      current = "";
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  if (parts.length) return parts;
  return normalized.split(/[，,]/).filter(Boolean).map((x) => `${x}。`);
}

function formatScriptText(cleaned, sentences) {
  if (sentences.length >= 4) {
    return sentences.join("\n");
  }
  return cleaned
    .replace(/([。！？!?])/g, "$1\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function buildTipsFromTranscript(sentences) {
  const candidate = sentences.filter((line) =>
    /注意|请勿|不要|禁止|安全|保管|防滑|小心|集合|排队|文明/.test(line),
  );
  return mergeTips([], normalizeTips(candidate.join("\n")));
}

function getCurrentScenicNameForWeb(spot) {
  const typedName = sanitizeSpotNameLabel(el.nameInput.value || spot?.name || "");
  const inferredName = inferScenicNameFromSpotContent(spot);
  if (typedName && !isLikelyGenericSpotName(typedName)) {
    return typedName;
  }
  if (inferredName) {
    return inferredName;
  }
  return typedName;
}

function syncResolvedScenicNameToSpot(spot) {
  if (!spot) return "";
  const resolved = getCurrentScenicNameForWeb(spot);
  const currentName = sanitizeSpotNameLabel(spot.name || "");
  if (resolved && (isLikelyGenericSpotName(currentName) || !currentName)) {
    spot.name = resolved;
    if (el.nameInput && getCurrentSpot()?.id === spot.id) {
      el.nameInput.value = resolved;
    }
  }
  return resolved;
}

function formatWebSourceHint(result) {
  const urls = Array.isArray(result?.sources)
    ? result.sources.map((item) => item.url).filter(Boolean)
    : result?.sourceUrl
      ? [result.sourceUrl]
      : [];
  if (!urls.length) return "";
  const picked = urls.slice(0, 2).join("，");
  return `\n来源：${picked}`;
}

function buildKeywordsHint(error) {
  return Array.isArray(error?.keywords) && error.keywords.length
    ? `\n本次检索词：${error.keywords.join("、")}`
    : "";
}

function resolveWebSearchErrorMessage(error, fallbackText) {
  const message = String(error?.message || "");
  if (message === "MISSING_TAVILY_API_KEY") {
    return "请先在“搜索设置”里填写 Tavily API Key。";
  }
  if (/^TAVILY_401/.test(message) || /^TAVILY_403/.test(message)) {
    return "Tavily API Key 无效，或当前密钥没有权限。请在“搜索设置”里更换。";
  }
  if (/^TAVILY_429/.test(message)) {
    return "Tavily 搜索额度不足或请求过快，请稍后再试。";
  }
  if (/^TAVILY_/.test(message)) {
    return "Tavily 搜索服务暂时不可用，请稍后重试。";
  }
  return fallbackText;
}

async function handleFetchIntroFromWeb() {
  const current = getCurrentSpot();
  if (!current) return;

  const name = syncResolvedScenicNameToSpot(current);
  if (!name) {
    alert("请先填写景区名称，再联网补全介绍。");
    return;
  }

  setJobStatus(`联网获取“${name}”的景区介绍...`);
  try {
    if (!navigator.onLine) throw new Error("OFFLINE");
    const result = await fetchSpotIntroFromWeb(name);
    current.intro = appendText(current.intro, result.intro || "");
    current.catalog = buildSpotCatalog(current);
    state.selectedCatalogId = current.catalog[0]?.id || state.selectedCatalogId;
    saveState();
    renderAll();
    openEditorSection("intro");
    alert(`已联网补全“${name}”介绍。${formatWebSourceHint(result)}`);
  } catch (error) {
    console.warn(error);
    if (String(error?.message || "") === "OFFLINE") {
      alert("联网获取失败：当前设备处于离线状态。请先连接网络后重试。");
      return;
    }
    if (String(error?.message || "") === "MISSING_TAVILY_API_KEY") {
      openSearchSettings();
      alert("联网获取失败：请先在“搜索设置”里填写 Tavily API Key。");
      return;
    }
    alert(`联网获取失败：${resolveWebSearchErrorMessage(error, "未找到可信简介，或当前网络对外部站点有限制。")}${buildKeywordsHint(error)}`);
  } finally {
    clearJobStatus(1200);
  }
}

async function handleFetchWebScriptFromWeb() {
  const current = getCurrentSpot();
  if (!current) return;

  const name = syncResolvedScenicNameToSpot(current);
  if (!name) {
    alert("请先填写景区名称，再联网补全网络讲解词。");
    return;
  }

  setJobStatus(`联网获取“${name}”的网络讲解词...`);
  try {
    if (!navigator.onLine) throw new Error("OFFLINE");
    const result = await fetchSpotWebScriptFromWeb(name);
    current.webScript = appendText(current.webScript, result.script || "");
    current.catalog = buildSpotCatalog(current);
    state.selectedCatalogId = current.catalog[0]?.id || state.selectedCatalogId;
    saveState();
    renderAll();
    openEditorSection("webscript");
    alert(`已联网补全“${name}”网络讲解词。${formatWebSourceHint(result)}`);
  } catch (error) {
    console.warn(error);
    if (String(error?.message || "") === "OFFLINE") {
      alert("联网获取失败：当前设备处于离线状态。请先连接网络后重试。");
      return;
    }
    if (String(error?.message || "") === "MISSING_TAVILY_API_KEY") {
      openSearchSettings();
      alert("联网获取失败：请先在“搜索设置”里填写 Tavily API Key。");
      return;
    }
    alert(`联网获取失败：${resolveWebSearchErrorMessage(error, "未找到可信讲解词。")}${buildKeywordsHint(error)}`);
  } finally {
    clearJobStatus(1200);
  }
}

async function handleFetchTipsFromWeb() {
  const current = getCurrentSpot();
  if (!current) return;

  const name = syncResolvedScenicNameToSpot(current);
  if (!name) {
    alert("请先填写景区名称，再联网补全注意事项。");
    return;
  }

  setJobStatus(`联网获取“${name}”的注意事项...`);
  try {
    if (!navigator.onLine) throw new Error("OFFLINE");
    const result = await fetchSpotTipsFromWeb(name);
    current.tips = mergeTips(current.tips, polishTips(result.tips || []));
    current.catalog = buildSpotCatalog(current);
    state.selectedCatalogId = current.catalog[0]?.id || state.selectedCatalogId;
    saveState();
    renderAll();
    openEditorSection("tips");
    alert(`已联网补全“${name}”注意事项（新增 ${result.tips.length} 条）。${formatWebSourceHint(result)}`);
  } catch (error) {
    console.warn(error);
    if (String(error?.message || "") === "OFFLINE") {
      alert("联网获取失败：当前设备处于离线状态。请先连接网络后重试。");
      return;
    }
    if (String(error?.message || "") === "MISSING_TAVILY_API_KEY") {
      openSearchSettings();
      alert("联网获取失败：请先在“搜索设置”里填写 Tavily API Key。");
      return;
    }
    alert(`联网获取失败：${resolveWebSearchErrorMessage(error, "未找到可信注意事项。")}${buildKeywordsHint(error)}`);
  } finally {
    clearJobStatus(1200);
  }
}

async function fetchSpotIntroFromWeb(name) {
  return fetchSpotContentByMode(name, "intro");
}

async function fetchSpotWebScriptFromWeb(name) {
  return fetchSpotContentByMode(name, "script");
}

async function fetchSpotTipsFromWeb(name) {
  return fetchSpotContentByMode(name, "tips");
}

async function fetchSpotContentByMode(name, mode) {
  const scenicName = String(name || "").trim();
  if (!scenicName) {
    return mode === "tips"
      ? { tips: [], sourceUrl: "", keywords: [] }
      : { intro: "", script: "", sourceUrl: "", keywords: [] };
  }

  const keywords = buildScenicSearchKeywords(scenicName);
  const query = buildTavilySearchQuery(scenicName, mode);
  setJobStatus(`联网搜索中：${query}`);
  const result = await searchWithTavily({
    query,
    maxResults: mode === "script" ? 6 : 5,
  });
  const extracted = extractSpotContentFromTavilyResult(result, scenicName, mode);
  if (!extracted) {
    const err = new Error("WEB_CONTENT_EMPTY");
    err.keywords = keywords;
    throw err;
  }

  if (!result) {
    const err = new Error("WEB_CONTENT_EMPTY");
    err.keywords = keywords;
    throw err;
  }

  if (mode === "tips") {
    return {
      tips: extracted.tips || [],
      sourceUrl: result.sources?.[0]?.url || "",
      sources: result.sources || [],
      keywords,
    };
  }
  if (mode === "script") {
    return {
      script: extracted.script || "",
      sourceUrl: result.sources?.[0]?.url || "",
      sources: result.sources || [],
      keywords,
    };
  }
  return {
    intro: extracted.intro || "",
    sourceUrl: result.sources?.[0]?.url || "",
    sources: result.sources || [],
    keywords,
  };
}

function buildTavilySearchQuery(scenicName, mode) {
  if (mode === "script") {
    return `${scenicName} 导游讲解词 讲解顺序 历史文化 核心看点 游览路线`;
  }
  if (mode === "tips") {
    return `${scenicName} 营业时间 门票价格 优惠政策 免票政策 导览图 预约 停车 交通 注意事项`;
  }
  return `${scenicName} 景区介绍 历史文化 核心看点 官方简介 旅游概况`;
}

async function searchWithTavily(params) {
  const query = String(params?.query || "").trim().slice(0, TAVILY_MAX_QUERY_LENGTH);
  const apiKey = String(state.webSearchApiKey || "").trim();
  if (!apiKey) {
    throw new Error("MISSING_TAVILY_API_KEY");
  }
  if (!query) {
    throw new Error("EMPTY_QUERY");
  }

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: Number(params?.maxResults || 5),
      include_answer: "basic",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`TAVILY_${response.status}:${errorText || response.statusText}`);
  }

  const data = await response.json();
  return {
    query: String(data?.query || query),
    answer: String(data?.answer || ""),
    responseTime: Number(data?.response_time || 0),
    sources: Array.isArray(data?.results)
      ? data.results.map((item) => ({
          title: String(item?.title || "未命名来源"),
          url: String(item?.url || ""),
          content: sanitizeNetworkIntro(item?.content || ""),
          score: Number(item?.score || 0),
        }))
      : [],
  };
}

function buildTavilyContextText(result) {
  const chunks = [];
  if (result?.answer) {
    chunks.push(String(result.answer).trim());
  }
  (result?.sources || []).forEach((item) => {
    const block = [item.title, item.content].filter(Boolean).join("\n");
    if (block.trim()) {
      chunks.push(block.trim());
    }
  });
  return sanitizeNetworkIntro(chunks.join("\n\n"));
}

function extractSpotContentFromTavilyResult(result, scenicName, mode) {
  const aggregateText = buildTavilyContextText(result);
  if (!aggregateText) return null;

  if (mode === "tips") {
    const tips = extractStructuredTravelTips(aggregateText, scenicName);
    return tips.length ? { tips } : null;
  }

  if (mode === "script") {
    const answerText = sanitizeNetworkIntro(result?.answer || "");
    const rawScript = pickScriptParagraphsFromLongText(
      [answerText, aggregateText].filter(Boolean).join("\n\n"),
      scenicName,
    );
    const script = rawScript
      ? buildReadableWebScript(rawScript, scenicName)
      : buildReadableWebScript(aggregateText, scenicName);
    return script ? { script } : null;
  }

  const intro = buildReadableIntroFromSearch(aggregateText, scenicName);
  return intro ? { intro } : null;
}

function buildReadableIntroFromSearch(rawText, scenicName) {
  const sentences = splitChineseSentences(
    sanitizeNetworkIntro(rawText).replace(/\n+/g, ""),
  ).filter((line) => {
    const normalizedLine = normalizeScenicKeyword(line);
    return (
      normalizedLine.includes(normalizeScenicKeyword(scenicName)) ||
      /位于|历史|文化|景区|景点|古建|街区|遗址|博物馆|名胜/.test(line)
    );
  });

  const selected = sentences.slice(0, 3);
  return selected.length ? selected.join("\n") : pickIntroParagraphFromLongText(rawText, scenicName);
}

function buildReadableWebScript(rawText, scenicName) {
  const sanitized = sanitizeNetworkIntro(rawText);
  const sentences = splitChineseSentences(sanitized.replace(/\n+/g, ""));
  const picked = sentences.filter((line) => {
    const normalizedLine = normalizeScenicKeyword(line);
    return (
      normalizedLine.includes(normalizeScenicKeyword(scenicName)) ||
      /欢迎|历史|文化|建筑|看点|故事|游览|来到|景区|景点|可以看到/.test(line)
    );
  });
  const base = (picked.length ? picked : sentences).slice(0, 8).join("");
  return refinePersonalScriptText(base || sanitized);
}

async function fetchFullWebVerifiedContent(scenicName, keywords, mode) {
  const queries = buildWebSearchQueries(scenicName, keywords, mode);
  const allUrls = [];

  for (let i = 0; i < queries.length; i += 1) {
    setJobStatus(`全网检索中 ${i + 1}/${queries.length}：${queries[i]}`);
    const urls = await searchWebUrls(queries[i], mode);
    allUrls.push(...urls);
  }

  const maxCandidates = mode === "script" ? 26 : 12;
  const uniqueUrls = Array.from(new Set(allUrls))
    .filter((url) => shouldKeepSearchResultUrl(url))
    .sort((a, b) => scoreSourceAuthority(b) - scoreSourceAuthority(a))
    .slice(0, maxCandidates);
  if (!uniqueUrls.length) return null;

  const candidates = [];
  for (let i = 0; i < uniqueUrls.length; i += 1) {
    const url = uniqueUrls[i];
    setJobStatus(`校验内容中 ${i + 1}/${uniqueUrls.length}：${new URL(url).hostname}`);
    try {
      const candidate = await buildWebContentCandidateFromUrl(url, scenicName, keywords, mode);
      if (candidate) {
        candidates.push(candidate);
      }
    } catch (error) {
      continue;
    }
  }

  if (!candidates.length) return null;

  candidates.forEach((item) => {
    const consensus = scoreCandidateConsensus(item, candidates);
    item.totalScore =
      item.authorityScore * 0.42 +
      item.relevanceScore * 0.36 +
      item.qualityScore * 0.12 +
      consensus * 0.1;
  });

  candidates.sort((a, b) => b.totalScore - a.totalScore);
  const best = candidates[0];
  const minRelevance = mode === "script" ? 10 : 16;
  if (!best || best.relevanceScore < minRelevance) {
    return null;
  }
  return {
    content: best.content,
    tips: best.tips || [],
    sourceUrl: best.url,
  };
}

function buildWebSearchQueries(scenicName, keywords, mode) {
  const queries = new Set();
  if (mode === "intro") {
    queries.add(`${scenicName} 景区介绍`);
    queries.add(`${scenicName} 官方 简介`);
  } else if (mode === "script") {
    queries.add(`${scenicName} 导游词`);
    queries.add(`${scenicName} 讲解词`);
    queries.add(`${scenicName} 解说词`);
    queries.add(`${scenicName} 景点讲解`);
    queries.add(`${scenicName} 导览词`);
  } else {
    queries.add(`${scenicName} 注意事项`);
    queries.add(`${scenicName} 游览须知`);
    queries.add(`${scenicName} 安全提示`);
    queries.add(`${scenicName} 营业时间`);
    queries.add(`${scenicName} 门票价格`);
    queries.add(`${scenicName} 优惠政策 免票政策`);
    queries.add(`${scenicName} 导览图 地图`);
  }

  keywords.slice(0, 4).forEach((item) => {
    if (mode === "tips") {
      queries.add(`${item} 温馨提示`);
      queries.add(`${item} 开放时间`);
      queries.add(`${item} 门票`);
      queries.add(`${item} 优惠政策`);
    } else {
      queries.add(`${item} 历史文化`);
      queries.add(`${item} 简介`);
    }
  });
  return Array.from(queries).slice(0, mode === "tips" ? 10 : 8);
}

async function searchWebUrls(query, mode = "intro") {
  const encoded = encodeURIComponent(query);
  const endpoints = [
    `https://r.jina.ai/http://duckduckgo.com/html/?q=${encoded}`,
    `https://r.jina.ai/http://duckduckgo.com/html/?q=${encoded}&s=30`,
    `https://r.jina.ai/http://www.bing.com/search?q=${encoded}&count=50&first=1`,
    `https://r.jina.ai/http://www.bing.com/search?q=${encoded}&count=50&first=11`,
    `https://r.jina.ai/http://www.bing.com/search?q=${encoded}&count=50&first=21`,
    `https://r.jina.ai/http://www.sogou.com/web?query=${encoded}&page=1`,
    `https://r.jina.ai/http://www.sogou.com/web?query=${encoded}&page=2`,
    `https://r.jina.ai/http://www.so.com/s?q=${encoded}&pn=1`,
    `https://r.jina.ai/http://www.so.com/s?q=${encoded}&pn=2`,
  ];

  if (mode === "script") {
    endpoints.push(
      `https://r.jina.ai/http://www.bing.com/search?q=${encodeURIComponent(`${query} site:mafengwo.cn`)}`,
      `https://r.jina.ai/http://www.bing.com/search?q=${encodeURIComponent(`${query} site:trip.com`)}`,
      `https://r.jina.ai/http://www.bing.com/search?q=${encodeURIComponent(`${query} site:ctrip.com`)}`,
      `https://r.jina.ai/http://www.bing.com/search?q=${encodeURIComponent(`${query} site:qunar.com`)}`,
      `https://r.jina.ai/http://www.bing.com/search?q=${encodeURIComponent(`${query} site:baike.baidu.com`)}`,
    );
  }

  const urls = [];
  for (const endpoint of endpoints) {
    try {
      const text = await fetchText(endpoint);
      urls.push(...extractUrlsFromSearchText(text));
    } catch (error) {
      continue;
    }
  }
  return Array.from(new Set(urls));
}

function extractUrlsFromSearchText(text) {
  const content = String(text || "");
  const fromMarkdown = Array.from(
    content.matchAll(/\[[^\]]{1,200}\]\((https?:\/\/[^\s)]+)\)/g),
  ).map((item) => sanitizeExtractedUrl(item[1]));
  const fromPlain = Array.from(
    content.matchAll(/https?:\/\/[^\s<>"')\]]+/g),
  ).map((item) => sanitizeExtractedUrl(item[0]));
  return [...fromMarkdown, ...fromPlain].filter(Boolean);
}

function sanitizeExtractedUrl(rawUrl) {
  const cleaned = String(rawUrl || "")
    .replace(/[),.;]+$/g, "")
    .replace(/&amp;/g, "&")
    .trim();
  return unwrapSearchRedirectUrl(cleaned);
}

function unwrapSearchRedirectUrl(url) {
  try {
    const parsed = new URL(url);
    const keys = ["url", "u", "target", "r", "q"];
    for (const key of keys) {
      const value = parsed.searchParams.get(key);
      if (value && /^https?:\/\//.test(value)) {
        return value;
      }
    }
    return url;
  } catch (error) {
    return url;
  }
}

function shouldKeepSearchResultUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const full = `${host}${parsed.pathname}`.toLowerCase();
    if (
      /(^|\.)r\.jina\.ai$|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)sogou\.com$/.test(
        host,
      )
    ) {
      return false;
    }
    if ((host === "baidu.com" || host === "www.baidu.com" || host === "m.baidu.com") && !/baike\.baidu\.com$/.test(host)) {
      return false;
    }
    if (/(\.jpg|\.jpeg|\.png|\.gif|\.svg|\.css|\.js|\.ico|\.xml|\.json|\/video\/|\/images\/)/.test(full)) {
      return false;
    }
    return /^https?:\/\//.test(url);
  } catch (error) {
    return false;
  }
}

async function buildWebContentCandidateFromUrl(url, scenicName, keywords, mode) {
  const rawText = await fetchText(toJinaReaderUrl(url));
  const extracted = extractModeContentFromRawText(rawText, scenicName, mode);
  const content = sanitizeNetworkIntro(extracted.content);
  if (content.length < 30) return null;

  const tips = mode === "tips" ? extractTipsFromWebText(content, scenicName) : [];
  if (mode === "tips" && !tips.length) return null;

  return {
    url,
    content,
    tips,
    authorityScore: scoreSourceAuthority(url),
    relevanceScore: scoreModeRelevance(content, scenicName, keywords, mode),
    qualityScore: scoreModeQuality(content, mode),
    totalScore: 0,
  };
}

function extractModeContentFromRawText(rawText, scenicName, mode) {
  if (mode === "script") {
    return { content: pickScriptParagraphsFromLongText(rawText, scenicName) };
  }
  if (mode === "tips") {
    const tips = extractStructuredTravelTips(rawText, scenicName);
    return { content: tips.join("\n"), tips };
  }
  return { content: pickIntroParagraphFromLongText(rawText, scenicName) };
}

function toJinaReaderUrl(url) {
  return `https://r.jina.ai/http://${String(url).replace(/^https?:\/\//, "")}`;
}

function scoreSourceAuthority(url) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch (error) {
    return 20;
  }
  if (/\.gov\.cn$/.test(host) || host === "www.gov.cn") return 98;
  if (/\.edu\.cn$/.test(host)) return 88;
  if (
    /wikipedia\.org$|baike\.baidu\.com$|xinhuanet\.com$|people\.com\.cn$|news\.cn$|cctv\.com$/.test(
      host,
    )
  ) {
    return 86;
  }
  if (/trip\.com$|ctrip\.com$|mafengwo\.cn$|qunar\.com$/.test(host)) return 58;
  if (/weibo\.com$|xiaohongshu\.com$|douyin\.com$|bilibili\.com$/.test(host)) return 36;
  return 52;
}

function scoreModeRelevance(content, scenicName, keywords, mode) {
  const text = normalizeScenicKeyword(content);
  const cueWords = Array.from(
    new Set([scenicName, ...(keywords || []).slice(0, 5)].map(normalizeScenicKeyword)),
  ).filter(Boolean);
  let score = 0;
  cueWords.forEach((kw) => {
    if (!kw || kw.length < 2) return;
    if (text.includes(kw)) {
      score += Math.min(28, kw.length * 6);
    }
  });
  if (mode === "intro" && /位于|坐落于|历史|文化|文物/.test(content)) score += 14;
  if (mode === "script" && /欢迎|今天|我们|来到|现在|请看|这里/.test(content)) score += 12;
  if (mode === "tips" && /注意|请勿|禁止|安全|预约|开放时间|门票|交通|优惠|免票|导览图|地图/.test(content)) {
    score += 22;
  }
  return Math.min(100, score);
}

function scoreModeQuality(content, mode) {
  const text = String(content || "").trim();
  if (!text) return 0;
  const len = text.length;
  let score = 0;
  if (mode === "script") {
    if (len >= 120 && len <= 1200) score += 42;
    else if (len >= 70) score += 24;
  } else if (mode === "tips") {
    if (len >= 30 && len <= 460) score += 36;
    else if (len >= 20) score += 20;
  } else if (len >= 50 && len <= 260) score += 40;
  else if (len >= 30 && len <= 400) score += 24;

  const punct = (text.match(/[，。！？；：]/g) || []).length;
  if (punct >= 2) score += 20;
  const weird = (text.match(/[^\u4e00-\u9fa5A-Za-z0-9，。！？；：、,.!?;:（）()《》“”‘’"'\-\s]/g) || [])
    .length;
  score += weird === 0 ? 20 : Math.max(0, 20 - weird * 2);
  return Math.min(100, score);
}

function scoreCandidateConsensus(current, allCandidates) {
  let total = 0;
  allCandidates.forEach((item) => {
    if (item === current) return;
    const sim = textSimilarityByBigrams(current.content, item.content);
    if (sim >= 0.18) {
      total += sim * 40;
    }
  });
  return Math.min(100, total);
}

function textSimilarityByBigrams(left, right) {
  const a = toBigramSet(normalizeScenicKeyword(left));
  const b = toBigramSet(normalizeScenicKeyword(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach((item) => {
    if (b.has(item)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  if (!union) return 0;
  return intersection / union;
}

function toBigramSet(text) {
  const value = String(text || "");
  const set = new Set();
  if (value.length < 2) return set;
  for (let i = 0; i < value.length - 1; i += 1) {
    set.add(value.slice(i, i + 2));
  }
  return set;
}

async function fetchText(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP_${resp.status}`);
  }
  return resp.text();
}

function sanitizeNetworkIntro(text) {
  return normalizeImportedText(
    String(text || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\[\d+\]/g, "")
      .replace(/[ \t\u3000]+/g, " ")
      .replace(/\n{3,}/g, "\n\n"),
  );
}

function pickIntroParagraphFromLongText(raw, keyword) {
  const text = sanitizeNetworkIntro(raw);
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length >= 24)
    .filter((line) => !/^(http|https|source|title|url):/i.test(line));
  const normalizedKeyword = normalizeScenicKeyword(keyword);
  const hit = lines.find((line) =>
    normalizeScenicKeyword(line).includes(normalizedKeyword),
  );
  if (hit) return hit;
  return lines[0] || "";
}

function pickScriptParagraphsFromLongText(raw, keyword) {
  const text = sanitizeNetworkIntro(raw);
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length >= 14 && line.length <= 220)
    .filter((line) => !/^(http|https|source|title|url):/i.test(line));
  const normalizedKeyword = normalizeScenicKeyword(keyword);
  const selected = lines.filter((line) => {
    const normalizedLine = normalizeScenicKeyword(line);
    return (
      normalizedLine.includes(normalizedKeyword) ||
      /欢迎|来到|这里|历史|文化|建筑|故事|景区|景点|可以看到|接下来|请看/.test(line)
    );
  });
  const source = selected.length >= 3 ? selected : lines;
  const merged = source.slice(0, 12).join("\n");
  return merged || "";
}

function extractTipsFromWebText(text, scenicName) {
  const normalized = sanitizeNetworkIntro(text);
  const sentences = normalized
    .replace(/\r/g, "\n")
    .split(/\n+|(?<=[。！？])/)
    .map((line) => line.trim())
    .filter(Boolean);
  const scenicKey = normalizeScenicKeyword(scenicName);
  const candidates = sentences.filter((line) => {
    const normalizedLine = normalizeScenicKeyword(line);
    return (
      /注意|请勿|禁止|安全|预约|实名|门票|开放时间|闭馆|交通|停车|排队|文明/.test(line) &&
      (normalizedLine.includes(scenicKey) || line.length <= 70)
    );
  });
  return polishTips(candidates).slice(0, 10);
}

function extractStructuredTravelTips(rawText, scenicName) {
  const normalized = sanitizeNetworkIntro(rawText);
  const lines = normalized
    .replace(/\r/g, "\n")
    .split(/\n+|(?<=[。！？])/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length >= 6 && line.length <= 120);

  const scenicKey = normalizeScenicKeyword(scenicName);
  const categories = [
    {
      label: "营业时间",
      pattern: /营业时间|开放时间|开园|闭园|停止入园|开放时段|接待时间/,
    },
    {
      label: "门票价格",
      pattern: /门票|票价|成人票|儿童票|老人票|学生票|套票|价格|费用/,
    },
    {
      label: "优惠与免票",
      pattern: /优惠|免票|免费|半价|减免|优待|政策|军人|老年|残疾|教师|学生/,
    },
    {
      label: "导览图",
      pattern: /导览图|地图|游览图|园区图|路线图|景区图|游客中心|语音导览/,
    },
    {
      label: "其他提醒",
      pattern: /交通|停车|预约|实名|排队|安检|文明|安全|请勿|禁止|天气|防滑/,
    },
  ];

  const results = [];
  categories.forEach((item) => {
    const matched = lines.find((line) => {
      const normalizedLine = normalizeScenicKeyword(line);
      const hasScenic = normalizedLine.includes(scenicKey) || line.length <= 60;
      return item.pattern.test(line) && hasScenic;
    });
    if (matched) {
      results.push(formatTipLine(item.label, matched));
    }
  });

  const fallback = extractTipsFromWebText(normalized, scenicName);
  const merged = mergeTips(results, fallback);
  return merged.slice(0, 12);
}

function formatTipLine(label, line) {
  const cleaned = String(line || "")
    .replace(/^[\-*•\d\.\)、\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  const withoutPrefix = cleaned.replace(
    /^(营业时间|开放时间|门票价格|门票|票价|优惠与免票|优惠政策|免票政策|导览图|地图|其他提醒)[:：]?\s*/,
    "",
  );
  const content = withoutPrefix || cleaned;
  return `${label}：${/[。！？]$/.test(content) ? content : `${content}。`}`;
}

function buildScenicSearchKeywords(name) {
  const raw = sanitizeSpotNameLabel(name);
  if (!raw) return [];

  const base = raw
    .replace(/[()（）【】\[\]<>《》]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalized = (base || raw).replace(/\s+/g, "");
  const baseNames = new Set([normalized]);

  const adminRemoved = normalized.replace(
    /^(?:中国)?(?:[\u4e00-\u9fa5]{2,6}(?:省|市|县|区|州|盟|旗))/,
    "",
  );
  if (adminRemoved && adminRemoved !== normalized) {
    baseNames.add(adminRemoved);
  }

  // 城市+景点名这种写法（如“福州三坊七巷”）增加核心名候选。
  if (/^[\u4e00-\u9fa5]{5,}$/.test(normalized)) {
    baseNames.add(normalized.slice(-4));
  }
  if (/^[\u4e00-\u9fa5]{6,}$/.test(normalized)) {
    baseNames.add(normalized.slice(-5));
    baseNames.add(normalized.slice(2));
  }

  const keys = [];
  baseNames.forEach((nameItem) => {
    if (!isUsefulScenicKeyword(nameItem)) return;
    keys.push(nameItem);
    if (!/(景区|景点|风景区|公园|古镇|博物馆|遗址|寺|山|湖|街区)$/.test(nameItem)) {
      keys.push(`${nameItem}景区`);
      keys.push(`${nameItem}风景区`);
      keys.push(`${nameItem}景点`);
    }
    keys.push(`${nameItem}旅游`);
  });

  return Array.from(new Set(keys)).filter(isUsefulScenicKeyword);
}

function isUsefulScenicKeyword(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (value.length < 2) return false;
  if (/^(景区|风景区|景点|旅游|公园|古镇|博物馆|遗址|寺|山|湖|街区)$/.test(value)) {
    return false;
  }
  return true;
}

function normalizeScenicKeyword(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）【】\[\]<>《》·,，.。:：'"“”‘’\-]/g, "")
    .trim();
}

function guessSpotNameFromText(text) {
  const source = String(text || "").slice(0, 4000);
  return extractScenicNameCandidates(source)[0] || "";
}

function setJobStatus(text) {
  if (!el.jobStatus) return;
  const content = String(text || "").trim();
  if (!content) {
    el.jobStatus.textContent = "";
    el.jobStatus.classList.add("hidden");
    return;
  }
  el.jobStatus.textContent = content;
  el.jobStatus.classList.remove("hidden");
}

function clearJobStatus(delayMs = 0) {
  const run = () => setJobStatus("");
  if (delayMs > 0) {
    window.setTimeout(run, delayMs);
  } else {
    run();
  }
}

async function handleUnifiedImport(event) {
  const eventInput = event?.target instanceof HTMLInputElement ? event.target : null;
  const activeInput =
    eventInput ||
    (document.activeElement === el.dashboardImportInput ? el.dashboardImportInput : null) ||
    (el.dashboardImportInput && el.dashboardImportInput.files?.length
      ? el.dashboardImportInput
      : el.importInput);
  const files = Array.from(activeInput?.files || []);
  if (!files.length) return;

  const groups = {
    json: [],
    txt: [],
    pdf: [],
    word: [],
    audio: [],
    unsupported: [],
  };

  files.forEach((file) => {
    const type = classifyImportFile(file);
    if (groups[type]) {
      groups[type].push(file);
    } else {
      groups.unsupported.push(file);
    }
  });

  try {
    const summaries = [];
    let totalImported = 0;

    const isSingleJson = files.length === 1 && groups.json.length === 1;
    if (groups.json.length) {
      const result = await importData(groups.json, {
        append: !isSingleJson,
        silent: true,
      });
      summaries.push(`JSON ${result.importedCount} 个景区`);
      totalImported += result.importedCount;
      if (result.failedFiles.length) {
        summaries.push(`JSON失败 ${result.failedFiles.length} 个`);
      }
    }

    if (groups.txt.length) {
      const result = await handleTxtImport(groups.txt, { silent: true });
      summaries.push(`TXT ${result.importedCount} 个景区`);
      totalImported += result.importedCount;
      if (result.failedFiles.length) {
        summaries.push(`TXT失败 ${result.failedFiles.length} 个`);
      }
    }

    if (groups.pdf.length) {
      const result = await handlePdfImport(groups.pdf, { silent: true });
      summaries.push(`PDF ${result.importedCount} 个景区`);
      totalImported += result.importedCount;
      if (result.failedFiles.length) {
        summaries.push(`PDF失败 ${result.failedFiles.length} 个`);
      }
    }

    if (groups.word.length) {
      const result = await handleWordImport(groups.word, { silent: true });
      summaries.push(`Word ${result.importedCount} 个景区`);
      totalImported += result.importedCount;
      if (result.failedFiles.length) {
        summaries.push(`Word失败 ${result.failedFiles.length} 个`);
      }
    }

    if (groups.audio.length) {
      const result = await handleAudioTranscribeImport(groups.audio, { silent: true });
      summaries.push(`音频 ${result.importedCount} 个景区`);
      totalImported += result.importedCount;
      if (result.failedFiles.length) {
        summaries.push(`音频失败 ${result.failedFiles.length} 个`);
      }
      if (result.skippedCount) {
        summaries.push(`音频跳过 ${result.skippedCount} 个`);
      }
    }

    if (groups.unsupported.length) {
      summaries.push(`不支持格式 ${groups.unsupported.length} 个`);
    }

    if (!summaries.length) {
      alert("没有可导入的文件。");
      return;
    }

    if (totalImported > 0) {
      state.currentView = "library";
      switchMobileView("editor");
      renderAll();
    }

    alert(`导入完成：${summaries.join("，")}。`);
  } finally {
    if (activeInput) {
      activeInput.value = "";
    }
    if (activeInput !== el.importInput && el.importInput) {
      el.importInput.value = "";
    }
    if (activeInput !== el.dashboardImportInput && el.dashboardImportInput) {
      el.dashboardImportInput.value = "";
    }
    clearJobStatus(1200);
  }
}

function classifyImportFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const mime = String(file?.type || "").toLowerCase();

  if (name.endsWith(".json") || mime.includes("json")) return "json";
  if (name.endsWith(".dos")) return "txt";
  if (name.endsWith(".txt") || mime === "text/plain") return "txt";
  if (name.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) return "word";
  if (name.endsWith(".doc") || mime === "application/msword") return "word";
  if (mime.startsWith("audio/")) return "audio";
  if (/\.(mp3|m4a|aac|wav|ogg|flac|opus|webm)$/i.test(name)) return "audio";
  return "unsupported";
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    spots: state.spots,
    selectedId: state.selectedId,
    note: "Audio binaries are stored in IndexedDB and are not embedded in this JSON export.",
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tour-guide-library-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert("已导出文本数据。提示：音频二进制文件不包含在 JSON 中。");
}

async function importData(inputFiles, options = {}) {
  const files = Array.isArray(inputFiles)
    ? inputFiles
    : inputFiles
      ? [inputFiles]
      : [];
  if (!files.length) {
    return { importedCount: 0, failedFiles: [] };
  }

  const append = Boolean(options.append);
  const silent = Boolean(options.silent);
  const failedFiles = [];
  let importedCount = 0;
  let newSelectedId = state.selectedId;

  for (const file of files) {
    try {
      const text = await readTextFile(file);
      const parsed = parseImportJson(text);
      const normalized = normalizeData(parsed);
      if (!normalized.spots.length) {
        throw new Error("NO_SPOTS");
      }

      if (append) {
        const importedSpots = cloneSpotsWithNewIds(normalized.spots);
        importedSpots.forEach((spot) => {
          spot.catalog = Array.isArray(spot.catalog) && spot.catalog.length
            ? spot.catalog
            : buildSpotCatalog(spot);
        });
        state.spots.unshift(...importedSpots);
        importedCount += importedSpots.length;
        newSelectedId = newSelectedId || importedSpots[0]?.id || null;
      } else {
        state.spots = normalized.spots;
        state.spots.forEach((spot) => {
          spot.catalog = Array.isArray(spot.catalog) && spot.catalog.length
            ? spot.catalog
            : buildSpotCatalog(spot);
        });
        newSelectedId = normalized.selectedId;
        importedCount = normalized.spots.length;
      }
    } catch (error) {
      failedFiles.push(file.name || "未命名.json");
      console.warn(error);
    }
  }

  if (importedCount > 0) {
    await migrateInlineAudiosToIndexedDb();
    state.selectedId = newSelectedId || state.spots[0]?.id || null;
    const selectedSpot = state.spots.find((spot) => spot.id === state.selectedId);
    state.selectedCatalogId = selectedSpot?.catalog?.[0]?.id || "";
    saveState();
    renderAll();
  }

  if (!silent) {
    if (!importedCount) {
      alert("导入失败：文件格式无法识别或没有景区数据。");
    } else if (failedFiles.length) {
      alert(`导入完成：成功 ${importedCount} 个景区，失败 ${failedFiles.length} 个文件。`);
    } else {
      alert(`导入成功，共 ${importedCount} 个景区。`);
    }
  }

  return { importedCount, failedFiles };
}

async function handlePdfImport(inputFiles, options = {}) {
  const files = Array.isArray(inputFiles)
    ? inputFiles
    : Array.from(inputFiles || []);
  const silent = Boolean(options.silent);
  if (!files.length) return;

  const importedIds = [];
  const failures = [];
  setJobStatus(`准备导入 PDF，共 ${files.length} 个文件...`);

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const positionText = `${index + 1}/${files.length}`;
      try {
        setJobStatus(`处理中 ${positionText}：${file.name}（PDF 解析中）...`);
        let fullText = await extractTextFromPdf(file);
        let ocrMeta = null;
        if (isLikelyScannedPdf(fullText)) {
          setJobStatus(`处理中 ${positionText}：${file.name}（扫描件 OCR 识别中）...`);
          ocrMeta = await extractTextByOcrFromPdf(file);
          fullText = ocrMeta.text;
        }

        if (!normalizeImportedText(fullText)) {
          throw new Error("PDF_NO_TEXT");
        }

        const fallback = buildSpotFromTranscript(fullText, file.name);
        const draftSpot = {
          id: createId(),
          name: fallback.name || deriveSpotNameFromFile(file.name),
          intro: "",
          script: fallback.script || fullText,
          webScript: "",
          tips: mergeTips([], fallback.tips),
          audios: [],
          catalog: [],
        };
        const spot = polishRecognizedSpot(draftSpot);
        if (ocrMeta && ocrMeta.totalPages > ocrMeta.pagesToProcess) {
          spot.script = appendText(
            spot.script,
            `（提示：该 PDF 共 ${ocrMeta.totalPages} 页，本次 OCR 识别前 ${ocrMeta.pagesToProcess} 页）`,
          );
          spot.catalog = buildSpotCatalog(spot);
        }

        state.spots.unshift(spot);
        importedIds.push(spot.id);
      } catch (error) {
        failures.push(file.name);
        console.warn(error);
      }
    }

    state.selectedId = importedIds[0] || state.selectedId;
    const selectedSpot = state.spots.find((spot) => spot.id === state.selectedId);
    state.selectedCatalogId = selectedSpot?.catalog?.[0]?.id || "";
    state.editorSection = "script";
    switchMobileView("editor");
    saveState();
    renderAll();

    if (!silent) {
      let message = `PDF 导入完成：成功 ${importedIds.length} 个，失败 ${failures.length} 个。`;
      if (failures.length) {
        message += ` 失败文件：${failures.join("、")}。`;
      }
      alert(message);
    }
    return {
      importedCount: importedIds.length,
      failedFiles: failures,
    };
  } finally {
    clearJobStatus(1800);
  }
}

async function extractTextFromPdf(file) {
  await ensurePdfJsLoaded();
  const buffer = await readFileAsArrayBuffer(file);
  const task = window.pdfjsLib.getDocument({ data: buffer });
  const pdf = await task.promise;
  const pageTexts = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    pageTexts.push(textContentToString(content.items || []));
  }

  return pageTexts.join("\n\n").trim();
}

function isLikelyScannedPdf(text) {
  const compact = String(text || "").replace(/\s+/g, "");
  return compact.length < OCR_FALLBACK_MIN_CHARS;
}

async function extractTextByOcrFromPdf(file) {
  await ensurePdfJsLoaded();
  await ensureOcrLoaded();

  const buffer = await readFileAsArrayBuffer(file);
  const task = window.pdfjsLib.getDocument({ data: buffer });
  const pdf = await task.promise;

  const totalPages = pdf.numPages;
  const pagesToProcess = Math.min(totalPages, OCR_MAX_PAGES);
  const pageTexts = [];

  for (let pageNo = 1; pageNo <= pagesToProcess; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("OCR_CANVAS_FAILED");
    }

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;
    const result = await window.Tesseract.recognize(canvas, OCR_LANG, {});
    pageTexts.push(String(result?.data?.text || "").trim());

    canvas.width = 1;
    canvas.height = 1;
  }

  return {
    text: pageTexts.join("\n\n").trim(),
    pagesToProcess,
    totalPages,
  };
}

function textContentToString(items) {
  const lines = [];
  let currentLine = "";

  items.forEach((item) => {
    const word = String(item?.str || "").trim();
    if (!word) return;
    currentLine += currentLine ? ` ${word}` : word;
    if (item?.hasEOL) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  });

  if (currentLine) {
    lines.push(currentLine.trim());
  }
  return lines.join("\n");
}

async function readFileAsArrayBuffer(file) {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("PDF_READ_FAILED"));
    reader.readAsArrayBuffer(file);
  });
}

async function ensurePdfJsLoaded() {
  if (window.pdfjsLib) return;
  if (pdfJsLoaderPromise) {
    await pdfJsLoaderPromise;
    return;
  }

  pdfJsLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PDFJS_LIB_URL;
    script.async = true;
    script.onload = () => {
      if (!window.pdfjsLib) {
        reject(new Error("PDFJS_LOAD_FAILED"));
        return;
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      resolve();
    };
    script.onerror = () => reject(new Error("PDFJS_LOAD_FAILED"));
    document.head.appendChild(script);
  });

  try {
    await pdfJsLoaderPromise;
  } catch (error) {
    pdfJsLoaderPromise = null;
    throw error;
  }
}

async function ensureOcrLoaded() {
  if (window.Tesseract) return;
  if (ocrLoaderPromise) {
    await ocrLoaderPromise;
    return;
  }

  ocrLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = OCR_LIB_URL;
    script.async = true;
    script.onload = () => {
      if (!window.Tesseract) {
        reject(new Error("OCR_LOAD_FAILED"));
        return;
      }
      resolve();
    };
    script.onerror = () => reject(new Error("OCR_LOAD_FAILED"));
    document.head.appendChild(script);
  });

  try {
    await ocrLoaderPromise;
  } catch (error) {
    ocrLoaderPromise = null;
    throw error;
  }
}

function mapPdfTextToFields(rawText) {
  const text = String(rawText || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sections = splitLinesByHeading(lines);

  let intro = sections.intro.join("\n");
  let script = sections.script.join("\n");
  let tips = normalizeTips(sections.tips.join("\n"));

  if (!intro && lines.length >= 6) {
    intro = lines.slice(0, 4).join("\n");
  }
  if (!script) {
    script = lines.join("\n");
  }
  tips = mergeTips(tips, extractTipsFromLines(lines));

  return {
    intro: intro.trim(),
    script: script.trim(),
    tips,
  };
}

function splitLinesByHeading(lines) {
  const buckets = { intro: [], script: [], tips: [] };
  let current = "script";

  const headingRules = [
    {
      key: "intro",
      regex: /^(景区介绍|景点介绍|景区简介|景点简介|简介|概况|背景|历史文化)$/,
    },
    {
      key: "script",
      regex: /^(讲解词|讲解稿|导游词|解说词|讲解内容)$/,
    },
    {
      key: "tips",
      regex: /^(注意事项|温馨提示|安全提示|注意|提示)$/,
    },
  ];

  lines.forEach((line) => {
    const inlineMatch = line.match(/^([^:：]{1,24})[:：]\s*(.+)$/);
    if (inlineMatch) {
      const heading = inlineMatch[1].trim();
      const content = inlineMatch[2].trim();
      const rule = headingRules.find((item) => item.regex.test(heading));
      if (rule) {
        current = rule.key;
        if (content) {
          buckets[current].push(content);
        }
        return;
      }
    }

    const normalizedLine = line.replace(/[:：]\s*$/, "").trim();
    const headingOnlyRule = headingRules.find((item) =>
      item.regex.test(normalizedLine),
    );
    if (headingOnlyRule) {
      current = headingOnlyRule.key;
      return;
    }
    buckets[current].push(line);
  });
  return buckets;
}

function extractTipsFromLines(lines) {
  return lines
    .map((line) => line.replace(/^(\d+[\.\)、]|[-*•])\s*/, "").trim())
    .filter((line) => {
      return /注意|请勿|不要|禁止|安全|保管|防滑|小心|集合/.test(line);
    });
}

function appendText(existing, imported) {
  const base = String(existing || "").trim();
  const add = String(imported || "").trim();
  if (!add) return base;
  if (!base) return add;
  if (base.includes(add)) return base;
  return `${base}\n\n${add}`;
}

function mergeTips(left, right) {
  const set = new Set([...(left || []), ...(right || [])]);
  return Array.from(set).map((item) => String(item).trim()).filter(Boolean);
}

async function readTextFile(file) {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsText(file, "utf-8");
  });
}

async function readTextWithEncodingDetection(file) {
  const buffer = await readFileAsArrayBuffer(file);
  const decoded = decodeBufferWithBestEncoding(buffer, [
    "utf-8",
    "gb18030",
    "utf-16le",
    "utf-16be",
    "big5",
    "windows-1252",
  ]);
  return normalizeImportedText(decoded);
}

function decodeBufferWithBestEncoding(buffer, candidates) {
  let bestText = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  const bytes = new Uint8Array(buffer);

  candidates.forEach((encoding) => {
    try {
      const text = new TextDecoder(encoding).decode(bytes);
      const score = scoreDecodedText(text);
      if (score > bestScore) {
        bestScore = score;
        bestText = text;
      }
    } catch (error) {
      return;
    }
  });

  if (bestText) return bestText;
  return new TextDecoder("utf-8").decode(bytes);
}

function scoreDecodedText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return -999;
  const length = raw.length;
  const chinese = (raw.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinNum = (raw.match(/[A-Za-z0-9]/g) || []).length;
  const punctuation = (raw.match(/[，。！？；：、,.!?;:（）()《》“”‘’"'\-\n\r\t]/g) || [])
    .length;
  const replacement = (raw.match(/�/g) || []).length;
  const weird = (
    raw.match(
      /[^\u4e00-\u9fffA-Za-z0-9，。！？；：、,.!?;:（）()《》“”‘’"'\-\s]/g,
    ) || []
  ).length;

  return (
    (chinese * 2.2 + latinNum * 0.8 + punctuation * 0.4) / length -
    (replacement * 4 + weird * 1.5) / length
  );
}

function cleanupLegacyDocText(text) {
  const raw = String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ");

  const segmented = raw
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9，。！？；：、,.!?;:（）()《》“”‘’"'\-\n\r\t\s]/g, "\n")
    .replace(/ {6,}/g, "\n")
    .replace(/\s+([，。！？；：,.!?;:])/g, "$1")
    .replace(/([（《“])\s+/g, "$1")
    .replace(/\s+([）》”])/g, "$1");

  const lines = segmented
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\bHYPERLINK\b/gi, " ")
        .replace(/http\s*:\s*blank/gi, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .filter(isLikelyLegacyDocContentLine);

  return normalizeImportedText(lines.join("\n"));
}

function isLikelyLegacyDocContentLine(line) {
  const text = String(line || "").trim();
  if (!text) return false;
  if (/^(blank|http|https)$/i.test(text)) return false;
  if (text.length <= 2) return false;

  const zh = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const ascii = (text.match(/[A-Za-z0-9]/g) || []).length;
  const punct = (text.match(/[，。！？；：、,.!?;:（）()《》“”‘’"'\-]/g) || []).length;
  const weird = (
    text.match(/[^\u4e00-\u9fa5A-Za-z0-9，。！？；：、,.!?;:（）()《》“”‘’"'\-\s]/g) || []
  ).length;

  if (zh >= 3) return true;
  if (zh >= 1 && text.length >= 10) return true;
  if (zh === 0 && ascii >= 18 && punct >= 2) return true;

  const useful = zh + ascii + punct;
  if (!text.length) return false;
  return useful / text.length >= 0.68 && weird / text.length <= 0.08;
}

function extractPrintableTextFromBinary(buffer) {
  const bytes = new Uint8Array(buffer);
  let output = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if (b === 10 || b === 13) {
      output += "\n";
      continue;
    }
    if (b >= 32 && b <= 126) {
      output += String.fromCharCode(b);
    } else {
      output += " ";
    }
  }
  return output;
}

function parseImportJson(rawText) {
  const text = String(rawText || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!text) {
    throw new Error("EMPTY_FILE");
  }
  return JSON.parse(text);
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function switchMobileView(view) {
  state.mobileView = view === "editor" ? "editor" : "list";
  updateMobileMode();
}

function updateMobileMode() {
  const mobile = isMobileViewport();
  el.body.classList.toggle("mobile-mode", mobile);
  el.mobileNav?.classList.toggle("hidden", !mobile || state.currentView !== "library");

  if (!mobile) {
    el.body.classList.remove("mobile-list", "mobile-editor");
    el.mobileListBtn.classList.remove("active");
    el.mobileEditorBtn.classList.remove("active");
    return;
  }

  if (state.mobileView !== "editor" && state.mobileView !== "list") {
    state.mobileView = "list";
  }
  el.body.classList.toggle("mobile-list", state.mobileView === "list");
  el.body.classList.toggle("mobile-editor", state.mobileView === "editor");
  el.mobileListBtn.classList.toggle("active", state.mobileView === "list");
  el.mobileEditorBtn.classList.toggle("active", state.mobileView === "editor");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const isSecureHost =
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  if (!isSecureHost) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker register failed", error);
    });
  });
}
