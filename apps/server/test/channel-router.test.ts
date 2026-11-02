import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import { RouteIncomingMessageUseCase } from "../src/application/use-cases/route-channel-message.ts";
import {
  parseApprovalCommand,
  routeMessage,
  senderMatchesAllowlist,
} from "../src/domain/channels/router.ts";
import type { ChannelEgressPort, TriggerRef } from "../src/application/ports/channels.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";

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

class FakeEgress implements ChannelEgressPort {
  sent: Array<{ channelSlug: string; text: string }> = [];
  async send(channelSlug: string, text: string, _recipient?: string) {
    this.sent.push({ channelSlug, text });
  }
}

const trigger: TriggerRef = {
  projectSlug: "ventas",
  workflowId: "ventas",
  nodeId: "start",
  channelSlug: "telegram",
  isPublic: true,
};

describe("channel router domain", () => {
  it("routes allowlisted senders to the global orchestrator", () => {
    const decision = routeMessage({
      senderId: "+57 300 111 2233",
      text: "¿cómo va el flujo?",
      channelSlug: "telegram",
      allowlist: ["+573001112233"],
      triggers: [trigger],
    });
    expect(decision.type).toBe("orchestrator");
  });

  it("parses approval commands from admins", () => {
    expect(parseApprovalCommand("/approve run-12345678 review")).toEqual({
      action: "approve",
      runId: "run-12345678",
      nodeId: "review",
    });
    expect(parseApprovalCommand("/reject run-12345678 review")?.action).toBe("reject");
    expect(parseApprovalCommand("hola")).toBeUndefined();
    const decision = routeMessage({
      senderId: "123",
      text: "/approve run-12345678 review",
      channelSlug: "telegram",
      allowlist: ["123"],
      triggers: [],
    });
    expect(decision.type).toBe("approval");
  });

  it("routes unknown senders only to public triggers", () => {
    const allowed = routeMessage({ senderId: "999", text: "hola", channelSlug: "telegram", allowlist: ["123"], triggers: [trigger] });
    expect(allowed.type).toBe("workflow");
    const dropped = routeMessage({ senderId: "999", text: "hola", channelSlug: "telegram", allowlist: ["123"], triggers: [{ ...trigger, isPublic: false }] });
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
    config: { kind: "telegram", channelSlug: "telegram", isPublic: true },
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
  store.channels.create({
    id: "c1",
    slug: "telegram",
    type: "telegram",
    name: "Telegram",
    adminAllowlist: ["+573001112233"],
    isPublic: true,
    status: "connected",
    createdAt: new Date().toISOString(),
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
  const router = new RouteIncomingMessageUseCase({
    store,
    workspace,
    agent,
    executor: executor as never,
    egress,
    events: { publish() {} },
    logger: silentLogger,
    orchestratorDirectory: join(dir, "orchestrator"),
  });
  return { router, store, agent, egress, executed, approvals };
}

describe("route incoming messages", () => {
  it("answers admin messages through a persistent orchestrator session", async () => {
    const { router, agent, egress, executed } = await setup();
    await router.execute({ channelSlug: "telegram", channelType: "telegram", senderId: "+573001112233", text: "estado" });
    await router.execute({ channelSlug: "telegram", channelType: "telegram", senderId: "+573001112233", text: "otra" });
    expect(agent.sessionCount).toBe(1);
    expect(agent.prompts).toHaveLength(2);
    expect(egress.sent).toHaveLength(2);
    expect(executed).toHaveLength(0);
  });

  it("executes public workflow triggers for unknown senders", async () => {
    const { router, egress, executed } = await setup();
    await router.execute({ channelSlug: "telegram", channelType: "telegram", senderId: "999", text: "hola" });
    expect(executed).toHaveLength(1);
    expect(egress.sent[0]?.text).toBe("resultado-flujo");
  });

  it("drops unknown senders when no public trigger matches", async () => {
    const { router, egress, executed, store } = await setup();
    store.channels.create({
      id: "c2",
      slug: "telegram-2",
      type: "telegram",
      name: "Telegram 2",
      adminAllowlist: [],
      isPublic: false,
      status: "connected",
      createdAt: new Date().toISOString(),
    });
    const result = await router.execute({ channelSlug: "telegram-2", channelType: "telegram", senderId: "999", text: "hola" });
    expect(result.decision).toBe("dropped");
    expect(egress.sent).toHaveLength(0);
    expect(executed).toHaveLength(0);
  });

  it("resumes paused runs from admin approval commands", async () => {
    const { router, approvals, egress } = await setup();
    await router.execute({
      channelSlug: "telegram",
      channelType: "telegram",
      senderId: "+573001112233",
      text: "/approve run-12345678 review",
    });
    expect(approvals).toEqual([{ runId: "run-12345678", nodeId: "review", approved: true, by: "+573001112233" }]);
    expect(egress.sent[0]?.text).toContain("succeeded");
  });
});
