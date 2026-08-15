import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import type { Logger } from "pino";
import type { ChatMessage, Clan, MapMarker, OperationsSnapshot, RustMap, RustPlusCommand, SmartDevice, Team } from "../../shared/contracts/operations";
import type { ServerProfile } from "../../shared/schemas/server";
import type { RustPlusCredentials } from "../security/credentialVault";
import type { ProviderEvent, RustPlusCapabilities, RustPlusProvider } from "./types";

interface CameraClient {
  cameraSubscribeInfo?: { width?: number; height?: number; controlFlags?: number } | null;
  on(event: string, listener: (...args: any[]) => void): void;
  subscribe(): Promise<void>;
  unsubscribe(): Promise<void>;
  move(buttons: number, x: number, y: number): Promise<unknown>;
  zoom(): Promise<void>;
}

interface RustPlusClient {
  on(event: string, listener: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  connect(): void;
  disconnect(): void;
  sendRequestAsync(request: Record<string, unknown>, timeoutMs?: number): Promise<any>;
  getCamera(identifier: string): CameraClient;
}

type RustPlusConstructor = new (address: string, port: number | string, playerId: string, playerToken: number) => RustPlusClient;

const LIVE_CAPABILITIES: RustPlusCapabilities = {
  serverInfo: true, rustTime: true, teamInfo: true, teamChat: true,
  map: true, mapMarkers: true, smartDevices: true, cameras: true,
};

const requireFromMain = createRequire(__filename);
const markerTypes: Record<number, MapMarker["type"]> = {
  1: "player", 2: "explosion", 3: "vending", 4: "ch47", 5: "cargo",
  6: "crate", 7: "radius", 8: "patrol-heli",
};
const deviceTypes: Record<number, SmartDevice["kind"]> = { 1: "switch", 2: "alarm", 3: "storage" };

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value && typeof (value as { toString?: () => string }).toString === "function") return String(value);
  return fallback;
}

function finite(value: unknown, fallback = 0): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function dateFromEpoch(value: unknown): string | null {
  const epoch = finite(value);
  if (epoch <= 0) return null;
  return new Date(epoch > 1_000_000_000_000 ? epoch : epoch * 1000).toISOString();
}

function normalizeChat(input: any): ChatMessage[] {
  return (input?.messages ?? []).map((message: any, index: number) => {
    const sentAt = dateFromEpoch(message.time) ?? new Date().toISOString();
    const steamId = text(message.steamId, "0");
    return {
      id: `${steamId}-${sentAt}-${index}`,
      steamId,
      name: text(message.name, "Unknown"),
      message: text(message.message),
      color: typeof message.color === "string" ? message.color : null,
      sentAt,
    };
  });
}

function normalizeTeam(input: any): Team | null {
  if (!input) return null;
  const leaderSteamId = input.leaderSteamId == null ? null : text(input.leaderSteamId);
  return {
    leaderSteamId,
    members: (input.members ?? []).map((member: any) => {
      const steamId = text(member.steamId, "0");
      return {
        steamId, name: text(member.name, "Unknown"), x: finite(member.x), y: finite(member.y),
        isOnline: Boolean(member.isOnline), isAlive: Boolean(member.isAlive),
        spawnTime: dateFromEpoch(member.spawnTime), deathTime: dateFromEpoch(member.deathTime),
        isLeader: leaderSteamId === steamId,
      };
    }),
    mapNotes: (input.mapNotes ?? []).map((note: any) => ({ type: Math.trunc(finite(note.type)), x: finite(note.x), y: finite(note.y) })),
    leaderMapNotes: (input.leaderMapNotes ?? []).map((note: any) => ({ type: Math.trunc(finite(note.type)), x: finite(note.x), y: finite(note.y) })),
  };
}

function normalizeClan(input: any): Clan | null {
  const clan = input?.clanInfo ?? input;
  if (!clan || !clan.clanId) return null;
  return {
    clanId: text(clan.clanId), name: text(clan.name), motd: text(clan.motd),
    motdAuthor: clan.motdAuthor == null ? null : text(clan.motdAuthor),
    motdTimestamp: dateFromEpoch(clan.motdTimestamp),
    color: clan.color == null ? null : String(clan.color),
    maxMemberCount: Math.max(0, Math.trunc(finite(clan.maxMemberCount))),
    roles: (clan.roles ?? []).map((role: any) => ({
      roleId: Math.trunc(finite(role.roleId)), name: text(role.name), rank: Math.trunc(finite(role.rank)),
      permissions: ["canSetMotd", "canSetLogo", "canInvite", "canKick", "canPromote", "canDemote", "canSetPlayerNotes", "canAccessLogs"]
        .reduce((mask, key, index) => mask | (role[key] ? 1 << index : 0), 0),
    })),
    members: (clan.members ?? []).map((member: any) => ({
      steamId: text(member.steamId), roleId: Math.trunc(finite(member.roleId)),
      joinedAt: dateFromEpoch(member.joined), lastSeenAt: dateFromEpoch(member.lastSeen),
      notes: text(member.notes), online: Boolean(member.online),
    })),
    invites: (clan.invites ?? []).map((invite: any) => ({
      steamId: text(invite.steamId), recruiter: text(invite.recruiter), createdAt: dateFromEpoch(invite.timestamp),
    })),
  };
}

export class LiveRustPlusProvider implements RustPlusProvider {
  readonly kind = "live" as const;
  readonly capabilities = LIVE_CAPABILITIES;
  private readonly emitter = new EventEmitter();
  private readonly client: RustPlusClient;
  private connected = false;
  private mapCache: RustMap | null = null;
  private readonly deviceCache = new Map<number, SmartDevice>();
  private camera: CameraClient | null = null;
  private cameraId: string | null = null;
  private requestTokens = 25;
  private lastTokenRefill = Date.now();
  private requestTail: Promise<void> = Promise.resolve();

  constructor(private readonly server: ServerProfile, credentials: RustPlusCredentials, private readonly logger: Logger) {
    const RustPlus = requireFromMain("@rustwirebot/rustplus.js") as RustPlusConstructor;
    this.client = new RustPlus(server.address, server.port, credentials.playerId, Number(credentials.playerToken));
    this.client.on("message", (message: any) => {
      this.emitter.emit("event", { type: "packet" } satisfies ProviderEvent);
      if (message?.broadcast?.entityChanged) this.cacheEntity(message.broadcast.entityChanged.entityId, { payload: message.broadcast.entityChanged.payload });
      if (message?.broadcast?.teamChanged || message?.broadcast?.teamMessage || message?.broadcast?.entityChanged || message?.broadcast?.clanChanged || message?.broadcast?.clanMessage) {
        this.emitter.emit("event", { type: "data_changed" } satisfies ProviderEvent);
      }
    });
    this.client.on("disconnected", () => {
      this.connected = false;
      this.emitter.emit("event", { type: "disconnected", reason: "Remote server closed the connection" } satisfies ProviderEvent);
    });
    this.client.on("error", (error: Error) => this.emitter.emit("event", { type: "error", error } satisfies ProviderEvent));
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); reject(new Error("Rust+ connection timed out")); }, 12_000);
      const onConnected = () => { cleanup(); this.connected = true; this.emitter.emit("event", { type: "connected" } satisfies ProviderEvent); resolve(); };
      const onError = (error: Error) => { cleanup(); reject(error); };
      const cleanup = () => { clearTimeout(timeout); this.client.off("connected", onConnected); this.client.off("error", onError); };
      this.client.once("connected", onConnected); this.client.once("error", onError);
      this.logger.info({ service: "rustplus", serverId: this.server.id, operation: "connect" }, "Connecting to Rust+");
      this.client.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (this.camera) await this.camera.unsubscribe().catch(() => undefined);
    this.camera = null; this.cameraId = null;
    if (this.connected) this.client.disconnect();
    this.connected = false;
  }

  async getServerTelemetry() {
    const startedAt = performance.now();
    const [infoResponse, timeResponse] = await Promise.all([
      this.request({ getInfo: {} }),
      this.request({ getTime: {} }).catch(() => ({ time: null })),
    ]);
    const info = infoResponse.info ?? {};
    const time = timeResponse.time ?? {};
    const timeDecimal = Number.isFinite(Number(time.time)) ? Number(time.time) : null;
    const rustTime = timeDecimal == null ? null : `${Math.floor(timeDecimal % 24).toString().padStart(2, "0")}:${Math.floor((timeDecimal % 1) * 60).toString().padStart(2, "0")}`;
    const latencyMs = Math.round(performance.now() - startedAt);
    return {
      name: typeof info.name === "string" ? info.name : null,
      players: Number.isInteger(info.players) ? info.players : null,
      maxPlayers: Number.isInteger(info.maxPlayers) && info.maxPlayers > 0 ? info.maxPlayers : null,
      queuedPlayers: Number.isInteger(info.queuedPlayers) ? info.queuedPlayers : null,
      mapSize: Number.isInteger(info.mapSize) && info.mapSize > 0 ? info.mapSize : null,
      mapName: typeof info.map === "string" ? info.map : null,
      mapSeed: Number.isInteger(info.seed) ? info.seed : null,
      headerImage: typeof info.headerImage === "string" && info.headerImage ? info.headerImage : null,
      logoImage: typeof info.logoImage === "string" && info.logoImage ? info.logoImage : null,
      websiteUrl: typeof info.url === "string" && /^https?:\/\//i.test(info.url) ? info.url : null,
      wipeTime: dateFromEpoch(info.wipeTime), rustTime, rustTimeDecimal: timeDecimal,
      sunrise: Number.isFinite(Number(time.sunrise)) ? Number(time.sunrise) : null,
      sunset: Number.isFinite(Number(time.sunset)) ? Number(time.sunset) : null,
      dayLengthMinutes: Number(time.dayLengthMinutes) > 0 ? Number(time.dayLengthMinutes) : null,
      latencyMs, connectedAt: null, reconnectCount: 0,
      connectionQuality: latencyMs < 90 ? "excellent" as const : latencyMs < 180 ? "good" as const : latencyMs < 350 ? "fair" as const : "poor" as const,
      source: "live" as const,
    };
  }

  async getOperationsSnapshot(deviceIds: number[]): Promise<Omit<OperationsSnapshot, "serverId" | "observedAt">> {
    const requests: Promise<any>[] = [
      this.request({ getMapMarkers: {} }).catch(() => ({ mapMarkers: { markers: [] } })),
      this.request({ getTeamInfo: {} }).catch(() => ({ teamInfo: null })),
      this.request({ getTeamChat: {} }).catch(() => ({ teamChat: { messages: [] } })),
      this.request({ getClanInfo: {} }).catch(() => ({ clanInfo: null })),
      this.request({ getClanChat: {} }).catch(() => ({ clanChat: { messages: [] } })),
    ];
    if (!this.mapCache) requests.push(this.request({ getMap: {} }, 5).catch(() => ({ map: null })));
    const [markerResponse, teamResponse, teamChatResponse, clanResponse, clanChatResponse, mapResponse] = await Promise.all(requests);
    if (!this.mapCache && mapResponse?.map?.jpgImage && mapResponse.map.width > 0 && mapResponse.map.height > 0) {
      this.mapCache = {
        width: mapResponse.map.width, height: mapResponse.map.height,
        oceanMargin: Math.max(0, finite(mapResponse.map.oceanMargin)),
        imageDataUrl: `data:image/jpeg;base64,${Buffer.from(mapResponse.map.jpgImage).toString("base64")}`,
        monuments: (mapResponse.map.monuments ?? []).map((monument: any) => ({ token: text(monument.token), x: finite(monument.x), y: finite(monument.y) })),
      };
    }
    await Promise.all(deviceIds.slice(0, 10).map((entityId) => this.refreshEntity(entityId).catch(() => undefined)));
    const markers: MapMarker[] = (markerResponse?.mapMarkers?.markers ?? []).map((marker: any) => ({
      id: text(marker.id), type: markerTypes[finite(marker.type)] ?? "unknown", x: finite(marker.x), y: finite(marker.y),
      rotation: Number.isFinite(Number(marker.rotation)) ? Number(marker.rotation) : null,
      radius: Number.isFinite(Number(marker.radius)) ? Number(marker.radius) : null,
      name: typeof marker.name === "string" && marker.name ? marker.name : null,
      outOfStock: Boolean(marker.outOfStock),
      sellOrders: (marker.sellOrders ?? []).map((order: any) => ({
        itemId: Math.trunc(finite(order.itemId)), quantity: Math.max(0, Math.trunc(finite(order.quantity))),
        currencyId: Math.trunc(finite(order.currencyId)), costPerItem: Math.max(0, Math.trunc(finite(order.costPerItem))),
        amountInStock: Math.max(0, Math.trunc(finite(order.amountInStock))), itemIsBlueprint: Boolean(order.itemIsBlueprint), currencyIsBlueprint: Boolean(order.currencyIsBlueprint),
      })),
    }));
    return {
      map: this.mapCache, markers, team: normalizeTeam(teamResponse?.teamInfo),
      teamChat: normalizeChat(teamChatResponse?.teamChat), clan: normalizeClan(clanResponse?.clanInfo),
      clanChat: normalizeChat(clanChatResponse?.clanChat), devices: [...this.deviceCache.values()],
    };
  }

  async execute(command: RustPlusCommand): Promise<void> {
    switch (command.type) {
      case "send_team_message": await this.request({ sendTeamMessage: { message: command.message } }, 2); break;
      case "send_clan_message": await this.request({ sendClanMessage: { message: command.message } }, 2); break;
      case "set_clan_motd": await this.request({ setClanMotd: { message: command.message } }); break;
      case "promote_to_leader": await this.request({ promoteToLeader: { steamId: command.steamId } }); break;
      case "set_entity_value":
        await this.request({ entityId: command.entityId, setEntityValue: { value: command.value } });
        await this.refreshEntity(command.entityId); break;
      case "refresh_entity": await this.refreshEntity(command.entityId); break;
      case "camera_open": await this.openCamera(command.cameraId); break;
      case "camera_close": if (this.camera) await this.camera.unsubscribe(); this.camera = null; this.cameraId = null; break;
      case "camera_move": if (!this.camera) throw new Error("Open a camera first"); await this.camera.move(0, command.x, command.y); break;
      case "camera_zoom": if (!this.camera) throw new Error("Open a camera first"); await this.camera.zoom(); break;
    }
    this.emitter.emit("event", { type: "data_changed" } satisfies ProviderEvent);
  }

  subscribe(listener: (event: ProviderEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  private async refreshEntity(entityId: number): Promise<void> {
    const response = await this.request({ entityId, getEntityInfo: {} });
    this.cacheEntity(entityId, response.entityInfo);
  }

  private cacheEntity(entityId: unknown, entityInfo: any): void {
    const id = Math.trunc(finite(entityId));
    if (id <= 0 || !entityInfo?.payload) return;
    const payload = entityInfo.payload;
    this.deviceCache.set(id, {
      entityId: id, kind: deviceTypes[finite(entityInfo.type)] ?? this.deviceCache.get(id)?.kind ?? "unknown",
      active: Boolean(payload.value), capacity: Number.isInteger(payload.capacity) ? payload.capacity : null,
      hasProtection: typeof payload.hasProtection === "boolean" ? payload.hasProtection : null,
      protectionExpiry: dateFromEpoch(payload.protectionExpiry),
      items: (payload.items ?? []).map((item: any) => ({ itemId: Math.trunc(finite(item.itemId)), quantity: Math.max(0, Math.trunc(finite(item.quantity))), isBlueprint: Boolean(item.itemIsBlueprint) })),
      updatedAt: new Date().toISOString(),
    });
  }

  private async openCamera(cameraId: string): Promise<void> {
    if (this.camera) await this.camera.unsubscribe().catch(() => undefined);
    const camera = this.client.getCamera(cameraId);
    this.camera = camera; this.cameraId = cameraId;
    camera.on("render", (frame: Buffer) => {
      this.emitter.emit("event", { type: "camera_frame", cameraId, imageDataUrl: `data:image/png;base64,${frame.toString("base64")}` } satisfies ProviderEvent);
    });
    await camera.subscribe();
  }

  private request<T = any>(payload: Record<string, unknown>, cost = 1): Promise<T> {
    const run = async (): Promise<T> => {
      while (true) {
        const now = Date.now();
        this.requestTokens = Math.min(25, this.requestTokens + ((now - this.lastTokenRefill) / 1000) * 3);
        this.lastTokenRefill = now;
        if (this.requestTokens >= cost) break;
        await new Promise((resolve) => setTimeout(resolve, Math.ceil(((cost - this.requestTokens) / 3) * 1000)));
      }
      this.requestTokens -= cost;
      return await this.client.sendRequestAsync(payload) as T;
    };
    const result = this.requestTail.then(run, run);
    this.requestTail = result.then(() => undefined, () => undefined);
    return result;
  }
}
