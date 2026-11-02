export interface ChannelEgressPort {
  send(channelSlug: string, text: string, recipient?: string): Promise<void>;
}

export interface IncomingChannelMessage {
  channelSlug: string;
  channelType: "telegram" | "whatsapp" | "external_chat";
  senderId: string;
  text: string;
}

export interface ChannelTransport {
  readonly type: "telegram" | "whatsapp";
  start(handler: (message: { senderId: string; text: string }) => void): Promise<void>;
  send(senderId: string, text: string): Promise<void>;
  stop(): Promise<void>;
  status(): string;
}

export interface TriggerRef {
  projectSlug: string;
  workflowId: string;
  nodeId: string;
  channelSlug: string;
  isPublic: boolean;
}
