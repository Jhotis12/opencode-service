import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import { ChatWithProjectUseCase } from "../src/application/use-cases/projects.ts";
import { ChatWithOrchestratorUseCase } from "../src/application/use-cases/orchestrator.ts";
import { RouteProjectIntegrationMessageUseCase } from "../src/application/use-cases/route-channel-message.ts";
import type { IntegrationEgressPort } from "../src/application/ports/channels.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const logger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return logger;
  },
};

class FakeEgress implements IntegrationEgressPort {
  sent: string[] = [];
  async send(_integrationId: string, text: string) {
    this.sent.push(text);
  }
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-chat-recovery-"));
  dirs.push(dir);
  const store = new SqliteStore(":memory:");
  const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
  await workspace.createProject({ slug: "ventas", name: "Ventas" });
  const now = new Date().toISOString();
  store.projects.create({
    id: "p1",
    slug: "ventas",
    name: "Ventas",
    description: "",
    primaryAgent: "principal/agente",
    createdAt: now,
    updatedAt: now,
  });
  const agent = new FakeAgentRuntime();
  const thread = store.chatThreads.findOrCreate({ scope: "project", projectSlug: "ventas", externalThreadId: "web" });
  store.chatThreads.setSession(thread.id, "ses_stale");
  const globalThread = store.chatThreads.findOrCreate({ scope: "global", externalThreadId: "web" });
  store.chatThreads.setSession(globalThread.id, "ses_stale_global");
  return { dir, store, workspace, agent, thread, globalThread };
}

describe("chat session recovery after OpenCode restart", () => {
  it("recreates a stale project session on the same thread", async () => {
    const { store, workspace, agent, thread } = await setup();
    const chat = new ChatWithProjectUseCase({
      store,
      workspace,
      agent,
      events: { publish() {} },
      logger,
    });
    const result = await chat.execute("ventas", "hola después del reinicio");
    expect(result.reply).toContain("[simulado");
    expect(result.sessionId).not.toBe("ses_stale");
    expect(store.chatThreads.findById(thread.id)?.opencodeSessionId).toBe(result.sessionId);
    expect(chat.history("ventas").map((message) => message.role)).toEqual(["user", "agent"]);
    expect(agent.sessionCount).toBe(1);
    store.close();
  });

  it("streams project chat text progress while the agent works", async () => {
    const { store, workspace, agent } = await setup();
    const chat = new ChatWithProjectUseCase({
      store,
      workspace,
      agent,
      events: { publish() {} },
      logger,
    });
    const progress: Array<{ type: string; text?: string }> = [];
    const result = await chat.execute("ventas", "construye el flujo", (event) => progress.push(event));
    expect(result.reply).toContain("[simulado");
    expect(progress.some((event) => event.type === "text" && event.text?.includes("[simulado"))).toBe(true);
    store.close();
  });

  it("recreates a stale global orchestrator session", async () => {
    const { dir, store, agent, globalThread } = await setup();
    const orchestrator = new ChatWithOrchestratorUseCase({
      store,
      agent,
      controlDirectory: join(dir, "control"),
      orchestratorAgent: "orchestrator/agente",
      logger,
    });
    const result = await orchestrator.execute("estado global");
    expect(result.reply).toContain("[simulado");
    expect(result.sessionId).not.toBe("ses_stale_global");
    expect(store.chatThreads.findById(globalThread.id)?.opencodeSessionId).toBe(result.sessionId);
    expect(orchestrator.history().map((message) => message.role)).toEqual(["user", "agent"]);
    store.close();
  });

  it("recovers project channel conversations too", async () => {
    const { store, workspace, agent } = await setup();
    const now = new Date().toISOString();
    store.integrations.create({
      id: "i1",
      scope: "project",
      projectSlug: "ventas",
      kind: "telegram",
      name: "Telegram",
      slug: "telegram",
      config: { routing: { mode: "agent", allowlist: ["123"], public: false } },
      secretRefs: {},
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    const channelThread = store.chatThreads.findOrCreate({
      scope: "project",
      projectSlug: "ventas",
      integrationId: "i1",
      externalThreadId: "123",
    });
    store.chatThreads.setSession(channelThread.id, "ses_stale_channel");
    const egress = new FakeEgress();
    const router = new RouteProjectIntegrationMessageUseCase({
      store,
      workspace,
      agent,
      executor: {} as never,
      egress,
      events: { publish() {} },
      logger,
    });
    await router.execute({ integrationId: "i1", kind: "telegram", senderId: "123", text: "hola" });
    expect(store.chatThreads.findById(channelThread.id)?.opencodeSessionId).not.toBe("ses_stale_channel");
    expect(egress.sent[0]).toContain("[simulado");
    store.close();
  });
});
