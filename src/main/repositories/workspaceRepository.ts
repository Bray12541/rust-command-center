import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { DEFAULT_WORKSPACE, workspaceDocumentSchema, type WorkspaceDocument } from "../../shared/contracts/operations";
import * as schema from "../database/schema";

export class WorkspaceRepository {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  get(serverId: string): WorkspaceDocument {
    const record = this.db.select().from(schema.settings).where(eq(schema.settings.key, `workspace:${serverId}`)).get();
    if (!record) return structuredClone(DEFAULT_WORKSPACE);
    try {
      const parsed = workspaceDocumentSchema.safeParse(JSON.parse(record.value));
      return parsed.success ? parsed.data : structuredClone(DEFAULT_WORKSPACE);
    } catch {
      return structuredClone(DEFAULT_WORKSPACE);
    }
  }

  save(serverId: string, document: WorkspaceDocument): WorkspaceDocument {
    const validated = workspaceDocumentSchema.parse(document);
    const updatedAt = new Date().toISOString();
    this.db.insert(schema.settings).values({ key: `workspace:${serverId}`, value: JSON.stringify(validated), updatedAt })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: JSON.stringify(validated), updatedAt } }).run();
    return validated;
  }

  delete(serverId: string): void {
    this.db.delete(schema.settings).where(eq(schema.settings.key, `workspace:${serverId}`)).run();
  }
}
