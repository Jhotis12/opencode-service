import type { ModelInfo } from "../../api.ts";

export type SelectMetaTone = "muted" | "info" | "agent" | "ok" | "warn";

export interface SelectMeta {
  readonly label: string;
  readonly title?: string;
  readonly tone?: SelectMetaTone;
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly group?: string;
  readonly disabled?: boolean;
  readonly meta?: readonly SelectMeta[];
  readonly keywords?: readonly string[];
}

export const MAX_VISIBLE = 8;

const META_TONES: readonly SelectMetaTone[] = ["muted", "info", "agent", "ok", "warn"];

export function metaTone(tone: string | undefined): SelectMetaTone {
  return META_TONES.includes(tone as SelectMetaTone) ? (tone as SelectMetaTone) : "muted";
}

export function normalize(text: string): string {
  const lowercased = String(text ?? "").toLowerCase();
  // NFD splits accented glyphs into base + combining mark; this strips the marks.
  return lowercased.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function defaultFilter(option: SelectOption, query: string): boolean {
  const needle = normalize(query).trim();
  if (!needle) return true;
  const haystack = [
    option.label,
    option.description,
    option.value,
    ...(option.keywords ?? []),
  ].map((entry) => normalize(entry ?? ""));
  return haystack.some((entry) => entry.includes(needle));
}

export function groupOrder(options: readonly SelectOption[]): readonly string[] {
  const order: string[] = [];
  for (const option of options) {
    const group = option.group;
    if (!group) continue;
    if (!order.includes(group)) order.push(group);
  }
  return order;
}

export function orderOptions(options: readonly SelectOption[]): readonly SelectOption[] {
  const order = groupOrder(options);
  const grouped = order.flatMap((group) => options.filter((option) => option.group === group));
  const ungrouped = options.filter((option) => !option.group);
  return [...grouped, ...ungrouped];
}

function formatCost(input: number): string {
  return `${input} $/M`;
}

export function modelOptions(models: readonly ModelInfo[]): readonly SelectOption[] {
  return models.map((model) => {
    const ref = `${model.providerID}/${model.modelID}`;
    const meta: SelectMeta[] = [];
    const vision = (model.input ?? []).some((input) => input.toLowerCase().includes("image"));
    if (vision) meta.push({ label: "visión", tone: "agent" });
    const costInput = model.cost?.input;
    if (typeof costInput === "number" && Number.isFinite(costInput)) {
      meta.push({ label: formatCost(costInput), tone: "muted" });
    }
    return {
      value: ref,
      label: model.name,
      description: ref,
      group: model.providerID,
      ...(meta.length > 0 ? { meta } : {}),
      keywords: [model.providerID, model.modelID],
    };
  });
}

export function simpleOptions<T>(
  items: readonly T[],
  map: (item: T, index: number) => SelectOption | undefined,
): readonly SelectOption[] {
  const result: SelectOption[] = [];
  items.forEach((item, index) => {
    const mapped = map(item, index);
    if (mapped) result.push(mapped);
  });
  return result;
}
