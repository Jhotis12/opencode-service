# Spec Delta

## ADDED Requirements

### Requirement: Reliable outbound notification delivery
El sistema SHALL enviar notificaciones salientes por la integración de proyecto seleccionada, con destinatario explícito cuando el canal lo requiera, y SHALL registrar cada intento con estado, timestamps e identificador del proveedor cuando esté disponible. Un reintento o replay del mismo nodo SHALL reutilizar la clave de acción y no reenviar una entrega ya confirmada.

#### Scenario: Entrega a Telegram con destinatario
- **WHEN** un nodo `notify` o la tool `notify` envía un mensaje por Telegram con un destinatario válido
- **THEN** el sistema entrega el mensaje y registra la entrega como `delivered` con el identificador del proveedor si existe

#### Scenario: Entrega a WhatsApp con destinatario
- **WHEN** un nodo `notify` o la tool `notify` envía un mensaje por WhatsApp con un destinatario válido
- **THEN** el sistema entrega el mensaje por el transporte conectado y registra el resultado

#### Scenario: Entrega a chat externo
- **WHEN** un nodo `notify` o la tool `notify` envía un mensaje por chat externo
- **THEN** el sistema entrega el payload firmado al `webhookUrl` y registra la respuesta HTTP

#### Scenario: Falta el destinatario requerido
- **WHEN** se intenta enviar por Telegram o WhatsApp sin destinatario
- **THEN** el sistema falla antes de llamar al proveedor con un mensaje que indica que el canal requiere destinatario

#### Scenario: Reintento no duplica una entrega confirmada
- **WHEN** un nodo `notify` se reintenta o se reproduce y la misma clave de acción ya figura como `delivered`
- **THEN** el sistema no vuelve a enviar el mensaje y devuelve el resultado de la entrega existente

#### Scenario: Fallo del proveedor queda registrado
- **WHEN** el proveedor rechaza o no responde dentro del timeout
- **THEN** el intento se registra como `failed` con un error sanitizado y el nodo aplica su política de reintento o error

### Requirement: Approval notifications for manual and scheduled runs
El sistema SHALL notificar las aprobaciones pendientes de runs manuales, programados, webhook y de canal al destino correspondiente, y SHALL permitir aprobar o rechazar desde el canal autorizado o desde la UI. Si no existe un destino, el run SHALL quedar visible como pendiente y la UI SHALL explicar qué configuración falta.

#### Scenario: Aprobación de un run manual
- **WHEN** un run manual llega a un nodo `approval` y el proyecto tiene canal de aprobación configurado
- **THEN** el sistema envía el prompt al canal y destinatario configurados y deja el run en `paused`

#### Scenario: Aprobación de un run programado
- **WHEN** un run iniciado por `schedule` llega a un nodo `approval` y el proyecto tiene canal de aprobación configurado
- **THEN** el sistema envía el prompt al canal configurado y el run permanece pausado hasta una decisión autorizada

#### Scenario: Aprobación de un run originado por canal
- **WHEN** un run originado por Telegram, WhatsApp o chat externo llega a un nodo `approval`
- **THEN** el prompt se envía al mismo canal y thread de origen

#### Scenario: Sin canal de aprobación
- **WHEN** un run sin origen llega a una aprobación y el proyecto no tiene canal configurado
- **THEN** el run queda pausado, la UI muestra la aprobación pendiente y se indica que falta configurar el canal

#### Scenario: Respuesta no autorizada
- **WHEN** un remitente fuera de la allowlist intenta aprobar o rechazar por un canal
- **THEN** el sistema rechaza la decisión, mantiene el run pausado y registra el intento

#### Scenario: Decisión consistente entre canal y UI
- **WHEN** una aprobación se resuelve por canal o por UI
- **THEN** el estado del run, el registro de aprobación y el evento SSE reflejan la misma decisión y el mismo actor
