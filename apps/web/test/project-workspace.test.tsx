import { beforeEach, describe, expect, it, vi } from "vitest";
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

function sectionTabs() {
  return screen.getByRole("navigation", { name: "Secciones del proyecto" });
}

async function makeGraphDirty(container: HTMLElement) {
  fireEvent.click(container.querySelector('[data-node-id="code"]')!);
  const inspector = await screen.findByRole("dialog", { name: "Nodo: Consultar" });
  await userEvent.type(within(inspector).getByLabelText("Etiqueta"), " editado");
  await userEvent.click(within(inspector).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nodo: Consultar" })).not.toBeInTheDocument());
  expect(screen.getByRole("status", { name: "Cambios sin guardar" })).toBeInTheDocument();
}

describe("routed project workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  it("redirects /projects/:slug to the overview section", async () => {
    renderApp("/projects/demo");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/projects/demo/overview"));
    expect(await screen.findByRole("heading", { name: "Resumen" })).toBeInTheDocument();
  });

  it("deep-links to every section by URL", async () => {
    const sections: Array<[string, string, () => Promise<HTMLElement>]> = [
      ["overview", "Resumen", () => screen.findByRole("heading", { name: "Resumen" })],
      ["flow", "Flujo", () => screen.findByRole("button", { name: "+ Nodo" }, { timeout: 10_000 })],
      ["runs", "Ejecuciones", () => screen.findByText("abcd1234")],
      ["agents", "Agentes", () => screen.findByTestId("agent-card-principal-agente")],
      ["knowledge", "Conocimiento", () => screen.findByRole("button", { name: "Crear notebook" })],
      ["integrations", "Integraciones", () => screen.findByRole("heading", { name: "Integraciones" })],
      ["settings", "Ajustes", () => screen.findByText("Identidad y modelo")],
    ];
    for (const [section, heading, find] of sections) {
      const { unmount } = renderApp(`/projects/demo/${section}`);
      expect(await find()).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      unmount();
    }
  });

  it("routes between sections when tabs are clicked", async () => {
    renderApp("/projects/demo/overview");
    expect(await screen.findByRole("heading", { name: "Resumen" })).toBeInTheDocument();
    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Flujo" }));
    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();
    expect(within(sectionTabs()).getByRole("link", { name: "Flujo" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("location")).toHaveTextContent("/projects/demo/flow");
  });

  it("confirms before leaving a dirty graph, keeps edits on cancel and discards on accept", async () => {
    const { container } = renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();

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

    await userEvent.click(screen.getByRole("link", { name: "← Proyectos" }));
    const leavingGuard = await screen.findByRole("dialog", { name: "Cambios sin guardar" });
    await userEvent.click(within(leavingGuard).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cambios sin guardar" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "+ Nodo" })).toBeInTheDocument();

    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Ejecuciones (1)" }));
    const discardGuard = await screen.findByRole("dialog", { name: "Cambios sin guardar" });
    await userEvent.click(within(discardGuard).getByRole("button", { name: "Descartar y continuar" }));
    expect(await screen.findByText("abcd1234")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Cambios sin guardar" })).not.toBeInTheDocument();

    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Flujo" }));
    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-node-id="code"]')!);
    const restored = await screen.findByRole("dialog", { name: "Nodo: Consultar" });
    expect(within(restored).getByLabelText("Etiqueta")).toHaveValue("Consultar");
  });

  it("still saves the flow from the flow section", async () => {
    const { container } = renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();

    await makeGraphDirty(container);
    await userEvent.click(screen.getByRole("button", { name: "Guardar flujo" }));

    await waitFor(() => expect(apiMock.saveWorkflow).toHaveBeenCalled());
    const saved = apiMock.saveWorkflow.mock.calls.at(-1)?.[1] as WorkflowGraph;
    expect(saved.nodes.find((node) => node.id === "code")?.label).toBe("Consultar editado");
    await waitFor(() => expect(screen.queryByRole("status", { name: "Cambios sin guardar" })).not.toBeInTheDocument());
    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Ejecuciones (1)" }));
    expect(await screen.findByText("abcd1234")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Cambios sin guardar" })).not.toBeInTheDocument();
  });

  it("warns before closing the tab only when the graph is dirty", async () => {
    const { container } = renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();

    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await makeGraphDirty(container);

    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
