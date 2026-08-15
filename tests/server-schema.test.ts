import { describe, expect, it } from "vitest";
import { createServerRequestSchema } from "../src/shared/schemas/server";

describe("createServerRequestSchema", () => {
  it("preserves 64-bit Steam identifiers as strings", () => {
    const parsed = createServerRequestSchema.parse({
      name: "Main",
      address: "rust.example.com",
      port: "28017",
      playerId: "76561198012345678",
      playerToken: "-123456789",
      provider: "live",
      favorite: true,
      autoConnect: true,
    });
    expect(parsed.playerId).toBe("76561198012345678");
    expect(parsed.port).toBe(28017);
  });

  it("rejects loopback for a live provider", () => {
    const result = createServerRequestSchema.safeParse({
      name: "Unsafe live profile",
      address: "127.0.0.1",
      port: 28017,
      playerId: "76561198012345678",
      playerToken: "1",
      provider: "live",
      favorite: false,
      autoConnect: false,
    });
    expect(result.success).toBe(false);
  });
});
