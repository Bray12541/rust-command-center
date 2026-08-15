// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { MockRustPlusProvider } from "../src/main/rustplus/mockProvider";

describe("MockRustPlusProvider", () => {
  it("labels every generated observation as simulation", async () => {
    vi.useFakeTimers();
    const provider = new MockRustPlusProvider();
    const connected = provider.connect();
    await vi.advanceTimersByTimeAsync(200);
    await connected;
    const observation = await provider.getServerTelemetry();
    expect(observation.source).toBe("simulation");
    expect(observation.players).toBeLessThanOrEqual(observation.maxPlayers!);
    await provider.disconnect();
    vi.useRealTimers();
  });
});
