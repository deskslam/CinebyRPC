import { WebSocketServer } from "ws";
import { EventEmitter } from "node:events";

export class ExtensionBridge extends EventEmitter {
  constructor(port) {
    super();
    this.port = port;
    this.wss = null;
    this.clients = new Set();
  }

  start() {
    this.wss = new WebSocketServer({ host: "127.0.0.1", port: this.port });

    this.wss.on("listening", () => console.log(`[ws] listening on ws://127.0.0.1:${this.port}`));

    this.wss.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[ws] port ${this.port} is in use — set a different "wsPort" in config.json`);
        process.exit(1);
      }
      console.error(`[ws] ${err.message}`);
    });

    this.wss.on("connection", (socket, req) => {
      const addr = req.socket.remoteAddress || "";
      if (!addr.includes("127.0.0.1") && addr !== "::1") {
        socket.close();
        return;
      }

      this.clients.add(socket);
      console.log(`[ws] extension connected (${this.clients.size})`);
      this.emit("connect");

      socket.on("message", (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg.type === "presence") {
          if (msg.payload && msg.payload.activity) this.emit("presence", msg.payload);
          else this.emit("clear");
        } else if (msg.type === "clear") {
          this.emit("clear");
        }
      });

      socket.on("close", () => {
        this.clients.delete(socket);
        console.log(`[ws] extension disconnected (${this.clients.size})`);
        if (this.clients.size === 0) this.emit("all-disconnected");
      });

      socket.on("error", () => this.clients.delete(socket));
    });

    this._ping = setInterval(() => {
      for (const s of this.clients) {
        try {
          s.send(JSON.stringify({ type: "ping" }));
        } catch {
          void 0;
        }
      }
    }, 20000);
  }

  async stop() {
    clearInterval(this._ping);
    for (const s of this.clients) {
      try {
        s.close();
      } catch {
        void 0;
      }
    }
    await new Promise((res) => (this.wss ? this.wss.close(res) : res()));
  }
}
