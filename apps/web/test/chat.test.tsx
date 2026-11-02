import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "../src/components/ChatPanel.tsx";
import { renderWithProviders } from "./render.tsx";

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
});
