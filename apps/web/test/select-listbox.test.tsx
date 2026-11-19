import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Listbox } from "../src/components/select/listbox.tsx";
import type { SelectMeta, SelectOption } from "../src/components/select/options.ts";
import { badge } from "../src/ui.ts";

function option(overrides: Partial<SelectOption> & { value: string; label: string }): SelectOption {
  return { ...overrides };
}

const grouped: readonly SelectOption[] = [
  option({
    value: "deepseek/v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    description: "deepseek/v4.1-flash",
    group: "deepseek",
    meta: [
      { label: "visión", tone: "agent" },
      { label: "1 $/M", tone: "muted" },
    ],
  }),
  option({
    value: "openai/mini",
    label: "OpenAI Mini",
    description: "openai/mini",
    group: "openai",
  }),
  option({
    value: "deepseek/pro",
    label: "DeepSeek Pro",
    description: "deepseek/pro",
    group: "deepseek",
  }),
  option({ value: "local/model", label: "Modelo local" }),
];

const BACKGROUND_CLASSES = ["bg-panel-2", "bg-panel-2/60"] as const;

function optionRow(container: HTMLElement, label: string): HTMLElement {
  const row = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).find((element) =>
    element.textContent?.includes(label),
  );
  if (row === undefined) throw new Error(`No option row for label: ${label}`);
  return row;
}

function backgrounds(row: HTMLElement): readonly string[] {
  return BACKGROUND_CLASSES.filter((name) => row.classList.contains(name));
}

function groupHeaders(container: HTMLElement): readonly string[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-listbox-group-header]")).map(
    (header) => header.textContent ?? "",
  );
}

describe("Listbox — structure", () => {
  it("renders one listbox with the given id and groups in first-appearance order", () => {
    const { container } = render(
      <Listbox id="model-listbox" options={grouped} emptyLabel="Sin opciones" noResultsLabel="Sin resultados" />,
    );

    const listbox = container.querySelector<HTMLElement>('[role="listbox"]');
    expect(listbox).not.toBeNull();
    expect(listbox!.getAttribute("id")).toBe("model-listbox");
    expect(document.getElementById("model-listbox")).toBe(listbox);

    expect(groupHeaders(container)).toEqual(["deepseek", "openai"]);

    const rows = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(rows.map((row) => row.textContent?.replace(/\s+/g, " ").trim().slice(0, 20))).toHaveLength(4);
    expect(rows[0]!.textContent).toContain("DeepSeek V4.1 Flash");
    expect(rows[1]!.textContent).toContain("DeepSeek Pro");
    expect(rows[2]!.textContent).toContain("OpenAI Mini");
    expect(rows[3]!.textContent).toContain("Modelo local");
  });

  it("labels every group with its header through aria-labelledby", () => {
    render(<Listbox id="model-listbox" options={grouped} emptyLabel="Sin opciones" />);

    for (const name of ["deepseek", "openai"]) {
      const group = screen.getByRole("group", { name });
      const headerId = group.getAttribute("aria-labelledby");
      expect(headerId).toBeTruthy();
      const header = document.getElementById(headerId!);
      expect(header).not.toBeNull();
      expect(header!.textContent).toBe(name);
      expect(header!.closest('[role="group"]')).toBe(group);
    }
  });

  it("keeps ungrouped options outside any group, including an empty group string", () => {
    const { container } = render(
      <Listbox
        id="model-listbox"
        options={[
          option({ value: "a", label: "Agrupada", group: "proveedor" }),
          option({ value: "b", label: "Sin grupo" }),
          option({ value: "c", label: "Grupo vacío", group: "" }),
        ]}
        emptyLabel="Sin opciones"
      />,
    );

    const loose = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).filter(
      (row) => row.closest('[role="group"]') === null,
    );
    expect(loose.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Sin grupo"),
      expect.stringContaining("Grupo vacío"),
    ]);
    expect(groupHeaders(container)).toEqual(["proveedor"]);
  });

  it("passes className through to the wrapper without touching the listbox id", () => {
    const { container } = render(
      <Listbox id="model-listbox" options={grouped} emptyLabel="Sin opciones" className="max-w-sm" />,
    );

    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    expect(container.querySelector(".max-w-sm")!.contains(listbox)).toBe(true);
    expect(listbox.getAttribute("id")).toBe("model-listbox");
  });
});

describe("Listbox — active row", () => {
  it("names the single data-active row through aria-activedescendant", () => {
    const { container } = render(
      <Listbox id="model-listbox" options={grouped} activeValue="deepseek/pro" emptyLabel="Sin opciones" />,
    );

    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    const activeRows = container.querySelectorAll<HTMLElement>("[data-active]");
    expect(activeRows).toHaveLength(1);

    const activeId = listbox.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId!)).toBe(activeRows[0]);
    expect(activeRows[0]!.textContent).toContain("DeepSeek Pro");

    const selected = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).filter(
      (row) => row.getAttribute("aria-selected") === "true",
    );
    expect(selected).toEqual([activeRows[0]]);
  });

  it("moves data-active exactly once when activeValue changes", () => {
    const view = render(
      <Listbox id="model-listbox" options={grouped} activeValue="deepseek/v4.1-flash" emptyLabel="Sin opciones" />,
    );

    expect(optionRow(view.container, "DeepSeek V4.1 Flash")).toHaveAttribute("data-active");

    view.rerender(
      <Listbox id="model-listbox" options={grouped} activeValue="openai/mini" emptyLabel="Sin opciones" />,
    );

    const listbox = view.container.querySelector<HTMLElement>('[role="listbox"]')!;
    const activeRows = view.container.querySelectorAll<HTMLElement>("[data-active]");
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]!.textContent).toContain("OpenAI Mini");
    expect(optionRow(view.container, "DeepSeek V4.1 Flash")).not.toHaveAttribute("data-active");
    expect(document.getElementById(listbox.getAttribute("aria-activedescendant")!)).toBe(activeRows[0]);
  });

  it("renders no active row and no aria-activedescendant without activeValue", () => {
    const { container } = render(<Listbox id="model-listbox" options={grouped} emptyLabel="Sin opciones" />);

    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    expect(listbox).not.toHaveAttribute("aria-activedescendant");
    expect(container.querySelectorAll("[data-active]")).toHaveLength(0);
    expect(container.querySelectorAll('[role="option"][aria-selected="true"]')).toHaveLength(0);
  });

  it("ignores an activeValue that matches no option", () => {
    const { container } = render(
      <Listbox id="model-listbox" options={grouped} activeValue="missing/option" emptyLabel="Sin opciones" />,
    );

    expect(container.querySelectorAll("[data-active]")).toHaveLength(0);
    expect(container.querySelector<HTMLElement>('[role="listbox"]')).not.toHaveAttribute(
      "aria-activedescendant",
    );
  });
});

describe("Listbox — rows", () => {
  it("renders rows as non-focusable options with aria-disabled", () => {
    const { container } = render(
      <Listbox
        id="model-listbox"
        options={[option({ value: "a", label: "Disponible" }), option({ value: "b", label: "Deshabilitada", disabled: true })]}
        emptyLabel="Sin opciones"
      />,
    );

    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
    for (const row of screen.getAllByRole("option")) {
      expect(row.tabIndex).toBe(-1);
      expect(row).toHaveAttribute("aria-selected");
    }
    expect(optionRow(container, "Deshabilitada")).toHaveAttribute("aria-disabled", "true");
    expect(optionRow(container, "Disponible")).not.toHaveAttribute("aria-disabled");
  });

  it("renders the description as an 11 px line", () => {
    const { container } = render(<Listbox id="model-listbox" options={grouped} emptyLabel="Sin opciones" />);

    const description = optionRow(container, "DeepSeek V4.1 Flash").querySelector<HTMLElement>(
      "[data-listbox-description]",
    );
    expect(description).not.toBeNull();
    expect(description!.textContent).toBe("deepseek/v4.1-flash");
    expect(description!.className).toContain("text-micro");
    expect(description!.className).not.toContain("text-[13px]");
    expect(description!.getAttribute("title")).toBe("deepseek/v4.1-flash");
  });

  it("renders meta chips with the shared badge and tone classes", () => {
    const meta: readonly SelectMeta[] = [
      { label: "info", tone: "info" },
      { label: "agent", tone: "agent" },
      { label: "ok", tone: "ok" },
      { label: "warn", tone: "warn" },
      { label: "muted", tone: "muted" },
      { label: "desconocido", tone: "desconocido" as never },
    ];
    const { container } = render(
      <Listbox
        id="tone-listbox"
        options={[option({ value: "tones", label: "Tonos", meta })]}
        emptyLabel="Sin opciones"
      />,
    );

    const chips = Array.from(container.querySelectorAll<HTMLElement>("[data-listbox-chip]"));
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "info",
      "agent",
      "ok",
      "warn",
      "muted",
      "desconocido",
    ]);

    const toneClasses = ["text-accent", "text-violet", "text-ok", "text-warn"];
    expect(chips[0]!.className).toContain(badge);
    expect(chips[0]!.className).toContain("text-accent");
    expect(chips[1]!.className).toContain("text-violet");
    expect(chips[2]!.className).toContain("text-ok");
    expect(chips[3]!.className).toContain("text-warn");
    for (const chip of chips.slice(4)) {
      expect(chip.className).toContain(badge);
      for (const toneClass of toneClasses) expect(chip.className).not.toContain(toneClass);
    }
    expect(chips[1]!.getAttribute("title")).toBeNull();
  });

  it("computes exactly one background class per row", () => {
    const { container } = render(
      <Listbox id="model-listbox" options={grouped} activeValue="deepseek/pro" emptyLabel="Sin opciones" />,
    );

    const active = optionRow(container, "DeepSeek Pro");
    expect(backgrounds(active)).toHaveLength(1);

    fireEvent.mouseEnter(active);
    expect(backgrounds(optionRow(container, "DeepSeek Pro"))).toEqual(["bg-panel-2"]);

    const other = optionRow(container, "OpenAI Mini");
    expect(backgrounds(other)).toHaveLength(0);
    fireEvent.mouseEnter(other);
    expect(backgrounds(optionRow(container, "OpenAI Mini"))).toHaveLength(1);
    expect(backgrounds(optionRow(container, "OpenAI Mini"))).not.toContain("bg-panel-2");

    fireEvent.mouseLeave(other);
    expect(backgrounds(optionRow(container, "OpenAI Mini"))).toHaveLength(0);
    expect(backgrounds(optionRow(container, "DeepSeek Pro"))).toEqual(["bg-panel-2"]);
  });

  it("reports hover and select for enabled rows and skips disabled ones", () => {
    const onHover = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <Listbox
        id="model-listbox"
        options={grouped}
        emptyLabel="Sin opciones"
        onHover={onHover}
        onSelect={onSelect}
        activeValue="openai/mini"
      />,
    );

    const enabled = optionRow(container, "OpenAI Mini");
    fireEvent.mouseEnter(enabled);
    expect(onHover).toHaveBeenCalledTimes(1);
    expect(onHover.mock.calls[0]![0]).toMatchObject({ value: "openai/mini" });

    expect(fireEvent.mouseDown(enabled)).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]).toMatchObject({ value: "openai/mini" });

    const disabled = render(
      <Listbox
        id="disabled-listbox"
        options={[option({ value: "off", label: "Apagada", disabled: true })]}
        emptyLabel="Sin opciones"
        onHover={onHover}
        onSelect={onSelect}
      />,
    );
    const blocked = optionRow(disabled.container, "Apagada");
    fireEvent.mouseEnter(blocked);
    fireEvent.mouseDown(blocked);
    expect(onHover).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("Listbox — states", () => {
  it("keeps a real empty listbox in the DOM when there are no options", () => {
    const { container } = render(<Listbox id="empty-listbox" options={[]} emptyLabel="Sin opciones disponibles" />);

    const listbox = document.getElementById("empty-listbox");
    expect(listbox).not.toBeNull();
    expect(listbox!.getAttribute("role")).toBe("listbox");
    expect(listbox!.childElementCount).toBe(0);
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Sin opciones disponibles");
  });

  it("announces the no-results copy with role=status while keeping the listbox mounted", () => {
    const { container } = render(
      <Listbox
        id="no-results-listbox"
        options={[]}
        emptyLabel="Sin opciones disponibles"
        noResultsLabel="Sin resultados para «deep»"
      />,
    );

    expect(document.getElementById("no-results-listbox")).not.toBeNull();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultados para «deep»");
    expect(screen.getByRole("status")).not.toHaveTextContent("Sin opciones disponibles");
  });

  it("marks the listbox busy and announces loading without rendering stale rows", () => {
    const { container, rerender } = render(
      <Listbox
        id="model-listbox"
        options={grouped}
        emptyLabel="Sin opciones"
        loading
        loadingLabel="Cargando modelos…"
      />,
    );

    const listbox = container.querySelector<HTMLElement>('[role="listbox"]')!;
    expect(listbox).toHaveAttribute("aria-busy", "true");
    expect(listbox).not.toHaveAttribute("aria-activedescendant");
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando modelos…");

    rerender(<Listbox id="model-listbox" options={grouped} emptyLabel="Sin opciones" />);
    expect(listbox).not.toHaveAttribute("aria-busy");
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(4);
  });

  it("renders an alert with a retry action on error", () => {
    const onRetry = vi.fn();
    const { container } = render(
      <Listbox
        id="error-listbox"
        options={grouped}
        emptyLabel="Sin opciones"
        error="No se pudieron cargar los modelos."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los modelos.");
    expect(document.getElementById("error-listbox")).not.toBeNull();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when no retry handler is provided", () => {
    render(
      <Listbox id="error-listbox" options={[]} emptyLabel="Sin opciones" error="Falló la carga." />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Falló la carga.");
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });

  it("drops the header of a group whose options were filtered away", () => {
    const filtered = grouped.filter((entry) => entry.group !== "openai");
    const { container } = render(<Listbox id="model-listbox" options={filtered} emptyLabel="Sin opciones" />);

    expect(groupHeaders(container)).toEqual(["deepseek"]);
    expect(screen.queryByRole("group", { name: "openai" })).toBeNull();
    expect(container.textContent).not.toContain("openai");
  });
});

describe("Listbox — scroll shadows", () => {
  it("drives the top and bottom shadows from the inner scroller position", () => {
    const many = Array.from({ length: 20 }, (_unused, index) =>
      option({ value: `value-${index}`, label: `Opción ${index}` }),
    );
    const { container } = render(<Listbox id="scroll-listbox" options={many} emptyLabel="Sin opciones" />);

    const scroller = container.querySelector<HTMLElement>("[data-listbox-scroller]");
    expect(scroller).not.toBeNull();
    Object.defineProperty(scroller!, "scrollHeight", { configurable: true, value: 640 });
    Object.defineProperty(scroller!, "clientHeight", { configurable: true, value: 320 });

    expect(container.querySelector('[data-scroll-shadow="top"]')).toBeNull();
    expect(container.querySelector('[data-scroll-shadow="bottom"]')).toBeNull();

    fireEvent.scroll(scroller!);
    expect(container.querySelector('[data-scroll-shadow="top"]')).toBeNull();
    const bottom = container.querySelector<HTMLElement>('[data-scroll-shadow="bottom"]');
    expect(bottom).not.toBeNull();
    expect(bottom!.getAttribute("aria-hidden")).toBe("true");

    scroller!.scrollTop = 120;
    fireEvent.scroll(scroller!);
    expect(container.querySelector('[data-scroll-shadow="top"]')).not.toBeNull();
    expect(container.querySelector('[data-scroll-shadow="bottom"]')).not.toBeNull();

    scroller!.scrollTop = 320;
    fireEvent.scroll(scroller!);
    expect(container.querySelector('[data-scroll-shadow="top"]')).not.toBeNull();
    expect(container.querySelector('[data-scroll-shadow="bottom"]')).toBeNull();

    scroller!.scrollTop = 0;
    fireEvent.scroll(scroller!);
    expect(container.querySelector('[data-scroll-shadow="top"]')).toBeNull();
    expect(container.querySelector('[data-scroll-shadow="bottom"]')).not.toBeNull();
  });

  it("shows no shadows when the content fits the scroller", () => {
    const { container } = render(<Listbox id="scroll-listbox" options={grouped} emptyLabel="Sin opciones" />);

    const scroller = container.querySelector<HTMLElement>("[data-listbox-scroller]")!;
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 200 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 200 });
    fireEvent.scroll(scroller);

    expect(container.querySelector('[data-scroll-shadow="top"]')).toBeNull();
    expect(container.querySelector('[data-scroll-shadow="bottom"]')).toBeNull();
  });
});
