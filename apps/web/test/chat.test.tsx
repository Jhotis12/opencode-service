import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "../src/components/ChatPanel.tsx";
import { renderWithProviders } from "./render.tsx";

/** Replaces navigator.clipboard and returns a restore function. */
function stubClipboard(writeText?: (text: string) => Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  if (writeText) {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  return () => {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  };
}

describe("ChatPanel", () => {
  it("renders markdown tables and code blocks safely", async () => {
    renderWithProviders(
      <ChatPanel
        storageKey="test"
        initialMessages={[
          {
            id: "m1",
            threadId: "t1",
            role: "agent",
            createdAt: new Date().toISOString(),
            content:
              "| Nodo | Estado |\n| --- | --- |\n| Cotizador | listo |\n\n```ts\nexport const ok = true;\n```\n\n<script>alert(1)</script>",
          },
        ]}
        onSend={async () => "ok"}
      />,
    );
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Cotizador")).toBeInTheDocument();
    expect(screen.getByText(/export const ok/)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("minimizes and restores the chat without an expand control", async () => {
    renderWithProviders(<ChatPanel storageKey="surface-test" onSend={async () => "ok"} />);
    expect(screen.queryByRole("button", { name: "Expandir chat" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Minimizar chat" }));
    expect(screen.getByRole("button", { name: "Restaurar chat del agente" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Restaurar chat del agente" }));
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("falls back to docked from a persisted expanded value", () => {
    localStorage.setItem("chat-surface:legacy-expanded", "expanded");
    renderWithProviders(<ChatPanel storageKey="legacy-expanded" onSend={async () => "ok"} />);
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expandir chat" })).not.toBeInTheDocument();
  });

  it("shows a jump-to-latest pill above the composer and respects reduced motion", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    renderWithProviders(<ChatPanel storageKey="jump-test" onSend={async () => "ok"} />);
    scrollIntoView.mockClear();

    const list = screen.getByTestId("chat-messages");
    Object.defineProperty(list, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 200, configurable: true });
    list.scrollTop = 0;
    fireEvent.scroll(list);

    const jump = await screen.findByRole("button", { name: "Ir al último mensaje" });
    expect(jump.closest("form")).toBeNull();
    await userEvent.click(jump);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "end" });
    vi.unstubAllGlobals();
  });

  it("lets the page scroll once on the primary surface, with no list cap", () => {
    renderWithProviders(<ChatPanel storageKey="primary-surface-test" onSend={async () => "ok"} />);
    const list = screen.getByTestId("chat-messages");
    expect(list.className).not.toContain("max-h-");
    expect(list.className).not.toContain("overflow");
  });

  it("keeps the capped scroll of the message list in the minimizable docked panel", () => {
    renderWithProviders(
      <ChatPanel storageKey="docked-cap-test" onSend={async () => "ok"} onMinimize={() => undefined} />,
    );
    const list = screen.getByTestId("chat-messages");
    expect(list.className).toContain("max-h-80");
    expect(list.className).toContain("overflow-y-auto");
  });

  it("sends a message and appends the reply", async () => {
    const onSend = vi.fn().mockResolvedValue("respuesta del agente");
    renderWithProviders(<ChatPanel storageKey="send-test" onSend={onSend} />);
    await userEvent.type(screen.getByPlaceholderText("Pídele un flujo, una corrección o un reporte…"), "hola");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("respuesta del agente")).toBeInTheDocument();
    expect(onSend).toHaveBeenCalledWith("hola", expect.any(Function));
  });

  it("streams partial text and activity while the agent is working", async () => {
    let resolveReply: (value: string) => void = () => undefined;
    const onSend = vi.fn().mockImplementation(
      (_message: string, onEvent: (event: unknown) => void) =>
        new Promise<string>((resolve) => {
          resolveReply = resolve;
          onEvent({ type: "activity", id: "tool:1", text: "Actualizando el flujo (3 nodos)", status: "started" });
          onEvent({ type: "text", text: "Voy creando " });
          onEvent({ type: "text", text: "los nodos." });
        }),
    );
    const onBusyChange = vi.fn();
    const onActivityChange = vi.fn();
    renderWithProviders(
      <ChatPanel
        storageKey="stream-test"
        onSend={onSend}
        onBusyChange={onBusyChange}
        onActivityChange={onActivityChange}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText("Pídele un flujo, una corrección o un reporte…"), "haz un flujo");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Actualizando el flujo (3 nodos)")).toBeInTheDocument();
    expect(await screen.findByText("Voy creando los nodos.")).toBeInTheDocument();
    expect(onBusyChange).toHaveBeenCalledWith(true);
    expect(onActivityChange).toHaveBeenCalledWith("Actualizando el flujo (3 nodos)");

    resolveReply("Listo, el flujo quedó creado.");
    expect(await screen.findByText("Listo, el flujo quedó creado.")).toBeInTheDocument();
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  });

  it("confirms the cancellation in a dialog and keeps the turn when it is dismissed", async () => {
    const onCancelTurn = vi.fn().mockResolvedValue({});
    const onSend = vi.fn().mockImplementation(
      (_message: string, onEvent: (event: unknown) => void) =>
        new Promise<string>(() => {
          onEvent({
            type: "turn",
            turn: { id: "turn-42", status: "running", startedAt: new Date().toISOString() },
          });
        }),
    );
    renderWithProviders(
      <ChatPanel storageKey="cancel-dialog-test" onSend={onSend} onCancelTurn={onCancelTurn} />,
    );

    await userEvent.type(screen.getByPlaceholderText("Pídele un flujo, una corrección o un reporte…"), "hola");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Cancelar el turno");

    await userEvent.click(screen.getByRole("button", { name: "Seguir trabajando" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onCancelTurn).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar turno" }));
    await waitFor(() => expect(onCancelTurn).toHaveBeenCalledWith("turn-42"));
    expect(await screen.findByText("Turno cancelado")).toBeInTheDocument();
  });

  it("copies a message with the clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const restoreClipboard = stubClipboard(writeText);
    try {
      renderWithProviders(
        <ChatPanel
          storageKey="copy-test"
          initialMessages={[
            {
              id: "m1",
              threadId: "t1",
              role: "user",
              content: "crea un nodo cotizador",
              createdAt: new Date().toISOString(),
            },
          ]}
          onSend={async () => "ok"}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: "Copiar mensaje: crea un nodo cotizador" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith("crea un nodo cotizador"));
      expect(await screen.findByText("Copiado")).toBeInTheDocument();
    } finally {
      restoreClipboard();
    }
  });

  it("falls back to the selection command when the clipboard API is unavailable", async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand");
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true, writable: true });
    const restoreClipboard = stubClipboard();
    try {
      renderWithProviders(
        <ChatPanel
          storageKey="copy-fallback-test"
          initialMessages={[
            {
              id: "m1",
              threadId: "t1",
              role: "agent",
              content: "Nodo cotizador listo",
              createdAt: new Date().toISOString(),
            },
          ]}
          onSend={async () => "ok"}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: "Copiar mensaje: Nodo cotizador listo" }));
      await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
      expect(await screen.findByText("Copiado")).toBeInTheDocument();
    } finally {
      restoreClipboard();
      if (originalExecCommand) Object.defineProperty(document, "execCommand", originalExecCommand);
      else Reflect.deleteProperty(document, "execCommand");
    }
  });

  it("filters the visible history with the in-chat search", async () => {
    renderWithProviders(
      <ChatPanel
        storageKey="search-test"
        initialMessages={[
          {
            id: "m1",
            threadId: "t1",
            role: "user",
            content: "crea un nodo cotizador",
            createdAt: new Date().toISOString(),
          },
          {
            id: "m2",
            threadId: "t1",
            role: "agent",
            content: "Listo, el nodo cotizador quedó creado",
            createdAt: new Date().toISOString(),
          },
          {
            id: "m3",
            threadId: "t1",
            role: "user",
            content: "gracias",
            createdAt: new Date().toISOString(),
          },
        ]}
        onSend={async () => "ok"}
      />,
    );

    const search = screen.getByLabelText("Buscar en el chat");
    expect(screen.getByText("gracias")).toBeInTheDocument();

    await userEvent.type(search, "cotizador");
    expect(screen.getByText(/2 de 3 mensajes/)).toBeInTheDocument();
    expect(screen.queryByText("gracias")).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, "inexistente");
    expect(await screen.findByText("Ningún mensaje coincide")).toBeInTheDocument();
    expect(screen.getByText(/0 de 3 mensajes/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ver todo el historial" }));
    expect(await screen.findByText("gracias")).toBeInTheDocument();
  });

  it("shows the history loading state and the history error state with a retry action", async () => {
    const { rerender } = renderWithProviders(
      <ChatPanel storageKey="history-states-test" onSend={async () => "ok"} historyStatus="loading" />,
    );
    expect(screen.getByText("Cargando el historial del chat…")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();

    const onRetryHistory = vi.fn();
    rerender(
      <ChatPanel
        storageKey="history-states-test"
        onSend={async () => "ok"}
        historyStatus="error"
        historyError="No se pudo cargar el historial."
        onRetryHistory={onRetryHistory}
      />,
    );
    expect(await screen.findByText("No se pudo cargar el historial.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetryHistory).toHaveBeenCalledTimes(1);
  });
});
