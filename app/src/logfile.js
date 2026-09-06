import { createWriteStream, existsSync, statSync, renameSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const MAX_BYTES = 1_000_000;

export function initLogFile(cfg, { forceFile = false } = {}) {
  if (!cfg._packaged && !forceFile) return null;

  const dir = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "cinebyRPC")
    : dirname(process.execPath);

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return null;
  }

  // Log file is named "alora" for a friend — nothing depends on the name.
  const file = join(dir, "alora.log");
  try {
    if (existsSync(file) && statSync(file).size > MAX_BYTES) renameSync(file, file + ".1");
  } catch {
    void 0;
  }

  let stream;
  try {
    stream = createWriteStream(file, { flags: "a" });
  } catch {
    return null;
  }

  const passthrough = !forceFile;
  const tee = (orig) => (...args) => {
    try {
      stream.write(`${new Date().toISOString()} ${args.join(" ")}\n`);
    } catch {
      void 0;
    }
    if (passthrough) {
      try {
        orig(...args);
      } catch {
        void 0;
      }
    }
  };

  console.log = tee(console.log.bind(console));
  console.warn = tee(console.warn.bind(console));
  console.error = tee(console.error.bind(console));
  console.info = tee(console.info.bind(console));
  console.debug = tee(console.debug.bind(console));

  return file;
}
