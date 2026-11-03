import { describe, expect, it } from "bun:test";
import {
  OpenCodeV2Adapter,
  extractAssistantText,
  type OpenCodeClientFactory,
  type OpenCodeClientLike,
} from "../src/infrastructure/out/opencode/opencode-adapter.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import { AgentPromptTimeoutError } from "../src/application/ports/runtime.ts";

function fakeClient(overrides: Partial<OpenCodeClientLike> = {}): OpenCodeClientLike {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, value: unknown) => {
    calls[name] = [...(calls[name] ?? []), value];
  };
  const client: OpenCodeClientLike & { calls: Record<string, unknown[]> } = {
    calls,
    server: { info: async () => ({ version: "2.2.5" }) },
    model: {
      list: async () => ({
        data: [
          { providerID: "opencode-go", modelID: "fast", name: "Fast", cost: [{ input: 1, output: 2 }] },
          { providerID: "other", id: "x", name: "Other" },
        ],
      }),
    },
    session: {
      create: async (input) => {
        record("create", input);
        return { id: "s1" };
      },
      prompt: async (input) => {
        record("prompt", input);
        return {};
      },
      interrupt: async (input) => record("interrupt", input),
      switchModel: async (input) => record("switchModel", input),
      switchAgent: async (input) => record("switchAgent", input),
      context: async () => [
        { type: "user", content: [{ type: "text", text: "hola" }] },
        {
          type: "assistant",
          content: [
            { type: "reasoning", text: "pensando" },
            { type: "text", text: "primera" },
            { type: "text", text: "segunda" },
          ],
        },
      ],
    },
    experimental: { session: { wait: async (input) => record("wait", input) } },
    integration: { connect: { key: async (input) => record("key", input) } },
    location: { reload: async () => record("reload", {}) },
    event: {
      subscribe: async function* () {
        yield { type: "filesystem.changed" };
        yield { type: "session.text.delta" };
      },
    },
    ...overrides,
  };
  return client;
}

function adapterWith(client: OpenCodeClientLike) {
  const factory: OpenCodeClientFactory = { create: async () => ({ client, url: "http://fake", version: "2.2.5" }) };
  return { adapter: new OpenCodeV2Adapter(factory), client: client as OpenCodeClientLike & { calls: Record<string, unknown[]> } };
}

describe("opencode v2 adapter contract", () => {
  it("maps models and filters provider metadata", async () => {
    const { adapter } = adapterWith(fakeClient());
    const models = await adapter.listModels();
    expect(models).toEqual([
      { providerID: "opencode-go", modelID: "fast", name: "Fast", cost: { input: 1, output: 2 } },
      { providerID: "other", modelID: "x", name: "Other", cost: undefined },
    ]);
  });

  it("creates sessions with directory, agent and parsed model", async () => {
    const { adapter, client } = adapterWith(fakeClient());
    await adapter.createSession({ directory: "/data/workspaces/p1", title: "T", agent: "ventas/calificador", model: "opencode-go/fast#high" });
    expect(client.calls.create?.[0]).toEqual({
      location: { directory: "/data/workspaces/p1" },
      title: "T",
      agent: "ventas/calificador",
      model: { providerID: "opencode-go", id: "fast", variant: "high" },
    });
  });

  it("waits for completion and extracts assistant text", async () => {
    const { adapter, client } = adapterWith(fakeClient());
    const reply = await adapter.prompt("s1", "hola");
    expect(reply).toBe("primera\nsegunda");
    expect(client.calls.wait?.[0]).toEqual({ sessionID: "s1" });
  });

  it("interrupts a prompt that exceeds its timeout", async () => {
    const client = fakeClient({
      experimental: {
        session: {
          wait: async () => new Promise<void>(() => undefined),
        },
      },
    });
    const { adapter } = adapterWith(client);
    await expect(adapter.prompt("s1", "hola", { timeoutMs: 20 })).rejects.toBeInstanceOf(AgentPromptTimeoutError);
    expect((client as OpenCodeClientLike & { calls: Record<string, unknown[]> }).calls.interrupt?.[0]).toEqual({
      sessionID: "s1",
    });
  });

  it("switches models and agents with the generated client shape", async () => {
    const { adapter, client } = adapterWith(fakeClient());
    await adapter.switchModel("s1", "opencode-go/reasoning");
    await adapter.switchAgent("s1", "soporte/triaje");
    expect(client.calls.switchModel?.[0]).toEqual({
      sessionID: "s1",
      model: { providerID: "opencode-go", id: "reasoning", variant: undefined },
    });
    expect(client.calls.switchAgent?.[0]).toEqual({ sessionID: "s1", agent: "soporte/triaje" });
  });

  it("registers provider keys and reloads locations", async () => {
    const { adapter, client } = adapterWith(fakeClient());
    await adapter.registerProviderKey("opencode-go", "sk-test");
    await adapter.reloadLocation();
    expect(client.calls.key?.[0]).toEqual({ integrationID: "opencode-go", key: "sk-test" });
    expect(client.calls.reload).toHaveLength(1);
  });

  it("reports health and streams events until unsubscribed", async () => {
    const { adapter } = adapterWith(fakeClient());
    expect((await adapter.health()).ok).toBe(true);
    const received: unknown[] = [];
    const unsubscribe = await adapter.subscribe((event) => received.push(event));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await unsubscribe();
    expect(received.length).toBe(2);
  });

  it("reports health failures without throwing", async () => {
    const { adapter } = adapterWith(
      fakeClient({ server: { info: async () => { throw new Error("down"); } } }),
    );
    const health = await adapter.health();
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("down");
  });

  it("extracts the last assistant text and ignores reasoning", () => {
    expect(
      extractAssistantText([
        { type: "assistant", content: [{ type: "text", text: "old" }] },
        { type: "assistant", content: [{ type: "reasoning", text: "r" }, { type: "text", text: "new" }] },
      ]),
    ).toBe("new");
    expect(extractAssistantText([])).toBe("");
  });
});

describe("fake runtime", () => {
  it("is deterministic and supports model switching and events", async () => {
    const runtime = new FakeAgentRuntime();
    const events: unknown[] = [];
    await runtime.subscribe((event) => events.push(event));
    const session = await runtime.createSession({ directory: "/tmp/p1", model: "opencode-go/fast" });
    const reply = await runtime.prompt(session.id, "hola mundo");
    expect(reply).toContain("[simulado · opencode-go/fast]");
    await runtime.switchModel(session.id, "opencode-go/reasoning");
    expect((await runtime.prompt(session.id, "x")).startsWith("[simulado · opencode-go/reasoning]")).toBe(true);
    expect(events.some((event) => (event as { type: string }).type === "session.created")).toBe(true);
  });
});
