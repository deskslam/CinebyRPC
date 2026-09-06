import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "app", "package.json"));
const { WebSocket } = require("ws");

const port = Number(process.argv[2]) || 3100;
const ws = new WebSocket(`ws://127.0.0.1:${port}`);

const frames = [
  {
    label: "play GoT S1E3",
    payload: {
      activity: true, mediaType: "tv", tmdbId: 1399, title: "Game of Thrones",
      season: 1, episode: 3, posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
      playing: true, currentTime: 120, duration: 3400,
      url: "https://cineby.rocks/watch/tv/1399?s=1&e=3", updatedAt: Date.now(),
    },
  },
  { label: "progress +90s", mutate: (p) => ((p.currentTime += 90), p) },
  { label: "pause", mutate: (p) => ((p.playing = false), p) },
  { label: "resume", mutate: (p) => ((p.playing = true), (p.currentTime += 5), p) },
  {
    label: "switch to a movie",
    payload: {
      activity: true, mediaType: "movie", tmdbId: 1137844, title: "Mayday",
      season: 0, episode: 0, posterPath: "/hVXjX1jLZ1ljFSNGXpjJfbTUOa7.jpg",
      playing: true, currentTime: 30, duration: 6600,
      url: "https://cineby.rocks/watch/movie/1137844", updatedAt: Date.now(),
    },
  },
  { label: "clear", clear: true },
];

let current = null;

ws.on("open", async () => {
  console.log(`connected to ws://127.0.0.1:${port}`);
  ws.send(JSON.stringify({ v: 1, type: "hello", client: "test-client" }));
  for (const f of frames) {
    await new Promise((r) => setTimeout(r, 2500));
    if (f.clear) {
      ws.send(JSON.stringify({ v: 1, type: "clear" }));
    } else {
      current = f.payload ? f.payload : f.mutate({ ...current });
      current.updatedAt = Date.now();
      ws.send(JSON.stringify({ v: 1, type: "presence", payload: current }));
    }
    console.log(`-> ${f.label}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
  ws.close();
  console.log("done");
});

ws.on("message", (d) => {
  const m = JSON.parse(d.toString());
  if (m.type !== "ping") console.log("<-", m);
});
ws.on("error", (e) => console.error("error:", e.message));
