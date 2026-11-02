export const card =
  "flex flex-col gap-3 rounded-xl border border-line bg-panel/90 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)]";

export const button =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-panel-2 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-45";

export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-accent px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-45";

export const buttonGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-line hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-45";

export const buttonDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-danger transition hover:border-danger/50 hover:bg-danger/10";

export const input =
  "w-full rounded-lg border border-line bg-[#0a1120] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export const label = "flex flex-col gap-1.5 text-xs text-muted";

export const badge =
  "inline-flex w-fit items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted";

export const pageTitle = "text-2xl font-semibold tracking-tight text-slate-100";
export const sectionTitle = "text-base font-semibold text-slate-100";
export const muted = "text-sm text-muted";
export const smallMuted = "text-xs text-muted";

export function statusBadge(status: string): string {
  const base = badge;
  if (["ok", "succeeded", "connected", "active"].includes(status)) {
    return `${base} border-ok/40 text-ok`;
  }
  if (["degraded", "paused", "qr_pending", "needs_config", "running", "queued"].includes(status)) {
    return `${base} border-warn/40 text-warn`;
  }
  if (["down", "failed", "timed_out", "error"].includes(status)) {
    return `${base} border-danger/40 text-danger`;
  }
  return base;
}

export const modalBackdrop =
  "modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-[#020617]/75 p-0 backdrop-blur-sm sm:items-center sm:p-4";

export const modalPanel =
  "modal-surface flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl sm:rounded-2xl";
