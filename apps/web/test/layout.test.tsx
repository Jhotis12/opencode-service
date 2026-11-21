import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "../src/components/Layout.tsx";
import { Tabs, type TabItem } from "../src/components/Tabs.tsx";

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
    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByTestId("app-main")).toHaveAttribute("id", "main-content");
    expect(screen.getByTestId("app-main")).toHaveAttribute("tabindex", "-1");
    expect(screen.getAllByRole("link", { name: /Agentic Platform/i }).length).toBeGreaterThan(0);
    const collapse = screen.getByRole("button", { name: "Contraer navegación" });
    expect(collapse).toHaveAttribute("aria-controls", "app-navigation");
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(collapse);
    const expand = screen.getByRole("button", { name: "Expandir navegación" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Navegación lateral")).toHaveAttribute("id", "app-navigation");
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

  it("makes the closed mobile drawer inert", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderLayout();
    expect(screen.getByLabelText("Navegación lateral")).toHaveAttribute("inert");
    vi.unstubAllGlobals();
  });

  // jsdom cannot resolve env(), so the safe-area rule is pinned as the class string.
  it("pays the app frame the top safe-area inset without doubling the main height", () => {
    renderLayout();
    const header = screen.getByRole("banner");
    expect(header.className).toContain("pt-[env(safe-area-inset-top)]");
    expect(header.className).toContain("h-[calc(3.5rem+env(safe-area-inset-top))]");
    expect(screen.getByTestId("app-main").className).toContain("calc(100dvh-3.5rem-env(safe-area-inset-top))");
  });

  it("pads the narrow-viewport drawer against both safe-area insets", () => {
    renderLayout();
    const drawer = screen.getByLabelText("Navegación lateral");
    expect(drawer.className).toContain("pt-[calc(1rem+env(safe-area-inset-top))]");
    expect(drawer.className).toContain("pb-[calc(1rem+env(safe-area-inset-bottom))]");
  });

  it("uses a fluid main area only on project routes", () => {
    const project = renderLayout("/projects/demo");
    expect(screen.getByTestId("app-main").className).toContain("lg:h-dvh");
    project.unmount();

    renderLayout("/settings");
    expect(screen.getByTestId("app-main").className).toContain("max-w-[1500px]");
  });
});

const tabItems = [
  { id: "overview", label: "Resumen", content: <p>Resumen</p> },
  { id: "runs", label: "Ejecuciones", content: <p>Ejecuciones</p> },
  { id: "agents", label: "Agentes", content: <p>Agentes</p> },
] satisfies readonly TabItem[];

/** jsdom reports zero metrics, so the strip's scroll box is stubbed on the node itself. */
function stubStripMetrics(metrics: { clientWidth: number; scrollWidth: number }) {
  const tablist = screen.getByRole("tablist", { name: "Secciones del proyecto" });
  let scrollLeft = 0;
  Object.defineProperty(tablist, "clientWidth", { configurable: true, get: () => metrics.clientWidth });
  Object.defineProperty(tablist, "scrollWidth", { configurable: true, get: () => metrics.scrollWidth });
  Object.defineProperty(tablist, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  return {
    tablist,
    scrollTo(value: number) {
      tablist.scrollLeft = value;
      act(() => {
        tablist.dispatchEvent(new Event("scroll"));
      });
    },
  };
}

describe("Tabs scroll affordances", () => {
  it("shows the trailing fade while content remains to the right and hides it at the end", () => {
    render(<Tabs items={tabItems} aria-label="Secciones del proyecto" />);
    const strip = stubStripMetrics({ clientWidth: 200, scrollWidth: 500 });
    strip.scrollTo(0);

    expect(screen.queryByTestId("tab-scroll-fade-start")).not.toBeInTheDocument();
    expect(screen.getByTestId("tab-scroll-fade-end")).toBeInTheDocument();

    strip.scrollTo(150);
    expect(screen.getByTestId("tab-scroll-fade-start")).toBeInTheDocument();
    expect(screen.getByTestId("tab-scroll-fade-end")).toBeInTheDocument();

    strip.scrollTo(300);
    expect(screen.getByTestId("tab-scroll-fade-start")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-scroll-fade-end")).not.toBeInTheDocument();
  });

  it("recomputes the affordance when the strip is resized", () => {
    render(<Tabs items={tabItems} aria-label="Secciones del proyecto" />);
    const metrics = { clientWidth: 500, scrollWidth: 500 };
    const strip = stubStripMetrics(metrics);
    strip.scrollTo(0);
    expect(screen.queryByTestId("tab-scroll-fade-end")).not.toBeInTheDocument();

    metrics.clientWidth = 200;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("tab-scroll-fade-end")).toBeInTheDocument();
  });
});
