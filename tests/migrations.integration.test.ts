// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("foundation migration", () => {
  it("creates constrained server, telemetry, settings, and audit tables", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys = ON");
    const migration = fs.readFileSync(
      path.join(process.cwd(), "src", "main", "database", "sql", "0001_foundation.sql"),
      "utf8",
    );
    sqlite.exec(migration);

    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => String(row.name));
    expect(tables).toEqual(expect.arrayContaining(["settings", "servers", "server_telemetry", "audit_log"]));

    sqlite.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
      .run("application", "{}", new Date().toISOString());
    expect(sqlite.prepare("SELECT value FROM settings WHERE key = ?").get("application")?.value).toBe("{}");
    expect(() => sqlite.prepare(`
      INSERT INTO servers (id, name, address, port, provider, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("id", "Invalid", "example.invalid", 70000, "live", "now", "now")).toThrow();
    sqlite.close();
  });
});
