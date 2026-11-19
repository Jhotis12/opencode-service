import type { ReactNode } from "react";
import { emptyState, emptyStateIcon, muted, sectionTitle } from "../ui.ts";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <section className={emptyState}>
      <div className={emptyStateIcon} aria-hidden="true">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>{title}</h2>
        <p className={`max-w-md ${muted}`}>{description}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </section>
  );
}
