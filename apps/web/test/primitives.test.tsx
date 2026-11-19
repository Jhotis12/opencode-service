import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../src/components/ConfirmDialog.tsx";
import { EmptyState } from "../src/components/EmptyState.tsx";
import { Field } from "../src/components/Field.tsx";
import { PageHeader } from "../src/components/PageHeader.tsx";
import { Skeleton } from "../src/components/Skeleton.tsx";
import { Tabs, type TabItem } from "../src/components/Tabs.tsx";

const items = [
  { id: "overview", label: "Resumen", content: <p>Contenido de resumen</p> },
  { id: "runs", label: "Ejecuciones", content: <p>Contenido de ejecuciones</p> },
  { id: "agents", label: "Agentes", content: <p>Contenido de agentes</p> },
] satisfies readonly TabItem[];

describe("Tabs", () => {
  it("links every tab to its labelled panel and exposes one roving tab stop", () => {
    render(<Tabs items={items} aria-label="Secciones del proyecto" />);

    const tablist = screen.getByRole("tablist", { name: "Secciones del proyecto" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(items.length);
    for (const tab of tabs) {
      const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "missing-panel");
      expect(panel).toHaveAttribute("role", "tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    }

    const overview = screen.getByRole("tab", { name: "Resumen" });
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(overview).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Ejecuciones" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel", { name: "Resumen" })).toBeVisible();
    expect(document.getElementById(overview.getAttribute("aria-controls") ?? "missing-panel")).toHaveTextContent(
      "Contenido de resumen",
    );
  });

  it.each([
    { key: "{ArrowRight}", initial: "overview", target: "Ejecuciones" },
    { key: "{ArrowLeft}", initial: "overview", target: "Agentes" },
    { key: "{Home}", initial: "agents", target: "Resumen" },
    { key: "{End}", initial: "overview", target: "Agentes" },
  ])("moves selection and focus to $target with $key", async ({ key, initial, target }) => {
    const user = userEvent.setup();
    render(<Tabs items={items} aria-label="Secciones del proyecto" defaultValue={initial} />);
    const selectedBefore = screen.getByRole("tab", { selected: true });
    selectedBefore.focus();

    await user.keyboard(key);

    const selected = screen.getByRole("tab", { name: target });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).toHaveAttribute("tabindex", "0");
    expect(selected).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: target })).toBeVisible();
    expect(selectedBefore).toHaveAttribute("tabindex", "-1");
  });
});

describe("ConfirmDialog", () => {
  it("cancels through the shared modal without running the danger action", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog title="Eliminar proyecto" confirmLabel="Eliminar proyecto" onCancel={onCancel} onConfirm={onConfirm}>
        <p>Esta acción no se puede deshacer.</p>
      </ConfirmDialog>,
    );

    expect(screen.getByRole("dialog", { name: "Eliminar proyecto" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("runs the danger confirmation action", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog title="Eliminar proyecto" confirmLabel="Eliminar proyecto" onCancel={vi.fn()} onConfirm={onConfirm}>
        <p>Esta acción no se puede deshacer.</p>
      </ConfirmDialog>,
    );

    const confirm = screen.getByRole("button", { name: "Eliminar proyecto" });
    expect(confirm).toHaveClass("bg-danger");
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("blocks confirmation until the required text matches", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        title="Eliminar proyecto"
        confirmLabel="Eliminar definitivamente"
        confirmationText="proyecto-demo"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      >
        <p>Se eliminarán todos los datos.</p>
      </ConfirmDialog>,
    );

    const confirm = screen.getByRole("button", { name: "Eliminar definitivamente" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Escribe proyecto-demo para confirmar"), "proyecto-demo");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("Field", () => {
  it("associates the label, hint and error with the wrapped control", () => {
    render(
      <Field id="agent-name" label="Nombre del agente" hint="Visible en el catálogo" error="Escribe un nombre">
        <input />
      </Field>,
    );

    const control = screen.getByLabelText("Nombre del agente");
    expect(control).toHaveAttribute("id", "agent-name");
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAttribute("aria-describedby", "agent-name-hint agent-name-error");
    expect(document.getElementById("agent-name-hint")).toHaveTextContent("Visible en el catálogo");
    expect(document.getElementById("agent-name-error")).toHaveTextContent("Escribe un nombre");
  });
});

describe("EmptyState", () => {
  it("renders its guidance and invokes the optional action", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <EmptyState
        icon={<svg data-testid="empty-state-icon" />}
        title="Todavía no hay proyectos"
        description="Crea un proyecto para configurar tu primera automatización."
        action={<button type="button" onClick={onCreate}>Crear proyecto</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Todavía no hay proyectos" })).toBeInTheDocument();
    expect(screen.getByTestId("empty-state-icon").parentElement).toHaveAttribute("aria-hidden", "true");
    await user.click(screen.getByRole("button", { name: "Crear proyecto" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});

describe("Skeleton", () => {
  it("uses fixed geometry and an opacity-only loading animation", () => {
    const { container } = render(
      <div>
        <Skeleton />
        <Skeleton shape="circle" size="sm" />
      </div>,
    );

    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons).toHaveLength(2);
    expect(skeletons.item(0)).toHaveClass("h-3", "w-full", "rounded-full", "animate-pulse", "motion-reduce:animate-none");
    expect(skeletons.item(1)).toHaveClass("h-8", "w-8", "rounded-full", "animate-pulse", "motion-reduce:animate-none");
  });
});

describe("PageHeader", () => {
  it("renders the title, description, breadcrumbs and actions slots", () => {
    render(
      <PageHeader
        title="Proyectos"
        description="Gestiona tus automatizaciones."
        breadcrumbs={<nav aria-label="Migas de pan"><a href="/projects">Proyectos</a></nav>}
        actions={<button type="button">Nuevo proyecto</button>}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Proyectos" })).toBeInTheDocument();
    expect(screen.getByText("Gestiona tus automatizaciones.")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Migas de pan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("button", { name: "Nuevo proyecto" })).toBeInTheDocument();
  });
});
