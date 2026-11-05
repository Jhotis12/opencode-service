# Proposal

## Why

La configuración de la plataforma está repartida entre variables de entorno, `system_settings`, la bóveda global, `integrations.config`, `projects`, `workflow.json` y varios formularios que repiten los mismos campos. Esa dispersión ya produce fallos concretos: un trigger que se cambia a manual sigue disparando por Telegram porque conserva un `integrationId` viejo; el botón “Probar” de Telegram solo verifica que exista un token; dos integraciones pueden usar el mismo bot y competir por `getUpdates`; y un DSN de Sentry guardado desde la UI nunca se lee al arrancar.

La sensación de “construido para pruebas” no viene del modelo de dominio, que es sólido y ya aísla proyectos, sino de la capa de configuración: hay contratos y adapters, pero la UI, la validación y el ciclo de vida de las conexiones quedaron a medio camino. Es el momento de centralizar porque la rama de transcripción agregará otra integración, otro nodo y otro ajuste por proyecto; sin un registro único, será una quinta superficie que repetirá el problema.

## What Changes

- Introducir un **registro único de configuración** en `packages/shared` para integraciones, nodos, ajustes de proyecto y ajustes de plataforma: esquemas, defaults, metadata de campos, capacidades y validación compartida entre servidor y web.
- Convertir la creación de integraciones en un **editor crear/editar** reutilizado por proyecto y por el orquestador global. Permitir rotar el token de Telegram, cambiar routing, allowlist, acceso público y alertas sin borrar la integración ni cambiar su `integrationId`.
- Endurecer **Telegram**: prueba real con `getMe`, detección de token duplicado por `botId`, manejo del conflicto con webhook, persistencia de `status: error` y `lastError`, y reporte fiel del resultado de conectar.
- Corregir la **configuración de nodos**: el ruteo exige `trigger.kind === "integration"`, el selector solo ofrece canales con `inbound_message`, el evento se elige de un catálogo y cambiar de tipo/kind reemplaza el config en lugar de acumular claves viejas.
- Unificar la superficie de configuración del proyecto en una sola sección “Configuración” con subsecciones de general, conexiones, canales, destinos y secretos; los ajustes de plataforma quedan en “Ajustes”.
- Añadir un **registro de destinos por proyecto** (chat IDs, emails, webhooks etiquetados) reutilizado por allowlist, alertas, aprobaciones y nodos `notify`, manteniendo compatibilidad con valores crudos existentes.
- Exponer una **configuración efectiva** que resuelva entorno, base y bóveda, enmascare secretos e indique la fuente y si requiere reinicio.
- Corregir la aplicación de **Sentry desde la UI**, retirar o cablear variables muertas (`DATABASE_URL`, `SESSION_TTL_HOURS`) y alinear `docker-compose.yml` con las variables documentadas.
- **BREAKING (validación):** los triggers con eventos no soportados o integraciones que no sean canales de entrada pasan a rechazarse al guardar, en lugar de guardarse y fallar silenciosamente en runtime.

## Capabilities

### New Capabilities

- `configuration-registry`: contrato único de configuración para integraciones, nodos, ajustes de proyecto y plataforma; esquemas, defaults, metadata de campos, resolución de valores efectivos y validación compartida entre servidor y UI.

### Modified Capabilities

- `project-resources`: edición y ciclo de vida de integraciones, pruebas reales de conexión, estado y último error visibles, superficies de configuración unificadas, destinos por proyecto y unicidad de credenciales de canal.
- `workflow-and-workspace-engine`: configuración tipada de nodos, validación de triggers por kind/capacidad/evento, reseteo de config al cambiar de tipo y formularios derivados del registro.
- `omnichannel-and-chat-gateway`: ciclo de conexión de Telegram con `getMe`, conflicto de webhook, token duplicado, catálogo de eventos y estado de conexión reportado al usuario.
- `global-orchestrator`: canales globales editables y probados con el mismo editor y contrato que los canales de proyecto.
- `observability-and-testing-harness`: el DSN de Sentry guardado desde Ajustes se aplica al arrancar, y el estado/último error de las integraciones es visible en salud y logs.

## Impact

- **Shared:** nuevo registro de configuración y metadata de campos; esquemas de nodo e integración reutilizados por servidor y web; contratos de configuración efectiva.
- **Servidor:** validación de integraciones y nodos contra el registro; `ManageIntegrationsUseCase` con edición, prueba real y unicidad de bot; `IntegrationManager` con estados `error`/`needs_config` y `lastError`; router de canales con validación de `kind`; `SessionCodec` y Sentry cableados a su configuración efectiva.
- **Base de datos:** tabla aditiva `project_destinations`; sin migración destructiva. Los valores crudos existentes siguen siendo válidos y se pueden adoptar como destinos etiquetados.
- **API:** nuevos endpoints de configuración efectiva, destinos y edición de integraciones; se mantienen los endpoints actuales para no romper el plugin ni la UI.
- **Web:** editor compartido de integraciones, inspector de nodos derivado del registro, sección única “Configuración” por proyecto, picker de destinos y vista de estado/último error de conexión.
- **Configuración y operación:** Sentry aplicado desde la bóveda, `ORCHESTRATOR_MODEL` editable con fallback a entorno, variables muertas eliminadas o cableadas, `docker-compose.yml` alineado con `.env.example`.
- **Pruebas:** unitarias del registro y validación de triggers; integración de edición/prueba real de Telegram con transporte falso; contratos de configuración efectiva; E2E de edición de canal, rotación de token y trigger manual que no dispara por Telegram.
- **Fuera de alcance:** implementación de media/transcripción, adaptador de email, ruteo de múltiples workflows por canal y portabilidad/exportación de un proyecto como manifiesto. La configuración de transcripción de la rama `add-transcription-nodes-and-channel-media` se absorberá en el registro cuando se mergee, sin crear una superficie paralela.
