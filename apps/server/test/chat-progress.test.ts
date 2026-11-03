import { describe, expect, it } from "bun:test";
import type { ChatProgressEvent } from "@platform/shared";
import { createChatProgressHandler } from "../src/application/use-cases/chat-progress.ts";

describe("chat progress mapping", () => {
  it("maps text, workflow tool activity and tool completion", () => {
    const events: ChatProgressEvent[] = [];
    const handle = createChatProgressHandler((event) => events.push(event));

    handle(
      {
        type: "session.tool.input.started",
        data: { sessionID: "s1", id: "t1", name: "workflow_upsert" },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.called",
        data: {
          sessionID: "s1",
          id: "t1",
          input: { graph: { nodes: [{ label: "Inicio" }, { label: "Consultar API" }] } },
        },
      },
      "s1",
    );
    handle({ type: "session.text.delta", data: { sessionID: "s1", delta: "Voy creando" } }, "s1");
    handle({ type: "session.tool.success", data: { sessionID: "s1", id: "t1" } }, "s1");

    expect(events).toContainEqual({ type: "text", text: "Voy creando" });
    expect(events).toContainEqual({
      type: "activity",
      id: "tool:t1",
      text: "Actualizando el flujo (2 nodos: Inicio, Consultar API)",
      status: "started",
    });
    expect(events).toContainEqual({
      type: "activity",
      id: "tool:t1",
      text: "Actualizando el flujo (2 nodos: Inicio, Consultar API)",
      status: "succeeded",
    });
  });

  it("ignores events from other sessions", () => {
    const events: ChatProgressEvent[] = [];
    const handle = createChatProgressHandler((event) => events.push(event));
    handle({ type: "session.text.delta", data: { sessionID: "other", delta: "no" } }, "s1");
    expect(events).toEqual([]);
  });

  it("normalizes namespaced platform tools and maps file and command details", () => {
    const events: ChatProgressEvent[] = [];
    const handle = createChatProgressHandler((event) => events.push(event));

    handle(
      {
        type: "session.tool.input.started",
        data: { sessionID: "s1", id: "t1", name: "platform_workflow_upsert" },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.called",
        data: {
          sessionID: "s1",
          id: "t1",
          input: { graph: { nodes: [{ label: "Inicio" }, { label: "Cobrar" }] } },
        },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.input.started",
        data: { sessionID: "s1", id: "t2", name: "platform_workflow_get" },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.called",
        data: { sessionID: "s1", id: "t2", input: { projectSlug: "p1" } },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.input.started",
        data: { sessionID: "s1", id: "t3", name: "edit" },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.called",
        data: { sessionID: "s1", id: "t3", input: { filePath: "nodes/validar.ts" } },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.input.started",
        data: { sessionID: "s1", id: "t4", name: "bash" },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.called",
        data: { sessionID: "s1", id: "t4", input: { command: "bun test --cwd apps/server" } },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.input.started",
        data: { sessionID: "s1", id: "t5", name: "shell" },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.called",
        data: { sessionID: "s1", id: "t5", input: { command: "tsc --noEmit" } },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.input.started",
        data: { sessionID: "s1", id: "t6", name: "write" },
      },
      "s1",
    );
    handle(
      {
        type: "session.tool.called",
        data: { sessionID: "s1", id: "t6", input: { filePath: "workflow.json" } },
      },
      "s1",
    );

    const texts = events.filter((event) => event.type === "activity").map((event) => event.text);
    expect(texts).toContain("Actualizando el flujo (2 nodos: Inicio, Cobrar)");
    expect(texts).toContain("Revisando el flujo");
    expect(texts).toContain("Actualizando el nodo validar.ts");
    expect(texts).toContain("Ejecutando pruebas");
    expect(texts).toContain("Verificando tipos");
    expect(texts).toContain("Actualizando el flujo");
  });
});
