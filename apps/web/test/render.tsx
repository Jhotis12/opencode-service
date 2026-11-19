import type { ReactElement } from "react";
import type { UserEvent } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * Drives a Select the way a user does: opens the trigger by its accessible name,
 * clicks the option row by name, and resolves once the popup is unmounted.
 * Works for both the desktop popover and the mobile sheet, since both expose the
 * listbox only while the picker is open.
 */
export async function chooseOption(
  user: UserEvent,
  labelText: string,
  optionName: string | RegExp,
): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: labelText }));
  await user.click(screen.getByRole("option", { name: optionName }));
  await waitFor(() => {
    if (screen.queryByRole("listbox") !== null) throw new Error("El popup del Select sigue abierto.");
  });
}

/**
 * Overrides `window.matchMedia` for exactly one query, so a spec can pin a breakpoint
 * (Select reads `(max-width: 639px)` to decide popover vs. sheet) without touching the
 * jsdom default. `useMediaQuery` reads the query on its first render, so call this
 * before rendering; the returned function restores the previous implementation.
 */
export function setViewportMatches(query: string, matches: boolean): () => void {
  const original = window.matchMedia;
  const stub = (media: string): MediaQueryList => {
    if (media !== query) return original.call(window, media);
    return {
      matches,
      media,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
  window.matchMedia = stub as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}
