# Tasks

## 1. Contratos compartidos P0 y persistencia base

- [x] 1.1 Agregar `notify` y `database` a `NodeTypeSchema`, sus configuraciones tipadas y la metadata del catálogo; verificar con `bun run --cwd packages/shared test` y un test de parseo de ambos nodos.
- [x] 1.2 Extender `NodeSpec` con `onError` (stop/continue/route) y `retryPolicy` con backoff opcional; verificar que un workflow existente sin esos campos sigue parseando y que los nuevos valores se validan.
- [x] 1.3 Extender `TriggerConfig` con `timezone`, `enabled`, `overlapPolicy` y `catchUp`/`catchUpWindowMinutes`, conservando UTC y `skip` como defaults; verificar con tests de parseo y de defaults.
- [x] 1.4 Crear las migraciones Drizzle para `workflow_deliveries` y `workflow_schedule_state`, con índices por `project_slug`, `action_key` y `workflow_id`; verificar que una base nueva y una existente migran sin pérdida de datos.
- [x] 1.5 Agregar los repositorios de entregas y estado de schedule al puerto `Store` y a SQLite; verificar con tests de integración contra `:memory:` para insertar, consultar por action key y actualizar estado.

## 2. Nodo nativo de base de datos P0

- [x] 2.1 Extender `ExternalDatabaseAdapter` con `transaction(config, statements)` e implementarlo para SQLite, Postgres, MySQL y SQL Server; verificar commits, rollback y timeout con SQLite real y mocks de los otros drivers.
- [x] 2.2 Implementar `ExecuteDatabaseActionUseCase` con validación de scope, modo lectura/escritura, sentencias parametrizadas, transacción y límite de filas; verificar con tests de scope cruzado, rollback y resultado truncado.
- [x] 2.3 Integrar el nodo `database` en `ExecuteWorkflowRunUseCase` y publicar la salida `{ rows, rowCount, affectedRows, truncated }`; verificar con un workflow que lee y otro que escribe en SQLite de prueba.
- [x] 2.4 Agregar el nodo `database` a la paleta y al inspector (integración, modo, SQL, params, transacción, maxRows); verificar con tests de componente que el formulario valida y persiste la configuración.
- [x] 2.5 Documentar el nodo `database` y su diferencia con `code`/`ctx.db`; verificar que el ejemplo documentado ejecuta contra una base SQLite de prueba.

## 3. Nodo nativo de notificación P0 y ledger de entregas

- [x] 3.1 Extender `IntegrationEgressPort.send` para devolver `{ providerMessageId?: string }` y actualizar los adaptadores de Telegram, WhatsApp y chat externo; verificar con tests de cada adaptador y un mock de proveedor.
- [x] 3.2 Implementar `SendNotificationUseCase` con reglas de destinatario, plantilla, deduplicación por `action_key` y estados `pending`/`delivered`/`failed`; verificar con tests de deduplicación, canal sin destinatario y fallo del proveedor.
- [x] 3.3 Integrar el nodo `notify` en el executor, extender `ctx.notify` para aceptar destinatario y ajustar el RPC del worker; verificar con un workflow que envía a Telegram/WhatsApp simulado y otro a chat externo.
- [x] 3.4 Agregar el nodo `notify` a la paleta y al inspector (integración, destinatario, plantilla, preview); verificar con tests de componente que solo ofrece integraciones de salida del proyecto.
- [x] 3.5 Documentar el nodo `notify`, el destinatario obligatorio y el ledger de entregas; verificar que los ejemplos de Telegram, WhatsApp y chat externo coinciden con el contrato.

## 4. Timeout, reintentos y política de error uniforme

- [x] 4.1 Extender `AgentRuntimePort` con timeout e `interrupt(sessionId)` y usar `session.interrupt` de OpenCode; verificar con el runtime fake que un timeout marca `timed_out` y no bloquea el run.
- [x] 4.2 Extraer `executeWithPolicy` en el executor para aplicar timeout y retry con backoff a `code`, `agent`, `http`, `database` y `notify`; verificar con tests de reintento exitoso y agotamiento.
- [x] 4.3 Implementar las estrategias `stop`, `continue` y `route`, validar targets inexistentes/auto-referencias/ciclos y persistir el payload de error; verificar con tests de cada estrategia y de un ciclo rechazado.
- [x] 4.4 Agregar al inspector la sección "On error" con estrategia y target, y representar la ruta en el canvas; verificar con tests de componente que se guarda y se vuelve a cargar.
- [x] 4.5 Documentar la política de error y la advertencia de reintentos en escrituras DB; verificar que el README y el inspector dicen lo mismo.

## 5. Ciclo de vida del schedule P0

- [x] 5.1 Implementar el matcher de cron con timezone IANA y DST usando `Intl`, sin dependencias nuevas; verificar con tests de zona horaria, hora repetida y hora inexistente.
- [x] 5.2 Implementar el repositorio/backfill de `workflow_schedule_state` al arrancar; verificar que un workflow con schedule crea su estado y que un reinicio conserva `last_window_at`.
- [x] 5.3 Refactorizar `WorkflowScheduler.tick` para `enabled`, solapamiento `skip`, catch-up acotado y `next_run_at`; verificar con reloj fake y workflows con runs en curso.
- [x] 5.4 Exponer `next_run_at` en la API y agregar timezone/enabled/overlap/catch-up al inspector; verificar con tests de API y de componente.
- [x] 5.5 Documentar timezone, catch-up, solapamiento y límites del scheduler; verificar que la documentación incluye ejemplos de DST y de recuperación.

## 6. Aprobaciones operables P0

- [x] 6.1 Implementar `DecideApprovalUseCase` y los endpoints `GET`/`POST` de aprobaciones con scope de proyecto y actor; verificar con tests HTTP de aprobar, rechazar, no autorizado y run inexistente.
- [x] 6.2 Conectar `notifyApproval` y la configuración de canal de aprobación del proyecto; verificar que un run manual y uno programado envían el prompt al canal configurado y uno de canal usa su origen.
- [x] 6.3 Aplicar `autoApprove` en el executor y registrar la decisión automática; verificar que no se crea una aprobación pendiente y que el step queda `succeeded`.
- [x] 6.4 Agregar la aprobación pendiente a `RunDetailModal` con aprobar/rechazar y refresco SSE; verificar con tests de componente y un test de integración de reanudación.
- [x] 6.5 Documentar el flujo de aprobación manual, programada y por canal; verificar que los comandos y endpoints documentados funcionan en el test de humo.

## 7. Integración P0 y aceptación

- [x] 7.1 Ejecutar `bun run typecheck`, `bun run test`, `bun run build` y los E2E de P0; verificar que toda la suite termina en verde.
- [x] 7.2 Ejecutar el escenario E2E "schedule -> notify" contra un canal de prueba y verificar que el mensaje llega una sola vez y la entrega aparece en el panel.
- [x] 7.3 Ejecutar el escenario E2E "webhook/agente -> database -> aprobación" y verificar que la escritura ocurre una sola vez y el rechazo no deja cambios.
- [x] 7.4 Ejecutar el escenario E2E de ruta de error y verificar que el run sigue por el target y registra el payload del fallo.
- [x] 7.5 Preparar la checklist de aceptación P0 y obtener la validación explícita del usuario en staging o un entorno real; registrar la evidencia en `openspec/changes/add-reliable-automation-actions/validation-p0.md`.

## 8. Gate P0 → P1 (BLOQUEANTE)

> No iniciar ni marcar ninguna tarea de los grupos 9 a 14 hasta que el usuario confirme la validación de P0.

- [x] 8.1 Confirmar que la checklist de P0 está completa, que los E2E pasan y que no hay regresiones abiertas; verificar el estado de la suite y la evidencia de `validation-p0.md`.
- [x] 8.2 Obtener la confirmación explícita del usuario para continuar con P1; sin esta confirmación, detener la implementación.

## 9. Seguridad de base de datos y secretos HTTP P1

- [x] 9.1 Agregar `access`, `maxRows` y `allowDdl` a la configuración de integraciones DB, con migración que preserve el comportamiento existente y defaults seguros para integraciones nuevas; verificar con tests de validación y migración.
- [x] 9.2 Aplicar la política en `ExecuteDatabaseActionUseCase` y en la tool `db_query` (clasificación read/write/ddl, límite de filas y rechazo previo a conectar); verificar con tests de cada operación y de auditoría.
- [x] 9.3 Implementar `integrationId`/`baseUrl` y referencias `secret:<alias>`/`{{secret.<alias>}}` en el nodo HTTP; verificar que el valor resuelto no aparece en workflow, snapshot, logs ni respuesta de tool.
- [x] 9.4 Agregar la política DB y los secretos HTTP a la UI de Recursos/Inspector; verificar con tests de componente que solo se ofrecen integraciones del proyecto y que el alias se guarda, no el valor.
- [x] 9.5 Documentar la política DB y los secretos HTTP; verificar con un ejemplo que el workflow versionado contiene solo alias.

## 10. Contexto de sesión y permisos de tools P1

- [x] 10.1 Crear `session_context` y registrar sesiones de chat, workflow y canal al crearlas; verificar con tests de alta, consulta, expiración y borrado en cascada.
- [x] 10.2 Propagar `sessionID`/`agent` desde `Tool.Info.execute` en el plugin y resolver el contexto en el servidor; verificar con tests de plugin y HTTP para chat, workflow y canal.
- [x] 10.3 Aplicar reglas `allow`/`deny` con el agente resuelto y auditar cada veredicto; verificar que un `deny` de `db_query`/`notify` bloquea en workflow y que un chat autorizado conserva diseño.
- [x] 10.4 Agregar la tool `integration_list` de solo lectura y limitada al proyecto; verificar que no expone secretos y que el scope global no la recibe.
- [x] 10.5 Documentar el contrato de contexto y permisos; verificar que el README ya no promete un enforcement que no existe.

## 11. Timers durables y schedules únicos P1

- [x] 11.1 Crear `workflow_timers` y su repositorio con reclamo atómico y recuperación al arrancar; verificar con tests de doble claim y reinicio.
- [x] 11.2 Implementar `delay` durable para esperas mayores a 60 s y `waitUntil`, pausando y reanudando el run; verificar con un test que simula reinicio y vencimiento.
- [x] 11.3 Agregar `mode: "once"` y `runAt` al trigger schedule, con idempotencia y catch-up al arrancar; verificar que se ejecuta una sola vez y que una fecha perdida se recupera según configuración.
- [x] 11.4 Agregar la configuración de espera/fecha única al inspector; verificar con tests de componente que se guarda y se muestra la próxima ejecución.
- [x] 11.5 Documentar timers durables y ejecuciones únicas; verificar que el ejemplo de espera de días funciona en el test de integración.

## 12. Foreach y subworkflows P1

- [ ] 12.1 Agregar `foreach` y `subworkflow` a los contratos, validación de recursos y detección de ciclos; verificar con tests de configuración inválida y ciclo directo/transitivo.
- [ ] 12.2 Implementar runs hijos con `parentRunId`, concurrencia acotada y agregación de resultados por elemento; verificar con tests de éxito, fallo `continue`, fallo `stop` y límite de concurrencia.
- [ ] 12.3 Implementar la invocación de subworkflow por versión inmutable y la propagación de fallo; verificar que un cambio en disco no altera el snapshot del hijo.
- [ ] 12.4 Agregar `foreach`/`subworkflow` a la paleta y al inspector; verificar con tests de componente que ofrecen solo workflows del mismo proyecto.
- [ ] 12.5 Documentar lotes y subworkflows; verificar que los ejemplos no violan el scope del proyecto.

## 13. Cola, rate limit y alertas por proyecto P1

- [ ] 13.1 Crear `workflow_run_queue`, agregar el estado `queued` y persistir la cola; verificar con tests de encolado, despacho y recuperación tras reinicio.
- [ ] 13.2 Implementar el límite de concurrencia por proyecto y el dispatcher; verificar que el exceso se encola y que no se pierde ni duplica trabajo.
- [ ] 13.3 Implementar rate limit de notificaciones con entrega `queued` y espera acotada; verificar con tests de ráfaga, espera y timeout.
- [ ] 13.4 Extender `AlertService` para usar integraciones y destinatario del proyecto con fallback global; verificar que un fallo de proyecto no se envía a un canal de otro proyecto.
- [ ] 13.5 Exponer cola, rate limit y alertas en la UI de ajustes/salud; verificar con tests de componente y documentar la configuración.

## 14. Observabilidad y verificación P1

- [ ] 14.1 Emitir eventos y métricas de entregas, schedules, aprobaciones y cola con redacción de datos sensibles; verificar con tests de logger y de métricas.
- [ ] 14.2 Agregar próximas ejecuciones, entregas fallidas, cola y aprobaciones pendientes al panel de salud; verificar con tests de API y de componente.
- [ ] 14.3 Ejecutar los E2E de P1: permisos por sesión, secreto HTTP, timer durable, `foreach`/subworkflow y rate limit; verificar que toda la suite termina en verde.
- [ ] 14.4 Ejecutar `bun run typecheck`, `bun run test`, `bun run build`, `bun run test:e2e` y `graphify update .`; verificar que no hay errores y que el grafo se actualiza.
- [ ] 14.5 Actualizar README y docs con las dos fases, el gate P0/P1 y las limitaciones de exactly-once/multi-instancia; verificar que la documentación coincide con los contratos.

## Workflow follow-up

- Create `change/add-reliable-automation-actions` from the remote base branch before implementation.
- Commit the planning artifacts with `docs(openspec): plan add-reliable-automation-actions`.
- Create one atomic commit per numbered group: `<type>(add-reliable-automation-actions): <summary>`.
- Push the branch and open a PR with `gh pr create`; report the URL and do not merge.
- Do not start Phase 2 (groups 9-14) until the user explicitly confirms P0 validation in group 8.
- Wait for human review and merge; archive only after the PR is merged.
