import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  groupOrder,
  metaTone,
  orderOptions,
  type SelectMeta,
  type SelectMetaTone,
  type SelectOption,
} from "./options.ts";
import { badge, focusRing } from "../../ui.ts";

export type ListboxProps = {
  readonly options: readonly SelectOption[];
  readonly activeValue?: string;
  readonly onHover?: (option: SelectOption) => void;
  readonly onSelect?: (option: SelectOption) => void;
  readonly emptyLabel: string;
  /** Callers pass this only while a filter is active; it then wins over emptyLabel. */
  readonly noResultsLabel?: string;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
  readonly error?: string | null;
  readonly onRetry?: () => void;
  readonly id: string;
  readonly className?: string;
};

type Entry = {
  readonly option: SelectOption;
  readonly id: string;
};

const ROOT_CLASS = "relative flex min-w-0 flex-col";
const SCROLLER_CLASS = "max-h-80 overflow-y-auto overscroll-contain rounded-lg";
const LISTBOX_CLASS = "flex min-w-0 flex-col gap-0.5 p-0.5";
const GROUP_HEADER_CLASS = "px-2.5 pb-0.5 pt-1.5 text-micro font-medium uppercase tracking-wide text-faint";
const ROW_BASE =
  "flex w-full min-w-0 cursor-pointer flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors";
const ROW_ACTIVE = "bg-panel-2";
const ROW_HOVER = "bg-panel-2/60";
const ROW_DISABLED = "cursor-not-allowed opacity-45";
const STATUS_CLASS = "px-2.5 py-2 text-xs text-muted";
const ALERT_CLASS =
  "flex items-start justify-between gap-2 rounded-lg border border-danger/40 px-2.5 py-2 text-xs text-danger";
const RETRY_CLASS = `shrink-0 rounded-lg border border-danger/40 px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/10 ${focusRing}`;
const SHADOW_TOP_CLASS =
  "pointer-events-none absolute inset-x-0 top-0 z-10 h-6 rounded-t-lg bg-gradient-to-b from-panel to-transparent";
const SHADOW_BOTTOM_CLASS =
  "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 rounded-b-lg bg-gradient-to-t from-panel to-transparent";

const META_TONE_CLASS: Record<SelectMetaTone, string> = {
  muted: "",
  info: "border-accent/40 text-accent",
  agent: "border-violet/40 text-violet",
  ok: "border-ok/40 text-ok",
  warn: "border-warn/40 text-warn",
};

const RETRY_LABEL = "Reintentar";
const DEFAULT_LOADING_LABEL = "Cargando…";

type Shadows = {
  readonly top: boolean;
  readonly bottom: boolean;
};

function rowClassName(active: boolean, hovered: boolean, disabled: boolean): string {
  // Exactly one background class: active wins over hover, and a row can never get both.
  const background = active ? ROW_ACTIVE : hovered ? ROW_HOVER : "";
  return [ROW_BASE, background, disabled ? ROW_DISABLED : ""].filter(Boolean).join(" ");
}

function chipClassName(tone: SelectMetaTone): string {
  const toneClass = META_TONE_CLASS[tone];
  return [`${badge} shrink-0`, toneClass].filter(Boolean).join(" ");
}

export function Listbox({
  options,
  activeValue,
  onHover,
  onSelect,
  emptyLabel,
  noResultsLabel,
  loading = false,
  loadingLabel,
  error,
  onRetry,
  id,
  className,
}: ListboxProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [shadows, setShadows] = useState<Shadows>({ top: false, bottom: false });

  const syncShadows = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    const top = scroller.scrollTop > 1;
    const bottom = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
    setShadows((current) =>
      current.top === top && current.bottom === bottom ? current : { top, bottom },
    );
  }, []);

  useLayoutEffect(() => {
    syncShadows();
  }, [syncShadows, options, loading, error]);

  const showRows = !loading && !error;
  const entries: readonly Entry[] = showRows
    ? orderOptions(options).map((option, index) => ({ option, id: `${id}-option-${index}` }))
    : [];
  const activeId = entries.find((entry) => entry.option.value === activeValue)?.id;
  const ungrouped = entries.filter((entry) => !entry.option.group);

  const renderRow = (entry: Entry) => {
    const option = entry.option;
    const active = entry.id === activeId;
    const hovered = entry.id === hoveredId;
    const disabled = option.disabled === true;
    return (
      <div
        key={entry.id}
        id={entry.id}
        role="option"
        aria-selected={active}
        aria-disabled={disabled ? "true" : undefined}
        data-active={active ? "" : undefined}
        className={rowClassName(active, hovered, disabled)}
        onMouseEnter={() => {
          if (disabled) return;
          setHoveredId(entry.id);
          onHover?.(option);
        }}
        onMouseLeave={() => {
          if (disabled) return;
          setHoveredId((current) => (current === entry.id ? null : current));
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          if (disabled) return;
          onSelect?.(option);
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-body text-slate-200" title={option.label}>
            {option.label}
          </span>
          {option.meta?.map((meta: SelectMeta, index: number) => (
            <span
              key={`${meta.label}-${index}`}
              data-listbox-chip=""
              className={chipClassName(metaTone(meta.tone))}
              title={meta.title}
            >
              {meta.label}
            </span>
          ))}
        </span>
        {option.description ? (
          <span
            data-listbox-description=""
            className="truncate text-micro text-muted"
            title={option.description}
          >
            {option.description}
          </span>
        ) : null}
      </div>
    );
  };

  const statusMessage = error
    ? null
    : loading
      ? (loadingLabel ?? DEFAULT_LOADING_LABEL)
      : options.length === 0
        ? (noResultsLabel ?? emptyLabel)
        : null;

  return (
    <div className={className ? `${ROOT_CLASS} ${className}` : ROOT_CLASS}>
      {shadows.top ? <div aria-hidden="true" data-scroll-shadow="top" className={SHADOW_TOP_CLASS} /> : null}
      <div
        ref={scrollerRef}
        data-listbox-scroller=""
        className={SCROLLER_CLASS}
        onScroll={syncShadows}
      >
        <div
          role="listbox"
          id={id}
          aria-busy={loading ? "true" : undefined}
          aria-activedescendant={activeId}
          className={LISTBOX_CLASS}
        >
          {showRows
            ? groupOrder(options).map((group, index) => {
                const headerId = `${id}-group-${index}`;
                return (
                  <div key={group} role="group" aria-labelledby={headerId} className="flex min-w-0 flex-col">
                    <div id={headerId} data-listbox-group-header="" className={GROUP_HEADER_CLASS}>
                      {group}
                    </div>
                    {entries
                      .filter((entry) => entry.option.group === group)
                      .map((entry) => renderRow(entry))}
                  </div>
                );
              })
            : null}
          {showRows ? ungrouped.map((entry) => renderRow(entry)) : null}
        </div>
        {statusMessage ? (
          <div role="status" className={STATUS_CLASS}>
            {statusMessage}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className={ALERT_CLASS}>
            <span className="min-w-0">{error}</span>
            {onRetry ? (
              <button type="button" className={RETRY_CLASS} onClick={onRetry}>
                {RETRY_LABEL}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {shadows.bottom ? (
        <div aria-hidden="true" data-scroll-shadow="bottom" className={SHADOW_BOTTOM_CLASS} />
      ) : null}
    </div>
  );
}
