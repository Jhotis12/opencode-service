# Proposal

## Why

La plataforma ya recibe y transcribe notas de voz de Telegram, pero el agente solo puede responder con texto: la conversación por voz queda a medias. Falta convertir texto en audio de forma autónoma, con una voz configurable y, preferiblemente, usando recursos locales del equipo.

Este cambio cierra el circuito en Telegram: si el usuario envía un audio, el agente responde con una nota de voz. Además expone la generación de audio como un nodo reutilizable para workflows.

## What Changes

- **Integración `speech` (TTS) por proyecto**: nueva conexión OpenAI-compatible con `baseUrl`, `model`, `voice`, `speed`, formato de salida y `apiKey` opcional en la bóveda. Capacidad `synthesize_speech`. Sirve tanto para proveedores externos (OpenAI y compatibles) como para speaches local.
- **Motor local por defecto**: el servicio `transcription` de `docker-compose` incorpora el modelo Kokoro de speaches, con una voz en español preinstalada. No se agrega otro contenedor ni una dependencia npm.
- **Nodo `speak`**: lee el texto de su input, sintetiza audio con una conexión del proyecto, guarda el archivo bajo la media del proyecto y devuelve un `MediaRef` reproducible.
- **Respuesta de voz en Telegram (opt-in)**: el canal declara `routing.voiceReplies: "auto" | "never"` (default `never`). En modo agente, si el mensaje entrante traía audio, la respuesta final se sintetiza y se envía como nota de voz nativa OGG/Opus con el texto como caption.
- **Entrega de audio en workflows**: si la salida final de un run contiene el audio generado por un nodo `speak`, el canal lo entrega como nota de voz con el texto disponible como caption.
- **Egress de media**: el contrato de salida de canales gana un envío de audio; Telegram lo implementa con `sendVoice`. Los canales sin soporte de audio rechazan la entrega con un error explícito.
- **Conversión a OGG/Opus**: la imagen de ejecución incorpora `ffmpeg` para producir notas de voz nativas. Si la conversión no está disponible, el sistema degrada a archivo MP3 en lugar de perder la respuesta.
- **Voz configurable**: el nodo puede sobrescribir modelo, voz y velocidad; la respuesta automática usa la voz de la conexión de voz por defecto del proyecto.
- **Ajustes y UI**: conexión de voz por defecto del proyecto, formulario guiado de la integración `speech`, inspector del nodo `speak` y toggle de respuesta por voz en el canal.
- **Observabilidad y pruebas**: métricas/logs de síntesis y entrega sin contenido, health de la conexión de voz y regresiones de nodo, fallback, conversión y respuesta automática.

## Capabilities

### New Capabilities

Ninguna. El cambio extiende capacidades existentes: la conexión de voz pertenece a los recursos del proyecto, el nodo al motor de workflows y la entrega al gateway de canales.

### Modified Capabilities

- `project-resources`: nueva integración `speech`, conexión de voz por defecto, prueba de conexión y readiness.
- `workflow-and-workspace-engine`: nodo `speak`, validación de su conexión y entrega de su audio como salida del flujo.
- `omnichannel-and-chat-gateway`: respuesta automática por voz en Telegram y egress de audio con fallback a texto.
- `observability-and-testing-harness`: telemetría de síntesis/voz, health de la conexión de voz y cobertura de regresión.

## Impact

- **Contratos compartidos**: `IntegrationKind` agrega `speech`; `IntegrationCapability` agrega `synthesize_speech`; `NodeType` agrega `speak`; nuevos `SpeechIntegrationConfigSchema`, `SpeakNodeConfig`; `ChannelRouting` agrega `voiceReplies`; `ProjectSettings` agrega `speechIntegrationId`.
- **Servidor**: `SpeechService` OpenAI-compatible, puerto `speech`, ejecutor del nodo `speak`, router de canales en modo agente, `IntegrationEgressPort.sendMedia`, adaptador de Telegram (`sendVoice`), conversión OGG/Opus con ffmpeg, ajustes de proyecto y migración aditiva (`projects.speech_integration_id`).
- **Web**: formulario de integración de voz con prueba, inspector del nodo `speak`, selector de conexión por defecto y control de respuesta por voz en el canal.
- **Despliegue**: `ffmpeg` en la imagen de ejecución y descarga del modelo Kokoro en el init de speaches; volumen de caché existente. No se agregan dependencias npm ni servicios nuevos.
- **Compatibilidad**: todos los campos nuevos son opcionales y con defaults conservadores. Los canales y flujos existentes siguen respondiendo solo texto hasta que se active la voz.
- **Fuera de alcance**: audio saliente por WhatsApp y chat web, voz para el orquestador global, entrada de audio por canales distintos de Telegram (ya cubierta o excluida por `add-transcription-nodes-and-channel-media`), clonación de voz, streaming TTS y edición de audio.
