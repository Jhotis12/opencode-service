# Tasks

## 1. Contratos compartidos y persistencia

- [x] 1.1 Agregar `speech` a `IntegrationKind`, `synthesize_speech` a `IntegrationCapability`, `SpeechIntegrationConfigSchema` (`baseUrl`, `model`, `voice`, `speed` 0.5–2, `responseFormat` mp3/wav/flac), sus capabilities, labels, eventos y registro de configuración con campos guiados; verificar con `bun run --cwd packages/shared test` que el parseo, los defaults y el secret field de la API key pasan los tests de contratos y registry.
- [x] 1.2 Agregar `speak` a `NodeType` y `SpeakNodeConfigSchema` (`integrationId`, `model`, `voice`, `speed`, `textPath`, `maxChars`) más su entrada en `NODE_TYPE_CONFIGURATION` con label, categoría y campos; verificar con los tests de `packages/shared/test/config-registry.test.ts` y `bun run --cwd packages/shared typecheck` que el nodo aparece en el catálogo con sus defaults.
- [x] 1.3 Agregar `voiceReplies: "never" | "auto"` con default `never` a `ChannelRoutingSchema`, al default de routing y al mapeo plano→anidado usado por la UI; verificar con un test de contrato que un canal sin el campo parsea como `never` y que el mapeo guarda `routing.voiceReplies`.
- [x] 1.4 Agregar `speechIntegrationId` a `ProjectRecord`, `ProjectSettingsSchema`, `UpdateProjectSettingsUseCase` (validando integración del proyecto, kind `speech` y capability), `readinessFor` y el endpoint `PATCH /api/projects/:slug/settings`; agregar la migración aditiva `projects.speech_integration_id` y el mapeo del store. Verificar con un test de migración que una base existente arranca sin backfill y con un test de settings que acepta el default válido y rechaza uno cruzado/incorrecto.

## 2. Servicio de voz

- [x] 2.1 Crear `SpeechPort`, `SpeechError` y `OpenAiCompatibleSpeechService` con `synthesize`, `listModels` y `test`: request a `/audio/speech`, auth opcional, timeout configurable, límite de caracteres, validación de bytes vacíos y tipo detectable, y errores sanitizados. Verificar con tests unitarios que usan `fetch` falso y cubren request shape, API key, overrides de modelo/voz/velocidad, respuesta vacía, formato inválido, error HTTP y timeout.
- [x] 2.2 Cablear el servicio en `app.ts`, tratarlo como integración sin transporte en `IntegrationManager` y hacer que el test existente de integraciones devuelva `ok`, latencia y modelos para `speech`; verificar con los tests HTTP de integraciones y del manager que probar una conexión local sin key y una con key funciona.
- [x] 2.3 Emitir métricas y logs de síntesis (`speech_requests`, `speech_succeeded`, `speech_failed`) con proyecto, integración, modelo, voz, caracteres, latencia y resultado, sin texto ni audio; verificar con un test de telemetría que el logger recibe los campos esperados y no el contenido.

## 3. Nodo `speak`

- [x] 3.1 Implementar la rama `speak` del ejecutor: resolver texto desde string o `textPath`, fallar si está vacío o supera `maxChars`, resolver la integración del nodo o el default del proyecto, llamar a `SpeechPort` y guardar el audio en `MediaStore`; devolver `{ text, audio }`. Verificar con tests de `execute-workflow` que cubren string plano, objeto con `text`, overrides y salida con `MediaRef` bajo `.opencode/media/`.
- [x] 3.2 Extender `workflow-resources.ts` para validar que la conexión `speak` exista, sea del proyecto, sea kind `speech`, tenga `synthesize_speech` o exista un default; agregar el ítem de readiness del nodo. Verificar con tests de `workflow-resources` para conexión válida, faltante, de otro proyecto, de otro kind y eliminada antes del run.
- [x] 3.3 Cubrir los bordes del nodo: texto vacío, texto largo, proveedor que falla o devuelve audio vacío, lectura de un archivo generado desde otro proyecto y reintento según la política del nodo; verificar que cada caso falla o reintenta con un error accionable y sanitizado.

## 4. Egress de audio y conversión

- [x] 4.1 Extender `IntegrationEgressPort` con `sendMedia`, agregar el registro de handlers de media en `IntegrationEgressRouter` y hacer que el adaptador de Telegram lo implemente; los canales sin handler deben fallar con un error explícito. Verificar con tests de `channel-adapters` que Telegram recibe los bytes y que WhatsApp falla sin fingir entrega.
- [x] 4.2 Implementar `AudioConverterPort` y `FfmpegAudioConverter` con ffmpeg/ffprobe, archivo temporal 0600, borrado en `finally` y duración; agregar `sendVoice`/`sendAudio` al transporte de Telegram con caption y reglas de duración. Verificar con tests que 1–60 s usan `sendVoice`, más de 60 s usa `sendAudio`, el fallo del converter usa MP3, el caption se omite si supera 1 024 caracteres y el texto completo se envía aparte.
- [x] 4.3 Agregar `ffmpeg` a la etapa runtime del `Dockerfile`; verificar que la imagen construye y que `ffmpeg -version` y `ffprobe -version` funcionan dentro del contenedor.

## 5. Respuesta automática por voz en Telegram

- [ ] 5.1 Propagar desde el router si el mensaje traía audio y si `routing.voiceReplies` es `auto`; en `deliverChatTurn`, tras el turno exitoso, resolver `project.speechIntegrationId`, sintetizar una vez y enviar con `sendMedia`; si falta conexión, falla la síntesis o el texto supera el límite, enviar el texto y registrar el fallback sin marcar el turno como fallido. Verificar con tests de `channel-router` que cubren `never`, `auto` con audio, `auto` con texto, sin conexión y fallo del proveedor.
- [ ] 5.2 Cubrir los bordes de entrega: caption de 1 024 caracteres, texto largo sin audio, reintento de entrega que reutiliza los bytes ya sintetizados, audio de más de 60 s y conversión no disponible; verificar que no se duplican mensajes y que el texto nunca se pierde.
- [ ] 5.3 Emitir métricas/logs `voice_reply_sent` y `voice_reply_fallback` con motivo, proyecto, integración y turno, sin texto; verificar con un test que el fallback registra `missing_speech`, `synthesis_failed` o `text_too_long` según corresponda.

## 6. Entrega de audio en workflows

- [ ] 6.1 En `handleWorkflow`, detectar un `MediaRef` de audio en la salida final, resolverlo con `readMedia`, usar `output.text` como caption y entregarlo con `sendMedia`; conservar el envío de texto cuando no hay audio. Verificar con tests del router que un run con `speak` entrega audio y que uno sin audio mantiene el comportamiento actual.
- [ ] 6.2 Registrar la entrega final en `deliveries` con una action key por run para que los reintentos no dupliquen el audio, y cubrir archivo faltante, ruta fuera del proyecto, canal sin soporte y salida con audio sin texto; verificar que cada fallo queda registrado y no se descarta en silencio.

## 7. UI y configuración

- [ ] 7.1 Hacer que el formulario de integración renderice los campos de `speech`, con sugerencias de voz (`ef_dora`, `em_alex`, `em_santa`) sin bloquear una voz personalizada, y que el botón existente “Probar conexión” muestre latencia y modelos. Verificar con `apps/web/test/integration-editor.test.tsx` que se guardan base URL, modelo, voz, velocidad y API key sin exponer el secreto.
- [ ] 7.2 Agregar el selector de conexión de voz por defecto y el ítem de readiness en `ProjectSettingsPanel`, y el control “Responder con audio cuando llegue audio” en el editor de canal escribiendo `routing.voiceReplies`. Verificar con `apps/web/test/pages.test.tsx`, `apps/web/test/project-configuration.test.tsx` y el test de `config-field-utils` que el valor se guarda y se recupera.
- [ ] 7.3 Verificar que el inspector y la paleta renderizan el nodo `speak` con sus campos (conexión, modelo, voz, velocidad, ruta y máximo de caracteres) sin cambios manuales por nodo; ejecutar `bun run --cwd apps/web typecheck` y `bun run --cwd apps/web test`.

## 8. Despliegue, salud y verificación integral

- [ ] 8.1 Agregar la descarga de `speaches-ai/Kokoro-82M-v1.0-ONNX` al init de speaches en `docker-compose.yml` y documentar en README la conexión local (`http://transcription:8000/v1`), la voz `ef_dora`, la necesidad de ffmpeg para la nota de voz y el fallback MP3; verificar con `docker compose config` y una consulta real a `/v1/models` con el servicio levantado.
- [ ] 8.2 Exponer las conexiones `speech` en el health con su último test y error sanitizado, sin secretos; verificar con el test del health use case y una respuesta del panel que incluye la conexión local.
- [ ] 8.3 Ejecutar la verificación integral: `bun run typecheck`, `bun run test`, una prueba local de síntesis con speaches que llegue a un nodo `speak` y a una entrega Telegram simulada, y `graphify update .`; confirmar que los escenarios de las cuatro deltas quedan cubiertos y que el grafo queda actualizado.

## Workflow follow-up

- Create `change/add-tts-node-and-telegram-voice-replies` from the remote base branch before implementation.
- Commit the planning artifacts with `docs(openspec): plan add-tts-node-and-telegram-voice-replies`.
- Create one atomic commit per numbered group: `<type>(add-tts-node-and-telegram-voice-replies): <summary>`.
- Push the branch and open a PR with `gh pr create`; report the URL and do not merge.
- Wait for human review and merge; archive only after the PR is merged.
