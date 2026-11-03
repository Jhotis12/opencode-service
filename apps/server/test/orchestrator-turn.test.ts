import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import {
  ChatWithOrchestratorUseCase,
  EmptyAgentReplyError,
  OrchestratorConfigurationError,
  resolveOrchestratorModel,
} from "../src/application/use-cases/orchestrator.ts";
import type { Logger, LogBindings } from "../src/domain/telemetry/index.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function captureLogger() {
  const events: Array<{ level: string; bindings: LogBindings; message?: string }> = [];
  const logger: Logger = {
    debug(bindings, message) {
      events.push({ level: "debug", bindings, message });
    },
    info(bindings, message) {
      events.push({ level: "info", bindings, message });
    },
    warn(bindings, message) {
      events.push({ level: "warn", bindings, message });
    },
    error(bindings, message) {
      events.push({ level: "error", bindings, message });
    },
    child() {
      return logger;
    },
  };
  return { logger, events };
}

async function setup(model: string | undefined = "opencode-go/fast") {
  const dir = await mkdtemp(join(tmpdir(), "platform-orchestrator-turn-"));
  dirs.push(dir);
  const store = new SqliteStore(":memory:");
  const agent = new FakeAgentRuntime();
  const { logger, events } = captureLogger();
  const orchestrator = new ChatWithOrchestratorUseCase({
    store,
    agent,
    controlDirectory: join(dir, "control"),
    orchestratorAgent: "orchestrator/agente",
    model: () => model,
    logger,
  });
  return { store, agent, orchestrator, events, logger, dir };
}

describe("global orchestrator model resolution", () => {
  it("uses an explicit model before the platform default and rejects a missing model", () => {
    expect(resolveOrchestratorModel(" opencode-go/explicit ", "opencode-go/default")).toBe(
      "opencode-go/explicit",
    );
    expect(resolveOrchestratorModel("", "opencode-go/default")).toBe("opencode-go/default");
    expect(resolveOrchestratorModel("   ", "   ")).toBeUndefined();
  });

  it("creates the session with the resolved model", async () => {
    const { store, agent, orchestrator } = await setup("opencode-go/deepseek-v4.1-flash");
    const result = await orchestrator.execute("hola");
    expect(result.reply).toContain("[simulado");
    expect(agent.session(result.sessionId)?.model).toBe("opencode-go/deepseek-v4.1-flash");
    expect(orchestrator.history().map((message) => message.role)).toEqual(["user", "agent"]);
    store.close();
  });

  it("fails with an actionable error and keeps the user message when no model is configured", async () => {
    const { store, orchestrator, events } = await setup("");
    await expect(orchestrator.execute("hola")).rejects.toBeInstanceOf(OrchestratorConfigurationError);
    const history = orchestrator.history();
    expect(history.map((message) => message.role)).toEqual(["user", "system"]);
    expect(history[0]?.content).toBe("hola");
    expect(history[1]?.content).toContain("ORCHESTRATOR_MODEL");
    expect(events.some((event) => event.bindings.event === "orchestrator_model_missing")).toBe(true);
    expect(events.filter((event) => event.bindings.event === "orchestrator_turn_failed")).toHaveLength(1);
    store.close();
  });

  it("switches the model when a healthy session is reused", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-orchestrator-model-"));
    dirs.push(dir);
    const store = new SqliteStore(":memory:");
    const agent = new FakeAgentRuntime();
    const model = { current: "opencode-go/first" as string | undefined };
    const orchestrator = new ChatWithOrchestratorUseCase({
      store,
      agent,
      controlDirectory: join(dir, "control"),
      orchestratorAgent: "orchestrator/agente",
      model: () => model.current,
    });

    const first = await orchestrator.execute("uno");
    model.current = "opencode-go/second";
    const second = await orchestrator.execute("dos");

    expect(second.sessionId).toBe(first.sessionId);
    expect(agent.switchedModels.at(-1)).toEqual({
      sessionId: first.sessionId,
      model: "opencode-go/second",
    });
    store.close();
  });
});

describe("global orchestrator empty replies and recovery", () => {
  it("replaces the session and retries once when the first reply is empty", async () => {
    const { store, agent, orchestrator, events } = await setup("opencode-go/fast");
    agent.scriptedReplies = ["", "respuesta recuperada"];

    const result = await orchestrator.execute("hola");

    expect(result.reply).toBe("respuesta recuperada");
    expect(agent.sessionCount).toBe(2);
    expect(agent.promptCalls).toHaveLength(2);
    expect(agent.promptCalls[0]?.sessionId).not.toBe(agent.promptCalls[1]?.sessionId);
    expect(orchestrator.history().map((message) => message.role)).toEqual(["user", "agent"]);
    expect(orchestrator.history()[1]?.content).toBe("respuesta recuperada");
    expect(events.some((event) => event.bindings.event === "orchestrator_empty_reply")).toBe(true);
    expect(events.some((event) => event.bindings.event === "orchestrator_session_replaced")).toBe(true);
    const thread = store.chatThreads.findOrCreate({ scope: "global", externalThreadId: "web" });
    expect(thread.opencodeSessionId).toBe(result.sessionId);
    store.close();
  });

  it("fails after one retry when both replies are empty and never appends an empty agent message", async () => {
    const { store, agent, orchestrator, events } = await setup("opencode-go/fast");
    agent.scriptedReplies = ["", "   "];

    await expect(orchestrator.execute("hola")).rejects.toBeInstanceOf(EmptyAgentReplyError);

    expect(agent.sessionCount).toBe(2);
    expect(orchestrator.history().map((message) => message.role)).toEqual(["user", "system"]);
    expect(orchestrator.history().some((message) => message.role === "agent")).toBe(false);
    expect(events.filter((event) => event.bindings.event === "orchestrator_empty_reply")).toHaveLength(2);
    expect(events.filter((event) => event.bindings.event === "orchestrator_turn_failed")).toHaveLength(1);
    store.close();
  });

  it("omits blank agent messages from history without removing non-empty ones", async () => {
    const { store, orchestrator } = await setup("opencode-go/fast");
    const thread = store.chatThreads.findOrCreate({ scope: "global", externalThreadId: "web" });
    store.chat.append({
      id: "empty",
      threadId: thread.id,
      role: "agent",
      content: "   ",
      createdAt: new Date().toISOString(),
    });
    store.chat.append({
      id: "visible",
      threadId: thread.id,
      role: "agent",
      content: "respuesta válida",
      createdAt: new Date().toISOString(),
    });

    expect(orchestrator.history().map((message) => message.content)).toEqual(["respuesta válida"]);
    store.close();
  });
});
