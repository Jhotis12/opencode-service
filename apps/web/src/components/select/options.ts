import type { ModelInfo } from "../../api.ts";
import type { ProjectDestination } from "@platform/shared";

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

export const DESTINATION_KIND_LABELS: Record<ProjectDestination["kind"], string> = {
  telegram_chat: "Chat de Telegram",
  whatsapp: "Chat de WhatsApp",
  email: "Email",
  webhook: "Webhook",
  custom: "Otro",
};

/**
 * Catalogue rows for a destination picker. The kind is a real grouping only when the project
 * mixes kinds, so a single-kind catalogue stays a flat list instead of one lonely header.
 */
export function destinationOptions(destinations: readonly ProjectDestination[]): readonly SelectOption[] {
  const grouped = new Set(destinations.map((destination) => destination.kind)).size > 1;
  return destinations.map((destination) => ({
    value: destination.id,
    label: `${destination.label} · ${destination.value}`,
    ...(grouped ? { group: DESTINATION_KIND_LABELS[destination.kind] } : {}),
  }));
}

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

// The empty value ("inherit"/"none") is the row a caller returns to, so it always leads
// the keyboard order; the grouped catalogue follows and ungrouped rows close the list.
export function orderOptions(options: readonly SelectOption[]): readonly SelectOption[] {
  const order = groupOrder(options);
  const empty = options.filter((option) => option.value === "");
  const rest = options.filter((option) => option.value !== "");
  const grouped = order.flatMap((group) => rest.filter((option) => option.group === group));
  const ungrouped = rest.filter((option) => !option.group);
  return [...empty, ...grouped, ...ungrouped];
}

/**
 * The empty choice of a model picker. The label is a parameter because the same row means
 * something different per surface: the project bar inherits the PROJECT default, while an
 * agent inherits the FLOW model. The emitted value stays `""` for every caller.
 */
export function inheritModelOption(label: string): SelectOption {
  return { value: "", label };
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
