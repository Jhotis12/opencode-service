import type {
  ChatProgressEvent,
  ChatTurnEvent,
  ChatTurnStatus,
  ChatTurnErrorCode,
  EntryPointType,
} from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { AgentRuntimePort, AgentSessionState } from "../ports/runtime.ts";
import type { EventBus } from "../ports/events.ts";
import type { Logger, Metrics, ErrorTracker } from "../../domain/telemetry/index.ts";
import type { ChatMessageRecord, ChatThreadRecord, ChatTurnRecord } from "../../domain/entities.ts";
import { createChatProgressHandler } from "./chat-progress.ts";
import { ensureChatSession, registerSessionContext } from "./chat-session.ts";
import { resolveChatTurnPolicy, type ChatTurnPolicy } from "./chat-turn-policy.ts";

export interface ChatTarget {
  scope: "project" | "global";
  projectSlug?: string;
  directory: string;
  agentId?: string;
  model?: string;
  context: "chat" | "external_channel";
  entryPoint: EntryPointType;
  readOnly?: boolean;
  timeoutMs?: number;
  idleMs?: number;
}

export interface StartChatTurnInput {
  thread: ChatThreadRecord;
  target: ChatTarget;
  message: string;
  idempotencyKey?: string;
}

export class TurnInProgressError extends Error {
  constructor(public readonly turnId: string) {
    super("a chat turn is already running for this thread");
    this.name = "TurnInProgressError";
  }
}

export class TurnNotFoundError extends Error {
  constructor() {
    super("chat turn not found");
    this.name = "TurnNotFoundError";
  }
}

export class TurnTimeoutError extends Error {
  constructor(public readonly reason: "max" | "idle") {
    super(reason === "max" ? "chat turn exceeded the maximum duration" : "chat turn exceeded the inactivity timeout");
    this.name = "TurnTimeoutError";
  }
}

export class TurnFailureError extends Error {
  constructor(
    public readonly code: ChatTurnErrorCode,
    message: string,
    public readonly status: ChatTurnStatus = "failed",
  ) {
    super(message);
    this.name = "TurnFailureError";
  }
}

export class TurnInterruptedError extends Error {
  constructor(message = "the agent execution was interrupted") {
    super(message);
    this.name = "TurnInterruptedError";
  }
}

function nowIso(now = Date.now()): string {
  return new Date(now).toISOString();
}

function isTransportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /transport|timed out|timeout|fetch|econn|socket|connection/i.test(message);
}

function extractTurnReply(messages: Array<{ id: string; type: string; text?: string; created?: number }>, startedAt: string): {
  reply: string;
  assistantMessageId?: string;
} {
  const started = Date.parse(startedAt);
  const assistants = messages.filter((message) => message.type === "assistant");
  const inTurn = assistants.filter((message) => !message.created || message.created >= started);
  const candidate = [...inTurn].reverse().find((message) => Boolean(message.text?.trim()));
  return { reply: candidate?.text?.trim() ?? "", assistantMessageId: candidate?.id };
}

export class ChatTurnService {
  private readonly policy: ChatTurnPolicy;
  private readonly listeners = new Map<string, Set<(event: ChatTurnEvent) => void>>();
  private readonly buffers = new Map<string, ChatTurnEvent[]>();
  private readonly running = new Set<string>();

  constructor(
    private readonly deps: {
      store: Store;
      agent: AgentRuntimePort;
      events: EventBus;
      logger?: Logger;
      metrics?: Metrics;
      errors?: ErrorTracker;
      policy?: ChatTurnPolicy;
      now?: () => number;
      sleep?: (ms: number) => Promise<void>;
    },
  ) {
    this.policy = deps.policy ?? resolveChatTurnPolicy();
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return this.deps.sleep?.(ms) ?? new Promise((resolve) => setTimeout(resolve, ms));
  }

  async start(input: StartChatTurnInput): Promise<ChatTurnRecord> {
    const { thread, target } = input;
    if (target.scope !== thread.scope) throw new Error("chat target scope does not match thread scope");
    if (thread.projectSlug && target.projectSlug && thread.projectSlug !== target.projectSlug) {
      throw new Error("chat target project does not match thread project");
    }
    const idempotencyKey = input.idempotencyKey?.trim() || crypto.randomUUID();
    const existing = this.deps.store.chatTurns.findByIdempotencyKey(thread.id, idempotencyKey);
    if (existing) return existing;
    const active = this.deps.store.chatTurns.findActiveByThread(thread.id);
    if (active) throw new TurnInProgressError(active.id);

    const now = this.now();
    const id = crypto.randomUUID();
    const userMessageId = crypto.randomUUID();
    const turn: ChatTurnRecord = {
      id,
      threadId: thread.id,
      scope: thread.scope,
      projectSlug: thread.projectSlug,
      integrationId: thread.integrationId,
      externalThreadId: thread.externalThreadId,
      status: "queued",
      deliveryState: "created",
      attempt: 0,
      startedAt: nowIso(now),
      lastActivityAt: nowIso(now),
      idempotencyKey,
      entryPoint: target.entryPoint,
      hasSideEffects: false,
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
      userMessageId,
    };
    const message: ChatMessageRecord = {
      id: userMessageId,
      threadId: thread.id,
      turnId: id,
      role: "user",
      content: input.message,
      createdAt: nowIso(now),
    };
    this.deps.store.chatTurns.createWithMessage(turn, message);
    this.deps.metrics?.increment("chat_turns_started");
    this.deps.logger?.info({
      event: "chat_turn_created",
      turnId: id,
      threadId: thread.id,
      projectSlug: target.projectSlug,
      entryPoint: target.entryPoint,
    });
    this.publishTurn(turn);
    void this.run(id, target, input.message).catch((error) => {
      this.deps.logger?.error({
        event: "chat_turn_unhandled_failure",
        turnId: id,
        entryPoint: target.entryPoint,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return turn;
  }

  get(id: string): ChatTurnRecord | undefined {
    return this.deps.store.chatTurns.findById(id);
  }

  async waitForTerminal(id: string, timeoutMs = this.policy.maxMs + 30_000): Promise<ChatTurnRecord> {
    const deadline = this.now() + timeoutMs;
    for (;;) {
      const turn = this.deps.store.chatTurns.findById(id);
      if (!turn) throw new TurnNotFoundError();
      if (this.isTerminal(turn.status)) return turn;
      if (this.now() >= deadline) throw new Error("chat turn did not finish in time");
      await this.sleep(Math.min(this.policy.pollMs, 500));
    }
  }

  replyForTurn(id: string): string {
    const messages = this.deps.store.chat.listByTurn(id);
    return [...messages].reverse().find((message) => message.role === "agent")?.content ?? "";
  }

  stats() {
    return this.deps.store.chatTurns.stats();
  }

  shutdown(): void {
    this.listeners.clear();
    this.buffers.clear();
  }

  history(threadId: string, limit = 200): Array<ChatMessageRecord & { turnStatus?: ChatTurnStatus }> {
    const messages = this.deps.store.chat.listByThread(threadId, limit);
    const turns = new Map(this.deps.store.chatTurns.listByThread(threadId, limit).map((turn) => [turn.id, turn]));
    return messages.map((message) => ({
      ...message,
      turnStatus: message.turnId ? turns.get(message.turnId)?.status : undefined,
    }));
  }

  subscribe(turnId: string, listener: (event: ChatTurnEvent) => void, after = 0): () => void {
    const set = this.listeners.get(turnId) ?? new Set();
    set.add(listener);
    this.listeners.set(turnId, set);
    const buffer = this.buffers.get(turnId) ?? [];
    if (after < buffer.length) {
      for (const event of buffer.slice(after)) listener(event);
    } else if (after > buffer.length && buffer.length > 0) {
      listener({ type: "gap", turnId, fromSeq: buffer.length });
    }
    const turn = this.deps.store.chatTurns.findById(turnId);
    const hasTerminalEvent = buffer.some((event) => event.type === "done" || event.type === "error");
    if (turn && this.isTerminal(turn.status) && !hasTerminalEvent) {
      const messages = this.deps.store.chat.listByTurn(turnId);
      const agentMessage = [...messages].reverse().find((message) => message.role === "agent");
      if (turn.status === "succeeded" && agentMessage) {
        listener({
          type: "done",
          turnId,
          status: "succeeded",
          reply: agentMessage.content,
          messageId: agentMessage.id,
          threadId: turn.threadId,
          startedAt: turn.startedAt,
          finishedAt: turn.finishedAt,
          usage: turn.usage,
        });
      } else if (turn.errorCode || turn.status !== "succeeded") {
        listener({
          type: "error",
          turnId,
          code: turn.errorCode ?? "unknown",
          message: turn.errorMessage ?? "chat turn failed",
          retryable: turn.status === "failed" || turn.status === "timed_out" || turn.status === "cancelled",
        });
      }
    }
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(turnId);
    };
  }

  async cancel(id: string): Promise<ChatTurnRecord> {
    const turn = this.deps.store.chatTurns.findById(id);
    if (!turn) throw new TurnNotFoundError();
    if (this.isTerminal(turn.status)) return turn;
    if (turn.sessionId) await this.deps.agent.interrupt(turn.sessionId).catch(() => undefined);
    const updated = this.updateTurn(turn, {
      status: "cancelled",
      deliveryState: "completed",
      errorCode: "cancelled",
      errorMessage: "cancelled by the user",
      finishedAt: nowIso(this.now()),
      lastActivityAt: nowIso(this.now()),
    });
    this.deps.store.chatTurns.complete(
      id,
      {
        status: "cancelled",
        deliveryState: "completed",
        errorCode: "cancelled",
        errorMessage: "cancelled by the user",
        finishedAt: nowIso(this.now()),
        lastActivityAt: nowIso(this.now()),
      },
      {
        id: crypto.randomUUID(),
        threadId: turn.threadId,
        turnId: turn.id,
        role: "system",
        content: "Error: el turno fue cancelado por el usuario.",
        errorCode: "cancelled",
        createdAt: nowIso(this.now()),
      },
    );
    this.deps.metrics?.increment("chat_turns_cancelled");
    this.deps.logger?.info({
      event: "chat_turn_cancelled",
      turnId: id,
      threadId: turn.threadId,
      projectSlug: turn.projectSlug,
      entryPoint: turn.entryPoint as never,
    });
    this.publishTerminal(turn.threadId, {
      type: "error",
      turnId: id,
      code: "cancelled",
      message: "cancelled by the user",
      retryable: true,
    });
    return updated;
  }

  async recover(): Promise<void> {
    for (const turn of this.deps.store.chatTurns.listActive()) {
      if (this.running.has(turn.id)) continue;
      this.deps.logger?.info({
        event: "chat_turn_recovery_started",
        turnId: turn.id,
        threadId: turn.threadId,
        projectSlug: turn.projectSlug,
        entryPoint: turn.entryPoint as never,
        status: turn.status,
      });
      if (!turn.sessionId) {
        this.failTurn(turn, "not_delivered", "the prompt was not delivered before restart", "failed");
        continue;
      }
      try {
        const session = await this.deps.agent.getSession(turn.sessionId);
        if (!session) {
          this.failTurn(turn, "session_not_found", "the OpenCode session no longer exists", "unknown");
          continue;
        }
        if (session.active) {
          this.updateTurn(turn, { status: "recovering", lastActivityAt: nowIso(this.now()) });
          void this.watchExisting(turn.id, turn.sessionId).catch(() => undefined);
          continue;
        }
        await this.reconcileFinished(turn, session);
      } catch (error) {
        this.failTurn(
          turn,
          isTransportError(error) ? "transport_interrupted" : "opencode_unavailable",
          error instanceof Error ? error.message : String(error),
          isTransportError(error) ? "unknown" : "failed",
        );
      }
    }
  }

  private async run(id: string, target: ChatTarget, text: string): Promise<void> {
    if (this.running.has(id)) return;
    this.running.add(id);
    let unsubscribe: (() => Promise<void> | void) | undefined;
    try {
      const turn = this.deps.store.chatTurns.findById(id);
      if (!turn) return;
      const thread = this.deps.store.chatThreads.findById(turn.threadId);
      if (!thread) {
        this.failTurn(turn, "session_not_found", "chat thread not found", "failed");
        return;
      }
      const create = () =>
        this.deps.agent.createSession({
          directory: target.directory,
          title: thread.title,
          agent: target.agentId,
          model: target.model,
        });
      const sessionFactory = { create, agentId: target.agentId, model: target.model, logger: this.deps.logger };
      const sessionId = await ensureChatSession(this.deps.store, this.deps.agent, thread, sessionFactory);
      registerSessionContext(this.deps.store, {
        sessionId,
        scope: thread.scope,
        projectSlug: thread.projectSlug,
        agentId: target.agentId,
        context: target.context,
        integrationId: thread.integrationId,
        externalThreadId: thread.externalThreadId,
      });
      if (this.deps.store.chatTurns.findById(turn.id)?.status === "cancelled") return;
      this.updateTurn(turn, {
        sessionId,
        status: "running",
        lastActivityAt: nowIso(this.now()),
      });

      const progress = createChatProgressHandler((event) => this.publishProgress(turn.id, event));
      unsubscribe = await this.deps.agent.subscribe((event) => {
        const data = event && typeof event === "object" ? (event as { data?: Record<string, unknown>; sessionID?: string; durable?: { seq?: number } }) : {};
        const session = data.data?.sessionID ?? data.sessionID;
        if (session !== sessionId) return;
        progress(event, sessionId);
        const rawToolName = data.data?.name ?? (data as { name?: string }).name;
        const toolName = typeof rawToolName === "string" ? rawToolName : undefined;
        if (toolName && /^(write|edit|patch|bash|shell|platform_workflow_upsert|platform_subagent_upsert|platform_notify|platform_db_query)$/.test(toolName)) {
          this.deps.store.chatTurns.update(turn.id, { hasSideEffects: true, lastActivityAt: nowIso(this.now()) });
        }
        const seq = data.durable?.seq;
        if (typeof seq === "number" && Number.isFinite(seq)) {
          this.deps.store.chatTurns.update(turn.id, { lastSeq: seq, lastActivityAt: nowIso(this.now()) });
        }
      });

      const promptId = `msg_${turn.id.replace(/-/g, "")}`;
      const sent = await this.deps.agent.sendPrompt(sessionId, {
        id: promptId,
        text,
        metadata: { platformTurnId: turn.id, threadId: turn.threadId, projectSlug: turn.projectSlug },
        delivery: "steer",
      });
      if (this.deps.store.chatTurns.findById(turn.id)?.status === "cancelled") {
        await this.deps.agent.interrupt(sessionId).catch(() => undefined);
        return;
      }
      this.updateTurn(turn, {
        sessionId,
        inboxId: sent.inboxId,
        deliveryState: "enqueued",
        status: "running",
        lastActivityAt: nowIso(this.now()),
      });
      const result = await this.pollTurn(turn.id, sessionId, {
        maxMs: target.timeoutMs,
        idleMs: target.idleMs,
      });
      if (!result) return;
      if (result.type === "cancelled") return;
      if (result.type === "failed") {
        this.failTurn(turn, result.code, result.message, result.status);
        return;
      }
      const currentTurn = this.deps.store.chatTurns.findById(turn.id) ?? turn;
      if (currentTurn.status === "cancelled") return;
      const assistantMessageId = crypto.randomUUID();
      const finishedAt = nowIso(this.now());
      const recovered = currentTurn.status === "recovering" || currentTurn.errorCode === "transport_interrupted";
      const message: ChatMessageRecord = {
        id: assistantMessageId,
        threadId: turn.threadId,
        turnId: turn.id,
        role: "agent",
        content: result.reply,
        createdAt: finishedAt,
      };
      const patch: Partial<ChatTurnRecord> = {
        status: "succeeded",
        deliveryState: "completed",
        assistantMessageId,
        assistantOpencodeMessageId: result.assistantMessageId,
        sessionId,
        finishedAt,
        lastActivityAt: finishedAt,
        usage: result.usage,
        errorCode: recovered ? "transport_interrupted" : undefined,
        errorMessage: recovered ? "the turn recovered from a transport interruption" : undefined,
      };
      this.deps.store.chatTurns.complete(turn.id, patch, message);
      this.deps.metrics?.increment("chat_turns_succeeded");
      if (recovered) this.deps.metrics?.increment("chat_turns_recovered");
      this.deps.logger?.info({
        event: recovered ? "chat_turn_recovered" : "chat_turn_succeeded",
        turnId: turn.id,
        threadId: turn.threadId,
        projectSlug: turn.projectSlug,
        entryPoint: turn.entryPoint as never,
        durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(turn.startedAt)),
      });
      this.deps.store.chatThreads.touch(turn.threadId);
      this.publishTerminal(turn.threadId, {
        type: "done",
        turnId: turn.id,
        status: "succeeded",
        reply: result.reply,
        messageId: assistantMessageId,
        sessionId,
        threadId: turn.threadId,
        startedAt: turn.startedAt,
        finishedAt,
        usage: result.usage,
      });
      this.publishTurn(this.deps.store.chatTurns.findById(turn.id) ?? turn);
    } catch (error) {
      const current = this.deps.store.chatTurns.findById(id);
      if (current?.status === "cancelled") return;
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof TurnTimeoutError) {
        if (current?.sessionId) await this.deps.agent.interrupt(current.sessionId).catch(() => undefined);
        this.failTurn(current ?? this.fallbackTurn(id, current), "turn_timeout", message, "timed_out");
      } else if (error instanceof TurnInterruptedError) {
        this.failTurn(current ?? this.fallbackTurn(id, current), "execution_interrupted", message, "interrupted");
      } else if (error instanceof TurnFailureError) {
        this.failTurn(current ?? this.fallbackTurn(id, current), error.code, message, error.status);
      } else if (isTransportError(error)) {
        this.deps.metrics?.increment("chat_transport_retries");
        const notDelivered = current?.deliveryState === "created";
        this.failTurn(
          current ?? this.fallbackTurn(id, current),
          notDelivered ? "not_delivered" : "transport_interrupted",
          message,
          notDelivered ? "failed" : "unknown",
        );
      } else {
        this.failTurn(current ?? this.fallbackTurn(id, current), "unknown", message, "failed");
      }
    } finally {
      await unsubscribe?.();
      this.running.delete(id);
    }
  }

  private fallbackTurn(id: string, current?: ChatTurnRecord): ChatTurnRecord {
    return (
      current ?? {
        id,
        threadId: "",
        scope: "project",
        status: "failed",
        deliveryState: "created",
        attempt: 0,
        startedAt: nowIso(this.now()),
        lastActivityAt: nowIso(this.now()),
        entryPoint: "unknown",
        createdAt: nowIso(this.now()),
        updatedAt: nowIso(this.now()),
      }
    );
  }

  private async watchExisting(id: string, sessionId: string): Promise<void> {
    if (this.running.has(id)) return;
    this.running.add(id);
    try {
      const result = await this.pollTurn(id, sessionId);
      if (!result) return;
      const turn = this.deps.store.chatTurns.findById(id);
      if (!turn || turn.status === "cancelled" || result.type === "cancelled") return;
      if (result.type === "failed") {
        this.failTurn(turn, result.code, result.message, result.status);
        return;
      }
      const finishedAt = nowIso(this.now());
      const assistantMessageId = crypto.randomUUID();
      this.deps.store.chatTurns.complete(
        id,
        {
          status: "succeeded",
          deliveryState: "completed",
          assistantMessageId,
          assistantOpencodeMessageId: result.assistantMessageId,
          finishedAt,
          lastActivityAt: finishedAt,
          usage: result.usage,
          errorCode: "transport_interrupted",
          errorMessage: "the turn recovered after a restart",
        },
        {
          id: assistantMessageId,
          threadId: turn.threadId,
          turnId: id,
          role: "agent",
          content: result.reply,
          createdAt: finishedAt,
        },
      );
      this.deps.metrics?.increment("chat_turns_recovered");
      this.publishTerminal(turn.threadId, {
        type: "done",
        turnId: id,
        status: "succeeded",
        reply: result.reply,
        messageId: assistantMessageId,
        threadId: turn.threadId,
        startedAt: turn.startedAt,
        finishedAt,
        usage: result.usage,
      });
    } catch (error) {
      const turn = this.deps.store.chatTurns.findById(id);
      if (!turn) return;
      this.failTurn(
        turn,
        error instanceof TurnTimeoutError ? "turn_timeout" : "unknown",
        error instanceof Error ? error.message : String(error),
        error instanceof TurnTimeoutError ? "timed_out" : "unknown",
      );
    } finally {
      this.running.delete(id);
    }
  }

  private async reconcileFinished(turn: ChatTurnRecord, session: AgentSessionState): Promise<void> {
    if (session.outcome === "failed") {
      this.failTurn(turn, "execution_failed", session.error?.message ?? "OpenCode execution failed", "failed");
      return;
    }
    if (session.outcome === "interrupted") {
      this.failTurn(turn, "execution_interrupted", "OpenCode execution was interrupted", "interrupted");
      return;
    }
    if (session.outcome === "succeeded") {
      const messages = await this.deps.agent.getMessages(turn.sessionId!, { order: "asc", limit: 200 });
      const extracted = extractTurnReply(messages, turn.startedAt);
      if (!extracted.reply) {
        this.failTurn(turn, "empty_reply", "the agent completed without a textual reply", "failed");
        return;
      }
      const finishedAt = nowIso(this.now());
      const assistantMessageId = crypto.randomUUID();
      this.deps.store.chatTurns.complete(
        turn.id,
        {
          status: "succeeded",
          deliveryState: "completed",
          assistantMessageId,
          assistantOpencodeMessageId: extracted.assistantMessageId,
          finishedAt,
          lastActivityAt: finishedAt,
          errorCode: "transport_interrupted",
          errorMessage: "the turn was reconciled after restart",
        },
        {
          id: assistantMessageId,
          threadId: turn.threadId,
          turnId: turn.id,
          role: "agent",
          content: extracted.reply,
          createdAt: finishedAt,
        },
      );
      this.publishTurn(this.deps.store.chatTurns.findById(turn.id) ?? turn);
      return;
    }
    const inbox = await this.deps.agent.listInbox(turn.sessionId!).catch(() => []);
    if (inbox.length > 0) {
      this.updateTurn(turn, { status: "recovering", lastActivityAt: nowIso(this.now()) });
      void this.watchExisting(turn.id, turn.sessionId!).catch(() => undefined);
      return;
    }
    this.failTurn(turn, "unknown", "the turn outcome could not be determined after restart", "unknown");
  }

  private isCurrentExecution(session: AgentSessionState, startedMs: number): boolean {
    const markers = [session.time?.busy, session.time?.updated].filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value),
    );
    if (markers.length === 0) return true;
    return markers.some((value) => value >= startedMs - 1_000);
  }

  private async pollTurn(
    id: string,
    sessionId: string,
    overrides: { maxMs?: number; idleMs?: number } = {},
  ): Promise<
    | { type: "done"; reply: string; assistantMessageId?: string; usage?: ChatTurnRecord["usage"] }
    | { type: "failed"; code: ChatTurnErrorCode; message: string; status: ChatTurnStatus }
    | { type: "cancelled" }
    | undefined
  > {
    const turn = this.deps.store.chatTurns.findById(id);
    if (!turn) return undefined;
    const policy = {
      ...this.policy,
      maxMs: overrides.maxMs && overrides.maxMs > 0 ? overrides.maxMs : this.policy.maxMs,
      idleMs: overrides.idleMs && overrides.idleMs > 0 ? overrides.idleMs : this.policy.idleMs,
    };
    const started = Date.parse(turn.startedAt);
    const maxDeadline = started + policy.maxMs;
    let lastActivity = this.now();
    let transportFailures = 0;
    let idlePolls = 0;
    while (true) {
      const current = this.deps.store.chatTurns.findById(id);
      if (!current) return undefined;
      if (current.status === "cancelled") return { type: "cancelled" };
      const now = this.now();
      if (now >= maxDeadline) throw new TurnTimeoutError("max");
      if (now - lastActivity >= policy.idleMs) throw new TurnTimeoutError("idle");
      try {
        const session = await this.deps.agent.getSession(sessionId);
        if (!session) {
          const inbox = await this.deps.agent.listInbox(sessionId).catch(() => []);
          if (inbox.length > 0) {
            this.updateTurn(current, { status: "running", lastActivityAt: nowIso(now) });
          } else {
            return {
              type: "failed",
              code: current.deliveryState === "created" ? "not_delivered" : "session_not_found",
              message: current.deliveryState === "created" ? "the prompt was not delivered" : "the OpenCode session no longer exists",
              status: current.deliveryState === "created" ? "failed" : "unknown",
            };
          }
        } else if (session.active) {
          lastActivity = now;
          idlePolls = 0;
          transportFailures = 0;
          if (current.status !== "running" && current.status !== "recovering") {
            this.updateTurn(current, { status: "running", lastActivityAt: nowIso(now) });
          } else if (now - Date.parse(current.lastActivityAt) > 5_000) {
            this.updateTurn(current, { lastActivityAt: nowIso(now) });
          }
        } else if (session.outcome === "succeeded" && this.isCurrentExecution(session, started)) {
          const messages = await this.deps.agent.getMessages(sessionId, { order: "asc", limit: 200 });
          const extracted = extractTurnReply(messages, current.startedAt);
          if (!extracted.reply) {
            return { type: "failed", code: "empty_reply", message: "the agent completed without a textual reply", status: "failed" };
          }
          const usage = session.tokens
            ? {
                cost: session.cost,
                inputTokens: session.tokens.input,
                outputTokens: session.tokens.output,
                reasoningTokens: session.tokens.reasoning,
                busyMs: session.time?.busy && session.time?.idle ? Math.max(0, session.time.idle - session.time.busy) : undefined,
              }
            : undefined;
          return { type: "done", reply: extracted.reply, assistantMessageId: extracted.assistantMessageId, usage };
        } else if (session.outcome === "failed" && this.isCurrentExecution(session, started)) {
          return { type: "failed", code: "execution_failed", message: session.error?.message ?? "OpenCode execution failed", status: "failed" };
        } else if (session.outcome === "interrupted" && this.isCurrentExecution(session, started)) {
          return { type: "failed", code: "execution_interrupted", message: "OpenCode execution was interrupted", status: "interrupted" };
        } else {
          const inbox = await this.deps.agent.listInbox(sessionId).catch(() => []);
          if (inbox.length > 0) {
            idlePolls = 0;
            lastActivity = now;
            this.updateTurn(current, { status: "running", lastActivityAt: nowIso(now) });
          } else {
            idlePolls += 1;
            if (idlePolls >= 10) {
              return {
                type: "failed",
                code: current.deliveryState === "created" ? "not_delivered" : "unknown",
                message: "the session is idle but no outcome or reply is available",
                status: current.deliveryState === "created" ? "failed" : "unknown",
              };
            }
          }
        }
      } catch (error) {
        if (error instanceof TurnTimeoutError) throw error;
        if (!isTransportError(error)) throw error;
        transportFailures += 1;
        lastActivity = now;
        this.deps.metrics?.increment("chat_transport_retries");
        this.deps.logger?.warn({
          event: "chat_transport_retry",
          turnId: id,
          threadId: current.threadId,
          projectSlug: current.projectSlug,
          entryPoint: current.entryPoint as never,
          attempt: transportFailures,
          error: error instanceof Error ? error.message : String(error),
        });
        if (current.status !== "recovering") {
          this.updateTurn(current, { status: "recovering", lastActivityAt: nowIso(now) });
        }
        if (transportFailures >= 5) {
          return { type: "failed", code: "opencode_unavailable", message: "OpenCode is unavailable", status: "unknown" };
        }
        await this.sleep(policy.transportRetryMs);
        continue;
      }
      await this.sleep(policy.pollMs);
    }
  }

  private updateTurn(turn: ChatTurnRecord, patch: Partial<ChatTurnRecord>): ChatTurnRecord {
    const current = this.deps.store.chatTurns.findById(turn.id);
    if (current?.status === "cancelled" && patch.status !== "cancelled") return current;
    this.deps.store.chatTurns.update(turn.id, { ...patch, updatedAt: nowIso(this.now()) });
    const updated = this.deps.store.chatTurns.findById(turn.id) ?? { ...turn, ...patch };
    this.publishTurn(updated);
    return updated;
  }

  private isTerminal(status: ChatTurnStatus): boolean {
    return ["succeeded", "failed", "timed_out", "cancelled", "interrupted", "unknown"].includes(status);
  }

  private failTurn(turn: ChatTurnRecord, code: ChatTurnErrorCode, message: string, status: ChatTurnStatus): void {
    if (this.isTerminal(turn.status) && turn.status !== "unknown") return;
    const finishedAt = nowIso(this.now());
    const friendly =
      status === "timed_out"
        ? "El turno superó el tiempo máximo y fue interrumpido."
        : status === "interrupted"
          ? "La ejecución del agente fue interrumpida."
          : code === "empty_reply"
            ? "El agente terminó sin una respuesta textual."
            : code === "not_delivered"
              ? "El mensaje no llegó a OpenCode; puedes reintentar."
              : `No se pudo completar el turno (${code}).`;
    this.deps.store.chatTurns.complete(
      turn.id,
      {
        status,
        deliveryState: "completed",
        errorCode: code,
        errorMessage: message,
        finishedAt,
        lastActivityAt: finishedAt,
      },
      {
        id: crypto.randomUUID(),
        threadId: turn.threadId,
        turnId: turn.id,
        role: "system",
        content: `Error: ${friendly}`,
        errorCode: code,
        createdAt: finishedAt,
      },
    );
    this.deps.metrics?.increment(status === "timed_out" ? "chat_turns_timed_out" : "chat_turns_failed");
    this.deps.logger?.error({
      event: status === "timed_out" ? "chat_turn_timed_out" : "chat_turn_failed",
      turnId: turn.id,
      threadId: turn.threadId,
      projectSlug: turn.projectSlug,
      entryPoint: turn.entryPoint as never,
      status,
      errorCode: code,
      error: message,
    });
    this.deps.errors?.captureMessage(message, "error", {
      entryPoint: turn.entryPoint as never,
      turnId: turn.id,
      threadId: turn.threadId,
      projectSlug: turn.projectSlug,
      code,
    });
    this.deps.store.errors.insert({
      id: crypto.randomUUID(),
      entryPoint: turn.entryPoint as never,
      level: "error",
      message: `chat turn ${status}: ${message}`,
      context: JSON.stringify({ turnId: turn.id, threadId: turn.threadId, projectSlug: turn.projectSlug, code }),
      createdAt: finishedAt,
    });
    this.publishTerminal(turn.threadId, {
      type: "error",
      turnId: turn.id,
      code,
      message: friendly,
      retryable: status !== "interrupted",
    });
    this.publishTurn(this.deps.store.chatTurns.findById(turn.id) ?? turn);
  }

  private publishProgress(turnId: string, event: ChatProgressEvent): void {
    this.publish(turnId, { ...event, turnId } as ChatTurnEvent);
  }

  private publishTurn(turn: ChatTurnRecord): void {
    this.publish(turn.id, { type: "turn", turn });
    this.deps.events.publish({
      type: "chat.turn.updated",
      turnId: turn.id,
      threadId: turn.threadId,
      scope: turn.scope,
      projectSlug: turn.projectSlug,
      status: turn.status,
    });
  }

  private publishTerminal(threadId: string, event: ChatTurnEvent): void {
    const turnId = "turnId" in event ? event.turnId : "";
    this.publish(turnId, event);
    const turn = this.deps.store.chatTurns.findById(turnId);
    if (turn) {
      this.deps.events.publish({
        type: "chat.turn.updated",
        turnId,
        threadId,
        scope: turn.scope,
        projectSlug: turn.projectSlug,
        status: turn.status,
      });
    }
  }

  private publish(turnId: string, event: ChatTurnEvent): void {
    const buffer = this.buffers.get(turnId) ?? [];
    buffer.push(event);
    if (buffer.length > 200) buffer.shift();
    this.buffers.set(turnId, buffer);
    for (const listener of this.listeners.get(turnId) ?? []) {
      try {
        listener(event);
      } catch {
        // A broken subscriber must not break the turn.
      }
    }
  }
}
