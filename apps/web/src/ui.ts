export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const card =
  "flex flex-col gap-3 rounded-xl border border-line bg-panel/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)]";

export const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-panel-2 px-3.5 py-2 text-sm font-medium text-slate-200 transition active:scale-[0.97] hover:border-accent disabled:cursor-not-allowed disabled:opacity-45";

export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-accent px-3.5 py-2 text-sm font-semibold text-ink transition active:scale-[0.97] hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45";

export const buttonGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-slate-300 transition active:scale-[0.97] hover:border-line hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-45";

export const buttonDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-danger transition active:scale-[0.97] hover:border-danger/50 hover:bg-danger/10";

export const buttonDangerSolid =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-danger px-3.5 py-2 text-sm font-semibold text-ink transition active:scale-[0.97] hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-45";

export const input =
  "w-full rounded-lg border border-line bg-well px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export const label = "flex flex-col gap-1.5 text-xs text-muted";

export const badge =
  "inline-flex w-fit items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted";

export const pageTitle = "text-2xl font-semibold tracking-tight text-slate-100";
export const sectionTitle = "text-base font-semibold text-slate-100";
export const muted = "text-sm text-muted";
export const smallMuted = "text-xs text-muted";

export const pageHeader = "flex flex-col gap-3";
export const pageHeaderRow = "flex flex-wrap items-end justify-between gap-4";
export const pageHeaderContent = "flex min-w-0 flex-col gap-1";
export const pageHeaderActions = "flex flex-wrap items-center gap-2";

export const emptyState =
  "flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-panel/60 px-6 py-12 text-center";
export const emptyStateIcon = "text-accent [&>svg]:h-8 [&>svg]:w-8";

export const field = "flex flex-col gap-1.5";
export const fieldLabel = "text-xs font-medium text-slate-300";
export const fieldError = "text-xs text-danger";

export const tabList = "flex w-full gap-1 overflow-x-auto border-b border-line";
export const tab = `inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-t-lg border border-transparent px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-panel-2 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`;
export const tabActive = "border-line bg-panel-2 text-slate-100";

export const skeleton = "shrink-0 animate-pulse bg-panel-2 motion-reduce:animate-none";

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  queued: { label: "En cola", tone: "neutral" },
  pending: { label: "Pendiente", tone: "warning" },
  delivered: { label: "Entregado", tone: "success" },
  running: { label: "En ejecución", tone: "info" },
  paused: { label: "Pausado", tone: "warning" },
  succeeded: { label: "Completado", tone: "success" },
  failed: { label: "Fallido", tone: "danger" },
  timed_out: { label: "Tiempo agotado", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  skipped: { label: "Omitido", tone: "neutral" },
  ok: { label: "Operativo", tone: "success" },
  degraded: { label: "Degradado", tone: "warning" },
  down: { label: "Caído", tone: "danger" },
  connecting: { label: "Conectando", tone: "info" },
  connected: { label: "Conectado", tone: "success" },
  needs_config: { label: "Falta configurar", tone: "warning" },
  qr_pending: { label: "QR pendiente", tone: "warning" },
  error: { label: "Error", tone: "danger" },
  active: { label: "Activo", tone: "success" },
};

const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  success: "border-ok/40 text-ok",
  warning: "border-warn/40 text-warn",
  danger: "border-danger/40 text-danger",
  info: "border-accent/40 text-accent",
  neutral: "",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status]?.label ?? status;
}

export function statusTone(status: string): StatusTone {
  return STATUS_LABELS[status]?.tone ?? "neutral";
}

export function agentModeLabel(mode: string): string {
  if (mode === "primary") return "Principal";
  if (mode === "all") return "Principal y sub-agente";
  return "Sub-agente";
}

export function friendlyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (/invalid username or password/i.test(message)) return "Usuario o contraseña incorrectos.";
  if (/already exists/i.test(message)) return "Ya existe un recurso con ese identificador.";
  if (/failed to fetch|network|load failed/i.test(message)) {
    return "No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentarlo.";
  }
  if (/unauthorized|session/i.test(message)) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (/timeout|timed out/i.test(message)) return "La operación tardó demasiado. Vuelve a intentarlo.";
  return message || fallback;
}

export function statusBadge(status: string): string {
  return `${badge} ${STATUS_TONE_CLASS[statusTone(status)]}`.trim();
}

export const modalBackdrop =
  "modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-ink/75 p-0 backdrop-blur-sm sm:items-center sm:p-4";

export const modalPanel =
  "modal-surface flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl sm:rounded-2xl";
