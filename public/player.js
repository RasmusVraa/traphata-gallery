(function (global) {
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const activePlayers = new Set();

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const s = Math.floor(sec % 60);
    const m = Math.floor((sec / 60) % 60);
    const h = Math.floor(sec / 3600);
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function icon(name) {
    const icons = {
      play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
      pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
      volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a3.5 3.5 0 0 0-1.8-3.05v6.1A3.5 3.5 0 0 0 16.5 12z"/><path fill="currentColor" d="M14.5 3.76v2.06a6.5 6.5 0 0 1 0 12.36v2.06a8.5 8.5 0 0 0 0-16.48z"/></svg>',
      mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.5 12a3.5 3.5 0 0 0-1.8-3.05v2.2l1.76 1.76c.03-.3.04-.6.04-.91zM19.07 4.93l-1.41 1.41A8.45 8.45 0 0 1 21 12a8.45 8.45 0 0 1-2.18 5.66l1.41 1.41A10.45 10.45 0 0 0 23 12c0-2.66-.99-5.1-2.93-7.07zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.94 8.94 0 0 0 3.76-1.76L19.73 21 21 19.73 4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>',
      full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5h2zm10 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
      exitFull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
    };
    return icons[name] || "";
  }

  function buildSources(url, variants) {
    const list = [];
    const seen = new Set();
    const add = (label, src) => {
      if (!src || seen.has(src)) return;
      seen.add(src);
      list.push({ label, url: src });
    };
    if (Array.isArray(variants)) {
      for (const v of variants) {
        add(v.label || v.quality || "Вариант", v.url);
      }
    }
    add("Оригинал", url);
    return list;
  }

  function fillSpeedSelect(select) {
    for (const s of SPEEDS) {
      const opt = document.createElement("option");
      opt.value = String(s);
      opt.textContent = `${s}×`;
      if (s === 1) opt.selected = true;
      select.appendChild(opt);
    }
  }

  function pauseOthers(except) {
    for (const media of activePlayers) {
      if (media !== except && !media.paused) media.pause();
    }
  }

  function wireCommonControls(media, ui) {
    const {
      root,
      playBtn,
      muteBtn,
      volume,
      progress,
      time,
      speedSelect,
      fullBtn,
    } = ui;

    let lastVolume = 0.8;
    let seeking = false;
    media.volume = 0.8;
    activePlayers.add(media);

    function syncPlayIcon() {
      playBtn.innerHTML = media.paused ? icon("play") : icon("pause");
      playBtn.setAttribute("aria-label", media.paused ? "Play" : "Пауза");
    }

    function syncMuteIcon() {
      const muted = media.muted || media.volume === 0;
      muteBtn.innerHTML = muted ? icon("mute") : icon("volume");
    }

    function syncTime() {
      const duration = Number.isFinite(media.duration) ? media.duration : 0;
      const current = Number.isFinite(media.currentTime) ? media.currentTime : 0;
      time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
      if (!seeking && duration > 0) {
        progress.value = String(Math.round((current / duration) * 1000));
      }
    }

    function togglePlay() {
      if (media.paused) {
        pauseOthers(media);
        media.play().catch(() => {});
      } else {
        media.pause();
      }
    }

    playBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePlay();
    });

    muteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (media.muted || media.volume === 0) {
        media.muted = false;
        media.volume = lastVolume || 0.8;
        volume.value = String(Math.round(media.volume * 100));
      } else {
        lastVolume = media.volume;
        media.muted = true;
      }
      syncMuteIcon();
    });

    volume.addEventListener("input", () => {
      const v = Number(volume.value) / 100;
      media.volume = v;
      media.muted = v === 0;
      if (v > 0) lastVolume = v;
      syncMuteIcon();
    });

    speedSelect.addEventListener("change", () => {
      media.playbackRate = Number(speedSelect.value) || 1;
    });

    progress.addEventListener("pointerdown", () => {
      seeking = true;
    });
    const endSeek = () => {
      seeking = false;
    };
    progress.addEventListener("pointerup", endSeek);
    progress.addEventListener("pointercancel", endSeek);
    progress.addEventListener("input", () => {
      const duration = Number.isFinite(media.duration) ? media.duration : 0;
      if (duration <= 0) return;
      media.currentTime = (Number(progress.value) / 1000) * duration;
      syncTime();
    });

    if (fullBtn) {
      fullBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (document.fullscreenElement === root) {
            await document.exitFullscreen();
          } else if (root.requestFullscreen) {
            await root.requestFullscreen();
          } else if (media.webkitEnterFullscreen) {
            media.webkitEnterFullscreen();
          }
        } catch {
          /* ignore */
        }
      });

      document.addEventListener("fullscreenchange", () => {
        const on = document.fullscreenElement === root;
        fullBtn.innerHTML = on ? icon("exitFull") : icon("full");
        fullBtn.setAttribute("aria-label", on ? "Выйти из полного экрана" : "На весь экран");
      });
    }

    media.addEventListener("play", () => {
      pauseOthers(media);
      syncPlayIcon();
      root.classList.add("is-playing");
    });
    media.addEventListener("pause", () => {
      syncPlayIcon();
      root.classList.remove("is-playing");
    });
    media.addEventListener("ended", () => {
      syncPlayIcon();
      root.classList.remove("is-playing");
    });
    media.addEventListener("timeupdate", syncTime);
    media.addEventListener("loadedmetadata", syncTime);
    media.addEventListener("durationchange", syncTime);
    media.addEventListener("volumechange", syncMuteIcon);

    root.addEventListener("keydown", (e) => {
      if (e.target.closest("input, select, textarea, button")) {
        if (e.key !== " " && e.key !== "k") return;
      }
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m") {
        muteBtn.click();
      } else if (e.key === "f" && fullBtn) {
        fullBtn.click();
      } else if (e.key === "ArrowRight") {
        media.currentTime = Math.min(media.duration || 0, media.currentTime + 5);
      } else if (e.key === "ArrowLeft") {
        media.currentTime = Math.max(0, media.currentTime - 5);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        volume.value = String(Math.min(100, Number(volume.value) + 5));
        volume.dispatchEvent(new Event("input"));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        volume.value = String(Math.max(0, Number(volume.value) - 5));
        volume.dispatchEvent(new Event("input"));
      }
    });

    syncPlayIcon();
    syncMuteIcon();
    syncTime();

    return { togglePlay };
  }

  function createControlBits() {
    const progress = document.createElement("input");
    progress.type = "range";
    progress.className = "rv-player__progress";
    progress.min = "0";
    progress.max = "1000";
    progress.value = "0";
    progress.step = "1";
    progress.setAttribute("aria-label", "Прогресс");

    const time = document.createElement("span");
    time.className = "rv-player__time";
    time.textContent = "0:00 / 0:00";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "rv-player__btn";
    playBtn.setAttribute("aria-label", "Play");
    playBtn.innerHTML = icon("play");

    const muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.className = "rv-player__btn";
    muteBtn.setAttribute("aria-label", "Громкость");
    muteBtn.innerHTML = icon("volume");

    const volume = document.createElement("input");
    volume.type = "range";
    volume.className = "rv-player__volume-range";
    volume.min = "0";
    volume.max = "100";
    volume.value = "80";
    volume.setAttribute("aria-label", "Уровень громкости");

    const speedSelect = document.createElement("select");
    speedSelect.className = "rv-player__select";
    speedSelect.setAttribute("aria-label", "Скорость");
    fillSpeedSelect(speedSelect);

    return { progress, time, playBtn, muteBtn, volume, speedSelect };
  }

  function createVideoPlayer(options) {
    const src = options.src;
    if (!src) return null;
    const sources = buildSources(src, options.variants);
    const compact = Boolean(options.compact);

    const root = document.createElement("div");
    root.className = `rv-player rv-player--video${compact ? " rv-player--compact" : ""}`;
    root.tabIndex = 0;

    const stage = document.createElement("div");
    stage.className = "rv-player__stage";

    const video = document.createElement("video");
    video.className = "rv-player__video";
    video.playsInline = true;
    video.preload = "metadata";
    video.src = sources[0].url;
    video.setAttribute("playsinline", "");
    video.disablePictureInPicture = false;

    const controls = document.createElement("div");
    controls.className = "rv-player__controls";

    const bits = createControlBits();
    const top = document.createElement("div");
    top.className = "rv-player__row rv-player__row--progress";
    top.appendChild(bits.progress);
    top.appendChild(bits.time);

    const bottom = document.createElement("div");
    bottom.className = "rv-player__row rv-player__row--main";

    const volWrap = document.createElement("div");
    volWrap.className = "rv-player__volume";
    volWrap.appendChild(bits.muteBtn);
    volWrap.appendChild(bits.volume);

    const menus = document.createElement("div");
    menus.className = "rv-player__menus";
    menus.appendChild(bits.speedSelect);

    const hasVariants = sources.length > 1;
    let qualitySelect = null;
    if (hasVariants) {
      qualitySelect = document.createElement("select");
      qualitySelect.className = "rv-player__select";
      qualitySelect.setAttribute("aria-label", "Качество");
      for (const s of sources) {
        const opt = document.createElement("option");
        opt.value = s.url;
        opt.textContent = s.label;
        qualitySelect.appendChild(opt);
      }
      menus.appendChild(qualitySelect);
      qualitySelect.addEventListener("change", () => {
        const next = qualitySelect.value;
        if (!next || next === video.src) return;
        const t = video.currentTime;
        const wasPaused = video.paused;
        const rate = video.playbackRate;
        video.src = next;
        video.addEventListener(
          "loadedmetadata",
          () => {
            video.currentTime = t;
            video.playbackRate = rate;
            if (!wasPaused) video.play().catch(() => {});
          },
          { once: true }
        );
      });
    }

    const fullBtn = document.createElement("button");
    fullBtn.type = "button";
    fullBtn.className = "rv-player__btn";
    fullBtn.setAttribute("aria-label", "На весь экран");
    fullBtn.innerHTML = icon("full");

    bottom.appendChild(bits.playBtn);
    bottom.appendChild(volWrap);
    bottom.appendChild(menus);
    bottom.appendChild(fullBtn);

    controls.appendChild(top);
    controls.appendChild(bottom);
    stage.appendChild(video);
    stage.appendChild(controls);
    root.appendChild(stage);

    const api = wireCommonControls(video, {
      root,
      playBtn: bits.playBtn,
      muteBtn: bits.muteBtn,
      volume: bits.volume,
      progress: bits.progress,
      time: bits.time,
      speedSelect: bits.speedSelect,
      fullBtn,
    });

    stage.addEventListener("click", (e) => {
      if (e.target.closest(".rv-player__controls")) return;
      api.togglePlay();
    });

    video.addEventListener("loadeddata", () => {
      root.classList.add("is-ready");
    });

    return root;
  }

  function createAudioPlayer(options) {
    const src = options.src;
    if (!src) return null;
    const compact = Boolean(options.compact);
    const title = options.title || "";

    const root = document.createElement("div");
    root.className = `rv-player rv-player--audio${compact ? " rv-player--compact" : ""}`;
    root.tabIndex = 0;

    const shell = document.createElement("div");
    shell.className = "rv-player__audio-shell";

    const disc = document.createElement("button");
    disc.type = "button";
    disc.className = "rv-player__disc";
    disc.setAttribute("aria-label", "Play");
    disc.innerHTML = '<span class="rv-player__disc-label" aria-hidden="true">♪</span>';

    const meta = document.createElement("div");
    meta.className = "rv-player__audio-meta";
    meta.innerHTML = `<p class="rv-player__audio-title">${escapeHtml(title || "Аудио")}</p><p class="rv-player__audio-sub">Аудиофайл</p>`;

    const audio = document.createElement("audio");
    audio.className = "rv-player__audio";
    audio.preload = "metadata";
    audio.controls = false;
    audio.setAttribute("playsinline", "");
    audio.src = src;

    const controls = document.createElement("div");
    controls.className = "rv-player__controls";

    const bits = createControlBits();
    const top = document.createElement("div");
    top.className = "rv-player__row rv-player__row--progress";
    top.appendChild(bits.progress);
    top.appendChild(bits.time);

    const bottom = document.createElement("div");
    bottom.className = "rv-player__row rv-player__row--main";

    const volWrap = document.createElement("div");
    volWrap.className = "rv-player__volume";
    volWrap.appendChild(bits.muteBtn);
    volWrap.appendChild(bits.volume);

    const menus = document.createElement("div");
    menus.className = "rv-player__menus";
    menus.appendChild(bits.speedSelect);

    bottom.appendChild(bits.playBtn);
    bottom.appendChild(volWrap);
    bottom.appendChild(menus);

    controls.appendChild(top);
    controls.appendChild(bottom);

    const head = document.createElement("div");
    head.className = "rv-player__audio-body";
    head.appendChild(disc);
    head.appendChild(meta);

    shell.appendChild(head);
    shell.appendChild(controls);
    shell.appendChild(audio);
    root.appendChild(shell);

    const api = wireCommonControls(audio, {
      root,
      playBtn: bits.playBtn,
      muteBtn: bits.muteBtn,
      volume: bits.volume,
      progress: bits.progress,
      time: bits.time,
      speedSelect: bits.speedSelect,
      fullBtn: null,
    });

    disc.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      api.togglePlay();
    });

    audio.addEventListener("play", () => {
      disc.setAttribute("aria-label", "Пауза");
    });
    audio.addEventListener("pause", () => {
      disc.setAttribute("aria-label", "Play");
    });

    audio.addEventListener("error", () => {
      root.classList.add("is-error");
      meta.querySelector(".rv-player__audio-sub").textContent = "Не удалось загрузить";
    });

    // Some short files report Infinity duration until enough data is buffered.
    audio.addEventListener("loadedmetadata", () => {
      if (!Number.isFinite(audio.duration) || audio.duration === Infinity) {
        audio.currentTime = 1e101;
        audio.addEventListener(
          "timeupdate",
          function fixDuration() {
            audio.removeEventListener("timeupdate", fixDuration);
            audio.currentTime = 0;
          },
          { once: true }
        );
      }
    });

    return root;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createPlayer(options) {
    const opts = options || {};
    if (opts.kind === "audio") return createAudioPlayer(opts);
    return createVideoPlayer(opts);
  }

  function mount(el, options) {
    if (!el) return null;
    const player = createPlayer(options || {});
    if (!player) return null;
    el.innerHTML = "";
    el.appendChild(player);
    return player;
  }

  global.RvPlayer = { create: createPlayer, mount };
})(typeof window !== "undefined" ? window : globalThis);
