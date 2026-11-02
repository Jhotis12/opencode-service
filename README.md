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
| `SENTRY_DSN` | Sentry / GlitchTip. |
| `EMBEDDINGS_URL` / `EMBEDDINGS_API_KEY` | Embeddings para búsqueda híbrida. |
| `PLATFORM_SERVICE_TOKEN` | Token de llamadas con scope de proyecto. |
| `PLATFORM_GLOBAL_TOKEN` | Token del plano de control (orquestador global). |
| `AGENT_CHAT_TIMEOUT_MS` | Timeout del chat (15 min por defecto). |
| `OPENCODE_MODE=fake` | Runtime simulado para desarrollo y E2E. |

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

## Canales de proyecto

Un canal de proyecto declara un modo:

- `agent`: conversación directa con el agente principal del proyecto.
- `workflow`: dispara el trigger del workflow del proyecto.
- `hybrid`: allowlist → agente; público → workflow.

El ruteo es determinista por `integrationId` y evento; no escanea todos los proyectos. Un trigger de integración debe declarar `integrationId` y evento, y no puede haber dos triggers del mismo proyecto para la misma integración/evento.

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
- **Programado (`kind: "schedule"`):** Expresión cron de 5 campos UTC (`config.cron`, ej. `0 9 * * 1-5`). El `WorkflowScheduler` evalúa cada ventana de minuto y reclama una clave de idempotencia determinista (`schedule:<workflowId>:<nodeId>:<YYYY-MM-DDTHH:mm>`).
- **Webhook (`kind: "webhook"`):** Recibe llamadas en `POST /api/v1/webhooks/:projectSlug/:nodeId` verificando en tiempo constante `x-webhook-secret` o la firma HMAC-SHA256 `x-webhook-signature: sha256=...` contra el alias de secreto del proyecto (`config.secretAlias`).
- **Recuperación al arranque:** Si el servidor se reinicia con ejecuciones en estado `running`, el motor las reanuda automáticamente desde el último paso `succeeded` usando el snapshot inmutable del grafo con el que iniciaron.
- El run guarda `launchedBy`, `graphHash`, `versionId`, `integrationId` y origen.
- El endpoint devuelve `202 { runId }` antes de terminar y el SSE actualiza el estado.
- El nodo `validate` permite reglas declarativas en cualquier punto; si falta un campo, falla el paso con un mensaje accionable y no ejecuta los siguientes.

## Versionado del grafo, Snapshots y Rollback

- Cada guardado o ejecución registra un snapshot inmutable en `workflow_versions` con el JSON del grafo y el paquete de código `nodes/*.ts`.
- `replay` y `resumeWithApproval` ejecutan siempre sobre el snapshot original del run aunque el flujo en disco haya cambiado después.
- Desde **Versiones** en la barra superior del proyecto (o `GET /api/projects/:slug/workflow/versions` y `POST /api/projects/:slug/workflow/versions/:version/rollback`) puedes restaurar cualquier versión previa en un clic.

## Salida estructurada del nodo Agente y Permisos de herramientas

- **Salida estructurada (`config.outputSchema`):** Los nodos `agent` pueden declarar campos de salida tipados (`string`, `number`, `boolean`, `json`). El motor instruye al agente a devolver JSON, limpia bloques Markdown, valida el contrato y ejecuta un turno automático de reparación si la primera respuesta no cumple el esquema antes de pasar el objeto tipado a nodos `decision`, `validate`, `transform` o `code`.
- **Permisos por agente y contexto:** Las herramientas `platform_*` validan `x-platform-agent` y `x-platform-context` (`chat`, `workflow`, `external_channel`). Por defecto, los pasos de workflow y canales externos no pueden mutar definiciones (`workflow_upsert`, `subagent_upsert`), y cualquier regla `deny` en el frontmatter del agente bloquea `db_query`, `notify` o `workflow_trigger` con HTTP `403`.
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
- Tiene estados acoplado, expandido y minimizado/burbuja.
- Persiste por proyecto y muestra tiempo transcurrido, errores y reintentos.
- El prompt del agente principal evita rutas internas y prioriza lenguaje de negocio.

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
