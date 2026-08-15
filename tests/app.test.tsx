import { render, screen } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/renderer/app/App";
import { DEFAULT_SETTINGS } from "../src/shared/schemas/settings";

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
      archiveServer: vi.fn(), deleteServer: vi.fn(), selectServer: vi.fn(), getTelemetry: vi.fn(),
      onAppEvent: vi.fn().mockReturnValue(() => undefined),
      getUpdateState: vi.fn().mockResolvedValue({
        phase: "disabled", currentVersion: "0.2.0", availableVersion: null,
        progress: null, message: "Update checks are available in packaged builds", canAutoUpdate: false,
      }),
      checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), installUpdate: vi.fn(), openReleases: vi.fn(),
      onUpdateState: vi.fn().mockReturnValue(() => undefined),
    };
  });

  it("renders an honest empty dashboard without sample server values", async () => {
    render(<HashRouter><App /></HashRouter>);
    expect(await screen.findByText("Pair a server to begin")).toBeInTheDocument();
    expect(screen.getByText(/No map or player data is generated locally/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Monuments/ }).every((button) => button.hasAttribute("disabled"))).toBe(true);
  });
});
