import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useChatTurn } from "../src/useChatTurn.ts";

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
});
