import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IntegrationRecord } from "@platform/shared";
import { renderWithProviders, chooseOption } from "./render.tsx";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,stub") },
}));

const apiMock = vi.hoisted(() => ({
  listIntegrations: vi.fn().mockResolvedValue({ data: [] }),
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  testIntegration: vi.fn(),
  connectIntegration: vi.fn(),
  disconnectIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  clearIntegrationWebhook: vi.fn(),
  integrationQr: vi.fn(),
  listDestinations: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock("../src/api.ts", () => ({ api: apiMock }));

import { DatabasePolicyEditor } from "../src/components/DatabasePolicyEditor.tsx";

function databaseIntegration(overrides: Partial<IntegrationRecord> = {}): IntegrationRecord {
  const now = new Date().toISOString();
  return {
    id: "db1",
    scope: "project",
    projectSlug: "demo",
    kind: "sqlite",
    name: "CRM",
    slug: "crm",
    config: { kind: "sqlite", filename: "/tmp/crm.sqlite", access: "read", maxRows: 1000, allowDdl: false },
    secretRefs: {},
    capabilities: ["query"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("DatabasePolicyEditor", () => {
  it("saves the database access policy", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    apiMock.updateIntegration.mockResolvedValueOnce({ ok: true });
    renderWithProviders(
      <DatabasePolicyEditor projectSlug="demo" integration={databaseIntegration()} onSaved={onSaved} />,
    );
    await chooseOption(user, "Acceso", "Lectura y escritura");
    await user.click(screen.getByRole("button", { name: "Guardar política" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "demo",
        "db1",
        expect.objectContaining({ config: expect.objectContaining({ access: "write" }) }),
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("keeps the policy operable when the saved access value is unknown", async () => {
    const user = userEvent.setup();
    apiMock.updateIntegration.mockResolvedValueOnce({ ok: true });
    renderWithProviders(
      <DatabasePolicyEditor
        projectSlug="demo"
        integration={databaseIntegration({
          id: "db2",
          name: "Ventas",
          slug: "ventas",
          config: { kind: "sqlite", filename: "/tmp/ventas.sqlite", access: "admin", maxRows: 500, allowDdl: false },
        })}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Acceso" })).toHaveTextContent("Lectura y escritura");
    await chooseOption(user, "Acceso", "Solo lectura");
    await user.click(screen.getByRole("button", { name: "Guardar política" }));
    await waitFor(() =>
      expect(apiMock.updateIntegration).toHaveBeenCalledWith(
        "demo",
        "db2",
        expect.objectContaining({ config: expect.objectContaining({ access: "read", maxRows: 500 }) }),
      ),
    );
  });
});
