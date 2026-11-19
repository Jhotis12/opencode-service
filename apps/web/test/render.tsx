import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { PlatformToaster } from "../src/components/Toaster.tsx";

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      {ui}
      <PlatformToaster />
    </QueryClientProvider>,
  );
}

export function toastRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Notificaciones" });
}

export async function findToast(text: RegExp | string): Promise<HTMLElement> {
  const content = await screen.findByText(text);
  const item = content.closest<HTMLElement>("[data-sonner-toast]");
  if (!item) throw new Error(`El texto "${String(text)}" no está dentro de un toast.`);
  return item;
}
