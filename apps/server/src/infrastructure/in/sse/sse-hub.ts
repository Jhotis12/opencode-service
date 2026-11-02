import type { SseEvent } from "@platform/shared";
import type { EventBus } from "../../../application/ports/events.ts";

export class SseHub implements EventBus {
  private readonly clients = new Set<(event: SseEvent) => void>();

  publish(event: SseEvent): void {
    for (const client of this.clients) {
      try {
        client(event);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  subscribe(client: (event: SseEvent) => void): () => void {
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
