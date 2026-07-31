const galleryEl = document.getElementById("gallery");
const emptyEl = document.getElementById("empty");
const statusEl = document.getElementById("status");
const storageStatsEl = document.getElementById("storage-stats");
const categoryTitleEl = document.getElementById("category-title");
const profilePanel = document.getElementById("profile-panel");
const authorsPanel = document.getElementById("authors-panel");
const auditPanel = document.getElementById("audit-panel");
const userChip = document.getElementById("user-chip");
const logoutUserBtn = document.getElementById("logout-user");
const openAuthBtn = document.getElementById("open-auth");
const mineCat = document.getElementById("mine-cat");
const auditCat = document.getElementById("audit-cat");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxVideo = document.getElementById("lightbox-video");

const uploadDialog = document.getElementById("upload-dialog");
const uploadForm = document.getElementById("upload-form");
const uploadTitle = document.getElementById("upload-title");
const uploadFileInput = document.getElementById("upload-file");
const uploadFilePick = document.getElementById("upload-file-pick");
const uploadFileMeta = document.getElementById("upload-file-meta");
const uploadAccountOptions = document.getElementById("upload-account-options");
const uploadGuestHint = document.getElementById("upload-guest-hint");
const uploadLimitHint = document.getElementById("upload-limit-hint");
const uploadUnlisted = document.getElementById("upload-unlisted");
const uploadTags = document.getElementById("upload-tags");
const tagBar = document.getElementById("tag-bar");

const authDialog = document.getElementById("auth-dialog");
const tagsDialog = document.getElementById("tags-dialog");
const tagsForm = document.getElementById("tags-form");
const tagsInput = document.getElementById("tags-input");
const tagsPreview = document.getElementById("tags-preview");
const tagsError = document.getElementById("tags-error");
const tagsCancel = document.getElementById("tags-cancel");
let tagsEditItem = null;
const authForm = document.getElementById("auth-form");
const authUsername = document.getElementById("auth-username");
const authPassword = document.getElementById("auth-password");
const authPassword2 = document.getElementById("auth-password2");
const authPassword2Field = document.getElementById("auth-password2-field");
const authTitle = document.getElementById("auth-title");
const authHint = document.getElementById("auth-hint");
const authError = document.getElementById("auth-error");
const authUsernameStatus = document.getElementById("auth-username-status");
const authSwitchBtn = document.getElementById("auth-switch");
const authSubmitBtn = document.getElementById("auth-submit");
const settingsDialog = document.getElementById("settings-dialog");
const openSettingsBtn = document.getElementById("open-settings");
const settingsCloseBtn = document.getElementById("settings-close");
const themeGrid = document.getElementById("theme-grid");
const settingsThemeCurrent = document.getElementById("settings-theme-current");
let authMode = "login";
let usernameCheckTimer = null;

const THEME_SWATCHES = {
  trap: "linear-gradient(135deg, #090b0d 30%, #d6ff4b 100%)",
  neon: "linear-gradient(135deg, #12081f 20%, #39f3ff 55%, #ff40d6 100%)",
  paper: "linear-gradient(135deg, #e8eef2 40%, #0f6b5c 100%)",
  midnight: "linear-gradient(135deg, #060b18 35%, #e2b65c 100%)",
  brutal: "linear-gradient(135deg, #0a0a0a 40%, #ff3b6b 100%)",
  ocean: "linear-gradient(135deg, #04161c 30%, #4fd1c5 100%)",
  office: "linear-gradient(135deg, #c8d0d8 20%, #f3f5f7 55%, #2b579a 100%)",
  maldives: "linear-gradient(135deg, #7ad7e8 10%, #1aa6c1 45%, #f6e7c1 100%)",
  sakura: "linear-gradient(135deg, #fff0f5 20%, #f7a8c4 60%, #8fbf9f 100%)",
  forest: "linear-gradient(135deg, #0d1a12 30%, #2f6b3a 70%, #c4a35a 100%)",
  arcade: "linear-gradient(135deg, #120018 20%, #ff2bd6 55%, #39ffe2 100%)",
  desert: "linear-gradient(135deg, #2a1208 15%, #e07a3d 55%, #f2d6a2 100%)",
  cafe: "linear-gradient(135deg, #2a1c14 25%, #8b5e3c 60%, #f0e0c8 100%)",
  noir: "linear-gradient(135deg, #000 40%, #fff 70%, #c0c0c0 100%)",
  random:
    "conic-gradient(from 20deg, #d6ff4b, #39f3ff, #1aa6c1, #f7a8c4, #2f6b3a, #ff2bd6, #e07a3d, #d6ff4b)",
};

function syncThemeFromUser(user) {
  if (!window.RvTheme) return;
  if (user && user.theme) {
    window.RvTheme.applyTheme(user.theme);
  } else if (!user) {
    window.RvTheme.applyTheme(window.RvTheme.getStoredPref());
  }
}

function themeLabel(pref) {
  if (!window.RvTheme) return pref || "trap";
  const found = window.RvTheme.THEMES.find((t) => t.id === pref);
  return found ? found.name : pref;
}

function updateSettingsThemeHint() {
  if (!settingsThemeCurrent || !window.RvTheme) return;
  const pref = window.RvTheme.currentPref();
  const resolved = window.RvTheme.currentResolved();
  if (pref === "random") {
    settingsThemeCurrent.textContent = `Сейчас: Рандом дня → ${themeLabel(resolved)} (МСК ${window.RvTheme.moscowDay()})`;
  } else {
    settingsThemeCurrent.textContent = `Сейчас: ${themeLabel(pref)}`;
  }
}

function renderThemeGrid() {
  if (!themeGrid || !window.RvTheme) return;
  const pref = window.RvTheme.currentPref();
  themeGrid.innerHTML = "";
  for (const theme of window.RvTheme.THEMES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-option" + (theme.id === pref ? " is-active" : "");
    btn.dataset.theme = theme.id;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", theme.id === pref ? "true" : "false");
    btn.innerHTML = `
      <span class="theme-option__swatch" style="background:${THEME_SWATCHES[theme.id] || "#333"}"></span>
      <span class="theme-option__name">${theme.name}</span>
      <span class="theme-option__desc">${theme.desc}</span>`;
    btn.addEventListener("click", () => selectTheme(theme.id));
    themeGrid.appendChild(btn);
  }
  updateSettingsThemeHint();
}

async function selectTheme(themeId) {
  if (!window.RvTheme) return;
  window.RvTheme.applyTheme(themeId);
  renderThemeGrid();
  if (currentUser) {
    try {
      const data = await api("/api/auth/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: themeId }),
      });
      currentUser = data.user;
      setStatus(`Тема: ${themeLabel(themeId)}`);
      setTimeout(() => setStatus(""), 1600);
    } catch (err) {
      setStatus(err.message || "Не удалось сохранить тему");
    }
  } else {
    setStatus(`Тема: ${themeLabel(themeId)} (сохранена в браузере)`);
    setTimeout(() => setStatus(""), 1600);
  }
}

function openSettings() {
  renderThemeGrid();
  if (settingsDialog && typeof settingsDialog.showModal === "function") {
    settingsDialog.showModal();
  }
}

function renderProfileVotes(data, section) {
  const isAnon = Boolean(data.isAnonymousProfile || (data.user && data.user.isAnonymousProfile));
  if (isAnon) return;
  if (section === "comments") {
    renderProfileComments(data);
    return;
  }
  if (section !== "likes" && section !== "dislikes") return;

  const liked = Array.isArray(data.likedItems) ? data.likedItems : [];
  const disliked = Array.isArray(data.dislikedItems) ? data.dislikedItems : [];
  const items = section === "likes" ? liked : disliked;
  const title = section === "likes" ? "Лайки" : "Дизлайки";
  const emptyText = section === "likes" ? "Пока нет лайков." : "Пока нет дизлайков.";

  const wrap = document.createElement("section");
  wrap.className = "profile-votes profile-votes--section";
  wrap.appendChild(buildVoteBlock(title, items, emptyText));
  profilePanel.appendChild(wrap);
}

function renderProfileComments(data) {
  const comments = Array.isArray(data.comments) ? data.comments : [];
  const wrap = document.createElement("section");
  wrap.className = "profile-votes profile-votes--section profile-comments";

  const block = document.createElement("div");
  block.className = "profile-votes__block";
  const heading = document.createElement("h2");
  heading.className = "profile-votes__heading";
  heading.textContent = `Комментарии · ${comments.length}`;
  block.appendChild(heading);

  if (!comments.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Пока нет комментариев к картинкам.";
    block.appendChild(empty);
    wrap.appendChild(block);
    profilePanel.appendChild(wrap);
    return;
  }

  const list = document.createElement("div");
  list.className = "profile-comments__list";
  for (const entry of comments) {
    const item = entry.item || {};
    const itemTitle = displayTitle(item);
    const card = document.createElement("a");
    card.className = "profile-comment-card";
    card.href = `/i/${encodeURIComponent(entry.itemId || item.id)}`;
    card.title = itemTitle;

    const thumb = document.createElement("div");
    thumb.className = "profile-comment-card__thumb";
    const type = itemType(item);
    if (type === "image" && item.url) {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = itemTitle;
      img.loading = "lazy";
      thumb.appendChild(img);
    } else {
      const icon = document.createElement("span");
      icon.textContent = type === "audio" ? "♪" : type === "video" ? "▶" : "◆";
      thumb.appendChild(icon);
    }
    card.appendChild(thumb);

    const body = document.createElement("div");
    body.className = "profile-comment-card__body";
    const meta = document.createElement("div");
    meta.className = "profile-comment-card__meta";
    meta.innerHTML = `<strong>${escapeHtml(itemTitle)}</strong><span>${escapeHtml(
      formatRuDate(entry.createdAt) || ""
    )}</span>`;
    body.appendChild(meta);

    if (entry.text) {
      const text = document.createElement("p");
      text.className = "profile-comment-card__text";
      text.textContent = entry.text;
      body.appendChild(text);
    }
    if (entry.imageUrl) {
      const shot = document.createElement("img");
      shot.className = "profile-comment-card__image";
      shot.src = entry.imageUrl;
      shot.alt = "Картинка в комментарии";
      shot.loading = "lazy";
      body.appendChild(shot);
    }
    card.appendChild(body);
    list.appendChild(card);
  }
  block.appendChild(list);
  wrap.appendChild(block);
  profilePanel.appendChild(wrap);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildVoteBlock(title, items, emptyText) {
  const block = document.createElement("div");
  block.className = "profile-votes__block";
  const heading = document.createElement("h2");
  heading.className = "profile-votes__heading";
  heading.textContent = `${title} · ${items.length}`;
  block.appendChild(heading);

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = emptyText;
    block.appendChild(empty);
    return block;
  }

  const grid = document.createElement("div");
  grid.className = "profile-votes__grid";
  for (const item of items) {
    const type = itemType(item);
    const titleText = displayTitle(item);
    const card = document.createElement("a");
    card.className = "profile-vote-card";
    card.href = `/i/${encodeURIComponent(item.id)}`;
    card.title = titleText;

    const media = document.createElement("div");
    media.className = "profile-vote-card__media";
    if (type === "image" && item.url) {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = titleText;
      img.loading = "lazy";
      media.appendChild(img);
    } else {
      const icon = document.createElement("span");
      icon.textContent = type === "audio" ? "♪" : type === "video" ? "▶" : "◆";
      media.appendChild(icon);
    }
    card.appendChild(media);

    const caption = document.createElement("span");
    caption.className = "profile-vote-card__title";
    caption.textContent = titleText;
    card.appendChild(caption);
    grid.appendChild(card);
  }
  block.appendChild(grid);
  return block;
}

function normalizeTagDraft(raw) {
  return String(raw || "")
    .split(/[,;\n]+/)
    .map((t) =>
      t
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9а-яё_-]/gi, "")
        .slice(0, 24)
    )
    .filter((t) => t.length >= 2)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 8);
}

function splitTagInput(raw) {
  const value = String(raw || "");
  const lastSep = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"), value.lastIndexOf("\n"));
  const fragment = (lastSep >= 0 ? value.slice(lastSep + 1) : value).replace(/^\s+/, "");
  const completedRaw = lastSep >= 0 ? value.slice(0, lastSep) : "";
  const selected = normalizeTagDraft(completedRaw);
  return { fragment, selected };
}

function matchExistingTags(fragment, selected) {
  const q = String(fragment || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё_-]/gi, "");
  const taken = new Set((selected || []).map((t) => String(t).toLowerCase()));
  const pool = Array.isArray(popularTags) ? popularTags : [];
  let list = pool.filter((entry) => entry && entry.tag && !taken.has(entry.tag));
  if (q) {
    list = list.filter((entry) => entry.tag.includes(q));
    list.sort((a, b) => {
      const aStart = a.tag.startsWith(q) ? 0 : 1;
      const bStart = b.tag.startsWith(q) ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      return (b.count || 0) - (a.count || 0) || a.tag.localeCompare(b.tag, "ru");
    });
  } else {
    list = list.slice().sort((a, b) => (b.count || 0) - (a.count || 0) || a.tag.localeCompare(b.tag, "ru"));
  }
  return list.slice(0, 8);
}

function wireTagSuggest(input, listEl, { onChange } = {}) {
  if (!input || !listEl) return;
  let activeIndex = -1;
  let currentMatches = [];

  const hide = () => {
    listEl.classList.add("hidden");
    listEl.hidden = true;
    listEl.innerHTML = "";
    activeIndex = -1;
    currentMatches = [];
  };

  const applyTag = (tag) => {
    const { selected } = splitTagInput(input.value);
    if (selected.includes(tag) || selected.length >= 8) {
      hide();
      return;
    }
    const next = [...selected, tag];
    input.value = next.length >= 8 ? next.join(", ") : `${next.join(", ")}, `;
    hide();
    input.focus();
    const len = input.value.length;
    try {
      input.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
    if (typeof onChange === "function") onChange();
    refresh();
  };

  const render = (matches) => {
    currentMatches = matches;
    listEl.innerHTML = "";
    if (!matches.length) {
      hide();
      return;
    }
    matches.forEach((entry, i) => {
      const li = document.createElement("li");
      li.className = "tag-suggest__item" + (i === activeIndex ? " is-active" : "");
      li.setAttribute("role", "option");
      li.dataset.tag = entry.tag;
      const name = document.createElement("span");
      name.className = "tag-suggest__tag";
      name.textContent = `#${entry.tag}`;
      const count = document.createElement("span");
      count.className = "tag-suggest__count";
      count.textContent = String(entry.count || 0);
      li.appendChild(name);
      li.appendChild(count);
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        applyTag(entry.tag);
      });
      listEl.appendChild(li);
    });
    listEl.classList.remove("hidden");
    listEl.hidden = false;
  };

  const refresh = () => {
    if (document.activeElement !== input) {
      hide();
      return;
    }
    const { fragment, selected } = splitTagInput(input.value);
    if (selected.length >= 8) {
      hide();
      return;
    }
    const matches = matchExistingTags(fragment, selected);
    if (activeIndex >= matches.length) activeIndex = matches.length - 1;
    render(matches);
  };

  input.addEventListener("input", () => {
    if (typeof onChange === "function") onChange();
    activeIndex = -1;
    refresh();
  });
  input.addEventListener("focus", () => {
    activeIndex = -1;
    refresh();
  });
  input.addEventListener("blur", () => {
    setTimeout(hide, 120);
  });
  input.addEventListener("keydown", (e) => {
    if (listEl.hidden || listEl.classList.contains("hidden") || !currentMatches.length) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % currentMatches.length;
      render(currentMatches);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + currentMatches.length) % currentMatches.length;
      render(currentMatches);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const pick =
        activeIndex >= 0 ? currentMatches[activeIndex] : currentMatches.length === 1 ? currentMatches[0] : null;
      if (pick) {
        e.preventDefault();
        applyTag(pick.tag);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      hide();
    }
  });
}

function renderTagsPreview() {
  if (!tagsPreview || !tagsInput) return;
  const tags = normalizeTagDraft(tagsInput.value);
  tagsPreview.innerHTML = "";
  if (!tags.length) {
    tagsPreview.textContent = "Пока пусто";
    return;
  }
  for (const tag of tags) {
    const chip = document.createElement("span");
    chip.className = "tag-chip tag-chip--static";
    chip.textContent = `#${tag}`;
    tagsPreview.appendChild(chip);
  }
}

function openTagsEditor(item) {
  if (!tagsDialog || !tagsInput || !item) return;
  tagsEditItem = item;
  tagsInput.value = (item.tags || []).join(", ");
  if (tagsError) tagsError.textContent = "";
  renderTagsPreview();
  if (typeof tagsDialog.showModal === "function") tagsDialog.showModal();
  else tagsDialog.setAttribute("open", "");
  tagsInput.focus();
  tagsInput.select();
}

function closeTagsEditor() {
  tagsEditItem = null;
  if (!tagsDialog) return;
  if (typeof tagsDialog.close === "function") tagsDialog.close();
  else tagsDialog.removeAttribute("open");
}

async function saveTagsEditor(e) {
  if (e) e.preventDefault();
  if (!tagsEditItem) return;
  const item = tagsEditItem;
  const next = normalizeTagDraft(tagsInput ? tagsInput.value : "");
  if (tagsError) tagsError.textContent = "";
  try {
    const updated = await api(`/api/items/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: next.join(", ") }),
    });
    item.tags = updated.tags || next;
    closeTagsEditor();
    setStatus("Теги обновлены.");
    await refreshView();
    setTimeout(() => setStatus(""), 1600);
  } catch (err) {
    if (tagsError) tagsError.textContent = err.message || "Ошибка тегов";
  }
}

function setProfileSection(section) {
  const allowed = new Set(["posts", "likes", "dislikes", "comments"]);
  const next = allowed.has(section) ? section : "posts";
  if (profileSection === next) return;
  profileSection = next;
  if (profileData) {
    renderProfileHeader(profileData);
    renderCurrentView();
  }
}

const VOTER_KEY = "rasmusvraa_voter_id";
const KIND_LABEL = { image: "фото", audio: "аудио", video: "видео" };
const UPLOAD_LIMITS = {
  guest: 200 * 1024 * 1024,
  user: 500 * 1024 * 1024,
  moderator: 1024 * 1024 * 1024,
  admin: Math.round(1.5 * 1024 * 1024 * 1024),
};
const CAT_LABELS = {
  all: "Все",
  top: "Топ",
  legendary: "Легенды",
  date: "По дате",
  image: "Фото",
  audio: "Аудио",
  video: "Видео",
  authors: "Авторы",
  mine: "Мои",
  audit: "Аудит",
};
const VALID_CATS = new Set(Object.keys(CAT_LABELS));
const AUDIT_LABELS = {
  "item.upload": "Загрузка файла",
  "item.delete": "Удаление файла",
  "item.restore": "Восстановление файла",
  "item.legendary.on": "Легендарный статус",
  "item.legendary.off": "Снят легендарный",
  "item.rename": "Переименование файла",
  "user.ban": "Бан",
  "user.unban": "Разбан",
  "user.mute": "Мут",
  "user.unmute": "Снят мут",
  "user.moderator.grant": "Выдана модерка",
  "user.moderator.revoke": "Снята модерка",
  "user.register": "Регистрация",
  "user.rename": "Смена ника",
  "comment.create": "Комментарий",
  "comment.delete": "Удалён комментарий",
};
const MUTE_OPTIONS = [
  { hours: 1, label: "1 час" },
  { hours: 24, label: "1 день" },
  { hours: 168, label: "7 дней" },
  { hours: 720, label: "30 дней" },
];

const progressWrap = document.getElementById("upload-progress");
const progressBar = document.getElementById("upload-progress-bar");
const progressLabel = document.getElementById("upload-progress-label");

let allItems = [];
let currentUser = null;
let profileUser = null;
let profileData = null;
let profileSection = "posts"; // posts | likes | dislikes | comments
let viewMode = "gallery";
let activeCategory = "all";
let activeTag = "";
let recommendSeed = Date.now();
let popularTags = [];

const PREFS_KEY = "rv_reco_prefs";

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return {
      types: raw.types && typeof raw.types === "object" ? raw.types : {},
      tags: raw.tags && typeof raw.tags === "object" ? raw.tags : {},
      authors: raw.authors && typeof raw.authors === "object" ? raw.authors : {},
    };
  } catch {
    return { types: {}, tags: {}, authors: {} };
  }
}

function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function bumpPref(map, key, amount) {
  if (!key) return;
  map[key] = Math.max(0, Math.min(40, (Number(map[key]) || 0) + amount));
}

function rememberItemInterest(item, weight = 1) {
  if (!item) return;
  const prefs = loadPrefs();
  bumpPref(prefs.types, itemType(item), weight);
  if (item.authorId && !item.anonymous) bumpPref(prefs.authors, item.authorId, weight);
  for (const tag of item.tags || []) bumpPref(prefs.tags, tag, weight);
  savePrefs(prefs);
}

function hashSeed(seed, id) {
  let h = 2166136261;
  const s = `${seed}:${id}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function recommendScore(item, prefs, seed) {
  const now = Date.now();
  const ageDays = Math.max(0, (now - (Number(item.createdAt) || now)) / 86400000);
  const recency = Math.exp(-ageDays / 12) * 42;
  const likes = Number(item.likes) || 0;
  const dislikes = Number(item.dislikes) || 0;
  const vote = (likes - dislikes) * 7 + likes * 1.5;
  const legend = item.legendary ? 38 : 0;
  const typeBoost = (prefs.types[itemType(item)] || 0) * 3.5;
  const authorBoost =
    item.authorId && !item.anonymous ? (prefs.authors[item.authorId] || 0) * 2.8 : 0;
  let tagBoost = 0;
  for (const tag of item.tags || []) tagBoost += (prefs.tags[tag] || 0) * 4.5;
  const noise = hashSeed(seed, item.id) * 14;
  return recency + vote + legend + typeBoost + authorBoost + tagBoost + noise;
}

function recommendSort(items, seed = recommendSeed) {
  const prefs = loadPrefs();
  return items
    .map((item) => ({ item, score: recommendScore(item, prefs, seed) }))
    .sort((a, b) => b.score - a.score || (b.item.createdAt || 0) - (a.item.createdAt || 0))
    .map((x) => x.item);
}

function tagCountMap() {
  const map = new Map();
  for (const entry of popularTags) {
    map.set(entry.tag, entry.count);
  }
  return map;
}

function formatTagLabel(tag, count) {
  const n = Number(count);
  if (Number.isFinite(n) && n > 0) {
    return `#${tag} <span class="tag-chip__count">${n}</span>`;
  }
  return `#${tag}`;
}

function fillTagChip(el, tag, count, suffix = "") {
  el.innerHTML = `${formatTagLabel(tag, count)}${suffix ? ` ${suffix}` : ""}`;
}

function tagFromQuery() {
  try {
    return String(new URLSearchParams(window.location.search).get("tag") || "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}

function displayUsername(user) {
  if (!user) return "";
  if (user.isAnonymousProfile || user.displayName) return user.displayName || "Аноним";
  return user.username;
}

function profileFromPath() {
  const match = window.location.pathname.match(/^\/u\/([^/]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function categoryFromPath() {
  const match = window.location.pathname.match(/^\/c\/([a-z]+)/i);
  if (match && VALID_CATS.has(match[1].toLowerCase())) {
    return match[1].toLowerCase();
  }
  return "all";
}

function categoryPath(cat) {
  if (!cat || cat === "all") return "/";
  return `/c/${cat}`;
}

function uploadLimitBytes() {
  if (currentUser && currentUser.isAdmin) return UPLOAD_LIMITS.admin;
  if (currentUser && currentUser.isModerator) return UPLOAD_LIMITS.moderator;
  if (currentUser) return UPLOAD_LIMITS.user;
  return UPLOAD_LIMITS.guest;
}

function uploadLimitLabel() {
  const n = uploadLimitBytes();
  if (n >= 1024 * 1024 * 1024) {
    const gb = n / (1024 * 1024 * 1024);
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} ГБ`;
  }
  return `${Math.round(n / (1024 * 1024))} МБ`;
}

function syncUploadLimitHint() {
  if (!uploadLimitHint) return;
  if (currentUser) {
    uploadLimitHint.textContent = `Ваш лимит загрузки: ${uploadLimitLabel()}.`;
  } else {
    uploadLimitHint.textContent = `Лимит для гостей: 200 МБ. После входа — до 500 МБ.`;
  }
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

function updateStorageStats() {
  const totalBytes = allItems.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
  const count = allItems.length;
  if (!count) {
    storageStatsEl.textContent = "Пока пусто — 0 Б";
    return;
  }
  const filesWord =
    count % 10 === 1 && count % 100 !== 11
      ? "файл"
      : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)
        ? "файла"
        : "файлов";
  storageStatsEl.textContent = `${count} ${filesWord} · ${formatBytes(totalBytes)}`;
}

function getVoterId() {
  let id = localStorage.getItem(VOTER_KEY);
  if (!id || !/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
    id = `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(VOTER_KEY, id);
  }
  return id;
}

function apiHeaders(extra = {}) {
  return {
    "X-Voter-Id": getVoterId(),
    ...extra,
  };
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...apiHeaders(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
}

function setUploadProgress(percent, visible) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  if (visible) {
    progressWrap.classList.remove("hidden");
    progressWrap.setAttribute("aria-hidden", "false");
  } else {
    progressWrap.classList.add("hidden");
    progressWrap.setAttribute("aria-hidden", "true");
  }
  progressBar.style.width = `${value}%`;
  progressLabel.textContent = `${value}%`;
}

function isAdmin() {
  return Boolean(currentUser && currentUser.isAdmin);
}

function isModerator() {
  return Boolean(currentUser && currentUser.isModerator);
}

function isStaff() {
  return isAdmin() || isModerator();
}

function roleBadgeHtml(user) {
  if (!user) return "";
  if (user.isAdmin) return '<em class="user-chip__role">админ</em>';
  if (user.isModerator) return '<em class="user-chip__role user-chip__role--mod">модер</em>';
  return "";
}

function profileRoleBadgeHtml(user) {
  if (!user) return "";
  if (user.isAdmin) return '<span class="profile-hero__badge">админ</span>';
  if (user.isModerator) return '<span class="profile-hero__badge profile-hero__badge--mod">модер</span>';
  return "";
}

function setStatus(text) {
  statusEl.textContent = text || "";
}

function formatRuDate(ts) {
  const n = Number(ts);
  if (!n) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Moscow",
    }).format(new Date(n));
  } catch {
    return new Date(n).toLocaleDateString("ru-RU");
  }
}

function displayTitle(item) {
  return item.title || item.originalName || "Без названия";
}

function itemType(item) {
  if (item.type === "audio" || item.type === "video") return item.type;
  return "image";
}

function itemPagePath(id) {
  return `/i/${encodeURIComponent(id)}`;
}

function itemShareUrl(id) {
  return `${window.location.origin}${itemPagePath(id)}`;
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.removeAttribute("src");
  lightboxImg.hidden = true;
  lightboxVideo.pause();
  lightboxVideo.removeAttribute("src");
  lightboxVideo.load();
  lightboxVideo.hidden = true;
}

function filteredItems() {
  let list = allItems;
  if (activeTag) {
    list = list.filter((item) => (item.tags || []).includes(activeTag));
  }
  if (viewMode === "profile") return list;
  if (activeCategory === "all") return recommendSort(list);
  if (activeCategory === "mine") return list;
  if (activeCategory === "top") {
    return list.slice().sort((a, b) => {
      const likesDiff = (Number(b.likes) || 0) - (Number(a.likes) || 0);
      if (likesDiff !== 0) return likesDiff;
      const scoreA = (Number(a.likes) || 0) - (Number(a.dislikes) || 0);
      const scoreB = (Number(b.likes) || 0) - (Number(b.dislikes) || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });
  }
  if (activeCategory === "date") {
    return list.slice().sort(
      (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
    );
  }
  if (activeCategory === "legendary") {
    return list.filter((item) => Boolean(item.legendary));
  }
  return list.filter((item) => itemType(item) === activeCategory);
}

function syncAuthUi() {
  const loggedIn = Boolean(currentUser);
  openAuthBtn.classList.toggle("hidden", loggedIn);
  logoutUserBtn.classList.toggle("hidden", !loggedIn);
  mineCat.classList.toggle("hidden", !loggedIn);
  if (auditCat) auditCat.classList.toggle("hidden", !isAdmin());
  uploadAccountOptions.classList.toggle("hidden", !loggedIn);
  uploadGuestHint.classList.toggle("hidden", loggedIn);
  syncUploadLimitHint();

  if (loggedIn) {
    userChip.classList.remove("hidden");
    userChip.innerHTML = "";
    const link = document.createElement("a");
    link.className = "user-chip__link";
    link.href = `/u/${encodeURIComponent(currentUser.username)}`;
    if (currentUser.avatarUrl) {
      const img = document.createElement("img");
      img.src = currentUser.avatarUrl;
      img.alt = "";
      img.className = "user-chip__avatar";
      link.appendChild(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "user-chip__avatar user-chip__avatar--empty";
      ph.textContent = currentUser.username.slice(0, 1).toUpperCase();
      link.appendChild(ph);
    }
    const meta = document.createElement("span");
    meta.className = "user-chip__meta";
    const muteBadge = currentUser.isMuted
      ? '<em class="user-chip__role user-chip__role--mute">мут</em>'
      : "";
    meta.innerHTML = `<strong>${currentUser.username}</strong>${roleBadgeHtml(currentUser)}${muteBadge}`;
    link.appendChild(meta);
    userChip.appendChild(link);
  } else {
    userChip.classList.add("hidden");
    userChip.innerHTML = "";
  }
}

function renderAuthors(list) {
  authorsPanel.innerHTML = "";
  authorsPanel.classList.remove("hidden");
  profilePanel.classList.add("hidden");
  if (auditPanel) auditPanel.classList.add("hidden");
  galleryEl.closest(".gallery").classList.add("hidden");
  emptyEl.classList.add("hidden");
  categoryTitleEl.classList.remove("hidden");
  categoryTitleEl.textContent = "Топ авторов";
  document.title = "Авторы · Файлы Трэп хаты";

  if (!list.length) {
    authorsPanel.innerHTML = `<p class="empty">Пока нет зарегистрированных пользователей.</p>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "authors-grid";
  list.forEach((user, index) => {
    const name = displayUsername(user);
    const card = document.createElement("a");
    card.className = "author-card";
    if (user.isAnonymousProfile) card.classList.add("author-card--anon");
    if (!user.uploads) card.classList.add("author-card--empty");
    card.href = `/u/${encodeURIComponent(user.username)}`;
    card.innerHTML = `<span class="author-card__rank">#${index + 1}</span>`;
    if (user.avatarUrl) {
      const img = document.createElement("img");
      img.src = user.avatarUrl;
      img.alt = "";
      img.className = "author-card__avatar";
      card.appendChild(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "author-card__avatar author-card__avatar--empty";
      ph.textContent = user.isAnonymousProfile ? "?" : name.slice(0, 1).toUpperCase();
      card.appendChild(ph);
    }
    const body = document.createElement("span");
    body.className = "author-card__body";
    const filesWord =
      user.uploads % 10 === 1 && user.uploads % 100 !== 11
        ? "файл"
        : user.uploads % 10 >= 2 &&
            user.uploads % 10 <= 4 &&
            (user.uploads % 100 < 10 || user.uploads % 100 >= 20)
          ? "файла"
          : "файлов";
    body.innerHTML = `<strong>${name}</strong><span>${user.uploads} ${filesWord}</span>`;
    card.appendChild(body);
    grid.appendChild(card);
  });
  authorsPanel.appendChild(grid);
}

function renderProfileHeader(data) {
  profilePanel.classList.remove("hidden");
  authorsPanel.classList.add("hidden");
  if (auditPanel) auditPanel.classList.add("hidden");
  galleryEl.closest(".gallery").classList.remove("hidden");
  categoryTitleEl.classList.add("hidden");

  const user = data.user;
  const isAnon = Boolean(data.isAnonymousProfile || user.isAnonymousProfile);
  const name = displayUsername(user);
  const joined = formatRuDate(user.createdAt);
  profilePanel.innerHTML = "";

  const hero = document.createElement("div");
  hero.className = "profile-hero";
  if (isAnon) hero.classList.add("profile-hero--anon");

  const avatarWrap = document.createElement("div");
  avatarWrap.className = "profile-hero__avatar-wrap";
  if (user.avatarUrl) {
    const img = document.createElement("img");
    img.className = "profile-hero__avatar";
    img.src = user.avatarUrl;
    img.alt = name;
    avatarWrap.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "profile-hero__avatar profile-hero__avatar--empty";
    ph.textContent = isAnon ? "?" : name.slice(0, 1).toUpperCase();
    avatarWrap.appendChild(ph);
  }
  hero.appendChild(avatarWrap);

  const statusBits = [];
  if (user.isBanned) statusBits.push("в бане");
  if (user.isMuted) statusBits.push("в муте");
  const statusLine = statusBits.length
    ? `<p class="profile-hero__status">${statusBits.join(" · ")}${
        user.banReason ? ` — ${user.banReason}` : ""
      }</p>`
    : "";

  const likedCount = Array.isArray(data.likedItems) ? data.likedItems.length : 0;
  const dislikedCount = Array.isArray(data.dislikedItems) ? data.dislikedItems.length : 0;
  const commentsCount = Array.isArray(data.comments) ? data.comments.length : 0;
  const postsCount = Array.isArray(data.items) ? data.items.length : 0;

  const info = document.createElement("div");
  info.className = "profile-hero__info";
  info.innerHTML = `
    <p class="profile-hero__eyebrow">${
      isAnon ? "Условный профиль" : data.isSelf ? "Ваш профиль" : "Профиль"
    }</p>
    <h1 class="profile-hero__name">${name}${profileRoleBadgeHtml(user)}</h1>
    <p class="profile-hero__joined">${
      isAnon
        ? "Сюда попадают все анонимные загрузки гостей и аккаунтов."
        : joined
          ? `На сайте с ${joined}`
          : "Дата регистрации неизвестна"
    }</p>
    ${statusLine}
    <div class="profile-hero__stats"></div>`;
  hero.appendChild(info);

  const statsEl = info.querySelector(".profile-hero__stats");
  const addStat = (value, label, section, enabled = true) => {
    const el = document.createElement(enabled ? "button" : "div");
    if (enabled) {
      el.type = "button";
      el.className =
        "profile-stat profile-stat--btn" + (profileSection === section ? " is-active" : "");
      el.addEventListener("click", () => setProfileSection(section));
    } else {
      el.className = "profile-stat";
    }
    el.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    statsEl.appendChild(el);
  };

  addStat(data.uploads, "загрузок", "posts", false);
  addStat(postsCount, "постов", "posts", true);
  if (!isAnon) {
    addStat(likedCount, "лайков", "likes", true);
    addStat(dislikedCount, "дизлайков", "dislikes", true);
    addStat(commentsCount, "комментариев", "comments", true);
    addStat(Number(user.gameScore) || 0, "очков ежедневки", null, false);
  }

  const actions = document.createElement("div");
  actions.className = "profile-hero__actions";

  if (data.isSelf && !isAnon) {
    const label = document.createElement("label");
    label.className = "btn btn--ghost profile-avatar-btn";
    label.textContent = "Сменить аватар";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.hidden = true;
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const form = new FormData();
        form.append("avatar", file);
        const res = await fetch("/api/auth/avatar", {
          method: "POST",
          credentials: "include",
          headers: apiHeaders(),
          body: form,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Ошибка аватара");
        currentUser = body.user;
        syncAuthUi();
        await loadProfile(user.username);
        setStatus("Аватар обновлён.");
        setTimeout(() => setStatus(""), 1800);
      } catch (err) {
        setStatus(err.message || "Ошибка аватара");
      }
    });
    label.appendChild(input);
    label.addEventListener("click", () => input.click());
    actions.appendChild(label);

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "btn btn--ghost";
    renameBtn.textContent = "Сменить ник";
    renameBtn.addEventListener("click", async () => {
      if (data.nextRenameAt && Date.now() < Number(data.nextRenameAt)) {
        const leftH = Math.max(
          1,
          Math.ceil((Number(data.nextRenameAt) - Date.now()) / (60 * 60 * 1000))
        );
        setStatus(`Ник можно менять раз в 3 дня. Осталось около ${leftH} ч.`);
        return;
      }
      const next = window.prompt("Новый ник (3–24, латиница/кириллица, цифры, _):", user.username);
      if (next == null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === user.username) return;
      try {
        const updated = await api("/api/auth/username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: trimmed }),
        });
        currentUser = updated.user;
        syncAuthUi();
        setStatus(`Ник изменён: @${updated.user.username}`);
        window.history.replaceState({}, "", `/u/${encodeURIComponent(updated.user.username)}`);
        await loadProfile(updated.user.username);
        setTimeout(() => setStatus(""), 2200);
      } catch (err) {
        setStatus(err.message || "Не удалось сменить ник");
      }
    });
    actions.appendChild(renameBtn);
  }

  if (data.canManageMod) {
    const modBtn = document.createElement("button");
    modBtn.type = "button";
    modBtn.className = "btn btn--ghost";
    modBtn.textContent = user.isModerator ? "Снять модера" : "Выдать модера";
    modBtn.addEventListener("click", async () => {
      try {
        const updated = await api(`/api/users/${encodeURIComponent(user.username)}/moderator`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isModerator: !user.isModerator }),
        });
        setStatus(updated.user.isModerator ? "Модерка выдана." : "Модерка снята.");
        await loadProfile(user.username);
        setTimeout(() => setStatus(""), 1800);
      } catch (err) {
        setStatus(err.message || "Ошибка");
      }
    });
    actions.appendChild(modBtn);
  }

  if (data.canModerateUser) {
    const banBtn = document.createElement("button");
    banBtn.type = "button";
    banBtn.className = "btn btn--ghost";
    banBtn.textContent = user.isBanned ? "Разбанить" : "Забанить";
    banBtn.addEventListener("click", async () => {
      try {
        let reason = "";
        if (!user.isBanned) {
          reason = window.prompt("Причина бана (необязательно):", "") || "";
        } else if (!window.confirm(`Разбанить @${user.username}?`)) {
          return;
        }
        const updated = await api(`/api/users/${encodeURIComponent(user.username)}/ban`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ banned: !user.isBanned, reason }),
        });
        setStatus(updated.user.isBanned ? "Пользователь забанен." : "Бан снят.");
        await loadProfile(user.username);
        setTimeout(() => setStatus(""), 1800);
      } catch (err) {
        setStatus(err.message || "Ошибка");
      }
    });
    actions.appendChild(banBtn);

    if (!user.isBanned) {
      const muteBtn = document.createElement("button");
      muteBtn.type = "button";
      muteBtn.className = "btn btn--ghost";
      muteBtn.textContent = user.isMuted ? "Снять мут" : "Замутить";
      muteBtn.addEventListener("click", async () => {
        try {
          if (user.isMuted) {
            if (!window.confirm(`Снять мут с @${user.username}?`)) return;
            await api(`/api/users/${encodeURIComponent(user.username)}/mute`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hours: 0 }),
            });
            setStatus("Мут снят.");
          } else {
            const choice = window.prompt(
              "Мут на сколько часов? (1 / 24 / 168 / 720)",
              "24"
            );
            if (choice == null) return;
            const hours = Number(choice);
            if (!Number.isFinite(hours) || hours <= 0) {
              setStatus("Укажите число часов больше 0");
              return;
            }
            const reason = window.prompt("Причина мута (необязательно):", "") || "";
            await api(`/api/users/${encodeURIComponent(user.username)}/mute`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hours, reason }),
            });
            setStatus(`Мут на ${hours} ч.`);
          }
          await loadProfile(user.username);
          setTimeout(() => setStatus(""), 1800);
        } catch (err) {
          setStatus(err.message || "Ошибка");
        }
      });
      actions.appendChild(muteBtn);
    }
  }

  if (actions.childNodes.length) {
    hero.appendChild(actions);
  }

  profilePanel.appendChild(hero);

  if (!isAnon) {
    const tabs = document.createElement("div");
    tabs.className = "profile-tabs";
    tabs.setAttribute("role", "tablist");
    const tabDefs = [
      { id: "posts", label: "Посты", count: postsCount },
      { id: "likes", label: "Лайки", count: likedCount },
      { id: "dislikes", label: "Дизлайки", count: dislikedCount },
      { id: "comments", label: "Комментарии", count: commentsCount },
    ];
    for (const tab of tabDefs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "profile-tab" + (profileSection === tab.id ? " is-active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", profileSection === tab.id ? "true" : "false");
      btn.innerHTML = `<span>${tab.label}</span><strong>${tab.count}</strong>`;
      btn.addEventListener("click", () => setProfileSection(tab.id));
      tabs.appendChild(btn);
    }
    profilePanel.appendChild(tabs);
  } else if (profileSection !== "posts") {
    profileSection = "posts";
  }

  renderProfileVotes(data, profileSection);
  document.title = `${name} · Файлы Трэп хаты`;
}

function formatAuditDate(ts) {
  const n = Number(ts);
  if (!n) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    }).format(new Date(n));
  } catch {
    return new Date(n).toLocaleString("ru-RU");
  }
}

function renderAudit(events) {
  if (!auditPanel) return;
  auditPanel.innerHTML = "";
  auditPanel.classList.remove("hidden");
  profilePanel.classList.add("hidden");
  authorsPanel.classList.add("hidden");
  galleryEl.closest(".gallery").classList.add("hidden");
  emptyEl.classList.add("hidden");
  categoryTitleEl.classList.remove("hidden");
  categoryTitleEl.textContent = "Журнал аудита";
  document.title = "Аудит · Файлы Трэп хаты";

  if (!events.length) {
    auditPanel.innerHTML = `<p class="empty">Пока нет записей.</p>`;
    return;
  }

  const list = document.createElement("div");
  list.className = "audit-list";

  for (const event of events) {
    const row = document.createElement("article");
    row.className = "audit-row";
    if (event.reversedAt) row.classList.add("audit-row--reversed");

    const actionLabel = AUDIT_LABELS[event.action] || event.action;
    const actor = event.actorUsername || "гость";
    const target = event.targetLabel || event.targetId || "—";
    const role = event.actorRole ? ` · ${event.actorRole}` : "";

    const head = document.createElement("div");
    head.className = "audit-row__head";
    head.innerHTML = `<strong>${actionLabel}</strong><time>${formatAuditDate(event.at)}</time>`;
    row.appendChild(head);

    const body = document.createElement("p");
    body.className = "audit-row__body";
    body.textContent = `${actor}${role} → ${target}`;
    row.appendChild(body);

    if (event.meta && event.meta.reason) {
      const reason = document.createElement("p");
      reason.className = "audit-row__meta";
      reason.textContent = `Причина: ${event.meta.reason}`;
      row.appendChild(reason);
    }

    if (event.reversedAt) {
      const note = document.createElement("p");
      note.className = "audit-row__meta";
      note.textContent = `Откатил ${event.reversedByUsername || "админ"} · ${formatAuditDate(event.reversedAt)}`;
      row.appendChild(note);
    }

    if (event.action === "item.delete" && !event.reversedAt && event.reversible) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--ghost";
      btn.textContent = "Откатить удаление";
      btn.addEventListener("click", async () => {
        try {
          await api(`/api/admin/audit/${encodeURIComponent(event.id)}/restore`, {
            method: "POST",
          });
          setStatus("Файл восстановлен.");
          await loadAudit();
          setTimeout(() => setStatus(""), 1800);
        } catch (err) {
          setStatus(err.message || "Не удалось откатить");
        }
      });
      row.appendChild(btn);
    }

    list.appendChild(row);
  }

  auditPanel.appendChild(list);
}

function renderGallery() {
  const items = filteredItems();
  galleryEl.innerHTML = "";
  galleryEl.classList.toggle(
    "gallery__wall--single",
    activeCategory === "top" || activeCategory === "date"
  );
  emptyEl.classList.toggle("hidden", items.length > 0);
  const admin = isStaff();

  for (const item of items) {
    const title = displayTitle(item);
    const type = itemType(item);
    const figure = document.createElement("figure");
    figure.className = `painting painting--${type}`;

    const frame = document.createElement("div");
    frame.className = "painting__frame";
    if (item.legendary) frame.classList.add("painting__frame--legendary");

    const mat = document.createElement("div");
    mat.className = "painting__mat";

    if (type === "audio") {
      frame.classList.add("painting__frame--media");
      const host = document.createElement("div");
      host.className = "rv-player-host";
      mat.appendChild(host);
      frame.appendChild(mat);
      if (window.RvPlayer) {
        window.RvPlayer.mount(host, {
          kind: "audio",
          src: item.url,
          title: displayTitle(item),
          compact: true,
        });
      } else {
        const audio = document.createElement("audio");
        audio.className = "audio-player";
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = item.url;
        host.appendChild(audio);
      }
    } else if (type === "video") {
      frame.classList.add("painting__frame--media");
      const host = document.createElement("div");
      host.className = "rv-player-host";
      mat.appendChild(host);
      frame.appendChild(mat);
      if (window.RvPlayer) {
        window.RvPlayer.mount(host, {
          kind: "video",
          src: item.url,
          variants: item.variants || [],
          compact: true,
        });
      } else {
        const video = document.createElement("video");
        video.className = "video-player";
        video.controls = true;
        video.preload = "metadata";
        video.playsInline = true;
        video.src = item.url;
        host.appendChild(video);
      }
    } else {
      frame.tabIndex = 0;
      frame.setAttribute("role", "link");
      frame.setAttribute("aria-label", `Открыть ${title}`);
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = title;
      img.loading = "lazy";
      mat.appendChild(img);
      frame.appendChild(mat);
      const open = () => {
        window.location.href = itemPagePath(item.id);
      };
      frame.addEventListener("click", open);
      frame.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    }

    figure.appendChild(frame);

    const caption = document.createElement("figcaption");
    const captionLink = document.createElement("a");
    captionLink.className = "painting__title-link";
    captionLink.href = itemPagePath(item.id);
    const prefix = type === "audio" ? "♪ " : type === "video" ? "▶ " : "";
    captionLink.textContent = `${prefix}${title}`;
    caption.appendChild(captionLink);

    const authorLine = document.createElement("div");
    authorLine.className = "painting__author";
    if (item.authorUsername && !item.anonymous) {
      const authorLink = document.createElement("a");
      authorLink.href = `/u/${encodeURIComponent(item.authorUsername)}`;
      authorLink.textContent = item.authorUsername;
      authorLine.appendChild(document.createTextNode("от "));
      authorLine.appendChild(authorLink);
    } else {
      authorLine.textContent = "от Аноним";
    }
    if (item.visibility === "unlisted") {
      const badge = document.createElement("span");
      badge.className = "badge-unlisted";
      badge.textContent = "ссылка";
      authorLine.appendChild(badge);
    }
    caption.appendChild(authorLine);

    const viewsLine = document.createElement("div");
    viewsLine.className = "painting__views";
    const views = Math.max(0, Number(item.views) || 0);
    const mod10 = views % 10;
    const mod100 = views % 100;
    let viewsWord = "просмотров";
    if (mod10 === 1 && mod100 !== 11) viewsWord = "просмотр";
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) viewsWord = "просмотра";
    viewsLine.textContent = `${views} ${viewsWord}`;
    caption.appendChild(viewsLine);

    if (item.tags && item.tags.length) {
      const counts = tagCountMap();
      const tagsRow = document.createElement("div");
      tagsRow.className = "painting__tags";
      for (const tag of item.tags) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tag-chip";
        fillTagChip(chip, tag, counts.get(tag));
        chip.title = `${counts.get(tag) || "?"} файлов с этим тегом`;
        chip.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          setActiveTag(tag);
        });
        tagsRow.appendChild(chip);
      }
      caption.appendChild(tagsRow);
    }

    figure.appendChild(caption);

    const actions = document.createElement("div");
    actions.className = "painting__actions";

    const pageLink = document.createElement("a");
    pageLink.className = "action-btn";
    pageLink.href = itemPagePath(item.id);
    pageLink.textContent = "Страница";
    actions.appendChild(pageLink);

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "action-btn";
    shareBtn.textContent = "Ссылка";
    shareBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = itemShareUrl(item.id);
      try {
        await navigator.clipboard.writeText(url);
        setStatus("Ссылка скопирована.");
        setTimeout(() => setStatus(""), 1600);
      } catch {
        setStatus(url);
      }
    });
    actions.appendChild(shareBtn);

    const votes = document.createElement("div");
    votes.className = "vote-group";

    const makeVoteWrap = (kind, count, voters, active) => {
      const wrap = document.createElement("div");
      wrap.className = "vote-wrap";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `vote-btn vote-btn--${kind}${active ? " is-active" : ""}`;
      btn.setAttribute("aria-label", kind === "like" ? "Лайк" : "Дизлайк");
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.innerHTML = `<span aria-hidden="true">${kind === "like" ? "▲" : "▼"}</span><span class="vote-btn__count">${Number(count) || 0}</span>`;

      const tip = document.createElement("div");
      tip.className = "vote-tip";
      tip.hidden = true;

      const renderTip = (list) => {
        tip.innerHTML = "";
        if (!list || !list.length) {
          tip.innerHTML = `<p class="vote-tip__empty">Пока никто</p>`;
          return;
        }
        const ul = document.createElement("ul");
        ul.className = "vote-tip__list";
        for (const voter of list) {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = `/u/${encodeURIComponent(voter.username)}`;
          a.className = "vote-tip__user";
          if (voter.avatarUrl) {
            const img = document.createElement("img");
            img.src = voter.avatarUrl;
            img.alt = "";
            a.appendChild(img);
          } else {
            const ph = document.createElement("span");
            ph.className = "vote-tip__avatar";
            ph.textContent = voter.username.slice(0, 1).toUpperCase();
            a.appendChild(ph);
          }
          const name = document.createElement("span");
          name.textContent = voter.username;
          a.appendChild(name);
          li.appendChild(a);
          ul.appendChild(li);
        }
        tip.appendChild(ul);
      };

      renderTip(voters);

      const canHover =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (canHover) {
        wrap.addEventListener("mouseenter", () => {
          tip.hidden = false;
        });
        wrap.addEventListener("mouseleave", () => {
          tip.hidden = true;
        });
        wrap.addEventListener("focusin", () => {
          tip.hidden = false;
        });
        wrap.addEventListener("focusout", (e) => {
          if (!wrap.contains(e.relatedTarget)) tip.hidden = true;
        });
      }

      wrap.appendChild(btn);
      wrap.appendChild(tip);
      return { wrap, btn, tip, renderTip };
    };

    const likeUi = makeVoteWrap("like", item.likes, item.likedBy, item.myVote === "like");
    const dislikeUi = makeVoteWrap("dislike", item.dislikes, item.dislikedBy, item.myVote === "dislike");

    const applyVoteState = (result) => {
      item.likes = result.likes;
      item.dislikes = result.dislikes;
      item.myVote = result.myVote;
      item.likedBy = result.likedBy || [];
      item.dislikedBy = result.dislikedBy || [];
      likeUi.btn.querySelector(".vote-btn__count").textContent = String(result.likes);
      dislikeUi.btn.querySelector(".vote-btn__count").textContent = String(result.dislikes);
      likeUi.btn.classList.toggle("is-active", result.myVote === "like");
      dislikeUi.btn.classList.toggle("is-active", result.myVote === "dislike");
      likeUi.btn.setAttribute("aria-pressed", result.myVote === "like" ? "true" : "false");
      dislikeUi.btn.setAttribute("aria-pressed", result.myVote === "dislike" ? "true" : "false");
      likeUi.renderTip(item.likedBy);
      dislikeUi.renderTip(item.dislikedBy);
    };

    const castVote = async (vote) => {
      if (!currentUser) {
        setStatus("Войдите, чтобы голосовать");
        setAuthMode("login");
        authDialog.showModal();
        authUsername.focus();
        return;
      }
      if (castVote.busy) return;
      castVote.busy = true;

      const prev = {
        likes: Number(item.likes) || 0,
        dislikes: Number(item.dislikes) || 0,
        myVote: item.myVote || null,
        likedBy: item.likedBy || [],
        dislikedBy: item.dislikedBy || [],
      };
      let nextLikes = prev.likes;
      let nextDislikes = prev.dislikes;
      let nextVote = prev.myVote;
      if (prev.myVote === vote) {
        nextVote = null;
        if (vote === "like") nextLikes = Math.max(0, nextLikes - 1);
        else nextDislikes = Math.max(0, nextDislikes - 1);
      } else {
        if (prev.myVote === "like") nextLikes = Math.max(0, nextLikes - 1);
        if (prev.myVote === "dislike") nextDislikes = Math.max(0, nextDislikes - 1);
        nextVote = vote;
        if (vote === "like") nextLikes += 1;
        else nextDislikes += 1;
      }
      applyVoteState({
        likes: nextLikes,
        dislikes: nextDislikes,
        myVote: nextVote,
        likedBy: prev.likedBy,
        dislikedBy: prev.dislikedBy,
      });
      const pulseBtn = vote === "like" ? likeUi.btn : dislikeUi.btn;
      pulseBtn.classList.remove("is-pulse");
      void pulseBtn.offsetWidth;
      pulseBtn.classList.add("is-pulse");

      try {
        const result = await api(`/api/items/${encodeURIComponent(item.id)}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote }),
        });
        applyVoteState(result);
        if (result.myVote === "like") rememberItemInterest(item, 3);
        else if (result.myVote === "dislike") rememberItemInterest(item, -1);
      } catch (err) {
        applyVoteState(prev);
        setStatus(err.message || "Ошибка голоса");
      } finally {
        castVote.busy = false;
      }
    };
    castVote.busy = false;

    likeUi.btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await castVote("like");
    });

    dislikeUi.btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await castVote("dislike");
    });

    votes.appendChild(likeUi.wrap);
    votes.appendChild(dislikeUi.wrap);
    actions.appendChild(votes);

    const download = document.createElement("a");
    download.className = "action-btn";
    download.href = `/api/download/${encodeURIComponent(item.id)}`;
    download.setAttribute("download", "");
    download.textContent = "Скачать";
    actions.appendChild(download);

    figure.appendChild(actions);
    galleryEl.appendChild(figure);
  }
}

function shuffle(items) {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

function syncCategoryUi() {
  document.querySelectorAll(".cat-btn").forEach((btn) => {
    const cat = btn.dataset.cat;
    const active =
      viewMode === "profile"
        ? false
        : viewMode === "authors"
          ? cat === "authors"
          : viewMode === "audit"
            ? cat === "audit"
            : cat === activeCategory;
    btn.classList.toggle("is-active", active);
  });
}

function renderTagBar() {
  if (!tagBar) return;
  const show = viewMode === "gallery" && popularTags.length > 0;
  tagBar.classList.toggle("hidden", !show);
  if (!show) {
    tagBar.innerHTML = "";
    return;
  }
  tagBar.innerHTML = "";
  const label = document.createElement("span");
  label.className = "tag-bar__label";
  label.textContent = "Теги";
  tagBar.appendChild(label);

  if (activeTag) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "tag-chip tag-chip--active";
    const activeEntry = popularTags.find((x) => x.tag === activeTag);
    fillTagChip(clear, activeTag, activeEntry && activeEntry.count, "×");
    clear.addEventListener("click", () => setActiveTag(""));
    tagBar.appendChild(clear);
  }

  for (const entry of popularTags) {
    if (entry.tag === activeTag) continue;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-chip";
    fillTagChip(chip, entry.tag, entry.count);
    chip.title = `${entry.count} файлов`;
    chip.addEventListener("click", () => setActiveTag(entry.tag));
    tagBar.appendChild(chip);
  }
}

function setActiveTag(tag) {
  activeTag = String(tag || "").trim().toLowerCase();
  const url = new URL(window.location.href);
  if (activeTag) url.searchParams.set("tag", activeTag);
  else url.searchParams.delete("tag");
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  renderTagBar();
  renderCurrentView();
  setStatus(activeTag ? `Фильтр по тегу #${activeTag}` : "");
  if (activeTag) setTimeout(() => setStatus(""), 1600);
}

function renderCurrentView() {
  syncCategoryUi();
  if (viewMode === "authors" || viewMode === "audit") {
    if (tagBar) tagBar.classList.add("hidden");
    return;
  }
  if (viewMode === "profile") {
    galleryEl.closest(".gallery").classList.remove("hidden");
    authorsPanel.classList.add("hidden");
    if (auditPanel) auditPanel.classList.add("hidden");
    if (tagBar) tagBar.classList.add("hidden");
    const showPosts = profileSection === "posts";
    galleryEl.closest(".gallery").classList.toggle("hidden", !showPosts);
    emptyEl.classList.toggle("hidden", true);
    if (showPosts) {
      renderGallery();
    } else {
      galleryEl.innerHTML = "";
    }
    return;
  }
  profilePanel.classList.add("hidden");
  authorsPanel.classList.add("hidden");
  if (auditPanel) auditPanel.classList.add("hidden");
  galleryEl.closest(".gallery").classList.remove("hidden");

  const label = CAT_LABELS[activeCategory] || "Все";
  if (activeCategory === "all" && !activeTag) {
    categoryTitleEl.classList.add("hidden");
    categoryTitleEl.textContent = "";
    document.title = "Файлы Трэп хаты";
  } else {
    categoryTitleEl.classList.remove("hidden");
    categoryTitleEl.textContent = activeTag
      ? `${label} · #${activeTag}`
      : activeCategory === "all"
        ? "Рекомендации"
        : label;
    document.title = `${categoryTitleEl.textContent} · Файлы Трэп хаты`;
  }
  renderTagBar();
  renderGallery();
}

async function loadGalleryItems() {
  const mine = activeCategory === "mine";
  const url = mine ? "/api/items?mine=1" : "/api/items";
  const items = await api(url);
  allItems = items;
  if (activeCategory === "all") {
    allItems = recommendSort(items);
  } else if (!(mine || activeCategory === "top" || activeCategory === "date")) {
    // keep API order for type filters; recommendations only on "all"
  }
  updateStorageStats();
  renderCurrentView();
}

async function loadPopularTags() {
  try {
    const data = await api("/api/tags");
    popularTags = data.tags || [];
  } catch {
    popularTags = [];
  }
  renderTagBar();
}

async function loadAuthors() {
  viewMode = "authors";
  activeCategory = "authors";
  if (auditPanel) auditPanel.classList.add("hidden");
  const list = await api("/api/users/top");
  storageStatsEl.textContent = list.length
    ? `${list.length} ${
        list.length % 10 === 1 && list.length % 100 !== 11
          ? "пользователь"
          : list.length % 10 >= 2 &&
              list.length % 10 <= 4 &&
              (list.length % 100 < 10 || list.length % 100 >= 20)
            ? "пользователя"
            : "пользователей"
      } в топе`
    : "Пользователей пока нет";
  renderAuthors(list);
  syncCategoryUi();
}

async function loadAudit() {
  if (!isAdmin()) {
    window.location.href = "/";
    return;
  }
  viewMode = "audit";
  activeCategory = "audit";
  const data = await api("/api/admin/audit?limit=150");
  storageStatsEl.textContent = `${(data.events || []).length} записей аудита`;
  renderAudit(data.events || []);
  syncCategoryUi();
}

async function loadProfile(username) {
  viewMode = "profile";
  if (auditPanel) auditPanel.classList.add("hidden");
  const data = await api(`/api/users/${encodeURIComponent(username)}`);
  profileUser = data.user;
  profileData = data;
  if (data.isAnonymousProfile || (data.user && data.user.isAnonymousProfile)) {
    profileSection = "posts";
  }
  allItems = data.items;
  updateStorageStats();
  renderProfileHeader(data);
  renderCurrentView();
}

async function refreshView() {
  if (viewMode === "authors") {
    await loadAuthors();
    return;
  }
  if (viewMode === "audit") {
    await loadAudit();
    return;
  }
  if (viewMode === "profile" && profileUser) {
    await loadProfile(profileUser.username);
    await loadPopularTags();
    return;
  }
  await loadGalleryItems();
  await loadPopularTags();
}

async function loadMe() {
  try {
    const data = await api("/api/auth/me");
    currentUser = data.user || null;
  } catch {
    currentUser = null;
  }
  syncThemeFromUser(currentUser);
  syncAuthUi();
}

async function uploadMedia(file, title) {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);

  if (currentUser) {
    const as = (uploadForm.querySelector('input[name="upload-as"]:checked') || {}).value || "named";
    form.append("anonymous", as === "anonymous" ? "1" : "0");
    form.append("visibility", uploadUnlisted.checked ? "unlisted" : "public");
  } else {
    form.append("anonymous", "1");
    form.append("visibility", "public");
  }
  if (uploadTags && uploadTags.value.trim()) {
    form.append("tags", uploadTags.value.trim());
  }

  setStatus("Загрузка…");
  setUploadProgress(0, true);

  const data = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.setRequestHeader("X-Voter-Id", getVoterId());

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        setStatus("Загрузка…");
        return;
      }
      const percent = (event.loaded / event.total) * 100;
      setUploadProgress(percent, true);
      setStatus(`Загрузка… ${Math.round(percent)}%`);
    });

    xhr.addEventListener("load", () => {
      const body = xhr.response && typeof xhr.response === "object"
        ? xhr.response
        : (() => {
            try {
              return JSON.parse(xhr.responseText || "{}");
            } catch {
              return {};
            }
          })();

      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress(100, true);
        resolve(body);
        return;
      }
      reject(new Error((body && body.error) || "Ошибка загрузки"));
    });

    xhr.addEventListener("error", () => reject(new Error("Сеть недоступна")));
    xhr.addEventListener("abort", () => reject(new Error("Загрузка отменена")));
    xhr.send(form);
  }).finally(() => {
    setTimeout(() => setUploadProgress(0, false), 400);
  });

  const kind = KIND_LABEL[data.type] || "файл";
  setStatus(`Готово — ${kind} на стене.`);
  if (data.visibility === "unlisted") {
    setStatus(`Готово — только по ссылке: ${itemShareUrl(data.id)}`);
  }
  await refreshView();
  setTimeout(() => setStatus(""), 2500);
}

function formatUploadBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function syncUploadFilePick() {
  if (!uploadFilePick) return;
  const file = uploadFileInput && uploadFileInput.files && uploadFileInput.files[0];
  const titleEl = uploadFilePick.querySelector(".file-pick__title");
  const btnEl = uploadFilePick.querySelector(".file-pick__btn");
  if (!file) {
    uploadFilePick.classList.remove("has-file");
    if (titleEl) titleEl.textContent = "Выберите файл";
    if (btnEl) btnEl.textContent = "Обзор";
    if (uploadFileMeta) {
      uploadFileMeta.hidden = true;
      uploadFileMeta.textContent = "";
    }
    return;
  }
  uploadFilePick.classList.add("has-file");
  if (titleEl) titleEl.textContent = file.name;
  if (btnEl) btnEl.textContent = "Заменить";
  if (uploadFileMeta) {
    uploadFileMeta.hidden = false;
    uploadFileMeta.textContent = formatUploadBytes(file.size);
  }
}

if (uploadFileInput && uploadFilePick) {
  uploadFileInput.addEventListener("change", syncUploadFilePick);
  ["dragenter", "dragover"].forEach((type) => {
    uploadFilePick.addEventListener(type, (e) => {
      e.preventDefault();
      uploadFilePick.classList.add("is-dragover");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    uploadFilePick.addEventListener(type, (e) => {
      e.preventDefault();
      uploadFilePick.classList.remove("is-dragover");
    });
  });
}

document.getElementById("open-upload").addEventListener("click", () => {
  uploadForm.reset();
  syncUploadFilePick();
  if (currentUser) {
    const named = uploadForm.querySelector('input[name="upload-as"][value="named"]');
    if (named) named.checked = true;
  }
  syncUploadLimitHint();
  uploadDialog.showModal();
  uploadTitle.focus();
});

document.getElementById("random-file").addEventListener("click", async () => {
  const btn = document.getElementById("random-file");
  try {
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-rolling");
    }
    setStatus("Крутим барабан…");
    const data = await api("/api/random");
    setStatus("Лови!");
    window.location.href = data.url || itemPagePath(data.id);
  } catch (err) {
    setStatus(err.message || "Пока пусто");
    setTimeout(() => setStatus(""), 2000);
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("is-rolling");
    }
  }
});

document.getElementById("reshuffle").addEventListener("click", () => {
  if (viewMode !== "gallery" || activeCategory === "authors" || activeCategory === "mine" || activeCategory === "audit") {
    window.location.href = "/";
    return;
  }
  if (activeCategory === "top" || activeCategory === "date") {
    window.location.href = "/";
    return;
  }
  recommendSeed = Date.now();
  if (activeCategory === "all") {
    allItems = recommendSort(allItems, recommendSeed);
  } else {
    allItems = shuffle(allItems);
  }
  renderGallery();
  setStatus(activeCategory === "all" ? "Рекомендации обновлены." : "Порядок обновлён.");
  setTimeout(() => setStatus(""), 1500);
});

document.getElementById("upload-cancel").addEventListener("click", () => {
  uploadDialog.close();
});

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = uploadFileInput.files && uploadFileInput.files[0];
  const title = uploadTitle.value.trim();
  if (!file || !title) return;
  const limit = uploadLimitBytes();
  if (file.size > limit) {
    setStatus(`Файл слишком большой. Максимум ${uploadLimitLabel()}.`);
    return;
  }
  uploadDialog.close();
  try {
    await uploadMedia(file, title);
  } catch (err) {
    setStatus(err.message || "Ошибка");
  }
});

function setAuthError(text) {
  if (!authError) return;
  if (text) {
    authError.textContent = text;
    authError.classList.remove("hidden");
  } else {
    authError.textContent = "";
    authError.classList.add("hidden");
  }
}

function setAuthMode(mode) {
  authMode = mode === "register" ? "register" : "login";
  const isRegister = authMode === "register";
  if (authTitle) authTitle.textContent = isRegister ? "Регистрация" : "Вход";
  if (authHint) {
    authHint.textContent = isRegister
      ? "Придумайте ник и пароль. Ник: латиница или кириллица, цифры и _, 3–24 символа. Пароль от 6 символов."
      : "Войдите в аккаунт. Ник: латиница или кириллица, цифры и _.";
  }
  if (authPassword2Field) authPassword2Field.classList.toggle("hidden", !isRegister);
  if (authPassword2) {
    authPassword2.required = isRegister;
    authPassword2.value = "";
  }
  if (authPassword) {
    authPassword.autocomplete = isRegister ? "new-password" : "current-password";
  }
  if (authSwitchBtn) authSwitchBtn.textContent = isRegister ? "У меня есть аккаунт" : "Создать аккаунт";
  if (authSubmitBtn) authSubmitBtn.textContent = isRegister ? "Зарегистрироваться" : "Войти";
  if (authUsernameStatus) authUsernameStatus.textContent = "";
  setAuthError("");
}

async function checkUsernameLive() {
  if (!authUsernameStatus) return;
  const value = authUsername.value.trim();
  if (!value || authMode !== "register") {
    authUsernameStatus.textContent = "";
    authUsernameStatus.className = "field-status";
    return;
  }
  try {
    const data = await api(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
    if (data.available) {
      authUsernameStatus.textContent = "Ник свободен";
      authUsernameStatus.className = "field-status field-status--ok";
    } else {
      authUsernameStatus.textContent = data.error || "Ник занят";
      authUsernameStatus.className = "field-status field-status--bad";
    }
  } catch (err) {
    authUsernameStatus.textContent = err.message || "";
    authUsernameStatus.className = "field-status field-status--bad";
  }
}

openAuthBtn.addEventListener("click", () => {
  authForm.reset();
  setAuthMode("login");
  authDialog.showModal();
  authUsername.focus();
});

document.getElementById("auth-cancel").addEventListener("click", () => {
  authDialog.close();
});

if (authSwitchBtn) {
  authSwitchBtn.addEventListener("click", () => {
    setAuthMode(authMode === "register" ? "login" : "register");
    authUsername.focus();
  });
}

if (authUsername) {
  authUsername.addEventListener("input", () => {
    if (usernameCheckTimer) clearTimeout(usernameCheckTimer);
    usernameCheckTimer = setTimeout(() => {
      checkUsernameLive();
    }, 350);
  });
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  const username = authUsername.value.trim();
  const password = authPassword.value;
  if (!username || !password) {
    setAuthError("Заполните ник и пароль");
    return;
  }

  if (authMode === "register") {
    const password2 = authPassword2 ? authPassword2.value : "";
    if (password !== password2) {
      setAuthError("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      setAuthError("Пароль минимум 6 символов");
      return;
    }
    try {
      if (authSubmitBtn) authSubmitBtn.disabled = true;
      const data = await api("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          passwordConfirm: password2,
        }),
      });
      currentUser = data.user;
      syncThemeFromUser(currentUser);
      syncAuthUi();
      authDialog.close();
      setStatus(`Аккаунт @${currentUser.username} создан. Добро пожаловать!`);
      await refreshView();
      setTimeout(() => setStatus(""), 2500);
    } catch (err) {
      setAuthError(err.message || "Ошибка регистрации");
    } finally {
      if (authSubmitBtn) authSubmitBtn.disabled = false;
    }
    return;
  }

  try {
    if (authSubmitBtn) authSubmitBtn.disabled = true;
    const data = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    currentUser = data.user;
    syncThemeFromUser(currentUser);
    syncAuthUi();
    authDialog.close();
    setStatus(`Привет, ${currentUser.username}`);
    await refreshView();
    setTimeout(() => setStatus(""), 2000);
  } catch (err) {
    setAuthError(err.message || "Ошибка входа");
  } finally {
    if (authSubmitBtn) authSubmitBtn.disabled = false;
  }
});

if (openSettingsBtn) {
  openSettingsBtn.addEventListener("click", () => openSettings());
}
if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener("click", () => {
    if (settingsDialog) settingsDialog.close();
  });
}

logoutUserBtn.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  currentUser = null;
  syncThemeFromUser(null);
  syncAuthUi();
  setStatus("Вы вышли.");
  if (activeCategory === "mine") {
    window.location.href = "/";
    return;
  }
  await refreshView();
  setTimeout(() => setStatus(""), 1600);
});

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox || e.target.classList.contains("lightbox__close")) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
});

if (tagsForm) tagsForm.addEventListener("submit", saveTagsEditor);
if (tagsCancel) tagsCancel.addEventListener("click", () => closeTagsEditor());
wireTagSuggest(tagsInput, document.getElementById("tags-input-suggest"), {
  onChange: renderTagsPreview,
});
wireTagSuggest(uploadTags, document.getElementById("upload-tags-suggest"));

(async function boot() {
  await loadMe();
  activeTag = tagFromQuery();
  await loadPopularTags();
  const profileName = profileFromPath();
  if (profileName) {
    try {
      await loadProfile(profileName);
    } catch (err) {
      setStatus(err.message || "Профиль не найден");
      profilePanel.innerHTML = `<p class="empty">${err.message || "Профиль не найден"}</p>`;
      profilePanel.classList.remove("hidden");
      galleryEl.closest(".gallery").classList.add("hidden");
    }
    return;
  }

  activeCategory = categoryFromPath();
  if (activeCategory === "authors") {
    try {
      await loadAuthors();
    } catch (err) {
      setStatus(err.message || "Не удалось загрузить авторов");
    }
    return;
  }

  if (activeCategory === "audit") {
    try {
      await loadAudit();
    } catch (err) {
      setStatus(err.message || "Нет доступа к аудиту");
      window.location.href = "/";
    }
    return;
  }

  if (activeCategory === "mine" && !currentUser) {
    window.location.href = "/";
    return;
  }

  viewMode = "gallery";
  try {
    await loadGalleryItems();
  } catch {
    setStatus("Не удалось загрузить галерею");
  }
})();
