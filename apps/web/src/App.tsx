import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth.tsx";
import { Layout } from "./components/Layout.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { ChangePasswordPage } from "./pages/ChangePasswordPage.tsx";
import { ProjectsPage } from "./pages/ProjectsPage.tsx";
import { ProjectPage } from "./pages/ProjectPage.tsx";
import { RunsPage } from "./pages/RunsPage.tsx";
import { OrchestratorPage } from "./pages/OrchestratorPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { HealthPage } from "./pages/HealthPage.tsx";

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-muted">Cargando…</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<Layout />}>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:slug" element={<ProjectPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/orchestrator" element={<OrchestratorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/system/health" element={<HealthPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
