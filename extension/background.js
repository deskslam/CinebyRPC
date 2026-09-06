const HOST = "com.cineby.rpc";
const RETRY_COOLDOWN_MS = 30000;

const tabs = new Map();
let port = null;
let discordReady = false;
let lastSent = "";
let enabled = true;
let retryAfter = 0;

chrome.storage.local.get("config").then(({ config }) => {
  if (config && typeof config.enabled === "boolean") enabled = config.enabled;
  updateBadge();
});

function connect() {
  if (port || Date.now() < retryAfter) return;

  const openedAt = Date.now();
  try {
    port = chrome.runtime.connectNative(HOST);
  } catch {
    retryAfter = Date.now() + RETRY_COOLDOWN_MS;
    return;
  }

  port.onMessage.addListener((msg) => {
    if (msg && msg.type === "status") {
      discordReady = Boolean(msg.discord);
      updateBadge();
    }
  });

  port.onDisconnect.addListener(() => {
    const err = chrome.runtime.lastError;
    if (err) console.warn("[native]", err.message);
    if (Date.now() - openedAt < 1000) retryAfter = Date.now() + RETRY_COOLDOWN_MS;
    port = null;
    discordReady = false;
    lastSent = "";
    updateBadge();
  });

  lastSent = "";
}

function disconnect() {
  if (!port) return;
  try {
    port.disconnect();
  } catch {
    void 0;
  }
  port = null;
  discordReady = false;
  updateBadge();
}

function post(msg) {
  connect();
  if (!port) return;
  try {
    port.postMessage(msg);
  } catch (e) {
    console.warn("[native] send failed:", e.message);
    port = null;
  }
}

function activeTab() {
  let best = null;
  for (const p of tabs.values()) {
    if (!p || !p.activity) continue;
    if (!best) {
      best = p;
    } else {
      const score = (x) => (x.playing ? 1e15 : 0) + (x.updatedAt || 0);
      if (score(p) > score(best)) best = p;
    }
  }
  return best;
}

function sync(force = false) {
  const active = enabled ? activeTab() : null;

  if (!active) {
    if (port) {
      post({ v: 1, type: "clear" });
      disconnect();
    }
    lastSent = "";
    updateBadge();
    return;
  }

  const json = JSON.stringify(active);
  if (force || json !== lastSent) {
    lastSent = json;
    post({ v: 1, type: "presence", payload: active });
  }
  updateBadge();
}

function keepAlive() {
  const active = enabled ? activeTab() : null;
  if (!active) return;
  connect();
  if (!port) return;
  post({ v: 1, type: "presence", payload: { ...active, updatedAt: Date.now() } });
  updateBadge();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "presence") {
    const id = sender.tab && sender.tab.id;
    if (typeof id !== "number") return;
    if (msg.payload && msg.payload.activity) tabs.set(id, msg.payload);
    else tabs.delete(id);
    sync();
    return false;
  }

  if (msg.type === "get-status") {
    chrome.storage.local.get("config").then(({ config }) => {
      sendResponse({
        connected: Boolean(port),
        discordReady,
        enabled: (config || {}).enabled !== false,
        active: activeTab() || null,
      });
    });
    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((id) => {
  if (tabs.delete(id)) sync();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.config) return;
  enabled = changes.config.newValue?.enabled !== false;
  if (enabled) {
    retryAfter = 0;
    sync(true);
  } else {
    disconnect();
    lastSent = "";
    updateBadge();
  }
});

chrome.alarms.create("keepalive", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepalive") keepAlive();
});

function updateBadge() {
  const active = activeTab();
  let text = "";
  let color = "#888888";

  if (!active) {
    text = "";
  } else if (!port || !discordReady) {
    text = "!";
    color = "#d83c3c";
  } else {
    text = active.playing ? "▶" : "II";
    color = active.playing ? "#3ba55d" : "#faa61a";
  }
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
