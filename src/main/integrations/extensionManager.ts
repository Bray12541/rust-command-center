import fs from "node:fs";
import path from "node:path";
import { shell } from "electron";
import { extensionManifestSchema, type InstalledExtension } from "../../shared/contracts/connectedServices";

export class ExtensionManager {
  private readonly directory: string;
  private readonly statePath: string;

  constructor(userDataPath: string) {
    this.directory = path.join(userDataPath, "extensions");
    this.statePath = path.join(this.directory, ".state.json");
    fs.mkdirSync(this.directory, { recursive: true });
  }

  list(): InstalledExtension[] {
    const state = this.readState();
    return fs.readdirSync(this.directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((entry) => {
      try {
        const manifest = extensionManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(this.directory, entry.name, "manifest.json"), "utf8")));
        const saved = state[manifest.id];
        return [{ ...manifest, enabled: saved?.enabled ?? false, approvedPermissions: saved?.approvedPermissions?.filter((permission) => manifest.permissions.includes(permission)) ?? [] }];
      } catch { return []; }
    });
  }

  setEnabled(id: string, enabled: boolean, approvedPermissions: InstalledExtension["approvedPermissions"]): InstalledExtension[] {
    const extension = this.list().find((item) => item.id === id);
    if (!extension) throw new Error("Extension manifest was not found");
    if (enabled && extension.permissions.some((permission) => !approvedPermissions.includes(permission))) throw new Error("Approve every requested permission before enabling this extension");
    const state = this.readState(); state[id] = { enabled, approvedPermissions }; this.writeState(state); return this.list();
  }

  async openFolder(): Promise<void> { await shell.openPath(this.directory); }

  private readState(): Record<string, { enabled: boolean; approvedPermissions: InstalledExtension["approvedPermissions"] }> {
    try { return JSON.parse(fs.readFileSync(this.statePath, "utf8")); } catch { return {}; }
  }
  private writeState(state: Record<string, unknown>): void { fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), { mode: 0o600 }); }
}
