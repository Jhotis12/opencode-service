import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunDetailModal } from "../src/components/RunDetailModal.tsx";
import type { RunRecord } from "../src/api.ts";
import { renderWithProviders } from "./render.tsx";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function run(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "run-12345678",
    projectSlug: "ventas",
    workflowId: "wf",
    status: "paused",
    entryPoint: "schedule",
    startedAt: new Date().toISOString(),
    steps: [],
    ...overrides,
  };
}

describe("RunDetailModal approvals", () => {
  it("loads a pending approval and submits a decision", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/approvals") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            data: [{ id: "a1", runId: "run-12345678", nodeId: "review", status: "pending", createdAt: new Date().toISOString() }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/deliveries")) {
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/approvals/review")) {
        return new Response(JSON.stringify(run({ status: "succeeded" })), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    renderWithProviders(
      <RunDetailModal
        run={run()}
        nodeLabels={{ review: "Revisar caso" }}
        onClose={vi.fn()}
        onReplay={vi.fn()}
      />,
    );
    expect(await screen.findByText("Aprobación pendiente")).toBeInTheDocument();
    expect(await screen.findByText("Revisar caso")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/approvals/review"),
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(JSON.parse(String(fetchMock.mock.calls.find((call) => String(call[0]).includes("/approvals/review"))?.[1]?.body))).toEqual({
      decision: "approve",
    });
  });

  it("explains when a paused run has no pending approval", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
    renderWithProviders(
      <RunDetailModal run={run()} onClose={vi.fn()} onReplay={vi.fn()} />,
    );
    expect(await screen.findByText(/No hay una aprobación pendiente/)).toBeInTheDocument();
  });
});
