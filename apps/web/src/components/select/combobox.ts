import { normalize, type SelectOption } from "./options.ts";

/** Single-select commits the active row and closes; multi-select toggles and stays open. */
export type ComboboxMode = "single" | "multi";

export type TypeaheadBuffer = { readonly buffer: string; readonly at: number };

export type TypeaheadStep = {
  readonly typeahead: TypeaheadBuffer;
  readonly value: string | undefined;
};

const TYPEAHEAD_RESET_MS = 500;

export function enabledOptions(options: readonly SelectOption[]): readonly SelectOption[] {
  return options.filter((option) => option.disabled !== true);
}

/** Listbox mints row ids as `<listboxId>-option-<index>` over the rows it receives (pinned included). */
export function optionId(
  listboxId: string,
  ordered: readonly SelectOption[],
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const index = ordered.findIndex((option) => option.value === value);
  return index < 0 ? undefined : `${listboxId}-option-${index}`;
}

/** Single-select clamps at both ends; multi-select wraps because its popup stays open. */
export function moveActiveValue(
  enabled: readonly SelectOption[],
  activeValue: string | undefined,
  delta: 1 | -1,
  mode: ComboboxMode,
): string | undefined {
  if (enabled.length === 0) return undefined;
  const index = enabled.findIndex((option) => option.value === activeValue);
  if (index < 0) return (delta > 0 ? enabled[0] : enabled[enabled.length - 1])?.value;
  if (mode === "multi") return enabled[(index + delta + enabled.length) % enabled.length]?.value;
  return enabled[Math.min(Math.max(index + delta, 0), enabled.length - 1)]?.value;
}

export function jumpActiveValue(
  enabled: readonly SelectOption[],
  position: "first" | "last",
): string | undefined {
  if (enabled.length === 0) return undefined;
  return (position === "first" ? enabled[0] : enabled[enabled.length - 1])?.value;
}

export function stepTypeahead(
  enabled: readonly SelectOption[],
  previous: TypeaheadBuffer,
  character: string,
  now: number = Date.now(),
): TypeaheadStep {
  const buffer = now - previous.at > TYPEAHEAD_RESET_MS ? character : previous.buffer + character;
  const typeahead = { buffer, at: now };
  const needle = normalize(buffer);
  if (needle.length === 0) return { typeahead, value: undefined };
  const match = enabled.find((option) => normalize(option.label).startsWith(needle));
  return { typeahead, value: match?.value };
}

/** A click in a single-select query input only moves the caret; every other click toggles. */
export function triggerClickAction(
  mode: ComboboxMode,
  open: boolean,
  { searchable = false }: { readonly searchable?: boolean } = {},
): "open" | "close" | "keep" {
  if (!open) return "open";
  if (mode === "single" && searchable) return "keep";
  return "close";
}
