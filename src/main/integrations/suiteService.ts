import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Logger } from "pino";
import {
  connectedServicesConfigSchema, installedExtensionSchema, serverOwnerConfigSchema, suiteStateSchema,
  type ConnectedServicesConfig, type InstalledExtension, type OwnerProfile, type ServerOwnerConfig, type SuiteState,
} from "../../shared/contracts/connectedServices";
import { workspaceDocumentSchema } from "../../shared/contracts/operations";
import type { ServerRepository } from "../repositories/serverRepository";
import type { SettingsRepository } from "../repositories/settingsRepository";
import type { SuiteRepository } from "../repositories/suiteRepository";
import type { WorkspaceRepository } from "../repositories/workspaceRepository";
import type { RustPlusConnectionManager } from "../rustplus/connectionManager";
import { CredentialVault } from "../security/credentialVault";
import { DiscordService } from "./discordService";
import { ExtensionManager } from "./extensionManager";
import { LocalGatewayService } from "./localGatewayService";
import { RconService } from "./rconService";

type ServiceName = "discord" | "shared-workspace" | "telemetry" | "mobile" | "bridge";

export class SuiteService {
  readonly rcon: RconService;
  private readonly discord: DiscordService;
  private readonly gateway: LocalGatewayService;
  private readonly extensions: ExtensionManager;
  private scheduler: NodeJS.Timeout | null = null;
  private readonly syncTimers = new Map<string, NodeJS.Timeout>();
  private readonly crashListener = (error: Error) => { void this.report("main_process_error", { name: error.name, message: sanitizeMessage(error.message), stack: sanitizeStack(error.stack) }, true); };
  private readonly rejectionListener = (reason: unknown) => { const error = reason instanceof Error ? reason : new Error(String(reason)); void this.report("unhandled_rejection", { name: error.name, message: sanitizeMessage(error.message), stack: sanitizeStack(error.stack) }, true); };

  constructor(
    private readonly repository: SuiteRepository, private readonly servers: ServerRepository, private readonly settings: SettingsRepository,
    private readonly workspaces: WorkspaceRepository, private readonly connections: RustPlusConnectionManager,
    private readonly vault: CredentialVault, userDataPath: string, private readonly logger: Logger,
  ) {
    this.rcon = new RconService(vault, logger);
    this.extensions = new ExtensionManager(userDataPath);
    this.discord = new DiscordService(vault, logger, () => this.discordStatus());
    this.gateway = new LocalGatewayService(vault, logger, () => this.mobileSummary());
  }

  async start(): Promise<void> {
    const connected = this.repository.getConnected(); const owner = this.repository.getOwner();
    try { await this.discord.configure(connected.discord); } catch (error) { this.logger.warn({ service: "discord", error }, "Discord start failed"); }
    try { await this.gateway.configureMobile(connected.mobileDashboard); } catch (error) { this.logger.warn({ service: "mobile", error }, "Mobile dashboard start failed"); }
    try { await this.gateway.configureBridge({ ...owner.bridge, enabled: owner.enabled && owner.bridge.enabled }); } catch (error) { this.logger.warn({ service: "owner-bridge", error }, "Owner bridge start failed"); }
    for (const profile of owner.enabled ? owner.profiles.filter((item) => item.autoConnect) : []) void this.rcon.connect(profile).catch(() => undefined);
    this.scheduler = setInterval(() => void this.runSchedules(), 15_000);
    process.on("uncaughtExceptionMonitor", this.crashListener); process.on("unhandledRejection", this.rejectionListener);
    void this.report("app_started", { platform: process.platform, version: process.versions.electron }, false);
  }

  snapshot(): SuiteState {
    const rcon = this.rcon.snapshot(); const gateway = this.gateway.snapshot();
    return suiteStateSchema.parse({ connected: this.repository.getConnected(), owner: this.repository.getOwner(), extensions: this.extensions.list(), rconStatuses: rcon.statuses, rconLines: rcon.lines, ownerMetrics: rcon.metrics, ownerEvents: gateway.events, mobileUrl: gateway.mobileUrl, bridgeUrl: gateway.bridgeUrl });
  }

  async saveConnected(config: ConnectedServicesConfig, secrets: Record<string, string | undefined>): Promise<SuiteState> {
    const parsed = connectedServicesConfigSchema.parse(config);
    this.storeSecret("discord-token", secrets.discordToken);
    this.storeSecret("profile-passphrase", secrets.profilePassphrase);
    this.storeSecret("shared-workspace-token", secrets.sharedWorkspaceToken);
    this.storeSecret("telemetry-token", secrets.telemetryToken);
    if (secrets.mobileToken) this.storeSecret("mobile-token", secrets.mobileToken);
    if (parsed.mobileDashboard.enabled && !this.vault.getSecret("mobile-token")) this.vault.saveSecret("mobile-token", crypto.randomBytes(24).toString("base64url"));
    parsed.discord.hasToken = Boolean(this.vault.getSecret("discord-token")); parsed.profileSync.hasPassphrase = Boolean(this.vault.getSecret("profile-passphrase"));
    parsed.sharedWorkspace.hasToken = Boolean(this.vault.getSecret("shared-workspace-token")); parsed.telemetry.hasToken = Boolean(this.vault.getSecret("telemetry-token")); parsed.mobileDashboard.hasToken = Boolean(this.vault.getSecret("mobile-token"));
    this.repository.saveConnected(parsed);
    await this.discord.configure(parsed.discord); await this.gateway.configureMobile(parsed.mobileDashboard);
    return this.snapshot();
  }

  async saveOwner(config: ServerOwnerConfig, passwords: Record<string, string>, bridgeToken?: string): Promise<SuiteState> {
    const parsed = serverOwnerConfigSchema.parse(config);
    for (const [id, value] of Object.entries(passwords)) this.storeSecret(`rcon:${id}`, value);
    if (bridgeToken) this.storeSecret("owner-bridge-token", bridgeToken);
    if (parsed.bridge.enabled && !this.vault.getSecret("owner-bridge-token")) this.vault.saveSecret("owner-bridge-token", crypto.randomBytes(24).toString("base64url"));
    parsed.profiles = parsed.profiles.map((profile) => ({ ...profile, hasPassword: Boolean(this.vault.getSecret(`rcon:${profile.id}`)) }));
    parsed.bridge.hasToken = Boolean(this.vault.getSecret("owner-bridge-token"));
    this.repository.saveOwner(parsed); await this.gateway.configureBridge({ ...parsed.bridge, enabled: parsed.enabled && parsed.bridge.enabled }); return this.snapshot();
  }

  async testService(service: ServiceName): Promise<string> {
    const config = this.repository.getConnected();
    if (service === "discord") return this.discord.test(config.discord);
    if (service === "mobile") { await this.gateway.configureMobile({ ...config.mobileDashboard, enabled: true }); return this.gateway.snapshot().mobileUrl ?? "Mobile dashboard started"; }
    if (service === "bridge") { const owner = this.repository.getOwner(); await this.gateway.configureBridge({ ...owner.bridge, enabled: true }); return this.gateway.snapshot().bridgeUrl ?? "Bridge started"; }
    if (service === "shared-workspace") { const response = await this.sharedRequest("HEAD", config, null); return `Workspace endpoint returned HTTP ${response.status}`; }
    const endpoint = config.telemetry.endpointUrl; if (!endpoint) throw new Error("Enter an HTTPS telemetry endpoint first");
    const response = await this.fetchAuthorized(endpoint, this.vault.getSecret("telemetry-token"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "connection_test", app: "rust-command-center", timestamp: new Date().toISOString() }) });
    if (!response.ok) throw new Error(`Telemetry endpoint returned HTTP ${response.status}`); return "Sanitized test event accepted";
  }

  async profileSync(direction: "push" | "pull"): Promise<string> {
    const config = this.repository.getConnected(); const passphrase = this.vault.getSecret("profile-passphrase");
    if (!config.profileSync.enabled) throw new Error("Enable encrypted profile sync first");
    if (!config.profileSync.folderPath || !passphrase) throw new Error("Choose a sync folder and save a passphrase first");
    await fs.mkdir(config.profileSync.folderPath, { recursive: true }); const file = path.join(config.profileSync.folderPath, "rust-command-center-profile.rccsync");
    if (direction === "push") {
      const payload = { format: "rcc-encrypted-profile", version: 1, createdAt: new Date().toISOString(), settings: this.settings.get(), connected: config, servers: this.servers.list(true).filter((server) => server.provider === "live").map((server) => ({ profile: server, credentials: this.vault.get(server.id), workspace: this.workspaces.get(server.id) })) };
      const temporary = `${file}.tmp`; await fs.writeFile(temporary, JSON.stringify(encryptJson(payload, passphrase)), { encoding: "utf8", mode: 0o600 }); await fs.rename(temporary, file);
    } else {
      const payload = decryptJson(JSON.parse(await fs.readFile(file, "utf8")), passphrase) as { settings?: unknown; servers?: Array<{ profile?: Record<string, unknown>; credentials?: { playerId: string; playerToken: string }; workspace?: unknown }> };
      for (const record of payload.servers ?? []) {
        const profile = record.profile; if (!profile || typeof profile.id !== "string" || typeof profile.name !== "string" || typeof profile.address !== "string" || typeof profile.port !== "number") continue;
        if (!this.servers.get(profile.id)) this.servers.create({ id: profile.id, name: profile.name, address: profile.address, port: profile.port, provider: "live", favorite: Boolean(profile.favorite), autoConnect: false });
        if (record.credentials) this.vault.save(profile.id, record.credentials);
        const workspace = workspaceDocumentSchema.safeParse(record.workspace); if (workspace.success) this.workspaces.save(profile.id, workspace.data);
      }
    }
    config.profileSync.lastSyncAt = new Date().toISOString(); this.repository.saveConnected(config); return direction === "push" ? `Encrypted profile saved to ${file}` : `Encrypted profile restored from ${file}`;
  }

  async sharedWorkspaceSync(direction: "push" | "pull", serverId: string): Promise<string> {
    const config = this.repository.getConnected();
    if (!config.sharedWorkspace.enabled) throw new Error("Enable shared team workspaces first");
    if (direction === "push") { const response = await this.sharedRequest("PUT", config, { format: "rcc-shared-workspace", version: 1, workspace: this.workspaces.get(serverId), updatedAt: new Date().toISOString() }); if (!response.ok) throw new Error(`Workspace service returned HTTP ${response.status}`); }
    else { const response = await this.sharedRequest("GET", config, null); if (!response.ok) throw new Error(`Workspace service returned HTTP ${response.status}`); const raw = await response.json() as { workspace?: unknown }; this.workspaces.save(serverId, workspaceDocumentSchema.parse(raw.workspace ?? raw)); }
    config.sharedWorkspace.lastSyncAt = new Date().toISOString(); this.repository.saveConnected(config); return direction === "push" ? "Shared workspace uploaded" : "Shared workspace downloaded";
  }

  async sendDiscord(message: string): Promise<void> { await this.discord.sendAlert(message); }
  notifyServerStatus(name: string, status: string): void {
    void this.report("server_status", { status }, false);
    if (this.repository.getConnected().discord.enabled) void this.discord.sendAlert(`**${name}** is now **${status.toLowerCase().replaceAll("_", " ")}**.`).catch((error) => this.logger.debug({ service: "discord", error }, "Discord status alert skipped"));
  }

  maybeAutoSync(serverId: string): void {
    const config = this.repository.getConnected(); if (!config.profileSync.autoSync && !config.sharedWorkspace.autoSync) return;
    const previous = this.syncTimers.get(serverId); if (previous) clearTimeout(previous);
    this.syncTimers.set(serverId, setTimeout(() => { this.syncTimers.delete(serverId); if (config.profileSync.autoSync) void this.profileSync("push").catch((error) => this.logger.warn({ service: "profile-sync", error }, "Automatic profile sync failed")); if (config.sharedWorkspace.autoSync) void this.sharedWorkspaceSync("push", serverId).catch((error) => this.logger.warn({ service: "workspace-sync", error }, "Automatic shared workspace sync failed")); }, 3_000));
  }
  async connectRcon(profileId: string): Promise<void> { await this.rcon.connect(this.requireProfile(profileId)); }
  disconnectRcon(profileId: string): void { this.rcon.disconnect(profileId); }
  runRcon(profileId: string, command: string): number { return this.rcon.execute(profileId, command); }
  runOwnerAction(profileId: string, action: "save" | "announce" | "kick" | "ban" | "unban" | "restart" | "plugins" | "performance", target = "", reason = ""): number {
    const safeReason = reason.replace(/["\\\r\n]/g, " ").trim().slice(0, 160); const steamId = /^\d{15,20}$/.test(target) ? target : null;
    const commands: Record<typeof action, string> = { save: "server.save", announce: `say ${safeReason || "Server announcement"}`, kick: `kick ${steamId ?? invalidTarget()} "${safeReason || "Removed by an administrator"}"`, ban: `banid ${steamId ?? invalidTarget()} "${safeReason || "Banned by an administrator"}"`, unban: `unban ${steamId ?? invalidTarget()}`, restart: `restart ${/^\d{1,4}$/.test(target) ? target : "60"}`, plugins: "oxide.plugins", performance: "serverinfo" };
    return this.rcon.execute(profileId, commands[action]);
  }

  async readServerConfig(profileId: string): Promise<string> { return fs.readFile(this.configPath(this.requireProfile(profileId)), "utf8"); }
  async saveServerConfig(profileId: string, content: string): Promise<void> {
    if (content.length > 1024 * 1024 || content.includes("\0")) throw new Error("Server configuration is invalid or too large");
    const file = this.configPath(this.requireProfile(profileId)); const backup = `${file}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`; await fs.copyFile(file, backup); await fs.writeFile(`${file}.tmp`, content, "utf8"); await fs.rename(`${file}.tmp`, file);
  }

  async backup(profileId: string): Promise<string> {
    const profile = this.requireProfile(profileId); if (!profile.localServerPath || !profile.backupPath) throw new Error("Set both the local server folder and backup destination");
    const source = path.resolve(profile.localServerPath); const root = path.resolve(profile.backupPath); const relative = path.relative(source, root);
    if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) throw new Error("Backup destination must be outside the live server folder");
    const target = path.join(root, `${profile.name.replace(/[^a-z0-9-_]/gi, "-")}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    await fs.mkdir(root, { recursive: true }); await fs.cp(source, target, { recursive: true, errorOnExist: true }); return target;
  }

  listExtensions(): InstalledExtension[] { return this.extensions.list(); }
  setExtension(id: string, enabled: boolean, permissions: InstalledExtension["approvedPermissions"]): InstalledExtension[] { return installedExtensionSchema.array().parse(this.extensions.setEnabled(id, enabled, permissions)); }
  async openExtensionsFolder(): Promise<void> { await this.extensions.openFolder(); }

  async shutdown(): Promise<void> { if (this.scheduler) clearInterval(this.scheduler); for (const timer of this.syncTimers.values()) clearTimeout(timer); process.off("uncaughtExceptionMonitor", this.crashListener); process.off("unhandledRejection", this.rejectionListener); await this.discord.stop(); this.rcon.shutdown(); await this.gateway.shutdown(); }

  private storeSecret(key: string, value?: string): void { if (value?.trim()) this.vault.saveSecret(key, value.trim()); }
  private requireProfile(id: string): OwnerProfile { const owner = this.repository.getOwner(); if (!owner.enabled) throw new Error("Enable and save Server Owner mode first"); const profile = owner.profiles.find((item) => item.id === id); if (!profile) throw new Error("Server Owner profile not found"); return profile; }
  private configPath(profile: OwnerProfile): string { if (!profile.localServerPath) throw new Error("Set the folder containing server.cfg first"); const root = path.resolve(profile.localServerPath); const file = path.resolve(root, "server.cfg"); if (path.dirname(file) !== root) throw new Error("Invalid server configuration path"); return file; }
  private async sharedRequest(method: string, config: ConnectedServicesConfig, body: unknown): Promise<Response> { const shared = config.sharedWorkspace; if (!shared.endpointUrl || !shared.workspaceId) throw new Error("Configure the shared workspace endpoint and ID first"); const url = `${shared.endpointUrl.replace(/\/$/, "")}/workspaces/${encodeURIComponent(shared.workspaceId)}`; return this.fetchAuthorized(url, this.vault.getSecret("shared-workspace-token"), { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); }
  private fetchAuthorized(url: string, token: string | null, init: RequestInit): Promise<Response> { const headers = new Headers(init.headers); if (token) headers.set("authorization", `Bearer ${token}`); return fetch(url, { ...init, headers, signal: AbortSignal.timeout(10_000) }); }
  private discordStatus(): string { const lines = this.servers.list().map((server) => { const telemetry = this.connections.getTelemetry(server.id); return `${server.name}: ${server.status}${telemetry?.players != null ? ` · ${telemetry.players}/${telemetry.maxPlayers ?? "?"} players` : ""}`; }); return lines.length ? `Rust Command Center\n${lines.join("\n")}` : "Rust Command Center: no servers configured"; }
  private mobileSummary(): Record<string, unknown> { return { servers: this.servers.list().map((server) => { const telemetry = this.connections.getTelemetry(server.id); return { id: server.id, name: server.name, status: server.status, players: telemetry?.players ?? null, maxPlayers: telemetry?.maxPlayers ?? null, rustTime: telemetry?.rustTime ?? null, latencyMs: telemetry?.latencyMs ?? null }; }) }; }
  private async runSchedules(): Promise<void> {
    const config = this.repository.getOwner(); const now = Date.now(); let changed = false;
    if (!config.enabled) return;
    for (const schedule of config.schedules.filter((item) => item.enabled)) {
      const runAt = new Date(schedule.runAt).getTime();
      if (schedule.kind === "restart" && runAt > now) {
        const remaining = Math.ceil((runAt - now) / 60_000);
        for (const minute of schedule.announceMinutes.filter((value) => remaining <= value && !schedule.announcedMinutes.includes(value))) {
          try { this.runOwnerAction(schedule.profileId, "announce", "", `Server restart in ${remaining} minute${remaining === 1 ? "" : "s"}.`); schedule.announcedMinutes.push(minute); changed = true; } catch (error) { this.logger.debug({ service: "owner-scheduler", error }, "Restart announcement deferred"); }
        }
      }
      if (runAt > now || (schedule.lastRunAt && new Date(schedule.lastRunAt).getTime() >= runAt)) continue;
      try { if (schedule.kind === "backup") await this.backup(schedule.profileId); else if (schedule.kind === "save") this.runOwnerAction(schedule.profileId, "save"); else if (schedule.kind === "restart") this.runOwnerAction(schedule.profileId, "restart", "60"); else { await this.backup(schedule.profileId); this.runOwnerAction(schedule.profileId, "save"); this.runOwnerAction(schedule.profileId, "announce", "", "Wipe preparation backup completed. Administrator action is required to wipe."); } } catch (error) { this.logger.warn({ service: "owner-scheduler", scheduleId: schedule.id, error }, "Scheduled operation failed"); }
      schedule.lastRunAt = new Date().toISOString(); changed = true;
      if (schedule.repeat !== "never") { const next = new Date(runAt); next.setUTCDate(next.getUTCDate() + (schedule.repeat === "daily" ? 1 : 7)); schedule.runAt = next.toISOString(); schedule.lastRunAt = null; schedule.announcedMinutes = []; }
      else schedule.enabled = false;
    }
    if (changed) this.repository.saveOwner(config);
  }

  private async report(type: string, metadata: Record<string, unknown>, crash: boolean): Promise<void> {
    const config = this.repository.getConnected().telemetry;
    if (!config.endpointUrl || (crash ? !config.crashReportsEnabled : !config.analyticsEnabled)) return;
    try { await this.fetchAuthorized(config.endpointUrl, this.vault.getSecret("telemetry-token"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, app: "rust-command-center", platform: process.platform, timestamp: new Date().toISOString(), metadata }) }); }
    catch (error) { this.logger.debug({ service: "telemetry", error }, "Opt-in report delivery failed"); }
  }
}

function invalidTarget(): never { throw new Error("Enter a valid 15–20 digit Steam ID"); }
function encryptJson(value: unknown, passphrase: string): Record<string, string | number> { const salt = crypto.randomBytes(16); const iv = crypto.randomBytes(12); const key = crypto.scryptSync(passphrase, salt, 32); const cipher = crypto.createCipheriv("aes-256-gcm", key, iv); const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]); return { version: 1, algorithm: "aes-256-gcm+scrypt", salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") }; }
function decryptJson(value: Record<string, unknown>, passphrase: string): unknown { if (value.version !== 1 || value.algorithm !== "aes-256-gcm+scrypt") throw new Error("Unsupported encrypted profile format"); const salt = Buffer.from(String(value.salt), "base64"); const iv = Buffer.from(String(value.iv), "base64"); const key = crypto.scryptSync(passphrase, salt, 32); const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv); decipher.setAuthTag(Buffer.from(String(value.tag), "base64")); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(String(value.ciphertext), "base64")), decipher.final()]).toString("utf8")); }
function sanitizeMessage(value: string): string { return value.replace(/(?:[A-Za-z]:\\|\/)(?:[^\s:]+[\\/])+/g, "<path>/").replace(/\b\d{15,20}\b/g, "<id>").slice(0, 500); }
function sanitizeStack(value?: string): string | null { return value ? sanitizeMessage(value).slice(0, 4000) : null; }
