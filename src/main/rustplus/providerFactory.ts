import type { Logger } from "pino";
import type { ServerProfile } from "../../shared/schemas/server";
import type { RustPlusCredentials } from "../security/credentialVault";
import { LiveRustPlusProvider } from "./liveProvider";
import { MockRustPlusProvider } from "./mockProvider";
import type { RustPlusProvider, RustPlusProviderFactory } from "./types";

export class DefaultRustPlusProviderFactory implements RustPlusProviderFactory {
  constructor(
    private readonly logger: Logger,
    private readonly mockProviderEnabled: boolean,
  ) {}

  create(server: ServerProfile, credentials: RustPlusCredentials): RustPlusProvider {
    if (server.provider === "mock") {
      if (!this.mockProviderEnabled) throw new Error("Simulation provider is unavailable in production builds");
      return new MockRustPlusProvider();
    }
    return new LiveRustPlusProvider(server, credentials, this.logger);
  }
}
