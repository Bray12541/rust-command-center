import { and, asc, desc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ConnectionState, ProviderKind, ServerProfile } from "../../shared/schemas/server";
import * as schema from "../database/schema";

type ServerRow = typeof schema.servers.$inferSelect;

function mapServer(row: ServerRow): ServerProfile {
  return {
    ...row,
    provider: row.provider as ProviderKind,
    status: row.status as ConnectionState,
  };
}

export class ServerRepository {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  list(includeArchived = false): ServerProfile[] {
    const query = this.db
      .select()
      .from(schema.servers)
      .orderBy(desc(schema.servers.favorite), asc(schema.servers.name));
    const rows = includeArchived
      ? query.all()
      : query.where(eq(schema.servers.archived, false)).all();
    return rows.map(mapServer);
  }

  get(id: string): ServerProfile | null {
    const row = this.db.select().from(schema.servers).where(eq(schema.servers.id, id)).get();
    return row ? mapServer(row) : null;
  }

  create(input: {
    id: string;
    name: string;
    address: string;
    port: number;
    provider: ProviderKind;
    favorite: boolean;
    autoConnect: boolean;
  }): ServerProfile {
    const now = new Date().toISOString();
    this.db
      .insert(schema.servers)
      .values({
        ...input,
        status: "DISCONNECTED",
        archived: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return this.require(input.id);
  }

  updateStatus(
    id: string,
    status: ConnectionState,
    options: { reason?: string | null; packetReceived?: boolean } = {},
  ): ServerProfile {
    const now = new Date().toISOString();
    this.db
      .update(schema.servers)
      .set({
        status,
        statusReason: options.reason ?? null,
        updatedAt: now,
        ...(status === "CONNECTED" ? { lastConnectedAt: now } : {}),
        ...(options.packetReceived ? { lastPacketAt: now } : {}),
      })
      .where(eq(schema.servers.id, id))
      .run();
    return this.require(id);
  }

  touchPacket(id: string): void {
    const now = new Date().toISOString();
    this.db
      .update(schema.servers)
      .set({ lastPacketAt: now, updatedAt: now })
      .where(eq(schema.servers.id, id))
      .run();
  }

  setArchived(id: string, archived: boolean): ServerProfile {
    this.db
      .update(schema.servers)
      .set({ archived, autoConnect: archived ? false : undefined, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.servers.id, id)))
      .run();
    return this.require(id);
  }

  setFavorite(id: string, favorite: boolean): ServerProfile {
    this.db.update(schema.servers).set({ favorite, updatedAt: new Date().toISOString() }).where(eq(schema.servers.id, id)).run();
    return this.require(id);
  }

  delete(id: string): void {
    this.db.delete(schema.servers).where(eq(schema.servers.id, id)).run();
  }

  private require(id: string): ServerProfile {
    const server = this.get(id);
    if (!server) throw new Error("Server profile not found");
    return server;
  }
}
