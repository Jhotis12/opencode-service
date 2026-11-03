# Spec Delta

## ADDED Requirements

### Requirement: Session context propagation for platform tools
El sistema SHALL atribuir cada llamada a una herramienta `platform_*` al agente y a la sesión de OpenCode que la invocó, y SHALL resolver el contexto de ejecución (`chat`, `workflow` o `external_channel`) desde esa sesión, sin asumir `chat` por defecto. Las sesiones desconocidas o expiradas SHALL recibir el contexto de menor privilegio o ser rechazadas.

#### Scenario: Nodo agent dentro de un workflow
- **WHEN** un nodo `agent` ejecuta una tool `platform_*` durante un run
- **THEN** la llamada incluye el agente y la sesión, el servidor la resuelve como `workflow` y aplica las reglas de ese contexto

#### Scenario: Chat web autenticado
- **WHEN** el agente principal del proyecto invoca una tool desde el chat web
- **THEN** la llamada se resuelve como `chat` y conserva las capacidades de diseño permitidas por su perfil

#### Scenario: Canal externo
- **WHEN** un agente responde desde Telegram, WhatsApp o chat externo e invoca una tool
- **THEN** la llamada se resuelve como `external_channel` y no puede mutar definiciones del workflow ni subagentes sin permiso explícito

#### Scenario: Sesión desconocida
- **WHEN** una tool recibe una sesión que no está registrada o ya expiró
- **THEN** el servidor aplica el contexto de menor privilegio o rechaza la operación y registra la sesión no reconocida

#### Scenario: Sesiones concurrentes no se contaminan
- **WHEN** dos sesiones del mismo proyecto ejecutan tools al mismo tiempo con agentes o contextos distintos
- **THEN** cada llamada conserva su propio agente y contexto y los permisos de una no se aplican a la otra

### Requirement: Integration discovery for project agents
El sistema SHALL exponer una herramienta de solo lectura para que un agente de proyecto descubra las integraciones de su propio proyecto, incluyendo identificador, tipo, capacidades, estado y nombre visible, sin secretos ni configuración sensible.

#### Scenario: Agente lista integraciones del proyecto
- **WHEN** un agente de proyecto invoca la herramienta de descubrimiento de integraciones
- **THEN** recibe solo las integraciones cuyo scope es ese proyecto, con identificadores utilizables en `db_query`, `notify` o triggers

#### Scenario: Integración de otro proyecto no aparece
- **WHEN** el proyecto A lista integraciones y el proyecto B tiene una integración del mismo tipo
- **THEN** la integración de B no aparece en el resultado

#### Scenario: Configuración sensible no se expone
- **WHEN** la herramienta devuelve una integración de base de datos o canal
- **THEN** el resultado excluye secretos, passwords, tokens, cadenas de conexión y valores de configuración sensibles

#### Scenario: Scope global no usa la herramienta de proyecto
- **WHEN** el orquestador global intenta invocar la herramienta de descubrimiento de integraciones de proyecto
- **THEN** la herramienta no está disponible en su inventario o la llamada se rechaza con HTTP `403`

### Requirement: Tool permission verdicts are auditable per invocation
El sistema SHALL registrar el resultado de cada verificación de permiso de una tool `platform_*` con proyecto, agente, sesión, contexto, tool y decisión, sin registrar el contenido de los argumentos ni secretos.

#### Scenario: Permiso denegado queda auditado
- **WHEN** un agente con una regla `deny` intenta invocar `db_query` desde un workflow
- **THEN** el sistema rechaza la llamada, registra `denied` con agente, sesión y contexto, y no ejecuta la operación

#### Scenario: Permiso permitido queda auditado
- **WHEN** un agente autorizado invoca `notify` desde su chat
- **THEN** el sistema registra la decisión `allowed` y el resultado de la entrega sin guardar el texto del mensaje

#### Scenario: La auditoría no filtra datos sensibles
- **WHEN** se registra una verificación de permiso
- **THEN** el log no contiene tokens, passwords, SQL completo ni cuerpos de mensajes
