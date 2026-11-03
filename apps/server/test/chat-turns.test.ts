import { describe, expect, it } from "bun:test";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import { ChatTurnService, TurnInProgressError, type ChatTarget } from "../src/application/use-cases/chat-turns.ts";
import { SseHub } from "../src/infrastructure/in/sse/sse-hub.ts";
import { InMemoryMetrics } from "../src/domain/telemetry/metrics.ts";

function setup() {
  const store = new SqliteStore(":memory:");
  const agent = new FakeAgentRuntime();
  const events = new SseHub();
  const service = new ChatTurnService({
    store,
    agent,
    events,
    metrics: new InMemoryMetrics(),
    policy: { maxMs: 2_000, idleMs: 2_000, pollMs: 20, transportRetryMs: 20 },
  });
  store.projects.create({
    id: "p1",
    slug: "p1",
    name: "P1",
    description: "",
    primaryAgent: "principal/agente",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const project = store.projects.findBySlug("p1")!;
  const thread = store.chatThreads.findOrCreate({ scope: "project", projectSlug: project.slug, externalThreadId: "web" });
  return { store, agent, events, service, project, thread };
}

function target(): ChatTarget {
  return {
    scope: "project",
    projectSlug: "p1",
    directory: "/tmp",
    agentId: "principal/agente",
    context: "chat",
    entryPoint: "web_ui",
  };
}

describe("ChatTurnService", () => {
  it("runs a turn to success and persists one user and one agent message", async () => {
    const { store, agent, service, thread } = setup();
    agent.scriptedReplies.push("listo");
    const turn = await service.start({ thread, target: target(), message: "hola" });
    const final = await service.waitForTerminal(turn.id, 2_000);
    expect(final.status).toBe("succeeded");
    expect(service.replyForTurn(turn.id)).toBe("listo");
    const messages = store.chat.listByTurn(turn.id);
    expect(messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(messages.filter((message) => message.role === "agent")).toHaveLength(1);
    expect(store.chatTurns.findById(turn.id)?.deliveryState).toBe("completed");
  });

  it("publishes progress and terminal events to subscribers", async () => {
    const { agent, service, thread } = setup();
    agent.scriptedReplies.push("progreso");
    const turn = await service.start({ thread, target: target(), message: "hola" });
    const events: string[] = [];
    const unsubscribe = service.subscribe(turn.id, (event) => events.push(event.type));
    await service.waitForTerminal(turn.id, 2_000);
    unsubscribe();
    expect(events).toContain("text");
    expect(events).toContain("done");
  });

  it("records side effects from mutating tool events", async () => {
    const { agent, service, thread } = setup();
    agent.scriptedEvents.push({ type: "session.tool.called", data: { id: "tool-1", name: "write", input: {} } });
    const turn = await service.start({ thread, target: target(), message: "editar" });
    const final = await service.waitForTerminal(turn.id, 2_000);
    expect(final.status).toBe("succeeded");
    expect(final.hasSideEffects).toBe(true);
  });

  it("removes turns and messages when a project is deleted", async () => {
    const { store, service, thread } = setup();
    const turn = await service.start({ thread, target: target(), message: "borrar" });
    await service.waitForTerminal(turn.id, 2_000);
    store.deleteProjectData("p1");
    expect(store.chatTurns.findById(turn.id)).toBeUndefined();
    expect(store.chat.listByTurn(turn.id)).toEqual([]);
  });

  it("deduplicates the same client message id", async () => {
    const { agent, service, thread } = setup();
    const first = await service.start({ thread, target: target(), message: "hola", idempotencyKey: "key-1" });
    const second = await service.start({ thread, target: target(), message: "hola", idempotencyKey: "key-1" });
    expect(second.id).toBe(first.id);
    await service.waitForTerminal(first.id, 2_000);
    expect(agent.promptCalls).toHaveLength(1);
  });

  it("rejects a concurrent turn on the same thread", async () => {
    const { store, service, thread } = setup();
    await service.start({ thread, target: target(), message: "primero" });
    await expect(service.start({ thread, target: target(), message: "segundo" })).rejects.toBeInstanceOf(TurnInProgressError);
    await service.waitForTerminal(store.chatTurns.findActiveByThread(thread.id)!.id, 2_000);
  });

  it("recovers a running session after a process restart", async () => {
    const { store, agent, thread } = setup();
    const session = await agent.createSession({ directory: "/tmp" });
    agent.completionDelayMs = 30;
    agent.scriptedReplies.push("recuperado activo");
    await agent.sendPrompt(session.id, { id: "msg_recovery", text: "recuperar" });
    const now = new Date().toISOString();
    const turnId = "turn-recovery-active";
    store.chatTurns.createWithMessage(
      {
        id: turnId,
        threadId: thread.id,
        scope: "project",
        projectSlug: "p1",
        sessionId: session.id,
        status: "running",
        deliveryState: "enqueued",
        attempt: 0,
        startedAt: now,
        lastActivityAt: now,
        entryPoint: "web_ui",
        createdAt: now,
        updatedAt: now,
      },
      { id: "user-recovery", threadId: thread.id, turnId, role: "user", content: "recuperar", createdAt: now },
    );
    const restarted = new ChatTurnService({
      store,
      agent,
      events: new SseHub(),
      policy: { maxMs: 2_000, idleMs: 2_000, pollMs: 20, transportRetryMs: 20 },
    });
    await restarted.recover();
    const final = await restarted.waitForTerminal(turnId, 2_000);
    expect(final.status).toBe("succeeded");
    expect(restarted.replyForTurn(turnId)).toBe("recuperado activo");
  });

  it("marks a missing session as unknown instead of resending", async () => {
    const { store, service, thread } = setup();
    const now = new Date().toISOString();
    const turnId = "turn-recovery-missing";
    store.chatTurns.createWithMessage(
      {
        id: turnId,
        threadId: thread.id,
        scope: "project",
        projectSlug: "p1",
        sessionId: "ses_missing",
        status: "running",
        deliveryState: "delivered",
        attempt: 0,
        startedAt: now,
        lastActivityAt: now,
        entryPoint: "web_ui",
        createdAt: now,
        updatedAt: now,
      },
      { id: "user-missing", threadId: thread.id, turnId, role: "user", content: "x", createdAt: now },
    );
    await service.recover();
    expect(store.chatTurns.findById(turnId)?.status).toBe("unknown");
  });

  it("keeps a turn alive past the former five-minute transport limit", async () => {
    const { store, agent, thread } = setup();
    let clock = Date.now();
    let polls = 0;
    agent.getSession = async (sessionId: string) => {
      polls += 1;
      if (polls < 4) return { id: sessionId, active: true, time: { busy: clock, updated: clock } };
      return { id: sessionId, active: false, outcome: "succeeded", time: { busy: clock, updated: clock } };
    };
    agent.getMessages = async () => [
      { id: "assistant-long", type: "assistant", text: "terminado", created: clock },
    ];
    const service = new ChatTurnService({
      store,
      agent,
      events: new SseHub(),
      policy: { maxMs: 30 * 60_000, idleMs: 10 * 60_000, pollMs: 750, transportRetryMs: 20 },
      now: () => clock,
      sleep: async (ms) => {
        clock += Math.max(ms, 2 * 60_000);
      },
    });
    const turn = await service.start({ thread, target: target(), message: "largo" });
    const final = await service.waitForTerminal(turn.id, 30 * 60_000);
    expect(final.status).toBe("succeeded");
    expect(service.replyForTurn(turn.id)).toBe("terminado");
    expect(clock - Date.parse(turn.startedAt)).toBeGreaterThan(5 * 60_000);
  });

  it("interrupts a turn that exceeds the maximum duration", async () => {
    const { agent, service, thread } = setup();
    agent.completionDelayMs = 200;
    const turn = await service.start({
      thread,
      target: { ...target(), timeoutMs: 40, idleMs: 40 },
      message: "lento",
    });
    const final = await service.waitForTerminal(turn.id, 1_000);
    expect(final.status).toBe("timed_out");
    expect(final.errorCode).toBe("turn_timeout");
    expect(agent.interruptedSessions.length).toBeGreaterThan(0);
  });

  it("cancels a running turn", async () => {
    const { service, thread } = setup();
    const turn = await service.start({ thread, target: target(), message: "cancelar" });
    const cancelled = await service.cancel(turn.id);
    expect(cancelled.status).toBe("cancelled");
    const final = await service.waitForTerminal(turn.id, 2_000);
    expect(final.status).toBe("cancelled");
  });

  it("recovers an active turn after restart", async () => {
    const { store, agent, service, thread } = setup();
    agent.scriptedReplies.push("recuperado");
    const turn = await service.start({ thread, target: target(), message: "recuperar" });
    await service.waitForTerminal(turn.id, 2_000);
    // A second service with the same store represents a process restart.
    const restarted = new ChatTurnService({
      store,
      agent,
      events: new SseHub(),
      policy: { maxMs: 2_000, idleMs: 2_000, pollMs: 20, transportRetryMs: 20 },
    });
    await restarted.recover();
    expect(store.chatTurns.findById(turn.id)?.status).toBe("succeeded");
  });
});
