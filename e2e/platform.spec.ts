import { expect, test } from "@playwright/test";

test("first boot, project canvas, sub-agent, external chat and health", async ({ page }) => {
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
  await page.getByLabel("Slug").fill("e2e-bot");
  await page.getByLabel("Nombre").fill("E2E Bot");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page.getByText("E2E Bot", { exact: true })).toBeVisible();
  await page.getByText("E2E Bot", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "E2E Bot" })).toBeVisible();
  await page.getByRole("button", { name: /Código/ }).click();
  const codeNode = page.locator('[data-testid^="rf__node-code-"]');
  await expect(codeNode).toBeVisible();

  // The minimap and controls must use the dark theme, not the library's white default.
  const minimapColor = await page
    .locator(".react-flow__minimap")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const controlsColor = await page
    .locator(".react-flow__controls-button")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(minimapColor).not.toBe("rgb(255, 255, 255)");
  expect(controlsColor).not.toBe("rgb(255, 255, 255)");
  await codeNode.click();
  await page.getByLabel("Etiqueta").fill("Preparar datos");
  await page.getByRole("button", { name: "Guardar flujo" }).click();
  await expect(page.getByText("Flujo guardado")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Preparar datos", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ejecutar" }).click();
  const runDialog = page.getByRole("dialog");
  await expect(runDialog.getByText("Resultado final")).toBeVisible();
  await expect(runDialog.getByText("Preparar datos")).toBeVisible();
  await expect(runDialog.getByTestId("run-status")).toHaveText("succeeded");
  await runDialog.getByRole("button", { name: "Cerrar" }).click();

  await page.getByPlaceholder("Pídele un flujo, una corrección o un reporte…").fill("¿Cómo va el flujo?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/\[simulado/)).toBeVisible();

  // Chat history survives a full navigation/reload.
  await page.reload();
  await expect(page.getByText("¿Cómo va el flujo?", { exact: true })).toBeVisible();
  await expect(page.getByText(/\[simulado/)).toBeVisible();

  // Dragging a node must not make it disappear, and the new position persists.
  const box = await codeNode.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 50, { steps: 12 });
    await page.mouse.up();
  }
  await expect(codeNode).toBeVisible();
  await page.getByRole("button", { name: "Guardar flujo" }).click();
  await expect(page.getByText("Flujo guardado")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Preparar datos", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Sub-agentes/ }).click();
  await page.getByLabel("Categoría").fill("ventas");
  await page.getByLabel("Rol").fill("calificador");
  await page.getByLabel("Descripción").fill("Califica leads entrantes");
  await page.getByLabel("Instrucciones (.md)").fill("Eres el calificador de ventas. Devuelve un score de 1 a 10.");
  await page.getByRole("button", { name: "Guardar sub-agente" }).click();
  await expect(page.getByText("Sub-agente ventas/calificador guardado")).toBeVisible();

  const agents = await page.request.get("/api/projects/e2e-bot/agents");
  expect(agents.ok()).toBeTruthy();
  const agentList = (await agents.json()) as { data: Array<{ category: string; role: string }> };
  expect(agentList.data[0]).toMatchObject({ category: "ventas", role: "calificador" });

  const createdChannel = await page.request.post("/api/channels", {
    data: {
      slug: "e2e-chat",
      type: "external_chat",
      name: "E2E Chat",
      adminAllowlist: [],
      isPublic: true,
      config: { projectSlug: "e2e-bot" },
    },
  });
  expect(createdChannel.ok()).toBeTruthy();
  const channel = (await createdChannel.json()) as { apiKey: string };

  const externalReply = await page.request.post("/api/v1/channels/e2e-chat/messages", {
    headers: { "x-channel-key": channel.apiKey },
    data: { threadId: "cliente-e2e", message: "Hola desde la app externa" },
  });
  expect(externalReply.ok()).toBeTruthy();
  const reply = (await externalReply.json()) as { reply: string };
  expect(reply.reply).toContain("[simulado");

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Ajustes" })).toBeVisible();
  await expect(page.getByText("e2e-chat")).toBeVisible();
  await page.getByRole("button", { name: "Configurar canales" }).click();
  await expect(page.getByText("¿Cómo se usan?")).toBeVisible();
  await expect(page.getByText("API key", { exact: true })).toBeVisible();
  await expect(page.getByText("/api/v1/channels/e2e-chat/messages")).toBeVisible();

  await page.goto("/system/health");
  await expect(page.getByTestId("health-status")).toHaveText("ok");
  await expect(page.getByRole("cell", { name: "OpenCode V2" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Database" })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
