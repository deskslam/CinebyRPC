import net from "node:net";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

const HANDSHAKE = 0;
const FRAME = 1;
const CLOSE = 2;
const PING = 3;
const PONG = 4;

function socketPaths(id) {
  if (process.platform === "win32") return [`\\\\?\\pipe\\discord-ipc-${id}`];

  const base = (process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || "/tmp").replace(/\/$/, "");
  return [
    `${base}/discord-ipc-${id}`,
    `${base}/app/com.discordapp.Discord/discord-ipc-${id}`,
    `${base}/snap.discord/discord-ipc-${id}`,
  ];
}

function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data), "utf8");
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(json.length, 4);
  return Buffer.concat([header, json]);
}

export class DiscordIPC extends EventEmitter {
  constructor(clientId) {
    super();
    this.clientId = String(clientId);
    this.socket = null;
    this.connected = false;
    this._buf = Buffer.alloc(0);
    this._closing = false;
  }

  async connect() {
    if (this.connected || this.socket) return;
    for (let id = 0; id < 10; id++) {
      for (const path of socketPaths(id)) {
        try {
          await this._open(path);
          return;
        } catch {
          continue;
        }
      }
    }
    throw new Error("no Discord IPC pipe found — is the desktop app running?");
  }

  _open(path) {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection(path);
      const fail = (err) => {
        sock.destroy();
        reject(err);
      };
      sock.once("error", fail);
      sock.once("connect", () => {
        sock.removeListener("error", fail);
        this.socket = sock;
        sock.on("data", (c) => this._onData(c));
        sock.on("close", () => this._onClose());
        sock.on("error", () => this._onClose());
        sock.write(encode(HANDSHAKE, { v: 1, client_id: this.clientId }));
        resolve();
      });
    });
  }

  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    while (this._buf.length >= 8) {
      const op = this._buf.readInt32LE(0);
      const len = this._buf.readInt32LE(4);
      if (this._buf.length < 8 + len) break;
      const body = this._buf.subarray(8, 8 + len).toString("utf8");
      this._buf = this._buf.subarray(8 + len);

      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        continue;
      }

      if (op === PING) {
        this._write(PONG, msg);
      } else if (op === CLOSE) {
        this._onClose();
      } else if (op === FRAME && msg.cmd === "DISPATCH" && msg.evt === "READY") {
        this.connected = true;
        this.emit("ready", msg.data && msg.data.user);
      }
    }
  }

  _onClose() {
    if (!this.socket && !this.connected) return;
    this.socket = null;
    this.connected = false;
    this._buf = Buffer.alloc(0);
    if (!this._closing) this.emit("disconnected");
  }

  _write(op, data) {
    if (!this.socket) return false;
    try {
      this.socket.write(encode(op, data));
      return true;
    } catch {
      return false;
    }
  }

  setActivity(activity) {
    return this._write(FRAME, {
      cmd: "SET_ACTIVITY",
      nonce: randomUUID(),
      args: { pid: process.pid, activity: activity || undefined },
    });
  }

  destroy() {
    this._closing = true;
    try {
      this._write(CLOSE, {});
      this.socket?.destroy();
    } catch {
      this.socket = null;
    }
    this.socket = null;
    this.connected = false;
  }
}
