export interface IntegrationEgressPort {
  send(integrationId: string, text: string, recipient?: string): Promise<void>;
}

export interface IncomingIntegrationMessage {
  integrationId: string;
  kind: "telegram" | "whatsapp" | "external_chat" | "email";
  senderId: string;
  text: string;
  event?: string;
  externalThreadId?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationTransport {
  readonly type: "telegram" | "whatsapp";
  start(handler: (message: { senderId: string; text: string }) => void, onQr?: (qr: string) => void): Promise<void>;
  send(senderId: string, text: string): Promise<void>;
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
