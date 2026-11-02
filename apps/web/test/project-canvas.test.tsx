import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { WorkflowGraph } from "@platform/shared";
import { renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  getWorkflow: vi.fn(),
  listRuns: vi.fn(),
  listAgents: vi.fn(),
  listModels: vi.fn(),
  chatHistory: vi.fn(),
  listIntegrations: vi.fn(),
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
import { ProjectPage } from "../src/pages/ProjectPage.tsx";

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

function setupApi() {
  apiMock.getWorkflow.mockResolvedValue(graph);
  apiMock.listRuns.mockResolvedValue({ data: [] });
  apiMock.listAgents.mockResolvedValue({ data: [] });
  apiMock.listModels.mockResolvedValue({ data: [] });
  apiMock.chatHistory.mockResolvedValue({ data: [] });
  apiMock.listIntegrations.mockResolvedValue({ data: [] });
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
    <MemoryRouter initialEntries={["/projects/demo"]}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectPage canvas workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  it("adds a node from the modal palette, preserves unsaved edits and saves it", async () => {
    renderPage();
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

    await userEvent.click(screen.getByRole("button", { name: "Guardar flujo" }));
    await waitFor(() => expect(apiMock.saveWorkflow).toHaveBeenCalled());
    const saved = apiMock.saveWorkflow.mock.calls.at(-1)?.[1] as WorkflowGraph;
    expect(saved.nodes.some((node) => node.type === "http" && node.label === "Mi HTTP")).toBe(true);
  });

  it("keeps non-canvas tabs inside a readable centered container", async () => {
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Agentes" }));
    expect(screen.getByTestId("project-tab-content").className).toContain("max-w-[1200px]");
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
