const common = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "shrink-0",
  "aria-hidden": true,
};

export type NavIconName = "projects" | "orchestrator" | "settings" | "health" | "logout" | "menu" | "collapse" | "expand";

export function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case "projects":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="7" height="7" rx="1.5" />
          <rect x="14" y="4" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "orchestrator":
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="2.5" />
          <circle cx="5" cy="18" r="2.5" />
          <circle cx="19" cy="18" r="2.5" />
          <path d="M12 7.5v4M10 12H6.5l-1.5 3.5M14 12h3.5l1.5 3.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-3v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-3h.08A1.7 1.7 0 0 0 4.6 9.94a1.7 1.7 0 0 0-.34-1.88L4.2 8l2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 9.3 4.72V4h3v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L17.4 7.36l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H19v3h-.08A1.7 1.7 0 0 0 19.4 15z" />
        </svg>
      );
    case "health":
      return (
        <svg {...common}>
          <path d="M3 12h4l2-5 4 10 2-5h6" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M18 12H9" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case "collapse":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M15 9l-3 3 3 3" />
        </svg>
      );
    case "expand":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16M12 9l3 3-3 3" />
        </svg>
      );
  }
}
