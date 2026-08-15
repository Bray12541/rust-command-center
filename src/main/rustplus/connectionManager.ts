import type { Logger } from "pino";
import type { ServerTelemetry } from "../../shared/contracts/app";
import type { OperationsSnapshot, RustPlusCommand } from "../../shared/contracts/operations";
import { AppEventBus } from "../../shared/events/eventBus";
import type { ServerProfile } from "../../shared/schemas/server";
import { ServerRepository } from "../repositories/serverRepository";
import { WorkspaceRepository } from "../repositories/workspaceRepository";
import { CredentialVault } from "../security/credentialVault";
import type { ProviderEvent, RustPlusProvider, RustPlusProviderFactory } from "./types";

interface Session {
  provider: RustPlusProvider;
  unsubscribe: () => void;
  manualDisconnect: boolean;
  reconnectAttempt: number;
  reconnectTimer: NodeJS.Timeout | null;
  heartbeatTimer: NodeJS.Timeout | null;
}

export class RustPlusConnectionManager {
  private readonly sessions = new Map<string, Session>();
  private readonly telemetry = new Map<string, ServerTelemetry>();
  private readonly reconnectAttempts = new Map<string, number>();
  private readonly operations = new Map<string, OperationsSnapshot>();
  private readonly connectedAt = new Map<string, string>();
  private readonly refreshingOperations = new Set<string>();
  private readonly refreshDebounce = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly servers: ServerRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly vault: CredentialVault,
    private readonly providerFactory: RustPlusProviderFactory,
    private readonly events: AppEventBus,
    private readonly logger: Logger,
    private readonly options: { heartbeatMs?: number; maximumReconnectMs?: number } = {},
  ) {}

  async restore(): Promise<void> {
    const candidates = this.servers.list().filter((server) => server.autoConnect && !server.archived);
    await Promise.allSettled(candidates.map((server) => this.connect(server.id)));
  }

  async connect(serverId: string): Promise<ServerProfile> {
    const server = this.requireServer(serverId);
    const existing = this.sessions.get(serverId);
    if (existing && ["CONNECTING", "AUTHENTICATING", "CONNECTED", "RECONNECTING"].includes(server.status)) {
      return server;
    }
    this.clearSession(serverId);

    const credentials = this.vault.get(serverId);
    if (!credentials) return this.setStatus(serverId, "ERROR", "Pairing credentials are unavailable or could not be decrypted");

    const provider = this.providerFactory.create(server, credentials);
    const session: Session = {
      provider,
      unsubscribe: () => undefined,
      manualDisconnect: false,
      reconnectAttempt: this.reconnectAttempts.get(serverId) ?? existing?.reconnectAttempt ?? 0,
      reconnectTimer: null,
      heartbeatTimer: null,
    };
    session.unsubscribe = provider.subscribe((event) => this.onProviderEvent(serverId, event));
    this.sessions.set(serverId, session);
    this.setStatus(serverId, session.reconnectAttempt > 0 ? "RECONNECTING" : "CONNECTING");

    try {
      await provider.connect();
      this.setStatus(serverId, "AUTHENTICATING");
      await this.refreshTelemetry(serverId);
      await this.refreshOperations(serverId);
      session.reconnectAttempt = 0;
      this.reconnectAttempts.delete(serverId);
      this.setStatus(serverId, "CONNECTED");
      this.connectedAt.set(serverId, new Date().toISOString());
      this.startHeartbeat(serverId);
      return this.requireServer(serverId);
    } catch (error) {
      const reason = this.describeError(error);
      this.logger.warn({ service: "rustplus", serverId, operation: "connect", error }, "Rust+ connection failed");
      this.setStatus(serverId, "ERROR", reason);
      this.scheduleReconnect(serverId);
      return this.requireServer(serverId);
    }
  }

  async disconnect(serverId: string): Promise<ServerProfile> {
    const session = this.sessions.get(serverId);
    if (session) {
      session.manualDisconnect = true;
      await session.provider.disconnect();
    }
    this.clearSession(serverId);
    return this.setStatus(serverId, "DISCONNECTED", "Disconnected by user");
  }

  async remove(serverId: string): Promise<void> {
    const session = this.sessions.get(serverId);
    if (session) await this.disconnect(serverId);
    this.telemetry.delete(serverId);
    this.operations.delete(serverId);
    this.connectedAt.delete(serverId);
    this.workspaces.delete(serverId);
    this.vault.delete(serverId);
    this.servers.delete(serverId);
  }

  getTelemetry(serverId: string): ServerTelemetry | null {
    return this.telemetry.get(serverId) ?? null;
  }

  getOperations(serverId: string): OperationsSnapshot | null {
    return this.operations.get(serverId) ?? null;
  }

  async execute(serverId: string, command: RustPlusCommand): Promise<void> {
    const session = this.sessions.get(serverId);
    if (!session || this.requireServer(serverId).status !== "CONNECTED") throw new Error("Connect the server before sending commands");
    await session.provider.execute(command);
    if (!command.type.startsWith("camera_")) await this.refreshOperations(serverId);
  }

  async shutdown(): Promise<void> {
    await Promise.allSettled([...this.sessions.keys()].map((id) => this.disconnect(id)));
  }

  private async refreshTelemetry(serverId: string): Promise<void> {
    const session = this.sessions.get(serverId);
    if (!session) return;
    const observed = await session.provider.getServerTelemetry();
    const telemetry: ServerTelemetry = {
      ...observed,
      serverId,
      connectedAt: this.connectedAt.get(serverId) ?? observed.connectedAt,
      reconnectCount: this.reconnectAttempts.get(serverId) ?? session.reconnectAttempt,
      observedAt: new Date().toISOString(),
    };
    this.telemetry.set(serverId, telemetry);
    this.servers.touchPacket(serverId);
    this.events.publish({ type: "server.telemetry", telemetry, timestamp: telemetry.observedAt });
  }

  private async refreshOperations(serverId: string): Promise<void> {
    const session = this.sessions.get(serverId);
    if (!session || this.refreshingOperations.has(serverId)) return;
    this.refreshingOperations.add(serverId);
    try {
      const workspace = this.workspaces.get(serverId);
      const observed = await session.provider.getOperationsSnapshot(workspace.devices.map((device) => device.entityId));
      const snapshot: OperationsSnapshot = { ...observed, serverId, observedAt: new Date().toISOString() };
      this.operations.set(serverId, snapshot);
      this.events.publish({ type: "server.operations", snapshot, timestamp: snapshot.observedAt });
    } finally {
      this.refreshingOperations.delete(serverId);
    }
  }

  private onProviderEvent(serverId: string, event: ProviderEvent): void {
    if (event.type === "packet") {
      this.servers.touchPacket(serverId);
      return;
    }
    if (event.type === "data_changed") {
      const existing = this.refreshDebounce.get(serverId);
      if (existing) clearTimeout(existing);
      this.refreshDebounce.set(serverId, setTimeout(() => {
        this.refreshDebounce.delete(serverId);
        void this.refreshOperations(serverId).catch((error) => this.logger.debug({ service: "rustplus", serverId, error }, "Operations refresh failed"));
      }, 500));
      return;
    }
    if (event.type === "camera_frame") {
      this.events.publish({ type: "camera.frame", serverId, cameraId: event.cameraId, imageDataUrl: event.imageDataUrl, timestamp: new Date().toISOString() });
      return;
    }
    if (event.type === "error") {
      this.logger.warn({ service: "rustplus", serverId, error: event.error }, "Rust+ provider error");
      return;
    }
    if (event.type === "disconnected") {
      const session = this.sessions.get(serverId);
      if (!session || session.manualDisconnect) return;
      this.setStatus(serverId, "DISCONNECTED", event.reason ?? "Connection closed");
      this.scheduleReconnect(serverId);
    }
  }

  private startHeartbeat(serverId: string): void {
    const session = this.sessions.get(serverId);
    if (!session) return;
    if (session.heartbeatTimer) clearInterval(session.heartbeatTimer);
    session.heartbeatTimer = setInterval(() => {
      void this.refreshTelemetry(serverId).catch((error) => {
        this.logger.warn({ service: "rustplus", serverId, operation: "heartbeat", error }, "Rust+ heartbeat failed");
        this.setStatus(serverId, "STALE", this.describeError(error));
        this.scheduleReconnect(serverId);
      });
      void this.refreshOperations(serverId).catch((error) => {
        this.logger.debug({ service: "rustplus", serverId, operation: "operations-heartbeat", error }, "Operations heartbeat failed");
      });
    }, this.options.heartbeatMs ?? 30_000);
  }

  private scheduleReconnect(serverId: string): void {
    const session = this.sessions.get(serverId);
    if (!session || session.manualDisconnect || session.reconnectTimer) return;
    session.reconnectAttempt += 1;
    const ceiling = this.options.maximumReconnectMs ?? 5 * 60_000;
    const base = Math.min(1_000 * 2 ** Math.min(session.reconnectAttempt, 8), ceiling);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.setStatus(serverId, "RECONNECTING", `Retrying in ${Math.ceil(delay / 1000)} seconds`);
    session.reconnectTimer = setTimeout(() => {
      session.reconnectTimer = null;
      this.reconnectAttempts.set(serverId, session.reconnectAttempt);
      this.clearSession(serverId);
      void this.connect(serverId);
    }, delay);
  }

  private clearSession(serverId: string): void {
    const session = this.sessions.get(serverId);
    if (!session) return;
    if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
    if (session.heartbeatTimer) clearInterval(session.heartbeatTimer);
    const debounce = this.refreshDebounce.get(serverId);
    if (debounce) clearTimeout(debounce);
    this.refreshDebounce.delete(serverId);
    session.unsubscribe();
    session.manualDisconnect = true;
    void session.provider.disconnect().catch(() => undefined);
    this.sessions.delete(serverId);
  }

  private setStatus(serverId: string, status: ServerProfile["status"], reason: string | null = null): ServerProfile {
    const server = this.servers.updateStatus(serverId, status, { reason });
    this.events.publish({ type: "server.status_changed", server, timestamp: new Date().toISOString() });
    return server;
  }

  private requireServer(serverId: string): ServerProfile {
    const server = this.servers.get(serverId);
    if (!server) throw new Error("Server profile not found");
    return server;
  }

  private describeError(error: unknown): string {
    if (!(error instanceof Error)) return "Unknown Rust+ error";
    if (/timed out/i.test(error.message)) return "Rust+ server did not respond before the timeout";
    if (/auth|token|permission/i.test(error.message)) return "Rust+ authentication failed; repair this server's pairing";
    if (/ENOTFOUND|EAI_AGAIN/i.test(error.message)) return "Server address could not be resolved";
    if (/ECONNREFUSED/i.test(error.message)) return "Rust+ server refused the connection";
    return error.message.slice(0, 180);
  }
}
