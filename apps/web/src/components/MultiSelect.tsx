import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { Listbox } from "./select/listbox.tsx";
import { Popover } from "./select/popover.tsx";
import { defaultFilter, orderOptions, type SelectOption } from "./select/options.ts";
import { field, fieldError, fieldLabel, focusRing, input, smallMuted } from "../ui.ts";

export type MultiSelectProps = {
  readonly options: readonly SelectOption[];
  readonly value?: readonly string[];
  readonly defaultValue?: readonly string[];
  readonly onChange?: (next: string[]) => void;
  readonly label?: ReactNode;
  readonly placeholder?: string;
  readonly searchLabel?: string;
  readonly emptyLabel?: string;
  readonly noResultsLabel?: string;
  readonly helper?: ReactNode;
  readonly error?: ReactNode;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
  readonly loadError?: string | null;
  readonly onRetry?: () => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly id?: string;
  readonly className?: string;
  readonly filter?: (option: SelectOption, query: string) => boolean;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean | "true" | "false";
};

const CHECK_LABEL = "✓";
const CHECK_TITLE = "Seleccionado";
const DEFAULT_PLACEHOLDER = "Selecciona una opción";
const DEFAULT_SEARCH_LABEL = "Buscar";
const DEFAULT_EMPTY_LABEL = "Sin opciones";
const DEFAULT_TRIGGER_LABEL = "Añadir";

const TRIGGER_CLASS = `${input} flex flex-wrap items-center gap-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30`;
const CHIP_CLASS =
  "inline-flex max-w-[14rem] items-center gap-1 rounded-full border border-line bg-panel-2/60 py-0.5 pl-2 pr-1 text-micro text-slate-200";
const REMOVE_CLASS = `shrink-0 rounded-full p-0.5 text-muted transition-colors hover:bg-panel-2 hover:text-slate-200 ${focusRing}`;
const CHEVRON_CLASS = `ml-auto shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-panel-2 hover:text-slate-200 ${focusRing}`;

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function labelFor(options: readonly SelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function firstEnabledValue(
  options: readonly SelectOption[],
  filterFn: (option: SelectOption, query: string) => boolean,
  query: string,
): string | undefined {
  return orderOptions(options.filter((option) => filterFn(option, query))).find(
    (option) => option.disabled !== true,
  )?.value;
}

function optionRowId(
  ordered: readonly SelectOption[],
  value: string | undefined,
  listboxId: string,
): string | undefined {
  if (value === undefined) return undefined;
  const index = ordered.findIndex((option) => option.value === value);
  return index < 0 ? undefined : `${listboxId}-option-${index}`;
}

export function MultiSelect({
  options,
  value,
  defaultValue,
  onChange,
  label,
  placeholder,
  searchLabel,
  emptyLabel,
  noResultsLabel,
  helper,
  error,
  loading = false,
  loadingLabel,
  loadError,
  onRetry,
  disabled = false,
  required = false,
  id,
  className,
  filter,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: MultiSelectProps) {
  const baseId = useId();
  const triggerId = id ?? `${baseId}-trigger`;
  const listboxId = `${baseId}-listbox`;
  const panelId = `${baseId}-popover`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  const [internalValue, setInternalValue] = useState<string[]>(() => dedupe(defaultValue ?? []));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState<string | undefined>(undefined);

  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filterFn = filter ?? defaultFilter;
  const listError = loadError ?? null;
  const canPick = !loading && listError === null;
  const selected = dedupe(value === undefined ? internalValue : value);
  const selectedSet = new Set(selected);
  const filtered = options.filter((option) => filterFn(option, query));
  const ordered = orderOptions(filtered);
  const orderedKey = ordered.map((option) => option.value).join("\u0000");
  const navigable = ordered.filter((option) => option.disabled !== true);
  const rows = filtered.map((option) =>
    selectedSet.has(option.value)
      ? {
          ...option,
          meta: [{ label: CHECK_LABEL, title: CHECK_TITLE, tone: "ok" as const }, ...(option.meta ?? [])],
        }
      : option,
  );
  const activeRowId = canPick ? optionRowId(ordered, activeValue, listboxId) : undefined;
  const describedBy =
    [ariaDescribedBy, helper ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  const triggerLabel =
    typeof label === "string" && label.trim() !== "" ? `${DEFAULT_TRIGGER_LABEL} ${label}` : DEFAULT_TRIGGER_LABEL;
  const resolvedNoResults =
    noResultsLabel ?? (query.trim() === "" ? undefined : `Sin resultados para «${query.trim()}»`);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || activeValue === undefined) return;
    const rowId = optionRowId(ordered, activeValue, listboxId);
    if (rowId === undefined) return;
    const node = document.getElementById(rowId);
    if (node !== null && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeValue, orderedKey, listboxId]);

  function commit(next: readonly string[]) {
    const deduped = dedupe(next);
    if (value === undefined) setInternalValue(deduped);
    onChange?.(deduped);
  }

  function toggle(optionValue: string) {
    if (disabled) return;
    commit(
      selected.includes(optionValue)
        ? selected.filter((entry) => entry !== optionValue)
        : [...selected, optionValue],
    );
  }

  function removeChip(chipValue: string) {
    commit(selected.filter((entry) => entry !== chipValue));
  }

  function openPicker() {
    if (disabled) return;
    setQuery("");
    setActiveValue(firstEnabledValue(options, filterFn, ""));
    setOpen(true);
  }

  function closePicker() {
    const active = document.activeElement;
    const panel = document.getElementById(panelId);
    const focusWasInside = panel !== null && active !== null && panel.contains(active);
    setOpen(false);
    if (focusWasInside) triggerRef.current?.focus();
  }

  function toggleActive() {
    if (!canPick) return;
    const active = navigable.find((option) => option.value === activeValue);
    if (active !== undefined) toggle(active.value);
  }

  function moveActive(delta: 1 | -1) {
    if (!canPick || navigable.length === 0) return;
    const index = navigable.findIndex((option) => option.value === activeValue);
    if (index < 0) {
      setActiveValue((delta === 1 ? navigable[0] : navigable[navigable.length - 1])?.value);
      return;
    }
    setActiveValue(navigable[(index + delta + navigable.length) % navigable.length]?.value);
  }

  function updateQuery(next: string) {
    setQuery(next);
    setActiveValue(firstEnabledValue(options, filterFn, next));
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      toggleActive();
      return;
    }
    if (event.key === " " && query === "") {
      event.preventDefault();
      toggleActive();
      return;
    }
    if (event.key === "Backspace" && query === "") {
      if (selected.length === 0) return;
      event.preventDefault();
      commit(selected.slice(0, -1));
    }
  }

  function onTriggerClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const target = event.target;
    if (target instanceof Element && target.closest("[data-multiselect-chip]") !== null) return;
    if (open) closePicker();
    else openPicker();
  }

  return (
    <div className={className ? `${field} ${className}` : field}>
      {label !== undefined && label !== null ? (
        <label className={fieldLabel} htmlFor={triggerId}>
          {label}
        </label>
      ) : null}
      <div
        ref={anchorRef}
        data-multiselect-trigger=""
        className={`${TRIGGER_CLASS} ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
        onClick={onTriggerClick}
      >
        {selected.map((chipValue) => {
          const text = labelFor(options, chipValue);
          return (
            <span key={chipValue} data-multiselect-chip="" className={CHIP_CLASS}>
              <span className="min-w-0 truncate" title={text}>
                {text}
              </span>
              <button
                type="button"
                aria-label={`Quitar ${text}`}
                title={`Quitar ${text}`}
                className={REMOVE_CLASS}
                disabled={disabled}
                onClick={() => removeChip(chipValue)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </span>
          );
        })}
        {selected.length === 0 ? (
          <span className="min-w-0 truncate text-slate-500">{placeholder ?? DEFAULT_PLACEHOLDER}</span>
        ) : null}
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={CHEVRON_CLASS}
          aria-label={triggerLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-describedby={describedBy}
          aria-invalid={ariaInvalid ?? (error ? true : undefined)}
          aria-required={required ? true : undefined}
          disabled={disabled}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </div>
      {helper ? (
        <p id={hintId} className={smallMuted}>
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={fieldError}>
          {error}
        </p>
      ) : null}
      <Popover open={open} anchorRef={anchorRef} onClose={closePicker} id={panelId}>
        <input
          ref={searchRef}
          type="text"
          role="combobox"
          aria-label={searchLabel ?? DEFAULT_SEARCH_LABEL}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeRowId}
          autoComplete="off"
          spellCheck={false}
          className="mb-1"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        <Listbox
          id={listboxId}
          options={rows}
          selectedValues={selected}
          activeValue={activeValue}
          onHover={(option) => setActiveValue(option.value)}
          onSelect={(option) => toggle(option.value)}
          emptyLabel={emptyLabel ?? DEFAULT_EMPTY_LABEL}
          noResultsLabel={resolvedNoResults}
          loading={loading}
          loadingLabel={loadingLabel}
          error={listError}
          onRetry={onRetry}
        />
      </Popover>
    </div>
  );
}
