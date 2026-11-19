import type { ReactNode } from "react";
import { muted, pageHeader, pageHeaderActions, pageHeaderContent, pageHeaderRow, pageTitle } from "../ui.ts";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly breadcrumbs?: ReactNode;
}) {
  return (
    <header className={pageHeader}>
      {breadcrumbs && <div className="min-w-0 text-xs text-muted">{breadcrumbs}</div>}
      <div className={pageHeaderRow}>
        <div className={pageHeaderContent}>
          <h1 className={pageTitle}>{title}</h1>
          {description && <p className={`max-w-3xl ${muted}`}>{description}</p>}
        </div>
        {actions && <div className={pageHeaderActions}>{actions}</div>}
      </div>
    </header>
  );
}
