import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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

  it("expands, minimizes and restores the chat surface", async () => {
    renderWithProviders(<ChatPanel storageKey="surface-test" onSend={async () => "ok"} />);
    await userEvent.click(screen.getByRole("button", { name: "Expandir chat" }));
    expect(screen.getByRole("button", { name: "Contraer chat" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Minimizar chat" }));
    expect(screen.getByRole("button", { name: "Restaurar chat del agente" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Restaurar chat del agente" }));
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
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
