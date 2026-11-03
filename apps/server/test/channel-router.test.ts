import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import {
  RouteGlobalIntegrationMessageUseCase,
  RouteProjectIntegrationMessageUseCase,
} from "../src/application/use-cases/route-channel-message.ts";
import { parseApprovalCommand, routeProjectMessage, senderMatchesAllowlist } from "../src/domain/channels/router.ts";
import type { IntegrationEgressPort, TriggerRef } from "../src/application/ports/channels.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";
import type { IntegrationRecord } from "../src/domain/entities.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

class FakeEgress implements IntegrationEgressPort {
  sent: Array<{ integrationId: string; text: string }> = [];
  async send(integrationId: string, text: string) {
    this.sent.push({ integrationId, text });
    return {};
  }
}

const trigger: TriggerRef = {
  projectSlug: "ventas",
  workflowId: "ventas",
  nodeId: "start",
  integrationId: "i1",
  event: "message.received",
};

describe("project channel routing domain", () => {
  it("routes allowlisted senders to the project agent in hybrid mode", () => {
    const decision = routeProjectMessage({
      senderId: "+57 300 111 2233",
      text: "¿cómo va el flujo?",
      mode: "hybrid",
      allowlist: ["+573001112233"],
      publicTriggers: true,
      triggers: [trigger],
    });
    expect(decision.type).toBe("agent");
  });

  it("parses approval commands from admins", () => {
    expect(parseApprovalCommand("/approve run-12345678 review")).toEqual({
      action: "approve",
      runId: "run-12345678",
      nodeId: "review",
    });
    expect(parseApprovalCommand("/reject run-12345678 review")?.action).toBe("reject");
    expect(parseApprovalCommand("hola")).toBeUndefined();
    const decision = routeProjectMessage({
      senderId: "123",
      text: "/approve run-12345678 review",
      mode: "hybrid",
      allowlist: ["123"],
      publicTriggers: false,
      triggers: [],
    });
    expect(decision.type).toBe("approval");
  });

  it("routes unknown senders only to public triggers", () => {
    const allowed = routeProjectMessage({
      senderId: "999",
      text: "hola",
      mode: "hybrid",
      allowlist: ["123"],
      publicTriggers: true,
      triggers: [trigger],
    });
    expect(allowed.type).toBe("workflow");
    const dropped = routeProjectMessage({
      senderId: "999",
      text: "hola",
      mode: "hybrid",
      allowlist: ["123"],
      publicTriggers: false,
      triggers: [trigger],
    });
    expect(dropped.type).toBe("dropped");
  });

  it("matches phone numbers regardless of formatting", () => {
    expect(senderMatchesAllowlist("+57 300-111-2233", ["573001112233"])).toBe(true);
    expect(senderMatchesAllowlist("12345@s.whatsapp.net", ["12345"])).toBe(true);
    expect(senderMatchesAllowlist("999", ["123"])).toBe(false);
  });
});

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-channels-"));
  dirs.push(dir);
  const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
  await workspace.createProject({ slug: "ventas", name: "Ventas" });
  const graph = await workspace.readWorkflow("ventas");
  graph.nodes[0] = {
    ...graph.nodes[0]!,
    config: { kind: "integration", integrationId: "i1", event: "message.received" },
  };
  graph.nodes.push({
    id: "reply",
    type: "code",
    codeFile: "nodes/reply.ts",
    position: { x: 200, y: 0 },
    config: {},
    notebookIds: [],
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 0 },
  });
  graph.edges.push({ id: "e1", source: "start", target: "reply" });
  await workspace.writeWorkflow("ventas", graph);
  await workspace.writeNode("ventas", "nodes/reply.ts", `export default async (input: any) => "eco:" + input.message;`);

  const store = new SqliteStore(":memory:");
  const now = new Date().toISOString();
  const integration: IntegrationRecord = {
    id: "i1",
    scope: "project",
    projectSlug: "ventas",
    kind: "telegram",
    name: "Telegram",
    slug: "telegram",
    config: { routing: { mode: "hybrid", allowlist: ["+573001112233"], public: true } },
    secretRefs: {},
    capabilities: ["inbound_message", "outbound_message"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
  };
  store.integrations.create(integration);
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
  const egress = new FakeEgress();
  const executed: unknown[] = [];
  const approvals: unknown[] = [];
  const executor = {
    execute: async (input: unknown) => {
      executed.push(input);
      return { id: "run-12345678", status: "succeeded", output: "resultado-flujo" };
    },
    resumeWithApproval: async (runId: string, nodeId: string, approved: boolean, by: string) => {
      approvals.push({ runId, nodeId, approved, by });
      return { id: runId, status: approved ? "succeeded" : "failed" };
    },
  };
  const router = new RouteProjectIntegrationMessageUseCase({
    store,
    workspace,
    agent,
    executor: executor as never,
    egress,
    events: { publish() {} },
    logger: silentLogger,
  });
  return { router, store, agent, egress, executed, approvals };
}

describe("route incoming project messages", () => {
  it("answers admin messages through the project agent", async () => {
    const { router, agent, egress, executed } = await setup();
    await router.execute({ integrationId: "i1", kind: "telegram", senderId: "+573001112233", text: "estado" });
    await router.execute({ integrationId: "i1", kind: "telegram", senderId: "+573001112233", text: "otra" });
    expect(agent.sessionCount).toBe(1);
    expect(agent.prompts).toHaveLength(2);
    expect(egress.sent).toHaveLength(2);
    expect(executed).toHaveLength(0);
  });

  it("executes public workflow triggers for unknown senders", async () => {
    const { router, egress, executed } = await setup();
    await router.execute({ integrationId: "i1", kind: "telegram", senderId: "999", text: "hola" });
    expect(executed).toHaveLength(1);
    expect(egress.sent[0]?.text).toBe("resultado-flujo");
  });

  it("drops unknown senders when public access is disabled", async () => {
    const { router, store, egress, executed } = await setup();
    const integration = store.integrations.findById("i1")!;
    integration.config = { routing: { mode: "hybrid", allowlist: ["123"], public: false } };
    store.integrations.update("i1", { config: integration.config });
    const result = await router.execute({ integrationId: "i1", kind: "telegram", senderId: "999", text: "hola" });
    expect(result.decision).toBe("dropped");
    expect(egress.sent).toHaveLength(0);
    expect(executed).toHaveLength(0);
  });

  it("resumes paused runs from admin approval commands", async () => {
    const { router, approvals, egress } = await setup();
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "/approve run-12345678 review",
    });
    expect(approvals).toEqual([{ runId: "run-12345678", nodeId: "review", approved: true, by: "+573001112233" }]);
    expect(egress.sent[0]?.text).toContain("succeeded");
  });

  it("routes only allowlisted senders to the global orchestrator", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-global-"));
    dirs.push(dir);
    const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
    const store = new SqliteStore(":memory:");
    const now = new Date().toISOString();
    store.integrations.create({
      id: "global-1",
      scope: "global",
      kind: "telegram",
      name: "Alertas",
      slug: "alertas",
      config: { routing: { mode: "agent", allowlist: ["123"], public: false } },
      secretRefs: {},
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    const agent = new FakeAgentRuntime();
    const egress = new FakeEgress();
    const router = new RouteGlobalIntegrationMessageUseCase({
      store,
      workspace,
      agent,
      executor: {} as never,
      egress,
      events: { publish() {} },
      logger: silentLogger,
      controlDirectory: join(dir, "control"),
      orchestratorAgent: "orchestrator/agente",
    });
    const allowed = await router.execute({ integrationId: "global-1", kind: "telegram", senderId: "123", text: "estado" });
    const dropped = await router.execute({ integrationId: "global-1", kind: "telegram", senderId: "999", text: "hola" });
    expect(allowed.decision).toBe("orchestrator");
    expect(dropped.decision).toBe("dropped");
    expect(egress.sent).toHaveLength(1);
    expect(agent.sessionCount).toBe(1);
    store.close();
  });
});
