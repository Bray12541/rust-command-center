import { EventEmitter } from "node:events";
import type { AppEvent } from "../contracts/app";

export class AppEventBus {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  publish(event: AppEvent): void {
    this.emitter.emit("event", event);
    this.emitter.emit(event.type, event);
  }

  subscribe(listener: (event: AppEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  subscribeTo<T extends AppEvent["type"]>(
    type: T,
    listener: (event: Extract<AppEvent, { type: T }>) => void,
  ): () => void {
    const wrapped = listener as (event: AppEvent) => void;
    this.emitter.on(type, wrapped);
    return () => this.emitter.off(type, wrapped);
  }
}
