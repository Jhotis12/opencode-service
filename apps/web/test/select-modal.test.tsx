import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "../src/components/Modal.tsx";
import { Select } from "../src/components/Select.tsx";
import type { SelectOption } from "../src/components/select/options.ts";
import { chooseOption, setViewportMatches } from "./render.tsx";

const OPTIONS: readonly SelectOption[] = [
  { value: "alfa", label: "Alfa" },
  { value: "beta", label: "Beta" },
  { value: "gamma", label: "Gamma" },
];

const TITLE = "Configurar nodo";

function PickerDialog({
  onClose,
  onChange,
}: {
  onClose?: () => void;
  onChange?: (value: string | undefined) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {open && (
        <Modal
          title={TITLE}
          onClose={() => {
            setOpen(false);
            onClose?.();
          }}
        >
          <Select label="Modelo" options={OPTIONS} emptyValue="" onChange={onChange} />
          <button type="button">Guardar</button>
        </Modal>
      )}
    </>
  );
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog", { name: TITLE });
}

async function openDialog(): Promise<HTMLElement> {
  return waitFor(() => {
    const panel = dialog();
    expect(panel).toHaveAttribute("data-state", "open");
    return panel;
  });
}

async function openPopup(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  const trigger = within(dialog()).getByRole("combobox", { name: "Modelo" });
  await user.click(trigger);
  expect(trigger).toHaveFocus();
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  return trigger;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Select inside Modal", () => {
  it("closes only the popup on Escape while the dialog stays open", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PickerDialog onClose={onClose} />);
    const panel = await openDialog();
    await openPopup(user);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(dialog()).toBe(panel);
    expect(panel).toHaveAttribute("data-state", "open");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes the dialog on the next Escape, after the exit animation", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PickerDialog onClose={onClose} />);
    const panel = await openDialog();
    await openPopup(user);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(panel).toHaveAttribute("data-state", "open");
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");

    expect(panel).toHaveAttribute("data-state", "closed");
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 1000 });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes the popup on Tab and moves focus to the next control inside the dialog", async () => {
    const user = userEvent.setup();
    render(<PickerDialog />);
    await openDialog();
    const trigger = await openPopup(user);

    const popup = document.querySelector("[data-popover]");
    expect(popup).not.toBeNull();
    expect(
      popup!.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).toHaveLength(0);

    await user.keyboard("{Tab}");

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    const active = document.activeElement;
    expect(active).not.toBe(trigger);
    expect(active).not.toBe(document.body);
    expect(dialog().contains(active)).toBe(true);
  });

  it("keeps the page root inert while the popup is open", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    try {
      const user = userEvent.setup();
      render(<PickerDialog />, { container: root });
      await waitFor(() => expect(root).toHaveAttribute("inert"));
      await openPopup(user);

      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(root).toHaveAttribute("inert");
    } finally {
      root.remove();
    }
  });

  it("keeps focus on the trigger after clicking an option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PickerDialog onChange={onChange} />);
    const trigger = await openPopup(user);

    await user.click(screen.getByRole("option", { name: "Beta" }));

    expect(onChange).toHaveBeenCalledWith("beta");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("leaves no popup behind after opening and closing twice", async () => {
    const user = userEvent.setup();
    render(<PickerDialog />);
    await openDialog();
    const trigger = within(dialog()).getByRole("combobox", { name: "Modelo" });

    for (let round = 0; round < 2; round += 1) {
      await user.click(trigger);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(document.querySelectorAll("[data-popover]")).toHaveLength(0);
    }

    await chooseOption(user, "Modelo", "Alfa");
    expect(trigger).toHaveTextContent("Alfa");
    expect(document.querySelectorAll("[data-popover]")).toHaveLength(0);
  });

  it("commits through the shared chooseOption helper", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PickerDialog onChange={onChange} />);
    await openDialog();

    await chooseOption(user, "Modelo", "Gamma");

    expect(onChange).toHaveBeenCalledWith("gamma");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveTextContent("Gamma");
  });

  it("pins the desktop popover with setViewportMatches and restores matchMedia afterwards", async () => {
    const user = userEvent.setup();
    const original = window.matchMedia;
    const restore = setViewportMatches("(max-width: 639px)", false);
    expect(window.matchMedia).not.toBe(original);
    try {
      render(<PickerDialog />);
      await openDialog();
      await openPopup(user);

      expect(document.querySelector("[data-popover]")).not.toBeNull();
      expect(screen.queryByRole("dialog", { name: "Modelo" })).toBeNull();
    } finally {
      restore();
    }
    expect(window.matchMedia).toBe(original);
  });
});
