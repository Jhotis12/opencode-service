# Agentic Platform

Plataforma de automatizaciones agénticas sobre **OpenCode V2**: cada proyecto es un caso de uso autocontenido con su workflow, agentes, integraciones, secretos y bancos de información. Un **orquestador global** separado consulta todos los proyectos y reporta fallos por los canales configurados en Ajustes.

Construida con **Bun + Hono** (arquitectura hexagonal), **React + Vite** (React Flow + Monaco) y **SQLite WAL**, empaquetada para Docker/EasyPanel.

## Inicio rápido (Docker)

```bash
docker compose up --build -d
```

Abre `http://localhost:3001` (el contenedor escucha en `3000`; el host usa `3001` para no chocar con Supabase/Next). Si `3001` también está ocupado: `HOST_PORT=3002 docker compose up -d`.

- Usuario inicial: `admin`
- Contraseña inicial: `admin123!` (o `INITIAL_ADMIN_PASSWORD`)
- En el primer ingreso la app obliga a cambiarla (mínimo 12 caracteres).
- Todos los datos viven en el volumen `platform-data` montado en `/data`:
  `db/`, `workspaces/`, `knowledge/`, `channels/`, `opencode/`, `control/`, `master.key`.
- Las sesiones y credenciales de OpenCode se guardan en `/data/opencode/opencode.db`
  (`OPENCODE_DB`) para que sobrevivan reinicios del contenedor.

### Variables relevantes

| Variable | Uso |
|---|---|
| `INITIAL_ADMIN_PASSWORD` | Contraseña inicial del administrador. |
| `SENTRY_DSN` | Sentry / GlitchTip. También se puede guardar desde Ajustes; se aplica en el siguiente arranque. |
| `SESSION_TTL_HOURS` | Vigencia de la sesión web en horas (168 por defecto). |
| `OPENCODE_BASE_URL` / `OPENCODE_SERVICE_FILE` | Conexión a un servicio OpenCode externo cuando `OPENCODE_MODE=service`. |
| `EMBEDDINGS_URL` / `EMBEDDINGS_API_KEY` | Embeddings para búsqueda híbrida. |
| `PLATFORM_SERVICE_TOKEN` | Token de llamadas con scope de proyecto. |
| `PLATFORM_GLOBAL_TOKEN` | Token del plano de control (orquestador global). |
| `AGENT_CHAT_TIMEOUT_MS` | Compatibilidad: timeout del chat (15 min por defecto). |
| `AGENT_TURN_MAX_MS` | Duración máxima de un turno durable (30 min por defecto). |
| `AGENT_TURN_IDLE_MS` | Inactividad máxima antes de interrumpir un turno (10 min por defecto). |
| `AGENT_TURN_POLL_MS` / `AGENT_TURN_RETRY_MS` | Intervalo de polling y reintento de transporte del turno. |
| `CHAT_TURN_ENGINE` | `v2` para el ciclo durable; `legacy` conserva la ruta anterior durante el rollout. |
| `ORCHESTRATOR_MODEL` | Modelo del orquestador global; Ajustes puede sobrescribirlo en base y, si ambos faltan, usa el modelo por defecto de la plataforma (DeepSeek V4.1 Flash). |
| `DEFAULT_MODEL` | Modelo por defecto de plataforma y orquestador al sembrar una instalación nueva (`opencode/deepseek-v4.1-flash-free`). Un valor guardado en Ajustes tiene prioridad y nunca se sobrescribe. |
| `OPENCODE_MODE=fake` | Runtime simulado para desarrollo y E2E. |

El modelo por defecto de la plataforma es **DeepSeek V4.1 Flash** (`opencode/deepseek-v4.1-flash-free`). El arranque lo siembra en `system_settings` solo cuando la clave está vacía; Ajustes, el proyecto, el flujo o el nodo pueden sobrescribirlo y el arranque nunca pisa ese valor.

## Dos planos

```text
PLATAFORMA
  Ajustes: proveedor, Sentry, bóveda global y canales del orquestador
  |
  +-- ORQUESTADOR GLOBAL (/data/control)
  |     agente propio, solo lectura cross-project, alertas deterministas
  |
  +-- PROYECTO (/data/workspaces/<slug>)
        workflow.json, nodes/, .opencode/agents/, AGENTS.md, knowledge/
        integraciones: Telegram, WhatsApp, chat externo, bases, email futuro
```

- **Plano de proyecto:** cada caso de uso configura sus canales, conexiones, secretos, agentes y conocimiento. Los nodos referencian `integrationId`, no slugs.
- **Plano de control:** el orquestador global vive en `/data/control`, tiene su propio agente y canales, y consulta todos los proyectos con herramientas de solo lectura. No edita proyectos por defecto.

## Interfaz web

El rail lateral fija las cinco páginas globales: **Proyectos**, **Ejecuciones**, **Orquestador global**, **Ajustes** y **Salud del sistema**. Dentro de un proyecto, la barra superior convierte cada sección en una ruta propia: recargar o compartir un enlace abre la misma sección, y `/projects/<slug>` redirige a `overview`.

| Ruta | Pantalla |
|---|---|
| `/login` | Inicio de sesión. |
| `/change-password` | Cambio obligatorio de contraseña en el primer ingreso. |
| `/projects` | Listado de proyectos. |
| `/projects/:slug` | Redirige a `/overview`. |
| `/projects/:slug/overview` | **Resumen**: preparación, últimas ejecuciones y acciones rápidas. |
| `/projects/:slug/flow` | **Flujo**: canvas, inspector de nodos y biblioteca del flujo. |
| `/projects/:slug/runs` | **Ejecuciones** del proyecto con filtros, jerarquía de runs hijos y exportación JSON/CSV. |
| `/projects/:slug/agents` | **Agentes**: catálogo del agente principal y los sub-agentes. |
| `/projects/:slug/knowledge` | **Conocimiento**: notebooks, fuentes y búsqueda híbrida. |
| `/projects/:slug/integrations` | **Integraciones**: canales, bases, HTTP, transcripción y voz. |
| `/projects/:slug/settings` | **Ajustes** del proyecto: General, Aprobaciones, Programaciones, Destinos, Secretos y Preparación. |
| `/projects/:slug/*` | Redirige a `/overview`. |
| `/runs` | **Ejecuciones** globales de todos los proyectos. |
| `/orchestrator` | **Orquestador global**: chat de control y estado cross-project. |
| `/settings` | **Ajustes** de plataforma: proveedor, Sentry, bóveda y canales del orquestador. |
| `/system/health` | **Salud del sistema**: estado de los servicios, rendimiento y errores recientes, con enlace a Sentry/GlitchTip en `/settings`. |
| `*` | Redirige a `/projects`. |

**Ejecuciones globales** reúne los runs de todos los proyectos en una sola tabla. Filtra por estado, slug de proyecto y rango de fechas en UTC, pagina de 50 en 50, abre el detalle paso a paso y exporta hasta 200 filas en JSON o CSV con los filtros activos. Los runs hijos de `foreach` y `subworkflow` se agrupan bajo su padre (`parentRunId`).

### Importar y exportar un flujo

El menú de la barra superior del proyecto abre **Biblioteca del flujo**. Exportar descarga un archivo `.workflow.json`; importar reemplaza el borrador y no lo guarda, así que conviene revisar el canvas y pulsar **Guardar flujo** después.

El contrato es la envoltura `WorkflowExportEnvelopeSchema` de `packages/shared/src/workflow.ts` (la web la reexporta como `WorkflowDefinitionSchema` desde `apps/web/src/workflow-transfer.ts`):

```json
{
  "version": 1,
  "exportedAt": "2026-11-19T12:00:00.000Z",
  "graph": {
    "version": 1,
    "id": "<id-del-flujo-de-destino>",
    "name": "Triaje de soporte",
    "description": "",
    "defaultModel": "opencode/deepseek-v4.1-flash-free",
    "nodes": [
      {
        "id": "entrada",
        "type": "trigger",
        "label": "Entrada",
        "position": { "x": 0, "y": 0 },
        "config": {}
      }
    ],
    "edges": [],
    "updatedAt": "2026-11-19T11:58:00.000Z"
  }
}
```

- `version` es la versión del formato de archivo (`1`) y debe coincidir con la que entiende la plataforma; una versión mayor se rechaza con un mensaje para actualizar.
- `graph` reutiliza el mismísimo `WorkflowGraphSchema`: nodos, conexiones, modelo por defecto y marcas de tiempo.
- Al importar, el grafo conserva el `id` del flujo abierto, así que el mismo archivo se mueve entre proyectos sin rebindear el editor.
- Un archivo más antiguo que el borrador pide confirmación explícita antes de reemplazarlo. Los errores de validación se listan en español y no tocan el borrador.

## Modelo de proyecto

Cada proyecto contiene:

```text
/data/workspaces/<slug>/
├── AGENTS.md
├── workflow.json
├── nodes/*.ts
├── knowledge/<notebook>/sources/*.md
├── .opencode/
│   ├── agents/principal/agente.md
│   └── agents/<categoria>/<rol>.md
└── opencode.jsonc
```

La configuración no secreta de integraciones vive en la base con `project_slug`; los secretos viven cifrados en la bóveda con scope de proyecto. El proyecto es la unidad de aislamiento: no puede leer ni operar recursos de un proyecto hermano.

## Configuración centralizada

Cada proyecto tiene una sola pestaña **Ajustes** con seis secciones: General, Aprobaciones, Programaciones, Destinos, Secretos y Preparación. Las conexiones y los canales viven en **Integraciones**, con el mismo editor para canales de proyecto y canales globales del orquestador: permite crear y editar sin recrear la integración, rotar el token de Telegram y conservar el `integrationId` y sus referencias.

Los **destinos** son etiquetas reutilizables (chat de Telegram/WhatsApp, email, webhook) para allowlists, alertas, aprobaciones y nodos `notify`. Los valores crudos existentes siguen funcionando; adoptar un valor como destino no reescribe las referencias actuales.

La configuración efectiva se resuelve con la precedencia **entidad → proyecto → plataforma → entorno → default** y se expone en `GET /api/config/effective` (con `?project=<slug>` para el ámbito de proyecto). Los secretos se devuelven enmascarados y cada valor indica su fuente y si requiere reinicio. El DSN de Sentry guardado desde Ajustes se lee de la bóveda en el siguiente arranque, sin depender de `SENTRY_DSN`.

## Canales de proyecto

Un canal de proyecto declara un modo:

- `agent`: conversación directa con el agente principal del proyecto.
- `workflow`: dispara el trigger del workflow del proyecto.
- `hybrid`: allowlist → agente; público → workflow.

El ruteo es determinista por `integrationId` y evento; no escanea todos los proyectos. Un trigger de integración debe declarar `integrationId` y evento, y no puede haber dos triggers del mismo proyecto para la misma integración/evento.

### Media y transcripción

Telegram puede capturar fotos, notas de voz, audio y documentos de imagen. El archivo se valida por contenido y se guarda en `.opencode/media/` del proyecto; los límites son 20 MB por archivo, 5 adjuntos por mensaje y 5 minutos de audio.

- **Modo agente:** la plataforma transcribe el audio con la conexión de transcripción por defecto del proyecto antes de iniciar el turno. Sin conexión, responde con un mensaje accionable.
- **Modo workflow:** el trigger declara qué acepta (`text`, `image`, `audio`) y el flujo decide cuándo convertir el audio con el nodo **Transcribir audio**.
- **Imágenes:** el nodo **Agente** adjunta las imágenes del input al prompt. El modelo elegido debe aceptar imagen.
- **Conexiones:** se crean en **Integraciones > Transcripción (ASR)** y se prueban desde la misma tarjeta; el botón de prueba lista y cachea los modelos del proveedor.
- **Local:** `docker-compose.yml` incluye `speaches` CPU con `Systran/faster-whisper-base` y `Systran/faster-whisper-small` preinstalados. La conexión local usa `http://transcription:8000/v1` y `Systran/faster-whisper-small`.
- **Terceros:** cualquier endpoint OpenAI-compatible sirve, por ejemplo `https://api.groq.com/openai/v1` con `whisper-large-v3`. Las notas de voz de Telegram son OGG/Opus; algunos modelos de OpenAI no aceptan ese formato, así que verifica el proveedor antes de usarlo.
- **Ajustes:** el proyecto elige su conexión de transcripción por defecto en **Ajustes > Transcripción**.

Fuera de alcance en esta versión: ASR para el orquestador global, media en WhatsApp, subida desde el chat web y retención automática de archivos.

### Voz (TTS) y respuestas de audio en Telegram

La plataforma puede convertir texto en voz y responder con una nota de voz nativa cuando el mensaje entrante traía audio.

- **Conexiones:** se crean en **Integraciones > Voz (TTS)** y se prueban desde la tarjeta. Cualquier endpoint OpenAI-compatible (`/audio/speech`) sirve; la API key es opcional y se guarda en la bóveda.
- **Voces:** al probar la conexión, la plataforma lee `/v1/models`, descubre las voces del proveedor (por ejemplo las de Kokoro local) y las muestra como selector en la conexión y en el nodo **Generar voz**. Si el proveedor no publica voces, queda el campo de texto con sugerencias.
- **Local:** el mismo `speaches` de `docker-compose.yml` descarga `speaches-ai/Kokoro-82M-v1.0-ONNX` en el init. La conexión local usa `http://transcription:8000/v1`, modelo Kokoro y voz `ef_dora`; `em_alex` y `em_santa` son alternativas en español.
- **Ajustes:** el proyecto elige su conexión de voz por defecto en **Ajustes > Voz**.
- **Canal Telegram:** en la configuración del canal, activa **Responder con audio cuando llegue audio**. El default sigue siendo solo texto y los mensajes de texto nunca llaman al TTS.
- **Nodo Generar voz:** convierte el texto de su input, guarda el audio en `.opencode/media/` y devuelve el `MediaRef`; el flujo puede terminar ahí para entregar la nota de voz.
- **ffmpeg:** la imagen de ejecución lo incluye para convertir a OGG/Opus, el formato de las notas de voz de Telegram. Si no está disponible o falla, el audio se envía como archivo MP3 en lugar de perderse. Las notas de voz de Telegram duran entre 1 y 60 segundos; audios más largos se envían como archivo.
- **Límites:** hasta 4 000 caracteres por síntesis. Si la respuesta es más larga o falta la conexión, se envía el texto completo.

Fuera de alcance en esta versión: audio saliente por WhatsApp y chat web, voz para el orquestador global, clonación de voz y streaming TTS.

### Chat externo (API)

```bash
curl -X POST http://localhost:3001/api/v1/integrations/<integrationId>/messages \
  -H "content-type: application/json" \
  -H "x-integration-key: sk_chat_..." \
  -d '{"threadId":"cliente-42","message":"Hola"}'
```

Con `Accept: text/event-stream` responde por SSE; con `webhookUrl` entrega el resultado firmado con `x-platform-signature: sha256=…`.

## Orquestador global

- Se configura en **Ajustes > Canales del orquestador global**.
- Puede recibir alertas de `run.failed`, `integration.down` y `health.degraded`; las alertas son deterministas, deduplicadas y con throttle.
- El chat del orquestador está en la página **Orquestador global** y usa herramientas `platform_*` con scope global.
- Solo recibe herramientas de lectura: proyectos, flujos, ejecuciones, errores, salud y conocimiento. Las tools de mutación o efectos secundarios no se registran en su inventario.
- Usa `ORCHESTRATOR_MODEL` si está definido; si no, el modelo por defecto de la plataforma (DeepSeek V4.1 Flash).
- Sus credenciales son distintas de las de proyecto: `PLATFORM_GLOBAL_TOKEN` vs `PLATFORM_SERVICE_TOKEN`.
- No edita proyectos; si en el futuro se habilitan acciones, requieren confirmación explícita y auditoría.

## Bancos de información

Los notebooks viven dentro de cada proyecto. La pestaña **Conocimiento** permite:

- Crear notebooks y subir PDF/DOCX/CSV/Markdown/TXT.
- Indexar URLs públicas con protección SSRF.
- Buscar con recuperación híbrida (FTS5 + vectores) y citas.
- Asignar notebooks a agentes y nodos del mismo proyecto.

El orquestador global puede buscar conocimiento cross-project en modo lectura, con citas que incluyen el proyecto.

## Ejecución manual, programada (Cron) y Webhooks

El trigger declara `inputSchema` con campos, tipos, obligatoriedad, descripción y ejemplo. El botón **Ejecutar** abre un formulario generado desde ese esquema; el servidor valida el payload antes de crear cualquier paso.

- **Manual (`kind: "manual"`):** Lanzamiento desde el canvas o `POST /api/projects/:slug/runs`.
- **Programado (`kind: "schedule"`):** Expresión cron de 5 campos en una zona IANA (`config.timezone`, por defecto UTC), por ejemplo `0 9 * * 1-5` con `America/Mexico_City`. El `WorkflowScheduler` evalúa cada minuto, reclama una clave determinista (`schedule:<workflowId>:<nodeId>:<ventanaUTC>`) y persiste `lastWindowAt`/`nextWindowAt` en `workflow_schedule_state`.
  - `enabled: false` pausa el schedule sin borrar la configuración.
  - `overlapPolicy: "skip"` (default) omite la ventana si el flujo anterior sigue `running` o `paused`; `"allow"` permite solapamiento.
  - `catchUp: true` recupera ventanas perdidas dentro de `catchUpWindowMinutes`, con tope de 1,000 ventanas.
  - `mode: "once"` + `runAt` ejecuta una sola vez en una fecha ISO; no se repite en días posteriores.
  - En DST, una hora repetida se ejecuta una sola vez y una hora inexistente se omite; con `catchUp` se recupera una sola vez.
  - `GET /api/projects/:slug/workflow/schedule` devuelve el estado y la próxima ejecución por trigger.
- **Webhook (`kind: "webhook"`):** Recibe llamadas en `POST /api/v1/webhooks/:projectSlug/:nodeId` verificando en tiempo constante `x-webhook-secret` o la firma HMAC-SHA256 `x-webhook-signature: sha256=...` contra el alias de secreto del proyecto (`config.secretAlias`).
- **Recuperación al arranque:** Si el servidor se reinicia con ejecuciones en estado `running`, el motor las reanuda automáticamente desde el último paso `succeeded` usando el snapshot inmutable del grafo con el que iniciaron.
- El run guarda `launchedBy`, `graphHash`, `versionId`, `integrationId` y origen.
- El endpoint devuelve `202 { runId }` antes de terminar y el SSE actualiza el estado.
- El nodo `validate` permite reglas declarativas en cualquier punto; si falta un campo, falla el paso con un mensaje accionable y no ejecuta los siguientes.

## Acción nativa de notificación (P0)

El nodo `notify` envía un mensaje por un canal del proyecto y registra la entrega en el ledger `workflow_deliveries`:

```json
{
  "type": "notify",
  "config": {
    "integrationId": "<id-del-canal>",
    "recipient": "123456789",
    "text": "Hola {{input.nombre}}, tu reporte está listo."
  }
}
```

- Telegram y WhatsApp requieren `recipient`; el chat externo lo omite y usa el `webhookUrl` de la integración.
- El mensaje acepta `{{input.campo}}` y se resuelve antes de enviar.
- La acción usa una clave estable (`runId:nodeId` o `config.actionKey`) para no reenviar una entrega ya confirmada en reintentos o replays.
- La salida es `{ delivered, integrationId, recipient, providerMessageId }`.
- Si el proveedor falla, el intento queda en `failed` con un error sanitizado y el nodo aplica su política de reintento o error.
- El adaptador de email sigue fuera de alcance; usa solo canales con egress activo.

## Acción nativa de base de datos (P0)

El nodo `database` ejecuta SQL parametrizado contra una integración del proyecto sin escribir un nodo de código. La configuración es declarativa:

```json
{
  "type": "database",
  "config": {
    "integrationId": "<id-de-la-integracion>",
    "mode": "write",
    "transaction": true,
    "maxRows": 1000,
    "statements": [
      { "sql": "INSERT INTO leads (name) VALUES (?)", "params": ["{{input.nombre}}"] }
    ]
  }
}
```

- `mode: "read"` solo permite `SELECT`, `WITH`, `PRAGMA` y `EXPLAIN`.
- `mode: "write"` permite `INSERT`, `UPDATE`, `DELETE` y `MERGE`; el DDL queda deshabilitado en P0.
- `params` es un arreglo JSON y acepta `{{input.campo}}`; se resuelve en el servidor antes de ejecutar.
- `transaction` agrupa las sentencias y revierte todo si una falla. Por defecto se activa cuando hay más de una sentencia.
- `maxRows` limita las filas devueltas y marca `truncated: true` cuando recorta.
- La salida es `{ rows, rowCount, affectedRows, truncated }`.

Usa `database` para operaciones declarativas y auditables. Usa `code` + `ctx.db` solo cuando necesites lógica, bucles o transformaciones que el nodo no cubre. El caso de escritura transaccional está cubierto por `apps/server/test/database-actions.test.ts`.

## Reintentos y ruta de error (P0)

Cada nodo de acción acepta `retryPolicy` y `onError`:

```json
{
  "retryPolicy": { "maxRetries": 2, "backoffMs": 500, "backoffMultiplier": 2 },
  "onError": { "strategy": "continue" }
}
```

- `stop`: el run falla, como antes.
- `continue`: el paso falla, pero el flujo sigue por su salida normal con `{ "error": { "nodeId", "message", "attempts" } }`.
- `route`: el flujo salta al nodo indicado en `onError.target` con el mismo payload de error.
- La ruta de error no es una arista normal del DAG; el inspector la configura y el canvas la dibuja como línea punteada.
- El backoff por defecto es 500 ms con multiplicador 2 y un tope de 30 s.
- Las escrituras `database` en modo `write` usan `maxRetries: 0` por defecto. Si habilitas reintentos, el SQL debe ser idempotente (upsert o clave natural); no hay exactly-once entre la base externa y el ledger local.

## Aprobaciones manuales, programadas y por canal (P0)

El nodo `approval` pausa el run y crea una aprobación pendiente. Ahora se puede resolver de tres formas:

- **UI:** abre el detalle de la ejecución y usa **Aprobar** o **Rechazar**.
- **API:** `GET /api/projects/:slug/runs/:runId/approvals` lista las aprobaciones; `POST /api/projects/:slug/runs/:runId/approvals/:nodeId` con `{ "decision": "approve" | "reject" }` decide.
- **Canal:** el prompt se envía al canal de origen si el run nació de una integración; si no, al canal configurado en **Ajustes → Aprobaciones**. El comando `/approve <runId> <nodeId>` sigue disponible para canales autorizados.

Si un run sin origen llega a una aprobación y el proyecto no tiene canal configurado, queda pausado y visible en la UI; la readiness del proyecto indica que falta el canal. `autoApprove: true` registra una aprobación automática (`decidedBy: "autoApprove"`) sin crear una pendiente.

## Política de base de datos y secretos HTTP (P1)

Cada integración de base de datos expone una política visible en **Integraciones**:

```json
{ "access": "read", "maxRows": 1000, "allowDdl": false }
```

- `access: "read"` rechaza `INSERT`, `UPDATE`, `DELETE` y DDL antes de abrir la conexión.
- `access: "write"` permite DML; el DDL sigue bloqueado salvo `allowDdl: true`.
- `maxRows` limita las filas devueltas; el máximo duro es 10,000.
- Las integraciones existentes se migran con `access: "write"`, `maxRows: 1000` y `allowDdl: true` para no romper flujos. Las nuevas nacen en `read`, `1000` y `false`.
- La política aplica al nodo `database`, a `ctx.db` y a la tool `db_query`.

El nodo `http` puede usar una integración HTTP para el `baseUrl` y referencias a la bóveda:

```json
{
  "integrationId": "<id-de-la-integracion-http>",
  "url": "/leads",
  "headers": { "Authorization": "secret:api-token" },
  "body": { "token": "{{secret.api-token}}" }
}
```

El servidor resuelve `secret:<alias>` y `{{secret.<alias>}}` en memoria antes del fetch. El workflow y los snapshots guardan solo el alias; un alias de otro proyecto falla antes de la petición.

## Esperas durables y ejecuciones únicas (P1)

- `delay` con `ms <= 60000` espera en memoria.
- `delay` con `waitUntil` (ISO) o `ms > 60000` pausa el run y persiste un `workflow_timer`; el scheduler lo reanuda al vencer y el run sobrevive reinicios.
- Un timer vencido durante una caída se procesa al arrancar. Cada timer se reclama una sola vez.
- `schedule` con `mode: "once"` y `runAt` crea un run único; si la fecha se perdió durante una caída, se ejecuta una vez al arrancar si el schedule está activo.

## Lotes y subflujos (P1)

- Un nodo `subworkflow` ejecuta una versión inmutable de `workflow_versions` del mismo proyecto. El payload se toma de `input` o de `config.payloadPath`; el resultado o el fallo se propaga al flujo padre.
- Un nodo `foreach` recibe `itemsPath`, `versionId`, `maxConcurrency` y `onItemError`. Ejecuta un run hijo por elemento, con `parentRunId`, y agrega `{ items: [{ index, status, output, error, runId }] }`.
- `onItemError: "stop"` corta el lote al primer fallo; `"continue"` procesa los demás y deja el fallo en el resultado.
- El sistema rechaza ciclos directos y transitivos comparando la cadena de `parentRunId` con el `workflowId` de la versión invocada.
- Los runs hijos quedan visibles en Ejecuciones con su `parentRunId`, lo que permite auditar el lote.

## Cola, rate limit y alertas por proyecto (P1)

- Los runs se encolan cuando el proyecto alcanza su límite de concurrencia (2 por defecto). El scheduler despacha la cola y el estado `queued` se muestra en Ejecuciones.
- Las notificaciones respetan `rateLimitPerMinute` (60 por defecto); si se excede, la entrega espera la ventana configurada.
- Las integraciones de canal pueden declarar `alerts` (`run.failed`, `integration.down`, `health.degraded`) y `alertRecipient`. Un fallo de proyecto usa primero los canales del proyecto y cae a los globales si no hay.
- Los run hijos de `foreach`/`subworkflow` conservan `parentRunId` y se pueden auditar desde Ejecuciones.

## Límites de automatización

- Las escrituras en bases externas son **at-least-once** si se habilitan reintentos; usa SQL idempotente (upsert o clave natural). No hay exactly-once entre la DB externa y el ledger local.
- La cola, los timers y el scheduler viven en un solo proceso con SQLite. No están diseñados para múltiples instancias; una cola distribuida queda fuera de alcance.
- El adaptador de email sigue siendo un contrato futuro; `notify` cubre Telegram, WhatsApp y chat externo.
- Los secretos HTTP se resuelven en el servidor y nunca se guardan en `workflow.json` ni en snapshots; no los pegues en headers como texto.

## Versionado del grafo, Snapshots y Rollback

- Cada guardado o ejecución registra un snapshot inmutable en `workflow_versions` con el JSON del grafo y el paquete de código `nodes/*.ts`.
- `replay` y `resumeWithApproval` ejecutan siempre sobre el snapshot original del run aunque el flujo en disco haya cambiado después.
- Desde **Versiones** en la barra superior del proyecto (o `GET /api/projects/:slug/workflow/versions` y `POST /api/projects/:slug/workflow/versions/:version/rollback`) puedes restaurar cualquier versión previa en un clic.

## Salida estructurada del nodo Agente y Permisos de herramientas

- **Salida estructurada (`config.outputSchema`):** Los nodos `agent` pueden declarar campos de salida tipados (`string`, `number`, `boolean`, `json`). El motor instruye al agente a devolver JSON, limpia bloques Markdown, valida el contrato y ejecuta un turno automático de reparación si la primera respuesta no cumple el esquema antes de pasar el objeto tipado a nodos `decision`, `validate`, `transform` o `code`.
- **Contexto de sesión y permisos:** cada sesión de OpenCode se registra en `session_context` con su agente y contexto (`chat`, `workflow` o `external_channel`). El plugin envía `x-platform-session` y `x-platform-agent` en cada tool; el servidor resuelve el contexto desde la sesión y aplica las reglas `allow`/`deny` del perfil. Una sesión desconocida cae en el contexto de menor privilegio. Cada veredicto se audita con proyecto, agente, sesión, tool y decisión, sin argumentos ni secretos.
- **Descubrimiento de integraciones:** los agentes de proyecto tienen `integration_list`, que devuelve id, tipo, capacidades, estado y nombre de las integraciones del proyecto, sin secretos. El orquestador global no la recibe.
- **Plantilla vertical (`triaje-operativo`):** Al crear un proyecto puedes elegir la plantilla **Triaje operativo**, que despliega un flujo completo de 6 nodos (trigger con esquema, validación, agente clasificador con `outputSchema` y permisos restringidos, decisión condicional, aprobación y nodo de código).

## Sesiones y credenciales de OpenCode

- La base de OpenCode vive en `/data/opencode/opencode.db`; no en el home efímero del contenedor.
- Al arrancar, la plataforma vuelve a registrar en OpenCode las API keys de proveedor guardadas en la bóveda global.
- Si una sesión persistida ya no existe (por ejemplo, tras una migración o un reinicio de OpenCode), el chat crea una sesión nueva sobre el mismo hilo y reintenta el turno una vez. El historial de mensajes de la plataforma no se pierde.
- Si actualizas una instalación anterior, reinicia el servicio de OpenCode una vez para que empiece a usar la base persistente:
  `opencode service restart`.

## Agente principal y chat

Cada proyecto crea `AGENTS.md` y `.opencode/agents/principal/agente.md`, y selecciona `default_agent` en `opencode.jsonc`. El chat:

- Renderiza Markdown/GFM con tablas, código copiable y enlaces seguros.
- Tiene estados acoplado y minimizado/burbuja; el chat del proyecto vive en un drawer lateral y no tiene modo maximizado.
- Persiste por proyecto y muestra tiempo transcurrido, errores y reintentos.
- El prompt del agente principal evita rutas internas y prioriza lenguaje de negocio.

### Turnos durables

Cada mensaje crea un `chat_turn` con estado, sesión de OpenCode, mensaje de usuario, respuesta y uso. El turno no depende de que el request HTTP siga abierto: el SSE es una vista reenganchable. El servidor detecta el fin con polling de `session.active`/`session.get`, interrumpe al vencer `AGENT_TURN_MAX_MS` o `AGENT_TURN_IDLE_MS`, y reconcilia turnos activos al arrancar. `POST /api/projects/:slug/chat` mantiene el contrato SSE (`turn`, `status`, `delta`, `activity`, `heartbeat`, `done`, `error`) y añade `turnId`; `GET /chat/turns/:id` y `GET /chat/turns/:id/events` permiten consultar o reenganchar un turno. El orquestador y los canales usan el mismo ciclo.

El log durable de OpenCode (`experimental.session.log`) se evaluó como fuente primaria; en la versión 2.2.5 probada no entregó los eventos de ejecución, así que esta entrega usa polling como mecanismo autoritativo y deja el log como mejora posterior.

## Email (futuro)

El contrato de integraciones ya admite `kind: "email"` con capacidades `send_email`/`read_email`, configuración SMTP/IMAP y secretos separados. El adapter se implementará en un cambio posterior; mientras tanto, el tipo aparece como contrato y se rechaza su conexión con un mensaje claro.

## Desarrollo local

Requisitos: Bun ≥ 1.4 y Node ≥ 20 (solo para Vitest/Playwright).

```bash
bun install
bun run dev:web     # Vite en :5173 (proxy /api → :3000)
bun run dev         # API en :3000
```

Primer arranque local: `DATA_DIR=./data OPENCODE_MODE=fake bun run dev`.

## Pruebas

```bash
bun run typecheck          # TypeScript en todo el monorepo
bun test --cwd apps/server # dominio, adapters, HTTP e integración
bun run test               # shared + server + web
bun run test:e2e           # Playwright: first boot, canvas, recursos, chat, orquestador y salud
```

La suite E2E arranca el servidor con `OPENCODE_MODE=fake` y un `/data` limpio en `/tmp`.

## Graphify (knowledge graph)

El repositorio tiene una integración project-scoped de [Graphify](https://github.com/Graphify-Labs/graphify): el CLI `graphify`, la skill `.opencode/skills/graphify`, el hook `.opencode/plugins/graphify.js` y las instrucciones de `AGENTS.md`.

```bash
bun run graph:build          # grafo local de código, sin API key
bun run graph:update         # actualización incremental tras cambios
graphify query "¿cómo funciona el canvas?"
graphify path "WorkflowCanvas" "ProjectPage"
```

El grafo vive en `graphify-out/` y OpenSpec lo consulta antes de explorar código a través de `openspec/config.yaml`. Guía completa: `docs/graphify.md`.

## Arquitectura

```text
apps/server/src/
├── domain/          # workflow, agentes, integraciones, conocimiento, canales, telemetría
├── application/     # puertos + casos de uso
└── infrastructure/  # Hono, OpenCode V2, SQLite/Drizzle, workers, canales, bóveda
apps/web/            # React + Vite + Tailwind + React Query + React Flow + Monaco
packages/shared/     # contratos Zod compartidos
packages/opencode-plugin/  # herramientas platform_* dentro de OpenCode V2
```

- Ejecución de nodos `code` en workers Bun aislados con timeout; `ctx.db`/`ctx.notify` resuelven integraciones del proyecto y los secretos nunca entran al worker.
- Checkpoints por paso con entradas/salidas/logs, idempotencia atómica y replay.
- SSE con heartbeats para chat, canvas y runs.
- Bóveda AES-256-GCM con scope de proyecto; el LLM nunca recibe secretos, solo alias.
- Observabilidad: logs JSON con `requestId`/`entryPoint`/`projectSlug`/`integrationId`, métricas RED, panel `/system/health`, Sentry/GlitchTip opcional.

## Migración desde el modelo anterior

El modelo global de canales, bases y notebooks se elimina; no hay capa de compatibilidad. Si hay datos reales, ejecuta el backup y la migración legacy con un mapa explícito antes de arrancar la versión nueva:

```bash
bun run --cwd apps/server migrate:legacy /data/db/platform.sqlite mapping.json /data/db/backups/pre-migration.sqlite
```

`mapping.json` usa este formato:

```json
{
  "channels": { "ventas-bot": { "scope": "project", "projectSlug": "ventas" } },
  "databases": { "crm": { "scope": "project", "projectSlug": "ventas" } },
  "notebooks": { "manual-ventas": "ventas" },
  "defaultProjectSlug": "ventas"
}
```

Los recursos sin proyecto asignable se reportan y no se adivinan. Las credenciales legacy deben reingresarse en la bóveda porque el modelo anterior las cifraba por recurso.

## Seguridad

- Cookies de sesión `httpOnly`/`sameSite`; rate limit en login (10 intentos/15 min).
- Validación Zod en los bordes, SQL parametrizado en bases externas y allowlist de IPs públicas para ingesta de URLs (anti-SSRF).
- Path traversal bloqueado con resolución de symlinks en workspaces.
- Scope de proyecto obligatorio en llamadas de servicio; credencial global separada para el orquestador.
- Workers con timeout; el contenedor es el sandbox de confianza.
- Nunca subas `.env`, `/data` ni `master.key` al repositorio.
