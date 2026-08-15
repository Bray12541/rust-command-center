import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { Logger } from "pino";

const bundledMigrationNames = ["0001_foundation.sql"] as const;

function resolveMigrationDirectory(isPackaged: boolean, resourcesPath: string): string {
  return isPackaged
    ? path.join(resourcesPath, "migrations")
    : path.join(process.cwd(), "src", "main", "database", "sql");
}

export function runMigrations(
  sqlite: Database.Database,
  options: { isPackaged: boolean; resourcesPath: string; logger: Logger },
): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationDirectory = resolveMigrationDirectory(options.isPackaged, options.resourcesPath);
  const alreadyApplied = sqlite.prepare("SELECT 1 FROM _migrations WHERE name = ?");
  const recordMigration = sqlite.prepare(
    "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
  );

  for (const name of bundledMigrationNames) {
    if (alreadyApplied.get(name)) continue;
    const filePath = path.join(migrationDirectory, name);
    const sql = fs.readFileSync(filePath, "utf8");
    sqlite.transaction(() => {
      sqlite.exec(sql);
      recordMigration.run(name, new Date().toISOString());
    })();
    options.logger.info({ service: "database", migration: name }, "Database migration applied");
  }
}
