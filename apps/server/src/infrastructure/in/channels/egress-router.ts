import type { IntegrationEgressPort } from "../../../application/ports/channels.ts";

export class IntegrationEgressRouter implements IntegrationEgressPort {
  private readonly senders = new Map<string, (text: string, recipient?: string) => Promise<void>>();

  register(integrationId: string, sender: (text: string, recipient?: string) => Promise<void>): void {
    this.senders.set(integrationId, sender);
  }

  unregister(integrationId: string): void {
    this.senders.delete(integrationId);
  }

  async send(integrationId: string, text: string, recipient?: string): Promise<void> {
    const sender = this.senders.get(integrationId);
    if (!sender) throw new Error(`no transport registered for integration: ${integrationId}`);
    await sender(text, recipient);
  }
}
