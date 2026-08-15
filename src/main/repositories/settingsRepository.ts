import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { appSettingsSchema, DEFAULT_SETTINGS, type AppSettings, type SettingsPatch } from "../../shared/schemas/settings";
import * as schema from "../database/schema";

const SETTINGS_KEY = "application";

export class SettingsRepository {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  get(): AppSettings {
    const record = this.db.select().from(schema.settings).where(eq(schema.settings.key, SETTINGS_KEY)).get();
    if (!record) return DEFAULT_SETTINGS;
    const parsed = appSettingsSchema.safeParse(JSON.parse(record.value));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  }

  update(patch: SettingsPatch): AppSettings {
    const next = appSettingsSchema.parse({ ...this.get(), ...patch });
    const updatedAt = new Date().toISOString();
    this.db
      .insert(schema.settings)
      .values({ key: SETTINGS_KEY, value: JSON.stringify(next), updatedAt })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: JSON.stringify(next), updatedAt },
      })
      .run();
    return next;
  }
}
