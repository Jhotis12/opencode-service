# Spec Delta

## ADDED Requirements

### Requirement: Secret references in HTTP workflow actions
El sistema SHALL permitir que un nodo `http` referencie secretos del proyecto para headers y campos sensibles del body, y una integración HTTP para resolver el `baseUrl`, sin persistir valores secretos en `workflow.json`, snapshots de versión, logs ni contexto del agente. La resolución SHALL ocurrir en el servidor antes de la petición.

#### Scenario: Header resuelto desde la bóveda
- **WHEN** un nodo `http` declara un header cuyo valor es el alias de un secreto del proyecto
- **THEN** el servidor resuelve el secreto en memoria, envía el header y el paso termina en `succeeded`

#### Scenario: Secreto no aparece en el workflow ni en el snapshot
- **WHEN** un usuario guarda o versiona un workflow con un header secreto
- **THEN** solo se persiste el alias, nunca el valor en claro, y el snapshot contiene el mismo alias

#### Scenario: Alias de otro proyecto es rechazado
- **WHEN** un nodo `http` referencia un alias de un proyecto hermano o del plano global
- **THEN** el paso falla antes de la petición y registra el alias y el scope denegado sin exponer el valor

#### Scenario: Alias inexistente falla con mensaje accionable
- **WHEN** un nodo `http` referencia un alias que ya no existe
- **THEN** el paso falla antes de la petición con un mensaje que identifica el alias faltante

#### Scenario: Base URL desde una integración HTTP
- **WHEN** un nodo `http` referencia una integración HTTP del proyecto y un path relativo
- **THEN** el servidor compone la URL con el `baseUrl` de la integración y aplica el scope del proyecto

### Requirement: Database access policy
El sistema SHALL asignar a cada integración de base de datos una política visible con modo de acceso `read` o `write`, límite de filas y permiso de DDL, y SHALL rechazar antes de conectar cualquier operación que exceda esa política. La política SHALL aplicar a nodos `database`, a `ctx.db` y a la tool `db_query`.

#### Scenario: Integración de solo lectura rechaza escrituras
- **WHEN** una integración tiene modo `read` y un nodo o tool intenta `INSERT`, `UPDATE`, `DELETE` o DDL
- **THEN** la operación se rechaza antes de abrir la conexión con un mensaje accionable

#### Scenario: Límite de filas se aplica a las consultas
- **WHEN** una consulta devuelve más filas que el `maxRows` configurado
- **THEN** el resultado se limita al máximo, se marca como truncado y el step registra el conteo devuelto

#### Scenario: DDL bloqueado por defecto
- **WHEN** una integración no tiene `allowDdl` habilitado y una operación intenta `CREATE`, `ALTER`, `DROP` o equivalente
- **THEN** la operación se rechaza y se registra como intento denegado

#### Scenario: Operación destructiva permitida y auditada
- **WHEN** una integración tiene `allowDdl` habilitado y una operación DDL válida se ejecuta
- **THEN** la operación se ejecuta y queda registrada con proyecto, integración, run, nodo y tipo de sentencia

#### Scenario: La política se aplica en el siguiente run
- **WHEN** un administrador cambia el modo de acceso o el límite de filas de una integración
- **THEN** los runs nuevos usan la política actualizada y los runs ya iniciados conservan la política con la que nacieron

### Requirement: Project approval routing configuration
El sistema SHALL permitir configurar en el proyecto una integración y un destinatario para aprobaciones, y SHALL usar ese destino cuando un run pausado no tenga un canal de origen. Solo las integraciones del proyecto SHALL ser seleccionables.

#### Scenario: Configurar canal de aprobación del proyecto
- **WHEN** un usuario guarda una integración y un destinatario de aprobación en los ajustes del proyecto
- **THEN** la configuración queda disponible solo para ese proyecto y se muestra en Recursos

#### Scenario: Run manual usa el canal de aprobación
- **WHEN** un run manual llega a un nodo `approval` y no tiene integración de origen
- **THEN** el sistema envía el prompt al canal y destinatario de aprobación del proyecto

#### Scenario: Run con origen usa su canal
- **WHEN** un run originado por Telegram, WhatsApp o chat externo llega a un nodo `approval`
- **THEN** el sistema usa el canal de origen en lugar del canal de aprobación por defecto

#### Scenario: Integración global no es seleccionable
- **WHEN** un usuario intenta configurar una integración global como canal de aprobación de un proyecto
- **THEN** la API rechaza la configuración con HTTP `422` y explica que debe ser una integración del proyecto

#### Scenario: Falta el canal de aprobación
- **WHEN** un run sin origen llega a una aprobación y el proyecto no tiene canal configurado
- **THEN** el run queda pausado, la UI lo muestra como pendiente y la readiness del proyecto indica que falta el canal

### Requirement: Automation action readiness
El sistema SHALL incluir en la readiness del proyecto las integraciones y la configuración requeridas por los nodos `notify` y `database` y por las aprobaciones, y SHALL mostrar la falta antes de ejecutar el flujo.

#### Scenario: Nodo notify sin integración
- **WHEN** un workflow tiene un nodo `notify` que referencia una integración inexistente o desconectada
- **THEN** la readiness del proyecto marca el recurso faltante y el run no inicia hasta corregirlo

#### Scenario: Nodo database sin integración
- **WHEN** un workflow tiene un nodo `database` que referencia una integración inexistente o de otro proyecto
- **THEN** la readiness del proyecto marca el recurso faltante y el run no inicia hasta corregirlo

#### Scenario: Aprobación sin canal
- **WHEN** un workflow tiene un nodo `approval` y el proyecto no tiene canal de origen posible ni canal de aprobación configurado
- **THEN** la readiness muestra una advertencia antes de ejecutar el flujo
