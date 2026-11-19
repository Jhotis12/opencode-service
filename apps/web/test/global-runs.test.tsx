import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { RunRecord, StepRun } from "../src/api.ts";
import { runOriginLabel } from "../src/api.ts";
import {
  RUN_EXPORT_FIELDS,
  exportableRun,
  formatRunDuration,
  groupRunsByParent,
  runsToCsv,
  runsToJson,
} from "../src/components/RunsTable.tsx";
import { GlobalRunsPage } from "../src/pages/GlobalRunsPage.tsx";
import { renderWithProviders } from "./render.tsx";

const apiMock = vi.hoisted(() => ({
  listGlobalRuns: vi.fn(),
  getGlobalRun: vi.fn(),
  listProjects: vi.fn(),
  listApprovals: vi.fn(),
  listDeliveries: vi.fn(),
  replayRun: vi.fn(),
}));

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return { ...actual, api: apiMock };
});

const step: StepRun = {
  id: "step-1",
  nodeId: "nodo-a",
  status: "succeeded",
  input: { dato: "entrada-sensible" },
  output: { dato: "salida-sensible" },
  logs: [{ message: "log-sensible", fields: { clave: "valor" } }],
  durationMs: 1234,
  startedAt: "2026-11-10T10:00:01.000Z",
  finishedAt: "2026-11-10T10:00:02.234Z",
};

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "aaaa1111-succeeded",
    projectSlug: "alpha",
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

const succeededWebUi = makeRun();
const failedWebhook = makeRun({
  id: "bbbb2222-failed",
  projectSlug: "beta",
  status: "failed",
  entryPoint: "webhook",
  error: "falló la petición",
  startedAt: "2026-11-11T11:30:00.000Z",
  finishedAt: "2026-11-11T11:30:05.000Z",
});
const runningSchedule = makeRun({
  id: "cccc3333-running",
  status: "running",
  entryPoint: "schedule",
  startedAt: "2026-11-12T09:15:00.000Z",
  finishedAt: undefined,
});

function pageOf(runs: RunRecord[], total = runs.length, offset = 0) {
  return { data: runs, total, limit: 50, offset };
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderPage(initialEntries: string[] = ["/runs"]) {
  return renderWithProviders(
    <MemoryRouter initialEntries={initialEntries}>
      <GlobalRunsPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function lastCall() {
  const calls = apiMock.listGlobalRuns.mock.calls;
  return calls[calls.length - 1]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.resetAllMocks();
  apiMock.listProjects.mockResolvedValue({ data: [{ slug: "alpha" }, { slug: "beta" }] });
  apiMock.listApprovals.mockResolvedValue({ data: [] });
  apiMock.listDeliveries.mockResolvedValue({ data: [] });
});

describe("GlobalRunsPage", () => {
  it("requests the first page with the page size and renders rows, counts and deep links", async () => {
    apiMock.listGlobalRuns.mockResolvedValue(pageOf([succeededWebUi, failedWebhook, runningSchedule]));

    renderPage();

    expect(await screen.findByText("aaaa1111")).toBeInTheDocument();
    expect(lastCall()).toMatchObject({ limit: 50, offset: 0 });
    expect(lastCall().status).toBeUndefined();
    expect(screen.getAllByTestId("run-row")).toHaveLength(3);
    expect(screen.getByTestId("global-runs-count")).toHaveTextContent("Mostrando 1–3 de 3 ejecuciones");
    expect(screen.getByTitle("webhook")).toHaveTextContent("Webhook");
    expect(screen.getByTitle("schedule")).toHaveTextContent("Programado");
    const rows = screen.getAllByTestId("run-row");
    expect(within(rows[0]!).getByRole("link", { name: "alpha" })).toHaveAttribute(
      "href",
      "/projects/alpha/runs?run=aaaa1111-succeeded",
    );
    expect(within(rows[1]!).getByRole("link", { name: "beta" })).toHaveAttribute(
      "href",
      "/projects/beta/runs?run=bbbb2222-failed",
    );
    expect(within(rows[0]!).getByText("5 s")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("En curso")).toBeInTheDocument();
  });

  it("sends the status filter to the API and keeps it in the URL", async () => {
    apiMock.listGlobalRuns.mockResolvedValue(pageOf([succeededWebUi, failedWebhook, runningSchedule]));
    renderPage();
    await screen.findByText("aaaa1111");

    apiMock.listGlobalRuns.mockResolvedValue(pageOf([failedWebhook]));
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "failed");

    await waitFor(() => expect(lastCall()).toMatchObject({ status: "failed", limit: 50, offset: 0 }));
    expect(screen.getByTestId("location")).toHaveTextContent("/runs?status=failed");
    expect(screen.getAllByTestId("run-row")).toHaveLength(1);
    expect(screen.getByTestId("global-runs-count")).toHaveTextContent("Mostrando 1–1 de 1 ejecuciones");
  });

  it("keeps the filters usable and offers a reset when no run matches", async () => {
    apiMock.listGlobalRuns.mockResolvedValue(pageOf([]));
    renderPage(["/runs?status=failed"]);

    const empty = await screen.findByRole("heading", { name: "Ninguna ejecución coincide" });
    expect(screen.getByLabelText("Estado")).toHaveValue("failed");

    await userEvent.click(within(empty.closest("section")!).getByRole("button", { name: "Limpiar filtros" }));

    await waitFor(() => expect(lastCall().status).toBeUndefined());
    expect(await screen.findByRole("heading", { name: "Sin ejecuciones todavía" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/runs$/);
  });

  it("indents each child run directly under its parent", async () => {
    const parent = makeRun({ id: "padre123-parent", startedAt: "2026-11-10T08:00:00.000Z" });
    const child = makeRun({
      id: "hija1234-child",
      parentRunId: "padre123-parent",
      startedAt: "2026-11-10T08:00:10.000Z",
    });
    apiMock.listGlobalRuns.mockResolvedValue(pageOf([child, parent]));

    renderPage();

    const rows = await screen.findAllByTestId("run-row");
    expect(within(rows[0]!).getByText("padre123")).toBeInTheDocument();
    expect(rows[0]).not.toHaveAttribute("data-child");
    expect(rows[1]).toHaveAttribute("data-child", "true");
    expect(within(rows[1]!).getByText("hija1234")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Hija")).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/de padre123/)).toBeInTheDocument();
  });

  it("pages through results 50 at a time and requests the next offset", async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => makeRun({ id: `first-${index}` }));
    const secondPage = Array.from({ length: 20 }, (_, index) => makeRun({ id: `second-${index}` }));
    apiMock.listGlobalRuns.mockImplementation((filters: { offset: number }) =>
      Promise.resolve(pageOf(filters.offset === 0 ? firstPage : secondPage, 120, filters.offset)),
    );

    renderPage();

    expect(await screen.findByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getByTestId("global-runs-count")).toHaveTextContent("Mostrando 1–50 de 120 ejecuciones");

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => expect(lastCall()).toMatchObject({ offset: 50 }));
    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByTestId("global-runs-count")).toHaveTextContent("Mostrando 51–70 de 120 ejecuciones");
    expect(screen.getByTestId("location")).toHaveTextContent("page=2");
  });

  it("shows the request error with a retry action instead of an empty state", async () => {
    apiMock.listGlobalRuns
      .mockRejectedValueOnce(new Error("failed to fetch"))
      .mockResolvedValueOnce(pageOf([succeededWebUi]));

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo conectar con el servidor");
    expect(screen.queryByRole("heading", { name: "Sin ejecuciones todavía" })).not.toBeInTheDocument();
    expect(screen.getByTestId("global-runs-count")).toHaveTextContent("No se pudieron cargar las ejecuciones");
    expect(screen.getByTestId("global-runs-count")).not.toHaveTextContent("0 ejecuciones");

    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("aaaa1111")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens the detail modal from a row and loads it from the control endpoint", async () => {
    const detail = makeRun({ steps: [step, { ...step, id: "step-2", nodeId: "nodo-b" }] });
    apiMock.listGlobalRuns.mockResolvedValue(pageOf([succeededWebUi]));
    apiMock.getGlobalRun.mockResolvedValue(detail);

    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));

    expect(await screen.findByRole("heading", { name: "Ejecución aaaa1111" })).toBeInTheDocument();
    expect(apiMock.getGlobalRun).toHaveBeenCalledWith("aaaa1111-succeeded");
    expect(screen.getByRole("heading", { name: "Pasos (2)" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("run=aaaa1111-succeeded");
  });

  it("opens a deep-linked run detail without the row being on the current page", async () => {
    apiMock.listGlobalRuns.mockResolvedValue(pageOf([]));
    apiMock.getGlobalRun.mockResolvedValue(makeRun({ steps: [step] }));

    renderPage(["/runs?run=aaaa1111-succeeded"]);

    expect(await screen.findByRole("heading", { name: "Pasos (1)" })).toBeInTheDocument();
    expect(apiMock.getGlobalRun).toHaveBeenCalledWith("aaaa1111-succeeded");
  });

  it("exports the filtered set as JSON with allowlisted fields and warns when it hits the cap", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:runs");
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    try {
      const sensitive = makeRun({
        id: "zzzz9999-secret",
        steps: [step],
        error: "error-sensible",
        output: { dato: "salida-sensible" },
      });
      const exportRuns = Array.from({ length: 200 }, (_, index) =>
        index === 0 ? sensitive : makeRun({ id: `export-${index}` }),
      );
      apiMock.listGlobalRuns.mockImplementation((filters: { limit?: number }) =>
        filters.limit === 200
          ? Promise.resolve({ data: exportRuns, total: 201, limit: 200, offset: 0 })
          : Promise.resolve(pageOf([succeededWebUi], 201)),
      );

      renderPage(["/runs?status=failed"]);

      await userEvent.click(await screen.findByRole("button", { name: "Exportar JSON" }));

      await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
      expect(lastCall()).toMatchObject({ status: "failed", limit: 200, offset: 0 });
      const blob = createObjectURL.mock.calls[0]![0];
      const text = await readBlob(blob);
      const payload = JSON.parse(text) as Array<Record<string, unknown>>;
      expect(payload).toHaveLength(200);
      expect(Object.keys(payload[0]!)).toEqual([...RUN_EXPORT_FIELDS, "steps"]);
      expect(text).not.toContain("entrada-sensible");
      expect(text).not.toContain("salida-sensible");
      expect(text).not.toContain("log-sensible");
      expect(text).not.toContain("error-sensible");
      expect(screen.getByTestId("global-runs-export-note")).toHaveTextContent(
        "La exportación se limitó a 200 de 201 ejecuciones",
      );
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:runs");
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});

describe("run view primitives", () => {
  it("exports CSV with allowlisted headers and escaped cells", () => {
    const run = makeRun({ id: 'run,con"coma', steps: [step], error: "error-sensible" });
    const [header, ...body] = runsToCsv([run]).split("\n");

    expect(header).toBe("id,projectSlug,workflowId,status,entryPoint,launchedBy,startedAt,finishedAt,steps");
    expect(header).not.toMatch(/input|output|logs|error/);
    expect(body).toHaveLength(1);
    expect(body[0]!.startsWith('"run,con""coma",alpha,wf-1,')).toBe(true);
    expect(body[0]).not.toContain("entrada-sensible");
    expect(body[0]).not.toContain("log-sensible");
    expect(body[0]).toContain("nodo-a");
  });

  it("exports only the allowlisted run and step fields as JSON", () => {
    const run = makeRun({ steps: [step], error: "error-sensible", output: { dato: "salida-sensible" } });
    const exported = exportableRun(run);

    expect(Object.keys(exported)).toEqual([...RUN_EXPORT_FIELDS, "steps"]);
    expect(Object.keys(exported.steps[0]!)).toEqual(["nodeId", "status", "durationMs", "startedAt", "finishedAt"]);
    expect(runsToJson([run])).not.toContain("salida-sensible");
  });

  it("groups children under present parents and formats durations", () => {
    const parent = makeRun({ id: "parentaaaa-parent" });
    const child = makeRun({ id: "childbbbbb-child", parentRunId: "parentaaaa-parent" });
    const orphan = makeRun({ id: "orphancccc-child", parentRunId: "missing-parent" });

    expect(groupRunsByParent([child])).toEqual([{ run: child, child: false }]);
    expect(groupRunsByParent([child, parent])).toEqual([
      { run: parent, child: false },
      { run: child, child: true },
    ]);
    expect(groupRunsByParent([orphan])).toEqual([{ run: orphan, child: false }]);
    expect(formatRunDuration(makeRun({ startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:00.250Z" }))).toBe(
      "250 ms",
    );
    expect(formatRunDuration(makeRun({ startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:01:30.000Z" }))).toBe(
      "1 min 30 s",
    );
    expect(formatRunDuration(makeRun({ startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T04:04:07.000Z" }))).toBe(
      "4 h 4 min",
    );
    expect(formatRunDuration(makeRun({ status: "running", finishedAt: undefined }))).toBe("En curso");
    expect(formatRunDuration(makeRun({ status: "paused", finishedAt: undefined }))).toBe("En pausa");
    expect(formatRunDuration(makeRun({ status: "cancelled", finishedAt: undefined }))).toBe("—");
  });

  it("labels known origins in Spanish and passes unknown ones through", () => {
    expect(runOriginLabel("web_ui")).toBe("Interfaz web");
    expect(runOriginLabel("global_orchestrator")).toBe("Orquestador global");
    expect(runOriginLabel("scheduler")).toBe("Programado");
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
