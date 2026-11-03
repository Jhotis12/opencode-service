import { expect, test, type Page } from "@playwright/test";
import { createServer } from "node:http";

test("first boot, project canvas, project resources, sub-agent, external chat and health", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Contraseña").fill("admin123!");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { name: "Cambia tu contraseña inicial" })).toBeVisible();
  await page.getByLabel("Contraseña actual").fill("admin123!");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("plataforma-segura-2026");
  await page.getByLabel("Confirmar nueva contraseña").fill("plataforma-segura-2026");
  await page.getByRole("button", { name: "Guardar y continuar" }).click();

  await expect(page.getByRole("heading", { name: "Proyectos y automatizaciones" })).toBeVisible();
  await page.getByRole("button", { name: "Crear primer proyecto" }).click();
  await page.getByLabel(/Nombre del proyecto/).fill("E2E Bot");
  await page.getByLabel(/^Slug/).fill("e2e-bot");
  await page.getByLabel(/^Descripción/).fill("Proyecto de prueba end-to-end");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page).toHaveURL(/\/projects\/e2e-bot$/);
  await expect(page.getByText("E2E Bot", { exact: true })).toBeVisible();

  // The canvas now uses a full-bleed workspace and the palette is an overlay modal.
  await page.getByRole("button", { name: "+ Nodo" }).click();
  const palette = page.getByRole("dialog", { name: "Agregar nodo" });
  await expect(palette).toBeVisible();
  await palette.getByRole("button", { name: /Código/ }).click();

  const codeInspector = page.getByRole("dialog", { name: /Nodo:/ });
  await expect(codeInspector).toBeVisible();
  await codeInspector.getByLabel("Etiqueta").fill("Preparar datos");
  await codeInspector.getByRole("button", { name: "Cerrar" }).click();

  const codeNode = page.locator('[data-testid^="rf__node-code-"]');
  await expect(codeNode).toBeVisible();
  await expect(page.locator('[data-node-shape="code"]')).toHaveCount(1);
  await expect(page.locator('[data-node-shape="trigger"]')).toHaveCount(1);

  // Connect the trigger to the new code node from the inspector, without dragging handles.
  await page.locator('[data-testid="rf__node-start"]').click();
  const startInspector = page.getByRole("dialog", { name: "Nodo: Inicio manual" });
  await expect(startInspector).toBeVisible();
  await startInspector.getByRole("tab", { name: "Conexiones" }).click();
  await startInspector.getByLabel("Nodo destino").selectOption({ label: "Preparar datos" });
  await startInspector.getByRole("button", { name: "Conectar", exact: true }).click();
  await startInspector.getByRole("button", { name: "Cerrar" }).click();

  // Save, reload and verify the node and connection persisted.
  await page.getByRole("button", { name: "Guardar flujo" }).click();
  await expect(page.getByText("Flujo guardado")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Preparar datos", { exact: true })).toBeVisible();

  // The sidebar collapses into an icon rail and remembers the preference.
  await page.getByRole("button", { name: "Contraer navegación" }).click();
  await expect(page.getByRole("button", { name: "Expandir navegación" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expandir navegación" })).toBeVisible();
  await page.getByRole("button", { name: "Expandir navegación" }).click();

  // The canvas uses the viewport, and the minimap/controls keep the dark theme.
  const canvasBox = await page.getByTestId("workflow-canvas").boundingBox();
  expect(canvasBox?.width ?? 0).toBeGreaterThan(1000);
  expect(canvasBox?.height ?? 0).toBeGreaterThan(700);
  const initialZoom = await page.locator(".react-flow__viewport").evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return Number(transform.split("(")[1]?.split(",")[0] ?? 0);
  });
  expect(initialZoom).toBeGreaterThanOrEqual(0.8);
  await expect(page.getByRole("button", { name: "Ajustar vista del flujo" })).toBeVisible();
  await page.getByRole("button", { name: "Ajustar vista del flujo" }).click();
  const minimapColor = await page
    .locator(".react-flow__minimap")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const controlsColor = await page
    .locator(".react-flow__controls-button")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(minimapColor).not.toBe("rgb(255, 255, 255)");
  expect(controlsColor).not.toBe("rgb(255, 255, 255)");

  // The desktop top bar keeps every tab label inside the strip at 1440 and 1280.
  const assertTabsFit = async () => {
    const nav = page.locator('nav[aria-label="Secciones del proyecto"]');
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    for (const name of [/^Canvas$/, /^Ejecuciones/, /^Agentes/, /^Conocimiento$/, /^Recursos/, /^Ajustes$/]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(navBox!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(navBox!.x + navBox!.width + 1);
    }
  };
  await assertTabsFit();
  await page.setViewportSize({ width: 1280, height: 900 });
  await assertTabsFit();
  await page.setViewportSize({ width: 1440, height: 960 });

  // Delete the edge through its toolbar and recreate the connection.
  await page.locator(".react-flow__edge-interaction").first().click({ force: true });
  await expect(page.getByRole("button", { name: "Eliminar conexión" })).toBeVisible();
  await page.getByRole("button", { name: "Eliminar conexión" }).click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  await page.locator('[data-testid="rf__node-start"]').click();
  const reconnectInspector = page.getByRole("dialog", { name: "Nodo: Inicio manual" });
  await reconnectInspector.getByRole("tab", { name: "Conexiones" }).click();
  await reconnectInspector.getByLabel("Nodo destino").selectOption({ label: "Preparar datos" });
  await reconnectInspector.getByRole("button", { name: "Conectar", exact: true }).click();
  await reconnectInspector.getByRole("button", { name: "Cerrar" }).click();
  await page.getByRole("button", { name: "Guardar flujo" }).click();
  await expect(page.getByText("Flujo guardado")).toBeVisible();

  // Keep the code node busy long enough to observe live canvas progress.
  const workflowResponse = await page.request.get("http://127.0.0.1:3100/api/projects/e2e-bot/workflow");
  const workflow = (await workflowResponse.json()) as { nodes: Array<{ type: string; codeFile?: string }> };
  const codeNodeConfig = workflow.nodes.find((node) => node.type === "code");
  expect(codeNodeConfig?.codeFile).toBeTruthy();
  await page.request.put(
    `http://127.0.0.1:3100/api/projects/e2e-bot/nodes/${codeNodeConfig!.codeFile!.replace("nodes/", "")}`,
    {
      data: {
        code: "export default async function run(input) { await new Promise((resolve) => setTimeout(resolve, 1200)); return { ok: true, input }; }",
      },
    },
  );

  await page.getByRole("button", { name: "Ejecutar" }).first().click();
  const launchDialog = page.getByRole("dialog", { name: "Ejecutar flujo" });
  await expect(launchDialog).toBeVisible();
  await launchDialog.getByRole("button", { name: "Ejecutar" }).click();

  // The canvas shows live progress; the run summary is not opened automatically.
  await expect(page.getByTestId("run-progress")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("run-progress").getByText("Preparar datos")).toBeVisible();
  await page.waitForTimeout(250);
  await expect(page.getByRole("dialog", { name: /Ejecución/ })).toHaveCount(0);

  // The summary lives in Executions > detail.
  await page.getByRole("button", { name: /^Ejecuciones/ }).first().click();
  await page.getByRole("button", { name: "Ver detalle" }).first().click();
  const runDialog = page.getByRole("dialog", { name: /Ejecución/ });
  await expect(runDialog.getByText("Resultado final")).toBeVisible();
  await expect(runDialog.getByText("Preparar datos")).toBeVisible();
  await expect(runDialog.getByTestId("run-status")).toHaveText("Completado", { timeout: 15_000 });
  await runDialog.getByRole("button", { name: "Cerrar" }).click();

  await page.getByRole("button", { name: "Agente", exact: true }).click();
  await page.getByPlaceholder("Pídele un flujo, una corrección o un reporte…").fill("¿Cómo va el flujo?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/\[simulado/)).toBeVisible();

  // Chat history survives a full navigation/reload.
  await page.reload();
  await page.getByRole("button", { name: "Agente", exact: true }).click();
  await expect(page.getByText("¿Cómo va el flujo?", { exact: true })).toBeVisible();
  await expect(page.getByText(/\[simulado/)).toBeVisible();
  await page.getByRole("button", { name: "Cerrar chat" }).click();

  // Dragging a node must not open the inspector or make it disappear, and the position persists.
  const box = await codeNode.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 50, { steps: 12 });
    await page.mouse.up();
  }
  await expect(page.getByRole("dialog", { name: /Nodo:/ })).toHaveCount(0);
  await expect(codeNode).toBeVisible();
  await page.getByRole("button", { name: "Guardar flujo" }).click();
  await expect(page.getByText("Flujo guardado")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Preparar datos", { exact: true })).toBeVisible();

  // Workflow versions modal lists snapshots and allows rolling back.
  await page.getByRole("button", { name: "Más acciones del flujo" }).click();
  await page.getByRole("menuitem", { name: /Versiones del flujo/ }).click();
  const versionsModal = page.getByRole("dialog", { name: "Versiones del flujo" });
  await expect(versionsModal).toBeVisible();
  await expect(versionsModal.getByRole("button", { name: "Restaurar v1" })).toBeVisible();
  await versionsModal.getByRole("button", { name: "Cerrar" }).click();

  await page.getByRole("button", { name: "Más acciones del flujo" }).click();
  await page.getByRole("menuitem", { name: "Ajustes del flujo" }).click();
  const flowSettings = page.getByRole("dialog", { name: "Ajustes del flujo" });
  await expect(flowSettings).toBeVisible();
  await flowSettings.getByRole("button", { name: "Cerrar" }).click();

  await page.getByRole("button", { name: /Agentes/ }).click();
  await page.getByRole("button", { name: "Nuevo agente" }).click();
  const newAgent = page.getByRole("dialog", { name: "Nuevo agente" });
  await expect(newAgent).toBeVisible();
  await newAgent.getByLabel("Categoría").fill("ventas");
  await newAgent.getByLabel("Rol").fill("calificador");
  await newAgent.getByLabel("Descripción").fill("Califica leads entrantes");
  await newAgent.getByLabel("Instrucciones (.md)").fill("Eres el calificador de ventas. Devuelve un score de 1 a 10.");
  await newAgent.getByRole("button", { name: "Guardar agente" }).click();
  await expect(newAgent).toBeHidden();
  await expect(page.getByText("Agente ventas/calificador guardado")).toBeVisible();

  const agentCard = page.getByTestId("agent-card-ventas-calificador");
  await expect(agentCard).toBeVisible();
  await agentCard.getByRole("button", { name: "Editar" }).click();
  const editAgent = page.getByRole("dialog", { name: "Editar agente" });
  await editAgent.getByLabel("Descripción").fill("Califica leads entrantes v2");
  await editAgent.getByRole("button", { name: "Guardar agente" }).click();
  await expect(editAgent).toBeHidden();
  await expect(agentCard.getByText("Califica leads entrantes v2")).toBeVisible();

  const agents = await page.request.get("/api/projects/e2e-bot/agents");
  expect(agents.ok()).toBeTruthy();
  const agentList = (await agents.json()) as {
    data: Array<{ category: string; role: string; frontmatter: { description: string } }>;
  };
  expect(
    agentList.data.some(
      (agent) =>
        agent.category === "ventas" &&
        agent.role === "calificador" &&
        agent.frontmatter.description === "Califica leads entrantes v2",
    ),
  ).toBe(true);

  // Project-owned resources: create an external chat integration inside the project.
  const createdIntegration = await page.request.post("/api/projects/e2e-bot/integrations", {
    data: {
      kind: "external_chat",
      name: "E2E Chat",
      slug: "e2e-chat",
      config: { routing: { mode: "agent", allowlist: [], public: false } },
    },
  });
  expect(createdIntegration.ok()).toBeTruthy();
  const integration = (await createdIntegration.json()) as { integration: { id: string }; apiKey: string };

  const externalReply = await page.request.post(`/api/v1/integrations/${integration.integration.id}/messages`, {
    headers: { "x-integration-key": integration.apiKey },
    data: { threadId: "cliente-e2e", message: "Hola desde la app externa" },
  });
  expect(externalReply.ok()).toBeTruthy();
  const reply = (await externalReply.json()) as { reply: string };
  expect(reply.reply).toContain("[simulado");

  // Global orchestrator channel: separate from project resources.
  const globalChannel = await page.request.post("/api/control/integrations", {
    data: {
      kind: "external_chat",
      name: "E2E Global",
      slug: "e2e-global",
      config: { routing: { mode: "agent", allowlist: [], public: false }, alerts: ["run.failed"] },
    },
  });
  expect(globalChannel.ok()).toBeTruthy();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Ajustes de plataforma" })).toBeVisible();
  await expect(page.getByText("E2E Global")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Canales del orquestador global" })).toBeVisible();

  await page.goto("/orchestrator");
  await expect(page.getByRole("heading", { name: "Orquestador global", level: 1 })).toBeVisible();
  await expect(page.getByText("E2E Bot")).toBeVisible();
  await expect(page.getByTestId("chat-panel")).toBeVisible();
  await page.getByRole("button", { name: "Minimizar chat" }).click();
  await expect(page.getByRole("button", { name: "Restaurar chat del agente" })).toBeVisible();
  await page.getByRole("button", { name: "Restaurar chat del agente" }).click();
  await expect(page.getByTestId("chat-panel")).toBeVisible();

  await page.getByPlaceholder("Pídele un flujo, una corrección o un reporte…").fill("¿Qué proyectos existen?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/\[simulado/)).toHaveCount(1, { timeout: 15_000 });
  await page.reload();
  await expect(page.getByText(/\[simulado/)).toHaveCount(1);
  await expect(
    page.locator('[data-testid="chat-messages"] article').filter({ hasText: /^\s*$/ }),
  ).toHaveCount(0);

  await page.goto("/system/health");
  await expect(page.getByTestId("health-status")).toHaveText("Operativo");
  await expect(page.getByRole("cell", { name: "OpenCode V2" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Database" })).toBeVisible();

  // Create a vertical template project (triaje-operativo) and run it end-to-end.
  await page.goto("/projects");
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await page.getByLabel(/Nombre del proyecto/).fill("Mesa Triaje");
  await page.getByLabel(/Plantilla inicial/).selectOption("triaje-operativo");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page).toHaveURL(/\/projects\/mesa-triaje$/);
  await expect(page.getByText("Clasificar caso", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ejecutar" }).first().click();
  const triajeLaunch = page.getByRole("dialog", { name: "Ejecutar flujo" });
  await expect(triajeLaunch).toBeVisible();
  await triajeLaunch.getByLabel(/Cliente/).fill("Acme Corp");
  await triajeLaunch.getByLabel(/Mensaje/).fill("Caída en producción");
  await triajeLaunch.getByRole("button", { name: "Ejecutar" }).click();
  await page.getByRole("button", { name: /^Ejecuciones/ }).first().click();
  await page.getByRole("button", { name: "Ver detalle" }).first().click();
  const triajeRunDialog = page.getByRole("dialog", { name: /Ejecución/ });
  await expect(triajeRunDialog.getByTestId("run-status")).toHaveText("Completado", { timeout: 15_000 });
  await expect(triajeRunDialog.getByText(/procesado/).first()).toBeVisible();
  await triajeRunDialog.getByRole("button", { name: "Cerrar" }).click();

  expect(consoleErrors).toEqual([]);
});

async function authenticate(page: Page) {
  let login = await page.request.post("/api/auth/login", {
    data: { username: "admin", password: "plataforma-segura-2026" },
  });
  if (!login.ok()) {
    login = await page.request.post("/api/auth/login", {
      data: { username: "admin", password: "admin123!" },
    });
    expect(login.ok()).toBeTruthy();
    const changed = await page.request.post("/api/auth/change-password", {
      data: { currentPassword: "admin123!", newPassword: "plataforma-segura-2026" },
    });
    expect(changed.ok()).toBeTruthy();
  }
}

async function waitForRun(
  page: Page,
  slug: string,
  predicate: (run: Record<string, unknown>) => boolean,
  timeoutMs = 75_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await page.request.get(`/api/projects/${slug}/runs?limit=10`);
    const body = (await response.json()) as { data: Array<Record<string, unknown>> };
    const found = body.data.find(predicate);
    if (found) return found;
    await page.waitForTimeout(1_500);
  }
  throw new Error(`run not found for ${slug}`);
}

async function waitForApproval(page: Page, slug: string, runId: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await page.request.get(`/api/projects/${slug}/runs/${runId}/approvals`);
    const body = (await response.json()) as { data: Array<{ nodeId: string; status: string }> };
    if (body.data.length > 0) return body.data[0]!;
    await page.waitForTimeout(100);
  }
  throw new Error("approval did not appear");
}

test("P0: scheduled notification delivers once and is visible in the run detail", async ({ page }) => {
  test.setTimeout(150_000);
  await authenticate(page);
  const slug = "e2e-notify";
  expect((await page.request.post("/api/projects", { data: { slug, name: "Notify E2E" } })).status()).toBe(201);

  const received: string[] = [];
  const receiver = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      received.push(body);
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
    });
  });
  await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  const address = receiver.address();
  if (!address || typeof address === "string") throw new Error("receiver did not bind");
  try {
    const integrationResponse = await page.request.post(`/api/projects/${slug}/integrations`, {
      data: {
        kind: "external_chat",
        name: "E2E hook",
        slug: "e2e-hook",
        config: {
          webhookUrl: `http://127.0.0.1:${address.port}/hook`,
          routing: { mode: "workflow", allowlist: [], public: false },
        },
      },
    });
    expect(integrationResponse.status()).toBe(201);
    const integration = (await integrationResponse.json()) as { integration: { id: string } };
    expect(
      (await page.request.post(`/api/projects/${slug}/integrations/${integration.integration.id}/connect`)).ok(),
    ).toBeTruthy();

    const workflow = {
      version: 1,
      id: slug,
      name: "Notify E2E",
      description: "",
      nodes: [
        {
          id: "start",
          type: "trigger",
          position: { x: 0, y: 0 },
          config: { kind: "schedule", cron: "* * * * *", timezone: "UTC", enabled: true, overlapPolicy: "skip" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "notify",
          type: "notify",
          position: { x: 200, y: 0 },
          config: { integrationId: integration.integration.id, text: "Hola E2E" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "notify" }],
      updatedAt: new Date().toISOString(),
    };
    expect(
      (await page.request.put(`/api/projects/${slug}/workflow`, { data: workflow })).ok(),
    ).toBeTruthy();

    const run = await waitForRun(page, slug, (item) => item.entryPoint === "schedule" && item.status === "succeeded");
    await expect.poll(() => received.length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(received[0]).toContain("Hola E2E");
    const deliveries = await page.request.get(`/api/projects/${slug}/runs/${run.id}/deliveries`);
    const deliveryBody = (await deliveries.json()) as { data: Array<{ status: string; nodeId: string }> };
    expect(deliveryBody.data).toHaveLength(1);
    expect(deliveryBody.data[0]).toMatchObject({ status: "delivered", nodeId: "notify" });

    await page.goto(`/projects/${slug}`);
    await page.getByRole("button", { name: /^Ejecuciones/ }).first().click();
    await page.getByRole("button", { name: "Ver detalle" }).first().click();
    const detail = page.getByRole("dialog", { name: /Ejecución/ });
    await expect(detail.getByText("Entregas")).toBeVisible();
    await expect(detail.getByText("Entregado")).toBeVisible();
  } finally {
    await new Promise<void>((resolve) => receiver.close(() => resolve()));
  }
});

test("P0: webhook approval writes the database once and rejection leaves no changes", async ({ page }) => {
  test.setTimeout(120_000);
  await authenticate(page);
  const slug = "e2e-actions";
  expect((await page.request.post("/api/projects", { data: { slug, name: "Actions E2E" } })).status()).toBe(201);
  expect(
    (
      await page.request.post(`/api/projects/${slug}/secrets`, {
        data: { alias: "wh-secret", value: "e2e-secret" },
      })
    ).status(),
  ).toBe(201);

  const integrationResponse = await page.request.post(`/api/projects/${slug}/integrations`, {
    data: {
      kind: "sqlite",
      name: "E2E DB",
      slug: "e2e-db",
      config: { kind: "sqlite", filename: "/tmp/opencode-agentic-platform-e2e/e2e-actions.sqlite" },
    },
  });
  expect(integrationResponse.status()).toBe(201);
  const integration = (await integrationResponse.json()) as { integration: { id: string } };
  const dbQuery = async (sql: string, params: unknown[] = []) => {
    const response = await page.request.post(
      `/api/projects/${slug}/integrations/${integration.integration.id}/database/query`,
      { data: { sql, params } },
    );
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as { data: Array<Record<string, unknown>> };
  };
  await dbQuery("CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY, name TEXT)");

  const workflow = {
    version: 1,
    id: slug,
    name: "Actions E2E",
    description: "",
    nodes: [
      {
        id: "start",
        type: "trigger",
        position: { x: 0, y: 0 },
        config: { kind: "webhook", secretAlias: "wh-secret" },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "review",
        type: "approval",
        position: { x: 150, y: 0 },
        config: { message: "Revisar escritura" },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "write",
        type: "database",
        position: { x: 300, y: 0 },
        config: {
          integrationId: integration.integration.id,
          mode: "write",
          statements: [{ sql: "INSERT INTO leads (name) VALUES (?)", params: ["E2E"] }],
        },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "review" },
      { id: "e2", source: "review", target: "write" },
    ],
    updatedAt: new Date().toISOString(),
  };
  expect((await page.request.put(`/api/projects/${slug}/workflow`, { data: workflow })).ok()).toBeTruthy();

  const startRun = async () => {
    const response = await page.request.post(`/api/v1/webhooks/${slug}/start`, {
      headers: { "x-webhook-secret": "e2e-secret", "content-type": "application/json" },
      data: { source: "e2e" },
    });
    expect(response.status()).toBe(202);
    return ((await response.json()) as { runId: string }).runId;
  };

  const approvedRun = await startRun();
  await waitForApproval(page, slug, approvedRun);
  const approved = await page.request.post(`/api/projects/${slug}/runs/${approvedRun}/approvals/review`, {
    data: { decision: "approve" },
  });
  expect(approved.ok()).toBeTruthy();
  expect(((await approved.json()) as { status: string }).status).toBe("succeeded");
  const afterApprove = await dbQuery("SELECT COUNT(*) AS total FROM leads");
  expect(Number(afterApprove.data[0]?.total)).toBe(1);

  const rejectedRun = await startRun();
  await waitForApproval(page, slug, rejectedRun);
  const rejected = await page.request.post(`/api/projects/${slug}/runs/${rejectedRun}/approvals/review`, {
    data: { decision: "reject" },
  });
  expect(rejected.ok()).toBeTruthy();
  expect(((await rejected.json()) as { status: string }).status).toBe("failed");
  const afterReject = await dbQuery("SELECT COUNT(*) AS total FROM leads");
  expect(Number(afterReject.data[0]?.total)).toBe(1);
});

test("P0: an error route receives a failed HTTP node", async ({ page }) => {
  test.setTimeout(60_000);
  await authenticate(page);
  const slug = "e2e-error-route";
  expect((await page.request.post("/api/projects", { data: { slug, name: "Error route E2E" } })).status()).toBe(201);
  const workflow = {
    version: 1,
    id: slug,
    name: "Error route E2E",
    description: "",
    nodes: [
      {
        id: "start",
        type: "trigger",
        position: { x: 0, y: 0 },
        config: { kind: "manual" },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "http",
        type: "http",
        position: { x: 100, y: 0 },
        config: { method: "GET", url: "http://127.0.0.1:1/fail" },
        notebookIds: [],
        timeoutMs: 1_000,
        retryPolicy: { maxRetries: 0 },
        onError: { strategy: "route", target: "fallback" },
      },
      {
        id: "fallback",
        type: "transform",
        position: { x: 200, y: 0 },
        config: { template: '{"route":"{{input.error.nodeId}}"}' },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [{ id: "e1", source: "start", target: "http" }],
    updatedAt: new Date().toISOString(),
  };
  expect((await page.request.put(`/api/projects/${slug}/workflow`, { data: workflow })).ok()).toBeTruthy();
  const launched = await page.request.post(`/api/projects/${slug}/runs`, { data: { payload: {} } });
  expect(launched.status()).toBe(202);
  const run = (await launched.json()) as { id: string };
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/runs/${run.id}`);
      return ((await response.json()) as { status: string }).status;
    }, { timeout: 15_000 })
    .toBe("succeeded");
  const final = (await (await page.request.get(`/api/runs/${run.id}`)).json()) as {
    output: { route?: string };
  };
  expect(final.output.route).toBe("http");
});

