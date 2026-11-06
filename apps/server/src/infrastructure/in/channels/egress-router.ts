import type { EgressSendResult, IntegrationEgressPort, OutgoingMedia } from "../../../application/ports/channels.ts";

export class IntegrationEgressRouter implements IntegrationEgressPort {
  private readonly senders = new Map<string, (text: string, recipient?: string) => Promise<EgressSendResult>>();
  private readonly mediaSenders = new Map<
    string,
    (media: OutgoingMedia, recipient?: string) => Promise<EgressSendResult>
  >();

  register(integrationId: string, sender: (text: string, recipient?: string) => Promise<EgressSendResult>): void {
    this.senders.set(integrationId, sender);
  }

  registerMedia(
    integrationId: string,
    sender: (media: OutgoingMedia, recipient?: string) => Promise<EgressSendResult>,
  ): void {
    this.mediaSenders.set(integrationId, sender);
  }

  unregister(integrationId: string): void {
    this.senders.delete(integrationId);
    this.mediaSenders.delete(integrationId);
  }

  async send(integrationId: string, text: string, recipient?: string): Promise<EgressSendResult> {
    const sender = this.senders.get(integrationId);
    if (!sender) throw new Error(`no transport registered for integration: ${integrationId}`);
    return sender(text, recipient);
  }

  async sendMedia(integrationId: string, media: OutgoingMedia, recipient?: string): Promise<EgressSendResult> {
    const sender = this.mediaSenders.get(integrationId);
    if (!sender) throw new Error(`no media transport registered for integration: ${integrationId}`);
    return sender(media, recipient);
  }
}
