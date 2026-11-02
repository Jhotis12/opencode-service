# Design

## Context

See `proposal.md` for motivation and `specs/` for behavioral requirements.
Currently:
- `ExecuteWorkflowRunUseCase` (`apps/server/src/application/use-cases/execute-workflow.ts`) executes workflows in-memory and reads `workflow.json` and `nodes/*.ts` directly from disk on `replay()` and `resumeWithApproval()`.
- `validateWorkflowGraph` (`apps/server/src/domain/workflow/graph.ts:51`) explicitly rejects `schedule` and `webhook` triggers.
- `agent` nodes return raw assistant strings (`extractAssistantText`), while downstream `decision`, `validate`, and `transform` nodes expect structured JSON objects (`resolvePath`).
- `packages/opencode-plugin/src/tools.ts` and `apps/server/src/app.ts` verify project scope (`x-platform-project`), but do not enforce per-agent tool permissions or distinguish interactive web chat from automated workflow steps or untrusted external channels.
- There is no `.github/workflows/` pipeline running the unit, integration, contract, and Playwright E2E suites on PRs.

## Goals / Non-Goals

**Goals:**
- Implement `schedule` (cron) and `webhook` triggers, startup run recovery, workflow snapshots/rollback, structured `agent` node outputs, per-agent tool permissions, the `triaje-operativo` vertical template, and GitHub Actions CI without adding external infrastructure dependencies (no Redis or external queue).
- Keep backward compatibility with existing `workflow.json` files and SQLite databases via additive schema migrations in `migrate.ts`.

**Non-Goals:**
- Distributed multi-node locking (the platform runs as a single container with SQLite WAL mounted on `/data`).
- Full JSON Schema Draft-07 editor in the UI (we reuse the existing `InputSchemaSchema` field list model so `trigger`, `validate`, and `agent` nodes share one validation and UI component model).

## Decisions

```text
+-----------------------------------------------------------------------------+
|                    ARQUITECTURA DE EJECUCION ENDURECIDA                     |
+-----------------------------------------------------------------------------+
|                                                                             |
|  [Cron Scheduler] --+                                                       |
|  [Webhook Route]  --+--> [ExecuteWorkflowRunUseCase]                        |
|  [Startup Recover] -+            |                                          |
|                                  +--> 1. Snapshot en `workflow_versions`    |
|                                  |       (graph JSON + nodes/*.ts bundle)   |
|                                  |                                          |
|                                  +--> 2. Nodo `agent` con `outputSchema`:   |
|                                  |       Prompt JSON -> Parse & Validate    |
|                                  |       -> 1 Auto-Repair si falla          |
|                                  |                                          |
|                                  +--> 3. Enforcer de Permisos (`app.ts`):   |
|                                          Evalua `x-platform-agent` +        |
|                                          `x-platform-context` vs rules      |
+-----------------------------------------------------------------------------+
```

### 1. Triggers `schedule` y `webhook` sin dependencias externas
- **Decisión:** Implementar un evaluador cron de 5 campos (`minuto hora día-mes mes día-semana`) en `apps/server/src/domain/workflow/cron.ts` y un servicio `WorkflowScheduler` que evalúa cada 30 segundos los proyectos cuyo trigger tiene `kind: "schedule"`. Para cada coincidencia con el minuto UTC actual (`YYYY-MM-DDTHH:mm`), dispara `executor.start` con `idempotencyKey = "schedule:<workflowId>:<nodeId>:<minuteKey>"` y `entryPoint = "schedule"`.
- **Webhook:** Exponer `POST /api/v1/webhooks/:projectSlug/:nodeId`. El trigger declara `config.secretAlias` (alias en la bóveda del proyecto). El endpoint verifica `x-webhook-secret` o `x-webhook-signature` (`sha256=<hmac-sha256>`) con `timingSafeEqual` contra el secreto descifrado de la bóveda antes de iniciar el run con `entryPoint = "webhook"`.
- **Alternativa descartada:** Añadir librerías pesadas de colas o cron externo; el reclamo atómico por `UNIQUE(project_slug, workflow_id, idempotency_key)` que ya existe en SQLite garantiza ejecución única por ventana.

### 2. Snapshots inmutables (`workflow_versions`) y recuperación de runs al arranque
- **Decisión:** Añadir la tabla `workflow_versions` en SQLite (`id`, `project_slug`, `version`, `graph_hash`, `graph_json`, `code_bundle`, `created_by`, `created_at`) y la columna `version_id` en `workflow_runs`.
  - `code_bundle` es un mapa JSON `{ "nodes/foo.ts": "..." }` con todos los archivos referenciados en `codeFile` por los nodos del grafo.
  - Al guardar un workflow (`SaveWorkflowUseCase`) o preparar un run sin versión registrada, si el `graph_hash` + hash del `code_bundle` cambió respecto a la última versión del proyecto, se inserta una nueva fila con `version = max + 1`.
  - `replay()`, `resumeWithApproval()` y la recuperación al arranque leen el grafo y el código desde el snapshot asociado al run, pasándolos al worker sin depender de que `workflow.json` en disco haya cambiado después.
  - Al iniciar `createApplication`, `executor.recoverInterruptedRuns()` busca runs en `status = "running"`, reconstruye `priorOutputs` desde `workflow_step_runs` con `status = "succeeded"` y reanuda en segundo plano desde el siguiente nodo pendiente.
- **Rollback:** `GET /api/projects/:slug/workflow/versions` lista versiones y `POST /api/projects/:slug/workflow/versions/:version/rollback` restaura `workflow.json` y `nodes/*.ts` en el workspace, registra la nueva versión y emite `workflow.updated`.

### 3. Salida estructurada del nodo `agent` (`outputSchema`)
- **Decisión:** Soportar `config.outputSchema` (validado con `InputSchemaSchema`) en nodos `type: "agent"`.
  - Si `outputSchema.fields` no está vacío, `buildNodePrompt` añade las instrucciones de contrato JSON especificando nombre, tipo y obligatoriedad de cada campo.
  - Al recibir la respuesta del agente, `parseAndValidateAgentOutput` extrae el bloque JSON (admitiendo texto envuelto en bloque Markdown ````json ... ```` o JSON directo) y lo valida con `validateInputPayload`.
  - Si falla el parseo o la validación, envía un único turno de reparación en la misma sesión indicando los errores exactos (`WorkflowInputValidationError.issues`). Si el segundo intento también falla, lanza `NodeValidationError` para marcar el paso como `failed` y detener el flujo.
- **Alternativa descartada:** Dejar que cada nodo posterior parsee texto libre con regex; reutilizar `InputSchemaSchema` permite que el editor visual en `NodeInspector.tsx` use el mismo `InputFieldsEditor` del trigger.

### 4. Permisos de herramientas del agente por perfil y contexto
- **Decisión:** Añadir soporte en `HttpPlatformClient` y `createPlatformTools` (`packages/opencode-plugin/src/tools.ts`) y en `apps/server/src/app.ts` para evaluar cabeceras `x-platform-agent` (ej. `operaciones/clasificador`) y `x-platform-context` (`chat` | `workflow` | `external_channel`).
  - Cuando el motor ejecuta un nodo `agent` o un canal externo enruta un mensaje, el servidor registra el contexto activo de la sesión/agente y valida cada llamada a rutas mutables o de herramientas (`/workflow`, `/agents/*`, `/integrations/:id/database/query`, `/integrations/:id/notify`, `/runs`).
  - Regla por defecto: en contexto `workflow` o `external_channel`, las mutaciones de definición (`PUT /workflow`, `PUT /agents/:category/:role`, `DELETE /agents/:category/:role`) se rechazan con `403 FORBIDDEN` salvo que el perfil del agente declare explícitamente `{ action: "tool", resource: "workflow_upsert", effect: "allow" }` (o `"*"`).
  - En cualquier contexto de proyecto, si el perfil del agente en `.opencode/agents/<category>/<role>.md` contiene una regla `deny` para la herramienta o recurso invocado (`db_query`, `notify`, `workflow_trigger`, `kb_search`, `workflow_upsert`, `subagent_upsert`), el servidor y el plugin rechazan la operación con `403 FORBIDDEN` y registran el intento en logs.

### 5. Plantilla vertical (`triaje-operativo`)
- **Decisión:** Extender `POST /api/projects` y `CreateProjectUseCase` con `template?: "blank" | "triaje-operativo"`.
  - Cuando se elige `triaje-operativo`, se crea:
    - Sub-agente `.opencode/agents/operaciones/clasificador.md` con permisos que niegan `workflow_upsert` y `subagent_upsert`.
    - Archivo `nodes/resumen-accion.ts` para formatear el dictamen final.
    - Grafo completo de 6 nodos conectados: `start` (trigger manual con `inputSchema`: `cliente`, `mensaje`, `canal`) → `validar-entrada` (`validate`) → `clasificar-caso` (`agent` vinculado a `operaciones/clasificador` con `outputSchema`: `categoria`, `urgencia`, `requiereAprobacion`, `accionSugerida`) → `requiere-aprobacion` (`decision` evaluando `requiereAprobacion equals true`) → rama `true` hacia `aprobacion-supervisor` (`approval`) y rama `false` hacia `emitir-dictamen` (`code`).

### 6. Pipeline CI en GitHub Actions (`.github/workflows/ci.yml`)
- **Decisión:** Configurar un workflow `.github/workflows/ci.yml` disparado en `pull_request` y `push` a `main` sobre `ubuntu-latest` con Bun y Node 20, ejecutando en orden:
  1. `bun install --frozen-lockfile`
  2. `bun run typecheck`
  3. `bun run test`
  4. `bun run build`
  5. `bunx playwright install --with-deps chromium` y `bun run test:e2e`

## Risks / Trade-offs

- **[Risk] Runs en estado `running` que ejecutaban un paso no idempotente al caer el proceso** → **Mitigation:** La recuperación al arranque reanuda desde el primer nodo posterior al último `step` guardado como `succeeded` en `workflow_step_runs`, preservando las salidas ya completadas.
- **[Risk] Modelos pequeños que devuelven JSON envuelto en bloques Markdown en nodos `agent`** → **Mitigation:** El extractor limpia cercas ````json ```` antes de `JSON.parse` y ejecuta un turno automático de reparación con los errores de validación antes de fallar el paso.
- **[Risk] Tiempo de ejecución de Playwright en GitHub Actions** → **Mitigation:** Instalar únicamente el navegador `chromium` requerido por `playwright.config.ts` y cachear dependencias de Bun.

## Migration Plan

1. En `apps/server/src/infrastructure/out/persistence/migrate.ts`, añadir `CREATE TABLE IF NOT EXISTS workflow_versions (...)` y `ALTER TABLE workflow_runs ADD COLUMN version_id TEXT` de forma idempotente.
2. Al sincronizar proyectos existentes en el arranque (`syncProjectsFromDisk`), generar automáticamente la versión inicial `v1` en `workflow_versions` si el proyecto aún no tiene snapshots registrados.
3. Para runs históricos sin `version_id`, `replay()` hace fallback al snapshot con mismo `graph_hash` o al `workflow.json` del proyecto.
