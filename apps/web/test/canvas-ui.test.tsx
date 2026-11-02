import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { NodeSpec, NodeType, WorkflowGraph } from "@platform/shared";
import { WorkflowCanvas } from "../src/components/WorkflowCanvas.tsx";
import { NodePaletteModal } from "../src/components/NodePaletteModal.tsx";
import { NodeInspectorModal } from "../src/components/NodeInspectorModal.tsx";
import { ProjectTopBar } from "../src/components/ProjectTopBar.tsx";

vi.mock("../src/components/CodeEditor.tsx", () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange(value: string): void }) => (
    <textarea aria-label="Editor de código" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

function node(id: string, type: NodeType, extra: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id,
    type,
    label: id,
    position: { x: 0, y: 0 },
    config: {},
    notebookIds: [],
    timeoutMs: 30_000,
    retryPolicy: { maxRetries: 0 },
    ...(type === "code" ? { codeFile: `nodes/${id}.ts` } : {}),
    ...(type === "agent" ? { agentId: "ventas/calificador" } : {}),
    ...(type === "http" ? { config: { url: "https://example.com" } } : {}),
    ...(type === "delay" ? { config: { ms: 1000 } } : {}),
    ...(type === "validate" ? { config: { rules: [{ name: "tema", type: "string", required: true }] } } : {}),
    ...(type === "transform" ? { config: { template: "{}" } } : {}),
    ...(type === "decision" ? { config: { mode: "condition", condition: { field: "ok", operator: "truthy" } } } : {}),
    ...extra,
  };
}

function graph(nodes: NodeSpec[], edges: WorkflowGraph["edges"] = []): WorkflowGraph {
  return {
    version: 1,
    id: "graph",
    name: "Demo",
    description: "Demo flow",
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}

const allTypes: NodeType[] = ["trigger", "http", "code", "transform", "delay", "validate", "agent", "decision", "approval"];

function renderCanvas(overrides: Partial<React.ComponentProps<typeof WorkflowCanvas>> = {}) {
  const props: React.ComponentProps<typeof WorkflowCanvas> = {
    graph: graph(allTypes.map((type, index) => node(type, type, { position: { x: index * 280, y: 0 } }))),
    onSelect: vi.fn(),
    onChange: vi.fn(),
    onConnect: vi.fn(),
    onConnectRejected: vi.fn(),
    onStartConnect: vi.fn(),
    onCancelConnect: vi.fn(),
    onDuplicateNode: vi.fn(),
    onDeleteNode: vi.fn(),
    onDeleteEdge: vi.fn(),
    onChangeEdgeCondition: vi.fn(),
    onOpenPalette: vi.fn(),
    ...overrides,
  };
  const result = render(<WorkflowCanvas {...props} />);
  return { ...result, props };
}

describe("WorkflowCanvas", () => {
  it("renders a distinct silhouette for every node type", () => {
    const { container } = renderCanvas();
    const shapes = Array.from(container.querySelectorAll("[data-node-shape]")).map((element) =>
      element.getAttribute("data-node-shape"),
    );
    expect(shapes.sort()).toEqual([...allTypes].sort());
  });

  it("shows the node toolbar for the selected node, exposes both decision handles and calls actions", async () => {
    const { container, props } = renderCanvas({ selectedId: "decision" });
    expect(await screen.findByRole("button", { name: "Duplicar nodo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar nodo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar nodo" })).toBeInTheDocument();

    const decision = container.querySelector('[data-node-id="decision"]')!;
    expect(decision.querySelector('[data-handleid="true"]')).not.toBeNull();
    expect(decision.querySelector('[data-handleid="false"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Duplicar nodo" }));
    fireEvent.click(screen.getByRole("button", { name: "Conectar nodo" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar nodo" }));
    expect(vi.mocked(props.onDuplicateNode)).toHaveBeenCalledWith("decision");
    expect(vi.mocked(props.onStartConnect)).toHaveBeenCalledWith("decision");
    expect(vi.mocked(props.onDeleteNode)).toHaveBeenCalledWith("decision");
  });

  it("highlights valid connection targets, connects on click and cancels with Escape", async () => {
    const { container, props } = renderCanvas({ connecting: { sourceId: "trigger" } });
    expect(screen.getByText("Elige el destino")).toBeInTheDocument();
    const source = container.querySelector('[data-node-id="trigger"]');
    await waitFor(() => expect(source).not.toBeNull());
    expect(source!.className).toContain("ring-sky-300");
    const codeTarget = container.querySelector('[data-node-id="code"]');
    await waitFor(() => expect(codeTarget).not.toBeNull());
    expect(codeTarget!.className).toContain("ring-emerald-400");

    fireEvent.click(codeTarget!);
    await waitFor(() => expect(vi.mocked(props.onConnect)).toHaveBeenCalledWith("trigger", "code", undefined));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(vi.mocked(props.onCancelConnect)).toHaveBeenCalled();
  });

  it("keeps selection and live status visible after a graph re-sync", async () => {
    const first = graph([node("start", "trigger"), node("code", "code")]);
    const { rerender, props } = renderCanvas({ graph: first, selectedId: "code" });
    expect(await screen.findByRole("button", { name: "Duplicar nodo" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Estado: succeeded")).not.toBeInTheDocument();

    rerender(
      <WorkflowCanvas
        {...props}
        graph={{ ...first, updatedAt: new Date().toISOString() }}
        nodeStatuses={{ code: "succeeded" }}
        selectedId="code"
      />,
    );
    expect(screen.getByLabelText("Estado: succeeded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicar nodo" })).toBeInTheDocument();
  });

  it("exposes an explicit fit-view action", () => {
    renderCanvas();
    expect(screen.getByRole("button", { name: "Ajustar vista del flujo" })).toBeInTheDocument();
  });

  it("uses the readable node footprint and title size", async () => {
    const { container } = renderCanvas({ graph: graph([node("code", "code", { label: "Consultar" })]) });
    const wrapper = container.querySelector('[data-node-id="code"]')!;
    expect(wrapper.className).toContain("h-[96px]");
    expect(wrapper.className).toContain("w-[252px]");
    expect(screen.getByText("Consultar").className).toContain("text-[14px]");
    expect(screen.getByText("Código").className).toContain("text-[11px]");
  });

  it("selects a node on click and keeps long labels in a truncated element", async () => {
    const onSelect = vi.fn();
    const { container } = renderCanvas({
      graph: graph([node("start", "trigger", { label: "Un nombre de nodo extremadamente largo que no debería romper la silueta" })]),
      onSelect,
    });
    const label = screen.getByTitle("Un nombre de nodo extremadamente largo que no debería romper la silueta");
    expect(label.className).toContain("truncate");
    fireEvent.click(container.querySelector('[data-node-id="start"]')!);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("start"));
  });

  it("persists keyboard node removal through onChange", async () => {
    const onChange = vi.fn();
    const { container } = renderCanvas({ onChange });
    fireEvent.click(container.querySelector('[data-node-id="code"]')!);
    fireEvent.keyDown(document, { key: "Delete", code: "Delete" });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const next = onChange.mock.calls.at(-1)?.[0] as WorkflowGraph;
    expect(next.nodes.some((item) => item.id === "code")).toBe(false);
  });
});

describe("NodePaletteModal", () => {
  const paletteGraph = graph([node("start", "trigger")]);

  it("searches, shows an empty state and disables a second trigger", async () => {
    const onAdd = vi.fn();
    render(<NodePaletteModal graph={paletteGraph} onClose={vi.fn()} onAdd={onAdd} />);

    const triggerOption = screen.getByRole("button", { name: /Trigger/ });
    expect(triggerOption).toBeDisabled();
    expect(screen.getAllByText("Este flujo ya tiene un trigger.").length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText("Buscar nodo"), "agente");
    expect(screen.getByRole("button", { name: /Agente/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /HTTP Request/ })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Buscar nodo"));
    await userEvent.type(screen.getByLabelText("Buscar nodo"), "zzzz");
    expect(screen.getByText(/No hay nodos que coincidan/)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Buscar nodo"));
    await userEvent.click(screen.getByRole("button", { name: /HTTP Request/ }));
    expect(onAdd).toHaveBeenCalledWith("http");
  });
});

describe("NodeInspectorModal", () => {
  const agent = node("agent", "agent");
  const code = node("code", "code");
  const inspectionGraph = graph([node("start", "trigger"), agent, code], [
    { id: "e1", source: "start", target: "agent" },
  ]);
  const lastStep = {
    id: "step",
    nodeId: "agent",
    status: "succeeded",
    input: { topic: "ventas" },
    output: { ok: true },
    durationMs: 42,
    model: "opencode-go/fast",
    agentId: "ventas/calificador",
    startedAt: new Date().toISOString(),
  };

  function renderInspector(overrides: Partial<React.ComponentProps<typeof NodeInspectorModal>> = {}) {
    const onConnect = vi.fn();
    const onStartCanvasConnect = vi.fn();
    const onDuplicate = vi.fn();
    const onRemove = vi.fn();
    render(
      <NodeInspectorModal
        node={agent}
        graph={inspectionGraph}
        agents={[]}
        models={[]}
        integrations={[]}
        lastStep={lastStep}
        code=""
        codeDirty={false}
        issues={[]}
        onClose={vi.fn()}
        onPatch={vi.fn()}
        onConfig={vi.fn()}
        onCodeChange={vi.fn()}
        onSaveCode={vi.fn()}
        onEnableDecisionCode={vi.fn()}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        onConnect={onConnect}
        onStartCanvasConnect={onStartCanvasConnect}
        onChangeEdgeCondition={vi.fn()}
        onDeleteEdge={vi.fn()}
        {...overrides}
      />,
    );
    return { onConnect, onStartCanvasConnect, onDuplicate, onRemove };
  }

  it("shows settings, connections with invalid targets disabled, and execution context", async () => {
    const { onConnect } = renderInspector();
    const dialog = screen.getByRole("dialog", { name: "Nodo: agent" });
    expect(dialog.className).toContain("max-w-5xl");

    expect(within(dialog).getByLabelText("Etiqueta")).toHaveValue("agent");
    await userEvent.click(within(dialog).getByRole("tab", { name: "Conexiones" }));
    const target = within(dialog).getByLabelText("Nodo destino");
    expect(within(target).getByRole("option", { name: /start/ })).toBeDisabled();
    expect(within(target).getByRole("option", { name: /code/ })).toBeEnabled();
    await userEvent.selectOptions(target, "code");
    await userEvent.click(within(dialog).getByRole("button", { name: "Conectar" }));
    expect(onConnect).toHaveBeenCalledWith("agent", "code", undefined);

    await userEvent.click(within(dialog).getByRole("tab", { name: "Ejecución" }));
    expect(within(dialog).getAllByText("succeeded").length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/"ok": true/)).toBeInTheDocument();
  });

  it("shows the empty execution state and runs duplicate/delete actions", async () => {
    const { onDuplicate, onRemove } = renderInspector({ lastStep: undefined });
    const dialog = screen.getByRole("dialog", { name: "Nodo: agent" });
    await userEvent.click(within(dialog).getByRole("tab", { name: "Ejecución" }));
    expect(within(dialog).getByText(/todavía no tiene una ejecución/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Duplicar" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    expect(onDuplicate).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });

  it("starts the canvas connection mode with the chosen decision branch", async () => {
    const decision = node("decision", "decision");
    const decisionGraph = graph(
      [node("start", "trigger"), decision, node("yes", "code"), node("no", "code")],
      [
        { id: "e1", source: "start", target: "decision" },
        { id: "e2", source: "decision", target: "yes", condition: "true" },
        { id: "e3", source: "decision", target: "no", condition: "false" },
      ],
    );
    const { onStartCanvasConnect } = renderInspector({ node: decision, graph: decisionGraph, lastStep: undefined });
    const dialog = screen.getByRole("dialog", { name: "Nodo: decision" });
    await userEvent.click(within(dialog).getByRole("tab", { name: "Conexiones" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "no" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Conectar en el canvas" }));
    expect(onStartCanvasConnect).toHaveBeenCalledWith("decision", "false");
  });
});

describe("ProjectTopBar", () => {
  it("switches tabs and edits flow settings", async () => {
    const onTab = vi.fn();
    const onChange = vi.fn();
    const onSave = vi.fn();
    const onRun = vi.fn();
    const onChat = vi.fn();
    const onRollbackVersion = vi.fn();
    const flowGraph = graph([node("start", "trigger")]);
    render(
      <MemoryRouter>
        <ProjectTopBar
          slug="demo"
          graph={flowGraph}
          tab="canvas"
          counts={{ runs: 2, agents: 1, integrations: 3 }}
          dirty
          issueCount={0}
          saving={false}
          modelOptions={["opencode-go/fast"]}
          versions={[
            {
              id: "v1",
              projectSlug: "demo",
              version: 1,
              graphHash: "h1",
              graph: flowGraph,
              codeBundle: {},
              createdBy: "admin",
              createdAt: new Date().toISOString(),
            },
          ]}
          onTab={onTab}
          onChange={onChange}
          onSave={onSave}
          onRun={onRun}
          onChat={onChat}
          onRollbackVersion={onRollbackVersion}
        />
      </MemoryRouter>,
    );
    for (const label of ["Canvas", "Ejecuciones (2)", "Agentes (1)", "Conocimiento", "Recursos (3)", "Ajustes"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Guardar flujo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ejecutar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agente" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Agentes (1)" }));
    expect(onTab).toHaveBeenCalledWith("agents");
    await userEvent.click(screen.getByRole("button", { name: "Más acciones del flujo" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Versiones del flujo/ }));
    const versionsDialog = screen.getByRole("dialog", { name: "Versiones del flujo" });
    await userEvent.click(within(versionsDialog).getByRole("button", { name: "Restaurar v1" }));
    expect(onRollbackVersion).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole("button", { name: "Más acciones del flujo" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Ajustes del flujo" }));
    const dialog = screen.getByRole("dialog", { name: "Ajustes del flujo" });
    await userEvent.type(within(dialog).getByLabelText("Descripción"), " nuevo");
    expect(onChange).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Ejecutar" }));
    await userEvent.click(screen.getByRole("button", { name: "Agente" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar flujo" }));
    expect(onRun).toHaveBeenCalled();
    expect(onChat).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });

  it("opens the overflow menu with the keyboard and closes it with Escape", async () => {
    render(
      <MemoryRouter>
        <ProjectTopBar
          slug="demo"
          graph={graph([node("start", "trigger")])}
          tab="canvas"
          counts={{ runs: 0, agents: 0, integrations: 0 }}
          dirty={false}
          issueCount={0}
          saving={false}
          modelOptions={[]}
          onTab={() => undefined}
          onChange={() => undefined}
          onSave={() => undefined}
          onRun={() => undefined}
          onChat={() => undefined}
        />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Más acciones del flujo" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    const menu = await screen.findByRole("menu", { name: "Más acciones del flujo" });
    const firstItem = within(menu).getByRole("menuitem", { name: /Versiones del flujo/ });
    await waitFor(() => expect(firstItem).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
