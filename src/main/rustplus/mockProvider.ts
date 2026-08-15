import { EventEmitter } from "node:events";
import type { ProviderEvent, RustPlusProvider, RustPlusCapabilities } from "./types";

const MOCK_CAPABILITIES: RustPlusCapabilities = {
  serverInfo: true,
  rustTime: true,
  teamInfo: false,
  teamChat: false,
  map: false,
  mapMarkers: false,
  smartDevices: false,
  cameras: false,
};

export class MockRustPlusProvider implements RustPlusProvider {
  readonly kind = "mock" as const;
  readonly capabilities = MOCK_CAPABILITIES;
  private readonly emitter = new EventEmitter();
  private connected = false;
  private startedAt = Date.now();

  async connect(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 180));
    this.connected = true;
    this.startedAt = Date.now();
    this.emitter.emit("event", { type: "connected" } satisfies ProviderEvent);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    this.emitter.emit("event", { type: "disconnected", reason: "Simulation stopped" } satisfies ProviderEvent);
  }

  async getServerTelemetry() {
    if (!this.connected) throw new Error("Simulation provider is disconnected");
    this.emitter.emit("event", { type: "packet" } satisfies ProviderEvent);
    const elapsedMinutes = Math.floor((Date.now() - this.startedAt) / 60_000);
    return {
      name: "Operations training simulation",
      players: 184 + (elapsedMinutes % 8),
      maxPlayers: 500,
      queuedPlayers: 0,
      mapSize: 4500,
      wipeTime: new Date(this.startedAt - 18 * 60 * 60 * 1000).toISOString(),
      rustTime: "14:32",
      latencyMs: 18,
      source: "simulation" as const,
    };
  }

  subscribe(listener: (event: ProviderEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
