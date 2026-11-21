import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { SubagentProfile } from "@platform/shared";
import type { ModelInfo, NotebookSummary } from "../src/api.ts";
import { qk } from "../src/query.ts";
import { chooseOption, findToast, renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  upsertAgent: vi.fn(),
  deleteAgent: vi.fn(),
  listAgents: vi.fn(),
  listNotebooks: vi.fn(),
}));

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return { ...actual, api: apiMock };
});

import { AgentCatalog } from "../src/components/AgentCatalog.tsx";
import { ProjectKnowledgePanel } from "../src/components/ProjectKnowledgePanel.tsx";
import { dismissAll } from "../src/components/Toast.tsx";

afterEach(() => {
  act(() => dismissAll());
});

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

const catalogue: ModelInfo[] = [
  { providerID: "opencode-go", modelID: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash" },
];

// `manual-ventas` is deliberately absent: the sub-agent keeps a notebook the
// catalogue no longer lists, so the chip has to survive without it.
const notebooks: NotebookSummary[] = [
  {
    id: "nb-politicas",
    projectSlug: "demo",
    slug: "politicas",
    name: "Políticas",
    description: "",
    sources: 0,
    createdAt: "2026-11-19T00:00:00.000Z",
  },
  {
    id: "nb-onboarding",
    projectSlug: "demo",
    slug: "onboarding",
    name: "Onboarding",
    description: "",
    sources: 2,
    createdAt: "2026-11-19T00:00:00.000Z",
  },
];

type User = ReturnType<typeof userEvent.setup>;

function renderCatalog(agents: SubagentProfile[] = [subagent, primary], models: ModelInfo[] = catalogue) {
  return renderWithProviders(<AgentCatalog projectSlug="demo" agents={agents} models={models} />);
}

async function fillNewAgent(user: User, dialog: HTMLElement): Promise<void> {
  await user.type(within(dialog).getByLabelText("Categoría"), "ventas");
  await user.type(within(dialog).getByLabelText("Rol"), "calificador");
  await user.type(within(dialog).getByLabelText("Descripción"), "Califica leads");
  await user.type(within(dialog).getByLabelText("Instrucciones (.md)"), "Eres un calificador.");
}

function savedPayload() {
  return apiMock.upsertAgent.mock.calls[0][3] as Record<string, unknown>;
}

// File-level so both suites get the notebook catalogue regardless of test order or `-t` filters.
beforeEach(() => {
  vi.clearAllMocks();
  apiMock.upsertAgent.mockResolvedValue(subagent);
  apiMock.deleteAgent.mockResolvedValue({ ok: true });
  apiMock.listNotebooks.mockResolvedValue({ data: notebooks });
});

describe("AgentCatalog", () => {
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

  it("never pairs the query error with the empty state and retries the catalog query", async () => {
    apiMock.listAgents
      .mockRejectedValueOnce(new Error("No se pudieron cargar los agentes"))
      .mockResolvedValue({ data: [subagent, primary] });
    function CatalogWithAgentsQuery() {
      const agentsQuery = useQuery({ queryKey: qk.agents("demo"), queryFn: () => apiMock.listAgents() });
      return (
        <AgentCatalog
          projectSlug="demo"
          agents={agentsQuery.data?.data ?? []}
          models={[]}
          isLoading={agentsQuery.isLoading}
          error={agentsQuery.error}
        />
      );
    }
    renderWithProviders(<CatalogWithAgentsQuery />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Error al cargar agentes")).toBeInTheDocument();
    expect(screen.queryByText("Sin sub-agentes todavía")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear sub-agente" })).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByTestId("agent-card-ventas-calificador")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("validates and saves a new agent through the focused editor", async () => {
    renderWithProviders(
      <>
        <AgentCatalog projectSlug="demo" agents={[primary]} models={[]} />
      </>,
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
    const savedToast = await screen.findByText("Agente ventas/calificador guardado");
    expect(savedToast.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("labels model choices from the catalogue and saves the provider/model ref", async () => {
    const user = userEvent.setup();
    renderCatalog([primary]);
    await user.click(screen.getByRole("button", { name: "Nuevo agente" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo agente" });

    await chooseOption(user, "Modelo", /DeepSeek V4\.1 Flash/);
    expect(within(dialog).getByRole("combobox", { name: "Modelo" })).toHaveTextContent("DeepSeek V4.1 Flash");

    await fillNewAgent(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));
    expect(savedPayload().model).toBe("opencode-go/deepseek-v4.1-flash");
  });

  it("inherits the flow model through the empty choice and omits the key", async () => {
    const user = userEvent.setup();
    renderCatalog([primary]);
    await user.click(screen.getByRole("button", { name: "Nuevo agente" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo agente" });

    await chooseOption(user, "Modelo", /DeepSeek V4\.1 Flash/);
    await chooseOption(user, "Modelo", "Heredar del flujo");
    expect(within(dialog).getByRole("combobox", { name: "Modelo" })).toHaveTextContent("Heredar del flujo");

    await fillNewAgent(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));

    const payload = savedPayload();
    expect("model" in payload).toBe(false);
    expect(JSON.stringify(payload)).not.toContain('"model"');
  });

  it("keeps a saved model that the catalogue lost selectable and selected", async () => {
    const user = userEvent.setup();
    renderCatalog([subagent, primary], []);
    await user.click(
      within(screen.getByTestId("agent-card-ventas-calificador")).getByRole("button", { name: "Editar" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Editar agente" });
    const picker = within(dialog).getByRole("combobox", { name: "Modelo" });
    expect(picker).toHaveTextContent("opencode-go/deepseek-v4.1-flash");

    await user.click(picker);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    const stale = screen.getByRole("option", { name: /opencode-go\/deepseek-v4\.1-flash/ });
    await user.click(stale);
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

    await user.click(within(dialog).getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));
    expect(savedPayload().model).toBe("opencode-go/deepseek-v4.1-flash");
  });

  it("falls back to the provider/model reference when a catalogue name is empty", async () => {
    const user = userEvent.setup();
    renderCatalog([primary], [{ providerID: "opencode-go", modelID: "sin-nombre", name: "" }]);
    await user.click(screen.getByRole("button", { name: "Nuevo agente" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo agente" });

    await chooseOption(user, "Modelo", /opencode-go\/sin-nombre/);
    expect(within(dialog).getByRole("combobox", { name: "Modelo" })).toHaveTextContent("opencode-go/sin-nombre");
  });

  it("emits the API mode values from the mode picker", async () => {
    const user = userEvent.setup();
    renderCatalog([primary]);
    await user.click(screen.getByRole("button", { name: "Nuevo agente" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo agente" });

    await fillNewAgent(user, dialog);
    await chooseOption(user, "Modo", "Principal");
    expect(within(dialog).getByRole("combobox", { name: "Modo" })).toHaveTextContent("Principal");

    await user.click(within(dialog).getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));
    expect(savedPayload().mode).toBe("primary");
  });

  it("picks notebooks in the multi-value field and saves the slug array", async () => {
    const user = userEvent.setup();
    renderCatalog([primary]);
    await user.click(screen.getByRole("button", { name: "Nuevo agente" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo agente" });
    await fillNewAgent(user, dialog);

    await user.click(within(dialog).getByRole("button", { name: "Añadir Notebooks" }));
    await user.click(await screen.findByRole("option", { name: "Políticas" }));
    await user.click(screen.getByRole("option", { name: "Onboarding" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(within(dialog).getByRole("button", { name: "Quitar Políticas" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));
    expect(savedPayload().notebooks).toEqual(["politicas", "onboarding"]);
  });

  it("saves an empty notebook array when the catalogue is empty", async () => {
    const user = userEvent.setup();
    apiMock.listNotebooks.mockResolvedValueOnce({ data: [] });
    renderCatalog([primary]);
    await user.click(screen.getByRole("button", { name: "Nuevo agente" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo agente" });
    await fillNewAgent(user, dialog);

    await user.click(within(dialog).getByRole("button", { name: "Añadir Notebooks" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sin opciones"));
    await user.keyboard("{Escape}");

    await user.click(within(dialog).getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));
    expect(savedPayload().notebooks).toEqual([]);
  });

  it("keeps a saved notebook absent from the catalogue as a removable chip", async () => {
    const user = userEvent.setup();
    renderCatalog([subagent, primary]);
    await user.click(
      within(screen.getByTestId("agent-card-ventas-calificador")).getByRole("button", { name: "Editar" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Editar agente" });
    expect(within(dialog).getByRole("button", { name: "Quitar manual-ventas" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Quitar manual-ventas" }));
    expect(within(dialog).queryByRole("button", { name: "Quitar manual-ventas" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Guardar agente" }));
    await waitFor(() => expect(apiMock.upsertAgent).toHaveBeenCalledTimes(1));
    expect(savedPayload().notebooks).toEqual([]);
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
    expect(await findToast("Agente ventas/calificador eliminado")).toBeVisible();
  });

  it("announces a rejected deletion as a toast", async () => {
    apiMock.deleteAgent.mockRejectedValueOnce(new Error("failed to fetch"));
    renderWithProviders(
      <>
        <AgentCatalog projectSlug="demo" agents={[subagent, primary]} models={catalogue} />
      </>,
    );
    const subCard = screen.getByTestId("agent-card-ventas-calificador");
    await userEvent.click(within(subCard).getByRole("button", { name: "Borrar" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Eliminar agente" })).getByRole("button", { name: "Borrar agente" }),
    );

    const toast = await screen.findByText(
      "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.",
    );
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Eliminar agente" })).not.toBeInTheDocument(),
    );
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

// The editor, ProjectKnowledgePanel and ProjectOverviewPage all read `qk.notebooks`,
// and React Query keys by queryKey alone: whichever view resolves first defines the
// shape every other view must handle.
describe("notebooks cache contract", () => {
  it("stores the unwrapped NotebookSummary[] that the knowledge panel maps over", async () => {
    let client: QueryClient | undefined;
    function ClientProbe() {
      client = useQueryClient();
      return null;
    }

    renderWithProviders(
      <>
        <ClientProbe />
        <AgentCatalog projectSlug="demo" agents={[primary]} models={[]} />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Nuevo agente" }));
    await waitFor(() => expect(client?.getQueryData(qk.notebooks("demo"))).toBeDefined());

    const cached = client!.getQueryData<NotebookSummary[]>(qk.notebooks("demo"));

    // Same cache, second consumer: an envelope here makes this render throw
    // `notebooks.map is not a function`, and an empty list would hide the notebooks.
    render(
      <QueryClientProvider client={client!}>
        <ProjectKnowledgePanel projectSlug="demo" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Políticas")).toBeInTheDocument();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
    expect(screen.queryByText("Aún no hay notebooks")).not.toBeInTheDocument();

    // The contract the other two consumers already implement: the array, not the envelope.
    expect(Array.isArray(cached)).toBe(true);
    expect(cached).toEqual(notebooks);
  });
});
