import { useCallback, useState } from "react";
import type { ChatTurnEvent, ChatTurnStatus } from "@platform/shared";
import type { ChatTurnResult } from "./api.ts";
import { notifyError } from "./components/Toast.tsx";
import { friendlyError } from "./ui.ts";

export type ChatTurnConnection = "idle" | "streaming" | "reconnecting" | "done" | "error";

export interface ChatTurnActions {
  attachTurn?: (turnId: string, onEvent: (event: ChatTurnEvent) => void) => Promise<ChatTurnResult>;
  cancelTurn?: (turnId: string) => Promise<unknown>;
  retryTurn?: (turnId: string) => Promise<{ turn: { id: string }; warning?: string }>;
}

export interface ChatTurnController {
  turnId?: string;
  status?: ChatTurnStatus;
  startedAt?: string;
  connection: ChatTurnConnection;
  begin(): void;
  handleEvent(event: ChatTurnEvent): void;
  reconnect(turnId?: string): Promise<ChatTurnResult | undefined>;
  cancel(): Promise<void>;
  retry(): Promise<string | undefined>;
  reset(): void;
}

function statusFromEvent(event: ChatTurnEvent): ChatTurnStatus | undefined {
  if (event.type === "turn") return event.turn.status;
  if (event.type === "status") return event.status;
  if (event.type === "done") return event.status;
  if (event.type === "error") return "failed";
  return undefined;
}

export function useChatTurn(actions: ChatTurnActions = {}): ChatTurnController {
  const [turnId, setTurnId] = useState<string>();
  const [status, setStatus] = useState<ChatTurnStatus>();
  const [startedAt, setStartedAt] = useState<string>();
  const [connection, setConnection] = useState<ChatTurnConnection>("idle");

  const handleEvent = useCallback((event: ChatTurnEvent) => {
    if (event.type === "turn") {
      setTurnId(event.turn.id);
      setStartedAt(event.turn.startedAt);
      setStatus(event.turn.status);
    } else if ("turnId" in event) {
      setTurnId(event.turnId);
    }
    const next = statusFromEvent(event);
    if (next) setStatus(next);
    if (event.type === "error") {
      notifyError(friendlyError(event, "No se pudo completar el turno de chat."));
      setConnection("error");
    } else if (event.type === "done") {
      setConnection("done");
    } else if (event.type === "turn" || event.type === "status" || event.type === "text" || event.type === "activity") {
      setConnection(event.type === "turn" || event.type === "status" ? "streaming" : "streaming");
    }
  }, []);

  const begin = useCallback(() => {
    setStatus(undefined);
    setConnection("streaming");
  }, []);

  const reconnect = useCallback(
    async (id = turnId) => {
      if (!id || !actions.attachTurn) return undefined;
      setConnection("reconnecting");
      try {
        const result = await actions.attachTurn(id, handleEvent);
        setConnection("done");
        return result;
      } catch (cause) {
        setConnection("error");
        notifyError(friendlyError(cause, "No se pudo reconectar con el turno."));
        return undefined;
      }
    },
    [actions, handleEvent, turnId],
  );

  const cancel = useCallback(async () => {
    if (!turnId || !actions.cancelTurn) return;
    await actions.cancelTurn(turnId);
    setStatus("cancelled");
    setConnection("done");
  }, [actions, turnId]);

  const retry = useCallback(async () => {
    if (!turnId || !actions.retryTurn) return undefined;
    const result = await actions.retryTurn(turnId);
    setTurnId(result.turn.id);
    setStatus("queued");
    setConnection("streaming");
    return result.warning;
  }, [actions, turnId]);

  const reset = useCallback(() => {
    setTurnId(undefined);
    setStatus(undefined);
    setStartedAt(undefined);
    setConnection("idle");
  }, []);

  return {
    turnId,
    status,
    startedAt,
    connection,
    begin,
    handleEvent,
    reconnect,
    cancel,
    retry,
    reset,
  };
}
