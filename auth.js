const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const COOKIE_NAME = "rv_sid";
const SESSION_DAYS = 30;
const DEFAULT_ADMINS = ["RasmusVraa"];
const ANONYMOUS_USERNAME = "anonymous";
const ANONYMOUS_DISPLAY = "Аноним";
const RESERVED_USERNAMES = new Set([
  "anonymous",
  "anon",
  "anonim",
  "anonym",
  "null",
  "undefined",
  "admin",
  "administrator",
  "moderator",
  "mod",
  "system",
  "root",
  "support",
  "guest",
]);

function createAuth({ uploadsDir, sessionSecret, adminUsernames }) {
  const usersFile = path.join(uploadsDir, "users.json");
  const sessionsFile = path.join(uploadsDir, "sessions.json");
  const avatarsDir = path.join(uploadsDir, "avatars");
  fs.mkdirSync(avatarsDir, { recursive: true });

  const secret = String(sessionSecret || "").trim() || crypto.randomBytes(32).toString("hex");
  const adminSet = new Set(
    (Array.isArray(adminUsernames) && adminUsernames.length ? adminUsernames : DEFAULT_ADMINS)
      .map((name) => String(name || "").trim().toLowerCase())
      .filter(Boolean)
  );

  function loadUsers() {
    try {
      const data = JSON.parse(fs.readFileSync(usersFile, "utf8"));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
  }

  function loadSessions() {
    try {
      const data = JSON.parse(fs.readFileSync(sessionsFile, "utf8"));
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function saveSessions(sessions) {
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), "utf8");
  }

  function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(password), salt, 64);
    return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
  }

  function verifyPassword(password, stored) {
    try {
      const parts = String(stored || "").split("$");
      if (parts.length !== 3 || parts[0] !== "scrypt") return false;
      const salt = Buffer.from(parts[1], "hex");
      const expected = Buffer.from(parts[2], "hex");
      const actual = crypto.scryptSync(String(password), salt, 64);
      if (expected.length !== actual.length) return false;
      return crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  function sanitizeUsername(value) {
    const raw = String(value || "").trim();
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]{3,24}$/.test(raw)) return "";
    return raw;
  }

  function normalizeUsername(value) {
    const cleaned = sanitizeUsername(value);
    return cleaned ? cleaned.toLowerCase() : "";
  }

  function usernameValidationError(usernameRaw) {
    const raw = String(usernameRaw || "").trim();
    if (!raw) return "Введите ник";
    if (raw.length < 3) return "Ник слишком короткий (минимум 3 символа)";
    if (raw.length > 24) return "Ник слишком длинный (максимум 24 символа)";
    if (/\s/.test(raw)) return "В нике нельзя использовать пробелы";
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(raw)) {
      return "Ник: латиница или кириллица, цифры и _";
    }
    if (isReservedUsername(raw)) return "Этот ник зарезервирован";
    return "";
  }

  function passwordValidationError(password) {
    const pass = String(password || "");
    if (!pass) return "Введите пароль";
    if (pass.length < 6) return "Пароль минимум 6 символов";
    if (pass.length > 128) return "Пароль слишком длинный";
    return "";
  }

  function isReservedUsername(username) {
    return RESERVED_USERNAMES.has(normalizeUsername(username));
  }

  function isAnonymousUsername(username) {
    return normalizeUsername(username) === ANONYMOUS_USERNAME;
  }

  function isAdminUsername(username) {
    return adminSet.has(normalizeUsername(username));
  }

  function userIsAdmin(user) {
    if (!user) return false;
    if (user.isAdmin) return true;
    return isAdminUsername(user.username);
  }

  function userIsModerator(user) {
    if (!user) return false;
    if (userIsAdmin(user)) return false;
    return Boolean(user.isModerator);
  }

  function userIsStaff(user) {
    return userIsAdmin(user) || userIsModerator(user);
  }

  function userIsBanned(user) {
    return Boolean(user && user.bannedAt);
  }

  function userIsMuted(user) {
    if (!user || !user.mutedUntil) return false;
    return Number(user.mutedUntil) > Date.now();
  }

  function canModerateTarget(actor, target) {
    if (!userIsStaff(actor) || !target) return false;
    if (actor.id === target.id) return false;
    if (userIsAdmin(target)) return false;
    if (userIsModerator(actor) && userIsStaff(target)) return false;
    return true;
  }

  function publicUser(user) {
    if (!user) return null;
    const admin = userIsAdmin(user);
    const mutedUntil = user.mutedUntil && Number(user.mutedUntil) > Date.now() ? Number(user.mutedUntil) : null;
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl || null,
      createdAt: user.createdAt,
      isAdmin: admin,
      isModerator: admin ? false : Boolean(user.isModerator),
      isBanned: userIsBanned(user),
      mutedUntil,
      isMuted: Boolean(mutedUntil),
      banReason: userIsBanned(user) ? user.banReason || null : null,
      theme: user.theme || "trap",
      gameScore: Number(user.gameScore) || 0,
      lastDailyGameDate: user.lastDailyGameDate || null,
      lastDailyScore: Number(user.lastDailyScore) || 0,
    };
  }

  function anonymousPublicUser(uploads = 0) {
    return {
      id: "anonymous",
      username: ANONYMOUS_USERNAME,
      displayName: ANONYMOUS_DISPLAY,
      avatarUrl: null,
      createdAt: null,
      isAdmin: false,
      isModerator: false,
      isBanned: false,
      mutedUntil: null,
      isMuted: false,
      banReason: null,
      isAnonymousProfile: true,
      uploads,
      gameScore: 0,
    };
  }

  function setModerator(username, enabled) {
    const users = loadUsers();
    const key = normalizeUsername(username);
    const idx = users.findIndex((u) => normalizeUsername(u.username) === key);
    if (idx === -1) return { error: "Пользователь не найден" };
    if (userIsAdmin(users[idx])) {
      return { error: "Нельзя менять роль админа" };
    }
    users[idx].isModerator = Boolean(enabled);
    if (enabled) {
      users[idx].bannedAt = null;
      users[idx].banReason = null;
      users[idx].bannedById = null;
      users[idx].bannedByUsername = null;
      users[idx].mutedUntil = null;
      users[idx].muteReason = null;
    }
    saveUsers(users);
    return { user: users[idx] };
  }

  function setBan(username, { enabled, reason, actor } = {}) {
    const users = loadUsers();
    const key = normalizeUsername(username);
    const idx = users.findIndex((u) => normalizeUsername(u.username) === key);
    if (idx === -1) return { error: "Пользователь не найден" };
    if (!canModerateTarget(actor, users[idx])) {
      return { error: "Нельзя банить этого пользователя" };
    }
    if (enabled) {
      users[idx].bannedAt = Date.now();
      users[idx].banReason = String(reason || "").trim().slice(0, 200) || null;
      users[idx].bannedById = actor && actor.id ? actor.id : null;
      users[idx].bannedByUsername = actor && actor.username ? actor.username : null;
      users[idx].isModerator = false;
      users[idx].mutedUntil = null;
      users[idx].muteReason = null;
    } else {
      users[idx].bannedAt = null;
      users[idx].banReason = null;
      users[idx].bannedById = null;
      users[idx].bannedByUsername = null;
    }
    saveUsers(users);
    return { user: users[idx] };
  }

  function setMute(username, { mutedUntil, reason, actor } = {}) {
    const users = loadUsers();
    const key = normalizeUsername(username);
    const idx = users.findIndex((u) => normalizeUsername(u.username) === key);
    if (idx === -1) return { error: "Пользователь не найден" };
    if (!canModerateTarget(actor, users[idx])) {
      return { error: "Нельзя мутить этого пользователя" };
    }
    if (userIsBanned(users[idx])) {
      return { error: "Пользователь в бане" };
    }
    const until = mutedUntil == null ? null : Number(mutedUntil);
    if (until && (!Number.isFinite(until) || until <= Date.now())) {
      return { error: "Некорректный срок мута" };
    }
    users[idx].mutedUntil = until || null;
    users[idx].muteReason = until
      ? String(reason || "").trim().slice(0, 200) || null
      : null;
    users[idx].mutedById = until && actor ? actor.id : null;
    users[idx].mutedByUsername = until && actor ? actor.username : null;
    saveUsers(users);
    return { user: users[idx] };
  }

  function ensureAdmins() {
    const users = loadUsers();
    let changed = false;
    for (const user of users) {
      if (isAdminUsername(user.username) && !user.isAdmin) {
        user.isAdmin = true;
        changed = true;
      }
    }
    if (changed) saveUsers(users);
  }

  ensureAdmins();

  function findUserById(id) {
    return loadUsers().find((u) => u.id === id) || null;
  }

  function findUserByUsername(username) {
    const key = normalizeUsername(username);
    if (!key) return null;
    return loadUsers().find((u) => normalizeUsername(u.username) === key) || null;
  }

  function parseCookies(req) {
    const header = req.headers.cookie || "";
    const out = {};
    for (const part of header.split(";")) {
      const idx = part.indexOf("=");
      if (idx === -1) continue;
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

  function createSession(userId) {
    const token = crypto.randomBytes(24).toString("hex");
    const sessions = loadSessions();
    const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
    sessions[token] = { userId, expiresAt };
    for (const [key, value] of Object.entries(sessions)) {
      if (!value || !value.expiresAt || value.expiresAt < Date.now()) {
        delete sessions[key];
      }
    }
    saveSessions(sessions);
    return { token, expiresAt };
  }

  function destroySession(token) {
    if (!token) return;
    const sessions = loadSessions();
    if (sessions[token]) {
      delete sessions[token];
      saveSessions(sessions);
    }
  }

  function destroyUserSessions(userId) {
    if (!userId) return;
    const sessions = loadSessions();
    let changed = false;
    for (const [token, value] of Object.entries(sessions)) {
      if (value && value.userId === userId) {
        delete sessions[token];
        changed = true;
      }
    }
    if (changed) saveSessions(sessions);
  }

  function setSessionCookie(res, token, expiresAt) {
    const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const parts = [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAge}`,
    ];
    if (process.env.NODE_ENV === "production") parts.push("Secure");
    res.append("Set-Cookie", parts.join("; "));
  }

  function clearSessionCookie(res) {
    const parts = [
      `${COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
    ];
    if (process.env.NODE_ENV === "production") parts.push("Secure");
    res.append("Set-Cookie", parts.join("; "));
  }

  function getSessionUser(req) {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    const sessions = loadSessions();
    const session = sessions[token];
    if (!session || !session.expiresAt || session.expiresAt < Date.now()) {
      if (session) {
        delete sessions[token];
        saveSessions(sessions);
      }
      return null;
    }
    const user = findUserById(session.userId);
    if (!user) return null;
    if (userIsBanned(user)) {
      delete sessions[token];
      saveSessions(sessions);
      return null;
    }
    return { user, token };
  }

  function register(usernameRaw, password) {
    const nameError = usernameValidationError(usernameRaw);
    if (nameError) return { error: nameError };
    const passError = passwordValidationError(password);
    if (passError) return { error: passError };

    const username = sanitizeUsername(usernameRaw);
    if (!username) {
      return { error: "Ник: латиница или кириллица, цифры и _, 3–24 символа" };
    }
    if (findUserByUsername(username)) {
      return { error: "Такой ник уже занят" };
    }
    const user = {
      id: `u_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
      username,
      passwordHash: hashPassword(password),
      avatarUrl: null,
      createdAt: Date.now(),
      isAdmin: isAdminUsername(username),
      usernameChangedAt: null,
    };
    const users = loadUsers();
    users.push(user);
    saveUsers(users);
    return { user };
  }

  function login(usernameRaw, password) {
    const raw = String(usernameRaw || "").trim();
    if (!raw || !String(password || "")) {
      return { error: "Введите ник и пароль" };
    }
    if (isReservedUsername(raw) || isAnonymousUsername(raw)) {
      return { error: "Неверный логин или пароль" };
    }
    const user = findUserByUsername(raw);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return { error: "Неверный логин или пароль" };
    }
    if (userIsBanned(user)) {
      return { error: user.banReason ? `Аккаунт забанен: ${user.banReason}` : "Аккаунт забанен" };
    }
    if (isAdminUsername(user.username) && !user.isAdmin) {
      user.isAdmin = true;
      const users = loadUsers();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        users[idx].isAdmin = true;
        saveUsers(users);
      }
    }
    return { user };
  }

  const RENAME_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

  function changeUsername(userId, newUsernameRaw) {
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { error: "Пользователь не найден" };

    const nameError = usernameValidationError(newUsernameRaw);
    if (nameError) return { error: nameError };
    const username = sanitizeUsername(newUsernameRaw);
    if (!username) {
      return { error: "Ник: латиница или кириллица, цифры и _, 3–24 символа" };
    }

    const current = users[idx];
    if (normalizeUsername(current.username) === normalizeUsername(username)) {
      return { error: "Это уже ваш текущий ник" };
    }

    const changedAt = Number(current.usernameChangedAt) || 0;
    if (changedAt && Date.now() - changedAt < RENAME_COOLDOWN_MS) {
      const leftMs = RENAME_COOLDOWN_MS - (Date.now() - changedAt);
      const leftHours = Math.max(1, Math.ceil(leftMs / (60 * 60 * 1000)));
      return { error: `Ник можно менять раз в 3 дня. Осталось около ${leftHours} ч.` };
    }

    const taken = users.find(
      (u) => u.id !== userId && normalizeUsername(u.username) === normalizeUsername(username)
    );
    if (taken) return { error: "Такой ник уже занят" };

    const oldUsername = current.username;
    users[idx].username = username;
    users[idx].usernameChangedAt = Date.now();
    if (isAdminUsername(username)) users[idx].isAdmin = true;
    saveUsers(users);
    return { user: users[idx], oldUsername };
  }

  function renameAvailability(user) {
    if (!user) return { canRename: false, nextRenameAt: null };
    const changedAt = Number(user.usernameChangedAt) || 0;
    if (!changedAt) return { canRename: true, nextRenameAt: null };
    const next = changedAt + RENAME_COOLDOWN_MS;
    if (Date.now() >= next) return { canRename: true, nextRenameAt: null };
    return { canRename: false, nextRenameAt: next };
  }

  function checkUsernameAvailable(usernameRaw, exceptUserId = null) {
    const nameError = usernameValidationError(usernameRaw);
    if (nameError) return { ok: false, error: nameError };
    const username = sanitizeUsername(usernameRaw);
    const existing = findUserByUsername(username);
    if (existing && existing.id !== exceptUserId) {
      return { ok: false, error: "Такой ник уже занят" };
    }
    return { ok: true, username };
  }

  const THEME_IDS = new Set([
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
  ]);

  function setTheme(userId, themeRaw) {
    const theme = String(themeRaw || "").trim().toLowerCase();
    if (!THEME_IDS.has(theme)) return { error: "Неизвестная тема" };
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { error: "Пользователь не найден" };
    users[idx].theme = theme;
    saveUsers(users);
    return { user: users[idx] };
  }

  function addGameScore(userId, pointsRaw) {
    const points = Math.max(0, Math.floor(Number(pointsRaw) || 0));
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { error: "Пользователь не найден" };
    const prev = Number(users[idx].gameScore) || 0;
    users[idx].gameScore = prev + points;
    saveUsers(users);
    return { user: users[idx], added: points, gameScore: users[idx].gameScore };
  }

  function markDailyPlayed(userId, moscowDate, scoreRaw) {
    const day = String(moscowDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Некорректная дата" };
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { error: "Пользователь не найден" };
    users[idx].lastDailyGameDate = day;
    users[idx].lastDailyScore = Math.max(0, Math.floor(Number(scoreRaw) || 0));
    saveUsers(users);
    return { user: users[idx] };
  }

  function resetAllGameScores() {
    const users = loadUsers();
    let changed = 0;
    for (const user of users) {
      const had =
        Number(user.gameScore) ||
        Number(user.lastDailyScore) ||
        user.lastDailyGameDate;
      if (!had) continue;
      user.gameScore = 0;
      user.lastDailyScore = 0;
      user.lastDailyGameDate = null;
      changed += 1;
    }
    if (changed) saveUsers(users);
    return { changed, total: users.length };
  }

  return {
    COOKIE_NAME,
    ANONYMOUS_USERNAME,
    ANONYMOUS_DISPLAY,
    RENAME_COOLDOWN_MS,
    THEME_IDS,
    avatarsDir,
    secret,
    loadUsers,
    saveUsers,
    publicUser,
    anonymousPublicUser,
    userIsAdmin,
    userIsModerator,
    userIsStaff,
    userIsBanned,
    userIsMuted,
    canModerateTarget,
    setModerator,
    setBan,
    setMute,
    changeUsername,
    renameAvailability,
    checkUsernameAvailable,
    setTheme,
    addGameScore,
    markDailyPlayed,
    resetAllGameScores,
    isReservedUsername,
    isAnonymousUsername,
    ensureAdmins,
    findUserById,
    findUserByUsername,
    sanitizeUsername,
    normalizeUsername,
    getSessionUser,
    createSession,
    destroySession,
    destroyUserSessions,
    setSessionCookie,
    clearSessionCookie,
    register,
    login,
  };
}

module.exports = { createAuth };
