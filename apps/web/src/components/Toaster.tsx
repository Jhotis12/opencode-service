import { Toaster } from "sonner";
import { toasterProps } from "../ui.ts";

export function PlatformToaster() {
  return <Toaster {...toasterProps} />;
}
