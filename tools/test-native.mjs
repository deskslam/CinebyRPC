import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const exe = process.argv[2] || join(root, "packaging", "dist", "cinebyRPC-helper.exe");
const EXT = "chrome-extension://mdgoeaelfcglnapppbljjbfgmnfbmlgd/";

const child = spawn(exe, [EXT, "--parent-window=0"], { stdio: ["pipe", "pipe", "inherit"] });

function send(obj) {
  const json = Buffer.from(JSON.stringify(obj), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  child.stdin.write(Buffer.concat([header, json]));
  console.log("  ->", JSON.stringify(obj).slice(0, 90));
}

let buf = Buffer.alloc(0);
child.stdout.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= 4) {
    const len = buf.readUInt32LE(0);
    if (buf.length < 4 + len) break;
    console.log("  <-", buf.subarray(4, 4 + len).toString("utf8"));
    buf = buf.subarray(4 + len);
  }
});

child.on("exit", (code) => console.log(`helper exited (${code})`));

const base = {
  activity: true, mediaType: "tv", tmdbId: 1399, title: "Game of Thrones",
  season: 1, episode: 3, posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
  playing: true, currentTime: 120, duration: 3400,
  url: "https://cineby.rocks/watch/tv/1399?s=1&e=3",
};

(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(500);
  send({ v: 1, type: "hello", client: "test-native" });
  await wait(1500);
  send({ v: 1, type: "presence", payload: { ...base, updatedAt: Date.now() } });
  await wait(3000);
  send({ v: 1, type: "presence", payload: { ...base, playing: false, currentTime: 150, updatedAt: Date.now() } });
  await wait(3000);
  send({ v: 1, type: "clear" });
  await wait(2000);
  console.log("closing stdin");
  child.stdin.end();
})();
