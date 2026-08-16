import { contextBridge, ipcRenderer } from "electron";
import { appEventSchema, bootstrapResponseSchema, serverTelemetrySchema } from "../shared/contracts/app";
import { IPC_CHANNELS, type RustCommandCenterApi } from "../shared/contracts/ipc";
import { appSettingsSchema } from "../shared/schemas/settings";
import { serverProfileSchema } from "../shared/schemas/server";
import { updateStateSchema } from "../shared/contracts/update";
import { operationsSnapshotSchema, rustPlusCommandSchema, workspaceDocumentSchema } from "../shared/contracts/operations";
import { connectedServicesConfigSchema, installedExtensionSchema, serverOwnerConfigSchema, suiteStateSchema } from "../shared/contracts/connectedServices";

const api: RustCommandCenterApi = {
  getBootstrap: async () => bootstrapResponseSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.bootstrap)),
  updateSettings: async (patch) =>
    appSettingsSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.updateSettings, patch)),
  createServer: async (request) =>
    serverProfileSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.createServer, request)),
  connectServer: async (serverId) =>
    serverProfileSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.connectServer, { serverId })),
  disconnectServer: async (serverId) =>
    serverProfileSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.disconnectServer, { serverId })),
  archiveServer: async (serverId, archived) =>
    serverProfileSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.archiveServer, { serverId, archived })),
  favoriteServer: async (serverId, favorite) => serverProfileSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.favoriteServer, { serverId, favorite })),
  testEndpoint: async (address, port) => await ipcRenderer.invoke(IPC_CHANNELS.testEndpoint, { address, port }),
  deleteServer: async (serverId) => {
    await ipcRenderer.invoke(IPC_CHANNELS.deleteServer, { serverId });
  },
  selectServer: async (serverId) =>
    appSettingsSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.selectServer, { serverId })),
  getTelemetry: async (serverId) => {
    const response = await ipcRenderer.invoke(IPC_CHANNELS.getTelemetry, { serverId });
    return response === null ? null : serverTelemetrySchema.parse(response);
  },
  getOperations: async (serverId) => {
    const response = await ipcRenderer.invoke(IPC_CHANNELS.getOperations, { serverId });
    return response === null ? null : operationsSnapshotSchema.parse(response);
  },
  executeCommand: async (serverId, command) => {
    await ipcRenderer.invoke(IPC_CHANNELS.executeCommand, { serverId, command: rustPlusCommandSchema.parse(command) });
  },
  getWorkspace: async (serverId) => workspaceDocumentSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.getWorkspace, { serverId })),
  saveWorkspace: async (serverId, document) => workspaceDocumentSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.saveWorkspace, { serverId, document })),
  exportData: async (serverId) => Boolean(await ipcRenderer.invoke(IPC_CHANNELS.exportData, { serverId })),
  importData: async (serverId) => {
    const response = await ipcRenderer.invoke(IPC_CHANNELS.importData, { serverId });
    return response === null ? null : workspaceDocumentSchema.parse(response);
  },
  setAlwaysOnTop: async (value) => { await ipcRenderer.invoke(IPC_CHANNELS.setAlwaysOnTop, { value }); },
  showNotification: async (title, body) => { await ipcRenderer.invoke(IPC_CHANNELS.showNotification, { title, body }); },
  sendWebhook: async (url, payload) => { await ipcRenderer.invoke(IPC_CHANNELS.sendWebhook, { url, payload }); },
  openExternal: async (url) => { await ipcRenderer.invoke(IPC_CHANNELS.openExternal, { url }); },
  openPanelWindow: async (panel) => { await ipcRenderer.invoke(IPC_CHANNELS.openPanelWindow, { panel }); },
  onAppEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, rawEvent: unknown) => {
      const parsed = appEventSchema.safeParse(rawEvent);
      if (parsed.success) listener(parsed.data);
    };
    ipcRenderer.on(IPC_CHANNELS.appEvent, handler);
    return () => ipcRenderer.off(IPC_CHANNELS.appEvent, handler);
  },
  getUpdateState: async () => updateStateSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.getUpdateState)),
  checkForUpdates: async () => updateStateSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.checkForUpdates)),
  downloadUpdate: async () => updateStateSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.downloadUpdate)),
  installUpdate: async () => {
    await ipcRenderer.invoke(IPC_CHANNELS.installUpdate);
  },
  openReleases: async () => {
    await ipcRenderer.invoke(IPC_CHANNELS.openReleases);
  },
  onUpdateState: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, rawState: unknown) => {
      const parsed = updateStateSchema.safeParse(rawState);
      if (parsed.success) listener(parsed.data);
    };
    ipcRenderer.on(IPC_CHANNELS.updateStateChanged, handler);
    return () => ipcRenderer.off(IPC_CHANNELS.updateStateChanged, handler);
  },
  getSuiteState: async () => suiteStateSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.getSuiteState)),
  saveConnectedServices: async (config, secrets = {}) => suiteStateSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.saveConnectedServices, { config: connectedServicesConfigSchema.parse(config), secrets })),
  saveServerOwner: async (config, passwords = {}, bridgeToken) => suiteStateSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.saveServerOwner, { config: serverOwnerConfigSchema.parse(config), passwords, bridgeToken })),
  testConnectedService: async (service) => String(await ipcRenderer.invoke(IPC_CHANNELS.testConnectedService, { service })),
  profileSync: async (direction) => String(await ipcRenderer.invoke(IPC_CHANNELS.profileSync, { direction })),
  sharedWorkspaceSync: async (direction, serverId) => String(await ipcRenderer.invoke(IPC_CHANNELS.sharedWorkspaceSync, { direction, serverId })),
  sendDiscordMessage: async (message) => { await ipcRenderer.invoke(IPC_CHANNELS.sendDiscordMessage, { message }); },
  chooseDirectory: async (title) => { const value = await ipcRenderer.invoke(IPC_CHANNELS.chooseDirectory, { title }); return typeof value === "string" ? value : null; },
  rconConnect: async (profileId) => { await ipcRenderer.invoke(IPC_CHANNELS.rconConnect, { profileId }); },
  rconDisconnect: async (profileId) => { await ipcRenderer.invoke(IPC_CHANNELS.rconDisconnect, { profileId }); },
  rconCommand: async (profileId, command) => Number(await ipcRenderer.invoke(IPC_CHANNELS.rconCommand, { profileId, command })),
  ownerAction: async (profileId, action, target = "", reason = "") => Number(await ipcRenderer.invoke(IPC_CHANNELS.ownerAction, { profileId, action, target, reason })),
  readServerConfig: async (profileId) => String(await ipcRenderer.invoke(IPC_CHANNELS.readServerConfig, { profileId })),
  saveServerConfig: async (profileId, content) => { await ipcRenderer.invoke(IPC_CHANNELS.saveServerConfig, { profileId, content }); },
  runServerBackup: async (profileId) => String(await ipcRenderer.invoke(IPC_CHANNELS.runServerBackup, { profileId })),
  openExtensionsFolder: async () => { await ipcRenderer.invoke(IPC_CHANNELS.openExtensionsFolder); },
  setExtensionEnabled: async (id, enabled, approvedPermissions) => installedExtensionSchema.array().parse(await ipcRenderer.invoke(IPC_CHANNELS.setExtensionEnabled, { id, enabled, approvedPermissions })),
};

contextBridge.exposeInMainWorld("rcc", Object.freeze(api));
