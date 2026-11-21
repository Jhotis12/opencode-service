import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DestinationKind } from "@platform/shared";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { chooseOption, findToast, renderWithProviders } from "./render.tsx";
import { dismissAll } from "../src/components/Toast.tsx";

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
const transcriptionIntegration = {
  id: "i2",
  scope: "project" as const,
  projectSlug: "ventas",
  kind: "transcription" as const,
  name: "Whisper local",
  slug: "whisper-local",
  config: { model: "whisper-1" },
  secretRefs: {},
  capabilities: ["transcribe_audio"],
  status: "connected",
  createdAt: now,
  updatedAt: now,
};
const speechIntegration = {
  id: "i3",
  scope: "project" as const,
  projectSlug: "ventas",
  kind: "speech" as const,
  name: "Voz del proyecto",
  slug: "voz-proyecto",
  config: { voice: "alloy" },
  secretRefs: {},
  capabilities: ["synthesize_speech"],
  status: "connected",
  createdAt: now,
  updatedAt: now,
};
const projectFixture = {
  id: "p1",
  slug: "ventas",
  name: "Ventas",
  description: "",
  primaryAgent: "principal/agente",
  createdAt: now,
  updatedAt: now,
};
const models = [
  { providerID: "proveedor", modelID: "alfa", name: "Alfa", input: ["text"], cost: { input: 1, output: 2 } },
  { providerID: "proveedor", modelID: "beta", name: "Beta", input: ["text", "image"], cost: { input: 3, output: 6 } },
];
const secret = { alias: "api_key", kind: "generic", createdAt: now };
const agents = [
  {
    category: "principal",
    role: "agente",
    frontmatter: { description: "Agente principal del proyecto", mode: "primary", permissions: [], notebooks: [] },
    body: "Coordina el proyecto.",
  },
  {
    category: "ventas",
    role: "calificador",
    frontmatter: { description: "Califica leads entrantes.", mode: "subagent", permissions: [], notebooks: [] },
    body: "Eres el calificador de ventas.",
  },
];

const apiMock = vi.hoisted(() => ({
  getProjectSettings: vi.fn(),
  listModels: vi.fn(),
  listAgents: vi.fn(),
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
    project: { ...projectFixture },
    integrations: [integration, transcriptionIntegration, speechIntegration],
    notebooks: [],
    readiness: [
      { id: "primary-agent", label: "Agente principal configurado", ready: true },
      { id: "channel", label: "Canal conectado", ready: false },
    ],
  });
  apiMock.listModels.mockResolvedValue({ data: models });
  apiMock.listAgents.mockResolvedValue({ data: agents });
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
  // Outcomes are announced by sonner: the real host proves the copy lands in a toast.
  return renderWithProviders(
    <>
      <MemoryRouter initialEntries={[initial]}>
        <LocationProbe />
        <Routes>
          <Route
            path="/projects/:slug/settings"
            element={<ProjectConfigurationPanel projectSlug="ventas" {...props} />}
          />
          <Route path="/projects/:slug/integrations" element={<p>Página de integraciones</p>} />
        </Routes>
      </MemoryRouter>
    </>
  );
}

afterEach(() => {
  act(() => dismissAll());
});

describe("ProjectConfigurationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("announces a settings save rejection that carries no message with main's localized fallback", async () => {
    mockQueries();
    // A rejection with no message is what reaches the fallback; an Error carries its own text through friendlyError.
    apiMock.updateProjectSettings.mockRejectedValueOnce(null);
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    const toast = await findToast(
      "No se pudieron guardar los ajustes. Revisa los campos y vuelve a intentarlo.",
    );
    expect(toast).toBeVisible();
    expect(screen.queryByText("Error de ajustes")).not.toBeInTheDocument();
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

  it("creates a labeled destination with the chosen kind without changing existing references", async () => {
    mockQueries();
    const user = userEvent.setup();
    renderPanel("destinations");
    await user.type(await screen.findByLabelText("Etiqueta"), "Soporte");
    await user.type(screen.getByLabelText("Valor"), "456");
    await chooseOption(user, "Tipo", "Email");
    await user.click(screen.getByRole("button", { name: "Crear destino" }));
    await waitFor(() =>
      expect(apiMock.createDestination).toHaveBeenCalledWith("ventas", {
        kind: "email",
        label: "Soporte",
        value: "456",
      }),
    );
    expect(apiMock.updateDestination).not.toHaveBeenCalled();
    const createdToast = await screen.findByText("Destino creado");
    expect(createdToast.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("edits a destination kind and saves it with its label and value", async () => {
    mockQueries();
    apiMock.updateDestination.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel("destinations");
    expect(await screen.findByText("Admin")).toBeInTheDocument();

    // The create form also exposes a "Tipo" picker, so the row picker is opened in place.
    const row = screen.getByRole("button", { name: "Borrar el destino Admin" }).closest("article");
    expect(row).not.toBeNull();
    await user.click(within(row!).getByRole("button", { name: "Editar" }));
    const kindTrigger = within(row!).getByRole("combobox", { name: "Tipo" });
    expect(kindTrigger).toHaveTextContent("Chat de Telegram");
    await user.click(kindTrigger);
    await user.click(screen.getByRole("option", { name: "Chat de WhatsApp" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Guardar destino" }));
    await waitFor(() =>
      expect(apiMock.updateDestination).toHaveBeenCalledWith("ventas", "d1", {
        kind: "whatsapp",
        label: "Admin",
        value: "123456",
      }),
    );
    const updatedToast = await screen.findByText("Destino actualizado");
    expect(updatedToast.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("keeps the panel usable with no destinations yet", async () => {
    mockQueries();
    apiMock.listDestinations.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderPanel("destinations");
    expect(await screen.findByText("Aún no hay destinos etiquetados en este proyecto.")).toBeInTheDocument();

    await chooseOption(user, "Tipo", "Webhook");
    await user.type(screen.getByLabelText("Etiqueta"), "Hook");
    await user.type(screen.getByLabelText("Valor"), "https://example.test/hook");
    await user.click(screen.getByRole("button", { name: "Crear destino" }));
    await waitFor(() =>
      expect(apiMock.createDestination).toHaveBeenCalledWith("ventas", {
        kind: "webhook",
        label: "Hook",
        value: "https://example.test/hook",
      }),
    );
  });

  it("still displays and saves a destination kind the catalogue no longer offers", async () => {
    mockQueries();
    apiMock.listDestinations.mockResolvedValue({
      data: [{ ...destination, kind: "carrier_pigeon" as DestinationKind }],
    });
    apiMock.updateDestination.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel("destinations");
    expect(await screen.findByText("carrier_pigeon")).toBeInTheDocument();

    const row = screen.getByRole("button", { name: "Borrar el destino Admin" }).closest("article");
    expect(row).not.toBeNull();
    await user.click(within(row!).getByRole("button", { name: "Editar" }));
    const kindTrigger = within(row!).getByRole("combobox", { name: "Tipo" });
    expect(kindTrigger).toHaveTextContent("carrier_pigeon");

    await user.click(kindTrigger);
    expect(within(await screen.findByRole("listbox")).getByRole("option", { name: /carrier_pigeon/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Guardar destino" }));
    await waitFor(() =>
      expect(apiMock.updateDestination).toHaveBeenCalledWith(
        "ventas",
        "d1",
        expect.objectContaining({ kind: "carrier_pigeon" }),
      ),
    );
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

  it("deletes a destination after confirming and announces it with a toast", async () => {
    mockQueries();
    apiMock.deleteDestination.mockResolvedValue({ ok: true });
    renderPanel("destinations");
    expect(await screen.findByText("Admin")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Borrar el destino Admin" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(apiMock.deleteDestination).toHaveBeenCalledWith("ventas", "d1"));
    expect(await findToast("Destino eliminado")).toBeVisible();
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
    const savedSecretToast = await screen.findByText("Secreto guardado en la bóveda del proyecto");
    expect(savedSecretToast.closest("[data-sonner-toast]")).not.toBeNull();
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
    const removedSecretToast = await screen.findByText("Secreto eliminado");
    expect(removedSecretToast.closest("[data-sonner-toast]")).not.toBeNull();
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

  it("keeps the empty choice label in every picker", async () => {
    mockQueries();
    renderPanel();
    await screen.findByText("Identidad y modelo");

    expect(screen.getByRole("combobox", { name: "Modelo por defecto del proyecto" })).toHaveValue(
      "Usar el modelo global",
    );
    expect(screen.getByRole("combobox", { name: "Canal de aprobación del proyecto" })).toHaveTextContent(
      "Sin canal por defecto",
    );
    expect(screen.getByRole("combobox", { name: "Destinatario de aprobación" })).toHaveValue(
      "Sin destinatario por defecto",
    );
    expect(screen.getByRole("combobox", { name: "Conexión de transcripción por defecto" })).toHaveTextContent(
      "Sin conexión por defecto",
    );
    expect(screen.getByRole("combobox", { name: "Conexión de voz por defecto" })).toHaveTextContent(
      "Sin conexión por defecto",
    );
  });

  it("saves the agent id chosen in the primary agent picker", async () => {
    mockQueries();
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Agente principal" }));
    await user.click(await screen.findByRole("option", { name: "ventas/calificador" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({ primaryAgent: "ventas/calificador" }),
      ),
    );
    expect(screen.getByRole("combobox", { name: "Agente principal" })).toHaveTextContent("ventas/calificador");
    const savedToast = await screen.findByText("Ajustes del proyecto guardados");
    expect(savedToast.closest("[data-sonner-toast]")).not.toBeNull();
  });

  it("clears the primary agent and saves null", async () => {
    mockQueries();
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await chooseOption(user, "Agente principal", "Sin agente principal");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({ primaryAgent: null }),
      ),
    );
  });

  it("still displays and saves a primary agent the catalogue no longer lists", async () => {
    mockQueries();
    apiMock.listAgents.mockResolvedValue({ data: [] });
    apiMock.getProjectSettings.mockResolvedValue({
      project: { ...projectFixture, primaryAgent: "legacy/agent" },
      integrations: [integration, transcriptionIntegration, speechIntegration],
      notebooks: [],
      readiness: [],
    });
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    const trigger = await screen.findByRole("combobox", { name: "Agente principal" });
    await waitFor(() => expect(trigger).toHaveTextContent("legacy/agent"));

    await user.click(trigger);
    expect(
      within(await screen.findByRole("listbox")).getByRole("option", { name: "legacy/agent (no disponible)" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));
    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({ primaryAgent: "legacy/agent" }),
      ),
    );
  });

  it("saves the model reference chosen in the picker, not its label", async () => {
    mockQueries();
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await chooseOption(user, "Modelo por defecto del proyecto", /^Alfa\b/);
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith("ventas", {
        name: "Ventas",
        description: "",
        defaultModel: "proveedor/alfa",
        primaryAgent: "principal/agente",
        approvalIntegrationId: null,
        approvalRecipient: null,
        transcriptionIntegrationId: null,
        speechIntegrationId: null,
      }),
    );
    expect(screen.getByRole("combobox", { name: "Modelo por defecto del proyecto" })).toHaveValue("Alfa");
  });

  it("keeps the model picker usable with an empty catalogue and saves null", async () => {
    mockQueries();
    apiMock.listModels.mockResolvedValue({ data: [] });
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await chooseOption(user, "Modelo por defecto del proyecto", "Usar el modelo global");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({ defaultModel: null }),
      ),
    );
  });

  it("still displays and saves a model the catalogue no longer lists", async () => {
    mockQueries();
    apiMock.listModels.mockResolvedValue({ data: [] });
    apiMock.getProjectSettings.mockResolvedValue({
      project: { ...projectFixture, defaultModel: "desconocido/modelo" },
      integrations: [integration, transcriptionIntegration, speechIntegration],
      notebooks: [],
      readiness: [],
    });
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    const trigger = await screen.findByRole("combobox", { name: "Modelo por defecto del proyecto" });
    expect(trigger).toHaveValue("desconocido/modelo");

    await user.click(trigger);
    expect(within(await screen.findByRole("listbox")).getByRole("option", { name: /desconocido\/modelo/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));
    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({ defaultModel: "desconocido/modelo" }),
      ),
    );
  });

  it("saves the ids chosen from the channel, transcription and voice pickers", async () => {
    mockQueries();
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await chooseOption(user, "Canal de aprobación del proyecto", "Bot de ventas · telegram");
    await chooseOption(user, "Conexión de transcripción por defecto", "Whisper local · whisper-1");
    await chooseOption(user, "Conexión de voz por defecto", "Voz del proyecto · alloy");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({
          approvalIntegrationId: "i1",
          transcriptionIntegrationId: "i2",
          speechIntegrationId: "i3",
        }),
      ),
    );
  });

  it("clears a chosen connection and saves null", async () => {
    mockQueries();
    apiMock.getProjectSettings.mockResolvedValue({
      project: { ...projectFixture, speechIntegrationId: "i3" },
      integrations: [integration, transcriptionIntegration, speechIntegration],
      notebooks: [],
      readiness: [],
    });
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await chooseOption(user, "Conexión de voz por defecto", "Sin conexión por defecto");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({ speechIntegrationId: null }),
      ),
    );
  });

  it("saves the destination id chosen in the approval recipient picker", async () => {
    mockQueries();
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();

    await chooseOption(user, "Destinatario de aprobación", "Admin · 123456");
    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));

    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({ approvalRecipient: "d1" }),
      ),
    );
  });

  it("keeps a raw approval recipient typed by hand", async () => {
    mockQueries();
    apiMock.updateProjectSettings.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    const trigger = await screen.findByRole("combobox", { name: "Destinatario de aprobación" });
    await user.click(trigger);
    await user.type(trigger, "987654");
    await user.click(screen.getByRole("option", { name: "Usar «987654»" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Guardar ajustes" }));
    await waitFor(() =>
      expect(apiMock.updateProjectSettings).toHaveBeenCalledWith(
        "ventas",
        expect.objectContaining({ approvalRecipient: "987654" }),
      ),
    );
  });

  it("shows a retryable error instead of an endless loading state when settings fail", async () => {
    mockQueries();
    apiMock.getProjectSettings.mockRejectedValueOnce(new Error("No se pudieron cargar los ajustes"));
    renderPanel();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("No se pudieron cargar los ajustes")).toBeInTheDocument();
    expect(screen.queryByText("Cargando ajustes del proyecto…")).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Identidad y modelo")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps pending approvals visible when a decision fails and lets the error be dismissed", async () => {
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
    apiMock.decideApproval.mockRejectedValue(new Error("La ejecución ya no está pausada"));
    renderPanel("approvals");

    expect(await screen.findByText("Nodo review")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aprobar" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("La ejecución ya no está pausada")).toBeInTheDocument();
    expect(screen.getByText("Nodo review")).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("Nodo review")).toBeInTheDocument();
  });
});
