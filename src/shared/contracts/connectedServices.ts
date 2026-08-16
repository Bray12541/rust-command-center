import { z } from "zod";

const safeIdentifier = z.string().trim().max(80);
const optionalHttpsUrl = z.union([z.literal(""), z.string().url().refine((value) => value.startsWith("https://"), "URL must use HTTPS")]);

export const connectedServicesConfigSchema = z.object({
  discord: z.object({
    enabled: z.boolean(), applicationId: safeIdentifier, guildId: safeIdentifier, channelId: safeIdentifier,
    commandPrefix: z.string().trim().min(1).max(8), allowedRoleIds: z.array(safeIdentifier).max(20), hasToken: z.boolean(),
  }),
  profileSync: z.object({
    enabled: z.boolean(), folderPath: z.string().trim().max(500), autoSync: z.boolean(), hasPassphrase: z.boolean(), lastSyncAt: z.string().datetime().nullable(),
  }),
  mobileDashboard: z.object({
    enabled: z.boolean(), bindAddress: z.enum(["127.0.0.1", "0.0.0.0"]), port: z.number().int().min(1024).max(65535), hasToken: z.boolean(),
  }),
  sharedWorkspace: z.object({
    enabled: z.boolean(), endpointUrl: optionalHttpsUrl, workspaceId: safeIdentifier, autoSync: z.boolean(), hasToken: z.boolean(), lastSyncAt: z.string().datetime().nullable(),
  }),
  telemetry: z.object({
    analyticsEnabled: z.boolean(), crashReportsEnabled: z.boolean(), endpointUrl: optionalHttpsUrl, privacyPolicyUrl: optionalHttpsUrl, hasToken: z.boolean(),
  }),
});

export const DEFAULT_CONNECTED_SERVICES: ConnectedServicesConfig = {
  discord: { enabled: false, applicationId: "", guildId: "", channelId: "", commandPrefix: "!rcc", allowedRoleIds: [], hasToken: false },
  profileSync: { enabled: false, folderPath: "", autoSync: false, hasPassphrase: false, lastSyncAt: null },
  mobileDashboard: { enabled: false, bindAddress: "127.0.0.1", port: 47831, hasToken: false },
  sharedWorkspace: { enabled: false, endpointUrl: "", workspaceId: "", autoSync: false, hasToken: false, lastSyncAt: null },
  telemetry: { analyticsEnabled: false, crashReportsEnabled: false, endpointUrl: "", privacyPolicyUrl: "", hasToken: false },
};

export const ownerProfileSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(80), address: z.string().trim().min(1).max(253),
  port: z.number().int().min(1).max(65535), serverId: z.string().uuid().nullable(), autoConnect: z.boolean(),
  localServerPath: z.string().trim().max(500), backupPath: z.string().trim().max(500), hasPassword: z.boolean(),
});

export const ownerScheduleSchema = z.object({
  id: z.string().uuid(), profileId: z.string().uuid(), kind: z.enum(["restart", "save", "backup", "wipe-prep"]),
  enabled: z.boolean(), runAt: z.string().datetime(), repeat: z.enum(["never", "daily", "weekly"]),
  announceMinutes: z.array(z.number().int().min(1).max(1440)).max(8), announcedMinutes: z.array(z.number().int().min(1).max(1440)).max(8).default([]), lastRunAt: z.string().datetime().nullable(),
});

export const serverOwnerConfigSchema = z.object({
  enabled: z.boolean(),
  profiles: z.array(ownerProfileSchema).max(50),
  schedules: z.array(ownerScheduleSchema).max(200),
  bridge: z.object({ enabled: z.boolean(), bindAddress: z.enum(["127.0.0.1", "0.0.0.0"]), port: z.number().int().min(1024).max(65535), hasToken: z.boolean() }),
});

export const DEFAULT_SERVER_OWNER: ServerOwnerConfig = {
  enabled: false, profiles: [], schedules: [], bridge: { enabled: false, bindAddress: "127.0.0.1", port: 47832, hasToken: false },
};

export const extensionManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9.-]{2,80}$/), name: z.string().trim().min(1).max(80), version: z.string().trim().min(1).max(30),
  description: z.string().trim().max(240), author: z.string().trim().max(80),
  permissions: z.array(z.enum(["open-external", "read-server-summary", "read-workspace", "theme"])).max(8),
  theme: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), background: z.string().regex(/^#[0-9a-fA-F]{6}$/), panel: z.string().regex(/^#[0-9a-fA-F]{6}$/), text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).optional(),
  links: z.array(z.object({ label: z.string().trim().min(1).max(40), url: z.string().url().refine((url) => url.startsWith("https://")) })).max(10).default([]),
});

export const installedExtensionSchema = extensionManifestSchema.extend({ enabled: z.boolean(), approvedPermissions: extensionManifestSchema.shape.permissions });

export const ownerEventSchema = z.object({
  id: z.string(), profileId: z.string().uuid().nullable(), type: z.enum(["raid", "death", "authorization", "plugin", "performance", "server", "custom"]),
  severity: z.enum(["info", "warning", "critical"]), title: z.string().max(120), message: z.string().max(1000), metadata: z.record(z.string(), z.unknown()), createdAt: z.string().datetime(),
});

export const rconLineSchema = z.object({ profileId: z.string().uuid(), identifier: z.number().int(), type: z.enum(["input", "output", "error", "system"]), message: z.string(), createdAt: z.string().datetime() });
export const ownerMetricSchema = z.object({ profileId: z.string().uuid(), fps: z.number().finite().nullable(), memoryMb: z.number().finite().nullable(), entities: z.number().finite().nullable(), uptimeSeconds: z.number().finite().nullable(), players: z.number().finite().nullable(), createdAt: z.string().datetime() });

export const suiteStateSchema = z.object({
  connected: connectedServicesConfigSchema,
  owner: serverOwnerConfigSchema,
  extensions: z.array(installedExtensionSchema),
  rconStatuses: z.record(z.string(), z.enum(["disconnected", "connecting", "connected", "error"])),
  rconLines: z.array(rconLineSchema).max(500),
  ownerEvents: z.array(ownerEventSchema).max(500),
  ownerMetrics: z.array(ownerMetricSchema).max(1000),
  mobileUrl: z.string().nullable(), bridgeUrl: z.string().nullable(),
});

export const connectedServicesUpdateSchema = z.object({ config: connectedServicesConfigSchema, secrets: z.object({ discordToken: z.string().max(300).optional(), profilePassphrase: z.string().min(8).max(300).optional(), sharedWorkspaceToken: z.string().max(500).optional(), telemetryToken: z.string().max(500).optional(), mobileToken: z.string().min(16).max(200).optional() }).default({}) });
export const serverOwnerUpdateSchema = z.object({ config: serverOwnerConfigSchema, passwords: z.record(z.string().uuid(), z.string().min(1).max(300)).default({}), bridgeToken: z.string().min(16).max(200).optional() });

export type ConnectedServicesConfig = z.infer<typeof connectedServicesConfigSchema>;
export type ServerOwnerConfig = z.infer<typeof serverOwnerConfigSchema>;
export type OwnerProfile = z.infer<typeof ownerProfileSchema>;
export type InstalledExtension = z.infer<typeof installedExtensionSchema>;
export type OwnerEvent = z.infer<typeof ownerEventSchema>;
export type RconLine = z.infer<typeof rconLineSchema>;
export type OwnerMetric = z.infer<typeof ownerMetricSchema>;
export type SuiteState = z.infer<typeof suiteStateSchema>;
