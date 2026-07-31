const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { createAuth } = require("./auth");

const PORT = Number(process.env.PORT || 3010);
const PUBLIC_URL = String(process.env.PUBLIC_URL || "https://rasmusvraa.site").replace(/\/$/, "");
const ROOT = __dirname;
const UPLOADS = path.join(ROOT, "uploads");
const META_FILE = path.join(UPLOADS, "meta.json");
const VOTES_FILE = path.join(UPLOADS, "votes.json");
const VIEWS_FILE = path.join(UPLOADS, "views.json");
const AUDIT_FILE = path.join(UPLOADS, "audit.json");
const COMMENTS_FILE = path.join(UPLOADS, "comments.json");
const GAME_HISTORY_FILE = path.join(UPLOADS, "game-history.json");
const COMMENT_MAX_LEN = 500;
const AUDIT_MAX = 2000;
const VIEW_COOKIE = "rv_iv";
const VIEW_DEDUP_MS = 15 * 60 * 1000;
/** Never-shown items get this virtual age so they win over recently shown ones. */
const GAME_NEVER_SHOWN_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".opus"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi", ".ogv"]);

const UPLOAD_LIMITS = {
  guest: 200 * 1024 * 1024,
  user: 500 * 1024 * 1024,
  moderator: 1024 * 1024 * 1024,
  admin: Math.round(1.5 * 1024 * 1024 * 1024),
};

function uploadLimitForUser(user) {
  if (auth.userIsAdmin(user)) return UPLOAD_LIMITS.admin;
  if (auth.userIsModerator(user)) return UPLOAD_LIMITS.moderator;
  if (user) return UPLOAD_LIMITS.user;
  return UPLOAD_LIMITS.guest;
}

function formatUploadLimit(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024 * 1024) {
    const gb = n / (1024 * 1024 * 1024);
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} ГБ`;
  }
  return `${Math.round(n / (1024 * 1024))} МБ`;
}

fs.mkdirSync(UPLOADS, { recursive: true });

const auth = createAuth({
  uploadsDir: UPLOADS,
  sessionSecret: process.env.SESSION_SECRET || "",
  adminUsernames: String(process.env.SITE_ADMINS || "RasmusVraa")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
});

(() => {
  const marker = path.join(UPLOADS, ".game-score-reset-20260731");
  if (fs.existsSync(marker)) return;
  try {
    const result = auth.resetAllGameScores();
    fs.writeFileSync(marker, `${new Date().toISOString()} changed=${result.changed}\n`);
    console.log(`[game] reset scores for ${result.changed}/${result.total} users`);
  } catch (err) {
    console.error("[game] score reset failed", err);
  }
})();

function loadMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveMeta(items) {
  fs.writeFileSync(META_FILE, JSON.stringify(items, null, 2), "utf8");
}

function loadVotes() {
  try {
    return JSON.parse(fs.readFileSync(VOTES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveVotes(votes) {
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2), "utf8");
}

function loadViews() {
  try {
    const data = JSON.parse(fs.readFileSync(VIEWS_FILE, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function saveViews(views) {
  fs.writeFileSync(VIEWS_FILE, JSON.stringify(views, null, 2), "utf8");
}

function getItemViews(itemId) {
  const views = loadViews();
  return Math.max(0, Number(views[itemId]) || 0);
}

function parseRequestCookies(req) {
  const header = String(req.headers.cookie || "");
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function bumpItemViews(req, res, itemId) {
  const now = Date.now();
  const cookies = parseRequestCookies(req);
  const seen = new Map();
  for (const part of String(cookies[VIEW_COOKIE] || "").split(",")) {
    const [id, tsRaw] = part.split(".");
    const ts = Number(tsRaw);
    if (!id || !Number.isFinite(ts)) continue;
    if (now - ts < VIEW_DEDUP_MS) seen.set(id, ts);
  }
  let counted = false;
  if (!seen.has(itemId)) {
    const views = loadViews();
    views[itemId] = Math.max(0, Number(views[itemId]) || 0) + 1;
    saveViews(views);
    seen.set(itemId, now);
    counted = true;
  }
  const serialized = [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([id, ts]) => `${id}.${ts}`)
    .join(",");
  res.append(
    "Set-Cookie",
    `${VIEW_COOKIE}=${encodeURIComponent(serialized)}; Path=/; Max-Age=${60 * 60 * 24}; SameSite=Lax`
  );
  return { views: getItemViews(itemId), counted };
}

function formatViewCount(n) {
  const v = Math.max(0, Number(n) || 0);
  const mod10 = v % 10;
  const mod100 = v % 100;
  let word = "просмотров";
  if (mod10 === 1 && mod100 !== 11) word = "просмотр";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = "просмотра";
  return `${v} ${word}`;
}

function loadAudit() {
  try {
    const data = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveAudit(events) {
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(events.slice(0, AUDIT_MAX), null, 2), "utf8");
}

function actorRole(user) {
  if (!user) return "guest";
  if (auth.userIsAdmin(user)) return "admin";
  if (auth.userIsModerator(user)) return "moderator";
  return "user";
}

function writeAudit(action, actor, extra = {}) {
  const events = loadAudit();
  const event = {
    id: `a_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`,
    at: Date.now(),
    action,
    actorId: actor && actor.id ? actor.id : null,
    actorUsername: actor && actor.username ? actor.username : null,
    actorRole: actorRole(actor),
    reversible: Boolean(extra.reversible),
    reversedAt: null,
    reversedById: null,
    reversedByUsername: null,
    ...extra,
  };
  events.unshift(event);
  saveAudit(events);
  return event;
}

function loadCommentsStore() {
  try {
    const data = JSON.parse(fs.readFileSync(COMMENTS_FILE, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveCommentsStore(store) {
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function commentsForItem(itemId) {
  const list = loadCommentsStore()[itemId] || [];
  return Array.isArray(list)
    ? list.slice().sort((a, b) => a.createdAt - b.createdAt)
    : [];
}

function sanitizeComment(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, COMMENT_MAX_LEN);
}

function isDeletedItem(item) {
  return Boolean(item && item.deletedAt);
}

function isAnonymousItem(item) {
  return Boolean(item && (item.anonymous || !item.authorUsername));
}

function muteBlockMessage(user) {
  if (!auth.userIsMuted(user)) return null;
  const until = Number(user.mutedUntil);
  const when = until
    ? formatUploadDate(until) || new Date(until).toLocaleString("ru-RU")
    : "";
  return when ? `Вы в муте до ${when}` : "Вы в муте";
}

function countVotes(itemVotes) {
  let likes = 0;
  let dislikes = 0;
  for (const value of Object.values(itemVotes || {})) {
    if (value === "like") likes += 1;
    if (value === "dislike") dislikes += 1;
  }
  return { likes, dislikes };
}

function voteVoters(itemVotes, kind) {
  const usersById = new Map(auth.loadUsers().map((u) => [u.id, u]));
  const list = [];
  for (const [userId, value] of Object.entries(itemVotes || {})) {
    if (value !== kind) continue;
    const user = usersById.get(userId);
    if (!user) continue;
    list.push({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl || null,
    });
  }
  list.sort((a, b) => a.username.localeCompare(b.username, "en"));
  return list;
}

function sanitizeTitle(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

const TAG_MAX = 8;
const TAG_LEN = 24;

function sanitizeTag(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё_-]+/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, TAG_LEN);
  if (raw.length < 2) return "";
  return raw;
}

function sanitizeTags(input) {
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === "string") {
    list = input.split(/[,;\n]+/);
  }
  const out = [];
  const seen = new Set();
  for (const part of list) {
    const tag = sanitizeTag(part);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= TAG_MAX) break;
  }
  return out;
}

function detectKind(file) {
  const ext = path.extname(file.originalname || file.filename || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();

  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";

  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === ".webm") return "video";
  if (ext === ".ogg") return "audio";
  return null;
}

function pickExt(file, kind) {
  const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 10);
  if (kind === "video") return VIDEO_EXTS.has(ext) || ext === ".webm" ? ext || ".mp4" : ".mp4";
  if (kind === "audio") return AUDIO_EXTS.has(ext) || ext === ".ogg" ? ext || ".mp3" : ".mp3";
  return IMAGE_EXTS.has(ext) ? ext : ".jpg";
}

function defaultDownloadName(type) {
  if (type === "audio") return "track";
  if (type === "video") return "video";
  return "painting";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mimeForFilename(filename, type) {
  const ext = path.extname(filename || "").toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".opus": "audio/opus",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".m4v": "video/mp4",
    ".avi": "video/x-msvideo",
    ".ogv": "video/ogg",
  };
  if (map[ext]) return map[ext];
  if (type === "audio") return "audio/mpeg";
  if (type === "video") return "video/mp4";
  return "image/jpeg";
}

function absoluteUrl(pathname) {
  if (!pathname) return PUBLIC_URL;
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${PUBLIC_URL}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}

function fileByteSize(filename) {
  try {
    return fs.statSync(path.join(UPLOADS, filename)).size;
  } catch {
    return 0;
  }
}

function shuffleList(items) {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

function pickRelated(items, current, limit = 8) {
  const currentType = current.type || "image";
  const currentTags = new Set(sanitizeTags(current.tags || []));
  const rest = items.filter(
    (x) =>
      x.id !== current.id &&
      !isDeletedItem(x) &&
      (x.visibility || "public") !== "unlisted"
  );

  function tagOverlap(item) {
    const tags = sanitizeTags(item.tags || []);
    let n = 0;
    for (const t of tags) if (currentTags.has(t)) n += 1;
    return n;
  }

  const scored = rest
    .map((item) => {
      const sameType = (item.type || "image") === currentType ? 8 : 0;
      const tags = tagOverlap(item) * 12;
      const legend = item.legendary ? 4 : 0;
      const noise = Math.random() * 3;
      return { item, score: sameType + tags + legend + noise };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((x) => x.item);
}

function relatedCardHtml(item) {
  const type = item.type || "image";
  const title = sanitizeTitle(item.title) || item.originalName || "Без названия";
  const href = `/i/${encodeURIComponent(item.id)}`;
  const safeTitle = escapeHtml(title);
  let thumb = "";
  if (type === "image") {
    thumb = `<img src="${escapeHtml(item.url)}" alt="" loading="lazy" />`;
  } else if (type === "video") {
    thumb = `<div class="related__thumb related__thumb--video" aria-hidden="true">▶</div>`;
  } else {
    thumb = `<div class="related__thumb related__thumb--audio" aria-hidden="true">♪</div>`;
  }
  const prefix = type === "audio" ? "♪ " : type === "video" ? "▶ " : "";
  return `<a class="related__card" href="${href}">
      <div class="related__media">${thumb}</div>
      <span class="related__title">${prefix}${safeTitle}</span>
    </a>`;
}

function withQuery(url, params) {
  const u = new URL(url, PUBLIC_URL);
  for (const [key, value] of Object.entries(params || {})) {
    if (value == null || value === "") continue;
    u.searchParams.set(key, String(value));
  }
  return u.toString();
}

function probeImageSize(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(131072);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const data = buf.subarray(0, bytes);

    if (data.length >= 24 && data[0] === 0x89 && data[1] === 0x50) {
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }
    if (data.length >= 10 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
      return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
    }
    if (data.length > 12 && data[0] === 0xff && data[1] === 0xd8) {
      let i = 2;
      while (i < data.length - 8) {
        if (data[i] !== 0xff) {
          i += 1;
          continue;
        }
        const marker = data[i + 1];
        if (marker === 0xd8 || marker === 0xd9) {
          i += 2;
          continue;
        }
        const len = data.readUInt16BE(i + 2);
        if (len < 2) break;
        if (marker >= 0xc0 && marker <= 0xc3) {
          return {
            height: data.readUInt16BE(i + 5),
            width: data.readUInt16BE(i + 7),
          };
        }
        i += 2 + len;
      }
    }
    if (
      data.length >= 30 &&
      data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP"
    ) {
      const kind = data.toString("ascii", 12, 16);
      if (kind === "VP8 " && data.length >= 30) {
        return {
          width: data.readUInt16LE(26) & 0x3fff,
          height: data.readUInt16LE(28) & 0x3fff,
        };
      }
      if (kind === "VP8L" && data.length >= 25) {
        const bits = data.readUInt32LE(21);
        return {
          width: (bits & 0x3fff) + 1,
          height: ((bits >> 14) & 0x3fff) + 1,
        };
      }
      if (kind === "VP8X" && data.length >= 30) {
        return {
          width: 1 + data[24] + (data[25] << 8) + (data[26] << 16),
          height: 1 + data[27] + (data[28] << 8) + (data[29] << 16),
        };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function formatUploadDate(createdAt) {
  const ts = Number(createdAt);
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString("ru-RU");
  }
}

function renderItemPage(item, related) {
  const type = item.type || "image";
  const title = sanitizeTitle(item.title) || item.originalName || "Без названия";
  const pageUrl = absoluteUrl(`/i/${encodeURIComponent(item.id)}`);
  const mediaUrl = absoluteUrl(item.url);
  const mime = mimeForFilename(item.filename, type);
  const safeTitle = escapeHtml(title);
  const siteName = "Файлы Трэп хаты";
  const typeLabel = type === "audio" ? "аудио" : type === "video" ? "видео" : "фото";
  const uploadedAt = formatUploadDate(item.createdAt);
  const description = uploadedAt
    ? `${siteName} — ${typeLabel}. Загружено ${uploadedAt}`
    : `${siteName} — ${typeLabel}`;
  const filePath = path.join(UPLOADS, item.filename);
  const bust = String(item.createdAt || Date.now());
  const ogImageUrl = withQuery(mediaUrl, { v: bust });
  const size = type === "image" ? probeImageSize(filePath) : null;
  const sizeMeta = size
    ? `
    <meta property="og:image:width" content="${size.width}" />
    <meta property="og:image:height" content="${size.height}" />`
    : "";

  const isAnonymous = isAnonymousItem(item);
  const authorUser = !isAnonymous && item.authorUsername
    ? auth.findUserByUsername(item.authorUsername)
    : null;
  const authorLabel = isAnonymous
    ? auth.ANONYMOUS_DISPLAY
    : item.authorUsername || auth.ANONYMOUS_DISPLAY;
  const authorHtml = isAnonymous
    ? `<p class="item-author"><span class="item-author__label">От</span> <a class="item-author__link" href="/u/${encodeURIComponent(auth.ANONYMOUS_USERNAME)}">${escapeHtml(auth.ANONYMOUS_DISPLAY)}</a></p>`
    : `<p class="item-author"><span class="item-author__label">От</span> <a class="item-author__link" href="/u/${encodeURIComponent(item.authorUsername)}">${
        authorUser && authorUser.avatarUrl
          ? `<img class="item-author__avatar" src="${escapeHtml(authorUser.avatarUrl)}" alt="" />`
          : ""
      }${escapeHtml(authorLabel)}</a></p>`;

  let ogExtras = "";
  let mediaHtml = "";
  let enlargeBtn = "";
  let lightboxHtml = "";
  let lightboxScript = "";

  if (type === "image") {
    ogExtras = `
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:type" content="${escapeHtml(mime)}" />
    ${sizeMeta}
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <link rel="image_src" href="${escapeHtml(ogImageUrl)}" />`;
    const legendClass = item.legendary ? " painting__frame--legendary" : "";
    mediaHtml = `<button type="button" class="painting__frame${legendClass} painting__frame--zoom" id="open-lightbox" aria-label="Открыть крупнее">
      <div class="painting__mat"><img src="${escapeHtml(item.url)}" alt="${safeTitle}" /></div>
      <span class="zoom-hint">Нажми, чтобы увеличить</span>
    </button>`;
    enlargeBtn = `<button type="button" class="btn btn--ghost" id="open-lightbox-btn">Крупнее</button>`;
    lightboxHtml = `<div id="lightbox" class="lightbox" hidden>
      <button type="button" class="lightbox__close" aria-label="Закрыть">&times;</button>
      <img id="lightbox-img" src="${escapeHtml(item.url)}" alt="${safeTitle}" />
    </div>`;
    lightboxScript = `
      const lightbox = document.getElementById("lightbox");
      const openers = [document.getElementById("open-lightbox"), document.getElementById("open-lightbox-btn")].filter(Boolean);
      function openLightbox() { lightbox.hidden = false; document.body.style.overflow = "hidden"; }
      function closeLightbox() { lightbox.hidden = true; document.body.style.overflow = ""; }
      openers.forEach((el) => el.addEventListener("click", openLightbox));
      lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox || e.target.classList.contains("lightbox__close")) closeLightbox();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
      });`;
  } else if (type === "video") {
    const poster = withQuery(absoluteUrl("/og-default.png"), { v: "1" });
    const legendClass = item.legendary ? " painting__frame--legendary" : "";
    ogExtras = `
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${escapeHtml(poster)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(poster)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:video" content="${escapeHtml(mediaUrl)}" />
    <meta property="og:video:type" content="${escapeHtml(mime)}" />
    <meta property="og:video:secure_url" content="${escapeHtml(mediaUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeHtml(poster)}" />`;
    mediaHtml = `<div class="painting__frame${legendClass} painting__frame--media"><div class="painting__mat"><div class="rv-player-host" id="item-media-host" data-kind="video" data-src="${escapeHtml(item.url)}" data-variants="${escapeHtml(JSON.stringify(item.variants || []))}"></div></div></div>`;
  } else {
    const poster = withQuery(absoluteUrl("/og-default.png"), { v: "1" });
    const legendClass = item.legendary ? " painting__frame--legendary" : "";
    ogExtras = `
    <meta property="og:type" content="website" />
    <meta property="og:audio" content="${escapeHtml(mediaUrl)}" />
    <meta property="og:audio:type" content="${escapeHtml(mime)}" />
    <meta property="og:image" content="${escapeHtml(poster)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(poster)}" />
    <meta property="og:image:type" content="image/png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeHtml(poster)}" />`;
    mediaHtml = `<div class="painting__frame${legendClass} painting__frame--media"><div class="painting__mat"><div class="rv-player-host" id="item-media-host" data-kind="audio" data-src="${escapeHtml(item.url)}" data-title="${safeTitle}"></div></div></div>`;
  }

  const relatedItems = Array.isArray(related) ? related : [];
  const relatedSection = relatedItems.length
    ? `<section class="related" aria-label="Рекомендации">
        <h2 class="related__heading">Ещё на стене</h2>
        <div class="related__grid">${relatedItems.map(relatedCardHtml).join("")}</div>
      </section>`
    : "";

  const typeHref =
    type === "audio" ? "/c/audio" : type === "video" ? "/c/video" : "/c/image";
  const unlistedNote =
    (item.visibility || "public") === "unlisted"
      ? `<p class="item-unlisted">Только по ссылке</p>`
      : "";

  const existingComments = commentsForItem(item.id);
  const commentsListHtml = existingComments.length
    ? existingComments
        .map((c) => {
          const imgHtml = c.imageUrl
            ? `<a class="comment__image-link" href="${escapeHtml(c.imageUrl)}" target="_blank" rel="noopener"><img class="comment__image" src="${escapeHtml(c.imageUrl)}" alt="" loading="lazy" /></a>`
            : "";
          const textHtml = c.text
            ? `<p class="comment__text">${escapeHtml(c.text)}</p>`
            : "";
          return `<li class="comment" data-id="${escapeHtml(c.id)}">
        <div class="comment__head">
          <a class="comment__author" href="/u/${encodeURIComponent(c.username)}">${escapeHtml(c.username)}</a>
          <time class="comment__date" datetime="${escapeHtml(new Date(c.createdAt).toISOString())}">${escapeHtml(formatUploadDate(c.createdAt))}</time>
        </div>
        ${textHtml}
        ${imgHtml}
      </li>`;
        })
        .join("")
    : `<li class="comment comment--empty" id="comments-empty">Пока нет комментариев.</li>`;

  const itemTags = sanitizeTags(item.tags || []);
  const tagCounts = new Map();
  if (itemTags.length) {
    for (const entry of loadMeta()) {
      if (isDeletedItem(entry) || !isPublicItem(entry)) continue;
      for (const tag of sanitizeTags(entry.tags || [])) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }
  const tagsHtml = itemTags.length
    ? `<div class="item-tags">${itemTags
        .map((tag) => {
          const count = tagCounts.get(tag) || 1;
          return `<a class="tag-chip" href="/?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)} <span class="tag-chip__count">${count}</span></a>`;
        })
        .join("")}</div>`
    : "";

  const viewsLabel = formatViewCount(item.views);
  const metaLine = [
    uploadedAt
      ? `<time class="item-date" datetime="${escapeHtml(new Date(Number(item.createdAt)).toISOString())}">Дата загрузки: ${escapeHtml(uploadedAt)}</time>`
      : "",
    `<p class="item-views" id="item-views">${escapeHtml(viewsLabel)}</p>`,
  ]
    .filter(Boolean)
    .join("");

  const manageButtons = [];
  if (item.isOwner) {
    manageButtons.push(
      `<button type="button" class="btn btn--ghost" id="manage-visibility" data-visibility="${escapeHtml(item.visibility || "public")}">${
        (item.visibility || "public") === "unlisted" ? "В открытый" : "Только ссылка"
      }</button>`
    );
  }
  if (item.canManage) {
    manageButtons.push(`<button type="button" class="btn btn--ghost" id="manage-title">Название</button>`);
    manageButtons.push(`<button type="button" class="btn btn--ghost" id="manage-tags">Теги</button>`);
  }
  if (item.isStaffViewer) {
    manageButtons.push(
      `<button type="button" class="btn btn--ghost" id="manage-legendary" data-legendary="${item.legendary ? "1" : "0"}">${
        item.legendary ? "Снять легенду" : "Золотая рамка"
      }</button>`
    );
  }
  if (item.canManage) {
    manageButtons.push(`<button type="button" class="btn btn--danger" id="manage-delete">Удалить</button>`);
  }
  const manageSection = manageButtons.length
    ? `<section class="item-manage" id="item-manage" aria-label="Управление файлом">
        <h2 class="item-manage__heading">Управление</h2>
        <div class="item-manage__actions">${manageButtons.join("")}</div>
        <p class="status item-manage__status" id="manage-status" role="status"></p>
      </section>`
    : "";

  const commentsSection = `<section class="comments" id="comments" data-item-id="${escapeHtml(item.id)}">
      <h2 class="comments__heading">Комментарии</h2>
      <ul class="comments__list" id="comments-list">${commentsListHtml}</ul>
      <form class="comments__form" id="comments-form">
        <label class="field">
          <span>Ваш комментарий</span>
          <textarea id="comment-text" maxlength="${COMMENT_MAX_LEN}" rows="3" placeholder="Напишите что-нибудь…"></textarea>
        </label>
        <label class="field">
          <span>Картинка (необязательно)</span>
          <input id="comment-image" type="file" accept="image/*" />
        </label>
        <p class="panel__hint" id="comments-hint">Войдите, чтобы комментировать.</p>
        <div class="panel__actions">
          <button type="submit" class="btn" id="comment-submit" disabled>Отправить</button>
        </div>
        <p class="status" id="comments-status" role="status"></p>
      </form>
    </section>`;

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} · ${escapeHtml(siteName)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#b8ff3c" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(withQuery(pageUrl, { v: bust }))}" />
    <meta property="og:locale" content="ru_RU" />
    ${ogExtras}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;700&family=Libre+Baskerville:wght@400;700&family=Onest:wght@300;400;500;600&family=Unbounded:wght@500;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css?v=views1" />
    <link rel="stylesheet" href="/themes.css?v=views1" />
    <script src="/theme.js?v=views1"></script>
  </head>
  <body>
    <div class="atmosphere" aria-hidden="true">
      <div class="atmosphere__grid"></div>
      <div class="atmosphere__glow"></div>
    </div>
    <main class="item-page">
      <a class="item-back" href="/">← ${escapeHtml(siteName)}</a>
      <h1 class="item-title" id="item-title">${safeTitle}</h1>
      ${authorHtml}
      <div class="item-meta">${metaLine}</div>
      ${unlistedNote}
      <div id="item-tags-wrap">${tagsHtml}</div>
      <article class="item-media painting painting--${escapeHtml(type)}">
        ${mediaHtml}
      </article>
      <div class="item-actions">
        <div class="item-votes vote-group" id="item-votes" data-item-id="${escapeHtml(item.id)}">
          <button type="button" class="vote-btn vote-btn--like${item.myVote === "like" ? " is-active" : ""}" id="vote-like" aria-label="Лайк">
            <span aria-hidden="true">▲</span>
            <span class="vote-btn__count" id="vote-like-count">${Number(item.likes) || 0}</span>
          </button>
          <button type="button" class="vote-btn vote-btn--dislike${item.myVote === "dislike" ? " is-active" : ""}" id="vote-dislike" aria-label="Дизлайк">
            <span aria-hidden="true">▼</span>
            <span class="vote-btn__count" id="vote-dislike-count">${Number(item.dislikes) || 0}</span>
          </button>
        </div>
        <a class="btn" href="${escapeHtml(item.url)}" download>Скачать</a>
        ${enlargeBtn}
        <button type="button" class="btn btn--ghost" id="copy-link">Копировать ссылку</button>
        <a class="btn btn--ghost" href="${typeHref}">К ${escapeHtml(typeLabel)}</a>
        <a class="btn btn--ghost" href="/">На стену</a>
      </div>
      <p class="item-vote-status status" id="vote-status" role="status"></p>
      ${manageSection}
      ${commentsSection}
      ${relatedSection}
    </main>
    ${lightboxHtml}
    <script src="/player.js"></script>
    <script>
      (function mountItemPlayer() {
        const host = document.getElementById("item-media-host");
        if (!host || !window.RvPlayer) return;
        const kind = host.dataset.kind || "video";
        let variants = [];
        try { variants = JSON.parse(host.dataset.variants || "[]"); } catch (_) {}
        window.RvPlayer.mount(host, {
          kind,
          src: host.dataset.src,
          title: host.dataset.title || "",
          variants,
          compact: false,
        });
      })();

      document.getElementById("copy-link").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(${JSON.stringify(pageUrl)});
          const btn = document.getElementById("copy-link");
          btn.textContent = "Скопировано";
          setTimeout(() => { btn.textContent = "Копировать ссылку"; }, 1600);
        } catch (_) {}
      });
      ${lightboxScript}

      (function setupVotes() {
        const itemId = ${JSON.stringify(item.id)};
        const likeBtn = document.getElementById("vote-like");
        const dislikeBtn = document.getElementById("vote-dislike");
        const likeCount = document.getElementById("vote-like-count");
        const dislikeCount = document.getElementById("vote-dislike-count");
        const statusEl = document.getElementById("vote-status");
        let me = null;
        let myVote = ${JSON.stringify(item.myVote || null)};
        let busy = false;

        function setStatus(text) { if (statusEl) statusEl.textContent = text || ""; }

        function paint(likes, dislikes, vote) {
          myVote = vote || null;
          likeCount.textContent = String(likes || 0);
          dislikeCount.textContent = String(dislikes || 0);
          likeBtn.classList.toggle("is-active", myVote === "like");
          dislikeBtn.classList.toggle("is-active", myVote === "dislike");
        }

        function pulse(btn) {
          btn.classList.remove("is-pulse");
          void btn.offsetWidth;
          btn.classList.add("is-pulse");
        }

        async function cast(vote) {
          if (busy) return;
          if (!me) {
            setStatus("Войдите на главной, чтобы голосовать");
            return;
          }
          busy = true;
          const prev = { likes: Number(likeCount.textContent) || 0, dislikes: Number(dislikeCount.textContent) || 0, myVote };
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
          paint(nextLikes, nextDislikes, nextVote);
          pulse(vote === "like" ? likeBtn : dislikeBtn);
          try {
            const res = await fetch("/api/items/" + encodeURIComponent(itemId) + "/vote", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vote }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Ошибка");
            paint(body.likes, body.dislikes, body.myVote);
            setStatus("");
          } catch (err) {
            paint(prev.likes, prev.dislikes, prev.myVote);
            setStatus(err.message || "Ошибка");
          } finally {
            busy = false;
          }
        }

        fetch("/api/auth/me", { credentials: "include" })
          .then((r) => r.json())
          .then((data) => {
            me = data && data.user ? data.user : null;
            if (me && me.theme && window.RvTheme) window.RvTheme.applyTheme(me.theme);
          })
          .catch(() => {});

        likeBtn.addEventListener("click", (e) => { e.preventDefault(); cast("like"); });
        dislikeBtn.addEventListener("click", (e) => { e.preventDefault(); cast("dislike"); });
      })();

      (function setupManage() {
        const root = document.getElementById("item-manage");
        if (!root) return;
        const itemId = ${JSON.stringify(item.id)};
        const statusEl = document.getElementById("manage-status");
        const titleEl = document.getElementById("item-title");
        const tagsWrap = document.getElementById("item-tags-wrap");
        const unlistedEl = document.querySelector(".item-unlisted");
        let busy = false;

        function setStatus(text) {
          if (statusEl) statusEl.textContent = text || "";
        }

        async function patch(body) {
          const res = await fetch("/api/items/" + encodeURIComponent(itemId), {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Ошибка");
          return data;
        }

        function renderTags(tags) {
          if (!tagsWrap) return;
          const list = Array.isArray(tags) ? tags : [];
          if (!list.length) {
            tagsWrap.innerHTML = "";
            return;
          }
          tagsWrap.innerHTML = '<div class="item-tags">' + list.map((tag) => {
            const safe = String(tag || "");
            return '<a class="tag-chip" href="/?tag=' + encodeURIComponent(safe) + '">#' + safe.replace(/[<>&"]/g, "") + '</a>';
          }).join("") + '</div>';
        }

        const visBtn = document.getElementById("manage-visibility");
        if (visBtn) {
          visBtn.addEventListener("click", async () => {
            if (busy) return;
            busy = true;
            setStatus("");
            try {
              const current = visBtn.getAttribute("data-visibility") || "public";
              const next = current === "unlisted" ? "public" : "unlisted";
              const updated = await patch({ visibility: next });
              visBtn.setAttribute("data-visibility", updated.visibility || next);
              visBtn.textContent = (updated.visibility || next) === "unlisted" ? "В открытый" : "Только ссылка";
              if ((updated.visibility || next) === "unlisted") {
                if (!document.querySelector(".item-unlisted")) {
                  const note = document.createElement("p");
                  note.className = "item-unlisted";
                  note.textContent = "Только по ссылке";
                  const meta = document.querySelector(".item-meta");
                  if (meta && meta.nextSibling) meta.parentNode.insertBefore(note, meta.nextSibling);
                  else if (meta) meta.after(note);
                }
              } else {
                const note = document.querySelector(".item-unlisted");
                if (note) note.remove();
              }
              setStatus(next === "unlisted" ? "Теперь только по ссылке." : "Снова на стене.");
            } catch (err) {
              setStatus(err.message || "Ошибка");
            } finally {
              busy = false;
            }
          });
        }

        const titleBtn = document.getElementById("manage-title");
        if (titleBtn) {
          titleBtn.addEventListener("click", async () => {
            if (busy) return;
            const current = titleEl ? titleEl.textContent : "";
            const next = window.prompt("Новое название файла:", current);
            if (next == null) return;
            const trimmed = String(next).trim().replace(/\\s+/g, " ").slice(0, 120);
            if (!trimmed) {
              setStatus("Название не может быть пустым");
              return;
            }
            busy = true;
            setStatus("");
            try {
              const updated = await patch({ title: trimmed });
              if (titleEl) titleEl.textContent = updated.title || trimmed;
              document.title = (updated.title || trimmed) + " · Файлы Трэп хаты";
              setStatus("Название обновлено.");
            } catch (err) {
              setStatus(err.message || "Не удалось переименовать");
            } finally {
              busy = false;
            }
          });
        }

        const tagsBtn = document.getElementById("manage-tags");
        if (tagsBtn) {
          tagsBtn.addEventListener("click", async () => {
            if (busy) return;
            const current = ${JSON.stringify((item.tags || []).join(", "))};
            const next = window.prompt("Теги через запятую:", current);
            if (next == null) return;
            busy = true;
            setStatus("");
            try {
              const updated = await patch({ tags: next });
              renderTags(updated.tags || []);
              setStatus("Теги обновлены.");
            } catch (err) {
              setStatus(err.message || "Не удалось обновить теги");
            } finally {
              busy = false;
            }
          });
        }

        const legendBtn = document.getElementById("manage-legendary");
        if (legendBtn) {
          legendBtn.addEventListener("click", async () => {
            if (busy) return;
            busy = true;
            setStatus("");
            try {
              const on = legendBtn.getAttribute("data-legendary") === "1";
              const updated = await patch({ legendary: !on });
              const next = Boolean(updated.legendary);
              legendBtn.setAttribute("data-legendary", next ? "1" : "0");
              legendBtn.textContent = next ? "Снять легенду" : "Золотая рамка";
              document.querySelectorAll(".item-media .painting__frame").forEach((frame) => {
                frame.classList.toggle("painting__frame--legendary", next);
              });
              setStatus(next ? "Легендарная рамка выдана." : "Легендарность снята.");
            } catch (err) {
              setStatus(err.message || "Ошибка");
            } finally {
              busy = false;
            }
          });
        }

        const delBtn = document.getElementById("manage-delete");
        if (delBtn) {
          delBtn.addEventListener("click", async () => {
            if (busy) return;
            const name = titleEl ? titleEl.textContent : "файл";
            if (!confirm("Удалить «" + name + "»?")) return;
            busy = true;
            setStatus("");
            try {
              const res = await fetch("/api/items/" + encodeURIComponent(itemId), {
                method: "DELETE",
                credentials: "include",
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || "Ошибка удаления");
              setStatus("Удалено. Возврат на стену…");
              setTimeout(() => { window.location.href = "/"; }, 700);
            } catch (err) {
              setStatus(err.message || "Ошибка удаления");
              busy = false;
            }
          });
        }
      })();

      (function setupComments() {
        const itemId = ${JSON.stringify(item.id)};
        const form = document.getElementById("comments-form");
        const textEl = document.getElementById("comment-text");
        const imageEl = document.getElementById("comment-image");
        const submitBtn = document.getElementById("comment-submit");
        const hint = document.getElementById("comments-hint");
        const statusEl = document.getElementById("comments-status");
        const list = document.getElementById("comments-list");
        let me = null;

        function setMsg(text) { statusEl.textContent = text || ""; }

        function escapeHtml(value) {
          return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
        }

        function formatDate(ts) {
          try {
            return new Intl.DateTimeFormat("ru-RU", {
              day: "numeric", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
            }).format(new Date(ts));
          } catch {
            return new Date(ts).toLocaleString("ru-RU");
          }
        }

        function appendComment(c) {
          const empty = document.getElementById("comments-empty");
          if (empty) empty.remove();
          const li = document.createElement("li");
          li.className = "comment";
          li.dataset.id = c.id;
          let html = '<div class="comment__head"><a class="comment__author" href="/u/' +
            encodeURIComponent(c.username) + '">' + escapeHtml(c.username) +
            '</a><time class="comment__date">' + escapeHtml(formatDate(c.createdAt)) +
            "</time></div>";
          if (c.text) html += '<p class="comment__text">' + escapeHtml(c.text) + "</p>";
          if (c.imageUrl) {
            html += '<a class="comment__image-link" href="' + escapeHtml(c.imageUrl) +
              '" target="_blank" rel="noopener"><img class="comment__image" src="' +
              escapeHtml(c.imageUrl) + '" alt="" loading="lazy" /></a>';
          }
          li.innerHTML = html;
          list.appendChild(li);
        }

        fetch("/api/auth/me", { credentials: "include" })
          .then((r) => r.json())
          .then((data) => {
            me = data && data.user ? data.user : null;
            if (me && me.theme && window.RvTheme) {
              window.RvTheme.applyTheme(me.theme);
            }
            if (me) {
              hint.textContent = "Можно текст и/или картинку. Макс. " + ${COMMENT_MAX_LEN} + " символов.";
              submitBtn.disabled = false;
            } else {
              hint.innerHTML = 'Войдите на <a href="/">главной</a>, чтобы комментировать.';
              submitBtn.disabled = true;
            }
          })
          .catch(() => {});

        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (!me) {
            setMsg("Нужен вход");
            return;
          }
          const text = textEl.value.trim();
          const file = imageEl && imageEl.files && imageEl.files[0];
          if (!text && !file) {
            setMsg("Нужен текст или картинка");
            return;
          }
          submitBtn.disabled = true;
          setMsg("Отправка…");
          try {
            const formData = new FormData();
            formData.append("text", text);
            if (file) formData.append("image", file);
            const res = await fetch("/api/items/" + encodeURIComponent(itemId) + "/comments", {
              method: "POST",
              credentials: "include",
              body: formData,
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Ошибка");
            textEl.value = "";
            if (imageEl) imageEl.value = "";
            appendComment(body.comment);
            setMsg("Комментарий добавлен.");
            setTimeout(() => setMsg(""), 1600);
          } catch (err) {
            setMsg(err.message || "Ошибка");
          } finally {
            submitBtn.disabled = !me;
          }
        });
      })();
    </script>
  </body>
</html>`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const kind = detectKind(file) || "image";
    const safeExt = pickExt(file, kind);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_LIMITS.admin },
  fileFilter: (_req, file, cb) => {
    if (!detectKind(file)) {
      cb(new Error("Можно загружать только фото, аудио или видео"));
      return;
    }
    cb(null, true);
  },
});

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, auth.avatarsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = IMAGE_EXTS.has(ext) ? ext : ".jpg";
      const userId = req.authUser && req.authUser.id ? req.authUser.id : "anon";
      cb(null, `${userId}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();
    if (mime.startsWith("image/") || IMAGE_EXTS.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error("Аватар должен быть картинкой"));
  },
});

const COMMENT_IMAGES_DIR = path.join(UPLOADS, "comments");
fs.mkdirSync(COMMENT_IMAGES_DIR, { recursive: true });

const commentImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, COMMENT_IMAGES_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = IMAGE_EXTS.has(ext) ? ext : ".jpg";
      const userId = req.authUser && req.authUser.id ? req.authUser.id : "anon";
      cb(null, `${userId}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();
    if (mime.startsWith("image/") || IMAGE_EXTS.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error("В комментарий можно прикрепить только картинку"));
  },
});

function itemsVotedByUser(userId, kind, viewer) {
  if (!userId) return [];
  const votes = loadVotes();
  const metaById = new Map(
    loadMeta()
      .filter((item) => !isDeletedItem(item))
      .map((item) => [item.id, item])
  );
  const out = [];
  for (const [itemId, byUser] of Object.entries(votes)) {
    if (!byUser || byUser[userId] !== kind) continue;
    const item = metaById.get(itemId);
    if (!item) continue;
    const viewingSelf = viewer && viewer.id === userId;
    if (!isPublicItem(item) && !viewingSelf) continue;
    out.push(enrichItem(item, viewer));
  }
  out.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  return out;
}

function commentsByUser(userId, viewer) {
  if (!userId) return [];
  const store = loadCommentsStore();
  const metaById = new Map(
    loadMeta()
      .filter((item) => !isDeletedItem(item))
      .map((item) => [item.id, item])
  );
  const viewingSelf = Boolean(viewer && viewer.id === userId);
  const out = [];
  for (const [itemId, list] of Object.entries(store)) {
    if (!Array.isArray(list)) continue;
    const item = metaById.get(itemId);
    if (!item) continue;
    if (!isPublicItem(item) && !viewingSelf) continue;
    const enriched = enrichItem(item, viewer);
    for (const comment of list) {
      if (!comment || comment.userId !== userId) continue;
      out.push({
        id: comment.id,
        text: comment.text || "",
        imageUrl: comment.imageUrl || null,
        createdAt: Number(comment.createdAt) || 0,
        itemId: item.id,
        item: {
          id: enriched.id,
          title: enriched.title,
          originalName: enriched.originalName,
          url: enriched.url,
          type: enriched.type,
          tags: enriched.tags,
        },
      });
    }
  }
  out.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  return out;
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

app.use((req, _res, next) => {
  const session = auth.getSessionUser(req);
  req.authUser = session ? session.user : null;
  req.authToken = session ? session.token : null;
  next();
});

app.use(express.static(path.join(ROOT, "public")));
app.use(
  "/uploads",
  express.static(UPLOADS, {
    maxAge: "7d",
    acceptRanges: true,
    setHeaders(res, filePath) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (/\.(jpe?g|png|gif|webp|avif)$/i.test(filePath)) {
        res.setHeader("Content-Disposition", "inline");
      }
    },
  })
);

function isPublicItem(item) {
  return (item.visibility || "public") !== "unlisted";
}

function isOwner(item, user) {
  return Boolean(user && item && item.authorId && item.authorId === user.id);
}

function enrichItem(item, currentUser) {
  const votes = loadVotes();
  const itemVotes = votes[item.id] || {};
  const counts = countVotes(itemVotes);
  const anonymous = isAnonymousItem(item);
  const likedBy = voteVoters(itemVotes, "like");
  const dislikedBy = voteVoters(itemVotes, "dislike");
  const owner = isOwner(item, currentUser);
  const staff = Boolean(currentUser && auth.userIsStaff(currentUser));
  return {
    ...item,
    type: item.type || "image",
    visibility: item.visibility || "public",
    anonymous,
    authorUsername: anonymous ? null : item.authorUsername || null,
    authorId: item.authorId || null,
    size: fileByteSize(item.filename),
    likes: counts.likes,
    dislikes: counts.dislikes,
    likedBy,
    dislikedBy,
    views: getItemViews(item.id),
    legendary: Boolean(item.legendary),
    deleted: isDeletedItem(item),
    tags: sanitizeTags(item.tags || []),
    variants: Array.isArray(item.variants) ? item.variants : [],
    myVote:
      currentUser && itemVotes[currentUser.id] ? itemVotes[currentUser.id] : null,
    isOwner: owner,
    isStaffViewer: staff,
    canManage: owner || staff,
  };
}

function enrichItems(currentUser, { includeUnlistedOwned = false, onlyAuthorId = null, attributedOnly = false, includeDeleted = false, anonymousOnly = false } = {}) {
  return loadMeta()
    .filter((item) => {
      if (!includeDeleted && isDeletedItem(item)) return false;
      if (anonymousOnly) {
        if (!isAnonymousItem(item)) return false;
        return isPublicItem(item);
      }
      if (onlyAuthorId) {
        if (item.authorId !== onlyAuthorId) return false;
        const viewingSelf = currentUser && currentUser.id === onlyAuthorId;
        if (viewingSelf) return true;
        if (!isPublicItem(item)) return false;
        if (attributedOnly && isAnonymousItem(item)) return false;
        return true;
      }
      if (isPublicItem(item)) return true;
      if (includeUnlistedOwned && isOwner(item, currentUser)) return true;
      return false;
    })
    .map((item) => enrichItem(item, currentUser))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function listItems(req, res) {
  const mine = String(req.query.mine || "") === "1";
  if (mine && !req.authUser) {
    return res.status(401).json({ error: "Нужен вход" });
  }
  const items = enrichItems(req.authUser, {
    includeUnlistedOwned: mine,
    onlyAuthorId: mine && req.authUser ? req.authUser.id : null,
    attributedOnly: false,
  });
  res.json(items);
}

app.get("/api/items", listItems);
app.get("/api/images", listItems);

app.get("/api/tags", (_req, res) => {
  const counts = new Map();
  for (const item of loadMeta()) {
    if (isDeletedItem(item) || !isPublicItem(item)) continue;
    for (const tag of sanitizeTags(item.tags || [])) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const tags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ru"));
  res.json({ tags });
});

app.get("/api/stats", (_req, res) => {
  const items = loadMeta().filter((item) => !isDeletedItem(item) && isPublicItem(item));
  let totalBytes = 0;
  for (const item of items) {
    totalBytes += fileByteSize(item.filename);
  }
  res.json({
    count: items.length,
    totalBytes,
  });
});

app.post("/api/auth/theme", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const result = auth.setTheme(req.authUser.id, req.body && req.body.theme);
  if (result.error) return res.status(400).json({ error: result.error });
  req.authUser = result.user;
  res.json({ user: auth.publicUser(result.user) });
});

app.get("/api/auth/me", (req, res) => {
  const limit = uploadLimitForUser(req.authUser);
  res.json({
    user: auth.publicUser(req.authUser),
    uploadLimit: limit,
    uploadLimitLabel: formatUploadLimit(limit),
    themes: [
      "trap",
      "neon",
      "paper",
      "midnight",
      "brutal",
      "ocean",
      "office",
      "maldives",
      "sakura",
      "forest",
      "arcade",
      "desert",
      "cafe",
      "noir",
      "random",
    ],
  });
});

app.get("/api/upload-limits", (req, res) => {
  const limit = uploadLimitForUser(req.authUser);
  res.json({
    guest: UPLOAD_LIMITS.guest,
    user: UPLOAD_LIMITS.user,
    moderator: UPLOAD_LIMITS.moderator,
    admin: UPLOAD_LIMITS.admin,
    current: limit,
    currentLabel: formatUploadLimit(limit),
  });
});

app.post("/api/auth/register", (req, res) => {
  const password = req.body && req.body.password;
  const passwordConfirm = req.body && req.body.passwordConfirm;
  if (
    passwordConfirm != null &&
    String(passwordConfirm) !== "" &&
    String(passwordConfirm) !== String(password || "")
  ) {
    return res.status(400).json({ error: "Пароли не совпадают" });
  }
  const result = auth.register(req.body && req.body.username, password);
  if (result.error) return res.status(400).json({ error: result.error });
  const session = auth.createSession(result.user.id);
  auth.setSessionCookie(res, session.token, session.expiresAt);
  writeAudit("user.register", result.user, {
    targetType: "user",
    targetId: result.user.id,
    targetLabel: result.user.username,
  });
  res.status(201).json({ user: auth.publicUser(result.user) });
});

app.post("/api/auth/login", (req, res) => {
  const result = auth.login(req.body && req.body.username, req.body && req.body.password);
  if (result.error) return res.status(401).json({ error: result.error });
  const session = auth.createSession(result.user.id);
  auth.setSessionCookie(res, session.token, session.expiresAt);
  res.json({ user: auth.publicUser(result.user) });
});

app.get("/api/auth/check-username", (req, res) => {
  const exceptId =
    req.authUser && String(req.query.exceptSelf || "") === "1" ? req.authUser.id : null;
  const result = auth.checkUsernameAvailable(req.query.username, exceptId);
  if (!result.ok) return res.json({ available: false, error: result.error });
  res.json({ available: true, username: result.username });
});

app.post("/api/auth/username", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const result = auth.changeUsername(req.authUser.id, req.body && req.body.username);
  if (result.error) return res.status(400).json({ error: result.error });

  const oldUsername = result.oldUsername;
  const newUsername = result.user.username;

  const items = loadMeta();
  let itemsChanged = false;
  for (const item of items) {
    if (item.authorId === result.user.id && item.authorUsername) {
      item.authorUsername = newUsername;
      itemsChanged = true;
    }
  }
  if (itemsChanged) saveMeta(items);

  const comments = loadCommentsStore();
  let commentsChanged = false;
  for (const list of Object.values(comments)) {
    if (!Array.isArray(list)) continue;
    for (const comment of list) {
      if (comment.userId === result.user.id) {
        comment.username = newUsername;
        commentsChanged = true;
      }
    }
  }
  if (commentsChanged) saveCommentsStore(comments);

  writeAudit("user.rename", result.user, {
    targetType: "user",
    targetId: result.user.id,
    targetLabel: newUsername,
    meta: { oldUsername, newUsername },
  });

  req.authUser = result.user;
  const rename = auth.renameAvailability(result.user);
  res.json({
    user: auth.publicUser(result.user),
    oldUsername,
    canRename: rename.canRename,
    nextRenameAt: rename.nextRenameAt,
  });
});

app.post("/api/auth/logout", (req, res) => {
  auth.destroySession(req.authToken);
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/auth/avatar", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Ошибка аватара" });
    if (!req.file) return res.status(400).json({ error: "Файл не выбран" });

    const users = auth.loadUsers();
    const idx = users.findIndex((u) => u.id === req.authUser.id);
    if (idx === -1) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    const oldAvatar = users[idx].avatarUrl;
    if (oldAvatar && oldAvatar.startsWith("/uploads/avatars/")) {
      const oldPath = path.join(UPLOADS, oldAvatar.replace(/^\/uploads\//, ""));
      fs.unlink(oldPath, () => {});
    }

    users[idx].avatarUrl = `/uploads/avatars/${req.file.filename}`;
    auth.saveUsers(users);
    req.authUser = users[idx];
    res.json({ user: auth.publicUser(users[idx]) });
  });
});

app.get("/api/users/top", (_req, res) => {
  const counts = new Map();
  let anonymousCount = 0;
  for (const item of loadMeta()) {
    if (isDeletedItem(item)) continue;
    if (isAnonymousItem(item)) {
      anonymousCount += 1;
      continue;
    }
    if (!item.authorId) continue;
    counts.set(item.authorId, (counts.get(item.authorId) || 0) + 1);
  }
  const users = auth.loadUsers();
  const ranked = users.map((user) => ({
    ...auth.publicUser(user),
    uploads: counts.get(user.id) || 0,
  }));

  if (anonymousCount > 0) {
    ranked.push(auth.anonymousPublicUser(anonymousCount));
  }

  ranked.sort(
    (a, b) =>
      b.uploads - a.uploads ||
      String(a.username).localeCompare(String(b.username), "ru")
  );
  res.json(ranked);
});

app.get("/api/random", (_req, res) => {
  const items = loadMeta().filter((item) => !isDeletedItem(item) && isPublicItem(item));
  if (!items.length) {
    return res.status(404).json({ error: "Пока нечего открывать" });
  }
  const item = items[Math.floor(Math.random() * items.length)];
  res.json({
    id: item.id,
    url: `/i/${encodeURIComponent(item.id)}`,
    title: item.title || item.originalName || null,
    type: item.type || "image",
  });
});

app.get("/api/users/:username", (req, res) => {
  if (auth.isAnonymousUsername(req.params.username)) {
    const items = enrichItems(req.authUser, { anonymousOnly: true });
    return res.json({
      user: auth.anonymousPublicUser(items.length),
      isSelf: false,
      uploads: items.length,
      items,
      likedItems: [],
      dislikedItems: [],
      comments: [],
      canManageMod: false,
      canModerateUser: false,
      isAnonymousProfile: true,
    });
  }

  const user = auth.findUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  const isSelf = req.authUser && req.authUser.id === user.id;
  const items = enrichItems(req.authUser, {
    onlyAuthorId: user.id,
    attributedOnly: !isSelf,
  });
  const allOwned = loadMeta().filter(
    (x) => !isDeletedItem(x) && x.authorId === user.id && !isAnonymousItem(x)
  );
  const rename = isSelf ? auth.renameAvailability(user) : { canRename: false, nextRenameAt: null };
  const likedItems = itemsVotedByUser(user.id, "like", req.authUser);
  const dislikedItems = itemsVotedByUser(user.id, "dislike", req.authUser);
  const comments = commentsByUser(user.id, req.authUser);
  res.json({
    user: auth.publicUser(user),
    isSelf: Boolean(isSelf),
    uploads: allOwned.length,
    items,
    likedItems,
    dislikedItems,
    comments,
    canManageMod:
      Boolean(req.authUser && auth.userIsAdmin(req.authUser) && !auth.userIsAdmin(user)),
    canModerateUser: Boolean(req.authUser && auth.canModerateTarget(req.authUser, user)),
    isAnonymousProfile: false,
    canRename: Boolean(isSelf && rename.canRename),
    nextRenameAt: isSelf ? rename.nextRenameAt : null,
  });
});

app.post("/api/users/:username/moderator", (req, res) => {
  if (!req.authUser || !auth.userIsAdmin(req.authUser)) {
    return res.status(403).json({ error: "Только админ может выдавать модерку" });
  }
  const enabled = Boolean(req.body && req.body.isModerator);
  const result = auth.setModerator(req.params.username, enabled);
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(enabled ? "user.moderator.grant" : "user.moderator.revoke", req.authUser, {
    targetType: "user",
    targetId: result.user.id,
    targetLabel: result.user.username,
  });
  res.json({ user: auth.publicUser(result.user) });
});

app.post("/api/users/:username/ban", (req, res) => {
  if (!req.authUser || !auth.userIsStaff(req.authUser)) {
    return res.status(403).json({ error: "Нужны права модератора или админа" });
  }
  const enabled = Boolean(req.body && req.body.banned);
  const reason = req.body && req.body.reason;
  const result = auth.setBan(req.params.username, {
    enabled,
    reason,
    actor: req.authUser,
  });
  if (result.error) return res.status(400).json({ error: result.error });
  if (enabled) auth.destroyUserSessions(result.user.id);
  writeAudit(enabled ? "user.ban" : "user.unban", req.authUser, {
    targetType: "user",
    targetId: result.user.id,
    targetLabel: result.user.username,
    meta: { reason: result.user.banReason || null },
  });
  res.json({ user: auth.publicUser(result.user) });
});

app.post("/api/users/:username/mute", (req, res) => {
  if (!req.authUser || !auth.userIsStaff(req.authUser)) {
    return res.status(403).json({ error: "Нужны права модератора или админа" });
  }
  const hours = Number(req.body && req.body.hours);
  const reason = req.body && req.body.reason;
  let mutedUntil = null;
  if (Number.isFinite(hours) && hours > 0) {
    mutedUntil = Date.now() + hours * 60 * 60 * 1000;
  } else if (req.body && req.body.mutedUntil != null) {
    mutedUntil = Number(req.body.mutedUntil) || null;
  }
  const result = auth.setMute(req.params.username, {
    mutedUntil,
    reason,
    actor: req.authUser,
  });
  if (result.error) return res.status(400).json({ error: result.error });
  writeAudit(mutedUntil ? "user.mute" : "user.unmute", req.authUser, {
    targetType: "user",
    targetId: result.user.id,
    targetLabel: result.user.username,
    meta: {
      mutedUntil: result.user.mutedUntil || null,
      reason: result.user.muteReason || null,
      hours: Number.isFinite(hours) && hours > 0 ? hours : null,
    },
  });
  res.json({ user: auth.publicUser(result.user) });
});

app.post("/api/items/:id/vote", (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ error: "Войдите, чтобы голосовать" });
  }
  const muteMsg = muteBlockMessage(req.authUser);
  if (muteMsg) return res.status(403).json({ error: muteMsg });

  const vote = String((req.body && req.body.vote) || "").toLowerCase();
  if (vote !== "like" && vote !== "dislike") {
    return res.status(400).json({ error: "vote должен быть like или dislike" });
  }

  const items = loadMeta();
  const item = items.find((x) => x.id === req.params.id && !isDeletedItem(x));
  if (!item) {
    return res.status(404).json({ error: "Not found" });
  }

  const userId = req.authUser.id;
  const votes = loadVotes();
  if (!votes[item.id]) votes[item.id] = {};
  const current = votes[item.id][userId];

  if (current === vote) {
    delete votes[item.id][userId];
  } else {
    votes[item.id][userId] = vote;
  }

  saveVotes(votes);
  const enriched = enrichItem(item, req.authUser);
  res.json({
    id: item.id,
    likes: enriched.likes,
    dislikes: enriched.dislikes,
    likedBy: enriched.likedBy,
    dislikedBy: enriched.dislikedBy,
    myVote: enriched.myVote,
  });
});

const GAME_ROUNDS = 5;
const GAME_OPTIONS = 6;
const GAME_ATTEMPTS = 3;
const GAME_ROUND_MAX = 30;
const GAME_MISTAKE_PENALTY = 10;
const GAME_TTL_MS = 60 * 60 * 1000;
const GAME_ONLINE_ROUND_MS = 25000;
/** Solo «проявление»: round length (curtain opens faster on the client). */
const GAME_REVEAL_ROUND_MS = 20000;
const GAME_ONLINE_MAX_PLAYERS = 6;
const GAME_REVEAL_FALLBACK_ARM_MS = 45000;
const GAME_ROUND_REVEAL_MS = 2200;
const GAME_ROUND_PREP_MS = 3000;
const GAME_MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const GAME_PLAY_MODES = new Set(["race", "reveal"]);
const GAME_MEDIA_KINDS = new Set(["any", "image", "video", "audio"]);
const gameSessions = new Map();
const gameRooms = new Map();

function defaultRoomSettings() {
  return {
    rounds: GAME_ROUNDS,
    tag: null,
    media: "any",
    playMode: "race",
    roundSeconds: Math.round(GAME_ONLINE_ROUND_MS / 1000),
  };
}

function clampInt(value, min, max, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeRoomSettings(raw = {}) {
  const base = defaultRoomSettings();
  const tagList = sanitizeTags(raw.tag == null || raw.tag === "" ? [] : [raw.tag]);
  const playMode = GAME_PLAY_MODES.has(String(raw.playMode || "").toLowerCase())
    ? String(raw.playMode).toLowerCase()
    : base.playMode;
  let media = GAME_MEDIA_KINDS.has(String(raw.media || "").toLowerCase())
    ? String(raw.media).toLowerCase()
    : base.media;
  const defaultSec =
    playMode === "reveal"
      ? Math.round(GAME_REVEAL_ROUND_MS / 1000)
      : base.roundSeconds;
  return {
    rounds: clampInt(raw.rounds, 1, 20, base.rounds),
    tag: tagList[0] || null,
    media,
    playMode,
    roundSeconds: clampInt(raw.roundSeconds, 10, 45, defaultSec),
  };
}

function roomRoundMs(room) {
  const sec = Number(room && room.settings && room.settings.roundSeconds);
  if (Number.isFinite(sec) && sec > 0) return Math.round(sec * 1000);
  if (isRevealRoom(room)) return GAME_REVEAL_ROUND_MS;
  return GAME_ONLINE_ROUND_MS;
}

function soloRoundMs(session) {
  if (isRevealSolo(session)) return GAME_REVEAL_ROUND_MS;
  return GAME_ONLINE_ROUND_MS;
}

function moscowDay(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function nextMoscowMidnightMs(now = Date.now()) {
  const day = moscowDay(new Date(now));
  const [y, m, d] = day.split("-").map(Number);
  // Find UTC instant of next Moscow midnight by probing hours around expected range.
  for (let t = Date.UTC(y, m - 1, d, 20, 0, 0); t < Date.UTC(y, m - 1, d + 2, 4, 0, 0); t += 60 * 1000) {
    if (moscowDay(new Date(t)) !== day) return t;
  }
  return now + 24 * 60 * 60 * 1000;
}

function dailyStatusForUser(user) {
  const today = moscowDay();
  const played = Boolean(user && user.lastDailyGameDate === today);
  return {
    available: !played,
    playedToday: played,
    today,
    nextAt: nextMoscowMidnightMs(),
    lastScore: Number(user && user.lastDailyScore) || 0,
    profileScore: Number(user && user.gameScore) || 0,
  };
}

function listGameTags() {
  const counts = new Map();
  for (const item of gameMediaPool({ media: "any" })) {
    for (const tag of sanitizeTags(item.tags || [])) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ru"))
    .slice(0, 80);
}

function shuffleList(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function displayItemTitle(item) {
  return sanitizeTitle(item.title) || item.originalName || "Без названия";
}

function gameMediaPool(options = {}) {
  const media = options.media || "any";
  const tag = options.tag || null;
  const playMode = options.playMode || "race";
  return loadMeta().filter((x) => {
    if (isDeletedItem(x) || !isPublicItem(x) || !x.url) return false;
    const bytes = fileByteSize(x.filename);
    if (bytes > GAME_MAX_MEDIA_BYTES) return false;
    const type =
      x.type === "video"
        ? "video"
        : x.type === "audio"
          ? "audio"
          : (x.type || "image") === "image"
            ? "image"
            : null;
    if (!type) return false;
    if (playMode === "reveal" && type === "audio") return false;
    if (media === "image" && type !== "image") return false;
    if (media === "video" && type !== "video") return false;
    if (media === "audio" && type !== "audio") return false;
    if (tag) {
      const tags = sanitizeTags(x.tags || []);
      if (!tags.includes(tag)) return false;
    }
    return true;
  });
}

function titlesSharingTag(item, pool, excludeTitle) {
  const tags = sanitizeTags(item.tags || []);
  if (!tags.length) return { tag: null, titles: [] };

  let bestTag = null;
  let bestTitles = [];
  for (const tag of tags) {
    const seen = new Set();
    const titles = [];
    for (const other of pool) {
      if (other.id === item.id) continue;
      const otherTags = sanitizeTags(other.tags || []);
      if (!otherTags.includes(tag)) continue;
      const title = displayItemTitle(other);
      if (!title || title === excludeTitle || seen.has(title)) continue;
      seen.add(title);
      titles.push(title);
    }
    if (titles.length > bestTitles.length) {
      bestTag = tag;
      bestTitles = titles;
    }
  }
  return { tag: bestTag, titles: bestTitles };
}

function titlesForPool(pool, excludeTitle = "") {
  const seen = new Set();
  const titles = [];
  for (const item of pool) {
    const title = displayItemTitle(item);
    if (!title || title === excludeTitle || seen.has(title)) continue;
    seen.add(title);
    titles.push(title);
  }
  return titles;
}

function allSiteTitles(excludeTitle = "") {
  return titlesForPool(
    loadMeta().filter((item) => !isDeletedItem(item) && isPublicItem(item)),
    excludeTitle
  );
}

function pickRoundOptions(correct, preferredTitles) {
  const need = Math.max(1, GAME_OPTIONS - 1);
  const seen = new Set([correct]);
  const distractors = [];

  for (const title of shuffleList(preferredTitles || [])) {
    if (!title || seen.has(title)) continue;
    seen.add(title);
    distractors.push(title);
    if (distractors.length >= need) break;
  }

  if (distractors.length < need) {
    for (const title of shuffleList(allSiteTitles(correct))) {
      if (seen.has(title)) continue;
      seen.add(title);
      distractors.push(title);
      if (distractors.length >= need) break;
    }
  }

  return shuffleList([correct, ...distractors]);
}

function loadGameHistory() {
  try {
    const data = JSON.parse(fs.readFileSync(GAME_HISTORY_FILE, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function saveGameHistory(history) {
  fs.writeFileSync(GAME_HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
}

function markGameItemsShown(itemIds) {
  const ids = Array.isArray(itemIds) ? itemIds.filter(Boolean) : [];
  if (!ids.length) return;
  const history = loadGameHistory();
  const now = Date.now();
  for (const id of ids) {
    history[String(id)] = now;
  }
  saveGameHistory(history);
}

/** Higher weight = more likely to appear (long since last shown / never shown). */
function gameItemWeight(itemId, history, now = Date.now()) {
  const last = Number(history[String(itemId)]);
  const age = Number.isFinite(last) && last > 0
    ? Math.max(60_000, now - last)
    : GAME_NEVER_SHOWN_AGE_MS;
  return age * age;
}

function pickWeightedFromPool(pool, history) {
  if (!pool.length) return null;
  const now = Date.now();
  const weights = pool.map((item) => gameItemWeight(item.id, history, now));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (!(total > 0)) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function buildGameRounds(options = {}) {
  const settings = normalizeRoomSettings(options);
  const pool = gameMediaPool(settings);
  if (!pool.length) {
    if (settings.tag) {
      return { error: `Для тега #${settings.tag} мало подходящих файлов` };
    }
    return { error: "Пока нет медиа для игры" };
  }

  const picks = [];
  const usedIds = new Set();
  const usedTitles = new Set();
  const preferredPoolTitles = titlesForPool(pool);
  const history = loadGameHistory();
  const remaining = pool.slice();

  while (picks.length < settings.rounds && remaining.length) {
    const item = pickWeightedFromPool(remaining, history);
    if (!item) break;
    const idx = remaining.findIndex((x) => x.id === item.id);
    if (idx >= 0) remaining.splice(idx, 1);
    if (usedIds.has(item.id)) continue;

    const title = displayItemTitle(item);
    if (!title || usedTitles.has(title)) continue;

    const shared = settings.tag
      ? { tag: settings.tag, titles: preferredPoolTitles.filter((t) => t !== title) }
      : titlesSharingTag(item, pool, title);
    const preferred = shared.titles.length
      ? shared.titles
      : preferredPoolTitles.filter((t) => t !== title);
    const optionsList = pickRoundOptions(title, preferred);
    if (optionsList.length < 2) continue;

    const mediaType =
      item.type === "video" ? "video" : item.type === "audio" ? "audio" : "image";

    picks.push({
      itemId: item.id,
      mediaUrl: item.url,
      mediaType,
      tag: shared.tag || settings.tag || null,
      correct: title,
      options: optionsList,
    });
    usedIds.add(item.id);
    usedTitles.add(title);
  }

  if (!picks.length) {
    return { error: "Не удалось собрать раунды с этими настройками" };
  }

  markGameItemsShown(picks.map((r) => r.itemId));
  return { rounds: picks, settings };
}

function cleanupGameSessions() {
  const now = Date.now();
  for (const [id, session] of gameSessions.entries()) {
    if (session.finished || now - session.createdAt > GAME_TTL_MS) {
      gameSessions.delete(id);
    }
  }
  for (const [code, room] of gameRooms.entries()) {
    if (now - room.createdAt > GAME_TTL_MS) gameRooms.delete(code);
  }
}

function soloRoundState(base, playerState, index) {
  return {
    index,
    mediaUrl: base.mediaUrl,
    mediaType: base.mediaType,
    imageUrl: base.mediaUrl,
    tag: base.tag,
    options: base.options,
    attemptsLeft: playerState.attemptsLeft,
    done: playerState.done,
    score: playerState.done ? playerState.score : null,
    wrongPicked: playerState.wrongPicked || [],
  };
}

function publicGameRound(round, index) {
  return soloRoundState(
    round,
    {
      attemptsLeft: round.attemptsLeft,
      done: round.done,
      score: round.score,
      wrongPicked: round.wrongPicked || [],
    },
    index
  );
}

function isTimedSolo(session) {
  return session && (session.mode === "daily" || session.mode === "reveal");
}

function isRevealSolo(session) {
  return session && (session.mode === "reveal" || session.playMode === "reveal");
}

function isRevealRoom(room) {
  return Boolean(room && room.settings && room.settings.playMode === "reveal");
}

function armSoloRoundClock(session, { force = false } = {}) {
  if (!session) return false;
  if (session.roundStartedAt && !force) return false;
  session.roundStartedAt = Date.now();
  return true;
}

function armRoomRoundClock(room) {
  if (!room || room.roundStartedAt) return false;
  room.roundStartedAt = Date.now();
  room.countdownEndsAt = null;
  return true;
}

function ensurePlayerState(room, userId) {
  if (!room.playerState[userId]) {
    room.playerState[userId] = {
      mistakes: 0,
      attemptsLeft: GAME_ATTEMPTS,
      done: false,
      score: 0,
      wrongPicked: [],
      correct: false,
      scored: false,
    };
  }
  if (typeof room.playerState[userId].scored !== "boolean") {
    room.playerState[userId].scored = false;
  }
  return room.playerState[userId];
}

function resetRoomRoundStates(room) {
  room.playerState = {};
  for (const player of room.players) {
    room.playerState[player.userId] = {
      mistakes: 0,
      attemptsLeft: GAME_ATTEMPTS,
      done: false,
      score: 0,
      wrongPicked: [],
      correct: false,
      scored: false,
    };
  }
  const now = Date.now();
  room.roundArmedAt = now;
  room.roundStartedAt = null;
  room.countdownEndsAt = null;
  room.roundPhase = "prep";
  room.phaseEndsAt = now + GAME_ROUND_PREP_MS;
  room.revealTitle = null;
}

function clearLobbyReady(room) {
  if (!room || !Array.isArray(room.players)) return;
  for (const player of room.players) {
    player.lobbyReady = false;
  }
}

function allLobbyReady(room) {
  return (
    Array.isArray(room.players) &&
    room.players.length >= 2 &&
    room.players.every((p) => Boolean(p.lobbyReady))
  );
}

function syncOnlineRoomPhases(room) {
  if (!room || room.status !== "playing" || room.finished) return;
  const now = Date.now();

  if (room.roundPhase === "prep" && room.phaseEndsAt && now >= room.phaseEndsAt) {
    room.roundPhase = "playing";
    room.phaseEndsAt = null;
    room.roundStartedAt = now;
    room.revealTitle = null;
    return;
  }

  if (room.roundPhase === "reveal" && room.phaseEndsAt && now >= room.phaseEndsAt) {
    if (room.roundIndex >= room.rounds.length - 1) {
      room.status = "finished";
      room.finished = true;
      room.scoresSaved = true;
      room.roundPhase = null;
      room.phaseEndsAt = null;
      room.revealTitle = null;
      return;
    }
    room.roundIndex += 1;
    resetRoomRoundStates(room);
  }
}

function ensureRoomRoundClock(room) {
  if (!room || room.roundStartedAt) return;
  if (room.roundPhase === "prep" || room.roundPhase === "reveal") return;
  if (!isRevealRoom(room)) {
    room.roundStartedAt = Date.now();
    room.roundPhase = "playing";
    return;
  }
  const armed = room.roundArmedAt || room.createdAt || Date.now();
  if (Date.now() - armed >= GAME_REVEAL_FALLBACK_ARM_MS) {
    room.roundStartedAt = Date.now();
    room.roundPhase = "playing";
  }
}

function playerAvatarUrl(userId) {
  const user = auth.findUserById(userId);
  return (user && user.avatarUrl) || null;
}

function playerSiteFlags(userId) {
  const user = auth.findUserById(userId);
  if (!user) return { isAdmin: false, isModerator: false };
  const isAdmin = Boolean(auth.userIsAdmin(user));
  return {
    isAdmin,
    isModerator: isAdmin ? false : Boolean(auth.userIsModerator(user)),
  };
}

function removePlayerFromRoom(room, userId) {
  if (!room || !Array.isArray(room.players)) return { removed: false, empty: true };
  const before = room.players.length;
  room.players = room.players.filter((p) => p.userId !== userId);
  if (room.playerState && room.playerState[userId]) {
    delete room.playerState[userId];
  }
  if (Array.isArray(room.rematchPlayers)) {
    room.rematchPlayers = room.rematchPlayers.filter((id) => id !== userId);
  }
  const removed = room.players.length < before;
  if (!room.players.length) {
    gameRooms.delete(room.code);
    return { removed, empty: true };
  }
  if (room.hostId === userId) {
    room.hostId = room.players[0].userId;
  }
  if (room.status === "lobby") {
    clearLobbyReady(room);
  }
  return { removed, empty: false };
}

function ensureSoloRoundClock(session) {
  if (!isTimedSolo(session)) return;
  if (session.roundStartedAt) return;
  if (!isRevealSolo(session)) {
    session.roundStartedAt = Date.now();
    return;
  }
  const armed = session.roundArmedAt || session.createdAt || Date.now();
  if (Date.now() - armed >= GAME_REVEAL_FALLBACK_ARM_MS) {
    session.roundStartedAt = Date.now();
  }
}

function publicGameState(session) {
  advanceSoloIfNeeded(session);
  const round = session.rounds[session.roundIndex];
  const timed = isTimedSolo(session);
  const clockLive = timed && Boolean(session.roundStartedAt);
  const roundMs = soloRoundMs(session);
  const endsAt =
    clockLive && !session.finished && round && !round.done
      ? session.roundStartedAt + roundMs
      : null;
  return {
    gameId: session.id,
    mode: session.mode || "fun",
    playMode: session.playMode || (session.mode === "reveal" ? "reveal" : "race"),
    roundIndex: session.roundIndex,
    totalRounds: session.rounds.length,
    totalScore: session.totalScore,
    finished: session.finished,
    endsAt,
    roundStartedAt: clockLive && !session.finished ? session.roundStartedAt : null,
    roundMs,
    clockArmed: clockLive,
    waitingForMedia: timed && isRevealSolo(session) && !session.roundStartedAt && !session.finished,
    countsForProfile: session.mode === "daily",
    round: round && !session.finished ? publicGameRound(round, session.roundIndex) : null,
    gameScore: null,
  };
}

function finishSoloSession(session, user) {
  if (!session.finished || session.scoreSaved) return null;
  session.scoreSaved = true;
  if (session.mode !== "daily" || !user) {
    return { user, added: 0, gameScore: Number(user && user.gameScore) || 0 };
  }
  const saved = auth.addGameScore(user.id, session.totalScore);
  if (saved.error) return null;
  const marked = auth.markDailyPlayed(user.id, moscowDay(), session.totalScore);
  return {
    user: (marked && marked.user) || saved.user,
    added: saved.added,
    gameScore: saved.gameScore,
  };
}

function advanceSoloRound(session) {
  if (session.roundIndex >= session.rounds.length - 1) {
    session.finished = true;
    return false;
  }
  session.roundIndex += 1;
  if (isTimedSolo(session)) {
    if (isRevealSolo(session)) {
      session.roundStartedAt = null;
      session.roundArmedAt = Date.now();
    } else {
      session.roundStartedAt = Date.now();
      session.roundArmedAt = session.roundStartedAt;
    }
  }
  return true;
}

function advanceSoloIfNeeded(session) {
  if (!session || session.finished || !isTimedSolo(session)) return false;
  const round = session.rounds[session.roundIndex];
  if (!round || round.done) return false;
  ensureSoloRoundClock(session);
  if (!session.roundStartedAt) return false;
  if (Date.now() - session.roundStartedAt < soloRoundMs(session)) return false;
  round.done = true;
  round.score = 0;
  advanceSoloRound(session);
  return true;
}

function buildGameSession(userId, modeRaw) {
  cleanupGameSessions();
  const raw = String(modeRaw || "fun").toLowerCase();
  const mode = raw === "daily" ? "daily" : raw === "reveal" ? "reveal" : "fun";
  const playMode = mode === "reveal" ? "reveal" : "race";
  const built = buildGameRounds(
    mode === "reveal" ? { media: "any", playMode: "reveal", rounds: GAME_ROUNDS } : {}
  );
  if (built.error) return built;

  const picks = built.rounds.map((round) => ({
    ...round,
    mistakes: 0,
    attemptsLeft: GAME_ATTEMPTS,
    done: false,
    score: 0,
    wrongPicked: [],
  }));

  const id = `g_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const now = Date.now();
  const timed = mode === "daily" || mode === "reveal";
  const session = {
    id,
    userId,
    mode,
    playMode,
    createdAt: now,
    roundIndex: 0,
    totalScore: 0,
    finished: false,
    scoreSaved: false,
    roundArmedAt: timed ? now : null,
    // В проявлении часы стартуют только после загрузки картинки (ready).
    roundStartedAt: mode === "daily" ? now : null,
    rounds: picks,
  };
  gameSessions.set(id, session);
  return { session };
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

function onlineSpeedScore(elapsedMs, mistakes) {
  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const speed = Math.max(5, GAME_ROUND_MAX - elapsedSec * 2);
  return Math.max(0, speed - mistakes * GAME_MISTAKE_PENALTY);
}

function advanceOnlineRoomIfNeeded(room) {
  if (room.status !== "playing" || room.finished) return;
  syncOnlineRoomPhases(room);
  if (room.status !== "playing" || room.finished) return;
  if (room.roundPhase === "reveal" || room.roundPhase === "prep") return;

  const base = room.rounds[room.roundIndex];
  if (!base) return;

  ensureRoomRoundClock(room);
  if (!room.roundStartedAt) return;

  const allDone = room.players.every((p) => {
    const st = ensurePlayerState(room, p.userId);
    return st.done;
  });
  const timedOut = Date.now() - room.roundStartedAt >= roomRoundMs(room);
  if (!allDone && !timedOut) return;

  for (const player of room.players) {
    const st = ensurePlayerState(room, player.userId);
    if (!st.done) {
      st.done = true;
      st.score = 0;
    }
    if (!st.scored) {
      player.score = (player.score || 0) + (st.score || 0);
      st.scored = true;
    }
  }

  room.roundPhase = "reveal";
  room.phaseEndsAt = Date.now() + GAME_ROUND_REVEAL_MS;
  room.revealTitle = base.correct;
}

function publicOnlineRoom(room, viewerId) {
  advanceOnlineRoomIfNeeded(room);
  const base = room.rounds[room.roundIndex];
  const myState =
    viewerId && room.status === "playing" ? ensurePlayerState(room, viewerId) : null;
  const roundMs = roomRoundMs(room);
  const clockLive = Boolean(room.roundStartedAt) && room.roundPhase === "playing";
  const endsAt =
    room.status === "playing" && clockLive ? room.roundStartedAt + roundMs : null;
  const settings = room.settings || defaultRoomSettings();
  const me = room.players.find((p) => p.userId === viewerId) || null;
  const showReveal = room.roundPhase === "reveal";

  return {
    mode: "online",
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    isHost: viewerId === room.hostId,
    settings,
    playMode: settings.playMode,
    roundMs,
    roundStartedAt: room.status === "playing" && clockLive ? room.roundStartedAt : null,
    clockArmed: room.status === "playing" && clockLive,
    roundPhase: room.roundPhase || "playing",
    phaseEndsAt: room.phaseEndsAt || null,
    prepMs: GAME_ROUND_PREP_MS,
    revealTitle: showReveal ? room.revealTitle || (base && base.correct) || null : null,
    waitingForMedia:
      room.status === "playing" && isRevealRoom(room) && room.roundPhase === "playing" && !clockLive,
    lobbyReady: Boolean(me && me.lobbyReady),
    allLobbyReady: room.status === "lobby" ? allLobbyReady(room) : false,
    players: room.players
      .map((p) => {
        const st =
          room.status === "playing" ? ensurePlayerState(room, p.userId) : null;
        const live =
          st && st.done && !st.scored
            ? (p.score || 0) + (st.score || 0)
            : p.score || 0;
        const flags = playerSiteFlags(p.userId);
        return {
          userId: p.userId,
          username: p.username,
          avatarUrl: playerAvatarUrl(p.userId),
          score: live,
          done: Boolean(st && st.done),
          lobbyReady: Boolean(p.lobbyReady),
          isYou: p.userId === viewerId,
          isHost: p.userId === room.hostId,
          isAdmin: flags.isAdmin,
          isModerator: flags.isModerator,
          rematch: Array.isArray(room.rematchPlayers)
            ? room.rematchPlayers.includes(p.userId)
            : false,
        };
      })
      .sort((a, b) => {
        if (room.status === "lobby") {
          if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
          return a.username.localeCompare(b.username, "ru");
        }
        return b.score - a.score || a.username.localeCompare(b.username, "ru");
      }),
    roundIndex: room.roundIndex,
    totalRounds: (room.rounds && room.rounds.length) || settings.rounds,
    endsAt,
    finished: room.finished,
    rematchCode: room.rematchCode || null,
    rematchCount: Array.isArray(room.rematchPlayers) ? room.rematchPlayers.length : 0,
    rematchReady: Boolean(
      Array.isArray(room.rematchPlayers) && room.rematchPlayers.includes(viewerId)
    ),
    rematchFrom: room.rematchFrom || null,
    round:
      room.status === "playing" && base && myState
        ? {
            index: room.roundIndex,
            mediaUrl: base.mediaUrl,
            mediaType: base.mediaType,
            imageUrl: base.mediaUrl,
            tag: base.tag,
            options: base.options,
            attemptsLeft: myState.attemptsLeft,
            done: myState.done || showReveal || room.roundPhase === "prep",
            score: myState.done ? myState.score : null,
            wrongPicked: myState.wrongPicked || [],
            revealed:
              showReveal || myState.done ? base.correct : null,
          }
        : null,
    myScore: (() => {
      const p = room.players.find((x) => x.userId === viewerId);
      const st = myState;
      if (st && st.done && !st.scored) {
        return (p?.score || 0) + (st.score || 0);
      }
      return p?.score || 0;
    })(),
  };
}

app.get("/api/game/status", (req, res) => {
  const tags = listGameTags();
  if (!req.authUser) {
    return res.json({
      authenticated: false,
      tags,
      daily: {
        available: false,
        playedToday: false,
        today: moscowDay(),
        nextAt: nextMoscowMidnightMs(),
        lastScore: 0,
        profileScore: 0,
      },
    });
  }
  const fresh = auth.findUserById(req.authUser.id) || req.authUser;
  res.json({
    authenticated: true,
    user: auth.publicUser(fresh),
    daily: dailyStatusForUser(fresh),
    tags,
  });
});

function sendBlockMediaPool(req, res, label) {
  const pool = gameMediaPool({ media: "any", playMode: "reveal" });
  if (pool.length < 4) {
    return res.status(400).json({ error: `Мало фото/видео на стене для ${label}` });
  }

  const images = pool.filter((x) => (x.type || "image") === "image");
  const videos = pool.filter((x) => x.type === "video");
  const history = loadGameHistory();
  const picks = [];
  const used = new Set();

  // Все видео со стены участвуют без лимита
  for (const item of shuffleList(videos)) {
    used.add(item.id);
    picks.push(item);
  }

  const takeFrom = (source, n) => {
    const remaining = source.filter((x) => !used.has(x.id));
    while (picks.length < n && remaining.length) {
      const item = pickWeightedFromPool(remaining, history);
      if (!item) break;
      const idx = remaining.findIndex((x) => x.id === item.id);
      if (idx >= 0) remaining.splice(idx, 1);
      if (used.has(item.id)) continue;
      used.add(item.id);
      picks.push(item);
    }
  };

  // Фото — для разнообразия кубиков, но видео уже все в пуле
  const imageCap = Math.min(images.length, Math.max(40, Number(req.query.images) || 120));
  takeFrom(images, picks.length + imageCap);
  if (picks.length < 8) takeFrom(pool, 8);

  res.json({
    items: shuffleList(picks).map((item) => {
      const type = item.type === "video" ? "video" : "image";
      const name = `${item.filename || ""} ${item.originalName || ""} ${item.url || ""}`;
      const animated = type === "image" && /\.(gif|webp)(\?|#|$)/i.test(name);
      return {
        id: item.id,
        url: item.url,
        type,
        title: displayItemTitle(item) || item.originalName || item.id,
        animated,
      };
    }),
    totals: {
      videos: videos.length,
      images: images.length,
      used: picks.length,
    },
  });
}

app.get("/api/game/tetris/media", (req, res) => sendBlockMediaPool(req, res, "тетриса"));
app.get("/api/game/blockblast/media", (req, res) => sendBlockMediaPool(req, res, "Block Blast"));

app.post("/api/game/start", (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ error: "Войдите, чтобы играть" });
  }
  const muteMsg = muteBlockMessage(req.authUser);
  if (muteMsg) return res.status(403).json({ error: muteMsg });

  const fresh = auth.findUserById(req.authUser.id) || req.authUser;
  const rawMode = String((req.body && req.body.mode) || "fun").toLowerCase();
  const mode = rawMode === "daily" ? "daily" : rawMode === "reveal" ? "reveal" : "fun";
  if (mode === "daily") {
    const daily = dailyStatusForUser(fresh);
    if (!daily.available) {
      return res.status(400).json({
        error: "Ежедневка уже пройдена сегодня. Новая — после полуночи по Москве.",
        daily,
      });
    }
    // Резервируем слот на сегодня сразу, чтобы нельзя было крутить несколько заходов.
    auth.markDailyPlayed(fresh.id, moscowDay(), Number(fresh.lastDailyScore) || 0);
  }

  const built = buildGameSession(fresh.id, mode);
  if (built.error) return res.status(400).json({ error: built.error });
  res.json(publicGameState(built.session));
});

app.post("/api/game/ready", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Войдите, чтобы играть" });
  const gameId = String((req.body && req.body.gameId) || "");
  const session = gameSessions.get(gameId);
  if (!session || session.userId !== req.authUser.id) {
    return res.status(404).json({ error: "Игра не найдена" });
  }
  if (session.finished) {
    return res.json(publicGameState(session));
  }
  if (isRevealSolo(session)) {
    // Часы всегда стартуют в момент ready — после клиентского отсчёта.
    armSoloRoundClock(session, { force: true });
  } else if (isTimedSolo(session) && !session.roundStartedAt) {
    armSoloRoundClock(session);
  }
  res.json(publicGameState(session));
});

app.get("/api/game/rooms", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  cleanupGameSessions();
  const rooms = [];
  for (const room of gameRooms.values()) {
    if (!room || room.status !== "lobby" || room.finished) continue;
    const settings = room.settings || defaultRoomSettings();
    rooms.push({
      code: room.code,
      players: room.players.length,
      maxPlayers: GAME_ONLINE_MAX_PLAYERS,
      hostName:
        (room.players.find((p) => p.userId === room.hostId) || {}).username || "?",
      playMode: settings.playMode || "race",
      rounds: settings.rounds || GAME_ROUNDS,
      media: settings.media || "any",
      tag: settings.tag || null,
      createdAt: room.createdAt || 0,
    });
  }
  rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json({ rooms });
});

app.get("/api/game/:gameId", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Войдите, чтобы играть" });
  const session = gameSessions.get(String(req.params.gameId || ""));
  if (!session || session.userId !== req.authUser.id) {
    return res.status(404).json({ error: "Игра не найдена" });
  }
  const before = session.finished;
  advanceSoloIfNeeded(session);
  let profileGameScore = null;
  let user = null;
  if (session.finished && !before) {
    const saved = finishSoloSession(session, req.authUser);
    if (saved) {
      profileGameScore = saved.gameScore;
      req.authUser = saved.user;
      user = auth.publicUser(req.authUser);
    }
  } else if (session.finished) {
    finishSoloSession(session, req.authUser);
  }
  res.json({
    ...publicGameState(session),
    profileGameScore,
    user,
    daily: dailyStatusForUser(req.authUser),
  });
});

app.post("/api/game/guess", (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ error: "Войдите, чтобы играть" });
  }
  const gameId = String((req.body && req.body.gameId) || "");
  const option = String((req.body && req.body.option) || "").trim();
  const session = gameSessions.get(gameId);
  if (!session || session.userId !== req.authUser.id) {
    return res.status(404).json({ error: "Игра не найдена. Начните новую." });
  }

  const timedOut = advanceSoloIfNeeded(session);
  if (session.finished) {
    const saved = finishSoloSession(session, req.authUser);
    const user = saved && saved.user ? saved.user : req.authUser;
    return res.json({
      correct: false,
      timedOut: Boolean(timedOut),
      finished: true,
      totalScore: session.totalScore,
      roundIndex: session.roundIndex,
      totalRounds: session.rounds.length,
      mode: session.mode,
      profileGameScore: saved ? saved.gameScore : null,
      user: auth.publicUser(user),
      round: null,
      daily: dailyStatusForUser(user),
    });
  }
  if (timedOut) {
    return res.json({
      correct: false,
      timedOut: true,
      finished: false,
      totalScore: session.totalScore,
      roundIndex: session.roundIndex,
      totalRounds: session.rounds.length,
      mode: session.mode,
      endsAt: session.roundStartedAt + soloRoundMs(session),
      roundMs: soloRoundMs(session),
      countsForProfile: session.mode === "daily",
      round: publicGameRound(session.rounds[session.roundIndex], session.roundIndex),
      profileGameScore: null,
      user: null,
      daily: dailyStatusForUser(req.authUser),
    });
  }

  const round = session.rounds[session.roundIndex];
  if (!round || round.done) {
    return res.status(400).json({ error: "Раунд уже завершён" });
  }
  if (!round.options.includes(option)) {
    return res.status(400).json({ error: "Такого варианта нет" });
  }
  if (round.wrongPicked.includes(option)) {
    return res.status(400).json({ error: "Этот вариант уже выбран" });
  }

  let correct = false;
  let revealed = null;
  if (option === round.correct) {
    correct = true;
    round.done = true;
    if (isTimedSolo(session)) {
      if (!session.roundStartedAt) armSoloRoundClock(session);
      round.score = onlineSpeedScore(Date.now() - (session.roundStartedAt || Date.now()), round.mistakes);
    } else {
      round.score = Math.max(0, GAME_ROUND_MAX - round.mistakes * GAME_MISTAKE_PENALTY);
    }
    session.totalScore += round.score;
    revealed = round.correct;
  } else {
    round.mistakes += 1;
    round.attemptsLeft = Math.max(0, GAME_ATTEMPTS - round.mistakes);
    round.wrongPicked.push(option);
    if (round.mistakes >= GAME_ATTEMPTS) {
      round.done = true;
      round.score = 0;
      revealed = round.correct;
    }
  }

  let advanced = false;
  if (round.done) {
    advanced = advanceSoloRound(session);
  }

  let profileScore = null;
  let savedUser = null;
  if (session.finished) {
    const saved = finishSoloSession(session, req.authUser);
    if (saved) {
      profileScore = saved.gameScore;
      req.authUser = saved.user;
      savedUser = auth.publicUser(req.authUser);
    }
  }

  res.json({
    correct,
    revealed,
    mistakes: round.mistakes,
    attemptsLeft: round.attemptsLeft,
    roundDone: round.done,
    roundScore: round.done ? round.score : null,
    wrongPicked: round.wrongPicked,
    advanced,
    finished: session.finished,
    totalScore: session.totalScore,
    roundIndex: session.roundIndex,
    totalRounds: session.rounds.length,
    mode: session.mode,
    endsAt:
      isTimedSolo(session) && !session.finished && session.roundStartedAt
        ? session.roundStartedAt + soloRoundMs(session)
        : null,
    roundStartedAt: isTimedSolo(session) && !session.finished ? session.roundStartedAt : null,
    roundMs: soloRoundMs(session),
    playMode: session.playMode || (session.mode === "reveal" ? "reveal" : "race"),
    countsForProfile: session.mode === "daily",
    round:
      !session.finished && advanced
        ? publicGameRound(session.rounds[session.roundIndex], session.roundIndex)
        : !session.finished && !round.done
          ? publicGameRound(round, session.roundIndex)
          : null,
    profileGameScore: profileScore,
    user: savedUser,
    daily: dailyStatusForUser(req.authUser),
  });
});

app.post("/api/game/room/create", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Войдите, чтобы создать комнату" });
  const muteMsg = muteBlockMessage(req.authUser);
  if (muteMsg) return res.status(403).json({ error: muteMsg });
  cleanupGameSessions();

  const settings = normalizeRoomSettings((req.body && req.body.settings) || req.body || {});

  let code = makeRoomCode();
  while (gameRooms.has(code)) code = makeRoomCode();

  const room = {
    code,
    hostId: req.authUser.id,
    createdAt: Date.now(),
    status: "lobby",
    finished: false,
    scoresSaved: false,
    settings,
    players: [
      {
        userId: req.authUser.id,
        username: req.authUser.username,
        score: 0,
        lobbyReady: false,
      },
    ],
    rounds: [],
    roundIndex: 0,
    roundStartedAt: null,
    roundArmedAt: null,
    playerState: {},
    rematchCode: null,
    rematchPlayers: [],
    rematchFrom: null,
  };
  gameRooms.set(code, room);
  res.json(publicOnlineRoom(room, req.authUser.id));
});

app.post("/api/game/room/rematch", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const muteMsg = muteBlockMessage(req.authUser);
  if (muteMsg) return res.status(403).json({ error: muteMsg });
  cleanupGameSessions();

  const code = String((req.body && req.body.code) || "")
    .trim()
    .toUpperCase();
  const room = gameRooms.get(code);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });
  if (!(room.finished || room.status === "finished")) {
    return res.status(400).json({ error: "Реванш доступен только после матча" });
  }
  if (!room.players.some((p) => p.userId === req.authUser.id)) {
    return res.status(403).json({ error: "Вы не в этой комнате" });
  }

  // Старая схема: та же комната снова становится лобби с тем же составом.
  room.status = "lobby";
  room.finished = false;
  room.scoresSaved = false;
  room.rounds = [];
  room.roundIndex = 0;
  room.roundStartedAt = null;
  room.roundArmedAt = null;
  room.countdownEndsAt = null;
  room.playerState = {};
  room.rematchCode = null;
  room.rematchPlayers = [];
  room.rematchFrom = null;
  room.settings = normalizeRoomSettings(room.settings || {});
  for (const player of room.players) {
    player.score = 0;
    player.lobbyReady = false;
  }

  res.json(publicOnlineRoom(room, req.authUser.id));
});

app.post("/api/game/room/settings", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const code = String((req.body && req.body.code) || "")
    .trim()
    .toUpperCase();
  const room = gameRooms.get(code);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });
  if (room.hostId !== req.authUser.id) {
    return res.status(403).json({ error: "Только хост меняет настройки" });
  }
  if (room.status !== "lobby") {
    return res.status(400).json({ error: "Настройки можно менять только в лобби" });
  }
  room.settings = normalizeRoomSettings((req.body && req.body.settings) || req.body || {});
  clearLobbyReady(room);
  res.json(publicOnlineRoom(room, req.authUser.id));
});

app.post("/api/game/room/join", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Войдите, чтобы войти в комнату" });
  const muteMsg = muteBlockMessage(req.authUser);
  if (muteMsg) return res.status(403).json({ error: muteMsg });
  const code = String((req.body && req.body.code) || "")
    .trim()
    .toUpperCase();
  const room = gameRooms.get(code);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });
  if (room.status !== "lobby") {
    return res.status(400).json({ error: "Игра уже началась" });
  }
  if (room.players.some((p) => p.userId === req.authUser.id)) {
    return res.json(publicOnlineRoom(room, req.authUser.id));
  }
  if (room.players.length >= GAME_ONLINE_MAX_PLAYERS) {
    return res.status(400).json({ error: "Комната заполнена" });
  }
  room.players.push({
    userId: req.authUser.id,
    username: req.authUser.username,
    score: 0,
    lobbyReady: false,
  });
  clearLobbyReady(room);
  res.json(publicOnlineRoom(room, req.authUser.id));
});

app.post("/api/game/room/lobby-ready", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const code = String((req.body && req.body.code) || "")
    .trim()
    .toUpperCase();
  const room = gameRooms.get(code);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });
  if (room.status !== "lobby") {
    return res.status(400).json({ error: "Готовность только в лобби" });
  }
  const player = room.players.find((p) => p.userId === req.authUser.id);
  if (!player) return res.status(403).json({ error: "Вы не в этой комнате" });
  const raw = req.body && req.body.ready;
  player.lobbyReady =
    raw == null ? !player.lobbyReady : Boolean(raw);
  res.json(publicOnlineRoom(room, req.authUser.id));
});

app.post("/api/game/room/leave", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const code = String((req.body && req.body.code) || "")
    .trim()
    .toUpperCase();
  const room = gameRooms.get(code);
  if (!room) return res.json({ ok: true, left: true, empty: true });
  if (!room.players.some((p) => p.userId === req.authUser.id)) {
    return res.json({ ok: true, left: true, empty: false });
  }
  const result = removePlayerFromRoom(room, req.authUser.id);
  res.json({ ok: true, left: true, empty: Boolean(result.empty) });
});

app.post("/api/game/room/kick", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const code = String((req.body && req.body.code) || "")
    .trim()
    .toUpperCase();
  const targetId = String((req.body && req.body.userId) || "").trim();
  const room = gameRooms.get(code);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });
  if (room.hostId !== req.authUser.id) {
    return res.status(403).json({ error: "Кикать может только хост лобби" });
  }
  if (room.status !== "lobby") {
    return res.status(400).json({ error: "Кик только в лобби" });
  }
  if (!targetId || targetId === req.authUser.id) {
    return res.status(400).json({ error: "Нельзя кикнуть себя" });
  }
  if (!room.players.some((p) => p.userId === targetId)) {
    return res.status(404).json({ error: "Игрок не в комнате" });
  }
  removePlayerFromRoom(room, targetId);
  res.json(publicOnlineRoom(room, req.authUser.id));
});

app.post("/api/game/room/start", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const code = String((req.body && req.body.code) || "")
    .trim()
    .toUpperCase();
  const room = gameRooms.get(code);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });
  if (room.hostId !== req.authUser.id) {
    return res.status(403).json({ error: "Только хост может начать" });
  }
  if (room.status !== "lobby") {
    return res.status(400).json({ error: "Игра уже идёт" });
  }
  if (room.players.length < 2) {
    return res.status(400).json({ error: "Нужен хотя бы ещё один игрок" });
  }
  if (!allLobbyReady(room)) {
    return res.status(400).json({ error: "Все игроки должны нажать «Готов»" });
  }

  room.settings = normalizeRoomSettings(room.settings || {});
  const built = buildGameRounds(room.settings);
  if (built.error) return res.status(400).json({ error: built.error });
  room.rounds = built.rounds;
  room.settings = built.settings || room.settings;
  room.status = "playing";
  room.roundIndex = 0;
  resetRoomRoundStates(room);
  res.json(publicOnlineRoom(room, req.authUser.id));
});

app.post("/api/game/room/ready", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const code = String((req.body && req.body.code) || "")
    .trim()
    .toUpperCase();
  const room = gameRooms.get(code);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });
  if (!room.players.some((p) => p.userId === req.authUser.id)) {
    return res.status(403).json({ error: "Вы не в этой комнате" });
  }
  if (room.status === "playing" && room.roundPhase === "playing" && isRevealRoom(room) && !room.roundStartedAt) {
    room.roundStartedAt = Date.now();
  }
  res.json(publicOnlineRoom(room, req.authUser.id));
});

app.get("/api/game/room/:code", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();
  const room = gameRooms.get(code);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });
  if (!room.players.some((p) => p.userId === req.authUser.id)) {
    return res.status(403).json({ error: "Вы не в этой комнате" });
  }
  res.json(publicOnlineRoom(room, req.authUser.id));
});

app.post("/api/game/room/guess", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const code = String((req.body && req.body.code) || "")
    .trim()
    .toUpperCase();
  const option = String((req.body && req.body.option) || "").trim();
  const room = gameRooms.get(code);
  if (!room) return res.status(404).json({ error: "Комната не найдена" });
  if (!room.players.some((p) => p.userId === req.authUser.id)) {
    return res.status(403).json({ error: "Вы не в этой комнате" });
  }
  advanceOnlineRoomIfNeeded(room);
  ensureRoomRoundClock(room);
  if (room.status !== "playing") {
    return res.status(400).json({ error: "Раунд сейчас недоступен" });
  }
  if (room.roundPhase && room.roundPhase !== "playing") {
    return res.status(400).json({ error: "Раунд ещё не начался" });
  }
  if (!room.roundStartedAt) {
    return res.status(400).json({ error: "Раунд ещё не начался" });
  }
  const base = room.rounds[room.roundIndex];
  const st = ensurePlayerState(room, req.authUser.id);
  if (st.done) return res.status(400).json({ error: "Вы уже закончили раунд" });
  if (!base.options.includes(option)) {
    return res.status(400).json({ error: "Такого варианта нет" });
  }
  if (st.wrongPicked.includes(option)) {
    return res.status(400).json({ error: "Этот вариант уже выбран" });
  }

  let correct = false;
  if (option === base.correct) {
    correct = true;
    st.done = true;
    st.correct = true;
    st.score = onlineSpeedScore(Date.now() - room.roundStartedAt, st.mistakes);
  } else {
    st.mistakes += 1;
    st.attemptsLeft = Math.max(0, GAME_ATTEMPTS - st.mistakes);
    st.wrongPicked.push(option);
    if (st.mistakes >= GAME_ATTEMPTS) {
      st.done = true;
      st.score = 0;
    }
  }

  advanceOnlineRoomIfNeeded(room);
  const state = publicOnlineRoom(room, req.authUser.id);
  res.json({
    ...state,
    correct,
    roundDone: st.done,
    roundScore: st.done ? st.score : null,
    attemptsLeft: st.attemptsLeft,
    wrongPicked: st.wrongPicked,
    revealed: st.done ? base.correct : null,
  });
});

app.get("/api/items/:id/comments", (req, res) => {
  const items = loadMeta();
  const item = items.find((x) => x.id === req.params.id && !isDeletedItem(x));
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ comments: commentsForItem(item.id) });
});

app.post("/api/items/:id/comments", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Войдите, чтобы комментировать" });
  const muteMsg = muteBlockMessage(req.authUser);
  if (muteMsg) return res.status(403).json({ error: muteMsg });

  commentImageUpload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Ошибка загрузки картинки" });
    }

    const text = sanitizeComment(req.body && req.body.text);
    const imageUrl = req.file ? `/uploads/comments/${req.file.filename}` : null;
    if (!text && !imageUrl) {
      return res.status(400).json({ error: "Нужен текст или картинка" });
    }

    const items = loadMeta();
    const item = items.find((x) => x.id === req.params.id && !isDeletedItem(x));
    if (!item) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "Not found" });
    }

    const comment = {
      id: `c_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`,
      userId: req.authUser.id,
      username: req.authUser.username,
      text: text || "",
      imageUrl,
      createdAt: Date.now(),
    };
    const store = loadCommentsStore();
    if (!Array.isArray(store[item.id])) store[item.id] = [];
    store[item.id].push(comment);
    saveCommentsStore(store);
    writeAudit("comment.create", req.authUser, {
      targetType: "comment",
      targetId: comment.id,
      targetLabel: item.title || item.id,
      meta: { itemId: item.id, text: comment.text, imageUrl },
    });
    res.status(201).json({ comment });
  });
});

app.delete("/api/items/:id/comments/:commentId", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });
  const store = loadCommentsStore();
  const list = Array.isArray(store[req.params.id]) ? store[req.params.id] : [];
  const idx = list.findIndex((c) => c.id === req.params.commentId);
  if (idx === -1) return res.status(404).json({ error: "Комментарий не найден" });
  const comment = list[idx];
  const ownerOk = comment.userId === req.authUser.id;
  const staffOk = auth.userIsStaff(req.authUser);
  if (!ownerOk && !staffOk) return res.status(403).json({ error: "Нет доступа" });
  list.splice(idx, 1);
  store[req.params.id] = list;
  saveCommentsStore(store);
  writeAudit("comment.delete", req.authUser, {
    targetType: "comment",
    targetId: comment.id,
    targetLabel: comment.username,
    meta: { itemId: req.params.id, text: comment.text },
  });
  res.json({ ok: true });
});

app.get("/api/download/:id", (req, res) => {
  const items = loadMeta();
  const item = items.find((x) => x.id === req.params.id && !isDeletedItem(x));
  if (!item) {
    return res.status(404).json({ error: "Not found" });
  }
  const filePath = path.join(UPLOADS, item.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File missing" });
  }
  const type = item.type || "image";
  const title = sanitizeTitle(item.title) || defaultDownloadName(type);
  const ext = path.extname(item.filename) || ".bin";
  const safeName = `${title.replace(/[\\/:*?"<>|]+/g, "_")}${ext}`;
  res.download(filePath, safeName);
});

app.post("/api/upload", (req, res) => {
  const maxBytes = uploadLimitForUser(req.authUser);
  if (req.authUser) {
    const muteMsg = muteBlockMessage(req.authUser);
    if (muteMsg) return res.status(403).json({ error: muteMsg });
  }
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: `Файл слишком большой. Максимум ${formatUploadLimit(maxBytes)}`,
        });
      }
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Файл не выбран" });
    }

    if (req.file.size > maxBytes) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: `Файл слишком большой. Максимум ${formatUploadLimit(maxBytes)}`,
      });
    }

    const type = detectKind(req.file);
    if (!type) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Можно загружать только фото, аудио или видео" });
    }

    const title =
      sanitizeTitle(req.body && req.body.title) ||
      path.parse(req.file.originalname || "Без названия").name;

    const anonymousFlag = String((req.body && req.body.anonymous) || "").toLowerCase();
    const wantAnonymous = anonymousFlag === "1" || anonymousFlag === "true" || anonymousFlag === "yes";
    const visibilityRaw = String((req.body && req.body.visibility) || "public").toLowerCase();
    const visibility = visibilityRaw === "unlisted" ? "unlisted" : "public";

    let authorId = null;
    let authorUsername = null;
    let anonymous = true;

    if (req.authUser) {
      authorId = req.authUser.id;
      if (wantAnonymous) {
        anonymous = true;
        authorUsername = null;
      } else {
        anonymous = false;
        authorUsername = req.authUser.username;
      }
    }

    const item = {
      id: path.parse(req.file.filename).name,
      filename: req.file.filename,
      title,
      type,
      originalName: req.file.originalname || req.file.filename,
      url: `/uploads/${req.file.filename}`,
      createdAt: Date.now(),
      authorId,
      authorUsername,
      anonymous,
      visibility,
      tags: sanitizeTags(req.body && req.body.tags),
    };

    const items = loadMeta();
    items.push(item);
    saveMeta(items);
    writeAudit("item.upload", req.authUser, {
      targetType: "item",
      targetId: item.id,
      targetLabel: item.title || item.originalName || item.id,
      meta: { type: item.type, anonymous: item.anonymous, visibility: item.visibility },
    });
    res.status(201).json(enrichItem(item, req.authUser));
  });
});

app.patch("/api/items/:id", (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: "Нужен вход" });

  const items = loadMeta();
  const idx = items.findIndex((x) => x.id === req.params.id && !isDeletedItem(x));
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const ownerOk = isOwner(items[idx], req.authUser);
  const staffOk = auth.userIsStaff(req.authUser);
  let legendaryChanged = null;
  let titleChanged = null;
  let touched = false;

  if (req.body && req.body.title != null) {
    if (!ownerOk && !staffOk) {
      return res.status(403).json({ error: "Нельзя переименовать этот файл" });
    }
    const nextTitle = sanitizeTitle(req.body.title);
    if (!nextTitle) {
      return res.status(400).json({ error: "Название не может быть пустым" });
    }
    titleChanged = {
      from: items[idx].title || items[idx].originalName || "",
      to: nextTitle,
    };
    items[idx].title = nextTitle;
    touched = true;
  }

  if (req.body && req.body.visibility != null) {
    if (!ownerOk) {
      return res.status(403).json({ error: "Это не ваш файл" });
    }
    const visibility = String(req.body.visibility).toLowerCase() === "unlisted" ? "unlisted" : "public";
    items[idx].visibility = visibility;
    touched = true;
  }

  if (req.body && req.body.tags != null) {
    if (!ownerOk && !staffOk) {
      return res.status(403).json({ error: "Нельзя менять теги" });
    }
    items[idx].tags = sanitizeTags(req.body.tags);
    touched = true;
  }

  if (req.body && req.body.legendary != null) {
    if (!staffOk) {
      return res.status(403).json({ error: "Нужны права модератора или админа" });
    }
    items[idx].legendary = Boolean(req.body.legendary);
    legendaryChanged = items[idx].legendary;
    touched = true;
  }

  if (!touched) {
    return res.status(400).json({ error: "Нечего обновлять" });
  }

  saveMeta(items);
  if (titleChanged) {
    writeAudit("item.rename", req.authUser, {
      targetType: "item",
      targetId: items[idx].id,
      targetLabel: titleChanged.to,
      reversible: true,
      meta: titleChanged,
    });
  }
  if (legendaryChanged != null) {
    writeAudit(legendaryChanged ? "item.legendary.on" : "item.legendary.off", req.authUser, {
      targetType: "item",
      targetId: items[idx].id,
      targetLabel: items[idx].title || items[idx].id,
      reversible: true,
      meta: { legendary: legendaryChanged },
    });
  }
  res.json(enrichItem(items[idx], req.authUser));
});

function softDeleteItem(item, actor) {
  item.deletedAt = Date.now();
  item.deletedById = actor && actor.id ? actor.id : null;
  item.deletedByUsername = actor && actor.username ? actor.username : null;
  item.deletedByRole = actorRole(actor);
  return item;
}

function deleteItem(req, res) {
  const items = loadMeta();
  const idx = items.findIndex((x) => x.id === req.params.id && !isDeletedItem(x));
  if (idx === -1) {
    return res.status(404).json({ error: "Not found" });
  }

  const staffOk = auth.userIsStaff(req.authUser);
  const ownerOk = isOwner(items[idx], req.authUser);

  if (!staffOk && !ownerOk) {
    return res.status(401).json({ error: "Нет доступа" });
  }

  const removed = softDeleteItem(items[idx], req.authUser);
  saveMeta(items);
  const event = writeAudit("item.delete", req.authUser, {
    targetType: "item",
    targetId: removed.id,
    targetLabel: removed.title || removed.originalName || removed.id,
    reversible: true,
    meta: {
      snapshot: {
        id: removed.id,
        filename: removed.filename,
        title: removed.title,
        type: removed.type,
        url: removed.url,
      },
    },
  });
  res.json({ ok: true, id: removed.id, auditId: event.id });
}

app.delete("/api/items/:id", deleteItem);
app.delete("/api/images/:id", deleteItem);

app.get("/api/admin/audit", (req, res) => {
  if (!req.authUser || !auth.userIsAdmin(req.authUser)) {
    return res.status(403).json({ error: "Только для админа" });
  }
  const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 100));
  const events = loadAudit().slice(0, limit);
  res.json({ events });
});

app.post("/api/admin/audit/:id/restore", (req, res) => {
  if (!req.authUser || !auth.userIsAdmin(req.authUser)) {
    return res.status(403).json({ error: "Только для админа" });
  }
  const events = loadAudit();
  const event = events.find((e) => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: "Событие не найдено" });
  if (event.reversedAt) return res.status(400).json({ error: "Уже откатили" });
  if (event.action !== "item.delete") {
    return res.status(400).json({ error: "Этот тип действия нельзя откатить" });
  }

  const items = loadMeta();
  const idx = items.findIndex((x) => x.id === event.targetId);
  if (idx === -1) return res.status(404).json({ error: "Файл не найден в базе" });
  if (!isDeletedItem(items[idx])) {
    return res.status(400).json({ error: "Файл уже на стене" });
  }

  const filePath = path.join(UPLOADS, items[idx].filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Файл на диске отсутствует" });
  }

  delete items[idx].deletedAt;
  delete items[idx].deletedById;
  delete items[idx].deletedByUsername;
  delete items[idx].deletedByRole;
  saveMeta(items);

  event.reversedAt = Date.now();
  event.reversedById = req.authUser.id;
  event.reversedByUsername = req.authUser.username;
  saveAudit(events);

  writeAudit("item.restore", req.authUser, {
    targetType: "item",
    targetId: items[idx].id,
    targetLabel: items[idx].title || items[idx].id,
    meta: { fromAuditId: event.id },
  });

  res.json({ ok: true, item: enrichItem(items[idx], req.authUser) });
});

app.get("/i/:id", (req, res) => {
  const items = loadMeta();
  const item = items.find((x) => x.id === req.params.id && !isDeletedItem(x));
  if (!item) {
    return res.status(404).send("Файл не найден");
  }
  const filePath = path.join(UPLOADS, item.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Файл не найден");
  }
  bumpItemViews(req, res, item.id);
  const related = pickRelated(
    items.filter((x) => !isDeletedItem(x)),
    item,
    8
  );
  res
    .type("html")
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "private, max-age=0, must-revalidate")
    .send(renderItemPage(enrichItem(item, req.authUser), related));
});

const CATEGORY_SLUGS = new Set(["top", "date", "image", "audio", "video", "authors", "mine", "legendary", "audit", "game", "tetris", "blockblast"]);

app.get("/c/:cat", (req, res) => {
  const cat = String(req.params.cat || "").toLowerCase();
  if (!CATEGORY_SLUGS.has(cat)) {
    return res.redirect(302, "/");
  }
  if (cat === "game") {
    return res.redirect(302, "/game");
  }
  if (cat === "tetris") {
    return res.redirect(302, "/tetris");
  }
  if (cat === "blockblast") {
    return res.redirect(302, "/blockblast");
  }
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.get("/game", (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "game.html"));
});

app.get("/tetris", (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "tetris.html"));
});

app.get("/blockblast", (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "blockblast.html"));
});

app.get("/u/:username", (req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`rasmusvraa gallery listening on 127.0.0.1:${PORT}`);
});
