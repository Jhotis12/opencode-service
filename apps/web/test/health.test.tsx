import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { HealthPayload } from "../src/api.ts";
import { HealthPage } from "../src/pages/HealthPage.tsx";
import { renderWithProviders } from "./render.tsx";

const health: HealthPayload = {
  status: "degraded",
  uptimeSeconds: 7_800,
  generatedAt: "2026-01-02T03:04:05.000Z",
  services: [
    { name: "OpenCode V2", status: "ok", detail: "OpenCode 2.2.5", latencyMs: 3 },
    { name: "Database", status: "down", detail: "SQLite no responde", latencyMs: 1 },
  ],
  metrics: { requests: 12, errors: 1, errorRate: 0.08, p50Ms: 10, p95Ms: 40, p99Ms: 80 },
  chat: { active: 2, oldestActiveAgeMs: 0, recovered24h: 3, failed24h: 1 },
  recentErrors: [
    {
      id: "e1",
      entryPoint: "web_ui",
      level: "fatal",
      message: "Fallo de base de datos",
      createdAt: "2026-01-02T03:03:04.000Z",
    },
  ],
};

function renderHealth(loadHealth: () => Promise<HealthPayload>) {
  return renderWithProviders(
    <MemoryRouter>
      <HealthPage loadHealth={loadHealth} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("HealthPage", () => {
  it("renders operational sections with severity chips, timestamps and drill-down links", async () => {
    renderHealth(async () => health);

    expect(await screen.findByTestId("health-status")).toHaveTextContent("Degradado");
    expect(screen.getByRole("heading", { name: "Estado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rendimiento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Errores recientes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Severidad: Crítico")).toHaveTextContent("Crítico");
    expect(screen.getByLabelText("Estado: Caído")).toHaveTextContent("Caído");

    const timestamps = screen.getAllByRole("time");
    expect(timestamps.map((item) => item.getAttribute("datetime"))).toEqual([
      health.generatedAt,
      health.recentErrors[0]?.createdAt,
    ]);
    expect(screen.getByRole("link", { name: "Ver ejecuciones" })).toHaveAttribute("href", "/runs");
    expect(screen.getByRole("link", { name: "Sentry/GlitchTip" })).toHaveAttribute("href", "/settings");
  });

  it("pauses and resumes the five-second refresh", async () => {
    vi.useFakeTimers();
    let resolveInitial: ((value: HealthPayload) => void) | undefined;
    const loadHealth = vi.fn()
      .mockImplementationOnce(() => new Promise<HealthPayload>((resolve) => {
        resolveInitial = resolve;
      }))
      .mockResolvedValue(health);
    renderHealth(loadHealth);
    expect(loadHealth).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveInitial?.(health);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("health-status")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pausar actualización" }));
    expect(screen.getByRole("button", { name: "Reanudar actualización" })).toHaveAttribute("aria-pressed", "true");
    act(() => vi.advanceTimersByTime(15_000));
    expect(loadHealth).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Reanudar actualización" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(loadHealth).toHaveBeenCalledTimes(2);
  });

  it("explains a down platform and shows actionable empty states", async () => {
    renderHealth(async () => ({ ...health, status: "down", services: [], recentErrors: [] }));

    expect(await screen.findByTestId("health-status")).toHaveTextContent("Caído");
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("La plataforma está caída")).toBeInTheDocument();
    expect(within(alert).getByText(/Revisa qué servicio dejó de responder/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sin servicios informados" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sin errores recientes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar ejecuciones" })).toHaveAttribute("href", "/runs");
  });

  it("retries after an initial health request failure", async () => {
    const loadHealth = vi.fn()
      .mockRejectedValueOnce(new Error("sin conexión"))
      .mockResolvedValueOnce(health);
    renderHealth(loadHealth);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/sin conexión/)).toBeInTheDocument();
    expect(within(alert).getByText(/La API puede estar caída o inalcanzable/)).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar consulta" }));

    expect(await screen.findByTestId("health-status")).toHaveTextContent("Degradado");
    expect(loadHealth).toHaveBeenCalledTimes(2);
  });

  it("shows an immediate loading state while the first request is pending", () => {
    renderHealth(() => new Promise<HealthPayload>(() => undefined));

    expect(screen.getByRole("status")).toHaveTextContent("Consultando salud del sistema");
    expect(screen.getByRole("button", { name: "Actualizando…" })).toBeDisabled();
  });
});
