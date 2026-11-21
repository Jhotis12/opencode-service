import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { IntegrationRecord, WorkflowGraph } from "@platform/shared";
import { renderWithProviders, findToast, toastRegion } from "./render.tsx";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,stub") },
}));

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
  testIntegration: vi.fn(),
  connectIntegration: vi.fn(),
  disconnectIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  clearIntegrationWebhook: vi.fn(),
  integrationQr: vi.fn(),
  controlIntegrations: vi.fn(),
  testControlIntegration: vi.fn(),
  connectControlIntegration: vi.fn(),
  disconnectControlIntegration: vi.fn(),
  deleteControlIntegration: vi.fn(),
  clearControlIntegrationWebhook: vi.fn(),
  controlIntegrationQr: vi.fn(),
  createIntegration: vi.fn(),
  createControlIntegration: vi.fn(),
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

import { ControlChannelsPanel } from "../src/components/ControlChannelsPanel.tsx";
import { ProjectLayout } from "../src/pages/ProjectLayout.tsx";
import { ProjectIntegrationsPage } from "../src/pages/ProjectIntegrationsPage.tsx";
import { dismissAll } from "../src/components/Toast.tsx";

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

function makeIntegration(overrides: Partial<IntegrationRecord> & Pick<IntegrationRecord, "id" | "kind" | "name" | "slug" | "status">): IntegrationRecord {
  const now = new Date().toISOString();
  return {
    scope: "project",
    projectSlug: "demo",
    config: {},
    secretRefs: {},
    capabilities: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const fixtures: IntegrationRecord[] = [
  makeIntegration({ id: "tg-1", kind: "telegram", name: "Telegram de operaciones", slug: "telegram-ops", status: "connected", config: { botUsername: "ops_bot" } }),
  makeIntegration({ id: "wa-1", kind: "whatsapp", name: "WhatsApp alertas", slug: "whatsapp-alertas", status: "needs_config" }),
  makeIntegration({ id: "db-1", kind: "sqlite", name: "SQLite CRM", slug: "sqlite-crm", status: "connected" }),
  makeIntegration({ id: "http-1", kind: "http", name: "HTTP pagos", slug: "http-pagos", status: "error", lastError: "upstream 503" }),
];

const settings = {
  project: { id: "p1", slug: "demo", name: "Demo", description: "", createdAt: new Date().toISOString() },
  integrations: [],
  notebooks: [],
  readiness: [],
};

function setupApi() {
  apiMock.getWorkflow.mockResolvedValue(graph);
  apiMock.listRuns.mockResolvedValue({ data: [] });
  apiMock.listAgents.mockResolvedValue({ data: [] });
  apiMock.listModels.mockResolvedValue({ data: [] });
  apiMock.chatHistory.mockResolvedValue({ data: [] });
  apiMock.listIntegrations.mockResolvedValue({ data: fixtures });
  apiMock.listDestinations.mockResolvedValue({ data: [] });
  apiMock.listSchedules.mockResolvedValue({ data: [] });
  apiMock.getProjectSettings.mockResolvedValue(settings);
  apiMock.listWorkflowVersions.mockResolvedValue({ data: [] });
  apiMock.listNotebooks.mockResolvedValue({ data: [] });
  apiMock.listProjectSecrets.mockResolvedValue({ data: [] });
  apiMock.controlIntegrations.mockResolvedValue({ data: [] });
}

function visibleActions(card: HTMLElement): (string | null)[] {
  return within(card)
    .getAllByRole("button")
    .map((button) => (button.getAttribute("aria-label")?.startsWith("Más acciones de") ? "Más acciones" : button.textContent));
}

async function menuLabels(card: HTMLElement): Promise<(string | null)[]> {
  await userEvent.click(within(card).getByRole("button", { name: /^Más acciones de/ }));
  const menu = within(card).getByRole("menu");
  const labels = within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(within(card).queryByRole("menu")).toBeNull());
  return labels;
}

async function connectFromMenu(card: HTMLElement): Promise<void> {
  await userEvent.click(within(card).getByRole("button", { name: /^Más acciones de/ }));
  await userEvent.click(within(card).getByRole("menuitem", { name: "Conectar" }));
}

function renderPage() {
  // Outcomes are announced by sonner: the real host proves the copy lands in a toast.
  return renderWithProviders(
    <>
      <MemoryRouter initialEntries={["/projects/demo/integrations"]}>
        <Routes>
          <Route path="/projects/:slug" element={<ProjectLayout />}>
            <Route path="integrations" element={<ProjectIntegrationsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupApi();
});

afterEach(() => {
  act(() => dismissAll());
});

describe("ProjectIntegrationsPage", () => {
  it("groups integrations by kind in the canonical kind order", async () => {
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByTestId("integration-group-telegram")).toBeInTheDocument());
    const groups = Array.from(container.querySelectorAll<HTMLElement>('[data-testid^="integration-group-"]'));
    expect(groups.map((group) => group.dataset.testid)).toEqual([
      "integration-group-telegram",
      "integration-group-whatsapp",
      "integration-group-sqlite",
      "integration-group-http",
    ]);
    expect(within(groups[0]!).getByText("Telegram")).toBeInTheDocument();
    expect(within(groups[1]!).getByText("WhatsApp")).toBeInTheDocument();
    expect(within(groups[2]!).getByText("SQLite")).toBeInTheDocument();
    expect(within(groups[3]!).getByText("HTTP API")).toBeInTheDocument();
    expect(within(groups[0]!).getByTestId("integration-card-tg-1")).toBeInTheDocument();
    expect(within(groups[3]!).getByTestId("integration-card-http-1")).toBeInTheDocument();
  });

  it("localizes the test result instead of echoing the raw ok/error label", async () => {
    apiMock.testIntegration.mockResolvedValue({ ok: true });
    renderPage();
    const httpCard = await screen.findByTestId("integration-card-http-1");
    await userEvent.click(within(httpCard).getByRole("button", { name: "Probar" }));
    const toast = await findToast("HTTP pagos: Operativo");
    expect(toast).toBeVisible();
    expect(toastRegion()).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Cerrar notificación" })).toBeInTheDocument();
  });

  it("announces a needs_config connect as a warning, never as a success", async () => {
    apiMock.connectIntegration.mockResolvedValue({ ...fixtures[1], status: "needs_config" });
    renderPage();
    await connectFromMenu(await screen.findByTestId("integration-card-wa-1"));

    const toastElement = (await screen.findByText("Integración WhatsApp alertas: Falta configurar")).closest<HTMLElement>(
      "[data-sonner-toast]",
    );
    expect(toastElement).toHaveAttribute("data-type", "warning");
    expect(document.querySelector('[data-sonner-toast][data-type="success"]')).toBeNull();
  });

  it("still announces a genuine connect as a success", async () => {
    apiMock.connectIntegration.mockResolvedValue({ ...fixtures[1], status: "connected" });
    renderPage();
    await connectFromMenu(await screen.findByTestId("integration-card-wa-1"));

    const toastElement = (await screen.findByText("Integración WhatsApp alertas: Conectado")).closest<HTMLElement>(
      "[data-sonner-toast]",
    );
    expect(toastElement).toHaveAttribute("data-type", "success");
  });

  it("shows the localized status badge on each card", async () => {
    renderPage();
    const telegramCard = await screen.findByTestId("integration-card-tg-1");
    expect(within(telegramCard).getByText("Conectado")).toBeInTheDocument();
    expect(within(telegramCard).getByTitle("connected")).toBeInTheDocument();
    const whatsappCard = screen.getByTestId("integration-card-wa-1");
    expect(within(whatsappCard).getByText("Falta configurar")).toBeInTheDocument();
    const httpCard = screen.getByTestId("integration-card-http-1");
    expect(within(httpCard).getByText("Error")).toBeInTheDocument();
    expect(within(httpCard).getByText("upstream 503")).toBeInTheDocument();
  });

  it("keeps two visible actions per card and moves the rest to the overflow menu", async () => {
    renderPage();
    const telegramCard = await screen.findByTestId("integration-card-tg-1");
    const visibleButtons = within(telegramCard).getAllByRole("button");
    expect(visibleButtons.map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([
      "Probar",
      "Editar",
      "Más acciones de Telegram de operaciones",
    ]);
    expect(within(telegramCard).queryByRole("menuitem")).toBeNull();

    await userEvent.click(within(telegramCard).getByRole("button", { name: "Más acciones de Telegram de operaciones" }));
    const menu = within(telegramCard).getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Desconectar" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Limpiar webhook" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Borrar" })).toBeInTheDocument();

    const whatsappCard = screen.getByTestId("integration-card-wa-1");
    await userEvent.click(within(whatsappCard).getByRole("button", { name: "Más acciones de WhatsApp alertas" }));
    const whatsappMenu = within(whatsappCard).getByRole("menu");
    expect(within(whatsappMenu).getByRole("menuitem", { name: "Conectar" })).toBeInTheDocument();
    expect(within(whatsappMenu).getByRole("menuitem", { name: "Ver QR" })).toBeInTheDocument();
  });

  it("shows the WhatsApp QR inside a modal fetched from the QR endpoint", async () => {
    apiMock.integrationQr.mockResolvedValue({ qr: "qr-payload-wa" });
    renderPage();
    const whatsappCard = await screen.findByTestId("integration-card-wa-1");
    await userEvent.click(within(whatsappCard).getByRole("button", { name: "Más acciones de WhatsApp alertas" }));
    await userEvent.click(within(whatsappCard).getByRole("menuitem", { name: "Ver QR" }));

    expect(await screen.findByRole("dialog", { name: "QR de WhatsApp" })).toBeInTheDocument();
    expect(apiMock.integrationQr).toHaveBeenCalledWith("demo", "wa-1");
    const image = await screen.findByTestId("qr-image");
    expect(image).toHaveAttribute("alt", "Código QR de WhatsApp alertas");
    expect(image).toHaveAttribute("src", "data:image/png;base64,stub");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "QR de WhatsApp" })).toBeNull());
  });

  it("shows a Spanish error with retry in the QR modal when the QR endpoint fails", async () => {
    apiMock.integrationQr.mockRejectedValue(new Error("no QR available"));
    renderPage();
    const whatsappCard = await screen.findByTestId("integration-card-wa-1");
    await userEvent.click(within(whatsappCard).getByRole("button", { name: "Más acciones de WhatsApp alertas" }));
    await userEvent.click(within(whatsappCard).getByRole("menuitem", { name: "Ver QR" }));

    const dialog = await screen.findByRole("dialog", { name: "QR de WhatsApp" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/Todavía no hay un QR disponible/);
    expect(within(dialog).getByRole("alert")).not.toHaveTextContent("no QR available");
    expect(within(dialog).getByTitle("no QR available")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("opens the overflow menu with the keyboard and restores focus on Escape", async () => {
    renderPage();
    const telegramCard = await screen.findByTestId("integration-card-tg-1");
    const trigger = within(telegramCard).getByRole("button", { name: "Más acciones de Telegram de operaciones" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");

    const menu = within(telegramCard).getByRole("menu");
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: "Desconectar" })).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: "Limpiar webhook" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(within(telegramCard).queryByRole("menu")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("does not delete an integration when the confirmation is cancelled", async () => {
    renderPage();
    const telegramCard = await screen.findByTestId("integration-card-tg-1");
    await userEvent.click(within(telegramCard).getByRole("button", { name: "Más acciones de Telegram de operaciones" }));
    await userEvent.click(within(telegramCard).getByRole("menuitem", { name: "Borrar" }));

    expect(await screen.findByRole("dialog", { name: "Eliminar integración" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: "Eliminar integración" })).getByText(/Telegram de operaciones/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Eliminar integración" })).toBeNull());
    expect(apiMock.deleteIntegration).not.toHaveBeenCalled();
  });

  it("deletes the integration after confirming the dialog", async () => {
    apiMock.deleteIntegration.mockResolvedValue({ ok: true });
    renderPage();
    const telegramCard = await screen.findByTestId("integration-card-tg-1");
    await userEvent.click(within(telegramCard).getByRole("button", { name: "Más acciones de Telegram de operaciones" }));
    await userEvent.click(within(telegramCard).getByRole("menuitem", { name: "Borrar" }));

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(apiMock.deleteIntegration).toHaveBeenCalledWith("demo", "tg-1"));
    const removedToast = await screen.findByText("Integración eliminada");
    expect(removedToast.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("closes the confirmation and puts the delete failure in the toast", async () => {
    apiMock.deleteIntegration.mockRejectedValue(new Error("failed to fetch"));
    renderPage();
    const telegramCard = await screen.findByTestId("integration-card-tg-1");
    await userEvent.click(within(telegramCard).getByRole("button", { name: "Más acciones de Telegram de operaciones" }));
    await userEvent.click(within(telegramCard).getByRole("menuitem", { name: "Borrar" }));

    const dialog = await screen.findByRole("dialog", { name: "Eliminar integración" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    const toast = await screen.findByText(/No se pudo conectar con el servidor/);
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Eliminar integración" })).not.toBeInTheDocument(),
    );
    expect(apiMock.deleteIntegration).toHaveBeenCalledWith("demo", "tg-1");
  });

  it("does not disconnect an integration when the confirmation is cancelled", async () => {
    renderPage();
    const telegramCard = await screen.findByTestId("integration-card-tg-1");
    await userEvent.click(within(telegramCard).getByRole("button", { name: "Más acciones de Telegram de operaciones" }));
    await userEvent.click(within(telegramCard).getByRole("menuitem", { name: "Desconectar" }));

    expect(await screen.findByRole("dialog", { name: "Desconectar integración" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Desconectar integración" })).toBeNull());
    expect(apiMock.disconnectIntegration).not.toHaveBeenCalled();
  });

  it("disconnects the integration after confirming the dialog", async () => {
    apiMock.disconnectIntegration.mockResolvedValue({ ok: true });
    renderPage();
    const telegramCard = await screen.findByTestId("integration-card-tg-1");
    await userEvent.click(within(telegramCard).getByRole("button", { name: "Más acciones de Telegram de operaciones" }));
    await userEvent.click(within(telegramCard).getByRole("menuitem", { name: "Desconectar" }));

    await userEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(apiMock.disconnectIntegration).toHaveBeenCalledWith("demo", "tg-1"));
    const disconnectedToast = await screen.findByText("Integración desconectada");
    expect(disconnectedToast.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("closes the disconnect confirmation and toasts when it fails", async () => {
    apiMock.disconnectIntegration.mockRejectedValue(new Error("failed to fetch"));
    renderPage();
    const telegramCard = await screen.findByTestId("integration-card-tg-1");
    await userEvent.click(within(telegramCard).getByRole("button", { name: "Más acciones de Telegram de operaciones" }));
    await userEvent.click(within(telegramCard).getByRole("menuitem", { name: "Desconectar" }));

    const dialog = await screen.findByRole("dialog", { name: "Desconectar integración" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Desconectar" }));
    const toast = await screen.findByText(/No se pudo conectar con el servidor/);
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Desconectar integración" })).not.toBeInTheDocument(),
    );
  });

  it("announces a test failure as an actionable error toast", async () => {
    apiMock.testIntegration.mockResolvedValue({ ok: false, detail: "token inválido" });
    renderPage();
    const httpCard = await screen.findByTestId("integration-card-http-1");
    await userEvent.click(within(httpCard).getByRole("button", { name: "Probar" }));

    const toast = await findToast("HTTP pagos: Error · token inválido");
    expect(toast).toBeVisible();
    expect(toast).toHaveTextContent("Revisa la configuración de la integración y vuelve a probarla.");
    expect(screen.queryByText("HTTP pagos: Operativo")).not.toBeInTheDocument();
  });

  it("shows the empty state when the project has no integrations", async () => {
    apiMock.listIntegrations.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText("Sin integraciones todavía")).toBeInTheDocument();
    const createActions = screen.getAllByRole("button", { name: "Nueva integración" });
    expect(createActions).toHaveLength(2); // header action + empty-state CTA
    expect(screen.queryByTestId("integration-group-telegram")).toBeNull();

    await userEvent.click(createActions[0]!);
    expect(await screen.findByRole("heading", { name: "Nueva integración" })).toBeInTheDocument();
  });

  it("shows a scoped error with retry instead of the empty state when the list fails", async () => {
    apiMock.listIntegrations.mockRejectedValue(new Error("failed to fetch"));
    renderPage();
    const page = await screen.findByTestId("project-tab-content");
    const alert = await within(page).findByRole("alert");
    expect(alert).toHaveTextContent(/No se pudo conectar con el servidor/);
    expect(screen.queryByText("Sin integraciones todavía")).toBeNull();

    apiMock.listIntegrations.mockResolvedValue({ data: fixtures });
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByTestId("integration-group-telegram")).toBeInTheDocument());
  });
});

describe("shared integration card", () => {
  it("exposes the same action set for the same kind in the project and orchestrator scopes", async () => {
    const projectTelegram = makeIntegration({ id: "tg-project", kind: "telegram", name: "Telegram de proyecto", slug: "telegram-proyecto", status: "connected", config: { botUsername: "proyecto_bot" } });
    const projectWhatsapp = makeIntegration({ id: "wa-project", kind: "whatsapp", name: "WhatsApp de proyecto", slug: "whatsapp-proyecto", status: "needs_config" });
    apiMock.listIntegrations.mockResolvedValue({ data: [projectTelegram, projectWhatsapp] });
    apiMock.controlIntegrations.mockResolvedValue({
      data: [
        { ...projectTelegram, id: "tg-channel", scope: "global", projectSlug: undefined, name: "Telegram del orquestador" },
        { ...projectWhatsapp, id: "wa-channel", scope: "global", projectSlug: undefined, name: "WhatsApp del orquestador" },
      ],
    });

    renderPage();
    renderWithProviders(<ControlChannelsPanel />);

    const pairs = [
      { project: "tg-project", channel: "tg-channel", menu: ["Desconectar", "Limpiar webhook", "Borrar"] },
      { project: "wa-project", channel: "wa-channel", menu: ["Conectar", "Ver QR", "Borrar"] },
    ];
    for (const pair of pairs) {
      const projectCard = await screen.findByTestId("integration-card-" + pair.project);
      const channelCard = await screen.findByTestId("integration-card-" + pair.channel);
      expect(visibleActions(projectCard)).toEqual(visibleActions(channelCard));
      expect(await menuLabels(projectCard)).toEqual(pair.menu);
      expect(await menuLabels(channelCard)).toEqual(pair.menu);
    }
  });

  it("announces a needs_config orchestrator channel as a warning", async () => {
    const channel = makeIntegration({
      id: "wa-canal",
      kind: "whatsapp",
      name: "WhatsApp del orquestador",
      slug: "whatsapp-orquestador",
      status: "needs_config",
      scope: "global",
      projectSlug: undefined,
    });
    apiMock.controlIntegrations.mockResolvedValue({ data: [channel] });
    apiMock.connectControlIntegration.mockResolvedValue({ ...channel, status: "needs_config" });
    renderWithProviders(
      <>
        <ControlChannelsPanel />
      </>,
    );

    await connectFromMenu(await screen.findByTestId("integration-card-wa-canal"));
    const toastElement = (await screen.findByText("Canal WhatsApp del orquestador: needs_config")).closest<HTMLElement>(
      "[data-sonner-toast]",
    );
    expect(toastElement).toHaveAttribute("data-type", "warning");
  });

  it("announces a rejected control-channel test as a toast", async () => {
    const channel = makeIntegration({
      id: "tg-canal",
      kind: "telegram",
      name: "Telegram del orquestador",
      slug: "telegram-orquestador",
      status: "connected",
      scope: "global",
      projectSlug: undefined,
    });
    apiMock.controlIntegrations.mockResolvedValue({ data: [channel] });
    apiMock.testControlIntegration.mockRejectedValueOnce(new Error("failed to fetch"));
    renderWithProviders(
      <>
        <ControlChannelsPanel />
      </>,
    );

    const card = await screen.findByTestId("integration-card-tg-canal");
    await userEvent.click(within(card).getByRole("button", { name: "Probar" }));

    const toast = await screen.findByText(
      "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.",
    );
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the empty state in both scopes when there are no integrations", async () => {
    apiMock.listIntegrations.mockResolvedValue({ data: [] });
    renderPage();
    renderWithProviders(<ControlChannelsPanel />);

    expect(await screen.findByText("Sin integraciones todavía")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay canales del orquestador.")).toBeInTheDocument();
  });

  it("shows the shared credential notice after creating a project integration", async () => {
    const created = makeIntegration({ id: "tg-nuevo", kind: "telegram", name: "Telegram nuevo", slug: "telegram-nuevo", status: "needs_config" });
    apiMock.createIntegration.mockResolvedValue({ integration: created, apiKey: "sk-project" });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Nueva integración" }));
    await userEvent.type(screen.getByLabelText("Nombre"), "Telegram nuevo");
    await userEvent.type(screen.getByLabelText("Slug"), "telegram-nuevo");
    await userEvent.type(screen.getByLabelText("Token del bot (@BotFather)"), "123:ABC");
    await userEvent.click(screen.getByRole("button", { name: "Crear integración" }));

    expect(await screen.findByText(/Guarda estas credenciales ahora/)).toBeInTheDocument();
    expect(screen.getByText("sk-project")).toBeInTheDocument();
  });

  it("shows the shared credential notice after creating an orchestrator channel", async () => {
    const created = makeIntegration({ id: "tg-canal", kind: "telegram", name: "Canal nuevo", slug: "canal-nuevo", status: "needs_config", scope: "global", projectSlug: undefined });
    apiMock.createControlIntegration.mockResolvedValue({ integration: created, apiKey: "sk-global" });
    renderWithProviders(<ControlChannelsPanel />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Canal nuevo");
    await userEvent.type(screen.getByLabelText("Slug"), "canal-nuevo");
    await userEvent.type(screen.getByLabelText("Token del bot (@BotFather)"), "456:DEF");
    await userEvent.click(screen.getByRole("button", { name: "Crear integración" }));

    expect(await screen.findByText(/Guarda estas credenciales ahora/)).toBeInTheDocument();
    expect(screen.getByText("sk-global")).toBeInTheDocument();
  });
});
