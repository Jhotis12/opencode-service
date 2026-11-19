import { Link } from "react-router-dom";

export function BrandMark({
  size = 24,
  title,
  className = "",
}: {
  size?: number;
  title?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`shrink-0 ${className}`}
    >
      <path
        d="M16.5 4.2H8.5C6.1 4.2 4.2 6.1 4.2 8.5V15.5C4.2 17.9 6.1 19.8 8.5 19.8H15.5C17.9 19.8 19.8 17.9 19.8 15.5V10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M9.4 9.2L13.2 12L9.4 14.8"
        stroke="var(--color-accent, #38BDF8)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="7" r="2.3" fill="var(--color-accent, #38BDF8)" />
    </svg>
  );
}

export function BrandLockup({
  size = 32,
  subtitle = "Agentes sobre OpenCode",
  to,
  compact = false,
  asHeading = false,
  className = "",
  wordmarkClassName = "",
}: {
  size?: number;
  subtitle?: string | false;
  to?: string;
  compact?: boolean;
  asHeading?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  const prominent = size >= 40;
  const Wordmark = asHeading ? "h1" : "strong";
  const content = (
    <>
      <BrandMark size={size} />
      {!compact && (
        <span className={`min-w-0 overflow-hidden ${wordmarkClassName}`}>
          <Wordmark
            className={`block whitespace-nowrap text-slate-100 ${
              prominent ? "text-xl font-semibold" : "text-xs font-semibold"
            }`}
          >
            Agentic Platform
          </Wordmark>
          {subtitle && (
            <small
              className={`block whitespace-nowrap text-muted ${
                prominent ? "text-xs" : "text-[11px]"
              }`}
            >
              {subtitle}
            </small>
          )}
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={`flex min-w-0 items-center gap-3 rounded-lg text-slate-100 transition hover:text-accent ${className}`}
        aria-label={compact ? "Agentic Platform, ir a proyectos" : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${className}`}
      aria-label={compact ? "Agentic Platform" : undefined}
    >
      {content}
    </div>
  );
}
