import type { BootstrapResponse, AppEvent, ServerTelemetry } from "./app";
import type { CreateServerRequest, ServerProfile } from "../schemas/server";
import type { AppSettings, SettingsPatch } from "../schemas/settings";
import type { UpdateState } from "./update";

export const IPC_CHANNELS = {
  bootstrap: "app:bootstrap",
  updateSettings: "settings:update",
  createServer: "servers:create",
  connectServer: "servers:connect",
  disconnectServer: "servers:disconnect",
  archiveServer: "servers:archive",
  deleteServer: "servers:delete",
  selectServer: "servers:select",
  getTelemetry: "servers:telemetry",
  appEvent: "events:app",
  getUpdateState: "updates:state",
  checkForUpdates: "updates:check",
  downloadUpdate: "updates:download",
  installUpdate: "updates:install",
  openReleases: "updates:open-releases",
  updateStateChanged: "updates:state-changed",
} as const;

export interface RustCommandCenterApi {
  getBootstrap(): Promise<BootstrapResponse>;
  updateSettings(patch: SettingsPatch): Promise<AppSettings>;
  createServer(request: CreateServerRequest): Promise<ServerProfile>;
  connectServer(serverId: string): Promise<ServerProfile>;
  disconnectServer(serverId: string): Promise<ServerProfile>;
  archiveServer(serverId: string, archived: boolean): Promise<ServerProfile>;
  deleteServer(serverId: string): Promise<void>;
  selectServer(serverId: string | null): Promise<AppSettings>;
  getTelemetry(serverId: string): Promise<ServerTelemetry | null>;
  onAppEvent(listener: (event: AppEvent) => void): () => void;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  downloadUpdate(): Promise<UpdateState>;
  installUpdate(): Promise<void>;
  openReleases(): Promise<void>;
  onUpdateState(listener: (state: UpdateState) => void): () => void;
}
