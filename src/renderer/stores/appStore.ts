import { create } from "zustand";
import type { AppHealth, BootstrapResponse, ServerTelemetry } from "../../shared/contracts/app";
import type { ServerProfile } from "../../shared/schemas/server";
import type { AppSettings, SettingsPatch } from "../../shared/schemas/settings";
import { DEFAULT_WORKSPACE, type OperationsSnapshot, type WorkspaceDocument } from "../../shared/contracts/operations";

interface AppState {
  ready: boolean;
  busy: boolean;
  error: string | null;
  appVersion: string;
  isPackaged: boolean;
  mockProviderEnabled: boolean;
  settings: AppSettings | null;
  servers: ServerProfile[];
  health: AppHealth | null;
  telemetry: Record<string, ServerTelemetry>;
  operations: Record<string, OperationsSnapshot>;
  workspaces: Record<string, WorkspaceDocument>;
  cameraFrames: Record<string, { cameraId: string; imageDataUrl: string; timestamp: string }>;
  initialize(): Promise<() => void>;
  updateSettings(patch: SettingsPatch): Promise<void>;
  selectServer(serverId: string | null): Promise<void>;
  refreshTelemetry(serverId: string): Promise<void>;
  refreshOperations(serverId: string): Promise<void>;
  loadWorkspace(serverId: string): Promise<void>;
  saveWorkspace(serverId: string, document: WorkspaceDocument): Promise<void>;
  setBusy(busy: boolean): void;
  setError(error: string | null): void;
  upsertServer(server: ServerProfile): void;
  removeServer(serverId: string): void;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': /, "") : "Request failed";
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  busy: false,
  error: null,
  appVersion: "",
  isPackaged: false,
  mockProviderEnabled: false,
  settings: null,
  servers: [],
  health: null,
  telemetry: {},
  operations: {},
  workspaces: {},
  cameraFrames: {},
  initialize: async () => {
    try {
      const bootstrap: BootstrapResponse = await window.rcc.getBootstrap();
      set({
        ...bootstrap,
        ready: true,
        error: null,
      });
      for (const server of bootstrap.servers) {
        if (server.status === "CONNECTED") { void get().refreshTelemetry(server.id); void get().refreshOperations(server.id); }
      }
      if (bootstrap.settings.selectedServerId) void get().loadWorkspace(bootstrap.settings.selectedServerId);
      return window.rcc.onAppEvent((event) => {
        if (event.type === "server.status_changed") get().upsertServer(event.server);
        if (event.type === "server.telemetry") {
          set((state) => ({ telemetry: { ...state.telemetry, [event.telemetry.serverId]: event.telemetry } }));
        }
        if (event.type === "server.operations") set((state) => ({ operations: { ...state.operations, [event.snapshot.serverId]: event.snapshot } }));
        if (event.type === "camera.frame") set((state) => ({ cameraFrames: { ...state.cameraFrames, [event.serverId]: { cameraId: event.cameraId, imageDataUrl: event.imageDataUrl, timestamp: event.timestamp } } }));
        if (event.type === "settings.changed") set({ settings: event.settings });
      });
    } catch (error) {
      set({ ready: true, error: messageFrom(error) });
      return () => undefined;
    }
  },
  updateSettings: async (patch) => {
    try {
      const settings = await window.rcc.updateSettings(patch);
      set({ settings, error: null });
    } catch (error) {
      set({ error: messageFrom(error) });
      throw error;
    }
  },
  selectServer: async (serverId) => {
    const settings = await window.rcc.selectServer(serverId);
    set({ settings });
    if (serverId) void get().refreshTelemetry(serverId);
    if (serverId) { void get().refreshOperations(serverId); void get().loadWorkspace(serverId); }
  },
  refreshTelemetry: async (serverId) => {
    const telemetry = await window.rcc.getTelemetry(serverId);
    if (telemetry) set((state) => ({ telemetry: { ...state.telemetry, [serverId]: telemetry } }));
  },
  refreshOperations: async (serverId) => {
    const snapshot = await window.rcc.getOperations(serverId);
    if (snapshot) set((state) => ({ operations: { ...state.operations, [serverId]: snapshot } }));
  },
  loadWorkspace: async (serverId) => {
    const document = await window.rcc.getWorkspace(serverId);
    set((state) => ({ workspaces: { ...state.workspaces, [serverId]: document } }));
  },
  saveWorkspace: async (serverId, document) => {
    const saved = await window.rcc.saveWorkspace(serverId, document);
    set((state) => ({ workspaces: { ...state.workspaces, [serverId]: saved } }));
  },
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  upsertServer: (server) =>
    set((state) => {
      const next = state.servers.some((item) => item.id === server.id)
        ? state.servers.map((item) => (item.id === server.id ? server : item))
        : [...state.servers, server];
      next.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
      return { servers: next };
    }),
  removeServer: (serverId) =>
    set((state) => ({
      servers: state.servers.filter((server) => server.id !== serverId),
      telemetry: Object.fromEntries(Object.entries(state.telemetry).filter(([id]) => id !== serverId)),
      operations: Object.fromEntries(Object.entries(state.operations).filter(([id]) => id !== serverId)),
      workspaces: Object.fromEntries(Object.entries(state.workspaces).filter(([id]) => id !== serverId)),
    })),
}));

export function useSelectedWorkspace(): WorkspaceDocument {
  return useAppStore((state) => state.settings?.selectedServerId ? state.workspaces[state.settings.selectedServerId] ?? DEFAULT_WORKSPACE : DEFAULT_WORKSPACE);
}

export function useSelectedServer(): ServerProfile | null {
  return useAppStore((state) =>
    state.servers.find((server) => server.id === state.settings?.selectedServerId) ?? null,
  );
}
