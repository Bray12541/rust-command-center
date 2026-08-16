import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  connectedServicesConfigSchema, DEFAULT_CONNECTED_SERVICES, DEFAULT_SERVER_OWNER,
  serverOwnerConfigSchema, type ConnectedServicesConfig, type ServerOwnerConfig,
} from "../../shared/contracts/connectedServices";
import * as schema from "../database/schema";

const CONNECTED_KEY = "connected-services";
const OWNER_KEY = "server-owner";

export class SuiteRepository {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  getConnected(): ConnectedServicesConfig { return this.read(CONNECTED_KEY, connectedServicesConfigSchema, DEFAULT_CONNECTED_SERVICES); }
  saveConnected(value: ConnectedServicesConfig): ConnectedServicesConfig { return this.write(CONNECTED_KEY, connectedServicesConfigSchema.parse(value)); }
  getOwner(): ServerOwnerConfig { return this.read(OWNER_KEY, serverOwnerConfigSchema, DEFAULT_SERVER_OWNER); }
  saveOwner(value: ServerOwnerConfig): ServerOwnerConfig { return this.write(OWNER_KEY, serverOwnerConfigSchema.parse(value)); }

  private read<T>(key: string, parser: { safeParse(value: unknown): { success: boolean; data?: T } }, fallback: T): T {
    const row = this.db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();
    if (!row) return structuredClone(fallback);
    try { const result = parser.safeParse(JSON.parse(row.value)); return result.success ? result.data! : structuredClone(fallback); }
    catch { return structuredClone(fallback); }
  }

  private write<T>(key: string, value: T): T {
    const updatedAt = new Date().toISOString();
    this.db.insert(schema.settings).values({ key, value: JSON.stringify(value), updatedAt })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: JSON.stringify(value), updatedAt } }).run();
    return value;
  }
}
