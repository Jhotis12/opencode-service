import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../src/components/Select.tsx";
import { Field } from "../src/components/Field.tsx";
import type { SelectOption } from "../src/components/select/options.ts";

const MOBILE_MAX_WIDTH = 639;

const OPTIONS: readonly SelectOption[] = [
  { value: "deepseek/v4.1-flash", label: "DeepSeek V4.1 Flash", group: "deepseek" },
  { value: "deepseek/pro", label: "DeepSeek Pro", group: "deepseek", disabled: true },
  { value: "openai/mini", label: "OpenAI Mini", group: "openai" },
  { value: "local/model", label: "Modelo local" },
];

const WITH_EMPTY: readonly SelectOption[] = [...OPTIONS, { value: "", label: "Heredar" }];

function stubViewport(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes(`max-width: ${MOBILE_MAX_WIDTH}px`) ? width <= MOBILE_MAX_WIDTH : false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }));
}

function getCombobox(): HTMLElement {
  return screen.getByRole("combobox");
}

function getListbox(): HTMLElement {
  return screen.getByRole("listbox");
}

function optionRows(): readonly HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
}

function optionByLabel(label: string): HTMLElement {
  const row = optionRows().find((element) => element.textContent?.includes(label));
  if (row === undefined) throw new Error(`No option row contains: ${label}`);
  return row;
}

function activeOption(): HTMLElement {
  const id = getCombobox().getAttribute("aria-activedescendant");
  expect(id).toBeTruthy();
  const option = document.getElementById(id!);
  expect(option).not.toBeNull();
  expect(option!.getAttribute("role")).toBe("option");
  return option as HTMLElement;
}

function openWithClick() {
  fireEvent.click(getCombobox());
  expect(getCombobox()).toHaveAttribute("aria-expanded", "true");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Select — ARIA contract", () => {
  it("renders a labelled button combobox that starts collapsed with no dangling aria-controls", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);

    const trigger = getCombobox();
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
    expect(trigger).not.toHaveAttribute("aria-activedescendant");

    const label = screen.getByText("Modelo");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", trigger.id);
    expect(trigger).toHaveAccessibleName("Modelo");
  });

  it("points aria-controls at the rendered listbox and aria-activedescendant at a rendered option", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);

    openWithClick();

    const listbox = getListbox();
    expect(getCombobox().getAttribute("aria-controls")).toBe(listbox.id);
    expect(document.getElementById(listbox.id)).toBe(listbox);

    const active = activeOption();
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active.textContent).toContain("DeepSeek V4.1 Flash");
  });

  it("keeps aria-activedescendant on a rendered option while the active row moves", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);
    const trigger = getCombobox();
    openWithClick();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeOption().textContent).toContain("OpenAI Mini");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeOption().textContent).toContain("Modelo local");
    expect(document.getElementById(getCombobox().getAttribute("aria-activedescendant")!)).not.toBeNull();
  });

  it("uses an input combobox with aria-autocomplete=list when searchable", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" searchable />);

    const trigger = getCombobox();
    expect(trigger.tagName).toBe("INPUT");
    expect(trigger).toHaveAttribute("aria-autocomplete", "list");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("wires helper and error text through aria-describedby and aria-invalid", () => {
    const clean = render(
      <Select label="Modelo" options={OPTIONS} emptyValue="" helper="Elige un modelo disponible." />,
    );
    const trigger = getCombobox();
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)!.textContent).toBe("Elige un modelo disponible.");
    expect(trigger).not.toHaveAttribute("aria-invalid");
    clean.unmount();

    render(<Select label="Modelo" options={OPTIONS} emptyValue="" helper="Elige uno." error="Elige un modelo." />);
    const invalid = getCombobox();
    const ids = invalid.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toHaveLength(2);
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toEqual([
      "Elige uno.",
      "Elige un modelo.",
    ]);
    expect(invalid).toHaveAttribute("aria-invalid", "true");
  });

  it("forwards Field's id, aria-describedby and aria-invalid without rendering a second label", () => {
    render(
      <Field id="modelo" label="Modelo" hint="Elige uno." error="Obligatorio">
        <Select label="Modelo" options={OPTIONS} emptyValue="" />
      </Field>,
    );

    const trigger = getCombobox();
    expect(trigger).toHaveAttribute("id", "modelo");
    expect(trigger.getAttribute("aria-describedby")).toBe("modelo-hint modelo-error");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(document.querySelectorAll("label")).toHaveLength(1);
    expect(trigger).toHaveAccessibleName("Modelo");
  });

  it("returns focus to the trigger after committing and after Escape", async () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);
    const trigger = getCombobox();
    trigger.focus();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveFocus();

    openWithClick();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("passes className through to the field wrapper", () => {
    const { container } = render(
      <Select label="Modelo" options={OPTIONS} emptyValue="" className="max-w-sm" />,
    );
    expect(container.querySelector(".max-w-sm")!.contains(getCombobox())).toBe(true);
  });
});

describe("Select — keyboard", () => {
  it("opens from Enter, Space, ArrowDown, ArrowUp and Alt+ArrowDown", () => {
    for (const key of ["Enter", " ", "ArrowDown", "ArrowUp"]) {
      const view = render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);
      fireEvent.keyDown(getCombobox(), { key });
      expect(getCombobox()).toHaveAttribute("aria-expanded", "true");
      expect(getListbox()).toBeInTheDocument();
      view.unmount();
    }

    const alt = render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);
    const notCancelled = fireEvent.keyDown(getCombobox(), { key: "ArrowDown", altKey: true });
    expect(notCancelled).toBe(false);
    expect(getCombobox()).toHaveAttribute("aria-expanded", "true");
    alt.unmount();
  });

  it("never commits while opening", () => {
    const onChange = vi.fn();
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" onChange={onChange} />);
    fireEvent.keyDown(getCombobox(), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(getCombobox()).toHaveAttribute("aria-expanded", "true");
  });

  it("moves the active option with the arrows, skips disabled rows and clamps without wrapping", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);
    const trigger = getCombobox();
    openWithClick();
    expect(activeOption().textContent).toContain("DeepSeek V4.1 Flash");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeOption().textContent).toContain("OpenAI Mini");
    expect(optionByLabel("DeepSeek Pro")).not.toHaveAttribute("data-active");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeOption().textContent).toContain("Modelo local");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(activeOption().textContent).toContain("Modelo local");

    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(activeOption().textContent).toContain("OpenAI Mini");

    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(activeOption().textContent).toContain("DeepSeek V4.1 Flash");
  });

  it("jumps with Home and End only in select-only mode", async () => {
    const selectOnly = render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);
    fireEvent.click(getCombobox());
    fireEvent.keyDown(getCombobox(), { key: "End" });
    expect(activeOption().textContent).toContain("Modelo local");
    fireEvent.keyDown(getCombobox(), { key: "Home" });
    expect(activeOption().textContent).toContain("DeepSeek V4.1 Flash");
    selectOnly.unmount();

    render(<Select label="Modelo" options={OPTIONS} emptyValue="" searchable />);
    const input = getCombobox();
    await userEvent.click(input);
    expect(getListbox()).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(activeOption().textContent).toContain("OpenAI Mini");
    const notCancelled = fireEvent.keyDown(input, { key: "End" });
    expect(notCancelled).toBe(true);
    expect(activeOption().textContent).toContain("OpenAI Mini");
  });

  it("commits the active option exactly once on Enter and closes", () => {
    const onChange = vi.fn();
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" onChange={onChange} />);
    const trigger = getCombobox();
    trigger.focus();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("openai/mini");
    expect(getCombobox()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.textContent).toContain("OpenAI Mini");
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape through the popover without letting the key bubble", async () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" defaultValue="openai/mini" />);
    await userEvent.click(getCombobox());
    expect(getListbox()).toBeInTheDocument();

    const documentListener = vi.fn();
    document.addEventListener("keydown", documentListener);
    fireEvent.keyDown(document.body, { key: "Escape" });
    document.removeEventListener("keydown", documentListener);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(documentListener).not.toHaveBeenCalled();
  });

  it("closes on Tab without preventing the default and without committing", async () => {
    const onChange = vi.fn();
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" onChange={onChange} />);
    await userEvent.click(getCombobox());
    expect(getListbox()).toBeInTheDocument();

    const notCancelled = fireEvent.keyDown(getCombobox(), { key: "Tab" });

    expect(notCancelled).toBe(true);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("typeaheads in select-only mode", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);
    fireEvent.click(getCombobox());

    fireEvent.keyDown(getCombobox(), { key: "o" });
    expect(activeOption().textContent).toContain("OpenAI Mini");
  });

  it("filters while typing, edits the query with Backspace and replaces a saved label", async () => {
    render(
      <Select
        label="Modelo"
        options={OPTIONS}
        emptyValue=""
        searchable
        defaultValue="openai/mini"
        noResultsLabel="Sin coincidencias"
      />,
    );
    const input = getCombobox();
    expect((input as HTMLInputElement).value).toBe("OpenAI Mini");

    await userEvent.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await userEvent.type(input, "deep");
    expect(optionRows()).toHaveLength(2);
    expect(optionByLabel("DeepSeek V4.1 Flash")).toBeInTheDocument();
    expect(() => optionByLabel("OpenAI Mini")).toThrow();
    expect(activeOption().textContent).toContain("DeepSeek V4.1 Flash");

    await userEvent.type(input, "{Backspace}{Backspace}{Backspace}{Backspace}");
    expect((input as HTMLInputElement).value).toBe("");
    expect(optionRows()).toHaveLength(4);

    await userEvent.type(input, "zzz");
    expect(optionRows()).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Sin coincidencias");
    expect(getCombobox()).not.toHaveAttribute("aria-activedescendant");
  });
});

describe("Select — empty value", () => {
  it("emits an empty string when emptyValue is \"\"", () => {
    const onChange = vi.fn();
    render(<Select label="Modelo" options={WITH_EMPTY} emptyValue="" onChange={onChange} />);
    fireEvent.click(getCombobox());
    fireEvent.keyDown(getCombobox(), { key: "End" });
    expect(activeOption().textContent).toContain("Heredar");
    fireEvent.keyDown(getCombobox(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("emits undefined when emptyValue is \"undefined\" and stays unset", () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Modelo"
        options={WITH_EMPTY}
        emptyValue="undefined"
        placeholder="Sin modelo"
        onChange={onChange}
      />,
    );
    fireEvent.click(getCombobox());
    fireEvent.keyDown(getCombobox(), { key: "End" });
    fireEvent.keyDown(getCombobox(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(getCombobox()).toHaveAttribute("aria-expanded", "false");
    expect(getCombobox().textContent).toContain("Sin modelo");
  });

  it("reports open changes through onOpenChange", async () => {
    const onOpenChange = vi.fn();
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" onOpenChange={onOpenChange} />);
    await userEvent.click(getCombobox());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe("Select — edge input", () => {
  it("renders an empty searchable picker without throwing and without a dangling active descendant", async () => {
    render(<Select label="Modelo" options={[]} emptyValue="" searchable emptyLabel="Sin modelos" />);
    const input = getCombobox();

    await userEvent.click(input);
    expect(getListbox()).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sin modelos");

    await userEvent.type(input, "abc");
    expect(optionRows()).toHaveLength(0);
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultados");
  });

  it("keeps exactly one open surface across three open and close cycles", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);
    const trigger = getCombobox();

    for (let round = 0; round < 3; round += 1) {
      fireEvent.click(trigger);
      expect(document.querySelectorAll('[role="listbox"]')).toHaveLength(1);
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(document.querySelectorAll('[role="listbox"]')).toHaveLength(0);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("skips a disabled row during keyboard navigation and never commits it", () => {
    const onChange = vi.fn();
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" onChange={onChange} />);
    const trigger = getCombobox();
    openWithClick();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("openai/mini");
    expect(onChange).not.toHaveBeenCalledWith("deepseek/pro");
  });
});

describe("Select — custom values", () => {
  it("offers a Usar row at the top and commits a typed value absent from the options", async () => {
    const onChange = vi.fn();
    render(
      <Select label="Destino" options={OPTIONS} emptyValue="" searchable allowCustom onChange={onChange} />,
    );
    const input = getCombobox();
    await userEvent.click(input);
    await userEvent.type(input, "  +34 600 123 456  ");

    const custom = optionByLabel("Usar «+34 600 123 456»");
    expect(custom).toHaveAttribute("role", "option");
    expect(optionRows()[0]).toBe(custom);
    expect(activeOption()).toBe(custom);

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("+34 600 123 456");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).value).toBe("+34 600 123 456");
  });

  it("commits the custom row on pointer selection", async () => {
    const onChange = vi.fn();
    render(
      <Select label="Destino" options={OPTIONS} emptyValue="" searchable allowCustom onChange={onChange} />,
    );
    const input = getCombobox();
    await userEvent.click(input);
    await userEvent.type(input, "abc123");

    const rows = screen.getAllByRole("option");
    expect(rows[0]).toHaveTextContent("Usar «abc123»");

    fireEvent.mouseDown(optionByLabel("Usar «abc123»"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("abc123");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input).toHaveFocus();
  });

  it("never offers or commits unknown text without allowCustom", async () => {
    const onChange = vi.fn();
    render(<Select label="Destino" options={OPTIONS} emptyValue="" searchable onChange={onChange} />);
    const input = getCombobox();
    await userEvent.click(input);
    await userEvent.type(input, "zzz");

    expect(optionRows()).toHaveLength(0);
    expect(screen.queryByText(/Usar «/)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultados");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hides the custom row when the query matches an option exactly", async () => {
    const onChange = vi.fn();
    render(
      <Select label="Modelo" options={OPTIONS} emptyValue="" searchable allowCustom onChange={onChange} />,
    );
    const input = getCombobox();
    await userEvent.click(input);
    await userEvent.type(input, "OpenAI Mini");

    expect(optionRows()).toHaveLength(1);
    expect(screen.queryByText(/Usar «/)).toBeNull();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("openai/mini");
  });

  it("refuses whitespace-only custom text", async () => {
    const onChange = vi.fn();
    render(<Select label="Destino" options={[]} emptyValue="" searchable allowCustom onChange={onChange} />);
    const input = getCombobox();
    await userEvent.click(input);
    await userEvent.type(input, "   ");

    expect(optionRows()).toHaveLength(0);
    expect(screen.queryByText(/Usar «/)).toBeNull();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Select — saved value fallback", () => {
  it("renders a value missing from the options as a selected row with a muted suffix", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" value="legacy/model#v2" />);
    const trigger = getCombobox();
    expect(trigger.textContent).toContain("legacy/model#v2");

    openWithClick();

    const row = optionByLabel("legacy/model#v2");
    expect(row).toHaveAttribute("role", "option");
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(row.textContent).toContain("legacy/model#v2");
    expect(row.textContent).toContain("(no disponible)");

    const suffix = row.querySelector("[data-listbox-suffix]");
    expect(suffix).not.toBeNull();
    expect(suffix!.textContent!.trim()).toBe("(no disponible)");
    expect(suffix!.className).toContain("text-muted");
  });

  it("keeps a saved value the catalogue drops across a re-render and re-emits it unchanged", () => {
    const onChange = vi.fn();
    const withLegacy: readonly SelectOption[] = [
      ...OPTIONS,
      { value: "legacy/model#v2", label: "Legacy v2" },
    ];
    const view = render(
      <Select label="Modelo" options={withLegacy} emptyValue="" value="legacy/model#v2" onChange={onChange} />,
    );
    expect(getCombobox().textContent).toContain("Legacy v2");

    view.rerender(
      <Select label="Modelo" options={OPTIONS} emptyValue="" value="legacy/model#v2" onChange={onChange} />,
    );

    expect(getCombobox().textContent).toContain("legacy/model#v2");

    openWithClick();
    const row = optionByLabel("legacy/model#v2");
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(row.textContent).toContain("(no disponible)");

    fireEvent.keyDown(getCombobox(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("legacy/model#v2");
  });

  it("shows the saved label again on Escape after typing a query", async () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" searchable defaultValue="openai/mini" />);
    const input = getCombobox();
    expect((input as HTMLInputElement).value).toBe("OpenAI Mini");

    await userEvent.click(input);
    await userEvent.type(input, "leg");
    expect((input as HTMLInputElement).value).toBe("leg");

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect((input as HTMLInputElement).value).toBe("OpenAI Mini");
  });

  it("keeps the unavailable fallback row first and selected while a query matches nothing", async () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" searchable value="legacy/model#v2" />);
    const input = getCombobox();
    await userEvent.click(input);
    await userEvent.type(input, "zzz");

    const rows = optionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("legacy/model#v2");
    expect(rows[0].textContent).toContain("(no disponible)");
    expect(rows[0]).toHaveAttribute("aria-selected", "true");
    expect(activeOption()).toBe(rows[0]);
  });

  it("keeps the unavailable fallback row first while a query matches other options", async () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" searchable value="legacy/model#v2" />);
    const input = getCombobox();
    await userEvent.click(input);
    await userEvent.type(input, "deep");

    const rows = optionRows();
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0].textContent).toContain("legacy/model#v2");
    expect(rows[0].textContent).toContain("(no disponible)");
    expect(rows[0]).toHaveAttribute("aria-selected", "true");
    expect(activeOption()).toBe(rows[0]);

    const match = optionByLabel("DeepSeek V4.1 Flash");
    expect(match).not.toBe(rows[0]);
    expect(match).toHaveAttribute("aria-selected", "false");
    expect(rows.indexOf(match)).toBeGreaterThan(0);
  });
});

describe("Select — selected row", () => {
  it("keeps aria-selected on the committed row while another row is active", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" defaultValue="openai/mini" />);
    openWithClick();
    expect(optionByLabel("OpenAI Mini")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(getCombobox(), { key: "ArrowDown" });

    const active = activeOption();
    expect(active.textContent).toContain("Modelo local");
    expect(active).toHaveAttribute("data-active");
    expect(active).toHaveAttribute("aria-selected", "false");

    const committed = optionByLabel("OpenAI Mini");
    expect(committed).toHaveAttribute("aria-selected", "true");
    expect(committed).not.toHaveAttribute("data-active");
  });

  it("keeps a saved value missing from the options selected while another row is active", () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" value="legacy/model#v2" />);
    openWithClick();

    const saved = optionByLabel("legacy/model#v2");
    expect(saved).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(getCombobox(), { key: "ArrowDown" });

    const active = activeOption();
    expect(active.textContent).toContain("DeepSeek V4.1 Flash");
    expect(active).toHaveAttribute("aria-selected", "false");
    expect(active).toHaveAttribute("data-active");
    expect(saved).toHaveAttribute("aria-selected", "true");
    expect(saved).not.toHaveAttribute("data-active");
  });
});

describe("Select — describedby composition", () => {
  it("keeps an external id, the helper and the error together when all three exist", () => {
    render(
      <Select
        label="Modelo"
        options={OPTIONS}
        emptyValue=""
        aria-describedby="external-hint"
        helper="Elige uno."
        error="Obligatorio"
      />,
    );

    const trigger = getCombobox();
    const ids = trigger.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe("external-hint");
    expect(ids.slice(1).map((id) => document.getElementById(id)!.textContent)).toEqual([
      "Elige uno.",
      "Obligatorio",
    ]);
    expect(trigger).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Select — pointer reopen", () => {
  it("reopens on a bare click after committing with Enter and toggles closed again", async () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);
    const trigger = getCombobox();
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("listbox")).toBeNull();

    await userEvent.click(trigger);
    expect(getListbox()).toBeInTheDocument();

    await userEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("reopens on a bare click after committing a searchable value", async () => {
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" searchable />);
    const input = getCombobox();

    await userEvent.click(input);
    await userEvent.type(input, "op");
    await userEvent.keyboard("{Enter}");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect((input as HTMLInputElement).value).toBe("OpenAI Mini");

    await userEvent.click(input);
    expect(getListbox()).toBeInTheDocument();
  });
});

describe("Select — mobile sheet", () => {
  it("renders the same listbox inside a modal sheet at 390 px", async () => {
    stubViewport(390);
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" />);

    await userEvent.click(getCombobox());

    const dialog = screen.getByRole("dialog", { name: "Modelo" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.querySelector("[data-popover]")).toBeNull();

    const listbox = within(dialog).getByRole("listbox");
    expect(getCombobox().getAttribute("aria-controls")).toBe(listbox.id);
    expect(document.getElementById(listbox.id)).toBe(listbox);
    expect(within(dialog).getAllByRole("option")).toHaveLength(4);
  });

  it("closes only the sheet on Escape without committing and returns focus", async () => {
    stubViewport(390);
    const onChange = vi.fn();
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" onChange={onChange} />);
    const trigger = getCombobox();

    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Modelo" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("moves the active row and commits from the sheet with the keyboard", async () => {
    stubViewport(390);
    const onChange = vi.fn();
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" onChange={onChange} />);

    await userEvent.click(getCombobox());
    const dialog = screen.getByRole("dialog", { name: "Modelo" });
    const body = dialog.querySelector<HTMLElement>("[data-select-sheet]");
    expect(body).not.toBeNull();
    await waitFor(() => expect(body).toHaveFocus());

    fireEvent.keyDown(body!, { key: "ArrowDown" });
    expect(activeOption().textContent).toContain("OpenAI Mini");

    fireEvent.keyDown(body!, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("openai/mini");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("filters from the sheet search field without reopening it after a commit", async () => {
    stubViewport(390);
    const onChange = vi.fn();
    render(<Select label="Modelo" options={OPTIONS} emptyValue="" searchable onChange={onChange} />);
    const trigger = getCombobox();

    await userEvent.click(trigger);
    const search = within(screen.getByRole("dialog")).getByRole("searchbox");
    await waitFor(() => expect(search).toHaveFocus());

    await userEvent.type(search, "deep");
    expect(optionRows()).toHaveLength(2);

    await userEvent.click(optionByLabel("DeepSeek V4.1 Flash"));
    expect(onChange).toHaveBeenCalledWith("deepseek/v4.1-flash");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect((trigger as HTMLInputElement).value).toBe("DeepSeek V4.1 Flash");
  });
});
