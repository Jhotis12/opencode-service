import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SubagentProfile } from "@platform/shared";
import type { ModelInfo } from "../src/api.ts";
import { renderWithProviders } from "./render.tsx";

/**
 * Plan row 67: a rejected request is an action outcome, so it reaches the error
 * toast. Validation is the other side of the line: it stays next to the field
 * and must never fire a toast or issue a request. Each panel below proves both
 * halves against the real sonner host, so "no toast" means the DOM has no toast.
 */

const apiMock = vi.hoisted(() => ({
  listDestinations: vi.fn(),
  createDestination: vi.fn(),
  updateDestination: vi.fn(),
  deleteDestination: vi.fn(),
  listProjectSecrets: vi.fn(),
  saveProjectSecret: vi.fn(),
  deleteProjectSecret: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  listNotebooks: vi.fn(),
  upsertAgent: vi.fn(),
  deleteAgent: vi.fn(),
}));

vi.mock("../src/api.ts", () => ({ api: apiMock }));

import { AgentEditorModal } from "../src/components/AgentEditorModal.tsx";
import { IntegrationEditor } from "../src/components/IntegrationEditor.tsx";
import { ProjectDestinationsPanel } from "../src/components/ProjectDestinationsPanel.tsx";
import { ProjectSettingsPanel } from "../src/components/ProjectSettingsPanel.tsx";
import { dismissAll } from "../src/components/Toast.tsx";
import { ProjectsPage } from "../src/pages/ProjectsPage.tsx";

const NETWORK_COPY = "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.";

function withToaster(node: React.ReactNode) {
  return renderWithProviders(
    <>
      {node}
    </>,
  );
}

function toastFor(text: string | RegExp): HTMLElement {
  const element = screen.getByText(text);
  const toast = element.closest("[data-sonner-toast]");
  if (!toast) throw new Error(`"${text}" is not inside a toast`);
  return toast as HTMLElement;
}

function expectNoToast(): void {
  expect(document.querySelector("[data-sonner-toast]")).toBeNull();
}

afterEach(() => {
  act(() => dismissAll());
  vi.resetAllMocks();
});

describe("request failures reach the error toast", () => {
  describe("ProjectDestinationsPanel", () => {
    beforeEach(() => {
      apiMock.listDestinations.mockResolvedValue({ data: [] });
    });

    it("keeps an empty destination inline and makes no request", async () => {
      const user = userEvent.setup();
      withToaster(<ProjectDestinationsPanel projectSlug="demo" />);
      await user.click(screen.getByRole("button", { name: "Crear destino" }));

      expect(screen.getByText("La etiqueta es obligatoria.")).toBeInTheDocument();
      expect(screen.getByText("El valor es obligatorio.")).toBeInTheDocument();
      expect(apiMock.createDestination).not.toHaveBeenCalled();
      expectNoToast();
    });

    it("announces a rejected creation as a toast", async () => {
      const user = userEvent.setup();
      apiMock.createDestination.mockRejectedValueOnce(new Error("failed to fetch"));
      withToaster(<ProjectDestinationsPanel projectSlug="demo" />);

      await user.type(screen.getByLabelText("Etiqueta"), "Admin");
      await user.type(screen.getByLabelText("Valor"), "123456");
      await user.click(screen.getByRole("button", { name: "Crear destino" }));

      expect(toastFor(NETWORK_COPY)).toBeInTheDocument();
      expect(screen.queryByText(NETWORK_COPY)?.closest("p.text-danger")).toBeNull();
    });
  });

  describe("ProjectSettingsPanel secrets", () => {
    beforeEach(() => {
      apiMock.listProjectSecrets.mockResolvedValue({ data: [] });
    });

    it("keeps an invalid secret alias inline and makes no request", async () => {
      const user = userEvent.setup();
      withToaster(<ProjectSettingsPanel projectSlug="demo" section="secrets" />);
      await screen.findByLabelText("Alias");

      await user.click(screen.getByRole("button", { name: "Guardar secreto" }));

      expect(screen.getByText("El alias es obligatorio.")).toBeInTheDocument();
      expect(screen.getByText("El valor es obligatorio.")).toBeInTheDocument();
      expect(apiMock.saveProjectSecret).not.toHaveBeenCalled();
      expectNoToast();
    });

    it("announces a rejected secret save as a toast", async () => {
      const user = userEvent.setup();
      apiMock.saveProjectSecret.mockRejectedValueOnce(new Error("failed to fetch"));
      withToaster(<ProjectSettingsPanel projectSlug="demo" section="secrets" />);
      await screen.findByLabelText("Alias");

      await user.type(screen.getByLabelText("Alias"), "openai_key");
      await user.type(screen.getByLabelText("Valor"), "sk-test");
      await user.click(screen.getByRole("button", { name: "Guardar secreto" }));

      expect(toastFor(NETWORK_COPY)).toBeInTheDocument();
    });
  });

  describe("ProjectsPage", () => {
    beforeEach(() => {
      apiMock.listProjects.mockResolvedValue({ data: [] });
      apiMock.deleteProject.mockResolvedValue(undefined);
    });

    function renderProjects() {
      return withToaster(
        <MemoryRouter initialEntries={["/projects"]}>
          <Routes>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:slug" element={<div>proyecto abierto</div>} />
          </Routes>
        </MemoryRouter>,
      );
    }

    it("keeps an empty project name inline and makes no request", async () => {
      const user = userEvent.setup();
      renderProjects();
      await user.click(await screen.findByRole("button", { name: "Crear primer proyecto" }));

      await user.click(screen.getByRole("button", { name: "Crear proyecto" }));

      expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
      expect(apiMock.createProject).not.toHaveBeenCalled();
      expectNoToast();
    });

    it("announces a rejected creation as a toast", async () => {
      const user = userEvent.setup();
      apiMock.createProject.mockRejectedValueOnce(new Error("already exists"));
      renderProjects();
      await user.click(await screen.findByRole("button", { name: "Crear primer proyecto" }));

      await user.type(screen.getByLabelText(/Nombre del proyecto/), "Bot de Ventas");
      await user.click(screen.getByRole("button", { name: "Crear proyecto" }));

      expect(toastFor("Ya existe un recurso con ese identificador.")).toBeInTheDocument();
    });
  });

  describe("IntegrationEditor", () => {
    it("keeps an unparsable advanced config inline and makes no request", async () => {
      const user = userEvent.setup();
      apiMock.listDestinations.mockResolvedValue({ data: [] });
      withToaster(<IntegrationEditor scope="project" projectSlug="demo" onSaved={vi.fn()} />);

      await user.type(screen.getByLabelText("Nombre"), "Bot");
      await user.type(screen.getByLabelText("Slug"), "bot");
      await user.click(screen.getByText("Configuración avanzada"));
      const advanced = await screen.findByLabelText(/JSON adicional/);
      await user.clear(advanced);
      fireEvent.change(advanced, { target: { value: "[]" } });
      await user.click(screen.getByRole("button", { name: "Crear integración" }));

      expect(screen.getByText("La configuración avanzada debe ser un objeto JSON.")).toBeInTheDocument();
      expect(apiMock.createIntegration).not.toHaveBeenCalled();
      expectNoToast();
    });

    it("announces a rejected save as a toast", async () => {
      const user = userEvent.setup();
      apiMock.listDestinations.mockResolvedValue({ data: [] });
      apiMock.createIntegration.mockRejectedValueOnce(new Error("failed to fetch"));
      withToaster(<IntegrationEditor scope="project" projectSlug="demo" onSaved={vi.fn()} />);

      await user.type(screen.getByLabelText("Nombre"), "Bot");
      await user.type(screen.getByLabelText("Slug"), "bot");
      await user.type(screen.getByLabelText("Token del bot (@BotFather)"), "123:ABC");
      await user.click(screen.getByRole("button", { name: "Crear integración" }));

      expect(toastFor(NETWORK_COPY)).toBeInTheDocument();
    });
  });

  describe("AgentEditorModal", () => {
    const models: ModelInfo[] = [{ providerID: "opencode-go", modelID: "fast", name: "Fast" }];
    const validAgent: SubagentProfile = {
      category: "ventas",
      role: "calificador",
      frontmatter: {
        description: "Califica leads",
        mode: "subagent",
        permissions: [{ action: "tool", resource: "db_query", effect: "deny" }],
        notebooks: [],
      },
      body: "Eres el calificador.",
    };
    const agentWithUnknownRule: SubagentProfile = {
      ...validAgent,
      frontmatter: {
        ...validAgent.frontmatter,
        permissions: [
          ...validAgent.frontmatter.permissions,
          { action: "tool", resource: "legacy_tool", effect: "deny" },
        ],
      },
    };

    beforeEach(() => {
      apiMock.listNotebooks.mockResolvedValue({ data: [] });
    });

    it("keeps an unknown permission rule inline, disables the save and makes no request", async () => {
      withToaster(<AgentEditorModal projectSlug="demo" agent={agentWithUnknownRule} models={models} onClose={vi.fn()} />);

      const block = await screen.findByTestId("unknown-permission-rules");
      expect(block).toHaveTextContent("legacy_tool");
      expect(screen.getByRole("button", { name: "Guardar agente" })).toBeDisabled();
      expect(apiMock.upsertAgent).not.toHaveBeenCalled();
      expectNoToast();
    });

    it("announces a rejected save as a toast", async () => {
      const user = userEvent.setup();
      apiMock.upsertAgent.mockRejectedValueOnce(new Error("failed to fetch"));
      withToaster(<AgentEditorModal projectSlug="demo" agent={validAgent} models={models} onClose={vi.fn()} />);

      await waitFor(() => expect(screen.getByRole("button", { name: "Guardar agente" })).toBeEnabled());
      await user.click(screen.getByRole("button", { name: "Guardar agente" }));

      expect(toastFor(NETWORK_COPY)).toBeInTheDocument();
    });
  });
});
