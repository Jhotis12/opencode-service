import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { focusRing, tab, tabActive, tabList } from "../ui.ts";

export type TabItem = {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
  readonly disabled?: boolean;
};

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  "aria-label": ariaLabel,
}: {
  readonly items: readonly TabItem[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly "aria-label": string;
}) {
  const baseId = useId();
  const firstEnabledId = items.find((item) => !item.disabled)?.id ?? items[0]?.id ?? "";
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstEnabledId);
  const activeId = value ?? internalValue;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stripRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const activeIndex = items.findIndex((item) => item.id === activeId);

  const updateOverflow = useCallback(() => {
    const element = stripRef.current;
    if (!element) return;
    const left = element.scrollLeft > 4;
    const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 4;
    setOverflow((current) => (current.left === left && current.right === right ? current : { left, right }));
  }, []);

  useEffect(() => {
    updateOverflow();
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
  }, [updateOverflow]);

  useEffect(() => {
    const activeTab = tabRefs.current[activeIndex];
    activeTab?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    updateOverflow();
  }, [activeId, activeIndex, updateOverflow]);

  function select(id: string) {
    if (value === undefined) setInternalValue(id);
    onValueChange?.(id);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const enabledIndexes = items.flatMap((item, itemIndex) => (item.disabled ? [] : [itemIndex]));
    const position = enabledIndexes.indexOf(index);
    if (position < 0) return;

    let nextIndex: number | undefined;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = enabledIndexes[(position + 1) % enabledIndexes.length];
        break;
      case "ArrowLeft":
        nextIndex = enabledIndexes[(position - 1 + enabledIndexes.length) % enabledIndexes.length];
        break;
      case "Home":
        nextIndex = enabledIndexes[0];
        break;
      case "End":
        nextIndex = enabledIndexes[enabledIndexes.length - 1];
        break;
    }
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextItem = items[nextIndex];
    if (!nextItem) return;
    select(nextItem.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="min-w-0">
      <div className="relative">
        <div
          ref={stripRef}
          className={tabList}
          role="tablist"
          aria-label={ariaLabel}
          onScroll={updateOverflow}
        >
          {items.map((item, index) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${index}`}
                aria-selected={active}
                aria-controls={`${baseId}-panel-${index}`}
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                tabIndex={active && !item.disabled ? 0 : -1}
                className={`${tab} ${active ? tabActive : ""}`.trim()}
                onClick={() => select(item.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {overflow.left && (
          <span
            data-testid="tab-scroll-fade-start"
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-ink to-transparent"
          />
        )}
        {overflow.right && (
          <span
            data-testid="tab-scroll-fade-end"
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-ink to-transparent"
          />
        )}
      </div>
      {items.map((item, index) => {
        const active = item.id === activeId;
        return (
          <div
            key={item.id}
            role="tabpanel"
            id={`${baseId}-panel-${index}`}
            aria-labelledby={`${baseId}-tab-${index}`}
            hidden={!active}
            tabIndex={active ? 0 : -1}
            className={focusRing}
          >
            <div className="pt-4">{item.content}</div>
          </div>
        );
      })}
    </div>
  );
}
