import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ChatMessageRequestSchema, apiError } from "@platform/shared";
import type { Store } from "../../../application/ports/store.ts";
import type { SecretVault } from "../../../application/ports/security.ts";
import type { AgentRuntimePort } from "../../../application/ports/runtime.ts";
import type { WorkspacePort } from "../../../application/ports/workspace.ts";
import type { ChannelEgressPort } from "../../../application/ports/channels.ts";
import type { EventBus } from "../../../application/ports/events.ts";
import {
  ChannelAuthError,
  CreateChannelUseCase,
  SendExternalChatMessageUseCase,
  verifyChannelKey,
} from "../../../application/use-cases/external-chat.ts";
import type { ExecuteWorkflowRunUseCase } from "../../../application/use-cases/execute-workflow.ts";

export interface ExternalChatRouteDeps {
  store: Store;
  vault: SecretVault;
  agent: AgentRuntimePort;
  workspace: WorkspacePort;
  executor: Pick<ExecuteWorkflowRunUseCase, "execute">;
  egress: ChannelEgressPort;
  events: EventBus;
  defaultDirectory: string;
  fetchImpl?: typeof fetch;
  webhookValidator?: (url: string) => Promise<unknown>;
}

export function createExternalChatRoutes(deps: ExternalChatRouteDeps): Hono {
  const app = new Hono();
  const send = new SendExternalChatMessageUseCase(deps);

  app.post("/v1/channels/:slug/messages", async (c) => {
    const apiKey = c.req.header("x-channel-key") ?? "";
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
    const wantsStream = (c.req.header("accept") ?? "").includes("text/event-stream");
    if (wantsStream) {
      const channel = deps.store.channels.findBySlug(c.req.param("slug"));
      if (!channel || channel.type !== "external_chat" || !verifyChannelKey(apiKey, channel.keyHash)) {
        return c.json(apiError("UNAUTHORIZED", "invalid channel key"), 401);
      }
    }
    try {
      if (wantsStream) {
        return streamSSE(c, async (stream) => {
          let unsubscribe: (() => void) | undefined;
          let deltaSent = false;
          let pendingWrite: Promise<void> | undefined;
          try {
            const result = await send.execute({
              channelSlug: c.req.param("slug"),
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
        channelSlug: c.req.param("slug"),
        apiKey,
        threadId: parsed.data.threadId,
        message: parsed.data.message,
        metadata: parsed.data.metadata,
        webhookUrl: parsed.data.webhookUrl,
      });
      return c.json({ threadId: result.threadId, sessionId: result.sessionId, reply: result.reply });
    } catch (error) {
      if (error instanceof ChannelAuthError) return c.json(apiError("UNAUTHORIZED", "invalid channel key"), 401);
      throw error;
    }
  });

  return app;
}

export function createChannelManagementRoutes(deps: {
  store: Store;
  vault: SecretVault;
  events: EventBus;
  egress: ChannelEgressPort;
  onCreated?: (channel: import("../../../domain/entities.ts").ChannelRecord) => Promise<void>;
}): Hono {
  const app = new Hono();
  const create = new CreateChannelUseCase(deps.store, deps.vault);

  app.get("/channels", (c) =>
    c.json({
      data: create.list().map(({ id, slug, type, name, status, adminAllowlist, isPublic, createdAt, keyHash }) => ({
        id,
        slug,
        type,
        name,
        status,
        adminAllowlist,
        isPublic,
        hasKey: Boolean(keyHash),
        createdAt,
      })),
    }),
  );

  app.post("/channels", async (c) => {
    let body: {
      slug?: string;
      type?: "telegram" | "whatsapp" | "external_chat";
      name?: string;
      adminAllowlist?: string[];
      isPublic?: boolean;
      config?: Record<string, unknown>;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json(apiError("VALIDATION_ERROR", "invalid json body"), 422);
    }
    if (!body.slug || !body.type || !body.name) {
      return c.json(apiError("VALIDATION_ERROR", "slug, type and name are required"), 422);
    }
    try {
      const result = create.execute({
        slug: body.slug,
        type: body.type,
        name: body.name,
        adminAllowlist: body.adminAllowlist,
        isPublic: body.isPublic,
        config: body.config,
      });
      deps.events.publish({
        type: "channel.status",
        channelSlug: result.channel.slug,
        status: "configured",
      });
      if (deps.onCreated) await deps.onCreated(result.channel);
      return c.json(
        {
          channel: { ...result.channel, configCiphertext: undefined, keyHash: undefined },
          apiKey: result.apiKey,
          webhookSecret: result.webhookSecret,
        },
        201,
      );
    } catch (error) {
      return c.json(apiError("CONFLICT", error instanceof Error ? error.message : "could not create channel"), 409);
    }
  });

  app.post("/channels/:slug/notify", async (c) => {
    let body: { text?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(apiError("VALIDATION_ERROR", "invalid json body"), 422);
    }
    if (!body.text) return c.json(apiError("VALIDATION_ERROR", "text is required"), 422);
    try {
      await deps.egress.send(c.req.param("slug"), body.text);
      return c.json({ ok: true });
    } catch (error) {
      return c.json(apiError("CHANNEL_UNAVAILABLE", error instanceof Error ? error.message : "send failed"), 503);
    }
  });

  return app;
}
