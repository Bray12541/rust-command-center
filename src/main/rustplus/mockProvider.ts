import { EventEmitter } from "node:events";
import type { OperationsSnapshot, RustPlusCommand } from "../../shared/contracts/operations";
import type { ProviderEvent, RustPlusProvider, RustPlusCapabilities } from "./types";

const MOCK_CAPABILITIES: RustPlusCapabilities = {
  serverInfo: true,
  rustTime: true,
  teamInfo: true,
  teamChat: true,
  map: true,
  mapMarkers: true,
  smartDevices: true,
  cameras: true,
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
      mapName: "Procedural Map",
      mapSeed: 8675309,
      headerImage: null,
      logoImage: null,
      websiteUrl: "https://example.invalid",
      wipeTime: new Date(this.startedAt - 18 * 60 * 60 * 1000).toISOString(),
      rustTime: "14:32",
      rustTimeDecimal: 14.53,
      sunrise: 7.5,
      sunset: 18.5,
      dayLengthMinutes: 60,
      latencyMs: 18,
      connectedAt: new Date(this.startedAt).toISOString(),
      reconnectCount: 0,
      connectionQuality: "excellent" as const,
      source: "simulation" as const,
    };
  }

  async getOperationsSnapshot(deviceIds: number[]): Promise<Omit<OperationsSnapshot, "serverId" | "observedAt">> {
    if (!this.connected) throw new Error("Simulation provider is disconnected");
    const now = new Date();
    return {
      map: {
        width: 1024, height: 1024, oceanMargin: 100,
        imageDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABCf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=",
        monuments: [
          { token: "launch_site", x: 730, y: 260 }, { token: "airfield", x: 300, y: 350 },
          { token: "outpost", x: 510, y: 530 }, { token: "harbor", x: 170, y: 700 },
        ],
      },
      markers: [
        { id: "cargo-1", type: "cargo", x: 820, y: 690, rotation: 32, radius: null, name: "Cargo Ship", outOfStock: false, sellOrders: [] },
        { id: "heli-1", type: "patrol-heli", x: 620, y: 250, rotation: 110, radius: null, name: "Patrol Helicopter", outOfStock: false, sellOrders: [] },
        { id: "crate-1", type: "crate", x: 735, y: 270, rotation: null, radius: null, name: "Locked Crate", outOfStock: false, sellOrders: [] },
        { id: "shop-1", type: "vending", x: 515, y: 530, rotation: null, radius: null, name: "Guns for sulfur", outOfStock: false, sellOrders: [{ itemId: -1211166256, quantity: 1, currencyId: -1581843485, costPerItem: 750, amountInStock: 4, itemIsBlueprint: false, currencyIsBlueprint: false }] },
      ],
      team: {
        leaderSteamId: "76561198000000001",
        members: [
          { steamId: "76561198000000001", name: "Atlas", x: 465, y: 460, isOnline: true, isAlive: true, spawnTime: new Date(now.getTime() - 3_600_000).toISOString(), deathTime: null, isLeader: true },
          { steamId: "76561198000000002", name: "Sable", x: 510, y: 485, isOnline: true, isAlive: true, spawnTime: new Date(now.getTime() - 1_800_000).toISOString(), deathTime: null, isLeader: false },
          { steamId: "76561198000000003", name: "Mako", x: 390, y: 610, isOnline: false, isAlive: false, spawnTime: null, deathTime: new Date(now.getTime() - 900_000).toISOString(), isLeader: false },
        ], mapNotes: [{ type: 0, x: 550, y: 510 }], leaderMapNotes: [],
      },
      teamChat: [
        { id: "mock-chat-1", steamId: "76561198000000002", name: "Sable", message: "Cargo is moving south.", color: "#79b8ff", sentAt: new Date(now.getTime() - 120_000).toISOString() },
        { id: "mock-chat-2", steamId: "76561198000000001", name: "Atlas", message: "Meet at Outpost in five.", color: "#f0b35b", sentAt: new Date(now.getTime() - 45_000).toISOString() },
      ],
      clan: { clanId: "1001", name: "Operations", motd: "Keep comms clear during events.", motdAuthor: "76561198000000001", motdTimestamp: now.toISOString(), color: "-34314", maxMemberCount: 20, roles: [{ roleId: 1, name: "Leader", rank: 0, permissions: 255 }, { roleId: 2, name: "Member", rank: 1, permissions: 1 }], members: [{ steamId: "76561198000000001", roleId: 1, joinedAt: new Date(now.getTime() - 86_400_000 * 30).toISOString(), lastSeenAt: now.toISOString(), notes: "", online: true }], invites: [] },
      clanChat: [{ id: "mock-clan-1", steamId: "76561198000000001", name: "Atlas", message: "Welcome to the command center.", color: null, sentAt: new Date(now.getTime() - 300_000).toISOString() }],
      devices: deviceIds.map((entityId, index) => ({ entityId, kind: index % 3 === 0 ? "alarm" : index % 3 === 1 ? "switch" : "storage", active: index % 2 === 0, capacity: index % 3 === 2 ? 30 : null, hasProtection: index % 3 === 2, protectionExpiry: index % 3 === 2 ? new Date(now.getTime() + 86_400_000).toISOString() : null, items: index % 3 === 2 ? [{ itemId: -1581843485, quantity: 12500, isBlueprint: false }] : [], updatedAt: now.toISOString() })),
    };
  }

  async execute(command: RustPlusCommand): Promise<void> {
    if (!this.connected) throw new Error("Simulation provider is disconnected");
    if (command.type === "camera_open") {
      this.emitter.emit("event", { type: "camera_frame", cameraId: command.cameraId, imageDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwG5WQAAAABJRU5ErkJggg==" } satisfies ProviderEvent);
    }
    this.emitter.emit("event", { type: "data_changed" } satisfies ProviderEvent);
  }

  subscribe(listener: (event: ProviderEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
