import { useRef, useState, type ReactNode, type RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Popover } from "../src/components/select/popover.tsx";

const DEFAULT_VIEWPORT = { width: window.innerWidth, height: window.innerHeight };

function setViewport(width: number, height = DEFAULT_VIEWPORT.height) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

afterEach(() => {
  setViewport(DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height);
  vi.restoreAllMocks();
});

function OpeningHarness({
  onClose,
  children,
}: {
  readonly onClose?: () => void;
  readonly children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef} type="button" onClick={() => setOpen((value) => !value)}>
        Abrir
      </button>
      <Popover
        open={open}
        anchorRef={anchorRef}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
      >
        {children ?? <p>Panel</p>}
      </Popover>
    </>
  );
}

function getPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-popover]");
}

async function openPopover() {
  const trigger = screen.getByRole("button", { name: "Abrir" });
  await userEvent.click(trigger);
  const panel = getPanel();
  expect(panel).not.toBeNull();
  return { trigger, panel: panel! };
}

describe("Popover", () => {
  it("portals the panel to document.body with fixed positioning outside the app root", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    render(<OpeningHarness />, { container: root });

    const { panel } = await openPopover();

    expect(panel.parentElement).toBe(document.body);
    expect(root.contains(panel)).toBe(false);
    expect(panel.style.position).toBe("fixed");
    expect(panel.style.zIndex).toBe("60");
    expect(panel).toHaveTextContent("Panel");
    root.remove();
  });

  it("measures the anchor rect and opens below it with the minimum width", async () => {
    render(<OpeningHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(40, 100, 200, 40));

    const { panel } = await openPopover();

    expect(panel.style.width).toBe("240px");
    expect(panel.style.left).toBe("40px");
    expect(panel.style.top).toBe("144px");
    expect(panel.style.bottom).toBe("");
    expect(panel.style.maxHeight).toBe("360px");
    expect(panel.style.visibility).toBe("visible");
  });

  it("flips above the anchor when there is no room below", async () => {
    setViewport(1024, 400);
    render(<OpeningHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(40, 200, 200, 40));

    const { panel } = await openPopover();

    expect(panel.style.top).toBe("");
    expect(panel.style.bottom).toBe("204px");
    expect(panel.style.maxHeight).toBe("192px");
  });

  it("clamps the width to the viewport on a narrow screen", async () => {
    setViewport(280);
    render(<OpeningHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(40, 100, 320, 40));

    const { panel } = await openPopover();

    expect(panel.style.width).toBe("264px");
    expect(panel.style.left).toBe("8px");
  });

  it("tolerates a zero-size anchor and stays hidden while it has no anchor to measure", async () => {
    render(<OpeningHarness />);
    const { panel } = await openPopover();
    expect(panel.style.width).toBe("240px");
    expect(panel.style.visibility).toBe("visible");

    const orphanAnchor: RefObject<HTMLElement | null> = { current: null };
    render(
      <Popover open anchorRef={orphanAnchor} onClose={() => undefined}>
        <p>Huérfano</p>
      </Popover>,
    );
    const panels = document.querySelectorAll<HTMLElement>("[data-popover]");
    expect(panels).toHaveLength(2);
    expect(panels[1]!.style.visibility).toBe("hidden");
  });

  it("closes on Escape without letting a surrounding dialog see the key", async () => {
    const onClose = vi.fn();
    render(<OpeningHarness onClose={onClose} />);
    await openPopover();

    const dialogListener = vi.fn();
    document.addEventListener("keydown", dialogListener);
    fireEvent.keyDown(document.body, { key: "Escape" });
    document.removeEventListener("keydown", dialogListener);

    expect(getPanel()).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialogListener).not.toHaveBeenCalled();
  });

  it("closes on an outside mousedown and ignores mousedowns inside the panel or on the anchor", async () => {
    const onClose = vi.fn();
    render(<OpeningHarness onClose={onClose} />);
    const { trigger } = await openPopover();

    fireEvent.mouseDown(getPanel()!.querySelector("p")!);
    expect(getPanel()).not.toBeNull();

    fireEvent.mouseDown(trigger);
    expect(getPanel()).not.toBeNull();

    fireEvent.mouseDown(document.body);
    expect(getPanel()).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when a scrollable container scrolls and listens in the capture phase", async () => {
    const addListener = vi.spyOn(window, "addEventListener");
    render(
      <div data-testid="scroller" style={{ overflowY: "auto", maxHeight: 200 }}>
        <OpeningHarness />
      </div>,
    );
    await openPopover();

    const scrollCall = addListener.mock.calls.find(([type]) => type === "scroll");
    expect(scrollCall?.[2]).toMatchObject({ capture: true, passive: true });

    fireEvent.scroll(screen.getByTestId("scroller"));
    expect(getPanel()).toBeNull();
  });

  it("closes on resize", async () => {
    render(<OpeningHarness />);
    await openPopover();

    fireEvent(window, new Event("resize"));
    expect(getPanel()).toBeNull();
  });

  it("closes on Tab without swallowing the focus move", async () => {
    render(<OpeningHarness />);
    await openPopover();

    const notPrevented = fireEvent.keyDown(document.body, { key: "Tab" });
    expect(notPrevented).toBe(true);
    expect(getPanel()).toBeNull();
  });

  it("closes when focus leaves the anchor but keeps focus that lands in the panel", async () => {
    render(
      <>
        <OpeningHarness />
        <button type="button">Fuera</button>
      </>,
    );
    const { trigger, panel } = await openPopover();

    fireEvent.focusOut(trigger, { relatedTarget: panel });
    expect(getPanel()).not.toBeNull();

    fireEvent.focusOut(trigger, { relatedTarget: screen.getByRole("button", { name: "Fuera" }) });
    expect(getPanel()).toBeNull();
  });

  it("keeps exactly one panel across repeated open and close cycles", async () => {
    render(<OpeningHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });

    for (let round = 0; round < 3; round += 1) {
      await userEvent.click(trigger);
      expect(document.querySelectorAll("[data-popover]")).toHaveLength(1);
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(document.querySelectorAll("[data-popover]")).toHaveLength(0);
    }
  });

  it("removes its listeners when it unmounts while open, without throwing on later events", async () => {
    const onClose = vi.fn();
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const view = render(<OpeningHarness onClose={onClose} />);
    await openPopover();

    view.unmount();

    expect(removeDocumentListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeDocumentListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    expect(removeWindowListener).toHaveBeenCalledWith("scroll", expect.any(Function), expect.anything());
    expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));

    expect(() => {
      fireEvent.keyDown(document.body, { key: "Escape" });
      fireEvent.mouseDown(document.body);
      fireEvent(window, new Event("resize"));
    }).not.toThrow();
    expect(onClose).not.toHaveBeenCalled();
  });
});
