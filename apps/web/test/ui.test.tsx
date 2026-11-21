import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "../src/pages/LoginPage.tsx";
import { AuthProvider } from "../src/auth.tsx";
import { HealthPage } from "../src/pages/HealthPage.tsx";
import { WorkflowCanvas } from "../src/components/WorkflowCanvas.tsx";
import { renderWithProviders } from "./render.tsx";
import type { HealthPayload } from "../src/api.ts";
import type { WorkflowGraph } from "@platform/shared";

const health: HealthPayload = {
  status: "ok",
  uptimeSeconds: 125,
  services: [
    { name: "OpenCode V2", status: "ok", detail: "OpenCode 2.2.5", latencyMs: 3 },
    { name: "Database", status: "ok", detail: "SQLite reachable", latencyMs: 1 },
  ],
  metrics: { requests: 12, errors: 1, errorRate: 0.08, p50Ms: 10, p95Ms: 40, p99Ms: 80 },
  recentErrors: [
    { id: "e1", entryPoint: "web_ui", level: "error", message: "boom", createdAt: new Date().toISOString() },
  ],
  generatedAt: new Date().toISOString(),
};

const graph: WorkflowGraph = {
  version: 1,
  id: "p1",
  name: "Demo",
  description: "",
  nodes: [
    { id: "start", type: "trigger", label: "Inicio", position: { x: 0, y: 0 }, config: {}, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } },
    { id: "code", type: "code", label: "Consultar", codeFile: "nodes/code.ts", position: { x: 200, y: 0 }, config: {}, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } },
  ],
  edges: [{ id: "e1", source: "start", target: "code" }],
  updatedAt: new Date().toISOString(),
};

describe("LoginPage", () => {
  it("submits credentials and routes to password rotation", async () => {
    const user = { id: "u1", username: "admin", mustChangePassword: true, createdAt: new Date().toISOString() };
    const login = vi.fn().mockResolvedValue({ user, mustChangePassword: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "no" } }), { status: 401 })),
    );

    renderWithProviders(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage login={login} />} />
            <Route path="/change-password" element={<div>cambiar clave</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Agentic Platform" })).toBeInTheDocument();
    await userEvent.type(await screen.findByLabelText("Contraseña"), "admin123!");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(login).toHaveBeenCalledWith("admin", "admin123!");
    await waitFor(() => expect(screen.getByText("cambiar clave")).toBeInTheDocument());
  });

  it("shows an error when credentials fail", async () => {
    const login = vi.fn().mockRejectedValue(new Error("invalid username or password"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    renderWithProviders(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage login={login} />
        </AuthProvider>
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByLabelText("Contraseña"), "mala");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Usuario o contraseña incorrectos.")).toBeInTheDocument();
  });
});

describe("HealthPage", () => {
  it("renders service status, RED metrics and recent errors", async () => {
    renderWithProviders(<HealthPage loadHealth={async () => health} />);
    expect(await screen.findByTestId("health-status")).toHaveTextContent("Operativo");
    expect(screen.getByText("OpenCode V2")).toBeInTheDocument();
    expect(screen.getByText("8.00%")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("reports a loading failure", async () => {
    renderWithProviders(<HealthPage loadHealth={async () => { throw new Error("sin conexión"); }} />);
    expect(await screen.findByText("No se pudo consultar la salud del sistema.")).toBeInTheDocument();
  });
});

describe("WorkflowCanvas", () => {
  it("renders nodes and edges from the graph", async () => {
    render(
      <WorkflowCanvas
        graph={graph}
        onSelect={() => undefined}
        onChange={() => undefined}
        onConnect={() => undefined}
        onConnectRejected={() => undefined}
        onStartConnect={() => undefined}
        onCancelConnect={() => undefined}
        onDuplicateNode={() => undefined}
        onDeleteNode={() => undefined}
        onDeleteEdge={() => undefined}
        onChangeEdgeCondition={() => undefined}
        onOpenPalette={() => undefined}
      />,
    );
    expect(await screen.findByText("Inicio")).toBeInTheDocument();
    expect(await screen.findByText("Consultar")).toBeInTheDocument();
    expect(screen.getByText("Trigger")).toBeInTheDocument();
    expect(screen.getByText("Código")).toBeInTheDocument();
  });
});
