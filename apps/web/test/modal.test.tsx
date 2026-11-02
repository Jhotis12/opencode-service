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
