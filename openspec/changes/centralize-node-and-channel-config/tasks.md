# Tasks

## 1. Registro compartido de configuración

- [x] 1.1 Definir en `packages/shared` los tipos `ConfigField`, `ConfigDefinition` y helpers de resolución de metadata, y verificar que el paquete compila con `bun run typecheck`.
- [x] 1.2 Crear el registro de integraciones para Telegram, WhatsApp, chat externo, email, PostgreSQL, MySQL, SQL Server, SQLite y HTTP con esquema, defaults, campos, campos secretos y capacidades; verificar con un test que recorre todos los `IntegrationKind` y falla si falta uno.
- [x] 1.3 Crear el registro de nodos para todos los `NodeType` con esquema, defaults, campos y eventos; verificar con un test que recorre todos los tipos y falla si falta uno o si un default no valida contra su esquema.
- [x] 1.4 Agregar el catálogo de eventos por canal (`message.received` para Telegram/WhatsApp/chat externo, vacío para los demás) y verificar con tests de contrato.
- [x] 1.5 Agregar pruebas de contrato que parseen configuraciones válidas existentes y rechacen campos inválidos; verificar con `bun test packages/shared/test/config-registry.test.ts`.

## 2. Validación de servidor y ruteo de triggers

- [x] 2.1 Migrar `validateIntegrationInput` al registro compartido, incluyendo defaults, campos secretos requeridos y rechazo de secretos en configuración no secreta; verificar con `bun test apps/server/test/integrations.test.ts`.
- [x] 2.2 Migrar `validateWorkflowGraph` al registro de nodos y agregar validación de trigger por `kind`, capacidad `inbound_message` y evento soportado; verificar con `bun test apps/server/test/workflow-domain.test.ts`.
- [x] 2.3 Corregir `RouteProjectIntegrationMessageUseCase` para exigir `trigger.kind === "integration"`, capacidad de entrada y evento soportado, con razones de drop explícitas; verificar con `bun test apps/server/test/channel-router.test.ts`.
- [x] 2.4 Hacer la lectura de `workflow.json` tolerante a eventos desconocidos y el guardado/run estrictos, con un test que abra el workflow viejo, falle al guardarlo y muestre el evento inválido.
- [x] 2.5 Normalizar el config al cambiar de kind, eliminando claves incompatibles y aplicando defaults; verificar con tests de guardado que un trigger manual no conserva `integrationId` ni `event`.

## 3. Destinos de proyecto

- [x] 3.1 Agregar la migración aditiva `project_destinations` y el repositorio en `Store`; verificar con un test de migración que la tabla existe y que una base existente se abre sin pérdida de datos.
- [x] 3.2 Implementar casos de uso y endpoints CRUD de destinos por proyecto (`GET/POST/PATCH/DELETE /api/projects/:slug/destinations`); verificar con tests HTTP de creación, listado, actualización y aislamiento entre proyectos.
- [x] 3.3 Implementar el resolver de destinatarios que acepta un ID de destino o un valor crudo en allowlist, `alertRecipient`, `approvalRecipient` y `notify.recipient`; verificar con tests de compatibilidad hacia atrás y de rechazo cross-project.
- [x] 3.4 Bloquear el borrado de un destino referenciado por integraciones, ajustes o workflows y listar las referencias; verificar con un test que el borrado devuelve error y que el destino sigue disponible.
- [x] 3.5 Agregar tests de contrato y de aislamiento para destinos; verificar con `bun test apps/server/test/destinations.test.ts`.

## 4. Ciclo de vida de Telegram

- [x] 4.1 Extender `TelegramTransport` con `verify()` basado en `getMe` y timeout, y usarlo en `IntegrationManager.start`; verificar con un transporte falso que un token inválido no marca la integración como conectada.
- [x] 4.2 Agregar el estado `connecting`, persistir `status: error` y `lastError` sanitizado en fallos de conexión, y devolver el estado real desde `connect`; verificar con tests de lifecycle y con la respuesta HTTP de `connect`.
- [x] 4.3 Detectar tokens de Telegram duplicados en create/update y en `startAll` mediante fingerprint en memoria; verificar que la segunda integración queda en `error` con un mensaje que nombra a la primera.
- [x] 4.4 Detectar el conflicto de webhook activo, devolver un error accionable y exponer una acción explícita para limpiar el webhook; verificar con un transporte falso que simula el conflicto y con un test de la acción de limpieza.
- [x] 4.5 Extender `POST /test` para aceptar un destinatario opcional y enviar un mensaje de prueba real cuando se provee; verificar con un transporte falso que registra el envío y con un test de token inválido.
- [x] 4.6 Agregar tests de rotación de token que conservan el `integrationId` y las referencias; verificar con `bun test apps/server/test/channel-adapters.test.ts apps/server/test/integration-lifecycle.test.ts`.

## 5. Editor compartido de integraciones

- [x] 5.1 Crear `IntegrationEditor` con secciones de conexión, comportamiento, alertas y avanzado, renderizando los campos del registro; verificar con un test de componente que los campos guiados aparecen y que el JSON avanzado es opcional.
- [x] 5.2 Implementar crear/editar con el mismo formulario y rotación de token que solo envía el secreto cuando cambia; verificar con un test que un guardado sin token conserva el `secretRef` y el `integrationId`.
- [x] 5.3 Mostrar estado, `lastError`, resultado de prueba y resultado de conexión en la tarjeta de la integración; verificar con tests de componente para `connected`, `needs_config` y `error`.
- [x] 5.4 Reemplazar los formularios de `ProjectResourcesPanel` y `ControlChannelsPanel` por wrappers del editor compartido; verificar que ambas superficies usan el mismo componente y que no quedan defaults duplicados.
- [x] 5.5 Agregar tests de componente para crear, editar, rotar token y mostrar error; verificar con `bun test apps/web/test/integration-editor.test.tsx`.

## 6. Superficie única de configuración y destinos UI

- [x] 6.1 Reemplazar las pestañas “Recursos” y “Ajustes” del proyecto por una pestaña “Configuración” con subsecciones General, Conexiones, Canales, Destinos, Secretos y Preparación; verificar con un test de navegación que todas las subsecciones son alcanzables.
- [x] 6.2 Reutilizar los paneles existentes como wrappers dentro de las subsecciones y eliminar la duplicación de editores; verificar que no hay dos formularios de integración montados a la vez.
- [x] 6.3 Implementar el gestor de destinos y el picker reutilizable en allowlist, alertas, aprobaciones y nodos `notify`; verificar con tests de componente que un destino creado aparece en los cuatro selectores.
- [x] 6.4 Permitir adoptar un valor crudo existente como destino etiquetado sin romper la configuración actual; verificar con un test que el valor crudo sigue funcionando antes y después de adoptarlo.
- [x] 6.5 Agregar pruebas de página y E2E de la nueva superficie de configuración; verificar con `bun test apps/web/test/pages.test.tsx` y el escenario Playwright de configuración de proyecto.

## 7. Inspector de nodos dirigido por contrato

- [ ] 7.1 Crear el renderer de campos del registro y conservar widgets custom para `inputSchema`, `outputSchema`, reglas, SQL, condición y código; verificar con un test que cada `NodeType` renderiza sus campos requeridos.
- [ ] 7.2 Mover los defaults de `addNode` al registro y aplicarlos al crear un nodo; verificar con un test que un nodo nuevo pasa la validación de guardado.
- [ ] 7.3 Reemplazar el config al cambiar de tipo/kind, con confirmación en la UI cuando se descartan claves incompatibles; verificar con un test que un trigger integration→manual elimina `integrationId` y `event`.
- [ ] 7.4 Mostrar errores de validación por campo en el inspector y bloquear el guardado inválido; verificar con un test de componente y con una respuesta 422 del servidor.
- [ ] 7.5 Agregar pruebas de canvas e inspector para defaults, cambio de kind y validación; verificar con `bun test apps/web/test/canvas-ui.test.tsx apps/web/test/node-inspector.test.tsx`.

## 8. Configuración efectiva y ajustes

- [ ] 8.1 Definir `PlatformSettingsSchema` y `ProjectSettingsSchema`, y agregar `GET /api/config/effective` con valor, fuente, máscara, editabilidad y `restartRequired`; verificar con tests de precedencia entidad→proyecto→plataforma→entorno→default.
- [ ] 8.2 Cablear `ORCHESTRATOR_MODEL` desde `system_settings` con fallback a entorno, aplicar el DSN de Sentry desde la bóveda al arrancar y conectar `SESSION_TTL_HOURS` a `SessionCodec`; verificar con tests de arranque y de expiración de sesión.
- [ ] 8.3 Eliminar `DATABASE_URL` de `.env.example` o documentar que no se usa, y agregar `OPENCODE_BASE_URL`/`OPENCODE_SERVICE_FILE` a `docker-compose.yml`; verificar que las variables documentadas son las que el contenedor recibe.
- [ ] 8.4 Mostrar en Ajustes el valor efectivo, la fuente y los campos read-only o secrets enmascarados; verificar con tests de componente y con el endpoint de configuración efectiva.
- [ ] 8.5 Actualizar README y la guía de configuración con la nueva superficie, precedencia, edición de canales y destinos; verificar que los comandos y variables documentados coinciden con `.env.example` y `docker-compose.yml`.

## 9. Integración final y verificación

- [ ] 9.1 Mostrar `lastError` de integraciones en salud y asegurar que los fallos de conexión se reportan a Sentry cuando hay DSN activo; verificar con tests de health y de captura de errores.
- [ ] 9.2 Agregar el E2E de edición de canal Telegram, rotación de token, prueba fallida/exitosa, trigger manual que no dispara y destino reutilizado; verificar con Playwright y con el transporte falso.
- [ ] 9.3 Ejecutar la suite completa, el typecheck y el build; verificar `bun test`, `bun run typecheck`, `bun run build` y el E2E sin errores de consola.
- [ ] 9.4 Hacer una verificación manual con una instancia real o transporte falso de: conectar, probar, desconectar, rotar token y editar routing sin recrear la integración; registrar el resultado en la PR.

## Workflow follow-up

- Create `change/centralize-node-and-channel-config` from the remote base branch before implementation.
- Commit the planning artifacts with `docs(openspec): plan centralize-node-and-channel-config`.
- Create one atomic commit per numbered group: `<type>(centralize-node-and-channel-config): <summary>`.
- Push the branch and open a PR with `gh pr create`; report the URL and do not merge.
- If `gh` is missing, unauthenticated, or the push/PR fails, stop with manual instructions and do not report completion.
- Wait for human review and merge; archive only after the PR is merged.
