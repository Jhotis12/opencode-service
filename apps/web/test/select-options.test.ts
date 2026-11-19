import { describe, expect, it } from "vitest";
import type { ModelInfo } from "../src/api.ts";
import {
  MAX_VISIBLE,
  defaultFilter,
  groupOrder,
  metaTone,
  modelOptions,
  normalize,
  orderOptions,
  simpleOptions,
  type SelectOption,
} from "../src/components/select/options.ts";

function model(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return { providerID: "deepseek", modelID: "v4.1-flash", name: "DeepSeek V4.1 Flash", ...overrides };
}

function option(overrides: Partial<SelectOption> & { value: string; label: string }): SelectOption {
  return { ...overrides };
}

describe("normalize", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalize("Visión")).toBe("vision");
    expect(normalize("ÑANDÚ")).toBe("nandu");
    expect(normalize("  Compré  ")).toBe("  compre  ");
  });

  it("returns an empty string for empty input", () => {
    expect(normalize("")).toBe("");
  });
});

describe("defaultFilter", () => {
  const target = option({
    value: "deepseek/v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    description: "Proveedor rápido",
    keywords: ["rápido", "economico"],
  });

  it("matches label, description, keywords and value without accents or case", () => {
    expect(defaultFilter(target, "deepseek")).toBe(true);
    expect(defaultFilter(target, "VISION")).toBe(false);
    expect(defaultFilter(target, "proveedor")).toBe(true);
    expect(defaultFilter(target, "RAPIDO")).toBe(true);
    expect(defaultFilter(target, "flash")).toBe(true);
  });

  it("matches every option when the query is blank or undefined-ish", () => {
    expect(defaultFilter(target, "")).toBe(true);
    expect(defaultFilter(target, "   ")).toBe(true);
    expect(defaultFilter(target, undefined as unknown as string)).toBe(true);
    expect(defaultFilter(target, null as unknown as string)).toBe(true);
  });

  it("does not throw for an option with an empty group", () => {
    const ungrouped = option({ value: "x", label: "X", group: "" });
    expect(defaultFilter(ungrouped, "nope")).toBe(false);
    expect(defaultFilter(ungrouped, "x")).toBe(true);
  });
});

describe("groupOrder", () => {
  it("returns groups in first-appearance order and drops the ungrouped bucket", () => {
    const options = [
      option({ value: "a", label: "A", group: "openai" }),
      option({ value: "b", label: "B" }),
      option({ value: "c", label: "C", group: "deepseek" }),
      option({ value: "d", label: "D", group: "openai" }),
      option({ value: "e", label: "E", group: "" }),
    ];
    expect(groupOrder(options)).toEqual(["openai", "deepseek"]);
  });
});

describe("orderOptions", () => {
  it("groups options, keeping the ungrouped bucket last and order stable inside a group", () => {
    const options = [
      option({ value: "d1", label: "D1", group: "deepseek" }),
      option({ value: "u1", label: "U1" }),
      option({ value: "o1", label: "O1", group: "openai" }),
      option({ value: "d2", label: "D2", group: "deepseek" }),
      option({ value: "u2", label: "U2", group: "" }),
    ];

    expect(orderOptions(options).map((entry) => entry.value)).toEqual(["d1", "d2", "o1", "u1", "u2"]);
  });

  it("does not mutate its input", () => {
    const options = Object.freeze([
      Object.freeze(option({ value: "b", label: "B", group: "z" })),
      Object.freeze(option({ value: "a", label: "A", group: "a" })),
    ]) as readonly SelectOption[];

    expect(() => orderOptions(options)).not.toThrow();
    expect(options.map((entry) => entry.value)).toEqual(["b", "a"]);
  });
});

describe("metaTone", () => {
  it("falls back to muted for unknown or missing tones", () => {
    expect(metaTone("ok")).toBe("ok");
    expect(metaTone("party")).toBe("muted");
    expect(metaTone(undefined)).toBe("muted");
  });
});

describe("modelOptions", () => {
  it("maps a model to a grouped, searchable option", () => {
    const [entry] = modelOptions([model({ input: ["text", "image"] })]);

    expect(entry).toEqual({
      value: "deepseek/v4.1-flash",
      label: "DeepSeek V4.1 Flash",
      description: "deepseek/v4.1-flash",
      group: "deepseek",
      meta: [{ label: "visión", tone: "agent" }],
      keywords: ["deepseek", "v4.1-flash"],
    });
  });

  it("groups two models of one provider and matches an accented query through keywords", () => {
    const entries = modelOptions([
      model({ modelID: "v4.1-flash", name: "DeepSeek V4.1 Flash", input: ["text", "image"] }),
      model({ modelID: "v4.1-pro", name: "DeepSeek V4.1 Pro", input: ["text"] }),
    ]);

    expect(entries.map((entry) => entry.group)).toEqual(["deepseek", "deepseek"]);
    expect(entries[0]?.meta).toContainEqual({ label: "visión", tone: "agent" });
    expect(entries[1]?.meta).toBeUndefined();
    expect(entries[0] && defaultFilter(entries[0], "FLASH")).toBe(true);
    expect(entries[1] && defaultFilter(entries[1], "flash")).toBe(false);
  });

  it("adds a cost chip only when cost.input is a number", () => {
    const [priced, free, outputOnly, notFinite] = modelOptions([
      model({ modelID: "priced", cost: { input: 0.27, output: 1.1 } }),
      model({ modelID: "free" }),
      model({ modelID: "output-only", cost: { output: 1.1 } }),
      model({ modelID: "not-finite", cost: { input: Number.NaN } }),
    ]);

    expect(priced?.meta).toEqual([{ label: "0.27 $/M", tone: "muted" }]);
    expect(free?.meta).toBeUndefined();
    expect(outputOnly?.meta).toBeUndefined();
    expect(notFinite?.meta).toBeUndefined();
  });

  it("keeps the vision chip ahead of the cost chip", () => {
    const [entry] = modelOptions([model({ input: ["text", "image"], cost: { input: 0.5 } })]);

    expect(entry?.meta).toEqual([
      { label: "visión", tone: "agent" },
      { label: "0.5 $/M", tone: "muted" },
    ]);
  });

  it("returns an empty list for an empty catalogue", () => {
    expect(modelOptions([])).toEqual([]);
  });

  it("is pure: same input yields the same output and leaves the input untouched", () => {
    const models = Object.freeze([Object.freeze(model({ input: ["text", "image"], cost: { input: 0.1 } }))]);

    const first = modelOptions(models);
    const second = modelOptions(models);

    expect(first).toEqual(second);
    expect(models[0]).toMatchObject({ providerID: "deepseek", modelID: "v4.1-flash" });
  });
});

describe("simpleOptions", () => {
  it("maps items and drops undefined results", () => {
    const items = ["alpha", "beta", "gamma"] as const;
    const entries = simpleOptions(items, (item, index) =>
      item === "beta" ? undefined : { value: item, label: `${index}-${item}` },
    );

    expect(entries).toEqual([
      { value: "alpha", label: "0-alpha" },
      { value: "gamma", label: "2-gamma" },
    ]);
  });

  it("supports a group per item", () => {
    const entries = simpleOptions([{ id: "1", name: "Uno" }], (item) => ({
      value: item.id,
      label: item.name,
      group: "items",
    }));

    expect(entries).toEqual([{ value: "1", label: "Uno", group: "items" }]);
  });
});

describe("MAX_VISIBLE", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(MAX_VISIBLE)).toBe(true);
    expect(MAX_VISIBLE).toBeGreaterThan(0);
  });
});
