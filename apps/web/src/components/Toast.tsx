import type { CSSProperties } from "react";
import { toast, Toaster, type ToasterProps } from "sonner";

/**
 * Shared sonner host config. The offsets consume the bottom safe-area inset so a toast never
 * lands inside the gesture bar; the rest is the shared look both toast migrations settled on.
 */
export const toastVars = {
  "--normal-bg": "var(--color-panel)",
  "--normal-border": "var(--color-line)",
  "--normal-text": "var(--color-text)",
  "--border-radius": "0.5rem",
  "--width": "22rem",
} as CSSProperties;

export const toasterProps: ToasterProps = {
  theme: "dark",
  position: "bottom-right",
  richColors: true,
  visibleToasts: 3,
  closeButton: true,
  offset: "calc(1.5rem + env(safe-area-inset-bottom))",
  mobileOffset: "calc(1rem + env(safe-area-inset-bottom))",
  gap: 10,
  containerAriaLabel: "Notificaciones",
  customAriaLabel: "Notificaciones",
  style: toastVars,
  toastOptions: {
    closeButtonAriaLabel: "Cerrar notificación",
    duration: 5000,
    style: {
      fontSize: "0.875rem",
      padding: "0.875rem 1rem",
      boxShadow: "0 12px 32px rgba(3, 7, 18, 0.55)",
    },
    classNames: {
      title: "text-sm font-medium text-slate-100",
      description: "text-xs text-muted",
      closeButton: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      success: "[&_[data-icon]]:text-ok",
      error: "[&_[data-icon]]:text-danger",
      info: "[&_[data-icon]]:text-accent",
      warning: "[&_[data-icon]]:text-warn",
    },
  },
};

export type NotifyOptions = {
  readonly description?: string;
  readonly duration?: number;
};

/** The app's only toast host; it reads the shared config above so host and helpers cannot drift. */
export function AppToaster() {
  return <Toaster {...toasterProps} />;
}

export function notifySuccess(message: string, options?: NotifyOptions): void {
  toast.success(message, options);
}

export function notifyWarning(message: string, options?: NotifyOptions): void {
  toast.warning(message, options);
}

export function notifyInfo(message: string, options?: NotifyOptions): void {
  toast.info(message, options);
}

export function notifyError(message: string, options?: NotifyOptions): void {
  toast.error(message, options);
}

export function dismissAll(): void {
  toast.dismiss();
}
