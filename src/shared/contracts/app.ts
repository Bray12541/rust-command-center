import { z } from "zod";
import { appSettingsSchema } from "../schemas/settings";
import { serverProfileSchema } from "../schemas/server";

export const serverTelemetrySchema = z.object({
  serverId: z.string().uuid(),
  name: z.string().nullable(),
  players: z.number().int().nonnegative().nullable(),
  maxPlayers: z.number().int().positive().nullable(),
  queuedPlayers: z.number().int().nonnegative().nullable(),
  mapSize: z.number().int().positive().nullable(),
  wipeTime: z.string().datetime().nullable(),
  rustTime: z.string().nullable(),
  latencyMs: z.number().nonnegative().nullable(),
  source: z.enum(["live", "simulation"]),
  observedAt: z.string().datetime(),
});

export const appHealthSchema = z.object({
  database: z.enum(["healthy", "degraded"]),
  rustplus: z.enum(["healthy", "degraded", "idle"]),
  scheduler: z.enum(["healthy", "idle"]),
  notificationQueue: z.enum(["healthy", "idle"]),
  checkedAt: z.string().datetime(),
});

export const bootstrapResponseSchema = z.object({
  appVersion: z.string(),
  platform: z.string(),
  isPackaged: z.boolean(),
  mockProviderEnabled: z.boolean(),
  settings: appSettingsSchema,
  servers: z.array(serverProfileSchema),
  health: appHealthSchema,
});

export const appEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("server.status_changed"),
    server: serverProfileSchema,
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal("server.telemetry"),
    telemetry: serverTelemetrySchema,
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal("settings.changed"),
    settings: appSettingsSchema,
    timestamp: z.string().datetime(),
  }),
]);

export type ServerTelemetry = z.infer<typeof serverTelemetrySchema>;
export type AppHealth = z.infer<typeof appHealthSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
export type AppEvent = z.infer<typeof appEventSchema>;
