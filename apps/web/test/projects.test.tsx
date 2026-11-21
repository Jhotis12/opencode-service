import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { renderWithProviders } from "./render.tsx";

const { project, secondProject } = vi.hoisted(() => ({
  project: {
    id: "p1",
    slug: "bot-ventas",
    name: "Bot de ventas",
    description: "Atiende leads",
    primaryAgent: "principal/agente",
    defaultModel: "opencode-go/fast",
    createdAt: "2026-06-15T12:00:00.000Z",
  },
  secondProject: {
    id: "p2",
    slug: "mesa-soporte",
    name: "Mesa de soporte",
    description: "Clasifica tickets",
    primaryAgent: "principal/agente",
    defaultModel: "opencode-go/fast",
    createdAt: "2026-06-14T12:00:00.000Z",
  },
}));

vi.mock("../src/api.ts", () => ({
  api: {
    listProjects: vi.fn().mockResolvedValue({ data: [] }),
    createProject: vi.fn().mockResolvedValue({
      project,
      graph: { version: 1, id: "p1", name: "Bot de ventas", description: "", nodes: [], edges: [], updatedAt: "" },
    }),
    deleteProject: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "../src/api.ts";
import { dismissAll } from "../src/components/Toast.tsx";
import { ProjectsPage } from "../src/pages/ProjectsPage.tsx";

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/projects"]}>
      <Routes>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:slug" element={<div>proyecto abierto</div>} />
      </Routes>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </MemoryRouter>,
  );
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    vi.mocked(api.createProject).mockClear();
    vi.mocked(api.deleteProject).mockClear();
  });

  afterEach(() => {
    act(() => dismissAll());
  });

  it("renders the value-proposition header with the canonical descriptor and project cards", async () => {
    vi.mocked(api.listProjects).mockResolvedValueOnce({ data: [project] });
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Automatizaciones agénticas sobre OpenCode" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo proyecto" })).toBeInTheDocument();
    const projectCard = await screen.findByRole("article");
    expect(within(projectCard).getByRole("heading", { name: "Bot de ventas" })).toBeInTheDocument();
    expect(within(projectCard).getByText(/2026/)).toBeInTheDocument();
    expect(within(projectCard).getByRole("link", { name: "Abrir proyecto" })).toHaveAttribute(
      "href",
      "/projects/bot-ventas",
    );
  });

  it("shows skeletons while the project list loads", () => {
    vi.mocked(api.listProjects).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando proyectos…");
  });

  it("renders the empty state with a CTA when there are no projects", async () => {
    vi.mocked(api.listProjects).mockResolvedValueOnce({ data: [] });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Todavía no hay proyectos" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Crear primer proyecto" }));
    expect(screen.getByRole("dialog", { name: "Nuevo proyecto" })).toBeInTheDocument();
  });

  it("creates a project with auto-generated slug and description", async () => {
    vi.mocked(api.listProjects).mockResolvedValueOnce({ data: [] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Crear primer proyecto" }));
    await userEvent.type(screen.getByLabelText(/Nombre del proyecto/), "Bot de Ventas");
    expect(screen.getByLabelText(/^Slug/)).toHaveValue("bot-de-ventas");
    await userEvent.type(screen.getByLabelText(/^Descripción/), "Atiende leads");
    await userEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));
    expect(api.createProject).toHaveBeenCalledWith({
      name: "Bot de Ventas",
      slug: "bot-de-ventas",
      description: "Atiende leads",
    });
    expect(await screen.findByText("proyecto abierto")).toBeInTheDocument();
  });

  it("shows both templates in the gallery and creates from the triaje-operativo template", async () => {
    vi.mocked(api.listProjects).mockResolvedValueOnce({ data: [project] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
    const blank = screen.getByRole("radio", { name: /En blanco/ });
    const triaje = screen.getByRole("radio", { name: /Triaje operativo/ });
    expect(blank).toBeChecked();
    expect(triaje).not.toBeChecked();
    await userEvent.click(triaje);
    expect(triaje).toBeChecked();
    expect(blank).not.toBeChecked();
    await userEvent.type(screen.getByLabelText(/Nombre del proyecto/), "Mesa Operativa");
    await userEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));
    expect(api.createProject).toHaveBeenLastCalledWith({
      name: "Mesa Operativa",
      slug: "mesa-operativa",
      description: undefined,
      template: "triaje-operativo",
    });
  });

  it("shows an inline Spanish error and does not POST when the slug is invalid", async () => {
    vi.mocked(api.listProjects).mockResolvedValueOnce({ data: [] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Crear primer proyecto" }));
    await userEvent.type(screen.getByLabelText(/Nombre del proyecto/), "Bot de Ventas");
    const slugField = screen.getByLabelText(/^Slug/);
    await userEvent.clear(slugField);
    await userEvent.type(slugField, "x");
    await userEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));
    const error = screen.getByText("El slug debe tener entre 2 y 61 caracteres: minúsculas, números y guiones.");
    expect(error).toBeInTheDocument();
    expect(slugField).toHaveAttribute("aria-invalid", "true");
    expect(slugField.getAttribute("aria-describedby")).toContain(error.id);
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("clears the search with the clear control and restores the full list", async () => {
    vi.mocked(api.listProjects).mockResolvedValueOnce({ data: [project, secondProject] });
    renderPage();
    await screen.findByRole("heading", { name: "Bot de ventas" });
    const search = screen.getByLabelText("Buscar proyectos");
    await userEvent.type(search, "ventas");
    expect(screen.getByText("1 de 2 proyectos")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mesa de soporte" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(search).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Mesa de soporte" })).toBeInTheDocument();
    expect(screen.getByText("2 de 2 proyectos")).toBeInTheDocument();
  });

  it("maps a project creation failure to actionable Spanish copy", async () => {
    vi.mocked(api.listProjects).mockResolvedValueOnce({ data: [] });
    vi.mocked(api.createProject).mockRejectedValueOnce(new Error("already exists"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Crear primer proyecto" }));
    await userEvent.type(screen.getByLabelText(/Nombre del proyecto/), "Bot de Ventas");
    await userEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));
    const error = await screen.findByText("Ya existe un recurso con ese identificador.");
    expect(error.closest("[data-sonner-toast]")).not.toBeNull();
    expect(screen.queryByTitle("already exists")).not.toBeInTheDocument();
  });

  it("deletes a project only after typing its slug", async () => {
    vi.mocked(api.listProjects).mockResolvedValueOnce({ data: [project] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    expect(screen.getByRole("dialog", { name: "Eliminar proyecto" })).toBeInTheDocument();
    const confirm = screen.getByLabelText(/Escribe/);
    await userEvent.type(confirm, "bot-ventas");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));
    expect(api.deleteProject).toHaveBeenCalledWith("bot-ventas");
  });

  it("closes the delete dialog and toasts when deletion fails", async () => {
    vi.mocked(api.listProjects).mockResolvedValueOnce({ data: [project] });
    vi.mocked(api.deleteProject).mockRejectedValueOnce(new Error("failed to fetch"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    const dialog = screen.getByRole("dialog", { name: "Eliminar proyecto" });
    await userEvent.type(screen.getByLabelText(/Escribe/), "bot-ventas");
    await userEvent.click(within(dialog).getByRole("button", { name: "Eliminar definitivamente" }));

    const toast = await screen.findByText("No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.");
    expect(toast.closest("[data-sonner-toast]")).not.toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Eliminar proyecto" })).not.toBeInTheDocument(),
    );
  });
});

describe("ProjectsPage first-run guidance", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.listProjects).mockResolvedValue({ data: [] });
  });

  it("shows the 'Cómo funciona' block with the three steps and leaves the primary action to the empty state", async () => {
    renderPage();
    const block = await screen.findByRole("region", { name: "Cómo funciona" });
    const steps = within(block).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(within(steps[0]).getByText("Proyecto")).toBeInTheDocument();
    expect(within(steps[1]).getByText("Flujo")).toBeInTheDocument();
    expect(within(steps[2]).getByText("Ejecución")).toBeInTheDocument();
    expect(within(block).queryByRole("button", { name: /crear .*proyecto/i })).not.toBeInTheDocument();
    await screen.findByRole("heading", { name: "Todavía no hay proyectos" });
    const createCtas = screen.getAllByRole("button", { name: /crear .*proyecto/i });
    expect(createCtas).toHaveLength(1);
    expect(createCtas[0]).toHaveTextContent("Crear primer proyecto");
  });

  it("keeps the guide CTA on a populated account and opens the create modal with it", async () => {
    vi.mocked(api.listProjects).mockResolvedValue({ data: [project] });
    renderPage();
    await screen.findByRole("heading", { name: "Bot de ventas" });
    const block = screen.getByRole("region", { name: "Cómo funciona" });
    expect(within(block).getByRole("button", { name: "Crear un proyecto" })).toBeInTheDocument();
    await userEvent.click(within(block).getByRole("button", { name: "Crear un proyecto" }));
    expect(screen.getByRole("dialog", { name: "Nuevo proyecto" })).toBeInTheDocument();
  });

  it("hides the block on dismissal, persists the key and stays hidden after a remount", async () => {
    const { unmount } = renderPage();
    const block = await screen.findByRole("region", { name: "Cómo funciona" });
    await userEvent.click(within(block).getByRole("button", { name: /Descartar/ }));
    expect(screen.queryByRole("region", { name: "Cómo funciona" })).not.toBeInTheDocument();
    expect(localStorage.getItem("platform.onboarding.dismissed")).toBe("1");
    unmount();
    renderPage();
    expect(screen.queryByRole("region", { name: "Cómo funciona" })).not.toBeInTheDocument();
  });

  it("still shows the block when the stored value is corrupt", async () => {
    localStorage.setItem("platform.onboarding.dismissed", "no-es-un-valor");
    renderPage();
    expect(await screen.findByRole("region", { name: "Cómo funciona" })).toBeInTheDocument();
  });

  it("renders the page and the block without throwing when localStorage access fails", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    try {
      renderPage();
      const block = await screen.findByRole("region", { name: "Cómo funciona" });
      await userEvent.click(within(block).getByRole("button", { name: /Descartar/ }));
      expect(screen.queryByRole("region", { name: "Cómo funciona" })).not.toBeInTheDocument();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
