import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithProviders } from "./render.tsx";

const { project } = vi.hoisted(() => ({
  project: {
    id: "p1",
    slug: "bot-ventas",
    name: "Bot de ventas",
    description: "Atiende leads",
    primaryAgent: "principal/agente",
    defaultModel: "opencode-go/fast",
    createdAt: new Date().toISOString(),
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
import { ProjectsPage } from "../src/pages/ProjectsPage.tsx";

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/projects"]}>
      <Routes>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:slug" element={<div>proyecto abierto</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectsPage", () => {
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
});
