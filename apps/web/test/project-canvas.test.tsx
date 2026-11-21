import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Position, ReactFlow } from "@xyflow/react";
import type { WorkflowGraph } from "@platform/shared";
import { PlatformEdge } from "../src/components/PlatformEdge.tsx";
import { CanvasActionsContext } from "../src/components/nodes/canvas-actions.ts";
import { chooseOption, renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  getWorkflow: vi.fn(),
  listRuns: vi.fn(),
  listAgents: vi.fn(),
  listModels: vi.fn(),
  chatHistory: vi.fn(),
  listIntegrations: vi.fn(),
  listDestinations: vi.fn(),
  getProjectSettings: vi.fn(),
  readNode: vi.fn(),
  saveWorkflow: vi.fn(),
  runWorkflow: vi.fn(),
  replayRun: vi.fn(),
  writeNode: vi.fn(),
  upsertAgent: vi.fn(),
  deleteAgent: vi.fn(),
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

import { ApiClientError } from "../src/api.ts";
import { ProjectLayout } from "../src/pages/ProjectLayout.tsx";
import { ProjectOverviewPage } from "../src/pages/ProjectOverviewPage.tsx";
import { ProjectFlowPage } from "../src/pages/ProjectFlowPage.tsx";
import { ProjectRunsPage } from "../src/pages/ProjectRunsPage.tsx";
import { ProjectAgentsPage } from "../src/pages/ProjectAgentsPage.tsx";
import { ProjectKnowledgePage } from "../src/pages/ProjectKnowledgePage.tsx";
import { ProjectIntegrationsPage } from "../src/pages/ProjectIntegrationsPage.tsx";
import { ProjectSettingsPage } from "../src/pages/ProjectSettingsPage.tsx";
import { dismissAll } from "../src/components/Toast.tsx";

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

const issueGraph: WorkflowGraph = {
  ...graph,
  nodes: [
    graph.nodes[0]!,
    {
      id: "code",
      type: "code",
      label: "Consultar",
      position: { x: 220, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30000,
      retryPolicy: { maxRetries: 0 },
    },
  ],
};

function setupApi() {
  apiMock.getWorkflow.mockResolvedValue(graph);
  apiMock.listRuns.mockResolvedValue({ data: [] });
  apiMock.listAgents.mockResolvedValue({ data: [] });
  apiMock.listModels.mockResolvedValue({ data: [] });
  apiMock.chatHistory.mockResolvedValue({ data: [] });
  apiMock.listIntegrations.mockResolvedValue({ data: [] });
  apiMock.listDestinations.mockResolvedValue({ data: [] });
  apiMock.getProjectSettings.mockResolvedValue({
    project: { id: "p1", slug: "demo", name: "Demo", description: "", createdAt: new Date().toISOString() },
    integrations: [],
    notebooks: [],
    readiness: [],
  });
  apiMock.readNode.mockImplementation(() =>
    Promise.resolve({ code: "export default async function run() { return {}; }" }),
  );
  apiMock.writeNode.mockResolvedValue({ ok: true });
  apiMock.chat.mockResolvedValue({ reply: "ok", sessionId: "session", threadId: "thread" });
  apiMock.saveWorkflow.mockImplementation((_slug: string, next: WorkflowGraph) => Promise.resolve(next));
}

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/projects/demo/flow"]}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<ProjectOverviewPage />} />
          <Route path="flow" element={<ProjectFlowPage />} />
          <Route path="runs" element={<ProjectRunsPage />} />
          <Route path="agents" element={<ProjectAgentsPage />} />
          <Route path="knowledge" element={<ProjectKnowledgePage />} />
          <Route path="integrations" element={<ProjectIntegrationsPage />} />
          <Route path="settings" element={<ProjectSettingsPage />} />
        </Route>
      </Routes>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </MemoryRouter>,
  );
}

/**
 * Edges need measured nodes before React Flow renders them, which jsdom never
 * provides. This host keeps the real edge wrapper and renders the branches
 * directly, so the picker is exercised through the component's own props.
 */
function renderEdgeHost(branches: ReadonlyArray<{ id: string; condition?: string; selected?: boolean }>) {
  const actions = {
    onDuplicateNode: vi.fn(),
    onStartConnect: vi.fn(),
    onDeleteNode: vi.fn(),
    onDeleteEdge: vi.fn(),
    onChangeEdgeCondition: vi.fn(),
  };
  const result = renderWithProviders(
    <CanvasActionsContext.Provider value={actions}>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow
          nodes={[]}
          edges={branches.map((branch) => ({ id: branch.id, source: "a", target: "b" }))}
          edgeTypes={{ platform: PlatformEdge }}
          onNodesChange={vi.fn()}
          onEdgesChange={vi.fn()}
          onConnect={vi.fn()}
        >
          {branches.map((branch, index) => (
            <svg key={branch.id} width={0} height={0}>
              <PlatformEdge
                id={branch.id}
                source="a"
                target="b"
                sourceX={0}
                sourceY={index * 120}
                targetX={240}
                targetY={index * 120}
                sourcePosition={Position.Right}
                targetPosition={Position.Left}
                selected={branch.selected ?? false}
                data={{ condition: branch.condition, isDecision: true }}
              />
            </svg>
          ))}
        </ReactFlow>
      </div>
    </CanvasActionsContext.Provider>,
  );
  return { ...result, actions };
}

describe("decision edge branches", () => {
  it("renders both branches of a decision edge", async () => {
    const { container } = renderEdgeHost([
      { id: "e-true", condition: "true" },
      { id: "e-false", condition: "false" },
    ]);
    await waitFor(() => expect(container.querySelector(".react-flow__edgelabel-renderer")).not.toBeNull());
    const labels = container.querySelector(".react-flow__edgelabel-renderer") as HTMLElement;
    expect(within(labels).getAllByText("sí").length).toBeGreaterThan(0);
    expect(within(labels).getAllByText("no").length).toBeGreaterThan(0);
  });

  it("falls back to the sí branch and emits the branch value through the shared picker", async () => {
    const user = userEvent.setup();
    const { actions } = renderEdgeHost([{ id: "e1", selected: true }]);

    const trigger = await screen.findByRole("combobox", { name: "Rama de la conexión" });
    expect(trigger).toHaveTextContent("sí");

    await chooseOption(user, "Rama de la conexión", "no");

    expect(actions.onChangeEdgeCondition).toHaveBeenCalledWith("e1", "false");
  });

  it("shows a saved false branch through the shared picker", async () => {
    renderEdgeHost([{ id: "e1", condition: "false", selected: true }]);

    expect(await screen.findByRole("combobox", { name: "Rama de la conexión" })).toHaveTextContent("no");
  });

  it("displays a saved branch value that is not one of the options", async () => {
    renderEdgeHost([{ id: "e1", condition: "legacy", selected: true }]);

    expect(await screen.findByRole("combobox", { name: "Rama de la conexión" })).toHaveTextContent("legacy");
  });

  it("does not forward an unknown saved condition when its pinned row is chosen", async () => {
    const user = userEvent.setup();
    const { actions } = renderEdgeHost([{ id: "e1", condition: "legacy", selected: true }]);

    const trigger = await screen.findByRole("combobox", { name: "Rama de la conexión" });
    expect(trigger).toHaveTextContent("legacy");

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /legacy/ }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

    expect(actions.onChangeEdgeCondition).not.toHaveBeenCalled();
    expect(trigger).toHaveTextContent("legacy");
  });
});

describe("ProjectLayout flow section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  afterEach(() => {
    act(() => dismissAll());
  });

  it("keeps the single-trigger rule inline and fires no toast", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();

    fireEvent.click(document.querySelector('[data-node-id="start"]')!);
    const inspector = await screen.findByRole("dialog", { name: "Nodo: Inicio" });
    await user.click(within(inspector).getByRole("button", { name: "Duplicar" }));

    expect(await screen.findByText("Solo puede existir un trigger. No se puede duplicar.")).toBeInTheDocument();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("announces a rejected node creation as a toast", async () => {
    const user = userEvent.setup();
    apiMock.writeNode.mockRejectedValueOnce(new Error("failed to fetch"));
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ Nodo" }));
    const palette = screen.getByRole("dialog", { name: "Agregar nodo" });
    await user.click(within(palette).getByRole("button", { name: /Código/ }));

    const toast = await screen.findByText("failed to fetch");
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("adds a node from the modal palette, preserves unsaved edits and saves it", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "+ Nodo" }));
    const palette = screen.getByRole("dialog", { name: "Agregar nodo" });
    await userEvent.click(within(palette).getByRole("button", { name: /HTTP Request/ }));

    const inspector = await screen.findByRole("dialog", { name: /Nodo:/ });
    expect(within(inspector).getByLabelText("URL")).toBeInTheDocument();
    await userEvent.clear(within(inspector).getByLabelText("Etiqueta"));
    await userEvent.type(within(inspector).getByLabelText("Etiqueta"), "Mi HTTP");
    await userEvent.click(within(inspector).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Nodo:/ })).not.toBeInTheDocument());

    fireEvent.click(container.querySelector('[data-node-id="code"]')!);
    const codeInspector = await screen.findByRole("dialog", { name: "Nodo: Consultar" });
    await userEvent.click(within(codeInspector).getByRole("tab", { name: "Conexiones" }));
    // The destination picker is the shared Select now, not a native <select>.
    await chooseOption(user, "Nodo destino", "Mi HTTP");
    await userEvent.click(within(codeInspector).getByRole("button", { name: "Conectar" }));
    await userEvent.click(within(codeInspector).getByRole("button", { name: "Cerrar" }));

    await userEvent.click(screen.getByRole("button", { name: "Guardar flujo" }));
    await waitFor(() => expect(apiMock.saveWorkflow).toHaveBeenCalled());
    const saved = apiMock.saveWorkflow.mock.calls.at(-1)?.[1] as WorkflowGraph;
    expect(saved.nodes.some((node) => node.type === "http" && node.label === "Mi HTTP")).toBe(true);
  });

  it("keeps non-canvas sections inside a readable centered container", async () => {
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Agentes" }));
    const content = await screen.findByTestId("project-tab-content");
    expect(content.className).toContain("max-w-[1200px]");
  });

  it("duplicates a code node with its own code file", async () => {
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();
    const codeNode = document.querySelector('[data-node-id="code"]');
    fireEvent.click(codeNode!);
    const inspector = await screen.findByRole("dialog", { name: "Nodo: Consultar" });
    await userEvent.click(within(inspector).getByRole("button", { name: "Duplicar" }));

    await waitFor(() => expect(apiMock.writeNode).toHaveBeenCalled());
    const call = apiMock.writeNode.mock.calls.at(-1) as [string, string, string];
    expect(call[1]).toMatch(/^nodes\/code-[a-z0-9]+\.ts$/);
    expect(call[2]).toContain("return {}");
    expect(await screen.findByRole("dialog", { name: "Nodo: Copia de Consultar" })).toBeInTheDocument();
  });

  it("opens the inspector when a canvas node is clicked", async () => {
    const { container } = renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();

    const codeNode = container.querySelector('[data-node-id="code"]');
    expect(codeNode).not.toBeNull();
    fireEvent.click(codeNode!);
    expect(await screen.findByRole("dialog", { name: "Nodo: Consultar" })).toBeInTheDocument();
    await waitFor(() => expect(apiMock.readNode).toHaveBeenCalledWith("demo", "nodes/code.ts"));
    await waitFor(() =>
      expect((screen.getByLabelText("Editor de código") as HTMLTextAreaElement).value).toContain("return {}"),
    );
  });

  it("keeps the agent busy state visible after minimizing the chat", async () => {
    let finishChat: ((value: { reply: string; sessionId: string; threadId: string }) => void) | undefined;
    apiMock.chat.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishChat = resolve;
        }),
    );
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Agente" }));
    await userEvent.type(screen.getByPlaceholderText("Pídele un flujo, una corrección o un reporte…"), "haz un flujo");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(
      await within(screen.getByTestId("chat-panel")).findByText("Agente trabajando"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar chat" }));
    expect(screen.getByTestId("agent-progress")).toHaveTextContent("Agente trabajando");
    expect(screen.getByRole("button", { name: "Agente" })).toHaveAttribute(
      "title",
      "El agente está trabajando",
    );

    finishChat?.({ reply: "Listo", sessionId: "session", threadId: "thread" });
    await waitFor(() => expect(screen.queryByTestId("agent-progress")).not.toBeInTheDocument());
  });

  it("saves a dirty draft with Ctrl+S", async () => {
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();
    fireEvent.click(document.querySelector('[data-node-id="code"]')!);
    const inspector = await screen.findByRole("dialog", { name: "Nodo: Consultar" });
    await userEvent.clear(within(inspector).getByLabelText("Etiqueta"));
    await userEvent.type(within(inspector).getByLabelText("Etiqueta"), "Consultar API");
    await userEvent.click(within(inspector).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Nodo:/ })).not.toBeInTheDocument());

    fireEvent.keyDown(document, { key: "s", ctrlKey: true });
    await waitFor(() => expect(apiMock.saveWorkflow).toHaveBeenCalled());
    const saved = apiMock.saveWorkflow.mock.calls.at(-1)?.[1] as WorkflowGraph;
    expect(saved.nodes.find((node) => node.id === "code")?.label).toBe("Consultar API");
  });

  it("blocks Ctrl+S and shows the issue count when the graph has problems", async () => {
    apiMock.getWorkflow.mockResolvedValue(issueGraph);
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();

    const summary = await screen.findByRole("region", { name: "Problemas del flujo" });
    expect(within(summary).getByText(/Guardar deshabilitado: el flujo tiene 1 problema\./)).toBeInTheDocument();
    expect(within(summary).getByText(/necesita un archivo TypeScript/)).toBeInTheDocument();
    expect(screen.getByText("1 problema")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar flujo" })).toBeDisabled();

    fireEvent.keyDown(document, { key: "s", metaKey: true });
    expect(apiMock.saveWorkflow).not.toHaveBeenCalled();

    await userEvent.click(within(summary).getByRole("button", { name: "Descartar" }));
    expect(screen.queryByRole("region", { name: "Problemas del flujo" })).not.toBeInTheDocument();
    expect(screen.getByText("1 problema")).toBeInTheDocument();
  });

  it("asks for confirmation before deleting a node", async () => {
    const { container } = renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-node-id="code"]')!);
    const inspector = await screen.findByRole("dialog", { name: "Nodo: Consultar" });
    await userEvent.click(within(inspector).getByRole("button", { name: "Eliminar" }));

    const dialog = await screen.findByRole("dialog", { name: "Eliminar nodo" });
    expect(dialog).toHaveTextContent("Se eliminará «Consultar»");
    expect(container.querySelector('[data-node-id="code"]')).not.toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Eliminar nodo" })).not.toBeInTheDocument());
    expect(container.querySelector('[data-node-id="code"]')).not.toBeNull();
  });

  it("shows mapped and unmapped server validation issues", async () => {
    apiMock.saveWorkflow.mockRejectedValueOnce(
      new ApiClientError(422, "INVALID_WORKFLOW", "invalid workflow: node code has multiple outgoing edges; workflow requires a trigger node", [
        "node code has multiple outgoing edges",
        "workflow requires a trigger node",
      ]),
    );
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar flujo" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/Consultar: node code has multiple outgoing edges/)).toBeInTheDocument();
    expect(within(alert).getByText("workflow requires a trigger node")).toBeInTheDocument();
    await userEvent.click(within(alert).getByRole("button", { name: "Descartar" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
