# Proposal

## Why

La plataforma tiene hoy dos modelos mezclados: los flujos, nodos y agentes viven por proyecto, pero los canales, bases de datos, notebooks y secretos viven en una configuración global. Eso obliga a configurar cada caso de uso en dos lugares, permite que dos proyectos declaren el mismo canal y compitan por el mismo mensaje, y hace que los nodos referencien recursos por texto libre sin validar su existencia ni su pertenencia. Además, el chat del proyecto usa el agente de código por defecto de OpenCode y no existe un agente separado con contexto de todos los proyectos para reportar fallos o responder preguntas globales.

Este cambio convierte al proyecto en la unidad de propiedad de todos sus recursos y separa explícitamente el plano de proyecto del plano de control global. Es el momento de hacerlo porque todavía no hay una capa de compatibilidad que mantener y porque el modelo actual bloquea la incorporación futura de email, nuevas integraciones y un orquestador global confiable.

## What Changes

- **BREAKING** — Cada proyecto es dueño de sus integraciones (Telegram, WhatsApp, chat externo, bases de datos y futuras integraciones como email), de sus notebooks, de sus secretos y de sus ajustes. Los canales, bases de datos y notebooks globales desaparecen como concepto de proyecto.
- **BREAKING** — Se reemplaza `channels` y `external_databases` por un modelo único de `Integration` con `scope` (`project` o `global`), `kind`, `capabilities`, `config` y `secretRefs`. Los nodos referencian `integrationId` estable, no `channelSlug`.
- **BREAKING** — El conocimiento se mueve dentro de cada proyecto: `notebooks.project_slug`, archivos bajo `knowledge/` del workspace y endpoints scoped por proyecto. La página global de Bancos de Información se elimina.
- **BREAKING** — La bóveda pasa a tener scope de proyecto. Los secretos globales quedan reservados para proveedores, Sentry y el orquestador.
- **BREAKING** — Se unifica el historial de conversaciones en hilos (`chat_threads`) para chat de proyecto, chat del orquestador y conversaciones de canales. Se elimina el caso especial `projects.chat_session_id`.
- **BREAKING** — El ruteo de canales deja de escanear todos los proyectos. Cada integración pertenece a un proyecto o al plano global y el ruteo es determinista por `integrationId` y evento.
- Se introduce el **orquestador global** como un workspace separado (`/data/control`) con agente propio, canales globales configurados en Ajustes, herramientas de consulta cross-project y alertas deterministas de fallos, canales caídos y salud degradada. Es independiente de los agentes de proyecto.
- Se agrega un **agente principal por proyecto** con `AGENTS.md`, `default_agent` y un perfil Markdown propio; el chat deja de hablar como el agente de código por defecto.
- Se mejora la **experiencia de chat**: renderizado Markdown/GFM con tablas y código, estados de carga/error, y superficie acoplada, expandida o minimizada/burbuja.
- Se agrega un **contrato de ejecución manual**: `inputSchema` en el trigger, formulario generado, validación en servidor antes de ejecutar, `launchedBy`, `graphHash`, `integrationId` de origen y devolución inmediata del `runId`.
- Se agrega un **nodo `validate`** opcional para reglas declarativas en cualquier punto del flujo, reutilizando el mismo esquema de validación de entrada.
- Se prepara el modelo de integraciones para **email futuro** (SMTP/IMAP) sin crear otra tabla ni otro concepto: email será un `kind` con capacidades `send_email`/`read_email`.
- Se agrega el **ciclo de vida del proyecto**: creación guiada con nombre, slug automático, descripción y validación; eliminación administrativa con confirmación escrita y borrado en cascada de workspace, workflow, agentes, conocimiento, integraciones, secretos, chats y ejecuciones.
- Se persiste el estado de OpenCode en `/data/opencode` (`OPENCODE_DB`), se restauran las API keys de proveedor desde la bóveda al arrancar y el chat recupera automáticamente sesiones huérfanas después de un reinicio.
- Se reorganiza el canvas para acercarlo a n8n: paleta lateral agrupada, inspector de nodo en panel inferior con última ejecución, chat en drawer lateral y formularios guiados para canales de proyecto.
- Se restringe el flujo a **un único trigger ejecutable**: se rechazan triggers duplicados y los tipos `schedule`/`webhook` mientras no exista un ejecutor real.
- Se elimina la capa legacy: no se mantienen endpoints, tablas ni adapters de compatibilidad. Si existen datos, se migran una sola vez y luego se borra el modelo anterior.

## Capabilities

### New Capabilities

- `project-resources`: propiedad, ciclo de vida, validación y uso de integraciones, secretos, conexiones y ajustes dentro de cada proyecto, incluyendo canales con modos agente/flujo/híbrido.
- `global-orchestrator`: plano de control separado con agente propio, canales globales, consultas cross-project de solo lectura y alertas deterministas de fallos y salud.
- `agent-chat-experience`: agente principal por proyecto, instrucciones de comunicación orientadas al negocio, chat Markdown accesible y superficie de chat acoplada, expandida y minimizada.

### Modified Capabilities

- `knowledge-base-notebooks`: los notebooks, fuentes, chunks y búsquedas pasan a ser propiedad y ámbito de un proyecto; el orquestador global puede consultarlos de forma transversal solo lectura.
- `omnichannel-and-chat-gateway`: se separan canales de proyecto y canales globales; se agregan modos `agent`, `workflow` y `hybrid`; el ruteo deja de escanear todos los proyectos; el chat externo usa integraciones scoped.
- `project-isolation`: se extiende el aislamiento a integraciones, secretos, notebooks, conexiones e historial; se formaliza la autenticación separada del orquestador global; se unifican hilos de chat.
- `workflow-and-workspace-engine`: triggers referencian integraciones, se agrega `inputSchema`, validación de entrada, nodo `validate`, metadata de procedencia del run y devolución inmediata del identificador.
- `multi-agent-catalog`: se agrega el agente principal del proyecto, `default_agent`, `AGENTS.md`, edición de modo `primary` y separación entre agentes de proyecto y agente del orquestador.
- `identity-and-bootstrap`: la bóveda y las conexiones externas pasan a scope de proyecto; se agrega el workspace del orquestador global y el aprovisionamiento de agentes principales por proyecto.
- `observability-and-testing-harness`: se agregan eventos de ciclo de vida de integraciones, alertas deterministas con deduplicación y throttle, atribución de entry point global y pruebas de aislamiento, migración y experiencia de chat.

## Impact

- **Base de datos:** nuevas tablas `integrations` y `chat_threads`; columnas `project_slug` en `notebooks` y `vault_secrets`; metadata de procedencia en `workflow_runs`; eliminación de `channels`, `external_databases` y del uso global de notebooks. Migración única con backup y verificación.
- **Backend:** nuevos dominios y casos de uso para recursos, integraciones, orquestador y alertas; `IntegrationManager` reemplaza `ChannelManager`; `RouteIncomingMessageUseCase` se divide en ruteo de proyecto y ruteo global; el executor valida input y persiste procedencia; el proveedor de agentes selecciona el agente principal del proyecto.
- **API:** endpoints scoped por proyecto para integraciones, notebooks, secretos y conexiones; endpoints de control para canales globales, chat del orquestador y alertas; se eliminan los endpoints globales de canales, bases y notebooks de proyecto.
- **Frontend:** Proyecto con pestañas Canvas, Ejecuciones, Agentes, Conocimiento, Recursos y Ajustes; Ajustes queda para plataforma y canales del orquestador; nueva página Orquestador; chat Markdown y redimensionable.
- **Plugin OpenCode:** herramientas de proyecto con scope obligatorio y herramientas globales separadas; autenticación explícita para distinguir proyecto de plano de control.
- **Pruebas:** unitarias de validación de recursos, integración de ruteo determinista, aislamiento cross-project, validación de input, alertas con throttle, migración y E2E de configuración de proyecto, chat y orquestador.
- **OpenCode y persistencia:** `OPENCODE_DB=/data/opencode/opencode.db`, `XDG_STATE_HOME=/data/opencode/state`, restauración de API keys de proveedor al arrancar y recuperación de sesiones huérfanas en el chat.
- **Experiencia web:** pantalla de Proyectos rediseñada (modal de creación, descripción, slug automático, búsqueda, estado vacío y borrado confirmado), paleta lateral, inspector inferior y chat en drawer.
- **Operación:** nuevo `DELETE /api/projects/:slug` solo para administradores, borrado en cascada y detención previa de integraciones del proyecto.
- **Documentación:** README, design.md y las specs afectadas se actualizan para eliminar el modelo global anterior.
- **Supuestos registrados:** un proyecto representa un caso de uso con un flujo principal y exactamente un trigger ejecutable; los recursos se almacenan en base con `project_slug` y la exportación/portabilidad como manifiesto queda diferida; el orquestador global es de solo lectura por defecto; email no se implementa en este cambio, pero el modelo de integraciones lo admite desde el inicio.
