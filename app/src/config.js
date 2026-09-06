import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const isPackaged = Boolean(process.pkg);

let sourceDir = process.cwd();
try {
  if (import.meta && import.meta.url) {
    sourceDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  }
} catch {
  sourceDir = process.cwd();
}

const DEFAULTS = {
  discordClientId: "1546233067583184926",
  wsPort: 3100,
  tmdbApiKey: "",
  activityType: "watching",
  showButtons: true,
  idleTimeoutSec: 90,
  minUpdateIntervalMs: 4000,
  smallImageAssetKey: "cineby",
  largeImageFallbackKey: "",
};

function configLocations() {
  const paths = [];
  if (process.env.CINEBY_RPC_CONFIG) paths.push(process.env.CINEBY_RPC_CONFIG);

  if (isPackaged) {
    paths.push(join(dirname(process.execPath), "config.json"));
    const appData =
      process.env.LOCALAPPDATA ||
      process.env.XDG_CONFIG_HOME ||
      join(process.env.HOME || process.env.USERPROFILE || ".", ".config");
    paths.push(join(appData, "cinebyRPC", "config.json"));
  } else {
    paths.push(join(sourceDir, "config.json"));
    paths.push(join(sourceDir, "config.example.json"));
  }
  return paths;
}

export function loadConfig() {
  let path = null;
  let fromFile = {};

  for (const p of configLocations()) {
    if (p && existsSync(p)) {
      try {
        fromFile = JSON.parse(readFileSync(p, "utf8"));
        path = p;
        break;
      } catch (err) {
        console.error(`[config] ${p} is not valid JSON: ${err.message}`);
      }
    }
  }

  const cfg = { ...DEFAULTS, ...fromFile };

  if (process.env.CINEBY_RPC_CLIENT_ID) cfg.discordClientId = process.env.CINEBY_RPC_CLIENT_ID;
  if (process.env.CINEBY_RPC_PORT) cfg.wsPort = Number(process.env.CINEBY_RPC_PORT);
  if (process.env.TMDB_API_KEY) cfg.tmdbApiKey = process.env.TMDB_API_KEY;

  cfg.wsPort = Number(cfg.wsPort) || DEFAULTS.wsPort;
  cfg.idleTimeoutSec = Number(cfg.idleTimeoutSec) || DEFAULTS.idleTimeoutSec;
  cfg.minUpdateIntervalMs = Number(cfg.minUpdateIntervalMs) || DEFAULTS.minUpdateIntervalMs;
  cfg.activityType = cfg.activityType === "playing" ? "playing" : "watching";

  cfg._configPath = path || "(defaults)";
  cfg._packaged = isPackaged;
  return cfg;
}
