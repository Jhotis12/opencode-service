import type { EgressSendResult, IntegrationEgressPort } from "../../../application/ports/channels.ts";

export class IntegrationEgressRouter implements IntegrationEgressPort {
  private readonly senders = new Map<string, (text: string, recipient?: string) => Promise<EgressSendResult>>();

  register(integrationId: string, sender: (text: string, recipient?: string) => Promise<EgressSendResult>): void {
    this.senders.set(integrationId, sender);
  }

  unregister(integrationId: string): void {
    this.senders.delete(integrationId);
  }

  async send(integrationId: string, text: string, recipient?: string): Promise<EgressSendResult> {
    const sender = this.senders.get(integrationId);
    if (!sender) throw new Error(`no transport registered for integration: ${integrationId}`);
    return sender(text, recipient);
  }
}
