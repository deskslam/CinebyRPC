const BASE = "https://api.themoviedb.org/3";
const CACHE_TTL = 6 * 60 * 60 * 1000;

export class Tmdb {
  constructor(apiKey) {
    this.key = (apiKey || "").trim();
    this.enabled = Boolean(this.key);
    this.useBearer = this.key.split(".").length === 3;
    this.cache = new Map();
  }

  async _get(path, params = {}) {
    if (!this.enabled) return null;

    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const headers = { accept: "application/json" };
    if (this.useBearer) headers.authorization = `Bearer ${this.key}`;
    else url.searchParams.set("api_key", this.key);

    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        if (res.status === 401) {
          console.error("[tmdb] 401 — bad key, disabling enrichment");
          this.enabled = false;
        }
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn(`[tmdb] ${err.message}`);
      return null;
    }
  }

  async enrich(p) {
    if (!this.enabled) return null;

    const key = `${p.mediaType}:${p.tmdbId}:${p.season}:${p.episode}`;
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;

    let out = null;

    if (p.mediaType === "movie") {
      const m = await this._get(`/movie/${p.tmdbId}`);
      if (m) {
        out = {
          title: m.title || m.original_title,
          year: (m.release_date || "").slice(0, 4) || undefined,
          posterPath: m.poster_path || undefined,
        };
      }
    } else {
      const [show, ep] = await Promise.all([
        this._get(`/tv/${p.tmdbId}`),
        p.season && p.episode
          ? this._get(`/tv/${p.tmdbId}/season/${p.season}/episode/${p.episode}`)
          : null,
      ]);
      if (show || ep) {
        out = {
          title: show?.name || show?.original_name,
          year: (show?.first_air_date || "").slice(0, 4) || undefined,
          posterPath: show?.poster_path || undefined,
          episodeName: ep?.name || undefined,
        };
      }
    }

    this.cache.set(key, { value: out, expires: Date.now() + CACHE_TTL });
    return out;
  }
}
