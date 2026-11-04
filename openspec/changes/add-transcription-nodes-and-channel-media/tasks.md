# Tasks

## 1. Contratos compartidos y persistencia

- [x] 1.1 Agregar `transcription` a `IntegrationKindSchema`, `transcribe_audio` a `IntegrationCapabilitySchema`, `TranscriptionIntegrationConfigSchema` (`baseUrl`, `model`, `language`) y los defaults/secretos requeridos; verificar con `bun test packages/shared` y `bun run --cwd packages/shared typecheck`.
- [x] 1.2 Agregar `MediaRefSchema`, `TriggerConfig.accepts` con default `["text"]`, `transcribe` a `NodeTypeSchema`, `TranscribeNodeConfigSchema`, `AgentNodeConfig.mediaPath`, `ChatMessageSchema.attachments` y `AgentModelInfo.input`; verificar con los tests de contratos y `bun run typecheck`.
- [x] 1.3 Agregar las columnas aditivas `chat_messages.attachments_json` y `projects.transcription_integration_id`, sus entidades y mapeos en SQLite, y verificar con `bun test apps/server/test/persistence.test.ts` y una migración sobre una base existente.
- [x] 1.4 Extender los ajustes de proyecto con `transcriptionIntegrationId`, validar que la integración sea `transcription` del mismo proyecto y agregar el ítem de readiness cuando falte; verificar con `bun test apps/server/test/project-settings.test.ts`.

## 2. Captura y almacenamiento de media

- [ ] 2.1 Implementar `MediaStore` con detección de tipo por magic bytes, límites de tamaño/cantidad/duración, nombre por hash SHA-256, permisos restrictivos y raíces separadas para proyecto y control; verificar con tests unitarios de tipo, tamaño, deduplicación y path traversal.
- [ ] 2.2 Extender `IntegrationTransport`/`IncomingIntegrationMessage` con adjuntos y agregar al transporte de Telegram los handlers de foto, nota de voz, audio y documento de imagen con descarga vía `getFile()`; verificar con `bun test apps/server/test/channel-adapters.test.ts`.
- [ ] 2.3 Integrar `MediaStore` en los routers de proyecto y global, guardar solo después de decidir el ruteo y responder con un error claro ante tipo/tamaño no soportado; verificar con tests de `channel-router` que un mensaje descartado no persiste archivos.
- [ ] 2.4 Mantener compatibilidad con los transports existentes y los fakes de WhatsApp/Telegram al hacer opcional el campo de adjuntos; verificar que los tests de canales y `bun run typecheck` sigan pasando.

## 3. Servicio de transcripción y recurso por proyecto

- [ ] 3.1 Implementar `TranscriptionService` OpenAI-compatible (`POST {baseUrl}/audio/transcriptions` con multipart, `GET {baseUrl}/models`, timeout y errores sanitizados) resolviendo configuración y API key de la bóveda; verificar con tests de adapter usando un `fetch` falso.
- [ ] 3.2 Integrar la prueba de conexión y el descubrimiento de modelos en `ManageIntegrationsUseCase`: actualizar `config.models`, estado y last error; verificar con `bun test apps/server/test/integration-manager.test.ts` e `integrations.test.ts`.
- [ ] 3.3 Agregar la conexión de transcripción por defecto al proyecto y resolverla en el router de agente y en los nodos que heredan; verificar con `bun test apps/server/test/project-settings.test.ts` y `channel-router.test.ts`.
- [ ] 3.4 Agregar el formulario guiado de Transcripción (base URL, modelo, idioma, API key), el botón de prueba con listado de modelos y el selector de conexión por defecto en Ajustes; verificar con `bun test apps/web/test/pages.test.tsx`.
- [ ] 3.5 Verificar que la API key nunca se devuelve, que el JSON avanzado sigue disponible y que una integración de otro proyecto se rechaza; verificar con tests de integración y revisión de la respuesta HTTP.

## 4. Modo agente: transcripción automática y adjuntos

- [ ] 4.1 Hacer que el router transcriba audio antes de iniciar el turno cuando la decisión es `agent`, usando la conexión por defecto y devolviendo un mensaje accionable si falta o falla; verificar con tests de `channel-router`.
- [ ] 4.2 Extender `ChatTurnService` con adjuntos: persistirlos en el mensaje, construir `file://` para imágenes y pasarlos a `sendPrompt`; actualizar también el camino legacy `promptWithSessionRecovery`; verificar con `bun test apps/server/test/chat-turns.test.ts` y `chat-recovery.test.ts`.
- [ ] 4.3 Hacer que los endpoints de reintento de proyecto y control reenvíen los adjuntos originales y que el historial los devuelva; verificar con tests de API y un reintento con imagen.
- [ ] 4.4 Aplicar el prompt neutral cuando una imagen no tiene caption y validar que un adjunto fuera de `.opencode/media/` se rechaza; verificar con tests de turno.

## 5. Workflow: trigger, nodo Transcribir y nodo Agente

- [ ] 5.1 Implementar el filtro `accepts` en el router y en el payload del workflow, con default texto y descarte de adjuntos no aceptados; verificar con tests de `channel-router` para texto, imagen, audio y mixto.
- [ ] 5.2 Implementar la rama `transcribe` en `execute-workflow`: resolver integración o default del proyecto, leer audios, transcribir uno o varios, devolver `{ text, language, durationSeconds, segments }`, aplicar timeout/retry y validar rutas; verificar con tests de `execute-workflow`.
- [ ] 5.3 Adjuntar imágenes del input al nodo `agent` desde `mediaPath`, advertir sobre audio sin transcribir y registrar warning si el modelo no reporta visión; verificar con tests de `execute-workflow`.
- [ ] 5.4 Extender `validateWorkflowGraph`/`validateWorkflowResources` para validar la integración `transcription`, el scope del proyecto y la conexión por defecto; verificar con tests de validación de workflows.
- [ ] 5.5 Agregar `transcribe` a la paleta, icono, forma, subtítulo, defaults e inspector del canvas, y los checkboxes Texto/Imagen/Audio al trigger; verificar con `bun test apps/web/test/canvas-ui.test.tsx`.
- [ ] 5.6 Agregar la validación visual y los mensajes de ayuda del nodo (sin audio, sin conexión, modelo sin visión) y verificar que el inspector los muestra.

## 6. Modalidades de modelo y UI

- [ ] 6.1 Exponer `capabilities.input` en `OpenCodeV2Adapter.listModels` y en el tipo `ModelInfo` del web; verificar con tests de runtime y `bun run typecheck`.
- [ ] 6.2 Mostrar la etiqueta de visión en los selectores de modelo del proyecto y del nodo, y una advertencia al elegir un modelo sin imagen para un nodo que recibirá adjuntos; verificar con tests de UI.
- [ ] 6.3 Manejar el caso en que el runtime no reporte modalidades sin afirmar soporte; verificar con un modelo fake sin `capabilities.input`.

## 7. Despliegue local con speaches

- [ ] 7.1 Agregar el servicio `transcription` con `ghcr.io/speaches-ai/speaches:latest-cpu`, volumen de modelos, healthcheck e init que descargue `Systran/faster-whisper-base` y `Systran/faster-whisper-small`; verificar con `docker compose config` y un arranque limpio.
- [ ] 7.2 Documentar en README y `.env.example` la conexión local por defecto (`http://transcription:8000/v1`, modelo small), la creación de conexiones terceras y la limitación de OGG/Opus en algunos proveedores; verificar que los comandos documentados funcionan.
- [ ] 7.3 Ejecutar una prueba real con una nota de voz OGG/Opus de Telegram contra speaches y verificar que el transcript llega a un turno de agente y a un nodo `transcribe`.

## 8. Observabilidad, seguridad y verificación integral

- [ ] 8.1 Emitir logs y métricas de captura/transcripción sin contenido ni transcripciones, y agregar el estado de las conexiones de transcripción al health; verificar con tests de telemetría y una consulta a `/api/system/health`.
- [ ] 8.2 Agregar tests de aislamiento para media y conexiones de transcripción entre proyectos, path traversal y secretos enmascarados; verificar que fallen si se permite un acceso cruzado.
- [ ] 8.3 Ejecutar `bun run typecheck`, `bun run test` y `bun run build`; corregir cualquier regresión antes de cerrar el cambio.
- [ ] 8.4 Ejecutar la verificación manual: foto de Telegram sin caption, nota de voz en modo agente, workflow con `accepts: ["audio"]` y nodo `transcribe`, reintento de turno con imagen, y confirmar las respuestas y el historial.
- [ ] 8.5 Ejecutar `graphify update .` y verificar que el grafo se actualiza sin errores.

## Workflow follow-up

- Create `change/add-transcription-nodes-and-channel-media` from the remote base branch before implementation.
- Commit the planning artifacts with `docs(openspec): plan add-transcription-nodes-and-channel-media`.
- Create one atomic commit per numbered group: `<type>(add-transcription-nodes-and-channel-media): <summary>`.
- Push the branch and open a PR with `gh pr create`; report the URL and do not merge automatically.
- Wait for human review and merge; archive only after the PR is merged.
