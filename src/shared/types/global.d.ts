import type { RustCommandCenterApi } from "../contracts/ipc";

declare global {
  interface Window {
    rcc: RustCommandCenterApi;
  }
}

export {};
