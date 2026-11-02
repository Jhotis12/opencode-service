import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubagentProfile } from "@platform/shared";
import { renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  upsertAgent: vi.fn(),
  deleteAgent: vi.fn(),
}));

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return { ...actual, api: apiMock };
});

import { AgentCatalog } from "../src/components/AgentCatalog.tsx";

const primary: SubagentProfile = {
  category: "principal",
  role: "agente",
  frontmatter: {
    description: "Agente principal del proyecto",
    mode: "primary",
    permissions: [],
    notebooks: [],
  },
  body: "Coordina el proyecto.",
};

const subagent: SubagentProfile = {
  category: "ventas",
  role: "calificador",
  frontmatter: {
    description: "Califica leads entrantes y propone el siguiente paso.",
    mode: "subagent",
    model: "opencode-go/deepseek-v4.1-flash",
    permissions: [{ action: "tool", resource: "db_query", effect: "deny" }],
    notebooks: ["manual-ventas"],
  },
  body: "Eres el calificador de ventas.",
};

function renderCatalog(agents: SubagentProfile[] = [subagent, primary]) {
  return renderWithProviders(
    <AgentCatalog projectSlug="demo" agents={agents} modelOptions={["opencode-go/deepseek-v4.1-flash"]} />,
  );
}

describe("AgentCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.upsertAgent.mockResolvedValue(subagent);
    apiMock.deleteAgent.mockResolvedValue({ ok: true });
  });

  it("lists the primary agent first, localizes modes and protects it from deletion", () => {
    renderCatalog();
    const cards = screen.getAllByTestId(/^agent-card-/);
    expect(cards[0]).toHaveAttribute("data-testid", "agent-card-principal-agente");
    const primaryCard = screen.getByTestId("agent-card-principal-agente");
    expect(within(primaryCard).getAllByText("Principal").length).toBeGreaterThan(0);
    expect(within(primaryCard).queryByRole("button", { name: "Borrar" })).not.toBeInTheDocument();
    const subCard = screen.getByTestId("agent-card-ventas-calificador");
    expect(within(subCard).getByText("Sub-agente")).toBeInTheDocument();
    expect(within(subCard).getByText("1 notebook")).toBeInTheDocument();
    expect(within(subCard).getByText("1 bloqueo")).toBeInTheDocument();
    const modelBadge = within(subCard).getByTitle("opencode-go/deepseek-v4.1-flash");
    expect(modelBadge).toHaveTextContent("Modelo: opencode-go/deepseek-v4.1-flash");
  });

  it("shows the empty sub-agent state with a create action", async () => {
    renderCatalog([primary]);
    expect(screen.getByText("Sin sub-agentes todavía")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Crear sub-agente" }));
    expect(screen.getByRole("dialog", { name: "Nuevo agente" })).toBeInTheDocument();
  });

  it("validates and saves a new agent through the focused editor", async () => {
    renderWithProviders(
      <AgentCatalog projectSlug="demo" agents={[primary]} modelOptions={[]} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Nuevo agente" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo agente" });
    const save = within(dialog).getByRole("button", { name: "Guardar agente" });
    expect(save).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText("Categoría"), "ventas");
    await userEvent.type(within(dialog).getByLabelText("Rol"), "calificador");
    await userEvent.type(within(dialog).getByLabelText("Descripción"), "Califica leads");
    await userEvent.type(within(dialog).getByLabelText("Instrucciones (.md)"), "Eres un calificador.");
    await userEvent.click(save);
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalled());
    expect(apiMock.upsertAgent).toHaveBeenCalledWith(
      "demo",
      "ventas",
      "calificador",
      expect.objectContaining({
        description: "Califica leads",
        body: "Eres un calificador.",
        mode: "subagent",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nuevo agente" })).not.toBeInTheDocument());
  });

  it("prefills the editor for an existing agent and locks its identifier", async () => {
    renderCatalog();
    await userEvent.click(
      within(screen.getByTestId("agent-card-ventas-calificador")).getByRole("button", { name: "Editar" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Editar agente" });
    expect(within(dialog).getByLabelText("Categoría")).toHaveValue("ventas");
    expect(within(dialog).getByLabelText("Categoría")).toBeDisabled();
    expect(within(dialog).getByLabelText("Rol")).toHaveValue("calificador");
    expect(within(dialog).getByLabelText("Descripción")).toHaveValue(subagent.frontmatter.description);
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledWith("demo", "ventas", "calificador", expect.any(Object)));
  });

  it("requires confirmation before deleting a sub-agent", async () => {
    renderCatalog();
    const subCard = screen.getByTestId("agent-card-ventas-calificador");
    await userEvent.click(within(subCard).getByRole("button", { name: "Borrar" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar agente" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(apiMock.deleteAgent).not.toHaveBeenCalled();

    await userEvent.click(within(subCard).getByRole("button", { name: "Borrar" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Eliminar agente" })).getByRole("button", { name: "Borrar agente" }));
    await waitFor(() => expect(apiMock.deleteAgent).toHaveBeenCalledWith("demo", "ventas", "calificador"));
  });
});
