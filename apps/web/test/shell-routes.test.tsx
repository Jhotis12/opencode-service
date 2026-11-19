import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { WorkflowGraph } from "@platform/shared";

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
  listWorkflowVersions: vi.fn(),
  listProjects: vi.fn(),
  listGlobalRuns: vi.fn(),
  readNode: vi.fn(),
}));

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return { ...actual, api: apiMock };
});

vi.mock("../src/components/CodeEditor.tsx", () => ({
  CodeEditor: () => <textarea aria-label="Editor de código" readOnly />,
}));

import { App } from "../src/App.tsx";
import { Breadcrumbs } from "../src/components/Breadcrumbs.tsx";
import { renderWithProviders } from "./render.tsx";

const graph: WorkflowGraph = {
  version: 1,
  id: "p1",
  name: "Demo",
  description: "",
  nodes: [
    { id: "start", type: "trigger", label: "Inicio", position: { x: 0, y: 0 }, config: {}, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } },
  ],
  edges: [],
  updatedAt: new Date().toISOString(),
};

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

describe("Breadcrumbs", () => {
  it("renders an accessible ordered trail with the current page marked", () => {
    renderWithProviders(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: "Proyectos", to: "/projects" },
            { label: "Ventas", to: "/projects/ventas" },
          ]}
        />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Migas de pan" });
    const list = within(nav).getByRole("list");
    expect(list.tagName).toBe("OL");
    const items = within(nav).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const home = within(nav).getByRole("link", { name: "Proyectos" });
    expect(home).toHaveAttribute("href", "/projects");
    expect(home).not.toHaveAttribute("aria-current");

    const current = within(nav).getByRole("link", { name: "Ventas" });
    expect(current).toHaveAttribute("href", "/projects/ventas");
    expect(current).toHaveAttribute("aria-current", "page");

    const divider = items[1]!.querySelector("svg");
    expect(divider).toHaveAttribute("aria-hidden", "true");
    expect(items[0]!.querySelector("svg")).toBeNull();
  });
});

describe("global runs route", () => {
  it("renders the global runs page with the nav item active", async () => {
    apiMock.listProjects.mockResolvedValue({ data: [] });
    apiMock.listGlobalRuns.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });

    renderWithProviders(
      <MemoryRouter initialEntries={["/runs"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Ejecuciones" })).toBeInTheDocument();
    const navItem = screen.getByRole("link", { name: "Ejecuciones" });
    expect(navItem).toHaveAttribute("href", "/runs");
    expect(navItem).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Proyectos" })).not.toHaveAttribute("aria-current");
    expect(await screen.findByRole("heading", { name: "Sin ejecuciones todavía" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a proyectos" })).toHaveAttribute("href", "/projects");
    expect(document.title).toBe("Ejecuciones · Agentic Platform");
  });

  it("redirects unknown routes to /projects", async () => {
    apiMock.listProjects.mockResolvedValue({ data: [] });

    renderWithProviders(
      <MemoryRouter initialEntries={["/no-such-route"]}>
        <LocationProbe />
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/projects"));
    await waitFor(() => expect(apiMock.listProjects).toHaveBeenCalled());
  });

  it("shows breadcrumbs on the project workspace", async () => {
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
    apiMock.listWorkflowVersions.mockResolvedValue({ data: [] });

    renderWithProviders(
      <MemoryRouter initialEntries={["/projects/demo"]}>
        <App />
      </MemoryRouter>,
    );

    const nav = await screen.findByRole("navigation", { name: "Migas de pan" });
    expect(within(nav).getByRole("link", { name: "Proyectos" })).toHaveAttribute("href", "/projects");
    const current = within(nav).getByRole("link", { name: "demo" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveAttribute("title", "Demo");
  });
});
