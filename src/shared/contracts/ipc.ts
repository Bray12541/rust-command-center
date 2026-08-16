import type { BootstrapResponse, AppEvent, ServerTelemetry } from "./app";
import type { CreateServerRequest, ServerProfile } from "../schemas/server";
import type { AppSettings, SettingsPatch } from "../schemas/settings";
import type { UpdateState } from "./update";
import type { OperationsSnapshot, RustPlusCommand, WorkspaceDocument } from "./operations";
import type { ConnectedServicesConfig, InstalledExtension, ServerOwnerConfig, SuiteState } from "./connectedServices";

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
  getSuiteState: "suite:state",
  saveConnectedServices: "suite:connected:save",
  saveServerOwner: "suite:owner:save",
  testConnectedService: "suite:service:test",
  profileSync: "suite:profile-sync",
  sharedWorkspaceSync: "suite:workspace-sync",
  sendDiscordMessage: "suite:discord:send",
  chooseDirectory: "system:choose-directory",
  rconConnect: "suite:rcon:connect",
  rconDisconnect: "suite:rcon:disconnect",
  rconCommand: "suite:rcon:command",
  ownerAction: "suite:owner:action",
  readServerConfig: "suite:owner:config-read",
  saveServerConfig: "suite:owner:config-save",
  runServerBackup: "suite:owner:backup",
  openExtensionsFolder: "suite:extensions:folder",
  setExtensionEnabled: "suite:extensions:enabled",
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
  getSuiteState(): Promise<SuiteState>;
  saveConnectedServices(config: ConnectedServicesConfig, secrets?: Record<string, string>): Promise<SuiteState>;
  saveServerOwner(config: ServerOwnerConfig, passwords?: Record<string, string>, bridgeToken?: string): Promise<SuiteState>;
  testConnectedService(service: "discord" | "shared-workspace" | "telemetry" | "mobile" | "bridge"): Promise<string>;
  profileSync(direction: "push" | "pull"): Promise<string>;
  sharedWorkspaceSync(direction: "push" | "pull", serverId: string): Promise<string>;
  sendDiscordMessage(message: string): Promise<void>;
  chooseDirectory(title: string): Promise<string | null>;
  rconConnect(profileId: string): Promise<void>;
  rconDisconnect(profileId: string): Promise<void>;
  rconCommand(profileId: string, command: string): Promise<number>;
  ownerAction(profileId: string, action: "save" | "announce" | "kick" | "ban" | "unban" | "restart" | "plugins" | "performance", target?: string, reason?: string): Promise<number>;
  readServerConfig(profileId: string): Promise<string>;
  saveServerConfig(profileId: string, content: string): Promise<void>;
  runServerBackup(profileId: string): Promise<string>;
  openExtensionsFolder(): Promise<void>;
  setExtensionEnabled(id: string, enabled: boolean, approvedPermissions: InstalledExtension["approvedPermissions"]): Promise<InstalledExtension[]>;
}
