import { expect, test } from "@playwright/test";

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
  const minimapColor = await page
    .locator(".react-flow__minimap")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const controlsColor = await page
    .locator(".react-flow__controls-button")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(minimapColor).not.toBe("rgb(255, 255, 255)");
  expect(controlsColor).not.toBe("rgb(255, 255, 255)");

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
  await expect(runDialog.getByTestId("run-status")).toHaveText("succeeded", { timeout: 15_000 });
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
  await page.getByRole("button", { name: "Versiones del flujo" }).click();
  const versionsModal = page.getByRole("dialog", { name: "Versiones del flujo" });
  await expect(versionsModal).toBeVisible();
  await expect(versionsModal.getByRole("button", { name: "Restaurar v1" })).toBeVisible();
  await versionsModal.getByRole("button", { name: "Cerrar" }).click();

  await page.getByRole("button", { name: /Agentes/ }).click();
  await page.getByLabel("Categoría").fill("ventas");
  await page.getByLabel("Rol").fill("calificador");
  await page.getByLabel("Descripción").fill("Califica leads entrantes");
  await page.getByLabel("Instrucciones (.md)").fill("Eres el calificador de ventas. Devuelve un score de 1 a 10.");
  await page.getByRole("button", { name: "Guardar agente" }).click();
  await expect(page.getByText("Agente ventas/calificador guardado")).toBeVisible();

  const agents = await page.request.get("/api/projects/e2e-bot/agents");
  expect(agents.ok()).toBeTruthy();
  const agentList = (await agents.json()) as { data: Array<{ category: string; role: string }> };
  expect(agentList.data.some((agent) => agent.category === "ventas" && agent.role === "calificador")).toBe(true);

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

  await page.goto("/system/health");
  await expect(page.getByTestId("health-status")).toHaveText("ok");
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
  await expect(triajeRunDialog.getByTestId("run-status")).toHaveText("succeeded", { timeout: 15_000 });
  await expect(triajeRunDialog.getByText(/procesado/).first()).toBeVisible();
  await triajeRunDialog.getByRole("button", { name: "Cerrar" }).click();

  expect(consoleErrors).toEqual([]);
});
