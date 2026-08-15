import type { AppHealth } from "../../shared/contracts/app";
import { ServerRepository } from "../repositories/serverRepository";

export class AppHealthService {
  constructor(private readonly servers: ServerRepository) {}

  snapshot(): AppHealth {
    const active = this.servers.list().filter((server) => !server.archived);
    const connected = active.filter((server) => server.status === "CONNECTED");
    const failing = active.filter((server) => server.status === "ERROR");
    return {
      database: "healthy",
      rustplus:
        active.length === 0 ? "idle" : failing.length > 0 && connected.length === 0 ? "degraded" : "healthy",
      scheduler: "idle",
      notificationQueue: "idle",
      checkedAt: new Date().toISOString(),
    };
  }
}
