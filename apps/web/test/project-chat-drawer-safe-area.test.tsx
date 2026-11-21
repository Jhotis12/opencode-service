import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { WorkflowGraph } from "@platform/shared";
import { renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  getWorkflow: vi.fn(),
  listSchedules: vi.fn(),
  listRuns: vi.fn(),
  listAgents: vi.fn(),
  listModels: vi.fn(),
  chatHistory: vi.fn(),
  listIntegrations: vi.fn(),
  listDestinations: vi.fn(),
  getProjectSettings: vi.fn(),
  listWorkflowVersions: vi.fn(),
}));

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return { ...actual, api: apiMock };
});

import { ProjectLayout } from "../src/pages/ProjectLayout.tsx";
import { dismissAll } from "../src/components/Toast.tsx";

const graph: WorkflowGraph = {
  version: 1,
  id: "p1",
  name: "Demo",
  description: "",
  nodes: [
    {
      id: "start",
      type: "trigger",
      label: "Inicio",
      position: { x: 0, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30000,
      retryPolicy: { maxRetries: 0 },
    },
  ],
  edges: [],
  updatedAt: new Date().toISOString(),
};

function setupApi() {
  apiMock.getWorkflow.mockResolvedValue(graph);
  apiMock.listSchedules.mockResolvedValue({ data: [] });
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
  apiMock.listWorkflowVersions.mockResolvedValue({ data: [] });
}

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/projects/demo"]}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

function drawerElement(): HTMLElement {
  const drawer = document.querySelector<HTMLElement>("[data-chat-drawer]");
  expect(drawer).not.toBeNull();
  return drawer!;
}

/**
 * jsdom never resolves `env()`, so these specs pin the class declarations and the browser
 * sweep in `.omo/evidence/task-70-chat-drawer.md` proves the real geometry.
 */
describe("project chat drawer safe-area bands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  afterEach(() => {
    act(() => dismissAll());
  });

  it("pays the top inset on the drawer panel", async () => {
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();

    expect(drawerElement().className).toContain("pt-[calc(0.75rem+env(safe-area-inset-top))]");
  });

  it("pays the bottom inset on the drawer panel", async () => {
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();

    expect(drawerElement().className).toContain("pb-[calc(0.75rem+env(safe-area-inset-bottom))]");
  });

  it("keeps the p-3 base so the side gutter survives", async () => {
    renderPage();
    expect(await screen.findByText("Demo")).toBeInTheDocument();

    expect(drawerElement().className.split(/\s+/)).toContain("p-3");
  });
});
