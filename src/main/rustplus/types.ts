import type { ServerTelemetry } from "../../shared/contracts/app";
import type { OperationsSnapshot, RustPlusCommand } from "../../shared/contracts/operations";
import type { ProviderKind, ServerProfile } from "../../shared/schemas/server";
import type { RustPlusCredentials } from "../security/credentialVault";

export interface RustPlusCapabilities {
  serverInfo: boolean;
  rustTime: boolean;
  teamInfo: boolean;
  teamChat: boolean;
  map: boolean;
  mapMarkers: boolean;
  smartDevices: boolean;
  cameras: boolean;
}

export type ProviderEvent =
  | { type: "connected" }
  | { type: "disconnected"; reason?: string }
  | { type: "packet" }
  | { type: "data_changed" }
  | { type: "camera_frame"; cameraId: string; imageDataUrl: string }
  | { type: "error"; error: Error };

export interface RustPlusProvider {
  readonly kind: ProviderKind;
  readonly capabilities: RustPlusCapabilities;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getServerTelemetry(): Promise<Omit<ServerTelemetry, "serverId" | "observedAt">>;
  getOperationsSnapshot(deviceIds: number[]): Promise<Omit<OperationsSnapshot, "serverId" | "observedAt">>;
  execute(command: RustPlusCommand): Promise<void>;
  subscribe(listener: (event: ProviderEvent) => void): () => void;
}

export interface RustPlusProviderFactory {
  create(server: ServerProfile, credentials: RustPlusCredentials): RustPlusProvider;
}
