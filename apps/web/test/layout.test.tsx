import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "../src/components/Layout.tsx";

vi.mock("../src/auth.tsx", () => ({
  useAuth: () => ({
    user: { username: "tester", mustChangePassword: false },
    loading: false,
    refresh: vi.fn(),
    setUser: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}));

function renderLayout(path = "/projects/demo") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/projects/:slug" element={<div>workspace</div>} />
          <Route path="/settings" element={<div>settings</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Layout", () => {
  beforeEach(() => localStorage.clear());

  it("collapses the navigation rail, keeps accessible labels and persists the preference", async () => {
    const first = renderLayout();
    expect(screen.getAllByRole("link", { name: /Agentic Platform/i }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Contraer navegación" }));
    expect(screen.getByRole("button", { name: "Expandir navegación" })).toBeInTheDocument();
    expect(localStorage.getItem("platform.nav.collapsed")).toBe("1");
    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute("title", "Proyectos");
    first.unmount();

    renderLayout();
    expect(screen.getByRole("button", { name: "Expandir navegación" })).toBeInTheDocument();
  });

  it("opens and closes the narrow-viewport drawer", async () => {
    renderLayout();
    await userEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));
    expect(screen.getByLabelText("Navegación lateral").className).toContain("translate-x-0");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar navegación" }));
    expect(screen.getByLabelText("Navegación lateral").className).toContain("-translate-x-full");
  });

  it("uses a fluid main area only on project routes", () => {
    const project = renderLayout("/projects/demo");
    expect(screen.getByTestId("app-main").className).toContain("lg:h-dvh");
    project.unmount();

    renderLayout("/settings");
    expect(screen.getByTestId("app-main").className).toContain("max-w-[1500px]");
  });
});
