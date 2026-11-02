# Proposal

## Why

Los orquestadores visuales tradicionales (como n8n) ejecutan grafos rígidos donde la IA es un simple nodo aislado, mientras que los asistentes agénticos (como OpenClaw o Hermes) operan por chat sin un lienzo visual compartido ni garantías empresariales de observabilidad, pruebas y aislamiento. Construir una plataforma de automatización agéntica sobre **OpenCode V2** con **Arquitectura Hexagonal** permite que el usuario y el Agente Principal co-diseñen y ejecuten flujos compuestos por nodos de código (`.ts`) y equipos de sub-agentes por categoría/rol (`.md`), fundamentados en bancos de información estilo NotebookLM, accesibles desde Web, WhatsApp, Telegram o el chat de cualquier aplicación externa, y listos para desplegarse desde el día uno en Docker/EasyPanel con observabilidad, captura de errores y pruebas automatizadas de extremo a extremo.

## What Changes

- **Monorepo Full-Stack bajo Arquitectura Hexagonal (Bun + Hono + React/Vite):**
  - Creación de la estructura base desacoplada en capas (`domain`, `application/ports`, `infrastructure/adapters`) para el servidor en Bun + Hono, el cliente web en React + Vite + **Tailwind CSS v4** + **React Query** + `@xyflow/react` + Monaco Editor, el paquete de contratos compartidos (`@platform/shared`) y el plugin nativo de servidor de OpenCode V2 (`@platform/opencode-plugin`).
- **Despliegue First-Boot en Docker / EasyPanel y Bóveda de Secretos (`identity-and-bootstrap`):**
  - Contenedor Docker unificado con volumen persistente `/data` que en el primer arranque autogenera la llave maestra (`AES-256-GCM`) y crea un usuario administrador por defecto (`admin` con cambio obligatorio de contraseña en el primer inicio de sesión).
  - Configuración 100% desde la interfaz web para conectar la API de **OpenCode Go** (y otros proveedores), seleccionar un **modelo global por defecto**, gestionar credenciales encriptadas en la bóveda y registrar pools de conexión a bases de datos externas (PostgreSQL, MySQL, MSSQL, SQLite) sin exponer secretos al LLM.
- **Motor de Flujos Bidireccional en Disco (`workflow-and-workspace-engine`):**
  - Cada proyecto/automatización vive en `/data/workspaces/<project-slug>/` con su `workflow.json`, archivos `nodes/*.ts` y configuración `opencode.jsonc`.
  - Sincronización en tiempo real vía SSE (`filesystem.changed` y eventos de sesión de OpenCode V2) para que tanto el Agente Principal desde el chat como el usuario desde el canvas visual puedan crear, editar, corregir y ejecutar flujos sobre los mismos archivos.
  - Ejecutor de flujos con estado por paso (checkpointing en SQLite WAL con Drizzle ORM; PostgreSQL del store queda diferido), claves de idempotencia atómicas, reintentos desde el nodo fallido y ejecución aislada de nodos de código en Bun Workers con `AbortSignal.timeout`.
- **Catálogo de Nodos Ampliado y Trazabilidad (`workflow-and-workspace-engine`):**
  - Nodos `http`, `delay`, `transform` y `decision` con condición visual (sin código), además de trigger, code, agent y approval. Canvas con tarjetas por tipo, iconos, handles sí/no y estado en vivo.
  - Cada paso guarda entrada, salida, logs, modelo y sub-agente; la UI muestra el detalle de la ejecución, el resultado final y permite reintentar desde cualquier paso.
- **Aislamiento y Sesiones por Proyecto (`project-isolation`):**
  - Cada proyecto tiene su propia sesión de chat e historial persistente; el agente solo ve su directorio y sus herramientas/API quedan limitadas por `x-platform-project` (403 fuera del proyecto).
  - Chat de proyecto con SSE, heartbeats y timeout configurable (15 minutos por defecto).
- **Experiencia Web con Tailwind CSS y React Query:**
  - Migración completa a Tailwind CSS v4 con tokens de diseño, componentes responsive, modales por sección de Ajustes y selector de modelo global por defecto.
  - Cache de estado del servidor con React Query (queries, mutations, invalidación e integración con SSE).
- **Catálogo de Sub-agentes por Categoría/Rol y Plugin Nativo (`multi-agent-catalog`):**
  - Gestión visual y por chat de sub-agentes definidos en `.opencode/agents/<categoria>/<rol>.md` con selección granular de modelo por flujo, nodo o sub-agente (incluyendo modelos de `opencode-go`), permisos aislados y servidores MCP por proyecto.
  - Plugin nativo `@opencode/plugin` que registra herramientas del namespace `platform_*` (`platform_workflow_list`, `platform_workflow_upsert`, `platform_workflow_trigger`, `platform_kb_search`, `platform_db_query`, `platform_notify`) para que OpenCode controle toda la plataforma.
- **Bancos de Información estilo Google NotebookLM (`knowledge-base-notebooks`):**
  - Creación de "Notebooks" documentales (PDF, DOCX, CSV, Markdown, TXT, URLs) con extracción a Markdown limpio, generación automática de ficha resumen de cada fuente, chunking semántico con metadatos de página/sección e índice de búsqueda híbrida (`sqlite-vec` + `FTS5` por defecto, o `pgvector` + `tsvector` en PostgreSQL).
  - Asignación de Notebooks a sub-agentes y nodos para respuestas fundamentadas con citas exactas de la fuente.
- **Pasarela Omnicanal y API de Chat para Aplicaciones Externas (`omnichannel-and-chat-gateway`):**
  - Doble capa para **WhatsApp** y **Telegram**: (1) canal directo con el Agente Orquestador Global protegido por `Admin Allowlist` para pedir reportes, consultar el estado de flujos o aprobar permisos (`Human-in-the-Loop`), y (2) nodos Trigger/Acción dentro de las automatizaciones.
  - **API Gateway de Chat Externo (`/api/v1/channels/:channelSlug/messages`):** Permite que cualquier aplicación externa con su propio chat converse con un nodo o flujo específico mediante REST, SSE Streaming o Webhooks, manteniendo la memoria conversacional mediante el mapeo persistente `externalThreadId <-> opencodeSessionId`.
- **Sistema de Pruebas TDD, Telemetría y Captura de Errores con Inicio de Sesión (`observability-and-testing-harness`):**
  - Pirámide de pruebas automatizadas con **Vitest** (unitarias de dominio puro, pruebas de contrato de API/Plugin e integración con SQLite en memoria) y **Playwright** (flujos críticos E2E en navegador).
  - Captura de errores y rendimiento de extremo a extremo integrando **Sentry SDK (`@sentry/bun` y `@sentry/react`)** compatible tanto con **Sentry Cloud** (donde inicias sesión en `sentry.io` para revisar la salud, excepciones y trazas de tu app) como con **GlitchTip / Bugsink** autoalojado, complementado con un **Panel Interno de Salud y Diagnóstico (`/system/health`)**, logs estructurados en JSON (Pino) con `requestId` + `entryPoint`, métricas RED/USE y trazas OpenTelemetry.

## Capabilities

### New Capabilities
- `identity-and-bootstrap`: Aprovisionamiento First-Boot en Docker/EasyPanel, autenticación con rotación forzada de contraseña inicial, bóveda encriptada AES-256-GCM, conexión con OpenCode Go y pools de bases de datos externas.
- `workflow-and-workspace-engine`: Espacios de trabajo en disco por proyecto, edición bidireccional Chat/Canvas (`workflow.json` y `nodes/*.ts`), ejecución aislada en Bun Workers, checkpointing por paso, idempotencia y reintentos.
- `multi-agent-catalog`: Sistema de sub-agentes por categoría y rol basados en archivos `.opencode/agents/<categoria>/<rol>.md`, selección de modelo por flujo/nodo, gestión de MCPs y plugin de herramientas `platform_*`.
- `knowledge-base-notebooks`: Bancos de información estilo NotebookLM con ingesta documental, resúmenes de fuentes, búsqueda híbrida vectorial + texto completo y fundamentación con citas para sub-agentes.
- `omnichannel-and-chat-gateway`: Enrutamiento de doble capa para WhatsApp y Telegram (Orquestador Global + Flujos), aprobaciones interactivas y pasarela API/SSE para conectar chats de aplicaciones externas con sesiones persistentes.
- `observability-and-testing-harness`: Arquitectura de pruebas TDD (Vitest + Playwright), instrumentación estructurada con `requestId`/`entryPoint`, métricas RED/USE, integración con Sentry (`@sentry/bun` + `@sentry/react`) y panel interno de salud del sistema.
- `project-isolation`: Sesión y chat persistentes por proyecto, historial de mensajes, timeout largo con heartbeats, permisos de archivos por `opencode.jsonc` y alcance de herramientas/API para impedir el acceso a proyectos hermanos.

### Modified Capabilities
<!-- No hay capacidades previas en openspec/specs/ -->

## Impact

- **Estructura del Repositorio:** Se introduce un monorepo con `apps/server` (Bun + Hono, Arquitectura Hexagonal), `apps/web` (React + Vite + Tailwind CSS + React Query + `@xyflow/react` + Monaco), `packages/shared` (esquemas Zod y contratos tipados) y `packages/opencode-plugin` (`@opencode/plugin`).
- **Infraestructura y Despliegue:** Se añade `Dockerfile`, `docker-compose.yml` y script de arranque para EasyPanel con persistencia unificada en `/data` y servicio local de OpenCode V2 (`opencode serve --service`).
- **Datos:** Nuevas tablas `chat_messages` y columnas `agent_id`/`logs` en `workflow_step_runs`; migraciones automáticas y backup previo en el arranque. `AGENT_CHAT_TIMEOUT_MS` controla el timeout del chat.
- **Dependencias Clave:** `@opencode/client`, `@opencode/plugin`, `hono`, `drizzle-orm`, `zod`, `@xyflow/react`, `@monaco-editor/react`, `@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite`, `qrcode`, `grammy`, `@whiskeysockets/baileys`, `pino`, `@sentry/bun`, `@sentry/react`, `@opentelemetry/api`, `vitest`, `@playwright/test`.
