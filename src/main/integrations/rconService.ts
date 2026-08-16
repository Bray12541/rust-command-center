import { EventEmitter } from "node:events";
import type { Logger } from "pino";
import WebSocket from "ws";
import type { OwnerMetric, OwnerProfile, RconLine } from "../../shared/contracts/connectedServices";
import { CredentialVault } from "../security/credentialVault";

type RconStatus = "disconnected" | "connecting" | "connected" | "error";

export class RconService extends EventEmitter {
  private readonly clients = new Map<string, WebSocket>();
  private readonly statuses = new Map<string, RconStatus>();
  private readonly lines: RconLine[] = [];
  private readonly metrics: OwnerMetric[] = [];
  private identifier = 1;

  constructor(private readonly vault: CredentialVault, private readonly logger: Logger) { super(); }

  snapshot(): { statuses: Record<string, RconStatus>; lines: RconLine[]; metrics: OwnerMetric[] } {
    return { statuses: Object.fromEntries(this.statuses), lines: this.lines.slice(-500), metrics: this.metrics.slice(-1000) };
  }

  async connect(profile: OwnerProfile): Promise<void> {
    this.disconnect(profile.id);
    const password = this.vault.getSecret(`rcon:${profile.id}`);
    if (!password) throw new Error("Save the RCON password before connecting");
    this.statuses.set(profile.id, "connecting"); this.emit("changed");
    const socket = new WebSocket(`ws://${profile.address}:${profile.port}/${encodeURIComponent(password)}`, { handshakeTimeout: 8_000, maxPayload: 2 * 1024 * 1024 });
    this.clients.set(profile.id, socket);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("RCON connection timed out")), 9_000);
      socket.once("open", () => { clearTimeout(timeout); this.statuses.set(profile.id, "connected"); this.push(profile.id, 0, "system", "RCON connected"); resolve(); });
      socket.once("error", (error) => { clearTimeout(timeout); this.statuses.set(profile.id, "error"); this.push(profile.id, 0, "error", error.message); reject(error); });
    });
    socket.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as { Identifier?: number; Message?: string };
        this.push(profile.id, Number(parsed.Identifier ?? 0), "output", String(parsed.Message ?? ""));
        this.captureMetric(profile.id, String(parsed.Message ?? ""));
      } catch { this.push(profile.id, 0, "output", data.toString()); }
    });
    socket.on("close", () => { if (this.clients.get(profile.id) === socket) this.clients.delete(profile.id); this.statuses.set(profile.id, "disconnected"); this.push(profile.id, 0, "system", "RCON disconnected"); });
  }

  disconnect(profileId: string): void {
    const socket = this.clients.get(profileId); this.clients.delete(profileId);
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "RCC disconnect");
    this.statuses.set(profileId, "disconnected"); this.emit("changed");
  }

  execute(profileId: string, rawCommand: string): number {
    const command = rawCommand.trim();
    if (!command || command.length > 500 || /[\r\n\0]/.test(command)) throw new Error("RCON command is empty or invalid");
    const socket = this.clients.get(profileId);
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Connect this RCON profile first");
    const identifier = this.identifier++;
    socket.send(JSON.stringify({ Identifier: identifier, Message: command, Name: "Rust Command Center" }));
    this.push(profileId, identifier, "input", command.replace(/password\s+\S+/gi, "password ••••••••"));
    return identifier;
  }

  shutdown(): void { for (const id of [...this.clients.keys()]) this.disconnect(id); }

  private push(profileId: string, identifier: number, type: RconLine["type"], message: string): void {
    this.lines.push({ profileId, identifier, type, message: message.slice(0, 20_000), createdAt: new Date().toISOString() });
    if (this.lines.length > 500) this.lines.splice(0, this.lines.length - 500);
    this.logger[type === "error" ? "warn" : "debug"]({ service: "rcon", profileId, type }, "RCON activity");
    this.emit("changed");
  }

  private captureMetric(profileId: string, message: string): void {
    try {
      const raw = JSON.parse(message) as Record<string, unknown>; const lower = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value]));
      if (!("framerate" in lower) && !("uptime" in lower) && !("entitycount" in lower)) return;
      const number = (...keys: string[]) => { const value = keys.map((key) => lower[key]).find((entry) => entry !== undefined); const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
      const memory = number("memory", "memorymb");
      this.metrics.push({ profileId, fps: number("framerate", "fps"), memoryMb: memory != null && memory > 1_000_000 ? memory / 1024 / 1024 : memory, entities: number("entitycount", "entities"), uptimeSeconds: number("uptime", "uptimeseconds"), players: number("players"), createdAt: new Date().toISOString() });
      if (this.metrics.length > 1000) this.metrics.splice(0, this.metrics.length - 1000);
    } catch { /* non-JSON console line */ }
  }
}
