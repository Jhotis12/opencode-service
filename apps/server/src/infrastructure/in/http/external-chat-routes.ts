import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ChatMessageRequestSchema, apiError } from "@platform/shared";
import type { Store } from "../../../application/ports/store.ts";
import type { SecretVault } from "../../../application/ports/security.ts";
import type { AgentRuntimePort } from "../../../application/ports/runtime.ts";
import type { WorkspacePort } from "../../../application/ports/workspace.ts";
import {
  ChannelAuthError,
  SendExternalChatMessageUseCase,
} from "../../../application/use-cases/external-chat.ts";
import { verifyIntegrationKey } from "../../../application/use-cases/manage-integrations.ts";
import type { ExecuteWorkflowRunUseCase } from "../../../application/use-cases/execute-workflow.ts";
import type { Logger } from "../../../domain/telemetry/index.ts";

export interface ExternalChatRouteDeps {
  store: Store;
  vault: SecretVault;
  agent: AgentRuntimePort;
  workspace: WorkspacePort;
  executor: Pick<ExecuteWorkflowRunUseCase, "execute">;
  controlDirectory: string;
  fetchImpl?: typeof fetch;
  webhookValidator?: (url: string) => Promise<unknown>;
  logger?: Logger;
}

export function createExternalChatRoutes(deps: ExternalChatRouteDeps): Hono {
  const app = new Hono();
  const send = new SendExternalChatMessageUseCase(deps);

  app.post("/v1/integrations/:integrationId/messages", async (c) => {
    const apiKey = c.req.header("x-integration-key") ?? "";
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(apiError("VALIDATION_ERROR", "invalid json body"), 422);
    }
    const parsed = ChatMessageRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(apiError("VALIDATION_ERROR", "invalid message payload", parsed.error.flatten()), 422);
    }
    const integration = deps.store.integrations.findById(c.req.param("integrationId"));
    if (!integration || integration.kind !== "external_chat" || !verifyIntegrationKey(apiKey, integration.keyHash)) {
      return c.json(apiError("UNAUTHORIZED", "invalid integration key"), 401);
    }
    const wantsStream = (c.req.header("accept") ?? "").includes("text/event-stream");
    try {
      if (wantsStream) {
        return streamSSE(c, async (stream) => {
          let unsubscribe: (() => void) | undefined;
          let deltaSent = false;
          let pendingWrite: Promise<void> | undefined;
          try {
            const result = await send.execute({
              integrationId: integration.id,
              apiKey,
              threadId: parsed.data.threadId,
              message: parsed.data.message,
              metadata: parsed.data.metadata,
              webhookUrl: parsed.data.webhookUrl,
              onSession: async (sessionId) => {
                unsubscribe = await deps.agent.subscribe((event) => {
                  const delta = event as { type?: string; sessionID?: string; text?: string };
                  if (delta.type === "session.text.delta" && delta.sessionID === sessionId && delta.text) {
                    deltaSent = true;
                    pendingWrite = stream.writeSSE({ event: "token", data: JSON.stringify({ text: delta.text }) });
                  }
                });
              },
            });
            if (pendingWrite) await pendingWrite;
            if (!deltaSent) {
              await stream.writeSSE({ event: "token", data: JSON.stringify({ text: result.reply }) });
            }
            await stream.writeSSE({
              event: "done",
              data: JSON.stringify({ threadId: result.threadId, sessionId: result.sessionId }),
            });
          } catch (error) {
            await stream
              .writeSSE({ event: "error", data: JSON.stringify({ message: error instanceof Error ? error.message : String(error) }) })
              .catch(() => undefined);
          } finally {
            unsubscribe?.();
          }
        });
      }
      const result = await send.execute({
        integrationId: integration.id,
        apiKey,
        threadId: parsed.data.threadId,
        message: parsed.data.message,
        metadata: parsed.data.metadata,
        webhookUrl: parsed.data.webhookUrl,
      });
      return c.json({ threadId: result.threadId, sessionId: result.sessionId, reply: result.reply });
    } catch (error) {
      if (error instanceof ChannelAuthError) return c.json(apiError("UNAUTHORIZED", "invalid integration key"), 401);
      throw error;
    }
  });

  return app;
}
