import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiSelect } from "../src/components/MultiSelect.tsx";
import type { SelectOption } from "../src/components/select/options.ts";

const NOTEBOOKS: readonly SelectOption[] = [
  { value: "nb-ideas", label: "Ideas", group: "Notebooks" },
  { value: "nb-research", label: "Investigación", group: "Notebooks" },
  { value: "nb-archive", label: "Archivo", group: "Antiguos", disabled: true },
  { value: "tag-urgent", label: "Urgente" },
];

type User = ReturnType<typeof userEvent.setup>;

function ControlledSelect({
  initialValue = [],
  onChange,
}: {
  readonly initialValue?: readonly string[];
  readonly onChange?: (next: string[]) => void;
}) {
  const [value, setValue] = useState<string[]>([...initialValue]);
  return (
    <MultiSelect
      label="Notebooks"
      placeholder="Selecciona notebooks"
      options={NOTEBOOKS}
      value={value}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-popover]");
}

function chips(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-multiselect-chip]")).map((chip) =>
    (chip.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}

function row(label: string): HTMLElement {
  const match = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((element) =>
    (element.textContent ?? "").includes(label),
  );
  if (match === undefined) throw new Error(`No hay una fila de opción que contenga «${label}»`);
  return match;
}

function rowLabels(): readonly string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).map((element) =>
    (element.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}

async function openPicker(user: User): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: "Añadir Notebooks" }));
  const search = screen.getByRole("combobox", { name: "Buscar" });
  await waitFor(() => expect(search).toHaveFocus());
  return search;
}

describe("MultiSelect — selection", () => {
  it("opens a searchable listbox with the grouped options", async () => {
    const user = userEvent.setup();
    render(<ControlledSelect />);

    const search = await openPicker(user);

    expect(panel()).not.toBeNull();
    const listbox = document.getElementById(search.getAttribute("aria-controls") ?? "");
    expect(listbox).not.toBeNull();
    expect(listbox!.getAttribute("role")).toBe("listbox");
    expect(search).toHaveAttribute("aria-autocomplete", "list");
    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Notebooks" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Antiguos" })).toBeInTheDocument();
    expect(rowLabels()).toEqual(["Ideas", "Investigación", "Archivo", "Urgente"]);
  });

  it("adds two values and emits both in the order they were chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<ControlledSelect onChange={onChange} />);

    await openPicker(user);
    await user.click(row("Ideas"));
    await user.click(row("Investigación"));

    expect(onChange).toHaveBeenLastCalledWith(["nb-ideas", "nb-research"]);
    expect(chips(container)).toEqual(["Ideas", "Investigación"]);
    expect(panel()).not.toBeNull();
  });

  it("keeps the popover open when Enter toggles the active row, and toggles it back off", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSelect onChange={onChange} />);

    await openPicker(user);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(["nb-research"]);
    expect(panel()).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Buscar" })).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(panel()).not.toBeNull();
  });

  it("toggles the active row with Space while the query is empty", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSelect onChange={onChange} />);

    await openPicker(user);
    await user.keyboard(" ");

    expect(onChange).toHaveBeenLastCalledWith(["nb-ideas"]);
    expect(panel()).not.toBeNull();
  });

  it("removes a chip by its accessible name and emits the remaining values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <ControlledSelect initialValue={["nb-ideas", "nb-research"]} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Quitar Ideas" }));

    expect(onChange).toHaveBeenLastCalledWith(["nb-research"]);
    expect(chips(container)).toEqual(["Investigación"]);
  });

  it("removes the last chip with Backspace on an empty query", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <ControlledSelect initialValue={["nb-ideas", "nb-research"]} onChange={onChange} />,
    );

    await openPicker(user);
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenLastCalledWith(["nb-ideas"]);
    expect(chips(container)).toEqual(["Ideas"]);
    expect(panel()).not.toBeNull();
  });

  it("emits an empty array when the last chip is removed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<ControlledSelect initialValue={["nb-ideas"]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Quitar Ideas" }));

    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(chips(container)).toEqual([]);
    expect(container.querySelectorAll("[data-multiselect-chip]")).toHaveLength(0);
  });

  it("removes a selected row instead of duplicating it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSelect initialValue={["nb-ideas"]} onChange={onChange} />);

    await openPicker(user);
    await user.click(row("Ideas"));

    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<ControlledSelect />);
    const trigger = screen.getByRole("button", { name: "Añadir Notebooks" });

    await openPicker(user);
    await user.keyboard("{Escape}");

    expect(panel()).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("MultiSelect — rows", () => {
  it("marks selected rows with a check and leaves the others unmarked", async () => {
    const user = userEvent.setup();
    render(<ControlledSelect />);

    await openPicker(user);
    await user.click(row("Ideas"));

    const check = row("Ideas").querySelector<HTMLElement>("[data-listbox-chip]");
    expect(check).not.toBeNull();
    expect(check!.textContent).toBe("✓");
    expect(check!.getAttribute("title")).toBe("Seleccionado");
    expect(row("Investigación").querySelector("[data-listbox-chip]")).toBeNull();
  });

  it("marks selected rows with aria-selected independently of the active row", async () => {
    const user = userEvent.setup();
    render(<ControlledSelect initialValue={["nb-ideas"]} />);

    await openPicker(user);
    const selected = row("Ideas");
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.querySelector("[data-listbox-chip]")).toHaveTextContent("✓");

    await user.keyboard("{ArrowDown}");

    const active = row("Investigación");
    expect(active).toHaveAttribute("data-active");
    expect(active).toHaveAttribute("aria-selected", "false");
    expect(row("Ideas")).toHaveAttribute("aria-selected", "true");
    expect(row("Ideas")).not.toHaveAttribute("data-active");
  });

  it("never toggles a disabled row, by mouse or by keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<ControlledSelect onChange={onChange} />);

    await openPicker(user);
    expect(row("Archivo")).toHaveAttribute("aria-disabled", "true");

    await user.click(row("Archivo"));
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["tag-urgent"]);
    expect(chips(container)).toEqual(["Urgente"]);
  });

  it("filters with the shared option filter and announces the empty result", async () => {
    const user = userEvent.setup();
    render(<ControlledSelect />);

    const search = await openPicker(user);
    await user.type(search, "inv");

    expect(rowLabels()).toEqual(["Investigación"]);
    expect(screen.getByRole("group", { name: "Notebooks" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Antiguos" })).toBeNull();

    const activeId = search.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId!)?.textContent).toContain("Investigación");

    await user.clear(search);
    await user.type(search, "zzz");
    expect(rowLabels()).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultados");
  });
});

describe("MultiSelect — chips", () => {
  it("gives every chip removal an accessible name", () => {
    render(
      <MultiSelect
        label="Notebooks"
        options={NOTEBOOKS}
        value={["nb-ideas", "nb-research"]}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Quitar Ideas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar Investigación" })).toBeInTheDocument();
  });

  it("labels a saved value absent from the options with its raw value", () => {
    render(
      <MultiSelect
        label="Notebooks"
        options={NOTEBOOKS}
        value={["nb-deleted"]}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Quitar nb-deleted" })).toBeInTheDocument();
  });

  it("keeps every chip when the value array is reordered", () => {
    const onChange = vi.fn();
    const view = render(
      <MultiSelect
        label="Notebooks"
        options={NOTEBOOKS}
        value={["nb-ideas", "nb-research"]}
        onChange={onChange}
      />,
    );
    expect(chips(view.container)).toEqual(["Ideas", "Investigación"]);

    view.rerender(
      <MultiSelect
        label="Notebooks"
        options={NOTEBOOKS}
        value={["nb-research", "nb-ideas"]}
        onChange={onChange}
      />,
    );

    expect(chips(view.container)).toEqual(["Investigación", "Ideas"]);
    expect(view.container.querySelectorAll("[data-multiselect-chip]")).toHaveLength(2);
  });

  it("collapses duplicate values into one chip and never emits a duplicate", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <ControlledSelect initialValue={["nb-ideas", "nb-ideas"]} onChange={onChange} />,
    );

    expect(container.querySelectorAll("[data-multiselect-chip]")).toHaveLength(1);
    expect(chips(container)).toEqual(["Ideas"]);

    await user.click(screen.getByRole("button", { name: "Quitar Ideas" }));

    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(container.querySelectorAll("[data-multiselect-chip]")).toHaveLength(0);
  });
});
