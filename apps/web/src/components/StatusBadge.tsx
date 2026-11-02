import { statusBadge, statusLabel } from "../ui.ts";

export function StatusBadge({
  status,
  className = "",
  testId,
}: {
  status: string;
  className?: string;
  testId?: string;
}) {
  return (
    <span
      className={`${statusBadge(status)} ${className}`.trim()}
      title={status}
      aria-label={`Estado: ${statusLabel(status)}`}
      data-testid={testId}
    >
      {statusLabel(status)}
    </span>
  );
}
