(function () {
  const intro = document.getElementById("game-intro");
  const lobby = document.getElementById("game-lobby");
  const play = document.getElementById("game-play");
  const result = document.getElementById("game-result");
  const dailyBtn = document.getElementById("game-daily");
  const startBtn = document.getElementById("game-start");
  const revealBtn = document.getElementById("game-reveal");
  const createRoomBtn = document.getElementById("mp-create-room");
  const multiplayerBtn = document.getElementById("game-multiplayer");
  const mpHub = document.getElementById("game-mp-hub");
  const mpHubBack = document.getElementById("mp-hub-back");
  const mpHubStatus = document.getElementById("mp-hub-status");
  const mpLobbyList = document.getElementById("mp-lobby-list");
  const mpLobbiesEmpty = document.getElementById("mp-lobbies-empty");
  const mpLobbiesRefresh = document.getElementById("mp-lobbies-refresh");
  const joinForm = document.getElementById("game-join-form");
  const joinCodeInput = document.getElementById("game-join-code");
  const againBtn = document.getElementById("game-again");
  const rematchBtn = document.getElementById("game-rematch");
  const rematchStatus = document.getElementById("game-rematch-status");
  const statusEl = document.getElementById("game-status");
  const authHint = document.getElementById("game-auth-hint");
  const gameAuthActions = document.getElementById("game-auth-actions");
  const gameLoginBtn = document.getElementById("game-login-btn");
  const gameRegisterBtn = document.getElementById("game-register-btn");
  const gameAuthDialog = document.getElementById("game-auth-dialog");
  const gameAuthForm = document.getElementById("game-auth-form");
  const gameAuthTitle = document.getElementById("game-auth-title");
  const gameAuthError = document.getElementById("game-auth-error");
  const gameAuthUsername = document.getElementById("game-auth-username");
  const gameAuthPassword = document.getElementById("game-auth-password");
  const gameAuthPassword2 = document.getElementById("game-auth-password2");
  const gameAuthPassword2Field = document.getElementById("game-auth-password2-field");
  const gameAuthCancel = document.getElementById("game-auth-cancel");
  const gameAuthSwitch = document.getElementById("game-auth-switch");
  const gameAuthSubmit = document.getElementById("game-auth-submit");
  const dailyCountdown = document.getElementById("daily-countdown");
  const dailyCta = document.getElementById("daily-cta");
  const roundNum = document.getElementById("game-round-num");
  const scoreEl = document.getElementById("game-score");
  const attemptsEl = document.getElementById("game-attempts");
  const tagEl = document.getElementById("game-tag");
  const timerChip = document.getElementById("game-timer-chip");
  const timerEl = document.getElementById("game-timer");
  const modeChip = document.getElementById("game-mode-chip");
  const modeLabel = document.getElementById("game-mode-label");
  const progressBar = document.getElementById("game-progress-bar");
  const imageWrap = document.getElementById("game-image-wrap");
  const imageEl = document.getElementById("game-image");
  const videoEl = document.getElementById("game-video");
  const audioWrap = document.getElementById("game-audio-wrap");
  const audioEl = document.getElementById("game-audio");
  const volumeInput = document.getElementById("game-volume");
  const burstEl = document.getElementById("game-burst");
  const answerFanfare = document.getElementById("game-answer-fanfare");
  const answerFanfareTitle = document.getElementById("game-answer-fanfare-title");
  const optionsEl = document.getElementById("game-options");
  const feedbackEl = document.getElementById("game-feedback");
  const finalPoints = document.getElementById("game-final-points");
  const finalCaption = document.getElementById("game-final-caption");
  const resultTitle = document.getElementById("game-result-title");
  const profileScoreEl = document.getElementById("game-profile-score");
  const profileLink = document.getElementById("game-profile-link");
  const lobbyCode = document.getElementById("lobby-code");
  const lobbyCopyBtn = document.getElementById("lobby-copy-code");
  const lobbyPlayers = document.getElementById("lobby-players");
  const lobbyStart = document.getElementById("lobby-start");
  const lobbyReadyBtn = document.getElementById("lobby-ready");
  const lobbyLeave = document.getElementById("lobby-leave");
  const lobbyStatus = document.getElementById("lobby-status");
  const lobbySubline = document.getElementById("lobby-subline");
  const lobbySettings = document.getElementById("lobby-settings");
  const lobbySettingsReadonly = document.getElementById("lobby-settings-readonly");
  const lobbySettingsHint = document.getElementById("lobby-settings-hint");
  const lobbyPlayMode = document.getElementById("lobby-play-mode");
  const lobbyRounds = document.getElementById("lobby-rounds");
  const lobbyRoundSec = document.getElementById("lobby-round-sec");
  const lobbyMedia = document.getElementById("lobby-media");
  const lobbyTag = document.getElementById("lobby-tag");
  const onlineBoard = document.getElementById("online-board");
  const resultPlayers = document.getElementById("result-players");
  const revealVeil = document.getElementById("game-reveal-veil");
  const countdownEl = document.getElementById("game-countdown");
  const countdownNum = document.getElementById("game-countdown-num");
  const countdownLabel = document.getElementById("game-countdown-label");
  const timebarEl = document.getElementById("game-timebar");
  const timebarFill = document.getElementById("game-timebar-fill");
  const timebarSec = document.getElementById("game-timebar-sec");
  const roundTotalEl = document.getElementById("game-round-total");

  const REVEAL_PREP_SEC = 4;
  const REVEAL_OPEN_MS = 7000;
  const REVEAL_ROUND_MS = 20000;
  const DEFAULT_ROUND_MS = 25000;

  let me = null;
  let daily = null;
  let gameTags = [];
  let mode = "fun";
  let playMode = "race";
  let gameId = null;
  let roomCode = null;
  let busy = false;
  let lockOptions = false;
  let pollTimer = null;
  let clockTimer = null;
  let dailyTimer = null;
  let revealRaf = null;
  let revealRunning = false;
  let lastRoundKey = "";
  let endsAt = null;
  let roundStartedAt = null;
  let roundMs = DEFAULT_ROUND_MS;
  let mediaReady = false;
  let armingClock = false;
  let countdownToken = 0;
  let revealArmedKey = "";
  let preparingKey = "";
  let countdownActive = false;
  let wantVideoSound = true;
  let mediaVolume = 0.5;
  try {
    const savedVol = Number(localStorage.getItem("rv_game_volume"));
    if (Number.isFinite(savedVol)) mediaVolume = Math.max(0, Math.min(1, savedVol));
  } catch {
    /* ignore */
  }
  let audioCtx = null;
  let fanfareTimer = null;
  let fanfareKey = "";
  let lastLobbySettingsKey = "";
  let isHostViewer = false;
  let settingsSaveTimer = null;
  let applyingLobbySettings = false;
  let localSettingsDirtyUntil = 0;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function setLobbyStatus(text) {
    if (lobbyStatus) lobbyStatus.textContent = text || "";
  }

  function setMpHubStatus(text) {
    if (mpHubStatus) mpHubStatus.textContent = text || "";
  }

  function showView(name) {
    if (!(name === "play" && countdownActive)) {
      hideCountdown();
    }
    hideTimebar();
    document.body.classList.toggle("game-playing", name === "play");
    document.body.classList.toggle("game-mp-view", name === "mp" || name === "lobby");
    if (name !== "play") {
      hideAnswerFanfare();
      stopAudioMedia();
      if (videoEl) {
        videoEl.pause();
      }
      document.body.classList.remove("game-online-play");
      setPrepUiHidden(false);
      if (play) {
        play.classList.remove("is-prep");
        play.classList.remove("game-play--online");
      }
    }
    intro.classList.toggle("hidden", name !== "intro");
    if (mpHub) mpHub.classList.toggle("hidden", name !== "mp");
    lobby.classList.toggle("hidden", name !== "lobby");
    play.classList.toggle("hidden", name !== "play");
    result.classList.toggle("hidden", name !== "result");
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
    countdownToken += 1;
    hideCountdown();
    hideTimebar();
    stopReveal();
  }

  function hideCountdown() {
    countdownActive = false;
    if (countdownEl) countdownEl.classList.add("hidden");
    if (countdownNum) countdownNum.classList.remove("is-pulse", "is-go");
  }

  function hideTimebar() {
    if (!timebarEl) return;
    timebarEl.classList.add("hidden");
    timebarEl.classList.remove("is-urgent");
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function ensureAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function playCountdownTone(kind) {
    try {
      const ctx = ensureAudio();
      if (!ctx) return;
      const fire = () => {
        try {
          if (ctx.state !== "running") return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const now = ctx.currentTime;
          const isGo = kind === "go";
          osc.type = isGo ? "triangle" : "sine";
          osc.frequency.setValueAtTime(isGo ? 660 : kind === 1 ? 480 : 420 + Number(kind) * 30, now);
          if (isGo) {
            osc.frequency.linearRampToValueAtTime(990, now + 0.18);
          }
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(isGo ? 0.28 : 0.16, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + (isGo ? 0.42 : 0.2));
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + (isGo ? 0.45 : 0.24));
        } catch {
          /* ignore */
        }
      };
      // Яндекс.Браузер: AudioContext часто suspended до жеста — resume, потом тон.
      if (ctx.state === "suspended") {
        ctx.resume().then(fire).catch(() => {});
        return;
      }
      fire();
    } catch {
      /* ignore autoplay / audio errors */
    }
  }

  function playCorrectSound() {
    try {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === notes.length - 1 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.0001, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.32);
      });
    } catch {
      /* ignore */
    }
  }

  function playWrongSound() {
    try {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.22);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      /* ignore */
    }
  }

  function hideAnswerFanfare() {
    if (fanfareTimer) {
      clearTimeout(fanfareTimer);
      fanfareTimer = null;
    }
    if (answerFanfare) answerFanfare.classList.add("hidden");
  }

  function showAnswerFanfare(title, { key = "", correct = false } = {}) {
    if (!answerFanfare || !answerFanfareTitle || !title) return;
    const fanKey = `${key}:${title}`;
    if (fanfareKey === fanKey && !answerFanfare.classList.contains("hidden")) return;
    fanfareKey = fanKey;
    answerFanfareTitle.textContent = title;
    answerFanfare.classList.toggle("is-correct", Boolean(correct));
    answerFanfare.classList.remove("hidden");
    void answerFanfare.offsetWidth;
    if (fanfareTimer) clearTimeout(fanfareTimer);
    fanfareTimer = setTimeout(() => {
      hideAnswerFanfare();
    }, 2200);
  }

  async function runRevealCountdown(token, endsAtMs = null, { prep = false, maxSec = null } = {}) {
    lockOptions = true;
    ensureAudio();
    countdownActive = true;
    const cap = prep ? 3 : maxSec != null ? maxSec : REVEAL_PREP_SEC;
    if (!countdownEl || !countdownNum) {
      await sleep(cap * 1000);
      countdownActive = false;
      return token === countdownToken;
    }

    countdownEl.classList.remove("hidden");
    if (countdownLabel) {
      countdownLabel.textContent = prep ? "Приготовьтесь" : "Проявление";
    }

    // Дискретные тики 3→2→1: стабильнее Date.now()/ceil (Яндекс.Браузер залипал на «3»).
    for (let n = cap; n >= 1; n -= 1) {
      if (token !== countdownToken) {
        countdownActive = false;
        return false;
      }
      countdownNum.textContent = String(n);
      if (countdownLabel) {
        countdownLabel.textContent = prep
          ? "Приготовьтесь"
          : n >= REVEAL_PREP_SEC
            ? "Приготовьтесь"
            : "Проявление";
      }
      countdownNum.classList.remove("is-pulse", "is-go");
      void countdownNum.offsetWidth;
      countdownNum.classList.add("is-pulse");
      playCountdownTone(n);

      const tickEnd = (typeof performance !== "undefined" ? performance.now() : Date.now()) + 1000;
      while (token === countdownToken) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now >= tickEnd) break;
        await sleep(Math.min(50, tickEnd - now));
      }
    }

    if (token !== countdownToken) {
      countdownActive = false;
      return false;
    }

    if (prep) {
      hideCountdown();
      return true;
    }

    countdownEl.classList.remove("hidden");
    countdownNum.textContent = "GO";
    if (countdownLabel) countdownLabel.textContent = "Поехали!";
    countdownNum.classList.remove("is-pulse");
    void countdownNum.offsetWidth;
    countdownNum.classList.add("is-pulse", "is-go");
    playCountdownTone("go");
    await sleep(420);
    if (token !== countdownToken) {
      countdownActive = false;
      return false;
    }
    hideCountdown();
    return true;
  }

  function pauseRoundMedia() {
    if (videoEl) {
      try {
        videoEl.pause();
      } catch {
        /* ignore */
      }
      videoEl.muted = true;
    }
    if (audioEl) {
      try {
        audioEl.pause();
      } catch {
        /* ignore */
      }
      audioEl.muted = true;
      if (audioWrap) audioWrap.classList.add("is-paused");
    }
  }

  function setPrepUiHidden(hidden) {
    const stage = document.querySelector(".game-stage");
    const question = document.querySelector(".game-question");
    const volume = document.querySelector(".game-volume");
    if (stage) stage.classList.toggle("is-prep-hidden", Boolean(hidden));
    if (optionsEl) optionsEl.classList.toggle("is-prep-hidden", Boolean(hidden));
    if (question) question.classList.toggle("is-prep-hidden", Boolean(hidden));
    if (volume) volume.classList.toggle("is-prep-hidden", Boolean(hidden));
    if (feedbackEl) {
      feedbackEl.classList.toggle("is-prep-hidden", Boolean(hidden));
      if (hidden) {
        feedbackEl.textContent = "";
        feedbackEl.classList.remove("is-bad");
      }
    }
    if (hidden) pauseRoundMedia();
  }

  let onlinePrepToken = 0;
  /** Стабильный id prep-фазы = server phaseEndsAt; один отсчёт 3-2-1 на фазу. */
  let onlinePrepEndsAt = 0;

  async function ensureOnlinePrepCountdown(phaseEndsAt, prepMs) {
    const serverEnd = Number(phaseEndsAt) || 0;
    if (!serverEnd) {
      onlinePrepEndsAt = 0;
      hideCountdown();
      return;
    }
    // Уже запущен/завершён для этой prep-фазы — не перезапускать (иначе «3 3 3»).
    if (onlinePrepEndsAt === serverEnd) return;

    onlinePrepEndsAt = serverEnd;
    const token = ++onlinePrepToken;
    const localToken = ++countdownToken;
    setPrepUiHidden(true);
    if (play) play.classList.add("is-prep");
    pauseRoundMedia();

    const capMs = Math.min(3000, Math.max(1000, Number(prepMs) || 3000));
    const ends = Date.now() + capMs;
    await runRevealCountdown(localToken, ends, { prep: true, maxSec: 3 });
    if (token !== onlinePrepToken) return;
  }

  function applyMediaVolume() {
    wantVideoSound = mediaVolume > 0.01;
    const allowPlay = !(play && play.classList.contains("is-prep"));
    if (videoEl) {
      videoEl.volume = mediaVolume;
      videoEl.muted = !wantVideoSound || !allowPlay;
      if (allowPlay && wantVideoSound && !videoEl.hidden) {
        videoEl.play().catch(() => {
          videoEl.muted = true;
          videoEl.play().catch(() => {});
        });
      } else if (!allowPlay) {
        try {
          videoEl.pause();
        } catch {
          /* ignore */
        }
      }
    }
    if (audioEl) {
      audioEl.volume = mediaVolume;
      audioEl.muted = !wantVideoSound || !allowPlay;
      if (allowPlay && wantVideoSound && audioWrap && !audioWrap.classList.contains("hidden")) {
        audioEl.play().catch(() => {});
      } else {
        try {
          audioEl.pause();
        } catch {
          /* ignore */
        }
      }
      if (audioWrap) {
        audioWrap.classList.toggle(
          "is-paused",
          !allowPlay || !wantVideoSound || audioEl.paused
        );
      }
    }
  }

  function applyVideoSound() {
    applyMediaVolume();
  }

  async function postRoomReady() {
    if (gameId) {
      return api("/api/game/ready", {
        method: "POST",
        body: JSON.stringify({ gameId }),
      });
    }
    if (roomCode) {
      return api("/api/game/room/ready", {
        method: "POST",
        body: JSON.stringify({ code: roomCode }),
      });
    }
    return null;
  }

  async function armAndStartReveal() {
    if (playMode !== "reveal") return;
    const key = lastRoundKey;
    if (armingClock && preparingKey === key) return;
    if (revealArmedKey === key && mediaReady && roundStartedAt) {
      ensureRevealRunning();
      return;
    }

    const token = countdownToken;
    preparingKey = key;
    armingClock = true;
    try {
      if (mode !== "online") {
        await waitForMediaReady(8000);
      }
      if (token !== countdownToken || lastRoundKey !== key) return;

      scheduleFitMediaFrame();
      setRevealProgress(0);
      endsAt = null;
      roundStartedAt = null;
      mediaReady = false;
      hideTimebar();
      updateClock();

      if (videoEl && !videoEl.hidden) {
        videoEl.muted = true;
        await videoEl.play().catch(() => {});
        applyVideoSound();
      }

      let state = null;
      if (mode === "online") {
        if (feedbackEl) {
          feedbackEl.classList.remove("is-bad");
          feedbackEl.textContent = "Ждём старта раунда…";
        }
        while (token === countdownToken && lastRoundKey === key && mode === "online" && roomCode) {
          try {
            state = await api(`/api/game/room/${encodeURIComponent(roomCode)}`);
          } catch {
            await sleep(300);
            continue;
          }
          if (token !== countdownToken || lastRoundKey !== key) return;
          if (state.finished || state.status === "finished") return;
          if (state.roundPhase === "reveal") return;
          if (state.roundStartedAt && state.clockArmed && state.roundPhase === "playing") break;
          await sleep(250);
        }
        if (token !== countdownToken || lastRoundKey !== key) return;
        try {
          state = await postRoomReady();
        } catch {
          /* ignore */
        }
      } else {
        if (feedbackEl) {
          feedbackEl.classList.remove("is-bad");
          feedbackEl.textContent = "";
        }
        const ok = await runRevealCountdown(token);
        if (!ok || token !== countdownToken || lastRoundKey !== key) return;
        try {
          state = await postRoomReady();
        } catch {
          state = null;
        }
      }
      if (token !== countdownToken || lastRoundKey !== key) return;

      if (playMode === "reveal" && mode !== "online") {
        roundMs = REVEAL_ROUND_MS;
      } else {
        roundMs = Number(state && state.roundMs) || roundMs || REVEAL_ROUND_MS;
      }
      const now = Date.now();
      if (mode === "online" && state && state.roundStartedAt && state.clockArmed) {
        roundStartedAt = state.roundStartedAt;
        endsAt = state.endsAt || roundStartedAt + roundMs;
      } else {
        roundStartedAt = now;
        endsAt = now + roundMs;
      }

      mediaReady = true;
      revealArmedKey = key;
      lockOptions = false;
      if (feedbackEl) feedbackEl.textContent = "";
      if (timerEl) timerEl.textContent = String(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
      setRevealProgress(0);
      startReveal();
      updateClock();
      applyVideoSound();
    } finally {
      if (preparingKey === key) {
        preparingKey = "";
        armingClock = false;
      }
    }
  }

  function syncOnlineRaceClock(state) {
    if (!state) return;
    roundMs = Number(state.roundMs) || roundMs;
    if (state.roundStartedAt && state.clockArmed) {
      roundStartedAt = state.roundStartedAt;
      endsAt = state.endsAt || roundStartedAt + roundMs;
      mediaReady = true;
      lockOptions = Boolean(state.round && state.round.done);
      updateClock();
    }
  }

  function updateTimebar() {
    if (!timebarEl || !timebarFill || !timebarSec) return;
    const onPlay = play && !play.classList.contains("hidden");
    const revealWaiting = playMode === "reveal" && !mediaReady;
    const live =
      onPlay &&
      Boolean(endsAt && roundStartedAt) &&
      !revealWaiting &&
      (mode === "daily" || mode === "reveal" || mode === "online");
    if (!live) {
      hideTimebar();
      return;
    }
    const leftMs = Math.max(0, endsAt - Date.now());
    const leftSec = Math.max(0, Math.ceil(leftMs / 1000));
    const pct = roundMs > 0 ? Math.max(0, Math.min(100, (leftMs / roundMs) * 100)) : 0;
    timebarEl.classList.remove("hidden");
    timebarEl.classList.toggle("is-urgent", leftSec <= 5);
    timebarFill.style.width = `${pct}%`;
    timebarSec.textContent = String(leftSec);
  }

  function stopReveal() {
    revealRunning = false;
    if (revealRaf) {
      cancelAnimationFrame(revealRaf);
      revealRaf = null;
    }
    if (revealVeil) {
      revealVeil.classList.add("hidden");
      revealVeil.classList.remove("is-active");
      revealVeil.style.removeProperty("--reveal");
    }
    imageWrap.classList.remove("is-reveal");
    imageWrap.style.removeProperty("--reveal");
  }

  function setRevealProgress(t) {
    const clamped = Math.min(1, Math.max(0, t));
    const pct = `${(clamped * 100).toFixed(3)}%`;
    imageWrap.style.setProperty("--reveal", pct);
    imageWrap.classList.add("is-reveal");
    if (revealVeil) {
      revealVeil.style.setProperty("--reveal", pct);
      revealVeil.classList.add("is-active");
      revealVeil.classList.remove("hidden");
    }
  }

  function syncRevealFrame() {
    if (!revealRunning || playMode !== "reveal" || !roundStartedAt || !roundMs) {
      revealRaf = null;
      return;
    }
    // Curtain fully opens in 7s; round timer stays longer for guessing.
    const openMs = Math.min(REVEAL_OPEN_MS, Math.max(4000, roundMs));
    const t = (Date.now() - roundStartedAt) / openMs;
    setRevealProgress(t);
    if (t < 1) {
      revealRaf = requestAnimationFrame(syncRevealFrame);
    } else {
      setRevealProgress(1);
      revealRaf = null;
    }
  }

  function ensureRevealRunning() {
    if (playMode !== "reveal" || !roundStartedAt || !mediaReady) return;
    revealRunning = true;
    if (!revealRaf) {
      revealRaf = requestAnimationFrame(syncRevealFrame);
    }
  }

  function startReveal() {
    if (playMode !== "reveal") {
      stopReveal();
      return;
    }
    if (!mediaReady || !roundStartedAt) {
      setRevealProgress(0);
      return;
    }
    revealRunning = true;
    if (revealRaf) cancelAnimationFrame(revealRaf);
    revealRaf = requestAnimationFrame(syncRevealFrame);
  }

  function waitForMediaReady(timeoutMs = 2500) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);

      const wrap = () => {
        clearTimeout(timer);
        finish();
      };

      if (audioWrap && !audioWrap.classList.contains("hidden") && audioEl) {
        if (audioEl.readyState >= 2) {
          wrap();
          return;
        }
        const onReady = () => {
          audioEl.removeEventListener("loadeddata", onReady);
          audioEl.removeEventListener("error", onReady);
          wrap();
        };
        audioEl.addEventListener("loadeddata", onReady);
        audioEl.addEventListener("error", onReady);
        return;
      }
      if (!imageEl.hidden) {
        if (imageEl.complete && imageEl.naturalWidth > 0) {
          wrap();
          return;
        }
        const onLoad = () => {
          imageEl.removeEventListener("load", onLoad);
          imageEl.removeEventListener("error", onLoad);
          wrap();
        };
        imageEl.addEventListener("load", onLoad);
        imageEl.addEventListener("error", onLoad);
        return;
      }
      if (!videoEl.hidden) {
        if (videoEl.readyState >= 2) {
          wrap();
          return;
        }
        const onReady = () => {
          videoEl.removeEventListener("loadeddata", onReady);
          videoEl.removeEventListener("error", onReady);
          wrap();
        };
        videoEl.addEventListener("loadeddata", onReady);
        videoEl.addEventListener("error", onReady);
        return;
      }
      wrap();
    });
  }

  async function prepareRevealMedia() {
    if (playMode !== "reveal") {
      countdownToken += 1;
      mediaReady = false;
      revealRunning = false;
      hideCountdown();
      hideTimebar();
      stopReveal();
      return;
    }

    const key = lastRoundKey;
    if (armingClock && preparingKey === key) return;
    if (revealArmedKey === key && mediaReady && roundStartedAt) {
      ensureRevealRunning();
      return;
    }

    countdownToken += 1;
    mediaReady = false;
    revealRunning = false;
    revealArmedKey = "";
    endsAt = null;
    roundStartedAt = null;
    hideCountdown();
    hideTimebar();
    setRevealProgress(0);
    lockOptions = true;
    if (feedbackEl) {
      feedbackEl.classList.remove("is-bad");
      if (!feedbackEl.textContent || feedbackEl.textContent === "Приготовьтесь…") {
        feedbackEl.textContent = "Загружаем картинку…";
      }
    }
    await armAndStartReveal();
    if (
      feedbackEl &&
      (feedbackEl.textContent === "Загружаем картинку…" || feedbackEl.textContent === "Приготовьтесь…")
    ) {
      feedbackEl.textContent = "";
    }
  }

  function updateClock() {
    if (!timerEl) return;
    if (playMode === "reveal" && (!mediaReady || !roundStartedAt || !endsAt)) {
      // До старта показываем длительность раунда (20с), не тикаем.
      timerEl.textContent = String(Math.round(REVEAL_ROUND_MS / 1000));
      hideTimebar();
      return;
    }
    if (!endsAt) {
      hideTimebar();
      return;
    }
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    timerEl.textContent = String(left);
    updateTimebar();
    if (left <= 0 && (mode === "daily" || mode === "reveal") && gameId && !busy && mediaReady) {
      tickDailyTimeout();
    }
  }

  function fillTagSelect(selected) {
    if (!lobbyTag) return;
    const current = selected == null ? lobbyTag.value : String(selected || "");
    lobbyTag.innerHTML = '<option value="">Любые теги</option>';
    gameTags.forEach(({ tag, count }) => {
      const opt = document.createElement("option");
      opt.value = tag;
      opt.textContent = `#${tag} · ${count}`;
      lobbyTag.appendChild(opt);
    });
    lobbyTag.value = current;
    if (lobbyTag.value !== current) lobbyTag.value = "";
  }

  function readLobbySettingsFromForm() {
    const roundsRaw = Number(lobbyRounds.value);
    return {
      playMode: lobbyPlayMode.value || "race",
      rounds: Number.isFinite(roundsRaw) ? roundsRaw : 5,
      roundSeconds: Number(lobbyRoundSec.value) || 25,
      media: lobbyMedia.value || "any",
      tag: lobbyTag.value || null,
    };
  }

  function applyLobbySettingsToForm(settings) {
    if (!settings) return;
    applyingLobbySettings = true;
    lobbyPlayMode.value = settings.playMode || "race";
    lobbyRounds.value = String(settings.rounds || 5);
    lobbyRoundSec.value = String(settings.roundSeconds || 25);
    lobbyMedia.value = settings.media || "any";
    fillTagSelect(settings.tag || "");
    syncLobbyMediaOptions();
    syncLobbySegsFromControls();
    applyingLobbySettings = false;
  }

  function syncLobbySegsFromControls() {
    document.querySelectorAll(".lobby-seg[data-seg-for]").forEach((seg) => {
      const el = document.getElementById(seg.getAttribute("data-seg-for") || "");
      if (!el) return;
      const val = String(el.value);
      let matched = false;
      seg.querySelectorAll("button[data-value]").forEach((btn) => {
        const on = btn.getAttribute("data-value") === val;
        btn.classList.toggle("is-active", on);
        if (on) matched = true;
      });
      // Кастомное число раундов вне пресетов — подсветим ближайшее / ничего.
      if (!matched && seg.getAttribute("data-seg-for") === "lobby-rounds") {
        /* leave all inactive */
      }
    });
  }

  function wireLobbySegControls() {
    document.querySelectorAll(".lobby-seg[data-seg-for]").forEach((seg) => {
      seg.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-value]");
        if (!btn || !seg.contains(btn)) return;
        const el = document.getElementById(seg.getAttribute("data-seg-for") || "");
        if (!el) return;
        el.value = btn.getAttribute("data-value");
        el.dispatchEvent(new Event("change", { bubbles: true }));
        syncLobbySegsFromControls();
      });
    });
  }

  function syncLobbyMediaOptions() {
    if (lobbySettingsHint) {
      const reveal = lobbyPlayMode.value === "reveal";
      const audioOnly = lobbyMedia.value === "audio";
      if (reveal && audioOnly) {
        lobbySettingsHint.textContent =
          "Проявление не работает с аудио — выбери фото/видео или режим «Гонка».";
      } else if (reveal) {
        lobbySettingsHint.textContent =
          "Медиа открывается слева направо — угадай раньше остальных. Аудио в этом режиме не берётся.";
      } else {
        lobbySettingsHint.textContent = "Медиа видно сразу, очки за скорость. Можно фото, видео и аудио.";
      }
    }
    if (lobbyPlayMode.value === "reveal" && Number(lobbyRoundSec.value) > 20) {
      lobbyRoundSec.value = "20";
    }
    syncLobbySegsFromControls();
  }

  function syncLobbyReadyUi(state) {
    const ready = Boolean(state && state.lobbyReady);
    if (lobbyReadyBtn) {
      lobbyReadyBtn.textContent = ready ? "Не готов" : "Я готов";
      lobbyReadyBtn.classList.toggle("is-ready", ready);
    }
    if (lobbyStart) {
      const canStart =
        Boolean(state && state.isHost) &&
        Boolean(state && state.allLobbyReady) &&
        Array.isArray(state.players) &&
        state.players.length >= 2;
      lobbyStart.classList.toggle("hidden", !(state && state.isHost));
      lobbyStart.disabled = !canStart;
    }
    const players = Array.isArray(state && state.players) ? state.players : [];
    const readyCount = players.filter((p) => p.lobbyReady).length;
    const need = Math.max(0, 2 - players.length);
    if (lobbySubline) {
      if (players.length < 2) {
        lobbySubline.textContent =
          need === 1 ? "Нужен ещё 1 игрок" : `Нужно ещё ${need} игрока`;
      } else if (state && state.allLobbyReady) {
        lobbySubline.textContent = state.isHost
          ? "Все готовы — можно стартовать"
          : "Все готовы — ждём хоста";
      } else {
        lobbySubline.textContent = `Готовность ${readyCount}/${players.length}`;
      }
    }
    if (lobbyStatus) {
      if (players.length < 2) {
        lobbyStatus.textContent = "Ждём игроков в лобби";
      } else if (!(state && state.allLobbyReady)) {
        lobbyStatus.textContent = `Готовы ${readyCount} из ${players.length}`;
      } else if (state && state.isHost) {
        lobbyStatus.textContent = "Можно жать старт";
      } else {
        lobbyStatus.textContent = "Ждём старт от хоста";
      }
    }
  }

  function formatSettingsSummary(settings) {
    if (!settings) return "";
    const modeName = settings.playMode === "reveal" ? "Проявление" : "Гонка";
    const mediaName =
      settings.media === "image"
        ? "фото"
        : settings.media === "video"
          ? "видео"
          : settings.media === "audio"
            ? "аудио"
            : "фото+видео+аудио";
    const tag = settings.tag ? `#${settings.tag}` : "любой тег";
    return `<p class="mp-panel__subtitle">Настройки</p><p>${modeName} · ${settings.rounds} раундов · ${settings.roundSeconds}с · ${mediaName} · ${tag}</p>`;
  }

  function queueSaveLobbySettings() {
    if (applyingLobbySettings || !roomCode || !me) return;
    syncLobbyMediaOptions();
    localSettingsDirtyUntil = Date.now() + 1600;
    if (settingsSaveTimer) clearTimeout(settingsSaveTimer);
    settingsSaveTimer = setTimeout(saveLobbySettings, 280);
  }

  async function saveLobbySettings() {
    if (!roomCode) return;
    try {
      const state = await api("/api/game/room/settings", {
        method: "POST",
        body: JSON.stringify({ code: roomCode, settings: readLobbySettingsFromForm() }),
      });
      renderOnlineState(state);
    } catch (err) {
      setLobbyStatus(err.message || "Не удалось сохранить настройки");
    }
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Ошибка");
    return body;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function formatHms(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function updateDailyUi() {
    if (!dailyBtn || !dailyCountdown) return;
    const loggedIn = Boolean(me);
    const available = Boolean(loggedIn && daily && daily.available);
    dailyBtn.classList.toggle("is-locked", !available);
    dailyBtn.disabled = !loggedIn || !available || busy;

    if (!loggedIn) {
      dailyCountdown.textContent = "--:--:--";
      dailyCta.textContent = "Нужен вход";
      return;
    }

    if (available) {
      dailyCountdown.textContent = "сейчас";
      dailyCta.textContent = "Играть";
      return;
    }

    const left = Math.max(0, (daily && daily.nextAt ? daily.nextAt : 0) - Date.now());
    dailyCountdown.textContent = formatHms(left);
    dailyCta.textContent =
      daily && daily.lastScore != null
        ? `Уже сыграно · ${daily.lastScore}`
        : "Уже сыграно";
  }

  function startDailyCountdown() {
    if (dailyTimer) clearInterval(dailyTimer);
    updateDailyUi();
    dailyTimer = setInterval(updateDailyUi, 1000);
  }

  function playerRolePrefix(p) {
    if (p.isAdmin) return { text: "админ", cls: "game-players__role" };
    if (p.isModerator) return { text: "модер", cls: "game-players__role" };
    if (p.isHost) return { text: "хост", cls: "game-players__role game-players__role--host" };
    return null;
  }

  function renderPlayers(list, target, { markDone = false, markRematch = false, markLobbyReady = false, allowKick = false } = {}) {
    if (!target) return;
    const asSlots = target.classList.contains("lobby-slots");
    const players = list || [];
    const maxSlots = asSlots ? 6 : players.length;
    const key = `${asSlots ? "slots" : "list"}|${players
      .map(
        (p) =>
          `${p.userId}:${p.username}:${p.avatarUrl || ""}:${p.score || 0}:${markDone && p.done ? 1 : 0}:${
            markRematch && p.rematch ? 1 : 0
          }:${markLobbyReady && p.lobbyReady ? 1 : 0}:${p.isHost ? 1 : 0}:${p.isAdmin ? 1 : 0}:${
            p.isModerator ? 1 : 0
          }:${p.isYou ? 1 : 0}:${allowKick ? 1 : 0}`
      )
      .join("|")}`;
    if (target.dataset.playersKey === key) return;
    target.dataset.playersKey = key;
    target.innerHTML = "";
    if (!asSlots && !players.length) {
      target.classList.add("hidden");
      return;
    }
    target.classList.remove("hidden");
    target.classList.toggle("game-players--kickable", Boolean(allowKick) && !asSlots);

    players.forEach((p) => {
      if (asSlots) {
        const li = document.createElement("li");
        li.className =
          "lobby-slot" +
          (p.isYou ? " is-you" : "") +
          (markLobbyReady && p.lobbyReady ? " is-ready" : "");

        const avatar = document.createElement("span");
        avatar.className = "lobby-slot__avatar";
        if (p.avatarUrl) {
          const img = document.createElement("img");
          img.src = p.avatarUrl;
          img.alt = "";
          avatar.appendChild(img);
        } else {
          avatar.textContent = String(p.username || "?").slice(0, 1).toUpperCase();
        }

        const meta = document.createElement("div");
        meta.className = "lobby-slot__meta";
        const name = document.createElement("p");
        name.className = "lobby-slot__name";
        name.textContent = p.username || "?";
        meta.appendChild(name);
        const marksEl = document.createElement("p");
        marksEl.className = "lobby-slot__marks";
        const bits = [];
        const role = playerRolePrefix(p);
        if (role) bits.push(role.text);
        if (p.isYou) bits.push("вы");
        if (markLobbyReady) bits.push(p.lobbyReady ? "готов" : "ждёт");
        marksEl.textContent = bits.join(" · ") || "игрок";
        meta.appendChild(marksEl);

        li.appendChild(avatar);
        li.appendChild(meta);

        if (allowKick && !p.isYou && !p.isHost) {
          const kick = document.createElement("button");
          kick.type = "button";
          kick.className = "lobby-slot__kick";
          kick.textContent = "Кик";
          kick.dataset.kickUserId = p.userId;
          li.appendChild(kick);
        }
        target.appendChild(li);
        return;
      }

      const li = document.createElement("li");
      li.className =
        "game-players__row" +
        (p.isYou ? " is-you" : "") +
        (markRematch && p.rematch ? " is-rematch" : "") +
        (markLobbyReady && p.lobbyReady ? " is-ready" : "");

      const avatar = document.createElement("span");
      avatar.className = "game-players__avatar";
      if (p.avatarUrl) {
        const img = document.createElement("img");
        img.src = p.avatarUrl;
        img.alt = "";
        avatar.appendChild(img);
      } else {
        avatar.textContent = String(p.username || "?").slice(0, 1).toUpperCase();
      }

      const marks = [];
      if (markDone && p.done) marks.push("✓");
      if (markRematch && p.rematch) marks.push("реванш");
      if (markLobbyReady) marks.push(p.lobbyReady ? "готов" : "ждёт");

      const meta = document.createElement("span");
      meta.className = "game-players__meta";
      const role = playerRolePrefix(p);
      const isDock = target.classList.contains("game-players--dock");
      if (isDock) {
        meta.textContent = p.username || "?";
      } else {
        if (role) {
          const badge = document.createElement("span");
          badge.className = role.cls;
          badge.textContent = role.text;
          meta.appendChild(badge);
        }
        meta.appendChild(
          document.createTextNode(
            `${p.username || "?"}${marks.length ? ` · ${marks.join(" · ")}` : ""}`
          )
        );
      }

      const score = document.createElement("strong");
      score.textContent = markLobbyReady
        ? p.lobbyReady
          ? "✓"
          : "…"
        : String(p.score || 0);

      li.appendChild(avatar);
      li.appendChild(meta);
      if (isDock && role) {
        const badge = document.createElement("span");
        badge.className = role.cls;
        badge.textContent = role.text;
        li.appendChild(badge);
      }
      li.appendChild(score);

      if (allowKick && !p.isYou && !p.isHost) {
        const kick = document.createElement("button");
        kick.type = "button";
        kick.className = "game-players__kick";
        kick.textContent = "Кик";
        kick.dataset.kickUserId = p.userId;
        li.appendChild(kick);
      }
      target.appendChild(li);
    });

    if (asSlots) {
      for (let i = players.length; i < maxSlots; i += 1) {
        const empty = document.createElement("li");
        empty.className = "lobby-slot is-empty";
        empty.textContent = "Ожидание игрока…";
        target.appendChild(empty);
      }
    }
  }

  function fitMediaFrame() {
    if (!imageWrap) return;
    const playing = document.body.classList.contains("game-playing");
    const frame = imageWrap.parentElement;

    if (playing) {
      // Рамка на всю зону; медиа — absolute + object-fit:contain (без обрезки).
      imageWrap.style.width = "100%";
      imageWrap.style.height = "100%";
      imageWrap.style.maxWidth = "none";
      imageWrap.style.maxHeight = "none";
      imageWrap.style.margin = "0";

      if (audioWrap && !audioWrap.classList.contains("hidden")) {
        audioWrap.style.width = "100%";
        audioWrap.style.height = "100%";
        audioWrap.style.minHeight = "0";
        return;
      }

      const el = imageEl && !imageEl.hidden ? imageEl : videoEl && !videoEl.hidden ? videoEl : null;
      if (!el) return;
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.maxWidth = "none";
      el.style.maxHeight = "none";
      el.style.objectFit = "contain";
      el.style.objectPosition = "center center";
      return;
    }

    if (audioWrap && !audioWrap.classList.contains("hidden")) {
      imageWrap.style.width = "min(100%, 420px)";
      imageWrap.style.height = "auto";
      audioWrap.style.removeProperty("width");
      audioWrap.style.removeProperty("height");
      audioWrap.style.removeProperty("min-height");
      return;
    }

    const el = imageEl && !imageEl.hidden ? imageEl : videoEl && !videoEl.hidden ? videoEl : null;
    if (!el) return;

    const nw = el.naturalWidth || el.videoWidth || 0;
    const nh = el.naturalHeight || el.videoHeight || 0;
    const maxW = Math.min(frame ? frame.clientWidth : 720, 720);
    const maxH = Math.min(window.innerHeight * 0.55, 420);

    if (!nw || !nh || !maxW || !maxH) {
      imageWrap.style.removeProperty("width");
      imageWrap.style.removeProperty("height");
      el.style.removeProperty("width");
      el.style.removeProperty("height");
      return;
    }

    const scale = Math.min(maxW / nw, maxH / nh);
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    imageWrap.style.width = `${w}px`;
    imageWrap.style.height = `${h}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.maxWidth = "none";
    el.style.maxHeight = "none";
  }

  function scheduleFitMediaFrame() {
    requestAnimationFrame(() => {
      fitMediaFrame();
      requestAnimationFrame(fitMediaFrame);
    });
  }

  function clearMediaFrame() {
    if (!imageWrap) return;
    imageWrap.style.removeProperty("width");
    imageWrap.style.removeProperty("height");
    if (imageEl) {
      imageEl.style.removeProperty("width");
      imageEl.style.removeProperty("height");
    }
    if (videoEl) {
      videoEl.style.removeProperty("width");
      videoEl.style.removeProperty("height");
    }
  }

  function stopAudioMedia() {
    if (!audioEl) return;
    audioEl.pause();
    audioEl.removeAttribute("src");
    audioEl.load();
    if (audioWrap) {
      audioWrap.classList.add("hidden");
      audioWrap.classList.add("is-paused");
    }
  }

  function setMedia(round, { silent = false } = {}) {
    const url = round.mediaUrl || round.imageUrl || "";
    const isVideo =
      round.mediaType === "video" || /\.(mp4|webm|mov|m4v|mkv|ogv)(\?|$)/i.test(url);
    const isAudio =
      round.mediaType === "audio" ||
      /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)(\?|$)/i.test(url);
    const hold = Boolean(silent || (play && play.classList.contains("is-prep")));

    clearMediaFrame();

    if (isAudio) {
      imageEl.hidden = true;
      imageEl.removeAttribute("src");
      imageEl.style.display = "none";
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
      videoEl.hidden = true;
      videoEl.style.display = "none";
      if (audioWrap) {
        audioWrap.classList.remove("hidden");
        audioWrap.classList.add("is-paused");
      }
      const abs = new URL(url, window.location.origin).href;
      if (audioEl) {
        if (audioEl.currentSrc !== abs && audioEl.src !== abs) {
          audioEl.src = url;
          audioEl.load();
        }
        audioEl.loop = true;
        audioEl.muted = true;
        try {
          audioEl.pause();
        } catch {
          /* ignore */
        }
        if (!hold) applyMediaVolume();
      }
      scheduleFitMediaFrame();
      return;
    }

    stopAudioMedia();

    if (isVideo) {
      imageEl.hidden = true;
      imageEl.removeAttribute("src");
      imageEl.alt = "";
      imageEl.style.display = "none";
      videoEl.hidden = false;
      videoEl.style.display = "";
      videoEl.controls = false;
      videoEl.removeAttribute("controls");
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.setAttribute("playsinline", "");
      videoEl.setAttribute("webkit-playsinline", "");
      videoEl.loop = true;
      videoEl.preload = "auto";
      videoEl.disablePictureInPicture = true;
      const abs = new URL(url, window.location.origin).href;
      const onMeta = () => {
        videoEl.removeEventListener("loadedmetadata", onMeta);
        scheduleFitMediaFrame();
      };
      videoEl.addEventListener("loadedmetadata", onMeta);
      if (videoEl.currentSrc !== abs && videoEl.src !== abs) {
        videoEl.src = url;
        videoEl.load();
      } else if (videoEl.videoWidth) {
        scheduleFitMediaFrame();
      }
      if (hold) {
        try {
          videoEl.pause();
        } catch {
          /* ignore */
        }
        videoEl.muted = true;
      } else {
        videoEl.play().catch(() => {}).finally(() => applyVideoSound());
      }
    } else {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
      videoEl.hidden = true;
      videoEl.style.display = "none";
      imageEl.hidden = false;
      imageEl.style.display = "";
      imageEl.alt = "Картинка раунда";
      const abs = new URL(url, window.location.origin).href;
      const onLoad = () => {
        imageEl.removeEventListener("load", onLoad);
        scheduleFitMediaFrame();
      };
      if (imageEl.src !== abs) {
        imageEl.addEventListener("load", onLoad);
        imageEl.src = url;
      } else if (imageEl.complete && imageEl.naturalWidth) {
        scheduleFitMediaFrame();
      } else {
        imageEl.addEventListener("load", onLoad);
      }
    }
  }

  function renderOptions(round, onPick) {
    optionsEl.innerHTML = "";
    round.options.forEach((title) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "game-option";
      btn.dataset.title = title;
      btn.textContent = title;
      if ((round.wrongPicked || []).includes(title)) {
        btn.classList.add("is-wrong");
        btn.disabled = true;
      }
      if (round.done && round.revealed === title) {
        btn.classList.add("is-correct");
        btn.disabled = true;
      }
      if (round.done) btn.disabled = true;
      btn.addEventListener("click", () => onPick(title, btn));
      optionsEl.appendChild(btn);
    });
  }

  function syncOptions(round, onPick) {
    const buttons = [...optionsEl.querySelectorAll(".game-option")];
    const titles = round.options || [];
    const same =
      buttons.length === titles.length &&
      buttons.every((btn, i) => btn.dataset.title === titles[i]);
    if (!same) {
      renderOptions(round, onPick);
      return;
    }
    buttons.forEach((btn) => {
      const title = btn.dataset.title;
      const wrong = (round.wrongPicked || []).includes(title);
      const correct = Boolean(round.done && round.revealed === title);
      if (wrong && !btn.classList.contains("is-wrong")) btn.classList.add("is-wrong");
      if (correct && !btn.classList.contains("is-correct")) btn.classList.add("is-correct");
      btn.disabled = wrong || round.done;
    });
  }

  async function tickDailyTimeout() {
    if (!gameId || busy || (mode !== "daily" && mode !== "reveal")) return;
    busy = true;
    try {
      const data = await api(`/api/game/${encodeURIComponent(gameId)}`);
      if (data.daily) daily = data.daily;
      if (data.finished) {
        showSoloResult(data);
        return;
      }
      if (data.round) {
        renderSoloRound(data, { forceMedia: true });
        feedbackEl.classList.add("is-bad");
        feedbackEl.textContent = "Время вышло — следующий раунд.";
      }
    } catch {
      /* ignore transient */
    } finally {
      busy = false;
    }
  }

  function renderSoloRound(state, { forceMedia = true } = {}) {
    const round = state.round;
    if (!round) return;
    mode = state.mode === "daily" ? "daily" : state.mode === "reveal" ? "reveal" : "fun";
    playMode = state.playMode || (mode === "reveal" ? "reveal" : "race");
    gameId = state.gameId;
    roomCode = null;
    if (play) play.classList.remove("game-play--online");
    document.body.classList.remove("game-online-play");
    onlineBoard.classList.add("hidden");
    setPrepUiHidden(false);
    if (play) play.classList.remove("is-prep");

    const timed = mode === "daily" || mode === "reveal";
    timerChip.classList.toggle("hidden", !timed);
    modeChip.classList.remove("hidden");
    modeLabel.textContent =
      mode === "daily" ? "Ежедневка" : mode === "reveal" ? "Проявление" : "Тренировка";

    roundMs =
      playMode === "reveal"
        ? REVEAL_ROUND_MS
        : Number(state.roundMs) || roundMs || DEFAULT_ROUND_MS;
    const key = `${state.roundIndex ?? round.index}:${round.mediaUrl}`;
    const isNewRound = forceMedia || key !== lastRoundKey;
    const revealPending =
      playMode === "reveal" && !round.done && (isNewRound || revealArmedKey !== key);

    if (revealPending) {
      endsAt = null;
      roundStartedAt = null;
      mediaReady = false;
      hideTimebar();
    } else {
      endsAt = timed ? state.endsAt || null : null;
      roundStartedAt = timed ? state.roundStartedAt || null : null;
    }
    updateClock();
    if (timed && !clockTimer) {
      clockTimer = setInterval(updateClock, 250);
    }
    if (!timed && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }

    roundNum.textContent = String((round.index != null ? round.index : state.roundIndex) + 1);
    if (roundTotalEl) roundTotalEl.textContent = String(state.totalRounds || 5);
    scoreEl.textContent = String(state.totalScore || 0);
    attemptsEl.textContent = String(round.attemptsLeft);
    tagEl.textContent = round.tag ? `#${round.tag}` : "—";
    progressBar.style.width = `${(((round.index != null ? round.index : state.roundIndex) + 1) / (state.totalRounds || 5)) * 100}%`;

    if (isNewRound) {
      lastRoundKey = key;
      fanfareKey = "";
      hideAnswerFanfare();
      imageWrap.classList.remove("is-enter", "is-shake", "is-win");
      void imageWrap.offsetWidth;
      imageWrap.classList.add("is-enter");
      setMedia(round);
      burstEl.hidden = true;
      feedbackEl.textContent = "";
      feedbackEl.classList.remove("is-bad");
      lockOptions = playMode === "reveal" && !round.done;
      renderOptions(round, guessSolo);
      if (playMode === "reveal" && !round.done) prepareRevealMedia();
      else stopReveal();
    } else {
      syncOptions(round, guessSolo);
      lockOptions = Boolean(round.done) || (playMode === "reveal" && !mediaReady);
      if (playMode === "reveal" && !round.done) {
        if (revealArmedKey === key && roundStartedAt && mediaReady) ensureRevealRunning();
        else prepareRevealMedia();
      }
      if (round.done) stopReveal();
    }
  }

  function renderOnlineState(state, { forceMedia = false } = {}) {
    mode = "online";
    roomCode = state.code;
    gameId = null;
    playMode = state.playMode || (state.settings && state.settings.playMode) || "race";
    roundMs = state.roundMs || ((state.settings && state.settings.roundSeconds) || 25) * 1000;

    if (state.status === "lobby") {
      showView("lobby");
      isHostViewer = Boolean(state.isHost);
      lobbyCode.textContent = state.code;
      renderPlayers(state.players, lobbyPlayers, {
        markLobbyReady: true,
        allowKick: Boolean(state.isHost),
      });
      syncLobbyReadyUi(state);
      if (state.isHost) {
        lobbySettings.classList.remove("hidden");
        lobbySettingsReadonly.classList.add("hidden");
        const settingsKey = JSON.stringify(state.settings || {});
        if (Date.now() > localSettingsDirtyUntil && settingsKey !== lastLobbySettingsKey) {
          applyLobbySettingsToForm(state.settings);
          lastLobbySettingsKey = settingsKey;
        }
      } else {
        lobbySettings.classList.add("hidden");
        lobbySettingsReadonly.classList.remove("hidden");
        lobbySettingsReadonly.innerHTML = formatSettingsSummary(state.settings);
      }
      return;
    }

    if (state.finished || state.status === "finished") {
      showOnlineResult(state);
      return;
    }

    showView("play");
    if (play) play.classList.add("game-play--online");
    document.body.classList.add("game-online-play");
    timerChip.classList.remove("hidden");
    modeChip.classList.remove("hidden");
    modeLabel.textContent = playMode === "reveal" ? "Проявление" : "Битва";
    roundMs = Number(state.roundMs) || ((state.settings && state.settings.roundSeconds) || 20) * 1000;

    scoreEl.textContent = String(state.myScore || 0);
    roundNum.textContent = String((state.roundIndex || 0) + 1);
    if (roundTotalEl) roundTotalEl.textContent = String(state.totalRounds || 5);
    progressBar.style.width = `${(((state.roundIndex || 0) + 1) / (state.totalRounds || 5)) * 100}%`;
    renderPlayers(state.players, onlineBoard, { markDone: true });

    const phase = state.roundPhase || "playing";
    if (phase === "prep" && state.phaseEndsAt) {
      lockOptions = true;
      hideAnswerFanfare();
      if (play) play.classList.add("is-prep");
      setPrepUiHidden(true);
      pauseRoundMedia();
      ensureOnlinePrepCountdown(state.phaseEndsAt, state.prepMs);
    } else {
      if (onlinePrepEndsAt && phase !== "prep") {
        onlinePrepEndsAt = 0;
        onlinePrepToken += 1;
      }
      if (play) play.classList.remove("is-prep");
      setPrepUiHidden(false);
      if (phase === "reveal" || phase === "playing") {
        if (!countdownActive || phase === "reveal") hideCountdown();
        if (phase === "playing") hideCountdown();
      }
    }

    if (phase === "reveal" && state.revealTitle) {
      showAnswerFanfare(state.revealTitle, {
        key: `sync-reveal:${state.roundIndex}:${state.revealTitle}`,
        correct: true,
      });
      lockOptions = true;
    } else if (phase !== "reveal") {
      if (fanfareKey.startsWith("sync-reveal:")) hideAnswerFanfare();
    }

    const round = state.round;
    if (!round) return;
    attemptsEl.textContent = String(round.attemptsLeft);
    tagEl.textContent = round.tag ? `#${round.tag}` : "—";

    const key = `${state.roundIndex}:${round.mediaUrl}`;
    const isNewRound = forceMedia || key !== lastRoundKey;
    const phaseBlocksPlay = phase === "prep" || phase === "reveal";
    const revealPending =
      playMode === "reveal" &&
      !phaseBlocksPlay &&
      !round.done &&
      (isNewRound || revealArmedKey !== key);

    if (revealPending || phase === "prep") {
      endsAt = null;
      roundStartedAt = null;
      if (phase === "prep") mediaReady = false;
      hideTimebar();
    } else if (state.roundStartedAt && state.clockArmed) {
      endsAt = state.endsAt || null;
      roundStartedAt = state.roundStartedAt || null;
      mediaReady = true;
    } else {
      endsAt = state.endsAt || null;
      roundStartedAt = state.roundStartedAt || null;
    }
    updateClock();
    if (!clockTimer) {
      clockTimer = setInterval(updateClock, 250);
    }

    if (isNewRound) {
      lastRoundKey = key;
      if (phase !== "reveal") {
        fanfareKey = "";
        hideAnswerFanfare();
      }
      imageWrap.classList.remove("is-enter", "is-shake", "is-win");
      void imageWrap.offsetWidth;
      imageWrap.classList.add("is-enter");
      setMedia(round, { silent: phase === "prep" });
      burstEl.hidden = true;
      if (phase === "prep") {
        // Текст только на оверлее отсчёта — не дублируем под вариантами.
        if (feedbackEl) {
          feedbackEl.textContent = "";
          feedbackEl.classList.remove("is-bad");
        }
        pauseRoundMedia();
      } else if (phase !== "reveal") {
        feedbackEl.textContent = "";
        feedbackEl.classList.remove("is-bad");
      }
      lockOptions = true;
      renderOptions(round, guessOnline);
      if (phase === "playing" && playMode === "reveal" && !round.done) prepareRevealMedia();
      else if (phase === "playing" && playMode !== "reveal" && !round.done) {
        stopReveal();
        syncOnlineRaceClock(state);
        applyMediaVolume();
      } else {
        stopReveal();
      }
    } else {
      syncOptions(round, guessOnline);
      if (phase === "playing" && playMode === "reveal" && !round.done) {
        if (revealArmedKey === key && roundStartedAt && mediaReady) ensureRevealRunning();
        else prepareRevealMedia();
      } else if (phase === "playing" && playMode !== "reveal" && !round.done) {
        syncOnlineRaceClock(state);
        applyMediaVolume();
      }
      if (round.done || phaseBlocksPlay) stopReveal();
      if (phase === "prep") pauseRoundMedia();
    }

    lockOptions =
      phaseBlocksPlay ||
      Boolean(round.done) ||
      (playMode === "reveal" && !mediaReady && !round.done);

    if (phase === "reveal") {
      stopReveal();
      feedbackEl.classList.remove("is-bad");
      feedbackEl.textContent = state.revealTitle
        ? `Ответ: «${state.revealTitle}»`
        : "Раунд завершён";
    } else if (phase === "prep") {
      lockOptions = true;
    } else if (round.done) {
      stopReveal();
      if (round.score) {
        feedbackEl.classList.remove("is-bad");
        feedbackEl.textContent = `Готово: +${round.score}. Ждём остальных…`;
      } else if (round.revealed) {
        feedbackEl.classList.add("is-bad");
        feedbackEl.textContent = `Раунд закрыт. Это было: «${round.revealed}»`;
      }
    } else if (playMode === "reveal") {
      ensureRevealRunning();
    }
  }

  function floatScore(points) {
    const el = document.createElement("div");
    el.className = "game-score-float";
    el.textContent = `+${points}`;
    imageWrap.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  async function guessSolo(option, btn) {
    if (!gameId || busy || lockOptions || btn.classList.contains("is-wrong")) return;
    busy = true;
    lockOptions = true;
    try {
      const data = await api("/api/game/guess", {
        method: "POST",
        body: JSON.stringify({ gameId, option }),
      });
      if (data.daily) daily = data.daily;
      if (data.timedOut) {
        if (data.finished) {
          showSoloResult(data);
          return;
        }
        if (data.round) {
          renderSoloRound(data, { forceMedia: true });
          feedbackEl.classList.add("is-bad");
          feedbackEl.textContent = "Время вышло — следующий раунд.";
        }
        return;
      }

      attemptsEl.textContent = String(data.attemptsLeft);
      scoreEl.textContent = String(data.totalScore);
      if (data.endsAt) endsAt = data.endsAt;

      if (data.correct) {
        btn.classList.add("is-correct");
        imageWrap.classList.add("is-win");
        burstEl.hidden = false;
        playCorrectSound();
        feedbackEl.classList.remove("is-bad");
        feedbackEl.textContent = data.roundScore ? `Верно! +${data.roundScore}` : "Верно!";
        if (data.roundScore) floatScore(data.roundScore);
        if (data.revealed || option) {
          showAnswerFanfare(data.revealed || option, {
            key: `${data.roundIndex ?? ""}:${option}`,
            correct: true,
          });
        }
        await wait(1500);
      } else {
        btn.classList.add("is-wrong");
        btn.disabled = true;
        playWrongSound();
        imageWrap.classList.remove("is-shake");
        void imageWrap.offsetWidth;
        imageWrap.classList.add("is-shake");
        feedbackEl.classList.add("is-bad");
        if (data.roundDone) {
          feedbackEl.textContent = `Не угадал. Это было: «${data.revealed}»`;
          if (data.revealed) {
            showAnswerFanfare(data.revealed, {
              key: `${data.roundIndex ?? ""}:miss:${data.revealed}`,
              correct: false,
            });
          }
          [...optionsEl.querySelectorAll(".game-option")].forEach((el) => {
            if (el.dataset.title === data.revealed || el.textContent === data.revealed) {
              el.classList.add("is-correct");
            }
            el.disabled = true;
          });
          await wait(1500);
        } else {
          feedbackEl.textContent = `Мимо. Осталось попыток: ${data.attemptsLeft}`;
          lockOptions = false;
          busy = false;
          ensureRevealRunning();
          return;
        }
      }

      if (data.finished) {
        showSoloResult(data);
        return;
      }
      if (data.round) {
        renderSoloRound(
          {
            gameId,
            mode: data.mode || mode,
            playMode: data.playMode || playMode,
            totalScore: data.totalScore,
            totalRounds: data.totalRounds,
            roundIndex: data.roundIndex,
            endsAt: data.endsAt,
            roundStartedAt: data.roundStartedAt,
            roundMs: data.roundMs || roundMs,
            round: data.round,
          },
          { forceMedia: true }
        );
      }
    } catch (err) {
      feedbackEl.classList.add("is-bad");
      feedbackEl.textContent = err.message || "Ошибка";
      lockOptions = false;
      if (mediaReady && roundStartedAt) ensureRevealRunning();
    } finally {
      busy = false;
    }
  }

  async function guessOnline(option, btn) {
    if (!roomCode || busy || lockOptions || btn.classList.contains("is-wrong")) return;
    busy = true;
    lockOptions = true;
    try {
      const data = await api("/api/game/room/guess", {
        method: "POST",
        body: JSON.stringify({ code: roomCode, option }),
      });
      if (data.correct) {
        btn.classList.add("is-correct");
        imageWrap.classList.add("is-win");
        burstEl.hidden = false;
        playCorrectSound();
        if (data.roundScore) floatScore(data.roundScore);
      } else {
        btn.classList.add("is-wrong");
        playWrongSound();
        imageWrap.classList.remove("is-shake");
        void imageWrap.offsetWidth;
        imageWrap.classList.add("is-shake");
        if (!data.roundDone && !(data.round && data.round.done)) {
          lockOptions = false;
        }
      }
      renderOnlineState(data, { forceMedia: false });
      ensureRevealRunning();
    } catch (err) {
      feedbackEl.classList.add("is-bad");
      feedbackEl.textContent = err.message || "Ошибка";
      lockOptions = false;
      ensureRevealRunning();
    } finally {
      busy = false;
    }
  }

  function showSoloResult(data) {
    stopPolling();
    if (rematchBtn) rematchBtn.classList.add("hidden");
    if (rematchStatus) {
      rematchStatus.classList.add("hidden");
      rematchStatus.textContent = "";
    }
    showView("result");
    resultPlayers.classList.add("hidden");
    finalPoints.textContent = String(data.totalScore || 0);
    const isDaily = (data.mode || mode) === "daily";
    const isReveal = (data.mode || mode) === "reveal";
    resultTitle.textContent = isDaily
      ? "Ежедневка закрыта"
      : isReveal
        ? "Проявление окончено"
        : "Тренировка окончена";
    finalCaption.textContent = isDaily ? "очков в профиль" : "очков за эту игру";
    if (isDaily) {
      profileScoreEl.textContent =
        data.profileGameScore != null
          ? `Общий счёт ежедневки в профиле: ${data.profileGameScore}`
          : "Очки ежедневки добавлены в профиль.";
    } else {
      profileScoreEl.textContent = "Этот режим не влияет на счёт в профиле.";
    }
    profileLink.href = me ? `/u/${encodeURIComponent(me.username)}` : "/";
    updateDailyUi();
  }

  function showOnlineResult(state) {
    showView("result");
    resultTitle.textContent = "Битва окончена";
    finalPoints.textContent = String(state.myScore || 0);
    finalCaption.textContent = "очков матча";
    renderPlayers(state.players, resultPlayers);
    profileScoreEl.textContent = "Очки битвы только в этом матче — в профиль не пишутся.";
    profileLink.href = me ? `/u/${encodeURIComponent(me.username)}` : "/";

    if (rematchBtn) {
      rematchBtn.classList.remove("hidden");
      rematchBtn.disabled = false;
      rematchBtn.textContent = "Реванш";
    }
    if (rematchStatus) {
      rematchStatus.classList.remove("hidden");
      rematchStatus.textContent =
        "Реванш вернёт эту же комнату в лобби с тем же составом.";
    }
  }

  async function requestRematch() {
    if (!roomCode || !me || busy) return;
    busy = true;
    if (rematchBtn) rematchBtn.disabled = true;
    try {
      const state = await api("/api/game/room/rematch", {
        method: "POST",
        body: JSON.stringify({ code: roomCode }),
      });
      lastRoundKey = "";
      renderOnlineState(state);
      startRoomPolling();
      setLobbyStatus("Комната снова в лобби — все жмут «Готов», хост стартует.");
    } catch (err) {
      if (rematchBtn) rematchBtn.disabled = false;
      if (rematchStatus) {
        rematchStatus.classList.remove("hidden");
        rematchStatus.textContent = err.message || "Не удалось собрать реванш";
      }
    } finally {
      busy = false;
    }
  }

  function startRoomPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      if (!roomCode) return;
      try {
        const state = await api(`/api/game/room/${encodeURIComponent(roomCode)}`);
        renderOnlineState(state);
      } catch (err) {
        const msg = err.message || "Связь с комнатой потеряна";
        if (/не в этой комнате|не найдена/i.test(msg)) {
          stopPolling();
          roomCode = null;
          busy = false;
          setMpHubStatus(msg.includes("не найдена") ? "Комната закрыта." : "Тебя кикнули из лобби.");
          showView("mp");
          refreshOpenLobbies();
          return;
        }
        setLobbyStatus(msg);
      }
    }, 700);
  }

  async function leaveRoom() {
    const code = roomCode;
    stopPolling();
    busy = false;
    roomCode = null;
    lastLobbySettingsKey = "";
    if (code) {
      try {
        await api("/api/game/room/leave", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
      } catch {
        /* already left / gone */
      }
    }
    await openMultiplayerHub();
  }

  async function kickPlayer(userId) {
    if (!roomCode || !userId || busy) return;
    busy = true;
    try {
      const state = await api("/api/game/room/kick", {
        method: "POST",
        body: JSON.stringify({ code: roomCode, userId }),
      });
      renderOnlineState(state);
      setLobbyStatus("Игрок кикнут");
      setTimeout(() => setLobbyStatus(""), 1400);
    } catch (err) {
      setLobbyStatus(err.message || "Не удалось кикнуть");
    } finally {
      busy = false;
    }
  }

  async function startSolo(playKind) {
    if (busy) return;
    if (!me) {
      setStatus("Нужен вход — зайди на главной и вернись в игру.");
      return;
    }
    if (playKind === "daily" && daily && !daily.available) {
      setStatus("Ежедневка уже сыграна. Новая — после полуночи по Москве.");
      return;
    }
    ensureAudio();
    busy = true;
    stopPolling();
    const label =
      playKind === "daily" ? "ежедневку" : playKind === "reveal" ? "проявление" : "тренировку";
    setStatus(`Собираем ${label}…`);
    try {
      const state = await api("/api/game/start", {
        method: "POST",
        body: JSON.stringify({
          mode: playKind === "daily" ? "daily" : playKind === "reveal" ? "reveal" : "fun",
        }),
      });
      setStatus("");
      lastRoundKey = "";
      showView("play");
      renderSoloRound(state, { forceMedia: true });
    } catch (err) {
      setStatus(err.message || "Не удалось начать игру");
      if (playKind === "daily") {
        try {
          const st = await api("/api/game/status");
          daily = st.daily || daily;
          if (st.user) me = st.user;
          updateDailyUi();
        } catch {
          /* ignore */
        }
      }
    } finally {
      busy = false;
      updateDailyUi();
    }
  }

  async function createRoom() {
    if (!me) {
      setMpHubStatus("Нужен вход.");
      return;
    }
    setMpHubStatus("Создаём комнату…");
    try {
      const state = await api("/api/game/room/create", { method: "POST", body: "{}" });
      setMpHubStatus("");
      lastRoundKey = "";
      renderOnlineState(state);
      startRoomPolling();
    } catch (err) {
      setMpHubStatus(err.message || "Не удалось создать комнату");
    }
  }

  async function joinRoom(code) {
    if (!me) {
      setMpHubStatus("Нужен вход.");
      return;
    }
    setMpHubStatus("Входим…");
    try {
      const state = await api("/api/game/room/join", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setMpHubStatus("");
      lastRoundKey = "";
      renderOnlineState(state);
      startRoomPolling();
    } catch (err) {
      setMpHubStatus(err.message || "Не удалось войти");
    }
  }

  function formatLobbyMode(playMode) {
    return playMode === "reveal" ? "Проявление" : "Гонка";
  }

  function renderOpenLobbies(rooms) {
    if (!mpLobbyList) return;
    mpLobbyList.innerHTML = "";
    const list = Array.isArray(rooms) ? rooms : [];
    if (mpLobbiesEmpty) mpLobbiesEmpty.classList.toggle("hidden", list.length > 0);
    list.forEach((room) => {
      const li = document.createElement("li");
      li.className = "mp-lobby-list__row";

      const meta = document.createElement("div");
      meta.className = "mp-lobby-list__meta";

      const code = document.createElement("div");
      code.className = "mp-lobby-list__code";
      code.textContent = room.code;

      const info = document.createElement("p");
      info.className = "mp-lobby-list__info";
      const host = document.createElement("span");
      host.textContent = room.hostName || "?";
      info.appendChild(host);
      info.appendChild(document.createElement("br"));
      const bits = [
        `${room.players || 0}/${room.maxPlayers || 6}`,
        formatLobbyMode(room.playMode),
        `${room.rounds || 5} раундов`,
      ];
      if (room.tag) bits.push(`#${room.tag}`);
      info.appendChild(document.createTextNode(bits.join(" · ")));

      meta.appendChild(code);
      meta.appendChild(info);

      const joinBtn = document.createElement("button");
      joinBtn.type = "button";
      joinBtn.className = "mp-cta mp-cta--ghost";
      joinBtn.textContent = "Войти";
      joinBtn.addEventListener("click", () => joinRoom(room.code));

      li.appendChild(meta);
      li.appendChild(joinBtn);
      mpLobbyList.appendChild(li);
    });
  }

  async function refreshOpenLobbies() {
    if (!me) {
      renderOpenLobbies([]);
      setMpHubStatus("Нужен вход, чтобы видеть лобби.");
      return;
    }
    try {
      const data = await api("/api/game/rooms");
      renderOpenLobbies(data.rooms || []);
      setMpHubStatus("");
    } catch (err) {
      renderOpenLobbies([]);
      setMpHubStatus(err.message || "Не удалось загрузить лобби");
    }
  }

  async function openMultiplayerHub() {
    if (!me) {
      setStatus("Нужен вход.");
      return;
    }
    showView("mp");
    setMpHubStatus("");
    await refreshOpenLobbies();
  }

  function setAuthControls(loggedIn) {
    startBtn.disabled = !loggedIn;
    if (revealBtn) revealBtn.disabled = !loggedIn;
    if (multiplayerBtn) multiplayerBtn.disabled = !loggedIn;
    if (createRoomBtn) createRoomBtn.disabled = !loggedIn;
    if (gameAuthActions) gameAuthActions.classList.toggle("hidden", Boolean(loggedIn));
  }

  let gameAuthMode = "login";

  function setGameAuthError(text) {
    if (!gameAuthError) return;
    gameAuthError.textContent = text || "";
    gameAuthError.classList.toggle("hidden", !text);
  }

  function setGameAuthMode(mode) {
    gameAuthMode = mode === "register" ? "register" : "login";
    if (gameAuthTitle) gameAuthTitle.textContent = gameAuthMode === "register" ? "Регистрация" : "Вход";
    if (gameAuthSubmit) gameAuthSubmit.textContent = gameAuthMode === "register" ? "Создать" : "Войти";
    if (gameAuthSwitch) {
      gameAuthSwitch.textContent =
        gameAuthMode === "register" ? "Уже есть аккаунт" : "Создать аккаунт";
    }
    if (gameAuthPassword2Field) {
      gameAuthPassword2Field.classList.toggle("hidden", gameAuthMode !== "register");
    }
    if (gameAuthPassword2) {
      gameAuthPassword2.required = gameAuthMode === "register";
      if (gameAuthMode !== "register") gameAuthPassword2.value = "";
    }
    setGameAuthError("");
  }

  function openGameAuth(mode) {
    if (!gameAuthDialog || !gameAuthForm) return;
    gameAuthForm.reset();
    setGameAuthMode(mode || "login");
    if (typeof gameAuthDialog.showModal === "function") gameAuthDialog.showModal();
    if (gameAuthUsername) gameAuthUsername.focus();
  }

  async function refreshAuthAfterLogin() {
    try {
      const st = await api("/api/game/status");
      me = st.user || null;
      daily = st.daily || null;
      gameTags = Array.isArray(st.tags) ? st.tags : [];
      fillTagSelect("");
      if (me && me.theme && window.RvTheme) window.RvTheme.applyTheme(me.theme);
      if (me) {
        authHint.textContent = `Играешь как @${me.username}. Счёт ежедневки: ${Number(me.gameScore) || 0}`;
        setAuthControls(true);
      } else {
        authHint.textContent = "Чтобы играть, войди в аккаунт.";
        setAuthControls(false);
      }
      startDailyCountdown();
    } catch (err) {
      authHint.textContent = err.message || "Не удалось обновить сессию";
      setAuthControls(false);
    }
  }

  async function boot() {
    try {
      const st = await api("/api/game/status");
      me = st.user || null;
      daily = st.daily || null;
      gameTags = Array.isArray(st.tags) ? st.tags : [];
      fillTagSelect("");
      if (me && me.theme && window.RvTheme) window.RvTheme.applyTheme(me.theme);
      if (me) {
        authHint.textContent = `Играешь как @${me.username}. Счёт ежедневки: ${Number(me.gameScore) || 0}`;
        setAuthControls(true);
      } else {
        authHint.textContent = "Чтобы играть, войди в аккаунт.";
        setAuthControls(false);
      }
      startDailyCountdown();
    } catch (err) {
      console.error(err);
      try {
        const data = await api("/api/auth/me");
        me = data.user || null;
        if (me && me.theme && window.RvTheme) window.RvTheme.applyTheme(me.theme);
        if (me) {
          authHint.textContent = `Играешь как @${me.username}. Счёт ежедневки: ${Number(me.gameScore) || 0}`;
          setAuthControls(true);
          dailyBtn.disabled = false;
        } else {
          authHint.textContent = "Чтобы играть, войди в аккаунт.";
          setAuthControls(false);
        }
      } catch {
        authHint.textContent = "Не удалось проверить вход.";
        setAuthControls(false);
        dailyBtn.disabled = true;
      }
    }
  }

  [lobbyPlayMode, lobbyRounds, lobbyRoundSec, lobbyMedia, lobbyTag].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", queueSaveLobbySettings);
    if (el === lobbyRounds) el.addEventListener("input", queueSaveLobbySettings);
  });
  wireLobbySegControls();
  syncLobbySegsFromControls();

  if (volumeInput) {
    const volumePct = document.getElementById("game-volume-pct");
    const syncVolUi = () => {
      volumeInput.value = String(Math.round(mediaVolume * 100));
      if (volumePct) volumePct.textContent = `${Math.round(mediaVolume * 100)}%`;
    };
    syncVolUi();
    volumeInput.addEventListener("input", () => {
      mediaVolume = Math.max(0, Math.min(1, Number(volumeInput.value) / 100));
      try {
        localStorage.setItem("rv_game_volume", String(mediaVolume));
      } catch {
        /* ignore */
      }
      if (volumePct) volumePct.textContent = `${Math.round(mediaVolume * 100)}%`;
      applyMediaVolume();
    });
  }

  dailyBtn.addEventListener("click", () => startSolo("daily"));
  startBtn.addEventListener("click", () => startSolo("fun"));
  if (revealBtn) revealBtn.addEventListener("click", () => startSolo("reveal"));
  if (multiplayerBtn) multiplayerBtn.addEventListener("click", () => openMultiplayerHub());
  if (mpHubBack) {
    mpHubBack.addEventListener("click", () => {
      showView("intro");
      setMpHubStatus("");
    });
  }
  if (mpLobbiesRefresh) mpLobbiesRefresh.addEventListener("click", () => refreshOpenLobbies());
  if (createRoomBtn) createRoomBtn.addEventListener("click", createRoom);
  joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = String(joinCodeInput.value || "").trim();
    if (!code) return;
    joinRoom(code);
  });
  if (lobbyReadyBtn) {
    lobbyReadyBtn.addEventListener("click", async () => {
      if (!roomCode || busy) return;
      busy = true;
      lobbyReadyBtn.disabled = true;
      try {
        const wantReady = !lobbyReadyBtn.classList.contains("is-ready");
        const state = await api("/api/game/room/lobby-ready", {
          method: "POST",
          body: JSON.stringify({ code: roomCode, ready: wantReady }),
        });
        renderOnlineState(state);
      } catch (err) {
        setLobbyStatus(err.message || "Не удалось сменить готовность");
      } finally {
        busy = false;
        lobbyReadyBtn.disabled = false;
      }
    });
  }
  lobbyStart.addEventListener("click", async () => {
    if (!roomCode || busy || lobbyStart.disabled) return;
    busy = true;
    setLobbyStatus("Запуск…");
    try {
      const state = await api("/api/game/room/start", {
        method: "POST",
        body: JSON.stringify({ code: roomCode }),
      });
      setLobbyStatus("");
      lastRoundKey = "";
      renderOnlineState(state, { forceMedia: true });
    } catch (err) {
      setLobbyStatus(err.message || "Не удалось начать");
    } finally {
      busy = false;
    }
  });
  lobbyLeave.addEventListener("click", () => {
    leaveRoom();
  });
  if (lobbyPlayers) {
    lobbyPlayers.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("[data-kick-user-id]") : null;
      if (!btn) return;
      e.preventDefault();
      kickPlayer(btn.dataset.kickUserId);
    });
  }
  if (lobbyCopyBtn) {
    lobbyCopyBtn.addEventListener("click", async () => {
      const code = (lobbyCode && lobbyCode.textContent || "").trim();
      if (!code || code === "----") return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const ta = document.createElement("textarea");
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setLobbyStatus(`Код ${code} скопирован`);
        setTimeout(() => setLobbyStatus(""), 1600);
      } catch {
        setLobbyStatus("Не удалось скопировать код");
      }
    });
  }
  againBtn.addEventListener("click", async () => {
    const code = roomCode;
    stopPolling();
    busy = false;
    roomCode = null;
    if (rematchBtn) rematchBtn.classList.add("hidden");
    if (rematchStatus) {
      rematchStatus.classList.add("hidden");
      rematchStatus.textContent = "";
    }
    if (code) {
      try {
        await api("/api/game/room/leave", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
      } catch {
        /* ignore */
      }
    }
    showView("intro");
    setStatus("");
    updateDailyUi();
  });
  if (rematchBtn) rematchBtn.addEventListener("click", () => requestRematch());

  window.addEventListener("pointerdown", () => {
    ensureAudio();
  }, { once: false, passive: true });

  window.addEventListener("resize", () => {
    if (!play.classList.contains("hidden")) scheduleFitMediaFrame();
  });

  function beaconLeaveRoom() {
    const code = roomCode;
    if (!code) return;
    const payload = JSON.stringify({ code });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon("/api/game/room/leave", blob)) return;
      }
    } catch {
      /* fall through */
    }
    try {
      fetch("/api/game/room/leave", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  window.addEventListener("pagehide", () => {
    beaconLeaveRoom();
  });
  window.addEventListener("beforeunload", () => {
    beaconLeaveRoom();
  });

  if (gameLoginBtn) gameLoginBtn.addEventListener("click", () => openGameAuth("login"));
  if (gameRegisterBtn) gameRegisterBtn.addEventListener("click", () => openGameAuth("register"));
  if (gameAuthCancel) {
    gameAuthCancel.addEventListener("click", () => {
      if (gameAuthDialog) gameAuthDialog.close();
    });
  }
  if (gameAuthSwitch) {
    gameAuthSwitch.addEventListener("click", () => {
      setGameAuthMode(gameAuthMode === "register" ? "login" : "register");
      if (gameAuthUsername) gameAuthUsername.focus();
    });
  }
  if (gameAuthForm) {
    gameAuthForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setGameAuthError("");
      const username = (gameAuthUsername && gameAuthUsername.value.trim()) || "";
      const password = (gameAuthPassword && gameAuthPassword.value) || "";
      if (!username || !password) {
        setGameAuthError("Заполните ник и пароль");
        return;
      }
      if (gameAuthMode === "register") {
        const password2 = (gameAuthPassword2 && gameAuthPassword2.value) || "";
        if (password !== password2) {
          setGameAuthError("Пароли не совпадают");
          return;
        }
        if (password.length < 6) {
          setGameAuthError("Пароль от 6 символов");
          return;
        }
      }
      try {
        const path = gameAuthMode === "register" ? "/api/auth/register" : "/api/auth/login";
        await api(path, {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        if (gameAuthDialog) gameAuthDialog.close();
        await refreshAuthAfterLogin();
      } catch (err) {
        setGameAuthError(err.message || "Не удалось войти");
      }
    });
  }

  boot();
})();
