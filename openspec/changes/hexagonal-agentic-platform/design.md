# Design

## Context

El repositorio parte en limpio (greenfield) con OpenSpec inicializado. La motivación del producto se detalla en `proposal.md` y los contratos de comportamiento en `specs/*/spec.md`. El sistema debe empaquetarse para correr tanto en desarrollo local como en un despliegue Docker/EasyPanel de un solo clic (con un único volumen persistente `/data`), orquestando el servidor de **OpenCode V2** (`opencode serve --service`) junto con un motor de flujos híbrido (código `.ts` + sub-agentes `.md`), bancos de información estilo NotebookLM y canales conversacionales en tiempo real.

## Goals / Non-Goals

**Goals:**
- Garantizar una **Arquitectura Hexagonal (Puertos y Adaptadores)** estricta donde el dominio (`src/domain/`) no dependa de frameworks HTTP, ORMs, SDKs de mensajería ni del cliente de OpenCode.
- Permitir que el usuario y el Agente Principal de OpenCode editen exactamente la misma representación en disco de cada proyecto (`workflow.json`, `nodes/*.ts`, `.opencode/agents/<categoria>/<rol>.md`) con sincronización instantánea en el canvas de React Flow.
- Proveer observabilidad de grado producción desde el primer commit: captura de errores con inicio de sesión externo (**Sentry Cloud / GlitchTip** vía `@sentry/bun` y `@sentry/react`), panel interno `/system/health`, logs estructurados JSON con `requestId` y `entryPoint`, métricas RED/USE y pirámide de pruebas TDD (Vitest + Playwright).
- Funcionar en EasyPanel/Docker sin requerir configuración previa por consola (*Zero-Env First Boot*), generando credenciales iniciales seguras y permitiendo configurar OpenCode Go, bases de datos, canales y Notebooks desde la UI web.
- Aislar cada proyecto: sesión/chat propios, historial persistente y alcance de archivos/herramientas; el orquestador global es la única vista transversal.
- Exponer trazabilidad completa de cada ejecución (entrada/salida/logs por paso) y un canvas con nodos tipados y estados en vivo.

**Non-Goals:**
- Multi-tenancy SaaS público con facturación por organización en esta primera fase (el diseño es single-tenant o equipo privado autohospedado con control de acceso por administrador).
- Entrenamiento de pesos de modelos LLM (fine-tuning GPU); el "entrenamiento" de sub-agentes se realiza mediante bancos de información fundamentados (RAG híbrido + resúmenes de fuentes estilo NotebookLM + instrucciones `.md`).
- Ejecución de nodos en lenguajes ajenos a TypeScript/JavaScript o shell controlado por OpenCode en el motor base de nodos `code`.
- Aislamiento a nivel de kernel/contenedor por proyecto: el shell dentro del contenedor sigue siendo una capacidad de confianza; el aislamiento de archivos se aplica a las herramientas de lectura/edición de OpenCode y a la API de la plataforma.

## Decisions

### 1. Stack de Runtime y Monorepo: Bun + Hono + React (Vite) sobre Next.js
- **Decisión:** Utilizar un monorepo gestionado con **Bun Workspaces** compuesto por:
  - `apps/server`: Servidor **Bun + Hono** (proceso persistente único para API REST, SSE, WebSockets, bots de Telegram/WhatsApp, scheduler y cola de ejecución).
  - `apps/web`: SPA en **React + Vite + Tailwind CSS v4 + `@xyflow/react` + `@monaco-editor/react` + TanStack Query**, con tokens de diseño en `@theme` y primitivos en `src/ui.ts`.
  - `packages/shared`: Esquemas **Zod**, tipos de dominio exportables, contratos de API (`APIError`, paginación) y eventos SSE.
  - `packages/opencode-plugin`: Plugin de servidor `@opencode/plugin` que inyecta las herramientas `platform_*` dentro de OpenCode V2.
- **Por qué:** Los listeners persistentes (sockets de WhatsApp con Baileys, long-polling de Telegram, suscripciones a `client.event.subscribe()` de OpenCode V2) y la ejecución dinámica de archivos `.ts` creados en caliente por el agente chocan con el modelo efímero y el bundler (Webpack/Turbopack) de Next.js. Bun ejecuta archivos `.ts` recién escritos por el agente en milisegundos sin paso de compilación separado.
- **Alternativas consideradas:**
  - *Next.js Fullstack Monolito:* Descartado por fricción con sockets persistentes en HMR y ejecución dinámica de nodos `.ts`.
  - *Microservicios separados en múltiples contenedores obligatorios:* Descartado para mantener el despliegue de 1 clic en EasyPanel simple y de bajo consumo de RAM.

### 2. Estructura de Arquitectura Hexagonal (Puertos y Adaptadores)
- **Decisión:** Dividir `apps/server/src` en tres anillos con regla de dependencia hacia adentro (`infrastructure -> application -> domain`):

```text
apps/server/src/
├── domain/                         # Reglas puras TS (Cero imports de Hono, Drizzle, OpenCode)
│   ├── identity/                   # User, PasswordPolicy, VaultSecret, ExternalDbConfig
│   ├── workflow/                   # Project, WorkflowGraph, NodeSpec, StepCheckpoint, IdempotencyRecord
│   ├── agents/                     # AgentCategory, SubagentProfile (.md AST), ModelSelection
│   ├── knowledge/                  # Notebook, SourceDocument, SemanticChunk, Citation
│   ├── channels/                   # ChannelMessage, ConversationThread, AdminAllowlist
│   └── telemetry/                  # HealthSnapshot, ErrorRecord, EntryPointType
├── application/                    # Casos de uso + Contratos de Puertos
│   ├── ports/
│   │   ├── in/                     # Casos de uso expuestos a adaptadores primarios
│   │   └── out/                    # IAgentRuntimePort, IWorkspaceFsPort, ICodeWorkerPort,
│   │                               # ISecretVaultPort, IKnowledgeIndexPort, IChannelEgressPort,
│   │                               # IExternalDbPoolPort, IErrorTrackerPort, IRepositoryPorts
│   └── use-cases/                  # Orquestación de negocio e idempotencia
└── infrastructure/                 # Adaptadores concretos
    ├── in/
    │   ├── http/                   # Controladores Hono, middlewares Auth/RateLimit/CorrelationId
    │   ├── sse/                    # Multiplexor SSE hacia React UI y clientes de Chat Externo
    │   ├── channels/               # TelegramGrammyAdapter, WhatsAppBaileysAdapter, ExternalChatHttpAdapter
    │   └── scheduler/              # CronRunnerAdapter
    └── out/
        ├── opencode/               # OpenCodeV2Adapter (@opencode/client + @opencode/client/service)
        ├── worker-sandbox/         # BunWorkerPoolAdapter (ejecución de nodes/*.ts con AbortSignal)
        ├── workspace-fs/           # SafeFsWorkspaceAdapter (validación de symlinks y lectura/escritura)
        ├── persistence/            # Drizzle ORM (SQLite WAL; PostgreSQL del store diferido)
        ├── knowledge-index/        # SqliteVecFtsAdapter y PgVectorTsvectorAdapter
        ├── vault/                  # Aes256GcmVaultAdapter
        ├── external-db/            # DynamicDatabaseClientAdapter (pg, mysql2, mssql, bun:sqlite)
        └── telemetry/              # PinoLoggerAdapter, SentryErrorTrackerAdapter, PromMetricsAdapter
```

### 3. Integración Nativa con OpenCode V2 (`@opencode/client` + `@opencode/plugin`)
- **Decisión:**
  1. El backend descubre o inicia el servicio local de OpenCode V2 mediante `Service.ensure()` de `@opencode/client/service` y mantiene un cliente autenticado (`OpenCode.make`).
  2. Cada proyecto (`/data/workspaces/<slug>`) se registra como una `location` de OpenCode V2.
  3. Los sub-agentes se almacenan en `.opencode/agents/<categoria>/<rol>.md` siguiendo la especificación oficial de OpenCode V2 (frontmatter YAML con `description`, `mode`, `model`, `color`, `permissions`, `steps` + cuerpo Markdown como prompt de sistema).
  4. El paquete `packages/opencode-plugin` usa `ctx.tool.transform` para registrar el namespace `platform` con herramientas tipadas:
     - `platform_workflow_list`, `platform_workflow_get`, `platform_workflow_upsert`, `platform_workflow_trigger`, `platform_workflow_runs`, `platform_workflow_replay`
     - `platform_subagent_upsert`, `platform_subagent_list`
     - `platform_kb_search`, `platform_kb_read_source`
     - `platform_db_query`, `platform_db_schema`
     - `platform_notify`, `platform_health_summary`
- **Por qué:** Aprovecha el motor nativo de OpenCode V2 (sesiones, compactación, permisos, MCPs, proveedor `opencode-go`, descubrimiento jerárquico de `.opencode/agents/<cat>/<rol>.md`) sin reinventar un runtime de agentes desde cero.

### 4. Contrato de `workflow.json` y Ejecución Aislada de Nodos `.ts`
- **Decisión:**
  - `workflow.json` almacena la versión del esquema, metadatos del flujo, modelo por defecto, nodos (`id`, `type`: `trigger | code | agent | decision | approval | http | delay | transform`, `position`, `config`, `codeFile` o `agentId`, `modelOverride`, `notebookIds`, `timeoutMs`, `retryPolicy`) y aristas (`edges`).
  - Cada nodo `code` apunta a `nodes/<node-id>.ts` que exporta una función estándar:
    ```ts
    export default async function run(input: unknown, ctx: NodeExecutionContext): Promise<unknown>
    ```
  - `BunWorkerPoolAdapter` ejecuta el nodo en un `Worker` aislado con `AbortSignal.timeout(node.timeoutMs)`, inyectando un proxy RPC para `ctx.db(alias)`, `ctx.http`, `ctx.notify` y `ctx.log` de modo que las credenciales jamás cruzan al hilo del worker en texto plano.
  - Nodos adicionales: `http` (method/url/headers/body + timeout), `delay` (ms, máximo 60s), `transform` (plantilla `{{input.campo}}` o mapping) y `decision` con condición visual (`field`, `operator`, `value`) o código. La decisión expone dos handles de salida (`true`/`false`) y las aristas guardan la condición.
  - Cada paso persiste `input`, `output`, `logs`, `model`, `agentId`, `durationMs` y estado; la UI muestra un detalle de ejecución con resultado final y replay desde cualquier paso.

### 5. Bancos de Información Estilo NotebookLM (Búsqueda Híbrida + Resúmenes)
- **Decisión:**
  - Al cargar un documento (PDF, DOCX, CSV, MD, TXT) o URL en un Notebook:
    1. Se convierte a Markdown estructurado y se guarda una copia de referencia en `/data/knowledge/<notebook-slug>/sources/<source-id>.md`.
    2. Se genera un resumen ejecutivo y lista de tópicos de la fuente (usando el modelo rápido configurado) y se almacena en la tabla `kb_sources`.
    3. El texto se divide en fragmentos semánticos (chunks de ~600 tokens con solapamiento de 100 tokens y metadatos de encabezado/página).
    4. Se indexa tanto en texto completo (**SQLite FTS5** / **Postgres `tsvector`**) como en vectores (**`sqlite-vec`** / **`pgvector`**) combinados con **Reciprocal Rank Fusion (RRF)**. Si en algún momento no hay proveedor de embeddings disponible, degrada limpiamente a BM25 (FTS5) + resúmenes sin interrumpir el servicio.
  - Cuando un sub-agente tiene Notebooks asignados, un hook `ctx.session.hook("context")` del plugin inyecta el índice de resúmenes de sus fuentes y habilita `platform_kb_search` con citas obligatorias `[Fuente: <título>, <sección/página>]`.

### 6. Pasarela Omnicanal y API de Chat para Aplicaciones Externas
- **Decisión:**
  - Un único puerto de entrada `IChannelIngressPort` recibe mensajes normalizados de tres adaptadores: `TelegramGrammyAdapter`, `WhatsAppBaileysAdapter` y `ExternalChatHttpAdapter`.
  - **Ruteo de Doble Capa:**
    - Si el canal es WhatsApp/Telegram y el `senderId` está en `AdminAllowlist` y no coincide con un comando/prefijo de flujo específico, se enruta a la sesión del **Agente Orquestador Global**.
    - Si el mensaje va dirigido a un canal de flujo (o entra por `POST /api/v1/channels/:channelSlug/messages`), se busca en la tabla `conversation_threads` la tupla `(channelId, externalThreadId)`. Si ya tiene una `opencodeSessionId` activa, continúa esa misma sesión conversacional; si no, crea una nueva y la vincula.
  - Soporta respuesta en **SSE Streaming** (`Accept: text/event-stream`), **JSON síncrono** y **Webhook asíncrono** firmado con `X-Platform-Signature` (HMAC-SHA256).

### 7. Sistema de Pruebas (TDD) y Captura de Errores / Salud (Sentry + Panel Interno)
- **Decisión:**
  - **Framework de Captura de Errores con Login Externo + Panel Interno:**
    1. **Sentry SDK (`@sentry/bun` en backend y `@sentry/react` en frontend):** Es el estándar de la industria que te permite **iniciar sesión en una plataforma web** (ya sea en **Sentry Cloud** gratis en `sentry.io` o en una instancia autoalojada de **GlitchTip / Bugsink** en tu propio EasyPanel) para revisar si la app ha estado funcionando bien o mal, recibir alertas de caídas, ver stack traces exactos, release health, breadcrumbs de qué hizo el usuario antes del fallo y rendimiento de endpoints. Se configura pegando el `SENTRY_DSN` en la pantalla de Ajustes o por variable de entorno.
    2. **Panel Interno `/system/health` y Ledger de Errores en DB:** Para que no dependas únicamente de un servicio externo, el propio backend guarda cada error e incidente en la tabla `system_error_events` y calcula métricas RED (Rate, Errors, Duration p50/p95/p99) e indicadores de salud de los subsistemas (OpenCode V2 daemon, DB, WhatsApp, Telegram, Workers). Al iniciar sesión en tu propia app tienes una vista dedicada de **Salud y Errores** en tiempo real.
  - **Logging y Trazabilidad:**
    - Logger estructurado JSON con **Pino**, propagando siempre `{ requestId, runId, entryPoint }` desde el borde de entrada hasta los workers y llamadas a OpenCode, aplicando redacción automática de campos sensibles (`password`, `token`, `secret`, `apiKey`, `authorization`).
  - **Pirámide de Pruebas TDD:**
    - **Unitarias (Vitest):** Prueban el 100% de las entidades y casos de uso en `domain/` y `application/` usando fakes en memoria (tiempo de ejecución < 2 segundos).
    - **Integración y Contratos (Vitest + SQLite `:memory:`):** Prueban repositorios Drizzle, encriptación AES-256-GCM, búsqueda híbrida FTS5, idempotencia atómica, rutas Hono y esquemas de herramientas `platform_*`.
    - **End-to-End (Playwright):** Prueban en un navegador real el flujo First-Boot (login con `admin`, cambio obligatorio de contraseña), creación de proyecto, renderizado del canvas React Flow, creación de sub-agente `.md` y vista `/system/health` verificando cero errores en consola.

### 8. Decisión de alcance sobre la base de datos de la plataforma
- **Decisión:** En este change la base de datos de la plataforma es **SQLite WAL** (`/data/db/platform.sqlite`) con Drizzle ORM. El soporte opcional de PostgreSQL para el store queda diferido: requeriría un puerto `Store` asíncrono y un `PgStore` con `drizzle-orm/node-postgres`.
- **Por qué:** El estado de la plataforma es de un solo contenedor y SQLite simplifica el despliegue de 1 clic en EasyPanel. Las bases de datos **externas** de los flujos sí soportan PostgreSQL, MySQL, MSSQL y SQLite por alias. El soporte PostgreSQL del store puede añadirse en un change de seguimiento sin cambiar los contratos de la API.

### 9. Catálogo de nodos y trazabilidad de ejecuciones
- **Decisión:** El motor soporta ocho tipos de nodo (`trigger`, `code`, `agent`, `decision`, `approval`, `http`, `delay`, `transform`). `http`, `delay` y `transform` se ejecutan en el servidor; `code`/decisión por código en workers Bun; los agentes en sesiones del proyecto.
- **Decisión:** Cada paso guarda `input`, `output`, `logs`, `model`, `agentId`, `durationMs` y estado. `GET /api/runs/:id` devuelve el run con sus pasos y la UI abre un modal de detalle al ejecutar, con resultado final y replay desde cualquier paso.
- **Decisión:** El canvas usa nodos personalizados (tarjeta, icono, color por tipo, subtítulo, estado y handles), una paleta con descripciones y un inspector específico por tipo. La condición tiene dos salidas (`sí`/`no`) y se autoajusta la vista al agregar nodos.
- **Por qué:** n8n demuestra que un catálogo claro y trazabilidad por paso son lo que hace usable un orquestador; sin salidas visibles el usuario no puede depurar sub-agentes ni flujos.

### 10. Aislamiento y sesiones por proyecto
- **Decisión:** Cada proyecto tiene su propia sesión de chat (`projects.chat_session_id`) y su historial en `chat_messages` (`user`, `agent`, `system`). Las sesiones de agentes de workflow se crean con `location.directory` del proyecto.
- **Decisión:** El bootstrap escribe en cada `opencode.jsonc` permisos para leer/editar solo dentro del proyecto y denegar `../**` y `external_directory`. El plugin calcula el slug desde `ctx.location.directory` y envía `x-platform-project`; el backend filtra `/api/projects` y devuelve `403` en rutas/runs de otro proyecto. El orquestador global (fuera de `/workspaces`) queda sin scope.
- **Por qué:** Compartir una sesión o un contexto global entre proyectos filtraba código, sub-agentes y conversaciones. El aislamiento por proyecto es un requisito de producto, no una optimización.
- **Límite conocido:** Los comandos de shell dentro del contenedor pueden acceder a rutas hermanas. El aislamiento fuerte requeriría un contenedor/sandbox por proyecto; se documenta en el README.

### 11. Chat de proyecto, timeout y modelo global
- **Decisión:** El chat del proyecto usa SSE con heartbeat cada 15s y un timeout configurable (`AGENT_CHAT_TIMEOUT_MS`, 15 min por defecto). Los mensajes del usuario, la respuesta y los errores se persisten; el spinner muestra el tiempo transcurrido.
- **Decisión:** `system_settings.default_model` guarda el modelo global; se usa cuando ni el flujo ni el nodo definen modelo. El modelo por flujo/nodo sigue teniendo prioridad.
- **Decisión:** Ajustes se organiza en tarjetas con un modal por sección (modelo, proveedor y modelos, bóveda, bases externas, canales, Sentry), con guías de uso de canales y credenciales de un solo uso copiables.

### 12. Frontend: Tailwind CSS v4 y React Query
- **Decisión:** Migrar todo el frontend a **Tailwind CSS v4** con `@tailwindcss/vite`, tokens en `@theme` (colores semánticos, tipografía, radios) y primitivos reutilizables en `src/ui.ts`. Se elimina el CSS artesanal.
- **Decisión:** **TanStack Query** centraliza el estado del servidor: claves por proyecto/recurso, `staleTime`, queries para proyectos/workflow/runs/agentes/modelos/chat/notebooks/ajustes/salud, mutations con invalidación selectiva y actualización de cache en eventos SSE. Al cerrar sesión se limpia la cache.
- **Decisión:** Revisión de diseño con breakpoints 390/1440, foco visible, modales con foco inicial/Escape, estados con texto además de color, paleta de nodos responsive, fit view y minimapa reducido. Monaco se carga de forma lazy con fallback a textarea si el CDN no responde en 6s.
- **Por qué:** Tailwind da consistencia y velocidad de iteración; React Query evita duplicar estado y mantiene la UI sincronizada sin refetch manual.

## Risks / Trade-offs

- **[Riesgo] Bloqueo de cuenta en WhatsApp no oficial (Baileys)** → **Mitigación:** Diseñar `WhatsAppAdapter` detrás de `IChannelEgressPort` soportando tanto **Baileys (QR personal)** con rate-limiting de salida y simulación de escritura humana (`sendPresenceUpdate`), como **WhatsApp Cloud API oficial de Meta** mediante configuración de credenciales en la bóveda.
- **[Riesgo] Código infinito o alto consumo de memoria en un nodo `.ts` generado por el agente** → **Mitigación:** Ejecutar cada nodo `code` en un `Worker` de Bun separado con `AbortSignal.timeout` estricto (por defecto 30s) y terminación forzada (`worker.terminate()`).
- **[Riesgo] Sesiones huérfanas en OpenCode V2 cuando una app externa abre miles de `externalThreadId`** → **Mitigación:** Incluir TTL de inactividad en `conversation_threads` (por defecto 24h) con compactación o archivado automático de sesiones inactivas.
- **[Riesgo] Fuga de secretos en logs o en Sentry** → **Mitigación:** Configurar `redact` en Pino y `beforeSend` en `@sentry/bun` y `@sentry/react` para limpiar cabeceras, tokens y cualquier valor registrado en `Aes256GcmVaultAdapter` antes de serializar o enviar telemetría.
- **[Riesgo] Shell con acceso a proyectos hermanos** → **Mitigación:** Permisos de archivos por proyecto + scope de API/plugin; documentar que el shell es una capacidad de confianza y planificar un sandbox/contenedor por proyecto para aislamiento fuerte.
- **[Riesgo] Monaco depende de un CDN** → **Mitigación:** carga lazy con fallback a textarea a los 6s; empaquetar Monaco localmente si el despliegue es air-gapped.
- **[Riesgo] `ProjectPage` concentra demasiada UI** → **Mitigación:** extraer paleta, inspector, runs y agentes a componentes separados en una siguiente iteración; la suite E2E cubre el flujo actual.

## Migration Plan

1. **Despliegue inicial (Greenfield):**
   - Construir la imagen Docker multi-stage (compila `apps/web`, prepara `apps/server` y `packages/*`, instala el binario de `opencode` V2).
   - Montar el volumen persistente en `/data` dentro de EasyPanel o `docker-compose.yml`.
2. **Secuencia de Arranque (`entrypoint.sh` / `BootstrapSystemUseCase`):**
   - Crea subdirectorios `/data/{db,workspaces,knowledge,channels,opencode}`.
   - Ejecuta migraciones de Drizzle ORM de forma transaccional, incluyendo `chat_messages` y las columnas `agent_id`/`logs` de `workflow_step_runs`; backfill de permisos en los `opencode.jsonc` existentes.
   - Si no existe `/data/master.key`, genera 32 bytes criptográficos (`0600`).
   - Si la tabla `users` está vacía, crea el usuario `admin` con `mustChangePassword = true`.
   - Inicia o conecta el servicio `opencode serve --service` y levanta el servidor Hono en el puerto `3000`.
   - Aplica `AGENT_CHAT_TIMEOUT_MS` (15 min por defecto) al chat del proyecto.
3. **Rollback:**
   - Antes de aplicar migraciones de esquema en actualizaciones futuras, el arranque realiza un backup automático instantáneo de `/data/db/platform.sqlite` a `/data/db/backups/platform-<timestamp>.sqlite`.
