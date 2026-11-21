import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Phone layouts, keyboard operation and picker round-trips.
 *
 * The suite shares one stateful fake server (`workers: 1`, `fullyParallel: false`) and
 * `platform.spec.ts` owns the seeded admin's first-boot password change. Playwright runs
 * spec files in path order, so this file is deliberately named to sort AFTER
 * `platform.spec.ts` (and `redesign.spec.ts`) and reuses the post-change password.
 * Run on its own against a fresh server, `authenticate` still performs that first change.
 */
const BASE_URL = "http://127.0.0.1:3100";
const INITIAL_PASSWORD = "admin123!";
const CHANGED_PASSWORD = "plataforma-segura-2026";
const CHOSEN_MODEL = "OpenCode Go Reasoning";
const CHOSEN_MODEL_REF = "opencode-go/reasoning";

let cachedSession: { name: string; value: string } | undefined;

function toast(page: Page, text: string | RegExp) {
  return page.locator("[data-sonner-toast]").filter({ hasText: text }).last();
}

async function authenticate(page: Page): Promise<void> {
  if (cachedSession) {
    await page.context().addCookies([{ ...cachedSession, url: BASE_URL }]);
    return;
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
    const session = (await page.context().cookies()).find((cookie) => cookie.httpOnly);
    if (!session) throw new Error("login did not set a session cookie");
    cachedSession = { name: session.name, value: session.value };
    return;
  }
  throw new Error("could not authenticate the seeded admin");
}

async function createProject(page: Page, slug: string, name: string): Promise<void> {
  const response = await page.request.post("/api/projects", { data: { slug, name } });
  expect(response.status()).toBe(201);
}

async function createAgent(page: Page, slug: string, category: string, role: string): Promise<void> {
  const response = await page.request.put(`/api/projects/${slug}/agents/${category}/${role}`, {
    data: {
      description: `Agente ${category}/${role} de prueba`,
      body: `Eres el agente ${category}/${role}.`,
      mode: "subagent",
    },
  });
  expect(response.ok()).toBeTruthy();
}

// Inner tab strips may scroll; only the document must stay on one horizontal axis.
async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(metrics.scrollWidth, `${label} keeps a single horizontal axis`).toBeLessThanOrEqual(
    metrics.innerWidth,
  );
}

async function expectInsideViewport(page: Page, locator: Locator, label: string) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("the page has no viewport");
  const box = await locator.boundingBox();
  expect(box, `${label} has a box`).not.toBeNull();
  expect(box!.x, `${label} starts inside the viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${label} ends inside the viewport`).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height, `${label} ends inside the viewport`).toBeGreaterThan(0);
}

/**
 * Below 640 px the shared `Modal` is a bottom sheet (`items-end` + `rounded-t-2xl` +
 * `max-h-[92dvh]`). Being visible and inside the viewport, which `expectInsideViewport`
 * proves, is equally true of a centred dialog, so this helper asserts the geometry only a
 * sheet can produce: flush with the viewport bottom, no bottom rounding, and the whole
 * free space above the panel instead of split above and below it.
 */
async function expectBottomSheet(
  page: Page,
  dialog: Locator,
  label: string,
  { fillsHeight = false }: { fillsHeight?: boolean } = {},
) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("the page has no viewport");
  const cap = viewport.height * 0.92;
  // The panel enters from `translateY(14px) scale(0.98)`, so the box is read only once the
  // entrance finished: until then the bottom edge is off-screen by ~6 px, never flush.
  await expect
    .poll(
      async () => {
        const measured = await dialog.boundingBox();
        return measured
          ? Math.round(Math.abs(viewport.height - (measured.y + measured.height)) * 10) / 10
          : null;
      },
      { message: `${label} settles flush with the viewport bottom` },
    )
    .toBeLessThanOrEqual(1);
  if (fillsHeight) {
    // Only the reserved sheet body reaches the cap; the settled height proves it did.
    await expect
      .poll(
        async () => (await dialog.boundingBox())?.height ?? 0,
        { message: `${label} settles against its 92dvh cap` },
      )
      .toBeGreaterThanOrEqual(cap - 8);
  }

  const box = await dialog.boundingBox();
  expect(box, `${label} has a box`).not.toBeNull();
  const topGap = box!.y;
  const gapBelow = viewport.height - (box!.y + box!.height);
  expect(
    topGap,
    `${label} keeps the free space above, not a centred pair (top ${topGap}, bottom ${gapBelow})`,
  ).toBeGreaterThan(gapBelow);
  expect(box!.height, `${label} never exceeds its 92dvh cap`).toBeLessThanOrEqual(cap + 1);
  if (fillsHeight) {
    expect(box!.height, `${label} fills the 92dvh sheet cap`).toBeGreaterThanOrEqual(cap - 8);
  }
  const radius = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      topLeft: Number.parseFloat(style.borderTopLeftRadius),
      bottomLeft: Number.parseFloat(style.borderBottomLeftRadius),
      bottomRight: Number.parseFloat(style.borderBottomRightRadius),
    };
  });
  expect(radius.topLeft, `${label} keeps its top corners rounded`).toBeGreaterThan(0);
  expect(radius.bottomLeft, `${label} has no bottom-left rounding`).toBe(0);
  expect(radius.bottomRight, `${label} has no bottom-right rounding`).toBe(0);
}

/**
 * The palette and the inspector reserve their body height only through `sheet={narrow}`
 * (`min-h-[calc(92dvh_-_5.5rem)]` + `data-sheet`). Without it the panel still looks like a
 * sheet while the body collapses to its content, so the body is asserted on its own.
 */
async function expectSheetBody(dialog: Locator, label: string) {
  const body = dialog.locator("[data-sheet]");
  await expect(body, `${label} marks its body as a sheet`).toHaveCount(1);
  const minHeight = await body.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).minHeight),
  );
  expect(minHeight, `${label} reserves the sheet body height`).toBeGreaterThan(0);
}

test.describe("phone at 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the flow keeps its action cluster, canvas sheet and picker within the phone width", async ({ page }) => {
    await authenticate(page);
    const slug = "e2e-phone-390";
    await createProject(page, slug, "Teléfono 390");

    await page.goto(`/projects/${slug}/flow`);
    await expect(page.getByTestId("workflow-canvas")).toBeVisible();

    await expect(page.locator(".react-flow__minimap")).toHaveCount(0);

    const addNode = page.getByRole("button", { name: "+ Nodo" });
    await addNode.click();
    const palette = page.getByRole("dialog", { name: "Agregar nodo" });
    await expect(palette).toBeVisible();
    await expectInsideViewport(page, palette, "the node palette");
    await expectBottomSheet(page, palette, "the node palette", { fillsHeight: true });
    await expectSheetBody(palette, "the node palette");
    await palette.getByRole("button", { name: /Código/ }).click();

    const codeInspector = page.getByRole("dialog", { name: /Nodo:/ });
    await expect(codeInspector).toBeVisible();
    await expectBottomSheet(page, codeInspector, "the node inspector", { fillsHeight: true });
    await expectSheetBody(codeInspector, "the node inspector");
    await codeInspector.getByLabel("Etiqueta").fill("Recolectar");
    await codeInspector.getByRole("button", { name: "Cerrar" }).click();
    await expect(codeInspector).toBeHidden();
    await expect(page.getByText("Recolectar", { exact: true })).toBeVisible();

    await page.locator('[data-testid="rf__node-start"]').click();
    const triggerInspector = page.getByRole("dialog", { name: "Nodo: Inicio manual" });
    await expect(triggerInspector).toBeVisible();
    await expectBottomSheet(page, triggerInspector, "the trigger inspector", { fillsHeight: true });
    await expectSheetBody(triggerInspector, "the trigger inspector");
    await triggerInspector.getByRole("tab", { name: "Conexiones" }).click();
    const targetPicker = triggerInspector.getByRole("combobox", { name: "Nodo destino" });
    await targetPicker.click();
    const targetSheet = page.getByRole("dialog", { name: "Nodo destino" });
    await expect(targetSheet).toBeVisible();
    await expect(targetSheet.locator("[data-select-sheet]")).toBeVisible();
    await expectInsideViewport(page, targetSheet, "the picker sheet");
    await expectBottomSheet(page, targetSheet, "the picker sheet");
    await targetSheet.getByRole("option", { name: /Recolectar/ }).click();
    await expect(targetSheet).toBeHidden();
    await expect(targetPicker).toContainText("Recolectar");
    await triggerInspector.getByRole("button", { name: "Conectar", exact: true }).click();
    await triggerInspector.getByRole("button", { name: "Cerrar" }).click();
    await expect(triggerInspector).toBeHidden();

    for (const name of ["Guardar flujo", "Ejecutar", "Agente"]) {
      await expectInsideViewport(page, page.getByRole("button", { name, exact: true }), `the ${name} action`);
    }
    await page.getByRole("button", { name: "Guardar flujo", exact: true }).click();
    await expect(toast(page, "Flujo guardado")).toBeVisible();

    await page.getByRole("button", { name: "Agente", exact: true }).click();
    const chatRegion = page.getByRole("region", { name: "Chat con Agente principal" });
    await expect(chatRegion).toBeVisible();
    await page.getByRole("button", { name: "Cerrar chat" }).click();
    await expect(chatRegion).toHaveCount(0);

    await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
    const launchDialog = page.getByRole("dialog", { name: "Ejecutar flujo" });
    await expect(launchDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(launchDialog).toBeHidden();

    await page.getByRole("button", { name: "Más acciones del flujo" }).click();
    await page.getByRole("menuitem", { name: "Ajustes del flujo" }).click();
    const flowSettings = page.getByRole("dialog", { name: "Ajustes del flujo" });
    await expect(flowSettings).toBeVisible();
    await flowSettings.getByRole("combobox", { name: "Modelo por defecto" }).click();
    const modelSheet = page.getByRole("dialog", { name: "Modelo por defecto" });
    await expect(modelSheet).toBeVisible();
    await expectBottomSheet(page, modelSheet, "the model picker sheet");
    await modelSheet.getByRole("option", { name: new RegExp(`^${CHOSEN_MODEL}`) }).click();
    await expect(modelSheet).toBeHidden();
    await flowSettings.getByRole("button", { name: "Listo" }).click();
    await expect(flowSettings).toBeHidden();

    await page.getByRole("button", { name: "Guardar flujo", exact: true }).click();
    await expect(toast(page, "Flujo guardado")).toBeVisible();

    const savedWorkflow = (await (await page.request.get(`/api/projects/${slug}/workflow`)).json()) as {
      defaultModel?: string;
    };
    expect(savedWorkflow.defaultModel).toBe(CHOSEN_MODEL_REF);

    await page.reload();
    await expect(page.getByTestId("workflow-canvas")).toBeVisible();
    await page.getByRole("button", { name: "Más acciones del flujo" }).click();
    await page.getByRole("menuitem", { name: "Ajustes del flujo" }).click();
    const reloadedSettings = page.getByRole("dialog", { name: "Ajustes del flujo" });
    await expect(reloadedSettings).toBeVisible();
    await expect(reloadedSettings.getByRole("combobox", { name: "Modelo por defecto" })).toContainText(
      CHOSEN_MODEL,
    );
    await reloadedSettings.getByRole("button", { name: "Cerrar" }).click();
    await expect(reloadedSettings).toBeHidden();
  });
});

test.describe("phone at 320x568", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("every global page and project tab fits 320 and the project picker persists", async ({ page }) => {
    await authenticate(page);
    const slug = "e2e-phone-320";
    await createProject(page, slug, "Teléfono 320");

    const globalPages: Array<[path: string, heading: string]> = [
      ["/projects", "Automatizaciones agénticas sobre OpenCode"],
      ["/settings", "Ajustes de plataforma"],
      ["/runs", "Ejecuciones"],
      ["/orchestrator", "Orquestador global"],
      ["/system/health", "Salud del sistema"],
    ];
    for (const [path, heading] of globalPages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page, path);
    }

    const projectTabs: Array<[label: RegExp, suffix: string]> = [
      [/^Resumen$/, "overview"],
      [/^Flujo$/, "flow"],
      [/^Ejecuciones/, "runs"],
      [/^Agentes/, "agents"],
      [/^Conocimiento$/, "knowledge"],
      [/^Integraciones/, "integrations"],
      [/^Ajustes$/, "settings"],
    ];
    const projectNav = page.getByRole("navigation", { name: "Secciones del proyecto" });
    await page.goto(`/projects/${slug}/overview`);
    await expect(page.getByTestId("project-top-bar")).toBeVisible();
    for (const [label, suffix] of projectTabs) {
      const link = projectNav.getByRole("link", { name: label });
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/projects/${slug}/${suffix}$`));
      await expect(page.getByTestId("project-top-bar")).toBeVisible();
      await expectNoHorizontalOverflow(page, `/projects/${slug}/${suffix}`);
    }

    await page.goto(`/projects/${slug}/flow`);
    await expect(page.getByTestId("workflow-canvas")).toBeVisible();
    await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
    for (const name of ["Guardar flujo", "Ejecutar", "Agente"]) {
      await expectInsideViewport(page, page.getByRole("button", { name, exact: true }), `the ${name} action`);
    }
    const menuTrigger = page.getByRole("button", { name: "Más acciones del flujo" });
    await menuTrigger.click();
    const menu = page.getByRole("menu", { name: "Más acciones del flujo" });
    await expect(menu).toBeVisible();
    const viewport = page.viewportSize()!;
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x, "the overflow panel keeps an 8 px left margin").toBeGreaterThanOrEqual(8);
    expect(menuBox!.x + menuBox!.width, "the overflow panel stays inside 312 px").toBeLessThanOrEqual(
      viewport.width - 8,
    );
    for (const item of await menu.getByRole("menuitem").all()) {
      const label = await item.innerText();
      const box = await item.boundingBox();
      expect(box, `${label} has a box`).not.toBeNull();
      expect(box!.x, `${label} starts inside the viewport`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${label} ends inside the viewport`).toBeLessThanOrEqual(viewport.width);
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuTrigger).toBeFocused();

    await page.goto(`/projects/${slug}/settings`);
    await expect(page.getByRole("heading", { name: "Ajustes", level: 1 })).toBeVisible();
    const modelPicker = page.getByRole("combobox", { name: "Modelo por defecto del proyecto" });
    await modelPicker.click();
    const sheet = page.getByRole("dialog", { name: "Modelo por defecto del proyecto" });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("[data-select-sheet]")).toBeVisible();
    await sheet.getByRole("option", { name: new RegExp(`^${CHOSEN_MODEL}`) }).click();
    await expect(sheet).toBeHidden();
    await expect(modelPicker).toHaveValue(CHOSEN_MODEL);

    await page.getByRole("button", { name: "Guardar ajustes" }).click();
    await expect(toast(page, "Ajustes del proyecto guardados")).toBeVisible();
    const saved = (await (await page.request.get(`/api/projects/${slug}/settings`)).json()) as {
      project: { defaultModel: string | null };
    };
    expect(saved.project.defaultModel).toBe(CHOSEN_MODEL_REF);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Ajustes", level: 1 })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Modelo por defecto del proyecto" })).toHaveValue(
      CHOSEN_MODEL,
    );
  });
});

test.describe("keyboard", () => {
  test("a picker opens, filters, moves with Home/End, types ahead, commits and cancels from the keyboard", async ({
    page,
  }) => {
    await authenticate(page);
    const slug = "e2e-keyboard-picker";
    await createProject(page, slug, "Teclado pickers");
    for (const [category, role] of [
      ["alfa", "uno"],
      ["beta", "dos"],
      ["zeta", "tres"],
    ] as const) {
      await createAgent(page, slug, category, role);
    }

    await page.goto(`/projects/${slug}/settings`);
    await expect(page.getByRole("heading", { name: "Ajustes", level: 1 })).toBeVisible();

    const modelPicker = page.getByRole("combobox", { name: "Modelo por defecto del proyecto" });
    await modelPicker.focus();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.type("reason");
    await expect(page.getByRole("option")).toHaveCount(1);
    await expect(page.getByRole("option").first()).toContainText(CHOSEN_MODEL);
    await page.keyboard.press("Enter");
    await expect(modelPicker).toHaveValue(CHOSEN_MODEL);

    const agentPicker = page.getByRole("combobox", { name: "Agente principal" });
    await agentPicker.focus();
    await expect(agentPicker).toHaveAttribute("aria-expanded", "false");
    await agentPicker.press("ArrowDown");
    await expect(agentPicker).toHaveAttribute("aria-expanded", "true");
    const activeRow = page.locator('[role="option"][data-active]');
    await expect(activeRow).toHaveText("Sin agente principal");
    await agentPicker.press("ArrowDown");
    await expect(activeRow).toHaveText("alfa/uno");
    await agentPicker.press("End");
    await expect(activeRow).toHaveText("zeta/tres");
    await agentPicker.press("Home");
    await expect(activeRow).toHaveText("Sin agente principal");
    await agentPicker.press("b");
    await expect(activeRow).toHaveText("beta/dos");
    await agentPicker.press("Enter");
    await expect(agentPicker).toContainText("beta/dos");

    await agentPicker.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await agentPicker.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(agentPicker).toContainText("beta/dos");

    const patched = page.waitForRequest(
      (request) => request.url().endsWith(`/api/projects/${slug}/settings`) && request.method() === "PATCH",
    );
    await page.getByRole("button", { name: "Guardar ajustes" }).click();
    const request = await patched;
    const body = request.postDataJSON() as { primaryAgent?: string; defaultModel?: string };
    expect(body.primaryAgent).toBe("beta/dos");
    expect(body.defaultModel).toBe(CHOSEN_MODEL_REF);
    await expect(toast(page, "Ajustes del proyecto guardados")).toBeVisible();
  });

  test("a modal traps Tab inside the dialog and Escape closes it, restoring the trigger focus", async ({
    page,
  }) => {
    await authenticate(page);
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Automatizaciones agénticas sobre OpenCode" })).toBeVisible();

    const openButton = page.getByRole("button", { name: "Nuevo proyecto" });
    await openButton.click();
    const dialog = page.getByRole("dialog", { name: "Nuevo proyecto" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeFocused();

    const focusStaysInside = async () =>
      dialog.evaluate((element) => element.contains(document.activeElement));
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press("Tab");
      expect(await focusStaysInside(), `Tab step ${step + 1} stays inside the dialog`).toBe(true);
    }
    for (let step = 0; step < 3; step += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await focusStaysInside(), `Shift+Tab step ${step + 1} stays inside the dialog`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(openButton).toBeFocused();
  });
});
