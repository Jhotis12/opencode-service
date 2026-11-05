# Design

## Context

Ver `proposal.md` para la motivación. El estado actual que condiciona el diseño:

- `packages/shared` ya tiene esquemas Zod para integraciones y varios nodos, pero `NodeSpecSchema.config` es un `Record<string, unknown>` y la validación real está repartida entre `graph.ts`, `execute-workflow.ts` y los formularios de `NodeInspector.tsx`.
- `ManageIntegrationsUseCase` ya soporta `PATCH`, pero la UI solo lo usa para alertas y política de base de datos. No existe un formulario de edición de canales.
- `IntegrationManager` crea el transporte de Telegram con `new Bot(token)` y arranca long polling; no llama a `getMe`, no detecta tokens duplicados ni conflictos de webhook.
- El ruteo de canales filtra triggers por `integrationId` y evento, sin exigir `kind === "integration"` ni capacidad `inbound_message`.
- La configuración de plataforma está repartida entre `process.env`, `system_settings`, la bóveda global y archivos del workspace. `Sentry` se lee solo desde `config.sentryDsn` al arrancar, aunque la UI guarde el DSN en la bóveda.
- La UI tiene dos editores de canales (`ProjectResourcesPanel` y `ControlChannelsPanel`) con defaults y campos distintos.
- El proceso es único, SQLite es el almacén y el proyecto es la unidad de aislamiento. No hay que introducir una cola distribuida ni un servicio externo.

## Goals / Non-Goals

**Goals:**

- Un contrato compartido de configuración para integraciones, nodos y ajustes, con defaults, metadata de campos y validación única.
- Edición de integraciones sin recrearlas, con pruebas de conexión reales y estado/error visible.
- Ruteo de canales y triggers correcto por kind, capacidad y evento.
- Una superficie de configuración por proyecto y una de plataforma, sin editores duplicados.
- Destinos de proyecto reutilizables por allowlist, alertas, aprobaciones y `notify`.
- Configuración efectiva con fuente visible y secretos enmascarados.
- Aplicar Sentry desde la UI y eliminar variables de entorno muertas.

**Non-Goals:**

- Implementar media, transcripción o email.
- Permitir varios workflows por canal o ruteo por intención/contenido.
- Exportar o migrar un proyecto como manifiesto físico.
- Escalado horizontal, leases distribuidas o cambios en la cola de runs.
- Reescribir el dominio de integraciones, la bóveda o el modelo de runs.

## Decisions

### 1. Registro compartido de configuración

Se crea un registro en `packages/shared` con una entrada por tipo de nodo y por kind de integración:

```ts
interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "boolean" | "select" | "textarea" | "json" | "code" | "custom";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  help?: string;
  visibleWhen?: (config: Record<string, unknown>) => boolean;
  secret?: boolean;
}

interface ConfigDefinition {
  schema: ZodType;
  defaults: Record<string, unknown>;
  fields: ConfigField[];
  secretFields?: string[];
  capabilities?: IntegrationCapability[];
  events?: string[];
}
```

El servidor usa `schema` y `defaults` en create/update/save/run. La web usa `fields` para renderizar y `visibleWhen` para mostrar/ocultar. Los campos complejos (SQL, `inputSchema`, reglas, código) se renderizan con widgets existentes referenciados por `type: "custom"` o `type: "json"`.

**Alternativas consideradas:**

- Derivar todo de Zod: pierde labels, orden, ayuda y visibilidad condicional.
- JSON Schema/OpenAPI: agrega una capa y dependencias sin resolver la metadata de UI.
- Mantener formularios a mano y agregar solo validación: no corrige la deriva, que es la causa raíz.

El registro se implementa de forma incremental: primero integraciones y triggers/notify/database; luego el resto de nodos. Los esquemas actuales se reutilizan y se mueven a la definición, sin cambiar el contrato de datos.

### 2. Editor único de integraciones

Se extrae un `IntegrationEditor` compartido con un prop `scope: "project" | "global"`. El editor tiene secciones:

- **Conexión:** token/secreto, modo de WhatsApp, `phoneNumberId`, `botUsername`, `botId`.
- **Comportamiento:** routing (`agent`, `workflow`, `hybrid`), allowlist, público.
- **Alertas:** eventos suscritos, destinatario, rate limit.
- **Avanzado:** JSON validado contra el contrato.

Crear y editar usan el mismo componente. En edición, el token solo se envía si el usuario escribe uno nuevo; el `secretRef` existente se conserva. El `integrationId` nunca cambia. `ProjectResourcesPanel` y `ControlChannelsPanel` quedan como wrappers del editor.

**Alternativa considerada:** mantener dos editores y compartir solo utilidades. Se descarta porque siguen divergiendo defaults, campos y mensajes.

### 3. Ciclo de vida de Telegram

- `TelegramTransport` expone `verify(): Promise<{ botId: string; username: string }>` que llama a `getMe` con timeout.
- `IntegrationManager.start` resuelve el token, verifica el bot, detecta duplicados y arranca polling. Si falla, persiste `status: "error"` y un `lastError` sanitizado, y devuelve el error al caller.
- Se agrega el estado `connecting` al enum de integración para que la UI muestre el intento en curso. Es un valor de texto; no requiere migración de columna.
- **Duplicados:** se comparan los tokens descifrados de las integraciones del mismo kind y se guarda en memoria un fingerprint SHA-256 durante `startAll`. Si dos integraciones comparten token, la segunda no arranca y queda en `error` con un mensaje que nombra la integración que ya lo usa. En create/update se hace la misma comprobación antes de persistir. No se agrega columna nueva.
- **Webhook:** si `getMe`/polling devuelve conflicto por webhook activo, no se borra automáticamente. Se devuelve un error accionable y se expone una acción explícita `clear webhook` en el editor. Esto evita destruir una integración que el usuario configuró a propósito.
- **Prueba:** `POST /test` acepta un `recipient` opcional. Sin recipient verifica `getMe`; con recipient envía un mensaje de prueba y reporta el `providerMessageId`. La UI de canales globales usa `alertRecipient` o pide un destinatario.
- `lastError` se muestra en la tarjeta de la integración y en salud. No se expone el token.

**Alternativa considerada:** usar webhook de Telegram en lugar de polling. Se descarta para este cambio porque el despliegue actual es de un solo proceso y el polling ya funciona; migrar a webhook requiere URL pública, TLS y manejo de secretos, y puede quedar como cambio posterior.

### 4. Ruteo y validación de triggers

- El router filtra `node.type === "trigger"`, `node.config.kind === "integration"`, `integrationId === integration.id`, capacidad `inbound_message` y evento soportado. Un trigger manual con `integrationId` viejo ya no consume mensajes.
- `validateWorkflowGraph` valida kind, capacidad y evento al guardar. La lectura de `workflow.json` sigue siendo tolerante para no bloquear proyectos existentes: un workflow con un evento desconocido se puede abrir, pero no guardar ni ejecutar hasta corregirlo.
- El catálogo de eventos vive en el registro: Telegram/WhatsApp/API exponen `message.received`; los kinds sin entrada no exponen eventos.
- Al cambiar el kind de un trigger, el editor reemplaza el config por los defaults del nuevo kind. Si el usuario cambia de integración a manual, se eliminan `integrationId` y `event`. La UI advierte que se descarta la configuración incompatible.
- La integración desconectada se rechaza en el run, no en la lectura. El guardado puede advertir para no impedir que el usuario termine de configurar el canal.

### 5. Superficie de configuración

La pestaña "Recursos" y la pestaña "Ajustes" del proyecto se reemplazan por una sola pestaña "Configuración" con subsecciones:

```text
Configuración del proyecto
  General      identidad, agente principal, modelo, aprobaciones, transcripción
  Conexiones   Telegram, WhatsApp, API, DB, HTTP, transcripción
  Canales      routing, allowlist, público, alertas
  Destinos     chats, emails, webhooks etiquetados
  Secretos     bóveda del proyecto
  Preparación  readiness y recursos faltantes
```

La configuración de plataforma sigue en "Ajustes" (modelo global, orquestador, proveedor, Sentry, bóveda global, canales del orquestador). El editor de integraciones es el mismo en ambos ámbitos; solo cambia el scope y las restricciones (un canal global no puede referenciar destinos de proyecto).

No se agregan rutas nuevas en React Router: la pestaña y sus subsecciones usan el estado existente, con un query param opcional para enlazar una subsección.

### 6. Destinos de proyecto

Se agrega la tabla aditiva `project_destinations`:

```text
id, project_slug, kind (telegram_chat | whatsapp | email | webhook | custom),
label, value, created_at, updated_at
```

Los campos que hoy aceptan un destinatario (`routing.allowlist[]`, `alertRecipient`, `approvalRecipient`, `notify.recipient`) aceptan un ID de destino o un valor crudo. El resolver comprueba primero si el valor corresponde a un destino del mismo proyecto; si no, lo trata como valor crudo. Esto mantiene compatibilidad total con datos existentes.

Al borrar un destino, el servidor busca referencias en integraciones, ajustes del proyecto y grafos de workflow; si hay referencias, rechaza el borrado y las lista. No se hace backfill automático: el usuario puede adoptar valores crudos como destinos etiquetados desde la UI.

**Alternativa considerada:** guardar destinos como JSON en `projects`. Se descarta porque no permite validar referencias ni listar usos con integridad.

### 7. Configuración efectiva

Se agrega `GET /api/config/effective` con dos ámbitos: plataforma y proyecto. Cada entrada devuelve:

```ts
{ key, value, source: "entity" | "project" | "platform" | "environment" | "default",
  secret: boolean, masked?: string, editable: boolean, restartRequired: boolean }
```

Precedencia: entidad (nodo/integración) > proyecto > plataforma (DB) > entorno > default. Los secretos se devuelven enmascarados. La UI muestra la fuente y deshabilita los campos que solo pueden venir del entorno.

Cambios concretos:

- `ORCHESTRATOR_MODEL`: se lee de `system_settings` y cae a `process.env.ORCHESTRATOR_MODEL`.
- `Sentry`: al crear la aplicación se usa `config.sentryDsn` o, si no existe, el secreto `setting:sentry_dsn` descifrado de la bóveda. El DSN se valida con `z.string().url()` antes de guardarlo.
- `SESSION_TTL_HOURS`: se cablea a `SessionCodec` (`horas * 3600`). Si no está, se mantiene el default de 7 días.
- `DATABASE_URL`: se elimina de `.env.example` porque SQLite es el almacén único y no hay soporte para esa variable.
- `OPENCODE_BASE_URL` y `OPENCODE_SERVICE_FILE`: se agregan a `docker-compose.yml` para que `.env.example` no documente variables que el contenedor ignora.

### 8. Inspector de nodos dirigido por contrato

`NodeInspector` deja de tener un `if` por tipo con campos escritos a mano. Pasa a renderizar los `fields` del registro y conserva componentes custom para:

- `inputSchema` y `outputSchema` (editor de campos).
- `rules` de validate.
- `statements` de database.
- `condition` de decision.
- `codeFile` y editor Monaco.

La validación de guardado y la de ejecución usan el mismo `schema`. Los defaults de `addNode` salen del registro, no de un objeto paralelo en `ProjectPage`.

**Alternativa considerada:** generar el formulario completo desde JSON Schema. Se descarta porque los widgets complejos y la visibilidad condicional requieren metadata propia.

### 9. Compatibilidad de API y datos

- Se mantienen los endpoints actuales de integraciones, settings, workflow y runs.
- Se agregan endpoints de destinos, configuración efectiva y prueba con recipient.
- `PATCH /integrations/:id` sigue aceptando `config` y `secrets`; el editor nuevo lo usa.
- No hay migración destructiva. `project_destinations` es aditiva. Los valores crudos siguen funcionando.
- El estado `connecting` es un valor nuevo de un campo de texto; no requiere migración.
- Los workflows existentes con eventos desconocidos se pueden leer, pero no guardar hasta corregirlos. La UI muestra el evento inválido y el catálogo disponible.

## Risks / Trade-offs

- **Refactor del inspector y del registro en un solo cambio** → migrar por tipo de nodo, empezando por trigger, notify y database; mantener pruebas de contrato para cada tipo y no eliminar el formulario actual hasta que el nuevo cubra todos los campos.
- **`getMe` agrega una dependencia de red al conectar** → timeout corto, error sanitizado y posibilidad de guardar la configuración aunque la verificación falle; el usuario puede reintentar sin perder datos.
- **Duplicados de token en datos existentes** → al arrancar, detectar y marcar la segunda integración en `error` con un mensaje claro; no borrar ni modificar tokens automáticamente.
- **Conflicto de webhook** → no borrar el webhook automáticamente; ofrecer una acción explícita y explicar el efecto.
- **Cambio de kind con pérdida de configuración** → la UI advierte antes de descartar claves incompatibles y permite cancelar.
- **Destinos con referencias** → validar referencias antes de borrar; si un valor crudo existente no se adopta, sigue funcionando.
- **Merge de pestañas** → mantener las subsecciones y los componentes actuales como wrappers para reducir el riesgo de regresión; agregar pruebas de navegación y de que no se duplican editores.
- **Sentry desde la bóveda** → si el master key no está disponible, el arranque ya falla hoy; no se agrega un modo inseguro. Si el DSN guardado es inválido, se ignora con un log y la UI muestra el error.
- **Eventos desconocidos en workflows existentes** → lectura tolerante, guardado/run estrictos y un mensaje de migración que sugiere `message.received`.

## Migration Plan

1. Agregar `project_destinations` con migración aditiva y backup previo del SQLite.
2. Introducir el registro compartido y migrar la validación de integraciones y de los nodos trigger/notify/database sin cambiar los datos persistidos.
3. Agregar `botId`/`botUsername` y `lastError` al flujo de conexión; no se requiere migración de columnas.
4. Cambiar el router y la validación de triggers. Los workflows con eventos desconocidos se leen, se marcan y no se guardan hasta corregirse.
5. Agregar endpoints de configuración efectiva y destinos; la UI nueva los consume.
6. Reemplazar las pestañas del proyecto por "Configuración" y el editor compartido; mantener los paneles actuales como wrappers durante la transición.
7. Aplicar Sentry desde la bóveda y cablear `SESSION_TTL_HOURS`; limpiar `.env.example` y `docker-compose.yml`.
8. Rollback: los endpoints nuevos son aditivos; la tabla de destinos se puede dejar sin uso. Si la UI nueva falla, se puede volver a montar los paneles antiguos sin revertir la base. Las conexiones de Telegram existentes conservan sus IDs y tokens.

## Open Questions

Ninguna que bloquee el diseño. La adopción de destinos etiquetados para valores crudos existentes queda como acción del usuario, no como migración automática.
