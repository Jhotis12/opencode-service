import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("../src/components/Toast.tsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/components/Toast.tsx")>();
  return { ...actual, notifyError: vi.fn() };
});

import { useChatTurn } from "../src/useChatTurn.ts";
import { notifyError } from "../src/components/Toast.tsx";

afterEach(() => {
  vi.clearAllMocks();
});

describe("useChatTurn", () => {
  it("tracks a turn and reconnects from an id", async () => {
    const attachTurn = vi.fn().mockImplementation(async (turnId, onEvent) => {
      onEvent({ type: "status", turnId, status: "running" });
      onEvent({
        type: "done",
        turnId,
        status: "succeeded",
        reply: "listo",
        threadId: "t1",
        startedAt: new Date().toISOString(),
      });
      return { reply: "listo", turnId, threadId: "t1", status: "succeeded" };
    });
    const { result } = renderHook(() => useChatTurn({ attachTurn }));

    act(() => result.current.begin());
    act(() => result.current.handleEvent({ type: "status", turnId: "turn-1", status: "running" }));
    expect(result.current.turnId).toBe("turn-1");
    expect(result.current.status).toBe("running");

    let attached: unknown;
    await act(async () => {
      attached = await result.current.reconnect("turn-1");
    });
    expect(attachTurn).toHaveBeenCalledWith("turn-1", expect.any(Function));
    expect(attached).toMatchObject({ reply: "listo", status: "succeeded" });
    expect(result.current.connection).toBe("done");
  });

  it("toasts a stream error and keeps the turn id the retry control reads", () => {
    const { result } = renderHook(() => useChatTurn());

    act(() => result.current.begin());
    act(() => result.current.handleEvent({ type: "status", turnId: "turn-1", status: "running" }));
    act(() =>
      result.current.handleEvent({
        type: "error",
        turnId: "turn-1",
        code: "transport_interrupted",
        message: "Se interrumpió la conexión.",
        retryable: true,
      }),
    );

    expect(notifyError).toHaveBeenCalledWith(
      "No se pudo completar el turno de chat. (código: transport_interrupted)",
    );
    expect(result.current.connection).toBe("error");
    expect(result.current.turnId).toBe("turn-1");
  });

  it("toasts a failed reconnect", async () => {
    const attachTurn = vi.fn().mockRejectedValue(new Error("failed to fetch"));
    const { result } = renderHook(() => useChatTurn({ attachTurn }));

    await act(async () => {
      await result.current.reconnect("turn-2");
    });

    expect(notifyError).toHaveBeenCalledWith(
      "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.",
    );
    expect(result.current.connection).toBe("error");
  });
});
