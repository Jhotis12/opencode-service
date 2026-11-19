# Arquitectura de workflows: capas y extensión

Este documento responde a una pregunta concreta: ¿el diseño actual aguanta tipos de
nodo nuevos, o cada nodo nuevo es una cirugía? La respuesta corta es que el contrato y
el registro están preparados para crecer, y que la validación y el motor no lo están:
un nodo nuevo toca archivos conocidos, pero varios de esos toques fallan en silencio si se
olvidan. Abajo está el mapa por capas, los huecos con líneas exactas, la lista de pasos
para añadir un tipo y un refactor priorizado que solo propone lo que el código justifica.

Todo lo que sigue se leyó del código de esta rama, no de `openspec/`.

## Veredicto

| Capa | Extensible hoy | Trabajo al añadir un nodo |
| --- | --- | --- |
| Contrato (`packages/shared/src/workflow.ts`) | Sí, enumeración cerrada | Añadir el tipo y su schema de config |
| Registro (`packages/shared/src/configuration.ts`) | Sí, exhaustivo por tipo | Una entrada obligatoria, el compilador la exige |
| Validación de servidor (`apps/server/src/domain/workflow/graph.ts`) | Parcial | Schema automático, invariantes a mano |
| Validación de cliente (`apps/web/src/components/canvas/graph-edits.ts`) | Parcial, ya divergente | Duplicar las invariantes en español |
| Motor (`apps/server/src/application/use-cases/execute-workflow.ts`) | No | Rama nueva en una cadena `if/else` de 470 líneas |
| Canvas y UI (`apps/web/src/components/`) | Sí, con 4 puntos de registro | Catálogo, icono, subtítulo, config |
| Herramientas del agente (`packages/opencode-plugin/src/tools.ts`) | Sí, por compartir schema | Nada obligatorio; falta descubrimiento |

## 1. Contrato y registro

`NodeTypeSchema` (`packages/shared/src/workflow.ts:3`) enumera los 15 tipos. `NodeSpecSchema`
(`workflow.ts:241`) es común a todos: `id` kebab-case, `position`, `config` como
`Record<string, unknown>`, `codeFile`, `agentId`, `modelOverride`, `notebookIds`,
`timeoutMs`, `retryPolicy` y `onError`. Eso significa que un tipo nuevo hereda gratis
timeout, reintentos, ruta de error y checkpoints; solo aporta su schema de `config`.

Cada tipo tiene su schema (`workflow.ts:68` a `workflow.ts:210`) y el registro los une:
`NodeConfigDefinition` (`configuration.ts:83`) declara `schema`, `defaults` y `fields`
(la metadata que pinta el inspector). `NODE_CONFIG_REGISTRY` está tipado como
`Record<NodeType, NodeConfigDefinition>` (`configuration.ts:501`), así que TypeScript
falla si el enum crece y la entrada falta. Los accesores
(`nodeConfigDefinition`, `defaultNodeConfig`, `validateNodeConfig`,
`configuration.ts:807-823`) son el único camino de lectura; `defaultNodeConfig` devuelve
`structuredClone`, así que los defaults del registro no se mutan.

El grafo completo está en `WorkflowGraphSchema` (`workflow.ts:265`) y la envoltura de
exportación en `workflow.ts:278`. Las versiones inmutables, con `graph` y `codeBundle`,
están en `WorkflowVersionSchema` (`workflow.ts:308`).

Esto es lo que hace que el diseño aguante: los nodos nuevos no necesitan columnas,
tablas ni endpoints nuevos. Un grafo con un tipo que el servidor entienda se guarda,
versiona, exporta y re-ejecuta sin código adicional.

## 2. Validación

Hay tres validadores y no uno:

1. **Schema de config por tipo**: `validateNodeConfig(node.type, node.config)`, llamado
   desde `validateWorkflowGraph` (`graph.ts:41-49`). Es automático por tipo nuevo.
2. **Invariantes del grafo**: `validateWorkflowGraph` (`apps/server/src/domain/workflow/graph.ts:36`)
   con una lista de `if (node.type === ...)` entre `graph.ts:85` y `graph.ts:160`:
   trigger único, kinds con ejecutor (`graph.ts:87`), `codeFile` en `code` (`graph.ts:109`),
   `agentId` en `agent` (`graph.ts:110`), `versionId` en `subworkflow` y `foreach`
   (`graph.ts:111-117`), reglas de `validate`, `delay`, `transform`, y las dos ramas
   obligatorias de `decision` (`graph.ts:149-160`). Después vienen ciclos y alcanzabilidad
   (`graph.ts:162-173`).
3. **Recursos por proyecto**: `validateWorkflowResources`
   (`apps/server/src/application/use-cases/workflow-resources.ts:11`) comprueba que cada
   referencia exista y sea del mismo proyecto: integración del trigger de canal, secreto
   del webhook, agente, conexión de transcripción o voz, notebooks. El comentario del
   archivo dice el motivo: que una referencia vieja no reviente a mitad del run.

El cliente repite el punto 2 en `getGraphIssues`
(`apps/web/src/components/canvas/graph-edits.ts:146`) para pintar el badge de problemas
y deshabilitar conexiones antes de guardar.

La duplicación ya se desvió. El cliente no valida `versionId` de `subworkflow` ni
`foreach`, ni los destinos de `onError.target`, ni que el cron sea válido: solo exige
que no esté vacío (`graph-edits.ts:176-179`). En el sentido contrario, el cliente exige
`mediaPath` en `transcribe` (`graph-edits.ts:198`) y el servidor no. Resultado: el canvas
puede mostrar el flujo limpio y el `PUT /api/projects/:slug/workflow`
(`apps/server/src/app.ts:1208`) responder 422 con `INVALID_WORKFLOW`, o al revés.

Los triggers duplican la lista de kinds: el enum está en `workflow.ts:22`, pero
`graph.ts:87` y `graph-edits.ts:175` la repiten en un array literal. Además hay cuatro
consumidores más que buscan el nodo trigger y su kind:
`project-settings.ts:104`, `route-channel-message.ts:316`, `external-chat.ts:98` y
`app.ts:711`.

## 3. Motor de ejecución

`ExecuteWorkflowRunUseCase` (`execute-workflow.ts:97`) recorre el grafo en un bucle con
`startNode` y `nextEdge` (`graph.ts:224-236`). La selección del nodo siguiente solo
entiende booleanos y solo para `decision` (`execute-workflow.ts:1159-1167`). Cualquier
tipo nuevo que no sea `decision` con una arista de salida avanza por `edges[0]`.

El despacho es una cadena `if/else` de `execute-workflow.ts:582` a `:1055`, un bloque por
tipo: `trigger`, `code`, `decision`, `http`, `database`, `notify`, `subworkflow`,
`foreach`, `delay`, `transform`, `validate`, `transcribe`, `speak`, `agent`, `approval`, y
al final `throw new Error("unsupported node type")` (`execute-workflow.ts:1055`).

Lo que sí es genérico alrededor de esa cadena:

- Checkpoint por paso: `insertStep` y `events.publish` de `run.updated` tras cada nodo
  (`execute-workflow.ts:1133-1155`).
- Reintentos con backoff (`execute-workflow.ts:1059-1076`), pero solo si el tipo está en
  la lista `retryable` (`execute-workflow.ts:539-546`), que es una enumeración a mano.
- Estrategias `continue` y `route` de `onError` (`execute-workflow.ts:1078-1129`), con
  payload de error estandarizado.
- Timeout (`NodeSpec.timeoutMs`) y `retryPolicy` vienen del schema común.
- Hash del grafo, versiones y replay no dependen del tipo de nodo.

Dos huecos concretos:

- Un tipo que se añade al enum pero no a la cadena guarda y valida sin problema, y
  falla en ejecución con `unsupported node type`. Los triggers sí tienen esa guarda
  (`graph.ts:87-89`, "no active executor yet"); los nodos no.
- `retryable` no se deriva de nada. Un nodo idempotente nuevo queda sin reintentos aunque
  el usuario configure `retryPolicy`.

`subworkflow` y `foreach` (`execute-workflow.ts:629-695`) lanzan runs hijos con
`launchedBy` literal. La UI los etiqueta en `runSourceLabel`
(`apps/web/src/api.ts:146-170`), otro switch que hay que tocar si un nodo nuevo lanza
hijos.

## 4. Canvas y UI

Registros, iconos y switches:

- `NODE_META` (`apps/web/src/components/nodes/node-catalog.ts:11`) es un
  `Record<NodeType, ...>`, así que el compilador obliga a añadir título, color y
  categoría.
- `NODE_CATALOG` (`node-catalog.ts:29`) y `PALETTE_GROUPS` (`node-catalog.ts:31`) son
  arrays sueltos. Un tipo que falte ahí existe en el motor pero no aparece en la paleta,
  y el build no avisa.
- `NodeIcon` (`apps/web/src/components/nodes/node-icons.tsx:3`) tiene `default`
  (`node-icons.tsx:112`), así que un icono olvidado cae en un círculo genérico.
- `subtitle()` en `WorkflowCanvas.tsx:32` es un switch con `default: undefined`; el nodo
  se pinta sin subtítulo.
- `NodeConfigFields.tsx:267` (`renderField`) traduce los `fields` del registro a
  controles; los `widget` personalizados viven en una cadena de `if` (`:277-514`). Un
  `widget` desconocido cae en el `input` de texto final (`NodeConfigFields.tsx:636-648`)
  sin error.

`ProjectFlowPage.addNode` (`apps/web/src/pages/ProjectFlowPage.tsx:149`) crea el nodo con
`defaultNodeConfig(type)` y ajusta `timeoutMs` para `transcribe`; `duplicateNode`
(`:187`) clona config y archivo de código. `connect` (`:244`) y `getConnectionIssue`
(`graph-edits.ts:34`) asumen que solo `decision` bifurca, y `connectNodes`
(`graph-edits.ts:84`) borra la arista previa del mismo origen para todo lo que no sea
`decision`.

El grafo editado es borrador hasta `saveWorkflowMutation`
(`apps/web/src/pages/project-workspace.tsx:268`), que publica "Flujo guardado" por la
barra de estado del layout (`ProjectLayout.tsx:120-124`). Los issues del cliente se
calculan en `project-workspace.tsx:206`.

## 5. Herramientas del agente

`workflow_get` (`packages/opencode-plugin/src/tools.ts:311`) lee el grafo y
`workflow_upsert` (`tools.ts:320`) lo escribe validando con `WorkflowGraphSchema`. Como el
schema es el mismo del canvas, un tipo nuevo funciona para el agente sin tocar el plugin.

Lo que falta es descubrimiento: el agente no tiene forma de leer
`NODE_CONFIG_REGISTRY` (labels, defaults, campos, widgets) ni la paleta. Tiene que
adivinar la forma de `config` y esperar un 422. En scope global la lista
`GLOBAL_READ_ONLY_TOOLS` (`tools.ts:260`) deja solo lectura, así que el orquestador no
tiene `workflow_upsert`.

## 6. Qué ya es extensible

- El par schema/registro está cerrado y exhaustivo por tipo; añadir un nodo no toca la
  base de datos, los endpoints ni el formato de exportación.
- Todo lo transversal (timeout, reintentos, `onError`, checkpoints, SSE, versiones,
  rollback, replay) se resuelve en estructuras comunes y no por tipo.
- `workflow_upsert` y el guardado del canvas validan con el mismo schema, así que UI y
  agente no pueden divergir en la forma del contrato.
- Los subflujos, los lotes y el replay ya demuestran que un nodo puede lanzar runs hijos
  y agruparlos (`parentRunId`, `launchedBy`) sin columnas nuevas.
- Los tests de dominio cubren el patrón: `packages/shared/test/config-registry.test.ts:41`
  recorre `NODE_CONFIG_REGISTRY` por tipo, y `apps/server/test/workflow-domain.test.ts:88`
  valida configs a través del registro compartido.

## 7. Huecos y riesgos, en orden de impacto

1. **Validación duplicada y desviada** entre `graph.ts:85-160` y
   `graph-edits.ts:146-245`. Cada nodo nuevo con invariantes propias hay que escribirla
   dos veces, y hoy ya no coinciden (ver sección 2).
2. **Bifurcación cableada a `decision`**: `graph.ts:160` prohíbe más de una salida,
   `nextEdge` (`graph.ts:230`) devuelve `edges[0]` sin condición y el motor solo calcula
   booleano para `decision` (`execute-workflow.ts:1159`). Un nodo tipo `switch` o
   `router` exige tocar esos tres sitios más las reglas de conexión del canvas.
3. **`retryable` y la cadena de despacho son listas a mano**. El primero falla en
   silencio; el segundo falla en runtime. Nada obliga a cubrir todos los `NodeType`.
4. **Catálogo no exhaustivo**: `NODE_CATALOG` y `PALETTE_GROUPS` son arrays. El tipo
   existe y no se puede añadir desde la UI.
5. **Fallbacks silenciosos de UI**: icono `default` y widget que degrada a texto. Un
   error de tecleo en `widget` no se nota hasta usarlo.
6. **Recursos por tipo a mano** en `workflow-resources.ts:11-97`. Sin bloque nuevo, una
   referencia rota no se detecta al guardar, solo al ejecutar.
7. **Kinds de trigger duplicados** en `graph.ts:87` y `graph-edits.ts:175`, más los cuatro
   consumidores de la sección 2.
8. **Sin descubrimiento para el agente**: no hay endpoint ni tool que exponga el registro.
9. **Etiquetas de runs hijos** en `api.ts:146-170` si el nodo nuevo lanza runs.

## 8. Checklist para añadir un tipo de nodo

Antes de tocar código, decide cuatro cosas: si bifurca, si llama recursos externos, si
lanza runs hijos y si necesita un widget propio. Cada respuesta añade pasos.

1. **Contrato**: añade el tipo a `NodeTypeSchema` (`packages/shared/src/workflow.ts:3`) y
   su `XConfigSchema` junto a los demás (`workflow.ts:68-210`). Nombra el tipo en kebab-case.
2. **Registro**: entrada en `NODE_CONFIG_REGISTRY` (`packages/shared/src/configuration.ts:501`)
   con `label`, `description`, `category`, `schema`, `defaults` y `fields`. Reutiliza los
   helpers `integrationField` (`configuration.ts:477`) y `destinationField`
   (`configuration.ts:492`) si referencias integraciones. Los defaults deben ser ejecutables o marcar
   `"__pending__"`, como hacen `database` y `subworkflow`.
3. **Metalenguaje del canvas**: `NODE_META` (`node-catalog.ts:11`), `NODE_CATALOG`
   (`:29`) y `PALETTE_GROUPS` (`:31`).
4. **Estética**: caso en `NodeIcon` (`node-icons.tsx:3`) y, si aporta, en `subtitle()`
   (`WorkflowCanvas.tsx:32`).
5. **Validación de servidor**: el schema se valida solo. Añade invariantes en
   `validateWorkflowGraph` (`graph.ts:85-160`) solo si dependen de campos de `NodeSpec`
   (`codeFile`, `agentId`) o de la forma del grafo (número de salidas).
6. **Validación de cliente**: replica esas invariantes en `getGraphIssues`
   (`graph-edits.ts:146`) con mensajes en español. Si el nodo bifurca, ajusta
   `getConnectionIssue` (`:34`), `connectNodes` (`:84`) y `changeEdgeCondition` (`:281`).
7. **Recursos**: bloque en `validateWorkflowResources` (`workflow-resources.ts:19-97`)
   si referencia integración, versión, agente o notebook.
8. **Motor**: rama en la cadena de `execute-workflow.ts:582-1055`, antes del `else`
   final. Si el nodo es idempotente o externo, añádelo a `retryable`
   (`execute-workflow.ts:539`). Si bifurca, extiende la selección de arista
   (`execute-workflow.ts:1159` y `nextEdge`, `graph.ts:230`). Declara `model` y `agentId`
   en el paso si aplican, y usa `events.publish` como los demás.
9. **Runs hijos**: si lanza subflujos, usa `launchedBy` y añade la etiqueta en
   `runSourceLabel` (`api.ts:146`).
10. **UI de configuración**: si necesitas un widget, añade el `if (field.widget === ...)`
    en `NodeConfigFields.tsx:277-514`. Si es un trigger, revisa `changeTriggerKind`
    (`NodeConfigFields.tsx:257`).
11. **Tests**:
    - `packages/shared/test/config-registry.test.ts` recorre el registro por tipo y exige
      defaults clonables; añade una aserción de config válida si el schema es nuevo.
    - `apps/server/test/workflow-domain.test.ts` para invariantes (patrón en
      `:88`, `:155`, `:161`, `:167`).
    - `apps/server/test/execute-workflow.test.ts` para el despacho y el checkpoint.
    - `apps/web/test/canvas-edits.test.ts` y `node-catalog.test.ts` para reglas y
      categorías; `node-inspector.test.tsx` y `project-canvas.test.tsx` si cambia el
      inspector o el canvas.
    - `e2e/platform.spec.ts` solo si la interacción del canvas cambia.
12. **Cierre**: `bun run typecheck`, `bun run test`,
    `bun test --cwd packages/shared`, y `graphify update .` para el grafo de código.

## 9. Refactor recomendado (solo lo que el código justifica)

**P0. Una sola fuente para las invariantes por tipo.** Extiende `NodeConfigDefinition`
(`configuration.ts:83`) con un validador opcional `validate(node, graph): string[]` o un
`NODE_VALIDATORS: Partial<Record<NodeType, ...>>` en shared, y consume ese validador desde
`graph.ts:36` y desde `graph-edits.ts:146`. Motivo medible: hoy hay dos implementaciones
que ya discrepan en varias reglas (sección 2), y cada nodo nuevo duplica el trabajo. Si
el validador compartido devuelve claves en vez de frases, la web traduce al español y el
servidor mantiene sus mensajes en inglés, como ya hace con los códigos de error.

**P1. Tabla de handlers por tipo en el motor.** Sustituye la cadena
`execute-workflow.ts:582-1055` por un `Record<NodeType, NodeHandler>` tipado, con
`retryable` como propiedad del handler y no una lista aparte. Motivo: convierte el
`throw unsupported node type` en un error de compilación y elimina el riesgo 3. Es el
cambio de mayor retorno por línea, pero también el de mayor riesgo: hazlo con la suite de
`execute-workflow.test.ts` en verde y sin tocar la lógica de checkpoints ni de error,
que se queda alrededor del handler.

**P1b. Generalizar la bifurcación.** Haz que `nextEdge` (`graph.ts:230`) reciba una
condición de arista (`string`) en vez de un booleano, y que cada handler devuelva la
condición elegida. Hoy `decision` es el único productor y el motor lo sabe; el día que
llegue un `switch`, ese acoplamiento es el que duele. Es un cambio acotado y se puede
hacer antes que P1.

**P2. Derivar la paleta del registro.** Calcula `NODE_CATALOG` y `PALETTE_GROUPS` desde
`NODE_CONFIG_REGISTRY` y su `category` en vez de mantener arrays. Motivo: elimina el
riesgo 4 sin tocar el motor. `NODE_META` se queda como está porque su color es decisión de
UI, no del contrato.

**P2b. Endpoint de tipos de nodo.** Expón `GET /api/workflow/node-types` (o incluye
`NodeConfigDefinition` en `workflow_get`) para que el agente y el orquestador lean
defaults, campos y widgets. Bajo riesgo, cierra el hueco 8 y evita configs adivinadas.

**No hacer todavía**: partir `execute-workflow.ts` en un archivo por tipo. El 90% del
archivo es persistencia, reintentos, error y reanudación compartidos; separarlo por tipo
duplicaría esa lógica y rompería el replay, que depende de que el checkpoint se escriba
en un solo sitio.

## 10. Cómo comprobarlo

```bash
bun run typecheck                 # shared -> plugin -> server -> web
bun run test                      # shared, server y web (no incluye opencode-plugin)
bun test --cwd packages/shared    # contratos y registro
bun run build && bun run test:e2e # solo si cambió el canvas
graphify update .
```

Un tipo nuevo está completo cuando: `bun run typecheck` pasa (el `Record<NodeType, ...>`
del registro y de `NODE_META` lo exige), los tests de dominio y del motor cubren el
nuevo camino, y el nodo aparece en la paleta, se configura en el inspector, se guarda sin
422 y ejecuta al menos un run con checkpoint.
