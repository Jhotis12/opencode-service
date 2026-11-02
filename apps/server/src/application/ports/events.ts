import type { SseEvent } from "@platform/shared";

export interface EventBus {
  publish(event: SseEvent): void;
}
