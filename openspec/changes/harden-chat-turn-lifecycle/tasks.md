# Tasks

Supuestos de planificación: el hilo web sigue siendo por proyecto/scope (no por usuario); el máximo de turno propuesto es 30 min con 10 min de inactividad, configurable; `session.log` será primario solo si el spike lo valida, con polling como watchdog/fallback; los turnos mutantes de proyecto no se reintentan automáticamente y el orquestador read-only puede reintentar una respuesta vacía.

## 1. Spike y contrato de OpenCode

- [x] 1.1 Validar en OpenCode 2.2.5 desplegado `experimental.session.log` con `after`/`follow` (eventos `log.synced`, `execution.started/succeeded/failed/interrupted`, `inbox.*`), keepalives y replay tras reconectar; documentar el resultado y si el modo primario será log o polling en `design.md` o un anexo de validación.
- [x] 1.2 Validar `session.active`, `session.get`, `session.inbox.list`, `session.message.get/list` y `session.interrupt` con una sesión activa, una idle y una inexistente; verificar que el flujo de reconciliación puede distinguir los tres casos con un test de contrato o script reproducible.
- [x] 1.3 Pinnear `@opencode/client` a la misma versión exacta que `@opencode/cli` y ampliar el fake client del adapter con las nuevas primitivas; verificar `bun run typecheck` y el test de contrato del adapter.

## 2. Persistencia durable del turno

- [x] 2.1 Añadir `chat_turns` (estado, scope, sesión, mensajes, inbox, uso, error, idempotencia, timestamps) y `chat_messages.turn_id/error_code` con migración aditiva; verificar que la migración corre sobre una copia de la DB actual y que las filas históricas quedan intactas.
- [x] 2.2 Añadir los índices/constraints de un turno activo por hilo y de idempotencia `(thread_id, idempotency_key)`; verificar con tests de creación concurrente que no se insertan dos turnos activos ni dos turnos para el mismo mensaje.
- [x] 2.3 Implementar el repositorio de turnos y la lectura de historial con metadata de turno; verificar con tests de persistencia, transición de estado y borrado en cascada al eliminar el proyecto/hilo.
- [x] 2.4 Añadir `session_event_cursors` (o el cursor equivalente en el turno) y persistir `last_seq`/`last_activity_at` con batching; verificar que un reinicio conserva el cursor y que la reconciliación no duplica eventos.

## 3. Runtime de OpenCode: enviar, esperar y reconciliar

- [x] 3.1 Extender `AgentRuntimePort` con `sendPrompt` (id/metadata/delivery), `openSessionLog`/`waitForTurn`, `getSession`, `listActive`, `listInbox`, `getMessages`, `getMessage` e `interrupt`; verificar que el fake runtime y los tests existentes compilan y que el helper `runPrompt` de workflow mantiene su contrato.
- [x] 3.2 Implementar las primitivas en `OpenCodeV2Adapter` con correlación por `turnId`/metadata y extracción del mensaje assistant exacto del turno, incluyendo el caso sin texto; verificar con tests de mensaje normal, tool-only, múltiples turnos y respuesta vacía.
- [x] 3.3 Hacer que el adapter invalide y recree el cliente ante fallos de transporte y que reconecte el log/event stream desde el cursor con backoff; verificar con un fake client que simula caída, endpoint nuevo y replay sin duplicados.
- [x] 3.4 Configurar el fetch del stream de larga duración (idle timeout mayor que el turno o keepalives validados) y el fetch corto de polling con timeout/reintento; verificar con un servidor fake que un stream silencioso de 6+ minutos simulados no se corta y que un poll colgado reintenta.
- [x] 3.5 Añadir tests de contrato para `session.log`/`session.active`/`session.get`/inbox/message/interrupt con el fake client y con el adapter real contra un servicio fake local; verificar `bun test --cwd apps/server` para el grupo.

## 4. ChatTurnService

- [x] 4.1 Implementar `start` con creación transaccional de turno + mensaje, resolución de `ChatTarget`, single-flight por hilo e idempotencia por `clientMessageId`; verificar con tests de creación, duplicado y segundo mensaje concurrente.
- [x] 4.2 Implementar el supervisor de progreso y fin: log durable como primario cuando esté validado, `session.active/get` como watchdog/fallback, cursor persistido y reconciliación de outcomes; verificar con tests de turno largo, evento perdido, log caído y sesión idle.
- [x] 4.3 Implementar la recuperación al arranque para turnos `queued/running/recovering` con los casos sesión activa, idle con mensaje, fallida, interrumpida e inexistente; verificar que el turno se reanuda, completa o marca `unknown` sin reenviar prompts entregados.
- [x] 4.4 Implementar timeout máximo/inactividad, cancelación y `session.interrupt`, con estados `timed_out`/`cancelled` y aviso de cambios parciales; verificar con un clock fake que el agente se interrumpe y que no queda trabajo invisible.
- [x] 4.5 Implementar la taxonomía de errores, detección de side effects y política de retry (orquestador read-only retry una vez; proyecto mutante sin auto-retry); verificar con tests de `execution.failed`, `empty_reply`, `unknown`,cancelación y reintento.
- [x] 4.6 Implementar el buffer de eventos por turno, suscripción/replay y `chat.turn.updated`; verificar con tests de attach, desconexión, reattach, turno ya terminado y gap de replay.

## 5. API y SSE

- [x] 5.1 Convertir `POST /api/projects/:slug/chat` en fachada del `ChatTurnService` (SSE con `turn`/`status`/`delta`/`activity`/`heartbeat`/`done`/`error`; JSON síncrono compatible); verificar con tests HTTP/SSE y con el cliente web actual.
- [x] 5.2 Añadir `GET /chat/turns/:id`, `GET /chat/turns/:id/events`, `POST /chat/turns/:id/cancel` y `POST /chat/turns/:id/retry` con autorización por proyecto/scope; verificar escenarios de cross-project 403, attach, replay, cancel y retry.
- [x] 5.3 Añadir el turno activo y la metadata de estado al historial `GET /chat`, y publicar `chat.turn.updated` en `SseHub`; verificar que la UI puede restaurar un turno activo y que el badge se actualiza sin el request original.
- [x] 5.4 Mantener la compatibilidad del orquestador global y del gateway de chat externo con los nuevos eventos/`turnId`; verificar los contratos HTTP/SSE existentes y documentar los campos nuevos.

## 6. Web

- [x] 6.1 Crear el hook `useChatTurn` con máquina de estados (en cola, trabajando, reintentando, reconectando, terminado, fallido, cancelado, desconocido), attach/reattach y reconciliación por `turnId`; verificar con tests de componente y de historial simulado.
- [x] 6.2 Actualizar `ChatPanel` para mostrar estado/elapsed del servidor, reconexión, cancelar, reintentar y avisos de side effects; verificar con tests de interacción y accesibilidad existentes.
- [x] 6.3 Actualizar `ProjectPage`/`OrchestratorPage` para usar el hook, escuchar `chat.turn.updated`, restaurar turno activo y no duplicar mensajes al recargar; verificar con tests de página y E2E de recarga durante un turno.

## 7. Orquestador global

- [x] 7.1 Migrar `ChatWithOrchestratorUseCase` a `ChatTurnService` con target global read-only, historial y attach; verificar que el chat web y el canal global comparten el ciclo durable sin mezclar hilos de proyecto.
- [ ] 7.2 Conservar la política de respuesta vacía: retry una vez en sesión nueva, sin mensaje vacío, y fallo visible si el retry también falla; verificar con los tests de `fix-orchestrator-tool-turns` y nuevos casos de turno largo/recarga.
- [x] 7.3 Verificar que el orquestador no auto-reintenta turnos mutantes de proyecto y que sus turnos no aparecen en historiales de proyecto; añadir tests de scope y de error.

## 8. Canales y gateway externo

- [x] 8.1 Migrar `RouteProjectIntegrationMessageUseCase` y `RouteGlobalIntegrationMessageUseCase` a `ChatTurnService`; el handler del canal crea el turno y no queda bloqueado; verificar con tests de Telegram/WhatsApp fake y entrega al completar.
- [x] 8.2 Migrar `SendExternalChatMessageUseCase`/`external-chat-routes` a turno durable con SSE attach, JSON compatible y webhook al completar; verificar desconexión del cliente, entrega posterior y thread mapping.
- [x] 8.3 Añadir idempotencia de mensajes externos (`externalMessageId`/`clientMessageId`) y entrega idempotente por canal con ledger/reintento acotado; verificar duplicado de inbound, fallo de proveedor y recuperación sin doble entrega.
- [x] 8.4 Verificar el alcance por proyecto/integración en turnos de canal y que un proyecto no puede leer, cancelar ni reintentar el turno de otro; añadir tests de aislamiento.

## 9. Presupuesto de timeouts y configuración

- [x] 9.1 Implementar el resolvedor único de política (`AGENT_TURN_MAX_MS`, `AGENT_TURN_IDLE_MS`, compatibilidad con `AGENT_CHAT_TIMEOUT_MS`) y validar que el máximo cubre los timeouts de provider/tool; verificar con tests de configuración y valores inválidos.
- [ ] 9.2 Alinear la configuración de OpenCode para provider headers/stream y bash default con el presupuesto del turno, y documentar las variables; verificar que un turno con tool larga no falla antes que el turno.
- [x] 9.3 Documentar en README y `.env.example` el ciclo de turno, los nuevos endpoints, los estados, la cancelación y el feature flag `CHAT_TURN_ENGINE`; verificar que los comandos/valores documentados existen.

## 10. Observabilidad y salud

- [x] 10.1 Instrumentar logs estructurados y métricas de turnos (creado, entregado, recuperado, terminado, fallido, timeout, cancelado, retry) con `turnId`/`threadId`/`projectSlug`/`sessionId`/entry point sin prompt; verificar con tests de logger/metrics y revisión de que no hay contenido sensible.
- [x] 10.2 Insertar fallos terminales en el error ledger y Sentry cuando esté configurado, y ampliar `/api/system/health` con turnos activos, edad del más viejo, recuperados y fallidos; verificar que un fallo de chat ya no deja `errors: 0`.
- [x] 10.3 Añadir tests de recuperación de sesión/turno, largo turno, desconexión/recarga, reinicio, duplicado, timeout, respuesta vacía, aislamiento cross-project y entrega de canal usando fake runtime/clock; verificar que la suite no tarda cinco minutos reales.

## 11. Rollout y verificación integral

- [x] 11.1 Añadir el feature flag `CHAT_TURN_ENGINE=legacy|v2`, cablear la recuperación al arranque y el shutdown del supervisor; verificar que `legacy` sigue funcionando y que `v2` puede activarse por entorno.
- [x] 11.2 Ejecutar la verificación completa: `bun run typecheck`, `bun test`, `bun run build`, `bun run test:e2e`, `graphify update .`; corregir cualquier regresión antes de cerrar el grupo.
- [x] 11.3 Ejecutar la prueba manual/controlada con un turno de 6+ minutos (tool larga o tarea real) en un proyecto de prueba: verificar que no aparece `Transport: The operation timed out.`, que el agente completa, que la respuesta se persiste, que recargar/reconectar funciona y que health muestra el turno recuperado.
- [x] 11.4 Verificar el rollback a `legacy` sin pérdida de historial y documentar el procedimiento de activación/rollback; confirmar que los turnos nuevos quedan inspeccionables en `chat_turns`.

## Workflow follow-up

- Create `change/harden-chat-turn-lifecycle` from the remote base branch before implementation.
- Commit the planning artifacts with `docs(openspec): plan harden-chat-turn-lifecycle`.
- Create one atomic commit per numbered group: `<type>(harden-chat-turn-lifecycle): <summary>`.
- Push the branch and open a PR with `gh pr create`; report the URL and do not merge automatically.
- Wait for human review and merge; archive only after the PR is merged.
