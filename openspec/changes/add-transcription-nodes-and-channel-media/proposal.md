# Proposal

## Why

Los canales y el motor de workflows solo transportan texto. Si un usuario envía una foto o una nota de voz por Telegram, el adaptador ignora el mensaje y el agente no puede analizarlo. OpenCode V2 acepta imágenes y PDF como adjuntos, pero no audio ni video: la voz obliga a transcribir antes de llegar al agente.

La plataforma ya tiene el contrato de integraciones, la bóveda de secretos y el nodo `agent`, pero le falta capturar media, persistirla, transcribir audio y entregar adjuntos al agente. Sin eso, los casos de uso con voz e imagen quedan fuera del producto.

## What Changes

- **Captura de media en Telegram**: foto, nota de voz, audio y documento de imagen. Descarga vía Bot API, valida tipo real y tamaño, y guarda el archivo bajo `proyecto/.opencode/media/<hash>.<ext>`.
- **Conexión de transcripción por proyecto**: nueva integración `transcription` con `baseUrl`, `model`, `language`, `apiKey` en bóveda y `models[]` descubiertos. Compatible con speaches local y proveedores OpenAI-compatible (Groq, OpenAI, etc.).
- **Nodo `transcribe`**: convierte los audios del input en texto usando una conexión del proyecto, con overrides de modelo e idioma, prompt de contexto, timeout y reintentos.
- **Trigger `accepts`**: el trigger de integración declara si acepta `text`, `image` y/o `audio`; por defecto solo texto para no cambiar el comportamiento actual.
- **Adjuntos en el nodo `agent`**: adjunta al prompt las imágenes del input (`file://`) y avisa cuando hay audio sin transcribir.
- **Transcripción automática en modo agente**: el router usa la conexión de transcripción por defecto del proyecto para convertir audio antes de crear el turno de chat.
- **Adjuntos en chat durable**: persiste los adjuntos del mensaje del usuario y los reutiliza en reintentos; las imágenes se envían a OpenCode como `file://`.
- **Despliegue local**: servicio `transcription` con speaches CPU en `docker-compose`, con `Systran/faster-whisper-base` y `Systran/faster-whisper-small` preinstalados.
- **Descubrimiento de modalidades**: expone `capabilities.input` de los modelos para que la UI avise cuando el modelo elegido no acepta imágenes.
- **Observabilidad y pruebas**: métricas/logs de captura y transcripción sin contenido, health de la conexión ASR y regresiones de media, adjuntos, reintentos y aislamiento.

## Capabilities

### New Capabilities

Ninguna. El cambio extiende capacidades existentes; la captura de media pertenece al gateway de canales y la transcripción al catálogo de recursos y al motor de workflows.

### Modified Capabilities

- `omnichannel-and-chat-gateway`: captura de media entrante, validación y almacenamiento, transcripción automática en modo agente y entrega de adjuntos al turno.
- `workflow-and-workspace-engine`: nodo `transcribe`, filtro `accepts` del trigger de integración y adjuntos de imagen en el nodo `agent`.
- `project-resources`: nueva integración `transcription`, conexión por defecto del proyecto, prueba de conexión, descubrimiento de modelos y readiness.
- `agent-chat-experience`: historial y reintentos de chat preservan los adjuntos del mensaje del usuario.
- `multi-agent-catalog`: exposición de modalidades de entrada del modelo para validar visión antes de adjuntar imágenes.
- `observability-and-testing-harness`: telemetría de media/transcripción, health de la conexión ASR y cobertura de regresión.

## Impact

- **Contratos compartidos**: `IntegrationKind` agrega `transcription`; `IntegrationCapability` agrega `transcribe_audio`; `TriggerConfig` agrega `accepts`; `NodeType` agrega `transcribe`; nuevos `TranscribeNodeConfig`, `MediaRef` y `AgentNodeConfig.mediaPath`; `ChatMessage` agrega adjuntos.
- **Servidor**: `TranscriptionService` OpenAI-compatible, `MediaStore`, adaptador de Telegram, router de canales, `ChatTurnService`, executor de workflows, ajustes de proyecto, `ManageIntegrationsUseCase` y migraciones aditivas (`chat_messages.attachments_json`, `projects.transcription_integration_id`).
- **Web**: formulario de integración de transcripción con prueba y modelos, inspector del nodo `transcribe`, trigger con `accepts`, ajuste de conexión por defecto y etiqueta de visión del modelo.
- **Despliegue**: servicio `transcription` (speaches CPU), init de modelos base/small, volumen de caché y documentación. No se agregan dependencias npm; `fetch`, `FormData` y `Blob` ya están disponibles.
- **Fuera de alcance**: ASR para el orquestador global, media en WhatsApp y subida desde el chat web, nodo `vision` separado, proveedores no OpenAI-compatible (Deepgram/Gemini) y retención/limpieza automática de archivos.
- **Compatibilidad**: los campos nuevos son opcionales y con defaults conservadores; los flujos que solo usan texto siguen funcionando sin cambios.
