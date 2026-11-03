# Proposal

## Why

La plataforma ya ejecuta grafos con checkpoints, snapshots inmutables, idempotencia de disparo, replay y recuperación al reiniciar. Pero una automatización real de negocio todavía obliga a escribir nodos `code` o a pedirle a un `agent` que invoque tools para las dos acciones más comunes: enviar un mensaje y modificar una base de datos.

Eso deja los casos de uso centrales en estado de piloto: no hay nodo nativo de Notificar ni de Base de datos; el scheduler no tiene timezone, catch-up ni política de solapamiento; una aprobación manual o programada no se puede resolver desde la aplicación; los reintentos solo cubren `code`; y las acciones del agente no tienen contexto de ejecución ni auditoría de entrega. La propuesta se entrega en dos fases: P0 primero, validación explícita del usuario y después P1.

## What Changes

### Fase 1 — P0

- **Nodo `notify` nativo**: integración de salida, destinatario, plantilla de mensaje y resultado de entrega. Extiende `ctx.notify` para aceptar destinatario y deja de depender de que un agente decida llamar una tool.
- **Nodo `database` nativo**: integración, operación `query`/`execute`, SQL parametrizado, modo lectura/escritura, transacción opcional y mapeo de resultado. `code` con `ctx.db` queda como escape hatch para lógica compleja.
- **Política de error uniforme**: reintentos con backoff para `agent` y `http`, timeout efectivo del nodo `agent`, rama de error (`error edge`), estado de dead letter y alineación entre lo que ofrece el inspector y lo que ejecuta el motor.
- **Aprobaciones operables**: endpoint y UI para aprobar o rechazar, notificación de aprobación para runs manuales y programados, y `autoApprove` aplicado por el executor.
- **Política de schedule**: timezone IANA, activar/desactivar, próxima ejecución visible, catch-up configurable y política de solapamiento (`skip` por defecto).
- **Superficie de edición**: nuevos nodos en la paleta, inspector con configuración de DB/Notify, campos de schedule y aprobación, y representación de la rama de error.

### Fase 2 — P1

- **Seguridad de base de datos**: modo `read`/`write` por integración, límite de filas, transacciones multi-sentencia, bloqueo de DDL por defecto y auditoría de operaciones destructivas.
- **Gobierno del agente**: propagar agente y contexto de ejecución desde el plugin, hacer efectivas las reglas `deny` de `db_query`/`notify`/`workflow_trigger`, y exponer descubrimiento de integraciones del proyecto.
- **Secretos en HTTP**: referencias a la bóveda para headers/campos sensibles y `baseUrl` desde una integración HTTP, sin persistir tokens en `workflow.json` ni en snapshots.
- **Timers durables y lotes**: esperas de días, trigger de fecha única (`once`), `foreach` y subworkflows.
- **Operación**: límite de concurrencia por proyecto, rate limit de salida, log de entregas, próxima ejecución y alertas por proyecto además de las globales.

### Fuera de alcance

- Adaptador de email. El contrato de integración existe, pero el transporte queda para un cambio posterior; el nodo `notify` cubre los canales que ya tienen egress activo.
- CDC o trigger nativo por cambio de fila en una base de datos. P1 puede resolver polling programado, pero no captura de cambios.
- Reemplazo del runtime de OpenCode, del motor de workers o del almacenamiento SQLite.
- Rediseño general del canvas o del sistema visual.
- Cambios de comportamiento para workflows existentes: los campos nuevos son opcionales y conservan los valores por defecto actuales.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workflow-and-workspace-engine`: nodos de acción nativos (`notify`, `database`), ejecución con política de error, schedule con timezone/catch-up/overlap, aprobaciones operables, timers durables, lotes/subworkflows y concurrencia.
- `project-resources`: referencias a secretos en acciones HTTP y gobierno de acceso/DDL de integraciones de base de datos.
- `multi-agent-catalog`: propagación de agente/sesión y enforcement real de permisos de tools, más descubrimiento de integraciones del proyecto.
- `omnichannel-and-chat-gateway`: entrega saliente confiable con destinatario y registro de entrega, y notificación de aprobaciones para runs manuales/programados.
- `observability-and-testing-harness`: telemetría de entregas, schedules, próximas ejecuciones y alertas por proyecto; cobertura de regresión de las nuevas acciones y del gate P0/P1.

## Impact

- **Contratos compartidos**: `NodeTypeSchema` agrega `notify` y `database`; `TriggerConfig` agrega `timezone`, `enabled`, `overlapPolicy`, `catchUp`; `NodeSpec` agrega política de error; `retryPolicy` agrega backoff opcional.
- **Motor**: `execute-workflow.ts` ejecuta los nuevos nodos, aplica retry/timeout a todos los tipos, resuelve ramas de error y aprueba/reanuda runs; `cron.ts` pasa a un scheduler con estado persistido y timezone.
- **Persistencia**: nuevas tablas para estado de schedule, entregas, timers y mapeo de sesión/contexto; la cola de runs y el log de entregas se completan en P1.
- **API/UI**: endpoints de aprobación y de próxima ejecución; inspector de nodos, paleta, formulario de schedule, aprobaciones y detalle de entregas.
- **Plugin**: `packages/opencode-plugin` usa el contexto de la tool (`agent`, `sessionID`) para enviar headers de agente/contexto y aplica permisos por agente; agrega descubrimiento de integraciones.
- **Canales**: el egress recibe destinatario y devuelve un identificador de entrega cuando el proveedor lo permite; se registra el intento y su resultado.
- **Tests**: dominio, ejecución, scheduler, canales, plugin, API, UI y E2E para las dos fases; la suite de P1 no se completa hasta que P0 pase la validación del usuario.
- **Dependencias**: ninguna nueva. Timezone se resuelve con `Intl`; las integraciones de DB ya existen.
