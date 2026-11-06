# Design

## Context

Ver `proposal.md` para la motivación. El estado actual que condiciona el diseño:

- El audio entrante de Telegram ya se descarga, valida y transcribe con una integración `transcription` y un nodo `transcribe` (cambio `add-transcription-nodes-and-channel-media`). Falta el camino inverso.
- `IntegrationEgressPort` solo envía texto; los adaptadores de Telegram y WhatsApp implementan `sendMessage`.
- El ejecutor de workflows ya resuelve integraciones del proyecto, valida recursos y persiste cada step. Los nodos de IA `agent` y `transcribe` son el patrón a seguir.
- `MediaStore` guarda archivos bajo `<proyecto>/.opencode/media/<sha256>.<ext>`, valida el tipo real y rechaza rutas fuera del workspace. Ya reconoce MP3, OGG, WAV y FLAC.
- speaches ya corre localmente para ASR y expone tambien `POST /v1/audio/speech` (OpenAI-compatible). Su limitación documentada es que **no genera Opus/AAC**.
- Telegram Bot API exige OGG/Opus para `sendVoice` y limita la nota de voz a 1–60 segundos; `sendAudio` acepta MP3.
- El proyecto usa defaults conservadores en los contratos compartidos: cualquier función nueva debe ser opt-in para no cambiar canales ni flujos existentes.
- `add-transcription-nodes-and-channel-media` sigue sin archivar; sus deltas y este cambio tocan el mismo router. Las migraciones y los cambios de contrato deben ser aditivos y convivir en cualquier orden.

## Goals / Non-Goals

**Goals:**

- Sintetizar voz con una conexión por proyecto, local o por API, sin acoplar el nodo a un proveedor.
- Responder con nota de voz nativa en Telegram solo cuando el usuario envió audio y el canal lo habilitó.
- Reutilizar el audio generado en workflows mediante un nodo `speak` y la entrega final del run.
- Degradar a texto o a archivo de audio cuando la síntesis o la conversión fallen, sin perder la respuesta.
- Mantener el flujo de texto intacto por defecto.

**Non-Goals:**

- Audio saliente por WhatsApp o chat web.
- Voz para el orquestador global.
- Entrada de audio por canales distintos de Telegram.
- Streaming de TTS, clonación de voz, edición o mezcla de audio.
- Caché de síntesis entre turnos o runs.

## Decisions

### 1. Una integración `speech` separada de `transcription`

Se agrega `kind: "speech"` al contrato de integraciones con `baseUrl`, `model`, `voice`, `speed` opcional, `responseFormat` opcional y `apiKey` opcional en la bóveda. Capacidad: `synthesize_speech`.

- **Por qué no extender `transcription`:** sus campos y su capacidad describen ASR. Mezclar TTS obligaría a tolerar configuraciones incompletas para una de las dos direcciones y a renombrar el kind existente. Dos integraciones pueden apuntar al mismo speaches local sin conflicto.
- **Alternativas descartadas:** URL y voz embebidas en el nodo (secretos en el grafo y en snapshots); variable de entorno global (el usuario pidió voz configurable por nodo); entidad nueva de proveedores de voz (duplicaría bóveda, lifecycle, aislamiento y UI).
- **Contrato:** `POST {baseUrl}/audio/speech` con `{ model, input, voice, response_format, speed }`; `Authorization: Bearer` solo si hay key. `GET {baseUrl}/models` para descubrimiento y prueba.
- **Validación de respuesta:** bytes no vacíos y tipo detectable (MP3/WAV/FLAC); se rechaza HTML o JSON de error. El formato se pide explícitamente y se verifica, no se confía solo en el header.
- **Límites:** 4 000 caracteres por síntesis, timeout de 120 s, velocidad 0.5–2.0. Sin streaming.

### 2. El motor local es speaches + Kokoro, y la API es el mismo contrato

El servicio `transcription` de `docker-compose` descarga `speaches-ai/Kokoro-82M-v1.0-ONNX` en su init. La conexión local usa `http://transcription:8000/v1`, ese modelo y la voz `ef_dora` (español) por defecto; `em_alex` y `em_santa` quedan como alternativas.

- **Por qué Kokoro:** 82M, CPU, licencia permisiva, voces en español y una sola imagen ya desplegada. Evita sumar un proceso, un binario o un modelo pesado.
- **Por qué el mismo contrato para API:** OpenAI, Groq y cualquier proveedor OpenAI-compatible funcionan sin código nuevo; el usuario puede cambiar de local a API cambiando solo la integración.
- **Alternativas descartadas:** Piper (mejores voces en español, pero exige binario/proceso y otro adaptador); TTS del sistema operativo (calidad y disponibilidad inconsistentes); proveedor cloud por defecto (el usuario prefiere local).
- **Descubrimiento de voces:** speaches no expone un endpoint de voces. La UI ofrece una lista conocida de voces Kokoro como sugerencias y acepta cualquier identificador libre para proveedores externos.

### 3. El nodo `speak` produce un `MediaRef` y no un base64

Config:

```ts
{
  integrationId?: string; // si falta, usa la conexión de voz por defecto del proyecto
  model?: string;
  voice?: string;
  speed?: number;         // 0.5–2.0
  textPath: string;       // default "text"
  maxChars?: number;      // default 4000
}
```

Salida:

```ts
{
  text: string;
  audio: MediaRef; // kind: "audio", path bajo .opencode/media/
}
```

- **Por qué un `MediaRef`:** los steps se persisten en SQLite; guardar bytes o base64 infla la base y el historial. El `MediaRef` reutiliza `MediaStore`, el hash de contenido y la validación de rutas.
- **Resolución del texto:** si el input es un string, se usa directamente; si es un objeto, se resuelve `textPath`. Un valor vacío o no-string falla antes de llamar al proveedor. Si supera `maxChars`, falla con error accionable; no se trunca en silencio.
- **Múltiples conexiones:** el nodo puede elegir una conexión del proyecto; si no, usa `project.speechIntegrationId`.
- **Validación:** `workflow-resources.ts` exige que la integración exista, sea del proyecto, sea `speech` y tenga `synthesize_speech`; si no hay `integrationId`, exige el default del proyecto. La validación corre al guardar y antes del run, como `transcribe`.

### 4. La respuesta automática vive en la entrega del turno, no en el agente

`ChannelRoutingSchema` agrega `voiceReplies: "never" | "auto"` con default `"never"`. En modo agente, el router pasa a la entrega si el mensaje original traía audio y si el canal tiene `auto`. `deliverChatTurn` sintetiza **después** de que el turno termina, para no duplicar trabajo ni mezclar TTS con el streaming del agente.

- **Por qué en la entrega:** el texto final ya está persistido y es el mismo que se envía por texto; TTS es transporte, no razonamiento. Si falla, la respuesta de texto sigue disponible.
- **Por qué solo modo agente:** en modo workflow no hay turno de chat; el flujo decide con `speak`. Así el nodo tiene una función real y no se sintetiza dos veces.
- **Resolución de la conexión:** `project.speechIntegrationId`. Si falta o falla, se envía texto y se registra un warning; el turno no se marca fallido.
- **Límite:** si la respuesta supera `maxChars` (4 000) o el audio supera 60 s, se envía texto o archivo MP3 según corresponda. Nunca se trunca el texto en silencio.
- **Idempotencia:** la síntesis ocurre una vez por intento de entrega; los reintentos de egress reutilizan los bytes ya generados. La entrega sigue usando `deliveries.actionKey` para no duplicar mensajes.

### 5. Egress de audio con conversión y fallback explícito

`IntegrationEgressPort` agrega `sendMedia(integrationId, media, recipient)`, con `media = { bytes, filename, mime, caption?, durationSeconds? }`. `IntegrationEgressRouter` registra un handler de media por integración; solo Telegram lo implementa en este cambio.

- **Telegram:** convierte a OGG/Opus (mono, 48 kHz) y usa `sendVoice` si la duración es 1–60 s. Si dura más, usa `sendAudio` con MP3. Si `ffmpeg` no está disponible o falla, usa `sendAudio` con el MP3 original.
- **Caption:** si el texto cabe en 1 024 caracteres, viaja como caption de la nota de voz; si no, se envía la nota de voz sin caption y luego el texto completo en un mensaje aparte. Nunca se corta el caption a mitad de frase.
- **Conversión:** `AudioConverterPort` con implementación ffmpeg/ffprobe sobre un archivo temporal con permisos restrictivos, borrado en `finally`. Devuelve bytes OGG y duración. La duración es necesaria para elegir `sendVoice` vs `sendAudio`.
- **Canales sin soporte:** el router de egress lanza un error explícito; no convierte audio a texto ni lo descarta en silencio.
- **Alternativa descartada:** pedir Opus directamente al proveedor. speaches no lo soporta y no todos los proveedores OpenAI-compatible lo garantizan; la conversión local hace el comportamiento uniforme.

### 6. La salida final de un workflow puede ser audio

`handleWorkflow` detecta si `run.output` es un objeto con `audio` (un `MediaRef` válido), resuelve el archivo con `readMedia` y lo entrega con `sendMedia`; usa `output.text` como caption. Si no hay audio, conserva el envío de texto actual.

- **Por qué en el router:** el flujo no conoce el canal ni el destinatario; la entrega es responsabilidad del gateway.
- **Persistencia de la entrega:** se reutiliza `deliveries` con `actionKey = run:<runId>:output` para que un reintento no duplique el audio y para registrar fallos.
- **Alternativa descartada:** extender `notify` con audio. Duplicaría la configuración de voz y obligaría a que cada flujo agregue un nodo extra; `speak` ya expresa la intención.

### 7. Persistencia aditiva y ajustes del proyecto

- `projects.speech_integration_id`: columna nullable, `addColumnIfMissing`, sin backfill. La usan la respuesta automática y los nodos `speak` que no declaran conexión.
- `ProjectSettingsSchema` y el endpoint `PATCH /api/projects/:slug/settings` agregan `speechIntegrationId`.
- `readinessFor` agrega un ítem cuando hay un nodo `speak` sin conexión propia o un canal Telegram con `voiceReplies: auto` y no hay default.
- **Por qué una columna y no config del canal:** el default es del proyecto, igual que transcripción; evita repetirlo en cada canal.

### 8. UI guiada y voz configurable

- **Recursos:** `speech` aparece como “Voz (TTS)” con campos `baseUrl`, `model`, `voice`, `speed`, `responseFormat` y `apiKey`; botón “Probar conexión” que sintetiza una frase corta y lista modelos. La voz se edita como texto con sugerencias (`ef_dora`, `em_alex`, `em_santa`) para no bloquear proveedores externos.
- **Nodo `speak`:** inspector con conexión, modelo, voz, velocidad, ruta del texto y máximo de caracteres. La voz del nodo gana sobre la conexión.
- **Canal:** control “Responder con audio cuando llegue audio” que escribe `routing.voiceReplies`; el mapeo plano→anidado sigue el patrón de `mode`, `allowlist` y `public` en `config-field-utils.ts`.
- **Ajustes del proyecto:** selector de conexión de voz por defecto y texto de ayuda; el readiness muestra el faltante.
- **Compatibilidad:** los formularios existentes no cambian; el nuevo kind solo aparece al crear una integración.

### 9. Despliegue local

- `Dockerfile`: agregar `ffmpeg` al `apt-get install` de la etapa runtime.
- `docker-compose.yml`: el init de speaches descarga tambien `speaches-ai/Kokoro-82M-v1.0-ONNX`; el volumen `whisper-models` ya persiste el caché.
- README: conexión local `http://transcription:8000/v1`, modelo Kokoro, voz `ef_dora`, y nota de que `ffmpeg` es necesario para la burbuja nativa (sin él se envía MP3).
- **Sin dependencias npm nuevas:** `fetch`, `FormData` y `Blob` ya se usan en ASR.

### 10. Observabilidad y seguridad

- Métricas: `speech_requests`, `speech_succeeded`, `speech_failed`, `voice_reply_sent`, `voice_reply_fallback`, `audio_converted`, `audio_conversion_failed`.
- Logs con `projectSlug`, `integrationId`, `runId`/`turnId`, modelo, voz, caracteres, duración, bytes, latencia y resultado; nunca texto, audio, key ni payload crudo del proveedor.
- La API key se resuelve en memoria desde la bóveda; el nodo solo guarda `integrationId`.
- El audio generado se escribe con los permisos restrictivos de `MediaStore`; la lectura valida que la ruta esté bajo `.opencode/media/`.
- Health muestra las conexiones `speech` con su último test y error sanitizado.

## Risks / Trade-offs

- **Calidad/latencia de Kokoro en CPU** → modelo 82M, límite de 4 000 caracteres, timeout de 120 s, fallback a texto y opción de proveedor externo.
- **Telegram limita la nota de voz a 60 s** → `sendAudio` para audios largos; se mide con ffprobe y se prueba el límite.
- **speaches no genera Opus** → conversión local con ffmpeg; si falta, se envía MP3 como archivo de audio.
- **`sendVoice` con caption de 1 024 caracteres** → caption solo si cabe; si no, audio + texto separado.
- **Primera descarga del modelo Kokoro** → init con volumen persistente; la primera ejecución puede tardar y se documenta.
- **Audio generado ocupa disco** → hash y deduplicación de `MediaStore`; retención y limpieza quedan como deuda operativa.
- **Doble entrega en reintentos** → reutilizar los bytes sintetizados dentro del intento y `deliveries.actionKey` para la salida de workflow.
- **Proveedor externo con voces/modelos distintos** → campos libres y prueba real; no se valida una lista cerrada.
- **SSRF y fuga de secretos** → mismo modelo de confianza que las integraciones existentes, timeout, sanitización y bóveda; no se registran payloads.
- **Convivencia con `add-transcription-nodes-and-channel-media`** → contratos y migraciones aditivas; el router se toca en puntos distintos (transcripción al entrar, voz al salir). Verificar ambos cambios juntos antes de archivar.
- **Canales sin audio** → error explícito; el texto sigue funcionando y no se finge una entrega.

## Migration Plan

1. Migración aditiva `projects.speech_integration_id` (nullable, sin backfill). Verificar que convive con las migraciones de `add-transcription-nodes-and-channel-media` y `harden-chat-turn-lifecycle`.
2. Agregar `speech` a `IntegrationKind`, `synthesize_speech` a capacidades, `speak` a `NodeType`, `voiceReplies` a `ChannelRouting` y `speechIntegrationId` a settings; los datos existentes se leen con defaults.
3. Desplegar la imagen con `ffmpeg` y el init de Kokoro; el servicio de voz es opcional.
4. Crear la integración de voz local desde Recursos, probarla y marcarla como default del proyecto.
5. Activar `voiceReplies: auto` en el canal Telegram de prueba y validar nota de voz, caption, audio largo y fallback a texto.
6. Rollback: poner `voiceReplies: never` o limpiar el default; los flujos con `speak` fallan de forma explícita hasta que se quite el nodo o se restaure la conexión. La columna es nullable y no hay migración destructiva.
