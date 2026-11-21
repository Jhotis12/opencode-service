import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { SubagentProfile, WorkflowGraph } from "@platform/shared";

vi.mock("../src/auth.tsx", () => ({
  useAuth: () => ({
    user: { username: "tester", mustChangePassword: false },
    loading: false,
    refresh: vi.fn(),
    setUser: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}));

const apiMock = vi.hoisted(() => ({
  getWorkflow: vi.fn(),
  listRuns: vi.fn(),
  listAgents: vi.fn(),
  listModels: vi.fn(),
  chatHistory: vi.fn(),
  listIntegrations: vi.fn(),
  listDestinations: vi.fn(),
  getProjectSettings: vi.fn(),
  listProjectSecrets: vi.fn(),
  listNotebooks: vi.fn(),
  listWorkflowVersions: vi.fn(),
  listSchedules: vi.fn(),
  readNode: vi.fn(),
  writeNode: vi.fn(),
  saveWorkflow: vi.fn(),
  replayRun: vi.fn(),
  runWorkflow: vi.fn(),
  chat: vi.fn(),
}));

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return { ...actual, api: apiMock };
});

vi.mock("../src/components/CodeEditor.tsx", () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange(value: string): void }) => (
    <textarea aria-label="Editor de código" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

import { App } from "../src/App.tsx";
import { renderWithProviders } from "./render.tsx";

// App.tsx mounts every project section through React.lazy, so the first render of a
// section suspends while Vite transforms and evaluates that page module. Every spec
// here mounts the app from scratch, so that cost landed inside the spec's own budget:
// under a loaded machine the seven-section deep-link loop outlived vitest's 5s
// testTimeout and the single-section waits expired on the Suspense fallback while the
// route was already correct. Evaluate the modules the routes lazy-import once, before
// the first render, so `lazy` resolves from the registry and each spec only waits for
// router state and the mocked queries.
beforeAll(async () => {
  await Promise.all([
    import("../src/pages/ProjectOverviewPage.tsx"),
    import("../src/pages/ProjectFlowPage.tsx"),
    import("../src/pages/ProjectRunsPage.tsx"),
    import("../src/pages/ProjectAgentsPage.tsx"),
    import("../src/pages/ProjectKnowledgePage.tsx"),
    import("../src/pages/ProjectIntegrationsPage.tsx"),
    import("../src/pages/ProjectSettingsPage.tsx"),
  ]);
});

const graph: WorkflowGraph = {
  version: 1,
  id: "p1",
  name: "Demo",
  description: "",
  nodes: [
    { id: "start", type: "trigger", label: "Inicio", position: { x: 0, y: 0 }, config: {}, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } },
    { id: "code", type: "code", label: "Consultar", codeFile: "nodes/code.ts", position: { x: 220, y: 0 }, config: {}, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } },
  ],
  edges: [{ id: "e1", source: "start", target: "code" }],
  updatedAt: new Date().toISOString(),
};

const agent: SubagentProfile = {
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

function setupApi() {
  apiMock.getWorkflow.mockResolvedValue(graph);
  apiMock.listRuns.mockResolvedValue({
    data: [
      {
        id: "abcd1234-run",
        projectSlug: "demo",
        workflowId: "p1",
        status: "succeeded",
        entryPoint: "web_ui",
        launchedBy: "admin",
        startedAt: new Date().toISOString(),
        steps: [],
      },
    ],
  });
  apiMock.listAgents.mockResolvedValue({ data: [agent] });
  apiMock.listModels.mockResolvedValue({
    data: [{ providerID: "opencode-go", modelID: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash" }],
  });
  apiMock.chatHistory.mockResolvedValue({ data: [] });
  apiMock.listIntegrations.mockResolvedValue({ data: [] });
  apiMock.listDestinations.mockResolvedValue({ data: [] });
  apiMock.getProjectSettings.mockResolvedValue({
    project: { id: "p1", slug: "demo", name: "Demo", description: "", createdAt: new Date().toISOString() },
    integrations: [],
    notebooks: [],
    readiness: [],
  });
  apiMock.listProjectSecrets.mockResolvedValue({ data: [] });
  apiMock.listNotebooks.mockResolvedValue({ data: [] });
  apiMock.listWorkflowVersions.mockResolvedValue({ data: [] });
  apiMock.listSchedules.mockResolvedValue({ data: [] });
  apiMock.readNode.mockResolvedValue({ code: "export default async function run() { return {}; }" });
  apiMock.writeNode.mockResolvedValue({ ok: true });
  apiMock.saveWorkflow.mockImplementation((_slug: string, next: WorkflowGraph) => Promise.resolve(next));
  apiMock.chat.mockResolvedValue({ reply: "ok", sessionId: "session", threadId: "thread" });
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderApp(entry: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <App />
    </MemoryRouter>,
  );
}

// Every section renders behind the workspace shell: the workflow query resolves, the
// shell commits, and only then does the router transition commit the section. A single
// assertion therefore spans several commits, so testing-library's 1 s async budget is a
// statement about an idle machine, not about correctness - under the 13-process load
// that exposed this file the redirect was still showing /projects/demo when the default
// budget expired, with the navigation merely queued. Same budget the flow deep-link
// already needed for React Flow's first paint.
const ROUTE_READY = { timeout: 10_000 };

function sectionTabs() {
  return screen.getByRole("navigation", { name: "Secciones del proyecto" });
}

// One spec per section so each mount keeps its own vitest timeout: as one spec, the
// seven full app mounts shared a single 5 s budget and timed out under load.
const deepLinks: Array<[string, string, () => Promise<HTMLElement>]> = [
  ["overview", "Resumen", () => screen.findByRole("heading", { name: "Resumen" }, ROUTE_READY)],
  ["flow", "Flujo", () => screen.findByRole("button", { name: "+ Nodo" }, ROUTE_READY)],
  ["runs", "Ejecuciones", () => screen.findByText("abcd1234", {}, ROUTE_READY)],
  ["agents", "Agentes", () => screen.findByTestId("agent-card-principal-agente", {}, ROUTE_READY)],
  ["knowledge", "Conocimiento", () => screen.findByRole("button", { name: "Crear notebook" }, ROUTE_READY)],
  ["integrations", "Integraciones", () => screen.findByRole("heading", { name: "Integraciones" }, ROUTE_READY)],
  ["settings", "Ajustes", () => screen.findByText("Identidad y modelo", {}, ROUTE_READY)],
];

async function makeGraphDirty(container: HTMLElement) {
  fireEvent.click(container.querySelector('[data-node-id="code"]')!);
  const inspector = await screen.findByRole("dialog", { name: "Nodo: Consultar" });
  await userEvent.type(within(inspector).getByLabelText("Etiqueta"), " editado");
  await userEvent.click(within(inspector).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nodo: Consultar" })).not.toBeInTheDocument());
  expect(screen.getByRole("status", { name: "Cambios sin guardar" })).toBeInTheDocument();
}

// This file mounts the whole SPA per spec, so the suite budget has to sit above the
// async budget above; at the 5 s default a starved machine reports a bare "Test timed
// out" instead of the assertion that did not settle.
describe("routed project workspace", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  it("redirects /projects/:slug to the overview section", async () => {
    renderApp("/projects/demo");
    await waitFor(
      () => expect(screen.getByTestId("location")).toHaveTextContent("/projects/demo/overview"),
      ROUTE_READY,
    );
    expect(await screen.findByRole("heading", { name: "Resumen" }, ROUTE_READY)).toBeInTheDocument();
  });

  for (const [section, heading, find] of deepLinks) {
    it(`deep-links to the ${section} section by URL`, async () => {
      renderApp(`/projects/demo/${section}`);
      expect(await find()).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    });
  }

  it("routes between sections when tabs are clicked", async () => {
    renderApp("/projects/demo/overview");
    expect(await screen.findByRole("heading", { name: "Resumen" }, ROUTE_READY)).toBeInTheDocument();
    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Flujo" }));
    expect(await screen.findByRole("button", { name: "+ Nodo" }, ROUTE_READY)).toBeInTheDocument();
    expect(within(sectionTabs()).getByRole("link", { name: "Flujo" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("location")).toHaveTextContent("/projects/demo/flow");
  });

  it("confirms before leaving a dirty graph, keeps edits on cancel and discards on accept", async () => {
    const { container } = renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" }, ROUTE_READY)).toBeInTheDocument();

    await makeGraphDirty(container);

    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Ejecuciones (1)" }));
    const guard = await screen.findByRole("dialog", { name: "Cambios sin guardar" });
    await userEvent.click(within(guard).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cambios sin guardar" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "+ Nodo" })).toBeInTheDocument();
    expect(screen.queryByText("abcd1234")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/projects/demo/flow");

    fireEvent.click(container.querySelector('[data-node-id="code"]')!);
    const stillEdited = await screen.findByRole("dialog", { name: "Nodo: Consultar editado" });
    await userEvent.click(within(stillEdited).getByRole("button", { name: "Cerrar" }));

    await userEvent.click(
      within(screen.getByRole("navigation", { name: "Migas de pan" })).getByRole("link", { name: "Proyectos" }),
    );
    const leavingGuard = await screen.findByRole("dialog", { name: "Cambios sin guardar" });
    await userEvent.click(within(leavingGuard).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cambios sin guardar" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "+ Nodo" })).toBeInTheDocument();

    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Ejecuciones (1)" }));
    const discardGuard = await screen.findByRole("dialog", { name: "Cambios sin guardar" });
    await userEvent.click(within(discardGuard).getByRole("button", { name: "Descartar y continuar" }));
    expect(await screen.findByText("abcd1234", {}, ROUTE_READY)).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Cambios sin guardar" })).not.toBeInTheDocument();

    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Flujo" }));
    expect(await screen.findByRole("button", { name: "+ Nodo" }, ROUTE_READY)).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-node-id="code"]')!);
    const restored = await screen.findByRole("dialog", { name: "Nodo: Consultar" });
    expect(within(restored).getByLabelText("Etiqueta")).toHaveValue("Consultar");
  });

  it("still saves the flow from the flow section", async () => {
    const { container } = renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" }, ROUTE_READY)).toBeInTheDocument();

    await makeGraphDirty(container);
    await userEvent.click(screen.getByRole("button", { name: "Guardar flujo" }));

    await waitFor(() => expect(apiMock.saveWorkflow).toHaveBeenCalled());
    const saved = apiMock.saveWorkflow.mock.calls.at(-1)?.[1] as WorkflowGraph;
    expect(saved.nodes.find((node) => node.id === "code")?.label).toBe("Consultar editado");
    await waitFor(() => expect(screen.queryByRole("status", { name: "Cambios sin guardar" })).not.toBeInTheDocument());
    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Ejecuciones (1)" }));
    expect(await screen.findByText("abcd1234", {}, ROUTE_READY)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Cambios sin guardar" })).not.toBeInTheDocument();
  });

  it("warns before closing the tab only when the graph is dirty", async () => {
    const { container } = renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" }, ROUTE_READY)).toBeInTheDocument();

    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await makeGraphDirty(container);

    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("shows a retryable error instead of an empty project when the workflow fails to load", async () => {
    apiMock.getWorkflow.mockRejectedValueOnce(new Error("No se pudo cargar el flujo"));
    renderApp("/projects/demo/overview");

    const alert = await screen.findByRole("alert", {}, ROUTE_READY);
    expect(within(alert).getByText("No se pudo cargar el flujo")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Secciones del proyecto" })).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Resumen" }, ROUTE_READY)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explica el ítem de preparación pendiente una sola vez, en el resumen", async () => {
    apiMock.getProjectSettings.mockResolvedValue({
      project: { id: "p1", slug: "demo", name: "Demo", description: "", createdAt: new Date().toISOString() },
      integrations: [],
      notebooks: [],
      readiness: [
        {
          id: "approval-channel",
          label: "Canal de aprobación configurado",
          ready: false,
          detail: "El flujo tiene aprobaciones y no hay un canal de origen ni un canal de aprobación del proyecto.",
        },
      ],
    });
    renderApp("/projects/demo/overview");

    const readiness = await screen.findByTestId("overview-readiness");
    expect(
      await within(readiness).findByText(/El flujo tiene aprobaciones y no hay un canal/),
    ).toBeInTheDocument();
    // La barra del proyecto ya no repite la preparación como texto inline.
    expect(screen.queryByText(/Configuración pendiente/)).not.toBeInTheDocument();
  });
});
