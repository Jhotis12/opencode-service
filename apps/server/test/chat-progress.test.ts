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
});
