import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { afterEach, describe, expect, it } from "vitest";
import { dismissAll, notifyError, notifySuccess } from "../src/components/Toast.tsx";

function renderToaster() {
  render(<Toaster theme="dark" position="bottom-right" richColors closeButton />);
}

afterEach(() => {
  act(() => dismissAll());
});

describe("notifySuccess", () => {
  it("puts the message inside the polite live region", async () => {
    renderToaster();

    act(() => notifySuccess("Ejecución iniciada"));

    const title = await screen.findByText("Ejecución iniciada");
    const liveRegion = title.closest("[aria-live]");

    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute("aria-live")).toBe("polite");
    expect(within(liveRegion as HTMLElement).getByText("Ejecución iniciada")).toBe(title);
  });
});

describe("notifyError", () => {
  it("renders an error toast that is dismissible with the keyboard", async () => {
    const user = userEvent.setup();
    renderToaster();

    act(() => notifyError("No se pudo guardar el flujo"));

    const title = await screen.findByText("No se pudo guardar el flujo");
    const toastItem = title.closest("[data-sonner-toast]") as HTMLElement;
    expect(toastItem).not.toBeNull();

    const closeButton = within(toastItem).getByRole("button", { name: "Close toast" });
    closeButton.focus();
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Enter}");

    await waitFor(
      () => expect(screen.queryByText("No se pudo guardar el flujo")).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});

describe("dismissAll", () => {
  it("clears every queued toast", async () => {
    renderToaster();

    act(() => {
      notifySuccess("Uno listo");
      notifyError("Dos falló");
    });
    await screen.findByText("Uno listo");
    await screen.findByText("Dos falló");

    act(() => dismissAll());

    await waitFor(
      () => {
        expect(screen.queryByText("Uno listo")).not.toBeInTheDocument();
        expect(screen.queryByText("Dos falló")).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
