import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const servers = sqliteTable(
  "servers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    port: integer("port").notNull(),
    steamServerId: text("steam_server_id"),
    provider: text("provider", { enum: ["live", "mock"] }).notNull().default("live"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    autoConnect: integer("auto_connect", { mode: "boolean" }).notNull().default(true),
    status: text("status").notNull().default("DISCONNECTED"),
    statusReason: text("status_reason"),
    lastConnectedAt: text("last_connected_at"),
    lastPacketAt: text("last_packet_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("servers_archived_idx").on(table.archived),
    index("servers_favorite_idx").on(table.favorite),
  ],
);

export const telemetry = sqliteTable(
  "server_telemetry",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: text("payload").notNull(),
    observedAt: text("observed_at").notNull(),
  },
  (table) => [index("telemetry_server_time_idx").on(table.serverId, table.observedAt)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id").references(() => servers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    result: text("result").notNull(),
    metadata: text("metadata"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("audit_created_idx").on(table.createdAt)],
);
