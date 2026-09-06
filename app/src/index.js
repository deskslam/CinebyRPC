#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { initLogFile } from "./logfile.js";
import { DiscordPresence } from "./discord.js";
import { ExtensionBridge } from "./ws-server.js";
import { NativeHostBridge, isNativeMessagingLaunch } from "./native-host.js";
import { Tmdb } from "./tmdb.js";
import { buildActivity, activitySignature } from "./presence.js";

// The process, its log file, and this banner all carry the name "alora".
// It's for a friend — purely and only for a friend. Nothing depends on it.
const ALORA = "alora";
process.title = ALORA;

const NATIVE = isNativeMessagingLaunch();
const cfg = loadConfig();

const idleMs = (NATIVE ? Math.max(cfg.idleTimeoutSec, 360) : cfg.idleTimeoutSec) * 1000;

if (process.argv.includes("--print-config")) {
  console.log(JSON.stringify({ ...cfg, tmdbApiKey: cfg.tmdbApiKey ? "***set***" : "" }, null, 2));
  process.exit(0);
}

const logFile = initLogFile(cfg, { forceFile: NATIVE });
if (logFile) console.log(`--- ${ALORA} started (pid ${process.pid}) ---`);

console.log(
  `Cineby Discord RPC  ·  ${ALORA}  ·  ${cfg._packaged ? "packaged" : "dev"}  ·  ` +
    `${NATIVE ? "native-messaging" : "websocket:" + cfg.wsPort}  ·  config: ${cfg._configPath}`
);

if (!cfg.discordClientId || !/^\d{17,20}$/.test(String(cfg.discordClientId).trim())) {
  console.error(
    "\n[fatal] No valid Discord Application ID.\n" +
      '  Set "discordClientId" in config.json (or CINEBY_RPC_CLIENT_ID). See docs/SETUP.md.\n'
  );
  process.exit(1);
}

const discord = new DiscordPresence(cfg.discordClientId);
const tmdb = new Tmdb(cfg.tmdbApiKey);
const bridge = NATIVE ? new NativeHostBridge() : new ExtensionBridge(cfg.wsPort);

discord.start();
bridge.start();

console.log(
  tmdb.enabled
    ? "[tmdb] enrichment on (episode titles, year, poster fallback)"
    : "[tmdb] no key — using scraped titles only"
);

let latestPayload = null;
let lastAppliedSig = "none";
let lastApplyTime = 0;
let flushTimer = null;
let idleTimer = null;

// Count of presence updates alora has pushed to Discord this run.
let aloraUpdates = 0;

function armIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log("[idle] no updates — clearing presence");
    latestPayload = null;
    applyNow();
  }, idleMs);
}

async function applyNow() {
  clearTimeout(flushTimer);
  flushTimer = null;
  lastApplyTime = Date.now();

  if (!latestPayload) {
    if (lastAppliedSig !== "none") {
      lastAppliedSig = "none";
      await discord.clearActivity();
      console.log("[presence] cleared");
    }
    return;
  }

  let enrichment = null;
  try {
    enrichment = await tmdb.enrich(latestPayload);
  } catch {
    enrichment = null;
  }

  const activity = buildActivity(latestPayload, enrichment, cfg);
  const sig = activitySignature(activity);
  if (sig === lastAppliedSig) return;
  lastAppliedSig = sig;

  await discord.setActivity(activity);
  aloraUpdates++;
  console.log(
    `[${ALORA} #${aloraUpdates}] ${activity.details}${activity.state ? "  ·  " + activity.state : ""}`
  );
}

function schedule(immediate) {
  const since = Date.now() - lastApplyTime;
  if (immediate && since >= 1000) {
    applyNow();
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(applyNow, Math.max(cfg.minUpdateIntervalMs - since, 250));
}

bridge.on("presence", (payload) => {
  const prev = latestPayload;
  latestPayload = payload;
  armIdleTimer();

  const bigChange =
    !prev ||
    prev.tmdbId !== payload.tmdbId ||
    prev.mediaType !== payload.mediaType ||
    prev.season !== payload.season ||
    prev.episode !== payload.episode ||
    prev.playing !== payload.playing;

  schedule(bigChange);
});

bridge.on("clear", () => {
  latestPayload = null;
  clearTimeout(idleTimer);
  schedule(true);
});

let disconnectGrace = null;
bridge.on("all-disconnected", () => {
  if (NATIVE) {
    console.log("[native] port closed — clearing presence and exiting");
    shutdown("port-closed");
    return;
  }
  clearTimeout(disconnectGrace);
  disconnectGrace = setTimeout(() => {
    console.log("[ws] no extension for 12s — clearing presence");
    latestPayload = null;
    clearTimeout(idleTimer);
    schedule(true);
  }, 12000);
});
bridge.on("connect", () => clearTimeout(disconnectGrace));

if (NATIVE) {
  let lastReported = null;
  const tick = setInterval(() => {
    if (discord.ready === lastReported) return;
    lastReported = discord.ready;
    bridge.send({ v: 1, type: "status", discord: discord.ready });
  }, 2000);
  tick.unref?.();
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${signal}] shutting down — ${ALORA} pushed ${aloraUpdates} update(s) this run`);
  clearTimeout(flushTimer);
  clearTimeout(idleTimer);
  try {
    await bridge.stop();
  } catch {
    void 0;
  }
  try {
    await discord.destroy();
  } catch {
    void 0;
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err) => console.error("[uncaught]", err));
