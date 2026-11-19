import { Link } from "react-router-dom";
import { focusRing } from "../ui.ts";

export type BreadcrumbItem = {
  readonly label: string;
  readonly to?: string;
  readonly title?: string;
};

export function Breadcrumbs({ items }: { readonly items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label="Migas de pan" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && (
                <svg
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 text-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              )}
              {item.to ? (
                <Link
                  to={item.to}
                  title={item.title}
                  aria-current={current ? "page" : undefined}
                  className={`min-w-0 truncate underline-offset-2 hover:underline ${focusRing} ${
                    current ? "font-medium text-slate-200" : "text-muted"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={current ? "page" : undefined}
                  title={item.title}
                  className="min-w-0 truncate font-medium text-slate-200"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
