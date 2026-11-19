import { lazy } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./auth.tsx";
import { Layout } from "./components/Layout.tsx";
import { PlatformToaster } from "./components/Toaster.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { ChangePasswordPage } from "./pages/ChangePasswordPage.tsx";
import { ProjectsPage } from "./pages/ProjectsPage.tsx";
import { ProjectLayout } from "./pages/ProjectLayout.tsx";
import { GlobalRunsPage } from "./pages/GlobalRunsPage.tsx";
import { OrchestratorPage } from "./pages/OrchestratorPage.tsx";
import { PlatformSettingsPage } from "./pages/PlatformSettingsPage.tsx";
import { HealthPage } from "./pages/HealthPage.tsx";

const ProjectOverviewPage = lazy(() =>
  import("./pages/ProjectOverviewPage.tsx").then((m) => ({ default: m.ProjectOverviewPage })),
);
const ProjectFlowPage = lazy(() =>
  import("./pages/ProjectFlowPage.tsx").then((m) => ({ default: m.ProjectFlowPage })),
);
const ProjectRunsPage = lazy(() => import("./pages/ProjectRunsPage.tsx").then((m) => ({ default: m.ProjectRunsPage })));
const ProjectAgentsPage = lazy(() =>
  import("./pages/ProjectAgentsPage.tsx").then((m) => ({ default: m.ProjectAgentsPage })),
);
const ProjectKnowledgePage = lazy(() =>
  import("./pages/ProjectKnowledgePage.tsx").then((m) => ({ default: m.ProjectKnowledgePage })),
);
const ProjectIntegrationsPage = lazy(() =>
  import("./pages/ProjectIntegrationsPage.tsx").then((m) => ({ default: m.ProjectIntegrationsPage })),
);
const ProjectSettingsPage = lazy(() =>
  import("./pages/ProjectSettingsPage.tsx").then((m) => ({ default: m.ProjectSettingsPage })),
);

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

function ProjectSectionRedirect() {
  const { slug = "" } = useParams();
  return <Navigate replace to={`/projects/${slug}/overview`} />;
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<Layout />}>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:slug" element={<ProjectLayout />}>
              <Route index element={<ProjectSectionRedirect />} />
              <Route path="overview" element={<ProjectOverviewPage />} />
              <Route path="flow" element={<ProjectFlowPage />} />
              <Route path="runs" element={<ProjectRunsPage />} />
              <Route path="agents" element={<ProjectAgentsPage />} />
              <Route path="knowledge" element={<ProjectKnowledgePage />} />
              <Route path="integrations" element={<ProjectIntegrationsPage />} />
              <Route path="settings" element={<ProjectSettingsPage />} />
              <Route path="*" element={<ProjectSectionRedirect />} />
            </Route>
            <Route path="/runs" element={<GlobalRunsPage />} />
            <Route path="/orchestrator" element={<OrchestratorPage />} />
            <Route path="/settings" element={<PlatformSettingsPage />} />
            <Route path="/system/health" element={<HealthPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
      <PlatformToaster />
    </>
  );
}
