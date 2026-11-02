# Proposal

## Why

Hoy la plataforma ejecuta flujos solo por disparo manual o canal de integración, lee `workflow.json` en vivo durante replays/aprobaciones (rompiendo ejecuciones en vuelo si el flujo cambia), devuelve texto libre en los nodos `agent` (impidiendo conectar decisiones o transformaciones fiables aguas abajo), deja ejecuciones en estado `running` huérfanas tras un reinicio y permite que cualquier sub-agente del proyecto invoque todas las herramientas `platform_*` sin restricción por rol o contexto. Resolver estos puntos junto con una plantilla vertical de referencia y un pipeline de CI en GitHub Actions convierte el motor en una plataforma de automatización desatendida, segura y verificable en cada PR.

## What Changes

- **Triggers `schedule` (cron) y `webhook` + recuperación de runs al arranque**:
  - Activar ejecutores reales para triggers `schedule` (evaluador cron en el servidor con idempotencia por ventana de tiempo) y `webhook` (`POST /api/v1/webhooks/:projectSlug/:triggerNodeId` autenticado con secreto/firma HMAC o token de proyecto), habilitando su configuración en el inspector.
  - Recuperar al arranque del servidor los runs que quedaron en estado `running` tras un corte o reinicio, reanudándolos desde el último checkpoint exitoso en `workflow_step_runs`.
- **Snapshot del grafo + versionado y rollback**:
  - Persistir snapshots inmutables del flujo (`workflow.json` + archivos `nodes/*.ts`) en SQLite (`workflow_versions`) cada vez que se guarda o ejecuta un grafo.
  - Vincular cada `workflow_run` a su snapshot para que `replay` y `resumeWithApproval` ejecuten exactamente la versión del grafo con la que nació el run.
  - Exponer historial de versiones y rollback en un clic desde API y modal en la barra superior del canvas.
- **Salida estructurada del nodo `agent`**:
  - Permitir declarar `outputSchema` en nodos `agent` (reutilizando el contrato de campos tipados `string`, `number`, `boolean`, `json`), exigir salida JSON en el prompt del nodo, parsear y validar el resultado (con un reintento automático de reparación ante JSON inválido) y entregar el objeto tipado al siguiente nodo.
- **Permisos de herramientas del agente (`platform_*` y capacidades)**:
  - Hacer cumplir en `packages/opencode-plugin` y en el backend (`apps/server`) las reglas `permissions` del perfil del agente y el contexto de invocación, bloqueando por defecto herramientas de mutación de diseño (`workflow_upsert`, `subagent_upsert`) durante la ejecución de nodos de workflow o canales externos no confiables, y filtrando `db_query`, `notify` y `workflow_trigger` según las reglas `allow`/`deny` del agente.
- **Caso de uso vertical con dueño (plantilla operativa de referencia)**:
  - Incorporar una plantilla vertical seleccionable al crear proyecto (`triaje-operativo`) que despliega un flujo completo de extremo a extremo (trigger con contrato de entrada, validación, sub-agente clasificador con `outputSchema` y permisos acotados, nodo `decision` sobre campos estructurados, rama de aprobación/notificación y código) listo para probar y recortar.
- **Refinamiento de modales e inspector de nodos**:
  - Ampliar el modal inspector de nodos (`NodeInspectorModal` / `NodeInspector`) para configurar cron/webhook en triggers, `outputSchema` en nodos `agent`, reglas de permisos por herramienta en agentes y el nuevo modal de historial de versiones/rollback del grafo.
- **Pipeline de GitHub Actions para PRs**:
  - Añadir `.github/workflows/ci.yml` para ejecutar `bun run typecheck`, `bun run test` (shared, server, web) y `bun run test:e2e` (Playwright con `OPENCODE_MODE=fake`) en cada `pull_request` y `push`.

## Capabilities

### New Capabilities

Ninguna. Todos los cambios extienden capacidades duraderas ya establecidas en el repositorio.

### Modified Capabilities

- `workflow-and-workspace-engine`: Activa triggers `schedule` y `webhook`, recuperación de runs interrumpidos al arranque, snapshots inmutables de grafo con versionado/rollback, `outputSchema` estructurado en nodos `agent`, plantilla de proyecto vertical y controles correspondientes en los modales del canvas.
- `multi-agent-catalog`: Hace cumplir permisos de herramientas (`permissions` por agente y restricción de mutación en ejecuciones de flujo/canales externos) sobre las herramientas `platform_*` y el catálogo de sub-agentes.
- `observability-and-testing-harness`: Incorpora la ejecución automatizada de toda la pirámide de pruebas (`typecheck`, unitarias, integración, contratos y E2E Playwright) en GitHub Actions en cada PR y la cobertura de regresión de las nuevas capacidades.

## Impact

- `packages/shared/src/{workflow,agents,api}.ts`: Esquemas para `outputSchema` en nodos `agent`, configuración `webhook`/`schedule`, snapshots de versión (`WorkflowVersionRecord`), plantillas de proyecto y cabeceras/alcances de permisos de herramientas.
- `apps/server/src/infrastructure/out/persistence/{schema,sqlite-store,migrate}.ts`: Nueva tabla `workflow_versions` y referencia de snapshot en `workflow_runs`.
- `apps/server/src/domain/workflow/graph.ts` y `apps/server/src/application/use-cases/execute-workflow.ts`: Validación y ejecución de triggers `schedule`/`webhook`, validación/reparación de `outputSchema` en nodo `agent`, uso de snapshot en `replay`/`resumeWithApproval` y recuperación de runs `running` al iniciar.
- `packages/opencode-plugin/src/tools.ts` y `apps/server/src/app.ts`: Enforcement de permisos por agente y contexto de ejecución sobre herramientas `platform_*`.
- `apps/web/src/components/{NodeInspector,NodeInspectorModal,ProjectTopBar}.tsx` y `apps/web/src/pages/ProjectsPage.tsx`: Controles de UI para cron/webhook, `outputSchema`, permisos de herramientas, selector de plantilla vertical y modal de versiones/rollback.
- `.github/workflows/ci.yml`: Workflow de integración continua para PRs en GitHub.
