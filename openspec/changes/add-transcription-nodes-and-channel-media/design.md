# Design

## Context

Ver `proposal.md` para la motivación. El estado actual que condiciona el diseño:

- El adaptador de Telegram solo registra `message:text` y el contrato `IncomingIntegrationMessage` solo transporta `text`.
- Los turnos de chat y el nodo `agent` envían únicamente texto a OpenCode.
- OpenCode V2 acepta adjuntos `file://` o `data:` de imágenes (PNG/JPEG/GIF/WebP), PDF y texto, pero **no audio ni video**. La voz debe transcribirse antes.
- Los proyectos tienen `PROJECT_ISOLATION_PERMISSIONS` con `external_directory: deny`, por lo que los adjuntos deben vivir dentro del workspace del proyecto para que OpenCode los lea.
- Ya existen el contrato de integraciones, la bóveda de secretos por proyecto y la validación de recursos de workflow. La conexión ASR debe reutilizar ese contrato, no crear un almacenamiento paralelo.
- Hay un cambio en curso (`harden-chat-turn-lifecycle`) que toca `chat_messages` y los reintentos; la migración de adjuntos debe ser aditiva y coordinarse con ese trabajo.

## Goals / Non-Goals

**Goals:**

- Capturar imagen y audio desde Telegram y guardarlos de forma segura dentro del proyecto.
- Transcribir audio con una conexión configurable por proyecto, local (speaches) o terceros OpenAI-compatible.
- Entregar imágenes al agente como adjuntos nativos de OpenCode.
- Permitir que los workflows decidan explícitamente qué media aceptan y cuándo transcribir.
- Mantener compatibilidad total con flujos y canales que solo usan texto.
- Dejar operativo un entorno local con modelos preinstalados y una ruta clara para terceros.

**Non-Goals:**

- ASR para el orquestador global.
- Media en WhatsApp o subida de archivos desde el chat web.
- Nodo `vision` separado: la imagen se entrega al nodo `agent`.
- Proveedores no OpenAI-compatible (Deepgram, Gemini u otros con contrato distinto).
- Retención, limpieza automática o cuotas por remitente.
- Coalescencia de álbumes de Telegram en un solo turno.
- Generación o envío de media saliente.

## Decisions

### 1. La media vive dentro del workspace del proyecto

Los archivos se guardan en `<proyecto>/.opencode/media/<sha256>.<ext>`. La ruta es relativa al workspace y el nombre en disco es el hash del contenido, no el nombre original.

- **Por qué:** OpenCode necesita una URL `file://` absoluta legible por el servidor. Guardar fuera del proyecto choca con `external_directory: deny`; usar `data:` duplica el contenido en el prompt y en la base de OpenCode.
- **Alternativas descartadas:** `/data/channels/...` con `data:` (más simple de aislar, pero peor para adjuntos grandes y para la depuración); dejar que el agente use la tool `read` sobre una ruta (menos determinista y depende de que el agente decida leerla).
- **Validación:** tipo real por magic bytes, no solo el MIME declarado por Telegram; máximo 20 MiB por archivo; máximo 5 adjuntos por mensaje; duración máxima de audio configurable; extensión derivada del tipo detectado; permisos de archivo restrictivos.
- **Deduplicación:** el hash SHA-256 evita guardar el mismo archivo dos veces y hace que un reintento de Telegram sea idempotente.

### 2. La conexión ASR es una integración `transcription` del proyecto

Se agrega un `kind: "transcription"` al contrato de integraciones existente, con `baseUrl`, `model`, `language` opcional y `apiKey` opcional en la bóveda. La capacidad es `transcribe_audio`.

- **Por qué:** reutiliza el aislamiento por proyecto, la bóveda, la validación, el lifecycle y la UI de recursos. Permite tener speaches local y un proveedor tercero en el mismo proyecto sin mezclar secretos en `workflow.json`.
- **Alternativas descartadas:** variable de entorno global (el usuario pidió conexión configurable por nodo); URL y key directas en el nodo (secretos en el grafo y en los snapshots); una entidad nueva de “proveedores ASR” (duplicaría el contrato de integraciones).
- **Contrato del proveedor:** OpenAI-compatible. Transcripción por `POST {baseUrl}/audio/transcriptions` con `multipart/form-data`; descubrimiento por `GET {baseUrl}/models`. Si el proveedor no expone `/models`, el test falla pero la conexión puede guardarse y usarse igual.
- **Secretos:** la API key se guarda con el alias de la integración; el servicio la resuelve en memoria. El nodo solo guarda `integrationId`.

### 3. Modo agente transcribe en el router; modo workflow transcribe en el grafo

- **Modo agente:** no hay grafo donde poner un nodo. El router resuelve la conexión por defecto del proyecto, transcribe el audio antes de crear el turno y usa el transcript como mensaje. Si no hay conexión o falla, responde con un error claro y no inicia el turno.
- **Modo workflow:** el router guarda el audio y lo entrega como adjunto. El nodo `transcribe` decide cuándo convertirlo. Así el nodo tiene una función real, el flujo controla el coste y se evita transcribir dos veces.
- **Por qué no transcribir siempre en el router:** duplicaría coste y haría que el nodo `transcribe` fuera decorativo. La asimetría está justificada porque el modo agente no tiene nodos.
- **Contrato del payload:** el trigger de workflow recibe `{ message, senderId, integrationId, metadata, attachments }`; `attachments` contiene solo los tipos aceptados por el trigger.

### 4. `accepts` es opt-in y filtra adjuntos

`TriggerConfig` agrega `accepts: ("text" | "image" | "audio")[]` con default `["text"]`.

- **Por qué:** los flujos existentes no deben empezar a recibir fotos o audios por sorpresa. El default conserva el comportamiento actual.
- **Enrutamiento:** un mensaje coincide si contiene al menos un tipo aceptado. Los adjuntos no aceptados se descartan antes de construir el payload; el texto/caption siempre se conserva como contexto.
- **Alternativa descartada:** emitir eventos nuevos (`message.photo`, `message.voice`), que rompería triggers existentes y obligaría a duplicar triggers para mensajes mixtos.

### 5. OpenCode recibe imágenes como `file://`; el audio nunca se adjunta

- **Imágenes:** se resuelve la ruta absoluta, se valida que esté bajo `.opencode/media/`, y se pasa `files: [{ uri: pathToFileURL(...).href, name }]` en `session.prompt`.
- **Audio:** OpenCode no lo incluye en el request al modelo. Se transcribe y se envía el texto; el archivo queda como metadata/auditoría, no como adjunto.
- **Límites:** solo PNG, JPEG, GIF y WebP; 20 MiB por archivo; el recorte/redimensionado lo hace OpenCode con su configuración de `media.image`.
- **Alternativa descartada:** `data:` inline para todos los archivos; funciona, pero infla el payload y duplica el contenido en la base de OpenCode.

### 6. Persistencia aditiva para adjuntos y conexión por defecto

- `chat_messages.attachments_json`: guarda `MediaRef[]` del mensaje del usuario. Es necesario para que el reintento no pierda la imagen o el audio.
- `projects.transcription_integration_id`: guarda la conexión por defecto usada por el modo agente y por los nodos `transcribe` que no declaran una.
- **Por qué una columna y no solo el payload del turno:** el historial y el reintento leen el mensaje, no el payload original. Guardar solo en el turno perdería los adjuntos al reconstruir la conversación.
- **Migración:** `addColumnIfMissing`; columnas nullable; sin backfill. Coordinar con la migración de `turn_id` de `harden-chat-turn-lifecycle`.

### 7. El nodo `transcribe` tiene contrato propio y predecible

Config:

```ts
{
  integrationId?: string; // si falta, usa la conexión por defecto del proyecto
  model?: string;         // override del modelo de la conexión
  language?: string;      // override del idioma
  prompt?: string;        // contexto opcional para el ASR
  mediaPath?: string;     // default "attachments"
}
```

Salida:

```ts
{
  text: string;
  language?: string;
  durationSeconds?: number;
  segments?: Array<{ filename: string; text: string; language?: string; durationSeconds?: number }>;
}
```

- **Por qué un objeto y no un string:** conserva idioma, duración y segmentos para trazabilidad y para downstream; un string perdería esa información.
- **Múltiples audios:** se transcriben todos (hasta el límite) y se concatenan con separadores; `segments` conserva el detalle.
- **Validación:** `workflow-resources.ts` verifica que la integración exista, sea del proyecto, sea `transcription` y tenga `transcribe_audio`; si no hay `integrationId`, exige la conexión por defecto.
- **Errores:** el nodo es reintentable y respeta `retryPolicy` y `onError`; si no hay audio en `mediaPath`, falla con un mensaje accionable.

### 8. El nodo `agent` adjunta imágenes y advierte sobre audio

- `AgentNodeConfig` agrega `mediaPath` con default `"attachments"`.
- Se recolectan solo adjuntos de imagen, se valida la ruta y se pasan como `files` al prompt del agente.
- Si hay audio sin transcribir, el prompt lo declara explícitamente para que el agente no invente contenido.
- Si el modelo seleccionado no reporta `image` en `capabilities.input`, se registra una advertencia y la UI lo muestra.
- **Por qué no fallar ante audio:** un flujo puede querer solo registrar los metadatos del audio o procesarlo con un nodo `code`; fallar sería demasiado restrictivo.

### 9. Speaches local con modelos preinstalados; terceros con la misma interfaz

- `docker-compose` agrega un servicio `transcription` con `ghcr.io/speaches-ai/speaches:latest-cpu`.
- Un servicio de inicialización descarga `Systran/faster-whisper-base` y `Systran/faster-whisper-small` usando `POST /v1/models/{id}`. El volumen de caché de Hugging Face persiste entre reinicios.
- La conexión local por defecto apunta a `http://transcription:8000/v1` con modelo `Systran/faster-whisper-small`.
- Terceros: se crea otra integración `transcription` con `https://api.groq.com/openai/v1`, `https://api.openai.com/v1`, etc. La misma interfaz sirve para todos los OpenAI-compatible.
- **Por qué speaches:** acepta OGG/Opus de Telegram, es OpenAI-compatible, tiene imagen CPU/GPU y no agrega dependencias npm a la plataforma.
- **Alternativas descartadas:** whisper.cpp (requiere ffmpeg y un adaptador para `/inference`), Whisper embebido en Bun (dependencias nativas y decodificación de OGG), proveedor cloud por defecto (el usuario prefiere local).

### 10. UI: conexión en Recursos, selección en el nodo, default en Ajustes

- **Recursos:** formulario guiado con `baseUrl`, `model`, `language`, `apiKey`; botón “Probar conexión” que lista modelos y cachea `config.models`. El JSON avanzado sigue disponible.
- **Inspector del nodo:** selector de conexión del proyecto, modelo (hereda o override), idioma, prompt y `mediaPath`.
- **Ajustes del proyecto:** selector de conexión de transcripción por defecto.
- **Trigger:** checkboxes Texto / Imagen / Audio, solo para triggers de integración.
- **Modelos:** etiqueta de visión en los selectores cuando `capabilities.input` incluye imagen.

### 11. Observabilidad y seguridad

- Logs y métricas registran `projectSlug`, `integrationId`, tipo, tamaño, duración, resultado y latencia; nunca contenido, transcript ni secretos.
- Health muestra el estado de las conexiones de transcripción configuradas y su último test.
- El audio se envía al proveedor ASR configurado; con speaches local no sale de la infraestructura.
- No se agrega cuota por remitente en este cambio; se mitiga con allowlist, límites de tamaño/duración y la conexión por proyecto.

## Risks / Trade-offs

- **Latencia y RAM del ASR local** → modelo `small` por defecto, límite de duración, timeout configurable, health y opción de GPU; el modelo `base` queda como alternativa rápida.
- **OGG/Opus no soportado por algunos terceros** (por ejemplo ciertos modelos de OpenAI) → speaches y Groq lo aceptan; se valida con una nota de voz real y se documenta la limitación. No se agrega ffmpeg en este cambio.
- **Primera descarga de modelos** → servicio de init con volumen persistente; la primera ejecución puede tardar varios minutos y se documenta.
- **Modelo sin visión** → se expone `capabilities.input`, se advierte en la UI y se registra un warning en el run; OpenCode puede reemplazar la imagen por una nota si el proveedor la rechaza.
- **Crecimiento de almacenamiento y PII** → archivos con nombre hash, permisos restrictivos y retención fuera de alcance; se documenta como deuda operativa.
- **Aislamiento entre proyectos** → media bajo `.opencode/media/`, validación de rutas y de scope de la integración; tests de regresión.
- **Coordinación con `harden-chat-turn-lifecycle`** → migraciones aditivas y orden de despliegue; tests de reintento con adjuntos.
- **`file://` en despliegues separados** → hoy plataforma y OpenCode comparten contenedor; si se separan, habrá que usar un volumen compartido o `data:`.
- **Abuso de coste en canales públicos** → límites de tamaño/duración y allowlist; cuotas por remitente quedan como follow-up.
- **Álbumes de Telegram** → cada foto llega como mensaje separado; no se agrupan en este cambio.
- **Global orchestrator sin ASR** → el audio global se rechaza con un mensaje claro; se puede agregar un recurso global después.

## Migration Plan

1. Migración aditiva: `chat_messages.attachments_json` y `projects.transcription_integration_id`; sin backfill. Verificar que la migración de `harden-chat-turn-lifecycle` ya haya agregado `turn_id` o que ambas convivan.
2. Agregar `transcription` a `IntegrationKind` y `transcribe_audio` a las capacidades; las integraciones existentes no cambian.
3. Agregar `accepts` al trigger con default `["text"]`; los grafos existentes se leen sin reescribirse.
4. Desplegar el servicio `transcription` y su init de modelos; crear la integración local desde Recursos y probarla.
5. Configurar la conexión por defecto del proyecto; ejecutar una prueba con una nota de voz OGG/Opus real y una foto.
6. Rollback: las columnas son nullable y el servicio es opcional. Si se retira la conexión, el texto sigue funcionando y el audio se rechaza con un mensaje claro; los flujos con `transcribe` fallan de forma explícita hasta que se elimine el nodo o se restaure la conexión. No hay migración destructiva.

## Open Questions

- Política de retención y limpieza de media (fuera de alcance; no cambia el diseño).
- Modelos adicionales a `base` y `small` para GPU o despliegues con más RAM.
- ASR para el orquestador global y su recurso por defecto.
- Cuotas o rate limits por remitente para canales públicos.
- Coalescencia de álbumes de Telegram.
- Pin exacto de la imagen de speaches y comando de init en el entorno de despliegue.
