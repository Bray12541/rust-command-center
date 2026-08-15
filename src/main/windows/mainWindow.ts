import path from "node:path";
import { BrowserWindow, app, screen } from "electron";
import type { Logger } from "pino";
import type { SettingsRepository } from "../repositories/settingsRepository";

export function createMainWindow(options: {
  settings: SettingsRepository;
  logger: Logger;
  onCloseToTray(): void;
  shouldQuit(): boolean;
}): BrowserWindow {
  const display = screen.getPrimaryDisplay().workArea;
  const window = new BrowserWindow({
    title: "Rust Command Center",
    width: Math.min(1480, display.width),
    height: Math.min(940, display.height),
    minWidth: 1040,
    minHeight: 680,
    x: Math.max(display.x, display.x + Math.floor((display.width - Math.min(1480, display.width)) / 2)),
    y: Math.max(display.y, display.y + Math.floor((display.height - Math.min(940, display.height)) / 2)),
    backgroundColor: "#0b0d0d",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0b0e0e",
      symbolColor: "#d8ddda",
      height: 40,
    },
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.once("did-finish-load", () => {
    if (!window.isVisible()) window.show();
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    options.logger.error(
      { service: "renderer", errorCode, errorDescription, validatedUrl },
      "Renderer failed to load",
    );
    if (!window.isVisible()) window.show();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.on("will-navigate", (event, url) => {
    const developmentOrigin = process.env.VITE_DEV_SERVER_URL;
    if (developmentOrigin && new URL(url).origin === new URL(developmentOrigin).origin) return;
    if (!developmentOrigin && url.startsWith("file:")) return;
    event.preventDefault();
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    options.logger.error({ service: "renderer", reason: details.reason }, "Renderer process exited");
  });
  window.on("close", (event) => {
    const behavior = options.settings.get().closeBehavior;
    if (!options.shouldQuit() && behavior === "tray") {
      event.preventDefault();
      window.hide();
      options.onCloseToTray();
    } else if (!options.shouldQuit()) {
      app.quit();
    }
  });

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  const loadPromise = developmentUrl
    ? window.loadURL(developmentUrl)
    : window.loadFile(path.join(__dirname, "..", "..", "..", "renderer", "index.html"));
  void loadPromise.catch((error: unknown) => {
    options.logger.error({ service: "renderer", error }, "Renderer navigation failed");
  });

  return window;
}
