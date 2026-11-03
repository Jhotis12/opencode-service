# Proposal

## Why

Un turno de chat que tarda más de cinco minutos falla con `Transport: The operation timed out.` aunque el agente siga trabajando y termine correctamente. La causa es que el turno vive dentro del request HTTP y depende de `experimental.session.wait`, un long-poll silencioso que Bun corta por inactividad a los 300 s por defecto. El agente continúa en OpenCode, pero la plataforma deja de escuchar, persiste un error y pierde la respuesta final.

El fallo se reprodujo en la instancia desplegada: tres intentos fallaron entre 5m24s y 5m48s; una prueba controlada con `sleep 330` falló a los 305 s y el agente respondió `listo` al turno siguiente. El flujo y el subagente creados seguían existiendo, el panel de salud mostraba `errors: 0` y los reintentos se encolaron sobre una sesión todavía ocupada. El resultado es un falso negativo, trabajo duplicado o inconsistente y pérdida de confianza en el chat.

No es un problema de latencia del modelo: es un problema de propiedad del turno. Mientras el turno dependa de un request y de un long-poll sin keepalive, cualquier tarea larga volverá a fallar, y no habrá forma de recuperar el resultado, reconectar la UI, cancelar el agente ni observar el fallo.

## What Changes

- Introducir un **turno de chat durable** (`chat_turns`) con estado, mensajes vinculados, sesión de OpenCode, modelo, uso, idempotencia y error tipado. El turno es la unidad de trabajo; el request y el SSE pasan a ser una vista que se puede conectar y desconectar.
- Implementar un `ChatTurnService` que crea, ejecuta, supervisa, recupera y cancela turnos. Un solo turno activo por hilo, con idempotencia por mensaje de cliente para que un reintento no duplique prompts ni side effects.
- Detectar el fin de forma autoritativa con el log durable de OpenCode (`experimental.session.log` con `after`/`follow`) y un watchdog estable (`session.active`/`session.get`). `session.wait` deja de ser el dueño del turno; queda, como máximo, como compatibilidad interna.
- Separar en el puerto de runtime “enviar prompt” de “esperar fin”: `sendPrompt` con `id`/metadata, consulta de sesión, inbox y mensajes, `interrupt`, y reconexión del cliente ante caídas del servicio OpenCode.
- Añadir APIs y eventos para consultar un turno y reenganchar su SSE: `POST /chat` devuelve/emite `turnId`, `GET /chat/turns/:id` expone estado e historial, y `GET /chat/turns/:id/events` permite reconectar con replay de progreso.
- Alinear el presupuesto de timeouts: máximo de turno configurable, timeout de inactividad, cancelación con `session.interrupt`, y timeouts de proveedor y tool `bash` coherentes con el turno. **BREAKING**: el timeout de chat ya no se limita a cortar la respuesta HTTP; interrumpe la ejecución del agente y deja un estado recuperable.
- Migrar el chat web de proyecto, el orquestador global y los canales de agente (Telegram, WhatsApp y chat externo) al mismo ciclo de vida. La entrega por canal ocurre cuando el turno termina y debe ser idempotente.
- Hacer visible el turno en la UI: en curso, en cola, reintentando, esperando confirmación, reconectando, terminado, fallido o desconocido; con cancelar, reintentar y recuperación al recargar.
- Instrumentar el ciclo: logs con `turnId`/`threadId`/`projectSlug`/`sessionId`, métricas de turnos activos/duración/recuperados/fallidos, errores terminales en `ErrorTracker`/Sentry y health con estado real del chat.

## Capabilities

### New Capabilities

- `chat-turn-lifecycle`: propiedad durable del turno, estados, idempotencia, single-flight, detección de fin, recuperación, timeout/cancelación y reconexión de la vista SSE.

### Modified Capabilities

- `agent-chat-experience`: estados de UI para turnos largos y reconectados; la respuesta final recuperada no se muestra como error terminal; el historial incluye el turno activo y las acciones de cancelar/reintentar.
- `project-isolation`: el chat largo de proyecto deja de ser un request de 15 minutos; pasa a ser un turno durable con alcance de proyecto, timeout que interrumpe y recuperación sin mezclar hilos entre proyectos.
- `global-orchestrator`: los turnos del orquestador usan el mismo ciclo durable, conservan su política de respuesta vacía solo por ser de solo lectura y no exponen datos de proyectos fuera de su alcance.
- `omnichannel-and-chat-gateway`: los turnos de agente por canal y el gateway de chat externo se ejecutan como turnos durables; la respuesta se entrega al completarse y los reintentos no duplican mensajes.
- `observability-and-testing-harness`: métricas, logs, errores y pruebas de regresión para turnos largos, desconexión, reinicio, duplicados, timeout y recuperación en todas las superficies.

## Impact

- **Persistencia**: nueva tabla `chat_turns` y columna nullable `chat_messages.turn_id`; migración aditiva con backup previo. No se reescriben mensajes históricos.
- **Servidor**: `ChatTurnService`, supervisor de eventos/estado, recuperación al arranque, `ChatWithProjectUseCase`, `ChatWithOrchestratorUseCase`, `SendExternalChatMessageUseCase`, `RouteProjectIntegrationMessageUseCase`, `app.ts`, `AgentRuntimePort` y `OpenCodeV2Adapter`.
- **API**: nuevos endpoints de estado/eventos de turno; `POST /chat` sigue funcionando como fachada SSE/JSON; eventos `turn`, `status`, `done`, `error` con `turnId`.
- **Web**: hook de turno, `ChatPanel`, `ProjectPage`, `OrchestratorPage`, historial con estado del turno y reconexión; `SseHub` publica `chat.turn.updated`.
- **Configuración**: máximo/inactividad del turno, timeouts de OpenCode/provider/bash y feature flag de despliegue; documentación en README y `.env.example`.
- **Dependencias**: OpenCode 2.2.5 (API experimental de log de sesión); se mantiene el cliente actual y se añade reconexión. Coordinar con `add-reliable-automation-actions` (`session_context`, timeout/interrupt de nodos) y con la política de respuesta vacía de `fix-orchestrator-tool-turns`.
- **Fuera de alcance**: corregir el versionado cuando el agente escribe `workflow.json` directamente, conectar/validar la integración de Telegram, separar hilos web por usuario, escalado horizontal con leases y optimización de la latencia del modelo. Se tratarán en cambios posteriores.
