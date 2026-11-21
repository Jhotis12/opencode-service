import { toast, Toaster } from "sonner";

/**
 * The toast host is fixed to the viewport bottom, so it must clear the gesture bar the same way
 * the chat pill and the drawer do: `viewport-fit=cover` makes the inset real, and sonner's own
 * defaults (24 desktop / 16 mobile) would put toasts inside a 24 px strip. The calc keeps the
 * shipped 24/16 px gaps on a flat viewport and adds the inset on a phone.
 */
export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      offset="calc(1.5rem + env(safe-area-inset-bottom))"
      mobileOffset="calc(1rem + env(safe-area-inset-bottom))"
    />
  );
}

export function notifySuccess(message: string): void {
  toast.success(message);
}

export function notifyWarning(message: string): void {
  toast.warning(message);
}

export function notifyError(message: string): void {
  toast.error(message);
}

export function dismissAll(): void {
  toast.dismiss();
}
