import { randomUUID } from "node:crypto";
import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from "electron";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { z, type ZodType } from "zod";
import type { Logger } from "pino";
import type { BootstrapResponse } from "../../shared/contracts/app";
import { rustPlusCommandSchema, workspaceDocumentSchema } from "../../shared/contracts/operations";
import { IPC_CHANNELS } from "../../shared/contracts/ipc";
import { AppEventBus } from "../../shared/events/eventBus";
import {
  archiveServerRequestSchema,
  createServerRequestSchema,
  serverActionRequestSchema,
} from "../../shared/schemas/server";
import { settingsPatchSchema } from "../../shared/schemas/settings";
import { AppHealthService } from "../diagnostics/healthService";
import { ServerRepository } from "../repositories/serverRepository";
import { SettingsRepository } from "../repositories/settingsRepository";
import { WorkspaceRepository } from "../repositories/workspaceRepository";
import { RustPlusConnectionManager } from "../rustplus/connectionManager";
import { CredentialVault } from "../security/credentialVault";
import { SlidingWindowRateLimiter } from "../security/rateLimiter";
import { UpdateService } from "../updates/updateService";

const selectServerSchema = z.object({ serverId: z.string().uuid().nullable() });
const serverCommandSchema = z.object({ serverId: z.string().uuid(), command: rustPlusCommandSchema });
const workspaceSaveSchema = z.object({ serverId: z.string().uuid(), document: workspaceDocumentSchema });
const alwaysOnTopSchema = z.object({ value: z.boolean() });
const favoriteServerSchema = z.object({ serverId: z.string().uuid(), favorite: z.boolean() });
const notificationSchema = z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(300) });
const webhookSchema = z.object({ url: z.string().url().refine((url) => url.startsWith("https://"), "Webhook must use HTTPS"), payload: z.record(z.string(), z.unknown()) });
const externalUrlSchema = z.object({ url: z.string().url().refine((url) => /^https?:\/\//i.test(url), "Only HTTP(S) links are allowed") });
const endpointSchema = z.object({ address: z.string().trim().min(1).max(253), port: z.number().int().min(1).max(65535) });
const panelWindowSchema = z.object({ panel: z.enum(["map", "chat"]) });

interface IpcDependencies {
  servers: ServerRepository;
  settings: SettingsRepository;
  workspaces: WorkspaceRepository;
  connections: RustPlusConnectionManager;
  vault: CredentialVault;
  events: AppEventBus;
  health: AppHealthService;
  logger: Logger;
  mockProviderEnabled: boolean;
  updates: UpdateService;
  onTrayRefresh(): void;
}

export function registerIpc(dependencies: IpcDependencies): () => void {
  const limiter = new SlidingWindowRateLimiter(20, 10_000);
  const channels = Object.values(IPC_CHANNELS).filter((channel) => channel !== IPC_CHANNELS.appEvent);

  const register = <T>(
    channel: string,
    schema: ZodType<T> | null,
    handler: (payload: T) => unknown | Promise<unknown>,
  ) => {
    ipcMain.handle(channel, async (event, rawPayload) => {
      limiter.assertAllowed(`${event.sender.id}:${channel}`);
      try {
        const payload = schema ? schema.parse(rawPayload) : (undefined as T);
        return await handler(payload);
      } catch (error) {
        dependencies.logger.warn({ service: "ipc", channel, error }, "IPC request failed");
        if (error instanceof z.ZodError) throw new Error(error.issues[0]?.message ?? "Invalid request");
        throw new Error(error instanceof Error ? error.message.slice(0, 240) : "Request failed");
      }
    });
  };

  register(IPC_CHANNELS.bootstrap, null, (): BootstrapResponse => ({
    appVersion: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
    mockProviderEnabled: dependencies.mockProviderEnabled,
    settings: dependencies.settings.get(),
    servers: dependencies.servers.list(),
    health: dependencies.health.snapshot(),
  }));

  register(IPC_CHANNELS.updateSettings, settingsPatchSchema, (patch) => {
    const settings = dependencies.settings.update(patch);
    if (patch.launchAtStartup !== undefined) {
      app.setLoginItemSettings({ openAtLogin: patch.launchAtStartup });
    }
    if (patch.updateChannel !== undefined || patch.skippedUpdateVersion !== undefined) dependencies.updates.setPreferences(settings.updateChannel, settings.skippedUpdateVersion);
    dependencies.events.publish({ type: "settings.changed", settings, timestamp: new Date().toISOString() });
    return settings;
  });

  register(IPC_CHANNELS.createServer, createServerRequestSchema, async (request) => {
    if (request.provider === "mock" && !dependencies.mockProviderEnabled) {
      throw new Error("Simulation mode is disabled in production builds");
    }
    if (dependencies.servers.list(true).some((server) => server.address.toLowerCase() === request.address.toLowerCase() && server.port === request.port)) throw new Error("A server profile already uses this address and Rust+ port");
    const id = randomUUID();
    const server = dependencies.servers.create({
      id,
      name: request.name,
      address: request.address,
      port: request.port,
      provider: request.provider,
      favorite: request.favorite,
      autoConnect: request.autoConnect,
    });
    try {
      dependencies.vault.save(id, { playerId: request.playerId, playerToken: request.playerToken });
    } catch (error) {
      dependencies.servers.delete(id);
      throw error;
    }
    if (!dependencies.settings.get().selectedServerId) dependencies.settings.update({ selectedServerId: id });
    dependencies.onTrayRefresh();
    if (request.autoConnect) await dependencies.connections.connect(id);
    return dependencies.servers.get(id) ?? server;
  });

  register(IPC_CHANNELS.connectServer, serverActionRequestSchema, ({ serverId }) =>
    dependencies.connections.connect(serverId),
  );
  register(IPC_CHANNELS.disconnectServer, serverActionRequestSchema, ({ serverId }) =>
    dependencies.connections.disconnect(serverId),
  );
  register(IPC_CHANNELS.archiveServer, archiveServerRequestSchema, async ({ serverId, archived }) => {
    if (archived) await dependencies.connections.disconnect(serverId);
    const server = dependencies.servers.setArchived(serverId, archived);
    dependencies.onTrayRefresh();
    return server;
  });
  register(IPC_CHANNELS.favoriteServer, favoriteServerSchema, ({ serverId, favorite }) => {
    const server = dependencies.servers.setFavorite(serverId, favorite); dependencies.onTrayRefresh(); return server;
  });
  register(IPC_CHANNELS.testEndpoint, endpointSchema, ({ address, port }) => new Promise((resolve) => {
    const started = performance.now();
    const socket = net.createConnection({ host: address, port });
    const finish = (reachable: boolean, message: string) => { socket.destroy(); resolve({ reachable, latencyMs: reachable ? Math.round(performance.now() - started) : null, message }); };
    socket.setTimeout(5_000);
    socket.once("connect", () => finish(true, "Companion port accepted a TCP connection"));
    socket.once("timeout", () => finish(false, "Connection timed out; check app.port and firewall rules"));
    socket.once("error", (error) => finish(false, error.message.slice(0, 180)));
  }));
  register(IPC_CHANNELS.deleteServer, serverActionRequestSchema, async ({ serverId }) => {
    await dependencies.connections.remove(serverId);
    if (dependencies.settings.get().selectedServerId === serverId) {
      dependencies.settings.update({ selectedServerId: dependencies.servers.list()[0]?.id ?? null });
    }
    dependencies.onTrayRefresh();
  });
  register(IPC_CHANNELS.selectServer, selectServerSchema, ({ serverId }) =>
    dependencies.settings.update({ selectedServerId: serverId }),
  );
  register(IPC_CHANNELS.getTelemetry, serverActionRequestSchema, ({ serverId }) =>
    dependencies.connections.getTelemetry(serverId),
  );
  register(IPC_CHANNELS.getOperations, serverActionRequestSchema, ({ serverId }) => dependencies.connections.getOperations(serverId));
  register(IPC_CHANNELS.executeCommand, serverCommandSchema, ({ serverId, command }) => dependencies.connections.execute(serverId, command));
  register(IPC_CHANNELS.getWorkspace, serverActionRequestSchema, ({ serverId }) => dependencies.workspaces.get(serverId));
  register(IPC_CHANNELS.saveWorkspace, workspaceSaveSchema, ({ serverId, document }) => dependencies.workspaces.save(serverId, document));
  register(IPC_CHANNELS.exportData, serverActionRequestSchema, async ({ serverId }) => {
    const server = dependencies.servers.get(serverId);
    if (!server) throw new Error("Server profile not found");
    const result = await dialog.showSaveDialog({
      title: "Export Rust Command Center workspace",
      defaultPath: `${server.name.replace(/[^a-z0-9-_]+/gi, "-")}-workspace.json`,
      filters: [{ name: "Rust Command Center workspace", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, JSON.stringify({ format: "rcc-workspace", version: 1, exportedAt: new Date().toISOString(), workspace: dependencies.workspaces.get(serverId) }, null, 2), "utf8");
    return true;
  });
  register(IPC_CHANNELS.importData, serverActionRequestSchema, async ({ serverId }) => {
    const result = await dialog.showOpenDialog({ title: "Import Rust Command Center workspace", properties: ["openFile"], filters: [{ name: "Rust Command Center workspace", extensions: ["json"] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const raw = JSON.parse(await fs.readFile(result.filePaths[0], "utf8"));
    return dependencies.workspaces.save(serverId, workspaceDocumentSchema.parse(raw?.workspace ?? raw));
  });
  register(IPC_CHANNELS.setAlwaysOnTop, alwaysOnTopSchema, ({ value }) => {
    const window = BrowserWindow.getFocusedWindow();
    if (window) window.setAlwaysOnTop(value, "floating");
  });
  register(IPC_CHANNELS.showNotification, notificationSchema, ({ title, body }) => {
    if (Notification.isSupported()) new Notification({ title, body, silent: false }).show();
  });
  register(IPC_CHANNELS.sendWebhook, webhookSchema, async ({ url, payload }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
    } finally { clearTimeout(timeout); }
  });
  register(IPC_CHANNELS.openExternal, externalUrlSchema, ({ url }) => shell.openExternal(url));
  register(IPC_CHANNELS.openPanelWindow, panelWindowSchema, async ({ panel }) => {
    const child = new BrowserWindow({
      title: panel === "map" ? "Rust Command Center · Mini Map" : "Rust Command Center · Team Chat",
      width: panel === "map" ? 760 : 520, height: panel === "map" ? 620 : 700, minWidth: 420, minHeight: 420,
      alwaysOnTop: panel === "map", autoHideMenuBar: true, backgroundColor: "#0b0e0e",
      webPreferences: { preload: path.join(__dirname, "..", "..", "preload", "index.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
    });
    child.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    child.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    const developmentUrl = process.env.VITE_DEV_SERVER_URL;
    if (developmentUrl) await child.loadURL(`${developmentUrl}/#/${panel === "map" ? "map" : "chat"}`);
    else await child.loadFile(path.join(__dirname, "..", "..", "..", "renderer", "index.html"), { hash: `/${panel === "map" ? "map" : "chat"}` });
  });
  register(IPC_CHANNELS.getUpdateState, null, () => dependencies.updates.snapshot());
  register(IPC_CHANNELS.checkForUpdates, null, () => dependencies.updates.check());
  register(IPC_CHANNELS.downloadUpdate, null, () => dependencies.updates.download());
  register(IPC_CHANNELS.installUpdate, null, () => dependencies.updates.install());
  register(IPC_CHANNELS.openReleases, null, () => dependencies.updates.openReleases());

  const unsubscribe = dependencies.events.subscribe((appEvent) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.appEvent, appEvent);
    }
    if (appEvent.type === "server.status_changed") dependencies.onTrayRefresh();
  });

  return () => {
    unsubscribe();
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}
