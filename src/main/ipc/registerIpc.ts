import { randomUUID } from "node:crypto";
import { app, BrowserWindow, ipcMain } from "electron";
import { z, type ZodType } from "zod";
import type { Logger } from "pino";
import type { BootstrapResponse } from "../../shared/contracts/app";
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
import { RustPlusConnectionManager } from "../rustplus/connectionManager";
import { CredentialVault } from "../security/credentialVault";
import { SlidingWindowRateLimiter } from "../security/rateLimiter";
import { UpdateService } from "../updates/updateService";

const selectServerSchema = z.object({ serverId: z.string().uuid().nullable() });

interface IpcDependencies {
  servers: ServerRepository;
  settings: SettingsRepository;
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
    dependencies.events.publish({ type: "settings.changed", settings, timestamp: new Date().toISOString() });
    return settings;
  });

  register(IPC_CHANNELS.createServer, createServerRequestSchema, async (request) => {
    if (request.provider === "mock" && !dependencies.mockProviderEnabled) {
      throw new Error("Simulation mode is disabled in production builds");
    }
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
