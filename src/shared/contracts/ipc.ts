import type { BootstrapResponse, AppEvent, ServerTelemetry } from "./app";
import type { CreateServerRequest, ServerProfile } from "../schemas/server";
import type { AppSettings, SettingsPatch } from "../schemas/settings";
import type { UpdateState } from "./update";
import type { OperationsSnapshot, RustPlusCommand, WorkspaceDocument } from "./operations";

export const IPC_CHANNELS = {
  bootstrap: "app:bootstrap",
  updateSettings: "settings:update",
  createServer: "servers:create",
  connectServer: "servers:connect",
  disconnectServer: "servers:disconnect",
  archiveServer: "servers:archive",
  favoriteServer: "servers:favorite",
  testEndpoint: "servers:test-endpoint",
  deleteServer: "servers:delete",
  selectServer: "servers:select",
  getTelemetry: "servers:telemetry",
  getOperations: "servers:operations",
  executeCommand: "servers:command",
  getWorkspace: "workspace:get",
  saveWorkspace: "workspace:save",
  exportData: "workspace:export",
  importData: "workspace:import",
  setAlwaysOnTop: "window:always-on-top",
  showNotification: "notifications:show",
  sendWebhook: "integrations:webhook",
  openExternal: "system:open-external",
  openPanelWindow: "window:open-panel",
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
  favoriteServer(serverId: string, favorite: boolean): Promise<ServerProfile>;
  testEndpoint(address: string, port: number): Promise<{ reachable: boolean; latencyMs: number | null; message: string }>;
  deleteServer(serverId: string): Promise<void>;
  selectServer(serverId: string | null): Promise<AppSettings>;
  getTelemetry(serverId: string): Promise<ServerTelemetry | null>;
  getOperations(serverId: string): Promise<OperationsSnapshot | null>;
  executeCommand(serverId: string, command: RustPlusCommand): Promise<void>;
  getWorkspace(serverId: string): Promise<WorkspaceDocument>;
  saveWorkspace(serverId: string, document: WorkspaceDocument): Promise<WorkspaceDocument>;
  exportData(serverId: string): Promise<boolean>;
  importData(serverId: string): Promise<WorkspaceDocument | null>;
  setAlwaysOnTop(value: boolean): Promise<void>;
  showNotification(title: string, body: string): Promise<void>;
  sendWebhook(url: string, payload: Record<string, unknown>): Promise<void>;
  openExternal(url: string): Promise<void>;
  openPanelWindow(panel: "map" | "chat"): Promise<void>;
  onAppEvent(listener: (event: AppEvent) => void): () => void;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  downloadUpdate(): Promise<UpdateState>;
  installUpdate(): Promise<void>;
  openReleases(): Promise<void>;
  onUpdateState(listener: (state: UpdateState) => void): () => void;
}
