import { app, BrowserWindow, shell } from "electron";
import { autoUpdater, type AppUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";
import type { Logger } from "pino";
import { IPC_CHANNELS } from "../../shared/contracts/ipc";
import type { UpdateState } from "../../shared/contracts/update";

const RELEASES_URL = "https://github.com/Bray12541/rust-command-center/releases";

export class UpdateService {
  private readonly updater: AppUpdater = autoUpdater;
  private state: UpdateState;
  private startupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly logger: Logger) {
    const portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
    const enabled = app.isPackaged && !portable;
    this.state = {
      phase: enabled ? "idle" : "disabled",
      currentVersion: app.getVersion(),
      availableVersion: null,
      progress: null,
      message: enabled
        ? "Ready to check for updates"
        : portable
          ? "Install Rust Command Center once to enable automatic updates"
          : "Update checks are available in packaged builds",
      canAutoUpdate: enabled,
      releaseNotes: null,
    };

    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = true;
    this.updater.allowPrerelease = false;
    this.updater.logger = {
      info: (message) => this.logger.info({ service: "updates", message }, "Updater"),
      warn: (message) => this.logger.warn({ service: "updates", message }, "Updater warning"),
      error: (message) => this.logger.error({ service: "updates", message }, "Updater error"),
      debug: (message) => this.logger.debug({ service: "updates", message }, "Updater debug"),
    };
    this.bindEvents();
  }

  setPreferences(channel: "stable" | "beta", skippedVersion: string | null): void {
    this.updater.allowPrerelease = channel === "beta";
    this.skippedVersion = skippedVersion;
  }

  start(): void {
    if (!this.state.canAutoUpdate) return;
    this.startupTimer = setTimeout(() => {
      void this.check().catch(() => undefined);
    }, 12_000);
    this.startupTimer.unref();
  }

  stop(): void {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
  }

  snapshot(): UpdateState {
    return { ...this.state };
  }

  async check(): Promise<UpdateState> {
    if (!this.state.canAutoUpdate) return this.snapshot();
    if (["checking", "downloading"].includes(this.state.phase)) return this.snapshot();
    this.setState({ phase: "checking", progress: null, message: "Checking GitHub for updates…" });
    try {
      await this.updater.checkForUpdates();
    } catch (error) {
      this.fail(error, "Could not check for updates");
    }
    return this.snapshot();
  }

  async download(): Promise<UpdateState> {
    if (!this.state.canAutoUpdate || this.state.phase !== "available") return this.snapshot();
    this.setState({ phase: "downloading", progress: 0, message: "Starting update download…" });
    try {
      await this.updater.downloadUpdate();
    } catch (error) {
      this.fail(error, "Could not download the update");
    }
    return this.snapshot();
  }

  install(): void {
    if (this.state.phase !== "downloaded") throw new Error("No downloaded update is ready to install");
    this.updater.quitAndInstall(false, true);
  }

  async openReleases(): Promise<void> {
    await shell.openExternal(RELEASES_URL);
  }

  private bindEvents(): void {
    this.updater.on("checking-for-update", () => {
      this.setState({ phase: "checking", progress: null, message: "Checking GitHub for updates…" });
    });
    this.updater.on("update-available", (info: UpdateInfo) => {
      if (info.version === this.skippedVersion) {
        this.setState({ phase: "up-to-date", availableVersion: info.version, progress: null, message: `Version ${info.version} is skipped`, releaseNotes: this.notes(info) });
        return;
      }
      this.setState({
        phase: "available",
        availableVersion: info.version,
        progress: null,
        message: `Version ${info.version} is ready to download`,
        releaseNotes: this.notes(info),
      });
    });
    this.updater.on("update-not-available", () => {
      this.setState({
        phase: "up-to-date",
        availableVersion: null,
        progress: null,
        message: "You are running the latest version",
      });
    });
    this.updater.on("download-progress", (progress: ProgressInfo) => {
      const percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
      this.setState({ phase: "downloading", progress: percent, message: `Downloading update · ${percent}%` });
    });
    this.updater.on("update-downloaded", (info: UpdateInfo) => {
      this.setState({
        phase: "downloaded",
        availableVersion: info.version,
        progress: 100,
        message: "Update ready — restart to install",
      });
    });
    this.updater.on("error", (error: Error) => this.fail(error, "Update service unavailable"));
  }

  private skippedVersion: string | null = null;

  private notes(info: UpdateInfo): string | null {
    const notes = info.releaseNotes;
    if (typeof notes === "string") return notes.slice(0, 5_000);
    if (Array.isArray(notes)) return notes.map((note) => note.note).filter(Boolean).join("\n").slice(0, 5_000) || null;
    return null;
  }

  private fail(error: unknown, fallback: string): void {
    this.logger.warn({ service: "updates", error }, fallback);
    this.setState({ phase: "error", progress: null, message: fallback });
  }

  private setState(patch: Partial<UpdateState>): void {
    this.state = { ...this.state, ...patch };
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC_CHANNELS.updateStateChanged, this.snapshot());
    }
  }
}
