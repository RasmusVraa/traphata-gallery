(() => {
  const GRID = 8;
  const TRAY_SLOTS = 3;
  const BEST_KEY = "rv_blockblast_best";
  const VOL_KEY = "rv_media_game_volume";
  const DEFAULT_VOL = 0.7;
  const MIN_VOL = 0.1;
  const MAX_VOL = 2;

  function loadVolume() {
    const raw = Number(localStorage.getItem(VOL_KEY));
    if (!Number.isFinite(raw)) return DEFAULT_VOL;
    return Math.max(MIN_VOL, Math.min(MAX_VOL, raw));
  }

  // Набор фигур в духе Block Blast / block puzzle
  const SHAPES = [
    [[0, 0]],
    [
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 0],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [2, 1],
    ],
    [
      [0, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  ];

  const els = {
    root: document.getElementById("game-blast"),
    board: document.getElementById("blast-board"),
    tray: document.getElementById("blast-tray"),
    boardAnims: document.getElementById("blast-board-anims"),
    trayAnims: document.getElementById("blast-tray-anims"),
    float: document.getElementById("blast-float"),
    score: document.getElementById("blast-score"),
    best: document.getElementById("blast-best"),
    clears: document.getElementById("blast-clears"),
    combo: document.getElementById("blast-combo"),
    mediaTitle: document.getElementById("blast-media-title"),
    vol: document.getElementById("blast-vol"),
    volLabel: document.getElementById("blast-vol-label"),
    overlay: document.getElementById("blast-overlay"),
    overlayTitle: document.getElementById("blast-overlay-title"),
    overlayText: document.getElementById("blast-overlay-text"),
    overlayBtn: document.getElementById("blast-overlay-btn"),
    restartBtn: document.getElementById("blast-restart"),
  };

  if (!els.board || !els.tray || !els.root) return;

  const ctx = els.board.getContext("2d");
  const trayCtx = els.tray.getContext("2d");
  let floatCanvas = null;
  let floatCtx = null;

  let running = false;
  let over = false;
  let startedOnce = false;
  let raf = 0;
  let board = [];
  let tray = [];
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let clears = 0;
  let combo = 0;
  let videoVolume = loadVolume();
  let media = [];
  let recentMedia = [];
  let selected = -1;
  let drag = null;
  let hoverCell = null;
  let flashLines = null;
  let flashUntil = 0;
  let popText = null;

  function emptyBoard() {
    return Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => null));
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function shapeBounds(cells) {
    const xs = cells.map(([x]) => x);
    const ys = cells.map(([, y]) => y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      w: Math.max(...xs) - Math.min(...xs) + 1,
      h: Math.max(...ys) - Math.min(...ys) + 1,
    };
  }

  function normalizeShape(cells) {
    const b = shapeBounds(cells);
    return cells.map(([x, y]) => [x - b.minX, y - b.minY]);
  }

  function cellSize() {
    return Math.max(1, Math.floor(els.board.width / GRID));
  }

  function resize() {
    const stage = els.board.closest(".blast-stage");
    const trayWrap = els.tray.parentElement;
    if (!stage) return;

    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;
    const trayReserve = Math.max(110, Math.min(160, Math.floor(stageH * 0.22)));
    const gap = 14;
    const frame = 12;
    const maxBoard = Math.max(160, Math.min(stageW - frame, stageH - trayReserve - gap - frame));
    const size = Math.max(18, Math.floor(maxBoard / GRID));
    const dim = size * GRID;

    if (els.board.width !== dim || els.board.height !== dim) {
      els.board.width = dim;
      els.board.height = dim;
    }
    els.board.style.width = `${dim}px`;
    els.board.style.height = `${dim}px`;

    const trayW = Math.min(stageW - 8, Math.max(dim, Math.floor(dim * 1.05)));
    const trayH = Math.max(96, Math.min(trayReserve - 8, Math.floor(size * 3.2)));
    if (els.tray.width !== trayW || els.tray.height !== trayH) {
      els.tray.width = trayW;
      els.tray.height = trayH;
    }
    els.tray.style.width = `${trayW}px`;
    els.tray.style.height = `${trayH}px`;
    if (trayWrap) trayWrap.style.width = `${trayW + 12}px`;
  }

  function isAnimatedImageUrl(url) {
    return /\.(gif|webp)(\?|#|$)/i.test(String(url || ""));
  }

  function mediaIsAnimated(index) {
    const item = media[index];
    return Boolean(item && item.animated);
  }

  function createVideoEl(item) {
    const video = document.createElement("video");
    video.src = item.url;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    return video;
  }

  function createImageEl(item) {
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    // GIF/WebP крутятся только как «живые» DOM-элементы, не через canvas
    if (item.animated) {
      img.className = "blast-gif-master";
      img.style.cssText =
        "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.02;pointer-events:none;z-index:-1;";
      document.body.appendChild(img);
    }
    img.src = item.url;
    return img;
  }

  function makeAnimTile(mediaIndex) {
    const item = media[mediaIndex];
    const cell = document.createElement("div");
    cell.className = "blast-anim-cell";
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    img.src = item ? item.url : "";
    cell.appendChild(img);
    return cell;
  }

  function ensureMediaEl(index) {
    const item = media[index];
    if (!item || item.el || item.failed) return item && item.loading ? item.loading : Promise.resolve(item);
    if (item.loading) return item.loading;
    item.loading = new Promise((resolve) => {
      if (item.type === "video") {
        const video = createVideoEl(item);
        const finish = (ok) => {
          item.el = ok ? video : null;
          item.failed = !ok;
          item.loading = null;
          if (!ok && video.parentNode) video.parentNode.removeChild(video);
          resolve(item);
        };
        video.addEventListener("loadeddata", () => finish(true), { once: true });
        video.addEventListener("error", () => finish(false), { once: true });
        setTimeout(() => {
          if (!item.el && !item.failed) finish(video.readyState >= 2);
        }, 4000);
      } else {
        const img = createImageEl(item);
        const finish = (ok) => {
          item.el = ok ? img : null;
          item.failed = !ok;
          item.loading = null;
          if (!ok && img.parentNode) img.parentNode.removeChild(img);
          resolve(item);
        };
        img.onload = () => finish(true);
        img.onerror = () => finish(false);
        setTimeout(() => {
          if (!item.el && !item.failed) finish(img.complete && img.naturalWidth > 0);
        }, 4000);
      }
    });
    return item.loading;
  }

  function disposeMedia() {
    for (const item of media) {
      if (!item || !item.el) continue;
      if (item.type === "video") {
        item.el.pause();
        item.el.removeAttribute("src");
        item.el.load();
      } else {
        item.el.removeAttribute("src");
      }
      if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
    }
    media = [];
  }

  async function loadMedia() {
    showOverlay("Загрузка медиа…", "Подключаем фото и видео со стены", "", true);
    const res = await fetch("/api/game/blockblast/media", { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Не удалось загрузить медиа");
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length < 4) throw new Error("Мало фото/видео на стене");

    disposeMedia();
    media = shuffle(
      items.map((item) => {
        const type = item.type === "video" ? "video" : "image";
        const url = item.url;
        const animated =
          type === "image" && (item.animated === true || isAnimatedImageUrl(url) || isAnimatedImageUrl(item.title));
        return {
          id: item.id,
          url,
          type,
          title: item.title || item.id,
          animated,
          el: null,
          failed: false,
          loading: null,
        };
      })
    );

    const videos = media.map((m, i) => ({ m, i })).filter(({ m }) => m.type === "video");
    const images = media.map((m, i) => ({ m, i })).filter(({ m }) => m.type !== "video");
    const warm = [...videos.map((x) => x.i), ...images.map((x) => x.i)].slice(0, Math.min(24, media.length));
    await Promise.all(warm.map((i) => ensureMediaEl(i)));
    if (media.filter((m) => m.el).length < 4) throw new Error("Медиа не прогрузились");
    media.forEach((_, i) => {
      if (!media[i].el && !media[i].failed) ensureMediaEl(i);
    });
    recentMedia = [];
  }

  function pickMediaIndex() {
    const used = new Set();
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        if (board[y][x]) used.add(board[y][x].mediaIndex);
      }
    }
    for (const p of tray) {
      if (p) used.add(p.mediaIndex);
    }

    const preferVideo = Math.random() < 0.5;
    const pool = media
      .map((m, i) => ({ m, i }))
      .filter(({ m, i }) => m && m.el && !used.has(i) && !recentMedia.includes(i));
    let candidates = pool.filter(({ m }) => (preferVideo ? m.type === "video" : m.type !== "video"));
    if (!candidates.length) candidates = pool;
    if (!candidates.length) {
      candidates = media.map((m, i) => ({ m, i })).filter(({ m }) => m && m.el);
    }
    if (!candidates.length) return 0;
    const choice = candidates[Math.floor(Math.random() * candidates.length)].i;
    recentMedia.push(choice);
    if (recentMedia.length > 12) recentMedia.shift();
    return choice;
  }

  function makePiece() {
    const cells = normalizeShape(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
    return {
      cells,
      mediaIndex: pickMediaIndex(),
      bounds: shapeBounds(cells),
    };
  }

  function refillTray() {
    if (tray.some((p) => p)) return;
    tray = Array.from({ length: TRAY_SLOTS }, () => makePiece());
  }

  function canPlace(piece, ox, oy) {
    if (!piece) return false;
    for (const [x, y] of piece.cells) {
      const gx = ox + x;
      const gy = oy + y;
      if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return false;
      if (board[gy][gx]) return false;
    }
    return true;
  }

  function anyPlacement(piece) {
    if (!piece) return false;
    const b = piece.bounds;
    for (let y = 0; y <= GRID - b.h; y += 1) {
      for (let x = 0; x <= GRID - b.w; x += 1) {
        if (canPlace(piece, x, y)) return true;
      }
    }
    return false;
  }

  function hasAnyMove() {
    return tray.some((p) => p && anyPlacement(p));
  }

  function placePiece(piece, ox, oy) {
    for (const [x, y] of piece.cells) {
      board[oy + y][ox + x] = { mediaIndex: piece.mediaIndex };
    }
    score += piece.cells.length;
    const cleared = clearLines();
    if (cleared > 0) {
      combo += 1;
      clears += cleared;
      const base = cleared * 10;
      const bonus = cleared * cleared * 5 + Math.max(0, combo - 1) * 20;
      score += base + bonus;
      flashLines = { rows: flashLines?.rows || [], cols: flashLines?.cols || [] };
      popText = { text: cleared > 1 ? `×${cleared}` : "Clear!", until: performance.now() + 700 };
    } else {
      combo = 0;
    }
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    syncHud();
  }

  function clearLines() {
    const fullRows = [];
    const fullCols = [];
    for (let y = 0; y < GRID; y += 1) {
      if (board[y].every((c) => c)) fullRows.push(y);
    }
    for (let x = 0; x < GRID; x += 1) {
      let full = true;
      for (let y = 0; y < GRID; y += 1) {
        if (!board[y][x]) {
          full = false;
          break;
        }
      }
      if (full) fullCols.push(x);
    }
    if (!fullRows.length && !fullCols.length) {
      flashLines = null;
      return 0;
    }
    flashLines = { rows: fullRows.slice(), cols: fullCols.slice() };
    flashUntil = performance.now() + 220;
    for (const y of fullRows) {
      for (let x = 0; x < GRID; x += 1) board[y][x] = null;
    }
    for (const x of fullCols) {
      for (let y = 0; y < GRID; y += 1) board[y][x] = null;
    }
    return fullRows.length + fullCols.length;
  }

  function syncHud() {
    if (els.score) els.score.textContent = String(score);
    if (els.best) els.best.textContent = String(best);
    if (els.clears) els.clears.textContent = String(clears);
    if (els.combo) els.combo.textContent = String(combo);
    if (els.vol) els.vol.value = String(Math.round(videoVolume * 100));
    if (els.volLabel) els.volLabel.textContent = `${Math.round(videoVolume * 100)}%`;
    const focus =
      (drag && drag.piece) ||
      (selected >= 0 && tray[selected]) ||
      tray.find((p) => p) ||
      null;
    if (els.mediaTitle && focus && media[focus.mediaIndex]) {
      const item = media[focus.mediaIndex];
      els.mediaTitle.textContent = `${item.type === "video" ? "▶" : "▣"} ${item.title}`;
    }
  }

  function setVolume(next) {
    videoVolume = Math.max(MIN_VOL, Math.min(MAX_VOL, Number(next) || MIN_VOL));
    localStorage.setItem(VOL_KEY, String(videoVolume));
    if (els.vol) els.vol.value = String(Math.round(videoVolume * 100));
    if (els.volLabel) els.volLabel.textContent = `${Math.round(videoVolume * 100)}%`;
    applyMasterGain();
    syncVideos();
  }

  let audioCtx = null;
  let masterGain = null;
  const hookedVideos = new WeakSet();

  function ensureAudioGraph() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    applyMasterGain();
    return audioCtx;
  }

  function applyMasterGain() {
    if (!masterGain) return;
    masterGain.gain.value = Math.max(MIN_VOL, Math.min(MAX_VOL, videoVolume));
  }

  function hookVideoAudio(video) {
    if (!video || hookedVideos.has(video)) return;
    if (!ensureAudioGraph()) return;
    try {
      const src = audioCtx.createMediaElementSource(video);
      src.connect(masterGain);
      hookedVideos.add(video);
      video.dataset.webAudio = "1";
    } catch (_) {
      /* уже подключено или браузер не дал */
    }
  }

  function applyVideoLoudness(video) {
    hookVideoAudio(video);
    if (video.dataset.webAudio === "1") {
      video.volume = 1;
      applyMasterGain();
    } else {
      video.volume = Math.max(MIN_VOL, Math.min(1, videoVolume));
    }
  }

  function showOverlay(title, text, btnLabel, visible = true) {
    if (!els.overlay) return;
    els.overlay.classList.toggle("hidden", !visible);
    if (els.overlayTitle) els.overlayTitle.textContent = title || "";
    if (els.overlayText) els.overlayText.textContent = text || "";
    if (els.overlayBtn) {
      els.overlayBtn.textContent = btnLabel || "Играть";
      els.overlayBtn.classList.toggle("hidden", !btnLabel);
    }
  }

  function coverDraw(target, source, x, y, size, alpha = 1) {
    const iw = source.videoWidth || source.naturalWidth || 0;
    const ih = source.videoHeight || source.naturalHeight || 0;
    target.save();
    target.globalAlpha = alpha;
    target.beginPath();
    const r = Math.max(2, size * 0.14);
    target.moveTo(x + r, y);
    target.arcTo(x + size, y, x + size, y + size, r);
    target.arcTo(x + size, y + size, x, y + size, r);
    target.arcTo(x, y + size, x, y, r);
    target.arcTo(x, y, x + size, y, r);
    target.closePath();
    target.clip();
    if (iw > 0 && ih > 0) {
      const scale = Math.max(size / iw, size / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      target.drawImage(source, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
    } else {
      target.fillStyle = "rgba(214,255,75,0.25)";
      target.fillRect(x, y, size, size);
    }
    target.restore();
    target.strokeStyle = "rgba(255,255,255,0.28)";
    target.lineWidth = 1;
    target.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  function drawCell(target, mediaIndex, px, py, size, alpha = 1) {
    if (mediaIsAnimated(mediaIndex)) {
      // GIF рисуем DOM-слоем — на canvas только подложка
      target.fillStyle = `rgba(12,12,12,${0.55 * alpha})`;
      target.fillRect(px, py, size, size);
      return;
    }
    const item = media[mediaIndex];
    const el = item && item.el;
    if (el) coverDraw(target, el, px, py, size, alpha);
    else {
      target.fillStyle = `hsla(${(mediaIndex * 47) % 360} 70% 45% / ${alpha})`;
      target.fillRect(px, py, size, size);
      target.strokeStyle = "rgba(255,255,255,0.25)";
      target.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    }
  }

  function drawPiece(target, piece, ox, oy, size, alpha = 1) {
    if (!piece) return;
    for (const [x, y] of piece.cells) {
      drawCell(target, piece.mediaIndex, ox + x * size, oy + y * size, size, alpha);
    }
  }

  function syncAnimLayer(layer, tiles) {
    if (!layer) return;
    const existing = new Map();
    for (const node of layer.children) {
      existing.set(node.dataset.key, node);
    }
    const keep = new Set();
    for (const tile of tiles) {
      keep.add(tile.key);
      let node = existing.get(tile.key);
      if (!node) {
        node = makeAnimTile(tile.mediaIndex);
        node.dataset.key = tile.key;
        layer.appendChild(node);
      }
      node.style.left = `${tile.left}px`;
      node.style.top = `${tile.top}px`;
      node.style.width = `${tile.size}px`;
      node.style.height = `${tile.size}px`;
      node.style.opacity = tile.alpha == null ? "1" : String(tile.alpha);
      const img = node.querySelector("img");
      const item = media[tile.mediaIndex];
      if (img && item && img.getAttribute("src") !== item.url) img.src = item.url;
    }
    for (const [key, node] of existing) {
      if (!keep.has(key)) node.remove();
    }
  }

  function syncBoardAnims() {
    const layer = els.boardAnims;
    if (!layer) return;
    const cssCell = boardCssCell();
    const tiles = [];
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const cell = board[y][x];
        if (!cell || !mediaIsAnimated(cell.mediaIndex)) continue;
        tiles.push({
          key: `b-${x}-${y}-${cell.mediaIndex}`,
          mediaIndex: cell.mediaIndex,
          left: x * cssCell,
          top: y * cssCell,
          size: cssCell,
        });
      }
    }
    syncAnimLayer(layer, tiles);
  }

  function syncTrayAnims() {
    const layer = els.trayAnims;
    if (!layer) return;
    const layout = trayLayout();
    const scaleX = els.tray.clientWidth / Math.max(1, els.tray.width);
    const scaleY = els.tray.clientHeight / Math.max(1, els.tray.height);
    const tiles = [];
    for (const slot of layout) {
      if (!slot.piece || (drag && drag.slot === slot.i)) continue;
      if (!mediaIsAnimated(slot.piece.mediaIndex)) continue;
      const size = slot.size * Math.min(scaleX, scaleY);
      const ox = slot.x * scaleX;
      const oy = slot.y * scaleY;
      for (const [x, y] of slot.piece.cells) {
        tiles.push({
          key: `t-${slot.i}-${x}-${y}`,
          mediaIndex: slot.piece.mediaIndex,
          left: ox + x * size,
          top: oy + y * size,
          size,
          alpha: anyPlacement(slot.piece) ? 1 : 0.35,
        });
      }
    }
    syncAnimLayer(layer, tiles);
  }

  function trayLayout() {
    const w = els.tray.width;
    const h = els.tray.height;
    const slotW = w / TRAY_SLOTS;
    const pad = 8;
    return tray.map((piece, i) => {
      if (!piece) return { i, piece: null, x: 0, y: 0, size: 0, slotX: i * slotW, slotW };
      const b = piece.bounds;
      const size = Math.max(12, Math.floor(Math.min((slotW - pad * 2) / b.w, (h - pad * 2) / b.h)));
      const x = Math.floor(i * slotW + (slotW - b.w * size) / 2);
      const y = Math.floor((h - b.h * size) / 2);
      return { i, piece, x, y, size, slotX: i * slotW, slotW };
    });
  }

  function drawTray() {
    const w = els.tray.width;
    const h = els.tray.height;
    trayCtx.clearRect(0, 0, w, h);
    trayCtx.fillStyle = "rgba(0,0,0,0.2)";
    trayCtx.fillRect(0, 0, w, h);

    const layout = trayLayout();
    for (const slot of layout) {
      trayCtx.strokeStyle = selected === slot.i ? "rgba(214,255,75,0.85)" : "rgba(255,255,255,0.08)";
      trayCtx.lineWidth = selected === slot.i ? 2 : 1;
      trayCtx.strokeRect(slot.slotX + 4.5, 4.5, slot.slotW - 9, h - 9);
      if (!slot.piece || (drag && drag.slot === slot.i)) continue;
      const alpha = anyPlacement(slot.piece) ? 1 : 0.35;
      drawPiece(trayCtx, slot.piece, slot.x, slot.y, slot.size, alpha);
    }
  }

  function drawBoard() {
    const size = cellSize();
    const w = els.board.width;
    const h = els.board.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * size + 0.5, 0);
      ctx.lineTo(i * size + 0.5, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * size + 0.5);
      ctx.lineTo(w, i * size + 0.5);
      ctx.stroke();
    }

    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const cell = board[y][x];
        if (cell) drawCell(ctx, cell.mediaIndex, x * size, y * size, size);
      }
    }

    if (flashLines && performance.now() < flashUntil) {
      ctx.fillStyle = "rgba(214,255,75,0.28)";
      for (const y of flashLines.rows) ctx.fillRect(0, y * size, w, size);
      for (const x of flashLines.cols) ctx.fillRect(x * size, 0, size, h);
    }

    const ghostPiece = drag ? drag.piece : selected >= 0 ? tray[selected] : null;
    if (ghostPiece && hoverCell && running && !over) {
      const ok = canPlace(ghostPiece, hoverCell.x, hoverCell.y);
      // Подсказка посадки по сетке — лёгкий контур, сама фигура едет плавно с курсором
      ctx.save();
      ctx.globalAlpha = ok ? 0.55 : 0.35;
      ctx.strokeStyle = ok ? "rgba(214,255,75,0.95)" : "rgba(255,90,80,0.85)";
      ctx.fillStyle = ok ? "rgba(214,255,75,0.12)" : "rgba(255,90,80,0.1)";
      ctx.lineWidth = Math.max(2, size * 0.08);
      for (const [x, y] of ghostPiece.cells) {
        const px = (hoverCell.x + x) * size;
        const py = (hoverCell.y + y) * size;
        ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
        ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
      }
      ctx.restore();
    }

    if (popText && performance.now() < popText.until) {
      ctx.fillStyle = "rgba(214,255,75,0.95)";
      ctx.font = `800 ${Math.max(22, Math.floor(size * 0.7))}px Unbounded, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(popText.text, w / 2, h / 2);
    } else {
      popText = null;
    }

    ctx.strokeStyle = "rgba(214, 255, 75, 0.95)";
    ctx.lineWidth = Math.max(3, Math.round(size * 0.08));
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }

  function fieldMediaIndexes() {
    const set = new Set();
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        if (board[y][x]) set.add(board[y][x].mediaIndex);
      }
    }
    for (const p of tray) {
      if (p) set.add(p.mediaIndex);
    }
    return set;
  }

  function syncVideos() {
    const audible = fieldMediaIndexes();
    for (const idx of audible) ensureMediaEl(idx);

    for (let i = 0; i < media.length; i += 1) {
      const item = media[i];
      if (!item || item.type !== "video" || !item.el) continue;
      const video = item.el;
      const onField = audible.has(i);
      if (!onField || over || !running) {
        video.muted = true;
        if (!video.paused) video.pause();
        continue;
      }
      video.loop = true;
      video.playsInline = true;
      if (video.paused || video.ended) {
        const startMuted = video.muted;
        video.muted = true;
        const p = video.play();
        if (p && p.then) {
          p.then(() => {
            if (over || !running || !fieldMediaIndexes().has(i)) return;
            video.muted = false;
            applyVideoLoudness(video);
          }).catch(() => {
            video.muted = startMuted;
          });
        } else {
          video.muted = false;
          applyVideoLoudness(video);
        }
      } else {
        video.muted = false;
        applyVideoLoudness(video);
      }
    }
  }

  function boardCssCell() {
    const rect = els.board.getBoundingClientRect();
    return rect.width > 0 ? rect.width / GRID : cellSize();
  }

  function hideFloat() {
    if (!els.float) return;
    els.float.classList.add("hidden");
    els.float.replaceChildren();
    floatCanvas = null;
    floatCtx = null;
  }

  function paintFloat(piece) {
    if (!els.float || !piece) return;
    const cssCell = boardCssCell();
    const b = piece.bounds;
    const cssW = Math.max(1, b.w * cssCell);
    const cssH = Math.max(1, b.h * cssCell);
    els.float.style.width = `${cssW}px`;
    els.float.style.height = `${cssH}px`;
    els.float.style.gridTemplateColumns = `repeat(${b.w}, ${cssCell}px)`;
    els.float.style.gridTemplateRows = `repeat(${b.h}, ${cssCell}px)`;

    if (mediaIsAnimated(piece.mediaIndex)) {
      floatCanvas = null;
      floatCtx = null;
      const sig = `gif:${piece.mediaIndex}:${b.w}x${b.h}:${Math.round(cssCell)}`;
      if (els.float.dataset.sig !== sig) {
        els.float.dataset.sig = sig;
        els.float.replaceChildren();
        const occupied = new Set(piece.cells.map(([x, y]) => `${x},${y}`));
        for (let y = 0; y < b.h; y += 1) {
          for (let x = 0; x < b.w; x += 1) {
            if (!occupied.has(`${x},${y}`)) {
              const spacer = document.createElement("div");
              spacer.style.visibility = "hidden";
              els.float.appendChild(spacer);
              continue;
            }
            els.float.appendChild(makeAnimTile(piece.mediaIndex));
          }
        }
      }
      return;
    }

    const sig = `canvas:${piece.mediaIndex}:${b.w}x${b.h}:${Math.round(cssCell)}`;
    if (els.float.dataset.sig !== sig || !floatCanvas) {
      els.float.dataset.sig = sig;
      els.float.replaceChildren();
      floatCanvas = document.createElement("canvas");
      floatCanvas.style.gridColumn = `1 / span ${b.w}`;
      floatCanvas.style.gridRow = `1 / span ${b.h}`;
      floatCanvas.style.width = "100%";
      floatCanvas.style.height = "100%";
      els.float.appendChild(floatCanvas);
      floatCtx = floatCanvas.getContext("2d");
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssH * dpr);
    if (floatCanvas.width !== pxW || floatCanvas.height !== pxH) {
      floatCanvas.width = pxW;
      floatCanvas.height = pxH;
    }
    floatCtx.setTransform(1, 0, 0, 1, 0, 0);
    floatCtx.clearRect(0, 0, pxW, pxH);
    floatCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPiece(floatCtx, piece, 0, 0, cssCell, 1);
  }

  function moveFloat(clientX, clientY) {
    if (!els.float || !drag) return;
    const cssCell = boardCssCell();
    const ox = (drag.grabX || 0) * cssCell;
    const oy = (drag.grabY || 0) * cssCell;
    els.float.style.transform = `translate(${clientX - ox}px, ${clientY - oy}px)`;
    els.float.classList.remove("hidden");
  }

  function canvasPoint(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      clientX: e.clientX,
      clientY: e.clientY,
    };
  }

  function hoverFromPointer(piece, e) {
    if (!piece) return null;
    const rect = els.board.getBoundingClientRect();
    const pad = boardCssCell() * 0.35;
    if (
      e.clientX < rect.left - pad ||
      e.clientX > rect.right + pad ||
      e.clientY < rect.top - pad ||
      e.clientY > rect.bottom + pad
    ) {
      return null;
    }
    const cssCell = boardCssCell();
    const b = piece.bounds;
    const grabX = drag && drag.piece === piece ? drag.grabX : b.w / 2;
    const grabY = drag && drag.piece === piece ? drag.grabY : b.h / 2;
    // Верхний левый угол фигуры в координатах поля (CSS px)
    const left = e.clientX - rect.left - grabX * cssCell;
    const top = e.clientY - rect.top - grabY * cssCell;
    let ox = Math.round(left / cssCell);
    let oy = Math.round(top / cssCell);
    ox = Math.max(0, Math.min(GRID - b.w, ox));
    oy = Math.max(0, Math.min(GRID - b.h, oy));
    return { x: ox, y: oy };
  }

  function tryCommit(slot, cell) {
    const piece = tray[slot];
    if (!piece || !cell || !canPlace(piece, cell.x, cell.y)) return false;
    placePiece(piece, cell.x, cell.y);
    tray[slot] = null;
    selected = -1;
    refillTray();
    if (!hasAnyMove()) {
      over = true;
      running = false;
      showOverlay("Конец игры", `Счёт ${score}. Ходов больше нет.`, "Ещё раз");
    }
    syncHud();
    return true;
  }

  function hitTraySlot(e) {
    const p = canvasPoint(els.tray, e);
    const layout = trayLayout();
    for (const slot of layout) {
      if (!slot.piece) continue;
      if (p.x >= slot.slotX && p.x < slot.slotX + slot.slotW) return slot.i;
    }
    return -1;
  }

  function endDrag(e, commit) {
    if (!drag) return;
    const slot = drag.slot;
    const cell = commit ? hoverFromPointer(drag.piece, e) : null;
    drag = null;
    hideFloat();
    try {
      if (e && typeof e.pointerId === "number") els.tray.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    if (cell) tryCommit(slot, cell);
    else selected = slot;
    hoverCell = null;
    syncHud();
    drawAll();
  }

  function onTrayPointerDown(e) {
    if (!running || over) return;
    e.preventDefault();
    const slot = hitTraySlot(e);
    if (slot < 0 || !tray[slot]) return;
    selected = slot;
    const piece = tray[slot];
    const layout = trayLayout()[slot];
    const p = canvasPoint(els.tray, e);
    let grabX = piece.bounds.w / 2;
    let grabY = piece.bounds.h / 2;
    if (layout && layout.size > 0) {
      grabX = (p.x - layout.x) / layout.size;
      grabY = (p.y - layout.y) / layout.size;
      grabX = Math.max(0, Math.min(piece.bounds.w, grabX));
      grabY = Math.max(0, Math.min(piece.bounds.h, grabY));
    }
    // На тач — чуть выше пальца, чтобы было видно фигуру
    if (e.pointerType === "touch") grabY += 0.85;

    drag = {
      slot,
      piece,
      pointerId: e.pointerId,
      grabX,
      grabY,
    };
    try {
      els.tray.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    paintFloat(piece);
    moveFloat(e.clientX, e.clientY);
    hoverCell = hoverFromPointer(piece, e);
    syncHud();
    drawAll();
  }

  function onPointerMove(e) {
    if (!drag) {
      if (selected >= 0 && tray[selected] && running && !over) {
        hoverCell = hoverFromPointer(tray[selected], e);
        drawAll();
      }
      return;
    }
    if (typeof e.pointerId === "number" && e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    moveFloat(e.clientX, e.clientY);
    hoverCell = hoverFromPointer(drag.piece, e);
    drawAll();
  }

  function onPointerUp(e) {
    if (!drag) return;
    if (typeof e.pointerId === "number" && e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    endDrag(e, true);
  }

  function onBoardPointerDown(e) {
    if (!running || over) return;
    if (drag) return;
    if (selected < 0 || !tray[selected]) return;
    e.preventDefault();
    const cell = hoverFromPointer(tray[selected], e);
    if (cell) tryCommit(selected, cell);
    hoverCell = null;
    drawAll();
  }

  function resetMatch() {
    board = emptyBoard();
    tray = [];
    score = 0;
    clears = 0;
    combo = 0;
    selected = -1;
    drag = null;
    hoverCell = null;
    flashLines = null;
    over = false;
    hideFloat();
    refillTray();
    syncHud();
    showOverlay("", "", "", false);
  }

  function drawAll() {
    drawBoard();
    drawTray();
    syncBoardAnims();
    syncTrayAnims();
    if (drag && drag.piece) paintFloat(drag.piece);
  }

  function frame() {
    syncVideos();
    drawAll();
    if (drag && drag.piece && typeof drag._mx === "number") {
      moveFloat(drag._mx, drag._my);
    }
    raf = requestAnimationFrame(frame);
  }

  async function beginGame() {
    try {
      ensureAudioGraph();
      if (!media.length) await loadMedia();
      running = true;
      startedOnce = true;
      over = false;
      resize();
      resetMatch();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    } catch (err) {
      showOverlay("Не вышло", err.message || "Ошибка", "Повторить");
    }
  }

  function onResize() {
    resize();
    if (drag && drag.piece) paintFloat(drag.piece);
    drawAll();
  }

  if (els.restartBtn) els.restartBtn.addEventListener("click", () => beginGame());
  if (els.overlayBtn) els.overlayBtn.addEventListener("click", () => beginGame());
  if (els.vol) {
    els.vol.addEventListener("input", () => setVolume(Number(els.vol.value) / 100));
    els.vol.addEventListener("change", () => setVolume(Number(els.vol.value) / 100));
  }

  els.tray.addEventListener("pointerdown", onTrayPointerDown);
  window.addEventListener("pointermove", (e) => {
    if (drag) {
      drag._mx = e.clientX;
      drag._my = e.clientY;
    }
    onPointerMove(e);
  });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  els.board.addEventListener("pointerdown", onBoardPointerDown);
  els.board.addEventListener("pointermove", (e) => {
    if (drag || selected < 0) return;
    hoverCell = hoverFromPointer(tray[selected], e);
    drawAll();
  });

  window.addEventListener("resize", onResize);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(raf);
    hideFloat();
    for (const item of media) {
      if (item && item.type === "video" && item.el) item.el.pause();
    }
  });

  syncHud();
  resize();
  hideFloat();
  showOverlay("Block Blast", "Ставь фигуры из фото и видео. Заполняй ряды и столбцы.", "Играть", true);
  requestAnimationFrame(() => {
    resize();
    drawAll();
  });
})();
