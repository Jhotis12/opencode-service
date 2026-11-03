# Spec Delta

## ADDED Requirements

### Requirement: Native database action node
El sistema SHALL ejecutar un nodo `database` que resuelva una integración de base de datos del proyecto, soporte lectura y escritura con SQL parametrizado, agrupe sentencias en una transacción opcional y devuelva filas o conteo afectado al nodo siguiente. SHALL rechazar integraciones de otro proyecto y escrituras que la política de acceso de la integración no permita.

#### Scenario: Consulta de lectura devuelve filas
- **WHEN** un nodo `database` en modo lectura ejecuta un `SELECT` válido contra una integración del proyecto
- **THEN** el paso termina en `succeeded`, devuelve las filas al siguiente nodo y registra el conteo de filas

#### Scenario: Escritura transaccional confirma todos los cambios
- **WHEN** un nodo `database` en modo escritura ejecuta varias sentencias con transacción habilitada y todas terminan bien
- **THEN** el sistema confirma la transacción y devuelve el conteo afectado acumulado

#### Scenario: Fallo de escritura revierte la transacción
- **WHEN** una sentencia de un nodo `database` transaccional falla después de otra sentencia exitosa
- **THEN** el sistema revierte todos los cambios del nodo, marca el paso como fallido y no deja escrituras parciales

#### Scenario: Integración de otro proyecto es rechazada
- **WHEN** un nodo `database` referencia una integración que no pertenece al proyecto del run
- **THEN** el run falla antes de abrir la conexión y registra el intento sin exponer credenciales

#### Scenario: Integración de solo lectura rechaza escritura
- **WHEN** un nodo `database` intenta `INSERT`, `UPDATE`, `DELETE` o DDL contra una integración con acceso de solo lectura
- **THEN** el paso falla con un mensaje accionable y no ejecuta la sentencia

### Requirement: Native notification action node
El sistema SHALL ejecutar un nodo `notify` que envíe un mensaje por una integración de salida del proyecto, acepte un destinatario explícito cuando el canal lo requiera, renderice una plantilla con la entrada del nodo y registre el resultado de la entrega. SHALL rechazar integraciones de otro proyecto y destinatarios inválidos antes de enviar.

#### Scenario: Mensaje a Telegram con destinatario
- **WHEN** un nodo `notify` usa una integración de Telegram y proporciona un `recipient` válido
- **THEN** el mensaje se envía, el paso termina en `succeeded` y la entrega queda registrada

#### Scenario: Mensaje a WhatsApp con destinatario
- **WHEN** un nodo `notify` usa una integración de WhatsApp y proporciona un `recipient` válido
- **THEN** el mensaje se envía por el transporte conectado y la entrega queda registrada

#### Scenario: Chat externo sin destinatario
- **WHEN** un nodo `notify` usa una integración de chat externo y no proporciona destinatario
- **THEN** el mensaje se entrega al `webhookUrl` configurado y el paso termina en `succeeded`

#### Scenario: Falta el destinatario requerido
- **WHEN** un nodo `notify` usa Telegram o WhatsApp sin `recipient`
- **THEN** el paso falla antes de enviar con un mensaje que indica que el canal requiere destinatario

#### Scenario: Plantilla renderiza la entrada
- **WHEN** el mensaje del nodo `notify` contiene `{{input.nombre}}` y la entrada incluye `nombre`
- **THEN** el mensaje enviado contiene el valor resuelto y no el marcador literal

#### Scenario: Integración de otro proyecto es rechazada
- **WHEN** un nodo `notify` referencia una integración de otro proyecto o del plano global
- **THEN** el paso falla antes de enviar y registra el intento denegado

### Requirement: Uniform timeout, retry, and error policy
El sistema SHALL aplicar el timeout y la política de reintentos configurados a los nodos `code`, `agent`, `http`, `database` y `notify`, con backoff configurable, y SHALL ofrecer una ruta de error que reciba un payload estructurado cuando se agoten los reintentos. Los flujos sin ruta de error SHALL conservar el comportamiento actual de fallar el run.

#### Scenario: Timeout del nodo agent
- **WHEN** un nodo `agent` supera su `timeoutMs`
- **THEN** el paso termina en `timed_out`, se aborta la espera y el run no queda bloqueado

#### Scenario: Reintento con backoff en HTTP
- **WHEN** un nodo `http` falla con un error reintentable y tiene `maxRetries` mayor que cero
- **THEN** el sistema reintenta con el backoff configurado y registra cada intento

#### Scenario: Ruta de error recibe el fallo
- **WHEN** un nodo con estrategia `route` agota sus reintentos
- **THEN** el run continúa en el nodo destino de error con un payload que incluye el nodo fallido, el mensaje y el número de intentos

#### Scenario: Estrategia continue pasa el error
- **WHEN** un nodo con estrategia `continue` agota sus reintentos
- **THEN** el run sigue por la salida normal con un objeto de error como salida del paso

#### Scenario: Reintento reutiliza la clave de acción
- **WHEN** un nodo `notify` o `database` se reintenta
- **THEN** todos los intentos usan la misma clave de acción del run y del nodo para permitir deduplicación

### Requirement: Schedule lifecycle and timezone
El sistema SHALL evaluar los triggers `schedule` en una zona horaria IANA configurable, exponer la próxima ejecución, permitir activar o desactivar el schedule, aplicar una política de solapamiento y opcionalmente recuperar ventanas perdidas. Los valores por defecto SHALL conservar UTC, schedule activo y solapamiento `skip`.

#### Scenario: Schedule en zona horaria local
- **WHEN** un trigger `schedule` declara `timezone: "America/Mexico_City"` y un cron de las 09:00
- **THEN** el run se dispara a las 09:00 de esa zona y registra la ventana en UTC

#### Scenario: Schedule desactivado no dispara
- **WHEN** un trigger `schedule` tiene `enabled: false`
- **THEN** el scheduler no inicia runs para ese trigger y la próxima ejecución no se muestra como activa

#### Scenario: Solapamiento se omite por defecto
- **WHEN** un schedule dispara mientras el run anterior del mismo flujo sigue en `running` o `paused`
- **THEN** el scheduler omite la nueva ventana, registra el motivo `overlap_skip` y no crea un run duplicado

#### Scenario: Catch-up recupera ventanas perdidas
- **WHEN** el servidor estuvo detenido y el schedule tiene `catchUp` habilitado
- **THEN** el scheduler crea como máximo un run por ventana perdida dentro de la ventana de recuperación y usa la idempotencia por minuto

#### Scenario: Próxima ejecución visible
- **WHEN** un usuario consulta o edita un trigger `schedule`
- **THEN** la API y el inspector muestran la próxima ejecución calculada en la zona horaria configurada

#### Scenario: Cambio de horario de verano determinista
- **WHEN** una ventana cae en una hora repetida o inexistente por DST
- **THEN** el scheduler no ejecuta dos veces la misma ventana y, si `catchUp` está habilitado, ejecuta una sola vez la ventana omitida

### Requirement: Operable human approvals
El sistema SHALL exponer las aprobaciones pendientes por API y UI, permitir que un usuario autorizado apruebe o rechace, notificar al canal de origen o al canal de aprobación del proyecto, y aplicar `autoApprove` solo cuando esté configurado. Las decisiones no autorizadas SHALL rechazarse y auditarse.

#### Scenario: Aprobación desde la UI reanuda el run
- **WHEN** un run manual está pausado en un nodo `approval` y un usuario autorizado aprueba desde la UI
- **THEN** el run se reanuda desde el nodo de aprobación y registra quién decidió

#### Scenario: Rechazo desde la UI falla el run
- **WHEN** un usuario autorizado rechaza una aprobación pendiente
- **THEN** el run termina en `failed` con el motivo de rechazo y no ejecuta los nodos posteriores

#### Scenario: Aprobación programada notifica al canal del proyecto
- **WHEN** un run iniciado por `schedule` llega a un nodo `approval` y el proyecto tiene un canal de aprobación configurado
- **THEN** el sistema envía el prompt de aprobación a ese canal y deja el run en `paused`

#### Scenario: Aprobación de un run originado por canal
- **WHEN** un run originado por Telegram, WhatsApp o chat externo llega a un nodo `approval`
- **THEN** el prompt se envía al mismo canal de origen y solo una respuesta autorizada lo reanuda

#### Scenario: Decisión no autorizada
- **WHEN** un remitente fuera de la allowlist intenta aprobar o rechazar
- **THEN** el sistema rechaza la decisión, mantiene el run pausado y registra el intento

#### Scenario: autoApprove evita la pausa
- **WHEN** un nodo `approval` tiene `autoApprove: true`
- **THEN** el executor registra la aprobación automática y continúa sin crear una aprobación pendiente

### Requirement: Durable timers and one-off schedules
El sistema SHALL persistir esperas largas y fechas de ejecución única para que sobrevivan reinicios del proceso, y SHALL reanudarlas o ejecutarlas al arrancar según su política de recuperación. El nodo `delay` existente SHALL conservar su límite de 60 segundos para esperas en memoria.

#### Scenario: Espera de varios días sobrevive un reinicio
- **WHEN** un run entra en una espera durable de tres días y el servidor se reinicia
- **THEN** el run se reanuda automáticamente al vencer el timer y registra el step de espera

#### Scenario: Ejecución única en fecha futura
- **WHEN** un trigger `schedule` declara una ejecución única con `runAt` futuro
- **THEN** el sistema crea exactamente un run en esa fecha y no lo repite en días posteriores

#### Scenario: Fecha única perdida durante una caída
- **WHEN** el servidor estuvo detenido cuando vencía una ejecución única y `catchUp` está habilitado
- **THEN** el sistema ejecuta el run al arrancar una sola vez y registra la recuperación

#### Scenario: Timer duplicado es idempotente
- **WHEN** dos workers o reinicios intentan procesar el mismo timer
- **THEN** solo uno reclama la ventana y crea el run

### Requirement: Foreach batch execution
El sistema SHALL permitir ejecutar una lista de elementos a través de un subflujo o bloque de nodos, con concurrencia acotada, estado por elemento y una política de fallo configurable.

#### Scenario: Procesa cada elemento
- **WHEN** un nodo `foreach` recibe una lista de tres elementos
- **THEN** el run registra un resultado por elemento y el resultado final contiene los tres

#### Scenario: Fallo de un elemento con política continue
- **WHEN** un elemento falla y la política es `continue`
- **THEN** los demás elementos se procesan y el resultado final marca el elemento fallido sin perder los exitosos

#### Scenario: Fallo de un elemento con política stop
- **WHEN** un elemento falla y la política es `stop`
- **THEN** el lote se detiene, los elementos posteriores no se ejecutan y el run falla con el elemento responsable

#### Scenario: Concurrencia acotada
- **WHEN** el lote tiene más elementos que el máximo de concurrencia configurado
- **THEN** el sistema procesa como máximo ese número de elementos a la vez

### Requirement: Subworkflow invocation
El sistema SHALL permitir invocar un workflow del mismo proyecto como subworkflow, usando una versión inmutable y un payload explícito, y SHALL propagar el resultado o el fallo al workflow padre.

#### Scenario: Subworkflow usa una versión inmutable
- **WHEN** un nodo `subworkflow` referencia un workflow del proyecto
- **THEN** el sistema ejecuta la versión registrada y no el archivo que pueda cambiar durante el run

#### Scenario: Subworkflow respeta el scope del proyecto
- **WHEN** un subworkflow intenta usar una integración, agente o notebook de otro proyecto
- **THEN** la ejecución falla antes de ejecutar el primer nodo

#### Scenario: Fallo del subworkflow se propaga
- **WHEN** el subworkflow termina en `failed` o `timed_out`
- **THEN** el nodo padre recibe el error y aplica su política de error

#### Scenario: Ciclo de subworkflows se rechaza
- **WHEN** un workflow se invoca a sí mismo directa o transitivamente
- **THEN** el sistema rechaza la configuración antes de ejecutar

### Requirement: Run concurrency and outbound rate limits
El sistema SHALL aplicar límites de concurrencia por proyecto y de tasa de salida para notificaciones, encolando o rechazando el exceso con un estado explícito y sin perder trabajo aceptado. La cola SHALL sobrevivir reinicios.

#### Scenario: Límite de concurrencia alcanzado
- **WHEN** un proyecto alcanza su máximo de runs concurrentes y llega un nuevo run
- **THEN** el run queda en `queued` con una posición visible y se inicia cuando hay capacidad

#### Scenario: La cola sobrevive un reinicio
- **WHEN** el servidor se reinicia con runs en `queued`
- **THEN** el sistema los recupera y continúa despachándolos sin duplicarlos

#### Scenario: Rate limit de notificaciones
- **WHEN** un flujo intenta enviar más mensajes que el límite configurado en la ventana
- **THEN** el sistema espera o encola la entrega, registra el motivo y no descarta el mensaje

#### Scenario: Schedule con solapamiento y límite
- **WHEN** un schedule coincide con el límite de concurrencia del proyecto
- **THEN** el scheduler aplica la política de solapamiento y registra si omitió o encoló la ventana
