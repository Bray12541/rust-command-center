import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import type { Logger } from "pino";
import type { ServerProfile } from "../../shared/schemas/server";
import type { RustPlusCredentials } from "../security/credentialVault";
import type { ProviderEvent, RustPlusCapabilities, RustPlusProvider } from "./types";

interface RustPlusClient {
  on(event: string, listener: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  connect(): void;
  disconnect(): void;
  getInfo(callback: (message: any) => boolean): void;
  getTime(callback: (message: any) => boolean): void;
}

type RustPlusConstructor = new (
  address: string,
  port: number | string,
  playerId: string,
  playerToken: number,
) => RustPlusClient;

const LIVE_CAPABILITIES: RustPlusCapabilities = {
  serverInfo: true,
  rustTime: true,
  teamInfo: true,
  teamChat: true,
  map: true,
  mapMarkers: true,
  smartDevices: true,
  cameras: true,
};

const requireFromMain = createRequire(__filename);

function withCallback<T>(
  invoke: (callback: (message: any) => boolean) => void,
  pick: (message: any) => T | null,
  timeoutMs = 8_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Rust+ request timed out")), timeoutMs);
    invoke((message) => {
      const result = pick(message);
      if (result === null) return false;
      clearTimeout(timer);
      resolve(result);
      return true;
    });
  });
}

export class LiveRustPlusProvider implements RustPlusProvider {
  readonly kind = "live" as const;
  readonly capabilities = LIVE_CAPABILITIES;
  private readonly emitter = new EventEmitter();
  private readonly client: RustPlusClient;
  private connected = false;

  constructor(
    private readonly server: ServerProfile,
    credentials: RustPlusCredentials,
    private readonly logger: Logger,
  ) {
    // The upstream library is CommonJS and does not publish TypeScript declarations.
    const RustPlus = requireFromMain("@rustwirebot/rustplus.js") as RustPlusConstructor;
    this.client = new RustPlus(
      server.address,
      server.port,
      credentials.playerId,
      Number(credentials.playerToken),
    );
    this.client.on("message", () => this.emitter.emit("event", { type: "packet" } satisfies ProviderEvent));
    this.client.on("disconnected", () => {
      this.connected = false;
      this.emitter.emit("event", { type: "disconnected", reason: "Remote server closed the connection" } satisfies ProviderEvent);
    });
    this.client.on("error", (error: Error) => {
      this.emitter.emit("event", { type: "error", error } satisfies ProviderEvent);
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Rust+ connection timed out"));
      }, 12_000);
      const onConnected = () => {
        cleanup();
        this.connected = true;
        this.emitter.emit("event", { type: "connected" } satisfies ProviderEvent);
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        clearTimeout(timeout);
        this.client.off("connected", onConnected);
        this.client.off("error", onError);
      };
      this.client.once("connected", onConnected);
      this.client.once("error", onError);
      this.logger.info({ service: "rustplus", serverId: this.server.id, operation: "connect" }, "Connecting to Rust+");
      this.client.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (this.connected) this.client.disconnect();
    this.connected = false;
  }

  async getServerTelemetry() {
    const startedAt = performance.now();
    const info = await withCallback<any>(
      (callback) => this.client.getInfo(callback),
      (message) => message?.response?.info ?? null,
    );

    let rustTime: string | null = null;
    try {
      const time = await withCallback<any>(
        (callback) => this.client.getTime(callback),
        (message) => message?.response?.time ?? null,
        5_000,
      );
      if (typeof time?.time === "number") {
        const hours = Math.floor(time.time) % 24;
        const minutes = Math.floor((time.time % 1) * 60);
        rustTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      }
    } catch (error) {
      this.logger.debug({ service: "rustplus", serverId: this.server.id, error }, "Rust time unavailable");
    }

    return {
      name: typeof info.name === "string" ? info.name : null,
      players: Number.isInteger(info.players) ? info.players : null,
      maxPlayers: Number.isInteger(info.maxPlayers) && info.maxPlayers > 0 ? info.maxPlayers : null,
      queuedPlayers: Number.isInteger(info.queuedPlayers) ? info.queuedPlayers : null,
      mapSize: Number.isInteger(info.mapSize) && info.mapSize > 0 ? info.mapSize : null,
      wipeTime: typeof info.wipeTime === "number" ? new Date(info.wipeTime * 1000).toISOString() : null,
      rustTime,
      latencyMs: Math.round(performance.now() - startedAt),
      source: "live" as const,
    };
  }

  subscribe(listener: (event: ProviderEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
