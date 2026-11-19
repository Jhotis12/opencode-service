import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "../src/components/ChatPanel.tsx";
import { api, type ChatHistoryMessage } from "../src/api.ts";
import { renderWithProviders } from "./render.tsx";

function sseResponse(errorGate: Promise<void>): Response {
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          'event: activity\ndata: {"type":"activity","id":"tool:1","text":"Consultando ejecuciones","status":"started"}\n\n',
        ),
      );
      void errorGate.then(() => {
        controller.enqueue(
          encoder.encode(
            'event: error\ndata: {"message":"the orchestrator returned an empty response"}\n\n',
          ),
        );
        controller.close();
      });
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
    let releaseError = () => {};
    const errorGate = new Promise<void>((resolve) => {
      releaseError = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(errorGate)));
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
    releaseError();
    expect(await screen.findByText(/Error: the orchestrator returned an empty response/)).toBeInTheDocument();
    await waitFor(() => expect(onActivityChange).toHaveBeenLastCalledWith(undefined));

    const agentBubbles = screen
      .getAllByRole("article")
      .filter((article) => article.className.includes("border-line") && article.textContent?.trim() === "");
    expect(agentBubbles).toHaveLength(0);
  });

  it("does not duplicate the reply when a history refetch arrives mid-stream", async () => {
    const initial: ChatHistoryMessage[] = [
      {
        id: "u1",
        threadId: "t1",
        role: "user",
        content: "hola",
        createdAt: new Date().toISOString(),
      },
    ];

    const onBusyChange = vi.fn();
    let releaseStream = () => {};
    const streamGate = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });

    function Harness() {
      const [history, setHistory] = useState(initial);
      return (
        <>
          <output data-testid="history-length" data-length={history.length} />
          <ChatPanel
            storageKey="control-chat-duplicate-test"
            initialMessages={history}
            onBusyChange={onBusyChange}
            onSend={async (_message, onEvent) => {
              onEvent({ type: "text", turnId: "turn-test", text: "OK" });
              setHistory([
                ...initial,
                {
                  id: "a1",
                  threadId: "t1",
                  role: "agent",
                  content: "OK",
                  createdAt: new Date().toISOString(),
                },
              ]);
              await streamGate;
              return "OK";
            }}
          />
        </>
      );
    }

    renderWithProviders(<Harness />);
    await userEvent.type(screen.getByPlaceholderText("Pídele un flujo, una corrección o un reporte…"), "hola");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(screen.getByTestId("history-length")).toHaveAttribute("data-length", "2"));
    releaseStream();
    await waitFor(() => expect(screen.getAllByText("OK")).toHaveLength(1));
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  });
});
