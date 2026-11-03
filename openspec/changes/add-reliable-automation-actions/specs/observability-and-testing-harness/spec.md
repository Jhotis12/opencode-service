# Spec Delta

## ADDED Requirements

### Requirement: Automation delivery, schedule, and approval telemetry
El sistema SHALL emitir eventos estructurados y métricas acotadas para entregas de notificación, evaluación de schedules, aprobaciones y decisiones de cola o rate limit, con `projectSlug`, `runId`, `nodeId`, `integrationId` y resultado cuando apliquen, sin registrar cuerpos de mensajes, destinatarios completos ni secretos.

#### Scenario: Entrega exitosa
- **WHEN** un nodo `notify` o la tool `notify` entrega un mensaje
- **THEN** el sistema registra un evento `delivery.succeeded` con proyecto, run, nodo, integración, latencia y resultado, sin el texto del mensaje

#### Scenario: Entrega fallida
- **WHEN** una entrega falla después de los reintentos configurados
- **THEN** el sistema registra `delivery.failed` con un error sanitizado y lo asocia al run y nodo

#### Scenario: Evaluación de schedule
- **WHEN** el scheduler evalúa una ventana
- **THEN** registra si disparó, omitió por solapamiento, omitió por schedule desactivado o recuperó una ventana perdida

#### Scenario: Decisión de aprobación
- **WHEN** una aprobación se solicita, aprueba, rechaza o rechaza por falta de autorización
- **THEN** el sistema registra el evento con proyecto, run, nodo, actor y decisión, sin datos personales innecesarios

#### Scenario: Cola y rate limit
- **WHEN** un run se encola, se despacha o una notificación espera por rate limit
- **THEN** el sistema registra el motivo, la posición o la espera estimada sin descartar el trabajo

#### Scenario: Sin datos sensibles
- **WHEN** se emite cualquier evento de automatización
- **THEN** el logger redacta secretos, tokens, SQL completo, cuerpos de mensajes y destinatarios completos

### Requirement: Automation operations view
El sistema SHALL mostrar en el panel de salud y en el detalle del proyecto la próxima ejecución de cada schedule, las entregas recientes con su estado, la profundidad de la cola y las aprobaciones pendientes, filtrables por proyecto.

#### Scenario: Próxima ejecución visible en salud
- **WHEN** un administrador abre el panel de salud
- **THEN** ve la próxima ejecución de cada schedule activo, su timezone y si está habilitado

#### Scenario: Entregas fallidas visibles
- **WHEN** una notificación falla y agota reintentos
- **THEN** el panel muestra el proyecto, run, nodo, integración y error sanitizado con navegación al run

#### Scenario: Cola y aprobaciones pendientes
- **WHEN** hay runs en cola o aprobaciones pendientes
- **THEN** el panel muestra sus conteos y permite abrir el proyecto o el run correspondiente

#### Scenario: Filtro por proyecto
- **WHEN** el administrador filtra por un proyecto
- **THEN** solo ve schedules, entregas, cola y aprobaciones de ese proyecto

### Requirement: Automation regression coverage
La suite automatizada SHALL cubrir los nodos de acción nativos, la política de timeout/reintento/error, el schedule con timezone/catch-up/overlap, las aprobaciones operables, la entrega con destinatario y deduplicación, el contexto y los permisos del agente, los secretos HTTP, los timers durables, los lotes/subworkflows y los límites de concurrencia y rate limit.

#### Scenario: Cobertura P0
- **WHEN** se ejecuta la suite de la fase P0
- **THEN** verifica nodos `notify` y `database`, reintentos y ruta de error, timezone/catch-up/overlap, aprobación por UI y por canal, y deduplicación de entregas

#### Scenario: Cobertura P1
- **WHEN** se ejecuta la suite de la fase P1
- **THEN** verifica política de acceso a DB, propagación de agente/contexto, secretos HTTP, timers durables, `foreach`/subworkflow y cola/rate limit

#### Scenario: E2E de automatización programada
- **WHEN** se ejecuta el escenario E2E de un schedule con un nodo `notify`
- **THEN** el mensaje llega al canal de prueba, el run queda `succeeded` y la entrega aparece en el panel

#### Scenario: E2E de escritura con aprobación
- **WHEN** se ejecuta el escenario E2E de un webhook o agente que escribe en DB después de una aprobación
- **THEN** la escritura ocurre una sola vez, queda asociada al run y el rechazo no deja cambios

#### Scenario: Regresión de secretos
- **WHEN** la suite inspecciona workflows, snapshots, logs y respuestas de tools
- **THEN** no encuentra valores de secretos ni tokens en claro y falla si aparece uno

#### Scenario: Regresión de aislamiento y permisos
- **WHEN** un agente de workflow o un proyecto intenta usar una integración, secreto o tool fuera de su scope
- **THEN** la suite verifica el rechazo y el registro de auditoría correspondiente
