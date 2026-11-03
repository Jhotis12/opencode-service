export interface EgressSendResult {
  providerMessageId?: string;
}

export interface IntegrationEgressPort {
  send(integrationId: string, text: string, recipient?: string): Promise<EgressSendResult>;
}

export interface IncomingIntegrationMessage {
  integrationId: string;
  kind: "telegram" | "whatsapp" | "external_chat" | "email";
  senderId: string;
  text: string;
  externalMessageId?: string;
  event?: string;
  externalThreadId?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationTransport {
  readonly type: "telegram" | "whatsapp";
  start(
    handler: (message: { senderId: string; text: string; messageId?: string }) => void,
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
