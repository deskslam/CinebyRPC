(() => {
  "use strict";

  const WATCH_RE = /^\/watch\/(movie|tv)\/(\d+)/i;

  const HEARTBEAT_MS = 4000;
  const STALL_MS = 5000;
  const KEEPALIVE_MS = 25000;
  const TICK_SEND_MS = 8000;

  let session = null;
  let lastSig = "";
  let lastSentAt = 0;
  let heartbeat = null;

  function parseLocation() {
    const m = location.pathname.match(WATCH_RE);
    if (!m) return null;
    const q = new URLSearchParams(location.search);
    return {
      mediaType: m[1].toLowerCase(),
      tmdbId: Number(m[2]),
      season: Number(q.get("s") || q.get("season") || 0) || 0,
      episode: Number(q.get("e") || q.get("episode") || 0) || 0,
    };
  }

  function historyEntry(tmdbId, mediaType) {
    try {
      const list = JSON.parse(localStorage.getItem("lumenstream.history.v1") || "[]");
      if (!Array.isArray(list)) return null;
      return list.find((e) => Number(e.id) === tmdbId && e.type === mediaType) || null;
    } catch {
      return null;
    }
  }

  function titleFromTab() {
    const t = (document.title || "").replace(/\s*[·|]\s*Cineby\s*$/i, "").trim();
    return t && t.toLowerCase() !== "cineby" ? t : null;
  }

  function refreshMeta() {
    if (!session) return;
    const e = historyEntry(session.tmdbId, session.mediaType);
    if (e) {
      session.title = e.title || session.title;
      session.posterPath = e.posterPath || session.posterPath;
      if (session.mediaType === "tv") {
        session.season = session.season || e.season || 0;
        session.episode = session.episode || e.episode || 0;
      }
    }
    session.title = session.title || titleFromTab();
  }

  function payload() {
    if (!session) return { activity: false };
    return {
      activity: true,
      mediaType: session.mediaType,
      tmdbId: session.tmdbId,
      title: session.title || null,
      season: session.season || 0,
      episode: session.episode || 0,
      posterPath: session.posterPath || null,
      playing: session.playing,
      currentTime: Math.max(0, Math.round(session.currentTime || 0)),
      duration: Math.max(0, Math.round(session.duration || 0)),
      url: location.href,
      updatedAt: Date.now(),
    };
  }

  function signature(p) {
    if (!p.activity) return "off";
    return [
      p.mediaType, p.tmdbId, p.season, p.episode, p.title, p.posterPath,
      p.playing ? "P" : "-", Math.round(p.currentTime / 10), p.duration,
    ].join("|");
  }

  function send(force = false) {
    const p = payload();
    const sig = signature(p);
    const stale = Date.now() - lastSentAt > KEEPALIVE_MS;
    if (!force && !stale && sig === lastSig) return;
    lastSig = sig;
    lastSentAt = Date.now();
    try {
      chrome.runtime.sendMessage({ v: 1, type: "presence", payload: p }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      void 0;
    }
  }

  function stop() {
    session = null;
    clearInterval(heartbeat);
    heartbeat = null;
    send(true);
  }

  function startHeartbeat() {
    if (heartbeat) return;
    heartbeat = setInterval(() => {
      if (!session) return;
      if (session.playing && Date.now() - session.lastTick > STALL_MS) {
        session.playing = false;
      }
      send();
    }, HEARTBEAT_MS);
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    const kind = data && typeof data === "object" ? String(data.type || "") : "";
    if (!kind.startsWith("cinesrc:") || !session) return;

    switch (kind) {
      case "cinesrc:timeupdate":
        if (Number.isFinite(data.currentTime)) session.currentTime = data.currentTime;
        if (Number.isFinite(data.duration) && data.duration > 0) session.duration = data.duration;
        session.lastTick = Date.now();
        session.playing = true;
        if (Date.now() - lastSentAt >= TICK_SEND_MS) send();
        break;
      case "cinesrc:play":
        session.playing = true;
        session.lastTick = Date.now();
        send(true);
        break;
      case "cinesrc:pause":
        session.playing = false;
        send(true);
        break;
      case "cinesrc:ended":
        session.playing = false;
        session.currentTime = session.duration || session.currentTime;
        send(true);
        break;
    }
  });

  function onNavigate() {
    const info = parseLocation();
    if (!info) {
      if (session) stop();
      return;
    }

    const same =
      session &&
      session.tmdbId === info.tmdbId &&
      session.mediaType === info.mediaType &&
      session.season === info.season &&
      session.episode === info.episode;
    if (same) return;

    session = {
      ...info,
      title: null,
      posterPath: null,
      playing: false,
      currentTime: 0,
      duration: 0,
      lastTick: 0,
    };
    refreshMeta();
    startHeartbeat();
    send(true);

    let tries = 0;
    const t = setInterval(() => {
      if (!session || session.tmdbId !== info.tmdbId) return clearInterval(t);
      refreshMeta();
      send();
      if (++tries >= 10 || (session.title && session.posterPath)) clearInterval(t);
    }, 1000);
  }

  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const r = original.apply(this, args);
      queueMicrotask(onNavigate);
      return r;
    };
  }
  window.addEventListener("popstate", onNavigate);
  window.addEventListener("hashchange", onNavigate);

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      onNavigate();
    }
  }, 1500);

  window.addEventListener("pagehide", () => {
    if (!session) return;
    try {
      chrome.runtime.sendMessage({ v: 1, type: "presence", payload: { activity: false } });
    } catch {
      void 0;
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && session) send(true);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onNavigate, { once: true });
  }
  onNavigate();
})();
