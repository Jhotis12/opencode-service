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

  it("round-trips per-tool permission rules through the visual editor", async () => {
    renderCatalog();
    await userEvent.click(
      within(screen.getByTestId("agent-card-ventas-calificador")).getByRole("button", { name: "Editar" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Editar agente" });
    expect(
      within(screen.getByTestId("permission-row-db_query")).getByRole("radio", { name: "Denegar" }),
    ).toBeChecked();
    expect(
      within(screen.getByTestId("permission-row-workflow_list")).getByRole("radio", { name: "Sin regla" }),
    ).toBeChecked();

    await userEvent.click(
      within(screen.getByTestId("permission-row-notify")).getByRole("radio", { name: "Preguntar" }),
    );
    await userEvent.click(
      within(screen.getByTestId("permission-row-workflow_trigger")).getByRole("radio", { name: "Permitir" }),
    );

    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));
    expect(apiMock.upsertAgent.mock.calls[0][3].permissions).toEqual([
      { action: "tool", resource: "workflow_trigger", effect: "allow" },
      { action: "tool", resource: "db_query", effect: "deny" },
      { action: "tool", resource: "notify", effect: "ask" },
    ]);
  });

  it("adding a deny on one tool leaves the other rules unchanged", async () => {
    const mixed: SubagentProfile = {
      ...subagent,
      frontmatter: {
        ...subagent.frontmatter,
        permissions: [
          { action: "tool", resource: "kb_search", effect: "allow" },
          { action: "tool", resource: "notify", effect: "ask" },
        ],
      },
    };
    renderCatalog([mixed, primary]);
    await userEvent.click(
      within(screen.getByTestId("agent-card-ventas-calificador")).getByRole("button", { name: "Editar" }),
    );
    await userEvent.click(
      within(screen.getByTestId("permission-row-db_query")).getByRole("radio", { name: "Denegar" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));
    expect(apiMock.upsertAgent.mock.calls[0][3].permissions).toEqual([
      { action: "tool", resource: "kb_search", effect: "allow" },
      { action: "tool", resource: "db_query", effect: "deny" },
      { action: "tool", resource: "notify", effect: "ask" },
    ]);
  });

  it("filters the catalog by name and role", async () => {
    renderCatalog();
    expect(screen.getByTestId("agent-card-principal-agente")).toBeInTheDocument();
    expect(screen.getByTestId("agent-card-ventas-calificador")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Buscar agentes" });
    await userEvent.type(search, "calificador");
    expect(screen.queryByTestId("agent-card-principal-agente")).not.toBeInTheDocument();
    expect(screen.getByTestId("agent-card-ventas-calificador")).toBeInTheDocument();
    expect(screen.getByTestId("agent-search-count")).toHaveTextContent("1 de 2 agentes");

    await userEvent.clear(search);
    await userEvent.type(search, "noexiste");
    expect(screen.queryByTestId("agent-card-ventas-calificador")).not.toBeInTheDocument();
    expect(screen.getByText("No hay agentes que coincidan con «noexiste».")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(screen.getByTestId("agent-card-principal-agente")).toBeInTheDocument();
    expect(screen.getByTestId("agent-card-ventas-calificador")).toBeInTheDocument();
  });

  it("blocks saving while unknown tool rules exist and removes them on demand", async () => {
    const legacy: SubagentProfile = {
      ...subagent,
      frontmatter: {
        ...subagent.frontmatter,
        permissions: [
          { action: "tool", resource: "db_query", effect: "deny" },
          { action: "tool", resource: "legacy_tool", effect: "deny" },
        ],
      },
    };
    renderCatalog([legacy, primary]);
    await userEvent.click(
      within(screen.getByTestId("agent-card-ventas-calificador")).getByRole("button", { name: "Editar" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Editar agente" });
    const unknownBlock = screen.getByTestId("unknown-permission-rules");
    expect(within(unknownBlock).getByText("legacy_tool")).toBeInTheDocument();
    const save = within(dialog).getByRole("button", { name: "Guardar agente" });
    expect(save).toBeDisabled();

    await userEvent.click(within(unknownBlock).getByRole("button", { name: "Quitar" }));
    expect(screen.queryByTestId("unknown-permission-rules")).not.toBeInTheDocument();
    expect(save).toBeEnabled();
    await userEvent.click(save);
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));
    expect(apiMock.upsertAgent.mock.calls[0][3].permissions).toEqual([
      { action: "tool", resource: "db_query", effect: "deny" },
    ]);
  });
});
