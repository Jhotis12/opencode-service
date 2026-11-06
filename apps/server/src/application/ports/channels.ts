export interface EgressSendResult {
  providerMessageId?: string;
}

export interface OutgoingMedia {
  bytes: Uint8Array;
  filename: string;
  mime: string;
  caption?: string;
  durationSeconds?: number;
}

export interface IntegrationEgressPort {
  send(integrationId: string, text: string, recipient?: string): Promise<EgressSendResult>;
  sendMedia?(integrationId: string, media: OutgoingMedia, recipient?: string): Promise<EgressSendResult>;
}

export interface IncomingAttachment {
  kind: "image" | "audio";
  filename: string;
  mime: string;
  bytes: Uint8Array;
  durationSeconds?: number;
}

export interface IncomingIntegrationMessage {
  integrationId: string;
  kind: "telegram" | "whatsapp" | "external_chat" | "email";
  senderId: string;
  text: string;
  externalMessageId?: string;
  event?: string;
  externalThreadId?: string;
  attachments?: IncomingAttachment[];
  metadata?: Record<string, unknown>;
}

export interface IntegrationTransport {
  readonly type: "telegram" | "whatsapp";
  start(
    handler: (message: {
      senderId: string;
      text: string;
      messageId?: string;
      attachments?: IncomingAttachment[];
    }) => void | Promise<void>,
    onQr?: (qr: string) => void,
  ): Promise<void>;
  send(senderId: string, text: string): Promise<EgressSendResult | void>;
  stop(): Promise<void>;
  status(): string;
}

export interface TriggerRef {
  projectSlug: string;
  workflowId: string;
  nodeId: string;
  integrationId: string;
  event: string;
}
