import { DiscordIPC } from "./discord-ipc.js";

const RECONNECT_MS = 10000;

function toIpc(a) {
  if (!a) return null;
  const out = { type: a.type ?? 3, instance: Boolean(a.instance) };
  if (a.details) out.details = a.details;
  if (a.state) out.state = a.state;

  if (a.startTimestamp || a.endTimestamp) {
    out.timestamps = {};
    if (a.startTimestamp) out.timestamps.start = Math.round(a.startTimestamp);
    if (a.endTimestamp) out.timestamps.end = Math.round(a.endTimestamp);
  }

  if (a.largeImageKey || a.smallImageKey || a.largeImageText || a.smallImageText) {
    out.assets = {};
    if (a.largeImageKey) out.assets.large_image = a.largeImageKey;
    if (a.largeImageText) out.assets.large_text = a.largeImageText;
    if (a.smallImageKey) out.assets.small_image = a.smallImageKey;
    if (a.smallImageText) out.assets.small_text = a.smallImageText;
  }

  if (Array.isArray(a.buttons) && a.buttons.length) out.buttons = a.buttons.slice(0, 2);
  return out;
}

export class DiscordPresence {
  constructor(clientId) {
    this.clientId = clientId;
    this.ipc = null;
    this.ready = false;
    this._pending = null;
    this._retry = null;
    this._connecting = false;
  }

  start() {
    this._connect();
  }

  async _connect() {
    if (this._connecting || this.ready) return;
    this._connecting = true;

    const ipc = new DiscordIPC(this.clientId);
    this.ipc = ipc;

    ipc.on("ready", (user) => {
      this.ready = true;
      this._connecting = false;
      console.log(`[discord] connected${user ? ` as ${user.username}` : ""} (${this.clientId})`);
      if (this._pending) this._apply(this._pending);
    });

    ipc.on("disconnected", () => {
      this.ready = false;
      this._connecting = false;
      console.warn(`[discord] lost connection; retrying in ${RECONNECT_MS / 1000}s`);
      this._scheduleRetry();
    });

    try {
      await ipc.connect();
    } catch (err) {
      this._connecting = false;
      console.warn(`[discord] ${err.message} retrying in ${RECONNECT_MS / 1000}s`);
      this._scheduleRetry();
    }
  }

  _scheduleRetry() {
    if (this._retry) return;
    try {
      this.ipc?.destroy();
    } catch {
      this.ipc = null;
    }
    this.ipc = null;
    this._retry = setTimeout(() => {
      this._retry = null;
      this._connect();
    }, RECONNECT_MS);
  }

  _apply(activity) {
    if (!this.ipc || !this.ready) return;
    if (!this.ipc.setActivity(toIpc(activity))) this._scheduleRetry();
  }

  setActivity(activity) {
    this._pending = activity;
    this._apply(activity);
  }

  clearActivity() {
    this._pending = null;
    if (this.ipc && this.ready) this.ipc.setActivity(null);
  }

  destroy() {
    if (this._retry) clearTimeout(this._retry);
    try {
      this.clearActivity();
      this.ipc?.destroy();
    } catch {
      this.ipc = null;
    }
  }
}
