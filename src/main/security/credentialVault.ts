import fs from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";
import { z } from "zod";

const credentialSchema = z.object({
  playerId: z.string(),
  playerToken: z.string(),
});

const vaultSchema = z.record(z.string(), z.string());

export type RustPlusCredentials = z.infer<typeof credentialSchema>;

export class CredentialVault {
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "secure", "credentials.json");
  }

  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  save(serverId: string, credentials: RustPlusCredentials): void {
    if (!this.isAvailable()) throw new Error("Windows credential encryption is not available");
    const vault = this.readVault();
    const encrypted = safeStorage.encryptString(JSON.stringify(credentialSchema.parse(credentials)));
    vault[serverId] = encrypted.toString("base64");
    this.writeVault(vault);
  }

  get(serverId: string): RustPlusCredentials | null {
    if (!this.isAvailable()) return null;
    const encoded = this.readVault()[serverId];
    if (!encoded) return null;
    try {
      const decrypted = safeStorage.decryptString(Buffer.from(encoded, "base64"));
      return credentialSchema.parse(JSON.parse(decrypted));
    } catch {
      return null;
    }
  }

  delete(serverId: string): void {
    const vault = this.readVault();
    delete vault[serverId];
    this.writeVault(vault);
  }

  private readVault(): Record<string, string> {
    if (!fs.existsSync(this.filePath)) return {};
    try {
      return vaultSchema.parse(JSON.parse(fs.readFileSync(this.filePath, "utf8")));
    } catch {
      return {};
    }
  }

  private writeVault(vault: Record<string, string>): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(vault), { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporaryPath, this.filePath);
  }
}
