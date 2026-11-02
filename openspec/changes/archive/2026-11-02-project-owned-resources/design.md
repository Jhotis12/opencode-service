# Design

## Context

Ver `proposal.md - Why` para la motivación. El estado actual relevante es:

- Monorepo Bun + Hono con arquitectura hexagonal, React + Vite + React Flow, SQLite WAL con Drizzle y OpenCode V2 como runtime de agentes.
- `workflow.json`, `nodes/*.ts` y `.opencode/agents/**` ya viven por proyecto; `channels`, `external_databases`, notebooks y secretos viven en el ámbito global.
- El ruteo de canales recorre todos los proyectos y elige el primer trigger público, sin pertenencia explícita.
- El chat del proyecto usa el agente por defecto de OpenCode, sin `default_agent`, `AGENTS.md` ni perfil primario.
- El lanzamiento manual envía un payload fijo y el endpoint espera a que termine toda la ejecución.
- El cambio anterior `hexagonal-agentic-platform` ya fue archivado y sus specs están en `openspec/specs/`.

Restricciones que guían el diseño: despliegue de un contenedor con SQLite, aislamiento por proyecto, secretos cifrados, ausencia de capa legacy, y necesidad de admitir email y nuevas integraciones sin duplicar el modelo.

## Goals / Non-Goals

**Goals:**

- Convertir el proyecto en la unidad de propiedad de integraciones, secretos, conocimiento y ajustes.
- Separar el plano de proyecto del plano de control global con autorización distinta.
- Unificar canales, bases de datos y futuras integraciones bajo un contrato estable y tipado.
- Hacer determinista el ruteo y validar las referencias antes de ejecutar.
- Dar al lanzamiento manual un contrato de entrada, procedencia y trazabilidad.
- Entregar un agente principal por proyecto y una experiencia de chat legible.
- Preparar email como un `kind` de integración futuro, sin cambiar el núcleo.
- Eliminar el modelo anterior sin mantener endpoints, tablas ni adapters de compatibilidad.

**Non-Goals:**

- Implementar email (SMTP/IMAP) en este cambio; solo se deja el contrato y la extensión.
- Multi-tenant SaaS, roles avanzados o facturación; el producto sigue siendo single-tenant autohospedado con administrador.
- Múltiples workflows por proyecto; se asume un caso de uso con un flujo principal y se deja la puerta abierta a subflujos.
- Exportación/importación portable del proyecto como manifiesto; se implementa `project_slug` en base y se difiere el manifiesto.
- Que el orquestador global modifique proyectos por defecto; su autoridad inicial es de lectura y reporte.
- Streaming token por token del chat; se implementa renderizado, estados y superficie, y el streaming fino queda como mejora posterior.
- Programación cron y webhooks ejecutables; sus tipos existen en el esquema pero se rechazan hasta tener scheduler y endpoint reales.
- Drag-and-drop desde la paleta; la primera iteración agrega nodos con clic.

## Decisions

### 1. Propiedad de recursos en base con `project_slug`, no manifiesto en disco

**Decisión:** Las integraciones, secretos y notebooks se almacenan en SQLite con `project_slug`; el workspace del proyecto conserva `workflow.json`, `nodes/`, `.opencode/agents/`, `AGENTS.md` y `knowledge/`.

**Por qué:** El estado runtime (estado de conexión, QR, latencia, sesiones) ya vive en base. Un manifiesto `project.json` obligaría a reconciliar archivo y base, resolver conflictos y mantener dos fuentes de verdad. La propiedad lógica se resuelve con `project_slug` y la UI del proyecto; el conocimiento sí queda físicamente dentro del workspace.

**Alternativas consideradas:**

- *Manifiesto `project.json` como fuente de verdad:* mejor portabilidad y edición por el agente, pero más reconciliación y riesgo de deriva. Se difiere como formato de exportación/importación.
- *Tabla de asignaciones `project_resources` para compartir recursos:* útil si un canal o notebook se comparte, pero añade joins y ambigüedad. No se necesita para el caso de uso actual.

### 2. Una entidad `Integration` con scope, kind y capabilities

**Decisión:** Reemplazar `channels` y `external_databases` por `integrations` con:

```text
id            UUID estable
scope         project | global
project_slug  null para global
kind          telegram | whatsapp | external_chat | email | postgres | mysql | mssql | sqlite | http
name          nombre visible
slug          identificador de display
config        JSON validado por kind (sin secretos)
secret_refs   mapa de campos a alias de bóveda
capabilities  inbound_message, outbound_message, send_email, read_email, query
status        connected | disconnected | needs_config | qr_pending | error
```

**Por qué:** Email, bases de datos y canales comparten problemas de credenciales, estado, test y ciclo de vida. Un modelo único evita una tabla nueva por integración y permite que la UI renderice formularios por `kind`. Los nodos referencian `id`, no `slug`.

**Alternativas consideradas:**

- *Tablas separadas por tipo:* consultas más tipadas, pero duplica CRUD, estado, secretos y UI; email exigiría otra tabla.
- *Un JSON genérico sin `kind` ni validación:* flexible pero inseguro; se perdería validación en el borde.

### 3. IDs estables y validación de referencias en guardado y ejecución

**Decisión:** `trigger.integrationId`, `agent.agentId`, `agent.notebookIds`, `code.ctx.db(integrationId)` y `code.ctx.notify(integrationId)` usan identificadores estables. Al guardar se valida existencia y pertenencia; al ejecutar se vuelve a validar antes del primer paso.

**Por qué:** Hoy un `channelSlug` o `agentId` es texto libre; renombrar o borrar un recurso rompe el flujo a mitad de ejecución. La validación temprana convierte un fallo difuso en un error claro y accionable.

**Alternativas consideradas:**

- *Mantener slugs y resolver por nombre:* más legible en JSON, pero frágil y ambiguo entre proyectos.
- *Validar solo en runtime:* menos trabajo al guardar, pero el usuario descubre el problema después de lanzar.

### 4. Dos planos con autorización separada

**Decisión:** El plano de proyecto usa `/data/workspaces/<slug>/` y un scope de proyecto obligatorio. El plano de control usa `/data/control/`, un agente propio y un credential/claim global. Las herramientas de proyecto nunca ven datos de otro proyecto; las globales son de solo lectura por defecto.

**Por qué:** El modelo actual permite omitir `x-platform-project` y obtener una vista global. Con un orquestador real, esa ambigüedad es una escalada de privilegios. La separación también evita que un canal de proyecto termine hablando con el orquestador global.

**Alternativas consideradas:**

- *Un solo agente con permisos condicionales:* menos componentes, pero mezcla contextos y hace difícil auditar.
- *Permitir que el orquestador edite proyectos:* más potente, pero peligroso; se pospone con confirmación explícita.

### 5. Ruteo determinista por integración

**Decisión:** Cada integración pertenece a un proyecto o al plano global. El `IntegrationManager` inicia adapters por integración y el router resuelve el proyecto por la integración. Los canales de proyecto tienen modos `agent`, `workflow` o `hybrid`; el modo `workflow` exige un único trigger por `(proyecto, integración, evento)`.

**Por qué:** Elimina el escaneo O(n) por mensaje y la ambigüedad de que dos proyectos declaren el mismo canal. Además permite conversación directa con el agente del proyecto, que hoy no existe en Telegram/WhatsApp.

**Alternativas consideradas:**

- *Mantener el escaneo global y desempatar por configuración:* más simple de migrar, pero el destino sigue siendo implícito.
- *Un canal global compartido con bindings:* se puede añadir después con una tabla de asignaciones; no se necesita ahora.

### 6. Hilos de chat unificados

**Decisión:** Sustituir `projects.chat_session_id` y el historial atado solo a `projectSlug` por `chat_threads` y `chat_messages`:

```text
chat_threads
  id, scope (project|global), project_slug nullable,
  integration_id nullable, external_thread_id nullable,
  opencode_session_id, title, created_at, last_active_at
```

**Por qué:** El chat de proyecto, el chat del orquestador y las conversaciones de canales comparten la misma necesidad de historial y sesión. Un solo modelo evita tres implementaciones y facilita el mapeo `externalThreadId <-> thread`.

**Alternativas consideradas:**

- *Mantener una tabla de mensajes por scope:* más simple a corto plazo, pero duplica la lógica de historial y de sesión.

### 7. Orquestador global separado y alertas deterministas

**Decisión:** `/data/control` contiene `AGENTS.md`, `.opencode/agents/orchestrator/agente.md` y `opencode.jsonc`. El orquestador usa herramientas `platform_*` de solo lectura para proyectos, runs, errores, salud y conocimiento. Las alertas de fallo se envían con plantillas deterministas a canales globales suscritos, con deduplicación y throttle. El LLM no está en el camino crítico de la alerta.

**Por qué:** Un agente con acceso a todos los proyectos debe ser auditable y de mínimo privilegio. Las alertas no pueden depender de la latencia, costo o fallo de un modelo. El usuario puede preguntar después y el orquestador consulta datos reales.

**Alternativas consideradas:**

- *Todo el reporting pasa por el LLM:* respuestas más naturales, pero caro, lento y frágil.
- *Acceso directo del orquestador a los archivos de todos los proyectos:* potente, pero difícil de auditar y con riesgo de fuga de secretos/PII.

### 8. Conocimiento dentro del proyecto

**Decisión:** `notebooks.project_slug NOT NULL`, unicidad `(project_slug, slug)`, archivos en `/data/workspaces/<slug>/knowledge/<notebook>/`. La búsqueda de proyecto solo ve sus notebooks; el orquestador global puede buscar cross-project en modo lectura con citas que incluyen el proyecto.

**Por qué:** El usuario pidió que el banco de información viva dentro de cada proyecto. Esto también simplifica borrado, backup y exportación futura del workspace.

**Alternativas consideradas:**

- *Mantener notebooks globales y asignarlos por proyecto:* permite compartir, pero no cumple “cada proyecto contiene sus recursos” y complica el aislamiento.

### 9. Bóveda con scope de proyecto

**Decisión:** `vault_secrets` incorpora `scope` y `project_slug`; unicidad por `(scope, project_slug, alias)`. Los secretos globales quedan solo para proveedor, Sentry y orquestador. La resolución es siempre en el proceso servidor; los workers reciben resultados, no credenciales.

**Por qué:** Hoy cualquier proyecto puede resolver cualquier alias global. Con integraciones por proyecto, un alias debe pertenecer a un scope y no debe poder resolverse desde otro. Los workers no deben recibir secretos en texto plano.

**Alternativas consideradas:**

- *Prefijar el alias con el slug (`ventas:telegram_token`):* simple, pero fácil de falsificar si la validación es solo textual. El scope explícito es más seguro.

### 10. Contrato de ejecución manual y nodo `validate`

**Decisión:** El trigger declara `inputSchema` con campos, tipo, requerido, descripción y ejemplo. La API y el executor validan el payload antes de crear pasos. El run se crea con `launchedBy`, `graphHash`, `integrationId` y se devuelve `202 { runId }` antes de completar. Se agrega un nodo `validate` reutilizando las mismas reglas para chequeos en cualquier punto.

**Por qué:** El caso `tema` demuestra que el lanzamiento manual necesita documentación y validación, no solo un botón. Validar antes de ejecutar evita runs a medias; la procedencia permite auditar quién lanzó y desde dónde. El nodo `validate` cubre entradas que no pasan por el formulario y chequeos posteriores a una transformación.

**Alternativas consideradas:**

- *Solo un nodo `validate` y sin `inputSchema`:* cubre runtime, pero no documenta ni genera el formulario de lanzamiento.
- *Solo validación en el frontend:* no protege canales, API ni llamadas del agente.

### 11. Agente principal por proyecto y contrato de comunicación

**Decisión:** Cada proyecto tiene `.opencode/agents/principal/agente.md` con `mode: primary`, `opencode.jsonc` con `default_agent`, y `AGENTS.md` con contexto del proyecto. El prompt del agente principal exige lenguaje de negocio, resumen primero, tablas compactas y confirmación antes de acciones destructivas. El chat renderiza GFM y tiene estados acoplado/expandido/minimizado.

**Por qué:** El agente por defecto de OpenCode es un agente de código y habla de archivos. El chat actual es texto plano y no interpreta tablas. Ambos problemas se resuelven en capas distintas: prompt para el contenido, renderer para la presentación, superficie para el espacio.

**Alternativas consideradas:**

- *Solo cambiar el system prompt global:* no permite personalizar por proyecto ni editar desde la UI.
- *Solo mejorar el renderer:* las tablas se verían, pero el agente seguiría hablando de rutas internas.

### 12. Email como extensión del contrato de integración

**Decisión:** No se implementa email en este cambio. El contrato `Integration` admite `kind: "email"` con `capabilities: ["send_email", "read_email"]`, configuración SMTP/IMAP validada, secretos separados y contenido entrante tratado como no confiable. En el futuro, `email.send` será una acción y `email.received` un evento de trigger.

**Por qué:** El usuario lo necesita más adelante y no queremos crear otra tabla o un modelo paralelo entonces. Dejar el contrato listo ahora evita un segundo refactor.

**Alternativas consideradas:**

- *Implementar email ahora:* aumenta el alcance y el riesgo de este cambio; se pospone.
- *Modelar email como canal genérico sin capacidades:* no distingue envío, lectura y adjuntos; el contrato de capabilities es más claro.

### 13. API tipada y consistente

**Decisión:** Endpoints scoped por proyecto (`/api/projects/:slug/integrations`, `/notebooks`, `/secrets`, `/settings`) y de control (`/api/control/integrations`, `/chat`, `/alerts`, `/overview`). Errores con `{ error: { code, message, details? } }`; listas paginadas; IDs estables; ejecución idempotente. La API externa usa `POST /api/v1/integrations/:integrationId/messages`.

**Por qué:** Un contrato predecible reduce errores de UI y plugin, y permite que el proyecto y el orquestador compartan tipos sin compartir permisos.

**Alternativas consideradas:**

- *Un endpoint genérico `/resources` para todo:* menos rutas, pero pierde validación y acciones específicas por tipo.
- *Mantener `/api/v1/channels/:channelSlug/messages`:* acopla la API pública a un slug renombrable y no distingue scope.

### 14. Observabilidad y pruebas desde el diseño

**Decisión:** Cada evento de integración, run, alerta y acceso cross-project lleva `requestId`, `entryPoint`, `projectSlug`, `integrationId` y `runId` cuando aplica. Las alertas se deduplican y se throttlean; los tests cubren unidad, integración, contratos, E2E, aislamiento y migración.

**Por qué:** Un refactor de este tamaño sin telemetría y pruebas de aislamiento es imposible de operar. Las alertas necesitan métricas para no convertirse en ruido.

**Alternativas consideradas:**

- *Agregar observabilidad después:* se pierde la capacidad de diagnosticar la migración y los primeros fallos de integración.

## Data Model Sketch

```text
projects
  id, slug, name, description, default_model, primary_agent, created_at, updated_at

integrations
  id, scope, project_slug, kind, name, slug,
  config, secret_refs, capabilities, status,
  last_error, created_at, updated_at
  unique (scope, project_slug, slug)

vault_secrets
  id, scope, project_slug, alias, kind, ciphertext, metadata, created_at
  unique (scope, project_slug, alias)

notebooks
  id, project_slug, slug, name, description, created_at
  unique (project_slug, slug)

kb_sources, kb_chunks
  ... via notebook_id

chat_threads
  id, scope, project_slug, integration_id, external_thread_id,
  opencode_session_id, title, created_at, last_active_at
  unique (scope, project_slug, integration_id, external_thread_id)

chat_messages
  id, thread_id, role, content, created_at

workflow_runs
  ... + launched_by, graph_hash, integration_id, source_detail

workflow_step_runs, workflow_approvals
  ... unchanged plus scope through run
```

`channels`, `external_databases`, `projects.chat_session_id` y el uso global de notebooks se eliminan.

## Follow-up Decisions

### 15. Persistir el estado de OpenCode y recuperar sesiones huérfanas

**Decisión:** OpenCode usa `OPENCODE_DB=/data/opencode/opencode.db` y `XDG_STATE_HOME=/data/opencode/state`; si una sesión persistida ya no existe, el chat crea una nueva sobre el mismo hilo y reintenta el turno una vez.

**Por qué:** las sesiones vivían en el home efímero del contenedor. Al reiniciar, la plataforma conservaba el `opencodeSessionId` pero OpenCode no. La recuperación centralizada (`ensureChatSession`/`promptWithSessionRecovery`) evita borrar historial o pedir al usuario que cree otro proyecto.

**Alternativas:** borrar todos los hilos al arrancar (pierde historial); consultar si la sesión existe antes de cada mensaje (llamada extra en el camino caliente).

### 16. Restaurar credenciales de proveedor al arrancar

**Decisión:** al iniciar, la plataforma lee los secretos globales `provider:*` de la bóveda y los vuelve a registrar con OpenCode.

**Por qué:** la bóveda de la plataforma sí persistía, pero el estado interno de OpenCode no siempre. Re-registrar la key evita que el usuario tenga que volver a pegarla en cada reinicio.

### 17. Ciclo de vida y borrado en cascada del proyecto

**Decisión:** la creación incluye nombre, slug automático y descripción. El borrado es solo para administrador autenticado, exige escribir el slug y elimina en una transacción el workspace y los datos project-owned; primero detiene las integraciones del proyecto.

**Por qué:** borrar solo la fila del proyecto dejaría archivos, runs, chats, secretos y conocimiento huérfanos. La confirmación tipada evita una acción destructiva accidental.

### 18. Canvas con paleta lateral, inspector inferior y chat en drawer

**Decisión:** la paleta se agrupa por categoría a la izquierda, el inspector del nodo aparece debajo del canvas a todo el ancho y el chat se abre como drawer desde la cabecera.

**Por qué:** el panel derecho reducía el canvas y el inspector competía con el chat. El inspector inferior muestra configuración y última ejecución sin ocultar el grafo; el drawer libera el ancho y conserva el chat cuando se necesita.

### 19. Un único trigger ejecutable

**Decisión:** cada workflow tiene exactamente un trigger. `schedule` y `webhook` se rechazan hasta que exista un ejecutor real; la UI los muestra deshabilitados.

**Por qué:** el motor solo arrancaba desde el primer trigger y los tipos sin ejecutor se guardaban pero nunca corrían. La restricción convierte una promesa falsa en un error de validación claro.

## Risks / Trade-offs

- **[Riesgo] Refactor grande y big-bang** → **Mitigación:** slices verticales con checkpoints, migración probada, backup de base y workspaces, y eliminación del modelo viejo en el mismo corte solo después de verificar.
- **[Riesgo] El orquestador global es demasiado poderoso** → **Mitigación:** credencial global separada, solo lectura por defecto, sin shell/edición, allowlist y auditoría de cada acceso.
- **[Riesgo] Prompt injection desde Telegram, WhatsApp, email o conocimiento** → **Mitigación:** el contenido entrante es dato, no instrucción; permisos en código; herramientas mutantes requieren confirmación; email se tratará como input no confiable.
- **[Riesgo] Fuga de secretos en logs, workers o LLM** → **Mitigación:** bóveda project-scoped, resolución server-side, redacción en logger/Sentry, y tests que verifican que el worker no recibe credenciales.
- **[Riesgo] Fatiga de alertas** → **Mitigación:** plantilla determinista, deduplicación por run, throttle por proyecto/tipo, horario de silencio y métricas de alertas suprimidas.
- **[Riesgo] Muchas integraciones en un solo proceso** → **Mitigación:** registro con arranque lazy, health checks, backoff/reconexión por integración y aislamiento de fallos.
- **[Riesgo] Migración de datos sin dueño claro** → **Mitigación:** no adivinar; un mapa explícito de recursos existentes a proyectos/global, backup previo y tests de migración.
- **[Riesgo] Sesiones OpenCode existentes conservan el agente anterior** → **Mitigación:** `switchAgent` o nueva sesión con el agente principal, conservando el historial.
- **[Riesgo] SQLite con múltiples adapters y alertas** → **Mitigación:** mantener el proceso único, WAL, operaciones cortas y colas/eventos internos; no introducir workers de base concurrentes.
- **[Riesgo] Email futuro con requisitos distintos** → **Mitigación:** contrato de capabilities y adapters; no se promete implementación en este cambio.
- **[Riesgo] Borrado accidental de un proyecto** → **Mitigación:** solo administrador autenticado, confirmación escribiendo el slug, detención de integraciones y transacción de borrado; no hay borrado suave silencioso.
- **[Riesgo] Migración a la base persistente de OpenCode** → **Mitigación:** reiniciar el servicio una vez, usar `OPENCODE_DB` explícito y recuperar sesiones huérfanas en el siguiente turno.
- **[Riesgo] Dependencia de una sola base de OpenCode en `/data`** → **Mitigación:** backup del volumen junto con la base de la plataforma y documentación del reinicio del servicio.

## Migration Plan

**Supuesto:** no hay datos de producción que preservar; si los hay, se aplica el mismo plan con un mapeo explícito y backup.

1. **Preparación:** backup de `/data/db/platform.sqlite`, `/data/workspaces/`, `/data/knowledge/` y `/data/master.key`; verificar que el backup se puede restaurar.
2. **Esquema expandido:** crear `integrations`, `chat_threads`, columnas `project_slug` en `notebooks`/`vault_secrets`, columnas de procedencia en `workflow_runs` y `scope` donde corresponda.
3. **Migración de datos existente (si aplica):**
   - Convertir `channels` en `integrations` globales o de proyecto según un mapa explícito; los canales de administrador sin proyecto se convierten en globales del orquestador.
   - Convertir `external_databases` en integrations de proyecto o globales según el mapa.
   - Asignar cada notebook a un proyecto; si no tiene dueño identificable, no adivinar: se deja en cuarentena o se reporta para asignación manual.
   - Convertir `chat_messages` y `projects.chat_session_id` en `chat_threads`/`chat_messages` de scope proyecto.
4. **Corte de código:** desplegar el nuevo dominio, adapters, endpoints y UI; eliminar `channels`, `external_databases`, endpoints globales y páginas globales de notebooks.
5. **Verificación:** ejecutar tests de migración, aislamiento, ruteo, validación de input, alertas y E2E; comprobar que no quedan referencias al modelo viejo.
6. **OpenCode persistente:** en el primer arranque con la nueva versión, `OPENCODE_DB` apunta a `/data/opencode/opencode.db`; las sesiones antiguas se recuperan en el siguiente turno y las API keys de proveedor se re-registran desde la bóveda.
7. **Rollback:** restaurar la base, los workspaces y `/data/opencode` desde el backup y desplegar la imagen anterior. Como el corte elimina tablas, el rollback depende del backup, no de una migración inversa.

**Sin capa legacy:** no se mantienen endpoints antiguos, tablas puente ni adapters de compatibilidad. El código viejo, sus tests y su documentación se eliminan en el mismo cambio.

## Open Questions

- ¿La carpeta del proyecto debe ser exportable/importable en el futuro? Si sí, se añadirá un manifiesto `project.json` como formato de exportación sobre este modelo, sin cambiar el runtime.
- ¿El orquestador global deberá ejecutar acciones en proyectos (por ejemplo, relanzar un flujo) o permanecerá de solo lectura? El diseño actual lo deja read-only con confirmación explícita como extensión.
- ¿Un proyecto necesitará varios workflows además del flujo principal? El modelo actual asume uno; si se requiere, se añadirá `workflows` como subrecurso del proyecto.
- ¿Email se implementará primero como notificación saliente, como bandeja entrante o ambos? El contrato de capabilities ya admite ambos.
