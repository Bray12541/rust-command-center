import { app, Notification, type BrowserWindow } from "electron";
import type { Logger } from "pino";
import { AppEventBus } from "../../shared/events/eventBus";
import { createDatabase, type DatabaseContext } from "../database/connection";
import { AppHealthService } from "../diagnostics/healthService";
import { registerIpc } from "../ipc/registerIpc";
import { ServerRepository } from "../repositories/serverRepository";
import { SettingsRepository } from "../repositories/settingsRepository";
import { WorkspaceRepository } from "../repositories/workspaceRepository";
import { RustPlusConnectionManager } from "../rustplus/connectionManager";
import { DefaultRustPlusProviderFactory } from "../rustplus/providerFactory";
import { CredentialVault } from "../security/credentialVault";
import { TrayService } from "../tray/trayService";
import { createMainWindow } from "../windows/mainWindow";
import { UpdateService } from "../updates/updateService";

export interface RunningApplication {
  window: BrowserWindow;
  shutdown(): Promise<void>;
}

export async function startApplication(logger: Logger): Promise<RunningApplication> {
  const database: DatabaseContext = createDatabase({
    userDataPath: app.getPath("userData"),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
    logger,
  });
  const events = new AppEventBus();
  const servers = new ServerRepository(database.db);
  const settings = new SettingsRepository(database.db);
  if (!app.isPackaged && process.env.RCC_E2E_SKIP_ONBOARDING === "1") settings.update({ onboardingComplete: true, closeBehavior: "exit" });
  const workspaces = new WorkspaceRepository(database.db);
  const vault = new CredentialVault(app.getPath("userData"));
  const mockProviderEnabled = !app.isPackaged;
  const providerFactory = new DefaultRustPlusProviderFactory(logger, mockProviderEnabled);
  const connections = new RustPlusConnectionManager(servers, workspaces, vault, providerFactory, events, logger);
  const health = new AppHealthService(servers);
  const updates = new UpdateService(logger);
  updates.setPreferences(settings.get().updateChannel, settings.get().skippedUpdateVersion);

  let quitting = false;
  const window = createMainWindow({
    settings,
    logger,
    onCloseToTray: () => undefined,
    shouldQuit: () => quitting,
  });
  const tray = new TrayService(
    window,
    servers,
    (serverId) => void connections.connect(serverId),
    () => {
      quitting = true;
      app.quit();
    },
  );
  tray.create();

  const previousStatuses = new Map<string, string>();
  const unsubscribeOperationalNotifications = events.subscribe((event) => {
    if (event.type !== "server.status_changed") return;
    const before = previousStatuses.get(event.server.id);
    previousStatuses.set(event.server.id, event.server.status);
    if (before && before !== event.server.status) {
      const workspace = workspaces.get(event.server.id);
      workspace.activity.push({ id: crypto.randomUUID(), type: "Connection", message: `${event.server.name}: ${event.server.status.toLowerCase().replaceAll("_", " ")}${event.server.statusReason ? ` — ${event.server.statusReason}` : ""}`, severity: ["ERROR", "STALE"].includes(event.server.status) ? "critical" : event.server.status === "DISCONNECTED" ? "warning" : "info", createdAt: event.timestamp });
      workspace.activity = workspace.activity.slice(-1000);
      workspaces.save(event.server.id, workspace);
    }
    if (!settings.get().desktopNotifications || !Notification.isSupported()) return;
    if (before === "CONNECTED" && ["DISCONNECTED", "STALE", "ERROR"].includes(event.server.status)) new Notification({ title: `${event.server.name} disconnected`, body: event.server.statusReason ?? "Rust+ monitoring is reconnecting automatically." }).show();
    if (before && before !== "CONNECTED" && event.server.status === "CONNECTED") new Notification({ title: `${event.server.name} connected`, body: "Live Rust+ monitoring has resumed." }).show();
  });

  const unregisterIpc = registerIpc({
    servers,
    settings,
    workspaces,
    connections,
    vault,
    events,
    health,
    logger,
    mockProviderEnabled,
    updates,
    onTrayRefresh: () => tray.refresh(),
  });

  void connections.restore();
  updates.start();

  return {
    window,
    shutdown: async () => {
      quitting = true;
      unregisterIpc();
      unsubscribeOperationalNotifications();
      updates.stop();
      tray.destroy();
      await connections.shutdown();
      database.close();
    },
  };
}
