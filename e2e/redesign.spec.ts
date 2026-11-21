import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INITIAL_PASSWORD = "admin123!";
const CHANGED_PASSWORD = "plataforma-segura-2026";
const OPERATOR_FIXTURE = "/tmp/redesign-e2e-fixture";

let cachedSession: { name: string; value: string; password: string } | undefined;

/**
 * Drives the shared Select the way a user does: open its combobox trigger, then pick the
 * row by accessible name. These filters used to be native drop-down elements.
 */
async function chooseFromCombobox(page: Page, field: string, option: string): Promise<void> {
  await page.getByRole("combobox", { name: field, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/**
 * Resolves whichever admin password is current (platform.spec.ts owns the first-boot change)
 * so this spec stays order-independent, and leaves the browser context authenticated.
 * The signed session cookie is reused across tests to stay under the login rate limit.
 */
async function signInWithCurrentAdminPassword(page: Page): Promise<string> {
  if (cachedSession) {
    await page.context().addCookies([
      { name: cachedSession.name, value: cachedSession.value, url: "http://127.0.0.1:3100" },
    ]);
    return cachedSession.password;
  }
  for (const candidate of [CHANGED_PASSWORD, INITIAL_PASSWORD]) {
    const response = await page.request.post("/api/auth/login", {
      data: { username: "admin", password: candidate },
    });
    if (!response.ok()) continue;
    const body = (await response.json()) as { mustChangePassword?: boolean };
    if (body.mustChangePassword) {
      const changed = await page.request.post("/api/auth/change-password", {
        data: { currentPassword: candidate, newPassword: CHANGED_PASSWORD },
      });
      expect(changed.ok()).toBeTruthy();
    }
    const password = body.mustChangePassword ? CHANGED_PASSWORD : candidate;
    const session = (await page.context().cookies()).find((cookie) => cookie.httpOnly);
    if (session) cachedSession = { name: session.name, value: session.value, password };
    return password;
  }
  throw new Error("could not authenticate the seeded admin");
}

test("login rejects bad credentials and change-password enforces its rules", async ({ page }) => {
  const currentPassword = await signInWithCurrentAdminPassword(page);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Agentic Platform" })).toBeVisible();
  const form = page.getByRole("form", { name: "Iniciar sesión" });
  await expect(form).toBeVisible();
  await expect(form.getByLabel("Usuario", { exact: true })).toHaveValue("admin");

  const password = form.getByLabel("Contraseña", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await form.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await form.getByRole("button", { name: "Ocultar contraseña" }).click();
  await expect(password).toHaveAttribute("type", "password");

  await password.fill("no-es-la-clave");
  await form.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveText("Usuario o contraseña incorrectos.");
  await expect(page).toHaveURL(/\/login$/);

  await password.fill(currentPassword);
  await form.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "Automatizaciones agénticas sobre OpenCode" })).toBeVisible();

  await page.goto("/change-password");
  const changeForm = page.getByRole("form", { name: "Cambiar contraseña" });
  await expect(page.getByRole("heading", { name: "Cambia tu contraseña inicial" })).toBeVisible();
  await changeForm.getByLabel("Contraseña actual", { exact: true }).fill(currentPassword);
  await changeForm.getByLabel("Nueva contraseña", { exact: true }).fill("corta");

  await changeForm.getByLabel("Confirmar nueva contraseña", { exact: true }).click();
  await expect(changeForm.getByText("La nueva contraseña necesita al menos 12 caracteres.")).toBeVisible();
  await changeForm.getByLabel("Nueva contraseña", { exact: true }).fill("redesign-e2e-password-2026");
  await changeForm.getByLabel("Confirmar nueva contraseña", { exact: true }).fill("otra-clave-distinta-2026");
  await expect(changeForm.getByText("Las contraseñas no coinciden.")).toBeVisible();
  await expect(changeForm.getByRole("button", { name: "Guardar y continuar" })).toBeDisabled();

  await expect(page).toHaveURL(/\/change-password$/);
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Automatizaciones agénticas sobre OpenCode" })).toBeVisible();
});

test("projects onboarding creates a project and every section has its own route", async ({ page }) => {
  await signInWithCurrentAdminPassword(page);
  await page.goto("/projects");

  const onboarding = page.getByRole("region", { name: "Cómo funciona" });
  await expect(onboarding).toBeVisible();
  await expect(onboarding.getByText("Flujo", { exact: true })).toBeVisible();
  await expect(onboarding.getByText("Ejecución", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Descartar la guía de cómo funciona" }).click();
  await expect(onboarding).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Cómo funciona" })).toHaveCount(0);

  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo proyecto" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Nombre del proyecto/).fill("Rediseño E2E");
  await expect(dialog.getByLabel(/^Slug/)).toHaveValue("rediseno-e2e");
  await dialog.getByLabel(/^Descripción/).fill("Cubre las secciones del workspace rediseñado.");
  await expect(dialog.getByRole("radio", { name: /En blanco/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Crear proyecto" }).click();

  await expect(page).toHaveURL(/\/projects\/rediseno-e2e\/overview$/);
  await expect(page.getByRole("heading", { name: "Resumen", level: 1 })).toBeVisible();
  await expect(page.getByTestId("overview-readiness")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Secciones del proyecto" });

  await nav.getByRole("link", { name: /^Flujo$/ }).click();
  await expect(page).toHaveURL(/\/projects\/rediseno-e2e\/flow$/);
  await expect(page.getByTestId("workflow-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Nodo" })).toBeVisible();

  await nav.getByRole("link", { name: /^Ejecuciones/ }).click();
  await expect(page).toHaveURL(/\/projects\/rediseno-e2e\/runs$/);
  await expect(page.getByRole("heading", { name: "Ejecuciones", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sin ejecuciones todavía" })).toBeVisible();

  await nav.getByRole("link", { name: /^Agentes/ }).click();
  await expect(page).toHaveURL(/\/projects\/rediseno-e2e\/agents$/);
  await expect(page.getByRole("heading", { name: "Agentes", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuevo agente" })).toBeVisible();

  await nav.getByRole("link", { name: /^Conocimiento$/ }).click();
  await expect(page).toHaveURL(/\/projects\/rediseno-e2e\/knowledge$/);
  await expect(page.getByRole("form", { name: "Crear notebook" })).toBeVisible();

  await nav.getByRole("link", { name: /^Integraciones/ }).click();
  await expect(page).toHaveURL(/\/projects\/rediseno-e2e\/integrations$/);
  await expect(page.getByRole("heading", { name: "Integraciones", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sin integraciones todavía" })).toBeVisible();

  await nav.getByRole("link", { name: /^Ajustes$/ }).click();
  await expect(page).toHaveURL(/\/projects\/rediseno-e2e\/settings$/);
  const settingsTabs = page.getByRole("tablist", { name: "Secciones de configuración" });
  await expect(settingsTabs.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  await settingsTabs.getByRole("tab", { name: "Preparación" }).click();
  await expect(page.getByRole("heading", { name: "Preparación del proyecto" })).toBeVisible();

  await nav.getByRole("link", { name: /^Resumen$/ }).click();
  await expect(page).toHaveURL(/\/projects\/rediseno-e2e\/overview$/);

  await page.goto("/projects/rediseno-e2e");
  await expect(page).toHaveURL(/\/projects\/rediseno-e2e\/overview$/);
  await page.goto("/projects/rediseno-e2e/knowledge");
  await expect(page.getByRole("form", { name: "Crear notebook" })).toBeVisible();
});

test("a fake run is listed, filtered and opened from the project and global executions", async ({ page }) => {
  await signInWithCurrentAdminPassword(page);
  const slug = "rediseno-runs";
  expect((await page.request.post("/api/projects", { data: { slug, name: "Rediseño Runs" } })).status()).toBe(201);
  const launched = await page.request.post(`/api/projects/${slug}/runs`, { data: { payload: {} } });
  expect(launched.status()).toBe(202);
  const run = (await launched.json()) as { id: string };
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/runs/${run.id}`);
        return ((await response.json()) as { status: string }).status;
      },
      { timeout: 30_000 },
    )
    .toBe("succeeded");
  const shortId = run.id.slice(0, 8);

  await page.goto(`/projects/${slug}/runs`);
  await expect(page.getByRole("heading", { name: "Ejecuciones", level: 1 })).toBeVisible();
  const projectRows = page.getByTestId("run-row");
  await expect(projectRows).toHaveCount(1);
  await expect(projectRows.first()).toContainText(shortId);
  await expect(page.getByTestId("runs-filter-count")).toHaveText("Mostrando 1 de 1 ejecuciones.");

  await chooseFromCombobox(page, "Estado", "Fallido");
  await expect(page.getByTestId("runs-filter-count")).toHaveText("Mostrando 0 de 1 ejecuciones.");
  await expect(page.getByRole("heading", { name: "Ninguna ejecución coincide" })).toBeVisible();
  await expect(projectRows).toHaveCount(0);
  await page.getByRole("button", { name: "Limpiar filtros" }).first().click();
  await expect(projectRows).toHaveCount(1);

  await page.getByRole("button", { name: "Ver detalle" }).click();
  const projectDetail = page.getByRole("dialog", { name: /^Ejecución/ });
  await expect(projectDetail.getByTestId("run-status")).toHaveText("Completado");
  await expect(projectDetail.getByText("Resultado final")).toBeVisible();
  await projectDetail.getByRole("button", { name: "Cerrar" }).click();
  await expect(projectDetail).toBeHidden();

  await page.goto("/runs");
  await expect(page.getByRole("heading", { name: "Ejecuciones", level: 1 })).toBeVisible();
  await chooseFromCombobox(page, "Proyecto", slug);
  const globalRows = page.getByTestId("run-row");
  await expect(globalRows).toHaveCount(1);
  await expect(globalRows).toContainText(shortId);
  await expect(page.getByTestId("global-runs-count")).toHaveText("Mostrando 1–1 de 1 ejecuciones");
  await expect(page.getByRole("button", { name: "Exportar JSON" })).toBeEnabled();

  await chooseFromCombobox(page, "Estado", "Fallido");
  await expect(page.getByRole("heading", { name: "Ninguna ejecución coincide" })).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).first().click();
  await expect(page.getByRole("combobox", { name: "Estado", exact: true })).toContainText("Todos");
  await chooseFromCombobox(page, "Proyecto", slug);
  await expect(globalRows).toHaveCount(1);

  await page.getByRole("button", { name: "Ver detalle" }).click();
  const globalDetail = page.getByRole("dialog", { name: /^Ejecución/ });
  await expect(globalDetail.getByTestId("run-status")).toHaveText("Completado");
  await expect(globalDetail.getByText("Resultado final")).toBeVisible();
  await globalDetail.getByRole("button", { name: "Cerrar" }).click();
  await expect(globalDetail).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/runs\\?project=${slug}`));
});

test("platform settings route by section and health reports the stack", async ({ page }) => {
  await signInWithCurrentAdminPassword(page);
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Ajustes de plataforma" })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Secciones de ajustes de plataforma" });
  const sections: ReadonlyArray<[label: string, hash: string, title: string]> = [
    ["Modelo", "#modelo", "Modelo por defecto"],
    ["Orquestador", "#orquestador", "Modelo del orquestador"],
    ["Proveedores", "#proveedores", "Proveedores"],
    ["Bóveda", "#boveda", "Bóveda"],
    ["Telemetría", "#telemetria", "Telemetría"],
    ["Proyectos", "#proyectos", "Proyectos"],
    ["Canales globales", "#canales", "Canales globales"],
    ["Configuración efectiva", "#configuracion", "Configuración efectiva"],
  ];

  for (const [label, hash, title] of sections) {
    await tabs.getByRole("tab", { name: label }).click();
    await expect(tabs.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(new RegExp(`/settings${hash}$`));
    await expect(page.getByRole("tabpanel", { name: label }).getByRole("heading", { name: title })).toBeVisible();
  }

  await page.goto("/settings#boveda");
  await expect(tabs.getByRole("tab", { name: "Bóveda" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Bóveda" }).getByRole("heading", { name: "Bóveda" })).toBeVisible();

  await page.goto("/system/health");
  await expect(page.getByRole("heading", { name: "Salud del sistema" })).toBeVisible();
  await expect(page.getByTestId("health-status")).toHaveText("Operativo");
  await expect(page.getByRole("cell", { name: "OpenCode V2" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Database" })).toBeVisible();
  await page.getByRole("button", { name: "Pausar actualización" }).click();
  await expect(page.getByRole("button", { name: "Reanudar actualización" })).toBeVisible();
  await expect(page.getByText("Actualización automática pausada.")).toBeVisible();
  await page.getByRole("button", { name: "Reanudar actualización" }).click();
  await expect(page.getByRole("button", { name: "Pausar actualización" })).toBeVisible();
});

test("the suite keeps its own data dir and leaves an operator fixture untouched", async ({ page }) => {
  const marker = join(OPERATOR_FIXTURE, "users.json");
  const payload = JSON.stringify({ users: [{ username: "operador", role: "admin" }] });
  mkdirSync(OPERATOR_FIXTURE, { recursive: true });
  writeFileSync(marker, payload);
  const seededAt = new Date("2026-01-01T00:00:00.000Z");
  utimesSync(marker, seededAt, seededAt);
  const before = statSync(marker);

  await signInWithCurrentAdminPassword(page);
  await page.goto("/settings");
  await expect(page.getByText("Datos persistentes:")).toBeVisible();
  const dataDir = await page.locator("p", { hasText: "Datos persistentes:" }).locator("code").innerText();

  expect(dataDir).toContain("opencode-agentic-platform-e2e");
  expect(dataDir).not.toContain(OPERATOR_FIXTURE);

  const after = statSync(marker);
  expect(after.mtimeMs).toBe(before.mtimeMs);
  expect(readFileSync(marker, "utf8")).toBe(payload);
});

test("the rail stays pinned while a long page scrolls", async ({ page }) => {
  await signInWithCurrentAdminPassword(page);
  await page.setViewportSize({ width: 1440, height: 520 });
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const path of ["/system/health", "/projects", "/runs", "/settings", "/orchestrator"]) {
    await page.goto(path);
    await expect(page.getByRole("main").or(page.getByTestId("app-main"))).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return {
        scrolled: window.scrollY,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      };
    });
    if (metrics.documentHeight <= metrics.viewportHeight + 80) continue;
    expect(metrics.scrolled, `${path} should scroll`).toBeGreaterThan(0);
    // A sticky element's box must be read with getBoundingClientRect: Playwright's boundingBox()
    // reports a different y for it here (76px while the element sits at -0.3px), which made this
    // assertion fail on CI while the rail was demonstrably pinned.
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            const nav = document.querySelector("#app-navigation");
            return nav ? Math.round(nav.getBoundingClientRect().top) : Number.NaN;
          });
        },
        { message: `${path} keeps the rail pinned at the bottom of the page`, timeout: 5000 },
      )
      .toBeLessThan(4);
  }
});
