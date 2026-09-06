"use strict";

const $ = (id) => document.getElementById(id);

async function loadConfig() {
  const { config } = await chrome.storage.local.get("config");
  return { enabled: true, ...(config || {}) };
}

function render(status) {
  const dot = $("dot");
  const text = $("statusText");
  const hint = $("hint");
  hint.hidden = true;

  const active = status.active;

  if (!status.enabled) {
    dot.className = "dot";
    text.textContent = "Disabled";
  } else if (status.discordReady) {
    dot.className = "dot ok";
    text.textContent = "Connected — Discord + helper";
  } else if (status.connected) {
    dot.className = "dot warn";
    text.textContent = "Helper up, waiting for Discord";
    hint.hidden = false;
    hint.textContent = "Open the Discord desktop app.";
  } else if (active) {
    dot.className = "dot bad";
    text.textContent = "Helper not responding";
    hint.hidden = false;
    hint.textContent = "Install the helper (see docs/SETUP.md).";
  } else {
    dot.className = "dot";
    text.textContent = "Idle";
  }

  if (active && active.activity) {
    $("nowWrap").hidden = false;
    $("nothing").hidden = true;
    $("nowTitle").textContent = active.title || "Cineby";
    const bits = [];
    if (active.mediaType === "tv" && active.season) {
      bits.push(`S${active.season}·E${active.episode}`);
    }
    bits.push(active.playing ? "Playing" : "Paused");
    if (active.duration) {
      const pct = Math.round((active.currentTime / active.duration) * 100);
      if (Number.isFinite(pct)) bits.push(`${pct}%`);
    }
    $("nowSub").textContent = bits.join("  ·  ");
  } else {
    $("nowWrap").hidden = true;
    $("nothing").hidden = false;
  }
}

async function refresh() {
  const cfg = await loadConfig();
  $("enabled").checked = cfg.enabled;

  chrome.runtime.sendMessage({ type: "get-status" }, (status) => {
    if (chrome.runtime.lastError || !status) {
      render({ enabled: cfg.enabled, connected: false, discordReady: false, active: null });
      return;
    }
    render(status);
  });
}

$("enabled").addEventListener("change", async () => {
  const cfg = await loadConfig();
  await chrome.storage.local.set({ config: { ...cfg, enabled: $("enabled").checked } });
  setTimeout(refresh, 300);
});

refresh();
setInterval(refresh, 2000);
