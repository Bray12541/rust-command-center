import { z } from "zod";
import { appSettingsSchema } from "../schemas/settings";
import { serverProfileSchema } from "../schemas/server";
import { operationsSnapshotSchema } from "./operations";

export const serverTelemetrySchema = z.object({
  serverId: z.string().uuid(),
  name: z.string().nullable(),
  players: z.number().int().nonnegative().nullable(),
  maxPlayers: z.number().int().positive().nullable(),
  queuedPlayers: z.number().int().nonnegative().nullable(),
  mapSize: z.number().int().positive().nullable(),
  mapName: z.string().nullable(),
  mapSeed: z.number().int().nullable(),
  headerImage: z.string().nullable(),
  logoImage: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  wipeTime: z.string().datetime().nullable(),
  rustTime: z.string().nullable(),
  rustTimeDecimal: z.number().min(0).max(24).nullable(),
  sunrise: z.number().min(0).max(24).nullable(),
  sunset: z.number().min(0).max(24).nullable(),
  dayLengthMinutes: z.number().positive().nullable(),
  latencyMs: z.number().nonnegative().nullable(),
  connectedAt: z.string().datetime().nullable(),
  reconnectCount: z.number().int().nonnegative(),
  connectionQuality: z.enum(["excellent", "good", "fair", "poor", "offline"]),
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
    type: z.literal("server.operations"),
    snapshot: operationsSnapshotSchema,
    timestamp: z.string().datetime(),
  }),
  z.object({
    type: z.literal("camera.frame"),
    serverId: z.string().uuid(),
    cameraId: z.string(),
    imageDataUrl: z.string().startsWith("data:image/png;base64,"),
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
