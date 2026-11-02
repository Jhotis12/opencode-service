# Tasks

## 1. Contratos compartidos y base de datos

- [x] 1.1 Definir en `packages/shared` los esquemas Zod de `Integration` (scope, kind, config discriminada por tipo, capabilities, status, secretRefs), incluyendo el kind `email` como contrato futuro. Verificar con `bun run typecheck` y tests unitarios de esquemas válidos e inválidos.
- [x] 1.2 Definir los contratos de `InputSchema`, `ValidateRule`, procedencia de run, `ChatThread`, `ProjectSettings` y errores de recursos. Verificar con typecheck y tests de serialización/validación.
- [x] 1.3 Crear la migración de expansión: tablas `integrations` y `chat_threads`/`chat_messages`, columnas de scope en `vault_secrets`, `project_slug` en `notebooks`, y procedencia en `workflow_runs`. Verificar la migración sobre base vacía y sobre un fixture legacy, y documentar el rollback por backup.
- [x] 1.4 Implementar los puertos y repositorios de integraciones, hilos de chat, bóveda scoped, notebooks scoped y ajustes de proyecto. Verificar con tests de integración contra SQLite en memoria.
- [x] 1.5 Escribir el test de migración con canales, bases y notebooks legacy y un mapa explícito de asignación. Verificar que no quedan recursos huérfanos, que el backup se crea y que los recursos no asignables se reportan.
- [x] 1.6 Documentar el modelo de datos y las reglas de propiedad en `README.md` o documentación del proyecto. Verificar que los ejemplos y comandos documentados funcionan contra el esquema nuevo.

## 2. Dominio y aplicación de recursos de proyecto

- [x] 2.1 Implementar la validación de dominio de integraciones por kind, capabilities, secretRefs y pertenencia a proyecto. Verificar con tests unitarios de configuraciones válidas e inválidas y de recursos de otro proyecto.
- [x] 2.2 Implementar los casos de uso de recursos de proyecto: listar, crear, actualizar, borrar, probar, conectar y desconectar. Verificar con tests de aplicación y respuestas HTTP 403/404/409/422.
- [x] 2.3 Implementar la bóveda con scope de proyecto y la resolución server-side de secretos. Verificar con tests de aislamiento cross-project y de que la API nunca devuelve el valor plano.
- [x] 2.4 Implementar ajustes de proyecto (modelo por defecto, agente principal, instrucciones) y el cálculo de readiness del proyecto. Verificar con tests de precedencia de modelo y de checklist incompleto/completo.
- [x] 2.5 Implementar la validación de referencias de workflow a integraciones, agentes y notebooks, y la detección de triggers duplicados por integración/evento. Verificar con tests de guardado y ejecución con recursos faltantes o de otro proyecto.
- [x] 2.6 Añadir el contrato de email al esquema y a la validación sin implementar adapters. Verificar con un test que acepta SMTP/IMAP con secretRefs y rechaza configuraciones incompletas, y documentar que el adapter queda para un cambio posterior.
- [x] 2.7 Documentar la API de recursos de proyecto y las reglas de propiedad. Verificar los ejemplos contra el servidor de pruebas y los tests de contrato.

## 3. Conocimiento dentro del proyecto

- [x] 3.1 Mover el almacenamiento de conocimiento a `/data/workspaces/<slug>/knowledge/` y migrar los archivos existentes. Verificar con tests de path traversal, lectura, escritura y borrado dentro del proyecto.
- [x] 3.2 Scopear notebooks, fuentes, chunks, ingesta y búsqueda por proyecto. Verificar con tests de aislamiento sibling y de que un proyecto no puede listar, buscar ni ingerir en otro.
- [x] 3.3 Implementar la búsqueda cross-project de solo lectura para el orquestador, con filtro opcional por proyecto y citas que incluyan el proyecto. Verificar con tests de resultados, citas y denegación de mutaciones.
- [x] 3.4 Cambiar los endpoints de conocimiento a `/api/projects/:slug/notebooks/...` y eliminar los endpoints globales. Verificar con tests de contrato y con la comprobación de que las rutas viejas ya no existen.
- [x] 3.5 Mover la UI de Bancos de Información a la pestaña Conocimiento del proyecto y retirar la página/navegación global. Verificar con tests de UI y un E2E de carga, búsqueda y cita dentro del proyecto.
- [x] 3.6 Documentar la propiedad del conocimiento, la ubicación de archivos y el formato de citas. Verificar que la documentación coincide con los endpoints y con el E2E.

## 4. Runtime de integraciones y ruteo

- [x] 4.1 Implementar `IntegrationManager` con registro project/global, arranque lazy, estado, QR y parada por integración. Verificar con tests de ciclo de vida usando adapters fake y de que una integración caída no afecta a las demás.
- [x] 4.2 Refactorizar los adapters de Telegram, WhatsApp y chat externo para usar `integrationId` y scope. Verificar con tests de contrato de envío, recepción, QR y errores sanitizados.
- [x] 4.3 Implementar los modos de canal de proyecto `agent`, `workflow` y `hybrid` y el ruteo determinista por integración/evento. Verificar con tests de duplicados, proyecto hermano, trigger inexistente y ausencia de escaneo global.
- [x] 4.4 Implementar el ruteo de canales globales al orquestador y su allowlist independiente. Verificar con tests de que un canal global no es visible ni usable por proyectos y viceversa.
- [x] 4.5 Implementar la separación de credenciales/claims proyecto vs global y rechazar omisiones de scope. Verificar con tests de escalada, credencial inválida y auditoría de rechazos.
- [x] 4.6 Cambiar los endpoints de integraciones y la API externa a `integrationId`, y eliminar los endpoints globales de canales. Verificar con tests de contrato, 401/403 y threading persistente.
- [x] 4.7 Documentar modos de canal, endpoints externos, allowlists y lifecycle. Verificar los ejemplos de curl y la configuración de cada modo.

## 5. Agente principal y experiencia de chat

- [x] 5.1 Scaffoldear `AGENTS.md` y `.opencode/agents/principal/agente.md` al crear un proyecto, con backfill idempotente para proyectos existentes. Verificar con tests de creación, no sobreescritura y contenido del scaffold.
- [x] 5.2 Escribir `default_agent` en `opencode.jsonc`, seleccionar el agente principal en sesiones nuevas y cambiar sesiones existentes o abrir una nueva conservando historial. Verificar con tests usando el runtime fake.
- [x] 5.3 Actualizar el catálogo/editor de agentes para listar y editar el modo `primary` sin degradarlo accidentalmente a subagente. Verificar con tests de UI y de persistencia del frontmatter.
- [x] 5.4 Implementar el renderer Markdown/GFM seguro con tablas, código copiable, listas y enlaces. Verificar con tests de componente para tabla ancha, bloque de código, HTML no seguro y enlaces.
- [x] 5.5 Implementar la superficie de chat acoplada, expandida y minimizada/burbuja, con persistencia por proyecto, focus/Escape y layout móvil. Verificar con tests de UI y E2E en 320/768/1440.
- [x] 5.6 Añadir el prompt de comunicación orientado a negocio y el copy de bienvenida del agente principal. Verificar con un E2E que la respuesta simulada no expone rutas por defecto y que el detalle técnico solo aparece cuando se pide.
- [x] 5.7 Documentar el agente principal, las reglas de comunicación y los estados del chat. Verificar que la documentación coincide con la UI y el E2E.

## 6. Contrato de ejecución manual, `validate` y procedencia

- [x] 6.1 Añadir `inputSchema` al schema del trigger y al inspector del canvas. Verificar con tests de esquema, guardado y renderizado del formulario declarado.
- [x] 6.2 Implementar la validación server-side del input para todos los entry points antes de crear pasos. Verificar con tests de 422, campo faltante, tipo incorrecto y payload válido desde web, canal y API.
- [x] 6.3 Implementar la creación asíncrona del run con respuesta `202 { runId }` y actualizaciones por SSE. Verificar con tests de idempotencia, run en vuelo y finalización.
- [x] 6.4 Persistir y exponer `launchedBy`, `graphHash`, `integrationId` y detalle de origen. Verificar con tests de API y de detalle de run para lanzamiento manual, canal y replay.
- [x] 6.5 Implementar el nodo `validate` con reglas declarativas y mensajes accionables. Verificar con tests de campo requerido, paso exitoso, múltiples reglas y bloqueo de nodos posteriores.
- [x] 6.6 Implementar el formulario de lanzamiento generado desde `inputSchema` y mostrar la procedencia en el detalle del run. Verificar con tests de UI y E2E del caso `tema`.
- [x] 6.7 Documentar el contrato de entrada, el nodo `validate` y la procedencia del run. Verificar los ejemplos contra la API y el E2E.

## 7. Orquestador global y alertas

- [x] 7.1 Scaffoldear `/data/control` con `AGENTS.md`, agente del orquestador y `opencode.jsonc` en el bootstrap. Verificar con tests de primera instalación, reinicio y no sobreescritura.
- [x] 7.2 Implementar el chat del orquestador y sus hilos separados de los proyectos. Verificar con tests de historial, sesión y aislamiento respecto al chat de proyecto.
- [x] 7.3 Implementar las herramientas globales de solo lectura (proyectos, runs, errores, salud, conocimiento) con credencial global. Verificar con tests de consulta cross-project y denegación de escalada desde proyecto.
- [x] 7.4 Implementar la configuración y el ciclo de vida de canales globales en Ajustes. Verificar con tests de crear, probar, conectar, desconectar y exclusión de la lista de proyectos.
- [x] 7.5 Implementar el servicio de alertas deterministas para run fallido, integración caída y salud degradada, con deduplicación, throttle y redacción. Verificar con tests de envío único, supresión, contenido seguro y ausencia de canal configurado.
- [x] 7.6 Construir la página Orquestador con chat, resumen de proyectos, fallos recientes y estado de canales, y la sección de canales globales en Ajustes. Verificar con tests de UI y E2E de pregunta cross-project y alerta.
- [x] 7.7 Extender logging, Sentry y salud con `integrationId`, scope global, estado de alertas y métricas de integraciones. Verificar con tests de eventos estructurados y de redacción de secretos.
- [x] 7.8 Documentar el orquestador, sus canales, alertas y límites de autoridad. Verificar que la documentación coincide con la UI y los tests de seguridad.

## 8. Corte, limpieza y verificación integral

- [x] 8.1 Eliminar `channels`, `external_databases`, endpoints globales de notebooks, `channelSlug` en triggers y el modelo de chat atado solo a proyecto. Verificar con búsqueda de símbolos, typecheck y tests de que las rutas viejas responden 404.
- [x] 8.2 Reorganizar la navegación y las pestañas del proyecto (Canvas, Ejecuciones, Agentes, Conocimiento, Recursos, Ajustes). Verificar con tests de navegación y E2E de configuración completa de un proyecto.
- [x] 8.3 Actualizar README, arquitectura y documentación operativa; retirar referencias al modelo global anterior. Verificar que los comandos y enlaces documentados funcionan.
- [x] 8.4 Ejecutar `bun run typecheck`, `bun test --cwd apps/server`, `bun run test` y `bun run test:e2e`; verificar cero fallos y cero errores de consola.
- [x] 8.5 Ejecutar la revisión de seguridad y aislamiento: acceso cross-project, redacción de secretos, prompt injection, SSRF, rate limits y credenciales globales. Verificar con tests dedicados y un checklist firmado.
- [x] 8.6 Ejecutar el drill de migración y rollback desde backup. Verificar que la restauración deja la aplicación operativa y sin recursos huérfanos.
- [x] 8.7 Verificar rendimiento y límites: arranque lazy con muchas integraciones, SSE de chat, alertas y consultas del orquestador. Verificar que no hay bucles bloqueantes ni regresiones de latencia.
- [x] 8.8 Aceptación final: configurar un proyecto con canal, conocimiento, agente principal y ejecución manual con `tema`, y consultar un reporte global desde el orquestador. Verificar todos los escenarios de las specs y adjuntar evidencia.

## 9. Endurecimiento y experiencia posterior

- [x] 9.1 Persistir OpenCode en `/data/opencode/opencode.db`, configurar `XDG_STATE_HOME` y restaurar las API keys de proveedor desde la bóveda al arrancar. Verificar con `provider-restore.test.ts` y el arranque E2E.
- [x] 9.2 Implementar recuperación centralizada de sesiones huérfanas (`ensureChatSession`/`promptWithSessionRecovery`) para chat de proyecto, orquestador, canales y chat externo. Verificar con `chat-recovery.test.ts`.
- [x] 9.3 Implementar `DELETE /api/projects/:slug` con borrado en cascada de workspace, runs, chats, integraciones, secretos y conocimiento, y detención previa de integraciones. Verificar con `app.http.test.ts`.
- [x] 9.4 Rediseñar la pantalla de Proyectos con modal de creación, slug automático, descripción, validación, búsqueda, estados vacíos, tarjetas informativas y confirmación tipada de borrado. Verificar con `projects.test.tsx`.
- [x] 9.5 Reorganizar el canvas: paleta lateral agrupada, inspector de nodo en panel inferior con última ejecución y chat en drawer lateral. Verificar con typecheck, tests de UI y E2E.
- [x] 9.6 Agregar formulario guiado de integraciones de canal (modo, allowlist, público, token, WhatsApp QR/Cloud y API key de chat externo) manteniendo el JSON avanzado opcional. Verificar con typecheck y pruebas de UI.
- [x] 9.7 Exigir exactamente un trigger ejecutable por workflow y rechazar `schedule`/`webhook` sin ejecutor. Verificar con `workflow-domain.test.ts` y el guard de la paleta.
- [x] 9.8 Re-ejecutar typecheck, suite completa y E2E tras los cambios de endurecimiento y UX. Verificar cero fallos.

## Workflow follow-up

- Archivar el change después de que la revisión y la implementación estén completas.
- Sincronizar las specs y verificar el resultado archivado.
- Iniciar la implementación únicamente con una nueva solicitud de apply (`/opsx-apply`).
