import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.tsx";
import { buttonGhost } from "../ui.ts";
import { BrandLockup } from "./Brand.tsx";
import { useMediaQuery } from "../useMediaQuery.ts";
import { NavIcon, type NavIconName } from "./NavIcon.tsx";

const NAV_ITEMS: Array<{ to: string; label: string; icon: NavIconName | "runs" }> = [
  { to: "/projects", label: "Proyectos", icon: "projects" },
  { to: "/runs", label: "Ejecuciones", icon: "runs" },
  { to: "/orchestrator", label: "Orquestador global", icon: "orchestrator" },
  { to: "/settings", label: "Ajustes", icon: "settings" },
  { to: "/system/health", label: "Salud del sistema", icon: "health" },
];

export function RunsNavIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

const COLLAPSE_KEY = "platform.nav.collapsed";

function initialCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    // Storage can be unavailable in private browsing; the rail still works for the session.
  }
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobileNav = useMediaQuery("(max-width: 1023px)");
  const navInert = isMobileNav && !mobileOpen;
  const fluid = location.pathname.startsWith("/projects/");

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      saveCollapsed(!current);
      return !current;
    });
  }

  return (
    <div className={`app-shell min-h-dvh lg:grid ${collapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[240px_1fr]"}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:border focus:border-line focus:bg-panel focus:px-4 focus:py-2 focus:text-sm focus:text-slate-100"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-ink/95 px-4 lg:hidden">
        <button
          type="button"
          className={buttonGhost}
          aria-label="Abrir navegación"
          onClick={() => setMobileOpen(true)}
        >
          <NavIcon name="menu" />
        </button>
        <BrandLockup size={24} subtitle={false} to="/projects" />
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/65 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        id="app-navigation"
        className={`nav-drawer fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col gap-6 border-r border-line bg-ink/95 p-4 lg:sticky lg:top-0 lg:bottom-auto lg:z-auto lg:h-dvh lg:w-auto lg:translate-x-0 lg:overflow-hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:gap-4 lg:p-3" : "lg:p-5"}`}
        aria-label="Navegación lateral"
        inert={navInert}
        aria-hidden={navInert || undefined}
      >
        <div className={`flex items-center gap-3 ${collapsed ? "lg:flex-col lg:gap-2" : ""}`}>
          <BrandLockup
            size={32}
            compact={false}
            subtitle="Agentes sobre OpenCode"
            to="/projects"
            className={collapsed ? "lg:self-stretch lg:justify-center lg:gap-0" : "flex-1"}
            wordmarkClassName={
              collapsed ? "nav-label lg:max-w-0 lg:opacity-0" : "nav-label lg:max-w-[180px] lg:opacity-100"
            }
          />
          <button
            type="button"
            className={`ml-auto hidden h-7 w-7 shrink-0 place-items-center rounded-md border border-transparent text-slate-300 transition hover:border-line hover:bg-panel-2 lg:grid ${
              collapsed ? "lg:ml-0" : ""
            }`}
            aria-label={collapsed ? "Expandir navegación" : "Contraer navegación"}
            aria-controls="app-navigation"
            aria-expanded={!collapsed}
            title={collapsed ? "Expandir navegación" : "Contraer navegación"}
            onClick={toggleCollapsed}
          >
            <NavIcon name={collapsed ? "expand" : "collapse"} />
          </button>
          <button
            type="button"
            className={`${buttonGhost} ml-auto !px-2 lg:hidden`}
            aria-label="Cerrar navegación"
            onClick={() => setMobileOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className="flex flex-col gap-1.5" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `nav-item flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
                  collapsed ? "lg:gap-0 lg:px-[11px]" : ""
                } ${
                  isActive
                    ? "border-line bg-panel-2 text-slate-100"
                    : "border-transparent text-muted hover:bg-panel hover:text-slate-200"
                }`
              }
            >
              {item.icon === "runs" ? <RunsNavIcon /> : <NavIcon name={item.icon} />}
              <span
                className={`nav-label min-w-0 overflow-hidden whitespace-nowrap ${
                  collapsed ? "lg:max-w-0 lg:opacity-0" : "lg:max-w-[180px] lg:opacity-100"
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className={`mt-auto flex flex-col gap-2 ${collapsed ? "lg:items-center" : ""}`}>
          <span
            className={`nav-label min-w-0 overflow-hidden whitespace-nowrap text-xs text-muted ${
              collapsed ? "lg:max-w-0 lg:opacity-0" : "lg:max-w-[180px] lg:opacity-100"
            }`}
          >
            {user?.username}
          </span>
          <button
            className={`${buttonGhost} justify-start ${collapsed ? "lg:justify-center lg:gap-0 lg:!px-2" : ""}`}
            aria-label="Salir"
            title={collapsed ? "Salir" : undefined}
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            <NavIcon name="logout" />
            <span
              className={`nav-label min-w-0 overflow-hidden whitespace-nowrap ${
                collapsed ? "lg:max-w-0 lg:opacity-0" : "lg:max-w-[180px] lg:opacity-100"
              }`}
            >
              Salir
            </span>
          </button>
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        data-testid="app-main"
        className={
          fluid
            ? "h-[calc(100dvh-3.5rem)] min-w-0 overflow-hidden lg:h-dvh"
            : "mx-auto w-full max-w-[1500px] px-5 py-6 lg:px-8 lg:py-8"
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
