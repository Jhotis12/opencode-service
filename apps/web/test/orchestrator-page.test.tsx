import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OrchestratorPage } from "../src/pages/OrchestratorPage.tsx";
import { api, ApiClientError, type ChatHistoryMessage, type OrchestratorOverview } from "../src/api.ts";
import { renderWithProviders } from "./render.tsx";

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return {
    ...actual,
    api: {
      controlOverview: vi.fn(),
      controlChatHistory: vi.fn(),
      controlChat: vi.fn(),
      attachControlChatTurn: vi.fn(),
      cancelControlChatTurn: vi.fn(),
      retryControlChatTurn: vi.fn(),
    },
  };
});

const overviewFixture: OrchestratorOverview = {
  projects: [{ slug: "ventas", name: "Ventas", description: "Caso de uso comercial", status: "active" }],
  recentRuns: [
    {
      id: "run-1234567890abcdef",
      projectSlug: "ventas",
      workflowId: "flujo-diario",
      status: "failed",
      error: "La API respondió 500",
      startedAt: "2026-11-19T10:00:00.000Z",
      finishedAt: "2026-11-19T10:01:00.000Z",
    },
    {
      id: "run-abcdef1234567890",
      projectSlug: "ventas",
      workflowId: "flujo-diario",
      status: "succeeded",
      startedAt: "2026-11-19T09:00:00.000Z",
      finishedAt: "2026-11-19T09:00:30.000Z",
    },
  ],
  recentErrors: [
    {
      id: "err-1",
      message: "Fallo al enviar el correo",
      entryPoint: "global_orchestrator",
      createdAt: "2026-11-19T11:00:00.000Z",
    },
  ],
  integrations: [{ id: "i1", scope: "global", kind: "telegram", name: "Alertas admin", status: "connected" }],
};

const emptyOverview: OrchestratorOverview = {
  projects: [],
  recentRuns: [],
  recentErrors: [],
  integrations: [],
};

function historyMessage(id: string, role: "user" | "agent", content: string): ChatHistoryMessage {
  return { id, threadId: "t-global", role, content, createdAt: "2026-11-19T12:00:00.000Z" };
}

function renderPage() {
  return renderWithProviders(
    <MemoryRouter>
      <OrchestratorPage />
    </MemoryRouter>,
  );
}

function statValue(label: string): string | undefined {
  const labelElement = screen.getAllByText(label).find((element) => element.tagName === "SMALL");
  return labelElement?.closest("div")?.querySelector("strong")?.textContent ?? undefined;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.controlChatHistory).mockResolvedValue({ data: [] });
});

describe("orchestrator page", () => {
  it("shows skeletons and never a fake zero while the overview loads", async () => {
    vi.mocked(api.controlOverview).mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();

    expect(screen.getAllByRole("status").map((node) => node.textContent)).toContain(
      "Cargando el resumen del orquestador…",
    );
    expect(screen.queryByText("Fallos recientes")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Cargando el historial del chat…")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/Hola. Soy el orquestador global/)).toBeInTheDocument();
  });

  it("renders the loaded overview with run rows and error rows linking to /runs", async () => {
    vi.mocked(api.controlOverview).mockResolvedValue(overviewFixture);
    renderPage();

    await screen.findByText("Fallos recientes");
    expect(statValue("Proyectos")).toBe("1");
    expect(statValue("Fallos recientes")).toBe("1");
    expect(statValue("Errores")).toBe("1");
    expect(statValue("Integraciones caídas")).toBe("0");

    const runRows = screen.getAllByRole("link", { name: /ventas · flujo-diario/ });
    expect(runRows).toHaveLength(2);
    for (const row of runRows) expect(row).toHaveAttribute("href", "/runs");
    expect(screen.getByText("Fallido")).toBeInTheDocument();
    expect(screen.getByText("Completado")).toBeInTheDocument();
    expect(screen.getByText("La API respondió 500")).toBeInTheDocument();

    const errorRow = screen.getByRole("link", { name: /Fallo al enviar el correo/ });
    expect(errorRow).toHaveAttribute("href", "/runs");
    expect(within(errorRow).getByText("Orquestador global")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/runs");

    expect(screen.getByRole("button", { name: "Actualizar" })).toBeEnabled();
  });

  it("shows an error card with retry when the overview request fails", async () => {
    vi.mocked(api.controlOverview)
      .mockRejectedValueOnce(new ApiClientError(500, "HTTP_ERROR", "request failed (500)"))
      .mockResolvedValue(overviewFixture);
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("request failed (500)");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(api.controlOverview).toHaveBeenCalledTimes(2));
    await screen.findByText("Fallos recientes");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("guides with empty states and real zeros when the platform is empty", async () => {
    vi.mocked(api.controlOverview).mockResolvedValue(emptyOverview);
    renderPage();

    await screen.findByText("Todavía no hay proyectos");
    expect(screen.getByText("Sin ejecuciones todavía")).toBeInTheDocument();
    expect(screen.getByText("Sin errores recientes")).toBeInTheDocument();
    expect(screen.getByText("Sin integraciones configuradas")).toBeInTheDocument();
    expect(statValue("Proyectos")).toBe("0");
    expect(statValue("Fallos recientes")).toBe("0");
    expect(statValue("Errores")).toBe("0");
    expect(statValue("Integraciones caídas")).toBe("0");
  });

  it("renders persisted chat history as markdown", async () => {
    vi.mocked(api.controlOverview).mockResolvedValue(overviewFixture);
    vi.mocked(api.controlChatHistory).mockResolvedValue({
      data: [
        historyMessage("u1", "user", "¿Cómo va todo?"),
        historyMessage("a1", "agent", "## Resumen semanal\n\n- **2 fallos** en ventas"),
      ],
    });
    renderPage();

    expect(await screen.findByRole("heading", { level: 2, name: "Resumen semanal" })).toBeInTheDocument();
    expect(screen.getByText("2 fallos").closest("strong")).toBeInTheDocument();
    expect(screen.getByText("¿Cómo va todo?")).toBeInTheDocument();
    expect(screen.queryByText(/Hola. Soy el orquestador global/)).not.toBeInTheDocument();
  });

  it("surfaces a chat history failure with a retry action", async () => {
    vi.mocked(api.controlOverview).mockResolvedValue(emptyOverview);
    vi.mocked(api.controlChatHistory)
      .mockRejectedValueOnce(new ApiClientError(500, "HTTP_ERROR", "request failed (500)"))
      .mockResolvedValueOnce({ data: [] });
    renderPage();

    expect(await screen.findByText(/request failed \(500\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(api.controlChatHistory).toHaveBeenCalledTimes(2));
  });

  it("sends a message through the control chat and renders the reply", async () => {
    const reply = "Todo en orden: 1 proyecto activo.";
    let sent = false;
    vi.mocked(api.controlOverview).mockResolvedValue(emptyOverview);
    vi.mocked(api.controlChat).mockImplementation(async () => {
      sent = true;
      return { reply };
    });
    vi.mocked(api.controlChatHistory).mockImplementation(async () =>
      sent
        ? { data: [historyMessage("u2", "user", "¿Cómo va la plataforma?"), historyMessage("a2", "agent", reply)] }
        : { data: [] },
    );
    renderPage();

    await screen.findByText(/Hola. Soy el orquestador global/);
    await userEvent.type(screen.getByPlaceholderText("Pídele un flujo, una corrección o un reporte…"), "¿Cómo va la plataforma?");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(api.controlChat).toHaveBeenCalledWith("¿Cómo va la plataforma?", expect.any(Function));
    expect(await screen.findByText(reply)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("¿Cómo va la plataforma?")).toBeInTheDocument());
  });

  it("shows a visible error in the chat when the turn fails", async () => {
    vi.mocked(api.controlOverview).mockResolvedValue(emptyOverview);
    vi.mocked(api.controlChat).mockRejectedValue(new Error("El proveedor no respondió"));
    renderPage();

    await screen.findByText(/Hola. Soy el orquestador global/);
    await userEvent.type(screen.getByPlaceholderText("Pídele un flujo, una corrección o un reporte…"), "dame un reporte");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText(/Error: El proveedor no respondió/)).toBeInTheDocument();
  });
});
