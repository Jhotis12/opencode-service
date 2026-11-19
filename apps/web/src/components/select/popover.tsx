import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export type PopoverProps = {
  readonly open: boolean;
  readonly anchorRef: RefObject<HTMLElement | null>;
  onClose(): void;
  readonly children: ReactNode;
  readonly id?: string;
  readonly className?: string;
};

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const EDGE = 8;
const GAP = 4;
const FLIP_SPACE = 240;
const MAX_HEIGHT = 360;
const Z_INDEX = 60;

const PANEL_CLASS =
  "flex flex-col overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-2xl";

const SCROLL_OPTIONS: AddEventListenerOptions = { capture: true, passive: true };

type Measurement = {
  readonly left: number;
  readonly width: number;
  readonly top: number | null;
  readonly bottom: number | null;
  readonly maxHeight: number;
};

function measure(anchor: HTMLElement): Measurement {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const width = Math.max(
    0,
    Math.min(Math.max(rect.width, MIN_WIDTH), Math.min(MAX_WIDTH, viewportWidth - EDGE * 2)),
  );
  const left = Math.min(Math.max(rect.left, EDGE), Math.max(EDGE, viewportWidth - width - EDGE));
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  const flip = spaceBelow < FLIP_SPACE && spaceAbove > spaceBelow;
  const space = flip ? spaceAbove : spaceBelow;
  return {
    left,
    width,
    top: flip ? null : rect.bottom + GAP,
    bottom: flip ? viewportHeight - rect.top + GAP : null,
    maxHeight: Math.max(0, Math.min(MAX_HEIGHT, space - EDGE)),
  };
}

function placementStyle(measurement: Measurement | null): CSSProperties {
  if (measurement === null) return { position: "fixed", zIndex: Z_INDEX, visibility: "hidden" };
  return {
    position: "fixed",
    zIndex: Z_INDEX,
    visibility: "visible",
    left: measurement.left,
    width: measurement.width,
    maxHeight: measurement.maxHeight,
    ...(measurement.top === null ? { bottom: measurement.bottom ?? 0 } : { top: measurement.top }),
  };
}

export function Popover({ open, anchorRef, onClose, children, id, className }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) {
      setMeasurement(null);
      return;
    }
    const anchor = anchorRef.current;
    setMeasurement(anchor === null ? null : measure(anchor));
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const anchor = anchorRef.current;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panel?.contains(target) || anchor?.contains(target)) return;
      onCloseRef.current();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // A surrounding dialog listens on document in the bubble phase; swallowing the
        // key here keeps Escape from closing both the popover and the dialog behind it.
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab") onCloseRef.current();
    };

    const onScroll = (event: Event) => {
      if (event.target instanceof Element && panel?.contains(event.target)) return;
      onCloseRef.current();
    };

    const onResize = () => onCloseRef.current();

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      // A click on a non-focusable row reports no related target; the outside mousedown
      // listener already covers page clicks, so a null target must keep the panel open.
      if (!(next instanceof Node)) return;
      if (anchor?.contains(next) || panel?.contains(next)) return;
      onCloseRef.current();
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, SCROLL_OPTIONS);
    window.addEventListener("resize", onResize);
    anchor?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, SCROLL_OPTIONS);
      window.removeEventListener("resize", onResize);
      anchor?.removeEventListener("focusout", onFocusOut);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      data-popover=""
      className={className ? `${PANEL_CLASS} ${className}` : PANEL_CLASS}
      style={placementStyle(measurement)}
    >
      {children}
    </div>,
    document.body,
  );
}
