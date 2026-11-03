import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "../src/components/ChatPanel.tsx";
import { api } from "../src/api.ts";
import { renderWithProviders } from "./render.tsx";

function sseResponse(): Response {
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          'event: activity\ndata: {"type":"activity","id":"tool:1","text":"Consultando ejecuciones","status":"started"}\n\n',
        ),
      );
      setTimeout(() => {
        controller.enqueue(
          encoder.encode(
            'event: error\ndata: {"message":"the orchestrator returned an empty response"}\n\n',
          ),
        );
        controller.close();
      }, 50);
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("control chat progress", () => {
  it("sends activity to the chat and renders an error instead of an empty agent bubble", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse()));
    const onActivityChange = vi.fn();

    renderWithProviders(
      <ChatPanel
        storageKey="control-chat-test"
        title="Orquestador global"
        onActivityChange={onActivityChange}
        onSend={(message, onEvent) => api.controlChat(message, onEvent).then((result) => result.reply)}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText("Pídele un flujo, una corrección o un reporte…"), "hola");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(onActivityChange).toHaveBeenCalledWith("Consultando ejecuciones"));
    expect(await screen.findByText(/Error: the orchestrator returned an empty response/)).toBeInTheDocument();

    const agentBubbles = screen
      .getAllByRole("article")
      .filter((article) => article.className.includes("border-line") && article.textContent?.trim() === "");
    expect(agentBubbles).toHaveLength(0);
  });
});
