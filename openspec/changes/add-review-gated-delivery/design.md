# Design

## Context

- OpenSpec 1.14.3 está instalado y el proyecto resuelve su raíz en `Opencode-server`; `openspec/config.yaml` usa hoy `schema: spec-driven`.
- OpenSpec soporta schemas locales en `openspec/schemas/<name>/`. `openspec schema fork` copia el schema built-in con sus plantillas y `openspec schema validate` verifica la estructura y las dependencias.
- Los skills `openspec-apply-change` y `openspec-archive-change` leen `operationGuidance` y lo tratan como consejo; el comando CLI de archive no expone hooks. La política de archive será por tanto prompt-level, no un candado del binario.
- El remoto es GitHub (`origin` → `Jhotis12/opencode-service.git`), la rama base es `main` y `gh` 2.102.0 está instalado. El árbol de trabajo puede tener cambios ajenos, así que los commits automáticos necesitan una compuerta de árbol limpio.

## Goals / Non-Goals

**Goals:**

- Que todo change nuevo use entrega con revisión por defecto, sin configuración por change.
- Un commit atómico por grupo de tareas, más un commit inicial de los artefactos de planificación.
- Abrir una PR automáticamente al terminar `apply`; una persona la revisa y la mergea.
- Bloquear el archive hasta que la PR esté mergeada.
- Mantener la política versionada en el repo, no en el paquete global de OpenSpec.

**Non-Goals:**

- Auto-merge o saltarse la revisión humana.
- Configurar CI, branch protection o reglas de GitHub (recomendado como siguiente paso, fuera de alcance).
- Migrar changes existentes al schema nuevo.
- Modificar la instalación global de `@fission-ai/openspec`.
- Cambiar código de producto.

## Decisions

### 1. Schema local derivado, no parche global

Se crea `review-gated-delivery` con `openspec schema fork spec-driven review-gated-delivery` y se fija en `openspec/config.yaml`.

Alternativas consideradas:

- Solo `rules`/`operations` en `config.yaml`: no puede cambiar la plantilla de `tasks` ni la instrucción de `apply`.
- Parchear el paquete instalado globalmente: afecta a otros proyectos, no queda versionado y se pierde al actualizar.

El schema local es el punto de extensión soportado, queda en git y sobrevive a actualizaciones de OpenSpec.

### 2. Conservar el grafo de artefactos

Se mantiene `proposal → specs → design → tasks`, con `apply.requires: [tasks]` y `apply.tracks: tasks.md`. No se agrega un artefacto de review.

Los skills instalados asumen este grafo y el review se expresa como handoff dentro de `tasks` y `apply`; un artefacto extra ampliaría el alcance sin aportar una verificación nueva.

### 3. Política de commits

- Primer commit de la rama: artefactos de planificación (`docs(openspec): plan <change-name>`).
- Un commit por cada grupo numerado de `tasks.md`, con mensaje `<type>(<change-name>): <resumen>` usando Conventional Commits (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`).
- Cada commit se verifica con `git log --oneline -1` y `git status --short` limpio antes de pasar al siguiente grupo.
- Los commits se documentan en el bloque obligatorio `## Workflow follow-up` de `tasks.md` y en la instrucción de `apply`, no como checkboxes. Así se evita el ciclo de marcar el checkbox del commit después de commitear.

### 4. Compuerta de árbol limpio y rama por change

Antes de tocar código, `apply` exige `git status --short` sin cambios ajenos al change. Si hay cambios sin relación, se detiene y pide al usuario que los commitee o los guarde en stash. La rama es `change/<change-name>`, creada desde la rama base del remoto. Si la rama ya existe, solo se reutiliza cuando corresponde al mismo change; si no, se detiene.

Esto evita arrastrar trabajo ajeno a la PR y es la única protección real contra commits accidentales.

### 5. PR automática al terminar apply

Al completar la última tarea:

1. `git push -u origin change/<change-name>`.
2. Resolver la base con `gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'` (fallback `main`).
3. `gh pr create --base <base> --head change/<change-name> --title "<change-name>: <resumen>" --body <cuerpo>`.
4. Reportar la URL de la PR. No ejecutar merge.

El cuerpo de la PR incluye la ruta del change, un resumen de lo hecho, los comandos de verificación ejecutados y una instrucción explícita de revisar y mergear. Antes de empezar se comprueba `gh auth status`.

Si `gh` falta, no está autenticado, no hay remoto o falla la red, el flujo se detiene después de los commits locales, muestra los comandos manuales y deja la tarea de PR sin completar. No se reporta éxito ni se archiva.

### 6. Archive bloqueado hasta el merge

`openspec/config.yaml` añade `operations.archive.guidance` para que el skill de archive ejecute `gh pr view change/<change-name> --json state,mergedAt` y exija `mergedAt` distinto de null antes de mover el change. Si el change se acordó sin PR (opt-out explícito del usuario) o el remoto no es GitHub, se exige confirmación humana explícita.

Limitación aceptada: al no existir un hook en el CLI, esta regla es prompt-level. CI o branch protection la harían enforceable en el servidor; se deja como follow-up, no como parte de este change.

### 7. Opt-out explícito

Solo una petición explícita del usuario puede omitir la PR de un change concreto. En ese caso el resumen de `apply` lo registra y el archive exige confirmación humana. El default sigue siendo PR obligatoria.

## Risks / Trade-offs

- **[La guía es advisory]** → se refuerza en tres capas (instrucción de schema, `tasks` follow-up y `operations.apply.guidance`) y se valida con un smoke test. Riesgo residual hasta que exista branch protection.
- **[Árbol sucio con trabajo ajeno]** → compuerta de árbol limpio que detiene el flujo antes de crear rama o commit.
- **[`gh` sin permisos o sin red]** → preflight de autenticación y parada con comandos manuales; nunca éxito simulado.
- **[Drift respecto al `spec-driven` upstream]** → al actualizar OpenSpec, re-forkear o comparar el schema local con el built-in; el schema mantiene `version: 1`.
- **[Colisión de rama]** → reutilizar solo si la rama pertenece al mismo change; en caso contrario, detenerse.
- **[La revisión bloquea el archive]** → es el comportamiento buscado; el change permanece abierto hasta el merge.
- **[Commitear artefactos de planificación cambia la convención actual]** → aplica solo a changes futuros; los existentes conservan su schema y su historial.

## Migration Plan

1. Forkear y personalizar el schema.
2. Cambiar `openspec/config.yaml` al schema nuevo y agregar las guías de `apply`/`archive`.
3. Probar con un change temporal y borrarlo.
4. Los changes existentes no se migran: su `.openspec.yaml` ya fija el schema.

Rollback: volver `schema: spec-driven` en `openspec/config.yaml` y quitar las guías de `operations`; el directorio del schema puede conservarse o eliminarse sin afectar changes existentes.

## Open Questions

Ninguna.
