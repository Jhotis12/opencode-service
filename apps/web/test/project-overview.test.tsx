import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { SubagentProfile, WorkflowGraph } from "@platform/shared";
import { findToast, renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  getWorkflow: vi.fn(),
  listRuns: vi.fn(),
  listAgents: vi.fn(),
  listModels: vi.fn(),
  chatHistory: vi.fn(),
  listIntegrations: vi.fn(),
  listDestinations: vi.fn(),
  listSchedules: vi.fn(),
  getProjectSettings: vi.fn(),
  listWorkflowVersions: vi.fn(),
  listNotebooks: vi.fn(),
  listProjectSecrets: vi.fn(),
  readNode: vi.fn(),
  writeNode: vi.fn(),
  saveWorkflow: vi.fn(),
  runWorkflow: vi.fn(),
  replayRun: vi.fn(),
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

const agent = (role: string): SubagentProfile => ({
  category: role === "agente" ? "principal" : "triage",
  role,
  frontmatter: {
    description: `Agente ${role} del proyecto`,
    mode: role === "agente" ? "primary" : "subagent",
    permissions: [],
    notebooks: [],
  },
  body: "Coordina el proyecto.",
});

const integration = {
  id: "int-1",
  scope: "project",
  projectSlug: "demo",
  kind: "telegram",
  name: "Telegram de operaciones",
  slug: "telegram-ops",
  config: {},
  secretRefs: {},
  capabilities: [] as never[],
  status: "connected",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const notebook = (index: number) => ({
  id: `nb-${index}`,
  projectSlug: "demo",
  slug: `notebook-${index}`,
  name: `Notebook ${index}`,
  description: "Documentación operativa",
  sources: index,
  createdAt: new Date().toISOString(),
});

function runRecord(index: number, status: string, minutesAgo: number) {
  return {
    id: `run-000${index}-seed`,
    projectSlug: "demo",
    workflowId: "p1",
    status,
    entryPoint: "web_ui",
    launchedBy: "admin",
    startedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    finishedAt: new Date(Date.now() - minutesAgo * 60_000 + 5_000).toISOString(),
    steps: [] as never[],
  };
}

const runs = [
  runRecord(1, "succeeded", 360),
  runRecord(2, "failed", 300),
  runRecord(3, "succeeded", 240),
  runRecord(4, "cancelled", 180),
  runRecord(5, "succeeded", 120),
  runRecord(6, "running", 30),
];

const settings = {
  project: { id: "p1", slug: "demo", name: "Demo", description: "", createdAt: new Date().toISOString() },
  integrations: [],
  notebooks: [],
  readiness: [
    { id: "primary-agent", label: "Agente principal configurado", ready: false, detail: "Define el agente principal del proyecto." },
    { id: "trigger", label: "El flujo tiene un trigger", ready: true },
    { id: "knowledge", label: "Conocimiento del proyecto", ready: true, detail: "Los notebooks son opcionales; se pueden agregar cuando el flujo los use." },
  ],
};

function setupApi() {
  apiMock.getWorkflow.mockResolvedValue(graph);
  apiMock.listRuns.mockResolvedValue({ data: runs });
  apiMock.listAgents.mockResolvedValue({ data: [agent("agente"), agent("triage")] });
  apiMock.listModels.mockResolvedValue({ data: [] });
  apiMock.chatHistory.mockResolvedValue({ data: [] });
  apiMock.listIntegrations.mockResolvedValue({ data: [integration] });
  apiMock.listDestinations.mockResolvedValue({ data: [] });
  apiMock.listSchedules.mockResolvedValue({ data: [] });
  apiMock.getProjectSettings.mockResolvedValue(settings);
  apiMock.listWorkflowVersions.mockResolvedValue({ data: [] });
  apiMock.listNotebooks.mockResolvedValue({ data: [notebook(1), notebook(2)] });
  apiMock.listProjectSecrets.mockResolvedValue({ data: [] });
  apiMock.readNode.mockResolvedValue({ code: "export default async function run() { return {}; }" });
  apiMock.writeNode.mockResolvedValue({ ok: true });
  apiMock.runWorkflow.mockResolvedValue({ ...runRecord(7, "running", 0), id: "run-0007-seed", status: "running" });
  apiMock.chat.mockResolvedValue({ reply: "ok", sessionId: "session", threadId: "thread" });
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderPage(entry = "/projects/demo/overview") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
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
    </MemoryRouter>,
  );
}

describe("ProjectOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  afterEach(() => {
    act(() => dismissAll());
  });

  it("renderiza preparación, el conteo de conocimiento y las últimas cinco ejecuciones", async () => {
    renderPage();

    const readiness = await screen.findByTestId("overview-readiness");
    expect(await within(readiness).findByText("Agente principal configurado")).toBeInTheDocument();
    expect(within(readiness).getByText("Define el agente principal del proyecto.")).toBeInTheDocument();
    expect(within(readiness).getByText("El flujo tiene un trigger")).toBeInTheDocument();
    expect(within(readiness).getByText("2 de 3 listas")).toBeInTheDocument();
    expect(within(readiness).getByRole("button", { name: "Revisar ajustes" })).toBeInTheDocument();

    expect(await screen.findByText("Notebooks de conocimiento del proyecto.")).toBeInTheDocument();
    expect(screen.getByTestId("overview-count-knowledge")).toHaveTextContent("2");
    // Los conteos de agentes e integraciones viven solo en las pestañas del proyecto.
    expect(screen.queryByTestId("overview-count-agents")).not.toBeInTheDocument();
    expect(screen.queryByTestId("overview-count-integrations")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agentes (2)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Integraciones (1)" })).toBeInTheDocument();

    const runsSection = screen.getByTestId("overview-runs");
    expect(await within(runsSection).findByText("run-0006")).toBeInTheDocument();
    expect(within(runsSection).getAllByText(/^run-000\d$/)).toHaveLength(5);
    expect(within(runsSection).queryByText("run-0001")).not.toBeInTheDocument();
    expect(within(runsSection).getAllByRole("listitem")[0]).toHaveTextContent("run-0006");
    expect(within(runsSection).getByText("Fallido")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Ejecutar flujo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir chat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir flujo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver todas" })).toBeInTheDocument();
  });

  it("muestra esqueletos mientras cargan las fuentes sin filtrar estados vacíos", async () => {
    const pending = () => new Promise(() => {});
    apiMock.getProjectSettings.mockReturnValue(pending());
    apiMock.listRuns.mockReturnValue(pending());
    apiMock.listAgents.mockReturnValue(pending());
    apiMock.listIntegrations.mockReturnValue(pending());
    apiMock.listNotebooks.mockReturnValue(pending());

    renderPage();

    const readiness = await screen.findByTestId("overview-readiness");
    expect(readiness).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("overview-runs")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("overview-count-knowledge")).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sin ejecuciones todavía")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("muestra los estados vacíos de un proyecto recién creado", async () => {
    apiMock.listRuns.mockResolvedValue({ data: [] });
    apiMock.listAgents.mockResolvedValue({ data: [] });
    apiMock.listIntegrations.mockResolvedValue({ data: [] });
    apiMock.listNotebooks.mockResolvedValue({ data: [] });

    renderPage();

    const runsSection = await screen.findByTestId("overview-runs");
    expect(
      await within(runsSection).findByRole("heading", { name: "Sin ejecuciones todavía" }),
    ).toBeInTheDocument();
    expect(within(runsSection).getByText(/las últimas corridas aparecen aquí/)).toBeInTheDocument();

    await userEvent.click(within(runsSection).getByRole("button", { name: "Ejecutar flujo" }));
    expect(await screen.findByRole("dialog", { name: "Ejecutar flujo" })).toBeInTheDocument();

    expect(await screen.findByText("Sin notebooks todavía.")).toBeInTheDocument();
    expect(screen.getByTestId("overview-count-knowledge")).toHaveTextContent("0");
    expect(screen.getByText("Define el agente principal del proyecto.")).toBeInTheDocument();
  });

  it("muestra un error acotado por fuente, conserva el resto y recupera con reintentar", async () => {
    apiMock.getProjectSettings.mockRejectedValue(new Error("failed to fetch"));

    renderPage();

    const readiness = await screen.findByTestId("overview-readiness");
    const alert = await within(readiness).findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo conectar con el servidor");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();

    expect(await screen.findByText("run-0006")).toBeInTheDocument();
    expect(await screen.findByText("Notebooks de conocimiento del proyecto.")).toBeInTheDocument();
    expect(within(readiness).queryByText("Agente principal configurado")).not.toBeInTheDocument();

    apiMock.getProjectSettings.mockResolvedValue(settings);
    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(await within(readiness).findByText("Agente principal configurado")).toBeInTheDocument();
    expect(within(readiness).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("aisla el error del query local de notebooks", async () => {
    apiMock.listNotebooks.mockRejectedValueOnce(new Error("failed to fetch"));

    renderPage();

    const knowledge = await screen.findByTestId("overview-count-knowledge");
    const alert = await within(knowledge).findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo conectar con el servidor");
    expect(
      within(screen.getByTestId("overview-readiness")).queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByTestId("overview-count-knowledge")).toHaveTextContent("2"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("las acciones rápidas abren el chat y ejecutan el flujo", async () => {
    renderPage();
    await screen.findByText("run-0006");

    await userEvent.click(screen.getByRole("button", { name: "Abrir chat" }));
    expect(await screen.findByRole("button", { name: "Cerrar chat" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar chat" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cerrar chat" })).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Ejecutar flujo" }));
    const launchDialog = await screen.findByRole("dialog", { name: "Ejecutar flujo" });
    await userEvent.click(within(launchDialog).getByRole("button", { name: "Ejecutar" }));
    await waitFor(() => expect(apiMock.runWorkflow).toHaveBeenCalledWith("demo", {}));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ejecutar flujo" })).not.toBeInTheDocument());
    const toast = await screen.findByText(/Ejecución iniciada/);
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("anuncia un lanzamiento rechazado como toast", async () => {
    apiMock.runWorkflow.mockRejectedValueOnce(new Error("failed to fetch"));
    renderPage();
    await screen.findByText("run-0006");

    await userEvent.click(screen.getByRole("button", { name: "Ejecutar flujo" }));
    const launchDialog = await screen.findByRole("dialog", { name: "Ejecutar flujo" });
    await userEvent.click(within(launchDialog).getByRole("button", { name: "Ejecutar" }));

    const toast = await screen.findByText(
      "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.",
    );
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("navega a cada sección desde los accesos del resumen", async () => {
    const targets: Array<[string, string]> = [
      ["Ver todas", "/projects/demo/runs"],
      ["Ver conocimiento", "/projects/demo/knowledge"],
      ["Revisar ajustes", "/projects/demo/settings"],
      ["Abrir flujo", "/projects/demo/flow"],
    ];

    for (const [name, path] of targets) {
      const { unmount } = renderPage();
      await screen.findByText("2 de 3 listas");
      await userEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(path));
      unmount();
    }
  });

  it("muestra el breadcrumb del proyecto una sola vez", async () => {
    renderPage();
    await screen.findByText("2 de 3 listas");

    // Una única fila de migas: la de la barra superior, que también lleva al resumen.
    const breadcrumbs = screen.getAllByRole("navigation", { name: "Migas de pan" });
    expect(breadcrumbs).toHaveLength(1);
    expect(within(breadcrumbs[0]!).getByRole("link", { name: "Proyectos" })).toHaveAttribute("href", "/projects");
    expect(within(breadcrumbs[0]!).getByRole("link", { name: "Demo" })).toHaveAttribute("aria-current", "page");
    // El slug no se repite en una segunda miga encima de la barra.
    expect(screen.getAllByText("demo")).toHaveLength(1);
  });
});
