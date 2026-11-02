import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatProgressEvent } from "@platform/shared";
import type { ChatHistoryMessage } from "../api.ts";
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

type ChatSurface = "docked" | "expanded" | "minimized";

const WELCOME =
  "Hola. Soy el agente principal de este proyecto. Puedo crear o editar nodos, sub-agentes y ejecutar el flujo. Te hablaré en términos de nodos y resultados; si necesitas el detalle técnico, lo abrimos.";

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
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
    <div className="prose-chat flex flex-col gap-2 text-[13px] leading-relaxed">
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
                  className="absolute right-2 top-2 z-10 rounded border border-line bg-panel px-2 py-1 text-[10px] text-muted hover:text-slate-100"
                  onClick={() => void copyText(raw)}
                >
                  Copiar
                </button>
                <pre className="mt-1">{children}</pre>
              </div>
            );
          },
          code: ({ children, className }) => (
            <code className={className ? "block" : "rounded border border-line bg-[#0b1220] px-1 py-0.5 text-[0.85em]"}>
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
  onSend(message: string, onEvent: (event: ChatProgressEvent) => void): Promise<string>;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [activities, setActivities] = useState<ChatActivity[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [surface, setSurface] = useState<ChatSurface>(() => {
    const saved = localStorage.getItem(`chat-surface:${storageKey}`);
    if (saved === "expanded") return "expanded";
    if (saved === "minimized" && !onMinimize) return "minimized";
    return "docked";
  });
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (surface === "minimized" || !atBottom) return;
    if (typeof endRef.current?.scrollIntoView === "function") {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, busy, draft, activities, surface, atBottom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && surface === "expanded") setSurface("docked");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [surface]);

  function upsertActivity(event: ChatProgressEvent & { type: "activity" }) {
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
    setBusy(true);
    setDraft("");
    setActivities([]);
    setAtBottom(true);
    onBusyChange?.(true);
    onActivityChange?.("Preparando respuesta…");
    let textStarted = false;
    try {
      const reply = await onSend(message, (progress) => {
        if (progress.type === "text") {
          setDraft((current) => current + progress.text);
          if (!textStarted) {
            textStarted = true;
            onActivityChange?.("Redactando respuesta…");
          }
        } else {
          upsertActivity(progress);
        }
      });
      setMessages((current) => [...current, { role: "agent", text: reply }]);
    } catch (error) {
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
        <span className="text-accent">◆</span>
        {title}
        {messages.length > 1 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-ink">{messages.length}</span>}
      </button>
    );
  }

  const expanded = surface === "expanded";
  const panelClass = expanded
    ? "fixed inset-0 z-40 flex flex-col gap-2.5 rounded-none border border-line bg-panel p-4 shadow-2xl sm:inset-4 sm:rounded-xl"
    : fill
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
            onClick={() => setSurface(expanded ? "docked" : "expanded")}
            aria-label={expanded ? "Contraer chat" : "Expandir chat"}
          >
            {expanded ? "Contraer" : "Expandir"}
          </button>
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
        className={`flex flex-col gap-2 overflow-auto pr-1 ${expanded || fill ? "min-h-0 flex-1" : "max-h-80"}`}
        onScroll={handleScroll}
        aria-live="polite"
        data-testid="chat-messages"
      >
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
            {message.role === "agent" ? <MarkdownMessage text={message.text} /> : message.text}
          </article>
        ))}
        {busy && (
          <article className="flex flex-col gap-2 rounded-[10px] border border-accent/25 bg-[#0b1220] px-3 py-2.5 text-[13px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                Agente trabajando
              </span>
              <small className="text-[10px] text-muted">{elapsed > 0 ? formatElapsed(elapsed) : "ahora"}</small>
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
        <div ref={endRef} />
      </div>
      {!atBottom && (
        <button
          type="button"
          className={buttonGhost}
          onClick={() => {
            if (typeof endRef.current?.scrollIntoView === "function") endRef.current.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Ir al último mensaje
        </button>
      )}
      <form className="flex flex-col gap-2" onSubmit={submit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pídele un flujo, una corrección o un reporte…"
          rows={expanded ? 4 : 3}
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
