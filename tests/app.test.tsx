import { render, screen } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/renderer/app/App";
import { DEFAULT_SETTINGS } from "../src/shared/schemas/settings";
import { DEFAULT_CONNECTED_SERVICES, DEFAULT_SERVER_OWNER } from "../src/shared/contracts/connectedServices";

describe("App", () => {
  beforeEach(() => {
    window.rcc = {
      getBootstrap: vi.fn().mockResolvedValue({
        appVersion: "0.1.0",
        platform: "win32",
        isPackaged: false,
        mockProviderEnabled: true,
        settings: { ...DEFAULT_SETTINGS, onboardingComplete: true },
        servers: [],
        health: { database: "healthy", rustplus: "idle", scheduler: "idle", notificationQueue: "idle", checkedAt: new Date().toISOString() },
      }),
      updateSettings: vi.fn(), createServer: vi.fn(), connectServer: vi.fn(), disconnectServer: vi.fn(),
      archiveServer: vi.fn(), favoriteServer: vi.fn(), testEndpoint: vi.fn(), deleteServer: vi.fn(), selectServer: vi.fn(), getTelemetry: vi.fn(),
      getOperations: vi.fn().mockResolvedValue(null), executeCommand: vi.fn(),
      getWorkspace: vi.fn().mockResolvedValue({ pins: [], routes: [], zones: [], devices: [], cameras: [], memberProfiles: {}, tasks: [], notes: [], checklists: [], shoppingList: [], shopFavorites: [], itemWatchlist: [], chatTemplates: [], automationRules: [], mutedChat: false, quietHours: { enabled: false, start: "22:00", end: "07:00" }, automationPaused: false, activity: [], positionHistory: [] }),
      saveWorkspace: vi.fn(), exportData: vi.fn(), importData: vi.fn(), setAlwaysOnTop: vi.fn(), showNotification: vi.fn(), sendWebhook: vi.fn(), openExternal: vi.fn(), openPanelWindow: vi.fn(),
      onAppEvent: vi.fn().mockReturnValue(() => undefined),
      getUpdateState: vi.fn().mockResolvedValue({
        phase: "disabled", currentVersion: "0.2.0", availableVersion: null,
        progress: null, message: "Update checks are available in packaged builds", canAutoUpdate: false, releaseNotes: null,
      }),
      checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), installUpdate: vi.fn(), openReleases: vi.fn(),
      onUpdateState: vi.fn().mockReturnValue(() => undefined),
      getSuiteState: vi.fn().mockResolvedValue({ connected: DEFAULT_CONNECTED_SERVICES, owner: DEFAULT_SERVER_OWNER, extensions: [], rconStatuses: {}, rconLines: [], ownerMetrics: [], ownerEvents: [], mobileUrl: null, bridgeUrl: null }), saveConnectedServices: vi.fn(), saveServerOwner: vi.fn(), testConnectedService: vi.fn(),
      profileSync: vi.fn(), sharedWorkspaceSync: vi.fn(), sendDiscordMessage: vi.fn(), chooseDirectory: vi.fn(),
      rconConnect: vi.fn(), rconDisconnect: vi.fn(), rconCommand: vi.fn(), ownerAction: vi.fn(), readServerConfig: vi.fn(),
      saveServerConfig: vi.fn(), runServerBackup: vi.fn(), openExtensionsFolder: vi.fn(), setExtensionEnabled: vi.fn(),
    };
  });

  it("renders an honest empty dashboard without sample server values", async () => {
    render(<HashRouter><App /></HashRouter>);
    expect(await screen.findByText("Pair a server to begin")).toBeInTheDocument();
    expect(screen.getByText(/never invents live player or map data/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Map layers" })).toBeDisabled();
  });
});
