import { describe, expect, it } from "vitest";
import { connectedServicesConfigSchema, DEFAULT_CONNECTED_SERVICES, DEFAULT_SERVER_OWNER, serverOwnerConfigSchema } from "../src/shared/contracts/connectedServices";

describe("connected service contracts", () => {
  it("keeps every external service and owner mode disabled by default", () => {
    const connected = connectedServicesConfigSchema.parse(DEFAULT_CONNECTED_SERVICES);
    const owner = serverOwnerConfigSchema.parse(DEFAULT_SERVER_OWNER);
    expect(connected.discord.enabled).toBe(false);
    expect(connected.mobileDashboard.enabled).toBe(false);
    expect(connected.telemetry.analyticsEnabled).toBe(false);
    expect(connected.telemetry.crashReportsEnabled).toBe(false);
    expect(owner.enabled).toBe(false);
    expect(owner.bridge.enabled).toBe(false);
  });

  it("rejects non-HTTPS hosted endpoints", () => {
    expect(() => connectedServicesConfigSchema.parse({ ...DEFAULT_CONNECTED_SERVICES, sharedWorkspace: { ...DEFAULT_CONNECTED_SERVICES.sharedWorkspace, endpointUrl: "http://example.com" } })).toThrow();
  });
});
