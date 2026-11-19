import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RunRecord, StepRun } from "../src/api.ts";
import { RUNS_LIST_LIMIT, runOriginLabel } from "../src/api.ts";
import {
  ProjectRunsPage,
  RUN_EXPORT_FIELDS,
  exportableRun,
  filterRuns,
  groupRunsByParent,
  runsToCsv,
  runsToJson,
} from "../src/pages/ProjectRunsPage.tsx";
import { renderWithProviders } from "./render.tsx";

const workspace = vi.hoisted(() => ({
  slug: "demo",
  runs: [] as RunRecord[],
  setLaunchOpen: vi.fn(),
  setDetailRun: vi.fn(),
  replayRun: vi.fn(),
}));

vi.mock("../src/pages/project-workspace.tsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/pages/project-workspace.tsx")>();
  return { ...actual, useProjectWorkspace: () => workspace };
});

const step: StepRun = {
  id: "step-1",
  nodeId: "nodo-a",
  status: "succeeded",
  input: { dato: "entrada-sensible" },
  output: { dato: "salida-sensible" },
  logs: [{ message: "log-sensible", fields: { clave: "valor" } }],
  model: "opencode/deepseek-v4.1-flash-free",
  agentId: "agente-1",
  durationMs: 1234,
  startedAt: "2026-11-10T10:00:01.000Z",
  finishedAt: "2026-11-10T10:00:02.234Z",
};

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "aaaa1111-succeeded",
    projectSlug: "demo",
    workflowId: "wf-1",
    status: "succeeded",
    entryPoint: "web_ui",
    launchedBy: "admin",
    startedAt: "2026-11-10T10:00:00.000Z",
    finishedAt: "2026-11-10T10:00:05.000Z",
    steps: [],
    ...overrides,
  };
}

const succeededWebUi = makeRun({ id: "aaaa1111-succeeded" });
const failedWebhook = makeRun({
  id: "bbbb2222-failed",
  status: "failed",
  entryPoint: "webhook",
  error: "falló la petición",
  startedAt: "2026-11-11T11:30:00.000Z",
});
const runningSchedule = makeRun({
  id: "cccc3333-running",
  status: "running",
  entryPoint: "schedule",
  startedAt: "2026-11-12T09:15:00.000Z",
});

function renderRuns() {
  return renderWithProviders(<ProjectRunsPage />);
}

function emptySection() {
  return screen.getByRole("heading", { name: "Ninguna ejecución coincide" }).closest("section")!;
}

describe("ProjectRunsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspace.runs = [];
  });

  it("renders each run with its origin label and the visible count", () => {
    workspace.runs = [succeededWebUi, failedWebhook, runningSchedule];
    renderRuns();
    expect(screen.getAllByTestId("run-row")).toHaveLength(3);
    expect(screen.getByTitle("web_ui")).toHaveTextContent("Interfaz web");
    expect(screen.getByTitle("webhook")).toHaveTextContent("Webhook");
    expect(screen.getByTitle("schedule")).toHaveTextContent("Programado");
    expect(screen.getByTestId("runs-filter-count")).toHaveTextContent("Mostrando 3 de 3 ejecuciones.");
  });

  it("filters by status and updates the filtered count", async () => {
    workspace.runs = [succeededWebUi, failedWebhook, runningSchedule];
    renderRuns();
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "failed");
    const rows = screen.getAllByTestId("run-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("bbbb2222")).toBeInTheDocument();
    expect(screen.getByTestId("runs-filter-count")).toHaveTextContent("Mostrando 1 de 3 ejecuciones.");
  });

  it("filters by origin label, grouping schedule and scheduler", async () => {
    const scheduled = makeRun({ id: "dddd4444-sched", entryPoint: "scheduler" });
    workspace.runs = [succeededWebUi, failedWebhook, scheduled];
    renderRuns();
    await userEvent.selectOptions(screen.getByLabelText("Origen"), "Programado");
    const rows = screen.getAllByTestId("run-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("dddd4444")).toBeInTheDocument();
  });

  it("filters by an inclusive date range", async () => {
    workspace.runs = [succeededWebUi, failedWebhook, runningSchedule];
    renderRuns();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-11" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-11" } });
    const rows = screen.getAllByTestId("run-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("bbbb2222")).toBeInTheDocument();
  });

  it("treats from and to as inclusive UTC day bounds", () => {
    const run = makeRun({ startedAt: "2026-11-19T23:59:59.999Z" });
    expect(filterRuns([run], { status: "", origin: "", from: "2026-11-19", to: "2026-11-19" })).toHaveLength(1);
    expect(filterRuns([run], { status: "", origin: "", from: "2026-11-20", to: "" })).toHaveLength(0);
    expect(filterRuns([run], { status: "", origin: "", from: "", to: "2026-11-18" })).toHaveLength(0);
  });

  it("indents each child run directly under its parent", () => {
    const parent = makeRun({ id: "padre123-parent", startedAt: "2026-11-10T08:00:00.000Z" });
    const child = makeRun({
      id: "hija1234-child",
      parentRunId: "padre123-parent",
      startedAt: "2026-11-10T08:00:10.000Z",
    });
    workspace.runs = [child, parent];
    renderRuns();
    const rows = screen.getAllByTestId("run-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("padre123")).toBeInTheDocument();
    expect(rows[0]).not.toHaveAttribute("data-child");
    expect(rows[1]).toHaveAttribute("data-child", "true");
    expect(within(rows[1]).getByText("hija1234")).toBeInTheDocument();
    expect(within(rows[1]).getByText(/Ejecución hija de padre123/)).toBeInTheDocument();
    expect(rows[1].parentElement).toHaveClass("ml-6");
    expect(rows[0].parentElement).not.toHaveClass("ml-6");
  });

  it("groups and orders runs from the server's recency order", () => {
    const parent = makeRun({ id: "parentaaaa-parent" });
    const child = makeRun({ id: "childbbbbb-child", parentRunId: "parentaaaa-parent", status: "failed" });
    expect(groupRunsByParent([child])).toEqual([{ run: child, child: false }]);
    expect(groupRunsByParent([child, parent])).toEqual([
      { run: parent, child: false },
      { run: child, child: true },
    ]);
  });

  it("shows the empty state when no run matches the filters and recovers", async () => {
    workspace.runs = [succeededWebUi];
    renderRuns();
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "failed");
    expect(screen.queryAllByTestId("run-row")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Ninguna ejecución coincide" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar JSON" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    await userEvent.click(within(emptySection()).getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getAllByTestId("run-row")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Ninguna ejecución coincide" })).not.toBeInTheDocument();
  });

  it("shows the launch action when the project has no runs", () => {
    workspace.runs = [];
    renderRuns();
    expect(screen.getByRole("heading", { name: "Sin ejecuciones todavía" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar flujo" }));
    expect(workspace.setLaunchOpen).toHaveBeenCalledWith(true);
  });

  it("opens the detail modal and re-executes from a run row", () => {
    workspace.runs = [succeededWebUi];
    renderRuns();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle" }));
    expect(workspace.setDetailRun).toHaveBeenCalledWith(expect.objectContaining({ id: "aaaa1111-succeeded" }));
    fireEvent.click(screen.getByRole("button", { name: "Re-ejecutar" }));
    expect(workspace.replayRun).toHaveBeenCalledWith("aaaa1111-succeeded");
  });

  it("warns when the loaded list hits the 100-run cap", () => {
    workspace.runs = Array.from({ length: RUNS_LIST_LIMIT }, (_, index) =>
      makeRun({ id: `run-${String(index).padStart(4, "0")}-cap` }),
    );
    renderRuns();
    expect(screen.getByTestId("runs-truncation-note")).toHaveTextContent(/100 ejecuciones más recientes/);
    expect(screen.getByTestId("runs-filter-count")).toHaveTextContent(
      `Mostrando ${RUNS_LIST_LIMIT} de ${RUNS_LIST_LIMIT} ejecuciones.`,
    );
  });

  it("exports only the allowlisted run and step fields as JSON", () => {
    const run = makeRun({ id: "run-exported", steps: [step], error: "error-sensible", output: { dato: "salida-sensible" } });
    const exported = exportableRun(run);
    expect(Object.keys(exported)).toEqual([...RUN_EXPORT_FIELDS, "steps"]);
    expect(Object.keys(exported.steps[0])).toEqual(["nodeId", "status", "durationMs", "startedAt", "finishedAt"]);
    const json = runsToJson([run]);
    expect(json).not.toContain("entrada-sensible");
    expect(json).not.toContain("salida-sensible");
    expect(json).not.toContain("log-sensible");
    expect(json).not.toContain("error-sensible");
    expect(json).toContain("nodo-a");
  });

  it("exports CSV with allowlisted headers and escaped cells", () => {
    const run = makeRun({ id: 'run,con"coma', steps: [step], error: "error-sensible" });
    const csv = runsToCsv([run]);
    const [header, ...body] = csv.split("\n");
    expect(header).toBe("id,projectSlug,workflowId,status,entryPoint,launchedBy,startedAt,finishedAt,steps");
    expect(header).not.toMatch(/input|output|logs|error/);
    expect(body).toHaveLength(1);
    expect(body[0].startsWith('"run,con""coma",demo,wf-1,')).toBe(true);
    expect(body[0]).not.toContain("entrada-sensible");
    expect(body[0]).not.toContain("log-sensible");
    expect(body[0]).not.toContain("error-sensible");
    expect(body[0]).toContain("nodo-a");
  });

  it("downloads the filtered set as JSON with allowlisted fields through the browser", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:runs");
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    try {
      workspace.runs = [
        succeededWebUi,
        makeRun({ id: "zzzz9999-secret", steps: [step], error: "error-sensible", output: { dato: "salida-sensible" } }),
      ];
      renderRuns();
      await userEvent.selectOptions(screen.getByLabelText("Estado"), "succeeded");
      await userEvent.click(screen.getByRole("button", { name: "Exportar JSON" }));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0];
      const text = await readBlob(blob);
      const payload = JSON.parse(text) as Array<Record<string, unknown>>;
      expect(payload).toHaveLength(2);
      expect(Object.keys(payload[0]).sort()).toEqual([...RUN_EXPORT_FIELDS, "steps"].sort());
      expect(text).not.toContain("entrada-sensible");
      expect(text).not.toContain("salida-sensible");
      expect(text).not.toContain("log-sensible");
      expect(text).not.toContain("error-sensible");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:runs");
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it("labels known entry points in Spanish and passes unknown ones through", () => {
    expect(runOriginLabel("web_ui")).toBe("Interfaz web");
    expect(runOriginLabel("global_orchestrator")).toBe("Orquestador global");
    expect(runOriginLabel("scheduler")).toBe("Programado");
    expect(runOriginLabel("schedule")).toBe("Programado");
    expect(runOriginLabel("external_chat")).toBe("Chat externo");
    expect(runOriginLabel("replay")).toBe("Re-ejecución");
    expect(runOriginLabel("canal-desconocido")).toBe("canal-desconocido");
  });
});

function readBlob(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
