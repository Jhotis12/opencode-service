# Design

## Context

Ver `proposal.md` para el incidente y la motivación. El estado actual relevante:

- `ChatWithProjectUseCase` y `ChatWithOrchestratorUseCase` ejecutan el turno dentro del request HTTP. `promptWithSessionRecovery` llama a `OpenCodeV2Adapter.prompt`, que hace `session.prompt` y luego `experimental.session.wait`; el `withTimeout` de 15 minutos es un `Promise.race` que no cancela la ejecución.
- `chat_threads` guarda el `opencodeSessionId` y `chat_messages` guarda user/agent/system sin identificador de turno. No hay estado durable del turno ni relación entre el mensaje del usuario, el prompt de OpenCode y la respuesta final.
- `OpenCodeV2Adapter` cachea el cliente de OpenCode y no lo invalida si el servicio se reinicia o cambia de endpoint. La suscripción de eventos es por turno, live-only, sin replay, y traga los errores.
- El chat web, el orquestador y los canales comparten `ensureChatSession`/`promptWithSessionRecovery`, así que el mismo corte de transporte afecta a todas las superficies.
- La plataforma es una sola instancia Bun + SQLite WAL; el executor de workflows ya tiene runs durables, checkpoints, `recoverInterruptedRuns` y SSE de progreso. Es el patrón de referencia para el chat.
- OpenCode 2.2.5 (cliente y CLI pinneados en el lockfile/imagen) expone `session.prompt` con `id`, `metadata` y `delivery`, `session.active`, `session.get`, `session.inbox.list/cancel`, `session.message.get/list`, `session.interrupt`, y `experimental.session.log` con `after` y `follow`. El log es experimental y debe validarse en la instancia desplegada.

La restricción central: **un turno de chat no puede depender de que un request HTTP permanezca abierto**. El request y el SSE deben ser una vista reemplazable.

## Goals / Non-Goals

**Goals:**

- Convertir el turno en la unidad durable de trabajo, con estado, mensajes vinculados, idempotencia, single-flight por hilo, recuperación al arranque y cancelación real.
- Detectar el fin de forma autoritativa con el log durable de OpenCode y un watchdog de estado, sin usar `session.wait` como dueño.
- Permitir que la UI se desconecte, recargue o reconecte sin perder el turno ni duplicar mensajes.
- Unificar el ciclo de vida en chat web de proyecto, orquestador global y canales de agente.
- Medir y observar el turno: duración, estado, recuperaciones, timeouts, uso y errores.

**Non-Goals:**

- Corregir el versionado cuando el agente escribe `workflow.json` directamente, o conectar/validar la integración de Telegram. Son cambios posteriores.
- Separar los hilos web por usuario; el hilo sigue siendo por proyecto/scope en esta entrega.
- Escalado horizontal con leases distribuidos; el diseño deja el campo `lease` como extensión, pero la implementación es in-process para una instancia.
- Rediseñar el chat o el canvas; solo se añaden estados, acciones y reconexión.
- Optimizar la latencia del modelo o el número de tool calls; el turno durable permite medirla, no la resuelve.
- Implementar permisos/forms interactivos de OpenCode si el agente los solicita; se auditan como posible causa de espera y se tratan en una fase posterior.

## Decisions

### 1. El turno es un registro durable; el request es una vista

Nueva tabla `chat_turns`:

```text
id (PK, también se usa como id del prompt de OpenCode)
thread_id (FK lógica a chat_threads)
scope: project | global
project_slug, integration_id, external_thread_id
session_id, user_message_id, assistant_message_id
inbox_id, assistant_opencode_message_id
status, delivery_state, attempt
started_at, finished_at, last_activity_at, last_seq
error_code, error_message, usage_json
idempotency_key, entry_point, created_at, updated_at
```

`chat_messages` recibe `turn_id` nullable y `error_code` opcional. Los mensajes históricos quedan con `turn_id` nulo y se muestran como legado.

Reglas de persistencia:

- Crear el turno y el mensaje del usuario en una transacción; el estado inicial es `queued`.
- Un índice único parcial o una transacción impide más de un turno `queued/running` por `thread_id`.
- Un índice único `(thread_id, idempotency_key)` deduplica reintentos del cliente.
- Al completar, guardar el mensaje del agente y el estado final en una transacción; si el proceso muere entre la respuesta de OpenCode y la escritura, la recuperación puede releer el mensaje por `assistant_opencode_message_id` o por el último mensaje del turno.
- No persistir mensajes de agente vacíos; un turno sin texto se marca `empty_reply`.

Alternativas:

- **Mapa en memoria**: simple, pero se pierde en restart y no permite reconciliar ni observar. Rechazado.
- **Reutilizar `workflow_runs` para cada turno**: el motor de DAGs y snapshots es demasiado pesado para una conversación; se reutiliza el patrón de durabilidad, no el executor. Rechazado.
- **Guardar el estado solo en OpenCode**: la plataforma necesita historial, scopes, métricas y UI; el estado del modelo no es el estado del usuario. Rechazado.

### 2. `ChatTurnService` es el dueño del ciclo de vida

Nuevo servicio de aplicación con estas responsabilidades:

```text
start(target, thread, message, clientMessageId) -> turn
subscribe(turnId, after, listener) -> unsubscribe
status(turnId, scope) -> turn + messages
cancel(turnId, scope)
recover()  // al arrancar
shutdown()
```

Un `ChatTarget` resuelve lo específico de cada superficie: `scope`, `projectSlug`, `directory`, `agent`, `model`, `context` (`chat`/`external_channel`), `entryPoint`, `timeoutPolicy`, `readOnly`, `sessionFactory`. El servicio no conoce paths ni reglas de proyecto; recibe un target ya autorizado.

Cada turno corre en una tarea supervisada dentro del proceso. El request solo crea el turno y se suscribe; si el cliente se va, el supervisor sigue. El servicio mantiene:
- un mapa en memoria de turnos activos y suscriptores;
- un buffer acotado de eventos de progreso por turno para replay/reconexión;
- un lock por `thread_id` para single-flight;
- un registro de side effects observados en el turno (tools `write`, `edit`, `bash`, `platform_workflow_upsert`, `platform_subagent_upsert`, `platform_notify`, `platform_db_query`).

Alternativas:

- **Cola/microservicio separado**: añade latencia y duplicación de estado; para una instancia con SQLite no aporta. Se deja la puerta abierta a `lease_owner`/`lease_until` si se escala.
- **Mantener el turno dentro del request**: es el bug actual; el request no puede ser el dueño. Rechazado.

### 3. Detección de fin: log durable + watchdog, sin `session.wait` como dueño

El adapter expone primitivas nuevas:

```text
sendPrompt(sessionId, { id, text, metadata, delivery }) -> { inboxId }
openSessionLog(sessionId, { after, follow }) -> AsyncIterable<SessionLogItem>
getSession(sessionId) -> SessionInfo | undefined
listActiveSessions() -> { [sessionId]: "running" }
listInbox(sessionId) -> inbox items
getMessages(sessionId, filter) / getMessage(sessionId, messageId)
interrupt(sessionId)
```

Flujo del supervisor:

1. `sendPrompt` con `id = turnId` y `metadata = { platformTurnId, projectSlug, threadId }`.
2. Abrir `session.log` con `after = cursor` y `follow = true`; persistir `event.durable.seq` como cursor de la sesión.
3. Traducir eventos:
   - `session.inbox.enqueued/delivered` -> estado `queued`/`delivered`;
   - `session.execution.started` -> `running`;
   - `session.text.delta`, `session.tool.*`, `session.step.*` -> progreso;
   - `session.execution.succeeded` -> completar y leer la respuesta;
   - `session.execution.failed/interrupted` -> estado terminal con error/reason;
   - `log.synced` -> cursor de replay confirmado.
4. Watchdog cada 1–5 s (adaptativo) consulta `session.active`/`session.get`. Si el log se cayó o no hay evento, reconcilia: sesión activa -> running; sesión inactiva con outcome -> terminal; sin outcome pero con mensaje -> recuperar; sesión inexistente -> `unknown` o `session_not_found` según si el prompt fue entregado.
5. Al completar, obtener el mensaje exacto por `assistantMessageID` si se conoce; si no, `message.list` filtrando por tipo assistant y tiempo posterior al inicio del turno. Extraer solo texto del turno, nunca el de un turno anterior.

`session.wait` puede quedar como fallback de compatibilidad dentro del adapter, pero el turn service no lo usa como fuente de verdad.

Alternativas:

- **Solo `session.wait` con más timeout**: mueve el cliff y sigue sin replay/recuperación. Es una mitigación, no la arquitectura.
- **Solo polling**: es estable y suficiente para la corrección; se usa como watchdog y puede ser el modo inicial si el spike de `session.log` falla. Pierde progreso en tiempo real y replay si no se combina con eventos.
- **Solo `event.subscribe` global**: live-only, sin cursor; se pierde al reconectar y no sirve como estado autoritativo. Se mantiene solo para progreso live si el log no está disponible.

**Spike obligatorio antes de implementar el log como primario**: validar en OpenCode 2.2.5 desplegado que `session.log` acepta `after`/`follow`, emite `log.synced` y `execution.*`, no muere por el idle timeout de Bun (keepalives o fetch con timeout mayor) y permite reanudar tras una desconexión. Si falla, el plan entra con polling como primario y el log queda detrás de una feature flag.

### 4. Separar “enviar” de “esperar” en el puerto de runtime

`AgentRuntimePort.prompt` actual mezcla envío, espera y extracción. Se reemplaza por primitivas y se deja un helper `runPrompt` para los nodos de workflow que necesitan el comportamiento síncrono con timeout corto.

- `sendPrompt` acepta `id`, `metadata`, `delivery` y devuelve el inbox ID.
- `openSessionLog`/`waitForTurn` abstraen el log y el watchdog.
- `getSession`/`listActive`/`listInbox`/`getMessages`/`getMessage` permiten reconciliar.
- `interrupt` corta el turno.
- El adapter invalida el cliente cacheado y vuelve a `Service.ensure`/`ServiceClientFactory.create` ante fallos de transporte; reconecta el log con backoff y cursor.
- El fetch del log de larga duración se configura con un idle timeout mayor que el turno o con keepalives validados; el fetch corto de polling usa timeout corto y reintento.

Los nodos `agent` del workflow siguen usando el executor y su `runId`/step state; usan el helper `runPrompt` con el `timeoutMs` del nodo y `interrupt`. No se crea un `chat_turn` para cada nodo de workflow, pero comparten la lógica de espera/reconciliación.

### 5. SSE reenganchable y API de turno

Se mantiene `POST /api/projects/:slug/chat` como fachada:

- Con `Accept: text/event-stream`, crea o recupera el turno y emite `turn` (turnId/status/startedAt), `status`, `delta`, `activity`, `heartbeat`, `done`, `error`.
- Con JSON, mantiene compatibilidad síncrona: espera el turno con un límite y devuelve la respuesta; si el cliente se va, el turno sigue.
- El evento `turn` es lo primero que recibe la UI; si el stream se corta, la UI usa el turnId para reenganchar.

Nuevos endpoints:

```text
GET  /api/projects/:slug/chat/turns/:turnId       -> estado + mensajes + uso
GET  /api/projects/:slug/chat/turns/:turnId/events -> SSE attach (after/Last-Event-ID)
POST /api/projects/:slug/chat/turns/:turnId/cancel -> cancelar
POST /api/projects/:slug/chat/turns/:turnId/retry  -> nuevo turno con aviso de side effects
```

El attach:
- envía heartbeats cada 15 s;
- replay desde el buffer del turno y, si está disponible, desde `session.log` con cursor;
- si no puede replayar, emite un evento `gap` y el estado actual; no inventa deltas;
- termina con `done` o `error` si el turno ya terminó.

`SseHub` publica `chat.turn.updated` con `turnId`, `status`, `projectSlug`, `threadId`, `activity`; el proyecto puede actualizar el badge aunque el drawer esté cerrado. El historial `GET /chat` incluye el turno activo y el estado de cada mensaje.

La autorización se aplica al turno, no solo al thread: `GET/POST` de turnos verifica `projectSlug`/scope y responde 403 en cruces.

### 6. UI: estado derivado del servidor, no del request

Un hook `useChatTurn` encapsula:

```text
messages, activeTurn, draft, activities, elapsed, connectionState
send(message), attach(turnId), cancel(), retry()
```

Estados visibles: `en cola`, `trabajando`, `reintentando`, `esperando confirmación`, `reconectando`, `terminado`, `falló`, `cancelado`, `desconocido`.

Reglas:

- El elapsed se calcula desde `startedAt` del turno, no desde el montaje del componente.
- Al montar, si el historial trae un turno activo, el panel se muestra ocupado y se engancha; no se depende de que la mutación siga viva.
- Si el stream se corta, no se muestra un error rojo terminal; se muestra “Reconectando” y se reintenta el attach con backoff.
- Al completar, el mensaje final se toma del historial/servidor y se reconcilia por `turnId`; no se duplica el mensaje local.
- El mensaje de sistema solo aparece para estados terminales (`failed`, `timed_out`, `cancelled`, `unknown`); un turno recuperado no deja un error terminal.
- `cancel` pide confirmación si hubo side effects; `retry` advierte si el turno previo es `unknown` o mutó archivos.

Alternativas: mantener el estado local de la mutación (actual) es lo que produce la UI bloqueada/errónea cuando el request muere; se reemplaza.

### 7. Presupuesto de timeouts coherente

Un resolvedor único de política de turno:

```text
AGENT_TURN_MAX_MS          (default 30 min)
AGENT_TURN_IDLE_MS         (default 10 min sin progreso/actividad)
AGENT_CHAT_TIMEOUT_MS      (compatibilidad; se mapea al máximo si existe)
OPENCODE transport idle    > AGENT_TURN_MAX_MS + margen
OpenCode provider headers  >= política de pausa del modelo
OpenCode bash default      >= máximo esperado de tools, o timeout por llamada
SSE heartbeat              15 s
```

Reglas:
- `session.active`/`get` y los eventos de progreso renuevan actividad; un `session.status` retry no cuenta como inactividad.
- Al vencer el máximo o el idle sin actividad, `session.interrupt`; el turno queda `timed_out` o `cancelled`.
- La cancelación del usuario es explícita y también interrumpe.
- Si la configuración de OpenCode tiene un timeout menor que el turno, el sistema lo reporta como error de configuración o lo escribe en el `opencode.json` del servicio; no deja un cliff oculto.
- El `withTimeout` actual se elimina del chat; el adapter/helper maneja el deadline y la cancelación.

### 8. Taxonomía de estados y recuperación

| Estado | Causa | Acción |
|---|---|---|
| `queued` | Turno creado, prompt aún no entregado | Esperar watchdog/inbox |
| `running` | Sesión activa o ejecución iniciada | Progreso + watchdog |
| `recovering` | Transporte interrumpido, sesión aún activa | Reanudar log/polling |
| `succeeded` | Ejecución exitosa con respuesta | Persistir mensaje |
| `empty_reply` | Éxito sin texto | Fallar; retry solo si read-only |
| `failed` | `execution.failed` o error terminal | Persistir código; retry manual |
| `timed_out` | Máximo/inactividad | Interrumpir; avisar |
| `cancelled` | Usuario | Interrumpir; avisar |
| `interrupted` | OpenCode shutdown/inactivity/superseded | Reconciliar; no auto-reenviar |
| `unknown` | Sesión perdida sin outcome | Avisar; revisar side effects |

`session.execution.failed` trae un `SessionStructuredError` con `type`, `message`, `status`, `retryAfterMs`; se sanitiza y se mapea. Un turno `unknown` nunca se auto-reintenta si hubo tools mutantes; uno read-only del orquestador puede reintentarse una vez.

La recuperación al arranque:

1. Listar `chat_turns` con `queued/running/recovering`.
2. Para cada uno, `session.get`/`listActive`/`listInbox`/mensajes.
3. Si el turno pertenece al mismo `thread`/scope y el prompt fue entregado, reconciliar.
4. Si no fue entregado (sin inbox y sin mensaje), marcar `failed`/`not_delivered`; el retry es seguro.
5. Si la sesión desapareció después de entregar, `unknown`; no reenviar.

### 9. Cross-surface

`ChatTarget`:

- **Proyecto web**: thread `web`, scope project, context `chat`, primary agent/model del proyecto.
- **Orquestador web**: thread global `web`, scope global, context `chat`, agente `orchestrator/agente`, readOnly.
- **Canal de proyecto**: thread por integración/external sender, context `external_channel`, reply por egress al completar.
- **Canal global**: scope global, integration global, readOnly.
- **Chat externo**: thread por `threadId`, context `external_channel`, SSE/JSON/webhook.

El servicio registra/actualiza `session_context` al crear o cambiar de sesión, agente o modelo, antes de enviar el prompt. La autorización del turno usa el scope/proyecto, y el plugin sigue recibiendo `x-platform-session`/`x-platform-agent`.

Para canales, la entrega de la respuesta se separa del turno:
- el turno termina y persiste la respuesta;
- se crea una entrega idempotente (o se reutiliza el ledger de deliveries) con `turnId`/integration/recipient;
- un worker/reintento acotado la envía; si falla, el turno sigue `succeeded` y la entrega queda `failed` con health/logs.
Esto evita que un fallo de Telegram/WhatsApp convierta un turno exitoso en error del agente.

### 10. Observabilidad

- Logs estructurados: `chat_turn_created`, `chat_turn_delivered`, `chat_turn_recovering`, `chat_turn_succeeded`, `chat_turn_failed`, `chat_turn_timed_out`, `chat_turn_cancelled`, `chat_turn_recovered`, `chat_transport_retry`, `chat_event_stream_reconnected`, `chat_delivery_failed`; incluyen `turnId`, `threadId`, `projectSlug`, `sessionId`, `entryPoint`, `durationMs`, `errorCode`, sin prompt/mensaje.
- Métricas: `chat_turns_started`, `chat_turns_succeeded`, `chat_turns_failed`, `chat_turns_timed_out`, `chat_turns_cancelled`, `chat_turns_recovered`, `chat_transport_retries`; histograma de duración y uso desde `session.get` (`cost`, `tokens`, `time.busy/idle`).
- `ErrorTracker`/Sentry para fallos terminales con contexto; los transportes recuperados son warnings.
- `GET /api/system/health` añade `chat: { active, oldestActiveAgeMs, recovered24h, failed24h, lastErrorAt }`; los fallos terminales se insertan en `store.errors` y aparecen en `/api/system/errors`.

## Risks / Trade-offs

- **`session.log` es experimental** -> spike en la versión desplegada, feature flag, polling como watchdog y fallback; pin de `@opencode/cli`/`@opencode/client` a 2.2.5 y tests de contrato.
- **Duplicar prompts o side effects** -> idempotencia por `clientMessageId`/external message ID, `session.prompt.id`/metadata, reconciliación de inbox, single-flight y no auto-retry de turnos mutantes.
- **El log de sesión no tenga keepalives** -> fetch con idle timeout mayor/reconexión por cursor; el watchdog de polling sigue detectando el fin.
- **Carrera entre evento de fin y lectura de mensaje** -> el log durable se procesa en orden y el reconciliador verifica `session.get`/mensajes antes de marcar terminal.
- **SQLite con muchas escrituras de estado** -> transiciones y cursor con batching/throttle; el polling no escribe en cada vuelta; una instancia es el supuesto actual.
- **Clientes HTTP existentes** -> `POST /chat` mantiene SSE/JSON; los nuevos endpoints son aditivos; el campo `sessionId` se conserva por compatibilidad y se añade `turnId`.
- **UI más compleja** -> hook/state machine y tests de componente/E2E; los estados se derivan del servidor y el historial es la fuente de verdad.
- **Servicio OpenCode reiniciado o endpoint cambiado** -> invalidar el cliente cacheado, `Service.ensure` con backoff, reconectar log/polling; si la sesión se perdió, `unknown` y aviso, sin reenvío ciego.
- **Timeout que interrumpe a mitad de una escritura** -> `session.interrupt` + `session.diff`/archivos cambiados en el aviso; el usuario revisa antes de reintentar. No hay rollback automático de archivos.
- **Permisos/forms de OpenCode** -> un turno puede quedar esperando una respuesta que la UI no ofrece; se detecta como `waiting_for_input` en una fase posterior o se desactiva el modo interactivo para agentes de proyecto. No se ignora: se audita y se documenta.
- **Cambio amplio** -> feature flag `CHAT_TURN_ENGINE=legacy|v2`, migración aditiva y rollout por superficies; el rollback es volver a `legacy` (los turnos nuevos quedan en la tabla, sin pérdida de chat histórico).

## Migration Plan

1. **Spike de OpenCode**: validar `session.log` (`after`, `follow`, `log.synced`, `execution.*`, keepalives/replay) y `session.active/get` contra el 2.2.5 desplegado. Documentar el resultado; si falla, polling primario.
2. **Esquema aditivo**: `chat_turns`, `chat_messages.turn_id/error_code`, `session_event_cursors` si se usa el log; migración con backup y test de migración. No tocar filas históricas.
3. **Adapter/primitivas**: `sendPrompt`, `openSessionLog`/`waitForTurn`, `getSession`, `listActive`, `listInbox`, `getMessages`, `interrupt`, reconexión del cliente; tests de contrato con fake client.
4. **Turn service**: creación, single-flight, idempotencia, supervisor, watchdog, timeout/cancel, recuperación, taxonomía; tests unitarios con clock/runtime fake.
5. **API/SSE**: POST fachada, GET estado/eventos, cancel/retry, `chat.turn.updated`, historial con turno; tests HTTP/SSE.
6. **Web**: `useChatTurn`, estados, reattach, cancel/retry, reconciliación de historial; tests de componente/E2E.
7. **Orquestador y canales**: migrar a `ChatTarget`; entrega idempotente; mantener la política read-only del orquestador y no auto-retry en project chat.
8. **Timeouts/config**: resolvedor único, variables documentadas, alineación de OpenCode provider/bash, health/metrics.
9. **Rollout**: `CHAT_TURN_ENGINE=legacy` por defecto; habilitar `v2` en el proyecto de prueba/admin; verificar turno de 6+ min, recarga, restart, duplicado, cancelación y canal; luego default `v2`. Rollback: volver a `legacy`; la tabla y los turnos quedan para inspección.
10. **Cierre**: eliminar `session.wait` como dueño y el `withTimeout` del chat; mantener un fallback de compatibilidad solo si el spike lo exige. Ejecutar `bun run typecheck`, `bun test`, `bun run test:e2e`, `graphify update .` y la prueba manual larga.

## Open Questions

- Confirmar en el spike si el `session.log` del 2.2.5 desplegado emite keepalives/replay y si `after` usa `durable.seq`; el diseño ya tiene polling como fallback, pero el modo primario depende de esto.
- Definir si el hilo web será por proyecto o por usuario cuando existan varios administradores. El diseño actual conserva el hilo por proyecto; cambiarlo afecta historial y single-flight.
- Decidir si los agentes de proyecto deben poder quedar en `waiting_for_input` por permisos/forms o si se desactiva el modo interactivo en chat. No cambia el núcleo del turno, pero sí la UI y la política de timeout.
- Fijar los defaults definitivos de máximo/inactividad (propuesta: 30 min / 10 min) y si serán ajustables por proyecto o solo por entorno.
