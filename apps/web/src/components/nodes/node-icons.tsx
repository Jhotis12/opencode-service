import type { NodeType } from "@platform/shared";

export function NodeIcon({ type }: { type: NodeType }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (type) {
    case "trigger":
      return (
        <svg {...common}>
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <path d="M8 6 3 12l5 6M16 6l5 6-5 6" />
        </svg>
      );
    case "agent":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="16" height="11" rx="3" />
          <path d="M12 8V4M9 13h.01M15 13h.01M9 16h6" />
        </svg>
      );
    case "decision":
      return (
        <svg {...common}>
          <path d="M6 4v5a4 4 0 0 0 4 4h8M6 20v-5a4 4 0 0 1 4-4h8" />
          <circle cx="6" cy="4" r="1.4" />
          <circle cx="6" cy="20" r="1.4" />
          <path d="m15 10 3 3-3 3" />
        </svg>
      );
    case "approval":
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
          <path d="m8.5 12 2.4 2.4 4.6-5" />
        </svg>
      );
    case "http":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
        </svg>
      );
    case "database":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
        </svg>
      );
    case "notify":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H9l-5 4V5z" />
          <path d="M8 9h8M8 12h5" />
        </svg>
      );
    case "delay":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "transform":
      return (
        <svg {...common}>
          <path d="M4 7h12l-3-3M20 17H8l3 3" />
        </svg>
      );
    case "validate":
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
          <path d="m8.5 12 2.4 2.4 4.6-5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
