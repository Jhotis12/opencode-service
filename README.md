# Agentic Platform

Plataforma de automatizaciones agénticas sobre **OpenCode V2**: proyectos en disco, nodos de código y sub-agentes Markdown por categoría/rol, bancos de información estilo NotebookLM, canales WhatsApp/Telegram y una API de chat para aplicaciones externas. Construida con **Bun + Hono** (arquitectura hexagonal) y **React + Vite** (React Flow + Monaco), empaquetada para Docker/EasyPanel.

## Inicio rápido (Docker)

```bash
docker compose up --build -d
```

Abre `http://localhost:3001` (el contenedor escucha en `3000`; el host usa `3001` para no chocar con Supabase/Next). Si `3001` también está ocupado: `HOST_PORT=3002 docker compose up -d`.

- Usuario inicial: `admin`
- Contraseña inicial: `admin123!` (o `INITIAL_ADMIN_PASSWORD`)
- En el primer ingreso la app obliga a cambiarla (mínimo 12 caracteres).
- Todos los datos viven en el volumen `platform-data` montado en `/data`:
  `db/`, `workspaces/`, `knowledge/`, `channels/`, `opencode/`, `master.key`.

### EasyPanel

1. Crea un servicio **Docker** apuntando a este repositorio (o sube la imagen).
2. Monta un volumen persistente en `/data`.
3. Expón el puerto `3000` del contenedor (el `docker-compose.yml` lo publica en `HOST_PORT`, por defecto `3001`).
4. Variables opcionales: `INITIAL_ADMIN_PASSWORD`, `SENTRY_DSN`, `EMBEDDINGS_URL`, `EMBEDDINGS_API_KEY`, `PLATFORM_SERVICE_TOKEN`, `AGENT_CHAT_TIMEOUT_MS` (15 min por defecto).
5. Tras el despliegue, entra con `admin` y la clave inicial; el asistente de rotación y la pantalla de **Ajustes** permiten configurar OpenCode Go, la bóveda, bases de datos, canales y Sentry.

El contenedor instala el CLI de OpenCode V2 (`@opencode/cli`) y el servidor lo descubre/inicia con `Service.ensure()`. En desarrollo o pruebas sin el CLI usa `OPENCODE_MODE=fake`.

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
bun test --cwd apps/server # dominio, adaptadores, HTTP e integración (Bun)
bun run test               # servidor + contratos + UI (Vitest)
bun run test:e2e           # Playwright: first boot, canvas, sub-agentes, chat externo y salud
```

La suite E2E arranca el servidor con `OPENCODE_MODE=fake` y un `/data` limpio en `/tmp`.

## Arquitectura

```text
apps/server/src/
├── domain/          # reglas puras: workflow, agentes, conocimiento, canales, telemetría
├── application/     # puertos + casos de uso
└── infrastructure/  # Hono, OpenCode V2, SQLite/Drizzle, workers Bun, canales, bóveda
apps/web/            # React + Vite + Tailwind CSS + React Query + React Flow + Monaco
packages/shared/     # contratos Zod compartidos
packages/opencode-plugin/  # herramientas platform_* dentro de OpenCode V2
```

- Cada proyecto: `/data/workspaces/<slug>/{workflow.json,nodes/*.ts,.opencode/agents/<categoria>/<rol>.md,opencode.jsonc}`.
- Cada proyecto tiene su propia **sesión de chat** y su propio `opencode.jsonc` con permisos de lectura/edición limitados a su directorio; el agente de un proyecto no puede leer ni modificar proyectos hermanos. Los comandos de shell siguen siendo una capacidad de confianza dentro del contenedor.
- El agente y el canvas editan los mismos archivos; los cambios viajan por SSE.
- Catálogo de nodos: trigger, HTTP Request, código, transformación, espera, agente, condición visual y aprobación.
- Ejecución de nodos `code` en workers Bun aislados con timeout; checkpoints por paso con entradas/salidas/logs, idempotencia atómica y replay desde cualquier paso.
- El chat del proyecto usa SSE con heartbeats y un timeout configurable (`AGENT_CHAT_TIMEOUT_MS`, 15 minutos por defecto).
- Bóveda AES-256-GCM; el LLM nunca recibe secretos, solo alias.
- Notebooks: extracción a Markdown, resumen, chunks con citas y búsqueda híbrida (FTS5 + vectores; degrada a BM25 sin embeddings).
- Observabilidad: logs JSON con `requestId`/`entryPoint`, métricas RED, panel `/system/health`, Sentry/GlitchTip opcional.

## Canales y chat externo

- Telegram/WhatsApp: capa global (admin allowlist → Agente Orquestador) y triggers públicos por flujo. Aprobaciones: `/approve <runId> <nodeId>` y `/reject …`.
- WhatsApp usa Baileys (QR) por defecto; instala `@whiskeysockets/baileys` si quieres el modo QR, o configura `mode: "cloud"` con las credenciales de Meta.
- API de aplicaciones externas:

```bash
curl -X POST http://localhost:3001/api/v1/channels/mi-app/messages \
  -H "content-type: application/json" \
  -H "x-channel-key: sk_chat_..." \
  -d '{"threadId":"cliente-42","message":"Hola"}'
```

Con `Accept: text/event-stream` responde por SSE; con `webhookUrl` entrega el resultado firmado con `x-platform-signature: sha256=…`.

## Seguridad

- Cookies de sesión `httpOnly`/`sameSite`; rate limit en login (10 intentos/15 min).
- Validación Zod en los bordes, SQL parametrizado en bases externas y allowlist de IPs públicas para ingesta de URLs (anti-SSRF).
- Path traversal bloqueado con resolución de symlinks en workspaces.
- Ejecuta los workers con timeout; el contenedor es el sandbox de confianza.
- Nunca subas `.env`, `/data` ni `master.key` al repositorio.
