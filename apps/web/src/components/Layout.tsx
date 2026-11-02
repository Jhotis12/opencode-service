import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.tsx";
import { buttonGhost } from "../ui.ts";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 flex h-auto flex-col gap-6 border-b border-line bg-[#080d18]/85 p-5 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <span className="text-3xl text-accent">◆</span>
          <div>
            <strong className="block text-sm text-slate-100">Agentic Platform</strong>
            <small className="text-[11px] text-muted">OpenCode V2 · Hexagonal</small>
          </div>
        </div>
        <nav className="flex flex-col gap-1.5" aria-label="Navegación principal">
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              `rounded-lg border px-3 py-2.5 text-sm transition ${
                isActive
                  ? "border-line bg-panel-2 text-slate-100"
                  : "border-transparent text-muted hover:bg-panel hover:text-slate-200"
              }`
            }
          >
            Proyectos
          </NavLink>
          <NavLink
            to="/notebooks"
            className={({ isActive }) =>
              `rounded-lg border px-3 py-2.5 text-sm transition ${
                isActive
                  ? "border-line bg-panel-2 text-slate-100"
                  : "border-transparent text-muted hover:bg-panel hover:text-slate-200"
              }`
            }
          >
            Bancos de información
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `rounded-lg border px-3 py-2.5 text-sm transition ${
                isActive
                  ? "border-line bg-panel-2 text-slate-100"
                  : "border-transparent text-muted hover:bg-panel hover:text-slate-200"
              }`
            }
          >
            Ajustes
          </NavLink>
          <NavLink
            to="/system/health"
            className={({ isActive }) =>
              `rounded-lg border px-3 py-2.5 text-sm transition ${
                isActive
                  ? "border-line bg-panel-2 text-slate-100"
                  : "border-transparent text-muted hover:bg-panel hover:text-slate-200"
              }`
            }
          >
            Salud del sistema
          </NavLink>
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <span className="text-xs text-muted">{user?.username}</span>
          <button
            className={`${buttonGhost} justify-start`}
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            Salir
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-[1500px] px-5 py-6 lg:px-8 lg:py-7">
        <Outlet />
      </main>
    </div>
  );
}
