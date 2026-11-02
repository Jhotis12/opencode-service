import { useEffect, useState, type FormEvent } from "react";
import type { ChatHistoryMessage } from "../api.ts";
import { buttonPrimary } from "../ui.ts";

export interface ChatMessage {
  role: "user" | "agent" | "system";
  text: string;
}

const WELCOME =
  "Hola. Soy el agente principal de este proyecto. Puedo crear o editar nodos, sub-agentes y ejecutar el flujo. También puedes editar el canvas y pedirme que revise tus cambios.";

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function ChatPanel({
  onSend,
  disabled,
  hint,
  initialMessages,
}: {
  onSend(message: string): Promise<string>;
  disabled?: boolean;
  hint?: string;
  initialMessages?: ChatHistoryMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const history = (initialMessages ?? []).map((message) => ({ role: message.role, text: message.content }));
    setMessages(history.length > 0 ? history : [{ role: "agent", text: WELCOME }]);
  }, [initialMessages]);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setBusy(true);
    try {
      const reply = await onSend(message);
      setMessages((current) => [...current, { role: "agent", text: reply }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "system", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-[380px] flex-col gap-2.5 rounded-xl border border-line bg-panel p-3.5" aria-label="Chat con el agente">
      <header>
        <h2 className="text-base font-semibold text-slate-100">Agente principal</h2>
        {hint && <small className="text-[11px] text-muted">{hint}</small>}
      </header>
      <div className="flex max-h-80 flex-col gap-2 overflow-auto pr-1">
        {messages.map((message, index) => (
          <article
            key={index}
            className={`whitespace-pre-wrap rounded-[10px] px-3 py-2 text-[13px] leading-relaxed ${
              message.role === "user"
                ? "ml-auto max-w-[90%] border border-accent/30 bg-accent/10"
                : message.role === "system"
                  ? "border border-danger/35 bg-danger/10 text-rose-200"
                  : "border border-line bg-[#0b1220]"
            }`}
          >
            {message.text}
          </article>
        ))}
        {busy && (
          <article className="rounded-[10px] border border-line bg-[#0b1220] px-3 py-2 text-[13px] text-muted">
            Pensando… {elapsed > 0 ? formatElapsed(elapsed) : ""}
            <br />
            <small>Puede tardar varios minutos si está construyendo nodos o ejecutando herramientas.</small>
          </article>
        )}
      </div>
      <form className="flex flex-col gap-2" onSubmit={submit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pídele un flujo, una corrección o un reporte…"
          rows={3}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit(event);
            }
          }}
        />
        <button className={buttonPrimary} disabled={busy || disabled || !input.trim()}>
          Enviar
        </button>
      </form>
    </section>
  );
}
