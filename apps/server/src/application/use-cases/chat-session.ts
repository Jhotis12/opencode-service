import type { Store } from "../ports/store.ts";
import type { AgentFileAttachment, AgentRuntimePort } from "../ports/runtime.ts";
import type { ChatThreadRecord } from "../../domain/entities.ts";
import type { Logger } from "../../domain/telemetry/index.ts";

export function isSessionNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /session not found/i.test(message);
}

export interface ChatSessionFactory {
  create(): Promise<{ id: string }>;
  agentId?: string;
  model?: string;
  logger?: Logger;
}

export function registerSessionContext(
  store: Store,
  input: {
    sessionId: string;
    scope: ChatThreadRecord["scope"];
    projectSlug?: string;
    agentId?: string;
    context: "chat" | "workflow" | "external_channel";
    runId?: string;
    integrationId?: string;
    externalThreadId?: string;
  },
): void {
  const now = new Date().toISOString();
  store.sessionContexts.upsert({
    ...input,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Reuses the session stored on a chat thread, but recreates it when OpenCode
 * restarted and the old session no longer exists. The new session is persisted
 * on the same thread so later turns do not repeat the failure.
 */
export async function ensureChatSession(
  store: Store,
  agent: AgentRuntimePort,
  thread: ChatThreadRecord,
  factory: ChatSessionFactory,
): Promise<string> {
  const existing = thread.opencodeSessionId;
  if (existing) {
    try {
      if (factory.agentId) await agent.switchAgent(existing, factory.agentId);
      if (factory.model) await agent.switchModel(existing, factory.model);
      return existing;
    } catch (error) {
      if (!isSessionNotFoundError(error)) throw error;
      factory.logger?.warn({
        event: "chat_session_missing",
        threadId: thread.id,
        sessionId: existing,
      });
    }
  }
  const session = await factory.create();
  store.chatThreads.setSession(thread.id, session.id);
  registerSessionContext(store, {
    sessionId: session.id,
    scope: thread.scope,
    projectSlug: thread.projectSlug,
    agentId: factory.agentId,
    context: thread.integrationId ? "external_channel" : "chat",
    integrationId: thread.integrationId,
    externalThreadId: thread.externalThreadId,
  });
  return session.id;
}

export async function promptWithSessionRecovery(
  store: Store,
  agent: AgentRuntimePort,
  thread: ChatThreadRecord,
  sessionId: string,
  text: string,
  factory: ChatSessionFactory,
  onEvent?: (event: unknown, sessionId: string) => void,
  files?: AgentFileAttachment[],
): Promise<{ reply: string; sessionId: string }> {
  let activeSessionId = sessionId;
  let unsubscribe: (() => Promise<void> | void) | undefined;
  if (onEvent) {
    try {
      unsubscribe = await agent.subscribe((event) => onEvent(event, activeSessionId));
    } catch (error) {
      factory.logger?.warn({
        event: "chat_progress_subscription_failed",
        threadId: thread.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    try {
      return {
        reply: await agent.prompt(activeSessionId, text, files && files.length > 0 ? { files } : undefined),
        sessionId: activeSessionId,
      };
    } catch (error) {
      if (!isSessionNotFoundError(error)) throw error;
      factory.logger?.warn({
        event: "chat_session_recovered",
        threadId: thread.id,
        sessionId: activeSessionId,
      });
      const session = await factory.create();
      store.chatThreads.setSession(thread.id, session.id);
      registerSessionContext(store, {
        sessionId: session.id,
        scope: thread.scope,
        projectSlug: thread.projectSlug,
        agentId: factory.agentId,
        context: thread.integrationId ? "external_channel" : "chat",
        integrationId: thread.integrationId,
        externalThreadId: thread.externalThreadId,
      });
      activeSessionId = session.id;
      return {
        reply: await agent.prompt(activeSessionId, text, files && files.length > 0 ? { files } : undefined),
        sessionId: activeSessionId,
      };
    }
  } finally {
    await unsubscribe?.();
  }
}
