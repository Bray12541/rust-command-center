import { z } from "zod";

const nullableNumber = z.number().finite().nullable();

export const monumentSchema = z.object({
  token: z.string(),
  x: z.number(),
  y: z.number(),
});

export const rustMapSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  oceanMargin: z.number().nonnegative(),
  imageDataUrl: z.string().startsWith("data:image/jpeg;base64,"),
  monuments: z.array(monumentSchema),
});

export const mapMarkerSchema = z.object({
  id: z.string(),
  type: z.enum(["player", "explosion", "vending", "ch47", "cargo", "crate", "radius", "patrol-heli", "unknown"]),
  x: z.number(),
  y: z.number(),
  rotation: nullableNumber,
  radius: nullableNumber,
  name: z.string().nullable(),
  outOfStock: z.boolean(),
  sellOrders: z.array(z.object({
    itemId: z.number().int(),
    quantity: z.number().int().nonnegative(),
    currencyId: z.number().int(),
    costPerItem: z.number().int().nonnegative(),
    amountInStock: z.number().int().nonnegative(),
    itemIsBlueprint: z.boolean(),
    currencyIsBlueprint: z.boolean(),
  })),
});

export const teamMemberSchema = z.object({
  steamId: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  isOnline: z.boolean(),
  isAlive: z.boolean(),
  spawnTime: z.string().datetime().nullable(),
  deathTime: z.string().datetime().nullable(),
  isLeader: z.boolean(),
});

export const mapNoteSchema = z.object({ type: z.number().int(), x: z.number(), y: z.number() });

export const teamSchema = z.object({
  leaderSteamId: z.string().nullable(),
  members: z.array(teamMemberSchema),
  mapNotes: z.array(mapNoteSchema),
  leaderMapNotes: z.array(mapNoteSchema),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  steamId: z.string(),
  name: z.string(),
  message: z.string(),
  color: z.string().nullable(),
  sentAt: z.string().datetime(),
});

export const clanSchema = z.object({
  clanId: z.string(),
  name: z.string(),
  motd: z.string(),
  motdAuthor: z.string().nullable(),
  motdTimestamp: z.string().datetime().nullable(),
  color: z.string().nullable(),
  maxMemberCount: z.number().int().nonnegative(),
  roles: z.array(z.object({ roleId: z.number().int(), name: z.string(), rank: z.number().int(), permissions: z.number() })),
  members: z.array(z.object({
    steamId: z.string(), roleId: z.number().int(), joinedAt: z.string().datetime().nullable(),
    lastSeenAt: z.string().datetime().nullable(), notes: z.string(), online: z.boolean(),
  })),
  invites: z.array(z.object({ steamId: z.string(), recruiter: z.string(), createdAt: z.string().datetime().nullable() })),
});

export const smartDeviceSchema = z.object({
  entityId: z.number().int().positive(),
  kind: z.enum(["switch", "alarm", "storage", "unknown"]),
  active: z.boolean(),
  capacity: z.number().int().nonnegative().nullable(),
  hasProtection: z.boolean().nullable(),
  protectionExpiry: z.string().datetime().nullable(),
  items: z.array(z.object({ itemId: z.number().int(), quantity: z.number().int().nonnegative(), isBlueprint: z.boolean() })),
  updatedAt: z.string().datetime(),
});

export const operationsSnapshotSchema = z.object({
  serverId: z.string().uuid(),
  map: rustMapSchema.nullable(),
  markers: z.array(mapMarkerSchema),
  team: teamSchema.nullable(),
  teamChat: z.array(chatMessageSchema),
  clan: clanSchema.nullable(),
  clanChat: z.array(chatMessageSchema),
  devices: z.array(smartDeviceSchema),
  observedAt: z.string().datetime(),
});

const pointSchema = z.object({ x: z.number(), y: z.number() });

export const workspaceDocumentSchema = z.object({
  pins: z.array(z.object({ id: z.string(), label: z.string(), category: z.string(), color: z.string(), x: z.number(), y: z.number(), note: z.string() })),
  routes: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), points: z.array(pointSchema) })),
  zones: z.array(z.object({ id: z.string(), name: z.string(), x: z.number(), y: z.number(), radius: z.number().positive(), eventTypes: z.array(z.string()), enabled: z.boolean() })),
  devices: z.array(z.object({ entityId: z.number().int().positive(), name: z.string(), kind: z.enum(["switch", "alarm", "storage", "unknown"]), group: z.string(), icon: z.string(), favorite: z.boolean(), confirmActions: z.boolean(), lowStockThreshold: z.number().int().nonnegative().nullable() })),
  cameras: z.array(z.object({ id: z.string(), name: z.string(), favorite: z.boolean(), lowRefresh: z.boolean() })),
  memberProfiles: z.record(z.string(), z.object({ nickname: z.string(), role: z.string(), color: z.string() })),
  tasks: z.array(z.object({ id: z.string(), title: z.string(), assignee: z.string(), status: z.enum(["todo", "doing", "done"]), dueAt: z.string().datetime().nullable() })),
  notes: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), scope: z.string(), x: z.number().nullable(), y: z.number().nullable(), updatedAt: z.string().datetime() })),
  checklists: z.array(z.object({ id: z.string(), name: z.string(), items: z.array(z.object({ id: z.string(), label: z.string(), done: z.boolean() })) })),
  shoppingList: z.array(z.object({ id: z.string(), itemId: z.number().int().nullable(), label: z.string(), quantity: z.number().int().positive(), done: z.boolean() })),
  shopFavorites: z.array(z.string()),
  itemWatchlist: z.array(z.number().int()),
  chatTemplates: z.array(z.object({ id: z.string(), label: z.string(), message: z.string() })),
  automationRules: z.array(z.object({
    id: z.string(), name: z.string(), enabled: z.boolean(), trigger: z.string(), triggerValue: z.string(),
    action: z.string(), actionValue: z.string(), cooldownSeconds: z.number().int().nonnegative(), severity: z.enum(["info", "warning", "critical"]), lastRunAt: z.string().datetime().nullable(),
  })),
  mutedChat: z.boolean(),
  quietHours: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }),
  automationPaused: z.boolean(),
  activity: z.array(z.object({ id: z.string(), type: z.string(), message: z.string(), severity: z.enum(["info", "warning", "critical"]), createdAt: z.string().datetime() })).max(1000),
  positionHistory: z.array(z.object({ steamId: z.string(), x: z.number(), y: z.number(), observedAt: z.string().datetime() })).max(10000),
});

export const DEFAULT_WORKSPACE: WorkspaceDocument = {
  pins: [], routes: [], zones: [], devices: [], cameras: [], memberProfiles: {}, tasks: [], notes: [], checklists: [],
  shoppingList: [], shopFavorites: [], itemWatchlist: [], chatTemplates: [], automationRules: [], mutedChat: false,
  quietHours: { enabled: false, start: "22:00", end: "07:00" }, automationPaused: false,
  activity: [],
  positionHistory: [],
};

export const rustPlusCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("send_team_message"), message: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("send_clan_message"), message: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("set_clan_motd"), message: z.string().trim().min(1).max(500) }),
  z.object({ type: z.literal("promote_to_leader"), steamId: z.string().regex(/^\d{15,20}$/) }),
  z.object({ type: z.literal("set_entity_value"), entityId: z.number().int().positive(), value: z.boolean() }),
  z.object({ type: z.literal("refresh_entity"), entityId: z.number().int().positive() }),
  z.object({ type: z.literal("camera_open"), cameraId: z.string().trim().min(1).max(64) }),
  z.object({ type: z.literal("camera_close") }),
  z.object({ type: z.literal("camera_move"), x: z.number().min(-100).max(100), y: z.number().min(-100).max(100) }),
  z.object({ type: z.literal("camera_zoom") }),
]);

export type RustMap = z.infer<typeof rustMapSchema>;
export type MapMarker = z.infer<typeof mapMarkerSchema>;
export type Team = z.infer<typeof teamSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type Clan = z.infer<typeof clanSchema>;
export type SmartDevice = z.infer<typeof smartDeviceSchema>;
export type OperationsSnapshot = z.infer<typeof operationsSnapshotSchema>;
export type WorkspaceDocument = z.infer<typeof workspaceDocumentSchema>;
export type RustPlusCommand = z.infer<typeof rustPlusCommandSchema>;
