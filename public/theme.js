(function (global) {
  const THEMES = [
    { id: "trap", name: "Trap Acid", desc: "Лайм и хром — классика стены" },
    { id: "neon", name: "Neon Night", desc: "Неон, свечение, скругления" },
    { id: "paper", name: "Paper Desk", desc: "Светлая бумага и спокойный UI" },
    { id: "midnight", name: "Midnight Gold", desc: "Ночь и золотые акценты" },
    { id: "brutal", name: "Brutal Hot", desc: "Жёсткие рамки и розовый акцент" },
    { id: "ocean", name: "Ocean Soft", desc: "Бирюза и мягкие формы" },
    { id: "office", name: "Офис 9:00", desc: "Серый Excel и кнопки Windows" },
    { id: "maldives", name: "Мальдивы", desc: "Лагуна, песок и круглые кнопки" },
    { id: "sakura", name: "Сакура", desc: "Розовый сад и мягкие тени" },
    { id: "forest", name: "Тайга", desc: "Мох, хвоя и тёмный лес" },
    { id: "arcade", name: "Аркада 84", desc: "CRT, пиксели и магента" },
    { id: "desert", name: "Сахара", desc: "Закат, песок и терракота" },
    { id: "cafe", name: "Кофейня", desc: "Тёплый латте и мягкий UI" },
    { id: "noir", name: "Нуар", desc: "Ч/б кино и жёсткий контраст" },
    { id: "random", name: "Рандом дня", desc: "Каждый день новая тема" },
  ];

  const FIXED = THEMES.filter((t) => t.id !== "random").map((t) => t.id);
  const STORAGE_KEY = "rv_theme_pref";
  const DAY_KEY = "rv_theme_day";

  function moscowDay() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function hashPick(seed, list) {
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return list[(h >>> 0) % list.length];
  }

  function getStoredPref() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && THEMES.some((t) => t.id === v)) return v;
    } catch {
      /* ignore */
    }
    return "trap";
  }

  function setStoredPref(pref) {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore */
    }
  }

  function resolveTheme(pref) {
    const choice = pref || getStoredPref();
    if (choice !== "random") return { pref: choice, resolved: choice };

    const day = moscowDay();
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(DAY_KEY) || "null");
    } catch {
      cached = null;
    }
    if (cached && cached.day === day && FIXED.includes(cached.theme)) {
      return { pref: "random", resolved: cached.theme };
    }
    const resolved = hashPick(`${day}:rv`, FIXED);
    try {
      localStorage.setItem(DAY_KEY, JSON.stringify({ day, theme: resolved }));
    } catch {
      /* ignore */
    }
    return { pref: "random", resolved };
  }

  function applyTheme(pref) {
    const { pref: p, resolved } = resolveTheme(pref);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePref = p;
    setStoredPref(p);
    return { pref: p, resolved };
  }

  function currentPref() {
    return document.documentElement.dataset.themePref || getStoredPref();
  }

  function currentResolved() {
    return document.documentElement.dataset.theme || "trap";
  }

  // Apply ASAP for FOUC reduction when script is in head
  applyTheme(getStoredPref());

  global.RvTheme = {
    THEMES,
    FIXED,
    getStoredPref,
    setStoredPref,
    resolveTheme,
    applyTheme,
    currentPref,
    currentResolved,
    moscowDay,
  };
})(typeof window !== "undefined" ? window : globalThis);
