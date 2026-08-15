import { app, type BrowserWindow } from "electron";
import type { Logger } from "pino";
import { AppEventBus } from "../../shared/events/eventBus";
import { createDatabase, type DatabaseContext } from "../database/connection";
import { AppHealthService } from "../diagnostics/healthService";
import { registerIpc } from "../ipc/registerIpc";
import { ServerRepository } from "../repositories/serverRepository";
import { SettingsRepository } from "../repositories/settingsRepository";
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
  const vault = new CredentialVault(app.getPath("userData"));
  const mockProviderEnabled = !app.isPackaged;
  const providerFactory = new DefaultRustPlusProviderFactory(logger, mockProviderEnabled);
  const connections = new RustPlusConnectionManager(servers, vault, providerFactory, events, logger);
  const health = new AppHealthService(servers);
  const updates = new UpdateService(logger);

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

  const unregisterIpc = registerIpc({
    servers,
    settings,
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
      updates.stop();
      tray.destroy();
      await connections.shutdown();
      database.close();
    },
  };
}
