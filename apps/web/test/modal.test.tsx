import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../src/components/Modal.tsx";

describe("Modal", () => {
  it("opens with the shared presence state and waits for the exit before closing", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Demo modal" onClose={onClose} size="sm">
        <p>Contenido</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Demo modal" });
    expect(dialog).toHaveClass("max-w-md");
    await waitFor(() => expect(dialog).toHaveAttribute("data-state", "open"));

    await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(dialog).toHaveAttribute("data-state", "closed");
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 1000 });
  });

  it("uses the same exit path for Escape and backdrop clicks", async () => {
    const onClose = vi.fn();
    const first = render(
      <Modal title="Primer modal" onClose={onClose} size="md">
        <p>Contenido</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    first.unmount();

    render(
      <Modal title="Segundo modal" onClose={onClose} size="lg">
        <p>Contenido</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("dialog", { name: "Segundo modal" }).parentElement!);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });

  it("closes only the topmost dialog when dialogs are stacked", async () => {
    function Stack() {
      const [outerOpen, setOuterOpen] = useState(true);
      const [innerOpen, setInnerOpen] = useState(true);
      return (
        <>
          {outerOpen && (
            <Modal title="Inspector del nodo" onClose={() => setOuterOpen(false)} size="xl">
              <p>Ficha del nodo</p>
              {innerOpen && (
                <Modal title="Eliminar nodo" onClose={() => setInnerOpen(false)} size="sm">
                  <p>Confirmación</p>
                </Modal>
              )}
            </Modal>
          )}
        </>
      );
    }
    render(<Stack />);
    const inner = screen.getByRole("dialog", { name: "Eliminar nodo" });
    await waitFor(() => expect(inner).toHaveAttribute("data-state", "open"));

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Eliminar nodo" })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Inspector del nodo" })).toHaveAttribute("data-state", "open");

    // Once the inner dialog is gone, Escape belongs to the dialog below it again.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Inspector del nodo" })).not.toBeInTheDocument());
  });

  it("traps focus inside the dialog and restores it to the trigger", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir modal
          </button>
          {open && (
            <Modal title="Trampa de foco" onClose={() => setOpen(false)}>
              <button type="button">Uno</button>
              <button type="button">Dos</button>
            </Modal>
          )}
        </>
      );
    }
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    render(<Harness />, { container: root });
    const trigger = screen.getByRole("button", { name: "Abrir modal" });
    await userEvent.click(trigger);
    expect(root).toHaveAttribute("inert");
    const dialog = screen.getByRole("dialog", { name: "Trampa de foco" });
    const close = within(dialog).getByRole("button", { name: "Cerrar" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    const two = within(dialog).getByRole("button", { name: "Dos" });
    two.focus();
    await userEvent.keyboard("{Tab}");
    expect(close).toHaveFocus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(two).toHaveFocus();

    await userEvent.click(close);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(root).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
    root.remove();
  });

  it("returns focus to the trigger after Escape closes the dialog", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir dialogo
          </button>
          {open && (
            <Modal title="Cierre con Escape" onClose={() => setOpen(false)}>
              {/* A field that autofocuses moves focus inside the dialog before the modal's own effects run. */}
              <input aria-label="Nombre" autoFocus />
            </Modal>
          )}
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Abrir dialogo" });
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Cierre con Escape" });
    expect(within(dialog).getByLabelText("Nombre")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cerrar" })).toHaveFocus());

    await userEvent.keyboard("{Escape}");
    // Subscribe to the state the assertion checks: focus and the page lock are restored by
    // the passive effect cleanup, which React can flush after the dialog node is gone.
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("returns focus to the trigger after a backdrop click", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir desde fondo
          </button>
          {open && (
            <Modal title="Cierre por fondo" onClose={() => setOpen(false)}>
              <p>Contenido</p>
            </Modal>
          )}
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Abrir desde fondo" });
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Cierre por fondo" });
    fireEvent.click(dialog.parentElement!);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps a readable title width when three header actions compete", () => {
    render(
      <Modal
        title="Nodo: Calificar leads del formulario de contacto"
        onClose={vi.fn()}
        actions={
          <>
            <button type="button">Duplicar</button>
            <button type="button">Conexiones</button>
            <button type="button">Eliminar</button>
          </>
        }
      >
        <p>Contenido</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: /Nodo: Calificar leads/ });
    const title = screen.getByRole("heading", { name: /Nodo: Calificar leads/ });
    // The floor is what pushes the action cluster onto a second line instead of shrinking
    // the title to nothing; truncation still handles titles longer than the line.
    expect(title).toHaveClass("min-w-28", "truncate");
    expect(title).not.toHaveClass("min-w-0");
    expect(dialog.querySelector("header > div")).toHaveClass("ml-auto");
  });

  it("scrolls the body once and pins the header and footer", () => {
    render(
      <Modal title="Con pie" onClose={vi.fn()} footer={<button type="button">Guardar</button>}>
        <p>Contenido</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Con pie" });
    const scrollers = dialog.querySelectorAll(".overflow-auto");
    expect(scrollers).toHaveLength(1);
    expect(scrollers[0]).toHaveAttribute("data-modal-body");
    expect(dialog.querySelector("header")).toHaveClass("shrink-0");
    expect(dialog.lastElementChild).toHaveClass("shrink-0");
    expect(dialog.lastElementChild).not.toHaveClass("overflow-auto");
  });

  it("pays the bottom sheet the gesture-area inset", () => {
    render(
      <Modal title="Hoja" onClose={vi.fn()}>
        <p>Contenido</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Hoja" })).toHaveClass("pb-[env(safe-area-inset-bottom)]");
  });

  it("maps each size to a distinct width", () => {
    const { rerender } = render(
      <Modal title="Size" onClose={vi.fn()} size="sm">
        <p>Contenido</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Size" })).toHaveClass("max-w-md");
    rerender(
      <Modal title="Size" onClose={vi.fn()} size="xl">
        <p>Contenido</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Size" })).toHaveClass("max-w-5xl");
  });
});
