import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Modal } from "../Modal.tsx";
import { input } from "../../ui.ts";

export type SelectSheetProps = {
  readonly title: string;
  onClose(): void;
  readonly searchable?: boolean;
  readonly query: string;
  onQueryChange(next: string): void;
  readonly onKeyDown?: (event: ReactKeyboardEvent<HTMLElement>) => void;
  readonly searchLabel?: string;
  readonly children: ReactNode;
};

const BODY_CLASS = "flex min-w-0 flex-col gap-3 outline-none";
const DEFAULT_SEARCH_LABEL = "Buscar";

/**
 * The under-640 px surface for Select: a Modal sheet that hosts the very same Listbox.
 * The trigger lives behind the modal's `inert` root, so the sheet owns its own search
 * field (searchable mode) and a programmatically focusable body (select-only mode)
 * that receive the same keyboard handler as the trigger.
 */
export function SelectSheet({
  title,
  onClose,
  searchable = false,
  query,
  onQueryChange,
  onKeyDown,
  searchLabel = DEFAULT_SEARCH_LABEL,
  children,
}: SelectSheetProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Modal focuses its close button when it mounts; a microtask lands after that
    // effect flush so the sheet opens ready for the keyboard.
    queueMicrotask(() => {
      const target = searchable ? searchRef.current : bodyRef.current;
      if (target !== null) target.focus();
    });
  }, [searchable]);

  return (
    <Modal title={title} onClose={onClose} size="md">
      <div
        ref={bodyRef}
        data-select-sheet=""
        tabIndex={-1}
        className={BODY_CLASS}
        onKeyDown={onKeyDown}
      >
        {searchable ? (
          <input
            ref={searchRef}
            type="search"
            className={input}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label={searchLabel}
            autoComplete="off"
            spellCheck={false}
          />
        ) : null}
        {children}
      </div>
    </Modal>
  );
}
