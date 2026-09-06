import { EventEmitter } from "node:events";

export function isNativeMessagingLaunch() {
  return process.argv.some(
    (a) => a.startsWith("chrome-extension://") || a.startsWith("--parent-window=")
  );
}

export class NativeHostBridge extends EventEmitter {
  constructor() {
    super();
    this._buf = Buffer.alloc(0);
    this._started = false;
    this._ended = false;
  }

  start() {
    if (this._started) return;
    this._started = true;

    process.stdin.on("data", (c) => this._onData(c));
    process.stdin.on("end", () => this._end());
    process.stdin.on("close", () => this._end());
    process.stdin.on("error", () => this._end());
    process.stdin.resume();

    queueMicrotask(() => this.emit("connect"));
  }

  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    while (this._buf.length >= 4) {
      const len = this._buf.readUInt32LE(0);
      if (len > 64 * 1024 * 1024) return this._end();
      if (this._buf.length < 4 + len) break;

      const json = this._buf.subarray(4, 4 + len).toString("utf8");
      this._buf = this._buf.subarray(4 + len);

      let msg;
      try {
        msg = JSON.parse(json);
      } catch {
        continue;
      }

      if (msg?.type === "presence") {
        if (msg.payload && msg.payload.activity) this.emit("presence", msg.payload);
        else this.emit("clear");
      } else if (msg?.type === "clear") {
        this.emit("clear");
      }
    }
  }

  _end() {
    if (this._ended) return;
    this._ended = true;
    this.emit("all-disconnected");
  }

  send(obj) {
    try {
      const json = Buffer.from(JSON.stringify(obj), "utf8");
      const header = Buffer.alloc(4);
      header.writeUInt32LE(json.length, 0);
      process.stdout.write(Buffer.concat([header, json]));
    } catch {
      return;
    }
  }

  async stop() {
    try {
      process.stdin.pause();
    } catch {
      return;
    }
  }
}
