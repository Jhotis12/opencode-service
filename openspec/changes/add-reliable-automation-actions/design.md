# Design

## Context

Ver `proposal.md` para la motivación. El estado actual que condiciona el diseño:

- `ExecuteWorkflowRunUseCase` recorre el DAG en memoria y resuelve cada nodo con un `if/else` en `execute-workflow.ts`.
- El scheduler (`WorkflowScheduler`) lee `workflow.json` en cada tick, compara el cron en UTC y reclama una clave por minuto. No persiste estado de schedule.
- `approval` pausa el run y crea una fila pendiente, pero no hay endpoint/UI para decidir; el único camino es `/approve` por un canal y solo si el run nació de una integración.
- `notify` y `database` no existen como nodos. La DB se escribe con `code` + `ctx.db` o con la tool `db_query`; los mensajes se envían con `code` + `ctx.notify` o con la tool `notify`.
- `ctx.notify` no acepta destinatario y los adaptadores de Telegram/WhatsApp lo exigen. `ctx.env` llega vacío.
- El plugin `platform_*` no propaga agente ni contexto de ejecución; el servidor asume `chat`.
- SQLite es el almacén único y el proceso es único. La cola y el scheduler viven en memoria.

## Goals / Non-Goals

**Goals:**

- Acciones nativas `database` y `notify` con contrato tipado, auditoría y reutilización de los casos de uso existentes.
- Reintentos, timeouts y ruta de error uniformes sin romper los grafos existentes.
- Scheduler con timezone, enabled, next run, catch-up y solapamiento.
- Aprobaciones resolubles desde API/UI y notificadas para runs manuales, programados y de canal.
- Gobierno real de tools del agente por sesión y contexto.
- Secretos de HTTP fuera del workflow y de los snapshots.
- P1 con timers durables, lotes/subworkflows, cola y observabilidad.
- Gate explícito: P0 se valida antes de empezar P1.

**Non-Goals:**

- Adaptador de email y otros canales nuevos.
- CDC o trigger nativo por cambio de fila.
- Exactly-once para escrituras en bases externas.
- Soporte multi-instancia o reemplazo de SQLite por una cola distribuida.
- Rediseño del canvas o del sistema visual.

## Decisions

### D1. `notify` y `database` son nodos de primera clase

Se agregan a `NodeTypeSchema` y a `NodeSpec.config`; no se implementan como casos especiales dentro del `if/else` del executor. Cada uno delega en un caso de uso de aplicación:

```text
NodeSpec notify    -> SendNotificationUseCase -> IntegrationEgressPort
NodeSpec database  -> ExecuteDatabaseActionUseCase -> ExternalDatabaseAdapter
```

`code` con `ctx.db`/`ctx.notify` sigue existiendo para lógica compleja, pero deja de ser la única vía.

**Alternativa descartada:** documentar solo patrones de `code`. No resuelve el caso no-code, la deduplicación de entregas ni la auditoría de DB.

### D2. Contratos de configuración

```text
DatabaseNodeConfig
  integrationId: string
  mode: "read" | "write"          // default "read"
  statements: Array<{ sql, params? }>
  transaction: boolean            // default true for >1 statement
  maxRows?: number                // default from integration policy

NotifyNodeConfig
  integrationId: string
  recipient?: string              // required for telegram/whatsapp
  text: string                    // supports {{input.x}}
  actionKey?: string              // optional override; default run:node
```

Los `params` y el `text` se resuelven con el helper existente `renderTemplate`/`resolvePath`. La salida es estable:

```text
database -> { rows, rowCount, affectedRows, truncated }
notify   -> { delivered, integrationId, recipient?, providerMessageId? }
```

La UI muestra un formulario guiado; el JSON avanzado queda como opción.

### D3. Política de error por nodo, sin una segunda arista en el DAG

`NodeSpec` agrega:

```text
onError?: {
  strategy: "stop" | "continue" | "route"
  target?: string        // requerido para route
}
retryPolicy: {
  maxRetries: number     // existente
  backoffMs?: number     // default 500
  backoffMultiplier?: number // default 2
}
```

Se envuelve la ejecución de cada nodo en un `executeWithPolicy`:

- `stop`: comportamiento actual; el run falla.
- `continue`: el paso falla, pero la salida es `{ error: { nodeId, message, attempts } }` y sigue la arista normal.
- `route`: el run salta al `target` con el mismo payload de error.

La ruta de error es un puntero del nodo, no una arista del grafo. Esto evita cambiar la regla existente de "una sola salida para nodos que no son decisión" y mantiene el DAG simple. La validación incluye el `target` en la detección de ciclos y rechaza targets inexistentes o auto-referencias. La UI la muestra en el inspector y como overlay punteado en el canvas.

**Alternativa descartada:** una arista con `condition: "error"`. Obliga a cambiar la validación de conexiones, la semántica de decisión y el editor; el puntero cubre el mismo caso con menos superficie.

Los reintentos de `database` en modo escritura quedan en `0` por defecto. Si el usuario los habilita, el SQL debe ser idempotente (upsert o clave natural); no hay exactly-once entre la DB externa y el ledger local. `notify` usa el ledger de entregas para no reenviar una entrega confirmada.

Para el timeout de `agent`, se extiende `AgentRuntimePort` con `interrupt(sessionId)` y se usa el endpoint `session.interrupt` de OpenCode. Si el runtime no lo soporta, el step se marca `timed_out`, se descarta la sesión para los nodos siguientes y se registra el riesgo.

### D4. Ledger de entregas y claves de acción

Nueva tabla `workflow_deliveries`:

```text
id, project_slug, run_id?, node_id?, integration_id,
action_key, recipient, status, provider_message_id,
attempts, last_error, created_at, updated_at
unique(action_key, integration_id)
```

Flujo de `notify`:

1. Calcular `action_key = runId + ":" + nodeId` (o `tool:sessionID:messageID` para tools).
2. Buscar una entrega `delivered` con la misma key; si existe, devolverla sin enviar.
3. Insertar/actualizar `pending`.
4. Enviar por `IntegrationEgressPort`.
5. Actualizar `delivered` o `failed` con el identificador del proveedor si existe.

Se extiende `IntegrationEgressPort.send` para devolver `{ providerMessageId?: string }`; los adaptadores de Telegram, WhatsApp y chat externo lo completan cuando el proveedor lo entrega.

### D5. Scheduler con estado persistido

Nueva tabla `workflow_schedule_state`:

```text
project_slug, workflow_id, node_id,
timezone, enabled, overlap_policy, catch_up, catch_up_window_minutes,
last_window_at, next_window_at, last_run_id, updated_at
```

En arranque se reconstruyen las filas faltantes desde `workflow.json`. En cada tick:

1. Leer schedules de todos los proyectos.
2. Saltar los `enabled: false`.
3. Calcular ventanas debidas entre `last_window_at` y `now` en la timezone del trigger.
4. Si no hay `catchUp`, procesar solo la ventana actual.
5. Si hay `catchUp`, procesar como máximo `catchUpWindowMinutes` de ventanas, de la más vieja a la más nueva.
6. Para cada ventana:
   - idempotencia `schedule:<workflowId>:<nodeId>:<windowUTC>`;
   - si `overlapPolicy = skip`, comprobar un run `running`/`paused` del mismo workflow;
   - si hay límite de concurrencia P1, encolar;
   - iniciar el run;
   - actualizar `last_window_at`/`next_window_at` en una transacción.

Timezone: se usa `Intl.DateTimeFormat` con `timeZone` para obtener las partes locales y compararlas contra el cron. Para DST se enumeran candidatos UTC y se deduplican por hora local; una hora inexistente se omite y una repetida se ejecuta una sola vez (o se recupera una vez con `catchUp`).

`once`: se modela como `schedule` con `mode: "once"` y `runAt` ISO, no como un trigger kind nuevo. Así se conserva la validación de "exactamente un trigger" y el contrato de `TriggerKindSchema`. El estado guarda `fired_at` y la clave de idempotencia es `once:<workflowId>:<nodeId>:<runAt>`.

### D6. Aprobaciones

Se agrega un caso de uso `DecideApprovalUseCase` y dos endpoints:

```text
GET  /api/projects/:slug/runs/:runId/approvals
POST /api/runs/:runId/approvals/:nodeId  { decision: "approve" | "reject" }
```

El endpoint exige sesión autenticada y scope de proyecto; registra `decidedBy`, timestamp y decisión. `resumeWithApproval` sigue siendo la operación de dominio que reanuda el snapshot.

Notificación de aprobación:

```text
run.integrationId (si existe y está conectada)
  -> canal de origen
si no
  -> projectSettings.approvalIntegrationId + approvalRecipient
si no
  -> run pausado visible en UI con warning; no se envía nada
```

`autoApprove` se evalúa en el executor antes de crear la aprobación pendiente. La UI de `RunDetailModal` muestra la aprobación pendiente con aprobar/rechazar y actualiza por SSE.

### D7. Contexto de sesión y permisos de tools

OpenCode entrega a `Tool.Info.execute` un contexto con `sessionID`, `agent`, `messageID` y `callID`. El plugin deja de crear un cliente con scope fijo y pasa ese contexto por llamada.

Nueva tabla `session_context`:

```text
session_id, scope, project_slug?, agent_id?, context,
run_id?, integration_id?, external_thread_id?, created_at, updated_at
```

Se registra al crear sesiones:

- chat de proyecto -> `chat`
- orquestador global -> `chat` (global, read-only)
- nodo `agent` de workflow -> `workflow`, `run_id`
- agente de canal -> `external_channel`, `integration_id`, `external_thread_id`

El plugin envía `x-platform-agent`, `x-platform-session` y `x-platform-context` (este último solo como hint). El servidor resuelve primero por `session_context`; si la sesión no existe, aplica el contexto de menor privilegio y registra la anomalía. Las reglas `deny` del perfil se evalúan con el agente resuelto, no con el header.

`integration_list` se agrega al namespace de proyecto y llama al endpoint existente `GET /api/projects/:slug/integrations`. Devuelve id, kind, capabilities, status y name; nunca secretos.

### D8. Secretos en HTTP

El nodo `http` acepta:

```text
config.integrationId?: string       // resuelve baseUrl de una integración HTTP
config.headers: Record<string,string> // valores "secret:<alias>" o texto
config.body: unknown                // JSON con "{{secret.<alias>}}" o texto
```

Antes del fetch, un resolvedor del servidor recorre headers y body, busca el alias en `store.vault.findByAlias({ scope: "project", projectSlug, alias })` y sustituye el valor en memoria. El workflow, el snapshot y los logs conservan solo el alias. Un alias de otro proyecto no se encuentra y falla el step.

**Alternativa descartada:** guardar el token en `headers` y confiar en que el usuario no versiona el workflow. Es exactamente el problema actual.

### D9. Política de acceso a base de datos

`IntegrationRecord.config` para DB agrega:

```text
access: "read" | "write"
maxRows: number
allowDdl: boolean
```

Clasificación de sentencias:

```text
read  -> SELECT, WITH, PRAGMA, EXPLAIN
write -> INSERT, UPDATE, DELETE, MERGE
ddl   -> CREATE, ALTER, DROP, TRUNCATE
```

`ExecuteDatabaseActionUseCase` valida todas las sentencias antes de abrir la conexión. `read` rechaza write/ddl; `write` permite write y, solo con `allowDdl`, ddl. El límite de filas se aplica al resultado (slice + `truncated`), con un máximo duro de 10,000.

Para transacciones se extiende `ExternalDatabaseAdapter` con `transaction(config, statements)`. SQLite usa `db.transaction`; Postgres/MySQL/MSSQL abren una conexión, ejecutan `BEGIN`, las sentencias y `COMMIT`, con rollback ante error. Cada sentencia tiene timeout.

La auditoría registra `statementKind`, hash de la sentencia, filas, afectados, duración y resultado; no registra SQL completo ni parámetros.

### D10. P1: timers, lotes, subworkflows y cola

- `workflow_timers`: `run_id`, `node_id`, `due_at`, `status`, `payload`. Un `delay` mayor a 60 s o un `waitUntil` pausa el run y crea un timer; el scheduler lo reclama y llama a `resumeFromTimer`. Al arrancar se recuperan timers vencidos.
- `foreach`: nodo nuevo que recibe `itemsPath`, `subworkflowId`, `maxConcurrency`, `onItemError`. Crea runs hijos con `parentRunId`, espera y agrega resultados por índice. El estado del padre queda `running` con progreso parcial.
- `subworkflow`: nodo que ejecuta una versión inmutable de otro workflow del proyecto. Rechaza ciclos con la cadena de `workflowId`s y propaga el resultado/fallo.
- `workflow_run_queue`: `id`, `project_slug`, `workflow_id`, `payload`, `entry_point`, `idempotency_key`, `status`, `available_at`, `created_at`. `start` encola si el proyecto alcanza `maxConcurrentRuns`; un dispatcher in-process despacha. Los runs encolados sobreviven reinicios y se recuperan al arrancar.
- Rate limit de notificaciones: token bucket por integración en `SendNotificationUseCase`; si se excede, la entrega queda `queued` con `available_at` y el nodo espera hasta el timeout o la política de error.
- Alertas por proyecto: `AlertService` resuelve primero integraciones del proyecto con `config.alerts` y cae a las globales si no hay; el destinatario sale de `alertRecipient` del proyecto.

### D11. UI

- `NODE_META`/`NODE_CATALOG`/`PALETTE_GROUPS` agregan `database` y `notify` en "Acciones".
- Inspector:
  - DB: integración (solo DB), modo, SQL, params, transacción, maxRows.
  - Notify: integración (solo canales con salida), destinatario, plantilla, preview.
  - Schedule: timezone, enabled, overlap, catch-up, next run.
  - Error: estrategia y target.
- `RunDetailModal`: aprobaciones pendientes y resultado de entregas.
- Salud: schedules, próximas ejecuciones, entregas fallidas, cola y aprobaciones pendientes.
- Accesibilidad: labels, foco, mensajes de error y estados anunciados; reutilizar los patrones de `docs/design-standard.md`.

### D12. Gate P0 → P1

El gate es de proceso, no de runtime:

1. Implementar y verificar todo P0.
2. El usuario valida P0 en un entorno real o staging con los escenarios de aceptación de `tasks.md`.
3. Solo entonces se habilitan las tareas de P1.

`tasks.md` marca la fase 2 como bloqueada por la validación del usuario. El apply workflow no debe iniciar P1 sin una confirmación explícita posterior.

## Risks / Trade-offs

- **Catch-up storm** tras una caída larga → `catchUpWindowMinutes` con tope y runs idempotentes por ventana.
- **Escrituras DB reintentadas** pueden duplicar efectos → `maxRetries: 0` por defecto en escritura, SQL idempotente obligatorio si se habilita, y auditoría del intento.
- **DST y timezones** son propensos a errores → tests con zonas con DST, deduplicación de ventanas y documentación de la zona por trigger.
- **La tabla de sesiones puede crecer** → TTL/limpieza al cerrar sesiones y borrado en cascada al eliminar el proyecto.
- **Entrega con destinatario** almacena datos personales → acceso restringido por proyecto, sin logging del destinatario completo y retención configurable.
- **SQLite y cola en un solo proceso** no soportan multi-instancia → documentar la limitación; una cola distribuida queda fuera de alcance.
- **El plugin puede ejecutar tools concurrentes** → headers por llamada y contexto resuelto por `sessionID`; no se usa estado global mutable.
- **P1 es grande** → gate de validación, tareas separadas y posibilidad de recortar `foreach`/subworkflow a un cambio posterior si P0 revela más trabajo.
- **La ruta de error no es una arista visual** → el inspector y el overlay deben dejar claro el destino; test de accesibilidad y de persistencia.

## Migration Plan

1. Migraciones aditivas: `workflow_deliveries`, `workflow_schedule_state`, `session_context`, `workflow_timers`, `workflow_run_queue`, `parent_run_id` en runs y columnas de política en integraciones.
2. Backfill de `workflow_schedule_state` desde los triggers `schedule` al arrancar.
3. Backfill de `session_context` para hilos de chat y canales existentes; las sesiones de workflow se crean al ejecutar.
4. Política DB: las integraciones existentes conservan `access: "write"`, `maxRows: 1000` y `allowDdl: true` para no romper flujos; las nuevas nacen con `access: "read"` y `allowDdl: false`. La UI muestra la política y permite cambiarla.
5. P0 se despliega primero; P1 se despliega después de la validación. Las tablas nuevas son inertes si la fase no está activa.
6. Rollback: revertir el código deja las tablas nuevas sin uso. Los workflows que ya usen `notify`/`database` no validarán en una versión anterior; se documenta como rollback incompatible para esos flujos.

## Open Questions

Ninguna que cambie el alcance o el enfoque. Las decisiones de UI fina (por ejemplo, si la ruta de error se dibuja como overlay o solo en el inspector) se resuelven en implementación sin alterar los contratos.
