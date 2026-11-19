import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatTurnEvent, ChatTurnStatus } from "@platform/shared";
import { ChatTurnStreamError, type ChatHistoryMessage, type ChatTurnResult } from "../api.ts";
import { useChatTurn } from "../useChatTurn.ts";
import { BrandMark } from "./Brand.tsx";
import { buttonGhost, buttonPrimary } from "../ui.ts";

type ChatActivity = {
  id: string;
  text: string;
  status: "started" | "succeeded" | "failed";
};

export interface ChatMessage {
  role: "user" | "agent" | "system";
  text: string;
}

type ChatSurface = "docked" | "minimized";

const WELCOME =
  "Hola. Soy el agente principal de este proyecto. Puedo crear o editar nodos, sub-agentes y ejecutar el flujo. Te hablaré en términos de nodos y resultados; si necesitas el detalle técnico, lo abrimos.";

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function turnStatusLabel(status: ChatTurnStatus | undefined, connection: string): string {
  if (connection === "reconnecting") return "Reconectando con el turno…";
  switch (status) {
    case "queued":
      return "En cola";
    case "retrying":
      return "El proveedor está reintentando";
    case "recovering":
      return "Recuperando el turno";
    case "running":
      return "Agente trabajando";
    default:
      return "Agente trabajando";
  }
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard can be unavailable in non-secure contexts; the user can still select the text.
  }
}

function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="prose-chat flex flex-col gap-2 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-2 text-base font-semibold text-slate-100">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-2 text-sm font-semibold text-slate-100">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-1 text-sm font-semibold text-slate-200">{children}</h3>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="list-inside list-disc pl-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-inside list-decimal pl-2">{children}</ol>,
          a: ({ href, children }) => (
            <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-line bg-panel-2 px-2 py-1.5 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-line/60 px-2 py-1.5 align-top">{children}</td>,
          pre: ({ children }) => {
            const raw = nodeText(children);
            return (
              <div className="relative">
                <button
                  type="button"
                  className="absolute right-2 top-2 z-10 rounded border border-line bg-panel px-2 py-1 text-[11px] text-muted hover:text-slate-100"
                  onClick={() => void copyText(raw)}
                >
                  Copiar
                </button>
                <pre className="mt-1">{children}</pre>
              </div>
            );
          },
          code: ({ children, className }) => (
            <code className={className ? "block" : "rounded border border-line bg-well px-1 py-0.5 text-[0.85em]"}>
              {children}
            </code>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function ChatPanel({
  onSend,
  onAttachTurn,
  onCancelTurn,
  onRetryTurn,
  disabled,
  hint,
  initialMessages,
  title = "Agente principal",
  welcome = WELCOME,
  storageKey = "project",
  fill = false,
  onMinimize,
  onBusyChange,
  onActivityChange,
}: {
  onSend(message: string, onEvent: (event: ChatTurnEvent) => void): Promise<ChatTurnResult | string>;
  onAttachTurn?: (turnId: string, onEvent: (event: ChatTurnEvent) => void) => Promise<ChatTurnResult>;
  onCancelTurn?: (turnId: string) => Promise<unknown>;
  onRetryTurn?: (turnId: string) => Promise<{ turn: { id: string }; warning?: string }>;
  disabled?: boolean;
  hint?: string;
  initialMessages?: ChatHistoryMessage[];
  title?: string;
  welcome?: string;
  storageKey?: string;
  fill?: boolean;
  onMinimize?: () => void;
  onBusyChange?: (busy: boolean) => void;
  onActivityChange?: (activity: string | undefined) => void;
}) {
  const turn = useChatTurn({ attachTurn: onAttachTurn, cancelTurn: onCancelTurn, retryTurn: onRetryTurn });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [activities, setActivities] = useState<ChatActivity[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [surface, setSurface] = useState<ChatSurface>(() => {
    const saved = localStorage.getItem(`chat-surface:${storageKey}`);
    if (saved === "minimized" && !onMinimize) return "minimized";
    return "docked";
  });
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const reconnectRef = useRef(turn.reconnect);
  reconnectRef.current = turn.reconnect;
  const attachedTurnRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // A query refetch can deliver the persisted agent reply while the streamed
    // draft is still visible. Do not replace the local turn mid-stream; the
    // local messages already contain the authoritative reply for this turn.
    if (busyRef.current) return;
    const history = (initialMessages ?? []).map((message) => ({ role: message.role, text: message.content }));
    setMessages(history.length > 0 ? history : [{ role: "agent", text: welcome }]);
  }, [initialMessages, welcome]);

  useEffect(() => {
    localStorage.setItem(`chat-surface:${storageKey}`, surface);
  }, [surface, storageKey]);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const started = turn.startedAt ? Date.parse(turn.startedAt) : Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [busy, turn.startedAt]);

  useEffect(() => {
    if (busyRef.current || !onAttachTurn || !initialMessages?.length) return;
    const active = [...initialMessages]
      .reverse()
      .find((message) => message.turnId && ["queued", "running", "recovering", "retrying"].includes(message.turnStatus ?? ""));
    if (!active?.turnId || attachedTurnRef.current === active.turnId) return;
    attachedTurnRef.current = active.turnId;
    setBusy(true);
    onBusyChange?.(true);
    onActivityChange?.("Reconectando con el turno…");
    void reconnectRef
      .current(active.turnId)
      .then((result) => {
        if (result?.reply) setMessages((current) => [...current, { role: "agent", text: result.reply }]);
      })
      .finally(() => {
        setBusy(false);
        onBusyChange?.(false);
        onActivityChange?.(undefined);
      });
  }, [initialMessages, onAttachTurn, onBusyChange, onActivityChange]);

  function scrollToLatest() {
    if (typeof endRef.current?.scrollIntoView !== "function") return;
    const reduced =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "end" });
  }

  useEffect(() => {
    if (surface === "minimized" || !atBottom) return;
    scrollToLatest();
  }, [messages, busy, draft, activities, surface, atBottom]);

  function upsertActivity(event: Extract<ChatTurnEvent, { type: "activity" }>) {
    setActivities((current) => {
      const next = [...current];
      const index = next.findIndex((item) => item.id === event.id);
      const activity = { id: event.id, text: event.text, status: event.status };
      if (index >= 0) next[index] = activity;
      else next.push(activity);
      return next.slice(-4);
    });
    onActivityChange?.(event.text);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    attachedTurnRef.current = undefined;
    setBusy(true);
    setDraft("");
    setActivities([]);
    setAtBottom(true);
    onBusyChange?.(true);
    onActivityChange?.("Preparando respuesta…");
    turn.begin();
    let textStarted = false;
    try {
      const result = await onSend(message, (progress) => {
        turn.handleEvent(progress);
        if (progress.type === "text") {
          setDraft((current) => current + progress.text);
          if (!textStarted) {
            textStarted = true;
            onActivityChange?.("Redactando respuesta…");
          }
        } else if (progress.type === "activity") {
          upsertActivity(progress);
        }
      });
      const reply = typeof result === "string" ? result : result.reply;
      setDraft("");
      setMessages((current) => [...current, { role: "agent", text: reply }]);
    } catch (error) {
      const recoverable =
        error instanceof ChatTurnStreamError &&
        Boolean(error.turnId) &&
        ["transport_interrupted", "unknown", "opencode_unavailable"].includes(error.code ?? "");
      if (recoverable && error.turnId) {
        const result = await turn.reconnect(error.turnId);
        if (result?.reply) {
          setDraft("");
          setMessages((current) => [...current, { role: "agent", text: result.reply }]);
          return;
        }
      }
      setMessages((current) => [
        ...current,
        { role: "system", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ]);
    } finally {
      setDraft("");
      setActivities([]);
      setBusy(false);
      onBusyChange?.(false);
      onActivityChange?.(undefined);
    }
  }

  function handleScroll() {
    const element = listRef.current;
    if (!element) return;
    setAtBottom(element.scrollHeight - element.scrollTop - element.clientHeight < 48);
  }

  if (surface === "minimized") {
    return (
      <button
        type="button"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-accent/40 bg-panel px-4 py-3 text-sm text-slate-100 shadow-2xl hover:border-accent"
        onClick={() => setSurface("docked")}
        aria-label="Restaurar chat del agente"
      >
        <BrandMark size={16} />
        {title}
        {messages.length > 1 && <span className="rounded-full bg-accent px-1.5 text-[11px] text-ink">{messages.length}</span>}
      </button>
    );
  }

  const panelClass = fill
    ? "flex h-full min-h-0 flex-col gap-2.5 rounded-xl border border-line bg-panel p-3.5"
    : "flex min-h-[380px] flex-col gap-2.5 rounded-xl border border-line bg-panel p-3.5";

  return (
    <section className={panelClass} aria-label={`Chat con ${title}`} data-testid="chat-panel">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          {hint && <small className="text-[11px] text-muted">{hint}</small>}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={buttonGhost}
            onClick={() => {
              if (onMinimize) onMinimize();
              else setSurface("minimized");
            }}
            aria-label={onMinimize ? "Cerrar chat" : "Minimizar chat"}
          >
            {onMinimize ? "Cerrar" : "Minimizar"}
          </button>
        </div>
      </header>
      <div
        ref={listRef}
        className={`flex flex-col gap-2 overflow-auto pr-1 ${fill ? "min-h-0 flex-1" : "max-h-80"}`}
        onScroll={handleScroll}
        aria-live="polite"
        data-testid="chat-messages"
      >
        {messages.map((message, index) => (
          <article
            key={index}
            className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
              message.role === "user"
                ? "ml-auto max-w-[90%] border border-accent/30 bg-accent/10"
                : message.role === "system"
                  ? "border border-danger/35 bg-danger/10 text-danger"
                  : "border border-line bg-well"
            }`}
          >
            {message.role === "agent" ? <MarkdownMessage text={message.text} /> : message.text}
          </article>
        ))}
        {busy && (
          <article className="flex flex-col gap-2 rounded-lg border border-accent/25 bg-well px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                {turnStatusLabel(turn.status, turn.connection)}
              </span>
              <div className="flex items-center gap-2">
                <small className="text-[11px] text-muted">{elapsed > 0 ? formatElapsed(elapsed) : "ahora"}</small>
                {turn.turnId && onCancelTurn && (
                  <button
                    type="button"
                    className={buttonGhost}
                    onClick={() => {
                      if (window.confirm("¿Cancelar este turno? Puede quedar trabajo parcial en el proyecto.")) {
                        void turn.cancel();
                      }
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
            {activities.length > 0 && (
              <ul className="flex flex-col gap-1 text-[11px] text-muted" aria-label="Actividad del agente">
                {activities.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-1.5">
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        activity.status === "started"
                          ? "animate-pulse bg-accent motion-reduce:animate-none"
                          : activity.status === "failed"
                            ? "bg-danger"
                            : "bg-ok"
                      }`}
                    />
                    <span className={activity.status === "failed" ? "text-danger" : undefined}>{activity.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {draft ? (
              <div className="border-l-2 border-accent/40 pl-2.5 text-slate-200">
                <MarkdownMessage text={draft} />
                <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-accent align-middle motion-reduce:animate-none" />
              </div>
            ) : (
              <small className="text-muted">Preparando respuesta…</small>
            )}
          </article>
        )}
        {!busy && turn.connection === "error" && turn.turnId && onRetryTurn && (
          <div className="flex justify-end">
            <button
              type="button"
              className={buttonGhost}
              onClick={() => {
                void (async () => {
                  const result = await onRetryTurn(turn.turnId!);
                  setBusy(true);
                  onBusyChange?.(true);
                  const attached = await turn.reconnect(result.turn.id);
                  if (attached?.reply) setMessages((current) => [...current, { role: "agent", text: attached.reply }]);
                  setBusy(false);
                  onBusyChange?.(false);
                })();
              }}
            >
              Reintentar
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="flex min-h-6 items-center justify-end">
        {!atBottom && (
          <button
            type="button"
            className="rounded-full border border-line bg-panel-2 px-3 py-1 text-[11px] text-slate-200 transition hover:border-accent"
            onClick={scrollToLatest}
          >
            Ir al último mensaje
          </button>
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
