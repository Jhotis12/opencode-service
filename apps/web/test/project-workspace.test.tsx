import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
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
import { findToast, renderWithProviders } from "./render.tsx";

type TestListener = (event: MessageEvent) => void;

class TestEventSource {
  static instances: TestEventSource[] = [];
  readonly url: string;
  private readonly listeners = new Map<string, Set<TestListener>>();

  constructor(url: string | URL) {
    this.url = String(url);
    TestEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: TestListener) {
    const listeners = this.listeners.get(type) ?? new Set<TestListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: TestListener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {}

  emit(type: string, payload: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(payload) } as MessageEvent);
    }
  }
}

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

function graphWithAgent(label: string): WorkflowGraph {
  return {
    ...graph,
    nodes: [
      ...graph.nodes.map((node) => (node.id === "code" ? { ...node, label } : node)),
      {
        id: "agent",
        type: "agent",
        label: "Redactar",
        agentId: "principal/agente",
        position: { x: 440, y: 0 },
        config: {},
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [...graph.edges, { id: "e2", source: "code", target: "agent" }],
    updatedAt: new Date().toISOString(),
  };
}

function emitWorkflowUpdate(next: WorkflowGraph) {
  const sources = TestEventSource.instances.filter((source) => source.url === "/api/events");
  expect(sources.length).toBeGreaterThan(0);
  act(() => {
    for (const source of sources) source.emit("workflow.updated", { projectSlug: "demo", graph: next });
  });
}

function emitRunUpdate(payload: { status: string; projectSlug?: string }) {
  const sources = TestEventSource.instances.filter((source) => source.url === "/api/events");
  expect(sources.length).toBeGreaterThan(0);
  act(() => {
    for (const source of sources) source.emit("run.updated", { projectSlug: "demo", ...payload });
  });
}

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
    TestEventSource.instances.length = 0;
    globalThis.EventSource = TestEventSource as unknown as typeof EventSource;
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

  it("announces a finished run with a toast instead of a green banner", async () => {
    renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();

    emitRunUpdate({ status: "succeeded" });

    expect(await findToast("Ejecución completada. El detalle está en Ejecuciones.")).toBeVisible();
  });

  it("marks and announces an external workflow update while the chat is idle", async () => {
    const { container } = renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();

    emitWorkflowUpdate(graphWithAgent("Consultar"));

    const banner = await screen.findByTestId("agent-update-banner");
    expect(banner).toHaveTextContent("El agente actualizó el flujo: +1 nodo (Redactar)");
    await waitFor(() => expect(container.querySelector('[data-node-id="agent"]')).not.toBeNull());
    expect(container.querySelector('[data-node-id="agent"] .agent-touch-layer')).not.toBeNull();
    expect(container.querySelector('[data-node-id="start"] .agent-touch-layer')).toBeNull();

    await userEvent.click(within(banner).getByRole("button", { name: "Descartar actualización del agente" }));
    expect(screen.queryByTestId("agent-update-banner")).not.toBeInTheDocument();
    expect(container.querySelector('[data-node-id="agent"] .agent-touch-layer')).toBeNull();
  });

  it("does not announce the SSE event that echoes the local save", async () => {
    let finishSave: (() => void) | undefined;
    apiMock.saveWorkflow.mockImplementation(
      (_slug: string, next: WorkflowGraph) =>
        new Promise<WorkflowGraph>((resolve) => {
          finishSave = () => resolve(next);
        }),
    );
    const { container } = renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();
    await makeGraphDirty(container);
    await userEvent.click(screen.getByRole("button", { name: "Guardar flujo" }));
    await waitFor(() => expect(apiMock.saveWorkflow).toHaveBeenCalled());
    const saved = apiMock.saveWorkflow.mock.calls.at(-1)?.[1] as WorkflowGraph;

    emitWorkflowUpdate(saved);
    expect(screen.queryByTestId("agent-update-banner")).not.toBeInTheDocument();

    act(() => finishSave?.());
    await waitFor(() => expect(screen.queryByRole("status", { name: "Cambios sin guardar" })).not.toBeInTheDocument());
    expect(screen.queryByTestId("agent-update-banner")).not.toBeInTheDocument();
  });

  it("replaces a dirty draft with the agent graph and announces the change", async () => {
    const { container } = renderApp("/projects/demo/flow");
    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();
    await makeGraphDirty(container);

    emitWorkflowUpdate(graphWithAgent("Desde el agente"));

    const banner = await screen.findByTestId("agent-update-banner");
    expect(banner).toHaveTextContent("El agente actualizó el flujo");
    expect(banner).toHaveTextContent("+1 nodo");
    expect(banner).toHaveTextContent("1 nodo actualizado");
    await waitFor(() => expect(screen.queryByRole("status", { name: "Cambios sin guardar" })).not.toBeInTheDocument());

    fireEvent.click(container.querySelector('[data-node-id="code"]')!);
    const inspector = await screen.findByRole("dialog", { name: "Nodo: Desde el agente" });
    expect(within(inspector).getByLabelText("Etiqueta")).toHaveValue("Desde el agente");
  });

  it("keeps the agent marker available when the flow tab opens after the update", async () => {
    renderApp("/projects/demo/overview");
    expect(await screen.findByRole("heading", { name: "Resumen" })).toBeInTheDocument();

    emitWorkflowUpdate(graphWithAgent("Desde el agente"));
    await userEvent.click(within(sectionTabs()).getByRole("link", { name: "Flujo" }));

    expect(await screen.findByRole("button", { name: "+ Nodo" })).toBeInTheDocument();
    expect(screen.getByTestId("agent-update-banner")).toHaveTextContent("El agente actualizó el flujo");
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

  it("shows a retryable error instead of an empty project when the workflow fails to load", async () => {
    apiMock.getWorkflow.mockRejectedValueOnce(new Error("No se pudo cargar el flujo"));
    renderApp("/projects/demo/overview");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("No se pudo cargar el flujo")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Secciones del proyecto" })).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Resumen" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("describes the pending readiness item instead of repeating its positive label", async () => {
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

    expect(
      await screen.findByText(/Configuración pendiente: El flujo tiene aprobaciones/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Configuración pendiente: Canal de aprobación configurado/)).not.toBeInTheDocument();
  });
});
