(() => {
  const COLS = 10;
  const ROWS = 20;
  const BEST_KEY = "rv_tetris_best";
  const SHAPES = {
    I: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    O: [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    T: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    L: [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    J: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    S: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    Z: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  };
  const BAG = Object.keys(SHAPES);
  const LINE_SCORES = [0, 100, 300, 500, 800];
  const VOL_KEY = "rv_media_game_volume";
  const DEFAULT_VOL = 0.7;
  const MIN_VOL = 0.1;
  const MAX_VOL = 2;

  function loadVolume() {
    const raw = Number(localStorage.getItem(VOL_KEY));
    if (!Number.isFinite(raw)) return DEFAULT_VOL;
    return Math.max(MIN_VOL, Math.min(MAX_VOL, raw));
  }

  const els = {
    root: document.getElementById("game-tetris"),
    board: document.getElementById("tetris-board"),
    next: document.getElementById("tetris-next"),
    score: document.getElementById("tetris-score"),
    best: document.getElementById("tetris-best"),
    lines: document.getElementById("tetris-lines"),
    level: document.getElementById("tetris-level"),
    speed: document.getElementById("tetris-speed"),
    vol: document.getElementById("tetris-vol"),
    volLabel: document.getElementById("tetris-vol-label"),
    mediaTitle: document.getElementById("tetris-media-title"),
    overlay: document.getElementById("tetris-overlay"),
    overlayTitle: document.getElementById("tetris-overlay-title"),
    overlayText: document.getElementById("tetris-overlay-text"),
    overlayBtn: document.getElementById("tetris-overlay-btn"),
    pauseBtn: document.getElementById("tetris-pause"),
    restartBtn: document.getElementById("tetris-restart"),
  };

  if (!els.board || !els.root) return;

  const ctx = els.board.getContext("2d");
  const nextCtx = els.next ? els.next.getContext("2d") : null;
  let videoVolume = loadVolume();

  let running = false;
  let paused = false;
  let over = false;
  let startedOnce = false;
  let raf = 0;
  let lastTs = 0;
  let dropAcc = 0;
  let board = [];
  let active = null;
  let queue = [];
  let bag = [];
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  let lines = 0;
  let level = 1;
  let media = [];
  let recentMedia = [];

  function cellSize() {
    return Math.max(1, Math.floor(els.board.width / COLS));
  }

  function resizeBoard() {
    const wrap = els.board.parentElement;
    if (!wrap) return;
    const stage = wrap.closest(".tetris-stage") || wrap.parentElement;
    const nextEl = stage && stage.querySelector(".tetris-next");
    const nextW = nextEl ? Math.ceil(nextEl.getBoundingClientRect().width) + 8 : 0;
    const stageW = stage ? stage.clientWidth : wrap.clientWidth;
    const stageH = stage ? stage.clientHeight : wrap.clientHeight;
    // Рамка поля ~4px + небольшой запас, чтобы не вылезало за экран
    const frame = 10;
    const maxW = Math.max(100, stageW - nextW - frame);
    const maxH = Math.max(140, stageH - frame);
    const size = Math.max(18, Math.min(Math.floor(maxW / COLS), Math.floor(maxH / ROWS)));
    const w = size * COLS;
    const h = size * ROWS;
    if (els.board.width !== w || els.board.height !== h) {
      els.board.width = w;
      els.board.height = h;
    }
    els.board.style.width = `${w}px`;
    els.board.style.height = `${h}px`;
    els.board.style.maxWidth = "100%";
    els.board.style.maxHeight = "100%";
    if (els.next) {
      const ns = Math.min(140, Math.max(72, Math.floor(size * 2.1)));
      if (els.next.width !== ns || els.next.height !== ns) {
        els.next.width = ns;
        els.next.height = ns;
      }
      els.next.style.width = `${ns}px`;
      els.next.style.height = `${ns}px`;
    }
  }

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function nextBag() {
    if (!bag.length) bag = shuffle(BAG);
    return bag.pop();
  }

  function busyMediaIndexes() {
    const set = new Set(recentMedia);
    if (active) set.add(active.mediaIndex);
    for (const p of queue) set.add(p.mediaIndex);
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (board[y][x]) set.add(board[y][x].mediaIndex);
      }
    }
    return set;
  }

  function nextMediaIndex() {
    if (!media.length) return 0;
    const busy = busyMediaIndexes();
    const freeVideos = [];
    const freeImages = [];
    const allVideos = [];
    for (let i = 0; i < media.length; i += 1) {
      if (media[i].type === "video") allVideos.push(i);
      if (busy.has(i)) continue;
      if (media[i].type === "video") freeVideos.push(i);
      else freeImages.push(i);
    }

    let pool;
    if (freeVideos.length && freeImages.length) {
      // Высокий шанс видео, иногда фото для разнообразия
      pool = Math.random() < 0.5 ? freeVideos : freeImages;
    } else if (freeVideos.length) {
      pool = freeVideos;
    } else if (freeImages.length) {
      // Свободных видео нет — всё равно чаще пробуем любое видео с поля/очереди не трогая busy если можно
      pool = freeImages;
    } else if (allVideos.length) {
      pool = allVideos;
    } else {
      pool = media.map((_, i) => i);
    }

    const idx = pool[Math.floor(Math.random() * pool.length)];
    recentMedia.push(idx);
    if (recentMedia.length > 16) recentMedia.shift();
    return idx;
  }

  function makePiece(type) {
    const t = type || nextBag();
    const mediaIndex = nextMediaIndex();
    ensureMediaEl(mediaIndex);
    return {
      type: t,
      cells: (SHAPES[t] || SHAPES.T).map(([x, y]) => [x, y]),
      x: 3,
      y: 0,
      mediaIndex,
    };
  }

  function rotateCells(cells) {
    const maxX = Math.max(...cells.map(([x]) => x));
    return cells.map(([x, y]) => [y, maxX - x]);
  }

  function pieceCells(piece, ox = piece.x, oy = piece.y, cells = piece.cells) {
    return cells.map(([x, y]) => [ox + x, oy + y]);
  }

  function collides(piece, ox = piece.x, oy = piece.y, cells = piece.cells) {
    return pieceCells(piece, ox, oy, cells).some(([x, y]) => {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y < 0) return false;
      return Boolean(board[y][x]);
    });
  }

  function dropInterval() {
    // Быстрее с каждым уровнем: ~900ms → ~70ms
    return Math.max(70, Math.round(920 * Math.pow(0.82, level - 1)));
  }

  function speedLabel() {
    const base = 920;
    const cur = dropInterval();
    const mult = base / cur;
    return `${mult.toFixed(mult >= 10 ? 0 : 1)}×`;
  }

  function lockPiece() {
    if (!active) return;
    for (const [x, y] of pieceCells(active)) {
      if (y < 0 || y >= ROWS || x < 0 || x >= COLS) {
        endGame();
        return;
      }
      board[y][x] = { mediaIndex: active.mediaIndex };
    }
    clearLines();
    spawnPiece();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y -= 1) {
      if (board[y].every((cell) => cell)) {
        board.splice(y, 1);
        board.unshift(Array.from({ length: COLS }, () => null));
        cleared += 1;
        y += 1;
      }
    }
    if (!cleared) return;
    lines += cleared;
    score += (LINE_SCORES[cleared] || cleared * 200) * level;
    level = Math.floor(lines / 8) + 1;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    syncHud();
  }

  function spawnPiece() {
    while (queue.length < 3) queue.push(makePiece(nextBag()));
    active = queue.shift();
    queue.push(makePiece(nextBag()));
    active.x = 3;
    active.y = 0;
    if (collides(active)) {
      endGame();
      return;
    }
    syncHud();
    syncVideos();
  }

  function tickDrop() {
    if (!active || paused || over) return;
    if (!collides(active, active.x, active.y + 1)) active.y += 1;
    else lockPiece();
  }

  function softDrop() {
    if (!active || paused || over) return;
    if (!collides(active, active.x, active.y + 1)) {
      active.y += 1;
      score += 1;
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
      }
      syncHud();
    } else lockPiece();
  }

  function hardDrop() {
    if (!active || paused || over) return;
    let dist = 0;
    while (!collides(active, active.x, active.y + 1)) {
      active.y += 1;
      dist += 1;
    }
    score += dist * 2;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    syncHud();
    lockPiece();
  }

  function move(dx) {
    if (!active || paused || over) return;
    if (!collides(active, active.x + dx, active.y)) active.x += dx;
  }

  function rotate() {
    if (!active || paused || over || active.type === "O") return;
    const next = rotateCells(active.cells);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(active, active.x + kick, active.y, next)) {
        active.cells = next;
        active.x += kick;
        return;
      }
    }
  }

  function ghostY() {
    if (!active) return 0;
    let y = active.y;
    while (!collides(active, active.x, y + 1)) y += 1;
    return y;
  }

  function syncHud() {
    if (els.score) els.score.textContent = String(score);
    if (els.best) els.best.textContent = String(best);
    if (els.lines) els.lines.textContent = String(lines);
    if (els.level) els.level.textContent = String(level);
    if (els.speed) els.speed.textContent = speedLabel();
    if (els.vol) els.vol.value = String(Math.round(videoVolume * 100));
    if (els.volLabel) els.volLabel.textContent = `${Math.round(videoVolume * 100)}%`;
    if (els.mediaTitle && active && media[active.mediaIndex]) {
      const item = media[active.mediaIndex];
      els.mediaTitle.textContent = `${item.type === "video" ? "▶" : "▣"} ${item.title}`;
    }
    if (els.pauseBtn) els.pauseBtn.textContent = paused ? "Продолжить" : "Пауза";
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
    // Выше 100% — через GainNode; у самого video максимум 1
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
    const r = Math.max(2, size * 0.12);
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

  function mediaEl(index) {
    const item = media[index];
    return item && item.el ? item.el : null;
  }

  function drawCell(target, mediaIndex, px, py, size, alpha = 1) {
    const el = mediaEl(mediaIndex);
    if (el) coverDraw(target, el, px, py, size, alpha);
    else {
      target.fillStyle = `hsla(${(mediaIndex * 47) % 360} 70% 45% / ${alpha})`;
      target.fillRect(px, py, size, size);
      target.strokeStyle = "rgba(255,255,255,0.25)";
      target.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    }
  }

  function drawBoard() {
    const size = cellSize();
    const w = els.board.width;
    const h = els.board.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * size + 0.5, 0);
      ctx.lineTo(x * size + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * size + 0.5);
      ctx.lineTo(w, y * size + 0.5);
      ctx.stroke();
    }

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const cell = board[y][x];
        if (cell) drawCell(ctx, cell.mediaIndex, x * size, y * size, size);
      }
    }

    if (active && !over) {
      const gy = ghostY();
      if (gy !== active.y) {
        for (const [x, y] of pieceCells(active, active.x, gy)) {
          if (y < 0) continue;
          ctx.strokeStyle = "rgba(214,255,75,0.55)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
        }
      }
      for (const [x, y] of pieceCells(active)) {
        if (y < 0) continue;
        drawCell(ctx, active.mediaIndex, x * size, y * size, size);
      }
    }

    if (paused && !over) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      ctx.font = "700 28px Onest, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Пауза", w / 2, h / 2);
    }

    // Обводка игровой зоны поверх всего
    ctx.strokeStyle = "rgba(214, 255, 75, 0.95)";
    ctx.lineWidth = Math.max(3, Math.round(size * 0.1));
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }

  function drawNext() {
    if (!nextCtx || !els.next) return;
    const w = els.next.width;
    const h = els.next.height;
    nextCtx.clearRect(0, 0, w, h);
    nextCtx.fillStyle = "rgba(0,0,0,0.35)";
    nextCtx.fillRect(0, 0, w, h);
    const piece = queue[0];
    if (!piece) return;
    const cells = piece.cells;
    const xs = cells.map(([x]) => x);
    const ys = cells.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const size = Math.floor(Math.min(w / (bw + 1.2), h / (bh + 1.2)));
    const ox = Math.floor((w - bw * size) / 2);
    const oy = Math.floor((h - bh * size) / 2);
    for (const [x, y] of cells) {
      drawCell(nextCtx, piece.mediaIndex, ox + (x - minX) * size, oy + (y - minY) * size, size);
    }
  }

  function usedMediaIndexes() {
    const set = new Set();
    if (active) set.add(active.mediaIndex);
    for (const p of queue) set.add(p.mediaIndex);
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (board[y][x]) set.add(board[y][x].mediaIndex);
      }
    }
    return set;
  }

  function fieldMediaIndexes() {
    const set = new Set();
    if (active && !over) set.add(active.mediaIndex);
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (board[y][x]) set.add(board[y][x].mediaIndex);
      }
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

      if (!onField || paused || over) {
        video.muted = true;
        if (!video.paused) video.pause();
        continue;
      }

      // Все видео на поле играют одновременно с одинаковой громкостью.
      // Сначала play() в mute (иначе браузер часто блокирует), затем unmute.
      video.loop = true;
      video.playsInline = true;
      if (video.paused || video.ended) {
        const startMuted = video.muted;
        video.muted = true;
        const req = video.play();
        if (req && typeof req.then === "function") {
          req
            .then(() => {
              if (paused || over || !fieldMediaIndexes().has(i)) return;
              video.muted = false;
              applyVideoLoudness(video);
            })
            .catch(() => {
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

  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;
    if (!paused && !over && active) {
      dropAcc += dt;
      const interval = dropInterval();
      while (dropAcc >= interval) {
        dropAcc -= interval;
        tickDrop();
      }
    }
    syncVideos();
    drawBoard();
    drawNext();
  }

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeBoard();
      drawBoard();
      drawNext();
    }, 60);
  }

  function endGame() {
    over = true;
    paused = false;
    syncHud();
    showOverlay("Конец игры", `Счёт: ${score} · рекорд: ${best} · линии: ${lines}`, "Ещё раз");
    syncVideos();
  }

  function resetMatch() {
    board = emptyBoard();
    queue = [];
    bag = [];
    active = null;
    score = 0;
    lines = 0;
    level = 1;
    dropAcc = 0;
    lastTs = 0;
    over = false;
    paused = false;
    recentMedia = [];
    spawnPiece();
    syncHud();
    showOverlay("", "", "", false);
  }

  function togglePause() {
    if (!running || over || !startedOnce) return;
    paused = !paused;
    syncHud();
    syncVideos();
  }

  function isAnimatedImageUrl(url) {
    return /\.(gif|webp)(\?|#|$)/i.test(String(url || ""));
  }

  function createVideoEl(item) {
    const video = document.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.loop = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.volume = 1;
    video.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);
    video.src = item.url;
    video.load();
    return video;
  }

  function createImageEl(item) {
    const img = new Image();
    img.decoding = "async";
    img.alt = "";
    // GIF/WebP анимируются в canvas только если элемент «живой» в DOM
    if (item.animated) {
      img.style.cssText =
        "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(img);
    }
    img.crossOrigin = "anonymous";
    img.src = item.url;
    return img;
  }

  function ensureMediaEl(index) {
    const item = media[index];
    if (!item || item.el || item.failed) return Promise.resolve(item);
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

  async function loadMedia() {
    showOverlay("Загрузка медиа…", "Подключаем все видео со стены", "", true);
    const res = await fetch("/api/game/tetris/media", { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Не удалось загрузить медиа");
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length < 4) throw new Error("Мало фото/видео на стене");

    disposeMedia();
    media = shuffle(
      items.map((item) => {
        const type = item.type === "video" ? "video" : "image";
        const url = item.url;
        return {
          id: item.id,
          url,
          type,
          title: item.title || item.id,
          animated: type === "image" && isAnimatedImageUrl(url),
          el: null,
          failed: false,
          loading: null,
        };
      })
    );

    // Сначала поднимаем пачку видео и фото, остальное догружается лениво
    const videos = media.map((m, i) => ({ m, i })).filter(({ m }) => m.type === "video");
    const images = media.map((m, i) => ({ m, i })).filter(({ m }) => m.type !== "video");
    const warm = [...videos.map((x) => x.i), ...images.map((x) => x.i)].slice(0, Math.min(24, media.length));
    await Promise.all(warm.map((i) => ensureMediaEl(i)));

    const ready = media.filter((m) => m.el).length;
    if (ready < 4) throw new Error("Медиа не прогрузились");

    // Фоном догружаем остальные, чтобы все видео успели поучаствовать
    media.forEach((_, i) => {
      if (!media[i].el && !media[i].failed) ensureMediaEl(i);
    });

    recentMedia = [];
  }

  function disposeMedia() {
    for (const item of media) {
      if (!item || !item.el) continue;
      if (item.type === "video") {
        item.el.pause();
        item.el.removeAttribute("src");
        item.el.load();
        if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
      } else {
        item.el.removeAttribute("src");
        if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
      }
    }
    media = [];
  }

  async function beginGame() {
    try {
      ensureAudioGraph();
      if (!media.length) await loadMedia();
      running = true;
      startedOnce = true;
      resizeBoard();
      resetMatch();
      cancelAnimationFrame(raf);
      lastTs = 0;
      raf = requestAnimationFrame(frame);
    } catch (err) {
      showOverlay("Не вышло", err.message || "Ошибка", "Повторить");
    }
  }

  function onKey(e) {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Spacebar"].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === "p" || e.key === "P" || e.key === "з" || e.key === "З") {
      togglePause();
      return;
    }
    if (!startedOnce || paused || over) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A" || e.key === "ф" || e.key === "Ф") move(-1);
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D" || e.key === "в" || e.key === "В") move(1);
    else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S" || e.key === "ы" || e.key === "Ы") softDrop();
    else if (
      e.key === "ArrowUp" ||
      e.key === "x" ||
      e.key === "X" ||
      e.key === "ч" ||
      e.key === "Ч" ||
      e.key === "w" ||
      e.key === "W" ||
      e.key === "ц" ||
      e.key === "Ц"
    )
      rotate();
    else if (e.key === " " || e.key === "Spacebar") hardDrop();
  }

  function bindPad(action) {
    if (!startedOnce) return;
    if (action === "left") move(-1);
    else if (action === "right") move(1);
    else if (action === "down") softDrop();
    else if (action === "rotate") rotate();
    else if (action === "drop") hardDrop();
  }

  if (els.pauseBtn) els.pauseBtn.addEventListener("click", () => togglePause());
  if (els.restartBtn) {
    els.restartBtn.addEventListener("click", () => {
      beginGame();
    });
  }
  if (els.overlayBtn) els.overlayBtn.addEventListener("click", () => beginGame());
  if (els.vol) {
    els.vol.addEventListener("input", () => setVolume(Number(els.vol.value) / 100));
    els.vol.addEventListener("change", () => setVolume(Number(els.vol.value) / 100));
  }

  document.querySelectorAll("[data-tetris]").forEach((btn) => {
    const fire = (e) => {
      e.preventDefault();
      bindPad(btn.getAttribute("data-tetris"));
    };
    btn.addEventListener("click", fire);
    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") fire(e);
    });
  });

  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(raf);
    for (const item of media) {
      if (item && item.type === "video" && item.el) item.el.pause();
    }
  });

  syncHud();
  resizeBoard();
  showOverlay("Медиа-тетрис", "Фигурки из файлов стены. Нажми, чтобы начать.", "Играть", true);
  requestAnimationFrame(() => {
    resizeBoard();
    drawBoard();
  });
})();
