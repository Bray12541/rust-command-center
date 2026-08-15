import { app } from "electron";
import { startApplication, type RunningApplication } from "./bootstrap/application";
import { createLogger } from "./logging/logger";

if (!app.isPackaged && process.env.RCC_E2E_USER_DATA) app.setPath("userData", process.env.RCC_E2E_USER_DATA);

const hasInstanceLock = app.requestSingleInstanceLock();
let running: RunningApplication | null = null;

if (!hasInstanceLock) {
  app.quit();
} else {
  app.setAppUserModelId("com.rustcommandcenter.desktop");
  const logger = createLogger(app.getPath("userData"), !app.isPackaged);

  app.on("second-instance", () => {
    const window = running?.window;
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });

  app.whenReady().then(async () => {
    try {
      running = await startApplication(logger);
      logger.info({ service: "bootstrap", version: app.getVersion() }, "Application started");
    } catch (error) {
      logger.fatal({ service: "bootstrap", err: error }, "Application startup failed");
      app.exit(1);
    }
  });

  app.on("before-quit", () => {
    if (running) void running.shutdown();
  });

  app.on("window-all-closed", () => {
    // The tray owns the application lifecycle on Windows.
    if (process.platform !== "win32" && process.platform !== "darwin") app.quit();
  });
}
