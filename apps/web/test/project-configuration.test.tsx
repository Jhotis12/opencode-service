import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "./render.tsx";

const now = new Date().toISOString();
const integration = {
  id: "i1",
  scope: "project" as const,
  projectSlug: "ventas",
  kind: "telegram" as const,
  name: "Bot de ventas",
  slug: "bot-ventas",
  config: { routing: { mode: "hybrid", allowlist: [], public: false } },
  secretRefs: { token: "alias" },
  capabilities: ["inbound_message", "outbound_message"],
  status: "connected",
  createdAt: now,
  updatedAt: now,
};
const destination = {
  id: "d1",
  projectSlug: "ventas",
  kind: "telegram_chat" as const,
  label: "Admin",
  value: "123456",
  createdAt: now,
  updatedAt: now,
};
const secret = { alias: "api_key", kind: "generic", createdAt: now };

const apiMock = vi.hoisted(() => ({
  getProjectSettings: vi.fn(),
  listModels: vi.fn(),
  listIntegrations: vi.fn(),
  listDestinations: vi.fn(),
  createDestination: vi.fn(),
  updateDestination: vi.fn(),
  deleteDestination: vi.fn(),
  updateProjectSettings: vi.fn(),
  saveProjectSecret: vi.fn(),
  listProjectSecrets: vi.fn(),
  deleteProjectSecret: vi.fn(),
  listRuns: vi.fn(),
  listApprovals: vi.fn(),
  decideApproval: vi.fn(),
  listSchedules: vi.fn(),
}));

vi.mock("../src/api.ts", () => ({ api: apiMock }));

import { ProjectConfigurationPanel } from "../src/components/ProjectConfigurationPanel.tsx";

function mockQueries() {
  apiMock.getProjectSettings.mockResolvedValue({
    project: {
      id: "p1",
      slug: "ventas",
      name: "Ventas",
      description: "",
      primaryAgent: "principal/agente",
      createdAt: now,
      updatedAt: now,
    },
    integrations: [integration],
    notebooks: [],
    readiness: [
      { id: "primary-agent", label: "Agente principal configurado", ready: true },
      { id: "channel", label: "Canal conectado", ready: false },
    ],
  });
  apiMock.listModels.mockResolvedValue({ data: [] });
  apiMock.listIntegrations.mockResolvedValue({ data: [integration] });
  apiMock.listDestinations.mockResolvedValue({ data: [destination] });
  apiMock.listProjectSecrets.mockResolvedValue({ data: [] });
  apiMock.listRuns.mockResolvedValue({ data: [] });
  apiMock.listApprovals.mockResolvedValue({ data: [] });
  apiMock.listSchedules.mockResolvedValue({ data: [] });
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
}

type PanelProps = { navigationBlocked?: boolean; onNavigateBlocked?(target: string): void };

function renderPanel(section?: string, props: PanelProps = {}) {
  const initial = `/projects/ventas/settings${section ? `?section=${section}` : ""}`;
  return renderWithProviders(
    <MemoryRouter initialEntries={[initial]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/projects/:slug/settings"
          element={<ProjectConfigurationPanel projectSlug="ventas" {...props} />}
        />
        <Route path="/projects/:slug/integrations" element={<p>Página de integraciones</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectConfigurationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the general section by default with the six addressable sections", async () => {
    mockQueries();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    for (const label of ["General", "Aprobaciones", "Programaciones", "Destinos", "Secretos", "Preparación"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("tab", { name: "Conexiones" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Canales" })).not.toBeInTheDocument();

    const integrations = screen.getByRole("link", { name: "Integraciones" });
    expect(integrations).toHaveAttribute("href", "/projects/ventas/integrations");
  });

  it("deep-links to each section by URL and renders it alone", async () => {
    mockQueries();
    const markers: Array<[string, string]> = [
      ["general", "Identidad y modelo"],
      ["approvals", "Sin aprobaciones pendientes"],
      ["schedules", "Sin programaciones"],
      ["destinations", "Crear destino"],
      ["secrets", "Secretos del proyecto"],
      ["readiness", "Preparación del proyecto"],
    ];
    const labels: Record<string, string> = {
      general: "General",
      approvals: "Aprobaciones",
      schedules: "Programaciones",
      destinations: "Destinos",
      secrets: "Secretos",
      readiness: "Preparación",
    };
    for (const [section, marker] of markers) {
      const { unmount } = renderPanel(section);
      expect(await screen.findByText(marker)).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: labels[section] })).toHaveAttribute("aria-selected", "true");
      for (const [, otherMarker] of markers) {
        if (otherMarker !== marker) {
          expect(screen.queryByText(otherMarker)).not.toBeInTheDocument();
        }
      }
      unmount();
    }
  });

  it("updates the URL when a section tab is selected", async () => {
    mockQueries();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Destinos" }));
    expect(await screen.findByRole("button", { name: "Crear destino" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/projects/ventas/settings?section=destinations");
  });

  it("routes the integrations pointer through the navigation guard", async () => {
    mockQueries();
    const onNavigateBlocked = vi.fn();
    const blocked = renderPanel(undefined, { navigationBlocked: true, onNavigateBlocked });
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Integraciones" }));
    expect(onNavigateBlocked).toHaveBeenCalledWith("/projects/ventas/integrations");
    expect(screen.getByTestId("location")).toHaveTextContent("/projects/ventas/settings");
    blocked.unmount();

    const plain = renderPanel();
    expect(await plain.findByText("Identidad y modelo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Integraciones" }));
    expect(await screen.findByText("Página de integraciones")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/projects/ventas/integrations");
  });

  it("creates a labeled destination without changing existing references", async () => {
    mockQueries();
    renderPanel("destinations");
    await userEvent.type(await screen.findByLabelText("Etiqueta"), "Soporte");
    await userEvent.type(screen.getByLabelText("Valor"), "456");
    await userEvent.click(screen.getByRole("button", { name: "Crear destino" }));
    await waitFor(() =>
      expect(apiMock.createDestination).toHaveBeenCalledWith("ventas", {
        kind: "telegram_chat",
        label: "Soporte",
        value: "456",
      }),
    );
    expect(apiMock.updateDestination).not.toHaveBeenCalled();
  });

  it("blocks an invalid destination and shows inline validation without a request", async () => {
    mockQueries();
    renderPanel("destinations");
    await screen.findByRole("button", { name: "Crear destino" });

    await userEvent.click(screen.getByRole("button", { name: "Crear destino" }));
    expect(await screen.findByText("La etiqueta es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText("El valor es obligatorio.")).toBeInTheDocument();
    expect(screen.getByLabelText("Etiqueta")).toHaveAttribute("aria-invalid", "true");
    expect(apiMock.createDestination).not.toHaveBeenCalled();
  });

  it("confirms before deleting a destination and keeps it after cancelling", async () => {
    mockQueries();
    apiMock.deleteDestination.mockResolvedValue({ ok: true });
    renderPanel("destinations");
    expect(await screen.findByText("Admin")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Borrar el destino Admin" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar destino" });
    expect(within(dialog).getByText("Admin")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Eliminar destino" })).not.toBeInTheDocument());
    expect(apiMock.deleteDestination).not.toHaveBeenCalled();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("saves a secret and clears the form", async () => {
    mockQueries();
    apiMock.saveProjectSecret.mockResolvedValue({ ok: true });
    renderPanel("secrets");
    expect(await screen.findByText("Secretos del proyecto")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Alias"), "openai_key");
    await userEvent.type(screen.getByLabelText("Valor"), "secret-value");
    await userEvent.click(screen.getByRole("button", { name: "Guardar secreto" }));

    await waitFor(() => expect(apiMock.saveProjectSecret).toHaveBeenCalledWith("ventas", "openai_key", "secret-value"));
    await waitFor(() => expect(screen.getByLabelText("Alias")).toHaveValue(""));
    expect(screen.getByLabelText("Valor")).toHaveValue("");
  });

  it("blocks an invalid secret alias and shows inline validation without a request", async () => {
    mockQueries();
    renderPanel("secrets");
    expect(await screen.findByText("Secretos del proyecto")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Alias"), "1 malo");
    await userEvent.type(screen.getByLabelText("Valor"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Guardar secreto" }));

    expect(
      await screen.findByText("El alias debe empezar por una letra y usar solo letras, números, :, _ o -."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Alias")).toHaveAttribute("aria-invalid", "true");
    expect(apiMock.saveProjectSecret).not.toHaveBeenCalled();
  });

  it("confirms before deleting a secret and keeps it after cancelling", async () => {
    mockQueries();
    apiMock.listProjectSecrets.mockResolvedValue({ data: [secret] });
    renderPanel("secrets");
    expect(await screen.findByText("api_key")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Borrar el secreto api_key" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar secreto" });
    expect(within(dialog).getByText(/api_key/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Eliminar secreto" })).not.toBeInTheDocument());
    expect(apiMock.deleteProjectSecret).not.toHaveBeenCalled();
    expect(screen.getByText("api_key")).toBeInTheDocument();
  });

  it("deletes a secret through the project vault after confirming", async () => {
    mockQueries();
    apiMock.listProjectSecrets.mockResolvedValueOnce({ data: [secret] }).mockResolvedValue({ data: [] });
    apiMock.deleteProjectSecret.mockResolvedValue({ ok: true });
    renderPanel("secrets");
    expect(await screen.findByText("api_key")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Borrar el secreto api_key" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(apiMock.deleteProjectSecret).toHaveBeenCalledWith("ventas", "api_key"));
    expect(await screen.findByText("Secreto eliminado")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("api_key")).not.toBeInTheDocument());
  });

  it("blocks an empty project name and shows inline validation without a request", async () => {
    mockQueries();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Nombre"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    expect(await screen.findByText("El nombre es obligatorio.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("aria-invalid", "true");
    expect(apiMock.updateProjectSettings).not.toHaveBeenCalled();
  });

  it("lists pending approvals from paused runs and resolves them", async () => {
    mockQueries();
    apiMock.listRuns.mockResolvedValue({
      data: [
        {
          id: "run-1",
          projectSlug: "ventas",
          workflowId: "wf",
          status: "paused",
          entryPoint: "web_ui",
          startedAt: now,
          steps: [],
        },
      ],
    });
    apiMock.listApprovals.mockResolvedValue({
      data: [{ id: "ap-1", runId: "run-1", nodeId: "review", status: "pending", createdAt: now }],
    });
    apiMock.decideApproval.mockResolvedValue({});
    renderPanel("approvals");

    expect(await screen.findByText("Nodo review")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aprobar" }));

    await waitFor(() => expect(apiMock.decideApproval).toHaveBeenCalledWith("ventas", "run-1", "review", "approve"));
  });

  it("lists schedule states from the workflow schedule endpoint", async () => {
    mockQueries();
    apiMock.listSchedules.mockResolvedValue({
      data: [
        {
          nodeId: "cron",
          workflowId: "wf",
          timezone: "UTC",
          enabled: true,
          overlapPolicy: "skip",
          catchUp: false,
          catchUpWindowMinutes: 60,
          nextWindowAt: now,
        },
      ],
    });
    renderPanel("schedules");

    expect(await screen.findByText("Nodo cron")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText(/Solapamiento: omitir/)).toBeInTheDocument();
  });

  it("offers destinations in the approval recipient picker", async () => {
    mockQueries();
    renderPanel();
    await screen.findByText("Identidad y modelo");
    const input = screen.getByLabelText("Destinatario de aprobación");
    expect(input).toHaveAttribute("list", "project-approval-destinations");
    expect(document.querySelector("#project-approval-destinations option")?.getAttribute("value")).toBe("d1");
  });
});
