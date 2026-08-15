import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { Logger } from "pino";
import * as schema from "./schema";
import { runMigrations } from "./migrations";

export interface DatabaseContext {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
  close(): void;
}

export function createDatabase(options: {
  userDataPath: string;
  resourcesPath: string;
  isPackaged: boolean;
  logger: Logger;
  databasePath?: string;
}): DatabaseContext {
  const databasePath = options.databasePath ?? path.join(options.userDataPath, "data", "rcc.sqlite3");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  runMigrations(sqlite, options);

  options.logger.info({ service: "database", databasePath }, "Database opened");
  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
    close: () => {
      if (sqlite.open) sqlite.close();
    },
  };
}
