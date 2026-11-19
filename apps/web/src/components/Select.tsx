import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Popover } from "./select/popover.tsx";
import { Listbox, type ListboxRow } from "./select/listbox.tsx";
import { SelectSheet } from "./select/sheet.tsx";
import {
  defaultFilter,
  normalize,
  orderOptions,
  type SelectOption,
} from "./select/options.ts";
import { useMediaQuery } from "../useMediaQuery.ts";
import { field, fieldError, fieldLabel, input, smallMuted } from "../ui.ts";

export type SelectProps = {
  readonly options: readonly SelectOption[];
  readonly label: string;
  readonly value?: string;
  readonly defaultValue?: string;
  onChange?(value: string | undefined): void;
  readonly placeholder?: string;
  readonly searchable?: boolean;
  /**
   * Searchable mode only: a typed value absent from `options` may be committed as-is.
   * Without it, unknown text can never be committed.
   */
  readonly allowCustom?: boolean;
  /** Required: the empty option has value "", so each call site declares what it emits. */
  readonly emptyValue: "" | "undefined";
  readonly emptyLabel?: string;
  readonly helper?: string;
  readonly error?: string;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
  readonly noResultsLabel?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly id?: string;
  readonly className?: string;
  readonly filter?: (option: SelectOption, query: string) => boolean;
  onOpenChange?(open: boolean): void;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean | "true" | "false";
};

const SHEET_QUERY = "(max-width: 639px)";
const TYPEAHEAD_RESET_MS = 500;
const DEFAULT_EMPTY_LABEL = "Sin opciones disponibles";
const DEFAULT_NO_RESULTS_LABEL = "Sin resultados";
const UNAVAILABLE_SUFFIX = "(no disponible)";
const CUSTOM_ROW_PREFIX = "Usar";
const ROOT_CLASS = `${field} min-w-0`;
const TRIGGER_CLASS = `${input} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-45`;
const VALUE_CLASS = "min-w-0 truncate";
const PLACEHOLDER_CLASS = "min-w-0 truncate text-slate-500";
const CHEVRON_CLASS = "h-4 w-4 shrink-0 text-muted";

type FocusTarget = "selected" | "first" | "last";

type Typeahead = { readonly buffer: string; readonly at: number };

function optionDomId(listboxId: string, ordered: readonly SelectOption[], value: string): string | undefined {
  const index = ordered.findIndex((option) => option.value === value);
  return index < 0 ? undefined : `${listboxId}-option-${index}`;
}

/**
 * Field clones `id`, `aria-describedby` and `aria-invalid` into its child; passing `id`
 * is therefore the signal that Field already renders the visible label and the messages.
 */
export function Select(props: SelectProps) {
  const {
    options,
    label,
    defaultValue,
    onChange,
    placeholder,
    searchable = false,
    allowCustom = false,
    emptyValue,
    emptyLabel,
    helper,
    error,
    loading = false,
    loadingLabel,
    noResultsLabel,
    disabled = false,
    required = false,
    className,
    filter,
    onOpenChange,
  } = props;

  const controlled = "value" in props;
  const [innerValue, setInnerValue] = useState<string | undefined>(defaultValue);
  const currentValue = controlled ? props.value : innerValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState<string | undefined>(undefined);
  const triggerRef = useRef<HTMLElement | null>(null);
  const typeahead = useRef<Typeahead>({ buffer: "", at: 0 });
  const suppressFocusOpen = useRef(false);

  const generatedId = useId();
  const triggerId = props.id ?? generatedId;
  const listboxId = `${triggerId}-listbox`;
  const helperId = `${triggerId}-helper`;
  const errorId = `${triggerId}-error`;
  const standalone = props.id === undefined;
  const isSheet = useMediaQuery(SHEET_QUERY);

  const setTrigger = useCallback((element: HTMLElement | null) => {
    triggerRef.current = element;
  }, []);

  const queryText = query.trim();
  const filtered = useMemo(() => {
    if (!searchable || queryText.length === 0) return options;
    const matches = filter ?? defaultFilter;
    return options.filter((option) => matches(option, query));
  }, [options, searchable, queryText, query, filter]);

  const savedValue =
    currentValue !== undefined &&
    currentValue.length > 0 &&
    !options.some((option) => option.value === currentValue)
      ? currentValue
      : undefined;

  const exactMatch = options.some(
    (option) => option.value === queryText || normalize(option.label).trim() === normalize(queryText).trim(),
  );
  const customValue =
    searchable && allowCustom && queryText.length > 0 && !exactMatch ? queryText : undefined;

  const pinned = useMemo<readonly ListboxRow[]>(() => {
    const rows: ListboxRow[] = [];
    if (customValue !== undefined) {
      rows.push({ value: customValue, label: `${CUSTOM_ROW_PREFIX} «${customValue}»` });
    }
    if (savedValue !== undefined) {
      rows.push({ value: savedValue, label: savedValue, suffix: UNAVAILABLE_SUFFIX });
    }
    return rows;
  }, [customValue, savedValue]);

  const ordered = useMemo(() => [...pinned, ...orderOptions(filtered)], [pinned, filtered]);
  const enabled = ordered.filter((option) => option.disabled !== true);
  const activeIndex = enabled.findIndex((option) => option.value === activeValue);
  const resolvedActive = activeIndex >= 0 ? activeValue : enabled[0]?.value;
  const rowsVisible = !loading;
  const activeOptionId =
    open && rowsVisible && resolvedActive !== undefined
      ? optionDomId(listboxId, ordered, resolvedActive)
      : undefined;

  const describedBy =
    [
      props["aria-describedby"],
      standalone && helper ? helperId : "",
      standalone && error ? errorId : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const invalid = props["aria-invalid"] ?? (error ? true : undefined);

  const selected = currentValue === undefined ? undefined : options.find((option) => option.value === currentValue);
  // A saved value the catalogue no longer offers still renders, as its raw string.
  const displayLabel = selected?.label ?? savedValue ?? "";
  // The committed value stays selected while the keyboard-active row moves.
  const selectedValues = currentValue === undefined ? undefined : [currentValue];

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const openPopup = useCallback(
    (target: FocusTarget = "selected") => {
      if (disabled || open) return;
      setQuery("");
      const visible = orderOptions(options);
      if (target === "last") {
        const enabledAll = visible.filter((option) => option.disabled !== true);
        setActiveValue(enabledAll[enabledAll.length - 1]?.value);
      } else if (target === "first") {
        setActiveValue(undefined);
      } else {
        const keepsSelection =
          savedValue !== undefined ||
          visible.some((option) => option.value === currentValue && option.disabled !== true);
        setActiveValue(keepsSelection ? currentValue : undefined);
      }
      setOpenState(true);
    },
    [currentValue, disabled, open, options, savedValue, setOpenState],
  );

  const closePopup = useCallback(() => {
    if (!open) return;
    if (isSheet) suppressFocusOpen.current = true;
    setQuery("");
    setActiveValue(undefined);
    setOpenState(false);
  }, [isSheet, open, setOpenState]);

  const focusTrigger = useCallback(() => {
    triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (option: SelectOption) => {
      if (option.disabled === true) return;
      const emitted = option.value === "" && emptyValue === "undefined" ? undefined : option.value;
      if (!controlled) setInnerValue(emitted);
      onChange?.(emitted);
      closePopup();
      if (!isSheet) focusTrigger();
    },
    [closePopup, controlled, emptyValue, focusTrigger, isSheet, onChange],
  );

  const moveActive = (delta: 1 | -1) => {
    if (enabled.length === 0) return;
    const index = enabled.findIndex((option) => option.value === resolvedActive);
    const from = index >= 0 ? index : delta > 0 ? -1 : enabled.length;
    const next = enabled[Math.min(Math.max(from + delta, 0), enabled.length - 1)];
    if (next !== undefined) setActiveValue(next.value);
  };

  const moveActiveTo = (position: "first" | "last") => {
    if (enabled.length === 0) return;
    const next = position === "first" ? enabled[0] : enabled[enabled.length - 1];
    if (next !== undefined) setActiveValue(next.value);
  };

  const runTypeahead = (character: string) => {
    const now = Date.now();
    const previous = typeahead.current;
    const buffer = now - previous.at > TYPEAHEAD_RESET_MS ? character : previous.buffer + character;
    typeahead.current = { buffer, at: now };
    const needle = normalize(buffer);
    if (needle.length === 0) return;
    const match = enabled.find((option) => normalize(option.label).startsWith(needle));
    if (match !== undefined) setActiveValue(match.value);
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    const { key, altKey, ctrlKey, metaKey } = event;

    if (key === "ArrowDown" || key === "ArrowUp") {
      if (key === "ArrowDown" && altKey) {
        event.preventDefault();
        openPopup("first");
        return;
      }
      event.preventDefault();
      if (!open) {
        openPopup(key === "ArrowDown" ? "first" : "last");
        return;
      }
      moveActive(key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (key === "Home" || key === "End") {
      if (searchable || !open) return;
      event.preventDefault();
      moveActiveTo(key === "Home" ? "first" : "last");
      return;
    }

    if (key === "Enter" || (key === " " && !searchable)) {
      event.preventDefault();
      if (!open) {
        openPopup("first");
        return;
      }
      const next = enabled.find((option) => option.value === resolvedActive);
      if (next !== undefined) commit(next);
      return;
    }

    if (!searchable && !altKey && !ctrlKey && !metaKey && key.length === 1 && key !== " ") {
      if (!open) openPopup("first");
      runTypeahead(key);
    }
  };

  const onQueryChange = (next: string) => {
    if (disabled) return;
    setQuery(next);
    // Typing re-points the active row at the first match (or the custom row), so Enter
    // commits what the query shows instead of a row chosen before filtering.
    setActiveValue(undefined);
    if (!open) setOpenState(true);
  };

  const onTriggerFocus = () => {
    if (!searchable) return;
    if (suppressFocusOpen.current) {
      suppressFocusOpen.current = false;
      return;
    }
    if (!open) openPopup();
  };

  const listbox = (
    <Listbox
      id={listboxId}
      options={filtered}
      pinnedOptions={pinned}
      selectedValues={selectedValues}
      activeValue={resolvedActive}
      onHover={(option) => setActiveValue(option.value)}
      onSelect={commit}
      emptyLabel={emptyLabel ?? DEFAULT_EMPTY_LABEL}
      noResultsLabel={queryText.length > 0 ? (noResultsLabel ?? DEFAULT_NO_RESULTS_LABEL) : undefined}
      loading={loading}
      loadingLabel={loadingLabel}
    />
  );

  const trigger = searchable ? (
    <input
      ref={setTrigger}
      type="text"
      id={triggerId}
      role="combobox"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-activedescendant={activeOptionId}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      aria-required={required || undefined}
      className={input}
      value={open ? query : displayLabel}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onQueryChange(event.target.value)}
      onFocus={onTriggerFocus}
      onClick={() => {
        // A focused input fires no focus event, so click-to-reopen must be explicit:
        // after a commit the trigger keeps focus and a bare click has to reopen.
        if (!open) openPopup();
      }}
      onKeyDown={onTriggerKeyDown}
    />
  ) : (
    <button
      ref={setTrigger}
      type="button"
      id={triggerId}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-activedescendant={activeOptionId}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      aria-required={required || undefined}
      className={TRIGGER_CLASS}
      disabled={disabled}
      onClick={() => (open ? closePopup() : openPopup())}
      onKeyDown={onTriggerKeyDown}
    >
      <span className={displayLabel.length > 0 ? VALUE_CLASS : PLACEHOLDER_CLASS}>
        {displayLabel.length > 0 ? displayLabel : (placeholder ?? "")}
      </span>
      <svg aria-hidden="true" viewBox="0 0 20 20" className={CHEVRON_CLASS}>
        <path
          d="M5 7.5 10 12l5-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  return (
    <div className={className ? `${ROOT_CLASS} ${className}` : ROOT_CLASS}>
      {standalone ? (
        <label htmlFor={triggerId} className={fieldLabel}>
          {label}
        </label>
      ) : null}
      {trigger}
      {standalone && helper ? (
        <p id={helperId} className={smallMuted}>
          {helper}
        </p>
      ) : null}
      {standalone && error ? (
        <p id={errorId} className={fieldError}>
          {error}
        </p>
      ) : null}
      {open && !isSheet ? (
        <Popover open anchorRef={triggerRef} onClose={closePopup}>
          {listbox}
        </Popover>
      ) : null}
      {open && isSheet ? (
        <SelectSheet
          title={label}
          onClose={closePopup}
          searchable={searchable}
          query={query}
          onQueryChange={onQueryChange}
          onKeyDown={onTriggerKeyDown}
        >
          {listbox}
        </SelectSheet>
      ) : null}
    </div>
  );
}
