import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SseEvent } from "@platform/shared";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { MarkdownAgentAdapter } from "../src/infrastructure/out/agents/markdown-agent-adapter.ts";
import { ManageSubagentsUseCase } from "../src/application/use-cases/manage-subagents.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import {
  AgentMarkdownError,
  agentRelativePath,
  parseAgentMarkdown,
  parseAgentPath,
  serializeAgentMarkdown,
} from "../src/domain/agents/markdown.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-agents-"));
  dirs.push(dir);
  const workspace = new SafeFsWorkspaceAdapter(dir);
  await workspace.createProject({ slug: "p1", name: "P1" });
  const adapter = new MarkdownAgentAdapter(workspace);
  const runtime = new FakeAgentRuntime();
  const events: SseEvent[] = [];
  const useCase = new ManageSubagentsUseCase(workspace, adapter, runtime, { publish: (event) => events.push(event) });
  return { workspace, adapter, runtime, events, useCase };
}

const markdown = `---
description: Califica leads entrantes
mode: subagent
model: opencode-go/fast
color: "#3b82f6"
permissions:
  - action: edit
    resource: "*"
    effect: deny
---

Eres el calificador de ventas. Responde con un score de 1 a 10.
`;

describe("agent markdown format", () => {
  it("parses frontmatter and body", () => {
    const profile = parseAgentMarkdown(markdown, ".opencode/agents/ventas/calificador.md");
    expect(profile.category).toBe("ventas");
    expect(profile.role).toBe("calificador");
    expect(profile.frontmatter.mode).toBe("subagent");
    expect(profile.frontmatter.model).toBe("opencode-go/fast");
    expect(profile.frontmatter.permissions[0]).toEqual({ action: "edit", resource: "*", effect: "deny" });
    expect(profile.body).toContain("calificador de ventas");
  });

  it("round-trips through serialization", () => {
    const profile = parseAgentMarkdown(markdown, ".opencode/agents/ventas/calificador.md");
    const reparsed = parseAgentMarkdown(
      serializeAgentMarkdown(profile.frontmatter, profile.body),
      ".opencode/agents/ventas/calificador.md",
    );
    expect(reparsed.frontmatter).toEqual(profile.frontmatter);
    expect(reparsed.body).toBe(profile.body);
  });

  it("rejects missing or invalid frontmatter", () => {
    expect(() => parseAgentMarkdown("solo cuerpo")).toThrow(AgentMarkdownError);
    expect(() => parseAgentMarkdown("---\nmode: subagent\n---\nbody")).toThrow(AgentMarkdownError);
    expect(() => parseAgentMarkdown("---\ndescription: x\nmode: nope\n---\nbody")).toThrow(AgentMarkdownError);
  });

  it("builds and parses hierarchical paths", () => {
    expect(agentRelativePath("ventas", "cotizador")).toBe(".opencode/agents/ventas/cotizador.md");
    expect(parseAgentPath(".opencode/agents/ventas/cotizador.md")).toEqual({ category: "ventas", role: "cotizador" });
    expect(() => agentRelativePath("../evil", "x")).toThrow(AgentMarkdownError);
  });
});

describe("subagent catalog", () => {
  it("creates, lists, updates and removes agents with reload events", async () => {
    const { useCase, adapter, events } = await setup();
    await useCase.upsert("p1", {
      category: "ventas",
      role: "calificador",
      frontmatter: { description: "Califica leads", mode: "subagent", permissions: [], notebooks: [] },
      body: "Clasifica al lead.",
    });
    expect((await adapter.list("p1")).map((profile) => `${profile.category}/${profile.role}`)).toEqual([
      "ventas/calificador",
    ]);
    await useCase.upsert("p1", {
      category: "ventas",
      role: "calificador",
      frontmatter: { description: "Califica leads v2", mode: "all", permissions: [], notebooks: [] },
      body: "Clasifica y responde.",
    });
    const updated = await adapter.get("p1", "ventas", "calificador");
    expect(updated?.frontmatter.description).toBe("Califica leads v2");
    expect(updated?.frontmatter.mode).toBe("all");
    await useCase.remove("p1", "ventas", "calificador");
    expect(await adapter.list("p1")).toEqual([]);
    expect(events.filter((event) => event.type === "agent.updated")).toHaveLength(3);
  });

  it("manages project-scoped MCP servers in opencode.jsonc", async () => {
    const { useCase, adapter, workspace, events } = await setup();
    await useCase.upsertMcp("p1", "playwright", { type: "local", command: ["bunx", "@playwright/mcp"] });
    expect((await adapter.listMcp("p1")).playwright?.command).toEqual(["bunx", "@playwright/mcp"]);
    expect((await workspace.readOpencodeConfig("p1")).mcp).toBeDefined();
    await useCase.removeMcp("p1", "playwright");
    expect(await adapter.listMcp("p1")).toEqual({});
    expect(events.some((event) => event.type === "agent.updated" && event.agentId === "mcp:playwright")).toBe(true);
  });
});
