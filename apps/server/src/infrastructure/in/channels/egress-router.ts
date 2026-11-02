import type { ChannelEgressPort } from "../../../application/ports/channels.ts";

export class ChannelEgressRouter implements ChannelEgressPort {
  private readonly senders = new Map<string, (text: string, recipient?: string) => Promise<void>>();

  register(channelSlug: string, sender: (text: string, recipient?: string) => Promise<void>): void {
    this.senders.set(channelSlug, sender);
  }

  unregister(channelSlug: string): void {
    this.senders.delete(channelSlug);
  }

  async send(channelSlug: string, text: string, recipient?: string): Promise<void> {
    const sender = this.senders.get(channelSlug);
    if (!sender) throw new Error(`no transport registered for channel: ${channelSlug}`);
    await sender(text, recipient);
  }
}
