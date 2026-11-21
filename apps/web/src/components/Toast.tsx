import { toast } from "sonner";

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
