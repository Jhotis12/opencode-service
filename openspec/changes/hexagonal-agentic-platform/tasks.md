# Tasks

## 1. Monorepo Scaffolding, Contratos Compartidos y Base de Telemetría

- [x] 1.1 Inicializar el monorepo con Bun Workspaces (`package.json` raíz, `tsconfig.base.json`, `apps/server`, `apps/web`, `packages/shared`, `packages/opencode-plugin`) y verificar que `bun install` y `bun run typecheck` finalizan con código 0.
- [x] 1.2 Implementar en `packages/shared` los esquemas Zod y contratos tipados (`APIError`, paginación, `WorkflowGraphSchema`, `NodeSpecSchema`, `SubagentFrontmatterSchema`, `EntryPointType`, eventos SSE) y verificar que las pruebas de contrato en `packages/shared/test/contracts.test.ts` pasan con `bun run test`.
- [x] 1.3 Implementar el núcleo de telemetría en `apps/server/src/domain/telemetry` y `apps/server/src/infrastructure/out/telemetry` (logger estructurado JSON con Pino, propagación de `requestId` + `runId` + `entryPoint`, redacción de secretos, histogramas RED/USE y adaptador `@sentry/bun` con `beforeSend` sanitizado) y verificar con pruebas unitarias/integración que ningún campo secreto aparece en los logs ni en payloads de Sentry.

## 2. Identidad, Bóveda AES-256-GCM, First-Boot y Conexiones Externas (`identity-and-bootstrap`)

- [x] 2.1 Configurar Drizzle ORM en `apps/server/src/infrastructure/out/persistence` (modo SQLite WAL por defecto en `/data/db/platform.sqlite` y soporte opcional PostgreSQL) con tablas para `users`, `vault_secrets`, `external_databases`, `system_settings` y `system_error_events`, verificando las migraciones contra SQLite en memoria en `persistence.test.ts`.
  - Decisión de alcance: la base de datos de la plataforma es SQLite WAL en este change. El PostgreSQL opcional del store queda como mejora de seguimiento (requiere puerto `Store` asíncrono + `PgStore`). Las bases de datos externas PostgreSQL/MySQL/MSSQL/SQLite sí están soportadas por alias para los flujos.
- [x] 2.2 Implementar el dominio y adaptador `Aes256GcmVaultAdapter` junto con `BootstrapSystemUseCase` (creación de `/data/master.key`, creación del usuario `admin` inicial con `mustChangePassword = true` cuando no existen usuarios) y verificar con pruebas unitarias e integración los escenarios de primer arranque y reinicio con volumen existente.
- [x] 2.3 Implementar autenticación HTTP (login con Argon2id, cookies `httpOnly`/`sameSite`, middleware que bloquea rutas con `403 PASSWORD_CHANGE_REQUIRED` mientras `mustChangePassword = true`, endpoint de cambio de contraseña y rate-limiting en auth) y verificar todos los casos con pruebas de integración HTTP en `auth.routes.test.ts`.
- [x] 2.4 Implementar los casos de uso y adaptadores para conectar **OpenCode Go** (y otros proveedores vía `@opencode/client`) y el pool dinámico de bases de datos externas (`DynamicDatabaseClientAdapter` con prueba de salud de 5s y resolución por alias desde la bóveda), verificando su comportamiento con pruebas de integración y documentando las variables de entorno opcionales en `.env.example`.

## 3. Espacios de Trabajo en Disco y Motor de Flujos con Bun Workers (`workflow-and-workspace-engine`)

- [x] 3.1 Implementar el dominio `workflow` (validación del grafo DAG, detección de ciclos, primitivas de nodos `trigger`, `code`, `agent`, `decision`, `approval` y modelo de `StepCheckpoint` e `IdempotencyRecord`) y verificar todas las invariantes con pruebas unitarias en `domain/workflow/workflow.test.ts`.
- [x] 3.2 Implementar `SafeFsWorkspaceAdapter` para gestionar proyectos en `/data/workspaces/<project-slug>/` (`opencode.jsonc`, `workflow.json`, `nodes/*.ts`) con resolución de symlinks y bloqueo estricto de path traversal (`403 FORBIDDEN_PATH`), verificando con pruebas de seguridad e integración sobre un directorio temporal.
- [x] 3.3 Implementar `BunWorkerPoolAdapter` para ejecutar nodos `code` (`nodes/*.ts`) en workers aislados con `AbortSignal.timeout`, exponiendo el contexto RPC seguro (`ctx.db(alias)`, `ctx.http`, `ctx.notify`, `ctx.log`) sin filtrar secretos en texto plano, y verificar con pruebas de ejecución exitosa, error y timeout forzado.
- [x] 3.4 Implementar `ExecuteWorkflowRunUseCase` y `ReplayWorkflowRunUseCase` con reclamación atómica de `Idempotency-Key` (constraint único, validación de hash de payload y respuesta `409 Conflict` en vuelo), guardado de checkpoints por nodo y emisión de eventos SSE en vivo, verificando cada escenario con pruebas de integración.

## 4. Catálogo de Sub-agentes Markdown, Modelos por Nodo y Plugin Nativo de OpenCode V2 (`multi-agent-catalog`)

- [x] 4.1 Implementar `OpenCodeV2Adapter` (`@opencode/client` + `Service.ensure()` de `@opencode/client/service`) para descubrir/iniciar el demonio local de OpenCode V2, listar modelos (`opencode-go` y otros), cambiar modelo/agente por sesión y suscribirse al stream de eventos SSE, verificando su contrato mediante pruebas de adaptador.
- [x] 4.2 Implementar `MarkdownAgentAdapter` y los casos de uso para listar, crear, validar y editar sub-agentes jerárquicos en `.opencode/agents/<categoria>/<rol>.md` y servidores MCP en `opencode.jsonc` con recarga en caliente (`POST /api/location/reload`), verificando con pruebas de integración la lectura/escritura de frontmatter YAML + cuerpo Markdown.
- [x] 4.3 Implementar en `packages/opencode-plugin` las herramientas del namespace `platform_*` (`platform_workflow_list`, `platform_workflow_upsert`, `platform_workflow_trigger`, `platform_workflow_runs`, `platform_subagent_upsert`, `platform_kb_search`, `platform_db_query`, `platform_notify`, `platform_health_summary`) usando `ctx.tool.transform`, y verificar con pruebas de contrato que cada herramienta valida sus entradas y delega en los casos de uso correspondientes.

## 5. Bancos de Información Estilo NotebookLM (`knowledge-base-notebooks`)

- [x] 5.1 Implementar el pipeline de ingesta documental en `domain/knowledge` y `infrastructure/out/knowledge-index` (extracción a Markdown de PDF, DOCX, CSV, MD, TXT y URLs con protección anti-SSRF que bloquea IPs privadas/loopback con `422 UNSAFE_URL`, resumen automático de la fuente y chunking semántico con metadatos de sección/página) y verificar con pruebas unitarias y de seguridad SSRF.
- [x] 5.2 Implementar el motor de búsqueda híbrida (`SqliteVecFtsAdapter` con `sqlite-vec` + `FTS5` y fusión RRF, con degradación limpia a BM25 si no hay embeddings configurados) y la vinculación de Notebooks a sub-agentes/nodos con citas verificables y modo `strictGrounding`, verificando la recuperación y formato de citas con pruebas de integración.

## 6. Pasarela Omnicanal (WhatsApp, Telegram) y API de Chat Externo (`omnichannel-and-chat-gateway`)

- [x] 6.1 Implementar `ChannelRouterUseCase` con validación de `AdminAllowlist` (mensajes de administradores van al Agente Orquestador Global; remitentes externos solo disparan triggers públicos autorizados) y soporte de aprobaciones interactivas (`Human-in-the-Loop` para nodos `approval` y eventos `permission.asked` de OpenCode), verificando ambos caminos con pruebas unitarias y de abuso.
- [x] 6.2 Implementar `TelegramGrammyAdapter` y `WhatsAppBaileysAdapter` (con generación de QR hacia la UI web, persistencia de sesión en `/data/channels/whatsapp` y soporte opcional para WhatsApp Cloud API), verificando el flujo de conexión y ruteo mediante pruebas de integración con clientes simulados.
- [x] 6.3 Implementar `ExternalChatHttpAdapter` (`POST /api/v1/channels/:channelSlug/messages`) con autenticación por `X-Channel-Key`, mapeo persistente `externalThreadId <-> opencodeSessionId` en `conversation_threads`, soporte de respuesta JSON o streaming SSE y callback asíncrono firmado con HMAC-SHA256, verificando conversaciones multi-turno con pruebas de integración HTTP/SSE.

## 7. Frontend Web en React + React Flow + Monaco + Panel de Salud (`/system/health`)

- [x] 7.1 Implementar en `apps/web` el flujo de autenticación, pantalla de rotación obligatoria de contraseña inicial (`mustChangePassword`) y el Centro de Configuración (conexión de API Key de OpenCode Go, bóveda de secretos, bases de datos externas, QR de WhatsApp/Telegram y `SENTRY_DSN`), verificando sus componentes con pruebas de Vitest + Testing Library.
- [x] 7.2 Implementar el espacio de trabajo de Proyectos en `apps/web`: selector de proyecto, consola de Chat en vivo con el Agente Principal, canvas visual con `@xyflow/react` sincronizado por SSE (`workflow.updated` y estado de ejecución de cada nodo en tiempo real), selector de modelo (`opencode-go`, etc.) por flujo/nodo y editor lateral con Monaco para nodos `.ts` y perfiles `.md` de sub-agentes por categoría/rol, verificando la sincronización en pruebas de componentes.
- [x] 7.3 Implementar la vista gestora de **Notebooks (Bancos de Información)** (subida de archivos/URLs, visualización de ficha resumen generada, prueba de búsqueda con citas y asignación a sub-agentes) y el **Panel de Salud y Errores (`/system/health`)** con integración de `@sentry/react` (`ErrorBoundary`), estado de servicios, métricas RED p50/p95/p99 e inspector de errores recientes, verificando su renderizado con pruebas de interfaz.

## 8. Contenedorización Docker / EasyPanel y Verificación End-to-End

- [x] 8.1 Crear el `Dockerfile` multi-stage, `docker-compose.yml`, script `entrypoint.sh` con backup automático de SQLite previo a migraciones y `README.md` con guía de despliegue de 1 clic en EasyPanel (volumen `/data`), verificando que la imagen construye y levanta limpiamente.
  - Verificado con `podman build` + `podman run` (el socket de Docker del entorno no era accesible para el usuario) y `docker compose config`; incluye OpenCode CLI 2.2.5 y el plugin `platform-tools` cargado.
- [x] 8.2 Configurar y ejecutar la suite E2E con **Playwright** (`e2e/platform.spec.ts`) verificando el ciclo completo: primer arranque con login `admin`, cambio obligatorio de contraseña, creación de proyecto, generación/edición de nodos en el canvas, creación de sub-agente `.md`, consulta al endpoint de chat externo y apertura de `/system/health` con cero errores en consola del navegador.

## 9. Refinamientos de Producto: Nodos, Trazabilidad, Aislamiento, UI y Cache

- [x] 9.1 Ampliar `NodeTypeSchema` y la validación del grafo con `http`, `delay`, `transform` y `decision` con condición visual (`field`, `operator`, `value`), manteniendo la decisión por código como opción; verificado con pruebas de dominio y de ejecución.
- [x] 9.2 Implementar la ejecución de nodos HTTP (método/URL/headers/body), espera (máx. 60s), transformación con `{{input.campo}}`/mapping y condición visual con ramas `true`/`false`; verificado con pruebas unitarias de ejecución y validación.
- [x] 9.3 Persistir `logs` y `agentId` por paso, exponer `GET /api/runs/:id`, abrir el detalle de ejecución al ejecutar y permitir replay desde cualquier paso; verificado con pruebas de integración, E2E y revisión del modal de detalle.
- [x] 9.4 Añadir la tabla `chat_messages`, historial persistente por proyecto y `GET /api/projects/:slug/chat`; elevar el timeout del chat a 15 min (`AGENT_CHAT_TIMEOUT_MS`) con SSE y heartbeats; verificado con pruebas HTTP, E2E de recarga y SSE en contenedor.
- [x] 9.5 Implementar aislamiento por proyecto: sesión de chat por proyecto, permisos por defecto en `opencode.jsonc`, backfill de proyectos existentes, cabecera `x-platform-project` en el plugin, filtro de proyectos y `403` en lecturas/runs cruzados; verificado con pruebas de integración y smoke de contenedor.
- [x] 9.6 Reemplazar los nodos rectangulares por tarjetas con icono, color por tipo, subtítulo, estado y handles; añadir paleta con descripciones, inspector por tipo, salidas sí/no, fit view y minimapa reducido; verificado con pruebas de UI, E2E de arrastre y capturas desktop/móvil.
- [x] 9.7 Migrar el frontend a **Tailwind CSS v4** con `@tailwindcss/vite`, tokens de diseño en `@theme`, primitivos en `src/ui.ts` y eliminación del CSS artesanal; verificado con build de Vite, capturas a 1440/390 y E2E.
- [x] 9.8 Integrar **TanStack Query** para proyectos, workflow, runs, agentes, modelos, chat, notebooks, ajustes y salud; invalidación por mutations, actualización de cache por SSE y limpieza al cerrar sesión; verificado con pruebas de UI y E2E.
- [x] 9.9 Reorganizar Ajustes en tarjetas con modal por sección, selector de modelo global, estado del proveedor, prueba de bases de datos, guía de uso de canales y credenciales copiables; verificado con pruebas de UI y E2E del modal de canales.
- [x] 9.10 Reconstruir la imagen Docker, validar `docker compose config` y ejecutar el smoke de contenedor (CSS servido, health, chat SSE, permisos y scope); verificado con Podman y la suite completa (10 contratos + 137 servidor + 7 UI + E2E).

## Workflow follow-up

- Ejecutar `openspec validate hexagonal-agentic-platform --strict` para confirmar que todos los artefactos cumplen el esquema antes de iniciar `/opsx-apply`.
- Una vez implementadas y verificadas todas las tareas con `/opsx-apply`, archivar el cambio mediante `/opsx-archive`.
