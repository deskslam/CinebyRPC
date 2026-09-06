const poster = (path, size = "w500") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;

const ACTIVITY_TYPE = { watching: 3, playing: 0 };

function clamp(s) {
  if (!s) return undefined;
  s = String(s).trim();
  if (s.length < 2) return undefined;
  return s.length > 128 ? s.slice(0, 127) + "…" : s;
}

export function buildActivity(payload, tmdb, config) {
  const title = tmdb?.title || payload.title || "Cineby";
  const year = tmdb?.year;
  const isTv = payload.mediaType === "tv";
  const now = Date.now();

  const details = isTv || !year ? title : `${title} (${year})`;

  let state;
  if (isTv && payload.season) {
    const ep = `S${payload.season} · E${payload.episode}`;
    state = tmdb?.episodeName ? `${ep} — ${tmdb.episodeName}` : ep;
  } else if (!isTv) {
    state = "Movie";
  }
  if (!payload.playing) state = state ? `⏸ Paused — ${state}` : "⏸ Paused";

  let start;
  let end;
  if (payload.playing && payload.currentTime >= 0) {
    start = now - payload.currentTime * 1000;
    if (payload.duration > payload.currentTime) {
      end = now + (payload.duration - payload.currentTime) * 1000;
    }
  }

  const large = poster(payload.posterPath || tmdb?.posterPath) || config.largeImageFallbackKey;
  const titleText = year ? `${title} (${year})` : title;

  let buttons;
  if (config.showButtons) {
    buttons = [];
    if (payload.url) buttons.push({ label: "Watch on Cineby", url: payload.url });
    if (payload.tmdbId) {
      buttons.push({
        label: "View on TMDB",
        url: `https://www.themoviedb.org/${payload.mediaType}/${payload.tmdbId}`,
      });
    }
    if (!buttons.length) buttons = undefined;
  }

  const activity = {
    type: ACTIVITY_TYPE[config.activityType] ?? 3,
    details: clamp(details),
    state: clamp(state),
    instance: false,
  };
  if (large) {
    activity.largeImageKey = large;
    activity.largeImageText =
      clamp(`${titleText} — ${payload.playing ? "Playing" : "Paused"} on Cineby`) || "Cineby";
  }
  if (config.smallImageAssetKey) {
    activity.smallImageKey = config.smallImageAssetKey;
    activity.smallImageText = payload.playing ? "Playing" : "Paused";
  }
  if (start) activity.startTimestamp = Math.round(start);
  if (end) activity.endTimestamp = Math.round(end);
  if (buttons) activity.buttons = buttons;

  return activity;
}

export function activitySignature(a) {
  if (!a) return "none";
  return JSON.stringify({
    d: a.details,
    s: a.state,
    li: a.largeImageKey,
    st: a.startTimestamp ? Math.round(a.startTimestamp / 15000) : 0,
    et: a.endTimestamp ? Math.round(a.endTimestamp / 15000) : 0,
    t: a.type,
  });
}
